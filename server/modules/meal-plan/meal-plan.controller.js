const { clientDB, adminDB } = require('../../config/db');
const svc = require('../../services/meal-plan-regeneration');

// GET /api/meal-plan/regenerations → { used, limit, remaining, pending, last }
async function regenerationStatus(req, res) {
  try {
    const status = await svc.getRegenerationStatus(req.userCode, { adminDB });
    res.set('Cache-Control', 'no-store');
    return res.json(status);
  } catch (error) {
    if (!error.status || error.status >= 500) console.error('GET /api/meal-plan/regenerations error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to load', code: error.code || null });
  }
}

// POST /api/meal-plan/regenerate { notes } → 202 { id, remaining }
async function regenerate(req, res) {
  try {
    const result = await svc.requestRegeneration(req.userCode, req.body?.notes, { clientDB, adminDB });
    return res.status(202).json(result);
  } catch (error) {
    if (!error.status || error.status >= 500) console.error('POST /api/meal-plan/regenerate error:', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to start', code: error.code || null });
  }
}

module.exports = { regenerationStatus, regenerate };
