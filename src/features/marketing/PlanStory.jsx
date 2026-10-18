import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { UserRound, UtensilsCrossed, Shuffle, RefreshCw, Check } from 'lucide-react';
import { focusClass } from '../../components/brand/ui';
import MobileStory from './MobileStory';

// "A meal plan made for you": a scroll-driven section of its own.
// Facts from BetterApp main:
// - Onboarding asks body, activity, goal, allergies & limitations, diet style,
//   eating window, calorie/macro targets, meal planning, medical conditions
//   (src/features/onboarding/components/step-defs.ts).
// - Right after onboarding the plan builder creates the meal plan from those
//   answers (src/features/onboarding/utils/prepare-meal-plan.ts); meals have
//   alternatives and can be edited (MealPlanTab, client_edited_meal_plan).
// - When weight or activity changes in the profile, daily targets are
//   recalculated (app/pages/profile.tsx). The plan itself is built once, so the
//   copy says targets update, not "the plan rewrites itself".
// - GOALS / DIETS mirror GOAL_OPTIONS / DIET_STYLE_OPTIONS (types.ts), with the
//   exact macro splits. Example meals and numbers are illustrative.

const FADE = { duration: 0.4, ease: 'easeOut' };
const pick = (o, language) => (o ? o[language] || o.english : '');

const GOALS = [
  { key: 'lose', hebrew: 'ירידה במשקל', english: 'Lose weight' },
  { key: 'recomp', hebrew: 'פחות שומן, אותו שריר', english: 'Lose fat, keep muscle' },
  { key: 'maintain', hebrew: 'שמירה על משקל', english: 'Maintain' },
  { key: 'muscle', hebrew: 'בניית שריר', english: 'Build muscle' },
  { key: 'gain', hebrew: 'עלייה במשקל', english: 'Gain weight' },
];

const DIETS = [
  { key: 'balanced', hebrew: 'מאוזן', english: 'Balanced', split: [30, 40, 30] },
  { key: 'high_protein', hebrew: 'עשיר בחלבון', english: 'High protein', split: [40, 30, 30] },
  { key: 'low_carb', hebrew: 'דל פחמימה', english: 'Low carb', split: [40, 20, 40] },
  { key: 'keto', hebrew: 'קטו', english: 'Keto', split: [20, 5, 75] },
  { key: 'endurance', hebrew: 'סיבולת', english: 'Endurance', split: [20, 55, 25] },
];

const EXAMPLE_DAY = {
  balanced: [
    { hebrew: 'שקשוקה עם לחם מלא', english: 'Shakshuka with wholegrain bread' },
    { hebrew: 'עוף בתנור, אורז וסלט', english: 'Baked chicken, rice and salad' },
    { hebrew: 'יוגורט עם פרי', english: 'Yogurt with fruit' },
    { hebrew: 'סלמון, בטטה וירקות', english: 'Salmon, sweet potato and vegetables' },
  ],
  high_protein: [
    { hebrew: 'חביתת 3 ביצים וקוטג׳', english: 'Three-egg omelette and cottage cheese' },
    { hebrew: 'חזה עוף, קינואה וירקות', english: 'Chicken breast, quinoa and vegetables' },
    { hebrew: 'יוגורט חלבון עם אגוזים', english: 'Protein yogurt with nuts' },
    { hebrew: 'דג לבן וסלט גדול', english: 'White fish and a big salad' },
  ],
  low_carb: [
    { hebrew: 'ביצים, אבוקדו וירקות', english: 'Eggs, avocado and vegetables' },
    { hebrew: 'סלט טונה עם טחינה', english: 'Tuna salad with tahini' },
    { hebrew: 'גבינה ושקדים', english: 'Cheese and almonds' },
    { hebrew: 'שניצל בתנור וירקות צלויים', english: 'Baked schnitzel and roasted vegetables' },
  ],
  keto: [
    { hebrew: 'חביתה בחמאה עם גבינה', english: 'Butter omelette with cheese' },
    { hebrew: 'סלמון עם אבוקדו', english: 'Salmon with avocado' },
    { hebrew: 'אגוזי מלך', english: 'Walnuts' },
    { hebrew: 'סטייק וירקות ירוקים', english: 'Steak and green vegetables' },
  ],
  endurance: [
    { hebrew: 'שיבולת שועל עם בננה', english: 'Oats with banana' },
    { hebrew: 'פסטה עם עוף וירקות', english: 'Pasta with chicken and vegetables' },
    { hebrew: 'פיתה עם חומוס', english: 'Pita with hummus' },
    { hebrew: 'אורז, דג וירקות', english: 'Rice, fish and vegetables' },
  ],
};

const MEAL_NAMES = [
  { hebrew: 'בוקר', english: 'Breakfast', time: '08:00' },
  { hebrew: 'צהריים', english: 'Lunch', time: '13:00' },
  { hebrew: 'ביניים', english: 'Snack', time: '16:30' },
  { hebrew: 'ערב', english: 'Dinner', time: '19:30' },
];

// Alternatives for lunch in the "swap" beat (illustrative).
const SWAPS = [
  { hebrew: 'עוף בתנור, אורז וסלט', english: 'Baked chicken, rice and salad', on: true },
  { hebrew: 'קציצות דג, בורגול וסלט', english: 'Fish patties, bulgur and salad' },
  { hebrew: 'טופו מוקפץ עם אורז', english: 'Stir-fried tofu with rice' },
];

const ANSWERS = [
  { hebrew: 'פחות שומן, אותו שריר', english: 'Lose fat, keep muscle' },
  { hebrew: 'מאוזן', english: 'Balanced' },
  { hebrew: 'בלי לקטוז', english: 'No lactose' },
  { hebrew: 'אוכלים 08:00–20:00', english: 'Eat 08:00–20:00' },
  { hebrew: '3 אימונים בשבוע', english: '3 workouts a week' },
  { hebrew: '4 ארוחות ביום', english: '4 meals a day' },
];

const STEPS = [
  {
    icon: UserRound,
    title: { hebrew: 'ספרו לנו עליכם', english: 'Tell us about you' },
    line: {
      hebrew: 'מטרה, גוף, שגרה, סגנון אכילה, אלרגיות והגבלות, ומתי נוח לכם לאכול. כמה דקות, פעם אחת.',
      english: 'Your goal, body, routine, eating style, allergies and limits, and when you like to eat. A few minutes, once.',
    },
  },
  {
    icon: UtensilsCrossed,
    title: { hebrew: 'מקבלים תפריט משלכם', english: 'Get a plan of your own' },
    line: {
      hebrew: 'מיד בסיום נבנה לכם תפריט מלא, ארוחה אחרי ארוחה, לפי יעדי הקלוריות והמאקרו שלכם. לא תבנית, ולא "תפריט 1,500 קלוריות".',
      english: 'Right after, a full plan is built for you, meal by meal, to your calorie and macro targets. Not a template, not a "1,500-calorie plan".',
    },
  },
  {
    icon: Shuffle,
    title: { hebrew: 'בא לכם משהו אחר? מחליפים', english: 'Want something else? Swap it' },
    line: {
      hebrew: 'לכל ארוחה יש חלופות באותם ערכים, ואפשר לערוך את התפריט בעצמכם.',
      english: 'Every meal has alternatives with the same values, and you can edit the plan yourself.',
    },
  },
  {
    icon: RefreshCw,
    title: { hebrew: 'הוא מתעדכן איתכם', english: 'It keeps up with you' },
    line: {
      hebrew: 'כשהמשקל או השגרה משתנים, היעדים מתעדכנים, וכל ארוחה נמדדת מול היעד החדש.',
      english: 'When your weight or routine changes, your targets update, and every meal is checked against the new ones.',
    },
  },
];

function MacroBar({ split, language }) {
  const he = language === 'hebrew';
  const parts = [
    { v: split[0], key: 'protein', label: he ? 'חלבון' : 'Protein' },
    { v: split[1], key: 'carbs', label: he ? 'פחמימה' : 'Carbs' },
    { v: split[2], key: 'fat', label: he ? 'שומן' : 'Fat' },
  ];
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full" dir="ltr">
        {parts.map((p) => (
          <motion.span key={p.key} className="h-full" style={{ backgroundColor: `var(--bc-${p.key})` }} animate={{ width: `${p.v}%` }} transition={FADE} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] font-bold">
        {parts.map((p) => (
          <span key={p.key} style={{ color: `var(--bc-${p.key})` }}>
            {p.label} <span dir="ltr">{p.v}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- The sticky plan card: one state per scroll beat ---------- */

function PlanCard({ step, language }) {
  const he = language === 'hebrew';
  const meals = EXAMPLE_DAY.balanced;
  const target = step >= 3 ? 1980 : 2050;

  return (
    <div className="w-full max-w-[480px] rounded-bc-card border border-bc-border bg-bc-canvas p-6 sm:p-7 min-h-[460px] flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-bc-muted">{step === 0 ? (he ? 'התשובות שלכם' : 'Your answers') : he ? 'התפריט שלכם' : 'Your plan'}</p>
          <AnimatePresence mode="wait">
            <motion.p key={target} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE}
              className="mt-1 font-choice font-medium text-[26px] text-bc-text tabular-nums" dir="ltr" style={{ textAlign: 'start' }}>
              {step === 0 ? '…' : `${target.toLocaleString('en-US')} kcal`}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.div key="answers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="mt-6 flex flex-wrap gap-2">
            {ANSWERS.map((a, i) => (
              <motion.span key={a.english} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...FADE, delay: i * 0.12 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-bc-border px-3.5 py-2 text-[14px] font-semibold text-bc-text">
                <Check size={14} aria-hidden="true" className="text-bc-accent-text" />
                {pick(a, language)}
              </motion.span>
            ))}
          </motion.div>
        ) : (
          <motion.div key="plan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="mt-5 flex flex-col">
            <MacroBar split={[30, 40, 30]} language={language} />
            <ul className="mt-5 divide-y divide-bc-border border-t border-bc-border">
              {meals.map((m, i) => {
                const swapping = step === 2 && i === 1;
                return (
                  <li key={m.english} className="py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-14 flex-none text-[12px] font-bold text-bc-muted tabular-nums" dir="ltr" style={{ textAlign: 'start' }}>{MEAL_NAMES[i].time}</span>
                      <span className="flex-1 text-[15px] font-semibold text-bc-text">{pick(m, language)}</span>
                      {step >= 3 ? <Check size={16} aria-hidden="true" className="flex-none text-bc-accent-text" /> : null}
                    </div>
                    <AnimatePresence>
                      {swapping ? (
                        <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={FADE} className="mt-3 ms-14 flex flex-col gap-2 overflow-hidden">
                          {SWAPS.map((s) => (
                            <li key={s.english} className={`rounded-[14px] border px-3 py-2 text-[13px] font-semibold ${s.on ? 'border-bc-accent text-bc-text' : 'border-bc-border text-bc-muted'}`}>
                              {pick(s, language)}
                            </li>
                          ))}
                        </motion.ul>
                      ) : null}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
            <AnimatePresence>
              {step >= 3 ? (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE}
                  className="mt-4 rounded-[16px] bg-[var(--bc-accent-well)] px-4 py-3 text-[14px] font-semibold text-bc-text">
                  {he ? 'שקילה חדשה: 82 → 80 ק״ג. היעד היומי עודכן ל-1,980 קק״ל.' : 'New weigh-in: 82 → 80 kg. Daily target updated to 1,980 kcal.'}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Beat({ step, index, language, onActive, active }) {
  const ref = useRef(null);
  const centered = useInView(ref, { margin: '-50% 0px -50% 0px' });
  useEffect(() => {
    if (centered) onActive(index);
  }, [centered, index, onActive]);
  const Icon = step.icon;
  return (
    <div ref={ref} className="py-14 lg:py-0 lg:min-h-[70vh] flex flex-col justify-center border-t border-bc-border first:border-0 lg:border-0">
      <p className={`flex items-center gap-2 text-[13px] font-bold transition-colors duration-[400ms] ${active ? 'text-bc-accent-text' : 'text-bc-muted'}`}>
        <span className="font-choice tabular-nums" dir="ltr">{String(index + 1).padStart(2, '0')}</span>
        <Icon size={16} aria-hidden="true" />
        {pick(step.title, language)}
      </p>
      <p className="mt-3 font-choice font-medium text-[24px] sm:text-[30px] leading-[1.25] text-bc-text max-w-[30rem]">{pick(step.line, language)}</p>
    </div>
  );
}

function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-[44px] rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors duration-150 ${focusClass} ${
        selected ? 'border-bc-accent bg-bc-accent text-bc-on-accent' : 'border-bc-border text-bc-muted hover:text-bc-text hover:border-bc-muted'
      }`}
    >
      {children}
    </button>
  );
}

function TryIt({ language }) {
  const he = language === 'hebrew';
  const [goal, setGoal] = useState('recomp');
  const [diet, setDiet] = useState('balanced');
  const dietDef = DIETS.find((d) => d.key === diet);
  const goalDef = GOALS.find((g) => g.key === goal);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-20 sm:pb-28 grid lg:grid-cols-2 gap-12 items-start">
      <div>
        <p className="inline-flex rounded-full border border-bc-border px-3 py-1 text-[13px] font-bold text-bc-accent-text">{he ? 'נסו בעצמכם' : 'Try it'}</p>
        <h3 className="mt-3 font-choice font-medium text-[28px] sm:text-[40px] leading-[1.08] text-bc-text">
          {he ? 'שתי בחירות, ותפריט אחר לגמרי.' : 'Two choices, a completely different plan.'}
        </h3>
        <p className="mt-8 text-[13px] font-bold text-bc-text">{he ? 'המטרה שלכם' : 'Your goal'}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <Chip key={g.key} selected={goal === g.key} onClick={() => setGoal(g.key)}>{pick(g, language)}</Chip>
          ))}
        </div>
        <p className="mt-6 text-[13px] font-bold text-bc-text">{he ? 'סגנון האכילה' : 'Eating style'}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DIETS.map((d) => (
            <Chip key={d.key} selected={diet === d.key} onClick={() => setDiet(d.key)}>{pick(d, language)}</Chip>
          ))}
        </div>
        <p className="mt-6 text-[14px] font-semibold text-bc-muted">
          {he
            ? 'באפליקציה נוספים גם הגוף, השגרה, האלרגיות וחלון האכילה שלכם, והתפריט נבנה מכל אלה.'
            : 'In the app, your body, routine, allergies and eating window go in too, and the plan is built from all of it.'}
        </p>
      </div>

      <div className="rounded-bc-card border border-bc-border bg-bc-canvas p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-bc-muted">{he ? 'התפריט שלכם' : 'Your plan'}</p>
            <p className="mt-1 font-choice font-medium text-[22px] sm:text-[26px] text-bc-text">{pick(goalDef, language)} · {pick(dietDef, language)}</p>
          </div>
          </div>
        <div className="mt-6"><MacroBar split={dietDef.split} language={language} /></div>
        <AnimatePresence mode="wait">
          <motion.ul key={diet} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="mt-6 divide-y divide-bc-border border-t border-bc-border">
            {EXAMPLE_DAY[diet].map((meal, i) => (
              <li key={meal.english} className="flex items-center justify-between gap-4 py-3.5">
                <span className="text-[13px] font-bold text-bc-muted w-16 flex-none">{pick(MEAL_NAMES[i], language)}</span>
                <span className="flex-1 text-[15px] font-semibold text-bc-text">{pick(meal, language)}</span>
                <span className="text-[12px] font-semibold text-bc-accent-text flex-none">{he ? '+ חלופות' : '+ swaps'}</span>
              </li>
            ))}
          </motion.ul>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function PlanStory({ language }) {
  const he = language === 'hebrew';
  const [active, setActive] = useState(0);

  return (
    <section aria-labelledby="plan-title" className="border-t border-bc-border bg-bc-band">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 sm:pt-28">
        <p className="inline-flex rounded-full border border-bc-border px-3 py-1 text-[13px] font-bold text-bc-accent-text">{he ? 'מהרגע שמורידים' : 'From the moment you download'}</p>
        <h2 id="plan-title" className="mt-3 font-choice font-medium text-[36px] sm:text-[56px] leading-[1.04] text-bc-text max-w-4xl">
          {he ? 'תפריט שנבנה רק בשבילכם.' : 'A meal plan built only for you.'}
        </h2>
        <p className="mt-4 text-[17px] sm:text-[20px] font-semibold text-bc-muted max-w-2xl">
          {he ? 'לפי הגוף, המטרה והטעם שלכם. ומתעדכן כשאתם מתקדמים.' : 'Built around your body, your goal and your taste. And it keeps up as you progress.'}
        </p>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:grid lg:grid-cols-2 lg:gap-16">
        <div className="hidden lg:block lg:py-[12vh]">
          {STEPS.map((s, i) => (
            <Beat key={s.title.english} step={s} index={i} language={language} onActive={setActive} active={active === i} />
          ))}
        </div>
        <MobileStory
          className="lg:hidden mt-10 mb-16"
          language={language}
          steps={STEPS}
          renderSlide={(s, i) => {
            const Icon = s.icon;
            return (
              <div className="flex flex-col gap-4">
                <div className="min-h-[148px]">
                  <p className="flex items-center gap-2 text-[13px] font-bold text-bc-accent-text">
                    <span className="font-choice tabular-nums" dir="ltr">{String(i + 1).padStart(2, '0')}</span>
                    <Icon size={16} aria-hidden="true" />
                    {pick(s.title, language)}
                  </p>
                  <p className="mt-2 font-choice font-medium text-[20px] leading-[1.3] text-bc-text">{pick(s.line, language)}</p>
                </div>
                <PlanCard step={i} language={language} />
              </div>
            );
          }}
        />
        <div className="hidden lg:block">
          <div className="sticky top-16 h-[calc(100vh-64px)] flex items-center justify-center">
            <PlanCard step={active} language={language} />
          </div>
        </div>
      </div>

      <TryIt language={language} />
      <p className="mx-auto max-w-6xl px-4 sm:px-6 pb-12 -mt-8 text-[12px] font-semibold text-bc-muted">
        {he ? 'הארוחות והמספרים כאן להמחשה. התפריט שלכם נבנה מהתשובות שלכם.' : 'Meals and numbers here are illustrative. Your plan is built from your answers.'}
      </p>
    </section>
  );
}
