const { Router } = require('express');
const ctrl = require('./meal-plan.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = Router();

// "Not quite right? Change my plan": the client asks for a new AI plan (max 3).
// Both sit under /api/meal-plan, which is in PROTECTED_API_PREFIXES.
router.get( '/meal-plan/regenerations', requireAuth, ctrl.regenerationStatus);
router.post('/meal-plan/regenerate',    requireAuth, ctrl.regenerate);

module.exports = router;
