const { Router } = require('express');
const ctrl = require('./starred-meals.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = Router();

// Starred meals: one-tap re-logging. The client is always the signed-in user
// (req.userCode from the token), so no userCode is accepted from the body or query.
// /api/starred-meals is also in PROTECTED_API_PREFIXES.
router.get(   '/starred-meals',         requireAuth, ctrl.list);
router.post(  '/starred-meals',         requireAuth, ctrl.star);
router.delete('/starred-meals/:id',     requireAuth, ctrl.unstar);
router.post(  '/starred-meals/:id/log', requireAuth, ctrl.log);

module.exports = router;
