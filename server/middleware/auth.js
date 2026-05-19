/**
 * JWT authentication middleware for API routes.
 * Uses Supabase Auth (anon client) to verify Bearer tokens — never exposes service role to clients.
 */

function createAuthMiddleware(supabaseAuth, supabaseDb, chatSupabase) {
  async function requireAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization required' });
      }

      const token = authHeader.slice(7).trim();
      if (!token) {
        return res.status(401).json({ error: 'Authorization required' });
      }

      const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
      if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      req.authUser = user;
      req.userId = user.id;
      req.accessToken = token;

      const { data: clientRow } = await supabaseDb
        .from('clients')
        .select('user_code, email, full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      req.clientRecord = clientRow || null;
      req.userCode = clientRow?.user_code || null;

      next();
    } catch (err) {
      console.error('requireAuth error:', err);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }

  function assertSelfUserId(source = 'params') {
    return (req, res, next) => {
      let targetId;
      if (source === 'params') {
        targetId = req.params.userId;
      } else if (source === 'body') {
        targetId = req.body?.userId;
      } else if (source === 'query') {
        targetId = req.query?.userId || req.query?.user_id;
      }

      if (targetId && targetId !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    };
  }

  function assertOwnUserCode() {
    return (req, res, next) => {
      const code =
        req.query?.userCode ||
        req.body?.userCode ||
        req.body?.user_code;

      if (code && req.userCode && code !== req.userCode) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    };
  }

  async function verifyFoodLogOwnership(foodLogId, userCode) {
    if (!chatSupabase || !foodLogId || !userCode) return false;

    const { data: chatUser } = await chatSupabase
      .from('chat_users')
      .select('id')
      .eq('user_code', userCode)
      .maybeSingle();

    if (!chatUser) return false;

    const { data: log } = await chatSupabase
      .from('food_logs')
      .select('user_id')
      .eq('id', foodLogId)
      .maybeSingle();

    return !!(log && log.user_id === chatUser.id);
  }

  const PUBLIC_API_PREFIXES = [
    '/api/auth/login',
    '/api/auth/signup',
    '/api/auth/check-email',
    '/api/auth/check-phone',
    '/api/auth/check-user-code',
    '/api/auth/check-registration-rule',
    '/api/auth/default-provider',
    '/api/auth/google',
    '/api/auth/oauth/callback',
    '/api/auth/oauth/mobile-callback',
    '/api/auth/oauth/exchange',
    '/api/auth/reset-password',
    '/api/auth/recovery/session',
    '/api/webhooks/',
    '/api/exchange-rates',
    '/api/waiting-list/',
    '/api/contact',
    '/api/ingredient-reports',
    '/api/weekly-macro-summary-svg',
    '/api/macro-summary-svg',
    '/health',
  ];

  const PROTECTED_API_PREFIXES = [
    '/api/user/',
    '/api/onboarding/',
    '/api/whatsapp/',
    '/api/profile/',
    '/api/food-logs',
    '/api/daily-xp/',
    '/api/chat-messages',
    '/api/weight-logs',
    '/api/companies',
    '/api/client-company-assignment',
    '/api/assign-client-company',
    '/api/training-plan',
    '/api/meal-plan',
    '/api/meal-plan-history',
    '/api/messages',
    '/api/debug/',
    '/api/db/registration-links',
    '/api/foods/',
    '/api/stripe/subscriptions',
    '/api/stripe/process-checkout-session',
    '/api/stripe/checkout-session/',
    '/api/stripe/sync-to-database',
    '/api/stripe/check-commitment-periods',
    '/api/auth/me',
    '/api/auth/logout',
    '/api/auth/refresh',
    '/api/auth/update-password',
    '/api/auth/client/',
  ];

  function isPublicApiPath(path) {
    return PUBLIC_API_PREFIXES.some((prefix) => path.startsWith(prefix));
  }

  function isProtectedApiPath(path) {
    return PROTECTED_API_PREFIXES.some((prefix) => path.startsWith(prefix));
  }

  function apiAuthGuard(req, res, next) {
    if (req.method === 'OPTIONS') return next();
    const path = req.path;

    if (!path.startsWith('/api/')) return next();
    if (isPublicApiPath(path)) return next();
    if (!isProtectedApiPath(path)) return next();

    return requireAuth(req, res, next);
  }

  return {
    requireAuth,
    assertSelfUserId,
    assertOwnUserCode,
    verifyFoodLogOwnership,
    apiAuthGuard,
  };
}

module.exports = { createAuthMiddleware };
