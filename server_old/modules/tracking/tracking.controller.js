const { adminDB } = require('../../config/db');
const { verifyCalendarEventOwnership } = require('../../middlewares/auth');
const { HEALTH_MAX_EVENTS_PER_REQUEST } = require('../../utils/constants');
const { isIsoDate, isYmd } = require('../../utils/helpers');

// ─── Calendar Events ──────────────────────────────────────────────────────────

async function createCalendarEvent(req, res) {
  try {
    const { userCode, event } = req.body || {};
    if (!userCode) return res.status(400).json({ error: 'userCode is required' });
    if (!event || typeof event !== 'object') return res.status(400).json({ error: 'event payload is required' });

    const title = typeof event.title === 'string' ? event.title.trim() : '';
    if (!title) return res.status(400).json({ error: 'event.title is required' });
    if (!event.event_date) return res.status(400).json({ error: 'event.event_date is required' });

    const parsedDate = new Date(event.event_date);
    if (Number.isNaN(parsedDate.getTime())) return res.status(400).json({ error: 'event.event_date must be a valid ISO-8601 date string' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    const { data: userData, error: userError } = await adminDB.from('chat_users').select('id, user_code').eq('user_code', userCode).maybeSingle();
    if (userError) return res.status(500).json({ error: userError.message });
    if (!userData) return res.status(404).json({ error: 'User not found' });

    const insertData = { user_id: userData.id, user_code: userData.user_code || userCode, title, event_date: parsedDate.toISOString() };
    if (event.category !== undefined && event.category !== null) insertData.category = String(event.category);
    if (event.description !== undefined && event.description !== null) insertData.description = String(event.description);

    const { data, error } = await adminDB.from('calendar_events').insert([insertData]).select().single();
    if (error) throw error;
    return res.status(201).json({ data });
  } catch (error) {
    console.error('❌ Error in POST /api/calendar-events:', error);
    return res.status(500).json({ error: 'Failed to create calendar event', message: error.message });
  }
}

async function updateCalendarEvent(req, res) {
  try {
    const { id } = req.params;
    const { event } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Calendar event id is required' });
    if (!event || typeof event !== 'object') return res.status(400).json({ error: 'event payload is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    if (!req.userCode || !(await verifyCalendarEventOwnership(id, req.userCode))) return res.status(403).json({ error: 'Forbidden' });

    const updateData = {};
    if (event.title !== undefined) {
      const title = typeof event.title === 'string' ? event.title.trim() : '';
      if (!title) return res.status(400).json({ error: 'event.title cannot be empty' });
      updateData.title = title;
    }
    if (event.event_date !== undefined) {
      const parsedDate = new Date(event.event_date);
      if (Number.isNaN(parsedDate.getTime())) return res.status(400).json({ error: 'event.event_date must be a valid ISO-8601 date string' });
      updateData.event_date = parsedDate.toISOString();
    }
    if (event.category !== undefined) updateData.category = event.category === null ? null : String(event.category);
    if (event.description !== undefined) updateData.description = event.description === null ? null : String(event.description);

    if (Object.keys(updateData).length === 0) return res.status(400).json({ error: 'No editable fields provided' });

    const { data, error } = await adminDB.from('calendar_events').update(updateData).eq('event_id', id).select().single();
    if (error) throw error;
    return res.json({ data });
  } catch (error) {
    console.error('❌ Error in PUT /api/calendar-events/:id:', error);
    return res.status(500).json({ error: 'Failed to update calendar event', message: error.message });
  }
}

async function deleteCalendarEvent(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Calendar event id is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    if (!req.userCode || !(await verifyCalendarEventOwnership(id, req.userCode))) return res.status(403).json({ error: 'Forbidden' });

    const { data, error } = await adminDB.from('calendar_events').delete().eq('event_id', id).select();
    if (error) throw error;
    return res.json({ data });
  } catch (error) {
    console.error('❌ Error in DELETE /api/calendar-events/:id:', error);
    return res.status(500).json({ error: 'Failed to delete calendar event', message: error.message });
  }
}

// ─── Daily XP ─────────────────────────────────────────────────────────────────

async function getDailyXpToday(req, res) {
  try {
    const { userCode } = req.query;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    const { data: userData, error: userError } = await adminDB.from('chat_users').select('id').eq('user_code', userCode).maybeSingle();
    if (userError || !userData) return res.status(404).json({ error: 'User not found' });

    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await adminDB.from('view_user_daily_xp').select('total_xp, rank_title, actual_cals, target_cals').eq('user_id', userData.id).eq('log_date', today).maybeSingle();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error fetching daily XP (today):', error);
    res.status(500).json({ error: error.message });
  }
}

async function getDailyXpWeekly(req, res) {
  try {
    const { userCode } = req.query;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    const { data: userData, error: userError } = await adminDB.from('chat_users').select('id').eq('user_code', userCode).maybeSingle();
    if (userError || !userData) return res.status(404).json({ error: 'User not found' });

    const { data, error } = await adminDB.from('view_user_daily_xp').select('log_date, total_xp, rank_title').eq('user_id', userData.id).order('log_date', { ascending: false }).limit(7);
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching daily XP (weekly):', error);
    res.status(500).json({ error: error.message });
  }
}

// ─── Weight Logs ──────────────────────────────────────────────────────────────

async function getWeightLogs(req, res) {
  try {
    const { userCode } = req.query;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    const { data, error } = await adminDB.from('weight_logs').select('*').eq('user_code', userCode).order('measurement_date', { ascending: true });
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching weight logs:', error);
    res.status(500).json({ error: error.message });
  }
}

async function createWeightLog(req, res) {
  try {
    const { userCode, weightLogData } = req.body;
    if (!userCode || !weightLogData) return res.status(400).json({ error: 'User code and weight log data are required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    const insertData = {
      user_code: userCode,
      measurement_date: weightLogData.measurement_date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };

    const numericFields = ['weight_kg', 'body_fat_percentage', 'waist_circumference_cm', 'hip_circumference_cm', 'arm_circumference_cm', 'neck_circumference_cm', 'height_cm'];
    for (const field of numericFields) {
      if (weightLogData[field] !== undefined && weightLogData[field] !== null && weightLogData[field] !== '') {
        insertData[field] = parseFloat(weightLogData[field]);
      }
    }

    const { data, error } = await adminDB.from('weight_logs').insert([insertData]).select();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error creating weight log:', error);
    res.status(500).json({ error: error.message });
  }
}

// ─── Health Data ──────────────────────────────────────────────────────────────

function _validateHealthEvent(raw, idx) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: `events[${idx}]: must be an object` };
  const { metric_type, start_time, end_time, summary_value, unit, date, payload } = raw;
  if (typeof metric_type !== 'string' || !metric_type.trim()) return { ok: false, error: `events[${idx}]: metric_type required` };
  if (!isIsoDate(start_time) || !isIsoDate(end_time)) return { ok: false, error: `events[${idx}]: start_time/end_time must be ISO timestamps` };
  if (Date.parse(end_time) < Date.parse(start_time)) return { ok: false, error: `events[${idx}]: end_time before start_time` };
  if (summary_value != null && !Number.isFinite(Number(summary_value))) return { ok: false, error: `events[${idx}]: summary_value must be numeric` };
  if (unit != null && typeof unit !== 'string') return { ok: false, error: `events[${idx}]: unit must be a string` };
  if (date != null && !isYmd(date)) return { ok: false, error: `events[${idx}]: date must be YYYY-MM-DD` };
  if (payload != null && (typeof payload !== 'object' || Array.isArray(payload))) return { ok: false, error: `events[${idx}]: payload must be an object` };
  return {
    ok: true,
    value: {
      metric_type: metric_type.trim().toLowerCase(),
      start_time, end_time,
      summary_value: summary_value != null ? Number(summary_value) : null,
      unit: unit || null,
      date: date || start_time.slice(0, 10),
      payload: payload || {},
    },
  };
}

async function ingestHealthData(req, res) {
  try {
    if (!adminDB) return res.status(503).json({ error: 'Health storage not configured' });

    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const raw = Array.isArray(req.body?.events) ? req.body.events : null;
    if (!raw) return res.status(400).json({ error: 'Body must include `events` array' });
    if (raw.length === 0) return res.json({ ok: true, inserted: 0, summarized: 0 });
    if (raw.length > HEALTH_MAX_EVENTS_PER_REQUEST) return res.status(413).json({ error: `Too many events; max ${HEALTH_MAX_EVENTS_PER_REQUEST} per request` });

    const events = [];
    for (let i = 0; i < raw.length; i++) {
      const result = _validateHealthEvent(raw[i], i);
      if (!result.ok) return res.status(400).json({ error: result.error });
      events.push(result.value);
    }

    const eventRows = events.map((e) => ({
      user_id: userId,
      user_code: req.userCode || null,
      metric_type: e.metric_type,
      start_time: e.start_time,
      end_time: e.end_time,
      summary_value: e.summary_value,
      unit: e.unit,
      payload: e.payload,
    }));

    const { error: insertErr } = await adminDB.from('user_health_events').upsert(eventRows, { onConflict: 'user_id,metric_type,start_time,end_time', ignoreDuplicates: true });
    if (insertErr) return res.status(500).json({ error: 'Failed to store events' });

    const summaryMap = new Map();
    for (const e of events) {
      const key = `${e.date}|${e.metric_type}`;
      const prev = summaryMap.get(key);
      if (prev) { prev.total_value += Number(e.summary_value || 0); prev.sample_count += 1; }
      else summaryMap.set(key, { user_id: userId, user_code: req.userCode || null, date: e.date, metric_type: e.metric_type, total_value: Number(e.summary_value || 0), unit: e.unit, sample_count: 1, payload: {}, updated_at: new Date().toISOString() });
    }

    const summaryRows = Array.from(summaryMap.values());
    const { error: summaryErr } = await adminDB.from('user_health_daily_summary').upsert(summaryRows, { onConflict: 'user_id,date,metric_type' });
    if (summaryErr) return res.status(500).json({ error: 'Failed to update summary' });

    return res.json({ ok: true, inserted: eventRows.length, summarized: summaryRows.length });
  } catch (err) {
    console.error('[health/ingest] unexpected error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

async function getHealthSummary(req, res) {
  try {
    if (!adminDB) return res.status(503).json({ error: 'Health storage not configured' });

    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const metric_type = String(req.query.metric_type || '').trim().toLowerCase();
    const start_date = String(req.query.start_date || '').trim();
    const end_date = String(req.query.end_date || '').trim();

    if (!metric_type) return res.status(400).json({ error: 'metric_type required' });
    if (!isYmd(start_date) || !isYmd(end_date)) return res.status(400).json({ error: 'start_date / end_date must be YYYY-MM-DD' });

    const { data, error } = await adminDB.from('user_health_daily_summary').select('date, metric_type, total_value, unit, sample_count, user_code').eq('user_id', userId).eq('metric_type', metric_type).gte('date', start_date).lte('date', end_date).order('date', { ascending: true });
    if (error) return res.status(500).json({ error: 'Query failed' });

    res.json({ data: data || [] });
  } catch (err) {
    console.error('[health/summary] unexpected error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

module.exports = {
  createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  getDailyXpToday, getDailyXpWeekly,
  getWeightLogs, createWeightLog,
  ingestHealthData, getHealthSummary,
};
