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
 */

const REGENERATION_LIMIT = 3;
const PENDING_TIMEOUT_MS = 10 * 60 * 1000;
const NOTES_MIN_LENGTH = 3;
const NOTES_MAX_LENGTH = 1000;
const ERROR_MAX_LENGTH = 500;
const TABLE = 'meal_plan_regenerations';

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

/** GET /api/meal-plan/regenerations */
async function getRegenerationStatus(userCode, { adminDB, now = () => Date.now() } = {}) {
  requireDeps(userCode, adminDB);
  return summarizeRegenerations(await loadRows(userCode, adminDB), now());
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
 * 400 invalid_notes, 409 in_progress, 409 limit_reached.
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
  getRegenerationStatus,
  requestRegeneration,
  runRegeneration,
};
