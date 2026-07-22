import React, { useEffect, useState } from 'react';
import OnboardingFlow from './OnboardingFlow';
import { useOnboardingStore, PHASES } from './onboarding.store';

/**
 * ProfilePage mounts this when onboarding should show.
 * Owns open/close only; all flow state lives in Zustand.
 */
export default function OnboardingGate({
  isOpen,
  onClose,
  user,
  companyConfig,
  companyName,
  companyId = null,
  forceFresh = false,
  remountKey = 0,
  allowDismiss = true,
}) {
  const [mounted, setMounted] = useState(false);
  const reset = useOnboardingStore((s) => s.reset);
  const forcePhase = useOnboardingStore((s) => s.forcePhase);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && forceFresh) {
      reset({ hydrated: false });
      forcePhase(PHASES.WELCOME);
    }
  }, [forceFresh, remountKey, isOpen, reset, forcePhase]);

  if (!isOpen && !mounted) return null;
  if (!isOpen) return null;

  const handleComplete = (completed = true) => {
    setMounted(false);
    onClose?.(completed);
  };

  return (
    <OnboardingFlow
      key={`onboarding-${remountKey}-${user?.id || 'anon'}`}
      user={user}
      companyConfig={companyConfig}
      companyName={companyName}
      companyId={companyId}
      forceFresh={forceFresh}
      allowDismiss={allowDismiss}
      skipPayment={Boolean(user?.user_metadata?.skip_pricing)}
      onComplete={handleComplete}
    />
  );
}
