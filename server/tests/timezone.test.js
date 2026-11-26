// Run: node --test tests/timezone.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { canonicalZone, decideTimezone, saveDeviceTimezone } = require('../services/timezone');

// ── Minimal Supabase stand-in: select/update + eq + maybeSingle ───────────────
function fakeDB(tables = {}, { failUpdate } = {}) {
  const updates = [];
  const from = (table) => {
    const q = { op: 'select', filters: [], payload: null };
    const rows = () => (tables[table] ||= []);
    const run = () => {
      const hit = rows().filter((r) => q.filters.every(([k, v]) => r[k] === v));
      if (q.op === 'update') {
        const failure = failUpdate ? failUpdate(table, q.payload) : null;
        if (failure) return { data: null, error: failure };
        updates.push({ table, payload: q.payload });
        hit.forEach((r) => Object.assign(r, q.payload));
        return { data: null, error: null };
      }
      return { data: hit.map((r) => ({ ...r })), error: null };
    };
    const b = {
      select() { return b; },
      update(patch) { q.op = 'update'; q.payload = patch; return b; },
      eq(k, v) { q.filters.push([k, v]); return b; },
      maybeSingle() { const r = run(); return Promise.resolve({ data: r.data?.[0] || null, error: r.error }); },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return b;
  };
  return { from, tables, updates };
}

const NOW = new Date('2026-11-26T10:00:00Z');
const missingColumn = (table, payload) =>
  table === 'chat_users' && 'timezone_previous' in payload
    ? { code: 'PGRST204', message: "Could not find the 'timezone_previous' column" }
    : null;

// ── Validation ────────────────────────────────────────────────────────────────

test('real IANA zones are accepted as sent', () => {
  assert.equal(canonicalZone('Asia/Jerusalem'), 'Asia/Jerusalem');
  assert.equal(canonicalZone(' Europe/London '), 'Europe/London');
  assert.equal(canonicalZone('America/Argentina/Buenos_Aires'), 'America/Argentina/Buenos_Aires');
  assert.equal(canonicalZone('UTC'), 'UTC');
  assert.equal(canonicalZone('Asia/Kolkata'), 'Asia/Kolkata'); // not the legacy Asia/Calcutta
});

test('offsets, junk and non-strings are refused', () => {
  for (const bad of ['', '   ', '+02:00', 'GMT+2', 'Not/AZone', '../etc/passwd', 'x'.repeat(80), null, 42, {}]) {
    assert.equal(canonicalZone(bad), null, String(bad));
  }
});

// ── Decisions ─────────────────────────────────────────────────────────────────

test('missing zone: the phone zone is saved, nothing previous', () => {
  assert.deepEqual(decideTimezone(null, 'Asia/Jerusalem'), { changed: true, timezone: 'Asia/Jerusalem', previous: null });
  assert.deepEqual(decideTimezone('', 'Asia/Jerusalem'), { changed: true, timezone: 'Asia/Jerusalem', previous: null });
});

test('same zone: nothing to save', () => {
  assert.equal(decideTimezone('Asia/Jerusalem', 'Asia/Jerusalem').changed, false);
});

test('travel: the new zone is saved and the home zone kept as previous', () => {
  assert.deepEqual(decideTimezone('Asia/Jerusalem', 'Europe/Rome'), { changed: true, timezone: 'Europe/Rome', previous: 'Asia/Jerusalem' });
});

test('a phone that says UTC does not overwrite a real zone, but fills a missing one', () => {
  assert.equal(decideTimezone('Asia/Jerusalem', 'UTC').changed, false);
  assert.deepEqual(decideTimezone(null, 'UTC'), { changed: true, timezone: 'UTC', previous: null });
  assert.deepEqual(decideTimezone('UTC', 'Asia/Jerusalem'), { changed: true, timezone: 'Asia/Jerusalem', previous: null });
});

test('a junk saved zone is replaced without being kept', () => {
  assert.deepEqual(decideTimezone('Mars/Base', 'Asia/Jerusalem'), { changed: true, timezone: 'Asia/Jerusalem', previous: null });
});

// ── Saving ────────────────────────────────────────────────────────────────────

test('fills a missing zone on chat_users and clients', async () => {
  const adminDB = fakeDB({ chat_users: [{ id: 'c1', user_code: 'ABC', timezone: null }] });
  const clientDB = fakeDB({ clients: [{ user_id: 'u1', user_code: 'ABC', timezone: null }] });
  const out = await saveDeviceTimezone('ABC', 'u1', 'Asia/Jerusalem', { adminDB, clientDB, now: NOW });
  assert.deepEqual(out, { timezone: 'Asia/Jerusalem', previous: null, changed: true });
  assert.equal(adminDB.tables.chat_users[0].timezone, 'Asia/Jerusalem');
  assert.equal(clientDB.tables.clients[0].timezone, 'Asia/Jerusalem');
  assert.equal(adminDB.updates.some((u) => 'timezone_previous' in u.payload), false);
});

test('travel keeps the previous zone and when it changed (once the columns exist)', async () => {
  const adminDB = fakeDB({ chat_users: [{ id: 'c1', user_code: 'ABC', timezone: 'Asia/Jerusalem' }] });
  const out = await saveDeviceTimezone('ABC', 'u1', 'Europe/London', { adminDB, clientDB: fakeDB(), now: NOW });
  assert.deepEqual(out, { timezone: 'Europe/London', previous: 'Asia/Jerusalem', changed: true });
  const row = adminDB.tables.chat_users[0];
  assert.equal(row.timezone, 'Europe/London');
  assert.equal(row.timezone_previous, 'Asia/Jerusalem');
  assert.equal(row.timezone_changed_at, NOW.toISOString());
});

test('without the travel columns the zone is still saved', async () => {
  const adminDB = fakeDB({ chat_users: [{ id: 'c1', user_code: 'ABC', timezone: 'Asia/Jerusalem' }] }, { failUpdate: missingColumn });
  const out = await saveDeviceTimezone('ABC', 'u1', 'Europe/London', { adminDB, clientDB: fakeDB(), now: NOW });
  assert.equal(out.changed, true);
  assert.equal(adminDB.tables.chat_users[0].timezone, 'Europe/London');
});

test('the same zone writes nothing', async () => {
  const adminDB = fakeDB({ chat_users: [{ id: 'c1', user_code: 'ABC', timezone: 'Asia/Jerusalem' }] });
  const out = await saveDeviceTimezone('ABC', 'u1', 'Asia/Jerusalem', { adminDB, clientDB: fakeDB(), now: NOW });
  assert.equal(out.changed, false);
  assert.equal(adminDB.updates.length, 0);
});

test('errors: no account 403, bad zone 400, no profile 404, failed write 500', async () => {
  const adminDB = fakeDB({ chat_users: [{ id: 'c1', user_code: 'ABC', timezone: null }] });
  await assert.rejects(saveDeviceTimezone(null, 'u1', 'Asia/Jerusalem', { adminDB }), { status: 403 });
  await assert.rejects(saveDeviceTimezone('ABC', 'u1', '+02:00', { adminDB }), { status: 400 });
  await assert.rejects(saveDeviceTimezone('NOPE', 'u1', 'Asia/Jerusalem', { adminDB }), { status: 404 });
  const failing = fakeDB({ chat_users: [{ id: 'c1', user_code: 'ABC', timezone: null }] }, { failUpdate: () => ({ code: 'XX', message: 'down' }) });
  await assert.rejects(saveDeviceTimezone('ABC', 'u1', 'Asia/Jerusalem', { adminDB: failing }), { status: 500 });
});

// ── Wiring ────────────────────────────────────────────────────────────────────

test('the route is signed-in only, takes the client from the token, and is mounted', () => {
  const routes = fs.readFileSync(path.join(__dirname, '../modules/timezone/timezone.routes.js'), 'utf8');
  assert.match(routes, /router\.post\('\/profile\/timezone', requireAuth, ctrl\.save\)/);
  const controller = fs.readFileSync(path.join(__dirname, '../modules/timezone/timezone.controller.js'), 'utf8');
  assert.match(controller, /saveDeviceTimezone\(req\.userCode, req\.userId, req\.body\?\.timezone/);
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(server, /app\.use\('\/api', timezoneRoutes\)/);
  const guard = fs.readFileSync(path.join(__dirname, '../middleware/auth.js'), 'utf8');
  assert.match(guard, /'\/api\/profile\/'/);
});
