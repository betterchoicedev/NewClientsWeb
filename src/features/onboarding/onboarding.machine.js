/** Pure phase / step transition helpers for onboarding. */

export const PHASES = {
  WELCOME: 'welcome',
  QUESTIONS: 'questions',
  COMMITTING: 'committing',
  PRODUCTS: 'products',
  PROMO: 'promo',
  PAYMENT: 'payment',
  PWA: 'pwa',
  DONE: 'done',
};

export const PHASE_ORDER = [
  PHASES.WELCOME,
  PHASES.QUESTIONS,
  PHASES.COMMITTING,
  PHASES.PRODUCTS,
  PHASES.PROMO,
  PHASES.PAYMENT,
  PHASES.PWA,
  PHASES.DONE,
];

export function canTransition(from, to) {
  if (!PHASE_ORDER.includes(to)) return false;
  if (from === to) return true;
  if (to === PHASES.WELCOME) return true;
  if (from === PHASES.WELCOME && to === PHASES.QUESTIONS) return true;
  if (from === PHASES.QUESTIONS && (to === PHASES.COMMITTING || to === PHASES.WELCOME)) return true;
  if (from === PHASES.COMMITTING && (to === PHASES.PRODUCTS || to === PHASES.PWA || to === PHASES.QUESTIONS)) return true;
  if (from === PHASES.PRODUCTS && (to === PHASES.PROMO || to === PHASES.COMMITTING)) return true;
  if (from === PHASES.PROMO && (to === PHASES.PAYMENT || to === PHASES.PWA || to === PHASES.PRODUCTS)) return true;
  if (from === PHASES.PAYMENT && (to === PHASES.PWA || to === PHASES.PROMO)) return true;
  if (from === PHASES.PWA && to === PHASES.DONE) return true;
  const fi = PHASE_ORDER.indexOf(from);
  const ti = PHASE_ORDER.indexOf(to);
  return ti === fi + 1 || ti === fi;
}

function resolveCommercePhase(commerce, { preferPayment = false } = {}) {
  if (!commerce) return PHASES.PRODUCTS;
  if (preferPayment && commerce.appliedPromo?.valid && commerce.appliedPromo?.type !== 'bypass') {
    return PHASES.PAYMENT;
  }
  if (commerce.appliedPromo?.valid) return PHASES.PROMO;
  if (Array.isArray(commerce.selectedProductIds) && commerce.selectedProductIds.length > 0) {
    return PHASES.PROMO;
  }
  return PHASES.PRODUCTS;
}

export function phaseFromStatus(status) {
  if (!status) return PHASES.WELCOME;
  if (status.completed) return PHASES.DONE;

  const draft = status.draft;
  const commerce = draft?.commerce;
  const subscriptionStatus = status.subscriptionStatus;

  if (subscriptionStatus === 'active') {
    return PHASES.DONE;
  }

  if (subscriptionStatus === 'pending_payment') {
    if (status.phase === PHASES.PAYMENT) return PHASES.PAYMENT;
    return resolveCommercePhase(commerce, { preferPayment: Boolean(commerce?.appliedPromo?.valid) });
  }

  if (status.phase === PHASES.PWA) return PHASES.PWA;
  if (status.phase === PHASES.PAYMENT) return PHASES.PAYMENT;
  if (status.phase === PHASES.PROMO) return PHASES.PROMO;
  if (status.phase === PHASES.PRODUCTS) return PHASES.PRODUCTS;
  if (status.phase === PHASES.QUESTIONS || status.phase === PHASES.COMMITTING) return PHASES.QUESTIONS;

  const hasDraftAnswers =
    draft &&
    typeof draft === 'object' &&
    ((draft.answers && Object.keys(draft.answers).length > 0) ||
      (draft.formData && Object.keys(draft.formData).length > 0) ||
      typeof draft.stepIndex === 'number');

  if (hasDraftAnswers) return PHASES.QUESTIONS;
  return PHASES.QUESTIONS;
}

export function nextStepIndex(current, total) {
  if (total <= 0) return 0;
  return Math.min(current + 1, total - 1);
}

export function prevStepIndex(current) {
  return Math.max(current - 1, 0);
}

/** True when user must stay in onboarding/payment flow. */
export function requiresOnboardingWall(status, { skipPayment = false } = {}) {
  if (!status) return false;
  if (status.completed === true) return false;
  if (status.subscriptionStatus === 'active') return false;
  if (skipPayment && status.subscriptionStatus === 'active') return false;
  return true;
}

/** Close (X) only when onboarding wall is not required. */
export function canDismissOnboarding(status, { skipPayment = false } = {}) {
  return !requiresOnboardingWall(status, { skipPayment });
}
