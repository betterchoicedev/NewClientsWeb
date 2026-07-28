import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../../context/AuthContext';
import { getOnboardingStatus } from './api/onboardingApi';
import { canDismissOnboarding, requiresOnboardingWall } from './onboarding.machine';

const OnboardingEntitlementContext = createContext(null);

export function OnboardingEntitlementProvider({ children }) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const skipPayment = Boolean(user?.user_metadata?.skip_pricing);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setStatus(null);
      setError(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await getOnboardingStatus();
      setStatus(next);
      return next;
    } catch (e) {
      setError(e.message || 'Failed to load onboarding status');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!isAuthenticated || !user?.id) {
      setStatus(null);
      setError(null);
      return undefined;
    }
    refresh();
    return undefined;
  }, [authLoading, isAuthenticated, user?.id, refresh]);

  const requiresWall = useMemo(
    () => requiresOnboardingWall(status, { skipPayment }),
    [status, skipPayment]
  );

  const canDismiss = useMemo(
    () => canDismissOnboarding(status, { skipPayment }),
    [status, skipPayment]
  );

  const value = useMemo(
    () => ({
      status,
      loading: authLoading || loading,
      error,
      refresh,
      requiresWall,
      canDismiss,
      skipPayment,
    }),
    [status, authLoading, loading, error, refresh, requiresWall, canDismiss, skipPayment]
  );

  return (
    <OnboardingEntitlementContext.Provider value={value}>
      {children}
    </OnboardingEntitlementContext.Provider>
  );
}

export function useOnboardingEntitlement() {
  const ctx = useContext(OnboardingEntitlementContext);
  if (!ctx) {
    throw new Error('useOnboardingEntitlement must be used within OnboardingEntitlementProvider');
  }
  return ctx;
}
