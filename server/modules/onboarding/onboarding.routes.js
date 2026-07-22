const { Router } = require('express');
const ctrl = require('./onboarding.controller');

const router = Router();

router.post('/onboarding/draft', ctrl.saveDraft);
router.post('/onboarding/save-step', ctrl.saveStep);
router.post('/onboarding/commit', ctrl.commit);
router.post('/onboarding/init-commerce', ctrl.initCommerce);
router.post('/onboarding/validate-promo', ctrl.validatePromo);
router.post('/onboarding/apply-bypass-promo', ctrl.applyBypassPromo);
router.post('/onboarding/complete', ctrl.complete);
router.get('/onboarding/status', ctrl.getStatus);
router.post('/onboarding/redeem-access-code', ctrl.redeemAccessCode);
router.post('/onboarding/opt-out', ctrl.optOut);

module.exports = router;
