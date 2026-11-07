const { adminDB } = require('../../config/db');
const svc = require('../../services/starred-meals');

function fail(res, label, error) {
  if (!error.status || error.status >= 500) console.error(`${label} error:`, error);
  return res.status(error.status || 500).json({ error: error.message || 'Request failed', code: error.code || null });
}

// GET /api/starred-meals → { data: StarredMeal[] } (most recently used first)
async function list(req, res) {
  try {
    const data = await svc.listStarredMeals(req.userCode, { adminDB });
    res.set('Cache-Control', 'no-store');
    return res.json({ data });
  } catch (error) {
    return fail(res, 'GET /api/starred-meals', error);
  }
}

// POST /api/starred-meals { items, name?, source?, sourceFoodLogId? } → 201 { data } (200 when already starred)
async function star(req, res) {
  try {
    const { created, meal } = await svc.starMeal(req.userCode, req.body, { adminDB });
    return res.status(created ? 201 : 200).json({ data: meal });
  } catch (error) {
    return fail(res, 'POST /api/starred-meals', error);
  }
}

// DELETE /api/starred-meals/:id → { data: { id } }
async function unstar(req, res) {
  try {
    const data = await svc.unstarMeal(req.userCode, req.params.id, { adminDB });
    return res.json({ data });
  } catch (error) {
    return fail(res, 'DELETE /api/starred-meals/:id', error);
  }
}

// POST /api/starred-meals/:id/log { mealSlot, date, items? } → 201 { data: foodLogRow, meal }
async function log(req, res) {
  try {
    const { foodLog, meal } = await svc.logStarredMeal(req.userCode, req.params.id, req.body, { adminDB });
    return res.status(201).json({ data: foodLog, meal });
  } catch (error) {
    return fail(res, 'POST /api/starred-meals/:id/log', error);
  }
}

module.exports = { list, star, unstar, log };
