import { create } from 'zustand';
import {
  PHASES as P,
  canTransition as canTx,
  phaseFromStatus as phaseFrom,
  nextStepIndex as nextIdx,
  prevStepIndex as prevIdx,
} from './onboarding.machine';

export const emptyAnswers = () => ({
  language: '',
  first_name: '',
  last_name: '',
  phone: '',
  phoneCountryCode: '+972',
  region: '',
  country_code: '',
  city: '',
  timezone: '',
  date_of_birth: '',
  gender: '',
  nursing_status: '',
  height_cm: '',
  weight_kg: '',
  target_weight: '',
  medical_conditions: '',
  activity_description: '',
  goal: '',
  food_allergies: [],
  food_limitations: [],
  allergies_other: '',
  limitations_other: '',
  region_other: '',
  gender_other: '',
  client_preference: '',
  first_meal_time: '08:00',
  last_meal_time: '20:00',
  activity_level: '',
  daily_calories: null,
  macros: { protein: null, carbs: null, fat: null },
  number_of_meals: '',
  meal_descriptions: [],
  meal_names: [],
  custom_answers: {},
});

const initialState = {
  phase: P.WELCOME,
  stepIndex: 0,
  answers: emptyAnswers(),
  userCode: null,
  error: null,
  fieldErrors: {},
  loading: false,
  hydrated: false,
  draftSyncing: false,
  draftSyncError: null,
  companyConfig: null,
  companyName: null,
  includeNursingStatus: true,
  weightUnit: 'kg',
  heightUnit: 'cm',
  skipPayment: false,
};

export const useOnboardingStore = create((set, get) => ({
  ...initialState,

  reset: (overrides = {}) => set({ ...initialState, answers: emptyAnswers(), ...overrides }),

  setPhase: (phase) => {
    const from = get().phase;
    if (!canTx(from, phase)) {
      console.warn(`[onboarding] blocked transition ${from} -> ${phase}`);
      return;
    }
    set({ phase, error: null });
  },

  forcePhase: (phase) => set({ phase, error: null }),

  setStepIndex: (stepIndex) => set({ stepIndex: Math.max(0, stepIndex) }),

  nextStep: (totalSteps) => set({ stepIndex: nextIdx(get().stepIndex, totalSteps) }),

  prevStep: () => {
    const { stepIndex, phase } = get();
    if (stepIndex <= 0 && phase === P.QUESTIONS) {
      set({ phase: P.WELCOME });
      return;
    }
    set({ stepIndex: prevIdx(stepIndex) });
  },

  setAnswer: (key, value) =>
    set((s) => ({
      answers: { ...s.answers, [key]: value },
      fieldErrors: { ...s.fieldErrors, [key]: undefined },
    })),

  setAnswers: (partial) =>
    set((s) => ({
      answers: { ...s.answers, ...partial },
    })),

  setFieldErrors: (fieldErrors) => set({ fieldErrors }),

  setError: (error) => set({ error }),

  setLoading: (loading) => set({ loading }),

  setDraftSyncing: (draftSyncing) => set({ draftSyncing }),

  setDraftSyncError: (draftSyncError) => set({ draftSyncError: draftSyncError || null }),

  setUserCode: (userCode) => set({ userCode }),

  setCompany: ({ companyConfig, companyName, includeNursingStatus }) =>
    set({
      companyConfig: companyConfig ?? null,
      companyName: companyName ?? null,
      includeNursingStatus: includeNursingStatus !== false,
    }),

  setUnits: ({ weightUnit, heightUnit }) =>
    set((s) => ({
      weightUnit: weightUnit || s.weightUnit,
      heightUnit: heightUnit || s.heightUnit,
    })),

  setSkipPayment: (skipPayment) => set({ skipPayment: Boolean(skipPayment) }),

  hydrateFromStatus: (status) => {
    const phase = phaseFrom(status);
    const draft = status?.draft || {};
    const draftAnswers = draft.answers || draft.formData || {};
    set({
      hydrated: true,
      phase: phase === P.DONE ? P.DONE : phase,
      userCode: status?.userCode || null,
      stepIndex: typeof draft.stepIndex === 'number' ? draft.stepIndex : 0,
      answers: { ...emptyAnswers(), ...draftAnswers },
      weightUnit: draft.weightUnit || 'kg',
      heightUnit: draft.heightUnit || 'cm',
      error: null,
    });
  },

  getDraftPayload: () => {
    const s = get();
    return {
      answers: s.answers,
      stepIndex: s.stepIndex,
      weightUnit: s.weightUnit,
      heightUnit: s.heightUnit,
      savedAt: new Date().toISOString(),
    };
  },
}));

export { P as PHASES };
