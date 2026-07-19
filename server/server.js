/**
 * Lean application entry point.
 *
 * Wires together all config, middleware, domain modules, and the health check.
 * The original monolithic index.js is kept intact at server/index.js while this
 * file serves as the new layered entry point.
 */
require('dotenv').config();
const express = require('express');
const { PORT } = require('./config/env');
const { clientDB, supabaseAuth, adminDB } = require('./config/db');
const { securityHeaders, corsMiddleware, requestLogger } = require('./middlewares/security');
const { apiAuthGuard } = require('./middlewares/auth');
const { registerAuthSessionRoutes } = require('./routes/authSession');

// ─── Domain routers ───────────────────────────────────────────────────────────
const authRoutes      = require('./modules/auth/auth.routes');
const billingRoutes   = require('./modules/billing/billing.routes');
const foodRoutes      = require('./modules/food/food.routes');
const profileRoutes    = require('./modules/profile/profile.routes');
const onboardingRoutes = require('./modules/onboarding/onboarding.routes');
const trackingRoutes   = require('./modules/tracking/tracking.routes');
const coachingRoutes   = require('./modules/coaching/coaching.routes');
const marketingRoutes  = require('./modules/marketing/marketing.routes');

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express();

// ─── Global middlewares ───────────────────────────────────────────────────────
app.use(securityHeaders);
app.use(corsMiddleware);

// Stripe webhook MUST be registered before express.json() to preserve raw body.
// Billing router mounts it with its own express.raw() at /api/webhooks/stripe.
app.use('/api', billingRoutes);

// Standard JSON body parser (limit raised for mobile photo uploads).
app.use(express.json({ limit: '20mb' }));
app.use(requestLogger);

// ─── OAuth / session routes (kept in original routes/authSession.js) ──────────
registerAuthSessionRoutes(app, {
  supabaseAuth,
  supabaseUrl: process.env.REACT_APP_SUPABASE_URL,
  supabaseAnonKey: process.env.REACT_APP_SUPABASE_ANON_KEY,
  supabaseDb: clientDB,
});

// ─── Auth guard (validates Bearer JWT on protected /api/* routes) ─────────────
app.use(apiAuthGuard);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || 'development' }));

// ─── Domain modules ───────────────────────────────────────────────────────────
app.use('/api', authRoutes);
app.use('/api', foodRoutes);
// Onboarding draft/commit/status must mount before profile so GET /onboarding/status uses the new contract.
app.use('/api', onboardingRoutes);
app.use('/api', profileRoutes);
app.use('/api', trackingRoutes);
app.use('/api', coachingRoutes);
app.use('/api', marketingRoutes);

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
