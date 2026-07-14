const { Router } = require('express');
const express = require('express');
const ctrl = require('./billing.controller');
const { requireAuth } = require('../../middlewares/auth');
const { buildStripeWebhookHandler } = require('../../services/stripe.service');
const { clientDB, adminDB } = require('../../config/db');
const { sendWhatsAppWelcomeByUserId } = require('../../services/whatsapp.service');

const router = Router();

// Stripe webhook — raw body required for signature verification
router.post('/webhooks/stripe', express.raw({ type: '*/*' }), (req, res, next) => {
  const handler = buildStripeWebhookHandler({ clientDB, adminDB, sendWhatsAppWelcomeByUserId });
  handler(req, res).catch(next);
});

// Apply JSON body parser for all other billing routes
router.use(express.json({ limit: '20mb' }));

router.get( '/exchange-rates',                                   ctrl.getExchangeRates);
router.post('/stripe/check-commitment-periods',    requireAuth,  ctrl.checkCommitmentPeriods);
router.post('/stripe/sync-to-database',            requireAuth,  ctrl.syncToDatabase);
router.post('/stripe/create-checkout-session',                   ctrl.createCheckoutSession);
router.get( '/stripe/checkout-session/:sessionId', requireAuth,  ctrl.getCheckoutSession);
router.post('/stripe/create-payment-intent',                     ctrl.createPaymentIntent);
router.post(['/subscription/validate-access-code', '/pricing/validate-access-code'], ctrl.validateAccessCode);
router.get( '/stripe/subscriptions',               requireAuth,  ctrl.getSubscriptions);
router.post('/stripe/subscriptions/:subscriptionId/cancel',           requireAuth, ctrl.cancelSubscription);
router.post('/stripe/subscriptions/:subscriptionId/reactivate',       requireAuth, ctrl.reactivateSubscription);
router.post('/stripe/subscriptions/:subscriptionId/payment-method',   requireAuth, ctrl.updatePaymentMethod);
router.post('/stripe/process-checkout-session',    requireAuth,  ctrl.processCheckoutSession);

module.exports = router;
