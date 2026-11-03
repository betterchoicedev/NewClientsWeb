/**
 * "Not happy with your meal plan? Tell us what to change and we'll make a new one."
 *
 * A client may ask for a new AI meal plan up to REGENERATION_LIMIT times. Each request is a
 * row in meal_plan_regenerations (Chat DB, sql/meal_plan_regenerations.sql). Rows that end
 * 'failed' don't use up a try. A 'pending' row older than PENDING_TIMEOUT_MS is treated as
 * failed (the instance probably died mid-run).
 *
 * The plan itself is built by createAndSaveOnboardingMealPlanForUser with the client's notes,
 * and saved as the active plan the same way the onboarding plan is.
 *
 * Only AI plans may be remade. A client of a real dietitian never gets the option, so an AI
 * plan can't overwrite their dietitian's work (see checkRegenerationAllowed).
 */

const REGENERATION_LIMIT = 3;
const PENDING_TIMEOUT_MS = 10 * 60 * 1000;
const NOTES_MIN_LENGTH = 3;
const NOTES_MAX_LENGTH = 1000;
const ERROR_MAX_LENGTH = 500;
const TABLE = 'meal_plan_regenerations';
// Providers with these roles are the company default every normal signup gets, not a dietitian.
const DEFAULT_PROVIDER_ROLES = new Set(['company_manager', 'sys_admin']);

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/** Trimmed notes, or null when they are not a 3..1000 character string. */
function normalizeNotes(raw) {
  if (typeof raw !== 'string') return null;
  const notes = raw.trim();
  if (notes.length < NOTES_MIN_LENGTH || notes.length > NOTES_MAX_LENGTH) return null;
  return notes;
}

function isStalePending(row, nowMs) {
  if (row.status !== 'pending') return false;
  const created = Date.parse(row.created_at);
  return Number.isFinite(created) && nowMs - created > PENDING_TIMEOUT_MS;
}

/** Status as the client should see it: a stale pending row counts as failed. */
function effectiveStatus(row, nowMs) {
  return isStalePending(row, nowMs) ? 'failed' : row.status;
}

/** { used, limit, remaining, pending, last } from the user's rows (any order). */
function summarizeRegenerations(rows, nowMs = Date.now()) {
  const list = Array.isArray(rows) ? [...rows] : [];
  list.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const statuses = list.map((r) => effectiveStatus(r, nowMs));
  const used = statuses.filter((s) => s !== 'failed').length;
  const pending = statuses.includes('pending');
  const last = list.length ? { status: statuses[0], created_at: list[0].created_at } : null;
  return {
    used,
    limit: REGENERATION_LIMIT,
    remaining: Math.max(0, REGENERATION_LIMIT - used),
    pending,
    last,
  };
}

async function loadRows(userCode, adminDB) {
  const { data, error } = await adminDB
    .from(TABLE)
    .select('id, status, created_at')
    .eq('user_code', userCode)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

function requireDeps(userCode, adminDB) {
  if (!userCode) throw httpError(400, 'no_user_code', 'Your account is not set up yet');
  if (!adminDB) throw httpError(503, 'unavailable', 'Chat database is not configured');
}

async function readOptional(query) {
  const { data, error } = await query;
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

/**
 * Whether the client may ask for an AI plan: { allowed: true } or { allowed: false, reason }.
 *
 * Not allowed (reason 'dietitian_plan') when
 *  - the active plan carries a dietitian_id (made or activated from the dietitian site; AI
 *    plans never set it), or
 *  - the client's provider is a real dietitian: anyone who isn't a company manager / admin
 *    (the default every normal signup gets), or a coach with a public profile (name or photo).
 * The dietitian site does not stamp dietitian_id when it edits a plan in place, so plan data
 * alone can't prove an AI plan was never touched; the provider rule covers that case.
 */
async function checkRegenerationAllowed(userCode, { clientDB, adminDB }) {
  const blocked = { allowed: false, reason: 'dietitian_plan' };

  const chatUser = await readOptional(
    adminDB.from('chat_users').select('provider_id').eq('user_code', userCode).maybeSingle(),
  );
  const providerId = chatUser?.provider_id || null;
  if (providerId) {
    const profile = await readOptional(
      adminDB.from('profiles').select('id, role').eq('id', providerId).maybeSingle(),
    );
    if (profile && !DEFAULT_PROVIDER_ROLES.has(profile.role)) return blocked;
    const { loadDietitianSettings } = require('./dietitian-invite');
    const settings = await loadDietitianSettings(providerId, { adminDB });
    if (settings && (settings.display_name || settings.photo_url)) return blocked;
  }

  const chatPlans = await readOptional(
    adminDB
      .from('meal_plans_and_schemas')
      .select('id, dietitian_id')
      .eq('user_code', userCode)
      .eq('record_type', 'meal_plan')
      .eq('status', 'active'),
  );
  if ((chatPlans || []).some((p) => p.dietitian_id)) return blocked;

  if (clientDB) {
    const clientPlans = await readOptional(
      clientDB.from('client_meal_plans').select('id, dietitian_id').eq('user_code', userCode).eq('active', true),
    );
    if ((clientPlans || []).some((p) => p.dietitian_id)) return blocked;
  }

  return { allowed: true, reason: null };
}

/** GET /api/meal-plan/regenerations → summary + { allowed, reason } */
async function getRegenerationStatus(userCode, { adminDB, clientDB, now = () => Date.now() } = {}) {
  requireDeps(userCode, adminDB);
  const [rows, access] = await Promise.all([
    loadRows(userCode, adminDB),
    checkRegenerationAllowed(userCode, { clientDB, adminDB }),
  ]);
  return { ...summarizeRegenerations(rows, now()), ...access };
}

function defaultGenerate({ clientDB, adminDB }) {
  return (userCode, notes) => {
    // Lazy: ai.service pulls in sharp and other heavy modules.
    const { createAndSaveOnboardingMealPlanForUser } = require('./ai.service');
    return createAndSaveOnboardingMealPlanForUser(
      null,
      userCode,
      { clientDB, adminDB },
      { clientNotes: notes, replaceActive: true, throwOnError: true },
    );
  };
}

async function finishRow(adminDB, id, patch) {
  const { error } = await adminDB
    .from(TABLE)
    .update({ ...patch, finished_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('meal_plan_regenerations update failed:', id, error.message || error);
}

/** Builds the plan and records the outcome on the row. Never throws. */
async function runRegeneration({ id, userCode, notes }, { adminDB, generate }) {
  try {
    await generate(userCode, notes);
    await finishRow(adminDB, id, { status: 'done', error: null });
  } catch (err) {
    const message = String(err?.message || err || 'Unknown error').slice(0, ERROR_MAX_LENGTH);
    console.error('❌ Meal plan regeneration failed for user_code:', userCode, message);
    await finishRow(adminDB, id, { status: 'failed', error: message });
  }
}

/**
 * POST /api/meal-plan/regenerate. userCode must come from the auth token (req.userCode).
 * Resolves to { id, remaining } once the pending row exists; the plan is built afterwards
 * through `schedule` (setImmediate). Throws an error with .status and .code otherwise:
 * 400 invalid_notes, 403 dietitian_plan, 409 in_progress, 409 limit_reached.
 */
async function requestRegeneration(userCode, rawNotes, deps = {}) {
  const { adminDB, clientDB } = deps;
  const now = deps.now || (() => Date.now());
  const schedule = deps.schedule || setImmediate;
  const generate = deps.generate || defaultGenerate({ clientDB, adminDB });

  requireDeps(userCode, adminDB);
  const notes = normalizeNotes(rawNotes);
  if (!notes) {
    throw httpError(400, 'invalid_notes', `Tell us what to change in ${NOTES_MIN_LENGTH} to ${NOTES_MAX_LENGTH} characters`);
  }

  const access = await checkRegenerationAllowed(userCode, { clientDB, adminDB });
  if (!access.allowed) {
    throw httpError(403, 'dietitian_plan', 'Your dietitian made your plan. Ask them for changes.');
  }

  const rows = await loadRows(userCode, adminDB);
  const nowMs = now();

  // Close pending rows that never finished, so they stop blocking and don't use up a try.
  const stale = rows.filter((r) => isStalePending(r, nowMs));
  for (const row of stale) {
    await finishRow(adminDB, row.id, { status: 'failed', error: 'Timed out' });
  }

  const summary = summarizeRegenerations(rows, nowMs);
  if (summary.pending) throw httpError(409, 'in_progress', 'Your new plan is still being made');
  if (summary.remaining <= 0) throw httpError(409, 'limit_reached', 'You have used all your plan changes');

  const { data: inserted, error: insertError } = await adminDB
    .from(TABLE)
    .insert({ user_code: userCode, notes, status: 'pending' })
    .select('id, created_at')
    .single();
  // A unique index allows one pending row per client, so a double tap lands here.
  if (insertError?.code === '23505') throw httpError(409, 'in_progress', 'Your new plan is still being made');
  if (insertError) throw insertError;
  if (!inserted?.id) throw new Error('Failed to record the request');

  schedule(() => {
    void runRegeneration({ id: inserted.id, userCode, notes }, { adminDB, generate });
  });

  return { id: inserted.id, remaining: summary.remaining - 1 };
}

module.exports = {
  REGENERATION_LIMIT,
  PENDING_TIMEOUT_MS,
  NOTES_MIN_LENGTH,
  NOTES_MAX_LENGTH,
  normalizeNotes,
  summarizeRegenerations,
  checkRegenerationAllowed,
  getRegenerationStatus,
  requestRegeneration,
  runRegeneration,
};
