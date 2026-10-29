// Run: node --test tests/dietitianInvite.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  normalizeInviteCode,
  ensurePresetPrices,
  applyDietitianOverrides,
  loadDietitian,
  presetToOffer,
} = require('../services/dietitian-invite');
const { getUserPaywallFlow } = require('../services/paywall-flow');
const { readCompanyOffer } = require('../services/company-offer');
const {
  lookupInvite,
  resolveSignupProvider,
  claimInviteCode,
  getMyDietitian,
} = require('../modules/invite/invite.service');
const { MEMBERSHIP_PRODUCT_ID } = require('../utils/constants');

// ── In-memory Supabase stand-in (same shape as paywallFlow.test.js) ────────────

function fakeDB(tables) {
  const from = (table) => {
    const q = { op: 'select', filters: [], payload: null, returnRows: false };
    const rows = () => (tables[table] ||= []);
    const matches = (row) => q.filters.every((f) => f(row));
    const run = () => {
      if (q.op === 'insert') {
        const inserted = q.payload.map((r) => ({ ...r }));
        rows().push(...inserted);
        return { data: inserted, error: null };
      }
      const hit = rows().filter(matches);
      if (q.op === 'update') {
        hit.forEach((r) => Object.assign(r, q.payload));
        return { data: q.returnRows ? hit.map((r) => ({ ...r })) : null, error: null };
      }
      return { data: hit.map((r) => ({ ...r })), error: null };
    };
    const b = {
      select() { if (q.op !== 'select') q.returnRows = true; return b; },
      update(patch) { q.op = 'update'; q.payload = patch; return b; },
      insert(list) { q.op = 'insert'; q.payload = list; return b; },
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

const DANA = '11111111-1111-4111-8111-111111111111';
const COMPANY = '22222222-2222-4222-8222-222222222222';

const presets = () => [
  { id: 'standard', monthly_dollars: 15, yearly_dollars: 144, monthly_price_id: 'price_std_m', yearly_price_id: 'price_std_y', trial_type: 'free_month', trial_days: 30, is_active: true },
  { id: 'clinic_partner', monthly_dollars: 12, yearly_dollars: 120, monthly_price_id: null, yearly_price_id: null, trial_type: 'card_trial', trial_days: 7, is_active: true },
  { id: 'coaching_plus', monthly_dollars: 25, yearly_dollars: 240, monthly_price_id: 'price_cp_m', yearly_price_id: 'price_cp_y', trial_type: 'none', trial_days: 0, is_active: true },
];

function chatDB({ preset = 'standard', steps = [], settingsActive = true } = {}) {
  return fakeDB({
    profiles: [{ id: DANA, name: 'Dana placeholder', company_id: COMPANY, role: 'company_manager' }],
    companies: [{
      id: COMPANY,
      name: "Elad's Gym",
      config: {
        ui: { branding: { logoUrl: 'https://cdn.example/logo.png' } },
        onboarding: { customSteps: [{ id: 'co1', question: 'Company question?' }] },
        pricing: { offer: { active: true, monthlyPriceId: 'price_co_m', yearlyPriceId: 'price_co_y', monthlyDollars: 20, yearlyDollars: 200, trialDays: 10 } },
      },
    }],
    dietitian_settings: [{
      profile_id: DANA, invite_code: 'DANA', display_name: 'Dana Cohen', title: 'Clinical Dietitian',
      photo_url: 'https://cdn.example/dana.jpg', welcome_message: 'Welcome!', pricing_preset_id: preset,
      custom_steps: steps, is_active: settingsActive,
    }],
    pricing_presets: presets(),
    chat_users: [{ user_code: 'ABCDEF', provider_id: 'default-manager', subscription_status: null }],
  });
}

const fakeStripe = () => {
  const created = [];
  return {
    created,
    prices: { create: async (cfg) => { created.push(cfg); return { id: `price_new_${created.length}` }; } },
  };
};

// ── codes and overrides ───────────────────────────────────────────────────────

test('invite codes are normalized to upper case and validated', () => {
  assert.equal(normalizeInviteCode(' dana '), 'DANA');
  assert.equal(normalizeInviteCode('DANA-COHEN'), 'DANA-COHEN');
  assert.equal(normalizeInviteCode('ab'), null);
  assert.equal(normalizeInviteCode('dana cohen'), null);
  assert.equal(normalizeInviteCode(42), null);
});

test('dietitian questions are added after the company questions, preset replaces the company offer', () => {
  const company = { onboarding: { customSteps: [{ id: 'co1', question: 'Q1' }], includeNursingStatusQuestion: true }, pricing: { promoCodes: [] } };
  const preset = presets()[0];
  const merged = applyDietitianOverrides(company, { settings: { custom_steps: [{ id: 'd1', question: 'Q2' }] }, preset });
  assert.deepEqual(merged.onboarding.customSteps.map((s) => s.id), ['co1', 'd1']);
  assert.equal(merged.onboarding.includeNursingStatusQuestion, true);
  assert.deepEqual(merged.pricing.promoCodes, []);
  assert.equal(merged.pricing.offer.monthlyPriceId, 'price_std_m');
  assert.equal(company.onboarding.customSteps.length, 1, 'company config is not mutated');

  // Nothing set: the company config comes back as is.
  assert.equal(applyDietitianOverrides(company, null), company);
  assert.deepEqual(applyDietitianOverrides(company, { settings: { custom_steps: [] }, preset: null }), company);
});

test('preset offers are readable by the existing company-offer code', () => {
  const standard = readCompanyOffer({ pricing: { offer: presetToOffer(presets()[0]) } });
  assert.equal(standard.monthlyDollars, 15);
  assert.equal(standard.trialDays, 0, 'free month is the paywall flow, not a Stripe trial');
  const clinic = readCompanyOffer({ pricing: { offer: presetToOffer({ ...presets()[1], monthly_price_id: 'price_a', yearly_price_id: 'price_b' }) } });
  assert.equal(clinic.trialDays, 7);
});

test('missing preset prices are created once in Stripe and saved', async () => {
  const db = chatDB({ preset: 'clinic_partner' });
  const stripe = fakeStripe();
  const preset = await ensurePresetPrices(presets()[1], { adminDB: db, stripe });
  assert.equal(stripe.created.length, 2);
  assert.deepEqual(stripe.created.map((p) => [p.unit_amount, p.recurring.interval, p.product]), [
    [1200, 'month', MEMBERSHIP_PRODUCT_ID],
    [12000, 'year', MEMBERSHIP_PRODUCT_ID],
  ]);
  assert.equal(preset.monthly_price_id, 'price_new_1');
  const saved = db.tables.pricing_presets.find((p) => p.id === 'clinic_partner');
  assert.equal(saved.yearly_price_id, 'price_new_2');

  await ensurePresetPrices(saved, { adminDB: db, stripe });
  assert.equal(stripe.created.length, 2, 'no new prices once saved');
});

test('loadDietitian falls back to company pricing when Stripe fails', async () => {
  const db = chatDB({ preset: 'clinic_partner' });
  const broken = { prices: { create: async () => { throw new Error('stripe down'); } } };
  const dietitian = await loadDietitian(DANA, { adminDB: db, stripe: broken });
  assert.equal(dietitian.preset, null);
  assert.equal(dietitian.settings.invite_code, 'DANA');
  assert.equal(await loadDietitian('nobody', { adminDB: db }), null);
  assert.equal(await loadDietitian(DANA, { adminDB: chatDB({ settingsActive: false }) }), null);
});

// ── paywall flow per preset ───────────────────────────────────────────────────

test('the dietitian preset decides the paywall flow, even outside BetterChoice', async () => {
  const clientDB = fakeDB({ paywall_settings: [{ id: 1, active_flow: 'card_trial', free_month_days: 30 }] });
  const flowFor = (preset) => getUserPaywallFlow('u1', {
    clientDB,
    resolveUserCompany: async () => ({ companyId: COMPANY, dietitian: preset ? { preset } : null }),
  });

  assert.deepEqual(await flowFor(presets()[0]), { flow: 'free_month', trialDays: 30, reminderDays: [7, 3, 1, 0] });
  assert.deepEqual(await flowFor(presets()[1]), { flow: 'card_trial', trialDays: 7, reminderDays: [] });
  assert.deepEqual(await flowFor(presets()[2]), { flow: 'card_trial', trialDays: 0, reminderDays: [] });
  // No preset: company users keep today's card trial.
  assert.equal((await flowFor(null)).flow, 'card_trial');
});

// ── landing, signup, claim, my dietitian ──────────────────────────────────────

test('lookupInvite returns landing info without prices; unknown codes return null', async () => {
  const invite = await lookupInvite('dana', { adminDB: chatDB() });
  assert.deepEqual(invite, {
    code: 'DANA',
    dietitian: { name: 'Dana Cohen', title: 'Clinical Dietitian', photoUrl: 'https://cdn.example/dana.jpg' },
    company: { name: "Elad's Gym", logoUrl: 'https://cdn.example/logo.png' },
  });
  assert.equal(await lookupInvite('NOPE', { adminDB: chatDB() }), null);
  assert.equal(await lookupInvite('DANA', { adminDB: chatDB({ settingsActive: false }) }), null);
});

test('signup provider: the code wins, a sent providerId must be a real profile', async () => {
  const db = chatDB();
  assert.equal(await resolveSignupProvider({ inviteCode: 'dana' }, { adminDB: db }), DANA);
  assert.equal(await resolveSignupProvider({ inviteCode: 'dana', providerId: '33333333-3333-4333-8333-333333333333' }, { adminDB: db }), DANA);
  assert.equal(await resolveSignupProvider({ providerId: DANA }, { adminDB: db }), DANA);
  assert.equal(await resolveSignupProvider({ providerId: '33333333-3333-4333-8333-333333333333' }, { adminDB: db }), null);
  assert.equal(await resolveSignupProvider({ providerId: "x' or 1=1" }, { adminDB: db }), null);
  assert.equal(await resolveSignupProvider({ inviteCode: 'NOPE' }, { adminDB: db }), null);
});

function claimDeps({ client, chat = chatDB() } = {}) {
  const clientDB = fakeDB({ clients: [{ user_id: 'u1', user_code: 'ABCDEF', onboarding_completed: false, subscription_status: null, ...client }] });
  const ensureClientAndChatUser = async (userId) => clientDB.tables.clients.find((c) => c.user_id === userId);
  return { clientDB, adminDB: chat, ensureClientAndChatUser };
}

test('claiming a code moves a new client to that dietitian in both databases', async () => {
  const deps = claimDeps();
  const invite = await claimInviteCode('u1', ' dana ', deps);
  assert.equal(invite.dietitian.name, 'Dana Cohen');
  assert.equal(deps.adminDB.tables.chat_users[0].provider_id, DANA);
  assert.equal(deps.clientDB.tables.clients[0].provider_id, DANA);
  // Claiming again is fine.
  await claimInviteCode('u1', 'DANA', deps);
});

test('claiming is refused once the client has a plan, and for unknown codes', async () => {
  await assert.rejects(claimInviteCode('u1', 'DANA', claimDeps({ client: { subscription_status: 'active' } })), { status: 409, code: 'already_started' });
  await assert.rejects(claimInviteCode('u1', 'DANA', claimDeps({ client: { onboarding_completed: true } })), { status: 409 });
  await assert.rejects(claimInviteCode('u1', 'NOPE', claimDeps()), { status: 404, code: 'code_not_found' });
  await assert.rejects(claimInviteCode('u1', 'x', claimDeps()), { status: 400, code: 'invalid_code' });
});

test('my dietitian: card info with the welcome message, null without a dietitian profile', async () => {
  const deps = claimDeps();
  await claimInviteCode('u1', 'DANA', deps);
  const mine = await getMyDietitian('u1', deps);
  assert.deepEqual(mine, {
    name: 'Dana Cohen',
    title: 'Clinical Dietitian',
    photoUrl: 'https://cdn.example/dana.jpg',
    welcomeMessage: 'Welcome!',
    companyName: "Elad's Gym",
    companyLogoUrl: 'https://cdn.example/logo.png',
  });
  assert.equal(await getMyDietitian('u1', claimDeps()), null, 'default manager has no settings row');

  // A coach with only a code (no display name or photo) shows no card.
  const bare = claimDeps();
  await claimInviteCode('u1', 'DANA', bare);
  const row = bare.adminDB.tables.dietitian_settings[0];
  row.display_name = null;
  row.photo_url = null;
  assert.equal(await getMyDietitian('u1', bare), null);
});

// ── end to end through resolveUserCompany and checkout ────────────────────────

function stubModule(relPath, exportsValue) {
  const full = require.resolve(path.join(__dirname, '..', relPath));
  require.cache[full] = { id: full, filename: full, loaded: true, exports: exportsValue };
}

test('resolveUserCompany applies the dietitian preset and questions; checkout charges the preset', async () => {
  const chat = chatDB({ preset: 'coaching_plus', steps: [{ id: 'd1', question: 'Training goal?' }] });
  chat.tables.chat_users[0].provider_id = DANA;
  const clientDB = fakeDB({ clients: [{ user_id: 'u1', user_code: 'ABCDEF' }] });

  stubModule('services/ai.service.js', { createAndSaveOnboardingMealPlanForUser: async () => {} });
  const svcPath = require.resolve('../modules/onboarding/onboarding.service');
  delete require.cache[svcPath];
  const { resolveUserCompany } = require(svcPath);

  const company = await resolveUserCompany('u1', { clientDB, adminDB: chat });
  assert.equal(company.companyId, COMPANY);
  assert.equal(company.providerId, DANA);
  assert.deepEqual(company.companyConfig.onboarding.customSteps.map((s) => s.id), ['co1', 'd1']);
  assert.equal(company.companyConfig.pricing.offer.monthlyPriceId, 'price_cp_m');

  // Checkout with that company: the preset price, no trial ("none" preset).
  const created = [];
  stubModule('config/stripe.js', {
    checkout: { sessions: { create: async (cfg) => { created.push(cfg); return { id: 'cs_1', url: 'https://checkout' }; } } },
    customers: { list: async () => ({ data: [] }), create: async () => ({ id: 'cus_1' }), update: async () => ({}) },
    promotionCodes: { list: async () => ({ data: [] }) },
  });
  const dbStub = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) };
  stubModule('config/db.js', { clientDB: dbStub, adminDB: dbStub, supabaseAuth: dbStub });
  stubModule('services/membership-pricing.js', {
    getMembershipOffer: async () => ({ monthlyCents: 1500, yearlyCents: 14400, monthlyPriceId: 'price_global_m', yearlyPriceId: 'price_global_y' }),
    toPublicOffer: () => ({}),
  });
  stubModule('services/stripe.service.js', { handleCheckoutCompleted: async () => {}, handleSubscriptionCreated: async () => {} });
  stubModule('modules/onboarding/onboarding.service.js', { resolveUserCompany: async () => company });
  const ctrlPath = require.resolve('../modules/billing/billing.controller');
  delete require.cache[ctrlPath];
  const ctrl = require(ctrlPath);

  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  await ctrl.createCheckoutSession({ userId: 'u1', authUser: { email: 'a@b.c' }, headers: {}, body: { plan: 'yearly', returnToApp: true } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual(created[0].line_items, [{ price: 'price_cp_y', quantity: 1 }]);
  assert.equal(created[0].subscription_data.trial_period_days, undefined);
  assert.equal(created[0].subscription_data.metadata.offer_company_id, COMPANY);
});
