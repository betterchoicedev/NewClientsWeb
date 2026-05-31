import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  consumeOAuthHashIfPresent,
  hasOAuthHash,
  parseHashParams,
} from '../lib/apiClient';

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

  useEffect(() => {
    if (location.pathname === '/auth/callback') return;
    if (!hasOAuthHash()) return;

    const params = parseHashParams();

    if (params.type === 'recovery') {
      if (location.pathname !== '/reset-password') {
        navigate(`/reset-password${window.location.hash}`, { replace: true });
      }
      return;
    }

    if (consumeOAuthHashIfPresent()) {
      navigate('/profile', { replace: true });
    }
  }, [location.pathname, location.hash, navigate]);

  return null;
}

export default OAuthHashHandler;
