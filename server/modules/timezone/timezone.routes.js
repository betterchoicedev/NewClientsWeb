const { Router } = require('express');
const ctrl = require('./timezone.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = Router();

// The phone's time zone for the signed-in client (services/timezone.js). The client is always
// req.userCode from the token, never the body. /api/profile/ is in PROTECTED_API_PREFIXES.
router.post('/profile/timezone', requireAuth, ctrl.save);

module.exports = router;
