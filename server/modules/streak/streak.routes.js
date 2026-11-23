const { Router } = require('express');
const ctrl = require('./streak.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = Router();

// The signed-in client's streak, worked out from their logs (services/streak.js).
// The client is always req.userCode from the token. /api/streak is in PROTECTED_API_PREFIXES.
router.get('/streak', requireAuth, ctrl.get);

module.exports = router;
