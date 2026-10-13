// End-to-end check of the company-offer billing timeline on Stripe TEST MODE using
// test clocks. Refuses to run with a live key. Creates temporary objects and removes them.
//
//   node scripts/e2e-company-offer-testclock.js
//
// Scenario A: user earns the free month on day 20 -> no charge on day 31, $15 on day 61.
// Scenario B: user does not earn it, yearly plan -> $144 charged on day 31.
// The trial extension uses the same Stripe call as backendapi maybe_grant_offer_free_month.

const stripe = require('../config/stripe');

const DAY = 86400;

async function waitReady(clockId) {
  for (let i = 0; i < 90; i++) {
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId);
    if (clock.status === 'ready') return clock;
    if (clock.status === 'internal_failure') throw new Error('test clock failed');
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('test clock did not settle');
}

async function advance(clockId, toUnix) {
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: toUnix });
  await waitReady(clockId);
}

async function paidInvoices(subId) {
  const list = await stripe.invoices.list({ subscription: subId, limit: 20 });
  return list.data.filter((i) => i.status === 'paid' && i.amount_paid > 0).map((i) => i.amount_paid);
}

async function startUser(clockId, priceId, label) {
  const customer = await stripe.customers.create({ test_clock: clockId, email: `offer-e2e-${label}@example.com` });
  const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id });
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } });
  return stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    trial_period_days: 30,
    metadata: {
      user_id: `e2e-${label}`,
      offer_company_id: 'e2e',
      offer_active_days_needed: '25',
      offer_window_days: '30',
      offer_extra_days: '30',
    },
  });
}

function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const balance = await stripe.balance.retrieve();
  if (balance.livemode) {
    console.error('Refusing to run: STRIPE_SECRET_KEY is a LIVE key. Use a test key.');
    process.exit(2);
  }

  const now = Math.floor(Date.now() / 1000);
  const product = await stripe.products.create({ name: 'E2E company offer (temporary)' });
  const monthly = await stripe.prices.create({ product: product.id, unit_amount: 1500, currency: 'usd', recurring: { interval: 'month' } });
  const yearly = await stripe.prices.create({ product: product.id, unit_amount: 14400, currency: 'usd', recurring: { interval: 'year' } });
  const clockA = await stripe.testHelpers.testClocks.create({ frozen_time: now, name: 'offer-e2e-A' });
  const clockB = await stripe.testHelpers.testClocks.create({ frozen_time: now, name: 'offer-e2e-B' });

  try {
    // ── Scenario A: earned free month, monthly plan
    let subA = await startUser(clockA.id, monthly.id, 'a');
    check('A: starts trialing with no charge', subA.status === 'trialing' && (await paidInvoices(subA.id)).length === 0);
    const trialEnd = subA.trial_end;
    check('A: trial ends 30 days after start', trialEnd - subA.trial_start === 30 * DAY);

    await advance(clockA.id, now + 20 * DAY);
    subA = await stripe.subscriptions.update(subA.id, {
      trial_end: trialEnd + 30 * DAY,
      proration_behavior: 'none',
      metadata: { offer_free_month_granted: 'true' },
    }, { idempotencyKey: `offer-free-month-${subA.id}-${trialEnd + 30 * DAY}` });
    check('A: trial extended to day 60', subA.trial_end === trialEnd + 30 * DAY && subA.status === 'trialing');
    check('A: extension creates no charge', (await paidInvoices(subA.id)).length === 0);

    await advance(clockA.id, now + 31 * DAY);
    subA = await stripe.subscriptions.retrieve(subA.id);
    check('A: day 31 still free (trialing, nothing paid)', subA.status === 'trialing' && (await paidInvoices(subA.id)).length === 0);

    await advance(clockA.id, now + 61 * DAY);
    subA = await stripe.subscriptions.retrieve(subA.id);
    const paidA = await paidInvoices(subA.id);
    check('A: day 61 charged $15 and active', subA.status === 'active' && paidA.length === 1 && paidA[0] === 1500, `paid=${paidA}`);

    // ── Scenario B: not earned, yearly plan
    let subB = await startUser(clockB.id, yearly.id, 'b');
    await advance(clockB.id, now + 31 * DAY);
    subB = await stripe.subscriptions.retrieve(subB.id);
    const paidB = await paidInvoices(subB.id);
    check('B: day 31 charged $144 for the year', subB.status === 'active' && paidB.length === 1 && paidB[0] === 14400, `paid=${paidB}`);
  } finally {
    await stripe.testHelpers.testClocks.del(clockA.id).catch(() => {});
    await stripe.testHelpers.testClocks.del(clockB.id).catch(() => {});
    await stripe.prices.update(monthly.id, { active: false }).catch(() => {});
    await stripe.prices.update(yearly.id, { active: false }).catch(() => {});
    await stripe.products.update(product.id, { active: false }).catch(() => {});
    console.log('Cleaned up test clocks and temporary prices');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
