import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { ClipboardList, Utensils, Dumbbell, MessageCircle, Pause, Play } from 'lucide-react';
import { PhoneFrame } from '../PhoneFrame';
import { AppScreen } from './AppScreens';
import { focusClass } from '../../../components/brand/ui';

// "Inside the app": tabs that switch a live vector recreation of the real
// screens, each with one line about the feature. Tabs advance on their own
// while in view until the visitor picks one.

const TABS = [
  {
    key: 'plan',
    icon: ClipboardList,
    label: { hebrew: 'התפריט', english: 'Meal plan' },
    title: { hebrew: 'תפריט שנבנה בשבילכם.', english: 'A plan built for you.' },
    line: {
      hebrew: 'יעד קלוריות, חלבון, פחמימות ושומן לפי המטרה שלכם, ארוחות לכל יום, ואפשרויות החלפה כשבא לכם משהו אחר.',
      english: 'Calorie and macro targets for your goal, meals for every day, and swaps when you feel like something else.',
    },
  },
  {
    key: 'nutrition',
    icon: Utensils,
    label: { hebrew: 'היומן', english: 'Daily log' },
    title: { hebrew: 'היום שלכם, במבט אחד.', english: 'Your day, at a glance.' },
    line: {
      hebrew: 'מתעדים ארוחה, והמספרים זזים: כמה נשאר, חלבון, פחמימות, שומן ומים.',
      english: 'Log a meal and the numbers move: what’s left, protein, carbs, fat and water.',
    },
  },
  {
    key: 'training',
    icon: Dumbbell,
    label: { hebrew: 'אימונים', english: 'Training' },
    title: { hebrew: 'האימון של היום, מוכן.', english: 'Today’s workout, ready.' },
    line: {
      hebrew: 'תוכנית בימים שבחרתם, עם סטים וחזרות. רושמים משקלים תוך כדי.',
      english: 'A plan on the days you chose, with sets and reps. Log weights as you go.',
    },
  },
  {
    key: 'chat',
    icon: MessageCircle,
    label: { hebrew: 'המאמנת', english: 'Coach' },
    title: { hebrew: 'שואלים, ומקבלים תשובה עם מספרים.', english: 'Ask, and get an answer with numbers.' },
    line: {
      hebrew: 'המאמנת מכירה את התפריט ואת היום שלכם, ומציעה ארוחה שסוגרת את היעד.',
      english: 'The coach knows your plan and your day, and suggests a meal that closes the gap.',
    },
  },
];

const ADVANCE_MS = 7000;
const pick = (o, language) => (o ? o[language] || o.english : '');

export default function AppFeatures({ language }) {
  const he = language === 'hebrew';
  const [tab, setTab] = useState(TABS[0].key);
  const [auto, setAuto] = useState(true);
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.5 });
  const reduce = useReducedMotion();
  const current = TABS.find((t) => t.key === tab);
  const tabRefs = useRef([]);
  const pickTab = (key) => { setAuto(false); setTab(key); };
  // Tabs keyboard: arrows move along the row (mirrored in Hebrew), Home/End jump to the ends.
  const onKeyDown = (e) => {
    const i = TABS.findIndex((t) => t.key === tab);
    const fwd = he ? 'ArrowLeft' : 'ArrowRight';
    const back = he ? 'ArrowRight' : 'ArrowLeft';
    let next = null;
    if (e.key === fwd) next = (i + 1) % TABS.length;
    else if (e.key === back) next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    pickTab(TABS[next].key);
    tabRefs.current[next]?.focus();
  };

  useEffect(() => {
    if (!auto || !inView || reduce) return undefined;
    const id = setTimeout(() => {
      const i = TABS.findIndex((t) => t.key === tab);
      setTab(TABS[(i + 1) % TABS.length].key);
    }, ADVANCE_MS);
    return () => clearTimeout(id);
  }, [auto, inView, reduce, tab]);

  return (
    <section ref={ref} id="inside-app" className="scroll-mt-16 bg-bc-canvas border-t border-bc-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
        <div>
          <p className="inline-flex rounded-full border border-bc-border px-3 py-1 text-[13px] font-bold text-bc-accent-text">{he ? 'מה יש באפליקציה' : 'Inside the app'}</p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={he ? 'מסכים באפליקציה' : 'App screens'} onKeyDown={onKeyDown}>
            {TABS.map((t, ti) => {
              const Icon = t.icon;
              const on = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  ref={(el) => (tabRefs.current[ti] = el)}
                  role="tab"
                  id={`app-tab-${t.key}`}
                  aria-selected={on}
                  aria-controls="app-tabpanel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => pickTab(t.key)}
                  className={`relative overflow-hidden inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 sm:px-5 text-[15px] font-semibold transition-colors ${focusClass} ${
                    on ? 'border-bc-text bg-bc-text text-bc-canvas' : 'border-bc-border text-bc-muted hover:text-bc-text'
                  }`}
                >
                  <Icon size={16} aria-hidden="true" />
                  {pick(t.label, language)}
                  {on && auto && inView && !reduce ? (
                    <motion.span
                      key={`${tab}-bar`}
                      aria-hidden="true"
                      className="absolute bottom-0 start-0 h-[3px] bg-bc-accent"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: ADVANCE_MS / 1000, ease: 'linear' }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          {!reduce ? (
            <button
              type="button"
              onClick={() => setAuto((a) => !a)}
              aria-label={auto ? (he ? 'עצירת ההחלפה האוטומטית' : 'Pause auto-advance') : (he ? 'הפעלת ההחלפה האוטומטית' : 'Play auto-advance')}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-bc-border text-bc-muted hover:text-bc-text ${focusClass}`}
            >
              {auto ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            </button>
          ) : null}
          </div>
          <div id="app-tabpanel" role="tabpanel" aria-labelledby={`app-tab-${tab}`} tabIndex={0} className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--bc-accent)]">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
              <h2 className="mt-8 font-choice font-medium text-[34px] sm:text-[52px] leading-[1.06] text-bc-text">{pick(current.title, language)}</h2>
              <p className="mt-4 text-[18px] sm:text-[20px] font-semibold text-bc-muted max-w-lg">{pick(current.line, language)}</p>
            </motion.div>
          </AnimatePresence>
          </div>
        </div>
        <div className="flex justify-center rounded-bc-card py-10" style={{ backgroundColor: 'var(--scene-bg)' }}>
          <PhoneFrame label={pick(current.label, language)}>
            <AnimatePresence mode="wait">
              <motion.div key={tab} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <AppScreen screen={tab} language={language} />
              </motion.div>
            </AnimatePresence>
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}
