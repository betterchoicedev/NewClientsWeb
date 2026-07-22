import React, { useMemo, useRef, useState } from 'react';
import { useOnboardingStore, PHASES } from '../onboarding.store';
import { buildSteps } from '../steps/stepDefs';
import StepFields, { validateStep } from '../steps/StepFields';
import StepShell from '../components/StepShell';
import { commitOnboarding, checkOnboardingPhone, saveOnboardingStep } from '../api/onboardingApi';
import { clearLocalDraft } from '../hooks/useOnboardingDraftSync';
import { isOnboardingHebrew } from '../onboardingLocale';
import { normalizeOnboardingPhone } from '../phoneUtils';

const COMMIT_TIMEOUT_MS = 30000;

function commitErrorMessage(err, isHe) {
  const status = err?.status;
  if (status === 401) return isHe ? 'יש להתחבר מחדש' : 'Please sign in again';
  if (status === 408 || err?.name === 'AbortError' || /abort|timeout/i.test(err?.message || '')) {
    return isHe ? 'השמירה ארכה יותר מדי — נסו שוב' : 'Save timed out — please retry';
  }
  if (status === 404) {
    return isHe
      ? 'לא ניתן לשמור — ודאו שהשרת המקומי פועל (פורט 8080) או שפריסת ה־API בפרודקשן מעודכנת.'
      : 'Could not save — ensure the local API is running on port 8080, or deploy the latest API to production.';
  }
  if (status >= 500) return isHe ? 'שגיאת שרת — נסו שוב' : 'Server error — please retry';
  return err?.message || (isHe ? 'שגיאה בשמירה' : 'Failed to save');
}

export default function QuestionsPhase({ userId, onCommitted }) {
  const stepIndex = useOnboardingStore((s) => s.stepIndex);
  const answers = useOnboardingStore((s) => s.answers);
  const includeNursingStatus = useOnboardingStore((s) => s.includeNursingStatus);
  const companyConfig = useOnboardingStore((s) => s.companyConfig);
  const draftSyncError = useOnboardingStore((s) => s.draftSyncError);
  const nextStep = useOnboardingStore((s) => s.nextStep);
  const prevStep = useOnboardingStore((s) => s.prevStep);
  const forcePhase = useOnboardingStore((s) => s.forcePhase);
  const setUserCode = useOnboardingStore((s) => s.setUserCode);
  const setError = useOnboardingStore((s) => s.setError);
  const setLoading = useOnboardingStore((s) => s.setLoading);
  const loading = useOnboardingStore((s) => s.loading);
  const error = useOnboardingStore((s) => s.error);
  const isHe = isOnboardingHebrew(answers.language);

  const [localError, setLocalError] = useState(null);
  const committingRef = useRef(false);

  const steps = useMemo(
    () =>
      buildSteps({
        includeNursingStatus,
        customSteps: companyConfig?.onboarding?.customSteps || [],
      }),
    [includeNursingStatus, companyConfig]
  );

  const step = steps[stepIndex] || steps[0];
  const title = isHe ? (step?.titleHe || step?.titleEn) : step?.titleEn;
  const isLast = stepIndex >= steps.length - 1;

  const handleNext = async () => {
    if (committingRef.current || loading) return;

    setLocalError(null);
    setError(null);
    const validationError = validateStep(step, answers, { includeNursingStatus, isHe });
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    if (step.id === 'phone') {
      setLoading(true);
      try {
        const normalizedPhone = normalizeOnboardingPhone(
          answers.phone,
          answers.phoneCountryCode || '+972'
        );
        const { exists } = await checkOnboardingPhone(normalizedPhone);
        if (exists) {
          setLocalError(
            isHe
              ? 'מספר הטלפון כבר קיים במערכת. אנא השתמש במספר אחר.'
              : 'This phone number is already registered. Please use a different number.'
          );
          return;
        }
      } catch (e) {
        setLocalError(
          isHe ? 'לא ניתן לאמת את מספר הטלפון — נסו שוב' : 'Could not verify phone number — please retry'
        );
        return;
      } finally {
        setLoading(false);
      }
    }

    if (!isLast) {
      const nextIndex = stepIndex + 1;
      const draft = useOnboardingStore.getState().getDraftPayload();
      saveOnboardingStep({
        stepId: step.id,
        answers,
        stepIndex: nextIndex,
        phase: PHASES.QUESTIONS,
        draft,
      }).catch((e) => {
        console.warn('Step progress persistence warning:', e);
      });
      nextStep(steps.length);
      return;
    }

    committingRef.current = true;
    forcePhase(PHASES.COMMITTING);
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), COMMIT_TIMEOUT_MS);

    try {
      const result = await commitOnboarding({ answers, signal: controller.signal });
      if (!result?.userCode) throw new Error(isHe ? 'שמירה נכשלה — נסו שוב' : 'Save failed — please try again');
      setUserCode(result.userCode);
      clearLocalDraft(userId);
      if (result.phase === 'pwa' || result.completed) {
        forcePhase(PHASES.PWA);
      } else {
        forcePhase(PHASES.PRODUCTS);
      }
      onCommitted?.(result);
    } catch (e) {
      forcePhase(PHASES.QUESTIONS);
      setError(commitErrorMessage(e, isHe));
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      committingRef.current = false;
    }
  };

  return (
    <StepShell
      title={title}
      stepIndex={stepIndex}
      totalSteps={steps.length}
      onBack={prevStep}
      onNext={handleNext}
      nextLabel={isLast ? (isHe ? 'סיום' : 'Finish') : undefined}
      loading={loading}
      error={localError || error}
    >
      {draftSyncError ? (
        <p className="mb-3 text-xs font-medium text-amber-700 dark:text-amber-400">
          {isHe ? 'הטיוטה לא נשמרה בענן' : 'Draft not saved to cloud'}
        </p>
      ) : null}
      <StepFields step={step} />
    </StepShell>
  );
}
