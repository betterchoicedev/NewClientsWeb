const { Router } = require('express');
const ctrl = require('./auth.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = Router();

router.post('/auth/refresh',                    ctrl.refreshSession);
router.post('/auth/oauth/apple/verify',         ctrl.appleVerify);
router.post('/auth/oauth/apple/exchange',       ctrl.appleExchange);
router.post('/auth/oauth/google/finalize',      ctrl.googleFinalize);
router.post('/auth/oauth/google/start',         ctrl.googleStart);
router.delete('/auth/account',        requireAuth, ctrl.deleteAccount);
router.post('/auth/signup',                     ctrl.signup);
router.post('/auth/login',                      ctrl.login);
router.post('/auth/check-email',                ctrl.checkEmail);
router.post('/auth/check-phone',                ctrl.checkPhone);
router.post('/auth/check-user-code',            ctrl.checkUserCode);
router.get( '/auth/check-registration-rule',    ctrl.checkRegistrationRule);
router.get( '/auth/default-provider',           ctrl.getDefaultProvider);
router.post('/auth/create-client',              ctrl.createClient);
router.get( '/auth/client/:userId',  requireAuth, ctrl.getClient);
router.put( '/auth/client/:userId',  requireAuth, ctrl.updateClient);

module.exports = router;
