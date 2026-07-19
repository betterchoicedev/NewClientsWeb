const { Router } = require('express');
const ctrl = require('./onboarding.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = Router();

router.post('/onboarding/draft', requireAuth, ctrl.saveDraft);
router.post('/onboarding/commit', requireAuth, ctrl.commit);
router.get('/onboarding/status', requireAuth, ctrl.getStatus);
router.post('/onboarding/redeem-access-code', requireAuth, ctrl.redeemAccessCode);

module.exports = router;
