const { Router } = require('express');
const ctrl = require('./points.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = Router();

// The signed-in client's points, worked out from their logs (services/points.js).
// The client is always req.userCode from the token. /api/points is in PROTECTED_API_PREFIXES.
router.get('/points', requireAuth, ctrl.get);

module.exports = router;
