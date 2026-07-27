import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOnboardingStore, PHASES } from '../onboarding.store';
import { buildSteps, extractCustomSteps, normalizeGoalValue } from '../steps/stepDefs';
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

function customStepKey(step) {
  const custom = step?.custom || {};
  return custom.id || step?.fields?.[0]?.replace(/^custom_/, '') || step?.id?.replace(/^custom_/, '');
}

function isCustomStepAnswered(step, customAnswers = {}) {
  const key = customStepKey(step);
  const type = step?.custom?.type || 'text';
  const val = customAnswers?.[key];
  if (type === 'multiselect') return Array.isArray(val) && val.length > 0;
  if (type === 'select') return Boolean(val && String(val).trim());
  return Boolean(val && String(val).trim());
}

export default function QuestionsPhase({ userId, onCommitted }) {
  const stepIndex = useOnboardingStore((s) => s.stepIndex);
  const answers = useOnboardingStore((s) => s.answers);
  const companyConfig = useOnboardingStore((s) => s.companyConfig);
  const draftSyncError = useOnboardingStore((s) => s.draftSyncError);
  const nextStep = useOnboardingStore((s) => s.nextStep);
  const prevStep = useOnboardingStore((s) => s.prevStep);
  const forcePhase = useOnboardingStore((s) => s.forcePhase);
  const setUserCode = useOnboardingStore((s) => s.setUserCode);
  const setStepIndex = useOnboardingStore((s) => s.setStepIndex);
  const setError = useOnboardingStore((s) => s.setError);
  const setLoading = useOnboardingStore((s) => s.setLoading);
  const loading = useOnboardingStore((s) => s.loading);
  const error = useOnboardingStore((s) => s.error);
  const isHe = isOnboardingHebrew(answers.language);

  const [localError, setLocalError] = useState(null);
  const committingRef = useRef(false);

  const customSteps = useMemo(() => extractCustomSteps(companyConfig), [companyConfig]);

  const steps = useMemo(
    () => buildSteps({ customSteps }),
    [customSteps]
  );

  useEffect(() => {
    const customStepIds = steps.filter((s) => s.isCustom).map((s) => s.id);
    // #region agent log
    fetch('http://127.0.0.1:7453/ingest/cfcdcc1a-63b4-43aa-b1e8-30e257becdab',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6a05fb'},body:JSON.stringify({sessionId:'6a05fb',location:'QuestionsPhase.jsx:steps',message:'questions steps built',data:{hasCompanyConfig:Boolean(companyConfig),customStepsCount:customSteps.length,totalSteps:steps.length,stepIndex,currentStepId:steps[stepIndex]?.id||null,customStepIds,companyId:useOnboardingStore.getState().companyId||null,runId:'post-fix-2'},hypothesisId:'E',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [companyConfig, customSteps, steps, stepIndex]);

  useEffect(() => {
    if (!customSteps.length) return;
    const firstCustomIdx = steps.findIndex((s) => s.isCustom);
    if (firstCustomIdx < 0) return;

    const lastCustomIdx = steps.reduce((acc, step, idx) => (step.isCustom ? idx : acc), -1);
    const unansweredIdx = steps.findIndex(
      (step) => step.isCustom && !isCustomStepAnswered(step, answers.custom_answers)
    );
    if (unansweredIdx < 0) return;

    if (stepIndex > lastCustomIdx || (stepIndex >= firstCustomIdx && stepIndex < unansweredIdx)) {
      setStepIndex(unansweredIdx);
    }
  }, [customSteps, steps, answers.custom_answers, stepIndex, setStepIndex]);

  const step = steps[stepIndex] || steps[0];
  const title = isHe ? (step?.titleHe || step?.titleEn) : step?.titleEn;
  const isLast = stepIndex >= steps.length - 1;

  const handleNext = async () => {
    if (committingRef.current || loading) return;

    setLocalError(null);
    setError(null);
    const validationError = validateStep(step, answers, { isHe });
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
      const result = await commitOnboarding({
        answers: { ...answers, goal: normalizeGoalValue(answers.goal) },
        signal: controller.signal,
      });
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
