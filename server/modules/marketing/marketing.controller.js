const { clientDB, adminDB } = require('../../config/db');
const { sendWhatsAppWelcomeToPhone, sendWhatsAppWelcomeByUserId } = require('../../services/whatsapp.service');
const { generateDailyMacroSummary, generateWeeklyMacroSummary } = require('../../services/svg.service');
const { INGREDIENT_REPORT_TYPES } = require('../../utils/constants');

async function submitWaitingList(req, res) {
  try {
    const { firstName, lastName, email, phone, goal, message } = req.body;
    if (!firstName || !lastName || !email) return res.status(400).json({ error: 'Missing required fields', message: 'First name, last name, and email are required' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format', message: 'Please provide a valid email address' });

    const normalizedEmail = email.toLowerCase();

    const { data: existingEntry, error: checkError } = await adminDB.from('waiting_list').select('id').eq('email', normalizedEmail).maybeSingle();
    if (checkError && checkError.code !== 'PGRST116') throw checkError;
    if (existingEntry) return res.status(400).json({ error: 'Email already registered', message: 'This email is already on the waiting list' });

    const { data, error } = await adminDB.from('waiting_list').insert([{
      first_name: firstName, last_name: lastName, email: normalizedEmail,
      phone: phone || null, goal: goal || null, message: message || null,
      created_at: new Date().toISOString(),
    }]).select();

    if (error) throw error;
    res.json({ success: true, data, message: 'Successfully joined waiting list' });
  } catch (error) {
    console.error('Error submitting waiting list entry:', error);
    res.status(500).json({ error: error.message || 'Failed to submit waiting list entry' });
  }
}

async function validateInvitationToken(req, res) {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ valid: false, error: 'Token is required' });

    let decodedToken;
    try {
      decodedToken = Buffer.from(token, 'base64').toString('utf-8');
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(decodedToken)) return res.status(400).json({ valid: false, error: 'Invalid token format' });
    } catch {
      return res.status(400).json({ valid: false, error: 'Invalid token format' });
    }

    const { data, error } = await adminDB.from('waiting_list').select('id, email, first_name, last_name, invitation_sent_at, invitation_used_at').eq('invitation_token', decodedToken).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return res.json({ valid: false, error: 'Invalid or expired invitation token' });
    if (data.invitation_used_at) return res.json({ valid: false, error: 'This invitation has already been used', used: true });

    res.json({ valid: true, data: { id: data.id, email: data.email, firstName: data.first_name, lastName: data.last_name } });
  } catch (error) {
    console.error('Error validating invitation token:', error);
    res.status(500).json({ valid: false, error: error.message || 'Failed to validate token' });
  }
}

async function markInvitationUsed(req, res) {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    let decodedToken;
    try {
      decodedToken = Buffer.from(token, 'base64').toString('utf-8');
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(decodedToken)) return res.status(400).json({ error: 'Invalid token format' });
    } catch {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    const { data, error } = await adminDB.from('waiting_list').update({ invitation_used_at: new Date().toISOString() }).eq('invitation_token', decodedToken).select();
    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Invitation token not found' });

    res.json({ success: true, message: 'Invitation marked as used' });
  } catch (error) {
    console.error('Error marking invitation as used:', error);
    res.status(500).json({ error: error.message || 'Failed to mark invitation as used' });
  }
}

async function submitContactForm(req, res) {
  try {
    const { fullName, email, phone, message, timestamp } = req.body;
    if (!fullName || !email || !message) return res.status(400).json({ error: 'Missing required fields', message: 'Full name, email, and message are required' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format', message: 'Please provide a valid email address' });

    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const { data, error } = await clientDB.from('contact_messages').insert([{
      full_name: fullName, email, phone: phone || null, message,
      ip_address: ipAddress, user_agent: userAgent,
      created_at: timestamp || new Date().toISOString(),
    }]).select();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Database error', message: 'Failed to save contact message' });
    }

    res.status(200).json({ success: true, message: 'Contact form submitted successfully', id: data[0]?.id });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to process contact form' });
  }
}

async function submitIngredientReport(req, res) {
  try {
    const { foodId, foodSnapshot, reportType, description, userCode } = req.body;
    if (!foodId) return res.status(400).json({ error: 'foodId is required' });
    if (!reportType || !INGREDIENT_REPORT_TYPES.includes(reportType)) return res.status(400).json({ error: 'reportType is required and must be one of: ' + INGREDIENT_REPORT_TYPES.join(', ') });
    if (!adminDB) return res.status(503).json({ error: 'Database not configured for ingredient reports' });

    const row = {
      food_id: String(foodId),
      food_snapshot: foodSnapshot || null,
      report_type: reportType,
      description: description && String(description).trim() ? String(description).trim() : null,
      reporter_user_code: userCode && String(userCode).trim() ? String(userCode).trim() : null,
      ip_address: req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown',
      user_agent: req.headers['user-agent'] || 'unknown',
    };

    const { data, error } = await adminDB.from('ingredient_reports').insert([row]).select('id, created_at');
    if (error) {
      console.error('ingredient_reports insert error:', error);
      return res.status(500).json({ error: 'Failed to save report' });
    }

    res.status(200).json({ success: true, id: data?.[0]?.id });
  } catch (err) {
    console.error('ingredient-reports error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function findRegistrationLink(req, res) {
  try {
    const link_id = req.query.link_id || req.body?.link_id || null;
    const manager_id = req.query.manager_id || req.body?.manager_id || null;

    if (!link_id && !manager_id) return res.status(400).json({ error: 'Either link_id or manager_id is required' });
    if (!adminDB) return res.status(503).json({ error: 'Registration links require CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY' });

    let row = null;
    if (link_id) {
      const { data, error } = await adminDB.from('registration_rules').select('id, link_id, manager_id, max_slots, current_count, expires_at, is_active').eq('link_id', link_id).maybeSingle();
      if (!error) row = data;
    } else {
      const { data, error } = await adminDB.from('registration_rules').select('id, manager_id, max_slots, current_count, expires_at, is_active').eq('manager_id', manager_id).maybeSingle();
      if (!error) row = data;
    }

    if (!row) return res.status(404).json({ error: 'Registration link not found' });
    return res.json({ ...row, link_id: row.link_id ?? null });
  } catch (e) {
    console.error('Error in registration-links find:', e);
    return res.status(500).json({ error: e.message });
  }
}

async function incrementRegistrationLink(req, res) {
  try {
    const { idOrLinkId } = req.params;
    if (!idOrLinkId) return res.status(400).json({ error: 'idOrLinkId is required' });
    if (!adminDB) return res.status(503).json({ error: 'Registration links require CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY' });

    const isNumericId = /^\d+$/.test(String(idOrLinkId));
    let q = adminDB.from('registration_rules').select('id, current_count');
    if (isNumericId) q = q.eq('id', parseInt(idOrLinkId, 10));
    else q = q.eq('link_id', idOrLinkId);

    const { data: existing, error: fetchErr } = await q.maybeSingle();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Registration link not found' });

    const newCount = (existing.current_count || 0) + 1;
    let upd = adminDB.from('registration_rules').update({ current_count: newCount });
    if (isNumericId) upd = upd.eq('id', parseInt(idOrLinkId, 10));
    else upd = upd.eq('link_id', idOrLinkId);

    const { error: updateErr } = await upd;
    if (updateErr) return res.status(500).json({ error: 'Failed to increment' });

    return res.json({ ok: true, current_count: newCount });
  } catch (e) {
    console.error('Error in registration-links increment:', e);
    return res.status(500).json({ error: e.message });
  }
}

async function weeklyMacroSummarySvg(req, res) {
  try {
    if (!adminDB) return res.status(503).json({ error: 'Admin database not configured' });
    const { user_code, phone_number, date } = req.query;
    const { contentType, buffer } = await generateWeeklyMacroSummary({ user_code, phone_number, date }, adminDB);
    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  } catch (error) {
    console.error('Error generating weekly macro summary SVG:', error);
    res.status(500).json({ error: error.message });
  }
}

async function dailyMacroSummarySvg(req, res) {
  try {
    if (!adminDB) return res.status(503).json({ error: 'Admin database not configured' });
    const { user_code, phone_number, date } = req.query;
    const { contentType, buffer } = await generateDailyMacroSummary({ user_code, phone_number, date }, adminDB);
    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  } catch (error) {
    console.error('Error generating daily macro summary SVG:', error);
    res.status(500).json({ error: error.message });
  }
}

async function validateLanding(req, res) {
  let { managerId, linkId } = req.body;
  console.log(`=== [HANDSHAKE] === Validating Schema Route for Manager: ${managerId || 'Unknown'}, Link: ${linkId || 'None'}`);

  if (!managerId && !linkId) return res.status(400).json({ error: 'INVALID_TOKEN_STRUCTURE' });

  try {
    let rule = null;
    let slotsRemaining = null, maxSlots = null, currentCount = 0, expiresAt = null, isSmartLinkActive = false;

    if (linkId) {
      const { data: ruleData, error: ruleErr } = await adminDB.from('registration_rules').select('manager_id, max_slots, current_count, expires_at, is_active').eq('link_id', linkId).maybeSingle();
      if (ruleErr) console.error('[-] Error fetching live campaign metrics:', ruleErr);

      if (ruleData) {
        rule = ruleData;
        if (!managerId) managerId = rule.manager_id;
        
        if (rule.is_active === false) return res.status(410).json({ error: 'This specific campaign track has been deactivated' });
        if (rule.expires_at && new Date(rule.expires_at) < new Date()) return res.status(410).json({ error: 'Campaign tracking parameters have expired on the server clock' });

        maxSlots = rule.max_slots ?? 30;
        currentCount = rule.current_count ?? 0;
        slotsRemaining = Math.max(0, maxSlots - currentCount);
        expiresAt = rule.expires_at;
        isSmartLinkActive = true;

        if (slotsRemaining <= 0) return res.status(403).json({ error: 'Registration thresholds reached. No remaining available slots' });
      } else if (!managerId) {
        return res.status(404).json({ error: 'Registration link not found' });
      }
    }

    if (!managerId) return res.status(400).json({ error: 'INVALID_TOKEN_STRUCTURE' });

    const { data: profile, error: profileErr } = await adminDB.from('profiles').select('name, role, company_id, companies(name, config)').eq('id', managerId).single();
    if (profileErr || !profile) return res.status(404).json({ error: 'Manager profile data records not found' });

    const companyData = profile.companies;
    if (!companyData) return res.status(404).json({ error: 'Associated corporate master profile missing' });

    return res.status(200).json({
      success: true,
      company: { id: profile.company_id, name: companyData.name, slug: companyData.name.toLowerCase().replace(/\s+/g, '').trim(), config: companyData.config || {} },
      manager: { name: profile.name, role: profile.role, id: managerId },
      campaign: { isSmartLink: isSmartLinkActive, maxSlots, currentCount, slotsRemaining, expiresAt },
    });
  } catch (globalFaultException) {
    console.error('[-] Fatal backend transaction collapse:', globalFaultException);
    return res.status(500).json({ error: 'Internal secure service validation cluster fault' });
  }
}

async function sendWhatsAppWelcome(req, res) {
  try {
    const { user_id, phone, language } = req.body;

    if (user_id) {
      const r = await sendWhatsAppWelcomeByUserId(user_id, clientDB);
      if (r.success) return res.json({ success: true, message: 'WhatsApp message sent successfully' });
      if (r.status === 500) return res.status(500).json({ error: r.message, success: false });
      return res.json({ success: false, message: r.message });
    }

    if (!phone) return res.status(400).json({ error: 'phone or user_id is required' });
    await sendWhatsAppWelcomeToPhone(phone, language);
    res.json({ success: true, message: 'WhatsApp message sent successfully' });
  } catch (error) {
    console.error('❌ Error in sendWhatsAppWelcome:', error);
    res.status(500).json({ error: error.message, success: false });
  }
}

// Legacy: send welcome to a raw phone number (no auth required)
async function sendWhatsAppWelcomeMessage(req, res) {
  try {
    const { phone, language } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });
    await sendWhatsAppWelcomeToPhone(phone, language);
    res.json({ success: true, message: 'WhatsApp message sent successfully' });
  } catch (error) {
    console.error('❌ Error in send-welcome-message:', error);
    res.status(500).json({ error: error.message, success: false });
  }
}

// Legacy: send welcome by user_id (no auth required)
async function sendWhatsAppWelcomeByUserIdHandler(req, res) {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });
    const r = await sendWhatsAppWelcomeByUserId(user_id, clientDB);
    if (r.success) return res.json({ success: true, message: 'WhatsApp message sent successfully' });
    if (r.status === 500) return res.status(500).json({ error: r.message, success: false });
    return res.json({ success: false, message: r.message });
  } catch (error) {
    console.error('❌ Error in send-welcome-by-user-id:', error);
    res.status(500).json({ error: error.message, success: false });
  }
}

module.exports = {
  submitWaitingList, validateInvitationToken, markInvitationUsed,
  submitContactForm, submitIngredientReport,
  findRegistrationLink, incrementRegistrationLink,
  weeklyMacroSummarySvg, dailyMacroSummarySvg,
  validateLanding,
  sendWhatsAppWelcome,
  sendWhatsAppWelcomeMessage,
  sendWhatsAppWelcomeByUserId: sendWhatsAppWelcomeByUserIdHandler,
};
