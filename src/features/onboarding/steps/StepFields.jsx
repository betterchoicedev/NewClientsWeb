import React, { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useOnboardingStore } from '../onboarding.store';
import { classifyActivity } from '../api/onboardingApi';
import SearchableSelect from '../components/SearchableSelect';
import CitySearchSelect from '../components/CitySearchSelect';
import DateOfBirthSelect from '../components/DateOfBirthSelect';
import { regionFromCountry } from '../countryOptions';
import { applyPreferredLanguageToApp, isOnboardingHebrew } from '../onboardingLocale';
import CaloriesMacrosFields from '../components/CaloriesMacrosFields';
import MealPlanningFields from '../components/MealPlanningFields';
import { GlassSecondaryButton } from '../components/OnboardingPanel';
import {
  glassChipClass,
  glassInputClass,
  glassOptionBtnClass,
  glassSelectClass,
} from '../components/glassStyles';
import { isValidPhoneDigits, sanitizePhoneDigits } from '../phoneUtils';

const inputClass = glassInputClass;
const optionBtn = glassOptionBtnClass;
const chipBtn = glassChipClass;

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'he', label: 'עברית' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ar', label: 'العربية' },
  { value: 'ru', label: 'Русский' },
  { value: 'pt', label: 'Português' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: '日本語' },
];

const GOALS = [
  { value: 'lose', en: 'Lose weight', he: 'ירידה במשקל' },
  { value: 'cut', en: 'Lose fat, keep muscle', he: 'ירידה בשומן תוך שמירה על שריר' },
  { value: 'maintain', en: 'Maintain weight', he: 'שמירה על משקל' },
  { value: 'gain', en: 'Gain weight', he: 'עלייה במשקל' },
  { value: 'muscle', en: 'Build muscle', he: 'בניית שרירים' },
  { value: 'improve_performance', en: 'Improve performance', he: 'שיפור ביצועים' },
  { value: 'improve_health', en: 'Improve health', he: 'שיפור בריאות' },
];

const ALLERGIES = [
  { value: 'peanuts', en: 'Peanuts', he: 'בוטנים' },
  { value: 'tree_nuts', en: 'Tree Nuts', he: 'אגוזי עץ' },
  { value: 'milk', en: 'Milk/Dairy', he: 'חלב' },
  { value: 'eggs', en: 'Eggs', he: 'ביצים' },
  { value: 'wheat', en: 'Wheat', he: 'חיטה' },
  { value: 'soy', en: 'Soy', he: 'סויה' },
  { value: 'fish', en: 'Fish', he: 'דגים' },
  { value: 'seafood', en: 'Seafood', he: 'פירות ים' },
  { value: 'other', en: 'Other', he: 'אחר' },
];

const LIMITATIONS = [
  { value: 'vegetarian', en: 'Vegetarian', he: 'צמחוני' },
  { value: 'vegan', en: 'Vegan', he: 'טבעוני' },
  { value: 'pescatarian', en: 'Pescatarian', he: 'פסקטריאני' },
  { value: 'kosher', en: 'Kosher', he: 'כשר' },
  { value: 'halal', en: 'Halal', he: 'חלאל' },
  { value: 'gluten_free', en: 'Gluten-free', he: 'ללא גלוטן' },
  { value: 'dairy_free', en: 'Dairy-free', he: 'ללא חלב' },
  { value: 'other', en: 'Other', he: 'אחר' },
];

const ACTIVITY_LEVELS = [
  { value: 'sedentary', en: 'Sedentary - Little or no exercise', he: 'יושבני - מעט או ללא פעילות' },
  { value: 'light', en: 'Light Activity - 1-3 days/week', he: 'פעילות קלה - 1-3 פעמים בשבוע' },
  { value: 'moderate', en: 'Moderate Activity - 3-5 days/week', he: 'פעילות בינונית - 3-5 פעמים בשבוע' },
  { value: 'very', en: 'Very Active - 6-7 days/week', he: 'פעיל מאוד - 6-7 פעמים בשבוע' },
  { value: 'extra', en: 'Extra Active - Very hard exercise/physical job', he: 'קיצוני - פעילות אינטנסיבית' },
];

function ChipMulti({
  options,
  selected,
  onToggle,
  otherText,
  onOtherText,
  otherKey = 'other',
  isHe,
  isDark,
  /** When true, skip the Other chip and always show a free-text field */
  otherAsText = false,
}) {
  const chipOptions = otherAsText ? options.filter((o) => o.value !== otherKey) : options;
  const showOther = otherAsText || (selected || []).includes(otherKey);

  const handleOtherText = (t) => {
    onOtherText(t);
    if (!otherAsText) return;
    const hasOther = (selected || []).includes(otherKey);
    if (t.trim() && !hasOther) onToggle(otherKey);
    if (!t.trim() && hasOther) onToggle(otherKey);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {chipOptions.map((o) => {
          const on = (selected || []).includes(o.value);
          return (
            <button key={o.value} type="button" onClick={() => onToggle(o.value)} className={chipBtn(on, isDark)}>
              {isHe ? o.he : o.en}
            </button>
          );
        })}
      </div>
      {showOther && (
        <input
          className={inputClass(isDark)}
          placeholder={
            otherAsText
              ? isHe
                ? 'אחר — פרט כאן'
                : 'Other — type here'
              : isHe
                ? 'פרט...'
                : 'Please specify...'
          }
          value={otherText || ''}
          onChange={(e) => handleOtherText(e.target.value)}
        />
      )}
    </div>
  );
}

function normalizeCustomOptions(options) {
  const list = Array.isArray(options)
    ? options
    : typeof options === 'string'
      ? options.split(/[,;\n]/).map((o) => o.trim()).filter(Boolean)
      : [];
  return list.map((opt) => {
    const label = String(opt);
    return { value: label, en: label, he: label };
  });
}

function ChoiceOptionList({ options, selectedValues, onToggle, isHe, isDark, multiple = false }) {
  const selected = multiple
    ? (Array.isArray(selectedValues) ? selectedValues : [])
    : selectedValues
      ? [selectedValues]
      : [];

  return (
    <div className="space-y-2">
      <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
        {multiple
          ? isHe
            ? 'בחרו את כל האפשרויות הרלוונטיות'
            : 'Select all that apply'
          : isHe
            ? 'בחרו אפשרות אחת'
            : 'Choose one option'}
      </p>
      <div className="grid gap-2" role={multiple ? 'group' : 'radiogroup'}>
        {options.map((opt) => {
          const on = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={on}
              onClick={() => onToggle(opt.value)}
              className={optionBtn(on, isDark)}
            >
              <span className="flex items-center justify-between gap-3 w-full">
                <span>{isHe ? opt.he : opt.en}</span>
                {on ? (
                  <Check size={18} className="shrink-0 text-emerald-500" aria-hidden />
                ) : (
                  <span
                    className={`shrink-0 w-5 h-5 rounded-full border-2 ${
                      isDark ? 'border-white/20' : 'border-slate-300'
                    }`}
                    aria-hidden
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomStepField({ step, answers, setAnswer, isDark, isHe }) {
  const custom = step.custom || {};
  const customKey = custom.id || step.fields?.[0]?.replace(/^custom_/, '') || step.id?.replace(/^custom_/, '');
  const type = custom.type || 'text';
  const options = normalizeCustomOptions(custom.options);
  const stored = answers.custom_answers?.[customKey];

  const setCustomValue = (value) => {
    setAnswer('custom_answers', {
      ...(answers.custom_answers || {}),
      [customKey]: value,
    });
  };

  const description = custom.description || custom.descriptionEn || custom.descriptionHe;
  const descriptionText =
    isHe && custom.descriptionHe ? custom.descriptionHe : custom.descriptionEn || description;

  let field;
  if (type === 'multiselect') {
    const selected = Array.isArray(stored) ? stored : [];
    field = (
      <ChoiceOptionList
        options={options}
        selectedValues={selected}
        multiple
        onToggle={(value) => {
          const next = selected.includes(value)
            ? selected.filter((v) => v !== value)
            : [...selected, value];
          setCustomValue(next);
        }}
        isHe={isHe}
        isDark={isDark}
      />
    );
  } else if (type === 'select') {
    field = (
      <ChoiceOptionList
        options={options}
        selectedValues={stored}
        onToggle={(value) => setCustomValue(value)}
        isHe={isHe}
        isDark={isDark}
      />
    );
  } else {
    field = (
      <textarea
        className={inputClass(isDark)}
        rows={4}
        value={typeof stored === 'string' ? stored : ''}
        onChange={(e) => setCustomValue(e.target.value)}
        placeholder={custom.placeholder || ''}
      />
    );
  }

  return (
    <div className="space-y-4">
      {descriptionText ? (
        <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{descriptionText}</p>
      ) : null}
      {field}
    </div>
  );
}

function preferredLanguageNote(code, isHe, isDark) {
  if (!code) return null;
  if (code === 'he') {
    return (
      <p className={`text-sm leading-relaxed rounded-2xl border px-4 py-3 ${
        isDark ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-100' : 'border-emerald-200 bg-emerald-50 text-emerald-900'
      }`}>
        השאלון והצ׳אט עם הדיאטנית AI יהיו בעברית.
      </p>
    );
  }
  const label = LANGUAGES.find((l) => l.value === code)?.label || code;
  return (
    <p className={`text-sm leading-relaxed rounded-2xl border px-4 py-3 ${
      isDark ? 'border-slate-700 bg-slate-900/60 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
    }`}>
      {isHe
        ? `השאלון יישאר באנגלית. הדיאטנית AI תענה ב־${label}.`
        : `This onboarding form stays in English. Your AI dietitian will reply in ${label}.`}
    </p>
  );
}

/** Renders the form body for a given step definition. */
export default function StepFields({ step }) {
  const { isDarkMode } = useTheme();
  const { setLanguage, setDirection } = useLanguage();
  const answers = useOnboardingStore((s) => s.answers);
  const setAnswer = useOnboardingStore((s) => s.setAnswer);
  const setAnswers = useOnboardingStore((s) => s.setAnswers);
  const includeNursing = useOnboardingStore((s) => s.includeNursingStatus);
  const weightUnit = useOnboardingStore((s) => s.weightUnit);
  const heightUnit = useOnboardingStore((s) => s.heightUnit);
  const setUnits = useOnboardingStore((s) => s.setUnits);
  const isHe = isOnboardingHebrew(answers.language);

  const [classifying, setClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState(null);

  const id = step?.id;

  const toggleList = (field, value) => {
    const cur = Array.isArray(answers[field]) ? answers[field] : [];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    setAnswer(field, next);
  };

  const onSelectPreferredLanguage = (code) => {
    setAnswer('language', code);
    applyPreferredLanguageToApp(code, { setLanguage, setDirection });
  };

  if (!step) return null;

  if (step.isCustom) {
    return (
      <CustomStepField
        step={step}
        answers={answers}
        setAnswer={setAnswer}
        isDark={isDarkMode}
        isHe={isHe}
      />
    );
  }

  switch (id) {
    case 'language': {
      const langOptions = LANGUAGES.map((l) => ({ value: l.value, label: l.label }));
      return (
        <div className="space-y-3">
          <SearchableSelect
            options={langOptions}
            value={answers.language || ''}
            onChange={onSelectPreferredLanguage}
            placeholder={isHe ? 'בחר שפה' : 'Select language'}
            searchPlaceholder={isHe ? 'חיפוש...' : 'Search...'}
            emptyText={isHe ? 'לא נמצאו תוצאות' : 'No matches'}
            isDark={isDarkMode}
            inputClass={inputClass(isDarkMode)}
          />
          {preferredLanguageNote(answers.language, isHe, isDarkMode)}
        </div>
      );
    }

    case 'name':
      return (
        <div className="space-y-3">
          <input className={inputClass(isDarkMode)} placeholder={isHe ? 'שם פרטי' : 'First name'} value={answers.first_name || ''} onChange={(e) => setAnswer('first_name', e.target.value)} />
          <input className={inputClass(isDarkMode)} placeholder={isHe ? 'שם משפחה' : 'Last name'} value={answers.last_name || ''} onChange={(e) => setAnswer('last_name', e.target.value)} />
        </div>
      );

    case 'phone':
      return (
        <div className="flex gap-2">
          <select className={`${glassSelectClass(isDarkMode)} w-28`} value={answers.phoneCountryCode || '+972'} onChange={(e) => setAnswer('phoneCountryCode', e.target.value)}>
            <option value="+972">+972</option>
            <option value="+1">+1</option>
            <option value="+44">+44</option>
            <option value="+33">+33</option>
            <option value="+49">+49</option>
          </select>
          <input
            className={inputClass(isDarkMode)}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="tel-national"
            placeholder={isHe ? 'מספר טלפון' : 'Phone number'}
            value={answers.phone || ''}
            onChange={(e) => setAnswer('phone', sanitizePhoneDigits(e.target.value))}
          />
        </div>
      );

    case 'city':
      return (
        <CitySearchSelect
          value={answers.city || ''}
          timezone={answers.timezone || ''}
          countryCode={answers.country_code || ''}
          isHe={isHe}
          isDark={isDarkMode}
          inputClass={inputClass(isDarkMode)}
          onCountryChange={(code) =>
            setAnswers({
              country_code: code,
              region: regionFromCountry(code),
              region_other: '',
              city: '',
              timezone: '',
            })
          }
          onSelect={({ city, timezone }) => setAnswers({ city, timezone })}
        />
      );

    case 'dob':
      return (
        <DateOfBirthSelect
          value={answers.date_of_birth || ''}
          onChange={(iso) => setAnswer('date_of_birth', iso)}
          isHe={isHe}
          isDark={isDarkMode}
          inputClass={inputClass(isDarkMode)}
        />
      );

    case 'gender':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {['male', 'female', 'other'].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setAnswers({ gender: g, ...(g !== 'other' ? { gender_other: '' } : {}) })}
                className={optionBtn(answers.gender === g, isDarkMode)}
              >
                {g === 'male' ? (isHe ? 'זכר' : 'Male') : g === 'female' ? (isHe ? 'נקבה' : 'Female') : (isHe ? 'אחר' : 'Other')}
              </button>
            ))}
          </div>
          {answers.gender === 'other' && (
            <input
              autoFocus
              className={inputClass(isDarkMode)}
              placeholder={isHe ? 'פרט...' : 'Please specify...'}
              value={answers.gender_other || ''}
              onChange={(e) => setAnswer('gender_other', e.target.value)}
            />
          )}
          {includeNursing && answers.gender === 'female' && (
            <SearchableSelect
              options={[
                { value: 'none', label: isHe ? 'לא מניקה' : 'Not nursing' },
                { value: 'partial', label: isHe ? 'הנקה חלקית' : 'Partial nursing' },
                { value: 'exclusive', label: isHe ? 'הנקה מלאה' : 'Exclusive nursing' },
              ]}
              value={answers.nursing_status || ''}
              onChange={(v) => setAnswer('nursing_status', v)}
              placeholder={isHe ? 'מצב פיזיולוגי' : 'Physiological state'}
              searchPlaceholder={isHe ? 'חיפוש...' : 'Search...'}
              emptyText={isHe ? 'לא נמצאו תוצאות' : 'No matches'}
              isDark={isDarkMode}
              inputClass={inputClass(isDarkMode)}
            />
          )}
        </div>
      );

    case 'biometrics': {
      const showCm = heightUnit === 'cm';
      const showKg = weightUnit === 'kg';
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            {[
              { label: 'cm', on: showCm, fn: () => setUnits({ heightUnit: 'cm' }) },
              { label: 'in', on: !showCm, fn: () => setUnits({ heightUnit: 'in' }) },
              { label: 'kg', on: showKg, fn: () => setUnits({ weightUnit: 'kg' }) },
              { label: 'lbs', on: !showKg, fn: () => setUnits({ weightUnit: 'lbs' }) },
            ].map((u) => (
              <button key={u.label} type="button" onClick={u.fn} className={chipBtn(u.on, isDarkMode)}>
                {u.label}
              </button>
            ))}
          </div>
          <input
            type="number"
            className={inputClass(isDarkMode)}
            placeholder={showCm ? (isHe ? 'גובה (ס״מ)' : 'Height (cm)') : (isHe ? 'גובה (אינץ׳)' : 'Height (in)')}
            value={answers.height_cm || ''}
            onChange={(e) => {
              let v = e.target.value;
              if (!showCm && v) v = String(Math.round(parseFloat(v) * 2.54));
              setAnswer('height_cm', v);
            }}
          />
          <input
            type="number"
            className={inputClass(isDarkMode)}
            placeholder={
              showKg
                ? isHe
                  ? 'משקל נוכחי (ק״ג)'
                  : 'Current weight (kg)'
                : isHe
                  ? 'משקל נוכחי (ליברות)'
                  : 'Current weight (lbs)'
            }
            value={answers.weight_kg || ''}
            onChange={(e) => {
              let v = e.target.value;
              if (!showKg && v) v = String((parseFloat(v) / 2.20462).toFixed(1));
              setAnswer('weight_kg', v);
            }}
          />
          <input
            type="number"
            className={inputClass(isDarkMode)}
            placeholder={isHe ? 'משקל מטרה (ק״ג)' : 'Target weight (kg)'}
            value={answers.target_weight || ''}
            onChange={(e) => setAnswer('target_weight', e.target.value)}
          />
        </div>
      );
    }

    case 'activity':
      return (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
              {isHe ? 'בחרו רמת פעילות' : 'Select your activity level'}
            </p>
            <div className="grid gap-2">
              {ACTIVITY_LEVELS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAnswer('activity_level', a.value)}
                  className={optionBtn(answers.activity_level === a.value, isDarkMode)}
                >
                  {isHe ? a.he : a.en}
                </button>
              ))}
            </div>
          </div>

          <div className={`space-y-3 pt-1 border-t ${isDarkMode ? 'border-white/10' : 'border-slate-200/80'}`}>
            <div>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                {isHe ? 'לא בטוחים?' : 'Not sure?'}
              </p>
              <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {isHe
                  ? 'תארו את העבודה והפעילות הגופנית שלכם — נציע רמה אוטומטית (אופציונלי)'
                  : 'Describe your job and exercise — we can suggest a level for you (optional)'}
              </p>
            </div>
            <textarea
              className={inputClass(isDarkMode)}
              rows={3}
              placeholder={
                isHe
                  ? 'לדוגמה: עבודה משרדית + אימוני כוח 4 פעמים בשבוע'
                  : 'e.g. Desk job + strength training 4 days a week'
              }
              value={answers.activity_description || ''}
              onChange={(e) => setAnswer('activity_description', e.target.value)}
            />
            <GlassSecondaryButton
              className="w-full"
              disabled={classifying || !answers.activity_description?.trim()}
              onClick={async () => {
                setClassifyError(null);
                setClassifying(true);
                try {
                  const res = await classifyActivity(answers.activity_description);
                  console.info('[StepFields] classify mapped', { raw: res?.activity_factor, reasoning: res?.reasoning, promptVersion: res?.promptVersion });
                  const raw = res?.activity_factor;
                  const allowed = new Set(ACTIVITY_LEVELS.map((a) => a.value));
                  if (typeof raw === 'string' && allowed.has(raw)) {
                    setAnswer('activity_level', raw);
                  } else {
                    const factor = Number(raw);
                    const map = [
                      [1.2, 'sedentary'],
                      [1.375, 'light'],
                      [1.55, 'moderate'],
                      [1.725, 'very'],
                      [1.9, 'extra'],
                    ];
                    let best = null;
                    let bestDiff = Infinity;
                    if (Number.isFinite(factor) && factor > 0) {
                      map.forEach(([f, level]) => {
                        const d = Math.abs(f - factor);
                        if (d < bestDiff) {
                          bestDiff = d;
                          best = level;
                        }
                      });
                    }
                    if (best) setAnswer('activity_level', best);
                    else throw new Error('bad classification');
                  }
                } catch (err) {
                  console.error('[StepFields] classify failed', err?.status, err?.message, err?.data);
                  setClassifyError(isHe ? 'הסיווג נכשל — בחרו ידנית למעלה' : 'Auto-classify failed — pick a level above');
                }
                setClassifying(false);
              }}
            >
              <Sparkles size={18} aria-hidden />
              {classifying
                ? (isHe ? 'מסווג...' : 'Classifying...')
                : (isHe ? 'סווג אוטומטית לפי התיאור' : 'Auto-classify from description')}
            </GlassSecondaryButton>
            {classifyError ? (
              <p className={`text-xs ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`} role="alert">
                {classifyError}
              </p>
            ) : null}
          </div>
        </div>
      );

    case 'goal':
      return (
        <div className="grid gap-2">
          {GOALS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setAnswer('goal', g.value)}
              className={optionBtn(answers.goal === g.value, isDarkMode)}
            >
              {isHe ? g.he : g.en}
            </button>
          ))}
        </div>
      );

    case 'dietary':
      return (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
              {isHe ? 'אלרגיות' : 'Allergies'}
            </p>
            <ChipMulti
              options={ALLERGIES}
              selected={answers.food_allergies}
              onToggle={(v) => toggleList('food_allergies', v)}
              otherText={answers.allergies_other}
              onOtherText={(t) => setAnswer('allergies_other', t)}
              otherAsText
              isHe={isHe}
              isDark={isDarkMode}
            />
          </div>
          <div className="space-y-2">
            <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
              {isHe ? 'הגבלות' : 'Limitations'}
            </p>
            <ChipMulti
              options={LIMITATIONS}
              selected={answers.food_limitations}
              onToggle={(v) => toggleList('food_limitations', v)}
              otherText={answers.limitations_other}
              onOtherText={(t) => setAnswer('limitations_other', t)}
              otherAsText
              isHe={isHe}
              isDark={isDarkMode}
            />
          </div>
        </div>
      );

    case 'preferences':
      return (
        <textarea className={inputClass(isDarkMode)} rows={4} placeholder={isHe ? 'מה אתה אוהב / לא אוהב' : 'Likes and dislikes'} value={answers.client_preference || ''} onChange={(e) => setAnswer('client_preference', e.target.value)} />
      );

    case 'eating_window':
      return (
        <div className="grid grid-cols-2 gap-3">
          <label className={`text-sm space-y-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
            <span>{isHe ? 'ארוחה ראשונה' : 'First meal'}</span>
            <input type="time" className={inputClass(isDarkMode)} value={answers.first_meal_time || '08:00'} onChange={(e) => setAnswer('first_meal_time', e.target.value)} />
          </label>
          <label className={`text-sm space-y-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
            <span>{isHe ? 'ארוחה אחרונה' : 'Last meal'}</span>
            <input type="time" className={inputClass(isDarkMode)} value={answers.last_meal_time || '20:00'} onChange={(e) => setAnswer('last_meal_time', e.target.value)} />
          </label>
        </div>
      );

    case 'calories':
      return (
        <CaloriesMacrosFields
          isHe={isHe}
          isDark={isDarkMode}
          inputClass={inputClass(isDarkMode)}
        />
      );

    case 'meals':
      return (
        <MealPlanningFields
          isHe={isHe}
          isDark={isDarkMode}
          inputClass={inputClass(isDarkMode)}
        />
      );

    case 'medical':
      return (
        <textarea className={inputClass(isDarkMode)} rows={4} placeholder={isHe ? 'מצבים רפואיים (אופציונלי)' : 'Medical conditions (optional)'} value={answers.medical_conditions || ''} onChange={(e) => setAnswer('medical_conditions', e.target.value)} />
      );

    default:
      return null;
  }
}

export function validateStep(step, answers, { includeNursingStatus = true, isHe = false } = {}) {
  if (!step) return null;
  const t = (en, he) => (isHe ? he : en);

  if (step.isCustom) {
    const custom = step.custom || {};
    const customKey = custom.id || step.fields?.[0]?.replace(/^custom_/, '') || step.id?.replace(/^custom_/, '');
    const val = answers.custom_answers?.[customKey];
    const type = custom.type || 'text';
    if (type === 'multiselect') {
      if (!Array.isArray(val) || val.length === 0) {
        return t('Please select at least one option', 'נא לבחור לפחות אפשרות אחת');
      }
    } else if (type === 'select') {
      if (!val || !String(val).trim()) return t('Please select an option', 'נא לבחור אפשרות');
    } else if (!val || !String(val).trim()) {
      return t('Please enter an answer', 'נא להזין תשובה');
    }
    return null;
  }

  switch (step.id) {
    case 'language':
      if (!answers.language) return t('Please select a language', 'נא לבחור שפה');
      break;
    case 'name':
      if (!answers.first_name?.trim() || !answers.last_name?.trim()) {
        return t('Please enter your full name', 'נא להזין שם מלא');
      }
      break;
    case 'phone':
      if (!answers.phone?.trim()) return t('Please enter a phone number', 'נא להזין מספר טלפון');
      if (!isValidPhoneDigits(answers.phone)) {
        return t('Phone number must contain only digits (7–15)', 'מספר הטלפון חייב להכיל ספרות בלבד (7–15)');
      }
      break;
    case 'city':
      if (!answers.country_code?.trim()) return t('Please select a country first', 'נא לבחור מדינה תחילה');
      if (!answers.city?.trim() || !answers.timezone?.trim()) {
        return t('Please select a city from the search list', 'נא לבחור עיר מהרשימה');
      }
      break;
    case 'dob':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(answers.date_of_birth || '')) {
        return t('Please enter a complete date of birth', 'נא להזין תאריך לידה מלא');
      }
      break;
    case 'gender':
      if (!answers.gender) return t('Please select gender', 'נא לבחור מין');
      if (answers.gender === 'other' && !answers.gender_other?.trim()) return t('Please specify', 'נא לפרט');
      if (includeNursingStatus && answers.gender === 'female' && !answers.nursing_status) {
        return t('Please select physiological state', 'נא לבחור מצב פיזיולוגי');
      }
      break;
    case 'biometrics':
      if (!answers.height_cm || !answers.weight_kg) {
        return t('Please enter height and current weight', 'נא להזין גובה ומשקל נוכחי');
      }
      if (!answers.target_weight) return t('Please enter target weight', 'נא להזין משקל מטרה');
      break;
    case 'activity':
      if (!answers.activity_level) return t('Please select activity level', 'נא לבחור רמת פעילות');
      break;
    case 'goal':
      if (!answers.goal) return t('Please select a goal', 'נא לבחור מטרה');
      break;
    case 'eating_window':
      if (!answers.first_meal_time || !answers.last_meal_time) {
        return t('Please set your eating window', 'נא להגדיר חלון אכילה');
      }
      break;
    case 'calories':
      if (!answers.daily_calories) return t('Please set daily calories', 'נא להגדיר קלוריות יומיות');
      if (!answers.macros?.protein || !answers.macros?.carbs || !answers.macros?.fat) {
        return t('Please set macro targets', 'נא להגדיר יעדי מאקרו');
      }
      break;
    case 'meals': {
      if (!answers.number_of_meals) return t('Please choose number of meals', 'נא לבחור מספר ארוחות');
      const n = parseInt(answers.number_of_meals, 10) || 0;
      const descs = answers.meal_descriptions || [];
      const empty = Array.from({ length: n }, (_, i) => !descs[i]?.trim());
      if (empty.some(Boolean)) {
        return t('Please describe each meal', 'נא לתאר כל ארוחה');
      }
      break;
    }
    default:
      break;
  }
  return null;
}
