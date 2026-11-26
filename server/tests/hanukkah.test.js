// Run: node --test tests/hanukkah.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const svc = require('../services/hanukkah');
const { resolveToday } = require('../services/streak');
const { seasonFor, isSufganiyaItem, isSufganiyaLog, buildChallenge, nightsOf } = svc;

const NIGHTS_2026 = ['2026-12-04', '2026-12-05', '2026-12-06', '2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11'];
const sufganiya = (log_date, name = 'Sufganiya (jam)') => ({ log_date, food_items: [{ name }] });

// ── Nights ────────────────────────────────────────────────────────────────────

test('2026: 8 nights, first candle on the evening of 4 Dec, the eighth on 11 Dec', () => {
  assert.deepEqual(nightsOf(svc.SEASONS[0]), NIGHTS_2026);
});

test('phase: before / during / after, by the local calendar day', () => {
  assert.equal(seasonFor('2026-12-01').phase, 'before');
  assert.equal(seasonFor('2026-12-03').phase, 'before');
  assert.equal(seasonFor('2026-12-04').phase, 'during');
  assert.equal(seasonFor('2026-12-11').phase, 'during');
  assert.equal(seasonFor('2026-12-12').phase, 'after');
  assert.equal(seasonFor('2026-12-13').phase, 'after');
});

test('season choice: the next one once the last ended 30+ days ago', () => {
  const seasons = [{ year: 2026, firstNight: '2026-12-04' }, { year: 2027, firstNight: '2027-12-24' }];
  assert.equal(seasonFor('2026-12-20', seasons).year, 2026);
  assert.equal(seasonFor('2027-02-01', seasons).year, 2027);
  assert.equal(seasonFor('2030-01-01', seasons).year, 2027); // nothing newer: the latest
});

// ── Timezone edge at midnight ─────────────────────────────────────────────────

test('00:30 in Jerusalem after the first candle is already night 2', () => {
  const now = new Date('2026-12-04T22:30:00Z'); // 00:30 on 5 Dec in Israel
  const today = resolveToday(undefined, { timeZone: 'Asia/Jerusalem', now });
  assert.equal(today, '2026-12-05');
  const c = buildChallenge([sufganiya('2026-12-04'), sufganiya('2026-12-05')], today);
  assert.equal(c.tonight.night, 2);
  assert.equal(c.tonight.logged, true);
  assert.equal(c.done, 2);
});

test('23:59 in Jerusalem on 3 Dec: still before, nothing counts yet', () => {
  const now = new Date('2026-12-03T21:59:00Z');
  const today = resolveToday(undefined, { timeZone: 'Asia/Jerusalem', now });
  assert.equal(today, '2026-12-03');
  const c = buildChallenge([sufganiya('2026-12-03')], today);
  assert.equal(c.phase, 'before');
  assert.equal(c.tonight, null);
  assert.equal(c.done, 0);
});

test('the app day wins when believable (a client abroad), the saved timezone otherwise', () => {
  const now = new Date('2026-12-11T23:30:00Z'); // 01:30 on the 12th in Israel, 18:30 on the 11th in New York
  assert.equal(resolveToday('2026-12-11', { timeZone: 'Asia/Jerusalem', now }), '2026-12-11');
  assert.equal(buildChallenge([], '2026-12-11').tonight.night, 8);
  assert.equal(buildChallenge([], resolveToday(undefined, { timeZone: 'Asia/Jerusalem', now })).phase, 'after');
});

// ── Matching names (HE / EN) and the marker ───────────────────────────────────

test('matches Hebrew and English names, any case and spelling', () => {
  for (const name of [
    'סופגניה', 'סופגנייה', 'סופגניות', 'סופגנייה (ריבה)', 'מיני סופגניות', 'דונאט',
    'Sufganiya', 'sufganiyah', 'Sufganiyot', 'Donut', 'DOUGHNUT', 'Glazed doughnuts', 'Mini donuts',
  ]) {
    assert.equal(isSufganiyaItem({ name }), true, name);
  }
});

test('does not match other foods', () => {
  for (const name of ['Bagel', 'בורקס', 'לביבות', 'Latkes', 'Jam', 'ריבה', 'Cream puff', '', null]) {
    assert.equal(isSufganiyaItem({ name }), false, String(name));
  }
  assert.equal(isSufganiyaItem(null), false);
  assert.equal(isSufganiyaItem('donut'), false); // not an item object
});

test('the app marker counts whatever the name; other name fields count too', () => {
  assert.equal(isSufganiyaItem({ name: 'Something', challenge_ref: { source: 'hanukkah', variant: 'jam' } }), true);
  assert.equal(isSufganiyaItem({ name: 'x', challenge_ref: { source: 'plan' } }), false);
  assert.equal(isSufganiyaItem({ item: 'Sufganiya' }), true);
  assert.equal(isSufganiyaItem({ name: 'Pastry', name_he: 'סופגנייה' }), true);
});

test('a log counts when any item is a sufganiya; food_items may be a JSON string', () => {
  assert.equal(isSufganiyaLog({ food_items: [{ name: 'Coffee' }, { name: 'Donut' }] }), true);
  assert.equal(isSufganiyaLog({ food_items: JSON.stringify([{ name: 'סופגנייה' }]) }), true);
  assert.equal(isSufganiyaLog({ food_items: 'not json' }), false);
  assert.equal(isSufganiyaLog({ food_items: null }), false);
});

// ── buildChallenge ────────────────────────────────────────────────────────────

test('nights logged, tonight, done/total; duplicates and other foods do not count', () => {
  const rows = [
    sufganiya('2026-12-04'),
    sufganiya('2026-12-04', 'Donut'), // second one the same night
    { log_date: '2026-12-05', food_items: [{ name: 'Salad' }] },
    sufganiya('2026-12-06', 'סופגנייה'),
  ];
  const c = buildChallenge(rows, '2026-12-06');
  assert.equal(c.id, 'hanukkah-2026');
  assert.equal(c.phase, 'during');
  assert.deepEqual(c.nights.map((n) => n.logged), [true, false, true, false, false, false, false, false]);
  assert.deepEqual(c.tonight, { night: 3, date: '2026-12-06', logged: true });
  assert.equal(c.done, 2);
  assert.equal(c.total, 8);
  assert.equal(c.badgeEarned, false);
  assert.equal(c.startsOn, '2026-12-04');
  assert.equal(c.endsOn, '2026-12-11');
});

test('all 8 nights earn the badge, and it stays after Hanukkah', () => {
  const rows = NIGHTS_2026.map((d) => sufganiya(d));
  assert.equal(buildChallenge(rows, '2026-12-11').badgeEarned, true);
  const after = buildChallenge(rows, '2026-12-13');
  assert.equal(after.phase, 'after');
  assert.equal(after.tonight, null);
  assert.equal(after.badgeEarned, true);
});

test('7 of 8 is no badge; logs outside the nights or after today never count', () => {
  const rows = NIGHTS_2026.slice(1).map((d) => sufganiya(d));
  rows.push(sufganiya('2026-12-03'), sufganiya('2026-12-12'));
  const c = buildChallenge(rows, '2026-12-13');
  assert.equal(c.done, 7);
  assert.equal(c.badgeEarned, false);
  assert.equal(buildChallenge([sufganiya('2026-12-08')], '2026-12-07').done, 0);
});

// ── getHanukkah with a fake DB ────────────────────────────────────────────────

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

test('getHanukkah: only the signed-in client, only the nights up to today', async () => {
  const db = fakeDB({
    chat_users: [{ id: 'u1', user_code: 'ABC', timezone: 'Asia/Jerusalem' }, { id: 'u2', user_code: 'XYZ' }],
    food_logs: [
      { user_id: 'u1', ...sufganiya('2026-12-04') },
      { user_id: 'u1', ...sufganiya('2026-12-05', 'סופגנייה') },
      { user_id: 'u2', ...sufganiya('2026-12-06') }, // someone else
    ],
  });
  const out = await svc.getHanukkah('ABC', { today: '2026-12-06' }, { adminDB: db, now: new Date('2026-12-06T10:00:00Z') });
  assert.equal(out.done, 2);
  assert.deepEqual(out.tonight, { night: 3, date: '2026-12-06', logged: false });
});

test('getHanukkah: before the first night it does not read food_logs', async () => {
  const db = fakeDB({ chat_users: [{ id: 'u1', user_code: 'ABC' }], food_logs: [] });
  const out = await svc.getHanukkah('ABC', { today: '2026-12-01' }, { adminDB: db, now: new Date('2026-12-01T10:00:00Z') });
  assert.equal(out.phase, 'before');
  assert.equal(out.done, 0);
  assert.equal(db.calls.filter((c) => c.table === 'food_logs').length, 0);
});

test('getHanukkah: no user code is 403, unknown client is 404, a DB error is 500', async () => {
  const db = fakeDB({ chat_users: [] });
  await assert.rejects(svc.getHanukkah(null, {}, { adminDB: db }), (e) => e.status === 403);
  await assert.rejects(svc.getHanukkah('NOPE', {}, { adminDB: db }), (e) => e.status === 404);
  const broken = {
    from: () => {
      const b = {
        select: () => b, eq: () => b, gte: () => b, lte: () => b, order: () => b,
        maybeSingle: () => Promise.resolve({ data: { id: 'u1', timezone: null }, error: null }),
        range: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
      };
      return b;
    },
  };
  await assert.rejects(
    svc.getHanukkah('ABC', { today: '2026-12-05' }, { adminDB: broken, now: new Date('2026-12-05T10:00:00Z') }),
    (e) => e.status === 500,
  );
});

test('the route is protected and mounted', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const auth = fs.readFileSync(path.join(__dirname, '..', 'middleware', 'auth.js'), 'utf8');
  assert.match(auth, /'\/api\/challenges'/);
  const routes = fs.readFileSync(path.join(__dirname, '..', 'modules', 'challenges', 'challenges.routes.js'), 'utf8');
  assert.match(routes, /router\.get\('\/challenges\/hanukkah', requireAuth/);
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /app\.use\('\/api', challengeRoutes\)/);
});
