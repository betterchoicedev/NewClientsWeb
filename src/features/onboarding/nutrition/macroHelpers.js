/**
 * Interconnected macro gram engine — total kcal always reconciles to target.
 */

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };
export const MACRO_KEYS = ['protein', 'carbs', 'fat'];

export function gramsToKcal(macro, grams) {
  return Math.round((Number(grams) || 0) * KCAL_PER_G[macro]);
}

export function kcalToGrams(macro, kcal) {
  return Math.round((Number(kcal) || 0) / KCAL_PER_G[macro]);
}

export function totalKcalFromGrams(g) {
  return gramsToKcal('protein', g.protein)
    + gramsToKcal('carbs', g.carbs)
    + gramsToKcal('fat', g.fat);
}

export function parseMacroGrams(macros) {
  const parse = (v) => {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    const m = String(v).match(/[\d.]+/);
    return m ? parseFloat(m[0]) : 0;
  };
  return {
    protein: parse(macros?.protein),
    carbs: parse(macros?.carbs),
    fat: parse(macros?.fat),
  };
}

export function getMacroPercentages(macros, calories) {
  const g = parseMacroGrams(macros);
  const total = calories || totalKcalFromGrams(g) || 1;
  return {
    protein: Math.round((gramsToKcal('protein', g.protein) / total) * 100),
    carbs: Math.round((gramsToKcal('carbs', g.carbs) / total) * 100),
    fat: Math.round((gramsToKcal('fat', g.fat) / total) * 100),
  };
}

export function macrosFromPercentages(proteinPct, carbsPct, fatPct, calories) {
  if (!calories) return { protein: null, carbs: null, fat: null };
  return {
    protein: kcalToGrams('protein', (proteinPct / 100) * calories),
    carbs: kcalToGrams('carbs', (carbsPct / 100) * calories),
    fat: kcalToGrams('fat', (fatPct / 100) * calories),
  };
}

/** Scale unlocked macros to fill newTargetKcal; locked macro stays fixed in grams. */
export function scaleMacrosToTargetCalories(prevGrams, newTargetKcal, lockedMacro = null) {
  const lockedKcal = lockedMacro ? gramsToKcal(lockedMacro, prevGrams[lockedMacro]) : 0;
  const targetForUnlocked = newTargetKcal - lockedKcal;
  const unlocked = MACRO_KEYS.filter((m) => m !== lockedMacro);
  const unlockedKcal = unlocked.reduce((s, m) => s + gramsToKcal(m, prevGrams[m]), 0);
  const next = { ...prevGrams };

  if (unlockedKcal === 0) {
    const defaults = { protein: 0.30, carbs: 0.40, fat: 0.30 };
    unlocked.forEach((m) => {
      next[m] = Math.max(0, kcalToGrams(m, targetForUnlocked * (defaults[m] ?? 1 / unlocked.length)));
    });
  } else {
    unlocked.forEach((m) => {
      const share = gramsToKcal(m, prevGrams[m]) / unlockedKcal;
      next[m] = Math.max(0, kcalToGrams(m, share * targetForUnlocked));
    });
  }
  return correctMacroDrift(next, newTargetKcal, lockedMacro);
}

/**
 * Change one macro (slider); others rebalance to keep total ≈ targetKcal.
 * lockedMacro (if set and !== changedMacro) stays fixed in grams.
 */
export function rebalanceMacroChange(prevGrams, changedMacro, newGrams, targetKcal, lockedMacro = null) {
  const target = targetKcal || totalKcalFromGrams(prevGrams);
  const lockedKcal = (lockedMacro && lockedMacro !== changedMacro)
    ? gramsToKcal(lockedMacro, prevGrams[lockedMacro])
    : 0;

  const maxAllowedKcal = Math.max(0, target - lockedKcal);
  const maxAllowedGrams = Math.floor(maxAllowedKcal / KCAL_PER_G[changedMacro]);
  const grams = Math.min(Math.max(0, Number(newGrams) || 0), maxAllowedGrams);

  const next = { ...prevGrams, [changedMacro]: grams };
  const changedKcal = gramsToKcal(changedMacro, grams);
  const remainingKcal = Math.max(0, target - changedKcal - lockedKcal);

  const free = MACRO_KEYS.filter((m) => m !== changedMacro && m !== lockedMacro);
  if (free.length === 0) return next;

  if (free.length === 1) {
    next[free[0]] = Math.max(0, kcalToGrams(free[0], remainingKcal));
  } else {
    const freeKcalPrev = free.reduce((s, m) => s + gramsToKcal(m, prevGrams[m]), 0);
    free.forEach((m) => {
      const share = freeKcalPrev > 0
        ? gramsToKcal(m, prevGrams[m]) / freeKcalPrev
        : 1 / free.length;
      next[m] = Math.max(0, kcalToGrams(m, share * remainingKcal));
    });
  }

  return correctMacroDrift(next, target, lockedMacro, changedMacro);
}

function correctMacroDrift(grams, targetKcal, lockedMacro, excludeMacro = null) {
  const next = { ...grams };
  const drift = targetKcal - totalKcalFromGrams(next);
  if (Math.abs(drift) <= 5) return next;

  const adjustable = MACRO_KEYS.filter(
    (m) => m !== lockedMacro && m !== excludeMacro
  );
  if (adjustable.length === 0) return next;

  const adjMacro = adjustable.reduce(
    (biggest, m) => (next[m] > next[biggest] ? m : biggest),
    adjustable[0]
  );
  next[adjMacro] = Math.max(0, next[adjMacro] + Math.round(drift / KCAL_PER_G[adjMacro]));
  return next;
}

export function preserveMacroPercentagesOnCalorieChange(oldCalories, newCalories, macros) {
  if (!oldCalories || !newCalories || !macros) return macros;
  const prev = parseMacroGrams(macros);
  if (prev.protein + prev.carbs + prev.fat === 0) return macros;
  const scaled = scaleMacrosToTargetCalories(prev, newCalories, null);
  return { protein: scaled.protein, carbs: scaled.carbs, fat: scaled.fat };
}

/** @deprecated Use rebalanceMacroChange */
export function redistributeMacroEdit(opts) {
  const grams = parseMacroGrams(opts.currentMacros);
  const locked = opts.lockedMacros?.protein ? 'protein'
    : opts.lockedMacros?.carbs ? 'carbs'
      : opts.lockedMacros?.fat ? 'fat' : null;
  const next = rebalanceMacroChange(
    grams,
    opts.macroType,
    opts.isPercentage
      ? kcalToGrams(opts.macroType, (opts.newValue / 100) * opts.calories)
      : opts.newValue,
    opts.calories,
    locked
  );
  return next;
}
