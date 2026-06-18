require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
const { randomUUID } = require('crypto');

// Initialize ClientDB (main project: Stripe, clients, etc.)
const clientDB = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY
);

// ClientDB anon client used only for authentication (sign-in / token verification)
const supabaseAuth = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Initialize AdminDB (chat/admin project: chat_users, meal_plans_and_schemas, etc.)
// Configure CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY
const adminDBUrl = process.env.CHAT_SUPABASE_URL;
const adminDBServiceRoleKey = process.env.CHAT_SUPABASE_SERVICE_ROLE_KEY;

const adminDB = adminDBUrl && adminDBServiceRoleKey
  ? createClient(adminDBUrl, adminDBServiceRoleKey)
  : null;

console.log('ClientDB connection:', process.env.REACT_APP_SUPABASE_URL ? 'Configured' : 'Missing URL');
console.log('AdminDB connection:', adminDB ? 'Configured' : 'Not configured – set CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY');

const { createAuthMiddleware } = require('./middleware/auth');
const { registerAuthSessionRoutes } = require('./routes/authSession');
const {
  requireAuth,
  assertOwnUserCode,
  verifyFoodLogOwnership,
  verifyCalendarEventOwnership,
  apiAuthGuard,
} = createAuthMiddleware(supabaseAuth, clientDB, adminDB);

const app = express();
function normalizePort(value) {
  const port = parseInt(value, 10);
  if (Number.isNaN(port)) {
    return value; // named pipe
  }
  if (port >= 0) {
    return port;
  }
  return false;
}

const PORT = normalizePort(
  process.env.PORT ||
  process.env.HTTP_PLATFORM_PORT ||
  '8080'
);

const DIGITAL_ONLY_PRODUCT_ID = 'prod_TrcVkwBC0wmqKp';
const DIGITAL_ONLY_PRICE_ID = 'price_1SyHX0HIeYfvCylDZyb1Lb3L';
const DIGITAL_ONLY_BASE_AMOUNT_USD = 48;
const CREATE_MEAL_PLAN_API_URL = 'https://meal-plan-builder-615263253386.europe-west3.run.app/api/create-meal-plan';

function isDigitalOnlyPlan(productId, priceId) {
  return productId === DIGITAL_ONLY_PRODUCT_ID || priceId === DIGITAL_ONLY_PRICE_ID;
}

function getDigitalOnlyAmount(subscription) {
  const coupon = subscription?.discount?.coupon;
  let amount = DIGITAL_ONLY_BASE_AMOUNT_USD;

  if (coupon?.percent_off != null) {
    amount = amount * (1 - (coupon.percent_off / 100));
  } else if (coupon?.amount_off != null) {
    // Stripe amount_off is in minor currency units (USD cents for Digital Only).
    amount = amount - (coupon.amount_off / 100);
  }

  return Number(Math.max(0, amount).toFixed(2));
}

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Middleware - Temporary permissive CORS for debugging
app.use(cors({
  origin: true, // Allow all origins temporarily for debugging
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Stripe webhook route MUST be registered before express.json() so the raw body is used for signature verification.
// Using route-level express.raw() ensures only this endpoint gets the raw Buffer; nothing else parses the body first.
let stripeWebhookHandler;
app.post('/api/webhooks/stripe', express.raw({ type: '*/*' }), (req, res, next) => {
  stripeWebhookHandler(req, res).catch(err => next(err));
});

// JSON parser for all other routes
// NOTE: limit raised to 20mb because several endpoints (profile image upload,
// nutrition-label photo analysis, etc.) accept base64-encoded photos taken on
// mobile devices that easily exceed the express default of 100kb.
app.use(express.json({ limit: '20mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

registerAuthSessionRoutes(app, {
  supabaseAuth,
  supabaseUrl: process.env.REACT_APP_SUPABASE_URL,
  supabaseAnonKey: process.env.REACT_APP_SUPABASE_ANON_KEY,
  supabaseDb: clientDB,
});

// Require Bearer JWT on protected /api/* routes
app.use(apiAuthGuard);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});
const MOBILE_APP_OAUTH_REDIRECT = (
  process.env.MOBILE_OAUTH_REDIRECT || 'betterchoicemobile://auth/callback'
).trim();

function buildMobileAppOAuthRedirect(session) {
  const fragment = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: String(session.expires_at ?? ''),
    expires_in: String(session.expires_in ?? ''),
    token_type: session.token_type || 'bearer',
  }).toString();
  const joiner = MOBILE_APP_OAUTH_REDIRECT.includes('#') ? '&' : '#';
  return `${MOBILE_APP_OAUTH_REDIRECT}${joiner}${fragment}`;
}

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body || {};
    if (!refresh_token || typeof refresh_token !== 'string') {
      return res.status(400).json({ error: 'refresh_token is required' });
    }

    const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token });
    if (error || !data?.session?.access_token) {
      console.warn('🔁 Refresh failed:', error?.message || 'no session returned');
      return res.status(401).json({
        error: error?.message || 'Failed to refresh session',
      });
    }

    res.json({
      session: data.session,
      user: data.user,
      error: null,
    });
  } catch (error) {
    console.error('❌ POST /api/auth/refresh error:', error);
    res.status(401).json({ error: error.message || 'Failed to refresh session' });
  }
});
// ──────────────────────────────────────────────────────────────────────────
// Sign in with Apple (App Review Guideline 4.8)
//
// Flow:
//   1. Decode the Apple identity token to extract the email claim
//      (signature is intentionally NOT verified here — it's only used to
//      decide whether the email is registered with us).
//   2. Look the email up in `clients` / `chat_users`. If not found, we
//      respond 404 `no_account` IMMEDIATELY, without ever calling
//      Supabase. This is the key behavioural difference from the previous
//      version: no Supabase auth row is created for unregistered Apple
//      users, so no orphans end up in the dashboard.
//   3. Only if the account exists do we hand the token to
//      `clientDB.auth.signInWithIdToken({ provider: 'apple', token })`.
//      Supabase verifies the JWT against Apple's JWKS — a forged token
//      with a stolen email won't produce a session, so the pre-check
//      can't be abused to log in as anyone.
//
// Body:
//   { identityToken: string, fullName?: { givenName?: string, familyName?: string } }
//
// Returns:
//   { data: { user, session }, language, error: null }
//   or 404 { error: 'no_account', email } when the Apple email isn't a
//   registered BetterChoice client.
// ──────────────────────────────────────────────────────────────────────────

/** Best-effort JWT payload decode — only used to read claims, never to
 *  authenticate. Signature is NOT verified here; that happens later in
 *  Supabase's `signInWithIdToken`, which is the only thing that can mint
 *  a real session. Returns {} on any parse failure. */
function decodeJwtPayloadServer(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 3) return {};
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(decoded) || {};
  } catch {
    return {};
  }
}

/** Returns true iff `email` (lower-cased) shows up in either the main
 *  `clients` table or the chat-side `chat_users` table. Used by both the
 *  Apple verify endpoint and the Google finalize endpoint below to gate
 *  whether a third-party login should produce a session at all. */
async function emailHasBetterChoiceAccount(email) {
  if (!email) return false;
  try {
    const { data: clientRow } = await clientDB
      .from('clients')
      .select('user_id')
      .eq('email', email)
      .maybeSingle();
    if (clientRow?.user_id) return true;
  } catch (e) {
    console.warn('emailHasBetterChoiceAccount: clients lookup failed:', e?.message);
  }
  if (adminDB) {
    try {
      const { data: chatRow } = await adminDB
        .from('chat_users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (chatRow?.id) return true;
    } catch (e) {
      console.warn('emailHasBetterChoiceAccount: chat_users lookup failed:', e?.message);
    }
  }
  return false;
}
async function ensureClientLinkedToAuthUser(authUserId, email) {
  if (!authUserId || !email) return;

  const normalizedEmail = email.trim().toLowerCase();
  try {
    const { data: byUserId } = await clientDB
      .from('clients')
      .select('id, user_code')
      .eq('user_id', authUserId)
      .maybeSingle();

    if (byUserId?.user_code) return;

    const { data: byEmail } = await clientDB
      .from('clients')
      .select('id, user_id, user_code')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!byEmail?.user_code) return;

    if (byEmail.user_id !== authUserId) {
      const { error } = await clientDB
        .from('clients')
        .update({ user_id: authUserId, updated_at: new Date().toISOString() })
        .eq('id', byEmail.id);

      if (error) {
        console.warn('ensureClientLinkedToAuthUser: link failed for', normalizedEmail, error.message);
      } else {
        console.log('✅ Linked clients.user_id for', normalizedEmail, '→', authUserId);
      }
    }
  } catch (e) {
    console.warn('ensureClientLinkedToAuthUser failed:', e?.message);
  }
}

async function resolveUserCodeForAuthUser(authUserId, email) {
  if (!authUserId) return null;

  const { data: byUserId, error } = await clientDB
    .from('clients')
    .select('id, user_code, user_id, email')
    .eq('user_id', authUserId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  if (byUserId?.user_code) return byUserId.user_code;

  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { data: byEmail, error: emailErr } = await clientDB
    .from('clients')
    .select('id, user_code, user_id, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (emailErr && emailErr.code !== 'PGRST116') throw emailErr;
  if (!byEmail?.user_code) return null;

  if (byEmail.user_id !== authUserId) {
    const { error: linkErr } = await clientDB
      .from('clients')
      .update({ user_id: authUserId, updated_at: new Date().toISOString() })
      .eq('id', byEmail.id);

    if (linkErr) {
      console.warn('resolveUserCodeForAuthUser: link failed for', normalizedEmail, linkErr.message);
    } else {
      console.log('✅ Linked clients.user_id via user-code lookup for', normalizedEmail);
    }
  }

  return byEmail.user_code;
}
app.post('/api/auth/oauth/apple/verify', async (req, res) => {
  try {
    const { identityToken, fullName } = req.body || {};
    if (!identityToken || typeof identityToken !== 'string') {
      return res.status(400).json({ error: 'identityToken is required' });
    }

    // 1) Pre-check: read the email from the Apple JWT WITHOUT calling
    // Supabase. If the email isn't registered we bail out here so no
    // Supabase auth row is ever created for this Apple ID.
    const payload = decodeJwtPayloadServer(identityToken);
    const claimedEmail = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (!claimedEmail) {
      return res.status(401).json({ error: 'Apple did not return an email for this account' });
    }

    const accountExists = await emailHasBetterChoiceAccount(claimedEmail);
    if (!accountExists) {
      return res.status(404).json({ error: 'no_account', email: claimedEmail });
    }

    // 2) Account exists — now actually mint a Supabase session by handing
    // Apple's identity token to Supabase. This is the step that verifies
    // the JWT signature against Apple's JWKS, so a forged token would
    // still fail here even though the pre-check above used the unverified
    // payload.
    const { data, error } = await clientDB.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
    });
    if (error) {
      console.error('❌ Apple signInWithIdToken error:', error);
      return res.status(401).json({ error: error.message || 'Apple sign-in rejected' });
    }
    if (!data?.user || !data?.session) {
      return res.status(401).json({ error: 'Apple sign-in returned no session' });
    }

    // Belt-and-suspenders: if for any reason Supabase came back with a
    // different (verified) email than what the JWT pre-check used, AND
    // that email is also unregistered, scrub the auth row and bail. This
    // shouldn't happen in practice — Supabase reads the same `email`
    // claim — but it's cheap insurance against the race where someone
    // hand-crafted a JWT with mismatched claims.
    const verifiedEmail = (data.user.email || '').trim().toLowerCase();
    if (verifiedEmail && verifiedEmail !== claimedEmail) {
      const verifiedExists = await emailHasBetterChoiceAccount(verifiedEmail);
      if (!verifiedExists) {
        try {
          await clientDB.auth.admin.deleteUser(data.user.id);
        } catch (e) {
          console.warn('Apple verify: orphan cleanup failed:', e?.message);
        }
        return res.status(404).json({ error: 'no_account', email: verifiedEmail });
      }
    }

    const finalEmail = verifiedEmail || claimedEmail;
    await ensureClientLinkedToAuthUser(data.user.id, finalEmail);
    // Best-effort: record the Apple-provided name onto the matching client
    // row the first time the user signs in (Apple only shares this on the
    // very first sign-in event). We don't fail the request if it doesn't
    // stick — the auth session is what actually matters.
    if (fullName && (fullName.givenName || fullName.familyName)) {
      try {
        const patch = {};
        if (fullName.givenName) patch.first_name = fullName.givenName;
        if (fullName.familyName) patch.last_name = fullName.familyName;
        await clientDB.from('clients').update(patch).eq('email', finalEmail);
      } catch {
        /* best-effort enrichment */
      }
    }

    // Look up the language preference the same way the password flow does
    // so the React Native context starts with the right locale.
    let language = null;
    try {
      if (adminDB) {
        const { data: lang } = await adminDB
          .from('chat_users')
          .select('user_language')
          .eq('email', finalEmail)
          .maybeSingle();
        if (lang) language = lang;
      }
    } catch {
      /* language is non-critical */
    }

    return res.json({
      data: { user: data.user, session: data.session },
      language,
      error: null,
    });
  } catch (error) {
    console.error('POST /api/auth/oauth/apple/verify error:', error);
    res.status(500).json({ error: error.message || 'Apple sign-in failed' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Google OAuth finalize
//
// The Google flow is structurally different from Apple: Supabase's hosted
// `/auth/v1/authorize` page is what runs the OAuth exchange, and by the
// time the user lands back in the app a Supabase auth row already exists.
// We can't pre-check like we do for Apple.
//
// Instead, the client calls this endpoint right after parsing the deep
// link. We:
//   1. Validate the supplied access token via `clientDB.auth.getUser` —
//      that's the only thing that gives us a *trusted* user id + email.
//   2. Look the email up in `clients` / `chat_users`.
//   3. If no match → `clientDB.auth.admin.deleteUser(userId)` so no
//      orphan Google auth row lingers, then respond 404 `no_account`.
//   4. If match → respond `{ ok: true, language }`.
//
// Body: { accessToken: string }
// ──────────────────────────────────────────────────────────────────────────
app.post('/api/auth/oauth/google/finalize', async (req, res) => {
  try {
    const { accessToken } = req.body || {};
    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({ error: 'accessToken is required' });
    }

    // 1) Trust step — only the bearer Supabase returned from its own OAuth
    // flow can resolve back to a real user here. Forged tokens fail this
    // call with `Invalid JWT`.
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      console.warn('Google finalize: getUser failed:', userError?.message);
      return res.status(401).json({ error: 'Invalid or expired Google session token' });
    }

    const userId = userData.user.id;
    const email = (userData.user.email || '').trim().toLowerCase();
    if (!email) {
      // Defensive: a Google auth row with no email is malformed. Wipe it
      // and tell the client to surface the "no account" UX.
      try {
        await clientDB.auth.admin.deleteUser(userId);
      } catch (e) {
        console.warn('Google finalize: cleanup of email-less auth row failed:', e?.message);
      }
      return res.status(404).json({ error: 'no_account', email: '' });
      await ensureClientLinkedToAuthUser(userId, email);
    }

    // 2) Same lookup the Apple endpoint uses.
    const accountExists = await emailHasBetterChoiceAccount(email);

    // 3) No matching BetterChoice account → delete the orphan auth row
    // (this is the fix for the "Google sign-in still creates a Supabase
    // user even when the email isn't a customer" bug) and respond 404.
    if (!accountExists) {
      try {
        const { error: deleteErr } = await clientDB.auth.admin.deleteUser(userId);
        if (deleteErr) {
          console.error('Google finalize: failed to delete orphan auth user:', deleteErr);
        }
      } catch (e) {
        console.error('Google finalize: failed to delete orphan auth user:', e?.message);
      }
      return res.status(404).json({ error: 'no_account', email });
    }

    // 4) Account exists — return language preference so the client can
    // seed locale identically to the password / Apple flows.
    let language = null;
    try {
      if (adminDB) {
        const { data: lang } = await adminDB
          .from('chat_users')
          .select('user_language')
          .eq('email', email)
          .maybeSingle();
        if (lang) language = lang;
      }
    } catch {
      /* language is non-critical */
    }

    return res.json({ ok: true, exists: true, language });
  } catch (error) {
    console.error('POST /api/auth/oauth/google/finalize error:', error);
    res.status(500).json({ error: error.message || 'Failed to finalize Google sign-in' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Account deletion (App Review Guideline 5.1.1(v))
//
// Authenticated DELETE. Uses Supabase's admin API (service-role key) to
// permanently delete the auth row; FK cascade rules then take care of the
// `clients` / `chat_users` / food-log / etc. rows that reference the user.
// We also call `auth.admin.deleteUser` rather than soft-deleting, because
// Apple explicitly says "only offering to temporarily deactivate or
// disable an account is insufficient."
// ──────────────────────────────────────────────────────────────────────────
app.delete('/api/auth/account', requireAuth, async (req, res) => {
  try {
    const authUserId = req.authUser?.id;
    if (!authUserId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const email = (req.authUser?.email || '').trim().toLowerCase();

    // ── Resolve the user's user_code and chat_users.id ──────────────────
    // The dietitian-side cleanup is keyed by `user_code`; the chat-side
    // cleanup is keyed by `chat_users.id`. We resolve both up front so the
    // rest of this handler mirrors DELETE /api/clients/:id exactly.
    let userCode = req.userCode || null;
    if (!userCode && email) {
      try {
        const { data: clientRow } = await clientDB
          .from('clients')
          .select('user_code')
          .eq('email', email)
          .maybeSingle();
        if (clientRow?.user_code) userCode = clientRow.user_code;
      } catch (e) {
        console.warn('Account deletion: user_code lookup by email failed:', e?.message);
      }
    }

    let chatUserId = null;
    if (adminDB && email) {
      try {
        const { data: chatUser } = await adminDB
          .from('chat_users')
          .select('id, user_code')
          .eq('email', email)
          .maybeSingle();
        if (chatUser?.id) chatUserId = chatUser.id;
        if (!userCode && chatUser?.user_code) userCode = chatUser.user_code;
      } catch (e) {
        console.warn('Account deletion: chat_users lookup by email failed:', e?.message);
      }
    }

    // ── 1. Reminder instances / definitions + meal plans (chat project) ──
    if (adminDB && userCode) {
      // 1a. Meal plan IDs for this user
      const { data: mealPlans, error: fetchMealPlansError } = await adminDB
        .from('meal_plans_and_schemas')
        .select('id')
        .eq('user_code', userCode)
        .eq('record_type', 'meal_plan');

      if (!fetchMealPlansError && mealPlans && mealPlans.length > 0) {
        const mealPlanIds = mealPlans.map((p) => p.id);
        // 1b. Reminder definitions referencing these meal plans
        const { data: reminderDefs, error: fetchReminderError } = await adminDB
          .from('reminder_definitions')
          .select('reminder_definition_id')
          .in('user_plan_id', mealPlanIds);

        if (!fetchReminderError && reminderDefs && reminderDefs.length > 0) {
          const definitionIds = reminderDefs.map((r) => r.reminder_definition_id);
          const { error: instancesError } = await adminDB
            .from('reminder_instances')
            .delete()
            .in('definition_id', definitionIds);
          if (instancesError) {
            console.error('Error deleting reminder instances:', instancesError);
            return res.status(500).json({ error: `Failed to delete reminder instances: ${instancesError.message}` });
          }
        }

        const { error: reminderError } = await adminDB
          .from('reminder_definitions')
          .delete()
          .in('user_plan_id', mealPlanIds);
        if (reminderError) {
          console.error('Error deleting reminder definitions:', reminderError);
          return res.status(500).json({ error: `Failed to delete reminder definitions: ${reminderError.message}` });
        }
      }

      // 1c. Meal plans themselves
      const { error: mealPlansError } = await adminDB
        .from('meal_plans_and_schemas')
        .delete()
        .eq('user_code', userCode)
        .eq('record_type', 'meal_plan');
      if (mealPlansError) {
        console.error('Error deleting meal plans:', mealPlansError);
        return res.status(500).json({ error: `Failed to delete meal plans: ${mealPlansError.message}` });
      }
    }

    // ── 2-5. Conversations, messages, food logs, chat_users ─────────────
    if (adminDB && chatUserId) {
      // 2. Conversation IDs
      const { data: conversations, error: convError } = await adminDB
        .from('chat_conversations')
        .select('id')
        .eq('user_id', chatUserId);
      if (convError) {
        console.error('Error fetching conversations:', convError);
        return res.status(500).json({ error: `Failed to fetch conversations: ${convError.message}` });
      }

      const conversationIds = (conversations || []).map((c) => c.id);

      // 3. Messages for those conversations
      if (conversationIds.length > 0) {
        const { error: messagesError } = await adminDB
          .from('chat_messages')
          .delete()
          .in('conversation_id', conversationIds);
        if (messagesError) {
          console.error('Error deleting messages:', messagesError);
          return res.status(500).json({ error: `Failed to delete messages: ${messagesError.message}` });
        }
      }

      // 4. Conversations
      const { error: deleteConvError } = await adminDB
        .from('chat_conversations')
        .delete()
        .eq('user_id', chatUserId);
      if (deleteConvError) {
        console.error('Error deleting conversations:', deleteConvError);
        return res.status(500).json({ error: `Failed to delete conversations: ${deleteConvError.message}` });
      }

      // 4.5. Food logs (FK fk_food_logs_user_id -> chat_users.id, no cascade)
      const { error: foodLogsError } = await adminDB
        .from('food_logs')
        .delete()
        .eq('user_id', chatUserId);
      if (foodLogsError) {
        console.error('Error deleting food logs:', foodLogsError);
        return res.status(500).json({ error: `Failed to delete food logs: ${foodLogsError.message}` });
      }

      // 5. chat_users row
      const { error: deleteUserError } = await adminDB
        .from('chat_users')
        .delete()
        .eq('id', chatUserId);
      if (deleteUserError) {
        console.error('Error deleting chat user:', deleteUserError);
        return res.status(500).json({ error: `Failed to delete chat user: ${deleteUserError.message}` });
      }
    }

    // ── 6. Main project cleanup: Stripe, client_meal_plans, stripe_usage_log, clients
    if (userCode) {
      try {
        // 6a2. Cancel any billable Stripe subscription for this user immediately.
        // Covers active, trialing, past_due, unpaid, paused, incomplete – everything
        // that isn't already in a terminal state (canceled / incomplete_expired).
        if (stripe) {
          const CANCELABLE_STATUSES = new Set([
            'active',
            'trialing',
            'past_due',
            'unpaid',
            'paused',
            'incomplete',
          ]);
          try {
            const customerIds = new Set();

            // Primary source: stripe_subscriptions rows for this auth user.
            const { data: subs } = await clientDB
              .from('stripe_subscriptions')
              .select('stripe_customer_id, stripe_subscription_id, status')
              .eq('user_id', authUserId);
            for (const s of subs || []) {
              if (s.stripe_customer_id) customerIds.add(s.stripe_customer_id);
            }

            // Also try to cancel by stored subscription_id directly, in case the
            // subscription is detached from the customer rows we have locally.
            for (const s of subs || []) {
              if (!s.stripe_subscription_id) continue;
              if (!CANCELABLE_STATUSES.has(String(s.status || '').toLowerCase()) && s.status) continue;
              try {
                await stripe.subscriptions.cancel(s.stripe_subscription_id);
                console.log('Stripe subscription canceled on account delete (by id):', s.stripe_subscription_id);
              } catch (cancelErr) {
                if (cancelErr?.code !== 'resource_missing') {
                  console.error('Error canceling Stripe subscription', s.stripe_subscription_id, 'on account delete:', cancelErr.message);
                }
              }
            }

            // Sweep each known customer for any remaining non-terminal subs.
            for (const customerId of customerIds) {
              const subscriptionList = await stripe.subscriptions.list({
                customer: customerId,
                status: 'all',
                limit: 100,
              });
              for (const sub of subscriptionList.data) {
                if (!CANCELABLE_STATUSES.has(sub.status)) continue;
                try {
                  await stripe.subscriptions.cancel(sub.id);
                  console.log('Stripe subscription canceled on account delete:', sub.id, `(was ${sub.status})`);
                } catch (cancelErr) {
                  if (cancelErr?.code !== 'resource_missing') {
                    console.error('Error canceling Stripe subscription', sub.id, 'on account delete:', cancelErr.message);
                  }
                }
              }
            }
          } catch (stripeCancelErr) {
            console.error('Error canceling Stripe subscriptions on account delete:', stripeCancelErr);
            // Don't fail the request – auth row removal below is the source of truth
          }
        }

        // 6b. client_meal_plans for this user_code
        const { error: mealPlansError } = await clientDB
          .from('client_meal_plans')
          .delete()
          .eq('user_code', userCode);
        if (mealPlansError) {
          console.error('Error deleting client_meal_plans:', mealPlansError);
        }

        // 6c. stripe_usage_log for this user_code
        const { error: stripeError } = await clientDB
          .from('stripe_usage_log')
          .delete()
          .eq('user_code', userCode);
        if (stripeError) {
          console.error('Error deleting stripe_usage_log:', stripeError);
        }

        // 6d. clients rows for this user_code
        const { error: clientsError } = await clientDB
          .from('clients')
          .delete()
          .eq('user_code', userCode);
        if (clientsError) {
          console.error('Error deleting clients (by user_code):', clientsError);
        }
      } catch (mainProjectErr) {
        console.error('Error cleaning up main Supabase project on account delete:', mainProjectErr);
        // Don't fail the request – auth row removal below is the source of truth
      }
    }

    // Safety net: drop any clients rows still tied to this auth user / email
    // even when we couldn't resolve a user_code above.
    try {
      await clientDB.from('clients').delete().eq('user_id', authUserId);
      if (email) {
        await clientDB.from('clients').delete().eq('email', email);
      }
    } catch (e) {
      console.warn('Account deletion: residual clients cleanup failed:', e?.message);
    }

    // ── 7. Finally, delete the auth row (source of truth) ──────────────
    // NOTE: admin.deleteUser requires the service-role key, so we must use
    // `clientDB` (service role) here — `supabaseAuth` is the anon client and
    // returns 403 "User not allowed / not_admin".
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Cannot delete auth user: SUPABASE_SERVICE_ROLE_KEY is not set');
      return res.status(500).json({
        error: 'Failed to delete account',
        details: 'Server is missing SUPABASE_SERVICE_ROLE_KEY required for admin deletion',
      });
    }
    const { error: deleteAuthError } = await clientDB.auth.admin.deleteUser(authUserId);
    if (deleteAuthError) {
      console.error('❌ clientDB.auth.admin.deleteUser failed:', deleteAuthError);
      return res.status(500).json({
        error: 'Failed to delete account',
        details: deleteAuthError.message,
      });
    }

    return res.json({ ok: true, success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/auth/account error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete account' });
  }
});

/**
 * Mobile app calls this to kick off Google sign-in.
 *
 * IMPORTANT — we intentionally bypass our own `/api/auth/oauth/mobile-callback`
 * and tell Supabase to redirect **straight to the app's deep link**
 * (`betterchoicemobile://auth/callback`). Why:
 *
 *   • Our `supabaseAuth` client is created without a `flowType` option, so
 *     `auth.signInWithOAuth()` defaults to the **implicit** OAuth flow.
 *     Implicit-flow tokens come back in the URL **fragment**
 *     (`#access_token=…`) which browsers never send to servers — so our
 *     server callback can never read them and would always end up
 *     redirecting with `?error=oauth_missing_code`.
 *
 *   • The PKCE alternative requires server-side persistence of a
 *     `code_verifier` between the start request and the callback. On
 *     Cloud Run that's brittle (any new instance kills the verifier
 *     because the Supabase JS client stores it in memory by default).
 *
 *   • Supabase's documented mobile pattern is exactly this: 302 the user
 *     straight from Supabase into the app via its custom URL scheme,
 *     with tokens in the fragment, and let the app parse them.
 *
 * Prerequisite: the deep link below MUST be present in the Supabase
 * dashboard → Authentication → URL Configuration → Redirect URLs (an
 * exact match or a wildcard like `betterchoicemobile://*` both work).
 */
app.post('/api/auth/oauth/google/start', async (req, res) => {
  try {
    const supabaseUrl = (process.env.REACT_APP_SUPABASE_URL || '').trim();
    if (!supabaseUrl) {
      return res.status(500).json({ error: 'SUPABASE_URL is not configured' });
    }

    // Build the Supabase `/auth/v1/authorize` URL by hand. We do NOT
    // include a `code_challenge`, so Supabase serves the implicit flow
    // and returns tokens in the redirect's URL fragment. We also do NOT
    // call `supabaseAuth.auth.signInWithOAuth(...)` because newer
    // versions of @supabase/supabase-js silently switch to PKCE when
    // available, which would round-trip back through our server (and we
    // don't want that — see comment above).
    const params = new URLSearchParams({
      provider: 'google',
      redirect_to: MOBILE_APP_OAUTH_REDIRECT,
    });

    const url = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/authorize?${params.toString()}`;
    res.json({ url });
  } catch (error) {
    console.error('POST /api/auth/oauth/google/start error:', error);
    res.status(500).json({ error: error.message || 'Failed to start Google sign-in' });
  }
});

// NOTE: `GET /api/auth/oauth/mobile-callback` is intentionally NOT defined
// here — the live implementation lives in `server/routes/authSession.js`
// (registered above via `registerAuthSessionRoutes`). Keeping a duplicate
// here used to mask which one was active; if you need to change behavior,
// edit the one in `authSession.js`.

app.post('/api/auth/oauth/google/start', async (req, res) => {
  try {
    // Build the absolute URL of our own mobile-callback. Honors the
    // standard proxy headers so this works behind Cloud Run / nginx
    // (which terminates TLS upstream and forwards `x-forwarded-*`).
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString().split(',')[0].trim();
    const host = (req.headers['x-forwarded-host'] || req.get('host') || '').toString().split(',')[0].trim();
    if (!host) {
      return res.status(500).json({ error: 'Could not resolve callback host' });
    }
    const mobileCallbackUrl = `${proto}://${host}/api/auth/oauth/mobile-callback`;

    const { data, error } = await supabaseAuth.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: mobileCallbackUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      console.error('❌ Google OAuth start error:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to start Google sign-in' });
    }

    if (!data?.url) {
      return res.status(500).json({ error: 'Supabase returned no OAuth URL' });
    }

    res.json({ url: data.url });
  } catch (error) {
    console.error('POST /api/auth/oauth/google/start error:', error);
    res.status(500).json({ error: error.message || 'Failed to start Google sign-in' });
  }
});

// Bank of Israel exchange rates proxy (avoids CORS – browser can't call boi.org.il directly)
const BOI_EXCHANGE_RATES_URL = 'https://boi.org.il/PublicApi/GetExchangeRates?asXml=false';
app.get('/api/exchange-rates', async (req, res) => {
  try {
    const response = await fetch(BOI_EXCHANGE_RATES_URL);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.warn('BOI exchange rates fetch failed:', err.message);
    res.status(502).json({ error: 'Failed to fetch exchange rates' });
  }
});

// Check and auto-cancel subscriptions past their commitment period
app.post('/api/stripe/check-commitment-periods', async (req, res) => {
  try {
    console.log('🔍 Checking subscriptions past their commitment period...');
    
    // Get all active subscriptions with commitment periods
    const { data: subscriptions, error: fetchError } = await clientDB
      .from('stripe_subscriptions')
      .select('*')
      .eq('status', 'active')
      .not('commitment_end_date', 'is', null)
      .not('cancel_at_period_end', 'eq', true);
    
    if (fetchError) {
      console.error('❌ Error fetching subscriptions:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
    
    const now = new Date();
    let cancelledCount = 0;
    const results = [];
    
    for (const sub of subscriptions || []) {
      const commitmentEndDate = new Date(sub.commitment_end_date);
      
      if (now >= commitmentEndDate) {
        try {
          console.log(`⏰ Commitment period ended for subscription ${sub.stripe_subscription_id}. Auto-cancelling...`);
          
          // Cancel at period end in Stripe
          const updatedSubscription = await stripe.subscriptions.update(sub.stripe_subscription_id, {
            cancel_at_period_end: true
          });
          
          // Update database
          const { error: updateError } = await clientDB
            .from('stripe_subscriptions')
            .update({ 
              cancel_at_period_end: true,
              updated_at: new Date().toISOString()
            })
            .eq('stripe_subscription_id', sub.stripe_subscription_id);
          
          if (updateError) {
            console.error(`❌ Error updating subscription ${sub.stripe_subscription_id}:`, updateError);
          } else {
            cancelledCount++;
            results.push({
              subscriptionId: sub.stripe_subscription_id,
              commitmentEndDate: commitmentEndDate.toISOString(),
              periodEndDate: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
              status: 'cancelled_at_period_end'
            });
            console.log(`✅ Auto-cancelled subscription ${sub.stripe_subscription_id}. Payments will stop on ${new Date(updatedSubscription.current_period_end * 1000).toISOString()}`);
          }
        } catch (error) {
          console.error(`❌ Error cancelling subscription ${sub.stripe_subscription_id}:`, error);
          results.push({
            subscriptionId: sub.stripe_subscription_id,
            error: error.message
          });
        }
      }
    }
    
    res.json({
      message: `Checked ${subscriptions?.length || 0} subscriptions. Auto-cancelled ${cancelledCount} subscriptions past their commitment period.`,
      checked: subscriptions?.length || 0,
      cancelled: cancelledCount,
      results
    });
    
  } catch (error) {
    console.error('❌ Error checking commitment periods:', error);
    res.status(500).json({ error: error.message || 'Failed to check commitment periods' });
  }
});

// Manual sync endpoint - sync existing Stripe data to database
app.post('/api/stripe/sync-to-database', async (req, res) => {
  try {
    const { customerId } = req.body;
    
    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID (user_id) is required' });
    }
    
    console.log('🔄 Manually syncing Stripe data to database for user:', customerId);
    
    // Find Stripe customer
    const customers = await stripe.customers.list({
      limit: 100
    });
    
    const matchingCustomers = customers.data.filter(customer => 
      customer.metadata && customer.metadata.user_id === customerId
    );
    
    if (matchingCustomers.length === 0) {
      return res.json({ message: 'No Stripe customer found for this user', synced: 0 });
    }
    
    let syncedCount = 0;
    
    // Sync subscriptions for each customer
    for (const customer of matchingCustomers) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        expand: ['data.items.data.price']
      });
      
      for (const subscription of subscriptions.data) {
        // Get product and price info
        const priceId = subscription.items.data[0]?.price?.id;
        const productId = subscription.items.data[0]?.price?.product;
        const amount = subscription.items.data[0]?.price?.unit_amount / 100;
        const currency = subscription.items.data[0]?.price?.currency?.toUpperCase() || 'USD';
        
        // Determine subscription type based on product ID
        let subscriptionType = 'unknown';
        if (productId === 'prod_SbI1Lu7FWbybUO') subscriptionType = 'nutrition_training_once_month';
        else if (productId === 'prod_SbI1dssS5NElLZ') subscriptionType = 'nutrition_only';
        else if (productId === 'prod_SbI1AIv2A46oJ9') subscriptionType = 'nutrition_training';
        else if (productId === 'prod_SbI0A23T20wul3') subscriptionType = 'nutrition_only_2x_month';
        else if (isDigitalOnlyPlan(productId, priceId)) subscriptionType = 'digital_only'; // Onboarding upsell (usage-based)
        
        // Determine commitment period based on exact price ID mapping
        let commitmentMonths = null; // Default no commitment 
        const currentDate = new Date(subscription.current_period_start * 1000);
        
        // Nutrition + Training (once/month) plans (using BetterPro price IDs)
        if (priceId === 'price_1Rg5R8HIeYfvCylDJ4Xfg5hr') {
          commitmentMonths = 3; // Nutrition + Training once/month 3-Month Plan
        } else if (priceId === 'price_1Rg5R8HIeYfvCylDxX2PsOrR') {
          commitmentMonths = 6; // Nutrition + Training once/month 6-Month Plan
        }
        // Nutrition Only plans
        else if (priceId === 'price_1Rg5R6HIeYfvCylDcsV3T2Kr') {
          commitmentMonths = 3; // Nutrition Only 3-Month Plan
        } else if (priceId === 'price_1Rg5R6HIeYfvCylDxuQODpK4') {
          commitmentMonths = 6; // Nutrition Only 6-Month Plan
        }
        // Nutrition + Training plans
        else if (priceId === 'price_1Rg5R4HIeYfvCylDAshP6FOk') {
          commitmentMonths = 3; // Nutrition + Training 3-Month Plan
        } else if (priceId === 'price_1Rg5R4HIeYfvCylDy1OT1YJc') {
          commitmentMonths = 6; // Nutrition + Training 6-Month Plan
        }
        // Nutrition Only 2x/month plans
        else if (priceId === 'price_1Rg5QtHIeYfvCylDyXHY5X6G') {
          commitmentMonths = 3; // Nutrition Only 2x/month 3-Month Plan
        } else if (priceId === 'price_1Rg5QtHIeYfvCylDwr9v599a') {
          commitmentMonths = 6; // Nutrition Only 2x/month 6-Month Plan
        }
        
        // Calculate commitment end date (only if there's a commitment period)
        let commitmentEndDate = null;
        let canCancel = true; // Default: can cancel anytime
        
        if (commitmentMonths) {
          commitmentEndDate = new Date(currentDate);
          commitmentEndDate.setMonth(commitmentEndDate.getMonth() + commitmentMonths);
          canCancel = new Date() >= commitmentEndDate; // Can only cancel after commitment period
        }
        
        const finalAmount = isDigitalOnlyPlan(productId, priceId)
          ? getDigitalOnlyAmount(subscription)
          : amount;

        const subscriptionData = {
          user_id: customerId,
          stripe_customer_id: subscription.customer,
          stripe_subscription_id: subscription.id,
          stripe_product_id: productId,
          stripe_price_id: priceId,
          subscription_type: subscriptionType,
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end || false,
          amount_total: finalAmount,
          currency: currency,
          commitment_months: commitmentMonths,
          commitment_end_date: commitmentEndDate ? commitmentEndDate.toISOString() : null,
          can_cancel: canCancel,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Insert or update subscription
        const { error: subscriptionError } = await clientDB
          .from('stripe_subscriptions')
          .upsert([subscriptionData], { 
            onConflict: 'stripe_subscription_id',
            ignoreDuplicates: false 
          });
        
        if (subscriptionError) {
          console.error('❌ Error saving subscription:', subscriptionError);
        } else {
          console.log('✅ Subscription synced:', subscription.id);
          syncedCount++;
        }
      }
      
      // Also sync recent payments/checkout sessions
      const sessions = await stripe.checkout.sessions.list({
        customer: customer.id,
        limit: 10
      });
      
      for (const session of sessions.data) {
        if (session.payment_status === 'paid') {
          const paymentData = {
            user_id: customerId,
            stripe_checkout_session_id: session.id,
            stripe_subscription_id: session.subscription,
            amount: session.amount_total ? session.amount_total / 100 : 0,
            currency: session.currency?.toUpperCase() || 'USD',
            status: 'succeeded',
            payment_method_type: session.payment_method_types?.[0] || 'card',
            created_at: new Date(session.created * 1000).toISOString()
          };
          
          const { error: paymentError } = await clientDB
            .from('stripe_payments')
            .upsert([paymentData], { 
              onConflict: 'stripe_checkout_session_id',
              ignoreDuplicates: false 
            });
          
          if (paymentError) {
            // If foreign key error, try with null user_id
            if (paymentError.code === '23503' && paymentData.user_id) {
              console.warn('⚠️ Foreign key constraint error. Retrying sync with null user_id...');
              paymentData.user_id = null;
              const { error: retryError } = await clientDB
                .from('stripe_payments')
                .upsert([paymentData], { 
                  onConflict: 'stripe_checkout_session_id',
                  ignoreDuplicates: false 
                });
              
              if (retryError) {
                console.error('❌ Error saving payment even with null user_id:', retryError);
              } else {
                console.log('✅ Payment synced (with null user_id):', session.id);
                syncedCount++;
              }
            } else {
              console.error('❌ Error saving payment:', paymentError);
            }
          } else {
            console.log('✅ Payment synced:', session.id);
            syncedCount++;
          }
        }
      }
    }
    
    res.json({ 
      message: `Successfully synced ${syncedCount} records to database`,
      synced: syncedCount 
    });
    
  } catch (error) {
    console.error('❌ Error syncing to database:', error);
    res.status(500).json({ error: error.message || 'Failed to sync to database' });
  }
});

// ====================================
// STRIPE CHECKOUT ROUTES
// ====================================

// Create checkout session
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { 
      priceId, 
      mode = 'subscription',
      customerId,
      customerEmail,
      successUrl,
      cancelUrl,
      promoCode,
      metadata = {}
    } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }

    console.log('Creating checkout session for price:', priceId, 'mode:', mode);

    // Metered/usage-based prices must not have quantity; other prices need quantity (use 1)
    const lineItem = priceId === DIGITAL_ONLY_PRICE_ID
      ? { price: priceId }
      : { price: priceId, quantity: 1 };

    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: [lineItem],
      mode: mode,
      // Use BetterChoice production domain as default for redirects
      // Still allow overriding via successUrl/cancelUrl in the request body
      success_url: successUrl || `https://betterchoice.one/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `https://betterchoice.one/payment-cancel`,
      metadata: {
        priceId,
        ...metadata
      },
      // Allow promotion codes (disabled automatically when explicit discounts are attached)
      allow_promotion_codes: true,
    };

    // If frontend passed a promo code, try to auto-apply matching Stripe promotion code.
    if (promoCode && typeof promoCode === 'string' && promoCode.trim()) {
      try {
        const normalizedPromoCode = promoCode.trim().toUpperCase();
        const promoLookup = await stripe.promotionCodes.list({
          code: normalizedPromoCode,
          active: true,
          limit: 1
        });
        const stripePromoCode = promoLookup?.data?.[0];
        if (stripePromoCode?.id) {
          sessionConfig.discounts = [{ promotion_code: stripePromoCode.id }];
          // Stripe forbids sending both allow_promotion_codes and discounts together.
          delete sessionConfig.allow_promotion_codes;
          console.log('✅ Applied Stripe promotion code to checkout:', normalizedPromoCode);
        } else {
          console.warn('⚠️ No matching active Stripe promotion code found for:', normalizedPromoCode);
        }
      } catch (promoLookupError) {
        console.warn('⚠️ Failed to lookup/apply Stripe promo code:', promoLookupError?.message || promoLookupError);
      }
    }

    // Handle customer
    if (customerId || customerEmail) {
      try {
        // First try to find existing customer
        if (customerId) {
          const customers = await stripe.customers.list({
            limit: 100 // Get customers to search through
          });

          // Filter by metadata on our side
          const existingCustomer = customers.data.find(customer => 
            customer.metadata && customer.metadata.user_id === customerId
          );

          if (existingCustomer) {
            sessionConfig.customer = existingCustomer.id;
            console.log('Found existing customer:', existingCustomer.id);
          } else {
            // Create new customer
            const customer = await stripe.customers.create({
              email: customerEmail,
              metadata: { user_id: customerId }
            });
            sessionConfig.customer = customer.id;
            console.log('Created new customer:', customer.id);
          }
        } else if (customerEmail) {
          sessionConfig.customer_email = customerEmail;
        }
      } catch (customerError) {
        console.error('Error handling customer:', customerError);
        // Continue without customer - not critical
      }
    }

    // Add subscription-specific config
    if (mode === 'subscription') {
      sessionConfig.subscription_data = {
        metadata: {
          user_id: customerId || 'anonymous',
          price_id: priceId,
          created_at: new Date().toISOString(),
          ...metadata
        }
      };
    } else if (mode === 'payment') {
      sessionConfig.payment_intent_data = {
        metadata: {
          user_id: customerId || 'anonymous',
          price_id: priceId,
          created_at: new Date().toISOString(),
          ...metadata
        }
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    
    console.log('Checkout session created:', session.id);
    
    res.json({ 
      sessionId: session.id,
      url: session.url 
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create checkout session' 
    });
  }
});

// Get checkout session details
app.get('/api/stripe/checkout-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'customer', 'subscription']
    });
    
    res.json(session);
  } catch (error) {
    console.error('Error retrieving checkout session:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to retrieve checkout session' 
    });
  }
});

// ====================================
// PAYMENT INTENT ROUTES
// ====================================

// Create payment intent for custom checkout
app.post('/api/stripe/create-payment-intent', async (req, res) => {
  try {
    const { 
      amount, 
      currency = 'usd',
      customerId,
      metadata = {}
    } = req.body;

    if (!amount || amount < 50) { // Stripe minimum is $0.50
      return res.status(400).json({ error: 'Amount must be at least 50 cents' });
    }

    console.log('Creating payment intent for amount:', amount, currency);

    const paymentIntentConfig = {
      amount: Math.round(amount), // Ensure integer
      currency: currency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        ...metadata,
        created_at: new Date().toISOString()
      }
    };

    // Add customer if provided
    if (customerId) {
      try {
        const customers = await stripe.customers.list({
          limit: 100 // Get customers to search through
        });

        // Filter by metadata on our side
        const existingCustomer = customers.data.find(customer => 
          customer.metadata && customer.metadata.user_id === customerId
        );

        if (existingCustomer) {
          paymentIntentConfig.customer = existingCustomer.id;
        }
      } catch (error) {
        console.error('Error finding customer:', error);
      }
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentConfig);

    console.log('Payment intent created:', paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create payment intent' 
    });
  }
});

// Validate onboarding/pricing access code (free-tier path)
app.post(['/api/subscription/validate-access-code', '/api/pricing/validate-access-code'], async (req, res) => {
  try {
    const { code, user_id, user_code } = req.body || {};

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ valid: false, error: 'Code is required' });
    }
    if (!adminDB) {
      return res.status(500).json({ valid: false, error: 'Chat database not configured' });
    }

    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      return res.status(400).json({ valid: false, error: 'Code is required' });
    }

    const nowIso = new Date().toISOString();
    const { data: accessCode, error: codeError } = await adminDB
      .from('onboarding_access_codes')
      .select('*')
      .eq('code', normalizedCode)
      .eq('is_active', true)
      .maybeSingle();

    if (codeError) {
      console.error('❌ Error validating access code:', codeError);
      return res.status(500).json({ valid: false, error: 'Failed to validate code' });
    }

    if (!accessCode) {
      return res.status(404).json({ valid: false, error: 'Code is invalid or unavailable' });
    }

    const now = new Date(nowIso);
    if (accessCode.valid_from && new Date(accessCode.valid_from) > now) {
      return res.status(400).json({ valid: false, error: 'Code is not active yet' });
    }
    if (accessCode.valid_until && new Date(accessCode.valid_until) < now) {
      return res.status(400).json({ valid: false, error: 'Code has expired' });
    }

    const usedCount = Number(accessCode.used_count || 0);
    const maxUses = accessCode.max_uses == null ? null : Number(accessCode.max_uses);
    if (maxUses != null && usedCount >= maxUses) {
      return res.status(400).json({ valid: false, error: 'Code usage limit reached' });
    }

    const updates = {
      used_count: usedCount + 1,
      last_used_at: nowIso,
      updated_at: nowIso
    };

    // Store the internal chat_users.id (chat project), not auth user id
    let resolvedUserCode = user_code || null;
    if (!resolvedUserCode && user_id) {
      const { data: clientData } = await clientDB
        .from('clients')
        .select('user_code')
        .eq('user_id', user_id)
        .maybeSingle();
      resolvedUserCode = clientData?.user_code || null;
    }
    if (resolvedUserCode) {
      const { data: chatUserData } = await adminDB
        .from('chat_users')
        .select('id')
        .eq('user_code', resolvedUserCode)
        .maybeSingle();
      if (chatUserData?.id) {
        updates.last_used_by_user_id = chatUserData.id;
      }
    }

    const { error: updateError } = await adminDB
      .from('onboarding_access_codes')
      .update(updates)
      .eq('id', accessCode.id);

    if (updateError) {
      console.error('❌ Error updating access code usage:', updateError);
      return res.status(500).json({ valid: false, error: 'Failed to apply code usage' });
    }

    return res.json({
      valid: true,
      code: normalizedCode,
      message: 'Code validated successfully'
    });
  } catch (error) {
    console.error('❌ Error in subscription/validate-access-code endpoint:', error);
    return res.status(500).json({
      valid: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// ====================================
// SUBSCRIPTION MANAGEMENT ROUTES
// ====================================

// Get customer subscriptions
app.get('/api/stripe/subscriptions', async (req, res) => {
  try {
    const { customerId } = req.query;
    
    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    console.log('Fetching subscriptions for customer:', customerId);
    
    // Find Stripe customer by user_id metadata
    // Note: customers.list doesn't support metadata filtering, so we get recent customers and filter
    const customers = await stripe.customers.list({
      limit: 100 // Get more customers to search through
    });

    // Filter customers by metadata on our side
    const matchingCustomers = customers.data.filter(customer => 
      customer.metadata && customer.metadata.user_id === customerId
    );

    if (matchingCustomers.length === 0) {
      return res.json({ subscriptions: [] });
    }

    let allSubscriptions = [];
    
    // Get subscriptions for all matching customers
    for (const customer of matchingCustomers) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        expand: ['data.items.data.price', 'data.latest_invoice']
      });
      allSubscriptions = allSubscriptions.concat(subscriptions.data);
    }
    
    console.log(`Found ${allSubscriptions.length} subscriptions`);
    
    res.json({ subscriptions: allSubscriptions });
  } catch (error) {
    console.error('Error retrieving subscriptions:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to retrieve subscriptions' 
    });
  }
});

// Remove user from stripe_usage_log when they cancel (usage-based / digital_only tracking)
async function removeUserFromStripeUsageLog(userId) {
  if (!userId) return;
  try {
    const { data: client } = await clientDB
      .from('clients')
      .select('user_code')
      .eq('user_id', userId)
      .maybeSingle();
    const userCode = client?.user_code;
    if (!userCode) return;
    const { error } = await clientDB
      .from('stripe_usage_log')
      .delete()
      .eq('user_code', userCode);
    if (error) console.warn('⚠️ stripe_usage_log delete failed for user_code:', userCode, error.message);
    else console.log('✅ Removed stripe_usage_log row for user_code:', userCode);
  } catch (e) {
    console.warn('⚠️ removeUserFromStripeUsageLog:', e.message);
  }
}

// Cancel subscription
app.post('/api/stripe/subscriptions/:subscriptionId/cancel', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { cancelAtPeriodEnd = true } = req.body;
    
    console.log('Cancelling subscription:', subscriptionId, 'at period end:', cancelAtPeriodEnd);

    let subscription;
    
    if (cancelAtPeriodEnd) {
      // Cancel at period end
      subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    } else {
      // Cancel immediately
      subscription = await stripe.subscriptions.cancel(subscriptionId);
    }
    
    console.log('Subscription cancelled:', subscription.id, 'status:', subscription.status);

    // Remove from stripe_usage_log so usage-based tracking stops
    const userId = subscription.metadata?.user_id;
    if (!userId) {
      const { data: row } = await clientDB.from('stripe_subscriptions').select('user_id').eq('stripe_subscription_id', subscriptionId).maybeSingle();
      if (row?.user_id) await removeUserFromStripeUsageLog(row.user_id);
    } else {
      await removeUserFromStripeUsageLog(userId);
    }
    
    res.json(subscription);
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to cancel subscription' 
    });
  }
});

// Reactivate subscription
app.post('/api/stripe/subscriptions/:subscriptionId/reactivate', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    console.log('Reactivating subscription:', subscriptionId);

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });
    
    console.log('Subscription reactivated:', subscription.id);
    
    res.json(subscription);
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to reactivate subscription' 
    });
  }
});

// Update subscription payment method
app.post('/api/stripe/subscriptions/:subscriptionId/payment-method', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { paymentMethodId } = req.body;
    
    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method ID is required' });
    }

    console.log('Updating payment method for subscription:', subscriptionId);

    // Get subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Update customer's default payment method
    await stripe.customers.update(subscription.customer, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    // Update subscription's default payment method
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      default_payment_method: paymentMethodId
    });
    
    console.log('Payment method updated for subscription:', subscriptionId);
    
    res.json(updatedSubscription);
  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to update payment method' 
    });
  }
});

// ====================================
// WEBHOOK HANDLING
// ====================================

stripeWebhookHandler = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  console.log('🎯 Webhook received from IP:', req.ip || req.headers['x-forwarded-for']);
  const isBuffer = Buffer.isBuffer(req.body);
  const bodyType = typeof req.body;
  const bodyLength = req.body?.length ?? (typeof req.body === 'string' ? req.body.length : 'n/a');
  console.log('📦 Webhook body:', bodyType, isBuffer ? 'Buffer' : 'not Buffer', 'length:', bodyLength);

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('❌ STRIPE_WEBHOOK_SECRET is not configured!');
    return res.status(500).send('Webhook secret not configured');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET.trim();
  const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      sig,
      webhookSecret
    );

    console.log('✅ Webhook verified:', event.type, event.id);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    console.error('💡 Ensure the signing secret is from the exact webhook endpoint URL in Stripe Dashboard (Developers → Webhooks) and from the same mode (Test vs Live) as the events.');
    console.error('Headers:', req.headers);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('💳 Checkout session completed:', event.data.object.id);
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
        console.log('🔄 Subscription created:', event.data.object.id);
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        console.log('🔄 Subscription updated:', event.data.object.id);
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        console.log('❌ Subscription deleted:', event.data.object.id);
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        console.log('✅ Payment succeeded:', event.data.object.id);
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        console.log('❌ Payment failed:', event.data.object.id);
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Manual endpoint to process a checkout session (backup if webhook fails)
app.post('/api/stripe/process-checkout-session', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    console.log('🔄 Manually processing checkout session:', sessionId);
    
    // Retrieve full session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'line_items']
    });
    
    console.log('📋 Session retrieved:', session.id, 'Status:', session.payment_status);
    
    // Process the checkout completion
    if (session.payment_status === 'paid') {
      await handleCheckoutCompleted(session);
      
      // If subscription exists, process it too
      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription, {
          expand: ['items.data.price']
        });
        await handleSubscriptionCreated(subscription);
      }
      
      res.json({ 
        success: true, 
        message: 'Checkout session processed successfully',
        sessionId: session.id,
        subscriptionId: session.subscription 
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Payment not completed',
        paymentStatus: session.payment_status 
      });
    }
    
  } catch (error) {
    console.error('❌ Error processing checkout session:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to process checkout session' 
    });
  }
});

// ====================================
// WEBHOOK HANDLER FUNCTIONS
// ====================================

// Helper function to update clients table subscription info by email
async function updateClientsSubscription(customerEmail, subscriptionStatus, subscriptionType, subscriptionExpiresAt) {
  if (!customerEmail) {
    return;
  }

  try {
    // Find client by email
    const { data: client, error: findError } = await clientDB
      .from('clients')
      .select('id')
      .eq('email', customerEmail)
      .maybeSingle();

    if (findError) {
      console.warn(`⚠️ Error finding client with email: ${customerEmail}`, findError);
      return;
    }

    if (!client) {
      console.warn(`⚠️ Could not find client with email: ${customerEmail}`);
      return;
    }

    // Update client by id
    const { error: updateError } = await clientDB
      .from('clients')
      .update({
        subscription_status: subscriptionStatus || 'none',
        subscription_type: subscriptionType,
        subscription_expires_at: subscriptionExpiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', client.id);

    if (updateError) {
      console.error('❌ Error updating clients subscription info:', updateError);
    } else {
      console.log(`✅ clients subscription info updated for email: ${customerEmail}`);
    }
  } catch (error) {
    console.error('❌ Error in updateClientsSubscription:', error);
  }
}

// Helper function to update chat_users subscription info by email
async function updateChatUserSubscription(customerEmail, subscriptionStatus, subscriptionType, subscriptionExpiresAt) {
  if (!adminDB || !customerEmail) {
    if (!adminDB) {
      console.warn('⚠️ adminDB client not configured, skipping chat_users update');
    }
    return;
  }

  try {
    // Find chat_user by email
    const { data: chatUser, error: findError } = await adminDB
      .from('chat_users')
      .select('id')
      .eq('email', customerEmail)
      .single();

    if (findError || !chatUser) {
      console.warn(`⚠️ Could not find chat_user with email: ${customerEmail}`, findError);
      return;
    }

    // Update chat_user by id
    const { error: updateError } = await adminDB
      .from('chat_users')
      .update({
        subscription_status: subscriptionStatus,
        subscription_type: subscriptionType,
        subscription_expires_at: subscriptionExpiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', chatUser.id);

    if (updateError) {
      console.error('❌ Error updating chat_users subscription info:', updateError);
    } else {
      console.log(`✅ chat_users subscription info updated for email: ${customerEmail}`);
    }
  } catch (error) {
    console.error('❌ Error in updateChatUserSubscription:', error);
  }
}

// Helper function to update both clients and chat_users subscription info
async function updateSubscriptionInfo(customerEmail, subscriptionStatus, subscriptionType, subscriptionExpiresAt) {
  // Update both tables in parallel
  await Promise.all([
    updateClientsSubscription(customerEmail, subscriptionStatus, subscriptionType, subscriptionExpiresAt),
    updateChatUserSubscription(customerEmail, subscriptionStatus, subscriptionType, subscriptionExpiresAt)
  ]);
}

function calculateMainTotalsFromMeals(meals) {
  if (!Array.isArray(meals)) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  return meals.reduce((acc, meal) => {
    if (meal?.main?.nutrition) {
      acc.calories += meal.main.nutrition.calories || 0;
      acc.protein += meal.main.nutrition.protein || 0;
      acc.carbs += meal.main.nutrition.carbs || 0;
      acc.fat += meal.main.nutrition.fat || 0;
    }
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

const nutritionSchema = {
  type: 'object',
  properties: {
    fat: { type: 'number' },
    carbs: { type: 'number' },
    protein: { type: 'number' },
    calories: { type: 'number' }
  },
  required: ['fat', 'carbs', 'protein', 'calories'],
  additionalProperties: false
};

const ingredientSchema = {
  type: 'object',
  properties: {
    UPC: { type: ['string', 'null'] },
    fat: { type: 'number' },
    item: { type: 'string' },
    carbs: { type: 'number' },
    protein: { type: 'number' },
    calories: { type: 'number' },
    'portionSI(gram)': { type: 'number' },
    'brand of pruduct': { type: 'string' },
    household_measure: { type: 'string' }
  },
  required: [
    'UPC', 'fat', 'item', 'carbs', 'protein', 'calories',
    'portionSI(gram)', 'brand of pruduct', 'household_measure'
  ],
  additionalProperties: false
};

const mealDetailsSchema = {
  type: 'object',
  properties: {
    meal_name: { type: 'string' },
    nutrition: nutritionSchema,
    meal_title: { type: 'string' },
    ingredients: {
      type: 'array',
      items: ingredientSchema
    },
    main_protein_source: { type: 'string' }
  },
  required: ['meal_name', 'nutrition', 'meal_title', 'ingredients', 'main_protein_source'],
  additionalProperties: false
};

const mealOptionSchema = {
  type: 'object',
  properties: {
    main: mealDetailsSchema,
    meal: { type: 'string' },
    alternative: mealDetailsSchema
  },
  required: ['main', 'meal', 'alternative'],
  additionalProperties: false
};

const mealPlanSchema = {
  type: 'object',
  properties: {
    note: { type: 'string' },
    meals: {
      type: 'array',
      items: mealOptionSchema
    },
    totals: nutritionSchema
  },
  required: ['note', 'meals', 'totals'],
  additionalProperties: false
};

async function generateUpdatedMealPlan(currentMealPlanStr, userRequestStr, userProfileObj) {
  const apiBase = (process.env.AZURE_OPENAI_API_BASE || '').replace(/\/$/, '');
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!apiBase || !apiKey || !deployment) {
    throw new Error('Azure OpenAI is not configured on the server');
  }

  const systemPrompt = `
You are an expert clinical dietitian and precise data processor. Your job is to modify an existing meal plan based on a user's request while strictly maintaining nutritional balance, adhering to the User Profile, and conforming to the required schema.

RULES & GUARDRAILS:
1. USER PROFILE ADHERENCE: You must strictly enforce all dietary restrictions, allergies, and preferences listed in the provided USER PROFILE. If a user's modification request violates their own profile, intelligently substitute the request with a safe, profile-compliant alternative that mimics the desired flavor profile or texture.
2. NUTRITIONAL REASONABLENESS: The user's request must be adapted into a healthy, balanced meal. If a user asks for something nutritionally unreasonable, adapt it into a viable option that fits their macros.
3. MACRO & CALORIE REDISTRIBUTION: You may change macros/calories for a specific requested meal when the user asks for that. If one meal is reduced or increased, redistribute the exact macro/calorie delta across the other meals so that the full-day totals remain balanced. Adjust ingredient portions (in grams) across affected meals to implement this redistribution accurately.
4. BRAND HANDLING: If the user explicitly requests a specific brand, place that exact brand name in the "brand of pruduct" field. If they ask for a generic item, leave "brand of pruduct" as an empty string "". Always set UPC to null for generated items.
5. DATA ACCURACY: For any new ingredients added, provide realistic, mathematically accurate estimations for macros, calories, and standard household measures based on the calculated portion size in grams.
6. DAILY TOTAL INTEGRITY: Keep the daily totals as close as possible to the original daily totals (target ±100 kcal and ±10% per macro for the day)
`;

  const userPrompt = `
USER PROFILE:
${JSON.stringify(userProfileObj)}

CURRENT MEAL PLAN:
${currentMealPlanStr}

USER MODIFICATION REQUEST:
"${userRequestStr}"

INSTRUCTIONS:
Update the CURRENT MEAL PLAN to accommodate the USER MODIFICATION REQUEST. Ensure all changes strictly comply with the USER PROFILE. If a specific meal is changed in calories/macros, rebalance the removed/added calories and macros across the remaining meals by adjusting ingredient portions. Recalculate the totals.
`;

  const url = `${apiBase}/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'updated_meal_plan',
          strict: true,
          schema: mealPlanSchema
        }
      },
      temperature: 0.1,
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Azure OpenAI meal-plan update failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Azure OpenAI returned empty content for meal-plan update');
  }

  try {
    return JSON.parse(content);
  } catch (parseError) {
    throw new Error(`Failed to parse Azure OpenAI meal-plan JSON: ${parseError.message}`);
  }
}

async function createAndSaveOnboardingMealPlanForUser(userId, fallbackUserCode = null) {
  try {
    if (!adminDB) {
      console.warn('⚠️ Skipping async meal plan generation: chat database is not configured');
      return;
    }

    let resolvedUserCode = fallbackUserCode || null;
    let clientName = 'Client';

    if (userId) {
      const { data: clientRecord, error: clientError } = await clientDB
        .from('clients')
        .select('user_code, full_name, first_name, last_name')
        .eq('user_id', userId)
        .maybeSingle();

      if (clientError && clientError.code !== 'PGRST116') {
        throw clientError;
      }

      if (clientRecord?.user_code) resolvedUserCode = clientRecord.user_code;
      if (clientRecord?.full_name) {
        clientName = clientRecord.full_name;
      } else {
        clientName = `${clientRecord?.first_name || ''} ${clientRecord?.last_name || ''}`.trim() || clientName;
      }
    }

    if (!resolvedUserCode) {
      console.warn('⚠️ Skipping async meal plan generation: user_code is missing for user_id:', userId);
      return;
    }

    const { data: chatUserData, error: chatUserError } = await adminDB
      .from('chat_users')
      .select('daily_target_total_calories, macros, user_language, language, full_name')
      .eq('user_code', resolvedUserCode)
      .maybeSingle();

    if (chatUserError && chatUserError.code !== 'PGRST116') {
      throw chatUserError;
    }

    if (chatUserData?.full_name) {
      clientName = chatUserData.full_name;
    }

    const dailyCalories = Number(chatUserData?.daily_target_total_calories || 0);
    const macros = chatUserData?.macros || null;
    const userLanguage = chatUserData?.user_language || chatUserData?.language || 'english';

    if (!dailyCalories) {
      console.warn('⚠️ Skipping async meal plan generation: missing daily_target_total_calories for user_code:', resolvedUserCode);
      return;
    }

    // Avoid duplicate plans if Stripe retries webhook events.
    const { data: existingPlans, error: existingPlansError } = await clientDB
      .from('client_meal_plans')
      .select('id')
      .eq('user_code', resolvedUserCode)
      .eq('active', true)
      .limit(1);

    if (existingPlansError) {
      throw existingPlansError;
    }

    if (existingPlans && existingPlans.length > 0) {
      console.log('ℹ️ Active meal plan already exists, skipping async onboarding generation for user_code:', resolvedUserCode);
      return;
    }

    console.log('🧠 Generating onboarding meal plan asynchronously for user_code:', resolvedUserCode);
    const createRes = await fetch(CREATE_MEAL_PLAN_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_code: resolvedUserCode })
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => '');
      throw new Error(`Create meal plan API error (${createRes.status}): ${errText}`);
    }

    const raw = await createRes.json();
    if (raw?.error) {
      throw new Error(typeof raw.error === 'string' ? raw.error : JSON.stringify(raw.error));
    }

    const payload = raw?.data ?? raw?.result ?? raw;
    const menu =
      payload?.menu ??
      payload?.meals ??
      payload?.meal_plan?.meals ??
      (Array.isArray(payload?.meal_plan) ? payload.meal_plan : null);

    if (!Array.isArray(menu) || menu.length === 0) {
      throw new Error('No meals were created by meal plan builder');
    }

    const template = payload?.template ?? payload?.schema ?? payload?.meal_plan?.template ?? null;
    const menuData = {
      meals: menu,
      totals: payload?.totals ?? payload?.meal_plan?.totals ?? calculateMainTotalsFromMeals(menu),
      note: payload?.note ?? payload?.meal_plan?.note ?? ''
    };

    const planId = randomUUID();
    const now = new Date().toISOString();
    const mealPlanName = `${clientName || 'Client'}'s Meal Plan`;

    const { error: secondaryError } = await adminDB
      .from('meal_plans_and_schemas')
      .insert({
        id: planId,
        record_type: 'meal_plan',
        user_code: resolvedUserCode,
        meal_plan_name: mealPlanName,
        schema: template,
        meal_plan: menuData,
        status: 'active',
        daily_total_calories: dailyCalories,
        macros_target: macros,
        active_from: now,
        created_at: now,
        updated_at: now
      });

    if (secondaryError) throw secondaryError;

    const { error: mainError } = await clientDB
      .from('client_meal_plans')
      .insert({
        id: planId,
        user_code: resolvedUserCode,
        original_meal_plan_id: planId,
        meal_plan_name: mealPlanName,
        dietitian_meal_plan: menuData,
        active: true,
        daily_total_calories: dailyCalories,
        macros_target: macros,
        created_at: now,
        updated_at: now
      });

    if (mainError) {
      await adminDB
        .from('meal_plans_and_schemas')
        .delete()
        .eq('id', planId);
      throw mainError;
    }

    console.log('✅ Async onboarding meal plan generated and saved for user_code:', resolvedUserCode, 'language:', userLanguage);
  } catch (error) {
    console.error('❌ Async onboarding meal plan generation failed:', error.message);
  }
}

async function handleCheckoutCompleted(session) {
  console.log('🎉 Processing checkout completion:', session.id);
  
  try {
    // Extract user information
    let userId = session.metadata?.user_id || session.client_reference_id;
    const customerEmail = session.customer_details?.email || session.customer_email;
    
    console.log('Checkout completed for user:', userId, 'email:', customerEmail);
    
    // If no userId but we have email, try to find user in clients table
    if (!userId && customerEmail) {
      console.log('🔍 No user_id found, searching for client by email:', customerEmail);
      const { data: clientData } = await clientDB
        .from('clients')
        .select('user_id')
        .eq('email', customerEmail)
        .single();
      
      if (clientData?.user_id) {
        userId = clientData.user_id;
        console.log('✅ Found client, using user_id:', userId);
      }
    }
    
    // Note: We'll rely on database constraints. If user doesn't exist, 
    // the insert will fail and we'll retry with null user_id
    
    // Save payment record
    const paymentData = {
      user_id: userId || null,
      stripe_checkout_session_id: session.id,
      stripe_subscription_id: session.subscription,
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency?.toUpperCase() || 'USD',
      status: 'succeeded',
      payment_method_type: session.payment_method_types?.[0] || 'card',
      created_at: new Date().toISOString()
    };
    
    console.log('💾 Saving payment to Supabase:', paymentData);
    
    const { data, error: paymentError } = await clientDB
      .from('stripe_payments')
      .insert([paymentData])
      .select();
    
    if (paymentError) {
      console.error('❌ Error saving payment to Supabase:', paymentError);
      console.error('Payment error code:', paymentError.code, 'userId:', userId);
      
      // If foreign key error, the user_id might not exist in auth.users
      // This should not happen if database constraints are properly configured
      if (paymentError.code === '23503') {
        console.error('⚠️ Foreign key constraint error - user_id may not exist in auth.users');
        console.error('   Please verify that the foreign key points to auth.users, not users table');
      }
      
      console.error('Payment data that failed:', paymentData);
    } else {
      console.log('✅ Payment record saved successfully:', data);
    }
    
    // If this is a subscription, it will be handled by handleSubscriptionCreated
    
  } catch (error) {
    console.error('❌ Error processing checkout completion:', error);
    console.error('Full error stack:', error.stack);
  }
}

async function handleSubscriptionCreated(subscription) {
  console.log('🔄 Processing subscription creation:', subscription.id);
  
  try {
    // Extract user_id from subscription metadata
    const userId = subscription.metadata?.user_id;
    
    if (!userId) {
      console.warn('⚠️ No user_id found in subscription metadata');
      return;
    }
    
    console.log('Creating subscription for user:', userId);
    
    // Get product and price info
    const priceId = subscription.items.data[0]?.price?.id;
    const productId = subscription.items.data[0]?.price?.product;
    const amount = subscription.items.data[0]?.price?.unit_amount / 100;
    const currency = subscription.items.data[0]?.price?.currency?.toUpperCase() || 'USD';
    
    // Determine subscription type based on product ID
    let subscriptionType = 'unknown';
    if (productId === 'prod_SbI1Lu7FWbybUO') subscriptionType = 'nutrition_training_once_month';
    else if (productId === 'prod_SbI1dssS5NElLZ') subscriptionType = 'nutrition_only';
    else if (productId === 'prod_SbI1AIv2A46oJ9') subscriptionType = 'nutrition_training';
    else if (productId === 'prod_SbI0A23T20wul3') subscriptionType = 'nutrition_only_2x_month';
    else if (isDigitalOnlyPlan(productId, priceId)) subscriptionType = 'digital_only'; // Onboarding upsell (usage-based)
    
    // Determine commitment period based on exact price ID mapping
    let commitmentMonths = null; // Default no commitment
    // Use subscription created date (when subscription was first created) for commitment calculation
    const subscriptionStartDate = new Date(subscription.created * 1000);
    
    // Nutrition + Training (once/month) plans (using BetterPro price IDs)
    if (priceId === 'price_1Rg5R8HIeYfvCylDJ4Xfg5hr') {
      commitmentMonths = 3; // Nutrition + Training once/month 3-Month Plan
    } else if (priceId === 'price_1Rg5R8HIeYfvCylDxX2PsOrR') {
      commitmentMonths = 6; // Nutrition + Training once/month 6-Month Plan
    }
    // Nutrition Only plans
    else if (priceId === 'price_1Rg5R6HIeYfvCylDcsV3T2Kr') {
      commitmentMonths = 3; // Nutrition Only 3-Month Plan
    } else if (priceId === 'price_1Rg5R6HIeYfvCylDxuQODpK4') {
      commitmentMonths = 6; // Nutrition Only 6-Month Plan
    }
    // Nutrition + Training plans
    else if (priceId === 'price_1Rg5R4HIeYfvCylDAshP6FOk') {
      commitmentMonths = 3; // Nutrition + Training 3-Month Plan
    } else if (priceId === 'price_1Rg5R4HIeYfvCylDy1OT1YJc') {
      commitmentMonths = 6; // Nutrition + Training 6-Month Plan
    }
    // Nutrition Only 2x/month plans
    else if (priceId === 'price_1Rg5QtHIeYfvCylDyXHY5X6G') {
      commitmentMonths = 3; // Nutrition Only 2x/month 3-Month Plan
    } else if (priceId === 'price_1Rg5QtHIeYfvCylDwr9v599a') {
      commitmentMonths = 6; // Nutrition Only 2x/month 6-Month Plan
    }
    
    // Calculate commitment end date from subscription start date (only if there's a commitment period)
    let commitmentEndDate = null;
    let canCancel = true; // Default: can cancel anytime
    
    if (commitmentMonths) {
      commitmentEndDate = new Date(subscriptionStartDate);
      commitmentEndDate.setMonth(commitmentEndDate.getMonth() + commitmentMonths);
      canCancel = new Date() >= commitmentEndDate; // Can only cancel after commitment period
      console.log(`📅 Commitment period: ${commitmentMonths} months from ${subscriptionStartDate.toISOString()} to ${commitmentEndDate.toISOString()}`);
      
      // Set cancel_at in Stripe so it automatically stops charging at commitment end
      // This ensures payments stop even if the customer never visits the website again
      try {
        const cancelAtTimestamp = Math.floor(commitmentEndDate.getTime() / 1000);
        await stripe.subscriptions.update(subscription.id, {
          cancel_at: cancelAtTimestamp
        });
        console.log(`🛑 Stripe subscription ${subscription.id} will auto-cancel at ${commitmentEndDate.toISOString()} (cancel_at: ${cancelAtTimestamp})`);
      } catch (err) {
        console.error('❌ Failed to set cancel_at on subscription:', err);
      }
    }
    
    const finalAmount = isDigitalOnlyPlan(productId, priceId)
      ? getDigitalOnlyAmount(subscription)
      : amount;

    const subscriptionData = {
      user_id: userId,
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      stripe_product_id: productId,
      stripe_price_id: priceId,
      subscription_type: subscriptionType,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      amount_total: finalAmount,
      currency: currency,
      commitment_months: commitmentMonths,
      commitment_end_date: commitmentEndDate ? commitmentEndDate.toISOString() : null,
      can_cancel: canCancel,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('📋 Subscription data to save:', subscriptionData);
    
    // Note: We'll rely on database constraints. If user doesn't exist, 
    // the insert will fail and we'll retry with null user_id
    
    console.log('💾 Saving subscription to Supabase...');
    
    const { data: insertedData, error: subscriptionError } = await clientDB
      .from('stripe_subscriptions')
      .insert([subscriptionData])
      .select();
    
    if (subscriptionError) {
      console.error('❌ Error saving subscription:', subscriptionError);
      console.error('Subscription data that failed:', subscriptionData);
      
      // If foreign key error, the user_id might not exist in auth.users
      // This should not happen if database constraints are properly configured
      if (subscriptionError.code === '23503') {
        console.error('⚠️ Foreign key constraint error - user_id may not exist in auth.users');
        console.error('   Please verify that the foreign key points to auth.users, not users table');
      }
    } else {
      console.log('✅ Subscription record saved successfully:', insertedData);

      // Also update clients and chat_users subscription info
      // Get customer email from Stripe
      try {
        const customer = await stripe.customers.retrieve(subscription.customer);
        const customerEmail = customer.email;
        
        if (customerEmail) {
          await updateSubscriptionInfo(
            customerEmail,
            subscription.status,
            subscriptionType,
            commitmentEndDate ? commitmentEndDate.toISOString() : null
          );
        } else {
          console.warn('⚠️ No email found for customer:', subscription.customer);
        }
      } catch (customerError) {
        console.error('❌ Error retrieving customer for subscription info update:', customerError);
      }

      // Onboarding upsell (usage-based): prod_TrcVkwBC0wmqKp / price_1SyHX0HIeYfvCylDZyb1Lb3L — send WhatsApp welcome
      if (priceId === DIGITAL_ONLY_PRICE_ID && userId) {
        try {
          const r = await sendWhatsAppWelcomeByUserId(userId);
          if (r.success) console.log('📱 WhatsApp welcome sent (onboarding upsell) for user:', userId);
          else console.warn('📱 WhatsApp welcome (onboarding upsell) skipped or failed:', r.message);
        } catch (e) {
          console.warn('📱 WhatsApp welcome (onboarding upsell) error:', e.message);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error processing subscription creation:', error);
    console.error('Full error stack:', error.stack);
  }
}

async function handleSubscriptionUpdated(subscription) {
  console.log('🔄 Processing subscription update:', subscription.id);
  
  try {
    const userId = subscription.metadata?.user_id;
    
    if (!userId) {
      console.warn('⚠️ No user_id found in subscription metadata');
    }
    
    console.log('Updating subscription for user:', userId);
    
    // Get existing subscription from database to get original start date
    const { data: existingSubscription } = await clientDB
      .from('stripe_subscriptions')
      .select('*')
      .eq('stripe_subscription_id', subscription.id)
      .single();
    
    // Get product and price info for commitment tracking
    const price = subscription.items.data[0]?.price;
    const priceId = price?.id;
    const productId = price?.product;
    
    // Determine commitment period based on exact price ID mapping
    let commitmentMonths = null; // Default no commitment
    // Use subscription created date from Stripe (when subscription was first created)
    // This is the correct date to calculate commitment period from
    const subscriptionStartDate = new Date(subscription.created * 1000);
    
    // Nutrition + Training (once/month) plans (using BetterPro price IDs)
    if (priceId === 'price_1Rg5R8HIeYfvCylDJ4Xfg5hr') {
      commitmentMonths = 3; // Nutrition + Training once/month 3-Month Plan
    } else if (priceId === 'price_1Rg5R8HIeYfvCylDxX2PsOrR') {
      commitmentMonths = 6; // Nutrition + Training once/month 6-Month Plan
    }
    // Nutrition Only plans
    else if (priceId === 'price_1Rg5R6HIeYfvCylDcsV3T2Kr') {
      commitmentMonths = 3; // Nutrition Only 3-Month Plan
    } else if (priceId === 'price_1Rg5R6HIeYfvCylDxuQODpK4') {
      commitmentMonths = 6; // Nutrition Only 6-Month Plan
    }
    // Nutrition + Training plans
    else if (priceId === 'price_1Rg5R4HIeYfvCylDAshP6FOk') {
      commitmentMonths = 3; // Nutrition + Training 3-Month Plan
    } else if (priceId === 'price_1Rg5R4HIeYfvCylDy1OT1YJc') {
      commitmentMonths = 6; // Nutrition + Training 6-Month Plan
    }
    // Nutrition Only 2x/month plans
    else if (priceId === 'price_1Rg5QtHIeYfvCylDyXHY5X6G') {
      commitmentMonths = 3; // Nutrition Only 2x/month 3-Month Plan
    } else if (priceId === 'price_1Rg5QtHIeYfvCylDwr9v599a') {
      commitmentMonths = 6; // Nutrition Only 2x/month 6-Month Plan
    }

    // Determine subscription type based on product ID (same mapping as on create)
    let subscriptionType = 'unknown';
    if (productId === 'prod_SbI1Lu7FWbybUO') subscriptionType = 'nutrition_training_once_month';
    else if (productId === 'prod_SbI1dssS5NElLZ') subscriptionType = 'nutrition_only';
    else if (productId === 'prod_SbI1AIv2A46oJ9') subscriptionType = 'nutrition_training';
    else if (productId === 'prod_SbI0A23T20wul3') subscriptionType = 'nutrition_only_2x_month';
    else if (isDigitalOnlyPlan(productId, priceId)) subscriptionType = 'digital_only'; // Onboarding upsell (usage-based)
    
    // Calculate commitment end date - use stored value if exists, otherwise calculate from start date
    let commitmentEndDate = null;
    let canCancel = true; // Default: can cancel anytime
    
    if (commitmentMonths) {
      // Use stored commitment_end_date if it exists (calculated at creation), otherwise calculate it
      if (existingSubscription?.commitment_end_date) {
        commitmentEndDate = new Date(existingSubscription.commitment_end_date);
      } else {
        commitmentEndDate = new Date(subscriptionStartDate);
        commitmentEndDate.setMonth(commitmentEndDate.getMonth() + commitmentMonths);
      }
      
      const now = new Date();
      canCancel = now >= commitmentEndDate; // Can only cancel after commitment period
    }
    
    const amount = price?.unit_amount / 100;
    const finalAmount = isDigitalOnlyPlan(productId, priceId)
      ? getDigitalOnlyAmount(subscription)
      : amount;

    // Update subscription record
    const finalCancelAtPeriodEnd = subscription.cancel_at_period_end || false;
    
    // Update subscription record
    const updateData = {
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: finalCancelAtPeriodEnd,
      amount_total: finalAmount,
      commitment_months: commitmentMonths,
      commitment_end_date: commitmentEndDate ? commitmentEndDate.toISOString() : null,
      can_cancel: canCancel,
      updated_at: new Date().toISOString()
    };
    
    const { error: updateError } = await clientDB
      .from('stripe_subscriptions')
      .update(updateData)
      .eq('stripe_subscription_id', subscription.id);
    
    if (updateError) {
      console.error('❌ Error updating subscription:', updateError);
    } else {
      console.log('✅ Subscription updated successfully');

      // Also update clients and chat_users subscription info
      // Get customer email from Stripe
      try {
        const customer = await stripe.customers.retrieve(subscription.customer);
        const customerEmail = customer.email;
        
        if (customerEmail) {
          await updateSubscriptionInfo(
            customerEmail,
            subscription.status,
            subscriptionType,
            commitmentEndDate ? commitmentEndDate.toISOString() : null
          );
        } else {
          console.warn('⚠️ No email found for customer:', subscription.customer);
        }
      } catch (customerError) {
        console.error('❌ Error retrieving customer for subscription info update:', customerError);
      }
    }
    
  } catch (error) {
    console.error('❌ Error processing subscription update:', error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  console.log('❌ Processing subscription deletion:', subscription.id);
  
  try {
    const userId = subscription.metadata?.user_id;
    
    if (!userId) {
      console.warn('⚠️ No user_id found in subscription metadata');
    }
    
    console.log('Marking subscription as deleted for user:', userId);
    
    // Get product and price info to calculate commitment_end_date
    const price = subscription.items.data[0]?.price;
    const priceId = price?.id;
    const currentDate = new Date(subscription.current_period_start * 1000);
    
    // Determine commitment period based on exact price ID mapping
    let commitmentMonths = null;
    // Nutrition + Training (once/month) plans (using BetterPro price IDs)
    if (priceId === 'price_1Rg5R8HIeYfvCylDJ4Xfg5hr') {
      commitmentMonths = 3; // Nutrition + Training once/month 3-Month Plan
    } else if (priceId === 'price_1Rg5R8HIeYfvCylDxX2PsOrR') {
      commitmentMonths = 6; // Nutrition + Training once/month 6-Month Plan
    }
    // Nutrition Only plans
    else if (priceId === 'price_1Rg5R6HIeYfvCylDcsV3T2Kr') {
      commitmentMonths = 3; // Nutrition Only 3-Month Plan
    } else if (priceId === 'price_1Rg5R6HIeYfvCylDxuQODpK4') {
      commitmentMonths = 6; // Nutrition Only 6-Month Plan
    }
    // Nutrition + Training plans
    else if (priceId === 'price_1Rg5R4HIeYfvCylDAshP6FOk') {
      commitmentMonths = 3; // Nutrition + Training 3-Month Plan
    } else if (priceId === 'price_1Rg5R4HIeYfvCylDy1OT1YJc') {
      commitmentMonths = 6; // Nutrition + Training 6-Month Plan
    }
    // Nutrition Only 2x/month plans
    else if (priceId === 'price_1Rg5QtHIeYfvCylDyXHY5X6G') {
      commitmentMonths = 3; // Nutrition Only 2x/month 3-Month Plan
    } else if (priceId === 'price_1Rg5QtHIeYfvCylDwr9v599a') {
      commitmentMonths = 6; // Nutrition Only 2x/month 6-Month Plan
    }
    
    // Calculate commitment end date (only if there's a commitment period)
    let commitmentEndDate = null;
    if (commitmentMonths) {
      commitmentEndDate = new Date(currentDate);
      commitmentEndDate.setMonth(commitmentEndDate.getMonth() + commitmentMonths);
    }
    
    // Update subscription status to cancelled
    const { error: deleteError } = await clientDB
      .from('stripe_subscriptions')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);
    
    if (deleteError) {
      console.error('❌ Error marking subscription as cancelled:', deleteError);
    } else {
      console.log('✅ Subscription marked as cancelled successfully');

      // Remove from stripe_usage_log so usage-based tracking is cleared
      let uid = subscription.metadata?.user_id;
      if (!uid) {
        const { data: subRow } = await clientDB.from('stripe_subscriptions').select('user_id').eq('stripe_subscription_id', subscription.id).maybeSingle();
        uid = subRow?.user_id;
      }
      if (uid) await removeUserFromStripeUsageLog(uid);

      // Also update clients and chat_users subscription info
      // Get customer email from Stripe
      try {
        const customer = await stripe.customers.retrieve(subscription.customer);
        const customerEmail = customer.email;
        
        if (customerEmail) {
          await updateSubscriptionInfo(
            customerEmail,
            'cancelled',
            null,
            commitmentEndDate ? commitmentEndDate.toISOString() : null
          );
        } else {
          console.warn('⚠️ No email found for customer:', subscription.customer);
        }
      } catch (customerError) {
        console.error('❌ Error retrieving customer for subscription info update:', customerError);
      }
    }
    
  } catch (error) {
    console.error('❌ Error processing subscription deletion:', error);
  }
}

async function handlePaymentSucceeded(invoice) {
  console.log('✅ Processing successful payment:', invoice.id);
  
  try {
    if (invoice.subscription) {
      console.log('Payment for subscription:', invoice.subscription);
      
      // Get subscription details to find user
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const userId = subscription.metadata?.user_id;
      
      if (userId) {
        // Save payment record
        const paymentData = {
          user_id: userId,
          stripe_payment_intent_id: invoice.payment_intent,
          stripe_subscription_id: invoice.subscription,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency?.toUpperCase() || 'USD',
          status: 'succeeded',
          payment_method_type: 'card', // Default since we don't have detailed info
          created_at: new Date(invoice.created * 1000).toISOString()
        };
        
        const { error: paymentError } = await clientDB
          .from('stripe_payments')
          .insert([paymentData]);
        
        if (paymentError) {
          // If foreign key error, try with null user_id
          if (paymentError.code === '23503') {
            console.warn('⚠️ Foreign key constraint error. Retrying payment with null user_id...');
            paymentData.user_id = null;
            const { error: retryError } = await clientDB
              .from('stripe_payments')
              .insert([paymentData]);
            
            if (retryError) {
              console.error('❌ Error saving payment even with null user_id:', retryError);
            } else {
              console.log('✅ Payment record saved successfully (with null user_id)');
            }
          } else {
            console.error('❌ Error saving payment record:', paymentError);
          }
        } else {
          console.log('✅ Payment record saved successfully');
        }
        
        // Update subscription status to active if it was past_due
        const { error: updateError } = await clientDB
          .from('stripe_subscriptions')
          .update({ 
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', invoice.subscription);
        
        if (updateError) {
          console.error('❌ Error updating subscription status:', updateError);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error processing payment success:', error);
  }
}

async function handlePaymentFailed(invoice) {
  console.log('❌ Processing failed payment:', invoice.id);
  
  try {
    if (invoice.subscription) {
      console.log('Failed payment for subscription:', invoice.subscription);
      
      // Get subscription details to find user
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const userId = subscription.metadata?.user_id;
      
      if (userId) {
        // Save failed payment record
        const paymentData = {
          user_id: userId,
          stripe_payment_intent_id: invoice.payment_intent,
          stripe_subscription_id: invoice.subscription,
          amount: invoice.amount_due / 100,
          currency: invoice.currency?.toUpperCase() || 'USD',
          status: 'failed',
          payment_method_type: 'card',
          created_at: new Date(invoice.created * 1000).toISOString()
        };
        
        const { error: paymentError } = await clientDB
          .from('stripe_payments')
          .insert([paymentData]);
        
        if (paymentError) {
          // If foreign key error, try with null user_id
          if (paymentError.code === '23503') {
            console.warn('⚠️ Foreign key constraint error. Retrying failed payment with null user_id...');
            paymentData.user_id = null;
            const { error: retryError } = await clientDB
              .from('stripe_payments')
              .insert([paymentData]);
            
            if (retryError) {
              console.error('❌ Error saving failed payment even with null user_id:', retryError);
            } else {
              console.log('✅ Failed payment record saved (with null user_id)');
            }
          } else {
            console.error('❌ Error saving failed payment record:', paymentError);
          }
        } else {
          console.log('✅ Failed payment record saved');
        }
        
        // Update subscription status to past_due
        const { error: updateError } = await clientDB
          .from('stripe_subscriptions')
          .update({ 
            status: 'past_due',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', invoice.subscription);
        
        if (updateError) {
          console.error('❌ Error updating subscription to past_due:', updateError);
        } else {
          console.log('✅ Subscription marked as past_due');
        }
      }
    }
  } catch (error) {
    console.error('❌ Error processing payment failure:', error);
  }
}

// ====================================
// USER API ENDPOINTS
// ====================================

// Get user_code by email
app.get('/api/user/user-code', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    console.log('🔍 Fetching user_code for email:', email);

    const { data: clientData, error } = await clientDB
      .from('clients')
      .select('user_code')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.json({ data: null });
      }
      console.error('❌ Error fetching user_code:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch user_code',
        message: error.message 
      });
    }

    res.json({ data: clientData });
  } catch (error) {
    console.error('❌ Error in user/user-code endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Get user language preference by user_id
app.get('/api/user/language', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    console.log('🌐 Fetching user language for user_id:', user_id);

    const { data: clientData, error: clientError } = await clientDB
      .from('clients')
      .select('user_language')
      .eq('user_id', user_id)
      .single();

    if (clientError) {
      if (clientError.code === 'PGRST116') {
        // No rows returned - return null
        return res.json({ data: null });
      }
      console.error('❌ Error fetching user language:', clientError);
      return res.status(500).json({ 
        error: 'Failed to fetch user language',
        message: clientError.message 
      });
    }

    res.json({ data: clientData });
  } catch (error) {
    console.error('❌ Error in user/language endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Get user settings by user_code
app.get('/api/user/settings', async (req, res) => {
  try {
    const { user_code } = req.query;

    if (!user_code) {
      return res.status(400).json({ error: 'user_code is required' });
    }

    console.log('⚙️ Fetching settings for user_code:', user_code);

    const { data, error } = await clientDB
      .from('clients')
      .select('show_calories, show_macros, portion_display, measurement_system, weight_unit, decimal_places')
      .eq('user_code', user_code)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.json({ data: null });
      }
      console.error('❌ Error fetching settings:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch settings',
        message: error.message 
      });
    }

    res.json({ data });
  } catch (error) {
    console.error('❌ Error in user/settings endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Update user settings
app.post('/api/user/settings', async (req, res) => {
  try {
    const { user_code, settings } = req.body;

    if (!user_code) {
      return res.status(400).json({ error: 'user_code is required' });
    }

    if (!settings) {
      return res.status(400).json({ error: 'settings is required' });
    }

    console.log('💾 Updating settings for user_code:', user_code);

    const { error } = await clientDB
      .from('clients')
      .update(settings)
      .eq('user_code', user_code);

    if (error) {
      console.error('❌ Error updating settings:', error);
      return res.status(500).json({ 
        error: 'Failed to update settings',
        message: error.message 
      });
    }

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('❌ Error in user/settings update endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// ====================================
// ONBOARDING API ENDPOINTS
// ====================================

// Get client data by user_id
app.get('/api/onboarding/client-data', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    console.log('📋 Fetching client data for user_id:', user_id);

    const { data, error } = await clientDB
      .from('clients')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - not an error, just no data
        return res.json({ data: null });
      }
      console.error('❌ Error fetching client data:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch client data',
        message: error.message 
      });
    }

    res.json({ data });
  } catch (error) {
    console.error('❌ Error in onboarding/client-data endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Get chat user meal data by user_code
app.get('/api/onboarding/chat-user-meal-data', async (req, res) => {
  try {
    const { user_code } = req.query;

    if (!user_code) {
      return res.status(400).json({ error: 'user_code is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    console.log('📋 Fetching chat user meal data for user_code:', user_code);

    const { data: chatData, error: chatError } = await adminDB
      .from('chat_users')
      .select('number_of_meals, meal_plan_structure, first_meal_time, last_meal_time, client_preference')
      .eq('user_code', user_code)
      .single();

    if (chatError) {
      if (chatError.code === 'PGRST116') {
        // No rows returned - not an error, just no data
        return res.json({ data: null });
      }
      console.error('❌ Error fetching chat user meal data:', chatError);
      return res.status(500).json({ 
        error: 'Failed to fetch chat user meal data',
        message: chatError.message 
      });
    }

    res.json({ data: chatData });
  } catch (error) {
    console.error('❌ Error in onboarding/chat-user-meal-data endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Check if phone number exists
// City search powered by GeoNames cities500 table living in adminDB.
// Returns a few candidates ordered by population so big cities win.
// Hebrew/local names are matched via the comma-separated `alternatenames` column.
app.get('/api/cities/search', async (req, res) => {
  try {
    if (!adminDB) {
      return res.status(503).json({
        error: 'City search is unavailable',
        message: 'adminDB is not configured on this server (CHAT_SUPABASE_URL / CHAT_SUPABASE_SERVICE_ROLE_KEY missing)'
      });
    }

    const rawQ = (req.query.q || '').toString().trim();
    if (rawQ.length < 1) {
      return res.json({ data: [] });
    }

    // PostgREST's .or() uses commas/parens as separators, so strip them from the user input
    // before interpolating; this is purely a filter sanitizer, the value is still going through
    // Supabase's parameterized .ilike() once parsed.
    const safe = rawQ.replace(/[,()*]/g, '').trim();
    if (safe.length < 1) {
      return res.json({ data: [] });
    }

    const limitParam = parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 10, 1), 25);

    const country = (req.query.country || '').toString().trim();
    const countryCodes = country
      ? country.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
      : [];

    // Prefix match on canonical/ascii name + substring match on alternate names
    // (alternatenames is a comma-joined blob containing localized & historical names).
    const orFilter = [
      `name.ilike.${safe}%`,
      `asciiname.ilike.${safe}%`,
      `alternatenames.ilike.%${safe}%`
    ].join(',');

    let query = adminDB
      .from('cities500')
      .select('geonameid, name, asciiname, alternatenames, country_code, latitude, longitude, timezone, population')
      .or(orFilter)
      .order('population', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (countryCodes.length === 1) {
      query = query.eq('country_code', countryCodes[0]);
    } else if (countryCodes.length > 1) {
      query = query.in('country_code', countryCodes);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ cities500 search error:', error);
      return res.status(500).json({ error: 'Failed to search cities', message: error.message });
    }

    res.json({ data: data || [] });
  } catch (error) {
    console.error('❌ cities/search endpoint exception:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

app.post('/api/onboarding/check-phone', async (req, res) => {
  try {
    const { phone, user_id, user_code } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'phone is required' });
    }

    console.log('📞 Checking phone existence:', phone);

    // Check in clients table
    const { data: clientData, error: clientError } = await clientDB
      .from('clients')
      .select('phone, user_id')
      .eq('phone', phone)
      .maybeSingle();

    // If found and it's not the current user's phone, it exists
    if (clientData && clientData.user_id !== user_id) {
      return res.json({ exists: true, table: 'clients' });
    }

    // Check in chat_users table (if secondary DB is available)
    if (adminDB) {
      // Check phone_number column
      const { data: chatUserDataByPhone } = await adminDB
        .from('chat_users')
        .select('phone_number, whatsapp_number, user_code')
        .eq('phone_number', phone)
        .maybeSingle();

      // Check whatsapp_number column
      const { data: chatUserDataByWhatsApp } = await adminDB
        .from('chat_users')
        .select('phone_number, whatsapp_number, user_code')
        .eq('whatsapp_number', phone)
        .maybeSingle();

      const chatUserData = chatUserDataByPhone || chatUserDataByWhatsApp;

      // If found and it's not the current user's phone (check by user_code if available)
      if (chatUserData) {
        // If we have userCode, check if it matches
        if (user_code && chatUserData.user_code === user_code) {
          // It's the same user, so it's okay
          return res.json({ exists: false });
        } else if (!user_code || chatUserData.user_code !== user_code) {
          // Different user has this phone number
          return res.json({ exists: true, table: 'chat_users' });
        }
      }
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('❌ Error in onboarding/check-phone endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Update client data
app.post('/api/onboarding/update-client', async (req, res) => {
  try {
    const { user_id, clientData } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    if (!clientData) {
      return res.status(400).json({ error: 'clientData is required' });
    }

    console.log('💾 Updating client data for user_id:', user_id);

    const { data: updateData, error: profileError } = await clientDB
      .from('clients')
      .update(clientData)
      .eq('user_id', user_id)
      .select();

    if (profileError) {
      console.error('❌ Error updating client:', profileError);
      return res.status(500).json({ 
        error: 'Failed to update client',
        message: profileError.message 
      });
    }

    res.json({ data: updateData });
  } catch (error) {
    console.error('❌ Error in onboarding/update-client endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Update chat user data
app.post('/api/onboarding/update-chat-user', async (req, res) => {
  try {
    const { user_code, chatUserData } = req.body;

    if (!user_code) {
      return res.status(400).json({ error: 'user_code is required' });
    }

    if (!chatUserData) {
      return res.status(400).json({ error: 'chatUserData is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    console.log('💾 Updating chat user data for user_code:', user_code);

    // Find chat user by user_code
    const { data: chatUser, error: chatUserError } = await adminDB
      .from('chat_users')
      .select('id')
      .eq('user_code', user_code)
      .single();

    if (chatUserError || !chatUser) {
      console.error('❌ Chat user not found:', chatUserError);
      return res.status(404).json({ 
        error: 'Chat user not found',
        message: chatUserError?.message 
      });
    }

    // Update chat user
    const { error: chatUpdateError } = await adminDB
      .from('chat_users')
      .update(chatUserData)
      .eq('id', chatUser.id);

    if (chatUpdateError) {
      console.error('❌ Error updating chat user:', chatUpdateError);
      return res.status(500).json({ 
        error: 'Failed to update chat user',
        message: chatUpdateError.message 
      });
    }

    res.json({ success: true, message: 'Chat user updated successfully' });
  } catch (error) {
    console.error('❌ Error in onboarding/update-chat-user endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Start async meal plan generation for onboarding without blocking checkout redirect
app.post('/api/onboarding/start-async-meal-plan', async (req, res) => {
  try {
    const { user_id, user_code } = req.body || {};
    if (!user_id && !user_code) {
      return res.status(400).json({ error: 'user_id or user_code is required' });
    }

    console.log('🚀 Queuing async onboarding meal plan generation', { user_id, user_code });

    // Return immediately so frontend can continue to Stripe checkout.
    setImmediate(() => {
      createAndSaveOnboardingMealPlanForUser(user_id || null, user_code || null).catch((err) => {
        console.warn('⚠️ Async onboarding meal plan task failed:', err?.message || err);
      });
    });

    res.json({ queued: true });
  } catch (error) {
    console.error('❌ Error in onboarding/start-async-meal-plan endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// AI-powered activity level classification from open-text description
app.post('/api/onboarding/classify-activity', async (req, res) => {
  try {
    const { activityDescription } = req.body;
    if (!activityDescription || !activityDescription.trim()) {
      return res.status(400).json({ error: 'activityDescription is required' });
    }

    const apiBase = (process.env.AZURE_OPENAI_API_BASE || '').replace(/\/$/, '');
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

    if (!apiBase || !apiKey || !deployment) {
      return res.status(500).json({ error: 'Azure OpenAI is not configured on the server' });
    }

    const url = `${apiBase}/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`;

    const systemPrompt = `You are an expert fitness and nutrition routing AI. Your exact task is to analyze a user's open-text description of their daily physical activity, job, and lifestyle, and accurately assign them the correct Harris-Benedict Activity Level.

Use the following strict classifications:
- "sedentary": Little to no intentional exercise. Desk jobs, mostly sitting or lying down. (Equivalent to 1.2)
- "light": Light exercise or sports 1-3 days a week. E.g., casual walking, easy yoga, or a job that requires occasional standing/walking. (Equivalent to 1.375)
- "moderate": Moderate exercise or sports 3-5 days a week. E.g., consistent gym-going, jogging, or a job that requires being on their feet most of the day (e.g., nurse, server). (Equivalent to 1.55)
- "very": Hard exercise or sports 6-7 days a week. High-intensity training, competitive sports, or heavy labor jobs (e.g., construction). (Equivalent to 1.725)
- "extra": Very hard exercise, physical job AND daily training, or 2x a day training. Professional athletes, military in training, etc. (Equivalent to 1.9)

Analyze the input carefully. Look for frequency (days/week), intensity (casual vs. hard), and occupational movement. If a user's description falls between two categories, default to the lower category to prevent overestimating caloric burn.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `User Input:\n"${activityDescription.trim()}"` }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'activity_classification',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                activity_factor: {
                  type: 'string',
                  enum: ['sedentary', 'light', 'moderate', 'very', 'extra']
                },
                reasoning: {
                  type: 'string',
                  description: 'A one-sentence explanation justifying the classification based on the user\'s text.'
                }
              },
              required: ['activity_factor', 'reasoning'],
              additionalProperties: false
            }
          }
        },
        max_tokens: 200
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ Azure OpenAI classify-activity error:', errText);
      return res.status(502).json({ error: 'AI classification failed', details: errText });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({ error: 'Empty response from AI' });
    }

    const parsed = JSON.parse(content);
    console.log(`✅ Activity classified as "${parsed.activity_factor}": ${parsed.reasoning}`);
    return res.json({ activity_factor: parsed.activity_factor, reasoning: parsed.reasoning });
  } catch (error) {
    console.error('❌ Error in classify-activity:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// ====================================
// WHATSAPP API ROUTES
// ====================================

// Send WhatsApp welcome message
app.post('/api/whatsapp/send-welcome-message', async (req, res) => {
  try {
    const { phone, language } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Get WhatsApp token from environment variable
    const waToken = process.env.WA_TOKEN || process.env.WHATSAPP_TOKEN;
    
    if (!waToken) {
      console.error('❌ WhatsApp token not configured');
      return res.status(500).json({ 
        error: 'WhatsApp service not configured',
        message: 'WA_TOKEN environment variable is missing' 
      });
    }

    // Determine template name and language code based on user's language
    let templateName = 'welcome_message_paid_clients';
    let languageCode = 'en';
    
    if (language === 'he' || language === 'hebrew') {
      templateName = 'welcome_message_paid_clients_hebrew';
      languageCode = 'he';
    }

    // Facebook Graph API endpoint
    const url = 'https://graph.facebook.com/v22.0/656545780873051/messages';

    // Prepare request body
    const body = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode }
      }
    };

    console.log('📱 Sending WhatsApp welcome message:', {
      to: phone,
      template: templateName,
      language: languageCode
    });

    // Send request to Facebook Graph API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${waToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('❌ WhatsApp API error:', responseData);
      return res.status(response.status).json({ 
        error: 'Failed to send WhatsApp message',
        message: responseData.error?.message || 'Unknown error',
        details: responseData
      });
    }

    console.log('✅ WhatsApp welcome message sent successfully:', responseData);
    
    res.json({ 
      success: true, 
      message: 'WhatsApp message sent successfully',
      data: responseData
    });
  } catch (error) {
    console.error('❌ Error in WhatsApp send-welcome-message endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Shared: send WhatsApp welcome by user_id. Returns { success } or { success: false, status?, message? }.
async function sendWhatsAppWelcomeByUserId(userId) {
  const { data: client, error } = await clientDB
    .from('clients')
    .select('phone, user_language')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('❌ Error fetching client for WhatsApp:', error);
    return { success: false, status: 500, message: 'Failed to fetch client' };
  }
  if (!client || !client.phone) {
    console.log('📱 sendWhatsAppWelcomeByUserId: no client or phone for user_id:', userId);
    return { success: false, message: 'No client or phone found' };
  }

  const phone = client.phone;
  const language = client.user_language || 'en';
  console.log('📱 sendWhatsAppWelcomeByUserId: attempting to send to number:', phone, 'user_id:', userId);
  const waToken = process.env.WA_TOKEN || process.env.WHATSAPP_TOKEN;
  if (!waToken) {
    console.error('❌ WhatsApp token not configured');
    return { success: false, status: 500, message: 'WhatsApp service not configured' };
  }

  let templateName = 'welcome_message_paid_clients';
  let languageCode = 'en';
  if (language === 'he' || language === 'hebrew') {
    templateName = 'welcome_message_paid_clients_hebrew';
    languageCode = 'he';
  }

  const url = 'https://graph.facebook.com/v22.0/656545780873051/messages';

  // 1) Send welcome message
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${waToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: { name: templateName, language: { code: languageCode } }
    })
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('❌ WhatsApp welcome failed — to:', phone, 'user_id:', userId, 'API error:', data);
    return { success: false, status: res.status, message: data?.error?.message || 'Failed to send' };
  }
  const welcomeMessageId = data?.messages?.[0]?.id;
  console.log('✅ WhatsApp welcome actually sent — to:', phone, 'user_id:', userId, 'message_id:', welcomeMessageId || '(none)');

  // 2) Send pin-the-chat message (same language)
  const pinTemplateName = languageCode === 'he' ? 'pin_the_chat_hebrew' : 'pin_the_chat';
  const resPin = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${waToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: { name: pinTemplateName, language: { code: languageCode } }
    })
  });
  const dataPin = await resPin.json();
  if (!resPin.ok) {
    console.error('❌ WhatsApp pin-the-chat failed — to:', phone, 'user_id:', userId, 'API error:', dataPin);
    // Welcome was sent; still return success but log the pin failure
  } else {
    console.log('✅ WhatsApp pin-the-chat sent — to:', phone, 'user_id:', userId);
  }

  console.log('✅ WhatsApp welcome flow complete — message sent to number:', phone, 'user_id:', userId);
  return { success: true };
}

// Send WhatsApp welcome message by user_id (used after onboarding upsell checkout)
app.post('/api/whatsapp/send-welcome-by-user-id', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });
    console.log('📱 send-welcome-by-user-id called for user_id:', user_id);
    const r = await sendWhatsAppWelcomeByUserId(user_id);
    if (r.success) return res.json({ success: true, message: 'WhatsApp message sent successfully' });
    if (r.status === 500) return res.status(500).json({ error: r.message, success: false });
    return res.json({ success: false, message: r.message });
  } catch (error) {
    console.error('❌ Error in send-welcome-by-user-id:', error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ====================================
// PROFILE PAGE API ROUTES
// ====================================

// Get active client meal plan
app.get('/api/profile/meal-plan', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    const { data, error } = await clientDB
      .from('client_meal_plans')
      .select('*')
      .eq('user_code', userCode)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Return array of meal plans (can be empty array if none found)
    res.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching client meal plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update client meal plan (clear old edited plan)
app.post('/api/profile/meal-plan/clear-edited', async (req, res) => {
  try {
    const { planId, selectedDay } = req.body;
    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    const { data: planData, error: planFetchError } = await clientDB
      .from('client_meal_plans')
      .select('id, user_code, meal_plan_name')
      .eq('id', planId)
      .single();

    if (planFetchError || !planData) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const { error } = await clientDB
      .from('client_meal_plans')
      .update({
        client_edited_meal_plan: null,
        edited_plan_date: null,
      })
      .eq('id', planId);

    if (error) throw error;

    if (adminDB) {
      const now = new Date().toISOString();
      const selectedDayNumber = Number.isInteger(selectedDay) ? selectedDay : Number(selectedDay);

      const { data: activePlans, error: activePlansError } = await adminDB
        .from('meal_plans_and_schemas')
        .select('id, active_days, created_at')
        .eq('user_code', planData.user_code)
        .eq('record_type', 'meal_plan')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (activePlansError) throw activePlansError;

      const latestActivePlan = Array.isArray(activePlans) && activePlans.length > 0 ? activePlans[0] : null;
      const planToDelete = Array.isArray(activePlans)
        ? activePlans.find((plan) => {
            if (!Number.isInteger(selectedDayNumber) || selectedDayNumber < 0 || selectedDayNumber > 6) {
              return false;
            }
            if (!Array.isArray(plan.active_days) || plan.active_days.length === 0) {
              return true;
            }
            return plan.active_days.includes(selectedDayNumber);
          }) || latestActivePlan
        : null;

      if (planToDelete?.id) {
        const { error: deleteError } = await adminDB
          .from('meal_plans_and_schemas')
          .delete()
          .eq('id', planToDelete.id);

        if (deleteError) throw deleteError;
      }

      const { data: previousPlan, error: previousPlanError } = await adminDB
        .from('meal_plans_and_schemas')
        .select('id')
        .eq('user_code', planData.user_code)
        .eq('record_type', 'meal_plan')
        .eq('meal_plan_name', planData.meal_plan_name)
        .neq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previousPlanError) throw previousPlanError;

      if (previousPlan?.id) {
        const { error: activateError } = await adminDB
          .from('meal_plans_and_schemas')
          .update({
            status: 'active',
            active_from: now,
            active_until: null,
            updated_at: now
          })
          .eq('id', previousPlan.id);

        if (activateError) throw activateError;
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing edited meal plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update client meal plan (save edited plan)
app.post('/api/profile/meal-plan/save-edited', async (req, res) => {
  try {
    const { planId, mealPlan, userCode } = req.body;
    if (!planId || !mealPlan) {
      return res.status(400).json({ error: 'Plan ID and meal plan data are required' });
    }

    const today = new Date().toISOString();
    
    // 1. Update client_meal_plans table
    const { data: planData, error: planError } = await clientDB
      .from('client_meal_plans')
      .select('user_code, dietitian_meal_plan, client_edited_meal_plan')
      .eq('id', planId)
      .single();

    if (planError) throw planError;

    const { error: clientMealPlanError } = await clientDB
      .from('client_meal_plans')
      .update({
        client_edited_meal_plan: mealPlan,
        edited_plan_date: today,
      })
      .eq('id', planId);

    if (clientMealPlanError) throw clientMealPlanError;

    // 2. Update meal_plans_and_schemas table
    if (adminDB && planData) {
      const userCodeToUse = userCode || planData.user_code;
      
      // Find the meal plan in meal_plans_and_schemas
      const { data: schemaPlan, error: schemaFindError } = await adminDB
        .from('meal_plans_and_schemas')
        .select('id, dietitian_meal_plan, client_edited_meal_plan')
        .eq('user_code', userCodeToUse)
        .eq('record_type', 'meal_plan')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!schemaFindError && schemaPlan) {
        // Determine which field to update (dietitian_meal_plan or client_edited_meal_plan)
        const updateField = schemaPlan.client_edited_meal_plan ? 'client_edited_meal_plan' : 'dietitian_meal_plan';
        
        const { error: schemaUpdateError } = await adminDB
          .from('meal_plans_and_schemas')
          .update({
            [updateField]: mealPlan,
            updated_at: today
          })
          .eq('id', schemaPlan.id);

        if (schemaUpdateError) {
          console.error('Error updating meal_plans_and_schemas:', schemaUpdateError);
        }
      }
    }

    // 3. Update chat_users table
    if (adminDB && planData) {
      const userCodeToUse = userCode || planData.user_code;
      
      const { data: chatUser, error: chatUserFindError } = await adminDB
        .from('chat_users')
        .select('id, meal_plan')
        .eq('user_code', userCodeToUse)
        .maybeSingle();

      if (!chatUserFindError && chatUser) {
        // Update meal_plan column in chat_users
        const { error: chatUserUpdateError } = await adminDB
          .from('chat_users')
          .update({
            meal_plan: mealPlan,
            updated_at: today
          })
          .eq('id', chatUser.id);

        if (chatUserUpdateError) {
          console.error('Error updating chat_users meal_plan:', chatUserUpdateError);
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving edited meal plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI update client meal plan from open request
app.post('/api/profile/meal-plan/ai-update', async (req, res) => {
  try {
    const { planId, userCode, requestText, selectedDay, overwriteEditedPlan = false } = req.body;
    if (!planId || !requestText || !String(requestText).trim()) {
      return res.status(400).json({ error: 'planId and requestText are required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data: planData, error: planError } = await clientDB
      .from('client_meal_plans')
      .select('id, user_code, meal_plan_name, dietitian_id, daily_total_calories, macros_target, active_days, dietitian_meal_plan, client_edited_meal_plan, ai_plan_change_used, ai_plan_change_used_at')
      .eq('id', planId)
      .single();

    if (planError || !planData) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }

    if (planData.ai_plan_change_used) {
      return res.status(403).json({
        error: 'AI meal plan change already used',
        code: 'AI_MEAL_PLAN_CHANGE_LIMIT_REACHED',
        usedAt: planData.ai_plan_change_used_at || null
      });
    }

    if (planData.client_edited_meal_plan && !overwriteEditedPlan) {
      return res.status(409).json({
        error: 'Existing edited meal plan will be overwritten',
        requiresConfirmation: true
      });
    }

    const resolvedUserCode = userCode || planData.user_code;
    const baseMealPlan = planData.client_edited_meal_plan || planData.dietitian_meal_plan;
    if (!baseMealPlan) {
      return res.status(400).json({ error: 'No base meal plan found to update' });
    }

    const [{ data: clientProfile }, { data: chatProfile }] = await Promise.all([
      clientDB
        .from('clients')
        .select('food_allergies, dietary_preferences, medical_conditions, food_limitations, first_name, last_name, full_name')
        .eq('user_code', resolvedUserCode)
        .maybeSingle(),
      adminDB
        .from('chat_users')
        .select('food_allergies, recommendations, food_limitations, medical_conditions, nursing_status, client_preference, language, user_language, full_name')
        .eq('user_code', resolvedUserCode)
        .maybeSingle()
    ]);

    const userProfileObj = {
      full_name: clientProfile?.full_name || chatProfile?.full_name || `${clientProfile?.first_name || ''} ${clientProfile?.last_name || ''}`.trim(),
      diet: clientProfile?.dietary_preferences || null,
      allergies: clientProfile?.food_allergies || chatProfile?.food_allergies || [],
      limitations: clientProfile?.food_limitations || null,
      medical_conditions: clientProfile?.medical_conditions || chatProfile?.medical_conditions || null,
      recommendations: chatProfile?.recommendations || null,
      chat_food_limitations: chatProfile?.food_limitations || null,
      nursing_status: chatProfile?.nursing_status || null,
      preferences: chatProfile?.client_preference || null,
      language: chatProfile?.user_language || chatProfile?.language || 'english'
    };

    const updatedMealPlan = await generateUpdatedMealPlan(
      JSON.stringify(baseMealPlan),
      String(requestText).trim(),
      userProfileObj
    );

    const now = new Date().toISOString();

    const { error: saveMainError } = await clientDB
      .from('client_meal_plans')
      .update({
        client_edited_meal_plan: updatedMealPlan,
        edited_plan_date: now,
        ai_plan_change_used: true,
        ai_plan_change_used_at: now,
        updated_at: now
      })
      .eq('id', planId);

    if (saveMainError) throw saveMainError;

    const { data: activePlans, error: activePlanError } = await adminDB
      .from('meal_plans_and_schemas')
      .select('id, schema, active_days')
      .eq('user_code', resolvedUserCode)
      .eq('record_type', 'meal_plan')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (activePlanError) {
      console.error('Error fetching active meal plan:', activePlanError);
    }

    const latestActivePlan = Array.isArray(activePlans) && activePlans.length > 0 ? activePlans[0] : null;
    const selectedDayNumber = Number.isInteger(selectedDay) ? selectedDay : Number(selectedDay);
    const planToExpire = Array.isArray(activePlans)
      ? activePlans.find((plan) => {
          if (!Number.isInteger(selectedDayNumber) || selectedDayNumber < 0 || selectedDayNumber > 6) {
            return false;
          }
          if (!Array.isArray(plan.active_days) || plan.active_days.length === 0) {
            return true; // daily/all-days plan
          }
          return plan.active_days.includes(selectedDayNumber);
        }) || latestActivePlan
      : null;

    if (planToExpire?.id) {
      const { error: deactivateError } = await adminDB
        .from('meal_plans_and_schemas')
        .update({
          status: 'expired',
          active_until: now,
          updated_at: now
        })
        .eq('id', planToExpire.id);

      if (deactivateError) throw deactivateError;
    }

    const newMealPlanId = randomUUID();
    const { error: createActiveError } = await adminDB
      .from('meal_plans_and_schemas')
      .insert({
        id: newMealPlanId,
        record_type: 'meal_plan',
        dietitian_id: planData.dietitian_id || null,
        user_code: resolvedUserCode,
        meal_plan_name: planData.meal_plan_name || 'Updated Meal Plan',
        schema: latestActivePlan?.schema || null,
        meal_plan: updatedMealPlan,
        status: 'active',
        active_from: now,
        active_days: planData.active_days || null,
        daily_total_calories: planData.daily_total_calories || null,
        macros_target: planData.macros_target || null,
        created_at: now,
        updated_at: now
      });

    if (createActiveError) throw createActiveError;

    res.json({ success: true, mealPlan: updatedMealPlan });
  } catch (error) {
    console.error('Error updating meal plan with AI:', error);
    res.status(500).json({ error: error.message || 'Failed to update meal plan with AI' });
  }
});

// Get client data for onboarding check
app.get('/api/profile/client', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const { data, error } = await clientDB
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({ data });
  } catch (error) {
    console.error('Error fetching client data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Load profile data from clients table
app.get('/api/profile/load', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const { data, error } = await clientDB
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({ data });
  } catch (error) {
    console.error('Error loading profile data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Load chat_users data
app.get('/api/profile/chat-user', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await adminDB
      .from('chat_users')
      .select('medical_conditions, client_preference, food_allergies, full_name, email, phone_number, region, city, timezone, age, gender, date_of_birth, language, subscription_status, subscription_type, subscription_expires_at, is_blocked, user_code, Activity_level, base_daily_total_calories, daily_target_total_calories, macros, height_cm, weight_kg')
      .eq('user_code', userCode)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({ data });
  } catch (error) {
    console.error('Error loading chat_users data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Load ALL chat_users columns for the authenticated client (identified by Bearer token).
// The apiAuthGuard middleware validates the JWT and populates req.userCode from the
// linked clients row, so no query/body params are needed.
app.get('/api/profile/chat-user/me', async (req, res) => {
  try {
    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const userCode = req.userCode;
    if (!userCode) {
      return res.status(404).json({ error: 'No user_code linked to this account' });
    }

    const { data, error } = await adminDB
      .from('chat_users')
      .select('*')
      .eq('user_code', userCode)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: 'Chat user not found' });
    }

    res.json({ data });
  } catch (error) {
    console.error('Error loading full chat_users row:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to parse time string to float (hour + minute/60)
function parseTimeToFloat(timeValue) {
  if (typeof timeValue === 'number') {
    return timeValue;
  }
  
  if (typeof timeValue === 'string') {
    // Try parsing as HH:MM format
    const parts = timeValue.split(':');
    if (parts.length === 2) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      if (!isNaN(hours) && !isNaN(minutes)) {
        return hours + (minutes / 60);
      }
    }
    // Try parsing as float string
    const floatValue = parseFloat(timeValue);
    if (!isNaN(floatValue)) {
      return floatValue;
    }
  }
  
  return 7.0; // Default fallback
}

// Get user meal window
app.get('/api/profile/meal-window', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await adminDB
      .from('chat_users')
      .select('first_meal_time, last_meal_time')
      .eq('user_code', userCode)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Parse times - they might be stored as strings (HH:MM) or already as floats
    let wakeTime = 7.0; // Default 7am
    let sleepTime = 23.0; // Default 11pm

    if (data) {
      if (data.first_meal_time) {
        wakeTime = parseTimeToFloat(data.first_meal_time);
      }
      if (data.last_meal_time) {
        sleepTime = parseTimeToFloat(data.last_meal_time);
      }
    }

    res.json({ data: { first_meal_time: wakeTime, last_meal_time: sleepTime } });
  } catch (error) {
    console.error('Error loading meal window:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save profile data
app.post('/api/profile/save', async (req, res) => {
  try {
    const { userId, profileData } = req.body;
    if (!userId || !profileData) {
      return res.status(400).json({ error: 'User ID and profile data are required' });
    }

    // Check if record exists
    const { data: existingData, error: checkError } = await clientDB
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    let result;
    if (!existingData) {
      // Insert new record
      result = await clientDB
        .from('clients')
        .insert(profileData)
        .select();
    } else {
      // Update existing record
      result = await clientDB
        .from('clients')
        .update(profileData)
        .eq('user_id', userId)
        .select();
    }

    const { data, error } = result;
    if (error) throw error;

    res.json({ data });
  } catch (error) {
    console.error('Error saving profile data:', error);
    res.status(500).json({ error: error.message, code: error.code });
  }
});

// Sync profile data to chat_users
app.post('/api/profile/sync-chat-user', async (req, res) => {
  try {
    const { userCode, chatUserData } = req.body;
    if (!userCode || !chatUserData) {
      return res.status(400).json({ error: 'User code and chat user data are required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    // Get chat_users id
    const { data: chatUser, error: chatUserError } = await adminDB
      .from('chat_users')
      .select('id')
      .eq('user_code', userCode)
      .maybeSingle();

    if (chatUserError) throw chatUserError;
    if (!chatUser) {
      return res.status(404).json({ error: 'Chat user not found' });
    }

    // Update chat_users
    const { error } = await adminDB
      .from('chat_users')
      .update(chatUserData)
      .eq('id', chatUser.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error syncing to chat_users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save nutritional profile to chat_users
// Accepts: daily_target_total_calories, base_daily_total_calories, macros, height_cm, Activity_level
app.post('/api/profile/save-nutritional', async (req, res) => {
  try {
    const { userCode, daily_target_total_calories, base_daily_total_calories, macros, height_cm, Activity_level } = req.body;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const updatePayload = {};
    if (daily_target_total_calories !== undefined && daily_target_total_calories !== null) {
      updatePayload.daily_target_total_calories = Number(daily_target_total_calories);
    }
    if (base_daily_total_calories !== undefined && base_daily_total_calories !== null) {
      updatePayload.base_daily_total_calories = Number(base_daily_total_calories);
    }
    if (macros !== undefined && macros !== null) {
      updatePayload.macros = macros;
    }
    if (height_cm !== undefined && height_cm !== null && height_cm !== '') {
      const parsed = parseFloat(height_cm);
      if (!Number.isNaN(parsed)) updatePayload.height_cm = parsed;
    }
    if (Activity_level !== undefined && Activity_level !== null && Activity_level !== '') {
      updatePayload.Activity_level = Activity_level;
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ error: 'No data to update' });
    }

    const { error } = await adminDB
      .from('chat_users')
      .update(updatePayload)
      .eq('user_code', userCode);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving nutritional profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save personal info (location fields: region, city, timezone) to clients + chat_users
app.post('/api/profile/save-personal', async (req, res) => {
  try {
    const { userId, userCode, region, city, timezone } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const clientPayload = {};
    if (region !== undefined) clientPayload.region = region || null;
    if (city !== undefined) clientPayload.city = city || null;
    if (timezone !== undefined) clientPayload.timezone = timezone || null;

    if (Object.keys(clientPayload).length === 0) {
      return res.status(400).json({ error: 'No data to update' });
    }

    // Update clients table
    const { error: clientError } = await clientDB
      .from('clients')
      .update(clientPayload)
      .eq('user_id', userId);

    if (clientError) throw clientError;

    // Sync to chat_users if userCode provided
    if (userCode && adminDB) {
      const chatPayload = {};
      if (region !== undefined) chatPayload.region = region || null;
      if (city !== undefined) chatPayload.city = city || null;
      if (timezone !== undefined) chatPayload.timezone = timezone || null;

      const { error: chatError } = await adminDB
        .from('chat_users')
        .update(chatPayload)
        .eq('user_code', userCode);

      if (chatError) console.error('Error syncing personal info to chat_users:', chatError);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving personal info:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save health info to clients + chat_users
app.post('/api/profile/save-health', async (req, res) => {
  try {
    const { userId, userCode, dietaryPreferences, foodAllergies, foodLimitations, medicalConditions } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const clientPayload = {};
    if (dietaryPreferences !== undefined) clientPayload.dietary_preferences = dietaryPreferences || null;
    if (foodAllergies !== undefined) clientPayload.food_allergies = foodAllergies || null;
    if (foodLimitations !== undefined) clientPayload.food_limitations = foodLimitations || null;
    if (medicalConditions !== undefined) clientPayload.medical_conditions = medicalConditions || null;

    if (Object.keys(clientPayload).length === 0) {
      return res.status(400).json({ error: 'No data to update' });
    }

    // Update clients table
    const { error: clientError } = await clientDB
      .from('clients')
      .update(clientPayload)
      .eq('user_id', userId);

    if (clientError) throw clientError;

    // Sync to chat_users if userCode provided
    if (userCode && adminDB) {
      const chatPayload = {};
      if (dietaryPreferences !== undefined) chatPayload.client_preference = dietaryPreferences || null;
      if (foodAllergies !== undefined) chatPayload.food_allergies = foodAllergies || null;
      if (foodLimitations !== undefined) chatPayload.food_limitations = foodLimitations || null;
      if (medicalConditions !== undefined) chatPayload.medical_conditions = medicalConditions || null;

      const { error: chatError } = await adminDB
        .from('chat_users')
        .update(chatPayload)
        .eq('user_code', userCode);

      if (chatError) console.error('Error syncing health info to chat_users:', chatError);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving health info:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save profile image URL
app.post('/api/profile/save-image-url', async (req, res) => {
  try {
    const { userId, imageUrl } = req.body;
    if (!userId || !imageUrl) {
      return res.status(400).json({ error: 'User ID and image URL are required' });
    }

    // Check if record exists
    const { data: existingData, error: checkError } = await clientDB
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingData) {
      // Insert new record with minimal data
      const { error: insertError } = await clientDB
        .from('clients')
        .insert({
          user_id: userId,
          profile_image_url: imageUrl,
          updated_at: new Date().toISOString()
        });

      if (insertError) throw insertError;
    } else {
      // Update existing record
      const { error: updateError } = await clientDB
        .from('clients')
        .update({
          profile_image_url: imageUrl,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving profile image URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user_code from clients table
app.get('/api/profile/user-code', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (req.userId && userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const email = req.authUser?.email || null;
    const userCode = await resolveUserCodeForAuthUser(userId, email);

    res.json({ user_code: userCode || null });
  } catch (error) {
    console.error('Error fetching user_code:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload profile image (with cropping on server)
app.post('/api/profile/upload-image', async (req, res) => {
  try {
    const { userId, imageData, bucketName } = req.body;
    if (!userId || !imageData) {
      return res.status(400).json({ error: 'User ID and image data are required' });
    }

    if (req.userId && userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get user_code
    const { data: clientData, error: clientError } = await clientDB
      .from('clients')
      .select('user_code')
      .eq('user_id', userId)
      .maybeSingle();

    if (clientError || !clientData) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userCode = clientData.user_code;
    if (!userCode) {
      return res.status(400).json({ error: 'User code not found' });
    }

    // Decode base64 image
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate filename
    const timestamp = Date.now();
    const filename = `${userCode}/${timestamp}.jpeg`;

    // Upload to Supabase Storage
    const bucket = bucketName || process.env.REACT_APP_SUPABASE_STORAGE_BUCKET_NAME || 'profile-pictures';
    const { data: uploadData, error: uploadError } = await clientDB.storage
      .from(bucket)
      .upload(filename, buffer, {
        contentType: 'image/jpeg',
        upsert: false,
        cacheControl: '3600',
        metadata: {
          userId: userId,
          userCode: userCode,
          uploadedAt: new Date().toISOString()
        }
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = clientDB.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);

    res.json({ publicUrl: urlData.publicUrl, path: uploadData.path });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Load client data for meal plan generation (from chat_users and clients)
app.get('/api/profile/client-data-full', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    // Load from chat_users
    const { data: chatData, error: chatError } = await adminDB
      .from('chat_users')
      .select('*')
      .eq('user_code', userCode)
      .maybeSingle();

    if (chatError && chatError.code !== 'PGRST116') {
      throw chatError;
    }

    // Load from clients
    const { data: clientsData, error: clientsError } = await clientDB
      .from('clients')
      .select('onboarding_completed')
      .eq('user_code', userCode)
      .maybeSingle();

    if (clientsError && clientsError.code !== 'PGRST116') {
      throw clientsError;
    }

    // Merge the data
    const mergedData = {
      ...chatData,
      onboarding_completed: clientsData?.onboarding_completed || false
    };

    res.json({ data: mergedData });
  } catch (error) {
    console.error('Error loading client data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save meal plan to both databases
app.post('/api/profile/meal-plan/create', async (req, res) => {
  try {
    const { planId, userCode, mealPlanName, template, menuData, dailyCalories, macros } = req.body;
    if (!planId || !userCode || !mealPlanName || !menuData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const now = new Date().toISOString();

    // Save to meal_plans_and_schemas (secondary database)
    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { error: secondaryError } = await adminDB
      .from('meal_plans_and_schemas')
      .insert({
        id: planId,
        record_type: 'meal_plan',
        user_code: userCode,
        meal_plan_name: mealPlanName,
        schema: template,
        meal_plan: menuData,
        status: 'active',
        daily_total_calories: dailyCalories,
        macros_target: macros,
        active_from: now,
        created_at: now,
        updated_at: now
      });

    if (secondaryError) throw secondaryError;

    // Save to client_meal_plans (main database)
    const { error: mainError } = await clientDB
      .from('client_meal_plans')
      .insert({
        id: planId,
        user_code: userCode,
        original_meal_plan_id: planId,
        meal_plan_name: mealPlanName,
        dietitian_meal_plan: menuData,
        active: true,
        daily_total_calories: dailyCalories,
        macros_target: macros,
        created_at: now,
        updated_at: now
      });

    if (mainError) {
      // Rollback secondary save
      await adminDB
        .from('meal_plans_and_schemas')
        .delete()
        .eq('id', planId);
      throw mainError;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error creating meal plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get provider_id from chat_users
app.get('/api/profile/provider', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await adminDB
      .from('chat_users')
      .select('provider_id')
      .eq('user_code', userCode)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({ provider_id: data?.provider_id || null });
  } catch (error) {
    console.error('Error fetching provider_id:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if system message already exists
app.get('/api/profile/system-message-exists', async (req, res) => {
  try {
    const { providerId, userCode, userId, title, messageType, requestKey } = req.query;
    if (!providerId || (!userCode && !userId)) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    let query = adminDB
      .from('system_messages')
      .select('id')
      .eq('directed_to', providerId)
      .eq('is_active', true);

    if (messageType) {
      query = query.eq('message_type', messageType);
    }

    if (title) {
      query = query.eq('title', title);
    }

    if (requestKey) {
      query = query.ilike('content', `%request_key:${requestKey}%`);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (userCode) {
      query = query.ilike('content', `%${userCode}%`);
    }

    let { data, error } = await query;

    // Backward compatibility: if checking by user_id found nothing, also check legacy messages by user_code in content.
    if ((!data || data.length === 0) && userId && userCode) {
      let fallbackQuery = adminDB
        .from('system_messages')
        .select('id')
        .eq('directed_to', providerId)
        .eq('is_active', true)
        .ilike('content', `%${userCode}%`);

      if (messageType) {
        fallbackQuery = fallbackQuery.eq('message_type', messageType);
      }
      if (title) {
        fallbackQuery = fallbackQuery.eq('title', title);
      }
      if (requestKey) {
        fallbackQuery = fallbackQuery.ilike('content', `%request_key:${requestKey}%`);
      }

      const fallbackResult = await fallbackQuery;
      if (!fallbackResult.error) {
        data = fallbackResult.data;
      } else if (!error) {
        error = fallbackResult.error;
      }
    }

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({ exists: data && data.length > 0 });
  } catch (error) {
    console.error('Error checking system message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create system message
app.post('/api/profile/system-message', async (req, res) => {
  try {
    const { title, content, messageType, priority, directedTo, userId } = req.body;
    if (!title || !content || !directedTo) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await adminDB
      .from('system_messages')
      .insert({
        title,
        content,
        message_type: messageType || 'info',
        priority: priority || 'medium',
        is_active: true,
        directed_to: directedTo,
        user_id: userId || null
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error creating system message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user language in clients table
app.post('/api/profile/update-language', async (req, res) => {
  try {
    const { userCode, language } = req.body;
    if (!userCode || !language) {
      return res.status(400).json({ error: 'User code and language are required' });
    }

    const { error } = await clientDB
      .from('clients')
      .update({ user_language: language })
      .eq('user_code', userCode);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating language:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================
// SECONDARY CLIENT API ROUTES (Food Logs, Chat, Weight, etc.)
// ====================================

// =========================================================================
// PUBLIC DYNAMIC LANDING PAGE VALIDATION ENDPOINT (CHAT DB RESOLVED)
// =========================================================================
app.post('/api/landing/validate', async (req, res) => {
  const { managerId, linkId } = req.body;
  
  console.log(`=== [HANDSHAKE] === Validating Schema Route for Manager: ${managerId}, Link: ${linkId || 'None'}`);

  if (!managerId) {
    return res.status(400).json({ error: 'INVALID_TOKEN_STRUCTURE' });
  }

  try {
    // 1. Fetch from profiles + join companies (Explicitly requesting the new config JSONB column)
    const { data: profile, error: profileErr } = await adminDB
      .from('profiles')
      .select('name, role, company_id, companies(name, config)')
      .eq('id', managerId)
      .single();

    if (profileErr || !profile) {
      console.error('[-] Profile database search failure:', profileErr);
      return res.status(404).json({ error: 'Manager profile data records not found' });
    }

    const companyData = profile.companies;
    if (!companyData) {
      return res.status(404).json({ error: 'Associated corporate master profile missing' });
    }

    // Initialize clean fallbacks for our campaign variables
    let slotsRemaining = null;
    let maxSlots = null;
    let currentCount = 0;
    let expiresAt = null;
    let isSmartLinkActive = false;

    // 2. Fetch campaign metrics using the exact registration_rules mapping columns
    if (linkId) {
      const { data: rule, error: ruleErr } = await adminDB
        .from('registration_rules')
        .select('max_slots, current_count, expires_at, is_active')
        .eq('link_id', linkId) // Matching your schema constraint unique (link_id)
        .single();

      if (ruleErr) {
        console.error('[-] Error fetching live campaign metrics:', ruleErr);
      }

      if (rule) {
        if (rule.is_active === false) {
          return res.status(410).json({ error: 'This specific campaign track has been deactivated' });
        }
        
        if (rule.expires_at && new Date(rule.expires_at) < new Date()) {
          return res.status(410).json({ error: 'Campaign tracking parameters have expired on the server clock' });
        }

        maxSlots = rule.max_slots ?? 30; // Matches your DDL default 30 limit
        currentCount = rule.current_count ?? 0;
        slotsRemaining = Math.max(0, maxSlots - currentCount);
        expiresAt = rule.expires_at;
        isSmartLinkActive = true;

        if (slotsRemaining <= 0) {
          return res.status(403).json({ error: 'Registration thresholds reached. No remaining available slots' });
        }
      }
    }

    // 3. Assemble dynamic response payload passing the dynamic config block
    const payloadResponse = {
      success: true,
      company: {
        id: profile.company_id,
        name: companyData.name,
        slug: companyData.name.toLowerCase().replace(/\s+/g, '').trim(),
        // Fallback to empty object if database config field is null
        config: companyData.config || {} 
      },
      manager: {
        name: profile.name,
        role: profile.role
      },
      campaign: {
        isSmartLink: isSmartLinkActive,
        maxSlots: maxSlots,
        currentCount: currentCount,
        slotsRemaining: slotsRemaining,
        expiresAt: expiresAt
      }
    };

    console.log('=== [SCHEMA PRODUCTION SUCCESS] === Dispatched Payload:', JSON.stringify(payloadResponse, null, 2));
    return res.status(200).json(payloadResponse);

  } catch (globalFaultException) {
    console.error('[-] Fatal backend transaction collapse:', globalFaultException);
    return res.status(500).json({ error: 'Internal secure service validation cluster fault' });
  }
});
// Get food logs
app.get('/api/food-logs', assertOwnUserCode(), async (req, res) => {
  try {
    const { userCode, date } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    // Get user_id from chat_users
    const { data: userData, error: userError } = await adminDB
      .from('chat_users')
      .select('id')
      .eq('user_code', userCode)
      .maybeSingle();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get food logs (ordered by log_date then created_at so display is by log date)
    let query = adminDB
      .from('food_logs')
      .select('*')
      .eq('user_id', userData.id)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (date) {
      query = query.eq('log_date', date);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ data });
  } catch (error) {
    console.error('Error fetching food logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create food log
app.post('/api/food-logs', assertOwnUserCode(), async (req, res) => {
  try {
    const { userCode, foodLogData } = req.body;
    if (!userCode || !foodLogData) {
      return res.status(400).json({ error: 'User code and food log data are required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    // Get user_id from chat_users
    const { data: userData, error: userError } = await adminDB
      .from('chat_users')
      .select('id')
      .eq('user_code', userCode)
      .maybeSingle();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create food log (include total_* when provided so DB has nutrition totals)
    const insertData = {
      user_id: userData.id,
      meal_label: foodLogData.meal_label,
      food_items: foodLogData.food_items || [],
      log_date: foodLogData.log_date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };
    if (foodLogData.total_calories !== undefined) insertData.total_calories = foodLogData.total_calories;
    if (foodLogData.total_protein_g !== undefined) insertData.total_protein_g = foodLogData.total_protein_g;
    if (foodLogData.total_carbs_g !== undefined) insertData.total_carbs_g = foodLogData.total_carbs_g;
    if (foodLogData.total_fat_g !== undefined) insertData.total_fat_g = foodLogData.total_fat_g;

    const { data, error } = await adminDB
      .from('food_logs')
      .insert([insertData])
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error creating food log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update food log
app.put('/api/food-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { foodLogData } = req.body;
    
    if (!foodLogData) {
      return res.status(400).json({ error: 'Food log data is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    if (!req.userCode || !(await verifyFoodLogOwnership(id, req.userCode))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    if (foodLogData.meal_label !== undefined) updateData.meal_label = foodLogData.meal_label;
    if (foodLogData.food_items !== undefined) updateData.food_items = foodLogData.food_items;
    if (foodLogData.image_url !== undefined) updateData.image_url = foodLogData.image_url;
    if (foodLogData.total_calories !== undefined) updateData.total_calories = foodLogData.total_calories;
    if (foodLogData.total_protein_g !== undefined) updateData.total_protein_g = foodLogData.total_protein_g;
    if (foodLogData.total_carbs_g !== undefined) updateData.total_carbs_g = foodLogData.total_carbs_g;
    if (foodLogData.total_fat_g !== undefined) updateData.total_fat_g = foodLogData.total_fat_g;
    if (foodLogData.log_date !== undefined) updateData.log_date = foodLogData.log_date;
    if (foodLogData.created_at !== undefined) updateData.created_at = foodLogData.created_at;
    if (foodLogData.updated_at !== undefined) updateData.updated_at = foodLogData.updated_at;

    const { data, error } = await adminDB
      .from('food_logs')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error updating food log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete food log
app.delete('/api/food-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    if (!req.userCode || !(await verifyFoodLogOwnership(id, req.userCode))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data, error } = await adminDB
      .from('food_logs')
      .delete()
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error deleting food log:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================
// FOOD IMAGE ANALYSIS  [MOBILE APP API]
// Consumed by the BetterChoice mobile app (photo-based meal logging flow).
// Vision LLM returns per-100g macro baselines + estimated grams per item.
// Final calories / protein / carbs / fat totals are computed in JS, NOT by the model.
// ====================================

// Resize the longest edge to <=1024px and re-encode as JPEG quality 80 to keep
// the LLM payload small and predictable regardless of the input source format.
async function compressFoodImage(buffer) {
  return await sharp(buffer)
    .rotate()
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

// Strict structured-output schema. Nullable fields use ["type","null"] which is
// the format Azure / OpenAI v1 structured outputs require alongside strict:true.
const FOOD_IMAGE_LLM_SCHEMA = {
  name: 'food_image_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      is_food: {
        type: 'boolean',
        description: 'True only when the image clearly contains food, beverages or a packaged food product that can be quantified.'
      },
      not_food_reason: {
        type: ['string', 'null'],
        description: 'Short reason when is_food is false (e.g. "image is a person", "image is too blurry"). null when is_food is true.'
      },
      meal_label: { type: ['string', 'null'] },
      info_message: { type: ['string', 'null'] },
      dietary_warnings: {
        type: ['array', 'null'],
        items: { type: 'string' }
      },
      food_items: {
        type: ['array', 'null'],
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            visual_evidence: {
              type: 'string',
              description: 'Short justification: cues used to identify the item and infer its weight & density (1-2 sentences max).'
            },
            estimated_weight_g: { type: 'number' },
            is_beverage: {
              type: 'boolean',
              description: 'True for drinks / liquids people normally measure in volume (water, juice, milk, soda, coffee, tea, beer, wine, smoothie, milkshake, broth-as-drink, etc.). False for everything that is eaten with utensils.'
            },
            estimated_volume_ml: {
              type: ['number', 'null'],
              description: 'Volume in milliliters. MUST be filled when is_beverage is true. MUST be null when is_beverage is false.'
            },
            confidence: { type: 'number', description: '0..1 confidence in identification + portion estimate.' },
            macros_per_100g: {
              type: 'object',
              additionalProperties: false,
              properties: {
                calories_per_100g: { type: 'number' },
                protein_per_100g: { type: 'number' },
                carbs_per_100g:   { type: 'number' },
                fat_per_100g:     { type: 'number' }
              },
              required: ['calories_per_100g', 'protein_per_100g', 'carbs_per_100g', 'fat_per_100g']
            }
          },
          required: ['name', 'visual_evidence', 'estimated_weight_g', 'is_beverage', 'estimated_volume_ml', 'confidence', 'macros_per_100g']
        }
      },
      overall_health_score: {
        type: ['number', 'null'],
        description: '0-10 general nutritional quality of the meal in the photo. INDEPENDENT of any meal plan. Null when is_food is false.'
      },
      overall_health_score_reason: {
        type: ['string', 'null'],
        description: 'Short (1 sentence) justification for overall_health_score. Null when is_food is false.'
      },
      plan_match_score: {
        type: ['number', 'null'],
        description: '0-10 how closely the photo matches the supplied plan meal (best of MAIN vs ALTERNATIVE). Null when no plan meal was supplied or when is_food is false.'
      },
      plan_match_reason: {
        type: ['string', 'null'],
        description: 'Short (1 sentence) justification for plan_match_score, mentioning which variant was used. Null when no plan meal was supplied or when is_food is false.'
      },
      plan_match_variant: {
        type: ['string', 'null'],
        description: 'Which plan variant the score was based on: "main", "alternative", or "none" if neither was a real match. Null when no plan meal was supplied or when is_food is false.'
      }
    },
    required: [
      'is_food', 'not_food_reason', 'meal_label', 'info_message', 'dietary_warnings', 'food_items',
      'overall_health_score', 'overall_health_score_reason',
      'plan_match_score', 'plan_match_reason', 'plan_match_variant'
    ]
  }
};

// Hard cap on the free-text caption that gets injected into the LLM prompt.
// Long enough for a sentence or two of useful context ("homemade lasagna, ~2
// servings, extra cheese") but short enough that a malicious or buggy client
// cannot blow up the prompt or smuggle in arbitrary instructions.
const MAX_USER_CAPTION_LENGTH = 500;

function sanitizeUserCaption(rawCaption) {
  if (typeof rawCaption !== 'string') return '';
  // Collapse all whitespace (including newlines) to a single space so the
  // caption cannot break out of its prompt block via crafted line breaks.
  const collapsed = rawCaption.replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';
  return collapsed.length > MAX_USER_CAPTION_LENGTH
    ? collapsed.slice(0, MAX_USER_CAPTION_LENGTH)
    : collapsed;
}

// Extract only the fields we need from a single plan ingredient and clip
// strings so the prompt cannot be inflated by long / hostile payloads.
function sanitizePlanIngredient(ing) {
  if (!ing || typeof ing !== 'object') return null;
  const safe = {};
  if (typeof ing.item === 'string' && ing.item.trim()) {
    safe.item = ing.item.trim().slice(0, 120);
  } else {
    return null;
  }
  const brand = ing['brand of pruduct'] ?? ing.brand;
  if (typeof brand === 'string' && brand.trim()) {
    safe.brand = brand.trim().slice(0, 80);
  }
  const grams = ing['portionSI(gram)'] ?? ing.grams;
  if (typeof grams === 'number' && Number.isFinite(grams)) {
    safe.grams = Math.round(grams * 10) / 10;
  }
  if (typeof ing.household_measure === 'string' && ing.household_measure.trim()) {
    safe.household_measure = ing.household_measure.trim().slice(0, 120);
  }
  const macros = {};
  if (typeof ing.calories === 'number') macros.calories = ing.calories;
  if (typeof ing.protein  === 'number') macros.protein  = ing.protein;
  if (typeof ing.carbs    === 'number') macros.carbs    = ing.carbs;
  if (typeof ing.fat      === 'number') macros.fat      = ing.fat;
  if (Object.keys(macros).length) safe.macros = macros;
  return safe;
}

// Sanitize one variant (main OR alternative) from a plan-meal entry.
function sanitizePlanVariant(variant) {
  if (!variant || typeof variant !== 'object') return null;
  const safe = {};
  if (typeof variant.meal_title === 'string' && variant.meal_title.trim()) {
    safe.meal_title = variant.meal_title.trim().slice(0, 200);
  }
  if (typeof variant.main_protein_source === 'string' && variant.main_protein_source.trim()) {
    safe.main_protein_source = variant.main_protein_source.trim().slice(0, 100);
  }
  if (variant.nutrition && typeof variant.nutrition === 'object') {
    const n = variant.nutrition;
    safe.nutrition = {
      calories: typeof n.calories === 'number' ? n.calories : null,
      protein:  typeof n.protein  === 'number' ? n.protein  : null,
      carbs:    typeof n.carbs    === 'number' ? n.carbs    : null,
      fat:      typeof n.fat      === 'number' ? n.fat      : null
    };
  }
  if (Array.isArray(variant.ingredients)) {
    safe.ingredients = variant.ingredients
      .slice(0, 25)
      .map(sanitizePlanIngredient)
      .filter(Boolean);
  }
  if (!safe.meal_title && !(safe.ingredients && safe.ingredients.length)) return null;
  return safe;
}

// The client should send ONE entry from `meals[]` of the plan JSON (i.e. the
// `{ main, meal, alternative }` slice for the meal being photographed). We
// deliberately do not accept the full plan — that would just bloat the prompt.
function sanitizePlanMeal(planMeal) {
  if (!planMeal || typeof planMeal !== 'object') return null;
  const main        = sanitizePlanVariant(planMeal.main);
  const alternative = sanitizePlanVariant(planMeal.alternative);
  if (!main && !alternative) return null;

  let mealName = null;
  if (typeof planMeal.meal === 'string' && planMeal.meal.trim()) {
    mealName = planMeal.meal.trim().slice(0, 100);
  } else if (typeof planMeal.main?.meal_name === 'string' && planMeal.main.meal_name.trim()) {
    mealName = planMeal.main.meal_name.trim().slice(0, 100);
  } else if (typeof planMeal.alternative?.meal_name === 'string' && planMeal.alternative.meal_name.trim()) {
    mealName = planMeal.alternative.meal_name.trim().slice(0, 100);
  }

  return { meal_name: mealName, main, alternative };
}

// Render a sanitized plan-meal slice as a compact, prompt-friendly block.
function formatPlanMealForPrompt(planMeal) {
  if (!planMeal) return '';

  const renderVariant = (label, v) => {
    if (!v) return `  ${label}: (not provided)`;
    const lines = [`  ${label}: ${v.meal_title || '(untitled)'}`];
    if (v.nutrition) {
      const n = v.nutrition;
      const fmt = (x) => (x == null ? '?' : x);
      lines.push(`    Target totals: ${fmt(n.calories)} kcal | P ${fmt(n.protein)}g | C ${fmt(n.carbs)}g | F ${fmt(n.fat)}g`);
    }
    if (v.main_protein_source) {
      lines.push(`    Main protein: ${v.main_protein_source}`);
    }
    if (v.ingredients && v.ingredients.length) {
      lines.push(`    Ingredients:`);
      v.ingredients.forEach((ing) => {
        const parts = [ing.item];
        if (ing.brand) parts.push(`(${ing.brand})`);
        if (ing.grams != null) parts.push(`${ing.grams}g`);
        if (ing.household_measure) parts.push(`— ${ing.household_measure}`);
        lines.push(`      • ${parts.join(' ')}`);
      });
    }
    return lines.join('\n');
  };

  const header = planMeal.meal_name
    ? `**CLIENT MEAL-PLAN ENTRY (what this "${planMeal.meal_name}" *should* be):**`
    : `**CLIENT MEAL-PLAN ENTRY (what this meal *should* be):**`;

  return `\n${header}\n${renderVariant('MAIN',        planMeal.main)}\n${renderVariant('ALTERNATIVE', planMeal.alternative)}\n`;
}

function buildFoodImagePrompt(mealLabel, userCaption, planMeal) {
  const cleanCaption = sanitizeUserCaption(userCaption);
  const captionBlock = cleanCaption
    ? `\n* **User description (sent with the photo):** "${cleanCaption}"\n  Treat this as ground truth about the dish identity, ingredients, preparation, or portion when it does not contradict clear visual evidence. Prefer the user's wording for \`name\` and let it refine portion / density estimates.\n`
    : '';

  const planBlock = formatPlanMealForPrompt(planMeal);
  const hasPlan = !!planBlock;

  const meal = mealLabel ? String(mealLabel) : 'unknown';

  const planStep = hasPlan
    ? `
7.  **MEAL-PLAN ADHERENCE SCORE (a plan meal was supplied — produce real numbers):**
    * Compare the dish in the photo/description against BOTH the MAIN and the ALTERNATIVE variant above.
    * Pick whichever variant the nutritional profile most resembles, and base \`plan_match_score\` on that one only.
    * The score is the client's adherence to their plan. Judge using:
        - **Macro & Calorie Proximity (PRIMARY FOCUS):** how close the computed totals (calories / protein / carbs / fat) are to that variant's target totals. This dictates the score.
        - **Portion sanity:** significantly oversized or undersized portions ruin the macro targets and heavily reduce the score.
        - **Identity / ingredient overlap (MINOR NOTE):** acknowledge if they ate the actual planned dish, but DO NOT heavily penalize them if they swapped the meal for something else that still hits the exact same macro and calorie targets.
    * Scoring guide:
        - 9–10 = Excellent macro and calorie match. The nutritional targets were hit, regardless of whether it's the exact planned dish or a smart substitute.
        - 7–8  = Good macro match with minor deviations (e.g., slightly higher fat, slightly lower protein, or small portion drift).
        - 4–6  = Moderate mismatch (e.g., calories are somewhat close, but the macro balance is wrong, like missing the protein target entirely).
        - 0–3  = Complete macro/calorie mismatch (e.g., vastly different calorie count or entirely wrong nutritional profile compared to the plan).
    * Set \`plan_match_variant\` to \`"main"\`, \`"alternative"\`, or \`"none"\` (use \`"none"\` only when the macros are a complete mismatch — in that case keep \`plan_match_score\` ≤ 3).
    * \`plan_match_reason\`: 1 short sentence. Focus the reasoning primarily on how the macros/calories compared to the target. You may briefly mention the dish identity as secondary context.`
    : `
7.  **MEAL-PLAN ADHERENCE SCORE:**
    * No plan meal was supplied. Set \`plan_match_score\`, \`plan_match_reason\`, and \`plan_match_variant\` to \`null\`.`;

  return `Act as a Lead Forensic Food Scientist and Computer Vision Specialist. Your objective is to classify the image as food or not, perform the macro analysis, and rate the meal.

**CONTEXTUAL METADATA:**
* **User Meal Time:** ${meal}
${captionBlock}${planBlock}
**STEP 0 — IMAGE TYPE GATE (execute first, before anything else):**
* Is the image clearly a single dish, multiple food items, a beverage, or a packaged food product?
  - If NO (it is not food at all – e.g. a person, scenery, document, screenshot, or quality is too poor to identify any food) → set \`is_food: false\`, fill \`not_food_reason\` with a short explanation, and set EVERY other field (\`food_items\`, \`overall_health_score\`, \`overall_health_score_reason\`, \`plan_match_score\`, \`plan_match_reason\`, \`plan_match_variant\`, etc.) to \`null\`. Skip the rest of the steps.
  - If YES → set \`is_food: true\`, leave \`not_food_reason\` null, and continue to steps 1–7 below.

**WHEN is_food IS TRUE — food photo analysis protocol:**

1.  **IMAGE VALIDATION & CLASSIFICATION:**
    * **Detection:** Food, beverage, or food-adjacent object (packaging)?
    * **Image Quality Check:** Assess blur and lighting. If quality prevents accurate analysis, lower \`confidence\` accordingly.

2.  **GEOMETRIC SCALE & CONTAINER STANDARDIZATION (CRITICAL FOR ACCURACY):**
    * **Anchor Identification:** Identify standard reference objects (dinner fork ≈ 20cm, dinner plate ≈ 25-28cm, standard mug, Starbucks Grande cup, etc.).
    * **Container Geometry:** If food is in a bowl/container, estimate the container's volume first. Is the container full, half-full, or 1/4 full?
    * **Z-Axis Estimation:** Analyze shadows and layering to estimate height. Piled high (pyramid) or spread flat (cylinder)?

3.  **COMPONENT DECOMPOSITION & DENSITY MAPPING:**
    * Deconstruct the dish into distinct components (Protein, Starch, Veg, Sauce, etc.).
    * **Shape & Dimensions:** Approximate geometric primitive and dimensions relative to the Anchor.
    * **Porosity/Density Mapping:**
        * High (Compact): Steak, dense brownie (>1.0 g/cm³).
        * Medium: Pasta, rice (0.6–0.9 g/cm³).
        * Low (Aerated): Popcorn, leafy salad, bread (<0.3 g/cm³).
    * **Hidden Calorie Detection:**
        * **Viscosity:** Watery sauce (low cal) vs. clinging/glossy (oil/cream-based)?
        * **Absorption:** For items like eggplant or bread, assume oil absorption if surface sheen is high.
    * **Final Weight Output:** Set \`estimated_weight_g\` for each component based on volume × density.
    * **Beverage Handling (decides the user-facing unit):**
        - Set \`is_beverage: true\` ONLY for drinks / pourable liquids that people naturally measure in volume (water, juice, milk, soft drinks, soda, coffee, tea, beer, wine, cocktails, smoothies, milkshakes, drinkable yogurts, broth served as a drink, etc.). Soups eaten with a spoon, ice cream, yogurt in a bowl, sauces, and dressings are NOT beverages.
        - When \`is_beverage\` is true: fill \`estimated_volume_ml\` from container geometry (mug ≈ 250ml, standard glass ≈ 250ml, soda can ≈ 330ml, half-litre bottle ≈ 500ml, Starbucks Tall ≈ 350ml / Grande ≈ 470ml / Venti ≈ 590ml) and convert to grams using the drink's density (water / most soft drinks ≈ 1.0 g/ml, milk ≈ 1.03 g/ml, whole-milk smoothies ≈ 1.0–1.05 g/ml, beer ≈ 1.01 g/ml, oil ≈ 0.92 g/ml). \`estimated_weight_g\` must STILL be filled (macros math runs in grams).
        - When \`is_beverage\` is false: set \`estimated_volume_ml: null\`.
    * **Hidden Calorie & Implicit Ingredient Detection (MANDATORY SEPARATION):**
        * **Explicit Extraction:** If you detect or infer added fats (oil, butter, dressings) or significant sauces, you MUST create a distinct, separate component for them in your output list. Do not implicitly merge their calories into the main food item.
        * **Visual Cues (Gloss/Sheen):** If vegetables, pasta, or salads appear shiny, glossy, or have pools of liquid, explicitly add an estimated portion of "Oil", "Butter", or "Dressing".
        * **Culinary Context (Heuristics):** If the dish traditionally relies on oil or fat (e.g., Hummus, Fried Eggs, Roasted Vegetables, Mediterranean Salads), assume standard culinary preparation and add an appropriate baseline amount of oil/fat.
        * **Viscosity & Absorption:** For porous items (eggplant, bread, croutons), assume high oil absorption and increase the estimated weight of the hidden fat component if the surface sheen is high.


4.  **MACRONUTRIENT BASELINES (CRITICAL HANDOFF):**
    * **DO NOT** calculate the final total macros for the estimated weight.
    * Provide ONLY the standard USDA / nutritional database baseline values **PER 100 GRAMS** for each component, in \`macros_per_100g\`.
    * The backend will multiply these baselines by the estimated mass.

5.  **CONTEXTUAL REASONING:**
    * **Meal Label Logic:** Cross-reference contents with "${meal}" (e.g., Pancakes at 20:00 is "Breakfast for Dinner", not "Snack").

6.  **OVERALL HEALTH SCORE (always, when is_food is true — independent of any meal plan):**
    * \`overall_health_score\` (0–10): general nutritional quality of the meal AS SHOWN. Judge macro balance, fiber / whole-food content, processing level, added sugar, fried / oily preparation, micronutrient density, and portion sanity.
        - 0–3 = poor (ultra-processed, fried, sugary, nutritionally empty).
        - 4–6 = mixed (some redeeming components, some poor ones).
        - 7–8 = good (balanced, mostly whole foods, reasonable portion).
        - 9–10 = excellent (clean, balanced, nutrient-dense).
    * \`overall_health_score_reason\`: 1 short sentence justifying the score.
    * This score MUST NOT be influenced by the supplied meal plan — it reflects only the photo itself.
${planStep}

Keep all string fields short (≤ 1–2 sentences). Numbers must be plain numbers (no units, no ranges). Respond ONLY with a valid JSON object matching the schema. Do not output markdown, explanations, or repetition of steps.`;
}

async function callFoodVisionLLM(compressedJpegBuffer, prompt) {
  const apiBase = (process.env.DEEPSEEK_ENDPOINT || '').replace(/\/$/, '');
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model  = process.env.DEEPSEEK_DEPLOYMENT;

  if (!apiBase || !apiKey || !model) {
    throw new Error('Vision LLM is not configured on the server (DEEPSEEK_ENDPOINT / DEEPSEEK_API_KEY / DEEPSEEK_DEPLOYMENT).');
  }

  const url = `${apiBase}/chat/completions`;
  const dataUrl = `data:image/jpeg;base64,${compressedJpegBuffer.toString('base64')}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Both header styles are accepted by the Azure AI Foundry OpenAI-compatible /openai/v1 path.
      'api-key': apiKey,
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: 4000,
      reasoning_effort: "medium",
      response_format: {
        type: 'json_schema',
        json_schema: FOOD_IMAGE_LLM_SCHEMA
      },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vision LLM call failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  if (!content) {
    const finishReason = choice?.finish_reason;
    const usage = data.usage ? JSON.stringify(data.usage) : 'n/a';
    throw new Error(`Empty content from vision LLM (finish_reason=${finishReason}, usage=${usage}).`);
  }

  try {
    return JSON.parse(content);
  } catch (parseError) {
    throw new Error(`Failed to parse vision LLM JSON: ${parseError.message}`);
  }
}

// Hard cap on the free-text food description sent to the text-analysis
// endpoint. Long enough for a multi-item meal log ("2 fried eggs, a slice of
// sourdough toast with butter, large flat white with oat milk") but short
// enough that a malicious / buggy client cannot blow up the prompt or burn
// tokens. Rejected (not silently truncated) when way over the cap so callers
// notice something is wrong with their payload.
const MAX_FOOD_TEXT_LENGTH = 1500;

function sanitizeFoodText(rawText) {
  if (typeof rawText !== 'string') return '';
  // Collapse all whitespace (including newlines) to a single space so the
  // description cannot break out of its prompt block via crafted line breaks.
  const collapsed = rawText.replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';
  return collapsed.length > MAX_FOOD_TEXT_LENGTH
    ? collapsed.slice(0, MAX_FOOD_TEXT_LENGTH)
    : collapsed;
}

function buildFoodTextPrompt(mealLabel, foodText, planMeal) {
  const planBlock = formatPlanMealForPrompt(planMeal);
  const hasPlan = !!planBlock;

  const meal = mealLabel ? String(mealLabel) : 'unknown';

  const planStep = hasPlan
    ? `
7.  **MEAL-PLAN ADHERENCE SCORE (a plan meal was supplied — produce real numbers):**
    * Compare the dish in the photo/description against BOTH the MAIN and the ALTERNATIVE variant above.
    * Pick whichever variant the nutritional profile most resembles, and base \`plan_match_score\` on that one only.
    * The score is the client's adherence to their plan. Judge using:
        - **Macro & Calorie Proximity (PRIMARY FOCUS):** how close the computed totals (calories / protein / carbs / fat) are to that variant's target totals. This dictates the score.
        - **Portion sanity:** significantly oversized or undersized portions ruin the macro targets and heavily reduce the score.
        - **Identity / ingredient overlap (MINOR NOTE):** acknowledge if they ate the actual planned dish, but DO NOT heavily penalize them if they swapped the meal for something else that still hits the exact same macro and calorie targets.
    * Scoring guide:
        - 9–10 = Excellent macro and calorie match. The nutritional targets were hit, regardless of whether it's the exact planned dish or a smart substitute.
        - 7–8  = Good macro match with minor deviations (e.g., slightly higher fat, slightly lower protein, or small portion drift).
        - 4–6  = Moderate mismatch (e.g., calories are somewhat close, but the macro balance is wrong, like missing the protein target entirely).
        - 0–3  = Complete macro/calorie mismatch (e.g., vastly different calorie count or entirely wrong nutritional profile compared to the plan).
    * Set \`plan_match_variant\` to \`"main"\`, \`"alternative"\`, or \`"none"\` (use \`"none"\` only when the macros are a complete mismatch — in that case keep \`plan_match_score\` ≤ 3).
    * \`plan_match_reason\`: 1 short sentence. Focus the reasoning primarily on how the macros/calories compared to the target. You may briefly mention the dish identity as secondary context.`
    : `
7.  **MEAL-PLAN ADHERENCE SCORE:**
    * No plan meal was supplied. Set \`plan_match_score\`, \`plan_match_reason\`, and \`plan_match_variant\` to \`null\`.`;

  return `Act as a Lead Forensic Food Scientist and Nutrition Description Parser. Your objective is to classify the user's text as describing food or not, parse the items, estimate portions from the wording, and rate the meal.

**CONTEXTUAL METADATA:**
* **User Meal Time:** ${meal}
* **User Food Description (free text — this is the primary input):** "${foodText}"
${planBlock}
**STEP 0 — TEXT GATE (execute first, before anything else):**
* Does the description clearly refer to one or more foods, beverages, or packaged food products that can be quantified?
  - If NO (gibberish, non-food topic, empty, just emojis, etc.) → set \`is_food: false\`, fill \`not_food_reason\` with a short explanation, and set EVERY other field (\`food_items\`, \`overall_health_score\`, \`overall_health_score_reason\`, \`plan_match_score\`, \`plan_match_reason\`, \`plan_match_variant\`, etc.) to \`null\`. Skip the rest of the steps.
  - If YES → set \`is_food: true\`, leave \`not_food_reason\` null, and continue to steps 1–7 below.

**WHEN is_food IS TRUE — text-based food analysis protocol:**

1.  **PARSE FOOD ITEMS:**
    * Identify each distinct food / beverage mentioned. Group obvious accompaniments where it makes sense ("scrambled eggs with butter" can be one item) but split items with very different macro profiles ("burger and fries" → two items).
    * Use the user's own wording for \`name\` (lightly cleaned).

2.  **PORTION ESTIMATION FROM WORDING (CRITICAL FOR ACCURACY):**
    * **Explicit units:** when the user gives grams / ml / oz / lb / kg, use those exactly. Conversions: 1 oz ≈ 28.35g, 1 fl oz ≈ 29.57ml, 1 lb ≈ 454g, 1 kg = 1000g.
    * **Common household measures (defaults — adjust by description):**
        - "slice of bread" ≈ 30g (thick slice ≈ 45g)
        - "cup" ≈ 240ml liquid; ≈ 150g cooked rice / pasta; ≈ 30g cereal
        - "tablespoon (tbsp)" ≈ 15g/15ml; "teaspoon (tsp)" ≈ 5g/5ml
        - "glass" / "mug" ≈ 250ml
        - "can of soda" ≈ 330ml; "bottle of water" ≈ 500ml; "pint of beer" ≈ 470ml
        - "small / medium / large apple" ≈ 130 / 180 / 250g
        - "small / medium / large egg" ≈ 45 / 55 / 65g
        - "scoop of ice cream" ≈ 65g; "scoop of protein powder" ≈ 30g
        - "handful of nuts" ≈ 30g
        - Restaurant entrée with no size given ≈ 350g; restaurant side ≈ 150g.
    * **Quantifier words:** "a/one" → 1 unit; "a couple of" → 2; "a few" → 3; "several" → ~4; bare plural with no number → 2 unless context says otherwise.
    * **Vague portions:** if the user just names a dish with no quantity, infer a sensible default for the meal slot ("${meal}").
    * **Final Weight Output:** set \`estimated_weight_g\` for each component.
    * **Beverage Handling (decides the user-facing unit):**
        - Set \`is_beverage: true\` ONLY for drinks / pourable liquids that people naturally measure in volume (water, juice, milk, soft drinks, soda, coffee, tea, beer, wine, cocktails, smoothies, milkshakes, drinkable yogurts, broth-as-drink, etc.). Soups eaten with a spoon, ice cream, yogurt in a bowl, sauces, and dressings are NOT beverages.
        - When \`is_beverage\` is true: fill \`estimated_volume_ml\` from the description and convert to grams using the drink's density (water / most soft drinks ≈ 1.0 g/ml, milk ≈ 1.03 g/ml, whole-milk smoothies ≈ 1.0–1.05 g/ml, beer ≈ 1.01 g/ml, oil ≈ 0.92 g/ml). \`estimated_weight_g\` must STILL be filled (macros math runs in grams).
        - When \`is_beverage\` is false: set \`estimated_volume_ml: null\`.

3.  **MACRONUTRIENT BASELINES (CRITICAL HANDOFF):**
    * **DO NOT** calculate the final total macros for the estimated weight.
    * Provide ONLY the standard USDA / nutritional database baseline values **PER 100 GRAMS** for each component, in \`macros_per_100g\`.
    * The backend will multiply these baselines by the estimated mass.

4.  **CONFIDENCE & EVIDENCE:**
    * \`confidence\` (0..1): how clearly the description specified portion + dish identity. Vague text ("some food") → low confidence; precise text ("180g grilled chicken breast") → high.
    * \`visual_evidence\`: 1–2 sentence justification quoting / paraphrasing the user wording you used to estimate weight (e.g. "user said 'large bowl of pasta' → estimated 250g cooked").

5.  **CONTEXTUAL REASONING:**
    * **Meal Label Logic:** Cross-reference contents with "${meal}" (e.g., Pancakes at 20:00 is "Breakfast for Dinner", not "Snack").

6.  **OVERALL HEALTH SCORE (always, when is_food is true — independent of any meal plan):**
    * \`overall_health_score\` (0–10): general nutritional quality of the meal AS DESCRIBED. Judge macro balance, fiber / whole-food content, processing level, added sugar, fried / oily preparation, micronutrient density, and portion sanity.
        - 0–3 = poor (ultra-processed, fried, sugary, nutritionally empty).
        - 4–6 = mixed (some redeeming components, some poor ones).
        - 7–8 = good (balanced, mostly whole foods, reasonable portion).
        - 9–10 = excellent (clean, balanced, nutrient-dense).
    * \`overall_health_score_reason\`: 1 short sentence justifying the score.
    * This score MUST NOT be influenced by the supplied meal plan — it reflects only the described meal itself.
${planStep}

Keep all string fields short (≤ 1–2 sentences). Numbers must be plain numbers (no units, no ranges). Respond ONLY with a valid JSON object matching the schema. Do not output markdown, explanations, or repetition of steps.`;
}

// Calls GPT-4o-mini for text-only food analysis. Reuses the same Azure /
// OpenAI-compatible endpoint + key as the vision model (same DEEPSEEK_ENDPOINT
// / DEEPSEEK_API_KEY) but routes to a separate deployment configured via
// DEEPSEEK_TEXT_DEPLOYMENT (falls back to the literal "gpt-4o-mini").
async function callFoodTextLLM(prompt) {
  const apiBase = (process.env.DEEPSEEK_ENDPOINT || '').replace(/\/$/, '');
  const apiKey  = process.env.DEEPSEEK_API_KEY;
  const model   = process.env.DEEPSEEK_TEXT_DEPLOYMENT || 'gpt-4o';

  if (!apiBase || !apiKey) {
    throw new Error('Text LLM is not configured on the server (DEEPSEEK_ENDPOINT / DEEPSEEK_API_KEY).');
  }

  const url = `${apiBase}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Both header styles are accepted by the Azure AI Foundry OpenAI-compatible /openai/v1 path.
      'api-key': apiKey,
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      // gpt-4o-mini is not a reasoning model, so we deliberately omit
      // `reasoning_effort` (it would be rejected) and lean on a slightly lower
      // temperature instead for stable structured-output behavior.
      max_completion_tokens: 2000,
      temperature: 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: FOOD_IMAGE_LLM_SCHEMA
      },
      messages: [
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Text LLM call failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  if (!content) {
    const finishReason = choice?.finish_reason;
    const usage = data.usage ? JSON.stringify(data.usage) : 'n/a';
    throw new Error(`Empty content from text LLM (finish_reason=${finishReason}, usage=${usage}).`);
  }

  try {
    return JSON.parse(content);
  } catch (parseError) {
    throw new Error(`Failed to parse text LLM JSON: ${parseError.message}`);
  }
}

// Shared response shaping for /analyze-image and /analyze-text. Both endpoints
// return the same JSON shape; only the prompt + LLM differ. Pulling the math /
// clamping / plan_match logic into one place keeps the two endpoints in sync.
function buildFoodAnalysisResponseBody(llmReport, hasPlan) {
  // ---- Math runs in code, NOT in the LLM ----
  const items = (llmReport.food_items || []).map((item) => {
    const grams = Math.max(0, Number(item.estimated_weight_g) || 0);
    const per100 = item.macros_per_100g || {};
    const m = grams / 100;

    const calories  = Math.round((Number(per100.calories_per_100g) || 0) * m);
    const protein_g = Math.round((Number(per100.protein_per_100g) || 0) * m);
    const carbs_g   = Math.round((Number(per100.carbs_per_100g)   || 0) * m);
    const fat_g     = Math.round((Number(per100.fat_per_100g)     || 0) * m);

    // For beverages, report the portion in ml so users see a familiar
    // serving size ("250ml" of milk instead of "258g"). Macros math still
    // runs in grams above — only the user-facing label changes.
    const isBeverage = item.is_beverage === true;
    const mlNum = Number(item.estimated_volume_ml);
    const hasMl = isBeverage && Number.isFinite(mlNum) && mlNum > 0;
    const portion_estimate = hasMl
      ? `${Math.round(mlNum)}ml`
      : `${Math.round(grams)}g`;

    return {
      name: item.name,
      macros: {
        fat_g,
        carbs_g,
        calories,
        protein_g
      },
      confidence: typeof item.confidence === 'number' ? item.confidence : null,
      visual_evidence: item.visual_evidence || null,
      portion_estimate
    };
  });

  // Clamp the LLM's scores to [0, 10] with one decimal of precision so the
  // client always gets a value in range, even if the model misbehaves.
  const clampScore = (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    return Math.max(0, Math.min(10, Math.round(v * 10) / 10));
  };

  const overall_health_score        = clampScore(llmReport.overall_health_score);
  const overall_health_score_reason = typeof llmReport.overall_health_score_reason === 'string'
    ? llmReport.overall_health_score_reason
    : null;

  let plan_match = null;
  if (hasPlan) {
    const variantRaw = typeof llmReport.plan_match_variant === 'string'
      ? llmReport.plan_match_variant.toLowerCase()
      : null;
    const variant = (variantRaw === 'main' || variantRaw === 'alternative' || variantRaw === 'none')
      ? variantRaw
      : null;
    plan_match = {
      score: clampScore(llmReport.plan_match_score),
      reason: typeof llmReport.plan_match_reason === 'string' ? llmReport.plan_match_reason : null,
      variant
    };
  }

  return {
    items,
    overall_health_score,
    overall_health_score_reason,
    plan_match
  };
}

// POST /api/food-logs/analyze-image
// Body: {
//   imageData:   string  (base64; with or without "data:image/...;base64," prefix)
//   mealLabel?:  string  (e.g. "breakfast" / "lunch" / "snack")
//   userCaption?: string (optional free-text description the user typed next to
//                         the photo, e.g. "homemade lasagna, big slice, extra
//                         cheese". Used to refine identification + portion.
//                         Whitespace is collapsed and the caption is truncated
//                         to MAX_USER_CAPTION_LENGTH characters before being
//                         injected into the prompt.)
//   planMeal?:   object  (optional — ONE entry from the client's meal plan
//                         `meals[]` array; the slice for the meal the user is
//                         logging right now, NOT the full plan).
//                         Shape: {
//                           meal?: string,             // e.g. "Breakfast"
//                           main?: {
//                             meal_name?: string,
//                             meal_title?: string,
//                             main_protein_source?: string,
//                             nutrition?: { calories, protein, carbs, fat },
//                             ingredients?: [{
//                               item, "brand of pruduct",
//                               "portionSI(gram)", household_measure,
//                               calories, protein, carbs, fat
//                             }, ...]
//                           },
//                           alternative?: { ...same shape as main }
//                         }
// }
//
// Success 200:
//   {
//     items: [
//       {
//         name: string,
//         macros: { fat_g, carbs_g, calories, protein_g },
//         confidence: number,
//         visual_evidence: string,
//         portion_estimate: string   // e.g. "120g"
//       },
//       ...
//     ],
//     overall_health_score: number | null,          // 0..10, plan-independent
//     overall_health_score_reason: string | null,
//     plan_match: null | {                          // null when no planMeal was sent
//       score: number | null,                        // 0..10
//       reason: string | null,
//       variant: "main" | "alternative" | "none" | null
//     }
//   }
//
// Not-food 422:
//   { error: 'not_food', message: <reason> }
app.post('/api/food-logs/analyze-image', async (req, res) => {
  try {
    const { imageData, mealLabel, userCaption, planMeal } = req.body || {};
    if (!imageData || typeof imageData !== 'string') {
      return res.status(400).json({ error: 'imageData (base64 string) is required' });
    }

    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const rawBuffer = Buffer.from(base64Data, 'base64');
    if (!rawBuffer.length) {
      return res.status(400).json({ error: 'imageData decoded to an empty buffer' });
    }

    let compressed;
    try {
      compressed = await compressFoodImage(rawBuffer);
    } catch (compressErr) {
      return res.status(400).json({ error: 'Could not decode/compress image', message: compressErr.message });
    }

    // Bad/empty plan payloads are silently ignored (sanitized → null) so the
    // LLM behaves as if no plan was sent rather than failing the request.
    const cleanPlanMeal = sanitizePlanMeal(planMeal);

    const prompt = buildFoodImagePrompt(mealLabel, userCaption, cleanPlanMeal);
    const llmReport = await callFoodVisionLLM(compressed, prompt);

    if (!llmReport.is_food || !Array.isArray(llmReport.food_items) || llmReport.food_items.length === 0) {
      return res.status(422).json({
        error: 'not_food',
        message: llmReport.not_food_reason || 'The provided image does not contain food items.'
      });
    }

    return res.json(buildFoodAnalysisResponseBody(llmReport, !!cleanPlanMeal));
  } catch (error) {
    console.error('❌ Error in POST /api/food-logs/analyze-image:', error);
    return res.status(500).json({
      error: 'Failed to analyze food image',
      message: error.message
    });
  }
});

// POST /api/food-logs/analyze-text
// Free-text counterpart of /analyze-image. Same response shape, same plan
// match logic, same per-100g → totals math; the only differences are
//   (a) input is a free-text food description instead of a base64 image, and
//   (b) the LLM is GPT-4o-mini (DEEPSEEK_TEXT_DEPLOYMENT, default
//       "gpt-4o-mini") on the same Azure / OpenAI-compatible endpoint as the
//       vision model.
//
// Body: {
//   text:        string  (required — the user's free-text meal description,
//                          e.g. "2 fried eggs, slice of sourdough toast with
//                          butter, large flat white with oat milk".
//                          Whitespace is collapsed and the text is truncated
//                          to MAX_FOOD_TEXT_LENGTH characters before being
//                          injected into the prompt.)
//   mealLabel?:  string  (e.g. "breakfast" / "lunch" / "snack")
//   planMeal?:   object  (optional — ONE entry from the client's meal plan
//                          `meals[]`, identical shape to /analyze-image.)
// }
//
// Success 200: identical shape to /analyze-image:
//   { items, overall_health_score, overall_health_score_reason, plan_match }
//
// Not-food 422:
//   { error: 'not_food', message: <reason> }
app.post('/api/food-logs/analyze-text', async (req, res) => {
  try {
    const { text, mealLabel, planMeal } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text (food description string) is required' });
    }

    const cleanText = sanitizeFoodText(text);
    if (!cleanText) {
      return res.status(400).json({ error: 'text is empty after sanitization' });
    }

    // Bad/empty plan payloads are silently ignored (sanitized → null) so the
    // LLM behaves as if no plan was sent rather than failing the request.
    const cleanPlanMeal = sanitizePlanMeal(planMeal);

    const prompt = buildFoodTextPrompt(mealLabel, cleanText, cleanPlanMeal);
    const llmReport = await callFoodTextLLM(prompt);

    if (!llmReport.is_food || !Array.isArray(llmReport.food_items) || llmReport.food_items.length === 0) {
      return res.status(422).json({
        error: 'not_food',
        message: llmReport.not_food_reason || 'The provided text does not describe food items.'
      });
    }

    return res.json(buildFoodAnalysisResponseBody(llmReport, !!cleanPlanMeal));
  } catch (error) {
    console.error('❌ Error in POST /api/food-logs/analyze-text:', error);
    return res.status(500).json({
      error: 'Failed to analyze food text',
      message: error.message
    });
  }
});

// ====================================
// CALENDAR EVENTS  [MOBILE APP API]
// Backs the in-app calendar screen used by the BetterChoice mobile app.
// Persists to chat_supabase → public.calendar_events.
// ====================================

// POST /api/calendar-events
// Body: {
//   userCode: string,
//   event: {
//     title:        string  (required)
//     event_date:   string  (required, ISO-8601 timestamp with timezone)
//     category?:    string
//     description?: string
//   }
// }
//
// Success 200: { data: <inserted_row> }
app.post('/api/calendar-events', assertOwnUserCode(), async (req, res) => {
  try {
    const { userCode, event } = req.body || {};

    if (!userCode) {
      return res.status(400).json({ error: 'userCode is required' });
    }
    if (!event || typeof event !== 'object') {
      return res.status(400).json({ error: 'event payload is required' });
    }

    const title = typeof event.title === 'string' ? event.title.trim() : '';
    const eventDateRaw = event.event_date;

    if (!title) {
      return res.status(400).json({ error: 'event.title is required' });
    }
    if (!eventDateRaw) {
      return res.status(400).json({ error: 'event.event_date is required' });
    }

    // Validate event_date is parseable; store as ISO-8601 so PG `timestamp with time zone` accepts it.
    const parsedDate = new Date(eventDateRaw);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'event.event_date must be a valid ISO-8601 date string' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    // Resolve chat_users.id from user_code; same pattern used by /api/food-logs.
    const { data: userData, error: userError } = await adminDB
      .from('chat_users')
      .select('id, user_code')
      .eq('user_code', userCode)
      .maybeSingle();

    if (userError) {
      console.error('Error looking up chat_users for calendar event:', userError);
      return res.status(500).json({ error: userError.message });
    }
    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    const insertData = {
      user_id: userData.id,
      user_code: userData.user_code || userCode,
      title,
      event_date: parsedDate.toISOString(),
    };
    if (event.category !== undefined && event.category !== null) {
      insertData.category = String(event.category);
    }
    if (event.description !== undefined && event.description !== null) {
      insertData.description = String(event.description);
    }

    const { data, error } = await adminDB
      .from('calendar_events')
      .insert([insertData])
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ data });
  } catch (error) {
    console.error('❌ Error in POST /api/calendar-events:', error);
    return res.status(500).json({
      error: 'Failed to create calendar event',
      message: error.message
    });
  }
});

// PUT /api/calendar-events/:id
// Edit an existing calendar event. Ownership is verified against the bearer-auth user's user_code.
// Body: { event: { title?, event_date?, category?, description? } }
// Any field omitted is left unchanged. Pass `null` to clear `category` / `description`.
//
// Success 200: { data: <updated_row> }
app.put('/api/calendar-events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { event } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: 'Calendar event id is required' });
    }
    if (!event || typeof event !== 'object') {
      return res.status(400).json({ error: 'event payload is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    if (!req.userCode || !(await verifyCalendarEventOwnership(id, req.userCode))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updateData = {};

    if (event.title !== undefined) {
      const title = typeof event.title === 'string' ? event.title.trim() : '';
      if (!title) {
        return res.status(400).json({ error: 'event.title cannot be empty' });
      }
      updateData.title = title;
    }

    if (event.event_date !== undefined) {
      const parsedDate = new Date(event.event_date);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'event.event_date must be a valid ISO-8601 date string' });
      }
      updateData.event_date = parsedDate.toISOString();
    }

    // Allow explicit null to clear these nullable columns.
    if (event.category !== undefined) {
      updateData.category = event.category === null ? null : String(event.category);
    }
    if (event.description !== undefined) {
      updateData.description = event.description === null ? null : String(event.description);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No editable fields provided' });
    }

    const { data, error } = await adminDB
      .from('calendar_events')
      .update(updateData)
      .eq('event_id', id)
      .select()
      .single();

    if (error) throw error;
    return res.json({ data });
  } catch (error) {
    console.error('❌ Error in PUT /api/calendar-events/:id:', error);
    return res.status(500).json({
      error: 'Failed to update calendar event',
      message: error.message
    });
  }
});

// DELETE /api/calendar-events/:id
// Remove a calendar event the authenticated user owns.
// Success 200: { data: <deleted_row[]> }
app.delete('/api/calendar-events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Calendar event id is required' });
    }
    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    if (!req.userCode || !(await verifyCalendarEventOwnership(id, req.userCode))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data, error } = await adminDB
      .from('calendar_events')
      .delete()
      .eq('event_id', id)
      .select();

    if (error) throw error;
    return res.json({ data });
  } catch (error) {
    console.error('❌ Error in DELETE /api/calendar-events/:id:', error);
    return res.status(500).json({
      error: 'Failed to delete calendar event',
      message: error.message
    });
  }
});

// Daily XP (view_user_daily_xp) – today's status
app.get('/api/daily-xp/today', assertOwnUserCode(), async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }
    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }
    const { data: userData, error: userError } = await adminDB
      .from('chat_users')
      .select('id')
      .eq('user_code', userCode)
      .maybeSingle();
    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await adminDB
      .from('view_user_daily_xp')
      .select('total_xp, rank_title, actual_cals, target_cals')
      .eq('user_id', userData.id)
      .eq('log_date', today)
      .maybeSingle();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error fetching daily XP (today):', error);
    res.status(500).json({ error: error.message });
  }
});




// Daily XP – weekly progress (last 7 days)
app.get('/api/daily-xp/weekly', assertOwnUserCode(), async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }
    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }
    const { data: userData, error: userError } = await adminDB
      .from('chat_users')
      .select('id')
      .eq('user_code', userCode)
      .maybeSingle();
    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { data, error } = await adminDB
      .from('view_user_daily_xp')
      .select('log_date, total_xp, rank_title')
      .eq('user_id', userData.id)
      .order('log_date', { ascending: false })
      .limit(7);
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching daily XP (weekly):', error);
    res.status(500).json({ error: error.message });
  }
});

// Get chat messages
app.get('/api/chat-messages', assertOwnUserCode(), async (req, res) => {
  try {
    const { userCode, beforeTimestamp } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    // Get user_id from chat_users
    const { data: userData, error: userError } = await adminDB
      .from('chat_users')
      .select('id')
      .eq('user_code', userCode)
      .maybeSingle();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get conversations
    const { data: conversations, error: conversationsError } = await adminDB
      .from('chat_conversations')
      .select('id')
      .eq('user_id', userData.id)
      .order('started_at', { ascending: false });

    if (conversationsError) throw conversationsError;

    if (!conversations || conversations.length === 0) {
      return res.json({ data: [] });
    }

    const conversationIds = conversations.map(conv => conv.id);
    
    let query = adminDB
      .from('chat_messages')
      .select('*')
      .in('conversation_id', conversationIds);

    if (beforeTimestamp) {
      query = query.lt('created_at', beforeTimestamp);
    }

    query = query.order('created_at', { ascending: false }).limit(20);

    const { data: messages, error: messagesError } = await query;
    if (messagesError) throw messagesError;

    res.json({ data: messages || [] });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create chat message
app.post('/api/chat-messages', assertOwnUserCode(), async (req, res) => {
  try {
    const { userCode, messageData } = req.body;
    if (!userCode || !messageData) {
      return res.status(400).json({ error: 'User code and message data are required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    // Get user_id from chat_users
    const { data: userData, error: userError } = await adminDB
      .from('chat_users')
      .select('id')
      .eq('user_code', userCode)
      .maybeSingle();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get or create conversation
    let { data: conversation, error: conversationError } = await adminDB
      .from('chat_conversations')
      .select('id')
      .eq('user_id', userData.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conversation) {
      const { data: newConversation, error: createError } = await adminDB
        .from('chat_conversations')
        .insert([{
          user_id: userData.id,
          started_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (createError) throw createError;
      conversation = newConversation;
    }

    // Create message
    const messageInsert = {
      conversation_id: conversation.id,
      role: messageData.role || 'user',
      topic: messageData.topic,
      extension: messageData.extension,
      attachments: messageData.attachments,
      created_at: new Date().toISOString()
    };

    if (messageData.role === 'assistant') {
      messageInsert.message = messageData.message;
    } else {
      messageInsert.content = messageData.content;
    }

    const { data, error } = await adminDB
      .from('chat_messages')
      .insert([messageInsert])
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error creating chat message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get weight logs
app.get('/api/weight-logs', assertOwnUserCode(), async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await adminDB
      .from('weight_logs')
      .select('*')
      .eq('user_code', userCode)
      .order('measurement_date', { ascending: true });

    if (error) throw error;
    res.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching weight logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create weight log
app.post('/api/weight-logs', assertOwnUserCode(), async (req, res) => {
  try {
    const { userCode, weightLogData } = req.body;
    if (!userCode || !weightLogData) {
      return res.status(400).json({ error: 'User code and weight log data are required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const insertData = {
      user_code: userCode,
      measurement_date: weightLogData.measurement_date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };

    if (weightLogData.weight_kg !== undefined && weightLogData.weight_kg !== null && weightLogData.weight_kg !== '') {
      insertData.weight_kg = parseFloat(weightLogData.weight_kg);
    }
    if (weightLogData.body_fat_percentage !== undefined && weightLogData.body_fat_percentage !== null && weightLogData.body_fat_percentage !== '') {
      insertData.body_fat_percentage = parseFloat(weightLogData.body_fat_percentage);
    }
    if (weightLogData.waist_circumference_cm !== undefined && weightLogData.waist_circumference_cm !== null && weightLogData.waist_circumference_cm !== '') {
      insertData.waist_circumference_cm = parseFloat(weightLogData.waist_circumference_cm);
    }
    if (weightLogData.hip_circumference_cm !== undefined && weightLogData.hip_circumference_cm !== null && weightLogData.hip_circumference_cm !== '') {
      insertData.hip_circumference_cm = parseFloat(weightLogData.hip_circumference_cm);
    }
    if (weightLogData.arm_circumference_cm !== undefined && weightLogData.arm_circumference_cm !== null && weightLogData.arm_circumference_cm !== '') {
      insertData.arm_circumference_cm = parseFloat(weightLogData.arm_circumference_cm);
    }
    if (weightLogData.neck_circumference_cm !== undefined && weightLogData.neck_circumference_cm !== null && weightLogData.neck_circumference_cm !== '') {
      insertData.neck_circumference_cm = parseFloat(weightLogData.neck_circumference_cm);
    }
// height_cm lives on weight_logs alongside chat_users.height_cm so the
    // Analytics screen can chart height over time too (children, post-op,
    // etc.). Stored only when the client actually sent a value.
    if (weightLogData.height_cm !== undefined && weightLogData.height_cm !== null && weightLogData.height_cm !== '') {
      insertData.height_cm = parseFloat(weightLogData.height_cm);
    }
    
    const { data, error } = await adminDB
      .from('weight_logs')
      .insert([insertData])
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error creating weight log:', error);
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/foods/search', async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;

    // 1. Input Validation
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Valid search query is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    // 2. Prepare Search Parameters
    // Clean the query: remove extra spaces, lower case for consistency
    const cleanQuery = query.trim();
    if (!cleanQuery) return res.json({ data: [] });

    const isHebrewQuery = /[\u0590-\u05FF]/.test(cleanQuery);
    const searchColumn = isHebrewQuery ? 'name' : 'english_name';
    
    // Split into unique words to avoid redundant filters
    const queryWords = [...new Set(cleanQuery.split(/\s+/).filter(w => w.length > 0))];
    const maxLimit = Math.min(parseInt(limit) || 20, 50); // Hard cap at 50

    // 3. Build the Database Query
    // We select specific columns to reduce payload size
    let dbQuery = adminDB
      .from('ingridientsroee')
      .select('id, name, english_name, calories_energy, protein_g, fat_g, carbohydrates_g');

    // 4. Dynamic Filtering (The "AND" Logic)
    // Instead of fetching everything and filtering in JS, we chain .ilike()
    // This tells SQL: WHERE column LIKE %word1% AND column LIKE %word2%
    queryWords.forEach(word => {
      dbQuery = dbQuery.ilike(searchColumn, `%${word}%`);
    });

    // Fetch a bit more than the limit to allow for re-sorting relevance in JS
    const { data: rawData, error } = await dbQuery.limit(maxLimit + 10);

    if (error) throw error;
    if (!rawData || rawData.length === 0) return res.json({ data: [] });

    // 5. Intelligent Sorting (Relevance)
    // We prioritize:
    // A. Exact matches
    // B. Starts with the query
    // C. Contains the query
    const lowerQuery = cleanQuery.toLowerCase();
    
    const sortedData = rawData.sort((a, b) => {
      const valA = (isHebrewQuery ? a.name : a.english_name)?.toLowerCase() || '';
      const valB = (isHebrewQuery ? b.name : b.english_name)?.toLowerCase() || '';

      // Check for Exact Match
      if (valA === lowerQuery) return -1;
      if (valB === lowerQuery) return 1;

      // Check for "Starts With"
      const aStarts = valA.startsWith(lowerQuery);
      const bStarts = valB.startsWith(lowerQuery);

      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Default to length (shorter names often more relevant)
      return valA.length - valB.length;
    });

    // 6. Transform Data
    const transformedData = sortedData.slice(0, maxLimit).map(ingredient => {
        // Fallback logic for name display
        const primaryName = isHebrewQuery ? ingredient.name : ingredient.english_name;
        const secondaryName = isHebrewQuery ? ingredient.english_name : ingredient.name;
        const displayName = primaryName || secondaryName || '';

        return {
            id: ingredient.id,
            name: displayName,
            item: displayName, // Preserving your existing structure
            english_name: ingredient.english_name || '',
            calories: Number(ingredient.calories_energy) || 0,
            protein: Number(ingredient.protein_g) || 0,
            fat: Number(ingredient.fat_g) || 0,
            carbs: Number(ingredient.carbohydrates_g) || 0,
            brand: '',
            household_measure: '',
            'portionSI(gram)': 100,
            UPC: null
        };
    });

    res.json({ data: transformedData });

  } catch (error) {
    console.error('Error searching foods:', error);
    res.status(500).json({ error: 'Internal server error processing search' });
  }
});
// OLD Search foods
// app.get('/api/foods/search', async (req, res) => {
//   try {
//     const { query, limit = 20 } = req.query;
//     if (!query) {
//       return res.status(400).json({ error: 'Search query is required' });
//     }

//     if (!adminDB) {
//       return res.status(500).json({ error: 'Chat database not configured' });
//     }

//     const isHebrewQuery = /[\u0590-\u05FF]/.test(query);
//     const queryWords = query.trim().split(/\s+/).filter(word => word.length > 0);
//     let allData = [];
    
//     if (queryWords.length === 1) {
//       const word = queryWords[0];
//       const startsWithPattern = `${word}%`;
//       const containsPattern = `%${word}%`;
//       const searchColumn = isHebrewQuery ? 'name' : 'english_name';
      
//       const { data: startsWithData } = await adminDB
//         .from('ingridientsroee')
//         .select('id, name, english_name, calories_energy, protein_g, fat_g, carbohydrates_g')
//         .ilike(searchColumn, startsWithPattern)
//         .limit(50);
      
//       if (startsWithData) {
//         allData = startsWithData;
//       }
      
//       if (allData.length < 20) {
//         const { data: containsData } = await adminDB
//           .from('ingridientsroee')
//           .select('id, name, english_name, calories_energy, protein_g, fat_g, carbohydrates_g')
//           .ilike(searchColumn, containsPattern)
//           .limit(50);
        
//         if (containsData) {
//           const existingIds = new Set(allData.map(item => item.id));
//           const newItems = containsData.filter(item => !existingIds.has(item.id));
//           allData = [...allData, ...newItems];
//         }
//       }
//     } else {
//       const searchColumn = isHebrewQuery ? 'name' : 'english_name';
//       const wordsConditions = queryWords.map(word => 
//         `${searchColumn}.ilike.%${word}%`
//       );
      
//       const { data: wordsData } = await adminDB
//         .from('ingridientsroee')
//         .select('id, name, english_name, calories_energy, protein_g, fat_g, carbohydrates_g')
//         .or(wordsConditions.join(','))
//         .limit(200);
      
//       if (wordsData) {
//         allData = wordsData.filter(item => {
//           const searchText = isHebrewQuery 
//             ? ((item.name || '').toLowerCase())
//             : ((item.english_name || '').toLowerCase());
          
//           return queryWords.every(word => 
//             searchText.includes(word.toLowerCase())
//           );
//         });
//       }
//     }
    
//     // Transform and limit data
//     const transformedData = allData.slice(0, parseInt(limit)).map(ingredient => ({
//       id: ingredient.id,
//       name: isHebrewQuery ? (ingredient.name || ingredient.english_name || '') : (ingredient.english_name || ingredient.name || ''),
//       item: isHebrewQuery ? (ingredient.name || ingredient.english_name || '') : (ingredient.english_name || ingredient.name || ''),
//       english_name: ingredient.english_name || '',
//       calories: ingredient.calories_energy || 0,
//       protein: ingredient.protein_g || 0,
//       fat: ingredient.fat_g || 0,
//       carbs: ingredient.carbohydrates_g || 0,
//       brand: '',
//       household_measure: '',
//       'portionSI(gram)': 100,
//       UPC: null
//     }));
    
//     res.json({ data: transformedData });
//   } catch (error) {
//     console.error('Error searching foods:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// Get companies with managers
app.get('/api/companies', async (req, res) => {
  try {
    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await adminDB
      .from('companies')
      .select('id, name, config, managers:profiles!profiles_company_id_fkey(id, name, role)')
      .order('name', { ascending: true });

    if (error) throw error;

    const formattedCompanies = (data || []).map((company) => ({
      id: company.id,
      name: company.name,
      config: company.config || null,
      managers: (company.managers || []).filter((manager) => manager.role === 'company_manager')
    }));

    res.json({ data: formattedCompanies });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get client company assignment
app.get('/api/client-company-assignment', async (req, res) => {
  console.log("AdminDB Key Used:", adminDBServiceRoleKey ? "Key exists" : "Key missing");
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data: chatUserData, error: chatUserError } = await adminDB
      .from('chat_users')
      .select('provider_id')
      .eq('user_code', userCode)
      .maybeSingle();

    if (chatUserError && chatUserError.code !== 'PGRST116') throw chatUserError;

    const providerId = chatUserData?.provider_id || null;
    if (!providerId) {
      return res.json({
        data: {
          provider_id: null,
          provider: null,
          company: null
        }
      });
    }

    const { data: providerData, error: providerError } = await adminDB
      .from('profiles')
      .select('id, name, company_id')
      .eq('id', providerId)
      .maybeSingle();

    if (providerError && providerError.code !== 'PGRST116') throw providerError;

    let companyData = null;
    if (providerData?.company_id) {
      const { data: companyRow, error: companyError } = await adminDB
        .from('companies')
        .select('id, name, config')
        .eq('id', providerData.company_id)
        .maybeSingle();

      if (companyError && companyError.code !== 'PGRST116') throw companyError;
      companyData = companyRow || null;
    }

    res.json({
      data: {
        provider_id: providerId,
        provider: providerData || null,
        company: companyData
      }
    });
  } catch (error) {
    console.error('Error fetching client assignment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Assign client to company
app.post('/api/assign-client-company', async (req, res) => {
  try {
    const { userCode, companyId } = req.body;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    let managerId = null;

    if (companyId) {
      const { data: manager, error: managerError } = await adminDB
        .from('profiles')
        .select('id')
        .eq('company_id', companyId)
        .eq('role', 'company_manager')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (managerError) throw managerError;

      if (!manager) {
        return res.status(404).json({ error: 'No manager found for the selected company' });
      }

      managerId = manager.id;
    }

    const { data, error } = await adminDB
      .from('chat_users')
      .update({ provider_id: managerId })
      .eq('user_code', userCode)
      .select('provider_id')
      .maybeSingle();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error assigning client to company:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get training plan by user code
app.get('/api/training-plan', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await adminDB
      .from('training_plans')
      .select('*')
      .eq('user_code', userCode)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error fetching training plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get meal plan by user code
app.get('/api/meal-plan', assertOwnUserCode(), async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await adminDB
      .from('meal_plans_and_schemas')
      .select('*')
      .eq('user_code', userCode)
      .eq('record_type', 'meal_plan')
      .eq('status', 'active')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error fetching meal plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get meal plan schemas
app.get('/api/meal-plan-schemas', async (req, res) => {
  try {
    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await adminDB
      .from('meal_plans_and_schemas')
      .select('*')
      .eq('record_type', 'schema')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error fetching meal plan schemas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create meal plan
app.post('/api/meal-plan', async (req, res) => {
  try {
    const { dietitianId, userCode, mealPlanData } = req.body;
    if (!userCode || !mealPlanData) {
      return res.status(400).json({ error: 'User code and meal plan data are required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await adminDB
      .from('meal_plans_and_schemas')
      .insert([{
        record_type: 'meal_plan',
        dietitian_id: dietitianId,
        user_code: userCode,
        meal_plan_name: mealPlanData.meal_plan_name,
        meal_plan: mealPlanData.meal_plan,
        status: mealPlanData.status || 'draft',
        active_from: mealPlanData.active_from,
        active_until: mealPlanData.active_until,
        daily_total_calories: mealPlanData.daily_total_calories,
        macros_target: mealPlanData.macros_target,
        recommendations: mealPlanData.recommendations,
        dietary_restrictions: mealPlanData.dietary_restrictions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error creating meal plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update meal plan
app.put('/api/meal-plan/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { mealPlanData } = req.body;
    
    if (!mealPlanData) {
      return res.status(400).json({ error: 'Meal plan data is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await adminDB
      .from('meal_plans_and_schemas')
      .update({
        meal_plan_name: mealPlanData.meal_plan_name,
        meal_plan: mealPlanData.meal_plan,
        status: mealPlanData.status,
        active_from: mealPlanData.active_from,
        active_until: mealPlanData.active_until,
        daily_total_calories: mealPlanData.daily_total_calories,
        macros_target: mealPlanData.macros_target,
        recommendations: mealPlanData.recommendations,
        dietary_restrictions: mealPlanData.dietary_restrictions,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error updating meal plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get meal plan history
app.get('/api/meal-plan-history', assertOwnUserCode(), async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await adminDB
      .from('meal_plans_and_schemas')
      .select('*')
      .eq('user_code', userCode)
      .eq('record_type', 'meal_plan')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error fetching meal plan history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get messages
app.get('/api/messages', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await adminDB
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send message
app.post('/api/messages', async (req, res) => {
  try {
    const { userId, messageData } = req.body;
    if (!userId || !messageData) {
      return res.status(400).json({ error: 'User ID and message data are required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await adminDB
      .from('messages')
      .insert([{
        user_id: userId,
        ...messageData,
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark message as read
app.put('/api/messages/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await adminDB
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get food by ID
app.get('/api/foods/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await adminDB
      .from('ingridientsroee')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error fetching food by ID:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug meal plans
app.get('/api/debug/meal-plans', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data: allPlans, error: allError } = await adminDB
      .from('meal_plans_and_schemas')
      .select('*')
      .eq('user_code', userCode)
      .eq('record_type', 'meal_plan');

    const { data: allPlansInDb, error: allDbError } = await adminDB
      .from('meal_plans_and_schemas')
      .select('user_code, status, record_type, meal_plan_name')
      .eq('record_type', 'meal_plan')
      .limit(10);

    res.json({ data: { allPlans, allPlansInDb }, allError, allDbError });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Onboarding resume status ────────────────────────────────────────────
// Auth-protected. Returns the onboarding completion flag, the step the user
// should resume from, and enough pre-filled data to seed the wizard.
//
// GET /api/onboarding/status
// Returns: { completed: bool, step: 0-6, resumeData: object }
// ─────────────────────────────────────────────────────────────────────────
app.get('/api/onboarding/status', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { data: client, error: clientErr } = await clientDB
      .from('clients')
      .select(
        'first_name, last_name, phone, user_language, region, city, timezone, birth_date, gender, height, current_weight, target_weight, goal, measurement_system, medical_conditions, activity_level, food_allergies, food_limitations, onboarding_completed, user_code',
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (clientErr && clientErr.code !== 'PGRST116') {
      console.error('onboarding/status: clients query error:', clientErr.message);
      return res.status(500).json({ error: clientErr.message });
    }

    if (!client) {
      return res.json({ completed: false, step: 0, resumeData: {} });
    }

    let chatUser = null;
    if (client.user_code && adminDB) {
      const { data: cu } = await adminDB
        .from('chat_users')
        .select(
          'user_language, Activity_level, medical_conditions, user_context, first_meal_time, last_meal_time, base_daily_total_calories, macros, onboarding_done, nursing_status, date_of_birth',
        )
        .eq('user_code', client.user_code)
        .maybeSingle();
      chatUser = cu;
    }

    const completed = Boolean(client.onboarding_completed || chatUser?.onboarding_done);
    if (completed) {
      return res.json({ completed: true, step: 6, resumeData: {} });
    }

    const foodAllergies = typeof client.food_allergies === 'string'
      ? client.food_allergies.split(',').map((s) => s.trim()).filter(Boolean)
      : Array.isArray(client.food_allergies) ? client.food_allergies : [];

    const foodLimitations = Array.isArray(client.food_limitations)
      ? client.food_limitations
      : typeof client.food_limitations === 'string'
        ? client.food_limitations.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

    let protein = null;
    let carbs = null;
    let fat = null;
    if (chatUser?.macros && typeof chatUser.macros === 'object') {
      const m = chatUser.macros;
      protein = typeof m.protein === 'number' ? m.protein : null;
      carbs   = typeof m.carbs   === 'number' ? m.carbs   : null;
      fat     = typeof m.fat     === 'number' ? m.fat     : null;
    }

    const resumeData = {
      language:             client.user_language || chatUser?.user_language || 'en',
      firstName:            client.first_name || '',
      lastName:             client.last_name  || '',
      region:               client.region     || '',
      city:                 client.city       || '',
      timezone:             client.timezone   || '',
      dateOfBirth:          client.birth_date || chatUser?.date_of_birth || '',
      gender:               client.gender     || 'other',
      physiologicalState:   chatUser?.nursing_status || 'none',
      unitSystem:           client.measurement_system || 'metric',
      heightCm:             client.height         ?? null,
      weightKg:             client.current_weight ?? null,
      targetWeightKg:       client.target_weight  ?? null,
      goal:                 client.goal           ?? null,
      medicalConditions:    client.medical_conditions || chatUser?.medical_conditions || '',
      activityLevel:        client.activity_level  || chatUser?.Activity_level || null,
      activityDescription:  chatUser?.user_context || '',
      foodAllergies,
      foodLimitations,
      eatingWindowStart:    chatUser?.first_meal_time || '07:00',
      eatingWindowEnd:      chatUser?.last_meal_time  || '21:00',
      dailyCalories:        chatUser?.base_daily_total_calories ?? null,
      protein,
      carbs,
      fat,
    };

    // First incomplete step (0 = Basics … 6 = Plan)
    let step = 0;
    if (resumeData.firstName) step = 1;
    if (step >= 1 && resumeData.region && resumeData.dateOfBirth) step = 2;
    if (step >= 2 && resumeData.heightCm != null && resumeData.weightKg != null && resumeData.goal) step = 3;
    if (step >= 3 && resumeData.activityDescription) step = 4;
    if (step >= 4 && resumeData.activityLevel) step = 5;
    if (step >= 5 && resumeData.dailyCalories != null) step = 6;

    return res.json({ completed: false, step, resumeData });
  } catch (error) {
    console.error('GET /api/onboarding/status error:', error);
    res.status(500).json({ error: error.message || 'Failed to load onboarding status' });
  }
});

// ====================================
// REGISTRATION LINKS API (find + increment)
// Used by SignupPage for #d=base64(JSON{link_id,manager_id,...}) and #d=base64(manager_id).
// ====================================

app.post('/api/db/registration-links/find', async (req, res) => {
  try {
    const { link_id, manager_id } = req.body || {};
    if (!link_id && !manager_id) {
      return res.status(400).json({ error: 'Either link_id or manager_id is required' });
    }
    // registration_rules lives in the secondary (chat) Supabase project
    if (!adminDB) {
      return res.status(503).json({ error: 'Registration links require CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY' });
    }
    const regDb = adminDB;
    let row = null;
    if (link_id) {
      const { data, error } = await regDb
        .from('registration_rules')
        .select('id, link_id, manager_id, max_slots, current_count, expires_at, is_active')
        .eq('link_id', link_id)
        .maybeSingle();
      if (!error) row = data;
    } else {
      const { data, error } = await regDb
        .from('registration_rules')
        .select('id, manager_id, max_slots, current_count, expires_at, is_active')
        .eq('manager_id', manager_id)
        .maybeSingle();
      if (!error) row = data;
    }
    if (!row) {
      return res.status(404).json({ error: 'Registration link not found' });
    }
    return res.json({ ...row, link_id: row.link_id ?? null });
  } catch (e) {
    console.error('Error in registration-links find:', e);
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/db/registration-links/find?link_id=... or ?manager_id=... (same logic as POST, for flexibility)
app.get('/api/db/registration-links/find', async (req, res) => {
  try {
    const link_id = req.query.link_id || null;
    const manager_id = req.query.manager_id || null;
    if (!link_id && !manager_id) {
      return res.status(400).json({ error: 'Either link_id or manager_id is required (query: ?link_id= or ?manager_id=)' });
    }
    if (!adminDB) {
      return res.status(503).json({ error: 'Registration links require CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY' });
    }
    const regDb = adminDB;
    let row = null;
    if (link_id) {
      const { data, error } = await regDb.from('registration_rules')
        .select('id, link_id, manager_id, max_slots, current_count, expires_at, is_active')
        .eq('link_id', link_id).maybeSingle();
      if (!error) row = data;
    } else {
      const { data, error } = await regDb.from('registration_rules')
        .select('id, manager_id, max_slots, current_count, expires_at, is_active')
        .eq('manager_id', manager_id).maybeSingle();
      if (!error) row = data;
    }
    if (!row) return res.status(404).json({ error: 'Registration link not found' });
    return res.json({ ...row, link_id: row.link_id ?? null });
  } catch (e) {
    console.error('Error in registration-links find (GET):', e);
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/db/registration-links/:idOrLinkId/increment', async (req, res) => {
  try {
    const { idOrLinkId } = req.params;
    if (!idOrLinkId) return res.status(400).json({ error: 'idOrLinkId is required' });
    if (!adminDB) {
      return res.status(503).json({ error: 'Registration links require CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY' });
    }
    const regDb = adminDB;
    const isNumericId = /^\d+$/.test(String(idOrLinkId));
    let q = regDb.from('registration_rules').select('id, current_count');
    if (isNumericId) q = q.eq('id', parseInt(idOrLinkId, 10));
    else q = q.eq('link_id', idOrLinkId);
    const { data: existing, error: fetchErr } = await q.maybeSingle();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Registration link not found' });
    const newCount = (existing.current_count || 0) + 1;
    let upd = regDb.from('registration_rules').update({ current_count: newCount });
    if (isNumericId) upd = upd.eq('id', parseInt(idOrLinkId, 10));
    else upd = upd.eq('link_id', idOrLinkId);
    const { error: updateErr } = await upd;
    if (updateErr) {
      console.error('Error incrementing registration link:', updateErr);
      return res.status(500).json({ error: 'Failed to increment' });
    }
    return res.json({ ok: true, current_count: newCount });
  } catch (e) {
    console.error('Error in registration-links increment:', e);
    return res.status(500).json({ error: e.message });
  }
});
// ===================================================================
// POST /api/health/ingest
// Body: { events: HealthEventInput[] }
// Inserts raw events + upserts the daily summary in one round-trip.
// ===================================================================
// ===== Health ingest helpers =====
const HEALTH_MAX_EVENTS_PER_REQUEST = 500;

function isIsoDate(v) {
  if (typeof v !== 'string') return false;
  return Number.isFinite(Date.parse(v));
}

function isYmd(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function validateHealthEvent(raw, idx) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: `events[${idx}]: must be an object` };
  }
  const { metric_type, start_time, end_time, summary_value, unit, date, payload } = raw;
  if (typeof metric_type !== 'string' || !metric_type.trim()) {
    return { ok: false, error: `events[${idx}]: metric_type required` };
  }
  if (!isIsoDate(start_time) || !isIsoDate(end_time)) {
    return { ok: false, error: `events[${idx}]: start_time/end_time must be ISO timestamps` };
  }
  if (Date.parse(end_time) < Date.parse(start_time)) {
    return { ok: false, error: `events[${idx}]: end_time before start_time` };
  }
  if (summary_value != null && !Number.isFinite(Number(summary_value))) {
    return { ok: false, error: `events[${idx}]: summary_value must be numeric` };
  }
  if (unit != null && typeof unit !== 'string') {
    return { ok: false, error: `events[${idx}]: unit must be a string` };
  }
  if (date != null && !isYmd(date)) {
    return { ok: false, error: `events[${idx}]: date must be YYYY-MM-DD` };
  }
  if (payload != null && (typeof payload !== 'object' || Array.isArray(payload))) {
    return { ok: false, error: `events[${idx}]: payload must be an object` };
  }
  return {
    ok: true,
    value: {
      metric_type: metric_type.trim().toLowerCase(),
      start_time,
      end_time,
      summary_value: summary_value != null ? Number(summary_value) : null,
      unit: unit || null,
      date: date || start_time.slice(0, 10),
      payload: payload || {},
    },
  };
}
app.post('/api/health/ingest', async (req, res) => {
  try {
    if (!adminDB) {
      console.error('[health/ingest] adminDB not configured');
      return res.status(503).json({ error: 'Health storage not configured' });
    }

    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const raw = Array.isArray(req.body?.events) ? req.body.events : null;
    if (!raw) {
      return res.status(400).json({ error: 'Body must include `events` array' });
    }
    if (raw.length === 0) {
      return res.json({ ok: true, inserted: 0, summarized: 0 });
    }
    if (raw.length > HEALTH_MAX_EVENTS_PER_REQUEST) {
      return res.status(413).json({
        error: `Too many events; max ${HEALTH_MAX_EVENTS_PER_REQUEST} per request`,
      });
    }

    const events = [];
    for (let i = 0; i < raw.length; i++) {
      const result = validateHealthEvent(raw[i], i);
      if (!result.ok) return res.status(400).json({ error: result.error });
      events.push(result.value);
    }

    // 1) Raw events — dedupe on (user_id, metric_type, start_time, end_time).
    const eventRows = events.map((e) => ({
      user_id: userId,
      user_code: req.userCode || null,
      metric_type: e.metric_type,
      start_time: e.start_time,
      end_time: e.end_time,
      summary_value: e.summary_value,
      unit: e.unit,
      payload: e.payload,
    }));

    const { error: insertErr } = await adminDB
      .from('user_health_events')
      .upsert(eventRows, {
        onConflict: 'user_id,metric_type,start_time,end_time',
        ignoreDuplicates: true,
      });

    if (insertErr) {
      console.error('[health/ingest] events insert failed:', insertErr);
      return res.status(500).json({ error: 'Failed to store events' });
    }

    // 2) Daily summary — device sends authoritative daily total so we REPLACE.
    const summaryMap = new Map();
    for (const e of events) {
      const key = `${e.date}|${e.metric_type}`;
      const prev = summaryMap.get(key);
      if (prev) {
        prev.total_value += Number(e.summary_value || 0);
        prev.sample_count += 1;
      } else {
        summaryMap.set(key, {
          user_id: userId,
          user_code: req.userCode || null,
          date: e.date,
          metric_type: e.metric_type,
          total_value: Number(e.summary_value || 0),
          unit: e.unit,
          sample_count: 1,
          payload: {},
          updated_at: new Date().toISOString(),
        });
      }
    }

    const summaryRows = Array.from(summaryMap.values());
    const { error: summaryErr } = await adminDB
      .from('user_health_daily_summary')
      .upsert(summaryRows, { onConflict: 'user_id,date,metric_type' });

    if (summaryErr) {
      console.error('[health/ingest] summary upsert failed:', summaryErr);
      return res.status(500).json({ error: 'Failed to update summary' });
    }

    return res.json({
      ok: true,
      inserted: eventRows.length,
      summarized: summaryRows.length,
    });
  } catch (err) {
    console.error('[health/ingest] unexpected error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ===================================================================
// GET /api/health/summary?metric_type=steps&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
// Pre-aggregated daily totals — single indexed lookup, no JSONB parsing.
// ===================================================================
app.get('/api/health/summary', async (req, res) => {
  try {
    if (!adminDB) {
      return res.status(503).json({ error: 'Health storage not configured' });
    }

    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const metric_type = String(req.query.metric_type || '').trim().toLowerCase();
    const start_date = String(req.query.start_date || '').trim();
    const end_date = String(req.query.end_date || '').trim();

    if (!metric_type) return res.status(400).json({ error: 'metric_type required' });
    if (!isYmd(start_date) || !isYmd(end_date)) {
      return res.status(400).json({ error: 'start_date / end_date must be YYYY-MM-DD' });
    }

    const { data, error } = await adminDB
      .from('user_health_daily_summary')
      .select('date, metric_type, total_value, unit, sample_count, user_code')
      .eq('user_id', userId)
      .eq('metric_type', metric_type)
      .gte('date', start_date)
      .lte('date', end_date)
      .order('date', { ascending: true });

    if (error) {
      console.error('[health/summary] query failed:', error);
      return res.status(500).json({ error: 'Query failed' });
    }

    res.json({ data: data || [] });
  } catch (err) {
    console.error('[health/summary] unexpected error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});
// ====================================
// AUTH API ROUTES
// ====================================

// Sign up with email and password
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, userData = {}, invitationToken, providerId, managerLinkData } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    console.log('📝 Attempting signup for email:', email);

    // Check if email already exists
    const normalizedEmail = email.toLowerCase().trim();
    const { data: existingClient } = await clientDB
      .from('clients')
      .select('email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingClient) {
      return res.status(400).json({ 
        error: 'This email is already registered. Please use a different email or login.',
        code: 400
      });
    }

    // Resolve registration link: #d=base64(JSON{link_id,manager_id,...}) or #d=base64(manager_id) or legacy integer id.
    // registration_rules is in the secondary (chat) Supabase project only.
    const regDb = adminDB;
    let managerId = null;
    let registrationRule = null;
    let linkIdFromToken = null;
    let managerIdFromToken = null;

    if (invitationToken) {
      try {
        const decoded = Buffer.from(invitationToken, 'base64').toString('utf-8');
        try {
          const obj = JSON.parse(decoded);
          if (obj && obj.link_id) { linkIdFromToken = obj.link_id; managerIdFromToken = obj.manager_id || null; }
          else if (obj && obj.manager_id) managerIdFromToken = obj.manager_id;
        } catch (_) { managerIdFromToken = decoded; }
      } catch (_) {}
    }
    if (!linkIdFromToken && managerLinkData?.link_id) linkIdFromToken = managerLinkData.link_id;
    if (!managerIdFromToken && managerLinkData?.manager_id) managerIdFromToken = managerLinkData.manager_id;

    if (linkIdFromToken || managerIdFromToken) {
      if (!regDb) {
        return res.status(503).json({ error: 'Registration links require CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY' });
      }
      try {
        let row = null;
        if (linkIdFromToken) {
          const { data, error } = await regDb.from('registration_rules')
            .select('id, link_id, manager_id, max_slots, current_count, expires_at, is_active')
            .eq('link_id', linkIdFromToken).maybeSingle();
          if (!error) row = data;
        } else {
          const numericId = /^\d+$/.test(String(managerIdFromToken)) ? parseInt(managerIdFromToken, 10) : null;
          if (numericId != null) {
            const { data } = await regDb.from('registration_rules')
              .select('id, manager_id, max_slots, current_count, expires_at, is_active')
              .eq('id', numericId).maybeSingle();
            row = data;
          }
          if (!row) {
            const { data } = await regDb.from('registration_rules')
              .select('id, manager_id, max_slots, current_count, expires_at, is_active')
              .eq('manager_id', managerIdFromToken).maybeSingle();
            row = data;
          }
        }
        if (row) {
          if (!row.is_active) return res.status(400).json({ error: 'This registration link is no longer active', code: 400 });
          if (row.expires_at && new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'This registration link has expired', code: 400 });
          if (row.max_slots != null && (row.current_count || 0) >= row.max_slots) return res.status(400).json({ error: `This registration link has reached the maximum number of slots (${row.max_slots})`, code: 400 });
          if (adminDB) {
            const { data: managerExists, error: me } = await adminDB.from('profiles').select('id').eq('id', row.manager_id).maybeSingle();
            if (me || !managerExists) return res.status(400).json({ error: 'Invalid manager ID in registration link', code: 400 });
          }
          registrationRule = row;
          managerId = row.manager_id;
          console.log('✅ Registration link validated:', { id: row.id, link_id: row.link_id, manager_id: managerId });
        } else if (managerIdFromToken) {
          // Simple dietitian ID link (#d=base64(dietitian_id)): unlimited, no registration_rules row, no DB check
          managerId = managerIdFromToken;
          console.log('✅ Using dietitian ID from link (unlimited):', managerId);
        }
      } catch (e) { console.error('⚠️ Error resolving registration link:', e); }
    }

    // Validate invitation token if provided (for regular waiting list invitations)
    // Skip when managerId is set (dietitian-only/unlimited link) — token is just the dietitian ID, not a waiting_list token
    if (invitationToken && !registrationRule && !managerId) {
      try {
        // Decode the token (it's base64 encoded UUID)
        const decodedToken = Buffer.from(invitationToken, 'base64').toString('utf-8');
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        
        if (uuidRegex.test(decodedToken)) {
          const { data: invitationData } = await adminDB
            .from('waiting_list')
            .select('id, email, invitation_used_at')
            .eq('invitation_token', decodedToken)
            .maybeSingle();

          if (!invitationData) {
            return res.status(400).json({ 
              error: 'Invalid invitation token',
              code: 400
            });
          }

          if (invitationData.invitation_used_at) {
            return res.status(400).json({ 
              error: 'This invitation has already been used',
              code: 400
            });
          }
        }
      } catch (tokenError) {
        console.error('⚠️ Error validating invitation token:', tokenError);
        // Continue without token validation if it fails (for backward compatibility)
      }
    }

    // Sign up using Supabase Auth client (with anon key)
    const { data: signupData, error: signupError } = await supabaseAuth.auth.signUp({
      email: normalizedEmail,
      password: password,
      options: {
        data: {
          first_name: userData.first_name,
          last_name: userData.last_name,
          phone: userData.phone,
          newsletter: userData.newsletter,
          full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
        }
      }
    });

    if (signupError) {
      console.error('❌ Signup error:', signupError.message);
      return res.status(400).json({ 
        error: signupError.message || 'Failed to create account',
        code: signupError.status || 400
      });
    }

    if (!signupData || !signupData.user) {
      return res.status(400).json({ 
        error: 'Failed to create user account',
        code: 400
      });
    }

    console.log('✅ Signup successful for user:', signupData.user.id);

    // Increment: find row by link_id (when limited) or id, then update both current_count and is_active.
    if (registrationRule && regDb) {
      try {
        const linkIdToUse = linkIdFromToken || registrationRule.link_id;
        const useLinkId = !!linkIdToUse;
        // 1) Find row by link_id or id to read current_count
        let q = regDb.from('registration_rules').select('current_count, max_slots, is_active');
        if (useLinkId) q = q.eq('link_id', linkIdToUse); else q = q.eq('id', registrationRule.id);
        const { data: cur, error: fe } = await q.maybeSingle();
        if (fe) {
          console.error('❌ Error fetching registration_rules for increment:', fe.message, fe.code);
        } else if (cur != null) {
          const newCount = (cur.current_count || 0) + 1;
          const setInactive = (cur.max_slots != null) && (newCount >= cur.max_slots);
          const updatePayload = { current_count: newCount };
          if (setInactive) updatePayload.is_active = false;
          // 2) Update: current_count always, is_active when link is full (same WHERE: link_id or id)
          let upd = regDb.from('registration_rules').update(updatePayload);
          if (useLinkId) upd = upd.eq('link_id', linkIdToUse); else upd = upd.eq('id', registrationRule.id);
          const { error: ue } = await upd;
          if (ue) {
            console.error('❌ Error incrementing registration link:', ue.message, ue.code, ue.details);
          } else {
            console.log('✅ Registration link incremented (signup):', useLinkId ? { link_id: linkIdToUse } : { id: registrationRule.id }, 'new_count:', newCount, updatePayload.is_active === false ? ', is_active=false' : '');
          }
        } else {
          console.warn('⚠️ registration_rules row not found for increment:', useLinkId ? { link_id: linkIdToUse } : { id: registrationRule.id });
        }
      } catch (e) {
        console.error('❌ Exception incrementing registration link:', e);
      }
    }

    // Generate unique user code
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let userCode = null;
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts && !userCode) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += letters.charAt(Math.floor(Math.random() * letters.length));
      }

      const { data: codeCheck } = await clientDB
        .from('clients')
        .select('user_code')
        .eq('user_code', code)
        .maybeSingle();

      if (!codeCheck) {
        userCode = code;
        break;
      }
      attempts++;
    }

    if (!userCode) {
      console.error('❌ Failed to generate unique user code');
      return res.status(500).json({ 
        error: 'Failed to generate unique user code',
        code: 500
      });
    }

    // Determine final provider ID
    // Priority: manager_id from manager link > providerId from request > default provider
    let finalProviderId = null;
    
    if (managerId) {
      // Use manager_id from manager link
      finalProviderId = managerId;
      console.log('✅ Using manager ID from link:', managerId);
    } else if (providerId && (typeof providerId === 'string' && providerId.trim().length > 0)) {
      // Use provided providerId (legacy support)
      finalProviderId = providerId.trim();
      console.log('✅ Using provided provider ID:', finalProviderId);
    } else {
      // Get default provider
      if (adminDB) {
        const betterChoiceCompanyId = '4ab37b7b-dff1-4ee5-9920-0281e0c6468a';
        const { data: defaultManagerData } = await adminDB
          .from('profiles')
          .select('id')
          .eq('company_id', betterChoiceCompanyId)
          .eq('role', 'company_manager')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (defaultManagerData) {
          finalProviderId = defaultManagerData.id;
          console.log('✅ Using default provider ID:', finalProviderId);
        }
      }
    }

    // Normalize phone number
    const normalizePhoneForDatabase = (phone) => {
      if (!phone) return '';
      return phone.replace(/[\s\-\(\)\.]/g, '');
    };
    const normalizedPhone = userData.phone ? normalizePhoneForDatabase(userData.phone) : null;

    // Create client record
    const clientInsertData = {
      user_id: signupData.user.id,
      full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      user_code: userCode,
      status: 'active'
    };

    const { data: clientData, error: clientError } = await clientDB
      .from('clients')
      .insert([clientInsertData])
      .select();

    if (clientError) {
      console.error('❌ Error creating client record:', clientError);
      return res.status(500).json({ 
        error: 'Account created but failed to create client record. Please contact support.',
        code: 500
      });
    }

    // Create chat_users record if secondary DB is available
    let chatUserCreated = false;
    let chatUserDataResult = null;

    if (adminDB && clientData && clientData[0]) {
      try {
        const chatUserData = {
          user_code: userCode,
          full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
          email: normalizedEmail,
          phone_number: normalizedPhone,
          whatsapp_number: normalizedPhone,
          platform: userData.platform || 'whatsapp',
          provider_id: finalProviderId || null,
          activated: true,
          is_verified: false,
          language: 'en',
          created_at: new Date().toISOString()
        };

        const { data: chatUserResult, error: chatUserError } = await adminDB
          .from('chat_users')
          .insert([chatUserData])
          .select();

        if (!chatUserError) {
          chatUserCreated = true;
          chatUserDataResult = chatUserResult;
        }
      } catch (chatError) {
        console.error('⚠️ Error creating chat user (non-critical):', chatError);
      }
    }


    // Mark invitation as used if token was provided (for waiting list invitations)
    if (invitationToken && !registrationRule) {
      try {
        const decodedToken = Buffer.from(invitationToken, 'base64').toString('utf-8');
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        
        if (uuidRegex.test(decodedToken)) {
          await adminDB
            .from('waiting_list')
            .update({ 
              invitation_used_at: new Date().toISOString()
            })
            .eq('invitation_token', decodedToken);
        }
      } catch (tokenError) {
        console.error('⚠️ Error marking invitation as used (non-critical):', tokenError);
      }
    }

    console.log('✅ Client record created successfully');

    // Return signup data
    res.json({
      data: {
        user: signupData.user,
        session: signupData.session
      },
      client: clientData && clientData[0] ? clientData[0] : null,
      chatUserCreated,
      chatUserData: chatUserDataResult,
      error: null
    });

  } catch (error) {
    console.error('❌ Unexpected signup error:', error);
    res.status(500).json({ 
      error: error.message || 'An error occurred during signup',
      code: 500
    });
  }
});

// Sign in with email and password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    console.log('🔐 Attempting login for email:', email);

    // Sign in using Supabase Auth client (with anon key)
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: password
    });

    if (error) {
      console.error('❌ Login error:', error.message);
      return res.status(401).json({ 
        error: error.message || 'Invalid email or password',
        code: error.status || 401
      });
    }

    if (!data || !data.user) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        code: 401
      });
    }

    console.log('✅ Login successful for user:', data.user.id);
    await ensureClientLinkedToAuthUser(data.user.id, data.user.email);

    // Fetch user's language preference directly from database
    let languageData = null;
    try {
      const { data: clientData, error: clientError } = await clientDB
        .from('clients')
        .select('user_language')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (!clientError && clientData) {
        languageData = clientData;
      }
    } catch (langError) {
      console.error('⚠️ Error fetching language preference (non-critical):', langError);
      // Continue even if language fetch fails
    }

    // Return session data and user info
    res.json({
      data: {
        user: data.user,
        session: data.session
      },
      language: languageData,
      error: null
    });

  } catch (error) {
    console.error('❌ Unexpected login error:', error);
    res.status(500).json({ 
      error: error.message || 'An error occurred during login',
      code: 500
    });
  }
});

// Check if email exists
app.post('/api/auth/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase();
    
    // Check PRIMARY database (clients table)
    const { data: primaryData, error: primaryError } = await clientDB
      .from('clients')
      .select('email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (primaryError && primaryError.code !== 'PGRST116') {
      throw primaryError;
    }

    if (primaryData) {
      return res.json({ exists: true });
    }

    // Check SECONDARY database (chat_users table)
    if (adminDB) {
      const { data: secondaryData, error: secondaryError } = await adminDB
        .from('chat_users')
        .select('email')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (secondaryError && secondaryError.code !== 'PGRST116') {
        throw secondaryError;
      }

      if (secondaryData) {
        return res.json({ exists: true });
      }
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if phone exists
app.post('/api/auth/check-phone', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone is required' });
    }

    // Check PRIMARY database (clients table)
    const { data: primaryData, error: primaryError } = await clientDB
      .from('clients')
      .select('phone')
      .eq('phone', phone)
      .maybeSingle();

    if (primaryError && primaryError.code !== 'PGRST116') {
      throw primaryError;
    }

    if (primaryData) {
      return res.json({ exists: true });
    }

    // Check SECONDARY database (chat_users table)
    if (adminDB) {
      const { data: secondaryDataByPhone, error: secondaryError1 } = await adminDB
        .from('chat_users')
        .select('phone_number, whatsapp_number')
        .eq('phone_number', phone)
        .maybeSingle();

      if (secondaryError1 && secondaryError1.code !== 'PGRST116') {
        throw secondaryError1;
      }

      if (secondaryDataByPhone) {
        return res.json({ exists: true });
      }

      const { data: secondaryDataByWhatsApp, error: secondaryError2 } = await adminDB
        .from('chat_users')
        .select('phone_number, whatsapp_number')
        .eq('whatsapp_number', phone)
        .maybeSingle();

      if (secondaryError2 && secondaryError2.code !== 'PGRST116') {
        throw secondaryError2;
      }

      if (secondaryDataByWhatsApp) {
        return res.json({ exists: true });
      }
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('Error checking phone:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if user code exists
app.post('/api/auth/check-user-code', async (req, res) => {
  try {
    const { userCode } = req.body;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    // Check PRIMARY database
    const { data: primaryData, error: primaryError } = await clientDB
      .from('clients')
      .select('user_code')
      .eq('user_code', userCode)
      .maybeSingle();

    if (primaryError && primaryError.code !== 'PGRST116') {
      throw primaryError;
    }

    if (primaryData) {
      return res.json({ exists: true });
    }

    // Check SECONDARY database
    if (adminDB) {
      const { data: secondaryData, error: secondaryError } = await adminDB
        .from('chat_users')
        .select('user_code')
        .eq('user_code', userCode)
        .maybeSingle();

      if (secondaryError && secondaryError.code !== 'PGRST116') {
        throw secondaryError;
      }

      if (secondaryData) {
        return res.json({ exists: true });
      }
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('Error checking user code:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check registration rule availability (for frontend validation)
app.get('/api/auth/check-registration-rule', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    try {
      const decodedToken = Buffer.from(token, 'base64').toString('utf-8');
      
      // Check if it's an integer (registration rule ID - SERIAL)
      const integerId = parseInt(decodedToken, 10);
      let registrationRule = null;
      
      if (!isNaN(integerId) && integerId > 0) {
        // Look up by ID
        const { data, error } = await adminDB
          .from('registration_rules')
          .select('id, manager_id, max_slots, current_count, expires_at, is_active')
          .eq('id', integerId)
          .maybeSingle();
        
        if (!error && data) {
          registrationRule = data;
        }
      } else {
        // Look up by manager_id (VARCHAR)
        const { data, error } = await adminDB
          .from('registration_rules')
          .select('id, manager_id, max_slots, current_count, expires_at, is_active')
          .eq('manager_id', decodedToken)
          .maybeSingle();
        
        if (!error && data) {
          registrationRule = data;
        }
      }

      if (!registrationRule) {
        return res.status(404).json({ 
          error: 'Registration rule not found',
          available: false
        });
      }

      // Check if rule is active
      if (!registrationRule.is_active) {
        return res.status(400).json({ 
          error: 'This registration link is no longer active',
          available: false,
          is_active: false
        });
      }

      // Check expiry date
      if (registrationRule.expires_at) {
        const expiryDate = new Date(registrationRule.expires_at);
        const now = new Date();
        if (expiryDate < now) {
          return res.status(400).json({ 
            error: 'This registration link has expired',
            available: false,
            expired: true
          });
        }
      }

      // Check max_slots limit
      const isAvailable = registrationRule.max_slots === null || 
                         registrationRule.current_count < registrationRule.max_slots;

      return res.json({
        available: isAvailable,
        registration_rule: {
          id: registrationRule.id,
          manager_id: registrationRule.manager_id,
          max_slots: registrationRule.max_slots,
          current_count: registrationRule.current_count,
          remaining_slots: registrationRule.max_slots !== null 
            ? Math.max(0, registrationRule.max_slots - registrationRule.current_count)
            : null,
          expires_at: registrationRule.expires_at,
          is_active: registrationRule.is_active
        },
        error: isAvailable ? null : `This registration link has reached the maximum number of slots (${registrationRule.max_slots})`
      });
    } catch (decodeError) {
      console.error('Error decoding token:', decodeError);
      return res.status(400).json({ error: 'Invalid token format' });
    }
  } catch (error) {
    console.error('Error checking registration rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get default provider (company manager)
app.get('/api/auth/default-provider', async (req, res) => {
  try {
    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const betterChoiceCompanyId = '4ab37b7b-dff1-4ee5-9920-0281e0c6468a';
    
    const { data: managerData, error: managerError } = await adminDB
      .from('profiles')
      .select('id')
      .eq('company_id', betterChoiceCompanyId)
      .eq('role', 'company_manager')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (managerError && managerError.code !== 'PGRST116') {
      throw managerError;
    }

    res.json({ provider_id: managerData?.id || null });
  } catch (error) {
    console.error('Error getting default provider:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create client record (used after OAuth signup, e.g. Google; also by WhatsAppRegisterPage, OnboardingModal, mobile)
app.post('/api/auth/create-client', async (req, res) => {
  const buildCreateClientResponse = ({
    userId,
    userData,
    clientRows,
    providerToken,
    alreadyExisted,
    chatUserCreated,
    chatUserData,
  }) => {
    const clientRow = clientRows?.[0] ?? null;
    const email = clientRow?.email || userData?.email || '';

    // Mobile OAuth sends providerToken and expects { data: { user, session } }.
    // Web callers omit providerToken and expect { data: [clientRow], chatUserCreated, ... }.
    if (providerToken) {
      return {
        data: {
          user: { id: userId, email },
          session: {
            access_token: providerToken.accessToken || null,
            refresh_token: providerToken.refreshToken || null,
            expires_at: providerToken.expiresAt ?? undefined,
            expires_in: providerToken.expiresIn ?? undefined,
            token_type: 'bearer',
          },
        },
        language: null,
        error: null,
        ...(alreadyExisted ? { alreadyExisted: true } : {}),
        chatUserCreated: chatUserCreated ?? false,
        chatUserData: chatUserData ?? null,
      };
    }

    return {
      data: clientRows ?? [],
      ...(alreadyExisted ? { alreadyExisted: true } : {}),
      chatUserCreated: chatUserCreated ?? false,
      chatUserData: chatUserData ?? null,
    };
  };

  try {
    const {
      userId,
      userData,
      userCode: requestedUserCode,
      providerId,
      invitationToken,
      managerLinkData,
      providerToken,
    } = req.body;
    if (!userId || !userData) {
      return res.status(400).json({ error: 'User ID and user data are required' });
    }

    if (req.userId && userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data: authUserData, error: authUserError } = await clientDB.auth.admin.getUserById(userId);
    if (authUserError || !authUserData?.user) {
      return res.status(400).json({ error: 'Invalid user' });
    }

    // Idempotency: if a row already exists for this auth user, return it instead of
    // failing. Bootstrap-from-OAuth-callback may race with the OnboardingModal's own
    // create path, and the client expects a 2xx with the existing row in that case.
    const { data: existingClient } = await clientDB
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingClient) {
      return res.json(buildCreateClientResponse({
        userId,
        userData,
        clientRows: [existingClient],
        providerToken,
        alreadyExisted: true,
        chatUserCreated: false,
        chatUserData: null,
      }));
    }

    // Auto-generate userCode when the mobile OAuth signup flow doesn't send one.
    let userCode = requestedUserCode || null;
    if (!userCode) {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let attempts = 0;
      while (attempts < 100 && !userCode) {
        let code = '';
        for (let i = 0; i < 6; i++) {
          code += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        const { data: codeCheck } = await clientDB
          .from('clients')
          .select('user_code')
          .eq('user_code', code)
          .maybeSingle();
        if (!codeCheck) userCode = code;
        attempts++;
      }
      if (!userCode) {
        return res.status(500).json({ error: 'Failed to generate unique user code' });
      }
    }

    const clientInsertData = {
      user_id: userId,
      full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
      email: userData.email,
      phone: userData.phone,
      user_code: userCode,
      status: 'active'
    };

    const { data, error } = await clientDB
      .from('clients')
      .insert([clientInsertData])
      .select();

    if (error) throw error;

    // Resolve registration link from invitationToken/managerLinkData (OAuth e.g. Google signup) and increment current_count.
    // registration_rules is in the secondary (chat) Supabase project only.
    const regDb = adminDB;
    let registrationRule = null;
    let linkIdFromToken = null;
    let managerIdFromToken = null;
    if (invitationToken) {
      try {
        const decoded = Buffer.from(invitationToken, 'base64').toString('utf-8');
        try {
          const obj = JSON.parse(decoded);
          if (obj && obj.link_id) { linkIdFromToken = obj.link_id; managerIdFromToken = obj.manager_id || null; }
          else if (obj && obj.manager_id) managerIdFromToken = obj.manager_id;
        } catch (_) { managerIdFromToken = decoded; }
      } catch (_) {}
    }
    if (!linkIdFromToken && managerLinkData?.link_id) linkIdFromToken = managerLinkData.link_id;
    if (!managerIdFromToken && managerLinkData?.manager_id) managerIdFromToken = managerLinkData.manager_id;

    if (linkIdFromToken || managerIdFromToken) {
      if (!regDb) {
        return res.status(503).json({ error: 'Registration links require CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY' });
      }
      try {
        let row = null;
        if (linkIdFromToken) {
          const { data: r, error: re } = await regDb.from('registration_rules').select('id, link_id, manager_id, max_slots, current_count, expires_at, is_active').eq('link_id', linkIdFromToken).maybeSingle();
          if (!re) row = r;
        } else {
          const numericId = /^\d+$/.test(String(managerIdFromToken)) ? parseInt(managerIdFromToken, 10) : null;
          if (numericId != null) {
            const { data: r } = await regDb.from('registration_rules').select('id, manager_id, max_slots, current_count, expires_at, is_active').eq('id', numericId).maybeSingle();
            row = r;
          }
          if (!row) {
            const { data: r } = await regDb.from('registration_rules').select('id, manager_id, max_slots, current_count, expires_at, is_active').eq('manager_id', managerIdFromToken).maybeSingle();
            row = r;
          }
        }
        if (row) registrationRule = row;
      } catch (e) { console.error('⚠️ create-client: resolve registration link:', e); }
    }

    if (registrationRule && regDb) {
      try {
        const linkIdToUse = linkIdFromToken || registrationRule.link_id;
        const useLinkId = !!linkIdToUse;
        let q = regDb.from('registration_rules').select('current_count, max_slots, is_active');
        if (useLinkId) q = q.eq('link_id', linkIdToUse); else q = q.eq('id', registrationRule.id);
        const { data: cur, error: fe } = await q.maybeSingle();
        if (!fe && cur != null) {
          const newCount = (cur.current_count || 0) + 1;
          const setInactive = (cur.max_slots != null) && (newCount >= cur.max_slots);
          const updatePayload = { current_count: newCount };
          if (setInactive) updatePayload.is_active = false;
          let upd = regDb.from('registration_rules').update(updatePayload);
          if (useLinkId) upd = upd.eq('link_id', linkIdToUse); else upd = upd.eq('id', registrationRule.id);
          const { error: ue } = await upd;
          if (ue) console.error('❌ create-client: increment registration link:', ue.message);
          else console.log('✅ create-client: registration link incremented (Google/OAuth)', useLinkId ? { link_id: linkIdToUse } : { id: registrationRule.id }, 'new_count:', newCount, setInactive ? ', is_active=false' : '');
        }
      } catch (e) { console.error('❌ create-client: exception incrementing registration link:', e); }
    }

    // Also create record in chat_users table (secondary database)
    let chatUserCreated = false;
    let chatUserDataResult = null;
    
    if (adminDB && data && data[0]) {
      try {
        const chatUserData = {
          user_code: userCode,
          full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
          email: userData.email,
          phone_number: userData.phone,
          whatsapp_number: userData.phone,
          platform: userData.platform || 'whatsapp',
          provider_id: providerId || null,
          activated: true,
          is_verified: false,
          language: 'en',
          created_at: new Date().toISOString()
        };

        const { data: chatUserResult, error: chatUserError } = await adminDB
          .from('chat_users')
          .insert([chatUserData])
          .select();

        if (!chatUserError) {
          chatUserCreated = true;
          chatUserDataResult = chatUserResult;
        }
      } catch (chatError) {
        console.error('Error creating chat user:', chatError);
      }
    }

    res.json(buildCreateClientResponse({
      userId,
      userData,
      clientRows: data,
      providerToken,
      chatUserCreated,
      chatUserData: chatUserDataResult,
    }));
  } catch (error) {
    console.error('Error creating client record:', error);
    res.status(500).json({ error: error.message });
  }
});


// ──────────────────────────────────────────────────────────────────────────
// Apple OAuth exchange (signup)
//
// Signup needs a Supabase UUID + session before create-client runs.
// Apple's identity-token `sub` is NOT a UUID — signInWithIdToken mints
// the real Supabase user. Login uses /oauth/apple/verify instead.
//
// Body: { identityToken: string, fullName?: { givenName?, familyName? } }
// Returns: { userId, accessToken, refreshToken, expiresAt?, expiresIn?, email }
// ──────────────────────────────────────────────────────────────────────────
app.post('/api/auth/oauth/apple/exchange', async (req, res) => {
  try {
    const { identityToken, fullName } = req.body || {};
    if (!identityToken || typeof identityToken !== 'string') {
      return res.status(400).json({ error: 'identityToken is required' });
    }

    const payload = decodeJwtPayloadServer(identityToken);
    const claimedEmail =
      typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';

    if (claimedEmail && (await emailHasBetterChoiceAccount(claimedEmail))) {
      return res.status(409).json({ error: 'account_exists', email: claimedEmail });
    }

    const { data, error } = await clientDB.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
    });

    if (error) {
      console.error('❌ Apple signup signInWithIdToken error:', error);
      return res.status(401).json({ error: error.message || 'Apple sign-in rejected' });
    }

    if (!data?.user || !data?.session) {
      return res.status(401).json({ error: 'Apple sign-in returned no session' });
    }

    const verifiedEmail = (data.user.email || claimedEmail || '').trim().toLowerCase();
    if (
      verifiedEmail &&
      verifiedEmail !== claimedEmail &&
      (await emailHasBetterChoiceAccount(verifiedEmail))
    ) {
      try {
        await clientDB.auth.admin.deleteUser(data.user.id);
      } catch (e) {
        console.warn('Apple exchange: orphan cleanup failed:', e?.message);
      }
      return res.status(409).json({ error: 'account_exists', email: verifiedEmail });
    }

    if (fullName && (fullName.givenName || fullName.familyName)) {
      try {
        const patch = {};
        if (fullName.givenName) patch.first_name = fullName.givenName;
        if (fullName.familyName) patch.last_name = fullName.familyName;
        await clientDB.auth.admin.updateUserById(data.user.id, {
          user_metadata: patch,
        });
      } catch {
        /* best-effort — Apple only shares the name on first sign-in */
      }
    }

    return res.json({
      userId: data.user.id,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at ?? undefined,
      expiresIn: data.session.expires_in ?? undefined,
      email: data.user.email || claimedEmail || '',
    });
  } catch (error) {
    console.error('POST /api/auth/oauth/apple/exchange error:', error);
    res.status(500).json({ error: error.message || 'Apple sign-up failed' });
  }
});

// Get client record
app.get('/api/auth/client/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.userId && userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { data, error } = await clientDB
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error getting client record:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update client record
app.put('/api/auth/client/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { updates } = req.body;

    if (req.userId && userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    if (!updates) {
      return res.status(400).json({ error: 'Updates are required' });
    }

    const { data, error } = await clientDB
      .from('clients')
      .update(updates)
      .eq('user_id', userId)
      .select();

    if (error) throw error;

    // If secondary DB is available and we have user_code, also update chat_users
    if (adminDB && data && data[0] && data[0].user_code) {
      try {
        const { data: chatUser, error: chatUserError } = await adminDB
          .from('chat_users')
          .select('id')
          .eq('user_code', data[0].user_code)
          .maybeSingle();

        if (!chatUserError && chatUser) {
          const chatUpdates = {};
          
          if (updates.full_name) chatUpdates.full_name = updates.full_name;
          if (updates.email) chatUpdates.email = updates.email;
          if (updates.phone) {
            chatUpdates.phone_number = updates.phone;
            chatUpdates.whatsapp_number = updates.phone;
          }
          if (updates.region) chatUpdates.region = updates.region;
          if (updates.city) chatUpdates.city = updates.city;
          if (updates.timezone) chatUpdates.timezone = updates.timezone;
          if (updates.age) chatUpdates.age = updates.age;
          if (updates.gender) chatUpdates.gender = updates.gender;
          if (updates.birth_date) chatUpdates.date_of_birth = updates.birth_date;
          if (updates.food_allergies) chatUpdates.food_allergies = updates.food_allergies;
          if (updates.updated_at) chatUpdates.updated_at = updates.updated_at;

          if (Object.keys(chatUpdates).length > 0) {
            await adminDB
              .from('chat_users')
              .update(chatUpdates)
              .eq('id', chatUser.id);
          }
        }
      } catch (syncError) {
        console.error('Error syncing to chat_users:', syncError);
      }
    }

    res.json({ data });
  } catch (error) {
    console.error('Error updating client record:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================
// WAITING LIST API ROUTES
// ====================================

// Submit waiting list entry
app.post('/api/waiting-list/submit', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, goal, message } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'First name, last name, and email are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        message: 'Please provide a valid email address'
      });
    }

    const normalizedEmail = email.toLowerCase();

    // Check if email already exists in waiting list
    const { data: existingEntry, error: checkError } = await adminDB
      .from('waiting_list')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingEntry) {
      return res.status(400).json({
        error: 'Email already registered',
        message: 'This email is already on the waiting list'
      });
    }

    // Save to Supabase
    const { data, error } = await adminDB
      .from('waiting_list')
      .insert([
        {
          first_name: firstName,
          last_name: lastName,
          email: normalizedEmail,
          phone: phone || null,
          goal: goal || null,
          message: message || null,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error('Error saving waiting list entry:', error);
      throw error;
    }

    res.json({ 
      success: true, 
      data,
      message: 'Successfully joined waiting list'
    });
  } catch (error) {
    console.error('Error submitting waiting list entry:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to submit waiting list entry' 
    });
  }
});

// Validate invitation token
app.get('/api/waiting-list/validate-token', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Token is required' 
      });
    }

    // Decode the token (it's base64 encoded UUID)
    let decodedToken;
    try {
      decodedToken = Buffer.from(token, 'base64').toString('utf-8');
      // Validate it looks like a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(decodedToken)) {
        return res.status(400).json({ 
          valid: false, 
          error: 'Invalid token format' 
        });
      }
    } catch (decodeError) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Invalid token format' 
      });
    }

    // Check if token exists in waiting_list table
    // The token should match the invitation_token field (stored as UUID string)
    const { data, error } = await adminDB
      .from('waiting_list')
      .select('id, email, first_name, last_name, invitation_sent_at, invitation_used_at')
      .eq('invitation_token', decodedToken)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return res.json({ 
        valid: false, 
        error: 'Invalid or expired invitation token' 
      });
    }

    // Check if token has already been used
    if (data.invitation_used_at) {
      return res.json({ 
        valid: false, 
        error: 'This invitation has already been used',
        used: true
      });
    }

    res.json({ 
      valid: true, 
      data: {
        id: data.id,
        email: data.email,
        firstName: data.first_name,
        lastName: data.last_name
      }
    });
  } catch (error) {
    console.error('Error validating invitation token:', error);
    res.status(500).json({ 
      valid: false,
      error: error.message || 'Failed to validate token' 
    });
  }
});

// Mark invitation as used
app.post('/api/waiting-list/mark-used', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ 
        error: 'Token is required' 
      });
    }

    // Decode the token (it's base64 encoded UUID)
    let decodedToken;
    try {
      decodedToken = Buffer.from(token, 'base64').toString('utf-8');
      // Validate it looks like a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(decodedToken)) {
        return res.status(400).json({ 
          error: 'Invalid token format' 
        });
      }
    } catch (decodeError) {
      return res.status(400).json({ 
        error: 'Invalid token format' 
      });
    }

    // Update the waiting_list entry to mark invitation as used
    const { data, error } = await adminDB
      .from('waiting_list')
      .update({ 
        invitation_used_at: new Date().toISOString()
      })
      .eq('invitation_token', decodedToken)
      .select();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ 
        error: 'Invitation token not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Invitation marked as used' 
    });
  } catch (error) {
    console.error('Error marking invitation as used:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to mark invitation as used' 
    });
  }
});

// ====================================
// CONTACT FORM ENDPOINT
// ====================================

app.post('/api/contact', async (req, res) => {
  try {
    const { fullName, email, phone, message, timestamp } = req.body;

    // Basic validation
    if (!fullName || !email || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Full name, email, and message are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        message: 'Please provide a valid email address'
      });
    }

    // Get client IP and user agent
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Save to Supabase
    const { data, error } = await clientDB
      .from('contact_messages')
      .insert([
        {
          full_name: fullName,
          email: email,
          phone: phone || null,
          message: message,
          ip_address: ipAddress,
          user_agent: userAgent,
          created_at: timestamp || new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to save contact message'
      });
    }

    console.log('📧 Contact message saved to Supabase:', {
      id: data[0]?.id,
      fullName,
      email,
      phone: phone || 'Not provided',
      ip: ipAddress
    });

    res.status(200).json({
      success: true,
      message: 'Contact form submitted successfully',
      id: data[0]?.id
    });

  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process contact form'
    });
  }
});

// ====================================
// INGREDIENT REPORTS (misinformation, wrong values, etc.)
// ====================================
// Table: ingredient_reports (run server/sql/ingredient_reports.sql in chat Supabase)

const INGREDIENT_REPORT_TYPES = ['misinformation', 'incorrect_values', 'wrong_name', 'wrong_portion', 'other'];

app.post('/api/ingredient-reports', async (req, res) => {
  try {
    const { foodId, foodSnapshot, reportType, description, userCode } = req.body;

    if (!foodId) {
      return res.status(400).json({ error: 'foodId is required' });
    }
    if (!reportType || !INGREDIENT_REPORT_TYPES.includes(reportType)) {
      return res.status(400).json({
        error: 'reportType is required and must be one of: ' + INGREDIENT_REPORT_TYPES.join(', ')
      });
    }

    if (!adminDB) {
      return res.status(503).json({ error: 'Database not configured for ingredient reports' });
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const row = {
      food_id: String(foodId),
      food_snapshot: foodSnapshot || null,
      report_type: reportType,
      description: description && String(description).trim() ? String(description).trim() : null,
      reporter_user_code: userCode && String(userCode).trim() ? String(userCode).trim() : null,
      ip_address: ipAddress,
      user_agent: userAgent
    };

    const { data, error } = await adminDB
      .from('ingredient_reports')
      .insert([row])
      .select('id, created_at');

    if (error) {
      console.error('ingredient_reports insert error:', error);
      return res.status(500).json({ error: 'Failed to save report' });
    }

    console.log('Ingredient report saved:', { id: data?.[0]?.id, foodId, reportType, userCode: userCode || 'anonymous' });
    res.status(200).json({ success: true, id: data?.[0]?.id });
  } catch (err) {
    console.error('ingredient-reports error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ====================================
// MACRO SUMMARY SVG ENDPOINT
// ====================================
app.get('/api/weekly-macro-summary-svg', async (req, res) => {
  try {
    const { user_code, phone_number, date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    if (!user_code && !phone_number) {
      return res.status(400).json({ error: 'Either user_code or phone_number is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    // 1. Calculate Week Range (Sunday to Saturday)
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const dayIndex = targetDate.getDay(); 
    const startDate = new Date(targetDate);
    startDate.setDate(targetDate.getDate() - dayIndex);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    const dateStrStart = startDate.toISOString().split('T')[0];
    const dateStrEnd = endDate.toISOString().split('T')[0];

    // 2. Find user
    let userQuery = adminDB
      .from('chat_users')
      .select('id, user_code, language')
      .limit(1);

    if (user_code) userQuery = userQuery.eq('user_code', user_code);
    else if (phone_number) userQuery = userQuery.eq('phone', phone_number);

    const { data: userData, error: userError } = await userQuery.single();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userData.id;
    const userCode = userData.user_code;
    const userLanguage = userData.language || 'en';
    const isHe = userLanguage === 'he';

    // 3. Get food logs & active meal plans
    const { data: foodLogs } = await adminDB
      .from('food_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('log_date', dateStrStart)
      .lte('log_date', dateStrEnd);

    const { data: activeMealPlans } = await adminDB
      .from('meal_plans_and_schemas')
      .select('*')
      .eq('user_code', userCode)
      .eq('record_type', 'meal_plan')
      .eq('status', 'active');

    // 4. Setup Daily and Weekly Data Structures
    const daysShort = isHe ? ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const dailyStats = Array(7).fill(0).map((_, i) => ({ label: daysShort[i], calories: 0, goal: 2000 }));
    let weeklyTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    let weeklyGoals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const defDaily = { calories: 2000, protein: 150, carbs: 250, fat: 65 };

    const safeNum = (v, def) => {
      const n = Number(v);
      return (typeof n === 'number' && !isNaN(n) && n >= 0) ? n : def;
    };

    // Calculate Weekly Goals from 7 Days (same multi-plan / active_days rules as daily macro card)
    for (let i = 0; i < 7; i++) {
      let planForDay = null;
      if (Array.isArray(activeMealPlans) && activeMealPlans.length > 0) {
        if (activeMealPlans.length === 1) {
          planForDay = activeMealPlans[0];
        } else {
          const matching = activeMealPlans.find((plan) => {
            const days = plan.active_days;
            if (days == null || !Array.isArray(days)) return true;
            return days.includes(i);
          });
          planForDay = matching || activeMealPlans[0];
        }
      }
      let dayGoals = { ...defDaily };

      if (planForDay && planForDay.meal_plan && Array.isArray(planForDay.meal_plan.meals)) {
        const mTarget = planForDay.meal_plan.meals.reduce((acc, meal) => {
          if (meal.main && meal.main.nutrition) {
            acc.c += Number(meal.main.nutrition.calories) || 0;
            acc.p += Number(meal.main.nutrition.protein) || 0;
            acc.cb += Number(meal.main.nutrition.carbs) || 0;
            acc.f += Number(meal.main.nutrition.fat) || 0;
          }
          return acc;
        }, { c: 0, p: 0, cb: 0, f: 0 });

        dayGoals = {
          calories: safeNum(mTarget.c, defDaily.calories),
          protein: safeNum(mTarget.p, defDaily.protein),
          carbs: safeNum(mTarget.cb, defDaily.carbs),
          fat: safeNum(mTarget.f, defDaily.fat)
        };
      }

      dailyStats[i].goal = dayGoals.calories;
      weeklyGoals.calories += dayGoals.calories;
      weeklyGoals.protein += dayGoals.protein;
      weeklyGoals.carbs += dayGoals.carbs;
      weeklyGoals.fat += dayGoals.fat;
    }

    // Populate Data from Logs
    (foodLogs || []).forEach(log => {
      const dIdx = new Date(log.log_date).getDay();
      let logCals = 0, logP = 0, logC = 0, logF = 0;

      if (log.food_items) {
        try {
          const items = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
          if (Array.isArray(items)) {
            logCals = items.reduce((sum, item) => sum + (item.cals || 0), 0);
            logP = items.reduce((sum, item) => sum + (item.p || 0), 0);
            logC = items.reduce((sum, item) => sum + (item.c || 0), 0);
            logF = items.reduce((sum, item) => sum + (item.f || 0), 0);
          }
        } catch (e) {}
      }

      logCals += (log.total_calories || 0);
      logP += (log.total_protein_g || 0);
      logC += (log.total_carbs_g || 0);
      logF += (log.total_fat_g || 0);

      dailyStats[dIdx].calories += logCals;
      weeklyTotals.calories += logCals;
      weeklyTotals.protein += logP;
      weeklyTotals.carbs += logC;
      weeklyTotals.fat += logF;
    });

    // 5. Averages for logged intake: only count days with calories > 0 (not full 7)
    const daysWithCalories = dailyStats.filter((d) => d.calories > 0).length;
    const avgTotals =
      daysWithCalories > 0
        ? {
            calories: weeklyTotals.calories / daysWithCalories,
            protein: weeklyTotals.protein / daysWithCalories,
            carbs: weeklyTotals.carbs / daysWithCalories,
            fat: weeklyTotals.fat / daysWithCalories
          }
        : { calories: 0, protein: 0, carbs: 0, fat: 0 };

    // Goals stay as true 7-day weekly averages (meal plan targets per calendar week)
    const avgGoals = {
      calories: weeklyGoals.calories / 7,
      protein: weeklyGoals.protein / 7,
      carbs: weeklyGoals.carbs / 7,
      fat: weeklyGoals.fat / 7
    };
    const hasCalorieDeficit = avgGoals.calories > 0 && avgTotals.calories < avgGoals.calories;

    // Mathematics for SVG rings (same geometry + label rules as /api/macro-summary-svg)
    const calPct = avgGoals.calories > 0 ? Math.round((avgTotals.calories / avgGoals.calories) * 100) : 0;
    const pPct = avgGoals.protein > 0 ? Math.round((avgTotals.protein / avgGoals.protein) * 100) : 0;
    const cPct = avgGoals.carbs > 0 ? Math.round((avgTotals.carbs / avgGoals.carbs) * 100) : 0;
    const fPct = avgGoals.fat > 0 ? Math.round((avgTotals.fat / avgGoals.fat) * 100) : 0;

    const outerRadius = 120;
    const innerRadius = 100;
    const cxRing = 140;
    const cyRing = 140;
    const outerCircumference = 2 * Math.PI * outerRadius;
    const circumference = 2 * Math.PI * innerRadius;
    const segmentLength = circumference / 3;

    const calNorm = Math.min(calPct, 100) / 100 * outerCircumference;
    const calOver = calPct > 100 ? Math.min(((calPct - 100) / 100) * outerCircumference, outerCircumference) : 0;
    const pNorm = Math.min(pPct, 100) / 100 * segmentLength;
    const pOver = pPct > 100 ? Math.min(((pPct - 100) / 100) * segmentLength, segmentLength) : 0;
    const cNorm = Math.min(cPct, 100) / 100 * segmentLength;
    const cOver = cPct > 100 ? Math.min(((cPct - 100) / 100) * segmentLength, segmentLength) : 0;
    const fNorm = Math.min(fPct, 100) / 100 * segmentLength;
    const fOver = fPct > 100 ? Math.min(((fPct - 100) / 100) * segmentLength, segmentLength) : 0;

    const calArcTotal = calNorm + calOver;
    const protArcTotal = pNorm + pOver;
    const carbArcTotal = cNorm + cOver;
    const fatArcTotal = fNorm + fOver;

    const polarAtPathS = (radius, sAlongPath) => {
      const th = sAlongPath / radius;
      return { x: cxRing + radius * Math.cos(th), y: cyRing + radius * Math.sin(th) };
    };
    const toScreenXY = (lx, ly) => {
      const dx = lx - cxRing;
      const dy = ly - cyRing;
      return { x: cxRing + dy, y: cyRing - dx };
    };
    const tangentDegScreen = (lx, ly) => {
      const { x: sx, y: sy } = toScreenXY(lx, ly);
      const psi = Math.atan2(sy - cyRing, sx - cxRing);
      let deg = (psi + Math.PI / 2) * (180 / Math.PI);
      deg = ((deg % 360) + 360) % 360;
      if (deg > 90 && deg < 270) deg -= 180;
      return deg;
    };

    const minArcPxForPctLabel = 18;
    const calArcForLabel = Math.min(calArcTotal, outerCircumference);
    const sCalMid = calArcForLabel / 2;
    const sProtMid = protArcTotal / 2;
    const sCarbMid = segmentLength + carbArcTotal / 2;
    const sFatMid = 2 * segmentLength + fatArcTotal / 2;

    const locCal = calArcForLabel >= minArcPxForPctLabel ? polarAtPathS(outerRadius, sCalMid) : null;
    const locP = protArcTotal >= minArcPxForPctLabel ? polarAtPathS(innerRadius, sProtMid) : null;
    const locC = carbArcTotal >= minArcPxForPctLabel ? polarAtPathS(innerRadius, sCarbMid) : null;
    const locF = fatArcTotal >= minArcPxForPctLabel ? polarAtPathS(innerRadius, sFatMid) : null;

    const fontUi = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    const ringPctFs = 10;
    const ringPctWeight = '500';
    const ringPctStroke = '1';
    const ringPctStrokeHex = '#ffffff';

    const pctTextEl = (loc, pctStr) => {
      if (!loc) return '';
      const { x: sx, y: sy } = toScreenXY(loc.x, loc.y);
      const deg = tangentDegScreen(loc.x, loc.y);
      return `  <text transform="rotate(${deg} ${sx} ${sy})" x="${sx}" y="${sy}" dy="0.35em" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" font-size="${ringPctFs}" font-weight="${ringPctWeight}" fill="#111827" stroke="${ringPctStrokeHex}" stroke-width="${ringPctStroke}" stroke-linejoin="round" paint-order="stroke fill">${pctStr}</text>`;
    };
    const ringPctSvg = [
      pctTextEl(locCal, `${calPct}%`),
      pctTextEl(locP, `${pPct}%`),
      pctTextEl(locC, `${cPct}%`),
      pctTextEl(locF, `${fPct}%`)
    ].filter(Boolean).join('\n');

    const innerClearR = innerRadius - 8;
    const calCenterStr = Math.round(avgTotals.calories).toLocaleString();
    const calCharFactor = 0.58;
    let centerCaloriesFontSize = 56;
    const estCalTextW = calCenterStr.length * calCharFactor * centerCaloriesFontSize;
    const maxCalW = innerClearR * 2 * 0.88;
    if (estCalTextW > maxCalW) {
      centerCaloriesFontSize = Math.max(26, Math.floor(maxCalW / (calCenterStr.length * calCharFactor)));
    }
    // Match daily hub subtitle (KCAL): same size & contrast so PNG matches /api/macro-summary-svg
    const kcalSubFont = 14;
    const hubGap = 8;
    const hubLineSpacing = centerCaloriesFontSize * 0.42 + hubGap + kcalSubFont * 0.42;
    const hubCalLineY = -hubLineSpacing / 2;
    const hubKcalLineY = hubLineSpacing / 2;
    const weeklySubFill = '#9ca3af';
    const weeklySubLetter = isHe ? '0.02em' : '0.05em';

    // Horizontal card: ring lives in the left 280 viewBox units (same geometry as daily). Bars + legend
    // on the right. PNG scale uses daily’s px-per-unit (1200/280) so the donut rasterizes at the same
    // resolution as /api/macro-summary-svg; total image width grows (~880 → ~3771px) unless clients resize.
    const ringColumnW = 280;
    const colGap = 12;
    const rightColX = ringColumnW + colGap;
    const chartW = 576;
    const plotPadL = 50;
    const plotPadR = 48;
    const plotPadT = 4;
    const plotPadB = 24;
    const innerW = chartW - plotPadL - plotPadR;
    const innerH = 90;
    const plotH = plotPadT + innerH + plotPadB;

    const dayCals = dailyStats.map((d) => d.calories);
    const dayGoals = dailyStats.map((d) => (d.goal > 0 ? d.goal : 2000));
    const yMaxRaw = Math.max(1, ...dayCals, ...dayGoals);
    const yMax = Math.max(500, Math.ceil((yMaxRaw * 1.06) / 100) * 100);

    const xAt = (i) => plotPadL + (innerW * i) / 6;
    // Hebrew: mirror X so Sunday (index 0) is on the right, Saturday (6) on the left (RTL week flow).
    const xDay = (dayIndex) => (isHe ? xAt(6 - dayIndex) : xAt(dayIndex));
    const yAt = (val) => plotPadT + innerH - (Math.min(Math.max(0, val), yMax) / yMax) * innerH;

    const linePts = dayCals.map((v, i) => `${xDay(i)},${yAt(v)}`).join(' ');
    const goalPts = dayGoals.map((g, i) => `${xDay(i)},${yAt(g)}`).join(' ');

    const areaD = `M ${dayCals.map((v, i) => `${xDay(i)} ${yAt(v)}`).join(' L ')} L ${xDay(6)} ${plotPadT + innerH} L ${xDay(0)} ${plotPadT + innerH} Z`;

    const yTickVals = [0, Math.round(yMax / 2), yMax];
    const gridLinesSvg = yTickVals
      .map((tv) => {
        const gy = yAt(tv);
        return `<line x1="${plotPadL}" y1="${gy}" x2="${plotPadL + innerW}" y2="${gy}" stroke="#f3f4f6" stroke-width="1" />`;
      })
      .join('\n        ');

    const yAxisLabelsSvg = yTickVals
      .map((tv) => {
        const gy = yAt(tv);
        return `<text x="${plotPadL - 6}" y="${gy}" text-anchor="end" dominant-baseline="middle" font-family="${fontUi}" font-size="10" font-weight="500" fill="#9ca3af">${tv.toLocaleString()}</text>`;
      })
      .join('\n        ');

    const dotsSvg = dayCals
      .map((v, i) => {
        const cx = xDay(i);
        const cy = yAt(v);
        const over = dayGoals[i] > 0 && v > dayGoals[i];
        const fill = v <= 0 ? '#e5e7eb' : over ? '#ef4444' : '#10b981';
        const stroke = v <= 0 ? '#d1d5db' : '#ffffff';
        return `<circle cx="${cx}" cy="${cy}" r="5" fill="${fill}" stroke="${stroke}" stroke-width="2" />`;
      })
      .join('\n        ');

    const insetXLabel = (cx) => {
      const edge = 20;
      if (cx > chartW - edge) return { x: chartW - 5, anchor: 'end' };
      if (cx < plotPadL + edge) return { x: plotPadL + 5, anchor: 'start' };
      return { x: cx, anchor: 'middle' };
    };

    const xLabelsSvg = dailyStats
      .map((d, i) => {
        const cx = xDay(i);
        const { x, anchor } = insetXLabel(cx);
        const y = plotPadT + innerH + 16;
        return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${fontUi}" font-size="12" font-weight="600" fill="#6b7280">${d.label}</text>`;
      })
      .join('\n        ');

    const calLabelsSvg = dayCals
      .map((v, i) => {
        const cx = xDay(i);
        const cy = yAt(v);
        const { x: lx, anchor } = insetXLabel(cx);
        const label = Math.round(v).toLocaleString();
        const gapAbove = 11;
        const gapBelow = 15;
        const yAbove = cy - gapAbove;
        const useBelow = yAbove < plotPadT + 4;
        const ty = useBelow ? cy + gapBelow : yAbove;
        const baseline = useBelow ? 'hanging' : 'alphabetic';
        return `<text x="${lx}" y="${ty}" text-anchor="${anchor}" dominant-baseline="${baseline}" font-family="${fontUi}" font-size="11" font-weight="700" fill="#111827" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" paint-order="stroke fill">${label}</text>`;
      })
      .join('\n        ');

    const lineChartSvg = `
        ${gridLinesSvg}
        ${yAxisLabelsSvg}
        <path d="${areaD}" fill="url(#weeklyLineAreaGrad)" />
        <polyline fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-dasharray="4 4" stroke-linecap="round" stroke-linejoin="round" points="${goalPts}" />
        <polyline fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${linePts}" />
        ${dotsSvg}
        ${calLabelsSvg}
        ${xLabelsSvg}`;

    const formatWeight = (grams) => {
      const n = Number(grams);
      return `${typeof n === 'number' && !isNaN(n) ? Math.round(n) : 0}g`;
    };

    const legendValueX = 200;
    const heLegendLabelShift = 500;
    const svgW = ringColumnW + colGap + chartW;
    const barBlockTop = 42;
    const chartInnerY = 22;
    const legendTop = 198;
    const legendBottomPad = 14;
    const svgH = legendTop + 105 + 48 + legendBottomPad;

    // 6. Assemble SVG — horizontal; left 280 = daily ring column
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}">
  <defs>
    <linearGradient id="weeklyCalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="weeklyProteinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c084fc" />
      <stop offset="100%" stop-color="#7e22ce" />
    </linearGradient>
    <linearGradient id="weeklyCarbsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <linearGradient id="weeklyFatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fcd34d" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <filter id="weeklySoftShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#000000" flood-opacity="0.15" />
    </filter>
    <linearGradient id="weeklyLineAreaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#34d399" stop-opacity="0.28" />
      <stop offset="100%" stop-color="#34d399" stop-opacity="0" />
    </linearGradient>
  </defs>

  <rect width="${svgW}" height="${svgH}" fill="#ffffff" rx="24" />

  <g transform="rotate(-90 ${cxRing} ${cyRing})">
    <circle cx="${cxRing}" cy="${cyRing}" r="${outerRadius}" fill="none" stroke="#f3f4f6" stroke-width="16" />
    <circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="#f3f4f6" stroke-width="16" />

    ${calNorm > 0 ? `<circle cx="${cxRing}" cy="${cyRing}" r="${outerRadius}" fill="none" stroke="url(#weeklyCalGrad)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${calNorm} ${outerCircumference}" filter="url(#weeklySoftShadow)" />` : ''}
    ${calOver > 0 ? `
    <circle cx="${cxRing}" cy="${cyRing}" r="${outerRadius}" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" stroke-dasharray="${calOver} ${outerCircumference}" />
    <circle cx="${cxRing}" cy="${cyRing}" r="${outerRadius}" fill="none" stroke="#047857" stroke-width="16" stroke-linecap="round" stroke-dasharray="${calOver} ${outerCircumference}" />` : ''}

    ${pNorm > 0 ? `<circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="url(#weeklyProteinGrad)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${pNorm} ${circumference}" filter="url(#weeklySoftShadow)" />` : ''}
    ${cNorm > 0 ? `<circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="url(#weeklyCarbsGrad)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${cNorm} ${circumference}" stroke-dashoffset="${-segmentLength}" filter="url(#weeklySoftShadow)" />` : ''}
    ${fNorm > 0 ? `<circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="url(#weeklyFatGrad)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${fNorm} ${circumference}" stroke-dashoffset="${-segmentLength * 2}" filter="url(#weeklySoftShadow)" />` : ''}

    ${pOver > 0 ? `<circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" stroke-dasharray="${pOver} ${circumference}" /><circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="#7e22ce" stroke-width="16" stroke-linecap="round" stroke-dasharray="${pOver} ${circumference}" />` : ''}
    ${cOver > 0 ? `<circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" stroke-dasharray="${cOver} ${circumference}" stroke-dashoffset="${-segmentLength}" /><circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="#1d4ed8" stroke-width="16" stroke-linecap="round" stroke-dasharray="${cOver} ${circumference}" stroke-dashoffset="${-segmentLength}" />` : ''}
    ${fOver > 0 ? `<circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" stroke-dasharray="${fOver} ${circumference}" stroke-dashoffset="${-segmentLength * 2}" /><circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="#b45309" stroke-width="16" stroke-linecap="round" stroke-dasharray="${fOver} ${circumference}" stroke-dashoffset="${-segmentLength * 2}" />` : ''}
  </g>

${ringPctSvg}

  <g transform="translate(${cxRing}, ${cyRing})">
    <text text-anchor="middle" dominant-baseline="central" y="${hubCalLineY}" font-family="${fontUi}" font-size="${centerCaloriesFontSize}" font-weight="700" fill="#111827" letter-spacing="-0.03em">${calCenterStr}</text>
    <text text-anchor="middle" dominant-baseline="central" y="${hubKcalLineY}" font-family="${fontUi}" font-size="${kcalSubFont}" font-weight="600" fill="${weeklySubFill}" letter-spacing="${weeklySubLetter}">${isHe ? 'ממוצע יומי' : 'DAILY AVG'}</text>
  </g>

  <g transform="translate(${rightColX}, ${barBlockTop})">
    <text x="${isHe ? chartW : 0}" y="0" text-anchor="${isHe ? 'end' : 'start'}" dominant-baseline="text-before-edge" font-family="${fontUi}" font-size="17" font-weight="700" fill="#111827">${isHe ? 'קלוריות לפי יום' : 'Daily calories'}</text>
    <g transform="translate(0, ${chartInnerY})">
      ${lineChartSvg}
    </g>
  </g>

  <g transform="translate(${rightColX}, ${legendTop})">
    ${isHe ? `
    <g transform="translate(0, 0)">
      <text x="0" y="12" text-anchor="start" font-family="${fontUi}" font-size="15" font-weight="700" fill="#111827">
        <tspan fill="#6b7280" font-weight="500">ממוצע </tspan>${Math.round(avgTotals.calories).toLocaleString()} <tspan fill="#9ca3af" font-weight="400">/ ${Math.round(avgGoals.calories).toLocaleString()}</tspan>
      </text>
      <g transform="translate(${heLegendLabelShift}, 0)">
        <circle cx="-40" cy="8" r="6" fill="#10b981"/>
        <text x="-30" y="12" text-anchor="end" direction="rtl" unicode-bidi="embed" xml:lang="he" font-family="${fontUi}" font-size="15" font-weight="500" fill="#4b5563">קלוריות</text>
      </g>
    </g>
    <g transform="translate(0, 35)">
      <text x="0" y="12" text-anchor="start" font-family="${fontUi}" font-size="15" font-weight="700" fill="#111827">
        <tspan fill="#6b7280" font-weight="500">ממוצע </tspan>${formatWeight(avgTotals.protein)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(avgGoals.protein)}</tspan>
      </text>
      <g transform="translate(${heLegendLabelShift}, 0)">
        <circle cx="-40" cy="8" r="6" fill="#a855f7"/>
        <text x="-30" y="12" text-anchor="end" direction="rtl" unicode-bidi="embed" xml:lang="he" font-family="${fontUi}" font-size="15" font-weight="500" fill="#4b5563">חלבון</text>
      </g>
    </g>
    <g transform="translate(0, 70)">
      <text x="0" y="12" text-anchor="start" font-family="${fontUi}" font-size="15" font-weight="700" fill="#111827">
        <tspan fill="#6b7280" font-weight="500">ממוצע </tspan>${formatWeight(avgTotals.carbs)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(avgGoals.carbs)}</tspan>
      </text>
      <g transform="translate(${heLegendLabelShift}, 0)">
        <circle cx="-40" cy="8" r="6" fill="#3b82f6"/>
        <text x="-30" y="12" text-anchor="end" direction="rtl" unicode-bidi="embed" xml:lang="he" font-family="${fontUi}" font-size="15" font-weight="500" fill="#4b5563">פחמימות</text>
      </g>
    </g>
    <g transform="translate(0, 105)">
      <text x="0" y="12" text-anchor="start" font-family="${fontUi}" font-size="15" font-weight="700" fill="#111827">
        <tspan fill="#6b7280" font-weight="500">ממוצע </tspan>${formatWeight(avgTotals.fat)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(avgGoals.fat)}</tspan>
      </text>
      <g transform="translate(${heLegendLabelShift}, 0)">
        <circle cx="-40" cy="8" r="6" fill="#f59e0b"/>
        <text x="-30" y="12" text-anchor="end" direction="rtl" unicode-bidi="embed" xml:lang="he" font-family="${fontUi}" font-size="15" font-weight="500" fill="#4b5563">שומן</text>
      </g>
    </g>
    ` : `
    <g transform="translate(0, 0)">
      <circle cx="6" cy="8" r="6" fill="#10b981"/>
      <text x="20" y="13" font-family="${fontUi}" font-size="15" font-weight="500" fill="#4b5563">Calories</text>
      <text x="${legendValueX}" y="13" text-anchor="start" font-family="${fontUi}" font-size="15" font-weight="700" fill="#111827">
        <tspan fill="#6b7280" font-weight="500">avg </tspan>${Math.round(avgTotals.calories).toLocaleString()} <tspan fill="#9ca3af" font-weight="400">/ ${Math.round(avgGoals.calories).toLocaleString()}</tspan>
      </text>
    </g>
    <g transform="translate(0, 35)">
      <circle cx="6" cy="8" r="6" fill="#a855f7"/>
      <text x="20" y="13" font-family="${fontUi}" font-size="15" font-weight="500" fill="#4b5563">Protein</text>
      <text x="${legendValueX}" y="13" text-anchor="start" font-family="${fontUi}" font-size="15" font-weight="700" fill="#111827">
        <tspan fill="#6b7280" font-weight="500">avg </tspan>${formatWeight(avgTotals.protein)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(avgGoals.protein)}</tspan>
      </text>
    </g>
    <g transform="translate(0, 70)">
      <circle cx="6" cy="8" r="6" fill="#3b82f6"/>
      <text x="20" y="13" font-family="${fontUi}" font-size="15" font-weight="500" fill="#4b5563">Carbs</text>
      <text x="${legendValueX}" y="13" text-anchor="start" font-family="${fontUi}" font-size="15" font-weight="700" fill="#111827">
        <tspan fill="#6b7280" font-weight="500">avg </tspan>${formatWeight(avgTotals.carbs)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(avgGoals.carbs)}</tspan>
      </text>
    </g>
    <g transform="translate(0, 105)">
      <circle cx="6" cy="8" r="6" fill="#f59e0b"/>
      <text x="20" y="13" font-family="${fontUi}" font-size="15" font-weight="500" fill="#4b5563">Fat</text>
      <text x="${legendValueX}" y="13" text-anchor="start" font-family="${fontUi}" font-size="15" font-weight="700" fill="#111827">
        <tspan fill="#6b7280" font-weight="500">avg </tspan>${formatWeight(avgTotals.fat)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(avgGoals.fat)}</tspan>
      </text>
    </g>
    `}
  </g>
</svg>`;

    // 7. PNG: same pixels-per-viewBox-unit as daily (1200 output px / 280 vb units) so the 280-wide
    // ring column matches /api/macro-summary-svg; full canvas width scales proportionally (not capped at 1200).
    const dailyMacroVbW = 280;
    const dailyMacroOutW = 1200;
    const vbToOutputPx = dailyMacroOutW / dailyMacroVbW;
    try {
      const pngBuffer = await sharp(Buffer.from(svg))
        .resize(Math.round(svgW * vbToOutputPx), Math.round(svgH * vbToOutputPx), {
          fit: 'fill',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toBuffer();

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(pngBuffer);
    } catch (sharpError) {
      console.warn('⚠️ Weekly macro PNG conversion failed, serving SVG:', sharpError.message);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(svg);
    }

  } catch (error) {
    console.error('❌ Error generating horizontal weekly macro summary:', error);
    res.status(500).json({ error: 'Failed to generate summary', message: error.message });
  }
});
// Generate macro summary SVG for a specific date
app.get('/api/macro-summary-svg', async (req, res) => {
  try {
    const { user_code, phone_number, date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    if (!user_code && !phone_number) {
      return res.status(400).json({ error: 'Either user_code or phone_number is required' });
    }

    if (!adminDB) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    console.log('📊 Generating macro summary SVG for:', { user_code, phone_number, date });

    // Find user in chat_users table
    let userQuery = adminDB
      .from('chat_users')
      .select('id, user_code, language')
      .limit(1);

    if (user_code) {
      userQuery = userQuery.eq('user_code', user_code);
    } else if (phone_number) {
      userQuery = userQuery.eq('phone', phone_number);
    }

    const { data: userData, error: userError } = await userQuery.single();

    if (userError || !userData) {
      console.error('❌ User not found:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userData.id;
    const userCode = userData.user_code;
    const userLanguage = userData.language || 'en';

    // Get food logs for the date
    const { data: foodLogs, error: logsError } = await adminDB
      .from('food_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('log_date', date);

    if (logsError) {
      console.error('❌ Error fetching food logs:', logsError);
      return res.status(500).json({ error: 'Failed to fetch food logs' });
    }

    // Calculate totals from food logs
    const totalCalories = (foodLogs || []).reduce((sum, log) => {
      let logCalories = 0;
      if (log.food_items) {
        try {
          const foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
          if (Array.isArray(foodItems)) {
            logCalories = foodItems.reduce((itemSum, item) => itemSum + (item.cals || 0), 0);
          }
        } catch (e) {
          console.error('Error parsing food_items:', e);
        }
      }
      return sum + logCalories + (log.total_calories || 0);
    }, 0);

    const totalProtein = (foodLogs || []).reduce((sum, log) => {
      let logProtein = 0;
      if (log.food_items) {
        try {
          const foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
          if (Array.isArray(foodItems)) {
            logProtein = foodItems.reduce((itemSum, item) => itemSum + (item.p || 0), 0);
          }
        } catch (e) {
          console.error('Error parsing food_items:', e);
        }
      }
      return sum + logProtein + (log.total_protein_g || 0);
    }, 0);

    const totalCarbs = (foodLogs || []).reduce((sum, log) => {
      let logCarbs = 0;
      if (log.food_items) {
        try {
          const foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
          if (Array.isArray(foodItems)) {
            logCarbs = foodItems.reduce((itemSum, item) => itemSum + (item.c || 0), 0);
          }
        } catch (e) {
          console.error('Error parsing food_items:', e);
        }
      }
      return sum + logCarbs + (log.total_carbs_g || 0);
    }, 0);

    const totalFat = (foodLogs || []).reduce((sum, log) => {
      let logFat = 0;
      if (log.food_items) {
        try {
          const foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
          if (Array.isArray(foodItems)) {
            logFat = foodItems.reduce((itemSum, item) => itemSum + (item.f || 0), 0);
          }
        } catch (e) {
          console.error('Error parsing food_items:', e);
        }
      }
      return sum + logFat + (log.total_fat_g || 0);
    }, 0);

    // Get meal plan targets: sum macros and calories from MAIN dishes only (not alternatives)
    // When client has multiple active meal plans, pick the one whose active_days (0=Sun..6=Sat) includes the request date
    const dayOfWeek = (() => {
      const d = new Date(date);
      if (isNaN(d.getTime())) return null;
      return d.getDay(); // 0 Sunday .. 6 Saturday
    })();

    const { data: activeMealPlans, error: mealPlansError } = await adminDB
      .from('meal_plans_and_schemas')
      .select('*')
      .eq('user_code', userCode)
      .eq('record_type', 'meal_plan')
      .eq('status', 'active');

    if (mealPlansError) {
      console.error('❌ Error fetching meal plans:', mealPlansError);
    }

    let mealPlanData = null;
    if (Array.isArray(activeMealPlans) && activeMealPlans.length > 0) {
      if (activeMealPlans.length === 1) {
        mealPlanData = activeMealPlans[0];
      } else {
        // Multiple active plans: use active_days to match the request date
        const matching = activeMealPlans.find((plan) => {
          const days = plan.active_days;
          if (days == null || !Array.isArray(days)) return true; // no filter = applies to any day
          if (dayOfWeek == null) return true;
          return days.includes(dayOfWeek);
        });
        mealPlanData = matching || activeMealPlans[0]; // fallback to first if no day match
      }
    }

    const defGoals = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
    let dailyGoals = { ...defGoals };

    if (mealPlanData && mealPlanData.meal_plan && Array.isArray(mealPlanData.meal_plan.meals)) {
      const totalsFromMainOnly = mealPlanData.meal_plan.meals.reduce((acc, meal) => {
        if (meal.main && meal.main.nutrition) {
          acc.calories += Number(meal.main.nutrition.calories) || 0;
          acc.protein += Number(meal.main.nutrition.protein) || 0;
          acc.carbs += Number(meal.main.nutrition.carbs) || 0;
          acc.fat += Number(meal.main.nutrition.fat) || 0;
        }
        return acc;
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

      const safeNum = (v, def) => {
        const n = Number(v);
        return (typeof n === 'number' && !isNaN(n) && n >= 0) ? n : def;
      };
      dailyGoals = {
        calories: safeNum(totalsFromMainOnly.calories, defGoals.calories),
        protein: safeNum(totalsFromMainOnly.protein, defGoals.protein),
        carbs: safeNum(totalsFromMainOnly.carbs, defGoals.carbs),
        fat: safeNum(totalsFromMainOnly.fat, defGoals.fat)
      };
    }

    // Calculate percentages (avoid division by zero)
    const caloriesPercent = dailyGoals.calories > 0 ? Math.round((totalCalories / dailyGoals.calories) * 100) : 0;
    const proteinPercent = dailyGoals.protein > 0 ? Math.round((totalProtein / dailyGoals.protein) * 100) : 0;
    const carbsPercent = dailyGoals.carbs > 0 ? Math.round((totalCarbs / dailyGoals.carbs) * 100) : 0;
    const fatPercent = dailyGoals.fat > 0 ? Math.round((totalFat / dailyGoals.fat) * 100) : 0;

    // Generate SVG
    const outerRadius = 120;
    const innerRadius = 100;
    const outerCircumference = 2 * Math.PI * outerRadius;
    const circumference = 2 * Math.PI * innerRadius;
    const segmentLength = circumference / 3;

    // Calculate lengths (capped so overflow cannot exceed its own sector boundaries)
    const caloriesNormalLength = Math.min(caloriesPercent, 100) / 100 * outerCircumference;
    const caloriesOverflowLength = caloriesPercent > 100
      ? Math.min(((caloriesPercent - 100) / 100) * outerCircumference, outerCircumference)
      : 0;

    const proteinNormalLength = Math.min(proteinPercent, 100) / 100 * segmentLength;
    const proteinOverflowLength = proteinPercent > 100
      ? Math.min(((proteinPercent - 100) / 100) * segmentLength, segmentLength)
      : 0;

    const carbsNormalLength = Math.min(carbsPercent, 100) / 100 * segmentLength;
    const carbsOverflowLength = carbsPercent > 100
      ? Math.min(((carbsPercent - 100) / 100) * segmentLength, segmentLength)
      : 0;

    const fatNormalLength = Math.min(fatPercent, 100) / 100 * segmentLength;
    const fatOverflowLength = fatPercent > 100
      ? Math.min(((fatPercent - 100) / 100) * segmentLength, segmentLength)
      : 0;

    // Center label: fit inside inner ring hole (path r=innerRadius, stroke 16 → inner clear radius innerRadius - 8)
    const innerClearR = innerRadius - 8;
    const calCenterStr = totalCalories.toLocaleString();
    const calCharFactor = 0.58;
    let centerCaloriesFontSize = 56;
    const estCalTextW = calCenterStr.length * calCharFactor * centerCaloriesFontSize;
    const maxCalW = innerClearR * 2 * 0.88;
    if (estCalTextW > maxCalW) {
      centerCaloriesFontSize = Math.max(28, Math.floor(maxCalW / (calCenterStr.length * calCharFactor)));
    }

    // Stack calories + KCAL around geometric center (140,140) so the pair is vertically balanced
    const kcalSubFont = 14;
    const hubGap = 8;
    const hubLineSpacing =
      centerCaloriesFontSize * 0.42 + hubGap + kcalSubFont * 0.42;
    const hubCalLineY = -hubLineSpacing / 2;
    const hubKcalLineY = hubLineSpacing / 2;

    // Legend: inset from card edges; values start after label column so rows never collide
    const legendPadX = 28;
    const legendValueX = 118;

    // % labels at arc midpoints; tangential to ring (screen space)
    const cxRing = 140;
    const cyRing = 140;
    const minArcPxForPctLabel = 18; // Prevents labels from drawing on tiny slivers

    /** Local coords: point at path distance s (clockwise from 3 o'clock on circle path). */
    const polarAtPathS = (radius, sAlongPath) => {
      const th = sAlongPath / radius; // FIXED: Removed the negative sign so it moves clockwise like the lines do
      return {
        x: cxRing + radius * Math.cos(th),
        y: cyRing + radius * Math.sin(th)
      };
    };

    /** Map local (pre-parent-rotate) point to screen/viewBox coords: parent is rotate(-90, 140, 140). */
    const toScreenXY = (lx, ly) => {
      const dx = lx - cxRing;
      const dy = ly - cyRing;
      return { x: cxRing + dy, y: cyRing - dx };
    };

    /** Degrees: tangent to circle clockwise at this point, in screen space, WITH readability flip. */
    const tangentDegScreen = (lx, ly) => {
      const { x: sx, y: sy } = toScreenXY(lx, ly);
      const psi = Math.atan2(sy - cyRing, sx - cxRing);
      let deg = (psi + Math.PI / 2) * (180 / Math.PI);
      
      // Normalize strictly to 0-360 degrees
      deg = ((deg % 360) + 360) % 360;
      
      // UI Polish: Prevent upside-down text by flipping it 180 degrees if it's in the lower hemisphere
      if (deg > 90 && deg < 270) {
        deg -= 180;
      }
      return deg;
    };

    const calArcTotal = caloriesNormalLength + caloriesOverflowLength;
    const protArcTotal = proteinNormalLength + proteinOverflowLength;
    const carbArcTotal = carbsNormalLength + carbsOverflowLength;
    const fatArcTotal = fatNormalLength + fatOverflowLength;
    
    const calArcForLabel = Math.min(calArcTotal, outerCircumference);

    const sCalMid = calArcForLabel / 2;
    const sProtMid = protArcTotal / 2;
    const sCarbMid = segmentLength + carbArcTotal / 2;
    const sFatMid = 2 * segmentLength + fatArcTotal / 2;

    const locCal = calArcForLabel >= minArcPxForPctLabel ? polarAtPathS(outerRadius, sCalMid) : null;
    const locProt = protArcTotal >= minArcPxForPctLabel ? polarAtPathS(innerRadius, sProtMid) : null;
    const locCarb = carbArcTotal >= minArcPxForPctLabel ? polarAtPathS(innerRadius, sCarbMid) : null;
    const locFat = fatArcTotal >= minArcPxForPctLabel ? polarAtPathS(innerRadius, sFatMid) : null;

    // Upgraded Typography: Smaller, normal weight, strictly inside the line
    const ringPctFs = 10;
    const ringPctWeight = '500'; 
    const ringPctStroke = '1';
    const ringPctStrokeHex = '#ffffff';

    const pctTextEl = (loc, pctStr) => {
      if (!loc) return '';
      const { x: sx, y: sy } = toScreenXY(loc.x, loc.y);
      const deg = tangentDegScreen(loc.x, loc.y);
      
      // FIXED: Used dy="0.35em" instead of dominant-baseline. This forces the text to perfectly 
      // straddle the center line across all rendering engines (like sharp/png generators).
      return `  <text transform="rotate(${deg} ${sx} ${sy})" x="${sx}" y="${sy}" dy="0.35em" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" font-size="${ringPctFs}" font-weight="${ringPctWeight}" fill="#111827" stroke="${ringPctStrokeHex}" stroke-width="${ringPctStroke}" stroke-linejoin="round" paint-order="stroke fill">${pctStr}</text>`;
    };

    const ringPctSvg = [
      pctTextEl(locCal, `${caloriesPercent}%`),
      pctTextEl(locProt, `${proteinPercent}%`),
      pctTextEl(locCarb, `${carbsPercent}%`),
      pctTextEl(locFat, `${fatPercent}%`)
    ].filter(Boolean).join('\n');

    // Format weight helper (never show NaNg)
    const formatWeight = (grams) => {
      const n = Number(grams);
      return `${typeof n === 'number' && !isNaN(n) ? Math.round(n) : 0}g`;
    };

    // Generate SVG string (white background so SVG fallback matches PNG when served without sharp)
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 460">
  <defs>
    <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="proteinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c084fc" />
      <stop offset="100%" stop-color="#7e22ce" />
    </linearGradient>
    <linearGradient id="carbsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <linearGradient id="fatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fcd34d" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>

    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#000000" flood-opacity="0.15" />
    </filter>
  </defs>

  <rect width="280" height="460" fill="#ffffff" rx="24" />
  
  <g transform="rotate(-90 140 140)">
  
  <circle
    cx="140"
    cy="140"
    r="${outerRadius}"
    fill="none"
    stroke="#f3f4f6"
    stroke-width="16"
  />
  
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="#f3f4f6"
    stroke-width="16"
  />
  
  ${caloriesNormalLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${outerRadius}"
    fill="none"
    stroke="url(#calGrad)"
    stroke-width="16"
    stroke-linecap="round"
    stroke-dasharray="${caloriesNormalLength} ${outerCircumference}"
    stroke-dashoffset="0"
    filter="url(#softShadow)"
  />` : ''}
  ${caloriesOverflowLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${outerRadius}"
    fill="none"
    stroke="#ffffff"
    stroke-width="20"
    stroke-linecap="round"
    stroke-dasharray="${caloriesOverflowLength} ${outerCircumference}"
    stroke-dashoffset="0"
  />
  <circle
    cx="140"
    cy="140"
    r="${outerRadius}"
    fill="none"
    stroke="#047857"
    stroke-width="16"
    stroke-linecap="round"
    stroke-dasharray="${caloriesOverflowLength} ${outerCircumference}"
    stroke-dashoffset="0"
  />` : ''}
  
  ${proteinNormalLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="url(#proteinGrad)"
    stroke-width="16"
    stroke-linecap="round"
    stroke-dasharray="${proteinNormalLength} ${circumference}"
    stroke-dashoffset="0"
    filter="url(#softShadow)"
  />` : ''}
  ${carbsNormalLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="url(#carbsGrad)"
    stroke-width="16"
    stroke-linecap="round"
    stroke-dasharray="${carbsNormalLength} ${circumference}"
    stroke-dashoffset="${-segmentLength}"
    filter="url(#softShadow)"
  />` : ''}
  ${fatNormalLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="url(#fatGrad)"
    stroke-width="16"
    stroke-linecap="round"
    stroke-dasharray="${fatNormalLength} ${circumference}"
    stroke-dashoffset="${-segmentLength * 2}"
    filter="url(#softShadow)"
  />` : ''}
  
  ${proteinOverflowLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="#ffffff"
    stroke-width="20"
    stroke-linecap="round"
    stroke-dasharray="${proteinOverflowLength} ${circumference}"
    stroke-dashoffset="0"
  />
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="#7e22ce"
    stroke-width="16"
    stroke-linecap="round"
    stroke-dasharray="${proteinOverflowLength} ${circumference}"
    stroke-dashoffset="0"
  />` : ''}

  ${carbsOverflowLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="#ffffff"
    stroke-width="20"
    stroke-linecap="round"
    stroke-dasharray="${carbsOverflowLength} ${circumference}"
    stroke-dashoffset="${-segmentLength}"
  />
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="#1d4ed8"
    stroke-width="16"
    stroke-linecap="round"
    stroke-dasharray="${carbsOverflowLength} ${circumference}"
    stroke-dashoffset="${-segmentLength}"
  />` : ''}

  ${fatOverflowLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="#ffffff"
    stroke-width="20"
    stroke-linecap="round"
    stroke-dasharray="${fatOverflowLength} ${circumference}"
    stroke-dashoffset="${-segmentLength * 2}"
  />
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="#b45309"
    stroke-width="16"
    stroke-linecap="round"
    stroke-dasharray="${fatOverflowLength} ${circumference}"
    stroke-dashoffset="${-segmentLength * 2}"
  />` : ''}
  </g>

${ringPctSvg}
  
  <g transform="translate(140, 140)">
    <text
      text-anchor="middle"
      dominant-baseline="central"
      y="${hubCalLineY}"
      font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      font-size="${centerCaloriesFontSize}"
      font-weight="700"
      fill="#111827"
      letter-spacing="-0.03em"
    >${calCenterStr}</text>
    <text
      text-anchor="middle"
      dominant-baseline="central"
      y="${hubKcalLineY}"
      font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      font-size="${kcalSubFont}"
      font-weight="600"
      fill="#9ca3af"
      letter-spacing="0.05em"
    >KCAL</text>
  </g>
  
  <g transform="translate(${legendPadX}, 310)">
    ${userLanguage === 'he' ? `
    <g transform="translate(0, 0)">
      <text x="0" y="12" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">
        ${totalCalories.toLocaleString()} <tspan fill="#9ca3af" font-weight="400">/ ${dailyGoals.calories.toLocaleString()}</tspan>
      </text>
      <g transform="translate(218, 0)">
        <circle cx="-40" cy="8" r="6" fill="#10b981"/>
        <text x="-30" y="12" text-anchor="end" direction="rtl" unicode-bidi="embed" xml:lang="he" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="500" fill="#4b5563">
          קלוריות
        </text>
      </g>
    </g>
    <g transform="translate(0, 35)">
      <text x="0" y="12" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">
        ${formatWeight(totalProtein)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(dailyGoals.protein)}</tspan>
      </text>
      <g transform="translate(218, 0)">
        <circle cx="-40" cy="8" r="6" fill="#a855f7"/>
        <text x="-30" y="12" text-anchor="end" direction="rtl" unicode-bidi="embed" xml:lang="he" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="500" fill="#4b5563">
          חלבון
        </text>
      </g>
    </g>
    <g transform="translate(0, 70)">
      <text x="0" y="12" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">
        ${formatWeight(totalCarbs)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(dailyGoals.carbs)}</tspan>
      </text>
      <g transform="translate(218, 0)">
        <circle cx="-40" cy="8" r="6" fill="#3b82f6"/>
        <text x="-30" y="12" text-anchor="end" direction="rtl" unicode-bidi="embed" xml:lang="he" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="500" fill="#4b5563">
          פחמימות
        </text>
      </g>
    </g>
    <g transform="translate(0, 105)">
      <text x="0" y="12" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">
        ${formatWeight(totalFat)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(dailyGoals.fat)}</tspan>
      </text>
      <g transform="translate(218, 0)">
        <circle cx="-40" cy="8" r="6" fill="#f59e0b"/>
        <text x="-30" y="12" text-anchor="end" direction="rtl" unicode-bidi="embed" xml:lang="he" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="500" fill="#4b5563">
          שומן
        </text>
      </g>
    </g>
    ` : `
    <g transform="translate(0, 0)">
      <circle cx="6" cy="8" r="6" fill="#10b981"/>
      <text x="20" y="13" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="500" fill="#4b5563">
        Calories
      </text>
      <text x="${legendValueX}" y="13" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">
        ${totalCalories.toLocaleString()} <tspan fill="#9ca3af" font-weight="400">/ ${dailyGoals.calories.toLocaleString()}</tspan>
      </text>
    </g>
    <g transform="translate(0, 35)">
      <circle cx="6" cy="8" r="6" fill="#a855f7"/>
      <text x="20" y="13" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="500" fill="#4b5563">
        Protein
      </text>
      <text x="${legendValueX}" y="13" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">
        ${formatWeight(totalProtein)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(dailyGoals.protein)}</tspan>
      </text>
    </g>
    <g transform="translate(0, 70)">
      <circle cx="6" cy="8" r="6" fill="#3b82f6"/>
      <text x="20" y="13" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="500" fill="#4b5563">
        Carbs
      </text>
      <text x="${legendValueX}" y="13" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">
        ${formatWeight(totalCarbs)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(dailyGoals.carbs)}</tspan>
      </text>
    </g>
    <g transform="translate(0, 105)">
      <circle cx="6" cy="8" r="6" fill="#f59e0b"/>
      <text x="20" y="13" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="500" fill="#4b5563">
        Fat
      </text>
      <text x="${legendValueX}" y="13" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">
        ${formatWeight(totalFat)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(dailyGoals.fat)}</tspan>
      </text>
    </g>
    `}
  </g>
</svg>`;

    // Prefer PNG via sharp when available (looks consistent everywhere). In production sharp
    // can fail (wrong native binary, missing libvips); fall back to SVG so the image still displays.
    try {
      const pngBuffer = await sharp(Buffer.from(svg))
        .resize(1200, Math.round((1200 * 460) / 280), {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toBuffer();

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(pngBuffer);
    } catch (sharpError) {
      console.warn('⚠️ Macro summary: sharp PNG conversion failed, serving SVG fallback:', sharpError.message);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(svg);
    }

  } catch (error) {
    console.error('❌ Error generating macro summary SVG:', error);
    res.status(500).json({ 
      error: 'Failed to generate macro summary SVG',
      message: error.message 
    });
  }
});

// ====================================
// ERROR HANDLING
// ====================================

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ====================================
// SERVER STARTUP
// ====================================

const serverInstance = app.listen(PORT, () => {
  const addressInfo = serverInstance.address();
  const displayPort = typeof addressInfo === 'string' ? addressInfo : addressInfo?.port;
  console.log(`🚀 Stripe API server running on port ${displayPort}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💳 Stripe API Version: ${stripe.VERSION || 'latest'}`);
  
  // Verify Stripe configuration
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('⚠️  WARNING: STRIPE_SECRET_KEY not found in environment');
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn('⚠️  WARNING: STRIPE_WEBHOOK_SECRET not found in environment');
  }
});
