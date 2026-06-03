import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  consumeOAuthHashIfPresent,
  hasOAuthHash,
  parseHashParams,
} from '../lib/apiClient';
import { bootstrapClientRecordIfMissing } from '../supabase/auth';

/**
 * Supabase may redirect to Site URL (e.g. /) with #access_token=… instead of /auth/callback.
 * This component picks up those tokens on any route.
 *
 * Special case: password recovery links also arrive as #access_token=…&type=recovery.
 * Those must NOT log the user in — they have to reach /reset-password so the user can
 * choose a new password.
 */
function OAuthHashHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  // Once we've consumed an OAuth hash + run the bootstrap, don't re-run on subsequent
  // route changes in the same session.
  const ranRef = useRef(false);

  useEffect(() => {
    if (location.pathname === '/auth/callback') return;
    if (!hasOAuthHash()) return;
    if (ranRef.current) return;

    const params = parseHashParams();

    if (params.type === 'recovery') {
      if (location.pathname !== '/reset-password') {
        navigate(`/reset-password${window.location.hash}`, { replace: true });
      }
      return;
    }

    if (!consumeOAuthHashIfPresent()) return;
    ranRef.current = true;

    // Mirrors AuthCallbackPage: ensure the clients/chat_users rows exist with the
    // right provider_id before the user lands on /profile, so the OnboardingModal
    // has a real companyConfig.
    (async () => {
      try {
        await bootstrapClientRecordIfMissing();
      } catch (e) {
        console.warn('[OAuthHashHandler] client bootstrap failed (non-blocking):', e);
      }
      navigate('/profile', { replace: true });
    })();
  }, [location.pathname, location.hash, navigate]);

  return null;
}

export default OAuthHashHandler;
