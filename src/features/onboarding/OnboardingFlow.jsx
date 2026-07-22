import React, { useCallback, useEffect, useState } from 'react';
import { useOnboardingStore, PHASES } from './onboarding.store';
import { OnboardingDismissProvider } from './onboardingDismissContext';
import {
  useOnboardingDraftSync,
  readLocalDraft,
  readSessionDraft,
  draftSavedAtMs,
} from './hooks/useOnboardingDraftSync';
import { getOnboardingStatus } from './api/onboardingApi';
import { phaseFromStatus } from './onboarding.machine';
import WelcomeStep from './steps/WelcomeStep';
import ProductSelectionPhase from './phases/ProductSelectionPhase';
import PromoCodePhase from './phases/PromoCodePhase';
import QuestionsPhase from './phases/QuestionsPhase';
import CommittingPhase from './phases/CommittingPhase';
import PaymentPhase from './phases/PaymentPhase';
import PwaPhase from './phases/PwaPhase';

function applyDraftToStore({
  draft,
  setAnswers,
  setStepIndex,
  setUnits,
  hydrateCommerce,
  resumeStepHint = 0,
}) {
  if (!draft || typeof draft !== 'object') return;
  const draftAnswers = draft.answers || draft.formData;
  if (draftAnswers && typeof draftAnswers === 'object') {
    setAnswers(draftAnswers);
  }
  const step =
    typeof draft.stepIndex === 'number'
      ? Math.max(draft.stepIndex, resumeStepHint)
      : resumeStepHint;
  if (step > 0) setStepIndex(step);
  if (draft.weightUnit || draft.heightUnit) {
    setUnits({ weightUnit: draft.weightUnit, heightUnit: draft.heightUnit });
  }
  if (draft.commerce) hydrateCommerce(draft.commerce);
}

function OnboardingBootstrap({ isHe }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <div className="w-10 h-10 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-200">
          {isHe ? 'טוען את ההתקדמות שלך...' : 'Restoring your progress...'}
        </p>
      </div>
    </div>
  );
}

/**
 * Onboarding router: Welcome → Questions → Commerce → Payment → PWA
 */
export default function OnboardingFlow({
  user,
  companyConfig,
  companyName,
  companyId = null,
  skipPayment = false,
  forceFresh = false,
  allowDismiss = true,
  onComplete,
}) {
  const phase = useOnboardingStore((s) => s.phase);
  const hydrated = useOnboardingStore((s) => s.hydrated);
  const answers = useOnboardingStore((s) => s.answers);
  const hydrateFromStatus = useOnboardingStore((s) => s.hydrateFromStatus);
  const setCompany = useOnboardingStore((s) => s.setCompany);
  const setSkipPayment = useOnboardingStore((s) => s.setSkipPayment);
  const reset = useOnboardingStore((s) => s.reset);
  const forcePhase = useOnboardingStore((s) => s.forcePhase);
  const setAnswers = useOnboardingStore((s) => s.setAnswers);
  const setStepIndex = useOnboardingStore((s) => s.setStepIndex);
  const setUserCode = useOnboardingStore((s) => s.setUserCode);
  const setUnits = useOnboardingStore((s) => s.setUnits);
  const hydrateCommerce = useOnboardingStore((s) => s.hydrateCommerce);
  const setError = useOnboardingStore((s) => s.setError);

  const [bootstrapError, setBootstrapError] = useState(null);
  const isHe = answers.language === 'he';

  useOnboardingDraftSync(user?.id, Boolean(user?.id) && !forceFresh && hydrated);

  useEffect(() => {
    setCompany({
      companyConfig,
      companyName,
      companyId,
      includeNursingStatus: companyConfig?.onboarding?.includeNursingStatusQuestion !== false,
    });
    setSkipPayment(skipPayment || Boolean(user?.user_metadata?.skip_pricing));
  }, [companyConfig, companyName, companyId, skipPayment, user, setCompany, setSkipPayment]);

  useEffect(() => {
    let cancelled = false;

    if (forceFresh && user?.id) {
      try {
        localStorage.removeItem(`onboarding_${user.id}`);
        sessionStorage.removeItem(`onboarding_draft_full_${user.id}`);
        sessionStorage.removeItem(`onboarding_commerce_${user.id}`);
      } catch (_) { /* ignore */ }
      reset({ hydrated: true, phase: PHASES.WELCOME });
      setBootstrapError(null);
      return undefined;
    }

    reset({ hydrated: false, phase: PHASES.WELCOME });
    setBootstrapError(null);

    if (!user?.id) {
      reset({ hydrated: true });
      return undefined;
    }

    const local = readLocalDraft(user.id);
    const session = readSessionDraft(user.id);

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

        const serverDraft = status.draft;
        const serverMs = draftSavedAtMs(serverDraft);
        const sessionMs = draftSavedAtMs(session);
        const localMs = draftSavedAtMs(local);

        let chosenDraft = serverDraft;
        if (sessionMs > serverMs && session) chosenDraft = session;
        else if (localMs > serverMs && local && !serverDraft) chosenDraft = local;

        if (chosenDraft) {
          applyDraftToStore({
            draft: chosenDraft,
            setAnswers,
            setStepIndex,
            setUnits,
            hydrateCommerce,
            resumeStepHint: status.resumeStepHint,
          });
        } else if (local) {
          applyDraftToStore({
            draft: local,
            setAnswers,
            setStepIndex,
            setUnits,
            hydrateCommerce,
            resumeStepHint: status.resumeStepHint,
          });
        }

        const resolvedPhase = phaseFromStatus(status);
        hydrateFromStatus(status);
        forcePhase(resolvedPhase);
        setBootstrapError(null);
      } catch (e) {
        console.warn('[OnboardingFlow] status load failed', e);
        if (cancelled) return;

        const fallback = session || local;
        if (fallback) {
          applyDraftToStore({
            draft: fallback,
            setAnswers,
            setStepIndex,
            setUnits,
            hydrateCommerce,
          });
          if (fallback.commerce?.selectedProductIds?.length) {
            forcePhase(PHASES.PROMO);
          } else if (fallback.answers || typeof fallback.stepIndex === 'number') {
            forcePhase(PHASES.QUESTIONS);
          }
        }

        setBootstrapError(
          e.message || 'Could not restore progress. Check your connection and try again.'
        );
        setError(e.message || 'Could not restore progress');
        reset({ hydrated: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, forceFresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = useCallback(() => {
    if (!allowDismiss) return;
    onComplete?.(false);
  }, [allowDismiss, onComplete]);

  if (!hydrated) {
    return <OnboardingBootstrap isHe={isHe} />;
  }

  let content;
  switch (phase) {
    case PHASES.WELCOME:
      content = <WelcomeStep />;
      break;
    case PHASES.QUESTIONS:
      content = <QuestionsPhase userId={user?.id} />;
      break;
    case PHASES.COMMITTING:
      content = <CommittingPhase />;
      break;
    case PHASES.PRODUCTS:
      content = <ProductSelectionPhase />;
      break;
    case PHASES.PROMO:
      content = <PromoCodePhase />;
      break;
    case PHASES.PAYMENT:
      content = <PaymentPhase onComplete={onComplete} />;
      break;
    case PHASES.PWA:
      content = <PwaPhase onComplete={onComplete} />;
      break;
    case PHASES.DONE:
      content = null;
      break;
    default:
      content = <WelcomeStep />;
  }

  return (
    <OnboardingDismissProvider onDismiss={allowDismiss ? handleDismiss : null}>
      {bootstrapError ? (
        <div
          className="fixed top-4 left-1/2 z-[110] -translate-x-1/2 max-w-md w-[calc(100%-2rem)] rounded-2xl border border-amber-400/30 bg-amber-950/90 px-4 py-3 text-sm text-amber-100 shadow-lg"
          role="alert"
        >
          {bootstrapError}
        </div>
      ) : null}
      {content}
    </OnboardingDismissProvider>
  );
}
