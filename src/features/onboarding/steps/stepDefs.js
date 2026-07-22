/**
 * Shared calorie/macro helpers for onboarding steps.
 */

export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  let y; let m; let d;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateOfBirth)) {
    [y, m, d] = dateOfBirth.split('-').map(Number);
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(dateOfBirth)) {
    const p = dateOfBirth.split('-').map(Number);
    d = p[0]; m = p[1]; y = p[2];
  } else return null;
  const birth = new Date(y, m - 1, d);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const md = today.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function calculateBMR(age, gender, weightKg, heightCm) {
  if (!age || !gender || !weightKg || !heightCm) return null;
  const w = Number(weightKg);
  const h = Number(heightCm);
  if (gender === 'male') return 88.362 + 13.397 * w + 4.799 * h - 5.677 * age;
  if (gender === 'female') return 447.593 + 9.247 * w + 3.098 * h - 4.330 * age;
  return 88.362 + 13.397 * w + 4.799 * h - 5.677 * age;
}

const ACTIVITY_MULT = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

export function calculateDailyCalories(age, gender, weightKg, heightCm, activityLevel, goal, nursingStatus) {
  const bmr = calculateBMR(age, gender, weightKg, heightCm);
  if (!bmr) return null;
  let tdee = bmr * (ACTIVITY_MULT[activityLevel] || 1.2);
  if (gender === 'female') {
    if (nursingStatus === 'exclusive') tdee += 500;
    else if (nursingStatus === 'partial') tdee += 300;
  }
  if (goal === 'lose' || goal === 'cut') tdee -= 500;
  else if (goal === 'gain' || goal === 'muscle') tdee += 300;
  return Math.round(Math.max(1200, tdee));
}

export function defaultMacros(calories, goal) {
  if (!calories) return { protein: null, carbs: null, fat: null };
  let pPct = 0.3;
  let cPct = 0.4;
  let fPct = 0.3;
  if (goal === 'muscle' || goal === 'cut') {
    pPct = 0.35;
    cPct = 0.35;
    fPct = 0.3;
  }
  return {
    protein: Math.round((calories * pPct) / 4),
    carbs: Math.round((calories * cPct) / 4),
    fat: Math.round((calories * fPct) / 9),
  };
}

export const STEP_DEFS = [
  { id: 'language', titleEn: 'Preferred Language', titleHe: 'שפת העדפה', fields: ['language'] },
  { id: 'name', titleEn: 'First & Last Name', titleHe: 'שם פרטי ומשפחה', fields: ['first_name', 'last_name'] },
  { id: 'phone', titleEn: 'Phone Number', titleHe: 'מספר טלפון', fields: ['phone'] },
  { id: 'city', titleEn: 'Location', titleHe: 'מיקום', fields: ['country_code', 'city', 'timezone', 'region'] },
  { id: 'dob', titleEn: 'Date of Birth', titleHe: 'תאריך לידה', fields: ['date_of_birth'] },
  { id: 'gender', titleEn: 'Gender', titleHe: 'מין', fields: ['gender', 'nursing_status'] },
  { id: 'biometrics', titleEn: 'Height & Weight', titleHe: 'גובה ומשקל', fields: ['height_cm', 'weight_kg', 'target_weight'] },
  { id: 'activity', titleEn: 'Activity', titleHe: 'פעילות', fields: ['activity_description', 'activity_level'] },
  { id: 'goal', titleEn: 'Goal', titleHe: 'מטרה', fields: ['goal'] },
  { id: 'dietary', titleEn: 'Allergies & Limitations', titleHe: 'אלרגיות והגבלות', fields: ['food_allergies', 'food_limitations'] },
  { id: 'preferences', titleEn: 'Food likes & dislikes', titleHe: 'מה אתה אוהב/לא אוהב לאכול?', fields: ['client_preference'] },
  { id: 'eating_window', titleEn: 'Daily Eating Window', titleHe: 'חלון האכילה היומי', fields: ['first_meal_time', 'last_meal_time'] },
  { id: 'calories', titleEn: 'Daily Calories & Macros', titleHe: 'קלוריות ומקרו יומיים', fields: ['daily_calories', 'macros'] },
  { id: 'meals', titleEn: 'Meal Planning', titleHe: 'תכנון ארוחות', fields: ['number_of_meals', 'meal_descriptions'] },
  { id: 'medical', titleEn: 'Medical Conditions', titleHe: 'מצבים רפואיים', fields: ['medical_conditions'] },
];

export function buildSteps({ includeNursingStatus = true, customSteps = [] } = {}) {
  const core = STEP_DEFS.map((s) => {
    if (s.id === 'gender' && !includeNursingStatus) {
      return {
        ...s,
        fields: ['gender'],
      };
    }
    return s;
  });

  const customs = (customSteps || []).map((cs, i) => ({
    id: `custom_${cs.id || i}`,
    titleEn: cs.titleEn || cs.question || cs.title || cs.label || `Custom ${i + 1}`,
    titleHe: cs.titleHe || cs.question || cs.title || cs.label || `מותאם ${i + 1}`,
    fields: [`custom_${cs.id || i}`],
    isCustom: true,
    custom: cs,
  }));

  // Insert custom steps before calories
  const insertAt = core.findIndex((s) => s.id === 'calories');
  if (customs.length && insertAt >= 0) {
    return [...core.slice(0, insertAt), ...customs, ...core.slice(insertAt)];
  }
  return [...core, ...customs];
}
