// Dietitian invite codes and per-dietitian settings (Chat DB, sql/dietitian_invites.sql).
//
//   dietitian_settings  one row per dietitian (profiles.id): invite code (e.g. DANA), landing
//                       info, the plan preset they picked and their extra onboarding questions
//   pricing_presets     plans an admin defines; dietitians choose one, they never type prices
//
// A client belongs to a dietitian through chat_users.provider_id. The dietitian's settings sit
// on top of their company's config: their questions are added after the company's, and their
// preset replaces the company's pricing offer. Anything they did not set falls back to the company.

const { MEMBERSHIP_PRODUCT_ID } = require('../utils/constants');

const INVITE_CODE_RE = /^[A-Z0-9-]{3,20}$/;
const TRIAL_TYPES = new Set(['free_month', 'card_trial', 'none']);
const DEFAULT_FREE_MONTH_DAYS = 30;

const SETTINGS_COLUMNS =
  'profile_id, invite_code, display_name, title, photo_url, welcome_message, pricing_preset_id, custom_steps, is_active';
const PRESET_COLUMNS =
  'id, name_en, name_he, monthly_dollars, yearly_dollars, monthly_price_id, yearly_price_id, trial_type, trial_days, is_active';

function tableMissing(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '');
  return code === 'PGRST205' || code === '42P01' || /does not exist|schema cache/i.test(message);
}

// "dana " -> "DANA". Returns null for anything that cannot be a code.
function normalizeInviteCode(raw) {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return INVITE_CODE_RE.test(code) ? code : null;
}

async function selectOne(adminDB, table, columns, column, value) {
  if (!adminDB || value == null) return null;
  const { data, error } = await adminDB.from(table).select(columns).eq(column, value).maybeSingle();
  if (error) {
    if (!tableMissing(error)) console.warn(`${table} read failed`, error.message);
    return null;
  }
  return data || null;
}

async function loadDietitianSettings(profileId, { adminDB }) {
  const row = await selectOne(adminDB, 'dietitian_settings', SETTINGS_COLUMNS, 'profile_id', profileId);
  return row && row.is_active !== false ? row : null;
}

async function findDietitianByCode(rawCode, { adminDB }) {
  const code = normalizeInviteCode(rawCode);
  if (!code) return null;
  const row = await selectOne(adminDB, 'dietitian_settings', SETTINGS_COLUMNS, 'invite_code', code);
  return row && row.is_active !== false ? row : null;
}

async function loadPreset(presetId, { adminDB }) {
  if (!presetId) return null;
  const row = await selectOne(adminDB, 'pricing_presets', PRESET_COLUMNS, 'id', presetId);
  if (!row || row.is_active === false || !TRIAL_TYPES.has(row.trial_type)) return null;
  return row;
}

// Presets are stored with dollar amounts only; the Stripe Prices are made the first time a
// client of that preset reaches the paywall. Two requests racing both create a price; only
// the first is saved and the other stays unused in Stripe, which is harmless.
async function ensurePresetPrices(preset, { adminDB, stripe }) {
  if (preset.monthly_price_id && preset.yearly_price_id) return preset;
  const create = (dollars, interval) =>
    stripe.prices.create({
      product: MEMBERSHIP_PRODUCT_ID,
      unit_amount: Math.round(Number(dollars) * 100),
      currency: 'usd',
      recurring: { interval },
      metadata: { app_plan: 'betterchoice_membership', preset_id: preset.id, plan: interval === 'year' ? 'yearly' : 'monthly' },
    });

  const monthlyId = preset.monthly_price_id || (await create(preset.monthly_dollars, 'month')).id;
  const yearlyId = preset.yearly_price_id || (await create(preset.yearly_dollars, 'year')).id;
  const { error } = await adminDB
    .from('pricing_presets')
    .update({ monthly_price_id: monthlyId, yearly_price_id: yearlyId, updated_at: new Date().toISOString() })
    .eq('id', preset.id);
  if (error) console.warn('Could not save preset price ids', error.message);
  return { ...preset, monthly_price_id: monthlyId, yearly_price_id: yearlyId };
}

// The preset in the companies.config.pricing.offer shape (see services/company-offer.js), so
// the paywall prices, the checkout allow-list and the Stripe metadata work unchanged.
// The free month itself is the paywall flow (see paywall-flow.js), not a Stripe trial.
function presetToOffer(preset) {
  return {
    active: true,
    monthlyPriceId: preset.monthly_price_id,
    yearlyPriceId: preset.yearly_price_id,
    monthlyDollars: Number(preset.monthly_dollars),
    yearlyDollars: Number(preset.yearly_dollars),
    trialDays: preset.trial_type === 'card_trial' ? Number(preset.trial_days) || 0 : 0,
    presetId: preset.id,
  };
}

function cleanSteps(steps) {
  return Array.isArray(steps) ? steps.filter((s) => s && typeof s === 'object') : [];
}

// Company config with the dietitian's settings on top. Never mutates the input.
function applyDietitianOverrides(companyConfig, dietitian) {
  const base = companyConfig && typeof companyConfig === 'object' ? companyConfig : {};
  if (!dietitian) return base;
  const config = { ...base };

  const extraSteps = cleanSteps(dietitian.settings?.custom_steps);
  if (extraSteps.length) {
    const onboarding = { ...(base.onboarding || {}) };
    onboarding.customSteps = [...cleanSteps(onboarding.customSteps), ...extraSteps];
    config.onboarding = onboarding;
  }

  if (dietitian.preset?.monthly_price_id && dietitian.preset?.yearly_price_id) {
    config.pricing = { ...(base.pricing || {}), offer: presetToOffer(dietitian.preset) };
  }
  return config;
}

// The dietitian behind a provider id, with their preset (Stripe prices ensured).
// Returns null when the provider has no settings row. Never throws.
async function loadDietitian(providerId, { adminDB, stripe }) {
  try {
    const settings = await loadDietitianSettings(providerId, { adminDB });
    if (!settings) return null;
    let preset = await loadPreset(settings.pricing_preset_id, { adminDB });
    if (preset) {
      try {
        preset = await ensurePresetPrices(preset, { adminDB, stripe: stripe || require('../config/stripe') });
      } catch (err) {
        console.warn('Could not create preset prices, using company pricing', err.message);
        preset = null;
      }
    }
    return { profileId: providerId, settings, preset };
  } catch (err) {
    console.warn('loadDietitian failed', err.message);
    return null;
  }
}

function companyLogoUrl(companyConfig) {
  const url = companyConfig?.ui?.branding?.logoUrl;
  return typeof url === 'string' && /^https:\/\//.test(url) ? url : null;
}

// What the in-app landing page shows for a code. No prices: the paywall shows those later.
function toPublicInvite({ settings, profileName, companyName, companyConfig }) {
  return {
    code: settings.invite_code,
    dietitian: {
      name: settings.display_name || profileName || null,
      title: settings.title || null,
      photoUrl: settings.photo_url || null,
    },
    company: {
      name: companyName || null,
      logoUrl: companyLogoUrl(companyConfig),
    },
  };
}

// The "My dietitian" card and the one-time welcome message.
function toPublicDietitian({ settings, profileName, companyName, companyConfig }) {
  return {
    ...toPublicInvite({ settings, profileName, companyName, companyConfig }).dietitian,
    welcomeMessage: settings?.welcome_message || null,
    companyName: companyName || null,
    companyLogoUrl: companyLogoUrl(companyConfig),
  };
}

// Paywall flow for a preset (see paywall-flow.js for the flow shape).
function presetPaywallFlow(preset, { freeMonthFlow, cardTrialFlow, reminderDays }) {
  if (preset.trial_type === 'free_month') {
    const days = Number(preset.trial_days);
    return {
      flow: freeMonthFlow,
      trialDays: Number.isInteger(days) && days > 0 && days <= 365 ? days : DEFAULT_FREE_MONTH_DAYS,
      reminderDays,
    };
  }
  const days = preset.trial_type === 'card_trial' ? Number(preset.trial_days) || 0 : 0;
  return { flow: cardTrialFlow, trialDays: days, reminderDays: [] };
}

module.exports = {
  INVITE_CODE_RE,
  normalizeInviteCode,
  findDietitianByCode,
  loadDietitianSettings,
  loadPreset,
  ensurePresetPrices,
  presetToOffer,
  applyDietitianOverrides,
  loadDietitian,
  toPublicInvite,
  toPublicDietitian,
  presetPaywallFlow,
};
