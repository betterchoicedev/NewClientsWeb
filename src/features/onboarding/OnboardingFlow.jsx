import React, { useEffect } from 'react';
import { useOnboardingStore, PHASES } from './onboarding.store';
import { useOnboardingDraftSync, readLocalDraft, draftSavedAtMs } from './hooks/useOnboardingDraftSync';
import { getOnboardingStatus } from './api/onboardingApi';
import WelcomeStep from './steps/WelcomeStep';
import QuestionsPhase from './phases/QuestionsPhase';
import CommittingPhase from './phases/CommittingPhase';
import PaymentPhase from './phases/PaymentPhase';
import PwaPhase from './phases/PwaPhase';

/**
 * Top-level phase router for the rebuilt onboarding flow.
 * UI paints immediately (welcome); status/draft hydrate in the background.
 */
export default function OnboardingFlow({
  user,
  companyConfig,
  companyName,
  skipPayment = false,
  forceFresh = false,
  onComplete,
}) {
  const phase = useOnboardingStore((s) => s.phase);
  const hydrateFromStatus = useOnboardingStore((s) => s.hydrateFromStatus);
  const setCompany = useOnboardingStore((s) => s.setCompany);
  const setSkipPayment = useOnboardingStore((s) => s.setSkipPayment);
  const reset = useOnboardingStore((s) => s.reset);
  const forcePhase = useOnboardingStore((s) => s.forcePhase);
  const setAnswers = useOnboardingStore((s) => s.setAnswers);
  const setStepIndex = useOnboardingStore((s) => s.setStepIndex);
  const setUserCode = useOnboardingStore((s) => s.setUserCode);
  const setUnits = useOnboardingStore((s) => s.setUnits);

  useOnboardingDraftSync(user?.id, Boolean(user?.id) && !forceFresh && phase === PHASES.QUESTIONS);

  useEffect(() => {
    setCompany({
      companyConfig,
      companyName,
      includeNursingStatus: companyConfig?.onboarding?.includeNursingStatusQuestion !== false,
    });
    // UX hint only — server resolves skip from Auth/DB, never from this flag
    setSkipPayment(skipPayment || Boolean(user?.user_metadata?.skip_pricing));
  }, [companyConfig, companyName, skipPayment, user, setCompany, setSkipPayment]);

  useEffect(() => {
    let cancelled = false;

    if (forceFresh && user?.id) {
      try {
        localStorage.removeItem(`onboarding_${user.id}`);
      } catch (_) { /* ignore */ }
      reset({ hydrated: true, phase: PHASES.WELCOME });
      return undefined;
    }

    reset({ hydrated: true, phase: PHASES.WELCOME });

    let local = null;
    if (user?.id) {
      local = readLocalDraft(user.id);
      if (local?.answers) {
        setAnswers(local.answers);
        if (typeof local.stepIndex === 'number') setStepIndex(local.stepIndex);
        if (local.weightUnit || local.heightUnit) {
          setUnits({ weightUnit: local.weightUnit, heightUnit: local.heightUnit });
        }
      }
    }

    if (!user?.id) return undefined;

    (async () => {
      try {
        const status = await getOnboardingStatus();
        if (cancelled) return;
        if (status.completed) {
          hydrateFromStatus(status);
          forcePhase(PHASES.DONE);
          onComplete?.(true);
          return;
        }
        if (status.userCode) setUserCode(status.userCode);

        if (status.subscriptionStatus === 'pending_payment' || status.phase === PHASES.PAYMENT) {
          hydrateFromStatus(status);
          forcePhase(PHASES.PAYMENT);
          return;
        }
        if (status.subscriptionStatus === 'active' && !status.completed) {
          hydrateFromStatus(status);
          forcePhase(PHASES.PWA);
          return;
        }

        const serverDraft = status.draft;
        const serverMs = draftSavedAtMs(serverDraft);
        const localMs = draftSavedAtMs(local);
        const preferServer = !local || serverMs >= localMs;

        if (preferServer && serverDraft) {
          const draftAnswers = serverDraft.answers || serverDraft.formData;
          if (draftAnswers && typeof draftAnswers === 'object') {
            setAnswers(draftAnswers);
          }
          if (typeof serverDraft.stepIndex === 'number') setStepIndex(serverDraft.stepIndex);
          if (serverDraft.weightUnit || serverDraft.heightUnit) {
            setUnits({ weightUnit: serverDraft.weightUnit, heightUnit: serverDraft.heightUnit });
          }
        }

        const hasDraft =
          (serverDraft && ((serverDraft.answers && Object.keys(serverDraft.answers).length) || typeof serverDraft.stepIndex === 'number')) ||
          (local && ((local.answers && Object.keys(local.answers).length) || typeof local.stepIndex === 'number'));

        if (status.phase === PHASES.QUESTIONS || hasDraft) {
          forcePhase(PHASES.QUESTIONS);
        }
      } catch (e) {
        console.warn('[OnboardingFlow] background status load failed', e);
        if (local && (local.answers || typeof local.stepIndex === 'number')) {
          forcePhase(PHASES.QUESTIONS);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, forceFresh]); // eslint-disable-line react-hooks/exhaustive-deps

  switch (phase) {
    case PHASES.WELCOME:
      return <WelcomeStep />;
    case PHASES.QUESTIONS:
      return <QuestionsPhase userId={user?.id} />;
    case PHASES.COMMITTING:
      return <CommittingPhase />;
    case PHASES.PAYMENT:
      return <PaymentPhase />;
    case PHASES.PWA:
      return <PwaPhase onComplete={onComplete} />;
    case PHASES.DONE:
      return null;
    default:
      return <WelcomeStep />;
  }
}
