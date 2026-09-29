const stripe = require('../config/stripe');
const { clientDB } = require('../config/db');
const {
  MEMBERSHIP_PRODUCT_ID,
  MEMBERSHIP_MONTHLY_PRICE_ID,
  MEMBERSHIP_YEARLY_PRICE_ID,
  MEMBERSHIP_PORTAL_CONFIGURATION_ID,
} = require('../utils/constants');

const DEFAULT_MONTHLY_DOLLARS = 15;
const DEFAULT_YEARLY_DOLLARS = 144;

// priceId -> unit amount in cents, so a repeat request does not call Stripe again
// until the stored dollar amount changes.
const verifiedAmounts = new Map();

function dollarsToCents(value, fallbackDollars) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0.5 || n > 10000) return Math.round(fallbackDollars * 100);
  return Math.round(n * 100);
}

function tableMissing(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '');
  return code === 'PGRST205' || code === '42P01' || /does not exist|schema cache/i.test(message);
}

async function readDesired() {
  const { data, error } = await clientDB
    .from('membership_pricing')
    .select('monthly_dollars, yearly_dollars, monthly_price_id, yearly_price_id')
    .eq('id', 1)
    .maybeSingle();

  if (!error && data) {
    return {
      source: 'db',
      monthly_cents: dollarsToCents(data.monthly_dollars, DEFAULT_MONTHLY_DOLLARS),
      yearly_cents: dollarsToCents(data.yearly_dollars, DEFAULT_YEARLY_DOLLARS),
      monthly_price_id: data.monthly_price_id || MEMBERSHIP_MONTHLY_PRICE_ID,
      yearly_price_id: data.yearly_price_id || MEMBERSHIP_YEARLY_PRICE_ID,
    };
  }

  if (error && !tableMissing(error)) {
    console.warn('membership_pricing read failed, using Stripe product metadata', error.message);
  }

  const product = await stripe.products.retrieve(MEMBERSHIP_PRODUCT_ID);
  const meta = product.metadata || {};
  return {
    source: 'stripe',
    monthly_cents: dollarsToCents(meta.monthly_dollars, DEFAULT_MONTHLY_DOLLARS),
    yearly_cents: dollarsToCents(meta.yearly_dollars, DEFAULT_YEARLY_DOLLARS),
    monthly_price_id: meta.monthly_price_id || MEMBERSHIP_MONTHLY_PRICE_ID,
    yearly_price_id: meta.yearly_price_id || MEMBERSHIP_YEARLY_PRICE_ID,
  };
}

async function ensurePrice(desired, which) {
  const centsKey = which === 'yearly' ? 'yearly_cents' : 'monthly_cents';
  const idKey = which === 'yearly' ? 'yearly_price_id' : 'monthly_price_id';
  const interval = which === 'yearly' ? 'year' : 'month';
  const wanted = desired[centsKey];
  const currentId = desired[idKey];

  if (verifiedAmounts.get(currentId) === wanted) {
    return { id: currentId, created: false };
  }

  let current = null;
  try {
    current = await stripe.prices.retrieve(currentId);
  } catch {
    current = null;
  }

  if (current && current.active && current.unit_amount === wanted && current.currency === 'usd') {
    verifiedAmounts.set(current.id, wanted);
    return { id: current.id, created: false };
  }

  const created = await stripe.prices.create({
    product: MEMBERSHIP_PRODUCT_ID,
    unit_amount: wanted,
    currency: 'usd',
    recurring: { interval },
    metadata: { plan: which, app_plan: 'betterchoice_membership' },
  });
  verifiedAmounts.set(created.id, wanted);
  desired[idKey] = created.id;
  return { id: created.id, created: true };
}

async function persist(desired) {
  const metadataPatch = {
    monthly_dollars: String(desired.monthly_cents / 100),
    yearly_dollars: String(desired.yearly_cents / 100),
    monthly_price_id: desired.monthly_price_id,
    yearly_price_id: desired.yearly_price_id,
  };

  try {
    const product = await stripe.products.retrieve(MEMBERSHIP_PRODUCT_ID);
    await stripe.products.update(MEMBERSHIP_PRODUCT_ID, {
      metadata: { ...(product.metadata || {}), ...metadataPatch },
    });
  } catch (err) {
    console.warn('Could not save membership price ids on the Stripe product', err.message);
  }

  if (desired.source !== 'db') return;

  const { error } = await clientDB
    .from('membership_pricing')
    .update({
      monthly_price_id: desired.monthly_price_id,
      yearly_price_id: desired.yearly_price_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) console.warn('Could not save new price ids on membership_pricing', error.message);
}

async function pointPortal(monthlyPriceId, yearlyPriceId) {
  try {
    await stripe.billingPortal.configurations.update(MEMBERSHIP_PORTAL_CONFIGURATION_ID, {
      features: {
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price'],
          proration_behavior: 'none',
          products: [{
            product: MEMBERSHIP_PRODUCT_ID,
            prices: [monthlyPriceId, yearlyPriceId],
          }],
        },
      },
    });
  } catch (err) {
    console.warn('Could not update portal prices', err.message);
  }
}

async function getMembershipOffer() {
  const desired = await readDesired();
  const monthly = await ensurePrice(desired, 'monthly');
  const yearly = await ensurePrice(desired, 'yearly');
  desired.monthly_price_id = monthly.id;
  desired.yearly_price_id = yearly.id;

  if (monthly.created || yearly.created) {
    await persist(desired);
    await pointPortal(monthly.id, yearly.id);
  }

  return {
    monthlyCents: desired.monthly_cents,
    yearlyCents: desired.yearly_cents,
    monthlyPriceId: desired.monthly_price_id,
    yearlyPriceId: desired.yearly_price_id,
  };
}

function toPublicOffer(offer) {
  const monthlyDollars = offer.monthlyCents / 100;
  const yearlyDollars = offer.yearlyCents / 100;
  const yearlyPerMonthDollars = Math.round(offer.yearlyCents / 12) / 100;
  const savingsDollars = (offer.monthlyCents * 12 - offer.yearlyCents) / 100;
  return {
    monthlyDollars,
    yearlyDollars,
    yearlyPerMonthDollars,
    savingsDollars: Math.round(savingsDollars * 100) / 100,
  };
}

module.exports = { getMembershipOffer, toPublicOffer };
