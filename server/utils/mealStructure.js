/**
 * Server-side meal_plan_structure builder (mirrors client nutrition/mealStructure.js).
 * Canonical chat_users.meal_plan_structure: { meal, description, calories, calories_pct }
 */

const MEAL_ORDER_EN = [
  'Breakfast', 'Morning Snack', 'Brunch', 'Lunch', 'Afternoon Snack',
  'Dinner', 'Evening Snack', 'Late Dinner', 'Post-Workout Meal', 'Midnight Snack',
];

const MEAL_NAMES_EN = ['Meal', ...MEAL_ORDER_EN];
const MEAL_NAMES_HE = [
  'ארוחה', 'ארוחת בוקר', 'חטיף בוקר', 'בראנץ\'', 'ארוחת צהריים', 'חטיף צהריים',
  'ארוחת ערב', 'חטיף ערב', 'ארוחת ערב מאוחרת', 'ארוחה לאחר אימון', 'חטיף לילה',
];

const MEAL_SPLIT_RATIOS = {
  2: { breakfast: 0.45, dinner: 0.55 },
  3: { breakfast: 0.30, lunch: 0.35, dinner: 0.35 },
  4: { breakfast: 0.25, lunch: 0.30, snack_1: 0.15, dinner: 0.30 },
  5: { breakfast: 0.20, lunch: 0.25, snack_1: 0.15, snack_2: 0.10, dinner: 0.30 },
  6: { breakfast: 0.20, lunch: 0.20, snack_1: 0.10, snack_2: 0.10, dinner: 0.30, snack_3: 0.10 },
  7: { breakfast: 0.15, lunch: 0.20, snack_1: 0.10, snack_2: 0.10, dinner: 0.25, snack_3: 0.10, snack_4: 0.10 },
};

function getMealOrderIndex(mealName) {
  const en = convertMealNameToEnglish(mealName);
  const idx = MEAL_ORDER_EN.indexOf(en);
  return idx === -1 ? 999 : idx;
}

function sortMealPlanStructure(structure) {
  if (!Array.isArray(structure)) return structure;
  return [...structure].sort(
    (a, b) => getMealOrderIndex(a?.mealSlot || a?.meal) - getMealOrderIndex(b?.mealSlot || b?.meal)
  );
}

function sortMealPlanMeals(meals) {
  if (!Array.isArray(meals)) return meals;
  return [...meals].sort(
    (a, b) => getMealOrderIndex(a?.meal) - getMealOrderIndex(b?.meal)
  );
}

function convertMealNameToEnglish(mealName) {
  if (!mealName) return mealName;
  if (MEAL_NAMES_EN.includes(mealName)) return mealName;
  const hebrewIndex = MEAL_NAMES_HE.indexOf(mealName);
  if (hebrewIndex !== -1) return MEAL_NAMES_EN[hebrewIndex];
  return mealName;
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

function computeMealRatios(numMeals, mealSlots) {
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

function distributeIntegerByRatios(total, ratios) {
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

/** Normalize one meal_plan_structure row to { meal, description, calories, calories_pct }. */
function normalizeMealPlanStructureEntry(entry, dailyCalories = 0) {
  if (!entry || typeof entry !== 'object') return null;

  if (entry.meal && (entry.calories != null || entry.calories_pct != null)) {
    const calories = Number(entry.calories) || 0;
    const caloriesPct =
      entry.calories_pct != null
        ? Number(entry.calories_pct) || 0
        : dailyCalories > 0
          ? Math.round((calories / dailyCalories) * 100)
          : 0;
    return {
      meal: convertMealNameToEnglish(entry.meal),
      description: entry.description || '',
      calories,
      calories_pct: caloriesPct,
    };
  }

  const meal = entry.mealSlot || entry.meal || 'Meal';
  const description = entry.mealName || entry.description || '';
  const calories = Number(entry.targetCalories ?? entry.calories) || 0;
  const caloriesPct =
    dailyCalories > 0 ? Math.round((calories / dailyCalories) * 100) : Number(entry.calories_pct) || 0;

  return {
    meal: convertMealNameToEnglish(meal),
    description,
    calories,
    calories_pct: caloriesPct,
  };
}

/** Accept legacy dietitian rows or canonical onboarding rows; always return canonical array. */
function normalizeMealPlanStructureForDb(structure, dailyCalories = 0) {
  if (!Array.isArray(structure)) return structure;
  const normalized = structure
    .map((entry) => normalizeMealPlanStructureEntry(entry, dailyCalories))
    .filter(Boolean);
  return sortMealPlanStructure(normalized);
}

function buildMealPlanStructure(answers) {
  const numMeals = parseInt(answers.number_of_meals, 10);
  if (!numMeals || numMeals < 1) return null;

  const descriptions = Array.isArray(answers.meal_descriptions) ? answers.meal_descriptions : [];
  const names = Array.isArray(answers.meal_names) ? answers.meal_names : [];
  const dailyCalories = Number(answers.daily_calories) || 0;

  const slotNames = Array.from({ length: numMeals }, (_, index) => {
    const raw = names[index] || `Meal ${index + 1}`;
    return convertMealNameToEnglish(raw);
  });

  const ratios = computeMealRatios(numMeals, slotNames);
  const caloriesPerMeal = distributeIntegerByRatios(dailyCalories, ratios);

  const structure = Array.from({ length: numMeals }, (_, index) => {
    const calories = caloriesPerMeal[index] || 0;
    const caloriesPct =
      dailyCalories > 0 ? Math.round((calories / dailyCalories) * 100) : 0;
    return {
      meal: slotNames[index],
      description: descriptions[index] || '',
      calories,
      calories_pct: caloriesPct,
    };
  });
  return sortMealPlanStructure(structure);
}

module.exports = {
  buildMealPlanStructure,
  normalizeMealPlanStructureEntry,
  normalizeMealPlanStructureForDb,
  sortMealPlanStructure,
  sortMealPlanMeals,
  getMealOrderIndex,
};
