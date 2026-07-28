import React, { useEffect } from 'react';
import { useOnboardingStore } from '../onboarding.store';
import SearchableSelect from './SearchableSelect';
import {
  getAllowedMealNamesForSlot,
  getMealName,
  getMealRecommendationForCalories,
  normalizeMealNames,
} from '../nutrition/mealStructure';

export default function MealPlanningFields({ isHe, isDark, inputClass }) {
  const answers = useOnboardingStore((s) => s.answers);
  const setAnswers = useOnboardingStore((s) => s.setAnswers);

  const numMeals = parseInt(answers.number_of_meals, 10) || 0;
  const dailyCal = answers.daily_calories ? Number(answers.daily_calories) : null;
  const rec = dailyCal != null ? getMealRecommendationForCalories(dailyCal) : null;

  const mealCountOptions = Array.from({ length: 10 }, (_, i) => i + 1).map((x) => ({
    value: String(x),
    label: String(x),
  }));

  const onMealCountChange = (v) => {
    const num = parseInt(v, 10) || 0;
    const mealNames = Array.from({ length: num }, (_, i) =>
      answers.meal_names?.[i] || getMealName(num, i, isHe)
    );
    setAnswers({
      number_of_meals: v,
      meal_descriptions: Array.from({ length: num }, (_, i) => answers.meal_descriptions?.[i] || ''),
      meal_names: mealNames,
    });
  };

  useEffect(() => {
    if (numMeals < 1) return;
    const { mealNames, changed } = normalizeMealNames(numMeals, answers.meal_names, isHe);
    if (changed) setAnswers({ meal_names: mealNames });
  }, [numMeals, isHe]); // eslint-disable-line react-hooks/exhaustive-deps

  const textMuted = isDark ? 'text-slate-400' : 'text-slate-600';
  const textMain = isDark ? 'text-slate-200' : 'text-slate-800';
  const cardClass = isDark
    ? 'rounded-2xl border border-emerald-800/40 bg-emerald-950/20 p-3'
    : 'rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3';

  const hasSelection = numMeals >= 1 && numMeals <= 10;
  const isBelowRec = rec && hasSelection && numMeals < rec.min;
  const isAboveRec = rec && hasSelection && numMeals > rec.max;

  return (
    <div className="space-y-4">
      <label className={`block text-sm font-medium ${textMain}`}>
        {isHe
          ? 'כמה ארוחות ביום? (ארוחות מלאות ו"נשנושים")'
          : 'How many meals per day? (full meals and snacks)'}
      </label>

      <SearchableSelect
        options={mealCountOptions}
        value={answers.number_of_meals || ''}
        onChange={onMealCountChange}
        placeholder={isHe ? 'בחר מספר ארוחות' : 'Select number of meals'}
        searchPlaceholder={isHe ? 'חיפוש...' : 'Search...'}
        emptyText={isHe ? 'לא נמצאו תוצאות' : 'No matches'}
        isDark={isDark}
        inputClass={inputClass}
      />

      {rec ? (
        <div className={cardClass}>
          <p className={`text-sm font-semibold ${textMain} mb-1`}>
            {isHe ? 'המלצה לפי תקציב הקלוריות שלך' : 'Recommendation for your calorie target'}
          </p>
          <p className={`text-sm ${textMuted}`}>
            {isHe
              ? `כ־${dailyCal} קלוריות → ${rec.rangeLabelHe} ארוחות`
              : `~${dailyCal} kcal → ${rec.rangeLabelEn} meals`}
          </p>
          <p className={`text-sm ${textMuted} mt-1`}>
            {isHe ? rec.rationaleHe : rec.rationaleEn}
          </p>
          {(isBelowRec || isAboveRec) ? (
            <p className={`text-sm font-medium mt-2 ${textMain}`}>
              {isBelowRec
                ? (isHe
                  ? `עם ${numMeals} ארוחות הארוחות עלולות להיות גדולות מדי. שקול ${rec.min}–${rec.max} ארוחות.`
                  : `With ${numMeals} meals, portions may be too large. Consider ${rec.min}–${rec.max} meals.`)
                : (isHe
                  ? `עם ${numMeals} ארוחות המנות עלולות להיות קטנות מדי. המלצתנו: ${rec.rangeLabelHe} ארוחות.`
                  : `With ${numMeals} meals, portions may be too small. We recommend ${rec.rangeLabelEn} meals.`)}
            </p>
          ) : null}
        </div>
      ) : null}

      {numMeals > 0 ? (
        <div className="space-y-4">
          <p className={`text-sm font-semibold ${textMain}`}>
            {isHe ? 'מה תרצה לאכול בכל ארוחה?' : 'What would you like to eat in each meal?'}
          </p>
          {Array.from({ length: numMeals }, (_, index) => {
            const defaultName = getMealName(numMeals, index, isHe);
            const mealNames = answers.meal_names || [];
            const allowed = getAllowedMealNamesForSlot(index, mealNames, isHe);
            const current = mealNames[index] || defaultName;
            const displayValue = allowed.includes(current) ? current : (allowed[0] ?? defaultName);
            const slotOptions = allowed.map((name) => ({ value: name, label: name }));

            return (
              <div key={index} className="space-y-2">
                <SearchableSelect
                  options={slotOptions}
                  value={displayValue}
                  onChange={(v) => {
                    const next = [...mealNames];
                    next[index] = v;
                    setAnswers({ meal_names: next });
                  }}
                  placeholder={isHe ? 'שם ארוחה' : 'Meal name'}
                  searchPlaceholder={isHe ? 'חיפוש...' : 'Search...'}
                  emptyText={isHe ? 'לא נמצאו תוצאות' : 'No matches'}
                  isDark={isDark}
                  inputClass={inputClass}
                />
                <textarea
                  rows={2}
                  className={inputClass}
                  placeholder={isHe ? 'לדוגמה: ביצים, לחם וירקות' : 'e.g., eggs, bread and vegetables'}
                  value={answers.meal_descriptions?.[index] || ''}
                  onChange={(e) => {
                    const next = [...(answers.meal_descriptions || [])];
                    next[index] = e.target.value;
                    setAnswers({ meal_descriptions: next });
                  }}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
