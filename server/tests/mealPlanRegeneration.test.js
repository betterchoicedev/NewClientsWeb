// Run: node --test tests/mealPlanRegeneration.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeNotes,
  summarizeRegenerations,
  getRegenerationStatus,
  requestRegeneration,
  checkRegenerationAllowed,
  PENDING_TIMEOUT_MS,
} = require('../services/meal-plan-regeneration');
const {
  createAndSaveOnboardingMealPlanForUser,
  buildClientNotesMealPlanPrompt,
  summarizeMealPlanTitles,
} = require('../services/ai.service');

// ── In-memory Supabase stand-in ───────────────────────────────────────────────

let idSeq = 0;
function fakeDB(tables = {}) {
  const from = (table) => {
    const q = { op: 'select', filters: [], payload: null };
    const rows = () => (tables[table] ||= []);
    const matches = (row) => q.filters.every((f) => f(row));
    const run = () => {
      if (q.op === 'insert') {
        const list = (Array.isArray(q.payload) ? q.payload : [q.payload]).map((r) => ({
          id: r.id || `row-${++idSeq}`,
          created_at: r.created_at || new Date().toISOString(),
          ...r,
        }));
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
      neq(col, val) { q.filters.push((r) => r[col] !== val); return b; },
      order() { return b; },
      limit() { return b; },
      async maybeSingle() { const { data } = run(); return { data: data?.[0] || null, error: null }; },
      async single() { const { data } = run(); return { data: data?.[0] || null, error: null }; },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return b;
  };
  return { from, tables };
}

const NOW = Date.parse('2026-10-30T12:00:00Z');
const minutesAgo = (m) => new Date(NOW - m * 60 * 1000).toISOString();
const row = (status, mins, user_code = 'U1') => ({ id: `r-${++idSeq}`, user_code, notes: 'x', status, created_at: minutesAgo(mins) });

/** Runs scheduled callbacks on demand instead of setImmediate. */
function manualScheduler() {
  const jobs = [];
  return {
    schedule: (fn) => jobs.push(fn),
    async flush() {
      while (jobs.length) jobs.shift()();
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));
    },
    get size() { return jobs.length; },
  };
}

// ── Notes validation ──────────────────────────────────────────────────────────

test('normalizeNotes trims and enforces 3..1000 characters', () => {
  assert.equal(normalizeNotes('  more fish  '), 'more fish');
  assert.equal(normalizeNotes('ab'), null);
  assert.equal(normalizeNotes('   a  '), null);
  assert.equal(normalizeNotes('x'.repeat(1000)), 'x'.repeat(1000));
  assert.equal(normalizeNotes('x'.repeat(1001)), null);
  assert.equal(normalizeNotes(null), null);
  assert.equal(normalizeNotes(42), null);
});

test('requestRegeneration rejects bad notes with 400 invalid_notes and writes nothing', async () => {
  const adminDB = fakeDB({ meal_plan_regenerations: [] });
  for (const notes of ['', ' hi ', undefined, 'y'.repeat(1001)]) {
    await assert.rejects(
      requestRegeneration('U1', notes, { adminDB, generate: async () => {}, schedule: () => {}, now: () => NOW }),
      (e) => e.status === 400 && e.code === 'invalid_notes',
    );
  }
  assert.equal(adminDB.tables.meal_plan_regenerations.length, 0);
});

// ── Limit and summary ─────────────────────────────────────────────────────────

test('summary: failed rows do not use a try; stale pending counts as failed', () => {
  const s = summarizeRegenerations([row('done', 30), row('failed', 20), row('pending', 15)], NOW);
  assert.deepEqual(s, { used: 1, limit: 3, remaining: 2, pending: false, last: { status: 'failed', created_at: minutesAgo(15) } });

  const fresh = summarizeRegenerations([row('done', 30), row('pending', 1)], NOW);
  assert.equal(fresh.used, 2);
  assert.equal(fresh.pending, true);
  assert.equal(fresh.last.status, 'pending');

  assert.deepEqual(summarizeRegenerations([], NOW), { used: 0, limit: 3, remaining: 3, pending: false, last: null });
});

test('getRegenerationStatus only reads the caller\'s rows', async () => {
  const adminDB = fakeDB({ meal_plan_regenerations: [row('done', 50), row('done', 40, 'OTHER'), row('done', 30, 'OTHER')] });
  const s = await getRegenerationStatus('U1', { adminDB, now: () => NOW });
  assert.equal(s.used, 1);
  assert.equal(s.remaining, 2);
});

test('limit: 3 non-failed rows → 409 limit_reached', async () => {
  const adminDB = fakeDB({ meal_plan_regenerations: [row('done', 90), row('done', 60), row('done', 30)] });
  await assert.rejects(
    requestRegeneration('U1', 'more fish please', { adminDB, generate: async () => {}, schedule: () => {}, now: () => NOW }),
    (e) => e.status === 409 && e.code === 'limit_reached',
  );
  assert.equal(adminDB.tables.meal_plan_regenerations.length, 3);
});

test('limit: failed rows do not count, so 2 done + 2 failed may still ask once more', async () => {
  const adminDB = fakeDB({ meal_plan_regenerations: [row('done', 90), row('failed', 80), row('done', 60), row('failed', 30)] });
  const sched = manualScheduler();
  const res = await requestRegeneration('U1', 'no cottage cheese', { adminDB, generate: async () => {}, schedule: sched.schedule, now: () => NOW });
  assert.equal(res.remaining, 0);
  assert.ok(res.id);
});

test('in progress: a pending row under 10 minutes old → 409 in_progress', async () => {
  const adminDB = fakeDB({ meal_plan_regenerations: [row('pending', 2)] });
  await assert.rejects(
    requestRegeneration('U1', 'bigger breakfast', { adminDB, generate: async () => {}, schedule: () => {}, now: () => NOW }),
    (e) => e.status === 409 && e.code === 'in_progress',
  );
});

test('stale pending (over 10 minutes) is closed as failed and no longer blocks', async () => {
  const stale = row('pending', PENDING_TIMEOUT_MS / 60000 + 1);
  const adminDB = fakeDB({ meal_plan_regenerations: [stale] });
  const res = await requestRegeneration('U1', 'bigger breakfast', { adminDB, generate: async () => {}, schedule: () => {}, now: () => NOW });
  assert.equal(res.remaining, 2);
  const closed = adminDB.tables.meal_plan_regenerations.find((r) => r.id === stale.id);
  assert.equal(closed.status, 'failed');
});

// ── Dietitian plans are never replaced ─────────────────────────────────────────

const DEFAULT_MANAGER = 'mgr-default';
const DIETITIAN = 'diet-1';

function accessWorld({ providerId = DEFAULT_MANAGER, providerRole = 'company_manager', settings = null, chatPlan = {}, clientPlan = {} } = {}) {
  const adminDB = fakeDB({
    meal_plan_regenerations: [],
    chat_users: [{ user_code: 'U1', provider_id: providerId }],
    profiles: [{ id: DEFAULT_MANAGER, role: 'company_manager' }, { id: DIETITIAN, role: providerRole }],
    dietitian_settings: settings ? [{ profile_id: providerId, is_active: true, ...settings }] : [],
    meal_plans_and_schemas: [{ id: 'p1', user_code: 'U1', record_type: 'meal_plan', status: 'active', dietitian_id: null, ...chatPlan }],
  });
  const clientDB = fakeDB({ client_meal_plans: [{ id: 'p1', user_code: 'U1', active: true, dietitian_id: null, ...clientPlan }] });
  return { adminDB, clientDB };
}

test('access: an AI plan of a default-manager client may be remade', async () => {
  const w = accessWorld();
  assert.deepEqual(await checkRegenerationAllowed('U1', w), { allowed: true, reason: null });
  const s = await getRegenerationStatus('U1', { ...w, now: () => NOW });
  assert.equal(s.allowed, true);
  assert.equal(s.remaining, 3);
});

test('access: a plan made or activated by a dietitian is blocked, in either database', async () => {
  for (const w of [accessWorld({ chatPlan: { dietitian_id: DIETITIAN } }), accessWorld({ clientPlan: { dietitian_id: DIETITIAN } })]) {
    assert.deepEqual(await checkRegenerationAllowed('U1', w), { allowed: false, reason: 'dietitian_plan' });
  }
  // An old dietitian plan that is no longer active does not count.
  const expired = accessWorld({ chatPlan: { status: 'expired', dietitian_id: DIETITIAN } });
  assert.equal((await checkRegenerationAllowed('U1', expired)).allowed, true);
});

test('access: a client whose provider is a real dietitian is blocked even on an AI plan', async () => {
  assert.equal((await checkRegenerationAllowed('U1', accessWorld({ providerId: DIETITIAN, providerRole: 'employee' }))).allowed, false);
  // A company manager with a public dietitian profile is a dietitian too...
  const solo = accessWorld({ providerId: DIETITIAN, providerRole: 'company_manager', settings: { display_name: 'Dana' } });
  assert.equal((await checkRegenerationAllowed('U1', solo)).allowed, false);
  // ...but a company manager with only an invite code is the company default.
  const bare = accessWorld({ providerId: DIETITIAN, providerRole: 'company_manager', settings: { invite_code: 'BC', display_name: null } });
  assert.equal((await checkRegenerationAllowed('U1', bare)).allowed, true);
});

test('access: GET reports allowed false and POST is refused with 403 dietitian_plan, nothing written', async () => {
  const w = accessWorld({ chatPlan: { dietitian_id: DIETITIAN } });
  const s = await getRegenerationStatus('U1', { ...w, now: () => NOW });
  assert.equal(s.allowed, false);
  assert.equal(s.reason, 'dietitian_plan');
  let generated = false;
  await assert.rejects(
    requestRegeneration('U1', 'more fish please', { ...w, generate: async () => { generated = true; }, schedule: (fn) => fn(), now: () => NOW }),
    (e) => e.status === 403 && e.code === 'dietitian_plan',
  );
  assert.equal(generated, false);
  assert.equal(w.adminDB.tables.meal_plan_regenerations.length, 0);
});

// ── Background run ────────────────────────────────────────────────────────────

test('accepted request: pending row, notes reach the generator, row marked done', async () => {
  const adminDB = fakeDB({ meal_plan_regenerations: [] });
  const calls = [];
  const sched = manualScheduler();
  const res = await requestRegeneration('U1', '  more fish, no cottage cheese  ', {
    adminDB,
    generate: async (userCode, notes) => { calls.push({ userCode, notes }); },
    schedule: sched.schedule,
    now: () => NOW,
  });
  assert.equal(res.remaining, 2);
  const [saved] = adminDB.tables.meal_plan_regenerations;
  assert.equal(saved.status, 'pending');
  assert.equal(saved.user_code, 'U1');
  assert.equal(saved.notes, 'more fish, no cottage cheese');
  assert.equal(calls.length, 0, 'generation waits for the scheduler (after the 202)');

  await sched.flush();
  assert.deepEqual(calls, [{ userCode: 'U1', notes: 'more fish, no cottage cheese' }]);
  assert.equal(saved.status, 'done');
  assert.ok(saved.finished_at);
});

test('generator failure marks the row failed with the message, and it does not use a try', async () => {
  const adminDB = fakeDB({ meal_plan_regenerations: [] });
  const sched = manualScheduler();
  await requestRegeneration('U1', 'more fish', {
    adminDB,
    generate: async () => { throw new Error('Create meal plan API error (503): down'); },
    schedule: sched.schedule,
    now: () => NOW,
  });
  await sched.flush();
  const [saved] = adminDB.tables.meal_plan_regenerations;
  assert.equal(saved.status, 'failed');
  assert.match(saved.error, /503/);
  const s = await getRegenerationStatus('U1', { adminDB, now: () => NOW });
  assert.equal(s.remaining, 3);
  assert.equal(s.pending, false);
  assert.equal(s.last.status, 'failed');
});

// ── The generator: notes reach the LLM prompt, new plan replaces the old one ───

const meal = (meal, title, alt) => ({
  meal,
  main: { meal_name: meal, meal_title: title, ingredients: [], nutrition: { calories: 500, protein: 30, carbs: 50, fat: 15 }, main_protein_source: '' },
  alternative: { meal_name: meal, meal_title: alt, ingredients: [], nutrition: { calories: 500, protein: 30, carbs: 50, fat: 15 }, main_protein_source: '' },
});

function generatorWorld() {
  const clientDB = fakeDB({
    client_meal_plans: [{
      id: 'old-plan', user_code: 'U1', active: true, created_at: minutesAgo(600),
      dietitian_meal_plan: { meals: [meal('Breakfast', 'Cottage cheese toast', 'Yogurt bowl'), meal('Lunch', 'Chicken rice', 'Tuna salad')] },
    }],
  });
  const adminDB = fakeDB({
    chat_users: [{ user_code: 'U1', full_name: 'Dana', daily_target_total_calories: 1800, macros: { protein: 120, carbs: 180, fat: 60 }, user_language: 'english', food_allergies: ['peanuts'] }],
    meal_plans_and_schemas: [{ id: 'old-plan', user_code: 'U1', record_type: 'meal_plan', status: 'active' }],
  });
  const builderBodies = [];
  const fetchImpl = async (_url, init) => {
    builderBodies.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ meals: [meal('Breakfast', 'Omelette', 'Granola'), meal('Lunch', 'Beef bowl', 'Lentil soup')], totals: { calories: 1800, protein: 120, carbs: 180, fat: 60 }, note: '' }) };
  };
  return { clientDB, adminDB, builderBodies, fetchImpl };
}

test('with clientNotes: notes go to the builder and to the LLM pass; new plan becomes the only active one', async () => {
  const w = generatorWorld();
  const llmInputs = [];
  const applyClientNotes = async (input) => {
    llmInputs.push(input);
    return { ...input.mealPlan, meals: [meal('Breakfast', 'Salmon toast', 'Smoked fish bagel'), meal('Lunch', 'Fish tacos', 'Shrimp salad')] };
  };

  const result = await createAndSaveOnboardingMealPlanForUser(
    null, 'U1',
    { clientDB: w.clientDB, adminDB: w.adminDB, fetchImpl: w.fetchImpl, applyClientNotes },
    { clientNotes: ' more fish, no cottage cheese ', replaceActive: true, throwOnError: true },
  );

  assert.ok(result?.planId);
  assert.equal(w.builderBodies[0].user_code, 'U1');
  assert.equal(w.builderBodies[0].client_notes, 'more fish, no cottage cheese');

  assert.equal(llmInputs.length, 1);
  assert.equal(llmInputs[0].clientNotes, 'more fish, no cottage cheese');
  assert.deepEqual(llmInputs[0].previousMealTitles, [
    'Breakfast: Cottage cheese toast / alternative: Yogurt bowl',
    'Lunch: Chicken rice / alternative: Tuna salad',
  ]);
  assert.deepEqual(llmInputs[0].userProfile.allergies, ['peanuts']);
  assert.equal(llmInputs[0].dailyCalories, 1800);

  const active = w.clientDB.tables.client_meal_plans.filter((p) => p.active);
  assert.equal(active.length, 1);
  assert.equal(active[0].id, result.planId);
  assert.equal(active[0].dietitian_meal_plan.meals[0].main.meal_title, 'Salmon toast');
  const activeChat = w.adminDB.tables.meal_plans_and_schemas.filter((p) => p.status === 'active');
  assert.deepEqual(activeChat.map((p) => p.id), [result.planId]);
  assert.equal(w.adminDB.tables.meal_plans_and_schemas.find((p) => p.id === 'old-plan').status, 'expired');
});

test('with clientNotes: an LLM failure throws and leaves the old plan active', async () => {
  const w = generatorWorld();
  await assert.rejects(
    createAndSaveOnboardingMealPlanForUser(
      null, 'U1',
      { clientDB: w.clientDB, adminDB: w.adminDB, fetchImpl: w.fetchImpl, applyClientNotes: async () => { throw new Error('LLM down'); } },
      { clientNotes: 'more fish', replaceActive: true, throwOnError: true },
    ),
    /LLM down/,
  );
  assert.deepEqual(w.clientDB.tables.client_meal_plans.filter((p) => p.active).map((p) => p.id), ['old-plan']);
});

test('onboarding call (no options) is unchanged: skips when an active plan exists, never throws', async () => {
  const w = generatorWorld();
  const result = await createAndSaveOnboardingMealPlanForUser(null, 'U1', { clientDB: w.clientDB, adminDB: w.adminDB, fetchImpl: w.fetchImpl });
  assert.equal(result, undefined);
  assert.equal(w.builderBodies.length, 0);

  const noCalories = fakeDB({ chat_users: [{ user_code: 'U2' }] });
  await assert.doesNotReject(createAndSaveOnboardingMealPlanForUser(null, 'U2', { clientDB: w.clientDB, adminDB: noCalories }));
});

test('prompt: the client notes and previous meals appear in a clear section', () => {
  const { systemPrompt, userPrompt } = buildClientNotesMealPlanPrompt({
    mealPlan: { meals: [] },
    clientNotes: 'more fish, no cottage cheese',
    previousMealTitles: ['Breakfast: Cottage cheese toast'],
    userProfile: { allergies: ['peanuts'] },
    dailyCalories: 1800,
    macrosTarget: { protein: '120g' },
  });
  assert.match(userPrompt, /The client saw their previous plan and asked for these changes — follow them unless they conflict with allergies\/medical limits or daily calorie\/macro targets:/);
  assert.match(userPrompt, /"""\nmore fish, no cottage cheese\n"""/);
  assert.match(userPrompt, /- Breakfast: Cottage cheese toast/);
  assert.match(userPrompt, /calories: 1800/);
  assert.match(systemPrompt, /CLIENT CHANGE REQUESTS/);
});

test('summarizeMealPlanTitles handles empty and partial plans', () => {
  assert.deepEqual(summarizeMealPlanTitles(null), []);
  assert.deepEqual(summarizeMealPlanTitles({ meals: [{ meal: 'Snack', main: { meal_title: 'Apple' } }] }), ['Snack: Apple']);
});
