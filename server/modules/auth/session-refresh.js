// POST /api/auth/refresh: trade a refresh token for a new Supabase session.
//
// The app signs the user out when this returns 401, so 401 must mean the refresh
// token itself is dead (used, revoked, expired, unknown). Anything else (Supabase
// unreachable, a timeout, a 5xx) is 503 and the app keeps the user signed in and
// tries again later. `code` tells the two apart without parsing the message.

const REFRESH_INVALID = 'refresh_invalid';
const REFRESH_UNAVAILABLE = 'refresh_unavailable';

// Supabase Auth error codes that mean this refresh token can never work again.
const INVALID_TOKEN_CODES = new Set([
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_not_found',
  'session_expired',
  'user_not_found',
  'user_banned',
]);

// Older GoTrue versions send no `code`, only the message.
const INVALID_TOKEN_MESSAGE = /invalid refresh token|already used|not found|revoked|expired|banned/i;

/** True only when Supabase answered and said the refresh token is no longer valid. */
function isInvalidRefreshTokenError(error) {
  if (!error || error.name !== 'AuthApiError') return false;
  const status = Number(error.status);
  if (status < 400 || status >= 500 || status === 408 || status === 429) return false;
  if (error.code && INVALID_TOKEN_CODES.has(error.code)) return true;
  return INVALID_TOKEN_MESSAGE.test(String(error.message || ''));
}

function createRefreshHandler(createAuthClient) {
  return async function refreshSession(req, res) {
    const { refresh_token } = req.body || {};
    if (!refresh_token || typeof refresh_token !== 'string') {
      return res.status(400).json({ error: 'refresh_token is required' });
    }
    try {
      const { data, error } = await createAuthClient().auth.refreshSession({ refresh_token });
      if (!error && data?.session?.access_token) {
        return res.json({ session: data.session, user: data.user, error: null });
      }
      if (error && isInvalidRefreshTokenError(error)) {
        console.warn('🔁 Refresh token rejected:', error.code || error.status, error.message);
        return res.status(401).json({ error: error.message || 'Invalid refresh token', code: REFRESH_INVALID });
      }
      console.error('🔁 Refresh unavailable:', error?.name, error?.status, error?.message || 'no session returned');
    } catch (error) {
      console.error('❌ POST /api/auth/refresh error:', error);
    }
    return res.status(503).json({ error: 'Could not refresh the session right now. Try again.', code: REFRESH_UNAVAILABLE });
  };
}

const refreshSession = createRefreshHandler(() => require('../../config/db').createStatelessAuthClient());

module.exports = {
  REFRESH_INVALID,
  REFRESH_UNAVAILABLE,
  isInvalidRefreshTokenError,
  createRefreshHandler,
  refreshSession,
};
