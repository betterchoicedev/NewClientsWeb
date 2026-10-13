// Company pricing offers.
//
// A company can replace the global membership pricing with its own offer, stored in
// companies.config.pricing.offer:
//
//   {
//     "monthlyPriceId": "price_…", "monthlyDollars": 15,
//     "yearlyPriceId":  "price_…", "yearlyDollars": 144,
//     "trialDays": 30,
//     "earnedFreeMonth": { "activeDaysNeeded": 25, "windowDays": 30, "extraDays": 30 }
//   }
//
// Users whose provider belongs to that company see this offer on the paywall. The
// rule is copied onto the Stripe subscription metadata at checkout, so the usage
// counter (backendapi stripe_usage.py) can extend the trial without reading the config.

const COMPANY_OFFER_SUBSCRIPTION_TYPE = 'company_offer';

function positiveInt(value, max) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > max) return null;
  return n;
}

function positiveDollars(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0.5 || n > 10000) return null;
  return n;
}

function readEarnedFreeMonth(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const windowDays = positiveInt(raw.windowDays, 365);
  const activeDaysNeeded = positiveInt(raw.activeDaysNeeded, 365);
  const extraDays = positiveInt(raw.extraDays, 365);
  if (!windowDays || !activeDaysNeeded || !extraDays) return null;
  if (activeDaysNeeded > windowDays) return null;
  return { activeDaysNeeded, windowDays, extraDays };
}

// Returns the normalized offer, or null when the company has no usable offer.
function readCompanyOffer(companyConfig) {
  const raw = companyConfig?.pricing?.offer;
  if (!raw || typeof raw !== 'object' || raw.active === false) return null;

  const monthlyPriceId = typeof raw.monthlyPriceId === 'string' ? raw.monthlyPriceId.trim() : '';
  const yearlyPriceId = typeof raw.yearlyPriceId === 'string' ? raw.yearlyPriceId.trim() : '';
  const monthlyDollars = positiveDollars(raw.monthlyDollars);
  const yearlyDollars = positiveDollars(raw.yearlyDollars);
  if (!monthlyPriceId.startsWith('price_') || !yearlyPriceId.startsWith('price_')) return null;
  if (monthlyDollars == null || yearlyDollars == null) return null;

  return {
    monthlyPriceId,
    yearlyPriceId,
    monthlyDollars,
    yearlyDollars,
    trialDays: positiveInt(raw.trialDays, 730) || 0,
    earnedFreeMonth: readEarnedFreeMonth(raw.earnedFreeMonth),
  };
}

function offerPlanForPrice(offer, priceId) {
  if (!offer || !priceId) return null;
  if (priceId === offer.yearlyPriceId) return 'yearly';
  if (priceId === offer.monthlyPriceId) return 'monthly';
  return null;
}

function toPublicCompanyOffer(offer, companyName) {
  const yearlyPerMonthDollars = Math.round((offer.yearlyDollars / 12) * 100) / 100;
  const savingsDollars = Math.round((offer.monthlyDollars * 12 - offer.yearlyDollars) * 100) / 100;
  return {
    monthlyDollars: offer.monthlyDollars,
    yearlyDollars: offer.yearlyDollars,
    yearlyPerMonthDollars,
    savingsDollars,
    trialDays: offer.trialDays,
    earnedFreeMonth: offer.earnedFreeMonth,
    companyName: companyName || null,
  };
}

// Stripe metadata values must be strings.
function offerSubscriptionMetadata(offer, companyId) {
  const meta = { offer_company_id: String(companyId) };
  if (offer.earnedFreeMonth) {
    meta.offer_active_days_needed = String(offer.earnedFreeMonth.activeDaysNeeded);
    meta.offer_window_days = String(offer.earnedFreeMonth.windowDays);
    meta.offer_extra_days = String(offer.earnedFreeMonth.extraDays);
  }
  return meta;
}

function isCompanyOfferSubscription(subscription) {
  return Boolean(subscription?.metadata?.offer_company_id);
}

// Progress toward the earned free month, for the app's progress card.
// usageRow is the user's stripe_usage_log row (or null before the first active day).
function buildOfferProgress(subscription, usageRow) {
  const meta = subscription?.metadata || {};
  const activeDaysNeeded = positiveInt(meta.offer_active_days_needed, 365);
  const windowDays = positiveInt(meta.offer_window_days, 365);
  const extraDays = positiveInt(meta.offer_extra_days, 365);
  if (!activeDaysNeeded || !windowDays || !extraDays) return null;

  const startUnix = subscription.trial_start || subscription.start_date || subscription.created;
  const windowEndsAt = usageRow?.period_ends_at
    || (startUnix ? new Date((startUnix + windowDays * 86400) * 1000).toISOString() : null);
  const activeDays = Math.max(0, Number(usageRow?.quantity) || 0);
  const freeMonthEarned = meta.offer_free_month_granted === 'true';
  const windowOpen = windowEndsAt ? Date.now() < new Date(windowEndsAt).getTime() : false;

  return {
    activeDays: Math.min(activeDays, windowDays),
    activeDaysNeeded,
    extraDays,
    windowEndsAt,
    freeMonthEarned,
    windowOpen,
    trialEndsAt: subscription.status === 'trialing' && subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
  };
}

// Looks up the offer for the company the user belongs to (chat_users.provider_id ->
// profiles.company_id -> companies). Returns null when the company has no offer.
async function getUserCompanyOffer(userId, { clientDB, adminDB, resolveUserCompany }) {
  if (!userId || typeof resolveUserCompany !== 'function') return null;
  let company = null;
  try {
    company = await resolveUserCompany(userId, { clientDB, adminDB });
  } catch (err) {
    console.warn('Could not resolve company for offer lookup', err.message);
    return null;
  }
  if (!company?.companyId) return null;
  const offer = readCompanyOffer(company.companyConfig);
  if (!offer) return null;
  return { companyId: company.companyId, companyName: company.companyName, offer };
}

module.exports = {
  COMPANY_OFFER_SUBSCRIPTION_TYPE,
  readCompanyOffer,
  offerPlanForPrice,
  toPublicCompanyOffer,
  offerSubscriptionMetadata,
  isCompanyOfferSubscription,
  buildOfferProgress,
  getUserCompanyOffer,
};
