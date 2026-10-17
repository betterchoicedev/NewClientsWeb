// Run: node --test tests/paywallFlow.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  getUserPaywallFlow,
  freeMonthState,
  freeMonthCheckoutTrialEnd,
  expireFreeMonths,
} = require('../services/paywall-flow');

const DAY = 86_400_000;
const NOW = new Date('2026-10-18T10:00:00Z');

// ── In-memory Supabase stand-in (eq / is / lte filters, select / update / insert) ──

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
      delete() { q.op = 'delete'; return b; },
      eq(col, val) { q.filters.push((r) => r[col] === val); return b; },
      is(col, val) { q.filters.push((r) => (r[col] ?? null) === val); return b; },
      lte(col, val) { q.filters.push((r) => r[col] != null && r[col] <= val); return b; },
      gte(col, val) { q.filters.push((r) => r[col] != null && r[col] >= val); return b; },
      in(col, vals) { q.filters.push((r) => vals.includes(r[col])); return b; },
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

const switchOn = (flow, days = 30) => [{ id: 1, active_flow: flow, free_month_days: days }];

// ── the switch ────────────────────────────────────────────────────────────────

test('getUserPaywallFlow follows the switch for normal signups', async () => {
  const free = await getUserPaywallFlow('u1', { clientDB: fakeDB({ paywall_settings: switchOn('free_month', 14) }) });
  assert.deepEqual(free, { flow: 'free_month', trialDays: 14, reminderDays: [7, 3, 1, 0] });

  const card = await getUserPaywallFlow('u1', { clientDB: fakeDB({ paywall_settings: switchOn('card_trial') }) });
  assert.equal(card.flow, 'card_trial');
  assert.equal(card.trialDays, require('../utils/constants').MEMBERSHIP_TRIAL_DAYS);
});

test('company / invite-link users always get the card trial with their company pricing', async () => {
  const flow = await getUserPaywallFlow('u1', {
    clientDB: fakeDB({ paywall_settings: switchOn('free_month') }),
    resolveUserCompany: async () => ({ companyId: 'c1' }),
  });
  assert.equal(flow.flow, 'card_trial');
});

test('normal signups (put under the BetterChoice company) follow the switch', async () => {
  const { BETTERCHOICE_COMPANY_ID } = require('../utils/constants');
  const flow = await getUserPaywallFlow('u1', {
    clientDB: fakeDB({ paywall_settings: switchOn('free_month') }),
    resolveUserCompany: async () => ({ companyId: BETTERCHOICE_COMPANY_ID, companyName: 'BetterChoice' }),
  });
  assert.equal(flow.flow, 'free_month');
  assert.equal(flow.trialDays, 30);
});

test('getUserPaywallFlow falls back to the card trial until the table exists', async () => {
  const missing = {
    from: () => {
      const b = {
        select: () => b, eq: () => b,
        maybeSingle: async () => ({ data: null, error: { code: '42P01', message: 'relation does not exist' } }),
      };
      return b;
    },
  };
  assert.equal((await getUserPaywallFlow('u1', { clientDB: missing })).flow, 'card_trial');
  assert.equal((await getUserPaywallFlow('u1', { clientDB: fakeDB({ paywall_settings: [] }) })).flow, 'card_trial');
});

// ── free month state / checkout trial end ──────────────────────────────────────

const onFreeMonth = (endsInMs, status = 'trialing') => ({
  subscription_type: 'free_month',
  subscription_status: status,
  subscription_expires_at: new Date(NOW.getTime() + endsInMs).toISOString(),
});

test('freeMonthState reports days left and expiry', () => {
  assert.deepEqual(freeMonthState(onFreeMonth(10 * DAY), NOW), {
    trialEndsAt: new Date(NOW.getTime() + 10 * DAY).toISOString(),
    daysLeft: 10,
    expired: false,
  });
  assert.equal(freeMonthState(onFreeMonth(-1000), NOW).expired, true);
  assert.equal(freeMonthState(onFreeMonth(-1000), NOW).daysLeft, 0);
  assert.equal(freeMonthState(onFreeMonth(5 * DAY, 'trial_expired'), NOW).expired, true);
  assert.equal(freeMonthState({ subscription_type: 'membership', subscription_expires_at: NOW.toISOString() }, NOW), null);
});

test('freeMonthCheckoutTrialEnd waits for the free month end, or charges now near the end', () => {
  const end = NOW.getTime() + 10 * DAY;
  assert.equal(freeMonthCheckoutTrialEnd(onFreeMonth(10 * DAY), NOW), Math.floor(end / 1000));
  assert.equal(freeMonthCheckoutTrialEnd(onFreeMonth(DAY), NOW), null); // under Stripe's 48h minimum
  assert.equal(freeMonthCheckoutTrialEnd(onFreeMonth(-DAY), NOW), null);
});

test('expireFreeMonths ends only free months whose date passed, in both databases', async () => {
  const past = new Date(NOW.getTime() - DAY).toISOString();
  const future = new Date(NOW.getTime() + DAY).toISOString();
  const clientDB = fakeDB({
    clients: [
      { user_id: 'u1', user_code: 'A', subscription_type: 'free_month', subscription_status: 'trialing', subscription_expires_at: past },
      { user_id: 'u2', user_code: 'B', subscription_type: 'free_month', subscription_status: 'trialing', subscription_expires_at: future },
      { user_id: 'u3', user_code: 'C', subscription_type: 'membership', subscription_status: 'trialing', subscription_expires_at: past },
    ],
  });
  const adminDB = fakeDB({
    chat_users: [
      { user_code: 'A', subscription_type: 'free_month', subscription_status: 'trialing' },
      { user_code: 'B', subscription_type: 'free_month', subscription_status: 'trialing' },
    ],
  });
  assert.equal(await expireFreeMonths({ clientDB, adminDB }, NOW), 1);
  assert.deepEqual(clientDB.tables.clients.map((r) => r.subscription_status), ['trial_expired', 'trialing', 'trialing']);
  assert.deepEqual(adminDB.tables.chat_users.map((r) => r.subscription_status), ['trial_expired', 'trialing']);
});

// ── onboarding service: grantFreeMonth and status ─────────────────────────────

function stubModule(relPath, exportsValue) {
  const full = require.resolve(path.join(__dirname, '..', relPath));
  require.cache[full] = { id: full, filename: full, loaded: true, exports: exportsValue };
}

const welcomes = [];

function loadOnboardingService() {
  stubModule('services/ai.service.js', { createAndSaveOnboardingMealPlanForUser: async () => {} });
  stubModule('services/whatsapp.service.js', {
    sendWhatsAppWelcomeByUserId: async (userId) => { welcomes.push(userId); return { success: true }; },
  });
  const p = require.resolve('../modules/onboarding/onboarding.service');
  delete require.cache[p];
  return require(p);
}

function onboardingDBs({ flow = 'free_month', client = {} } = {}) {
  const clientDB = fakeDB({
    clients: [{ user_id: 'u1', user_code: 'A', email: 'a@b.c', onboarding_completed: false, app_trial_started_at: null, ...client }],
    paywall_settings: switchOn(flow),
    client_meal_plans: [],
    companies: [],
  });
  const adminDB = fakeDB({ chat_users: [{ id: 1, user_code: 'A' }], companies: [], profiles: [] });
  return { clientDB, adminDB };
}

test('grantFreeMonth starts a 30-day free month once and never extends it', async () => {
  const svc = loadOnboardingService();
  const dbs = onboardingDBs();
  const status = await svc.grantFreeMonth('u1', dbs);

  const client = dbs.clientDB.tables.clients[0];
  assert.equal(client.subscription_type, 'free_month');
  assert.equal(client.subscription_status, 'trialing');
  assert.ok(client.app_trial_started_at);
  assert.equal(dbs.adminDB.tables.chat_users[0].subscription_type, 'free_month');
  assert.equal(status.subscriptionStatus, 'trialing');
  assert.ok(status.freeMonth.daysLeft >= 29 && status.freeMonth.daysLeft <= 30);

  assert.equal(client.onboarding_completed, true);
  assert.equal(dbs.adminDB.tables.chat_users[0].onboarding_done, true);

  const firstEnd = client.subscription_expires_at;
  await svc.grantFreeMonth('u1', dbs);
  assert.equal(dbs.clientDB.tables.clients[0].subscription_expires_at, firstEnd);
  await new Promise((r) => setImmediate(r));
  assert.equal(welcomes.filter((u) => u === 'u1').length, 1);
});

test('grantFreeMonth is refused when the user\'s flow is the card trial', async () => {
  const svc = loadOnboardingService();
  const dbs = onboardingDBs({ flow: 'card_trial' });
  await assert.rejects(() => svc.grantFreeMonth('u1', dbs), (err) => err.status === 403);
  assert.equal(dbs.clientDB.tables.clients[0].subscription_type, undefined);
});

test('a user who already used the free month cannot start another one', async () => {
  const svc = loadOnboardingService();
  const dbs = onboardingDBs({ client: { app_trial_started_at: '2026-01-01T00:00:00Z', subscription_status: 'canceled' } });
  await svc.grantFreeMonth('u1', dbs);
  assert.equal(dbs.clientDB.tables.clients[0].subscription_status, 'canceled');
});

test('getStatus ends a free month whose date passed and reports trial_expired', async () => {
  const svc = loadOnboardingService();
  const past = new Date(Date.now() - DAY).toISOString();
  const dbs = onboardingDBs({
    client: { subscription_type: 'free_month', subscription_status: 'trialing', subscription_expires_at: past, onboarding_completed: true },
  });
  Object.assign(dbs.adminDB.tables.chat_users[0], { subscription_type: 'free_month', subscription_status: 'trialing' });

  const status = await svc.getStatus('u1', dbs);
  assert.equal(status.subscriptionStatus, 'trial_expired');
  assert.equal(status.freeMonth.expired, true);
  assert.equal(dbs.clientDB.tables.clients[0].subscription_status, 'trial_expired');
  assert.equal(dbs.adminDB.tables.chat_users[0].subscription_status, 'trial_expired');
});

// ── checkout and prices for free-month users ──────────────────────────────────

function loadBillingWith({ clientRow, company = null }) {
  const created = [];
  const stripeStub = {
    checkout: { sessions: { create: async (cfg) => { created.push(cfg); return { id: 'cs_1', url: 'https://checkout' }; } } },
    customers: { list: async () => ({ data: [] }), create: async () => ({ id: 'cus_1' }), update: async () => ({}) },
    promotionCodes: { list: async () => ({ data: [] }) },
  };
  const clientDB = fakeDB({ clients: [{ user_id: 'u1', ...clientRow }] });
  const adminDB = fakeDB({ companies: [] });
  stubModule('config/stripe.js', stripeStub);
  stubModule('config/db.js', { clientDB, adminDB, supabaseAuth: clientDB });
  stubModule('services/membership-pricing.js', {
    getMembershipOffer: async () => ({ monthlyCents: 1500, yearlyCents: 14400, monthlyPriceId: 'price_global_m', yearlyPriceId: 'price_global_y' }),
    toPublicOffer: () => ({ monthlyDollars: 15, yearlyDollars: 144, yearlyPerMonthDollars: 12, savingsDollars: 36 }),
  });
  stubModule('services/stripe.service.js', { handleCheckoutCompleted: async () => {}, handleSubscriptionCreated: async () => {} });
  stubModule('modules/onboarding/onboarding.service.js', { resolveUserCompany: async () => company });
  const ctrlPath = require.resolve('../modules/billing/billing.controller');
  delete require.cache[ctrlPath];
  return { ctrl: require(ctrlPath), created };
}

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

const checkoutReq = { userId: 'u1', authUser: { email: 'a@b.c' }, headers: {}, body: { plan: 'monthly', returnToApp: true } };

test('checkout: paying mid free month is charged when the month ends, with no extra trial', async () => {
  const endsAt = new Date(Date.now() + 10 * DAY);
  const { ctrl, created } = loadBillingWith({
    clientRow: { subscription_type: 'free_month', subscription_status: 'trialing', subscription_expires_at: endsAt.toISOString() },
  });
  const res = fakeRes();
  await ctrl.createCheckoutSession(checkoutReq, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const sub = created[0].subscription_data;
  assert.equal(sub.trial_end, Math.floor(endsAt.getTime() / 1000));
  assert.equal(sub.trial_period_days, undefined);
  assert.equal(sub.metadata.from_free_month, 'true');
});

test('checkout: paying after the free month ended charges right away', async () => {
  const { ctrl, created } = loadBillingWith({
    clientRow: { subscription_type: 'free_month', subscription_status: 'trial_expired', subscription_expires_at: new Date(Date.now() - DAY).toISOString() },
  });
  await ctrl.createCheckoutSession(checkoutReq, fakeRes());
  const sub = created[0].subscription_data;
  assert.equal(sub.trial_end, undefined);
  assert.equal(sub.trial_period_days, undefined);
});

test('checkout: users not on the free month keep the normal Stripe trial', async () => {
  const { ctrl, created } = loadBillingWith({ clientRow: { subscription_type: null } });
  await ctrl.createCheckoutSession(checkoutReq, fakeRes());
  assert.equal(created[0].subscription_data.trial_period_days, require('../utils/constants').MEMBERSHIP_TRIAL_DAYS);
});

test('membership-prices: free-month users see days until their first charge', async () => {
  const { ctrl } = loadBillingWith({
    clientRow: { subscription_type: 'free_month', subscription_status: 'trialing', subscription_expires_at: new Date(Date.now() + 10 * DAY).toISOString() },
  });
  const res = fakeRes();
  await ctrl.getMembershipPrices({ userId: 'u1' }, res);
  assert.equal(res.body.trialDays, 10);
  assert.equal(res.body.monthlyDollars, 15);

  const expired = loadBillingWith({
    clientRow: { subscription_type: 'free_month', subscription_status: 'trial_expired', subscription_expires_at: new Date(Date.now() - DAY).toISOString() },
  });
  const res2 = fakeRes();
  await expired.ctrl.getMembershipPrices({ userId: 'u1' }, res2);
  assert.equal(res2.body.trialDays, 0);
});

test('getStatus returns free month progress: meals, days logged and weight change', async () => {
  const svc = loadOnboardingService();
  const dbs = onboardingDBs({
    client: {
      subscription_type: 'free_month',
      subscription_status: 'trialing',
      subscription_expires_at: new Date(Date.now() + 5 * DAY).toISOString(),
      app_trial_started_at: '2026-10-01T08:00:00Z',
    },
  });
  Object.assign(dbs.adminDB.tables.chat_users[0], { subscription_type: 'free_month', subscription_status: 'trialing' });
  dbs.adminDB.tables.food_logs = [
    { user_id: 1, log_date: '2026-09-30' },
    { user_id: 1, log_date: '2026-10-02' },
    { user_id: 1, log_date: '2026-10-02' },
    { user_id: 1, log_date: '2026-10-05' },
    { user_id: 2, log_date: '2026-10-05' },
  ];
  dbs.adminDB.tables.weight_logs = [
    { user_code: 'A', weight_kg: 82, measurement_date: '2026-10-01' },
    { user_code: 'A', weight_kg: 79.6, measurement_date: '2026-10-15' },
  ];
  const status = await svc.getStatus('u1', dbs);
  assert.equal(status.freeMonth.expired, false);
  assert.deepEqual(status.freeMonth.progress, { mealsLogged: 3, daysLogged: 2, weightChangeKg: -2.4 });
});
