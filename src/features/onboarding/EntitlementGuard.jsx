import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOnboardingEntitlement } from './OnboardingEntitlementContext';

const PAYMENT_RETURN_PATHS = new Set(['/payment-success', '/payment-cancel']);

function isProfilePath(pathname) {
  return pathname === '/profile' || /^\/c\/[^/]+\/profile\/?$/.test(pathname);
}

/**
 * Redirects entitled-incomplete users to profile (onboarding wall).
 */
export default function EntitlementGuard({ children }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { requiresWall, loading: entitlementLoading } = useOnboardingEntitlement();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || entitlementLoading || !isAuthenticated || !requiresWall) return;

    const path = location.pathname;
    if (isProfilePath(path) || PAYMENT_RETURN_PATHS.has(path)) return;

    navigate('/profile', { replace: true, state: { onboardingWall: true } });
  }, [
    authLoading,
    entitlementLoading,
    isAuthenticated,
    requiresWall,
    location.pathname,
    navigate,
  ]);

  return children;
}
