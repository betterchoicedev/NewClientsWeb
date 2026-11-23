// Run: node --test tests/points.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const svc = require('../services/points');
const { scoreDay, levelFor, weekStart, waterTargetMl, grams, streakCountByDay, buildDays } = svc;

const T = { calories: 2000, protein: 150, waterMl: 2450 };
const day = (over = {}) => ({ logs: 0, calories: 0, protein: 0, waterMl: 0, workout: false, streakCount: 0, ...over });
const part = (s, key) => s.parts.find((p) => p.key === key)?.points ?? 0;

test('meals: 10 each, at most 5 a day', () => {
  assert.equal(part(scoreDay(day({ logs: 3 }), T), 'meal'), 30);
  assert.equal(part(scoreDay(day({ logs: 9 }), T), 'meal'), 50);
});

test('calories: within 10% of the target only', () => {
  assert.equal(part(scoreDay(day({ logs: 3, calories: 2150 }), T), 'calories'), 20);
  assert.equal(part(scoreDay(day({ logs: 3, calories: 2300 }), T), 'calories'), 0);
  assert.equal(part(scoreDay(day({ logs: 3, calories: 2000 }), { ...T, calories: null }), 'calories'), 0);
});

test('protein: 90% of the target; water: the full target', () => {
  assert.equal(part(scoreDay(day({ logs: 1, protein: 135 }), T), 'protein'), 20);
  assert.equal(part(scoreDay(day({ logs: 1, protein: 120 }), T), 'protein'), 0);
  assert.equal(part(scoreDay(day({ waterMl: 2450 }), T), 'water'), 20);
  assert.equal(part(scoreDay(day({ waterMl: 2000 }), T), 'water'), 0);
});

test('workout 30; streak bonus 2 a day up to 20', () => {
  assert.equal(part(scoreDay(day({ workout: true }), T), 'workout'), 30);
  assert.equal(part(scoreDay(day({ streakCount: 4 }), T), 'streak'), 8);
  assert.equal(part(scoreDay(day({ streakCount: 40 }), T), 'streak'), 20);
});

test('a perfect day is 160 and only scoring parts are listed', () => {
  const s = scoreDay(day({ logs: 5, calories: 2000, protein: 150, waterMl: 2500, workout: true, streakCount: 10 }), T);
  assert.equal(s.total, 160);
  assert.deepEqual(scoreDay(day({ logs: 1 }), { calories: null, protein: null, waterMl: 2000 }).parts, [{ key: 'meal', points: 10 }]);
});

test('levels: 0, 200, 600, 1200...', () => {
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(199).level, 1);
  assert.equal(levelFor(200).level, 2);
  assert.deepEqual(levelFor(700), { level: 3, points: 700, levelStart: 600, nextLevelAt: 1200 });
});

test('weeks start on Sunday', () => {
  assert.equal(weekStart('2026-11-23'), '2026-11-22'); // Monday → Sunday
  assert.equal(weekStart('2026-11-22'), '2026-11-22');
  assert.equal(weekStart('2026-11-28'), '2026-11-22'); // Saturday
});

test('water target matches the app (35 ml/kg, nursing extra, 2 L unknown)', () => {
  assert.equal(waterTargetMl(70), 2450);
  assert.equal(waterTargetMl(60, 'exclusive'), 2950);
  assert.equal(waterTargetMl(null), 2000);
  assert.equal(grams('150g'), 150);
  assert.equal(grams('abc'), null);
});

test('streak count per day follows the streak rules (freezes included)', () => {
  const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-09'];
  const c = streakCountByDay(days, '2026-11-09');
  assert.equal(c.get('2026-11-07'), 7);
  assert.equal(c.get('2026-11-09'), 8); // the 8th was frozen
  const broke = streakCountByDay(['2026-11-01', '2026-11-03'], '2026-11-03');
  assert.equal(broke.get('2026-11-03'), 1);
});

test('buildDays sums each day and reads drink water from the items', () => {
  const days = buildDays(
    [
      { log_date: '2026-11-23', total_calories: 500, total_protein_g: 30, food_items: [{ water_ml: 250 }] },
      { log_date: '2026-11-23', total_calories: 700, total_protein_g: 40, food_items: [{ water_ml: 500 }, { name: 'x' }] },
    ],
    ['2026-11-22'],
  );
  assert.deepEqual(days.get('2026-11-23'), { logs: 2, calories: 1200, protein: 70, waterMl: 750, workout: false, streakCount: 0 });
  assert.equal(days.get('2026-11-22').workout, true);
});

// ── getPoints with a fake DB ──────────────────────────────────────────────────

function fakeDB(tables) {
  const from = (table) => {
    const q = { filters: [], range: [0, 999] };
    const run = () => ({ data: (tables[table] || []).filter((r) => q.filters.every((f) => f(r))).slice(q.range[0], q.range[1] + 1), error: null });
    const b = {
      select() { return b; },
      eq(col, val) { q.filters.push((r) => r[col] === val); return b; },
      gte(col, val) { q.filters.push((r) => r[col] >= val); return b; },
      lte(col, val) { q.filters.push((r) => r[col] <= val); return b; },
      order() { return b; },
      range(a, z) { q.range = [a, z]; return Promise.resolve(run()); },
      maybeSingle() { return Promise.resolve({ data: run().data[0] || null, error: null }); },
    };
    return b;
  };
  return { from };
}

test('getPoints: today, this week from Sunday, level, only this client', async () => {
  const db = fakeDB({
    chat_users: [
      { id: 'u1', user_code: 'ABC', daily_target_total_calories: 2000, macros: { protein: '150g' }, weight_kg: 70 },
      { id: 'u2', user_code: 'XYZ' },
    ],
    food_logs: [
      { user_id: 'u1', log_date: '2026-11-22', total_calories: 2000, total_protein_g: 150, food_items: [] },
      { user_id: 'u1', log_date: '2026-11-23', total_calories: 400, total_protein_g: 20, food_items: [] },
      { user_id: 'u2', log_date: '2026-11-23', total_calories: 400, total_protein_g: 20, food_items: [] },
    ],
    training_logs: [{ user_id: 'u1', session_date: '2026-11-23' }],
  });
  const out = await svc.getPoints('ABC', { today: '2026-11-23' }, { adminDB: db, now: new Date('2026-11-23T10:00:00Z') });
  // Sunday: meal 10 + calories 20 + protein 20 + streak 2 = 52. Monday: meal 10 + workout 30 + streak 4 = 44.
  assert.equal(out.week.length, 2);
  assert.deepEqual(out.week.map((d) => d.points), [52, 44]);
  assert.equal(out.todayPoints, 44);
  assert.equal(out.weekPoints, 96);
  assert.equal(out.level, 1);
  assert.deepEqual(out.todayParts.map((p) => p.key), ['meal', 'workout', 'streak']);
});

test('getPoints: 403 without a user code, 404 unknown client', async () => {
  const db = fakeDB({ chat_users: [] });
  await assert.rejects(svc.getPoints(null, {}, { adminDB: db }), (e) => e.status === 403);
  await assert.rejects(svc.getPoints('NOPE', {}, { adminDB: db }), (e) => e.status === 404);
});
