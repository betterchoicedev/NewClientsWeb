// Run: node --test tests/onboardingCoachPrefs.test.js
// Onboarding v2: "Set up your coach", "Other: describe your diet" and "I already have a meal plan"
// travel in client_preference as flat keys (the chat prompt renders them key by key).
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  STEP_FIELD_MAP,
  buildClientPreference,
  mapAnswersToPayloads,
  saveStep,
} = require('../modules/onboarding/onboarding.service');

// ── In-memory Supabase stand-in (same shape as dietitianInvite.test.js) ───────

function fakeDB(tables) {
  const from = (table) => {
    const q = { op: 'select', filters: [], payload: null, returnRows: false };
    const rows = () => (tables[table] ||= []);
    const matches = (row) => q.filters.every((f) => f(row));
    const run = () => {
      if (q.op === 'insert') {
        const inserted = q.payload.map((r) => ({ id: `${table}-${rows().length + 1}`, ...r }));
        rows().push(...inserted);
        return { data: inserted, error: null };
      }
      const hit = rows().filter(matches);
      if (q.op === 'update') {
        hit.forEach((r) => Object.assign(r, q.payload));
        return { data: q.returnRows ? hit.map((r) => ({ ...r })) : null, error: null };
      }
      if (q.op === 'delete') {
        tables[table] = rows().filter((r) => !matches(r));
        return { data: null, error: null };
      }
      return { data: hit.map((r) => ({ ...r })), error: null };
    };
    const b = {
      select() { if (q.op !== 'select') q.returnRows = true; return b; },
      update(patch) { q.op = 'update'; q.payload = patch; return b; },
      insert(list) { q.op = 'insert'; q.payload = list; return b; },
      delete() { q.op = 'delete'; return b; },
      eq(col, val) { q.filters.push((r) => r[col] === val); return b; },
      is(col, val) { q.filters.push((r) => (r[col] ?? null) === val); return b; },
      limit() { return b; },
      order() { return b; },
      async maybeSingle() { const { data } = run(); return { data: data?.[0] || null, error: null }; },
      async single() { const { data } = run(); return { data: data?.[0] || null, error: null }; },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return b;
  };
  return { from, tables };
}

const coachAnswers = {
  first_name: 'Dana',
  last_name: 'Levi',
  language: 'en',
  client_preference: 'no mushrooms',
  diet_style: 'other',
  diet_description: ' Mediterranean, no red meat ',
  has_own_plan: true,
  coach_tone: 'direct',
  coach_focus: 'energy',
  coach_checkins: 'once_a_day',
  coach_about: 'Shift work, I cook on Sundays ',
};

test('buildClientPreference: every onboarding-v2 answer lands as a flat key', () => {
  assert.deepEqual(buildClientPreference(coachAnswers), {
    dietary_preferences: 'no mushrooms',
    diet_style: 'other',
    diet_description: 'Mediterranean, no red meat',
    has_own_plan: true,
    coach_tone: 'direct',
    coach_focus: 'energy',
    coach_checkins: 'once_a_day',
    coach_about: 'Shift work, I cook on Sundays',
  });
  for (const value of Object.values(buildClientPreference(coachAnswers))) {
    assert.ok(typeof value !== 'object', 'the chat prompt skips nested values');
  }
});

test('buildClientPreference: nothing to say stays undefined, blanks are dropped', () => {
  assert.equal(buildClientPreference({}), undefined);
  assert.equal(buildClientPreference({ first_name: 'Dana', coach_about: '   ', has_own_plan: false }), undefined);
  assert.deepEqual(buildClientPreference({ diet_style: 'keto' }), { diet_style: 'keto' });
  assert.deepEqual(buildClientPreference({ coach_checkins: 'only_when_asked' }), { coach_checkins: 'only_when_asked' });
});

test('mapAnswersToPayloads: the same client_preference on both databases', () => {
  const { clientData, chatUserData } = mapAnswersToPayloads(coachAnswers);
  assert.equal(clientData.client_preference.coach_tone, 'direct');
  assert.equal(clientData.client_preference.has_own_plan, true);
  assert.equal(clientData.dietary_preferences, 'no mushrooms');
  assert.deepEqual(chatUserData.client_preference, clientData.client_preference);

  // Without the new answers the old shape is unchanged.
  const legacy = mapAnswersToPayloads({ client_preference: 'no olives', diet_style: 'keto' });
  assert.deepEqual(legacy.chatUserData.client_preference, { dietary_preferences: 'no olives', diet_style: 'keto' });
  assert.equal(mapAnswersToPayloads({ first_name: 'Dana' }).chatUserData.client_preference, undefined);
});

test('STEP_FIELD_MAP: coach_setup saves client_preference on the chat side only', () => {
  assert.deepEqual(STEP_FIELD_MAP.coach_setup, { clientKeys: [], chatKeys: ['client_preference'] });
  assert.deepEqual(STEP_FIELD_MAP.preferences, { clientKeys: [], chatKeys: ['client_preference'] });
});

test('saveStep coach_setup: writes the flat keys to chat_users and touches nothing else', async () => {
  const clientDB = fakeDB({
    clients: [{ id: 'c1', user_id: 'user-1', user_code: 'CODE1', email: 'a@example.com', onboarding_completed: false, goal: 'lose' }],
  });
  const adminDB = fakeDB({
    chat_users: [{ id: 'ch1', user_code: 'CODE1', goal: 'lose', onboarding_data: null }],
  });

  const result = await saveStep('user-1', { stepId: 'coach_setup', answers: coachAnswers, stepIndex: 19, phase: 'questions' }, { clientDB, adminDB });
  assert.deepEqual(result, { ok: true, userCode: 'CODE1' });

  const chat = adminDB.tables.chat_users[0];
  assert.deepEqual(chat.client_preference, buildClientPreference(coachAnswers));
  assert.equal(chat.goal, 'lose', 'other columns untouched');
  assert.equal(chat.onboarding_done, false);
  assert.equal(chat.full_name, undefined, 'only the step\'s keys are written');

  const client = clientDB.tables.clients[0];
  assert.equal(client.client_preference, undefined, 'the clients side has no keys for this step');
  assert.equal(client.onboarding_completed, false);
});

test('saveStep: an unknown step is still refused', async () => {
  const clientDB = fakeDB({ clients: [{ id: 'c1', user_id: 'user-1', user_code: 'CODE1' }] });
  const adminDB = fakeDB({ chat_users: [{ id: 'ch1', user_code: 'CODE1' }] });
  await assert.rejects(
    saveStep('user-1', { stepId: 'coach_setup_v9', answers: {} }, { clientDB, adminDB }),
    /Unknown stepId/,
  );
});
