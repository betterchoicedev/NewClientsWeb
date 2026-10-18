import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UserRound, UtensilsCrossed, RefreshCw } from 'lucide-react';
import { focusClass } from '../../components/brand/ui';

// "A meal plan made for you": facts from BetterApp main.
// - Onboarding asks body, activity, goal, allergies & limitations, diet style,
//   eating window, calorie/macro targets, meal planning, medical conditions
//   (src/features/onboarding/components/step-defs.ts).
// - Right after onboarding the plan builder creates the meal plan from those
//   answers (src/features/onboarding/utils/prepare-meal-plan.ts).
// - When weight or activity changes in the profile, daily targets are
//   recalculated (app/pages/profile.tsx). The plan itself is built once; meals
//   can be swapped/edited. So the page says targets update, not "the plan rewrites itself".
// - GOALS / DIETS below mirror GOAL_OPTIONS / DIET_STYLE_OPTIONS (types.ts),
//   including the exact macro splits.

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

// Example day per diet style (illustrative; the real plan is built from your answers).
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
  { hebrew: 'בוקר', english: 'Breakfast' },
  { hebrew: 'צהריים', english: 'Lunch' },
  { hebrew: 'ביניים', english: 'Snack' },
  { hebrew: 'ערב', english: 'Dinner' },
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
    title: { hebrew: 'קבלו תפריט משלכם', english: 'Get a plan of your own' },
    line: {
      hebrew: 'מיד בסיום נבנה לכם תפריט מלא, ארוחה אחרי ארוחה, לפי יעדי הקלוריות והמאקרו שלכם. עם חלופות לכל ארוחה.',
      english: 'Right after, a full meal plan is built for you, meal by meal, to your calorie and macro targets. With alternatives for every meal.',
    },
  },
  {
    icon: RefreshCw,
    title: { hebrew: 'הוא מתעדכן איתכם', english: 'It keeps up with you' },
    line: {
      hebrew: 'כשהמשקל או השגרה משתנים, היעדים מתעדכנים, וכל ארוחה נמדדת מול היעד החדש. בא לכם משהו אחר? מחליפים.',
      english: 'When your weight or routine changes, your targets update, and every meal is checked against the new ones. Want something else? Swap it.',
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

function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors duration-150 ${focusClass} ${
        selected ? 'border-bc-accent bg-bc-accent text-bc-on-accent' : 'border-bc-border text-bc-muted hover:text-bc-text hover:border-bc-muted'
      }`}
    >
      {children}
    </button>
  );
}

export default function PlanStory({ language }) {
  const he = language === 'hebrew';
  const [goal, setGoal] = useState('recomp');
  const [diet, setDiet] = useState('balanced');
  const dietDef = DIETS.find((d) => d.key === diet);
  const goalDef = GOALS.find((g) => g.key === goal);

  return (
    <>
      {/* How it starts */}
      <section className="border-t border-bc-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
          <p className="text-[13px] font-bold text-bc-accent">{he ? 'מהרגע שמורידים' : 'From the moment you download'}</p>
          <h2 className="mt-3 font-choice font-medium text-[34px] sm:text-[56px] leading-[1.04] text-bc-text max-w-4xl">
            {he ? 'תפריט שנבנה רק בשבילכם.' : 'A meal plan built only for you.'}
          </h2>
          <p className="mt-4 text-[17px] sm:text-[20px] font-semibold text-bc-muted max-w-2xl">
            {he
              ? 'לא תבנית, לא "תפריט 1,500 קלוריות". התפריט שלכם, לפי הגוף, המטרה והטעם שלכם.'
              : 'Not a template, not a "1,500-calorie plan". Yours, built around your body, your goal and your taste.'}
          </p>

          <ol className="mt-12 grid md:grid-cols-3 gap-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.li
                  key={s.title.english}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ ...FADE, delay: i * 0.12 }}
                  className="rounded-bc-card border border-bc-border bg-bc-surface p-6 sm:p-8"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bc-accent-well)] text-bc-accent">
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <span className="font-choice text-[28px] text-bc-border" dir="ltr">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <h3 className="mt-6 font-choice font-medium text-[24px] sm:text-[28px] text-bc-text">{pick(s.title, language)}</h3>
                  <p className="mt-3 text-[15px] sm:text-[16px] font-semibold text-bc-muted leading-relaxed">{pick(s.line, language)}</p>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Try it: pick a goal and a style, see what your plan is built on */}
      <section className="border-t border-bc-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <p className="text-[13px] font-bold text-bc-accent">{he ? 'נסו בעצמכם' : 'Try it'}</p>
            <h2 className="mt-3 font-choice font-medium text-[32px] sm:text-[48px] leading-[1.06] text-bc-text">
              {he ? 'שתי בחירות, ותפריט אחר לגמרי.' : 'Two choices, a completely different plan.'}
            </h2>

            <p className="mt-8 text-[13px] font-bold text-bc-text">{he ? 'המטרה שלכם' : 'Your goal'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <Chip key={g.key} selected={goal === g.key} onClick={() => setGoal(g.key)}>
                  {pick(g, language)}
                </Chip>
              ))}
            </div>

            <p className="mt-6 text-[13px] font-bold text-bc-text">{he ? 'סגנון האכילה' : 'Eating style'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DIETS.map((d) => (
                <Chip key={d.key} selected={diet === d.key} onClick={() => setDiet(d.key)}>
                  {pick(d, language)}
                </Chip>
              ))}
            </div>
            <p className="mt-6 text-[14px] font-semibold text-bc-muted">
              {he
                ? 'באפליקציה נוספים גם הגוף, השגרה, האלרגיות וחלון האכילה שלכם, והתפריט נבנה מכל אלה.'
                : 'In the app, your body, routine, allergies and eating window go in too, and the plan is built from all of it.'}
            </p>
          </div>

          <div className="rounded-bc-card border border-bc-border bg-bc-surface p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-bc-muted">{he ? 'התפריט שלכם' : 'Your plan'}</p>
                <p className="mt-1 font-choice font-medium text-[22px] sm:text-[26px] text-bc-text">
                  {pick(goalDef, language)} · {pick(dietDef, language)}
                </p>
              </div>
              <span className="flex-none rounded-full border border-dashed border-bc-border px-2.5 py-1 text-[11px] font-semibold text-bc-muted">
                {he ? 'יום לדוגמה' : 'Example day'}
              </span>
            </div>
            <div className="mt-6">
              <MacroBar split={dietDef.split} language={language} />
            </div>
            <AnimatePresence mode="wait">
              <motion.ul key={diet} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="mt-6 divide-y divide-bc-border border-t border-bc-border">
                {EXAMPLE_DAY[diet].map((meal, i) => (
                  <li key={meal.english} className="flex items-center justify-between gap-4 py-3.5">
                    <span className="text-[13px] font-bold text-bc-muted w-16 flex-none">{pick(MEAL_NAMES[i], language)}</span>
                    <span className="flex-1 text-[15px] font-semibold text-bc-text">{pick(meal, language)}</span>
                    <span className="text-[12px] font-semibold text-bc-accent flex-none">{he ? '+ חלופות' : '+ swaps'}</span>
                  </li>
                ))}
              </motion.ul>
            </AnimatePresence>
          </div>
        </div>
      </section>
    </>
  );
}
