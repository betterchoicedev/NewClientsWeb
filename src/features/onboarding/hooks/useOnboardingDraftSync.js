import { useEffect, useRef } from 'react';
import { useOnboardingStore } from '../onboarding.store';
import { saveDraft } from '../api/onboardingApi';
import { PHASES } from '../onboarding.machine';

const LOCAL_KEY = (userId) => `onboarding_${userId}`;
const DEBOUNCE_MS = 500;

/** Fields safe to keep in localStorage (no PHI / medical / contact). */
const LOCAL_SAFE_ANSWER_KEYS = [
  'language',
  'first_name',
  'last_name',
  'country_code',
  'region',
  'city',
  'timezone',
  'goal',
  'number_of_meals',
  'first_meal_time',
  'last_meal_time',
];

function toLocalSafeDraft(draft) {
  const answers = draft?.answers || {};
  const safeAnswers = {};
  LOCAL_SAFE_ANSWER_KEYS.forEach((k) => {
    if (answers[k] !== undefined && answers[k] !== null && answers[k] !== '') {
      safeAnswers[k] = answers[k];
    }
  });
  return {
    stepIndex: typeof draft?.stepIndex === 'number' ? draft.stepIndex : 0,
    weightUnit: draft?.weightUnit || 'kg',
    heightUnit: draft?.heightUnit || 'cm',
    savedAt: draft?.savedAt || new Date().toISOString(),
    answers: safeAnswers,
  };
}

/**
 * Debounced sync: stripped localStorage + full POST /api/onboarding/draft while in questions phase.
 */
export function useOnboardingDraftSync(userId, enabled = true) {
  const timerRef = useRef(null);
  const answers = useOnboardingStore((s) => s.answers);
  const stepIndex = useOnboardingStore((s) => s.stepIndex);
  const phase = useOnboardingStore((s) => s.phase);
  const weightUnit = useOnboardingStore((s) => s.weightUnit);
  const heightUnit = useOnboardingStore((s) => s.heightUnit);
  const hydrated = useOnboardingStore((s) => s.hydrated);
  const getDraftPayload = useOnboardingStore((s) => s.getDraftPayload);
  const setDraftSyncing = useOnboardingStore((s) => s.setDraftSyncing);
  const setDraftSyncError = useOnboardingStore((s) => s.setDraftSyncError);
  const setUserCode = useOnboardingStore((s) => s.setUserCode);

  useEffect(() => {
    if (!enabled || !userId || !hydrated) return undefined;
    if (phase !== PHASES.QUESTIONS && phase !== PHASES.WELCOME) return undefined;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const draft = { ...getDraftPayload(), savedAt: new Date().toISOString() };
      try {
        localStorage.setItem(LOCAL_KEY(userId), JSON.stringify(toLocalSafeDraft(draft)));
      } catch (_) {
        /* ignore quota */
      }
      try {
        setDraftSyncing(true);
        const res = await saveDraft({
          draft,
          phase: phase === PHASES.WELCOME ? PHASES.WELCOME : PHASES.QUESTIONS,
          stepIndex,
        });
        if (res?.userCode) setUserCode(res.userCode);
        setDraftSyncError(null);
      } catch (e) {
        console.warn('[onboarding] draft sync failed:', e.message);
        setDraftSyncError(e.message || 'Draft not saved');
      } finally {
        setDraftSyncing(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    enabled,
    userId,
    hydrated,
    answers,
    stepIndex,
    phase,
    weightUnit,
    heightUnit,
    getDraftPayload,
    setDraftSyncing,
    setDraftSyncError,
    setUserCode,
  ]);
}

export function readLocalDraft(userId) {
  try {
    const raw = localStorage.getItem(LOCAL_KEY(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLocalDraft(userId) {
  try {
    localStorage.removeItem(LOCAL_KEY(userId));
  } catch (_) {
    /* ignore */
  }
}

export function draftSavedAtMs(draft) {
  if (!draft?.savedAt) return 0;
  const t = Date.parse(draft.savedAt);
  return Number.isFinite(t) ? t : 0;
}

export { toLocalSafeDraft };
