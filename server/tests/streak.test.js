// Run: node --test tests/streak.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const svc = require('../services/streak');
const { replayStreak, resolveToday, addDays } = svc;

/** Consecutive days starting at `start`. */
function run(start, n) {
  return Array.from({ length: n }, (_, i) => addDays(start, i));
}

// ── Rules ─────────────────────────────────────────────────────────────────────

test('no logs: no streak', () => {
  const s = replayStreak([], '2026-11-23');
  assert.equal(s.currentStreak, 0);
  assert.equal(s.longestStreak, 0);
  assert.equal(s.freezes, 0);
});

test('logged today and yesterday: 2, duplicates count once', () => {
  const s = replayStreak(['2026-11-22', '2026-11-23', '2026-11-23'], '2026-11-23');
  assert.equal(s.currentStreak, 2);
  assert.equal(s.lastLoggedYmd, '2026-11-23');
});

test('today not logged yet: the streak is still alive', () => {
  const s = replayStreak(run('2026-11-18', 5), '2026-11-23'); // 18..22
  assert.equal(s.currentStreak, 5);
  assert.equal(s.lastActiveYmd, '2026-11-22');
});

test('a missed day with no freeze breaks the streak; longest is kept', () => {
  const s = replayStreak([...run('2026-11-10', 5), '2026-11-16', '2026-11-17'], '2026-11-17'); // 15 missed
  assert.equal(s.currentStreak, 2);
  assert.equal(s.longestStreak, 5);
});

test('7 days earns a freeze; the next missed day uses it and does not add to the count', () => {
  const days = [...run('2026-11-01', 7), '2026-11-09']; // 8th missed
  const s = replayStreak(days, '2026-11-09');
  assert.equal(s.currentStreak, 8);
  assert.equal(s.freezes, 0);
  assert.deepEqual(s.frozenYmds, ['2026-11-08']);
});

test('freezes cap at 2', () => {
  const s = replayStreak(run('2026-10-01', 21), '2026-10-21');
  assert.equal(s.currentStreak, 21);
  assert.equal(s.freezes, 2);
});

test('two missed days use two freezes; a third breaks it', () => {
  const base = run('2026-10-01', 14); // 2 freezes
  const kept = replayStreak([...base, '2026-10-17'], '2026-10-17'); // 15, 16 missed
  assert.equal(kept.currentStreak, 15);
  assert.equal(kept.freezes, 0);
  const broke = replayStreak([...base, '2026-10-18'], '2026-10-18'); // 15, 16, 17 missed
  assert.equal(broke.currentStreak, 1);
  assert.equal(broke.longestStreak, 14);
});

test('days after today are ignored', () => {
  const s = replayStreak(['2026-11-23', '2026-11-24'], '2026-11-23');
  assert.equal(s.currentStreak, 1);
});

test('daysToNextFreeze: 7 minus progress, null at the cap', () => {
  assert.equal(svc.daysToNextFreeze(3, 0), 4);
  assert.equal(svc.daysToNextFreeze(7, 1), 7);
  assert.equal(svc.daysToNextFreeze(14, 2), null);
});

// ── Today ─────────────────────────────────────────────────────────────────────

test('today: the app day is used when within a day of UTC, else the saved timezone', () => {
  const now = new Date('2026-11-23T22:30:00Z'); // 00:30 on the 24th in Jerusalem
  assert.equal(resolveToday('2026-11-24', { timeZone: 'Asia/Jerusalem', now }), '2026-11-24');
  assert.equal(resolveToday('2026-11-27', { timeZone: 'Asia/Jerusalem', now }), '2026-11-24');
  assert.equal(resolveToday(undefined, { timeZone: 'Asia/Jerusalem', now }), '2026-11-24');
  assert.equal(resolveToday('nope', { timeZone: 'Not/AZone', now }), '2026-11-23');
});

// ── getStreak with a fake DB ──────────────────────────────────────────────────

function fakeDB(tables) {
  const calls = [];
  const from = (table) => {
    const q = { table, filters: [], range: [0, 999] };
    const b = {
      select() { return b; },
      eq(col, val) { q.filters.push((r) => r[col] === val); return b; },
      gte(col, val) { q.filters.push((r) => r[col] >= val); return b; },
      lte(col, val) { q.filters.push((r) => r[col] <= val); return b; },
      order() { return b; },
      range(a, z) { q.range = [a, z]; calls.push({ table, range: q.range }); return Promise.resolve(run()); },
      maybeSingle() { const rows = run().data; return Promise.resolve({ data: rows[0] || null, error: null }); },
    };
    const run = () => {
      const rows = (tables[table] || []).filter((r) => q.filters.every((f) => f(r)));
      return { data: rows.slice(q.range[0], q.range[1] + 1), error: null };
    };
    return b;
  };
  return { from, calls };
}

test('getStreak: meals and workouts both count, only the signed-in client', async () => {
  const db = fakeDB({
    chat_users: [{ id: 'u1', user_code: 'ABC', timezone: 'Asia/Jerusalem' }, { id: 'u2', user_code: 'XYZ' }],
    food_logs: [
      { user_id: 'u1', log_date: '2026-11-21' },
      { user_id: 'u1', log_date: '2026-11-23' },
      { user_id: 'u2', log_date: '2026-11-22' }, // someone else
    ],
    training_logs: [{ user_id: 'u1', session_date: '2026-11-22' }],
  });
  const out = await svc.getStreak('ABC', { today: '2026-11-23' }, { adminDB: db, now: new Date('2026-11-23T10:00:00Z') });
  assert.equal(out.currentStreak, 3);
  assert.equal(out.loggedToday, true);
  assert.deepEqual(out.activeYmds, ['2026-11-21', '2026-11-22', '2026-11-23']);
  assert.equal(out.daysToNextFreeze, 4);
});

test('getStreak: pages past 1000 rows', async () => {
  const many = Array.from({ length: 1500 }, (_, i) => ({ user_id: 'u1', log_date: addDays('2026-10-01', Math.floor(i / 30)) }));
  const db = fakeDB({ chat_users: [{ id: 'u1', user_code: 'ABC' }], food_logs: many, training_logs: [] });
  const out = await svc.getStreak('ABC', { today: '2026-11-19' }, { adminDB: db, now: new Date('2026-11-19T10:00:00Z') });
  assert.equal(out.currentStreak, 50); // Oct 1 .. Nov 19
  assert.equal(db.calls.filter((c) => c.table === 'food_logs').length, 2);
});

test('getStreak: a broken streak reports no freezes and no last active day', async () => {
  const db = fakeDB({
    chat_users: [{ id: 'u1', user_code: 'ABC' }],
    food_logs: run('2026-11-01', 7).map((d) => ({ user_id: 'u1', log_date: d })),
    training_logs: [],
  });
  const out = await svc.getStreak('ABC', { today: '2026-11-23' }, { adminDB: db, now: new Date('2026-11-23T10:00:00Z') });
  assert.equal(out.currentStreak, 0);
  assert.equal(out.longestStreak, 7);
  assert.equal(out.freezes, 0);
  assert.equal(out.lastActiveYmd, null);
});

test('getStreak: no user code is 403, unknown client is 404', async () => {
  const db = fakeDB({ chat_users: [] });
  await assert.rejects(svc.getStreak(null, {}, { adminDB: db }), (e) => e.status === 403);
  await assert.rejects(svc.getStreak('NOPE', {}, { adminDB: db }), (e) => e.status === 404);
});
