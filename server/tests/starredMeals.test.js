// Run: node --test tests/starredMeals.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const svc = require('../services/starred-meals');

// ── In-memory Supabase stand-in ───────────────────────────────────────────────
let idSeq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++idSeq).padStart(12, '0')}`;

function fakeDB(tables = {}, { failInsert } = {}) {
  const from = (table) => {
    const q = { op: 'select', filters: [], payload: null };
    const rows = () => (tables[table] ||= []);
    const matches = (row) => q.filters.every((f) => f(row));
    const run = () => {
      if (q.op === 'insert') {
        const failure = failInsert ? failInsert(table) : null;
        if (failure) return { data: null, error: failure };
        const list = (Array.isArray(q.payload) ? q.payload : [q.payload]).map((r) => ({ id: r.id || uuid(), ...r }));
        rows().push(...list);
        return { data: list.map((r) => ({ ...r })), error: null };
      }
      const hit = rows().filter(matches);
      if (q.op === 'update') {
        hit.forEach((r) => Object.assign(r, q.payload));
        return { data: null, error: null };
      }
      if (q.op === 'delete') {
        tables[table] = rows().filter((r) => !matches(r));
        return { data: null, error: null };
      }
      return { data: hit.map((r) => ({ ...r })), error: null };
    };
    const b = {
      select() { return b; },
      update(patch) { q.op = 'update'; q.payload = patch; return b; },
      insert(payload) { q.op = 'insert'; q.payload = payload; return b; },
      delete() { q.op = 'delete'; return b; },
      eq(col, val) { q.filters.push((r) => r[col] === val); return b; },
      order() { return b; },
      limit() { return b; },
      async maybeSingle() { const { data, error } = run(); return { data: data?.[0] || null, error }; },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return b;
  };
  return { from, tables };
}

const U1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const U2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const users = () => [{ id: U1, user_code: 'CODE1' }, { id: U2, user_code: 'CODE2' }];

const eggs = {
  name: 'Fried eggs',
  macros: { calories: 180, protein_g: 12.4, carbs_g: 1, fat_g: 14 },
  portion_estimate: '100g',
  confidence: 0.9,
  visual_evidence: 'x',
};
const latte = {
  name: 'Oat latte',
  macros: { calories: 120, protein_g: 3, carbs_g: 18, fat_g: 4 },
  portion_estimate: '250 ml',
  water_ml: 220,
};

test('mealSignature ignores order, case and extra spaces', () => {
  const a = svc.mealSignature([eggs, latte]);
  const b = svc.mealSignature([
    { ...latte, name: ' OAT  latte ', portion_estimate: '250ml' },
    { ...eggs, name: 'fried eggs' },
  ]);
  assert.equal(a, b);
  assert.equal(a, 'fried eggs|100g;oat latte|250ml');
});

test('sanitizeItems keeps water_ml and drops unknown fields', () => {
  const [, l] = svc.sanitizeItems([eggs, { ...latte, secret: 'no', macros: { ...latte.macros, calories: -5 } }]);
  assert.equal(l.water_ml, 220);
  assert.equal(l.secret, undefined);
  assert.equal(l.macros.calories, 0);
  assert.throws(() => svc.sanitizeItems([]), /At least one item/);
  assert.throws(() => svc.sanitizeItems([{ name: '  ' }]), /needs a name/);
  assert.throws(() => svc.sanitizeItems(Array(31).fill(eggs)), /At most 30/);
});

test('isYmd accepts only real dates', () => {
  assert.equal(svc.isYmd('2026-11-06'), true);
  assert.equal(svc.isYmd('2026-02-30'), false);
  assert.equal(svc.isYmd('06/11/2026'), false);
});

test('starMeal creates a row with totals, name and source; same items again returns it', async () => {
  const db = fakeDB({ chat_users: users() });
  const first = await svc.starMeal('CODE1', { items: [eggs, latte], source: 'photo' }, { adminDB: db });
  assert.equal(first.created, true);
  assert.equal(first.meal.user_id, U1);
  assert.equal(first.meal.name, 'Fried eggs, Oat latte');
  assert.equal(first.meal.source, 'photo');
  assert.equal(first.meal.total_calories, 300);
  assert.equal(first.meal.total_water_ml, 220);
  assert.equal(first.meal.use_count, 0);

  const again = await svc.starMeal('CODE1', { items: [latte, eggs], source: 'text' }, { adminDB: db });
  assert.equal(again.created, false);
  assert.equal(again.meal.id, first.meal.id);
  assert.equal(db.tables.starred_meals.length, 1);
});

test('starMeal ignores bad source values and rejects unknown users', async () => {
  const db = fakeDB({ chat_users: users() });
  const { meal } = await svc.starMeal(
    'CODE1',
    { items: [eggs], source: 'hack', sourceFoodLogId: 'not-a-uuid' },
    { adminDB: db },
  );
  assert.equal(meal.source, 'text');
  assert.equal(meal.source_food_log_id, null);
  await assert.rejects(svc.starMeal('NOPE', { items: [eggs] }, { adminDB: db }), (e) => e.status === 404);
  await assert.rejects(svc.starMeal(null, { items: [eggs] }, { adminDB: db }), (e) => e.status === 403);
});

test('starMeal caps a client at 50 meals', async () => {
  const existing = Array.from({ length: svc.MAX_STARRED_PER_USER }, (_, i) => ({
    id: uuid(),
    user_id: U1,
    signature: `s${i}`,
  }));
  const db = fakeDB({ chat_users: users(), starred_meals: existing });
  await assert.rejects(
    svc.starMeal('CODE1', { items: [eggs] }, { adminDB: db }),
    (e) => e.status === 409 && e.code === 'limit_reached',
  );
});

test('starMeal returns the winner when a parallel star hits the unique index', async () => {
  const db = fakeDB(
    { chat_users: users() },
    {
      failInsert: (table) => {
        if (table !== 'starred_meals') return null;
        db.tables.starred_meals.push({ id: 'winner', user_id: U1, signature: svc.mealSignature([eggs]) });
        return { code: '23505', message: 'duplicate' };
      },
    },
  );
  const res = await svc.starMeal('CODE1', { items: [eggs] }, { adminDB: db });
  assert.equal(res.created, false);
  assert.equal(res.meal.id, 'winner');
});

test('listStarredMeals returns only the caller rows, most recently used first', async () => {
  const db = fakeDB({
    chat_users: users(),
    starred_meals: [
      { id: 'old', user_id: U1, created_at: '2026-10-01T00:00:00Z', last_used_at: null },
      { id: 'used', user_id: U1, created_at: '2026-09-01T00:00:00Z', last_used_at: '2026-11-05T00:00:00Z' },
      { id: 'other', user_id: U2, created_at: '2026-11-06T00:00:00Z' },
    ],
  });
  const rows = await svc.listStarredMeals('CODE1', { adminDB: db });
  assert.deepEqual(rows.map((r) => r.id), ['used', 'old']);
});

test('unstarMeal deletes only the caller row', async () => {
  const id = uuid();
  const db = fakeDB({ chat_users: users(), starred_meals: [{ id, user_id: U2 }] });
  await assert.rejects(svc.unstarMeal('CODE1', id, { adminDB: db }), (e) => e.status === 404);
  assert.equal(db.tables.starred_meals.length, 1);
  await svc.unstarMeal('CODE2', id, { adminDB: db });
  assert.equal(db.tables.starred_meals.length, 0);
  await assert.rejects(svc.unstarMeal('CODE2', 'x; drop table', { adminDB: db }), (e) => e.status === 404);
});

test('logStarredMeal writes a food log with the same items and counts the use', async () => {
  const db = fakeDB({ chat_users: users() });
  const { meal } = await svc.starMeal('CODE1', { items: [eggs, latte] }, { adminDB: db });
  const now = () => new Date('2026-11-06T08:00:00Z');
  const res = await svc.logStarredMeal(
    'CODE1',
    meal.id,
    { mealSlot: 'Breakfast', date: '2026-11-06' },
    { adminDB: db, now },
  );
  assert.equal(res.foodLog.user_id, U1);
  assert.equal(res.foodLog.meal_label, 'Breakfast');
  assert.equal(res.foodLog.log_date, '2026-11-06');
  assert.equal(res.foodLog.total_calories, 300);
  assert.equal(res.foodLog.food_items.length, 2);
  assert.equal(res.foodLog.food_items[1].water_ml, 220);
  assert.equal(res.meal.use_count, 1);
  const stored = db.tables.starred_meals[0];
  assert.equal(stored.use_count, 1);
  assert.equal(stored.last_used_at, '2026-11-06T08:00:00.000Z');
});

test('logStarredMeal logs adjusted items when given and leaves the star unchanged', async () => {
  const db = fakeDB({ chat_users: users() });
  const { meal } = await svc.starMeal('CODE1', { items: [eggs] }, { adminDB: db });
  const half = { ...eggs, portion_estimate: '50g', macros: { calories: 90, protein_g: 6.2, carbs_g: 0.5, fat_g: 7 } };
  const res = await svc.logStarredMeal(
    'CODE1',
    meal.id,
    { mealSlot: 'Lunch', date: '2026-11-06', items: [half] },
    { adminDB: db },
  );
  assert.equal(res.foodLog.total_calories, 90);
  assert.equal(db.tables.starred_meals[0].items[0].portion_estimate, '100g');
});

test('logStarredMeal validates input and ownership', async () => {
  const db = fakeDB({ chat_users: users() });
  const { meal } = await svc.starMeal('CODE1', { items: [eggs] }, { adminDB: db });
  await assert.rejects(
    svc.logStarredMeal('CODE1', meal.id, { date: '2026-11-06' }, { adminDB: db }),
    (e) => e.status === 400,
  );
  await assert.rejects(
    svc.logStarredMeal('CODE1', meal.id, { mealSlot: 'Lunch', date: 'today' }, { adminDB: db }),
    (e) => e.status === 400,
  );
  await assert.rejects(
    svc.logStarredMeal('CODE2', meal.id, { mealSlot: 'Lunch', date: '2026-11-06' }, { adminDB: db }),
    (e) => e.status === 404,
  );
  assert.equal((db.tables.food_logs || []).length, 0);
});

test('routes are mounted and every one requires auth', () => {
  const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
  assert.match(read('server.js'), /starred-meals\.routes/);
  assert.match(read('middleware', 'auth.js'), /'\/api\/starred-meals'/);
  const routes = read('modules', 'starred-meals', 'starred-meals.routes.js');
  assert.equal((routes.match(/requireAuth,/g) || []).length, 4);
});
