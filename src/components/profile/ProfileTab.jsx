import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createWeightLog } from '../../supabase/secondaryClient';
import { apiFetch } from '../../lib/apiClient';
import { useSettings } from '../../context/SettingsContext';

const CM_PER_IN = 2.54;

const roundMeasurementDisplay = (value, decimals = 1) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
};

// ─── Nutritional helper constants & functions ─────────────────────────────────
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

const parseGrams = (str) => {
  if (str === null || str === undefined) return 0;
  if (typeof str === 'number') return str;
  const match = String(str).match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
};

const gramsToKcal = (macro, grams) => Math.round(grams * KCAL_PER_G[macro]);

const kcalToGrams = (macro, kcal) => Math.round(kcal / KCAL_PER_G[macro]);

const totalKcalFromGrams = (g) =>
  gramsToKcal('protein', g.protein) + gramsToKcal('carbs', g.carbs) + gramsToKcal('fat', g.fat);

const macrosToGrams = (macrosObj) => ({
  protein: parseGrams(macrosObj?.protein),
  carbs: parseGrams(macrosObj?.carbs),
  fat: parseGrams(macrosObj?.fat),
});

const gramsToDbMacros = (g) => ({
  protein: `${g.protein}g`,
  carbs: `${g.carbs}g`,
  fat: `${g.fat}g`,
});

const MACRO_META = {
  protein: { label: 'Protein', labelHe: 'חלבון', color: 'blue', kcalPer: 4 },
  carbs:   { label: 'Carbs',   labelHe: 'פחמימות', color: 'amber', kcalPer: 4 },
  fat:     { label: 'Fat',     labelHe: 'שומן', color: 'rose', kcalPer: 9 },
};

// ─── BMR / TDEE engine ────────────────────────────────────────────────────────
const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light:     1.375,
  moderate:  1.55,
  very:      1.725,
  extra:     1.9,
};

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', labelEn: 'Sedentary — little or no exercise',          labelHe: 'יושבני — מעט או ללא פעילות' },
  { value: 'light',     labelEn: 'Light — exercise 1–3 days/week',              labelHe: 'פעילות קלה — 1–3 פעמים בשבוע' },
  { value: 'moderate',  labelEn: 'Moderate — exercise 3–5 days/week',           labelHe: 'בינוני — 3–5 פעמים בשבוע' },
  { value: 'very',      labelEn: 'Very Active — hard exercise 6–7 days/week',   labelHe: 'פעיל מאוד — 6–7 פעמים בשבוע' },
  { value: 'extra',     labelEn: 'Extra Active — very hard exercise/physical job', labelHe: 'קיצוני — פעילות אינטנסיבית מאוד' },
];

/**
 * Harris-Benedict BMR (revised).
 * Returns null when any argument is missing / invalid.
 */
const computeBMR = (age, gender, weightKg, heightCm) => {
  const a = Number(age), w = Number(weightKg), h = Number(heightCm);
  if (!a || !w || !h || a <= 0 || w <= 0 || h <= 0) return null;
  if (gender === 'male')   return Math.round(66.5 + 13.75 * w + 5.003 * h - 6.75 * a);
  if (gender === 'female') return Math.round(655.1 + 9.563 * w + 1.850 * h - 4.676 * a);
  // 'other' / unknown — average of male and female
  const m = 66.5 + 13.75 * w + 5.003 * h - 6.75 * a;
  const f = 655.1 + 9.563 * w + 1.850 * h - 4.676 * a;
  return Math.round((m + f) / 2);
};

const computeTDEE = (bmr, activityLevel) => {
  if (!bmr) return null;
  const mult = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.2;
  return Math.round(bmr * mult);
};

/**
 * Scale unlocked macros so their combined kcal fills newTdee.
 * The locked macro (if any) stays fixed in grams.
 * If all macros are zero, fall back to a 30/40/30 protein/carbs/fat split.
 */
const scaleMacrosToTdee = (prevGrams, newTdee, lockedMacro) => {
  const lockedKcal = lockedMacro ? gramsToKcal(lockedMacro, prevGrams[lockedMacro]) : 0;
  const targetForUnlocked = newTdee - lockedKcal;
  const unlocked = Object.keys(MACRO_META).filter((m) => m !== lockedMacro);
  const unlockedKcal = unlocked.reduce((s, m) => s + gramsToKcal(m, prevGrams[m]), 0);

  const next = { ...prevGrams };

  if (unlockedKcal === 0) {
    // No existing distribution — use default 30% protein / 40% carbs / 30% fat
    const defaults = { protein: 0.30, carbs: 0.40, fat: 0.30 };
    unlocked.forEach((m) => {
      const kcalShare = targetForUnlocked * (defaults[m] ?? 1 / unlocked.length);
      next[m] = Math.max(0, kcalToGrams(m, kcalShare));
    });
  } else {
    unlocked.forEach((m) => {
      const share = gramsToKcal(m, prevGrams[m]) / unlockedKcal;
      next[m] = Math.max(0, kcalToGrams(m, share * targetForUnlocked));
    });
  }
  return next;
};

const allergiesOptions = [
  { value: 'peanuts', labelHe: 'בוטנים', labelEn: 'Peanuts' },
  { value: 'tree_nuts', labelHe: 'אגוזי עץ', labelEn: 'Tree Nuts' },
  { value: 'milk', labelHe: 'חלב', labelEn: 'Milk/Dairy' },
  { value: 'eggs', labelHe: 'ביצים', labelEn: 'Eggs' },
  { value: 'wheat', labelHe: 'חיטה', labelEn: 'Wheat' },
  { value: 'soy', labelHe: 'סויה', labelEn: 'Soy' },
  { value: 'fish', labelHe: 'דגים', labelEn: 'Fish' },
  { value: 'seafood', labelHe: 'פירות ים', labelEn: 'Seafood' }
];

const limitationsOptions = [
  { value: 'vegetarian', labelHe: 'צמחוני', labelEn: 'Vegetarian' },
  { value: 'vegan', labelHe: 'טבעוני', labelEn: 'Vegan' },
  { value: 'pescatarian', labelHe: 'פסקטריאני', labelEn: 'Pescatarian' },
  { value: 'kosher', labelHe: 'כשר', labelEn: 'Kosher' },
  { value: 'halal', labelHe: 'חלאל', labelEn: 'Halal' },
  { value: 'gluten_free', labelHe: 'ללא גלוטן', labelEn: 'Gluten-free' },
  { value: 'dairy_free', labelHe: 'ללא חלב', labelEn: 'Dairy-free' }
];

const otherOption = { value: 'other', labelHe: 'אחר', labelEn: 'Other' };

const allergiesOptionsWithOther = [...allergiesOptions, otherOption];
const limitationsOptionsWithOther = [...limitationsOptions, otherOption];

const ALLERGY_VALUE_SET = new Set(allergiesOptions.map((o) => o.value));
const LIMITATION_VALUE_SET = new Set(limitationsOptions.map((o) => o.value));

/** Parse comma-separated food_allergies / food_limitations (values + optional Other: free text) */
const parseMultiSelectField = (stored, knownValueSet, optionsList) => {
  if (!stored || typeof stored !== 'string' || !stored.trim()) {
    return { selected: [], otherText: '' };
  }
  let text = stored.trim();
  let otherText = '';
  const otherPrefix = text.match(/\b(?:Other|אחר)\s*:\s*(.+)$/is);
  if (otherPrefix) {
    otherText = otherPrefix[1].trim();
    text = text.slice(0, otherPrefix.index).replace(/,\s*$/, '').trim();
  }
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  const selected = [];
  for (const part of parts) {
    if (knownValueSet.has(part)) {
      selected.push(part);
      continue;
    }
    if (part === 'other') {
      if (!selected.includes('other')) selected.push('other');
      continue;
    }
    const opt = optionsList.find(
      (o) =>
        o.value === part ||
        o.labelEn.toLowerCase() === part.toLowerCase() ||
        o.labelHe === part
    );
    if (opt) {
      if (!selected.includes(opt.value)) selected.push(opt.value);
      continue;
    }
    if (!otherText) otherText = part;
    else otherText = `${otherText}, ${part}`;
    if (!selected.includes('other')) selected.push('other');
  }
  if (otherText && !selected.includes('other')) selected.push('other');
  return { selected, otherText };
};

/** Serialize selected values + optional other text (matches onboarding + supports commas in "Other" via prefix) */
const serializeMultiSelectField = (selected, otherText, knownValueSet) => {
  const parts = selected.filter((v) => v !== 'other' && knownValueSet.has(v));
  if (selected.includes('other')) {
    if (otherText.trim()) {
      parts.push(`Other: ${otherText.trim()}`);
    } else {
      parts.push('other');
    }
  }
  return parts.join(', ');
};

const ProfileTab = ({ profileData, onInputChange, onSave, isSaving, saveStatus, errorMessage, themeClasses, t, companyOptions, isLoadingCompanies, companyError, language, onboardingCompleted = false, user, onSaveProfileImageUrl }) => {
  const { settings } = useSettings();
  const displayMeasurementSystem = !settings.loading ? (settings.measurementSystem || 'metric') : (profileData.measurementSystem || 'metric');
  const heightIsImperial = String(displayMeasurementSystem).toLowerCase() === 'imperial';

  const toWeightKgFromInput = useCallback((raw) => {
    if (raw === '' || raw == null) return null;
    const n = parseFloat(String(raw).trim());
    if (Number.isNaN(n)) return NaN;
    return n;
  }, []);

  const toHeightCmFromInput = useCallback(
    (raw) => {
      if (raw === '' || raw == null) return null;
      const n = parseFloat(String(raw).trim());
      if (Number.isNaN(n)) return NaN;
      return heightIsImperial ? n * CM_PER_IN : n;
    },
    [heightIsImperial]
  );

  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [cropImage, setCropImage] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const isHebrew = language === 'hebrew';

  // ─── Nutritional Profile State ─────────────────────────────────────────────
  const [calculatedBmr, setCalculatedBmr]         = useState(null);
  const [targetCals, setTargetCals]               = useState(null);
  const [originalTargetCals, setOriginalTargetCals] = useState(null);
  const [macroGrams, setMacroGrams]               = useState({ protein: 0, carbs: 0, fat: 0 });
  const [lockedMacro, setLockedMacro]             = useState(null);
  const [isSavingNutritional, setIsSavingNutritional] = useState(false);
  const [nutritionalSaveStatus, setNutritionalSaveStatus] = useState('');
  const [autoCalcActive, setAutoCalcActive]       = useState(false);
  const nutritionalInitialized = useRef(false);

  // ─── Weight, Height & Activity state (editable inputs) ───────────────────
  const [weightInput, setWeightInput]     = useState('');
  const [heightInput, setHeightInput]     = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const measurementDisplayKeyRef = useRef('');

  // Sync editable weight/height fields from stored kg/cm when source values or height display unit changes
  useEffect(() => {
    const ms = String(displayMeasurementSystem || 'metric').toLowerCase();
    const key = `${profileData.weightKg ?? ''}|${profileData.heightCm ?? ''}|${ms}`;
    if (key === measurementDisplayKeyRef.current) return;
    measurementDisplayKeyRef.current = key;

    if (profileData.weightKg != null) {
      const kg = Number(profileData.weightKg);
      setWeightInput(String(roundMeasurementDisplay(kg)));
    }
    if (profileData.heightCm != null) {
      const cm = Number(profileData.heightCm);
      setHeightInput(String(ms === 'imperial' ? roundMeasurementDisplay(cm / CM_PER_IN) : roundMeasurementDisplay(cm)));
    }
  }, [profileData.weightKg, profileData.heightCm, displayMeasurementSystem]);

  useEffect(() => {
    if (profileData.activityLevel) setActivityLevel(profileData.activityLevel);
  }, [profileData.activityLevel]);

  useEffect(() => {
    if (nutritionalInitialized.current) return;
    const hasCals   = profileData.targetCalories != null;
    const hasMacros = profileData.macros != null;
    if (!hasCals && !hasMacros) return;
    nutritionalInitialized.current = true;

    const initialTarget = hasCals ? Number(profileData.targetCalories) : null;
    if (hasCals) {
      setTargetCals(initialTarget);
      setOriginalTargetCals(initialTarget);
    }
    if (hasMacros) {
      const loadedMacros = macrosToGrams(profileData.macros);
      // Safety: if stored macros total more kcal than the daily target,
      // rescale them down so the total is in sync with targetCals.
      if (initialTarget !== null && totalKcalFromGrams(loadedMacros) > initialTarget + 5) {
        setMacroGrams(scaleMacrosToTdee(loadedMacros, initialTarget, null));
      } else {
        setMacroGrams(loadedMacros);
      }
    }
    if (profileData.bmrCalories) setCalculatedBmr(Number(profileData.bmrCalories));
  }, [profileData.targetCalories, profileData.macros, profileData.bmrCalories]);

  // ─── Reactive BMR / TDEE engine ──────────────────────────────────────────
  // Runs whenever weight, height, gender or activity level changes.
  // Pure recalculation only — no DB write happens here.
  // Persisting to the database is done by the "Save Nutritional Profile" button.
  useEffect(() => {
    const w = toWeightKgFromInput(weightInput);
    const h = toHeightCmFromInput(heightInput);
    const gender = profileData.gender;
    const age    = profileData.age ? Number(profileData.age) : null;

    if (w == null || h == null || !gender || !age || !activityLevel) return;
    if (Number.isNaN(w) || Number.isNaN(h) || w <= 0 || h <= 0) return;

    const newBmr  = computeBMR(age, gender, w, h);
    const newTdee = computeTDEE(newBmr, activityLevel);
    if (!newBmr || !newTdee) return;

    setCalculatedBmr(newBmr);
    setTargetCals(newTdee);
    setOriginalTargetCals(newTdee);
    setMacroGrams((prev) => scaleMacrosToTdee(prev, newTdee, lockedMacro));
    setAutoCalcActive(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightInput, heightInput, profileData.gender, profileData.age, activityLevel, toWeightKgFromInput, toHeightCmFromInput]);

  // Slider range = ±30% of the current TDEE (recalculates when engine fires).
  const calAnchor = originalTargetCals ?? null;
  const calMin = calAnchor ? Math.round(calAnchor * 0.7) : 0;
  const calMax = calAnchor ? Math.round(calAnchor * 1.3) : 9999;

  const weightInputMin = 20;
  const weightInputMax = 500;
  const heightInputMin = heightIsImperial ? roundMeasurementDisplay(50 / CM_PER_IN, 1) : 50;
  const heightInputMax = heightIsImperial ? roundMeasurementDisplay(300 / CM_PER_IN, 1) : 300;

  const currentWeightDisplay =
    profileData.weightKg == null
      ? null
      : `${roundMeasurementDisplay(Number(profileData.weightKg))} kg`;
  const currentHeightDisplay =
    profileData.heightCm == null
      ? null
      : heightIsImperial
        ? `${roundMeasurementDisplay(Number(profileData.heightCm) / CM_PER_IN)} in`
        : `${roundMeasurementDisplay(Number(profileData.heightCm))} cm`;

  // Scale macros when calories slider changes
  const handleCaloriesChange = useCallback((newCals) => {
    const clamped = Math.max(calMin, Math.min(calMax, Number(newCals)));
    setTargetCals(clamped);
    setMacroGrams((prev) => {
      const currentKcal = totalKcalFromGrams(prev);
      if (currentKcal === 0) return prev;

      const lockedKcal = lockedMacro ? gramsToKcal(lockedMacro, prev[lockedMacro]) : 0;
      const remainingForUnlocked = clamped - lockedKcal;
      const unlockedKcal = currentKcal - lockedKcal;

      const next = { ...prev };
      const unlocked = Object.keys(MACRO_META).filter((m) => m !== lockedMacro);

      if (unlockedKcal === 0) {
        // Distribute equally
        unlocked.forEach((m) => {
          next[m] = kcalToGrams(m, remainingForUnlocked / unlocked.length);
        });
      } else {
        unlocked.forEach((m) => {
          const share = gramsToKcal(m, prev[m]) / unlockedKcal;
          next[m] = Math.max(0, kcalToGrams(m, share * remainingForUnlocked));
        });
      }
      return next;
    });
  }, [calMin, calMax, lockedMacro]);

  // Rebalance when a single macro gram value is changed directly.
  // Guarantees: the total kcal across all macros stays within ±5 kcal of targetCals
  // (and never exceeds it). If the user drags / types a value that would push the
  // total over budget, the dragged macro itself is clamped at the maximum allowed
  // by the remaining (target − locked) calorie budget.
  const handleMacroChange = useCallback((changedMacro, newGrams) => {
    const requested = Math.max(0, Number(newGrams) || 0);
    setMacroGrams((prev) => {
      const target = targetCals || totalKcalFromGrams(prev);
      const lockedKcal = (lockedMacro && lockedMacro !== changedMacro)
        ? gramsToKcal(lockedMacro, prev[lockedMacro])
        : 0;

      // Hard cap: changed macro alone can't exceed (target − locked) kcal
      const maxAllowedKcal = Math.max(0, target - lockedKcal);
      const maxAllowedGrams = Math.floor(maxAllowedKcal / KCAL_PER_G[changedMacro]);
      const grams = Math.min(requested, maxAllowedGrams);

      const next = { ...prev, [changedMacro]: grams };
      const changedKcal = gramsToKcal(changedMacro, grams);
      const remainingKcal = Math.max(0, target - changedKcal - lockedKcal);

      const free = Object.keys(MACRO_META).filter(
        (m) => m !== changedMacro && m !== lockedMacro
      );

      if (free.length === 0) return next;

      if (free.length === 1) {
        next[free[0]] = Math.max(0, kcalToGrams(free[0], remainingKcal));
      } else {
        const freeKcalPrev = free.reduce((s, m) => s + gramsToKcal(m, prev[m]), 0);
        free.forEach((m) => {
          const share = freeKcalPrev > 0
            ? gramsToKcal(m, prev[m]) / freeKcalPrev
            : 1 / free.length;
          next[m] = Math.max(0, kcalToGrams(m, share * remainingKcal));
        });
      }

      // Drift correction: gram rounding causes ±a few kcal slippage.
      // Push any rounding error into the largest free (unlocked, non-changed) macro
      // so the total lands within ±5 kcal of the target.
      const drift = target - totalKcalFromGrams(next);
      if (Math.abs(drift) > 5 && free.length > 0) {
        const adjMacro = free.reduce((biggest, m) => (next[m] > next[biggest] ? m : biggest), free[0]);
        const adjGrams = Math.round(drift / KCAL_PER_G[adjMacro]);
        next[adjMacro] = Math.max(0, next[adjMacro] + adjGrams);
      }
      return next;
    });
  }, [lockedMacro, targetCals]);

  const handleLockToggle = (macro) => {
    setLockedMacro((prev) => (prev === macro ? null : macro));
  };

  /**
   * Single save handler — persists *everything* in one click:
   *  • weight  → POST /api/weight-logs   (via createWeightLog; DB trigger updates chat_users.weight_kg)
   *  • height, Activity_level, base_daily_total_calories,
   *    daily_target_total_calories, macros → POST /api/profile/save-nutritional
   * Both run in parallel; only fields that actually changed are sent.
   */
  const saveNutritionalProfile = async () => {
    if (!profileData.userCode) return;
    setIsSavingNutritional(true);
    setNutritionalSaveStatus('');

    const newWeightKg = toWeightKgFromInput(weightInput);
    const newHeightCm = toHeightCmFromInput(heightInput);

    if (newWeightKg !== null && (Number.isNaN(newWeightKg) || newWeightKg <= 0 || newWeightKg > 500)) {
      setNutritionalSaveStatus('error');
      setIsSavingNutritional(false);
      return;
    }
    if (newHeightCm !== null && (Number.isNaN(newHeightCm) || newHeightCm <= 0 || newHeightCm > 300)) {
      setNutritionalSaveStatus('error');
      setIsSavingNutritional(false);
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
      const tasks = [];

      // 1. Weight → weight_logs (only if changed; always stored as kg)
      const weightChanged = newWeightKg !== null
        && (profileData.weightKg == null || Math.abs(Number(profileData.weightKg) - newWeightKg) > 1e-3);
      if (weightChanged) {
        tasks.push(
          createWeightLog(profileData.userCode, {
            weight_kg: newWeightKg,
            measurement_date: new Date().toISOString().split('T')[0],
          }).then((res) => {
            if (res.error) throw new Error(res.error.message || 'Weight log failed');
          })
        );
      }

      // 2. Everything else → /api/profile/save-nutritional
      const body = {
        userCode:                    profileData.userCode,
        daily_target_total_calories: targetCals,
        macros:                      gramsToDbMacros(macroGrams),
      };
      if (calculatedBmr) body.base_daily_total_calories = calculatedBmr;
      if (activityLevel) body.Activity_level = activityLevel;
      const heightChanged = newHeightCm !== null
        && (profileData.heightCm == null || Math.abs(Number(profileData.heightCm) - newHeightCm) > 1e-3);
      if (heightChanged) body.height_cm = newHeightCm;

      tasks.push(
        fetch(`${apiUrl}/api/profile/save-nutritional`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Nutritional save failed');
        })
      );

      await Promise.all(tasks);
      setNutritionalSaveStatus('success');
      setTimeout(() => setNutritionalSaveStatus(''), 3000);
    } catch (err) {
      console.error('Error saving nutritional profile:', err);
      setNutritionalSaveStatus('error');
    } finally {
      setIsSavingNutritional(false);
    }
  };

  // Compute percentage of total for each macro
  const computeMacroPercents = () => {
    const totalKcal = totalKcalFromGrams(macroGrams) || 1;
    return {
      protein: Math.round((gramsToKcal('protein', macroGrams.protein) / totalKcal) * 100),
      carbs:   Math.round((gramsToKcal('carbs',   macroGrams.carbs)   / totalKcal) * 100),
      fat:     Math.round((gramsToKcal('fat',      macroGrams.fat)     / totalKcal) * 100),
    };
  };

  const { selected: selectedAllergies, otherText: allergiesOtherText } = parseMultiSelectField(
    profileData.foodAllergies,
    ALLERGY_VALUE_SET,
    allergiesOptions
  );
  const { selected: selectedLimitations, otherText: limitationsOtherText } = parseMultiSelectField(
    profileData.foodLimitations,
    LIMITATION_VALUE_SET,
    limitationsOptions
  );

  const toggleMultiValueField = (field, currentSelected, otherText, value, knownSet) => {
    const next = currentSelected.includes(value)
      ? currentSelected.filter((item) => item !== value)
      : [...currentSelected, value];
    const nextOther = next.includes('other') ? otherText : '';
    onInputChange(field, serializeMultiSelectField(next, nextOther, knownSet));
  };

  const handleMultiSelectOtherTextChange = (field, currentSelected, text, knownSet) => {
    onInputChange(field, serializeMultiSelectField(currentSelected, text, knownSet));
  };

  // Helper function to check if a field should be shown (if onboarding not completed, only show non-null fields)
  const shouldShowField = (fieldValue) => {
    if (onboardingCompleted === true) return true; // Show all fields if onboarding is completed
    return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''; // Only show non-null fields if skipped
  };

  // Personal Information fields are always read-only - cannot be edited
  const isReadOnly = true;

  // Handle image selection - show crop modal
  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setImageError(language === 'hebrew' ? 'הקובץ חייב להיות תמונה' : 'File must be an image');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setImageError(language === 'hebrew' ? 'התמונה גדולה מדי (מקסימום 5MB)' : 'Image is too large (max 5MB)');
      return;
    }

    setImageError('');
    
    // Create image preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageToCrop(e.target.result);
      setShowCropModal(true);
      setCropImage({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle mouse events for dragging
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropImage.x, y: e.clientY - cropImage.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setCropImage(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };


  // Crop and upload the image
  const handleCropAndUpload = async () => {
    if (!imageToCrop || !imageRef.current || !containerRef.current) return;

    setUploadingImage(true);
    setImageError('');

    try {
      // Get container and image dimensions
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const containerSize = Math.min(containerRect.width, containerRect.height);
      
      // Create canvas for cropping
      const canvas = document.createElement('canvas');
      canvas.width = 400; // Output size
      canvas.height = 400;
      const ctx = canvas.getContext('2d');

      // Load image
      const img = new Image();
      img.onload = async () => {
        const container = containerRef.current;
        if (!container) return;
        
        const containerRect = container.getBoundingClientRect();
        const containerSize = Math.min(containerRect.width, containerRect.height);
        const cropCircleSize = containerSize * 0.75; // 75% - the visible circle
        const circleRadius = cropCircleSize / 2;
        
        // Calculate how image is displayed with object-fit: cover
        const imgAspect = img.width / img.height;
        let coverScale;
        
        if (imgAspect > 1) {
          // Wider image - height fills container
          coverScale = containerSize / img.height;
        } else {
          // Taller image - width fills container
          coverScale = containerSize / img.width;
        }
        
        // Image element dimensions after object-fit: cover
        const displayedWidth = img.width * coverScale;
        const displayedHeight = img.height * coverScale;
        
        // Offset to center the image (object-fit: cover centers it)
        const offsetX = (containerSize - displayedWidth) / 2;
        const offsetY = (containerSize - displayedHeight) / 2;
        
        // Circle center in container coordinates
        const circleCenterX = containerSize / 2;
        const circleCenterY = containerSize / 2;
        
        // Transform origin is top-left of the image element
        // We need to find what point in the original image corresponds to the circle center
        // Step 1: Convert circle center to coordinates relative to image element (before transform)
        let relativeX = circleCenterX - offsetX;
        let relativeY = circleCenterY - offsetY;
        
        // Step 2: Account for the transform (translate only, no scale)
        // The transform is: translate(x, y)
        // First undo the translation
        relativeX = relativeX - cropImage.x;
        relativeY = relativeY - cropImage.y;
        
        // Step 3: Add back the offset to get position in displayed image
        relativeX = relativeX + offsetX;
        relativeY = relativeY + offsetY;
        
        // Step 4: Convert to original image pixel coordinates
        const imageX = relativeX / coverScale;
        const imageY = relativeY / coverScale;
        
        // Calculate crop size in original image coordinates
        const cropSizeInImage = cropCircleSize / coverScale;
        
        // Calculate crop rectangle centered on the calculated position
        let cropX = imageX - cropSizeInImage / 2;
        let cropY = imageY - cropSizeInImage / 2;
        
        // Ensure crop stays within image bounds
        cropX = Math.max(0, Math.min(cropX, img.width - cropSizeInImage));
        cropY = Math.max(0, Math.min(cropY, img.height - cropSizeInImage));
        const finalCropSize = Math.min(cropSizeInImage, img.width - cropX, img.height - cropY);

        // Draw cropped image
        ctx.drawImage(
          img,
          cropX, cropY, finalCropSize, finalCropSize,
          0, 0, 400, 400
        );

        // Convert to blob
        canvas.toBlob(async (blob) => {
          if (!blob) {
            setImageError(language === 'hebrew' ? 'שגיאה בעיבוד התמונה' : 'Error processing image');
            setUploadingImage(false);
            return;
          }

          const reader = new FileReader();
          const base64Promise = new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          let publicUrl;
          try {
            const imageData = await base64Promise;
            const uploadResult = await apiFetch('/api/profile/upload-image', {
              method: 'POST',
              body: JSON.stringify({
                userId: user.id,
                imageData,
              }),
            });
            publicUrl = uploadResult.publicUrl;
          } catch (uploadError) {
            console.error('Error uploading profile image:', uploadError);
            setImageError(
              uploadError.message ||
                (language === 'hebrew' ? 'שגיאה בהעלאת התמונה' : 'Error uploading image')
            );
            setUploadingImage(false);
            setShowCropModal(false);
            return;
          }

          // Update profile data
          onInputChange('profileImageUrl', publicUrl);
          
          // Save to database
          if (onSaveProfileImageUrl) {
            const saveResult = await onSaveProfileImageUrl(publicUrl);
            if (saveResult.error) {
              console.error('Error saving profile image URL to database:', saveResult.error);
              setImageError(language === 'hebrew' ? 'התמונה הועלתה אך לא נשמרה. אנא נסה לשמור ידנית.' : 'Image uploaded but not saved. Please try saving manually.');
            } else {
              setImageError('');
            }
          } else {
            setImageError('');
          }

          setShowCropModal(false);
          setImageToCrop(null);
          setUploadingImage(false);
        }, 'image/jpeg', 0.9);
      };
      img.src = imageToCrop;
    } catch (error) {
      console.error('Error processing image:', error);
      setImageError(error.message || (language === 'hebrew' ? 'שגיאה בעיבוד התמונה' : 'Error processing image'));
      setUploadingImage(false);
      setShowCropModal(false);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn`}>
      {/* Header Section */}
      <div className="mb-8 sm:mb-10 md:mb-12 animate-slideInUp">
        <div className="flex items-center mb-6 sm:mb-8">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg shadow-indigo-500/25 animate-pulse">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
            </svg>
          </div>
    <div>
            <h2 className="text-white text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">{t.profile.profileTab.title}</h2>
            <p className="text-slate-400 text-sm sm:text-base mt-1">{t.profile.profileTab.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {/* Profile Photo Section */}
        <div className={`${themeClasses.bgCard} border border-emerald-500/20 rounded-2xl p-5 shadow-lg shadow-emerald-500/5`}>
          <div className="flex items-start gap-4">
            {/* Profile Photo Display */}
            <div className="relative flex-shrink-0">
              <div 
                onClick={handleImageClick}
                className={`relative w-24 h-24 rounded-full overflow-hidden cursor-pointer transition-all duration-300 ${
                uploadingImage 
                  ? 'ring-2 ring-gray-400/50' 
                  : 'ring-2 ring-emerald-500/30 hover:ring-emerald-500/50 shadow-lg'
              }`}
              >
                {profileData.profileImageUrl ? (
                  <img 
                    src={profileData.profileImageUrl} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                    <svg className="w-10 h-10 text-white/90" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                    </svg>
                  </div>
                )}
                
                {/* Upload overlay */}
                {uploadingImage && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-sm">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/30 border-t-white"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className={`${themeClasses.textPrimary} text-base font-semibold mb-3`}>
                {language === 'hebrew' ? 'תמונת פרופיל' : 'Profile Photo'}
              </h3>
              
              <button
                onClick={handleImageClick}
                disabled={uploadingImage}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                  uploadingImage 
                    ? 'bg-gray-400/50 cursor-not-allowed text-gray-600' 
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {uploadingImage ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {language === 'hebrew' ? 'מעלה...' : 'Uploading...'}
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {language === 'hebrew' ? 'העלה תמונה' : 'Upload Photo'}
                  </span>
                )}
              </button>

              {/* Info Text */}
              <p className={`${themeClasses.textSecondary} text-xs mt-3`}>
                {language === 'hebrew' 
                  ? 'JPG, PNG, GIF, WebP (מקסימום 5MB)'
                  : 'JPG, PNG, GIF, WebP (max 5MB)'}
              </p>

              {/* Error Message */}
              {imageError && (
                <div className="mt-3 px-3 py-2 bg-red-500/10 dark:bg-red-900/20 border border-red-400/30 dark:border-red-600/30 text-red-600 dark:text-red-400 rounded-lg text-xs">
                  {imageError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Crop Modal */}
        {showCropModal && imageToCrop && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => !uploadingImage && setShowCropModal(false)}>
            <div className={`${themeClasses.bgCard} rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl`} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`${themeClasses.textPrimary} text-xl font-bold`}>
                  {language === 'hebrew' ? 'התאם את התמונה' : 'Adjust Your Photo'}
                </h3>
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setImageToCrop(null);
                  }}
                  className={`${themeClasses.textSecondary} hover:${themeClasses.textPrimary} transition-colors`}
                  disabled={uploadingImage}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <p className={`${themeClasses.textSecondary} text-sm mb-4`}>
                  {language === 'hebrew' 
                    ? 'גרור את התמונה כדי למקם את הפנים במרכז.'
                    : 'Drag the image to position your face in the center.'}
                </p>
                
                <div 
                  ref={containerRef}
                  className="relative w-full aspect-square bg-gray-900 rounded-lg overflow-hidden border-2 border-emerald-500/50"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                  <img
                    ref={imageRef}
                    src={imageToCrop}
                    alt="Crop preview"
                    className="absolute select-none"
                    style={{
                      transform: `translate(${cropImage.x}px, ${cropImage.y}px)`,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none'
                    }}
                    draggable={false}
                  />
                  
                  {/* Crop overlay circle */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3/4 h-3/4 rounded-full border-4 border-emerald-500 shadow-lg ring-4 ring-black/50"></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => {
                    setShowCropModal(false);
                    setImageToCrop(null);
                    setCropImage({ x: 0, y: 0 });
                  }}
                  className={`px-4 py-2 rounded-lg ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:opacity-80 transition-opacity`}
                  disabled={uploadingImage}
                >
                  {language === 'hebrew' ? 'ביטול' : 'Cancel'}
                </button>
                
                <button
                  onClick={handleCropAndUpload}
                  disabled={uploadingImage}
                  className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 ${
                    uploadingImage
                      ? 'bg-gray-400 cursor-not-allowed text-gray-600'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg hover:shadow-xl'
                  }`}
                >
                  {uploadingImage ? (
                    <span className="flex items-center">
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {language === 'hebrew' ? 'מעלה...' : 'Uploading...'}
                    </span>
                  ) : (
                    language === 'hebrew' ? 'שמור והעלה' : 'Save & Upload'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Personal Information */}
        <div className={`${themeClasses.bgCard} border border-indigo-500/30 rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl shadow-indigo-500/10 transform hover:scale-[1.01] transition-all duration-300 animate-slideInUp`} style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center mb-6 sm:mb-8">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg shadow-indigo-500/25">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <h3 className={`${themeClasses.textPrimary} text-lg sm:text-xl font-bold tracking-tight`}>
                {t.profile.profileTab.personalInfo}
              </h3>
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm mt-1`}>
                {language === 'hebrew' ? 'פרטים אישיים - לא ניתן לערוך' : 'Your basic personal details - Read only'}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {shouldShowField(profileData.firstName) && (
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {t.profile.profileTab.firstName} *
              </label>
              <input
                type="text"
                value={profileData.firstName}
                readOnly
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.textPrimary} cursor-not-allowed opacity-80`}
                required
              />
            </div>
            )}

            {shouldShowField(profileData.lastName) && (
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {t.profile.profileTab.lastName} *
              </label>
              <input
                type="text"
                value={profileData.lastName}
                readOnly
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.textPrimary} cursor-not-allowed opacity-80`}
                required
              />
            </div>
            )}

            {shouldShowField(profileData.email) && (
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {t.profile.profileTab.email} *
              </label>
              <input
                type="email"
                value={profileData.email}
                readOnly
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.textPrimary} cursor-not-allowed opacity-80`}
                required
              />
            </div>
            )}

            {shouldShowField(profileData.phone) && (
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {t.profile.profileTab.phone}
              </label>
              <input
                type="tel"
                value={profileData.phone}
                readOnly
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.textPrimary} cursor-not-allowed opacity-80`}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            )}
            </div>
        </div>
        {/* Nutritional Profile */}
        {(() => {
          const percents = computeMacroPercents();
          return (
            <div className={`${themeClasses.bgSecondary} rounded-xl p-3 sm:p-5 md:p-6 border-l-4 border-orange-500 animate-slideInUp`}>
              {/* Section header */}
              <div className="flex items-center mb-4 sm:mb-6 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mr-2.5 sm:mr-3 flex-shrink-0">
                  <span className="text-orange-600 dark:text-orange-400 text-base sm:text-lg">🔥</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className={`${themeClasses.textPrimary} text-base sm:text-lg md:text-xl font-bold leading-tight`}>
                    {isHebrew ? 'פרופיל תזונתי' : 'Nutritional Profile'}
                  </h3>
                  <p className={`${themeClasses.textSecondary} text-[11px] sm:text-sm mt-0.5`}>
                    {isHebrew ? 'התאם יעד קלוריות ומאקרו-נוטריינטים' : 'Adjust your calorie target and macronutrient distribution'}
                  </p>
                </div>
              </div>

              {/* Activity Level — editable, triggers BMR/TDEE recalculation */}
              <div className="mb-4 sm:mb-5">
                <div className="flex items-start sm:items-center justify-between gap-2 mb-2 flex-wrap">
                  <label className={`${themeClasses.textSecondary} block text-sm font-semibold`}>
                    {isHebrew ? 'רמת פעילות' : 'Activity Level'}
                  </label>
                  {autoCalcActive && (
                    <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-orange-500 font-medium animate-pulse">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/>
                      </svg>
                      {isHebrew ? 'מחושב אוטומטית' : 'Auto-calculated'}
                    </span>
                  )}
                </div>
                <select
                  value={activityLevel}
                  onChange={(e) => setActivityLevel(e.target.value)}
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 text-base sm:text-sm transition-all ${themeClasses.inputBg} ${themeClasses.textPrimary} focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-800`}
                >
                  <option value="">{isHebrew ? 'בחר רמת פעילות' : 'Select activity level'}</option>
                  {ACTIVITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {isHebrew ? opt.labelHe : opt.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Weight & Height (editable) */}
              <div className="mb-4 sm:mb-5 rounded-xl border border-orange-400/20 bg-orange-500/5 p-3 sm:p-4">
                <div className="flex items-start sm:items-center justify-between gap-2 mb-3 flex-wrap">
                  <h4 className={`${themeClasses.textPrimary} text-sm font-semibold`}>
                    {isHebrew ? 'מדידות גוף' : 'Body Measurements'}
                  </h4>
                  <span className={`text-[11px] sm:text-xs ${themeClasses.textSecondary}`}>
                    {isHebrew ? 'משקל יישמר כיומן חדש' : 'Weight saved as a new log entry'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {/* Weight input (always kg in UI; stored as kg) */}
                  <div>
                    <label className={`${themeClasses.textSecondary} block text-xs font-semibold mb-1.5`}>
                      {isHebrew ? 'משקל נוכחי (ק"ג)' : 'Current Weight (kg)'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={weightInputMin}
                        max={weightInputMax}
                        step={0.1}
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value)}
                        placeholder={isHebrew ? 'לדוגמה 72.5' : 'e.g. 72.5'}
                        className={`flex-1 min-w-0 px-3 py-2.5 rounded-lg border-2 transition-all font-semibold text-base sm:text-sm ${themeClasses.inputBg} ${themeClasses.textPrimary} focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-800`}
                      />
                      <span className={`text-xs ${themeClasses.textSecondary} whitespace-nowrap`}>kg</span>
                    </div>
                    {currentWeightDisplay != null && (
                      <p className={`mt-1 text-[11px] sm:text-xs ${themeClasses.textSecondary} opacity-70`}>
                        {isHebrew ? 'נוכחי: ' : 'Current: '}
                        <span className="font-medium">{currentWeightDisplay}</span>
                      </p>
                    )}
                  </div>

                  {/* Height input */}
                  <div>
                    <label className={`${themeClasses.textSecondary} block text-xs font-semibold mb-1.5`}>
                      {isHebrew
                        ? (heightIsImperial ? 'גובה (אינץ׳)' : 'גובה (ס"מ)')
                        : (heightIsImperial ? 'Height (in)' : 'Height (cm)')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={heightInputMin}
                        max={heightInputMax}
                        step={0.1}
                        value={heightInput}
                        onChange={(e) => setHeightInput(e.target.value)}
                        placeholder={
                          isHebrew
                            ? (heightIsImperial ? 'לדוגמה 69' : 'לדוגמה 175')
                            : (heightIsImperial ? 'e.g. 69' : 'e.g. 175')
                        }
                        className={`flex-1 min-w-0 px-3 py-2.5 rounded-lg border-2 transition-all font-semibold text-base sm:text-sm ${themeClasses.inputBg} ${themeClasses.textPrimary} focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-800`}
                      />
                      <span className={`text-xs ${themeClasses.textSecondary} whitespace-nowrap`}>
                        {heightIsImperial ? 'in' : 'cm'}
                      </span>
                    </div>
                    {currentHeightDisplay != null && (
                      <p className={`mt-1 text-[11px] sm:text-xs ${themeClasses.textSecondary} opacity-70`}>
                        {isHebrew ? 'נוכחי: ' : 'Current: '}
                        <span className="font-medium">{currentHeightDisplay}</span>
                      </p>
                    )}
                  </div>
                </div>

                <p className={`mt-3 text-[11px] sm:text-xs ${themeClasses.textSecondary} opacity-70 leading-relaxed`}>
                  {isHebrew
                    ? 'השינויים יישמרו בלחיצה על "שמור פרופיל תזונתי"'
                    : 'Changes are saved when you click "Save Nutritional Profile"'}
                </p>
              </div>

              {/* BMR (calculated, read-only display) */}
              {calculatedBmr !== null && (
                <div className="mb-4 sm:mb-5">
                  <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                    {isHebrew ? 'קצב חילוף חומרים בסיסי (BMR)' : 'Basal Metabolic Rate (BMR)'}
                    <span className={`block sm:inline sm:ml-2 text-[11px] sm:text-xs font-normal ${themeClasses.textSecondary} opacity-70 mt-0.5 sm:mt-0`}>
                      {isHebrew ? '— מחושב אוטומטית, לקריאה בלבד' : '— auto-calculated, read only'}
                    </span>
                  </label>
                  <div className={`flex items-center flex-wrap gap-x-2 sm:gap-x-3 gap-y-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 ${themeClasses.inputBg} opacity-80 cursor-not-allowed`}>
                    <svg className="w-4 h-4 text-orange-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                    </svg>
                    <span className={`${themeClasses.textPrimary} font-semibold text-sm sm:text-base`}>{calculatedBmr.toLocaleString()}</span>
                    <span className={`${themeClasses.textSecondary} text-xs sm:text-sm`}>kcal / day</span>
                    {profileData.gender && profileData.age && (
                      <span className={`w-full sm:w-auto sm:ml-auto text-[10px] sm:text-xs ${themeClasses.textSecondary} opacity-60 truncate`}>
                        Harris-Benedict · {profileData.gender} · {isHebrew ? 'גיל' : 'age'} {profileData.age}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Target Calories (adjustable: ±30% of original loaded target) */}
              <div className="mb-5 sm:mb-6">
                <div className="flex items-start sm:items-center justify-between gap-2 mb-2 flex-wrap">
                  <label className={`${themeClasses.textSecondary} text-sm font-semibold`}>
                    {isHebrew ? 'יעד קלורי יומי' : 'Daily Calorie Target'}
                  </label>
                  {calAnchor && (
                    <span className={`text-[11px] sm:text-xs ${themeClasses.textSecondary} opacity-70 whitespace-nowrap`}>
                      {isHebrew
                        ? `טווח ±30%: ${calMin.toLocaleString()}–${calMax.toLocaleString()} קל'`
                        : `±30% range: ${calMin.toLocaleString()}–${calMax.toLocaleString()} kcal`}
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {calAnchor && (
                    <input
                      type="range"
                      min={calMin}
                      max={calMax}
                      step={10}
                      value={targetCals ?? calAnchor}
                      onChange={(e) => handleCaloriesChange(e.target.value)}
                      className="w-full sm:flex-1 accent-orange-500 cursor-pointer h-2"
                      aria-label={isHebrew ? 'יעד קלורי יומי' : 'Daily Calorie Target'}
                    />
                  )}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={calAnchor ? calMin : 0}
                      max={calAnchor ? calMax : undefined}
                      step={10}
                      value={targetCals ?? ''}
                      placeholder={isHebrew ? 'יעד' : 'Target'}
                      onChange={(e) => handleCaloriesChange(e.target.value)}
                      className={`w-24 px-3 py-2.5 rounded-lg border-2 text-center font-bold text-base sm:text-sm text-orange-500 transition-all ${themeClasses.inputBg} focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-800`}
                    />
                    <span className={`text-xs ${themeClasses.textSecondary} whitespace-nowrap`}>kcal</span>
                  </div>
                </div>

                {/* Progress bar with original-target marker */}
                {calAnchor && targetCals !== null && (
                  <div className="relative mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-200"
                      style={{ width: `${Math.min(100, Math.max(0, ((targetCals - calMin) / (calMax - calMin)) * 100))}%` }}
                    />
                    {originalTargetCals !== null && (
                      <div
                        title={isHebrew ? `יעד מקורי: ${originalTargetCals} קל'` : `Original target: ${originalTargetCals} kcal`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-3 bg-slate-500 dark:bg-slate-300 rounded"
                        style={{ left: `${Math.min(100, Math.max(0, ((originalTargetCals - calMin) / (calMax - calMin)) * 100))}%` }}
                      />
                    )}
                  </div>
                )}

                {originalTargetCals !== null && targetCals !== null && targetCals !== originalTargetCals && (
                  <p className={`mt-2 text-[11px] sm:text-xs ${themeClasses.textSecondary} flex flex-wrap items-center gap-x-2`}>
                    <span>
                      {isHebrew ? 'מקורי: ' : 'Original: '}
                      <span className="font-semibold">{originalTargetCals.toLocaleString()} kcal</span>
                    </span>
                    <span className={`font-semibold ${targetCals > originalTargetCals ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {targetCals > originalTargetCals ? '+' : ''}
                      {Math.round(((targetCals - originalTargetCals) / originalTargetCals) * 100)}%
                    </span>
                  </p>
                )}
              </div>

              {/* Macro Distribution */}
              {Object.entries(MACRO_META).map(([macro, meta]) => {
                const colorMap = {
                  blue:  { ring: 'focus:ring-blue-200 dark:focus:ring-blue-800',  border: 'focus:border-blue-500',  badge: 'bg-blue-500/15 text-blue-500 border-blue-500/30',  lock: 'bg-blue-500 text-white',  accent: 'accent-blue-500',  barFrom: 'from-blue-400',  barTo: 'to-blue-600' },
                  amber: { ring: 'focus:ring-amber-200 dark:focus:ring-amber-800', border: 'focus:border-amber-500', badge: 'bg-amber-500/15 text-amber-500 border-amber-500/30', lock: 'bg-amber-500 text-white', accent: 'accent-amber-500', barFrom: 'from-amber-400', barTo: 'to-amber-600' },
                  rose:  { ring: 'focus:ring-rose-200 dark:focus:ring-rose-800',   border: 'focus:border-rose-500',   badge: 'bg-rose-500/15 text-rose-500 border-rose-500/30',   lock: 'bg-rose-500 text-white',  accent: 'accent-rose-500',  barFrom: 'from-rose-400',  barTo: 'to-rose-600' },
                };
                const c = colorMap[meta.color];
                const isLocked = lockedMacro === macro;
                const pct = percents[macro];
                const kcal = gramsToKcal(macro, macroGrams[macro]);

                // Hard cap: this macro can never consume more kcal than
                // (target − lockedMacroKcal). Floor so even at max grams the
                // total cannot overshoot the daily target.
                const lockedKcal = (lockedMacro && lockedMacro !== macro)
                  ? gramsToKcal(lockedMacro, macroGrams[lockedMacro])
                  : 0;
                const remainingKcal = Math.max(0, (targetCals || totalKcalFromGrams(macroGrams)) - lockedKcal);
                const sliderMax = Math.floor(remainingKcal / KCAL_PER_G[macro]);

                return (
                  <div key={macro} className={`mb-3 sm:mb-4 p-3 rounded-xl border ${isLocked ? 'border-orange-400/50 bg-orange-500/5' : `border-slate-200/50 dark:border-slate-700/50`}`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 min-w-0">
                        <span className={`${themeClasses.textPrimary} text-sm font-semibold`}>
                          {isHebrew ? meta.labelHe : meta.label}
                        </span>
                        <span className={`text-[11px] sm:text-xs px-2 py-0.5 rounded-full border font-medium ${c.badge}`}>
                          {pct}%
                        </span>
                        <span className={`text-[11px] sm:text-xs ${themeClasses.textSecondary} whitespace-nowrap`}>{kcal} kcal</span>
                      </div>

                      {/* Lock toggle */}
                      <button
                        type="button"
                        title={isLocked
                          ? (isHebrew ? 'שחרר נעילה' : 'Unlock')
                          : (isHebrew ? 'נעל ערך זה' : 'Lock this value')}
                        aria-label={isLocked
                          ? (isHebrew ? 'שחרר נעילה' : 'Unlock')
                          : (isHebrew ? 'נעל ערך זה' : 'Lock this value')}
                        onClick={() => handleLockToggle(macro)}
                        className={`flex-shrink-0 h-9 w-9 sm:h-8 sm:w-8 rounded-lg transition-all duration-200 flex items-center justify-center ${
                          isLocked
                            ? `${c.lock} shadow-sm`
                            : `${themeClasses.bgCard} border border-slate-300/50 dark:border-slate-600/50 ${themeClasses.textSecondary} hover:border-orange-400/50`
                        }`}
                      >
                        {isLocked ? (
                          <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z"/>
                          </svg>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={sliderMax}
                        step={1}
                        value={Math.min(macroGrams[macro], sliderMax)}
                        onChange={(e) => handleMacroChange(macro, e.target.value)}
                        disabled={isLocked}
                        aria-label={`${isHebrew ? meta.labelHe : meta.label} (g)`}
                        className={`w-20 sm:w-24 px-2 sm:px-3 py-2 rounded-lg border-2 text-center font-semibold text-base sm:text-sm transition-all ${themeClasses.inputBg} ${themeClasses.textPrimary} ${c.ring} ${c.border} ${isLocked ? 'cursor-not-allowed opacity-60' : ''}`}
                      />
                      <span className={`text-[11px] sm:text-xs ${themeClasses.textSecondary}`}>g</span>

                      {/* Interactive slider — drag to change grams */}
                      <input
                        type="range"
                        min={0}
                        max={sliderMax}
                        step={1}
                        value={Math.min(macroGrams[macro], sliderMax)}
                        onChange={(e) => handleMacroChange(macro, e.target.value)}
                        disabled={isLocked}
                        aria-label={`${isHebrew ? meta.labelHe : meta.label} slider`}
                        className={`flex-1 min-w-0 h-2 cursor-pointer ${c.accent} ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Macro calorie total vs target */}
              {targetCals !== null && (
                <div className={`mt-3 sm:mt-4 flex items-center justify-between gap-2 flex-wrap px-3 py-2 rounded-lg ${themeClasses.bgCard} border border-slate-200/50 dark:border-slate-700/50`}>
                  <span className={`text-[11px] sm:text-sm ${themeClasses.textSecondary}`}>
                    {isHebrew ? 'סה"כ קלוריות ממאקרו:' : 'Total kcal from macros:'}
                  </span>
                  <span className={`text-[11px] sm:text-sm font-bold whitespace-nowrap ${
                    Math.abs(totalKcalFromGrams(macroGrams) - targetCals) < 20
                      ? 'text-emerald-500'
                      : 'text-orange-500'
                  }`}>
                    {totalKcalFromGrams(macroGrams).toLocaleString()} / {targetCals.toLocaleString()} kcal
                  </span>
                </div>
              )}

              {/* Save nutritional profile */}
              <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <button
                  onClick={saveNutritionalProfile}
                  disabled={isSavingNutritional}
                  className={`w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                    isSavingNutritional
                      ? 'bg-gray-400/50 cursor-not-allowed text-gray-500'
                      : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md hover:shadow-lg active:scale-[0.98]'
                  }`}
                >
                  {isSavingNutritional ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      {isHebrew ? 'שומר...' : 'Saving...'}
                    </span>
                  ) : (
                    isHebrew ? 'שמור פרופיל תזונתי' : 'Save Nutritional Profile'
                  )}
                </button>

                {nutritionalSaveStatus === 'success' && (
                  <span className="flex items-center justify-center sm:justify-start gap-1.5 text-sm text-emerald-500 font-medium">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                    {isHebrew ? 'נשמר בהצלחה' : 'Saved successfully'}
                  </span>
                )}
                {nutritionalSaveStatus === 'error' && (
                  <span className="text-sm text-red-500 font-medium text-center sm:text-left">
                    {isHebrew ? 'שגיאה בשמירה' : 'Failed to save'}
                  </span>
                )}
              </div>
            </div>
          );
        })()}


        {/* Location Information */}
        <div className={`${themeClasses.bgSecondary} rounded-xl p-4 sm:p-6 border-l-4 border-purple-500`}>
          <div className="flex items-center mb-4 sm:mb-6">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mr-3">
              <span className="text-purple-600 dark:text-purple-400 text-base sm:text-lg">📍</span>
            </div>
            <div>
              <h3 className={`${themeClasses.textPrimary} text-lg sm:text-xl font-bold`}>
                {language === 'hebrew' ? 'מידע מיקום' : 'Location Information'}
              </h3>
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm`}>
                {language === 'hebrew' ? 'עזרו לנו לספק המלצות מותאמות למיקום' : 'Help us provide location-specific recommendations'}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {language === 'hebrew' ? 'אזור' : 'Region'}
              </label>
              <select
                value={profileData.region}
                onChange={(e) => onInputChange('region', e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800`}
              >
                <option value="">{language === 'hebrew' ? 'בחר אזור' : 'Select Region'}</option>
                <option value="israel">{language === 'hebrew' ? 'ישראל' : 'Israel'}</option>
                <option value="japan">{language === 'hebrew' ? 'יפן' : 'Japan'}</option>
                <option value="korea">{language === 'hebrew' ? 'קוריאה' : 'Korea'}</option>
                <option value="greater_china">{language === 'hebrew' ? 'סין/הונג קונג/טאיוואן' : 'Greater China (China/Hong Kong/Taiwan)'}</option>
                <option value="india_south_asia">{language === 'hebrew' ? 'הודו / דרום אסיה' : 'India / South Asia'}</option>
                <option value="southeast_asia">{language === 'hebrew' ? 'דרום־מזרח אסיה' : 'Southeast Asia'}</option>
                <option value="indonesia_malaysia">{language === 'hebrew' ? 'אינדונזיה/מלזיה' : 'Indonesia/Malaysia'}</option>
                <option value="turkey">{language === 'hebrew' ? 'טורקיה' : 'Turkey'}</option>
                <option value="persian_iranian">{language === 'hebrew' ? 'איראן/פרס' : 'Persian/Iranian'}</option>
                <option value="gulf_arabia">{language === 'hebrew' ? 'העולם הערבי-מפרץ' : 'Gulf Arabia'}</option>
                <option value="north_africa">{language === 'hebrew' ? 'צפון אפריקה' : 'North Africa'}</option>
                <option value="east_africa">{language === 'hebrew' ? 'אפריקה מזרחית' : 'East Africa'}</option>
                <option value="europe_mediterranean">{language === 'hebrew' ? 'אירופה - ים תיכוני' : 'Europe - Mediterranean'}</option>
                <option value="europe_west">{language === 'hebrew' ? 'אירופה - מרכז/מערב' : 'Europe - Central/West'}</option>
                <option value="europe_east_russian">{language === 'hebrew' ? 'אירופה - מזרח/רוסי' : 'Europe - East/Russian'}</option>
                <option value="mexico">{language === 'hebrew' ? 'אמריקה לטינית - מקסיקו' : 'Latin America - Mexico'}</option>
                <option value="latam_south_america">{language === 'hebrew' ? 'אמריקה לטינית - דרום אמריקה' : 'Latin America - South America'}</option>
                <option value="caribbean">{language === 'hebrew' ? 'קריביים' : 'Caribbean'}</option>
                <option value="north_america">{language === 'hebrew' ? 'צפון אמריקה' : 'North America'}</option>
                <option value="other">{language === 'hebrew' ? 'אחר' : 'Other'}</option>
              </select>
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {language === 'hebrew' ? 'עיר' : 'City'}
              </label>
              <input
                type="text"
                value={profileData.city}
                onChange={(e) => onInputChange('city', e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800`}
                placeholder={language === 'hebrew' ? 'תל אביב' : 'Tel Aviv'}
              />
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
                {language === 'hebrew' ? 'אזור זמן' : 'Timezone'}
              </label>
              <select
                value={profileData.timezone}
                onChange={(e) => onInputChange('timezone', e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800`}
              >
                <option value="">{language === 'hebrew' ? 'בחר אזור זמן' : 'Select Timezone'}</option>
                <optgroup label={language === 'hebrew' ? 'ישראל והמזרח התיכון' : 'Israel & Middle East'}>
                  <option value="Asia/Jerusalem">{language === 'hebrew' ? 'ירושלים (ישראל)' : 'Asia/Jerusalem (Israel)'}</option>
                  <option value="Asia/Dubai">{language === 'hebrew' ? 'דובאי (איחוד האמירויות)' : 'Asia/Dubai (UAE)'}</option>
                  <option value="Asia/Riyadh">{language === 'hebrew' ? 'ריאד (ערב הסעודית)' : 'Asia/Riyadh (Saudi Arabia)'}</option>
                  <option value="Asia/Tehran">{language === 'hebrew' ? 'טהרן (איראן)' : 'Asia/Tehran (Iran)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'אירופה' : 'Europe'}>
                  <option value="Europe/London">{language === 'hebrew' ? 'לונדון (GMT)' : 'Europe/London (GMT)'}</option>
                  <option value="Europe/Paris">{language === 'hebrew' ? 'פריז (CET)' : 'Europe/Paris (CET)'}</option>
                  <option value="Europe/Berlin">{language === 'hebrew' ? 'ברלין (CET)' : 'Europe/Berlin (CET)'}</option>
                  <option value="Europe/Rome">{language === 'hebrew' ? 'רומא (CET)' : 'Europe/Rome (CET)'}</option>
                  <option value="Europe/Madrid">{language === 'hebrew' ? 'מדריד (CET)' : 'Europe/Madrid (CET)'}</option>
                  <option value="Europe/Amsterdam">{language === 'hebrew' ? 'אמסטרדם (CET)' : 'Europe/Amsterdam (CET)'}</option>
                  <option value="Europe/Moscow">{language === 'hebrew' ? 'מוסקבה (MSK)' : 'Europe/Moscow (MSK)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'צפון אמריקה' : 'North America'}>
                  <option value="America/New_York">{language === 'hebrew' ? 'ניו יורק (EST)' : 'America/New_York (EST)'}</option>
                  <option value="America/Chicago">{language === 'hebrew' ? 'שיקגו (CST)' : 'America/Chicago (CST)'}</option>
                  <option value="America/Denver">{language === 'hebrew' ? 'דנבר (MST)' : 'America/Denver (MST)'}</option>
                  <option value="America/Los_Angeles">{language === 'hebrew' ? 'לוס אנג\'לס (PST)' : 'America/Los_Angeles (PST)'}</option>
                  <option value="America/Toronto">{language === 'hebrew' ? 'טורונטו (EST)' : 'America/Toronto (EST)'}</option>
                  <option value="America/Vancouver">{language === 'hebrew' ? 'ונקובר (PST)' : 'America/Vancouver (PST)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'אסיה' : 'Asia'}>
                  <option value="Asia/Tokyo">{language === 'hebrew' ? 'טוקיו (JST)' : 'Asia/Tokyo (JST)'}</option>
                  <option value="Asia/Shanghai">{language === 'hebrew' ? 'שנחאי (CST)' : 'Asia/Shanghai (CST)'}</option>
                  <option value="Asia/Hong_Kong">{language === 'hebrew' ? 'הונג קונג (HKT)' : 'Asia/Hong_Kong (HKT)'}</option>
                  <option value="Asia/Singapore">{language === 'hebrew' ? 'סינגפור (SGT)' : 'Asia/Singapore (SGT)'}</option>
                  <option value="Asia/Kolkata">{language === 'hebrew' ? 'קולקטה (IST)' : 'Asia/Kolkata (IST)'}</option>
                  <option value="Asia/Seoul">{language === 'hebrew' ? 'סיאול (KST)' : 'Asia/Seoul (KST)'}</option>
                  <option value="Asia/Bangkok">{language === 'hebrew' ? 'בנגקוק (ICT)' : 'Asia/Bangkok (ICT)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'אוקיאניה' : 'Oceania'}>
                  <option value="Australia/Sydney">{language === 'hebrew' ? 'סידני (AEST)' : 'Australia/Sydney (AEST)'}</option>
                  <option value="Australia/Melbourne">{language === 'hebrew' ? 'מלבורן (AEST)' : 'Australia/Melbourne (AEST)'}</option>
                  <option value="Australia/Perth">{language === 'hebrew' ? 'פרת (AWST)' : 'Australia/Perth (AWST)'}</option>
                  <option value="Pacific/Auckland">{language === 'hebrew' ? 'אוקלנד (NZST)' : 'Pacific/Auckland (NZST)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'דרום אמריקה' : 'South America'}>
                  <option value="America/Sao_Paulo">{language === 'hebrew' ? 'סאו פאולו (BRT)' : 'America/Sao_Paulo (BRT)'}</option>
                  <option value="America/Buenos_Aires">{language === 'hebrew' ? 'בואנוס איירס (ART)' : 'America/Buenos_Aires (ART)'}</option>
                  <option value="America/Lima">{language === 'hebrew' ? 'לימה (PET)' : 'America/Lima (PET)'}</option>
                </optgroup>
                <optgroup label={language === 'hebrew' ? 'אפריקה' : 'Africa'}>
                  <option value="Africa/Cairo">{language === 'hebrew' ? 'קהיר (EET)' : 'Africa/Cairo (EET)'}</option>
                  <option value="Africa/Johannesburg">{language === 'hebrew' ? 'יוהנסבורג (SAST)' : 'Africa/Johannesburg (SAST)'}</option>
                  <option value="Africa/Lagos">{language === 'hebrew' ? 'לאגוס (WAT)' : 'Africa/Lagos (WAT)'}</option>
                </optgroup>
              </select>
            </div>
          </div>

          <div className="mt-6">
            <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-2`}>
              {language === 'hebrew' ? 'חברה' : 'Company'}
            </label>
            {companyError && (
              <p className="text-red-500 text-xs mb-2">
                {companyError}
              </p>
            )}
            <select
              value={profileData.companyId || ''}
              onChange={(e) => onInputChange('companyId', e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800`}
              disabled={true}
              readOnly={true}
            >
              <option value="">{language === 'hebrew' ? 'ללא חברה' : 'No company'}</option>
              {companyOptions.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            {isLoadingCompanies && (
              <p className={`${themeClasses.textSecondary} text-xs mt-2`}>
                {language === 'hebrew' ? 'טוען רשימת חברות...' : 'Loading companies...'}
              </p>
            )}
            {!isLoadingCompanies && companyOptions.length === 0 && !companyError && (
              <p className={`${themeClasses.textSecondary} text-xs mt-2`}>
                {language === 'hebrew' ? 'לא נמצאו חברות זמינות' : 'No companies available'}
              </p>
            )}
          </div>

        </div>

        {/* Health Information */}
        <div className={`${themeClasses.bgSecondary} rounded-xl p-4 sm:p-6 border-l-4 border-emerald-500`}>
          <div className="flex items-center mb-4 sm:mb-6">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-100 dark:bg-emerald-900 rounded-lg flex items-center justify-center mr-3">
              <span className="text-emerald-600 dark:text-emerald-400 text-base sm:text-lg">🏥</span>
            </div>
            <div>
              <h3 className={`${themeClasses.textPrimary} text-lg sm:text-xl font-bold`}>
                {language === 'hebrew' ? 'מידע בריאותי' : 'Health Information'}
              </h3>
              <p className={`${themeClasses.textSecondary} text-xs sm:text-sm`}>
                {language === 'hebrew' ? 'אופציונלי - ספקו פרטי בריאות אם רלוונטי' : 'Optional - provide your health details if relevant'}
              </p>
            </div>
          </div>
          
          <div className="space-y-4 sm:space-y-6">
            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-3`}>
                {language === 'hebrew' ? 'העדפות תזונתיות' : 'Dietary Preferences'}
              </label>
              <textarea
                value={profileData.dietaryPreferences}
                onChange={(e) => onInputChange('dietaryPreferences', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
                placeholder={language === 'hebrew' ? 'לדוגמה: צמחוני, טבעוני, ללא גלוטן, דיאטה ים תיכונית...' : 'e.g., Vegetarian, Vegan, Gluten-free, Mediterranean diet...'}
              />
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-1`}>
                {language === 'hebrew' ? 'אלרגיות למזון' : 'Food Allergies'}
              </label>
              <p className={`${themeClasses.textMuted} text-xs mb-3`}>
                {isHebrew ? 'ניתן לבחור מספר אפשרויות' : 'Select all that apply'}
              </p>
              <div
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-200 dark:focus-within:ring-emerald-800`}
              >
                <div className="flex flex-wrap gap-2">
                  {allergiesOptionsWithOther.map((option) => {
                    const isSelected = selectedAllergies.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected}
                        onClick={() =>
                          toggleMultiValueField(
                            'foodAllergies',
                            selectedAllergies,
                            allergiesOtherText,
                            option.value,
                            ALLERGY_VALUE_SET
                          )
                        }
                        className={`
                          group inline-flex items-center gap-2 min-h-[38px] px-3 py-1.5 rounded-full text-sm font-medium
                          border-2 transition-all
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:focus-visible:ring-offset-slate-900
                          ${isHebrew ? 'flex-row-reverse' : ''}
                          ${
                            isSelected
                              ? `border-emerald-500 bg-emerald-500/10 ${themeClasses.textPrimary}`
                              : `border-slate-300/60 dark:border-slate-600/80 bg-transparent ${themeClasses.textPrimary} hover:border-emerald-500/50`
                          }
                        `}
                      >
                        <span
                          className={`
                            flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors
                            ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-500 text-white dark:border-emerald-400'
                                : 'border-slate-400/70 dark:border-slate-500 bg-transparent'
                            }
                          `}
                          aria-hidden
                        >
                          {isSelected ? (
                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : null}
                        </span>
                        <span className="whitespace-nowrap">{isHebrew ? option.labelHe : option.labelEn}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedAllergies.includes('other') && (
                  <div className="mt-3">
                    <label className={`${themeClasses.textMuted} block text-xs font-medium mb-2`}>
                      {isHebrew ? 'פרטו (אחר)' : 'Please specify (other)'}
                    </label>
                    <textarea
                      value={allergiesOtherText}
                      onChange={(e) =>
                        handleMultiSelectOtherTextChange(
                          'foodAllergies',
                          selectedAllergies,
                          e.target.value,
                          ALLERGY_VALUE_SET
                        )
                      }
                      rows={2}
                      className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
                      placeholder={
                        isHebrew ? 'תארו אלרגיות נוספות...' : 'Describe any additional allergies...'
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-1`}>
                {language === 'hebrew' ? 'מגבלות תזונתיות' : 'Food Limitations'}
              </label>
              <p className={`${themeClasses.textMuted} text-xs mb-3`}>
                {isHebrew ? 'ניתן לבחור מספר אפשרויות' : 'Select all that apply'}
              </p>
              <div
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-200 dark:focus-within:ring-emerald-800`}
              >
                <div className="flex flex-wrap gap-2">
                  {limitationsOptionsWithOther.map((option) => {
                    const isSelected = selectedLimitations.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected}
                        onClick={() =>
                          toggleMultiValueField(
                            'foodLimitations',
                            selectedLimitations,
                            limitationsOtherText,
                            option.value,
                            LIMITATION_VALUE_SET
                          )
                        }
                        className={`
                          group inline-flex items-center gap-2 min-h-[38px] px-3 py-1.5 rounded-full text-sm font-medium
                          border-2 transition-all
                          focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:focus-visible:ring-offset-slate-900
                          ${isHebrew ? 'flex-row-reverse' : ''}
                          ${
                            isSelected
                              ? `border-emerald-500 bg-emerald-500/10 ${themeClasses.textPrimary}`
                              : `border-slate-300/60 dark:border-slate-600/80 bg-transparent ${themeClasses.textPrimary} hover:border-emerald-500/50`
                          }
                        `}
                      >
                        <span
                          className={`
                            flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors
                            ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-500 text-white dark:border-emerald-400'
                                : 'border-slate-400/70 dark:border-slate-500 bg-transparent'
                            }
                          `}
                          aria-hidden
                        >
                          {isSelected ? (
                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : null}
                        </span>
                        <span className="whitespace-nowrap">{isHebrew ? option.labelHe : option.labelEn}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedLimitations.includes('other') && (
                  <div className="mt-3">
                    <label className={`${themeClasses.textMuted} block text-xs font-medium mb-2`}>
                      {isHebrew ? 'פרטו (אחר)' : 'Please specify (other)'}
                    </label>
                    <textarea
                      value={limitationsOtherText}
                      onChange={(e) =>
                        handleMultiSelectOtherTextChange(
                          'foodLimitations',
                          selectedLimitations,
                          e.target.value,
                          LIMITATION_VALUE_SET
                        )
                      }
                      rows={2}
                      className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
                      placeholder={
                        isHebrew ? 'תארו מגבלות נוספות...' : 'Describe any additional limitations...'
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className={`${themeClasses.textSecondary} block text-sm font-semibold mb-3`}>
                {language === 'hebrew' ? 'מצבים רפואיים' : 'Medical Conditions'}
              </label>
              <textarea
                value={profileData.medicalConditions}
                onChange={(e) => onInputChange('medicalConditions', e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${themeClasses.inputBg} ${themeClasses.inputFocus} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
                placeholder={language === 'hebrew' ? 'לדוגמה: סוכרת, יתר לחץ דם, בעיות לב...' : 'e.g., Diabetes, Hypertension, Heart condition...'}
              />
            </div>
          </div>
        </div>

      </div>

      {/* Save Button */}
      <div className="mt-6 sm:mt-8 flex justify-end">
        <button
          onClick={onSave}
          disabled={isSaving}
          className={`w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg transition-all duration-200 transform hover:scale-105 ${
            isSaving
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg hover:shadow-xl'
          } text-white`}
        >
          {isSaving ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              {t.profile.profileTab.saving}
            </div>
          ) : (
            <div className="flex items-center">
              <span className="mr-2">💾</span>
              {t.profile.profileTab.saveChanges}
            </div>
          )}
        </button>
      </div>

      {/* Save Status */}
      {saveStatus && (
        <div className={`mt-6 p-4 rounded-xl border-l-4 ${
          saveStatus === 'success' 
            ? 'bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-500' 
            : 'bg-red-50 border-red-400 dark:bg-red-900/20 dark:border-red-500'
        }`}>
          <div className="flex items-center">
            <span className="text-2xl mr-3">
              {saveStatus === 'success' ? '✅' : '❌'}
            </span>
            <p className={`text-sm font-medium ${
              saveStatus === 'success' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
            }`}>
              {saveStatus === 'success' ? t.profile.profileTab.saved : (errorMessage || 'Error saving profile')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileTab;
