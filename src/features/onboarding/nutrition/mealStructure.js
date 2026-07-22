/**
 * Meal slot names, calorie split ratios, and meal_plan_structure builder.
 * Ported from legacy OnboardingModal.jsx — shared shape with server buildMealPlanStructure.
 */

export const MEAL_ORDER_EN = [
  'Breakfast', 'Morning Snack', 'Brunch', 'Lunch', 'Afternoon Snack',
  'Dinner', 'Evening Snack', 'Late Dinner', 'Post-Workout Meal', 'Midnight Snack',
];

const MEAL_NAMES_EN = ['Meal', ...MEAL_ORDER_EN];
const MEAL_NAMES_HE = [
  'ארוחה', 'ארוחת בוקר', 'חטיף בוקר', 'בראנץ\'', 'ארוחת צהריים', 'חטיף צהריים',
  'ארוחת ערב', 'חטיף ערב', 'ארוחת ערב מאוחרת', 'ארוחה לאחר אימון', 'חטיף לילה',
];

export const MEAL_SPLIT_RATIOS = {
  2: { breakfast: 0.45, dinner: 0.55 },
  3: { breakfast: 0.30, lunch: 0.35, dinner: 0.35 },
  4: { breakfast: 0.25, lunch: 0.30, snack_1: 0.15, dinner: 0.30 },
  5: { breakfast: 0.20, lunch: 0.25, snack_1: 0.15, snack_2: 0.10, dinner: 0.30 },
  6: { breakfast: 0.20, lunch: 0.20, snack_1: 0.10, snack_2: 0.10, dinner: 0.30, snack_3: 0.10 },
  7: { breakfast: 0.15, lunch: 0.20, snack_1: 0.10, snack_2: 0.10, dinner: 0.25, snack_3: 0.10, snack_4: 0.10 },
};

export function getAllMealNames(isHebrew = false) {
  if (isHebrew) return MEAL_NAMES_HE.slice(1);
  return [...MEAL_ORDER_EN];
}

export function convertMealNameToEnglish(mealName) {
  if (!mealName) return mealName;
  if (MEAL_NAMES_EN.includes(mealName)) return mealName;
  const hebrewIndex = MEAL_NAMES_HE.indexOf(mealName);
  if (hebrewIndex !== -1) return MEAL_NAMES_EN[hebrewIndex];
  return mealName;
}

export function getMealOrderIndex(mealName) {
  const en = convertMealNameToEnglish(mealName);
  const idx = MEAL_ORDER_EN.indexOf(en);
  return idx === -1 ? 0 : idx;
}

function getMealSlotSortIndex(mealName) {
  const en = convertMealNameToEnglish(mealName);
  const idx = MEAL_ORDER_EN.indexOf(en);
  return idx === -1 ? 999 : idx;
}

export function sortMealPlanStructure(structure) {
  if (!Array.isArray(structure)) return structure;
  return [...structure].sort(
    (a, b) => getMealSlotSortIndex(a?.mealSlot || a?.meal) - getMealSlotSortIndex(b?.mealSlot || b?.meal)
  );
}

export function sortMealPlanMeals(meals) {
  if (!Array.isArray(meals)) return meals;
  return [...meals].sort(
    (a, b) => getMealSlotSortIndex(a?.meal) - getMealSlotSortIndex(b?.meal)
  );
}

export function getAllowedMealNamesForSlot(slotIndex, currentMealNames, isHebrew = false) {
  const allNames = getAllMealNames(isHebrew);
  let minOrder = 0;
  for (let i = 0; i < slotIndex; i++) {
    const name = currentMealNames[i];
    if (name) minOrder = Math.max(minOrder, getMealOrderIndex(name));
  }
  const usedEn = new Set();
  for (let i = 0; i < currentMealNames.length; i++) {
    if (i !== slotIndex && currentMealNames[i]) {
      usedEn.add(convertMealNameToEnglish(currentMealNames[i]));
    }
  }
  return allNames.filter(
    (name) => getMealOrderIndex(name) >= minOrder && !usedEn.has(convertMealNameToEnglish(name))
  );
}

export function getMealName(numMeals, index, isHebrew = false) {
  if (numMeals === 1) return isHebrew ? 'ארוחה' : 'Meal';
  if (numMeals === 2) {
    const names = isHebrew ? ['ארוחת בוקר', 'ארוחת ערב'] : ['Breakfast', 'Dinner'];
    return names[index] || (isHebrew ? 'ארוחה' : 'Meal');
  }
  if (numMeals === 3) {
    const names = isHebrew ? ['ארוחת בוקר', 'ארוחת צהריים', 'ארוחת ערב'] : ['Breakfast', 'Lunch', 'Dinner'];
    return names[index] || (isHebrew ? 'ארוחה' : 'Meal');
  }
  const names = isHebrew ? MEAL_NAMES_HE.slice(1) : MEAL_ORDER_EN;
  return names[index] || (isHebrew ? `ארוחה ${index + 1}` : `Meal ${index + 1}`);
}

export function getMealRecommendationForCalories(calories) {
  if (!calories || calories < 1200) return null;
  if (calories >= 4000) {
    return {
      min: 6, max: 10, rangeLabelHe: '6+', rangeLabelEn: '6+',
      rationaleHe: 'בטווח הזה מומלץ 6 ארוחות ומעלה (כולל שייקים). קל יותר לפזר את הקלוריות.',
      rationaleEn: 'At this range we recommend 6+ meals (including shakes). Easier to spread calories.',
    };
  }
  if (calories >= 2800) {
    return {
      min: 5, max: 6, rangeLabelHe: '5–6', rangeLabelEn: '5–6',
      rationaleHe: 'כדי לא להעמיס על הקיבה – ארוחות בינוניות כל 3 שעות נוחות יותר מארוחות ענק.',
      rationaleEn: 'To avoid overloading your stomach – medium meals every ~3 hours are easier than huge meals.',
    };
  }
  if (calories >= 2000) {
    return {
      min: 4, max: 5, rangeLabelHe: '4–5', rangeLabelEn: '4–5',
      rationaleHe: '3 ארוחות עיקריות + 1–2 נשנושים. האיזון הנוח לרוב האנשים.',
      rationaleEn: '3 main meals + 1–2 snacks. The most comfortable balance for most people.',
    };
  }
  if (calories >= 1500) {
    return {
      min: 3, max: 3, rangeLabelHe: '3', rangeLabelEn: '3',
      rationaleHe: 'ארוחות גדולות ומשביעות (כ־500–600 קלוריות לארוחה) עדיפות על הרבה ארוחות קטנות.',
      rationaleEn: 'Larger, satiating meals (~500–600 kcal each) work better than many small meals.',
    };
  }
  return {
    min: 2, max: 3, rangeLabelHe: '2–3', rangeLabelEn: '2–3',
    rationaleHe: 'פחות קלוריות – פחות ארוחות, כדי שכל ארוחה תהיה משביעה.',
    rationaleEn: 'Fewer calories – fewer meals, so each meal stays satisfying.',
  };
}

function classifyMealSlot(slot) {
  const s = (slot || '').toLowerCase().trim();
  if (s.includes('breakfast') || s.includes('brunch')) return { kind: 'main', preferredKey: 'breakfast' };
  if (s.includes('lunch')) return { kind: 'main', preferredKey: 'lunch' };
  if (s.includes('dinner') || s.includes('post-workout') || s.includes('post workout')) {
    return { kind: 'main', preferredKey: 'dinner' };
  }
  return { kind: 'snack', preferredKey: null };
}

export function computeMealRatios(numMeals, mealSlots) {
  const ratiosForCount = MEAL_SPLIT_RATIOS[numMeals];
  const safeSlots = Array.from({ length: numMeals }, (_, i) => mealSlots[i] || '');

  if (!ratiosForCount) return safeSlots.map(() => 1 / numMeals);

  const assigned = new Array(numMeals).fill(null);
  const usedKeys = new Set();

  safeSlots.forEach((slot, i) => {
    const { kind, preferredKey } = classifyMealSlot(slot);
    if (kind === 'main' && preferredKey && ratiosForCount[preferredKey] !== undefined && !usedKeys.has(preferredKey)) {
      assigned[i] = ratiosForCount[preferredKey];
      usedKeys.add(preferredKey);
    }
  });

  const snackKeys = Object.keys(ratiosForCount).filter((k) => k.startsWith('snack_')).sort();
  let snackCursor = 0;
  safeSlots.forEach((slot, i) => {
    if (assigned[i] !== null) return;
    const { kind } = classifyMealSlot(slot);
    if (kind !== 'snack') return;
    while (snackCursor < snackKeys.length && usedKeys.has(snackKeys[snackCursor])) snackCursor += 1;
    if (snackCursor < snackKeys.length) {
      const key = snackKeys[snackCursor];
      assigned[i] = ratiosForCount[key];
      usedKeys.add(key);
      snackCursor += 1;
    }
  });

  const leftoverKeys = Object.keys(ratiosForCount).filter((k) => !usedKeys.has(k));
  let leftoverCursor = 0;
  safeSlots.forEach((slot, i) => {
    if (assigned[i] !== null) return;
    if (leftoverCursor < leftoverKeys.length) {
      const key = leftoverKeys[leftoverCursor];
      assigned[i] = ratiosForCount[key];
      usedKeys.add(key);
      leftoverCursor += 1;
    } else {
      assigned[i] = 1 / numMeals;
    }
  });

  return assigned;
}

export function distributeIntegerByRatios(total, ratios) {
  if (!total || total <= 0 || !ratios || ratios.length === 0) return ratios.map(() => 0);
  const raw = ratios.map((r) => total * r);
  const floors = raw.map((v) => Math.floor(v));
  let remainder = Math.round(total) - floors.reduce((a, b) => a + b, 0);
  const fractionalOrder = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < fractionalOrder.length && remainder > 0; k += 1) {
    floors[fractionalOrder[k].i] += 1;
    remainder -= 1;
  }
  return floors;
}

export function buildMealPlanStructure(answers) {
  const numMeals = parseInt(answers.number_of_meals, 10);
  if (!numMeals || numMeals < 1) return null;

  const descriptions = Array.isArray(answers.meal_descriptions) ? answers.meal_descriptions : [];
  const names = Array.isArray(answers.meal_names) ? answers.meal_names : [];
  const dailyCalories = Number(answers.daily_calories) || 0;
  const macros = answers.macros || {};
  const protein = Number(macros.protein) || 0;
  const carbs = Number(macros.carbs) || 0;
  const fat = Number(macros.fat) || 0;

  const slotNames = Array.from({ length: numMeals }, (_, index) => {
    const raw = names[index] || `Meal ${index + 1}`;
    return convertMealNameToEnglish(raw);
  });

  const ratios = computeMealRatios(numMeals, slotNames);
  const caloriesPerMeal = distributeIntegerByRatios(dailyCalories, ratios);
  const proteinPerMeal = distributeIntegerByRatios(protein, ratios);
  const carbsPerMeal = distributeIntegerByRatios(carbs, ratios);
  const fatsPerMeal = distributeIntegerByRatios(fat, ratios);

  const structure = descriptions.slice(0, numMeals).map((description, index) => ({
    mealSlot: slotNames[index],
    mealName: description || '',
    targetCalories: caloriesPerMeal[index] || 0,
    targetMacros: {
      protein: proteinPerMeal[index] || 0,
      carbs: carbsPerMeal[index] || 0,
      fats: fatsPerMeal[index] || 0,
    },
  }));
  return sortMealPlanStructure(structure);
}

export function normalizeMealNames(numMeals, mealNames, isHebrew) {
  const fixed = [...(mealNames || [])];
  let changed = false;
  for (let i = 0; i < numMeals; i++) {
    const allowed = getAllowedMealNamesForSlot(i, fixed, isHebrew);
    const current = fixed[i] || getMealName(numMeals, i, isHebrew);
    if (!fixed[i]) {
      fixed[i] = getMealName(numMeals, i, isHebrew);
      changed = true;
    } else if (!allowed.includes(current)) {
      fixed[i] = allowed[0] ?? getMealName(numMeals, i, isHebrew);
      changed = true;
    }
  }
  return { mealNames: fixed.slice(0, numMeals), changed };
}
