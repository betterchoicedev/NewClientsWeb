/** Pure phase / step transition helpers for onboarding. */

export const PHASES = {
  WELCOME: 'welcome',
  QUESTIONS: 'questions',
  COMMITTING: 'committing',
  PAYMENT: 'payment',
  PWA: 'pwa',
  DONE: 'done',
};

export const PHASE_ORDER = [
  PHASES.WELCOME,
  PHASES.QUESTIONS,
  PHASES.COMMITTING,
  PHASES.PAYMENT,
  PHASES.PWA,
  PHASES.DONE,
];

export function canTransition(from, to) {
  if (!PHASE_ORDER.includes(to)) return false;
  if (from === to) return true;
  // Allow jump to payment/pwa/done from commit; allow force-reset to welcome
  if (to === PHASES.WELCOME) return true;
  if (from === PHASES.COMMITTING && (to === PHASES.PAYMENT || to === PHASES.PWA || to === PHASES.DONE)) {
    return true;
  }
  if (from === PHASES.PAYMENT && (to === PHASES.PWA || to === PHASES.DONE || to === PHASES.QUESTIONS)) {
    return true;
  }
  if (from === PHASES.PWA && to === PHASES.DONE) return true;
  const fi = PHASE_ORDER.indexOf(from);
  const ti = PHASE_ORDER.indexOf(to);
  return ti === fi + 1 || ti === fi;
}

export function phaseFromStatus(status) {
  if (!status) return PHASES.WELCOME;
  if (status.completed) return PHASES.DONE;
  if (status.subscriptionStatus === 'pending_payment' || status.phase === PHASES.PAYMENT) {
    return PHASES.PAYMENT;
  }
  if (status.subscriptionStatus === 'active' && !status.completed) {
    return PHASES.PWA;
  }
  if (status.phase === PHASES.PWA) return PHASES.PWA;
  // Resume mid-questionnaire when a draft (or questions phase) is present
  const draft = status.draft;
  const hasDraftAnswers =
    draft &&
    typeof draft === 'object' &&
    ((draft.answers && Object.keys(draft.answers).length > 0) ||
      (draft.formData && Object.keys(draft.formData).length > 0) ||
      typeof draft.stepIndex === 'number');
  if (status.phase === PHASES.QUESTIONS || hasDraftAnswers) {
    return PHASES.QUESTIONS;
  }
  return PHASES.WELCOME;
}

export function nextStepIndex(current, total) {
  if (total <= 0) return 0;
  return Math.min(current + 1, total - 1);
}

export function prevStepIndex(current) {
  return Math.max(current - 1, 0);
}
