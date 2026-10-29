const { Router } = require('express');
const ctrl = require('./invite.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = Router();

// Public on purpose: the landing page shows it before the client has an account.
router.get( '/invite-codes/:code',        ctrl.lookup);
router.post('/my-dietitian/claim-code',   requireAuth, ctrl.claim);
router.get( '/my-dietitian',              requireAuth, ctrl.mine);

module.exports = router;
