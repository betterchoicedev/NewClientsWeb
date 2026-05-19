import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { consumeOAuthHashIfPresent, hasOAuthHash } from '../lib/apiClient';

/**
 * Supabase may redirect to Site URL (e.g. /) with #access_token=… instead of /auth/callback.
 * This component picks up those tokens on any route.
 */
function OAuthHashHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/auth/callback') return;
    if (!hasOAuthHash()) return;

    if (consumeOAuthHashIfPresent()) {
      navigate('/profile', { replace: true });
    }
  }, [location.pathname, location.hash, navigate]);

  return null;
}

export default OAuthHashHandler;
