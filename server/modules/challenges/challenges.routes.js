const { Router } = require('express');
const ctrl = require('./challenges.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = Router();

// Seasonal challenges, worked out from the client's logs (services/hanukkah.js).
// The client is always req.userCode from the token. /api/challenges is in PROTECTED_API_PREFIXES.
router.get('/challenges/hanukkah', requireAuth, ctrl.hanukkah);

module.exports = router;
