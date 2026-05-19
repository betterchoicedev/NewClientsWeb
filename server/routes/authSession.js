/**
 * Session & OAuth routes (browser never touches Supabase directly).
 */

function getFrontendOrigin() {
  return (
    process.env.FRONTEND_URL ||
    process.env.REACT_APP_FRONTEND_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

function getApiPublicOrigin(req) {
  if (process.env.API_PUBLIC_URL) {
    return process.env.API_PUBLIC_URL.replace(/\/$/, '');
  }
  const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}

function registerAuthSessionRoutes(app, { supabaseAuth, supabaseUrl, supabaseAnonKey }) {
  app.get('/api/auth/me', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization required' });
      }
      const token = authHeader.slice(7).trim();
      const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
      if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      res.json({ user, error: null });
    } catch (error) {
      console.error('GET /api/auth/me error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/auth/refresh', async (req, res) => {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) {
        return res.status(400).json({ error: 'refresh_token is required' });
      }
      const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token });
      if (error) throw error;
      res.json({ session: data.session, user: data.user, error: null });
    } catch (error) {
      console.error('POST /api/auth/refresh error:', error);
      res.status(401).json({ error: error.message || 'Failed to refresh session' });
    }
  });

  app.post('/api/auth/logout', async (_req, res) => {
    res.json({ error: null });
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      const redirectTo = `${getFrontendOrigin()}/reset-password`;
      const { error } = await supabaseAuth.auth.resetPasswordForEmail(
        email.toLowerCase().trim(),
        { redirectTo }
      );
      if (error) throw error;
      res.json({ error: null });
    } catch (error) {
      console.error('POST /api/auth/reset-password error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/auth/recovery/session', async (req, res) => {
    try {
      const { access_token, refresh_token } = req.body;
      if (!access_token || !refresh_token) {
        return res.status(400).json({ error: 'Tokens are required' });
      }
      const { data, error } = await supabaseAuth.auth.setSession({
        access_token,
        refresh_token,
      });
      if (error) throw error;
      res.json({
        session: data.session,
        user: data.user,
        error: null,
      });
    } catch (error) {
      console.error('POST /api/auth/recovery/session error:', error);
      res.status(401).json({ error: error.message || 'Invalid recovery session' });
    }
  });

  app.post('/api/auth/update-password', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization required' });
      }
      const token = authHeader.slice(7).trim();
      const { password } = req.body;
      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const { createClient } = require('@supabase/supabase-js');
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data, error } = await userClient.auth.updateUser({ password });
      if (error) throw error;
      res.json({ data, error: null });
    } catch (error) {
      console.error('POST /api/auth/update-password error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/auth/google', async (req, res) => {
    try {
      // Redirect straight to the SPA callback (must be whitelisted in Supabase Auth → URL config).
      const redirectTo =
        req.query.redirectTo || `${getFrontendOrigin()}/auth/callback`;

      const { data, error } = await supabaseAuth.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;

      res.redirect(data.url);
    } catch (error) {
      console.error('GET /api/auth/google error:', error);
      res.status(500).json({ error: error.message || 'Failed to start Google sign-in' });
    }
  });

  app.get('/api/auth/oauth/callback', async (req, res) => {
    try {
      const code = req.query.code;
      if (!code) {
        return res.redirect(`${getFrontendOrigin()}/login?error=oauth_missing_code`);
      }

      const { data, error } = await supabaseAuth.auth.exchangeCodeForSession(code);
      if (error) throw error;

      const nextPath = req.query.next || `${getFrontendOrigin()}/auth/callback`;

      const session = data.session;
      const fragment = new URLSearchParams({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: String(session.expires_at ?? ''),
        expires_in: String(session.expires_in ?? ''),
        token_type: session.token_type || 'bearer',
      }).toString();

      const redirectBase = nextPath.includes('://') ? nextPath : `${getFrontendOrigin()}${nextPath.startsWith('/') ? '' : '/'}${nextPath}`;
      const joiner = redirectBase.includes('#') ? '&' : '#';
      res.redirect(`${redirectBase}${joiner}${fragment}`);
    } catch (error) {
      console.error('GET /api/auth/oauth/callback error:', error);
      res.redirect(`${getFrontendOrigin()}/login?error=oauth_failed`);
    }
  });
}

module.exports = { registerAuthSessionRoutes };
