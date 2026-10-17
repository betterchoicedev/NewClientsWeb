// Payment flow for normal signups, switched from Supabase (public.paywall_settings):
//
//   free_month  free month with no card; the app locks when it ends until they pay
//   card_trial  today's flow: card at checkout, short Stripe trial, then auto-charge
//
// Users who came through a company / invite link always get card_trial, which uses
// their company's pricing. Normal signups are put under the BetterChoice company,
// so that company counts as no company. See sql/paywall_flows.sql.

const { MEMBERSHIP_TRIAL_DAYS, BETTERCHOICE_COMPANY_ID } = require('../utils/constants');

const FREE_MONTH_FLOW = 'free_month';
const CARD_TRIAL_FLOW = 'card_trial';
const DEFAULT_FREE_MONTH_DAYS = 30;
// Days left on which the app shows the countdown and sends reminders.
const REMINDER_DAYS = [7, 3, 1, 0];

// Written to clients / chat_users while the no-card free month runs and after it ends.
const FREE_MONTH_SUBSCRIPTION_TYPE = 'free_month';
const TRIAL_EXPIRED_STATUS = 'trial_expired';

// Stripe Checkout needs trial_end at least 48 hours ahead.
const MIN_CHECKOUT_TRIAL_MS = 48 * 3600 * 1000;
const DAY_MS = 86_400_000;

const CARD_TRIAL = Object.freeze({ flow: CARD_TRIAL_FLOW, trialDays: MEMBERSHIP_TRIAL_DAYS, reminderDays: [] });

function tableMissing(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '');
  return code === 'PGRST205' || code === '42P01' || /does not exist|schema cache/i.test(message);
}

// The switch. Falls back to today's card trial until the table exists.
async function readPaywallSettings(clientDB) {
  const { data, error } = await clientDB
    .from('paywall_settings')
    .select('active_flow, free_month_days')
    .eq('id', 1)
    .maybeSingle();
  if (error && !tableMissing(error)) console.warn('paywall_settings read failed', error.message);
  if (error || !data || data.active_flow !== FREE_MONTH_FLOW) return CARD_TRIAL;

  const days = Number(data.free_month_days);
  return {
    flow: FREE_MONTH_FLOW,
    trialDays: Number.isInteger(days) && days > 0 && days <= 365 ? days : DEFAULT_FREE_MONTH_DAYS,
    reminderDays: REMINDER_DAYS,
  };
}

// The flow this user sees on the payment step.
async function getUserPaywallFlow(userId, { clientDB, adminDB, resolveUserCompany } = {}) {
  if (!userId || !clientDB) return CARD_TRIAL;
  try {
    if (typeof resolveUserCompany === 'function') {
      const company = await resolveUserCompany(userId, { clientDB, adminDB });
      if (company?.companyId && String(company.companyId) !== BETTERCHOICE_COMPANY_ID) return CARD_TRIAL;
    }
    return await readPaywallSettings(clientDB);
  } catch (err) {
    console.warn('getUserPaywallFlow failed, using card trial', err.message);
    return CARD_TRIAL;
  }
}

function isFreeMonthRow(row) {
  return row?.subscription_type === FREE_MONTH_SUBSCRIPTION_TYPE;
}

// State of the no-card free month for a clients / chat_users row, or null when the
// user is not on one. "expired" is true once the end date passed, even if the
// stored status still says trialing (the sweep has not run yet).
function freeMonthState(row, now = new Date()) {
  if (!isFreeMonthRow(row) || !row.subscription_expires_at) return null;
  const endsAt = new Date(row.subscription_expires_at);
  if (Number.isNaN(endsAt.getTime())) return null;
  const msLeft = endsAt.getTime() - now.getTime();
  return {
    trialEndsAt: endsAt.toISOString(),
    daysLeft: Math.max(0, Math.ceil(msLeft / DAY_MS)),
    expired: msLeft <= 0 || row.subscription_status === TRIAL_EXPIRED_STATUS,
  };
}

// When a free-month user pays before the month ends, the Stripe subscription starts
// trialing until the same end date so they are not charged early. Returns the unix
// trial_end, or null to charge right away.
function freeMonthCheckoutTrialEnd(row, now = new Date()) {
  const state = freeMonthState(row, now);
  if (!state || state.expired) return null;
  const endsAtMs = new Date(state.trialEndsAt).getTime();
  if (endsAtMs - now.getTime() < MIN_CHECKOUT_TRIAL_MS) return null;
  return Math.floor(endsAtMs / 1000);
}

function freeMonthEntitlement(trialDays, now = new Date()) {
  return {
    subscription_type: FREE_MONTH_SUBSCRIPTION_TYPE,
    subscription_status: 'trialing',
    subscription_expires_at: new Date(now.getTime() + trialDays * DAY_MS).toISOString(),
    updated_at: now.toISOString(),
  };
}

const expiredPatch = (now) => ({ subscription_status: TRIAL_EXPIRED_STATUS, updated_at: now.toISOString() });

// Marks one user's free month as ended in both databases.
async function expireFreeMonthForUser({ userId, userCode }, { clientDB, adminDB }, now = new Date()) {
  const patch = expiredPatch(now);
  const { error } = await clientDB
    .from('clients')
    .update(patch)
    .eq('user_id', userId)
    .eq('subscription_type', FREE_MONTH_SUBSCRIPTION_TYPE)
    .eq('subscription_status', 'trialing');
  if (error) console.warn('Could not expire free month on clients', error.message);
  if (adminDB && userCode) {
    const { error: chatErr } = await adminDB
      .from('chat_users')
      .update(patch)
      .eq('user_code', userCode)
      .eq('subscription_type', FREE_MONTH_SUBSCRIPTION_TYPE)
      .eq('subscription_status', 'trialing');
    if (chatErr) console.warn('Could not expire free month on chat_users', chatErr.message);
  }
}

// Ends every free month whose date passed, so the WhatsApp/Telegram bot sees it too
// for users who never open the app. Safe to run often and from several instances.
async function expireFreeMonths({ clientDB, adminDB }, now = new Date()) {
  const { data: rows, error } = await clientDB
    .from('clients')
    .select('user_id, user_code')
    .eq('subscription_type', FREE_MONTH_SUBSCRIPTION_TYPE)
    .eq('subscription_status', 'trialing')
    .lte('subscription_expires_at', now.toISOString())
    .limit(500);
  if (error) {
    console.warn('expireFreeMonths query failed', error.message);
    return 0;
  }
  for (const row of rows || []) {
    await expireFreeMonthForUser({ userId: row.user_id, userCode: row.user_code }, { clientDB, adminDB }, now);
  }
  return (rows || []).length;
}

// What the user did during the free month, for the lock screen and the countdown.
// Every part is best effort: a failed read leaves that number null.
async function loadFreeMonthProgress({ clientDB, adminDB, userId, userCode }) {
  const progress = { mealsLogged: null, daysLogged: null, weightChangeKg: null };
  if (!adminDB || !userCode) return progress;

  let since = null;
  try {
    const { data } = await clientDB.from('clients').select('app_trial_started_at').eq('user_id', userId).maybeSingle();
    since = data?.app_trial_started_at ? String(data.app_trial_started_at).slice(0, 10) : null;
  } catch (err) {
    console.warn('Could not read app_trial_started_at', err.message);
  }

  try {
    const { data: chatUser } = await adminDB.from('chat_users').select('id').eq('user_code', userCode).maybeSingle();
    if (chatUser?.id) {
      let query = adminDB.from('food_logs').select('log_date').eq('user_id', chatUser.id);
      if (since) query = query.gte('log_date', since);
      const { data: logs, error } = await query;
      if (!error && Array.isArray(logs)) {
        progress.mealsLogged = logs.length;
        progress.daysLogged = new Set(logs.map((l) => l.log_date).filter(Boolean)).size;
      }
    }
  } catch (err) {
    console.warn('Could not count free month meals', err.message);
  }

  try {
    let query = adminDB.from('weight_logs').select('weight_kg, measurement_date').eq('user_code', userCode);
    if (since) query = query.gte('measurement_date', since);
    const { data: weights, error } = await query.order('measurement_date', { ascending: true });
    const kgs = (!error && Array.isArray(weights) ? weights : [])
      .map((w) => Number(w.weight_kg))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (kgs.length >= 2) progress.weightChangeKg = Math.round((kgs[kgs.length - 1] - kgs[0]) * 10) / 10;
  } catch (err) {
    console.warn('Could not read free month weight change', err.message);
  }

  return progress;
}

module.exports = {
  loadFreeMonthProgress,
  FREE_MONTH_FLOW,
  CARD_TRIAL_FLOW,
  FREE_MONTH_SUBSCRIPTION_TYPE,
  TRIAL_EXPIRED_STATUS,
  readPaywallSettings,
  getUserPaywallFlow,
  isFreeMonthRow,
  freeMonthState,
  freeMonthCheckoutTrialEnd,
  freeMonthEntitlement,
  expireFreeMonthForUser,
  expireFreeMonths,
};
