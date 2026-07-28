import { useCallback, useEffect, useRef } from 'react';
import { useOnboardingStore } from '../onboarding.store';
import { saveDraft } from '../api/onboardingApi';
import { PHASES } from '../onboarding.machine';

const LOCAL_KEY = (userId) => `onboarding_${userId}`;
const SESSION_DRAFT_KEY = (userId) => `onboarding_draft_full_${userId}`;
const DEBOUNCE_MS = 500;

/** Stable callback ref for effects without exhaustive-deps churn. */
function useCallbackRef(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args) => ref.current(...args), []);
}

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
    commerce: draft?.commerce || null,
    phase: draft?.phase || null,
  };
}

function writeSessionDraft(userId, draft) {
  if (!userId) return;
  try {
    sessionStorage.setItem(SESSION_DRAFT_KEY(userId), JSON.stringify(draft));
  } catch (_) {
    /* ignore quota */
  }
}

/**
 * Debounced sync: localStorage (safe subset) + sessionStorage (full) + server draft.
 */
export function useOnboardingDraftSync(userId, enabled = true) {
  const timerRef = useRef(null);
  const answers = useOnboardingStore((s) => s.answers);
  const stepIndex = useOnboardingStore((s) => s.stepIndex);
  const phase = useOnboardingStore((s) => s.phase);
  const weightUnit = useOnboardingStore((s) => s.weightUnit);
  const heightUnit = useOnboardingStore((s) => s.heightUnit);
  const selectedProductIds = useOnboardingStore((s) => s.selectedProductIds);
  const appliedPromo = useOnboardingStore((s) => s.appliedPromo);
  const hydrated = useOnboardingStore((s) => s.hydrated);
  const getDraftPayload = useOnboardingStore((s) => s.getDraftPayload);
  const setDraftSyncing = useOnboardingStore((s) => s.setDraftSyncing);
  const setDraftSyncError = useOnboardingStore((s) => s.setDraftSyncError);
  const setUserCode = useOnboardingStore((s) => s.setUserCode);

  const syncPhases = new Set([
    PHASES.WELCOME,
    PHASES.PRODUCTS,
    PHASES.PROMO,
    PHASES.PAYMENT,
    PHASES.QUESTIONS,
  ]);

  const persistDraft = useCallbackRef(async () => {
    if (!userId) return;
    const draft = { ...getDraftPayload(), phase, savedAt: new Date().toISOString() };
    try {
      localStorage.setItem(LOCAL_KEY(userId), JSON.stringify(toLocalSafeDraft(draft)));
    } catch (_) {
      /* ignore quota */
    }
    writeSessionDraft(userId, draft);
    try {
      setDraftSyncing(true);
      const res = await saveDraft({ draft, phase, stepIndex });
      if (res?.userCode) setUserCode(res.userCode);
      setDraftSyncError(null);
    } catch (e) {
      console.warn('[onboarding] draft sync failed:', e.message);
      setDraftSyncError(e.message || 'Draft not saved');
    } finally {
      setDraftSyncing(false);
    }
  });

  useEffect(() => {
    if (!enabled || !userId || !hydrated) return undefined;
    if (!syncPhases.has(phase)) return undefined;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      persistDraft();
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
    selectedProductIds,
    appliedPromo,
    persistDraft,
  ]);

  useEffect(() => {
    if (!enabled || !userId || !hydrated) return undefined;
    const flush = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      persistDraft();
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [enabled, userId, hydrated, persistDraft]);
}

export function readLocalDraft(userId) {
  try {
    const raw = localStorage.getItem(LOCAL_KEY(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function readSessionDraft(userId) {
  try {
    const raw = sessionStorage.getItem(SESSION_DRAFT_KEY(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLocalDraft(userId) {
  try {
    localStorage.removeItem(LOCAL_KEY(userId));
    sessionStorage.removeItem(SESSION_DRAFT_KEY(userId));
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
