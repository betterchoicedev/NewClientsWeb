import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Beef, Droplets, Flame, Lock, LockOpen, RotateCcw, Wheat } from 'lucide-react';
import { useOnboardingStore } from '../onboarding.store';
import { calculateAge, calculateDailyCalories, defaultMacros } from '../steps/stepDefs';
import {
  MACRO_KEYS,
  getMacroPercentages,
  gramsToKcal,
  parseMacroGrams,
  rebalanceMacroChange,
  scaleMacrosToTargetCalories,
} from '../nutrition/macroHelpers';

const MACRO_META = {
  protein: { en: 'Protein', he: 'חלבון', short: 'P', bar: 'bg-blue-500', accent: 'accent-blue-500', Icon: Beef, iconClass: 'text-blue-500' },
  carbs: { en: 'Carbs', he: 'פחמימות', short: 'C', bar: 'bg-amber-500', accent: 'accent-amber-500', Icon: Wheat, iconClass: 'text-amber-500' },
  fat: { en: 'Fat', he: 'שומן', short: 'F', bar: 'bg-rose-500', accent: 'accent-rose-500', Icon: Droplets, iconClass: 'text-rose-500' },
};

function gramsToStore(g) {
  return { protein: g.protein, carbs: g.carbs, fat: g.fat };
}

export default function CaloriesMacrosFields({ isHe, isDark }) {
  const answers = useOnboardingStore((s) => s.answers);
  const setAnswers = useOnboardingStore((s) => s.setAnswers);

  const [lockedMacro, setLockedMacro] = useState(null);

  const computedCalories = useMemo(() => {
    const age = calculateAge(answers.date_of_birth);
    return calculateDailyCalories(
      age,
      answers.gender,
      answers.weight_kg,
      answers.height_cm,
      answers.activity_level,
      answers.goal,
      answers.nursing_status
    );
  }, [
    answers.date_of_birth,
    answers.gender,
    answers.weight_kg,
    answers.height_cm,
    answers.activity_level,
    answers.goal,
    answers.nursing_status,
  ]);

  const calAnchor = computedCalories ?? null;
  const calories = answers.daily_calories ?? calAnchor ?? null;
  const calMin = calAnchor ? Math.round(calAnchor * 0.85) : 0;
  const calMax = calAnchor ? Math.round(calAnchor * 1.15) : 6000;

  const macroGrams = useMemo(
    () => parseMacroGrams(answers.macros),
    [answers.macros]
  );

  const defaultGrams = useMemo(() => {
    if (!computedCalories) return null;
    return parseMacroGrams(defaultMacros(computedCalories, answers.goal));
  }, [computedCalories, answers.goal]);

  useEffect(() => {
    if (!computedCalories || answers.daily_calories) return;
    const defs = defaultMacros(computedCalories, answers.goal);
    setAnswers({ daily_calories: computedCalories, macros: defs });
  }, [computedCalories]); // eslint-disable-line react-hooks/exhaustive-deps

  const pcts = calories
    ? getMacroPercentages(macroGrams, calories)
    : { protein: 30, carbs: 40, fat: 30 };

  const isDirty = useMemo(() => {
    if (!computedCalories || !defaultGrams) return false;
    if (calories !== computedCalories) return true;
    return MACRO_KEYS.some((k) => macroGrams[k] !== defaultGrams[k]);
  }, [computedCalories, calories, defaultGrams, macroGrams]);

  const commit = useCallback((nextCalories, nextGrams) => {
    setAnswers({
      daily_calories: nextCalories,
      macros: gramsToStore(nextGrams),
    });
  }, [setAnswers]);

  const onCaloriesChange = useCallback((raw) => {
    if (!calAnchor) return;
    const clamped = Math.round(Math.max(calMin, Math.min(calMax, Number(raw) || calAnchor)));
    const nextGrams = scaleMacrosToTargetCalories(macroGrams, clamped, lockedMacro);
    commit(clamped, nextGrams);
  }, [calAnchor, calMin, calMax, macroGrams, lockedMacro, commit]);

  const onMacroChange = useCallback((macro, raw) => {
    if (!calories) return;
    const nextGrams = rebalanceMacroChange(macroGrams, macro, raw, calories, lockedMacro);
    commit(calories, nextGrams);
  }, [calories, macroGrams, lockedMacro, commit]);

  const onReset = useCallback(() => {
    if (!computedCalories || !defaultGrams) return;
    setLockedMacro(null);
    commit(computedCalories, defaultGrams);
  }, [computedCalories, defaultGrams, commit]);

  const toggleLock = (macro) => {
    setLockedMacro((prev) => (prev === macro ? null : macro));
  };

  const textMuted = isDark ? 'text-slate-400' : 'text-slate-600';
  const textMain = isDark ? 'text-slate-200' : 'text-slate-800';
  const card = isDark ? 'border-white/10 bg-white/[0.04]' : 'border-white/70 bg-white/40';

  return (
    <div className={`rounded-2xl border backdrop-blur-md ${card}`}>
      {/* Calories header + slider */}
      <div className="px-3 pt-3 pb-2 border-b border-white/10">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-[10px] font-medium uppercase tracking-wide flex items-center gap-1 ${textMuted}`}>
              <Flame className="w-3 h-3 text-emerald-500" aria-hidden />
              {isHe ? 'יעד יומי' : 'Daily target'}
            </p>
            <p className={`text-2xl font-bold tabular-nums leading-tight ${textMain}`}>
              {(calories ?? '—').toLocaleString()}
              <span className={`text-sm font-medium ms-1 ${textMuted}`}>kcal</span>
            </p>
            {calAnchor ? (
              <p className={`text-[10px] mt-0.5 ${textMuted}`}>
                {isHe ? 'מחושב' : 'Computed'} {calAnchor.toLocaleString()} · ±15%
              </p>
            ) : null}
          </div>
          {computedCalories ? (
            <button
              type="button"
              onClick={onReset}
              disabled={!isDirty}
              title={isHe ? 'איפוס לערכים מחושבים' : 'Reset to computed values'}
              aria-label={isHe ? 'איפוס לערכים מחושבים' : 'Reset to computed values'}
              className={`shrink-0 min-h-9 min-w-9 flex items-center justify-center rounded-lg border transition-colors ${
                isDirty
                  ? isDark
                    ? 'border-white/20 text-slate-200 hover:bg-white/10'
                    : 'border-slate-300 text-slate-700 hover:bg-white/60'
                  : isDark
                    ? 'border-white/5 text-slate-600 cursor-default'
                    : 'border-slate-200 text-slate-400 cursor-default'
              }`}
            >
              <RotateCcw className="w-4 h-4" aria-hidden />
            </button>
          ) : null}
        </div>

        {calAnchor ? (
          <input
            type="range"
            min={calMin}
            max={calMax}
            step={10}
            value={calories ?? calAnchor}
            onChange={(e) => onCaloriesChange(e.target.value)}
            className="w-full h-2 mt-2 accent-emerald-500 cursor-pointer"
            aria-label={isHe ? 'קלוריות יומיות' : 'Daily calories'}
          />
        ) : null}
      </div>

      {/* Macro split bar + sliders */}
      {calories && macroGrams.protein + macroGrams.carbs + macroGrams.fat > 0 ? (
        <div className="px-3 py-2 space-y-2">
          <div
            className="h-2.5 rounded-full overflow-hidden flex"
            role="img"
            aria-label={isHe ? 'חלוקת מאקרו' : 'Macro distribution'}
          >
            {MACRO_KEYS.map((key) => (
              <div
                key={key}
                className={`${MACRO_META[key].bar} transition-all duration-200`}
                style={{ width: `${Math.max(0, pcts[key])}%` }}
              />
            ))}
          </div>

          <div className="flex justify-around text-[10px] tabular-nums">
            {MACRO_KEYS.map((key) => {
              const { Icon, iconClass, short } = MACRO_META[key];
              return (
                <span key={key} className={`flex items-center gap-0.5 ${textMuted}`}>
                  <Icon className={`w-3 h-3 ${iconClass}`} aria-hidden />
                  {short} {pcts[key]}%
                </span>
              );
            })}
          </div>

          {MACRO_KEYS.map((key) => {
            const meta = MACRO_META[key];
            const { Icon, iconClass } = meta;
            const locked = lockedMacro === key;
            const grams = macroGrams[key];
            const lockedKcal = lockedMacro && lockedMacro !== key
              ? gramsToKcal(lockedMacro, macroGrams[lockedMacro])
              : 0;
            const sliderMax = Math.floor(Math.max(0, calories - lockedKcal) / (key === 'fat' ? 9 : 4));

            return (
              <div
                key={key}
                className={`rounded-xl px-2 py-1.5 ${locked ? 'bg-emerald-500/10' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`flex items-center gap-1 text-xs font-semibold w-[4.5rem] shrink-0 ${textMain}`}>
                    <Icon className={`w-3.5 h-3.5 ${iconClass}`} aria-hidden />
                    {isHe ? meta.he : meta.en}
                  </span>
                  <span className={`text-[10px] tabular-nums flex-1 ${textMuted}`}>
                    {grams}g · {gramsToKcal(key, grams)} kcal
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleLock(key)}
                    aria-pressed={locked}
                    aria-label={locked
                      ? (isHe ? 'שחרר נעילה' : 'Unlock')
                      : (isHe ? 'נעל' : 'Lock')}
                    className={`shrink-0 min-h-8 min-w-8 flex items-center justify-center rounded-lg border transition-colors ${
                      locked
                        ? 'bg-emerald-500 text-white border-emerald-400'
                        : isDark
                          ? 'border-white/15 text-slate-500'
                          : 'border-slate-300 text-slate-400'
                    }`}
                  >
                    {locked
                      ? <Lock className="w-3.5 h-3.5" aria-hidden />
                      : <LockOpen className="w-3.5 h-3.5" aria-hidden />}
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(sliderMax, grams)}
                  step={1}
                  disabled={locked}
                  value={Math.min(grams, sliderMax)}
                  onChange={(e) => onMacroChange(key, e.target.value)}
                  className={`w-full h-2 cursor-pointer ${meta.accent} ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                  aria-label={isHe ? meta.he : meta.en}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
