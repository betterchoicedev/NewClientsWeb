// ─── Prompt formatter helpers ─────────────────────────────────────────────────
// Converts structured meal plan / log data into compact Markdown summaries
// that are token-efficient for LLM consumption.

const _num = (val, fallback = 0) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

const _round = (val) => Math.round(_num(val) * 10) / 10;

function formatDailyTargets(totals = {}) {
  const cal = Math.round(_num(totals.calories || totals.calories_energy));
  const p   = _round(totals.protein || totals.protein_g);
  const c   = _round(totals.carbs   || totals.carbs_g || totals.carbohydrates_g);
  const f   = _round(totals.fat     || totals.fat_g);
  return `${cal} kcal | ${p}g P / ${c}g C / ${f}g F`;
}

function formatLoggedMealsList(loggedMeals = []) {
  if (!Array.isArray(loggedMeals) || loggedMeals.length === 0) {
    return 'None logged yet today.';
  }
  return loggedMeals.map((log) => {
    const label = (log.meal_label || 'Meal').trim();
    const items = Array.isArray(log.food_items) ? log.food_items : [];
    const itemNames = items.map((it) => it.name || it.item || 'Item').join(', ');
    const cal = Math.round(_num(log.total_calories));
    const p   = _round(log.total_protein_g);
    const c   = _round(log.total_carbs_g);
    const f   = _round(log.total_fat_g);
    return `- **${label}**: ${itemNames} (${cal} kcal | ${p}g P / ${c}g C / ${f}g F)`;
  }).join('\n');
}

function _formatMealSection(section = {}, role = 'Main') {
  if (!section || typeof section !== 'object') return '';
  const title = section.meal_title || section.meal_name || section.title || role;
  const nut   = section.nutrition || {};
  const cal   = Math.round(_num(nut.calories));
  const p     = _round(nut.protein);
  const c     = _round(nut.carbs);
  const f     = _round(nut.fat);
  const ingList = Array.isArray(section.ingredients)
    ? section.ingredients.map((ing) => {
        const name  = ing.item || ing.name || 'Ingredient';
        const grams = _num(ing['portionSI(gram)'] || ing.portion_grams);
        return `${name}${grams > 0 ? ` (${grams}g)` : ''}`;
      }).join(', ')
    : 'No ingredients listed';
  return `  * **${role} - ${title}** (${cal} kcal | ${p}g P / ${c}g C / ${f}g F)\n    * Ingredients: ${ingList}`;
}

function formatFullMealPlanMenu(mealPlan = {}) {
  const meals = Array.isArray(mealPlan.meals) ? mealPlan.meals : [];
  if (meals.length === 0) return 'No specific meal plan assigned.';
  return meals.map((slot, idx) => {
    const slotName = slot.meal || slot.main?.meal_name || `Slot ${idx + 1}`;
    const mainStr  = _formatMealSection(slot.main, 'Main');
    const altStr   = _formatMealSection(slot.alternative, 'Alternative');
    return `**Slot: ${slotName}**\n${mainStr}\n${altStr}`;
  }).join('\n\n');
}

module.exports = {
  formatDailyTargets,
  formatLoggedMealsList,
  formatFullMealPlanMenu,
};
