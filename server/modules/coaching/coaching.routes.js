const { Router } = require('express');
const ctrl = require('./coaching.controller');
const { requireAuth, assertOwnUserCode } = require('../../middlewares/auth');

const router = Router();

// ─── Chat messages ────────────────────────────────────────────────────────────
router.get( '/chat-messages',   requireAuth, assertOwnUserCode('query'), ctrl.getChatMessages);
router.post('/chat-messages',   requireAuth, assertOwnUserCode('body'),  ctrl.createChatMessage);

// ─── System messages ──────────────────────────────────────────────────────────
router.get( '/messages',        requireAuth,                             ctrl.getMessages);
router.post('/messages',        requireAuth,                             ctrl.sendMessage);
router.put( '/messages/:id/read', requireAuth,                          ctrl.markMessageRead);

// ─── Meal plans (coaching) ────────────────────────────────────────────────────
router.get( '/meal-plan',        requireAuth, assertOwnUserCode('query'), ctrl.getMealPlan);
router.get( '/meal-plan-schemas',requireAuth,                             ctrl.getMealPlanSchemas);
router.post('/meal-plan',        requireAuth,                             ctrl.createMealPlan);
router.put( '/meal-plan/:id',    requireAuth,                             ctrl.updateMealPlan);
router.get( '/meal-plan-history',requireAuth, assertOwnUserCode('query'), ctrl.getMealPlanHistory);

// ─── Training plans ───────────────────────────────────────────────────────────
router.get('/training-plan',     requireAuth, assertOwnUserCode('query'), ctrl.getTrainingPlan);

// ─── Companies & Assignments ──────────────────────────────────────────────────
router.get( '/companies',                         requireAuth,            ctrl.getCompanies);
router.get( '/client-company-assignment',         requireAuth,            ctrl.getClientCompanyAssignment);
router.post('/assign-client-company',             requireAuth,            ctrl.assignClientCompany);

// ─── Debug ────────────────────────────────────────────────────────────────────
router.get('/debug/meal-plans',                   requireAuth,            ctrl.debugMealPlans);

module.exports = router;
