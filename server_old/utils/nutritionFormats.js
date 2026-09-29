/**
 * Canonical nutrition / meal-plan DB shapes (aligned with dietitian web + meal-plan-builder).
 */

const { sortMealPlanMeals, normalizeMealPlanStructureForDb } = require('./mealStructure');
const { calculateMainTotalsFromMeals } = require('./helpers');

function parseMacroGrams(value) {
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const match = String(value).match(/-?\d+(\.\d+)?/);
  return match ? Math.round(Number(match[0])) : 0;
}

/** chat_users.macros + client_meal_plans.macros_target: { protein: "150g", carbs: "200g", fat: "60g" } */
function formatMacrosGramStrings(macros) {
  if (!macros || typeof macros !== 'object') return null;
  const protein = parseMacroGrams(macros.protein);
  const carbs = parseMacroGrams(macros.carbs ?? macros.carbohydrates);
  const fat = parseMacroGrams(macros.fat ?? macros.fats);
  return {
    protein: `${protein}g`,
    carbs: `${carbs}g`,
    fat: `${fat}g`,
  };
}

function normalizeMealSection(section, mealName) {
  if (!section || typeof section !== 'object') return null;
  const title =
    section.meal_title ||
    section.meal_name ||
    section.title ||
    section.name ||
    mealName;
  const nutrition = section.nutrition && typeof section.nutrition === 'object'
    ? {
        calories: Number(section.nutrition.calories) || 0,
        protein: Number(section.nutrition.protein) || 0,
        carbs: Number(section.nutrition.carbs) || 0,
        fat: Number(section.nutrition.fat) || 0,
      }
    : {
        calories: Number(section.calories) || 0,
        protein: Number(section.protein) || 0,
        carbs: Number(section.carbs) || 0,
        fat: Number(section.fat) || 0,
      };

  const ingredients = Array.isArray(section.ingredients)
    ? section.ingredients.map((ing) => {
        if (!ing || typeof ing !== 'object') return ing;
        const out = { ...ing };
        if (out.UPC === undefined) out.UPC = null;
        return out;
      })
    : [];

  return {
    meal_name: section.meal_name || mealName,
    meal_title: title,
    nutrition,
    ingredients,
    main_protein_source: section.main_protein_source || '',
  };
}

/** dietitian_meal_plan / meal_plans_and_schemas.meal_plan: { note, meals, totals } */
function normalizeMealPlanForDb(raw = {}) {
  const meals = sortMealPlanMeals(
    Array.isArray(raw.meals) ? raw.meals : Array.isArray(raw.menu) ? raw.menu : []
  );

  const normalizedMeals = meals.map((meal) => {
    const mealName =
      (typeof meal?.meal === 'string' && meal.meal.trim()) ||
      meal?.main?.meal_name ||
      meal?.main?.meal_title ||
      'Meal';
    const out = { meal: mealName };
    if (meal.main) out.main = normalizeMealSection(meal.main, mealName);
    if (meal.alternative) out.alternative = normalizeMealSection(meal.alternative, mealName);
    return out;
  });

  const totals =
    raw.totals && typeof raw.totals === 'object'
      ? {
          calories: Number(raw.totals.calories) || 0,
          protein: Number(raw.totals.protein) || 0,
          carbs: Number(raw.totals.carbs) || 0,
          fat: Number(raw.totals.fat) || 0,
        }
      : calculateMainTotalsFromMeals(normalizedMeals);

  return {
    note: typeof raw.note === 'string' ? raw.note : '',
    meals: normalizedMeals,
    totals,
  };
}

/** Normalize known chat_users nutrition fields before any DB write. */
function normalizeChatUserPayloadForDb(payload = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  const out = { ...payload };
  if (out.macros != null) {
    out.macros = formatMacrosGramStrings(out.macros) || out.macros;
  }
  if (out.meal_plan_structure != null) {
    out.meal_plan_structure = normalizeMealPlanStructureForDb(
      out.meal_plan_structure,
      Number(out.daily_target_total_calories) || 0
    );
  }
  if (out.meal_plan != null && typeof out.meal_plan === 'object') {
    out.meal_plan = normalizeMealPlanForDb(out.meal_plan);
  }
  return out;
}

module.exports = {
  parseMacroGrams,
  formatMacrosGramStrings,
  normalizeMealPlanForDb,
  normalizeChatUserPayloadForDb,
};
