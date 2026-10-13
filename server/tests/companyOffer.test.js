// Run: node --test tests/companyOffer.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  readCompanyOffer,
  offerPlanForPrice,
  toPublicCompanyOffer,
  offerSubscriptionMetadata,
  buildOfferProgress,
  getUserCompanyOffer,
} = require('../services/company-offer');

const volleyballConfig = {
  pricing: {
    customProducts: [],
    offer: {
      active: true,
      monthlyPriceId: 'price_volley_month',
      monthlyDollars: 15,
      yearlyPriceId: 'price_volley_year',
      yearlyDollars: 144,
      trialDays: 30,
      earnedFreeMonth: { activeDaysNeeded: 25, windowDays: 30, extraDays: 30 },
    },
  },
};

test('readCompanyOffer reads a valid offer', () => {
  const offer = readCompanyOffer(volleyballConfig);
  assert.deepEqual(offer, {
    monthlyPriceId: 'price_volley_month',
    yearlyPriceId: 'price_volley_year',
    monthlyDollars: 15,
    yearlyDollars: 144,
    trialDays: 30,
    earnedFreeMonth: { activeDaysNeeded: 25, windowDays: 30, extraDays: 30 },
  });
});

test('readCompanyOffer rejects missing, disabled or broken offers', () => {
  assert.equal(readCompanyOffer(null), null);
  assert.equal(readCompanyOffer({ pricing: {} }), null);
  assert.equal(readCompanyOffer({ pricing: { offer: { ...volleyballConfig.pricing.offer, active: false } } }), null);
  assert.equal(readCompanyOffer({ pricing: { offer: { ...volleyballConfig.pricing.offer, monthlyPriceId: '' } } }), null);
  assert.equal(readCompanyOffer({ pricing: { offer: { ...volleyballConfig.pricing.offer, yearlyDollars: 'abc' } } }), null);
});

test('an impossible earned-month rule is dropped, the prices still apply', () => {
  const offer = readCompanyOffer({
    pricing: { offer: { ...volleyballConfig.pricing.offer, earnedFreeMonth: { activeDaysNeeded: 40, windowDays: 30, extraDays: 30 } } },
  });
  assert.equal(offer.earnedFreeMonth, null);
  assert.equal(offer.monthlyDollars, 15);
});

test('public offer shows $12/month on the yearly plan', () => {
  const pub = toPublicCompanyOffer(readCompanyOffer(volleyballConfig), 'Volleyball Teams');
  assert.equal(pub.yearlyPerMonthDollars, 12);
  assert.equal(pub.savingsDollars, 36);
  assert.equal(pub.trialDays, 30);
  assert.equal(pub.companyName, 'Volleyball Teams');
  assert.equal('monthlyPriceId' in pub, false, 'price ids stay on the server');
});

test('offerPlanForPrice and metadata', () => {
  const offer = readCompanyOffer(volleyballConfig);
  assert.equal(offerPlanForPrice(offer, 'price_volley_year'), 'yearly');
  assert.equal(offerPlanForPrice(offer, 'price_volley_month'), 'monthly');
  assert.equal(offerPlanForPrice(offer, 'price_other'), null);
  assert.deepEqual(offerSubscriptionMetadata(offer, 'c1'), {
    offer_company_id: 'c1',
    offer_active_days_needed: '25',
    offer_window_days: '30',
    offer_extra_days: '30',
  });
});

test('buildOfferProgress before and after the free month', () => {
  const start = Math.floor(Date.now() / 1000) - 5 * 86400;
  const sub = {
    status: 'trialing',
    trial_start: start,
    trial_end: start + 30 * 86400,
    metadata: offerSubscriptionMetadata(readCompanyOffer(volleyballConfig), 'c1'),
  };
  const before = buildOfferProgress(sub, null);
  assert.equal(before.activeDays, 0);
  assert.equal(before.activeDaysNeeded, 25);
  assert.equal(before.windowOpen, true);
  assert.equal(before.freeMonthEarned, false);
  assert.equal(new Date(before.windowEndsAt).getTime(), (start + 30 * 86400) * 1000);

  const after = buildOfferProgress(
    { ...sub, metadata: { ...sub.metadata, offer_free_month_granted: 'true' } },
    { quantity: 25, period_ends_at: new Date((start + 30 * 86400) * 1000).toISOString() },
  );
  assert.equal(after.activeDays, 25);
  assert.equal(after.freeMonthEarned, true);

  assert.equal(buildOfferProgress({ ...sub, metadata: { offer_company_id: 'c1' } }, null), null);
});

test('getUserCompanyOffer resolves through the user company', async () => {
  const resolveUserCompany = async () => ({ companyId: 'c1', companyName: 'Volley', companyConfig: volleyballConfig });
  const found = await getUserCompanyOffer('u1', { resolveUserCompany });
  assert.equal(found.companyId, 'c1');
  assert.equal(found.offer.yearlyPriceId, 'price_volley_year');

  const none = await getUserCompanyOffer('u1', { resolveUserCompany: async () => ({ companyId: 'c2', companyConfig: {} }) });
  assert.equal(none, null);
  const broken = await getUserCompanyOffer('u1', { resolveUserCompany: async () => { throw new Error('db down'); } });
  assert.equal(broken, null);
});

// ── createCheckoutSession with stubbed Stripe / DB ─────────────────────────────

function stubModule(relPath, exportsValue) {
  const full = require.resolve(path.join(__dirname, '..', relPath));
  require.cache[full] = { id: full, filename: full, loaded: true, exports: exportsValue };
}

function loadControllerWith({ company }) {
  const created = [];
  const stripeStub = {
    checkout: { sessions: { create: async (cfg) => { created.push(cfg); return { id: 'cs_1', url: 'https://checkout' }; } } },
    customers: {
      list: async () => ({ data: [] }),
      create: async () => ({ id: 'cus_1' }),
      update: async () => ({}),
    },
    promotionCodes: { list: async () => ({ data: [] }) },
  };
  const dbStub = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) };
  stubModule('config/stripe.js', stripeStub);
  stubModule('config/db.js', { clientDB: dbStub, adminDB: dbStub, supabaseAuth: dbStub });
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

const req = (body) => ({ userId: 'u1', authUser: { email: 'a@b.c' }, headers: {}, body });

test('checkout: company user gets the company price, 30-day trial and offer metadata', async () => {
  const { ctrl, created } = loadControllerWith({
    company: { companyId: 'c1', companyName: 'Volley', companyConfig: volleyballConfig },
  });
  const res = fakeRes();
  await ctrl.createCheckoutSession(req({ plan: 'yearly', priceId: 'price_global_y', returnToApp: true }), res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const cfg = created[0];
  assert.deepEqual(cfg.line_items, [{ price: 'price_volley_year', quantity: 1 }]);
  assert.equal(cfg.subscription_data.trial_period_days, 30);
  assert.equal(cfg.payment_method_collection, 'always');
  assert.equal(cfg.subscription_data.metadata.offer_company_id, 'c1');
  assert.equal(cfg.subscription_data.metadata.offer_active_days_needed, '25');
  assert.equal(cfg.subscription_data.metadata.plan, 'yearly');

  const res2 = fakeRes();
  await ctrl.createCheckoutSession(req({ plan: 'monthly' }), res2);
  assert.deepEqual(created[1].line_items, [{ price: 'price_volley_month', quantity: 1 }]);
});

test('checkout: users without a company offer keep global pricing and the 3-day trial', async () => {
  const { ctrl, created } = loadControllerWith({ company: { companyId: 'c2', companyName: 'Other', companyConfig: {} } });
  const res = fakeRes();
  await ctrl.createCheckoutSession(req({ plan: 'monthly' }), res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual(created[0].line_items, [{ price: 'price_global_m', quantity: 1 }]);
  assert.equal(created[0].subscription_data.trial_period_days, require('../utils/constants').MEMBERSHIP_TRIAL_DAYS);
  assert.equal(created[0].subscription_data.metadata.offer_company_id, undefined);
});

test('membership-prices returns the company offer for company users', async () => {
  const { ctrl } = loadControllerWith({
    company: { companyId: 'c1', companyName: 'Volley', companyConfig: volleyballConfig },
  });
  const res = fakeRes();
  await ctrl.getMembershipPrices({ userId: 'u1' }, res);
  assert.equal(res.body.trialDays, 30);
  assert.equal(res.body.yearlyPerMonthDollars, 12);
  assert.deepEqual(res.body.earnedFreeMonth, { activeDaysNeeded: 25, windowDays: 30, extraDays: 30 });

  const { ctrl: ctrl2 } = loadControllerWith({ company: null });
  const res2 = fakeRes();
  await ctrl2.getMembershipPrices({ userId: 'u1' }, res2);
  assert.equal(res2.body.earnedFreeMonth, null);
  assert.equal(res2.body.monthlyDollars, 15);
});
