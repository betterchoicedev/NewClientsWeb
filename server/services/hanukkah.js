/**
 * Hanukkah "sufganiya challenge": log a sufganiya on each of the 8 nights, earn a badge.
 * Worked out from what the client actually logged, like the streak (services/streak.js) and
 * points (services/points.js): no table of its own, nothing to migrate, and deleting the log
 * takes the night away again.
 *
 * Nights: night 1 is the calendar day whose evening the first candle is lit, night 8 the day of
 * the eighth candle. A sufganiya counts for the night whose date is its `food_logs.log_date`
 * (the app sends the client's local day), so 00:30 after the first candle already counts for night 2.
 *
 * A log counts when one of its food items
 *   - carries the app's marker `challenge_ref.source === 'hanukkah'` (the one-tap button), or
 *   - is named like a sufganiya: סופגני(י)ה / סופגניות / sufganiya(h) / sufganiyot / donut / doughnut,
 *     so a photo, barcode or Beti log of one counts too.
 * One per night is enough; more do not add anything.
 */

const streak = require('./streak');

/** First night (first candle) of each Hanukkah. Add next year's before it starts. */
const SEASONS = [
  { year: 2026, firstNight: '2026-12-04' },
];
const NIGHTS = 8;

/** Names that count, in Hebrew and English (any case, any spelling the logs use). */
const SUFGANIYA_NAME = /סופגנ|sufgan|doughnut|donut|דונאט/i;
/** Item name fields the app, Beti and the photo analysis write. */
const NAME_FIELDS = ['name', 'item', 'name_he', 'name_en', 'hebrew_name', 'english_name', 'display_name'];
const MARKER = 'hanukkah';

const PAGE = 1000;
const MAX_PAGES = 5;

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || null;
  return err;
}

/** The 8 night dates of a season. */
function nightsOf(season) {
  return Array.from({ length: NIGHTS }, (_, i) => streak.addDays(season.firstNight, i));
}

/**
 * The season `today` belongs to: the first one that has not ended more than 30 days ago,
 * else the latest one. With `phase`: before / during / after.
 */
function seasonFor(today, seasons = SEASONS) {
  const sorted = [...seasons].sort((a, b) => a.firstNight.localeCompare(b.firstNight));
  const season =
    sorted.find((s) => streak.addDays(nightsOf(s)[NIGHTS - 1], 30) >= today) || sorted[sorted.length - 1];
  const nights = nightsOf(season);
  const phase = today < nights[0] ? 'before' : today > nights[NIGHTS - 1] ? 'after' : 'during';
  return { ...season, nights, phase };
}

function parseItems(raw) {
  if (raw == null) return [];
  try {
    const items = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

/** True when a food item is a sufganiya: the app's marker, or its name. Pure. */
function isSufganiyaItem(item) {
  if (!item || typeof item !== 'object') return false;
  const ref = item.challenge_ref;
  if (ref && typeof ref === 'object' && ref.source === MARKER) return true;
  return NAME_FIELDS.some((f) => typeof item[f] === 'string' && SUFGANIYA_NAME.test(item[f]));
}

/** True when any item of a food_logs row is a sufganiya. */
function isSufganiyaLog(row) {
  return parseItems(row?.food_items).some(isSufganiyaItem);
}

/**
 * The challenge for one season from the client's food_logs rows. Pure, no clock.
 * rows: [{ log_date, food_items }]
 */
function buildChallenge(rows, today, seasons = SEASONS) {
  const season = seasonFor(today, seasons);
  const logged = new Set();
  for (const row of rows || []) {
    const d = row?.log_date;
    if (typeof d === 'string' && d <= today && season.nights.includes(d) && isSufganiyaLog(row)) logged.add(d);
  }
  const nights = season.nights.map((date, i) => ({ night: i + 1, date, logged: logged.has(date) }));
  const tonightIdx = season.nights.indexOf(today);
  const done = nights.filter((n) => n.logged).length;
  return {
    id: `hanukkah-${season.year}`,
    year: season.year,
    today,
    phase: season.phase,
    startsOn: season.nights[0],
    endsOn: season.nights[NIGHTS - 1],
    nights,
    tonight: tonightIdx >= 0 ? nights[tonightIdx] : null,
    done,
    total: NIGHTS,
    badgeEarned: done === NIGHTS,
  };
}

async function loadRows(adminDB, userId, from, to) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const start = page * PAGE;
    const { data, error } = await adminDB
      .from('food_logs')
      .select('log_date, food_items')
      .eq('user_id', userId)
      .gte('log_date', from)
      .lte('log_date', to)
      .order('log_date', { ascending: true })
      .range(start, start + PAGE - 1);
    if (error) throw httpError(500, 'Could not read food_logs', 'db_error');
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/**
 * GET /api/challenges/hanukkah for the signed-in client: the 8 nights with which have a
 * sufganiya logged, tonight, done/total and `badgeEarned`. "Today" as in the streak.
 */
async function getHanukkah(userCode, { today: requested } = {}, { adminDB, now } = {}) {
  if (!userCode) throw httpError(403, 'No client profile for this account', 'no_user_code');
  const { data: user, error } = await adminDB
    .from('chat_users')
    .select('id, timezone')
    .eq('user_code', userCode)
    .maybeSingle();
  if (error) throw httpError(500, 'Could not read the client profile', 'db_error');
  if (!user) throw httpError(404, 'Client profile not found', 'no_chat_user');

  const today = streak.resolveToday(requested, { timeZone: user.timezone, now });
  const season = seasonFor(today);
  const last = season.nights[NIGHTS - 1];
  // Nothing can count before the first night; skip the read entirely.
  const rows = today < season.nights[0] ? [] : await loadRows(adminDB, user.id, season.nights[0], today < last ? today : last);
  return buildChallenge(rows, today);
}

module.exports = {
  SEASONS,
  NIGHTS,
  SUFGANIYA_NAME,
  nightsOf,
  seasonFor,
  isSufganiyaItem,
  isSufganiyaLog,
  buildChallenge,
  getHanukkah,
};
