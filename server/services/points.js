/**
 * Points (XP): worked out on the server from what the client actually logged, like the streak
 * (services/streak.js), so the weekly friends leaderboard compares real numbers.
 *
 * Per local day:
 *   meal        +10 for each food log, at most 5 a day
 *   water       +20 when the day's drinks reach the water target (35 ml/kg, +850 / +425 nursing)
 *   calories    +20 when the day ends within 10% of the calorie target (needs a target)
 *   protein     +20 when protein reaches 90% of the target (needs a target)
 *   workout     +30 for a day with a workout
 *   streak      +2 for each streak day, at most +20 (a 10-day streak and up)
 * Today's calorie points are live: they come and go as the day's total moves in and out of range.
 *
 * Levels: level n starts at 100 * n * (n - 1) total points (0, 200, 600, 1200, 2000...).
 * Weeks start on Sunday (Israel).
 */

const streak = require('./streak');

const RULES = {
  mealEach: 10,
  mealMaxPerDay: 5,
  water: 20,
  calories: 20,
  caloriesTolerance: 0.1,
  protein: 20,
  proteinShare: 0.9,
  workout: 30,
  streakPerDay: 2,
  streakMax: 20,
};
const HISTORY_DAYS = streak.HISTORY_DAYS;
const PAGE = 1000;
const MAX_PAGES = 20;

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || null;
  return err;
}

/** Same as the app's dailyWaterTargetMl (src/features/health-diary/utils/water-intake.ts). */
function waterTargetMl(weightKg, nursingStatus) {
  const kg = Number(weightKg);
  if (!kg || !Number.isFinite(kg)) return 2000;
  let ml = kg * 35;
  if (nursingStatus === 'exclusive') ml += 850;
  else if (nursingStatus === 'partial') ml += 425;
  return Math.max(250, Math.round(ml));
}

/** "150g" / 150 / "150 g" → 150; anything else → null. */
function grams(value) {
  const n = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function targetsOf(user) {
  const calories = Number(user?.daily_target_total_calories);
  const macros = user?.macros && typeof user.macros === 'object' ? user.macros : {};
  return {
    calories: Number.isFinite(calories) && calories > 0 ? calories : null,
    protein: grams(macros.protein),
    waterMl: waterTargetMl(user?.weight_kg, user?.nursing_status),
  };
}

function itemsWaterMl(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, it) => {
    const ml = Number(it?.water_ml);
    return sum + (Number.isFinite(ml) && ml > 0 ? Math.min(ml, 10000) : 0);
  }, 0);
}

/**
 * Points for one day. Pure.
 * day: { logs: number, calories, protein, waterMl, workout: boolean, streakCount }
 * Returns { total, parts: [{ key, points }] } with only the parts that scored.
 */
function scoreDay(day, targets) {
  const parts = [];
  const add = (key, points) => {
    if (points > 0) parts.push({ key, points });
  };
  add('meal', Math.min(day.logs, RULES.mealMaxPerDay) * RULES.mealEach);
  if (targets.waterMl && day.waterMl >= targets.waterMl) add('water', RULES.water);
  if (targets.calories && day.logs > 0 && Math.abs(day.calories - targets.calories) <= targets.calories * RULES.caloriesTolerance) {
    add('calories', RULES.calories);
  }
  if (targets.protein && day.protein >= targets.protein * RULES.proteinShare) add('protein', RULES.protein);
  if (day.workout) add('workout', RULES.workout);
  add('streak', Math.min(day.streakCount * RULES.streakPerDay, RULES.streakMax));
  return { total: parts.reduce((s, p) => s + p.points, 0), parts };
}

/** Level from total points: level n starts at 100·n·(n−1). */
function levelFor(total) {
  let level = 1;
  while (100 * (level + 1) * level <= total) level += 1;
  const start = 100 * level * (level - 1);
  const next = 100 * (level + 1) * level;
  return { level, points: total, levelStart: start, nextLevelAt: next };
}

/** Sunday of the week `ymd` is in. */
function weekStart(ymd) {
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return streak.addDays(ymd, -dow);
}

/** Streak count on each logged day (the replay's running count), for the streak bonus. */
function streakCountByDay(activeDays, today) {
  const active = new Set(activeDays);
  const sorted = [...active].sort();
  const byDay = new Map();
  if (sorted.length === 0) return byDay;
  let count = 0;
  let freezes = 0;
  for (let d = sorted[0]; d <= today; d = streak.addDays(d, 1)) {
    if (active.has(d)) {
      count += 1;
      if (count % streak.FREEZE_EVERY_DAYS === 0 && freezes < streak.FREEZE_CAP) freezes += 1;
      byDay.set(d, count);
    } else if (d < today && count > 0) {
      if (freezes > 0) freezes -= 1;
      else count = 0;
    }
  }
  return byDay;
}

/** Builds each day's totals from raw rows. Pure. */
function buildDays(foodRows, workoutDays) {
  const days = new Map();
  const day = (d) => {
    if (!days.has(d)) days.set(d, { logs: 0, calories: 0, protein: 0, waterMl: 0, workout: false, streakCount: 0 });
    return days.get(d);
  };
  for (const row of foodRows) {
    if (!row?.log_date) continue;
    const d = day(row.log_date);
    d.logs += 1;
    d.calories += Number(row.total_calories) || 0;
    d.protein += Number(row.total_protein_g) || 0;
    d.waterMl += itemsWaterMl(row.food_items);
  }
  for (const w of workoutDays) day(w).workout = true;
  return days;
}

async function loadRows(adminDB, table, columns, dateCol, userId, since, today) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE;
    const { data, error } = await adminDB
      .from(table)
      .select(columns)
      .eq('user_id', userId)
      .gte(dateCol, since)
      .lte(dateCol, today)
      .order(dateCol, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw httpError(500, `Could not read ${table}`, 'db_error');
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/**
 * GET /api/points for the signed-in client: today's points with their parts, this week's days
 * and total (Sunday to today), the all-time total (last 400 days) and the level.
 */
async function getPoints(userCode, { today: requested } = {}, { adminDB, now } = {}) {
  if (!userCode) throw httpError(403, 'No client profile for this account', 'no_user_code');
  const { data: user, error } = await adminDB
    .from('chat_users')
    .select('id, timezone, daily_target_total_calories, macros, weight_kg, nursing_status')
    .eq('user_code', userCode)
    .maybeSingle();
  if (error) throw httpError(500, 'Could not read the client profile', 'db_error');
  if (!user) throw httpError(404, 'Client profile not found', 'no_chat_user');

  const today = streak.resolveToday(requested, { timeZone: user.timezone, now });
  const since = streak.addDays(today, -HISTORY_DAYS);
  const [food, workouts] = await Promise.all([
    loadRows(adminDB, 'food_logs', 'log_date, total_calories, total_protein_g, food_items', 'log_date', user.id, since, today),
    loadRows(adminDB, 'training_logs', 'session_date', 'session_date', user.id, since, today),
  ]);
  const workoutDays = workouts.map((w) => w.session_date).filter(Boolean);
  const days = buildDays(food, workoutDays);
  const counts = streakCountByDay([...days.keys()], today);
  for (const [d, v] of days) v.streakCount = counts.get(d) || 0;

  const targets = targetsOf(user);
  let total = 0;
  const scored = new Map();
  for (const [d, v] of days) {
    const s = scoreDay(v, targets);
    scored.set(d, s);
    total += s.total;
  }

  const start = weekStart(today);
  const week = [];
  for (let d = start; d <= today; d = streak.addDays(d, 1)) week.push({ date: d, points: scored.get(d)?.total || 0 });
  const todayScore = scored.get(today) || { total: 0, parts: [] };

  return {
    today,
    todayPoints: todayScore.total,
    todayParts: todayScore.parts,
    weekStart: start,
    weekPoints: week.reduce((s, d) => s + d.points, 0),
    week,
    ...levelFor(total),
    targets: { calories: targets.calories, protein: targets.protein, waterMl: targets.waterMl },
  };
}

module.exports = {
  RULES,
  waterTargetMl,
  grams,
  scoreDay,
  levelFor,
  weekStart,
  streakCountByDay,
  buildDays,
  getPoints,
};
