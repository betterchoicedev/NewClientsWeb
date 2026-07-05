const { Router } = require('express');
const ctrl = require('./marketing.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = Router();

router.post('/waiting-list/submit',               ctrl.submitWaitingList);
router.get( '/waiting-list/validate-token',       ctrl.validateInvitationToken);
router.post('/waiting-list/mark-used',            ctrl.markInvitationUsed);
router.post('/contact',                           ctrl.submitContactForm);
router.post('/ingredient-reports',                ctrl.submitIngredientReport);

router.post('/db/registration-links/find',                          ctrl.findRegistrationLink);
router.get( '/db/registration-links/find',                          ctrl.findRegistrationLink);
router.post('/db/registration-links/:idOrLinkId/increment',         ctrl.incrementRegistrationLink);

router.get( '/weekly-macro-summary-svg',          ctrl.weeklyMacroSummarySvg);
router.get( '/macro-summary-svg',                 ctrl.dailyMacroSummarySvg);

router.post('/landing/validate',                  ctrl.validateLanding);
// Unified auth-protected endpoint
router.post('/whatsapp/send-welcome',             requireAuth, ctrl.sendWhatsAppWelcome);
// Legacy unauthenticated endpoints (kept for backward-compatibility with existing mobile clients)
router.post('/whatsapp/send-welcome-message',                  ctrl.sendWhatsAppWelcomeMessage);
router.post('/whatsapp/send-welcome-by-user-id',               ctrl.sendWhatsAppWelcomeByUserId);

module.exports = router;
