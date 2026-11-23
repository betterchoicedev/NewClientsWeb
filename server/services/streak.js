/**
 * Streak on the server: worked out from what the client actually logged, so it is the same on
 * every phone, survives a reinstall, counts WhatsApp logs, and cannot be faked from the app.
 * Friends and the leaderboard read this, never the phone's own copy.
 *
 * Rules (the same as the app's src/features/rewards/logic/streak-rules.ts; keep both in sync):
 * - Logging anything (a meal, a drink, a workout) on a local calendar day keeps the streak.
 *   The count is the number of logged days in the current run.
 * - Freezes: +1 for every completed 7-day stretch (7, 14, 21...), hold at most 2. A missed day
 *   uses one automatically; without one the streak breaks. A frozen day keeps the run alive but
 *   does not add to the count.
 * - Today is never a missed day: the streak is still alive until the day after.
 *
 * Active days come from `food_logs.log_date` (meals and drinks; the app sends the local day)
 * and `training_logs.session_date` (workouts). No table of its own: nothing to migrate, and a
 * deleted log takes its day away again.
 */

const FREEZE_EVERY_DAYS = 7;
const FREEZE_CAP = 2;
/** How far back the replay looks. Longer runs than this show as this long. */
const HISTORY_DAYS = 400;
/** Recent active / frozen days returned to the app (enough for the 30-day challenge). */
const RECENT_DAYS = 120;
const PAGE = 1000;
const MAX_PAGES = 10;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || null;
  return err;
}

function isYmd(v) {
  return typeof v === 'string' && YMD.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
}

/** Calendar math at noon UTC, so DST never shifts a day. */
function addDays(ymd, days) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
}

/** The local calendar day in an IANA timezone (falls back to UTC). */
function ymdInZone(now, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/**
 * "Today" for this client: the app's local day when it sends a believable one (within a day of
 * the server's UTC day, so timezones from -12 to +14 fit), else the day in their saved timezone.
 */
function resolveToday(requested, { timeZone, now = new Date() } = {}) {
  const utc = now.toISOString().slice(0, 10);
  if (isYmd(requested) && Math.abs(daysBetween(utc, requested)) <= 1) return requested;
  return ymdInZone(now, timeZone);
}

/**
 * Replays every day from the first logged one to `today` with the rules above.
 * `activeDays`: iterable of YYYY-MM-DD (any order, duplicates fine). Pure, no clock.
 */
function replayStreak(activeDays, today) {
  const active = new Set([...activeDays].filter((d) => isYmd(d) && d <= today));
  const sorted = [...active].sort();
  const state = {
    currentStreak: 0,
    longestStreak: 0,
    freezes: 0,
    lastLoggedYmd: null,
    lastActiveYmd: null,
    frozenYmds: [],
  };
  if (sorted.length === 0) return { ...state, activeYmds: [] };

  for (let d = sorted[0]; d <= today; d = addDays(d, 1)) {
    if (active.has(d)) {
      state.currentStreak += 1;
      state.longestStreak = Math.max(state.longestStreak, state.currentStreak);
      if (state.currentStreak % FREEZE_EVERY_DAYS === 0 && state.freezes < FREEZE_CAP) state.freezes += 1;
      state.lastLoggedYmd = d;
      state.lastActiveYmd = d;
    } else if (d < today && state.currentStreak > 0) {
      if (state.freezes > 0) {
        state.freezes -= 1;
        state.frozenYmds.push(d);
        state.lastActiveYmd = d;
      } else {
        state.currentStreak = 0;
        state.lastActiveYmd = null;
      }
    }
  }
  return { ...state, activeYmds: sorted };
}

function daysToNextFreeze(currentStreak, freezes) {
  if (freezes >= FREEZE_CAP) return null;
  return FREEZE_EVERY_DAYS - (currentStreak % FREEZE_EVERY_DAYS);
}

/** Distinct values of one date column for one user, paged past PostgREST's row cap. */
async function loadDays(adminDB, table, dateCol, userId, since, today) {
  const days = new Set();
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE;
    const { data, error } = await adminDB
      .from(table)
      .select(dateCol)
      .eq('user_id', userId)
      .gte(dateCol, since)
      .lte(dateCol, today)
      .order(dateCol, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw httpError(500, `Could not read ${table}`, 'db_error');
    (data || []).forEach((row) => {
      if (isYmd(row?.[dateCol])) days.add(row[dateCol]);
    });
    if (!data || data.length < PAGE) break;
  }
  return days;
}

async function resolveChatUser(userCode, { adminDB }) {
  if (!userCode) throw httpError(403, 'No client profile for this account', 'no_user_code');
  const { data, error } = await adminDB.from('chat_users').select('id, timezone').eq('user_code', userCode).maybeSingle();
  if (error) throw httpError(500, 'Could not read the client profile', 'db_error');
  if (!data) throw httpError(404, 'Client profile not found', 'no_chat_user');
  return data;
}

/**
 * GET /api/streak for the signed-in client.
 * Returns the app's StreakState fields that the server owns, plus `today`, `loggedToday`
 * and `daysToNextFreeze`. Celebrations already shown and the 30-day challenge stay on the phone.
 */
async function getStreak(userCode, { today: requested } = {}, { adminDB, now } = {}) {
  const user = await resolveChatUser(userCode, { adminDB });
  const today = resolveToday(requested, { timeZone: user.timezone, now });
  const since = addDays(today, -HISTORY_DAYS);
  const [meals, workouts] = await Promise.all([
    loadDays(adminDB, 'food_logs', 'log_date', user.id, since, today),
    loadDays(adminDB, 'training_logs', 'session_date', user.id, since, today),
  ]);
  const s = replayStreak([...meals, ...workouts], today);
  return {
    today,
    currentStreak: s.currentStreak,
    longestStreak: s.longestStreak,
    freezes: s.currentStreak > 0 ? s.freezes : 0,
    lastLoggedYmd: s.lastLoggedYmd,
    lastActiveYmd: s.currentStreak > 0 ? s.lastActiveYmd : null,
    loggedToday: s.lastLoggedYmd === today,
    daysToNextFreeze: daysToNextFreeze(s.currentStreak, s.currentStreak > 0 ? s.freezes : 0),
    activeYmds: s.activeYmds.slice(-RECENT_DAYS),
    frozenYmds: s.frozenYmds.slice(-RECENT_DAYS),
  };
}

module.exports = {
  FREEZE_EVERY_DAYS,
  FREEZE_CAP,
  HISTORY_DAYS,
  addDays,
  daysBetween,
  ymdInZone,
  resolveToday,
  replayStreak,
  daysToNextFreeze,
  getStreak,
};
