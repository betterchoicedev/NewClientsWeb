import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Lockup } from '../../../components/brand/Logo';

// Live vector recreations of BetterApp screens in dark mode, as the app ships.
// Sizes, colors and strings follow BetterApp main (NAV_THEME dark, ScreenHeader,
// NutritionHeroCard, NutritionMealSection, BottomTabBar, training.tsx,
// ai-chat.tsx, MealPlanTab). Drawn at the real 393pt width, then scaled to the
// phone frame. Numbers are an example day.

const W = 393;
const H = 795; // app area below the iPhone status bar
const STATUS = 57;

const APP = {
  base: '#121915',
  s1: '#1A241F',
  s2: '#2E3A34',
  border: '#3E4F47',
  text: '#EEF3F0',
  muted: '#9FB3A8',
  accent: '#81C784',
  green: '#34C759',
  protein: '#AF52DE',
  carbs: '#0A84FF',
  fat: '#FF9F0A',
  proteinBg: 'rgba(175,82,222,.15)',
  carbsBg: 'rgba(10,132,255,.15)',
  fatBg: 'rgba(255,149,0,.15)',
};
const SYS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Arial, sans-serif';

const T = {
  hebrew: {
    nutrition: 'תזונה', dailyLog: 'יומן יומי', mealPlan: 'תוכנית תזונה', today: 'היום',
    remaining: 'נותר', protein: 'חלבון', carbs: 'פחמימות', fat: 'שומן',
    breakfast: 'ארוחת בוקר', lunch: 'ארוחת צהריים', dinner: 'ארוחת ערב', snacks: 'חטיפים',
    tapToLog: 'הקש כדי להוסיף פריט', items: (n, k) => `${n} רכיבים • ${k} קק״ל`,
    mealsLogged: (a, b) => `${a} מתוך ${b} ארוחות תועדו`,
    training: 'תוכנית אימונים', trainingDays: 'ימי אימון', trainingHint: 'ראשון · שלישי · חמישי', edit: 'עריכה',
    todayWorkout: 'האימון של היום', pull: 'משיכה', sets: 'סטים', exercises: 'תרגילים', planned: 'תרגילים מתוכננים',
    kg: 'ק״ג', days: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'],
    ex: [['מתח (משקל גוף או עזרה)', '4 סטים  /  8-10 חזרות'], ['חתירה בכבל בישיבה', '4 סטים  /  10-12 חזרות'], ['פייס פולס', '3 סטים  /  12-15 חזרות'], ['כפיפת מרפקים במשקולות', '4 סטים  /  10 חזרות']],
    chat: 'צ׳אט AI', ask: 'מה כדאי לי לאכול בארוחה הבאה?',
    reply: 'נשארו לך היום 900 קק״ל ו-48 ג׳ חלבון. משהו עשיר בחלבון יסגור את היום: דג על הגריל (150 ג׳), קינואה (100 ג׳) וסלט ירוק.',
    breakdown: 'פירוט תזונתי', bProtein: 'חלבון', bCarbs: 'פחמימות', bFat: 'שומן',
    thinking: 'חושב...', notMedical: 'זו אינה עצה רפואית', type: 'הקלידי הודעה...',
    target: 'סה״כ קלוריות יעד', kcalUnit: 'קק״ל', ranges: ['ראשון–חמישי', 'שישי', 'שבת'],
    planMeals: [
      ['ארוחת בוקר', 'יוגורט עם גרנולה ופירות יער', 420, 28, 52, 11],
      ['ארוחת צהריים', 'חזה עוף, אורז ובטטה', 620, 48, 70, 14],
      ['ארוחת ערב', 'סלמון עם ירקות צלויים', 560, 40, 30, 28],
      ['חטיפים', 'תפוח וחמאת בוטנים', 220, 6, 24, 12],
    ],
    alt: 'אפשרויות החלפה', alts: ['טופו במקום עוף', 'קינואה במקום אורז'],
  },
  english: {
    nutrition: 'Nutrition', dailyLog: 'Daily Log', mealPlan: 'Meal Plan', today: 'Today',
    remaining: 'REMAINING', protein: 'PROTEIN', carbs: 'CARBS', fat: 'FAT',
    breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks',
    tapToLog: 'Tap to log food', items: (n, k) => `${n} items • ${k} kcal`,
    mealsLogged: (a, b) => `${a} of ${b} meals logged`,
    training: 'Training Plan', trainingDays: 'Training days', trainingHint: 'Sun · Tue · Thu', edit: 'Edit',
    todayWorkout: "TODAY'S WORKOUT", pull: 'Pull', sets: 'SETS', exercises: 'EXERCISES', planned: 'Planned Exercises',
    kg: 'kg', days: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    ex: [['Pull-ups (Weighted or Assisted)', '4 SETS  /  8-10 REPS'], ['Seated Cable Row', '4 SETS  /  10-12 REPS'], ['Face Pulls', '3 SETS  /  12-15 REPS'], ['Dumbbell Curls', '4 SETS  /  10 REPS']],
    chat: 'AI Chat', ask: 'What should I eat for my next meal?',
    reply: 'You have 900 kcal and 48 g of protein left today. Something protein-rich closes the day: grilled fish (150 g), quinoa (100 g) and a green salad.',
    breakdown: 'NUTRITIONAL BREAKDOWN', bProtein: 'Protein', bCarbs: 'Carbs', bFat: 'Fat',
    thinking: 'ANALYZING...', notMedical: 'Not medical advice', type: 'Type a message...',
    target: 'Daily Calorie Target', kcalUnit: 'kcal', ranges: ['Sunday–Thursday', 'Friday', 'Saturday'],
    planMeals: [
      ['BREAKFAST', 'Yogurt, granola and berries', 420, 28, 52, 11],
      ['LUNCH', 'Chicken breast, rice and sweet potato', 620, 48, 70, 14],
      ['DINNER', 'Salmon with roasted vegetables', 560, 40, 30, 28],
      ['SNACKS', 'Apple and peanut butter', 220, 6, 24, 12],
    ],
    alt: 'Alternative Options', alts: ['Tofu instead of chicken', 'Quinoa instead of rice'],
  },
};

/* ---------- icons (MaterialCommunityIcons / Ionicons look-alikes) ---------- */

const Svg = ({ size = 24, color = APP.text, sw = 2, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const Sun = (p) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>;
const SunHalf = (p) => <Svg {...p}><path d="M12 7a5 5 0 0 0 0 10z" fill={p.color || APP.text} /><circle cx="12" cy="12" r="5" /><path d="M12 1v3M12 20v3M1 12h3M20 12h3" /></Svg>;
const Moon = (p) => <Svg {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></Svg>;
const Apple = (p) => <Svg {...p}><path d="M12 7c-2-2.5-7-1.5-7 3.5 0 5 3.5 9.5 7 9.5s7-4.5 7-9.5C19 5.5 14 4.5 12 7z" /><path d="M12 7c0-2 1-3.5 3-4" /></Svg>;
const Plus = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
const Chevron = ({ dir = 'down', ...p }) => <Svg {...p}><path d={{ down: 'M6 9l6 6 6-6', up: 'M6 15l6-6 6 6', left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6' }[dir]} /></Svg>;
const Barbell = (p) => <Svg {...p}><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" /></Svg>;
const Chats = (p) => <Svg {...p}><path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /><path d="M17 9h3a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2v3l-3-3h-4" /></Svg>;
const Menu = (p) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>;
const Drop = ({ size = 28, color = '#007AFF' }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z" fill={color} /></svg>;
const MARK = 'M-229,-132 L-229,132 L0,265 L229,132 L229,-132 L0,-265 L-84,-216.5 L-84,-146.5 L0,-195 L169,-97.5 L169,97.5 L0,195 L-169,97.5 L-169,-167.5 Z';

/* ---------- shared chrome ---------- */

// Steps through a short storyboard each time the screen comes into view.
// Reduced motion shows the final frame.
function useStep(ref, timeline) {
  const reduce = useReducedMotion();
  const inView = useInView(ref, { amount: 0.4 });
  const [step, setStep] = useState(reduce ? timeline.length : 0);
  useEffect(() => {
    if (reduce) { setStep(timeline.length); return undefined; }
    if (!inView) return undefined;
    setStep(0);
    const ids = timeline.map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => ids.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce]);
  return step;
}

function Header({ title, he, streak = 6 }) {
  return (
    <div style={{ minHeight: 44, padding: '6px 16px 8px', borderBottom: `1px solid ${APP.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span className={he ? '' : 'font-choice'} style={he ? { fontSize: 24, fontWeight: 800, letterSpacing: -0.5 } : { fontSize: 26, fontWeight: 500 }}>{title}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} dir="ltr">
        <span style={{ borderRadius: 999, padding: '4px 10px', backgroundColor: APP.fatBg, color: APP.fat, fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
          <motion.span animate={{ scale: [1, 1.12, 0.96, 1] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ fontSize: 15, display: 'inline-block' }}>🔥</motion.span>
          {streak}
        </span>
        <span style={{ '--bc-text': APP.muted, '--bc-accent': APP.accent, display: 'flex' }}>
          <Lockup height={20} />
        </span>
      </div>
    </div>
  );
}

function Segmented({ a, b, active = 0 }) {
  return (
    <div style={{ margin: '12px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: APP.s2, borderRadius: 16, padding: 4 }}>
      {[a, b].map((label, i) => (
        <span key={label} style={{ padding: '10px 0', textAlign: 'center', borderRadius: 12, fontSize: 15, fontWeight: 700, backgroundColor: i === active ? APP.s1 : 'transparent', color: i === active ? APP.text : APP.muted }}>
          {label}
        </span>
      ))}
    </div>
  );
}

function TabBar({ active = 0 }) {
  const c = (i) => (i === active ? APP.text : APP.muted);
  return (
    <div style={{ position: 'absolute', left: 20, right: 20, bottom: 46, height: 64, borderRadius: 32, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', backgroundColor: 'rgba(0,0,0,.4)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,.15)', borderLeft: '1px solid rgba(255,255,255,.1)', borderRight: '1px solid rgba(255,255,255,.1)', boxShadow: '0 8px 16px rgba(0,0,0,.15)' }} dir="ltr">
      <Apple size={30} color={c(0)} sw={1.6} />
      <Barbell size={30} color={c(1)} sw={1.6} />
      <span style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: APP.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
        <Plus size={36} color={APP.base} sw={2.4} />
      </span>
      <Chats size={30} color={c(3)} sw={1.6} />
      <Menu size={30} color={c(4)} sw={1.6} />
    </div>
  );
}

function Ring({ color, pct, label, value }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width="50" height="50" viewBox="0 0 50 50" aria-hidden="true">
        <circle cx="25" cy="25" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="5" />
        <motion.circle cx="25" cy="25" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} transform="rotate(-90 25 25)"
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ type: 'spring', damping: 20, stiffness: 60 }} />
      </svg>
      <span style={{ fontSize: 11, fontWeight: 700, color: APP.muted }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800 }}>{value}g</span>
    </div>
  );
}

const mealIcon = { breakfast: Sun, lunch: SunHalf, dinner: Moon, snacks: Apple };

function MealRow({ kind, title, sub, filled, index, pulse }) {
  const Icon = mealIcon[kind];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: index * 0.08 }}
      style={{ margin: '0 16px 16px', backgroundColor: APP.s1, borderRadius: 32, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(148,163,184,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={28} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{title}</p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={sub} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            style={{ fontSize: 14, fontWeight: 600, margin: 0, color: filled ? APP.muted : APP.green, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sub}
          </motion.p>
        </AnimatePresence>
      </div>
      {filled ? <Chevron size={24} color={APP.muted} /> : null}
      <motion.span animate={pulse ? { scale: [1, 0.86, 1.08, 1] } : { scale: 1 }} transition={{ duration: 0.5 }}
        style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: APP.green, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(52,199,89,.3)' }}>
        <Plus size={24} color="#FFFFFF" sw={2.4} />
      </motion.span>
    </motion.div>
  );
}

/* ---------- screens ---------- */

// Storyboard: breakfast is logged; the lunch plus is tapped, lunch fills, and
// the remaining number, rings and water move.
function Nutrition({ t, he }) {
  const ref = useRef(null);
  const step = useStep(ref, [1400, 2200]);
  const lunch = step >= 2;
  const remaining = lunch ? 900 : 1420;
  return (
    <div ref={ref}>
      <Header title={t.nutrition} he={he} />
      <Segmented a={t.dailyLog} b={t.mealPlan} />
      <div style={{ margin: '14px auto 0', width: '75%', borderRadius: 999, backgroundColor: APP.s1, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} dir="ltr">
        <span style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: 'rgba(148,163,184,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Chevron dir="left" /></span>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.4 }}>{t.today}</span>
        <span style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: 'rgba(148,163,184,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}><Chevron dir="right" /></span>
      </div>
      <div style={{ margin: '14px 16px 0', backgroundColor: APP.s1, borderRadius: 32, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: 0.5, color: APP.muted }}>{t.remaining}</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={remaining} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.35 }}
                style={{ margin: 0, fontSize: 48, fontWeight: 800, letterSpacing: -1, lineHeight: '52px' }}>{remaining}</motion.p>
            </AnimatePresence>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: APP.muted }}>kcal</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }} dir="ltr">
            <Ring color={APP.protein} pct={lunch ? 0.62 : 0.3} label={t.protein} value={lunch ? 74 : 36} />
            <Ring color={APP.carbs} pct={lunch ? 0.6 : 0.3} label={t.carbs} value={lunch ? 122 : 52} />
            <Ring color={APP.fat} pct={lunch ? 0.46 : 0.18} label={t.fat} value={lunch ? 25 : 11} />
          </div>
        </div>
        <p style={{ margin: '16px 0 0', fontSize: 13, fontWeight: 600, color: APP.muted }}>{t.mealsLogged(lunch ? 2 : 1, 4)}</p>
      </div>
      <div style={{ margin: '16px 16px 0', backgroundColor: APP.s1, borderRadius: 32, padding: 20, display: 'flex', alignItems: 'center', gap: 12 }} dir="ltr">
        <Drop />
        <div style={{ flex: 1, height: 16, borderRadius: 8, backgroundColor: 'rgba(10,132,255,.15)', overflow: 'hidden' }}>
          <motion.div initial={{ width: '0%' }} animate={{ width: lunch ? '50%' : '24%' }} transition={{ type: 'spring', damping: 20, stiffness: 60 }} style={{ height: '100%', backgroundColor: '#007AFF', borderRadius: 8 }} />
        </div>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{lunch ? 1000 : 500} ml</span>
      </div>
      <p style={{ margin: '20px 16px 12px', fontSize: 24, fontWeight: 800 }}>{t.dailyLog}</p>
      <MealRow kind="breakfast" title={t.breakfast} sub={t.items(3, 420)} filled index={0} />
      <MealRow kind="lunch" title={t.lunch} sub={lunch ? t.items(3, 520) : t.tapToLog} filled={lunch} index={1} pulse={step === 1} />
      <MealRow kind="dinner" title={t.dinner} sub={t.tapToLog} index={2} />
      <TabBar active={0} />
    </div>
  );
}

function Training({ t, he }) {
  const ref = useRef(null);
  const step = useStep(ref, [1600]);
  const trainingDays = [0, 2, 4];
  return (
    <div ref={ref}>
      <Header title={t.training} he={he} />
      <Segmented a={t.dailyLog} b={t.training} active={1} />
      <p style={{ margin: '14px 16px 8px', fontSize: 32, fontWeight: 800, letterSpacing: -1, opacity: 0.7 }}>{t.today}</p>
      <div style={{ margin: '0 16px', display: 'flex', justifyContent: 'space-between' }}>
        {t.days.map((d, i) => {
          const sel = i === 2;
          return (
            <div key={i} style={{ width: 44, height: 72, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: sel ? APP.text : 'transparent', color: sel ? APP.base : APP.text }}>
              <span style={{ fontSize: 13, fontWeight: 600, opacity: sel ? 1 : 0.7 }}>{d}</span>
              <span style={{ fontSize: 17, fontWeight: 700 }}>{11 + i}</span>
              <span style={{ width: 4, height: 4, borderRadius: 4, backgroundColor: trainingDays.includes(i) ? APP.accent : 'transparent' }} />
            </div>
          );
        })}
      </div>
      <div style={{ margin: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{t.trainingDays}</p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: APP.muted }}>{t.trainingHint}</p>
        </div>
        <span style={{ fontSize: 15, fontWeight: 800, color: APP.accent }}>{t.edit}</span>
      </div>
      <div style={{ margin: '16px 16px 0', display: 'grid', gridTemplateColumns: '2fr 1fr', borderTop: `1px solid ${APP.border}`, borderBottom: `1px solid ${APP.border}` }}>
        <div style={{ padding: '16px 0', borderInlineEnd: `1px solid ${APP.border}` }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: 0.8, color: APP.muted }}>{t.todayWorkout}</p>
          <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800 }}>{t.pull}</p>
        </div>
        <div style={{ paddingInlineStart: 14 }}>
          <p style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>15 <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0, color: APP.muted }}>{t.sets}</span></p>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>4 <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0, color: APP.muted }}>{t.exercises}</span></p>
        </div>
      </div>
      <p style={{ margin: '18px 16px 4px', fontSize: 18, fontWeight: 800 }}>{t.planned}</p>
      {t.ex.map(([n, s], i) => (
        <motion.div key={n} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05, type: 'spring', damping: 20, stiffness: 120 }}
          style={{ margin: '0 16px', padding: '14px 0', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${APP.border}` }}>
          <span style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: APP.s2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Barbell size={20} color={APP.muted} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n}</p>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: APP.muted, whiteSpace: 'pre' }}>{s}</p>
          </div>
          <span style={{ width: 72, height: 40, borderRadius: 16, border: `1px solid ${i === 0 && step >= 1 ? APP.accent : APP.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 15, fontWeight: 700, color: APP.muted, transition: 'border-color .3s', flexShrink: 0 }}>
            {i === 0 && step >= 1 ? <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: APP.text }}>10</motion.span> : null}
            {t.kg}
          </span>
        </motion.div>
      ))}
      <TabBar active={1} />
    </div>
  );
}

function Avatar({ size = 34 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 999, backgroundColor: APP.s2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="-300 -300 600 600" aria-hidden="true"><path d={MARK} fill="none" stroke={APP.accent} strokeWidth="40" /></svg>
    </span>
  );
}

// Storyboard: the question is sent, the coach thinks, the answer lands with
// its nutritional breakdown.
function Chat({ t, he }) {
  const ref = useRef(null);
  const step = useStep(ref, [500, 1900]);
  return (
    <div ref={ref}>
      <Header title={t.chat} he={he} />
      <div style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {step >= 1 ? (
          <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 16, stiffness: 140 }}
            style={{ alignSelf: 'flex-end', maxWidth: '85%', margin: 0, backgroundColor: APP.accent, color: APP.base, fontSize: 15, fontWeight: 500, lineHeight: '22px', padding: '12px 16px', borderRadius: 20, borderEndEndRadius: 8 }}>
            {t.ask}
          </motion.p>
        ) : null}
        {step === 1 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar />
            {[0, 1, 2].map((i) => (
              <motion.span key={i} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} style={{ width: 6, height: 6, borderRadius: 6, backgroundColor: APP.muted, display: 'inline-block' }} />
            ))}
            <span style={{ fontSize: 12, fontWeight: 700, color: APP.muted }}>{t.thinking}</span>
          </div>
        ) : null}
        {step >= 2 ? (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 16, stiffness: 140 }} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Avatar />
            <div style={{ maxWidth: '90%', backgroundColor: APP.s1, border: `1px solid ${APP.border}`, borderRadius: 20, borderEndStartRadius: 8, padding: '12px 14px' }}>
              <p style={{ margin: 0, fontSize: 15, lineHeight: '22px' }}>{t.reply}</p>
              <div style={{ marginTop: 10, backgroundColor: APP.s1, border: `1px solid ${APP.border}`, borderRadius: 14, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: APP.muted }}>{t.breakdown}</span>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>520 <span style={{ fontSize: 11, fontWeight: 600 }}>kcal</span></span>
                </div>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
                  {[[t.bProtein, 42], [t.bCarbs, 45], [t.bFat, 14]].map(([l, v], i) => (
                    <React.Fragment key={l}>
                      {i ? <span style={{ width: 1, height: 20, backgroundColor: APP.border }} /> : null}
                      <span style={{ textAlign: 'center' }}>
                        <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: APP.muted }}>{l}</span>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{v}g</span>
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 122, padding: '8px 16px 10px', backgroundColor: APP.base, borderTop: `1px solid ${APP.border}` }}>
        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: APP.muted }}>{t.notMedical}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, height: 44, borderRadius: 24, backgroundColor: APP.s1, border: `1px solid ${APP.border}`, padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: 16, color: APP.muted }}>{t.type}</span>
          <span style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Svg size={20} color="#fff"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Svg>
          </span>
          <span style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: '#10B981', opacity: 0.35, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Svg size={20} color="#fff" sw={2.4}><path d="M12 19V5M6 11l6-6 6 6" /></Svg>
          </span>
        </div>
      </div>
      <TabBar active={3} />
    </div>
  );
}

// Meal Plan tab: the plan built for you. Macro bars grow, meals stagger in,
// lunch opens to show its alternatives.
function Plan({ t, he }) {
  const ref = useRef(null);
  const step = useStep(ref, [1500]);
  const total = t.planMeals.reduce((s, m) => s + m[2], 0);
  const macros = [[t.protein, 122, APP.protein, APP.proteinBg], [t.carbs, 176, APP.carbs, APP.carbsBg], [t.fat, 65, APP.fat, APP.fatBg]];
  return (
    <div ref={ref}>
      <Header title={t.nutrition} he={he} />
      <Segmented a={t.dailyLog} b={t.mealPlan} active={1} />
      <div style={{ margin: '12px 16px 0', display: 'flex', gap: 8 }}>
        {t.ranges.map((r, i) => (
          <span key={r} style={{ flex: i === 0 ? 1 : '0 0 auto', minHeight: 48, padding: '0 12px', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? APP.green : APP.muted, backgroundColor: i === 0 ? 'rgba(129,199,132,.12)' : 'transparent' }}>{r}</span>
        ))}
      </div>
      <div style={{ margin: '12px 16px 0', backgroundColor: APP.s1, borderRadius: 32, padding: 20 }}>
        <p style={{ margin: 0, textAlign: 'center', fontSize: 16, fontWeight: 600, opacity: 0.8 }}>{t.target}</p>
        <p style={{ margin: '2px 0 12px', textAlign: 'center', fontSize: 48, fontWeight: 800, lineHeight: '54px' }}>{total}<span style={{ fontSize: 18, fontWeight: 600, color: APP.muted }}> {t.kcalUnit}</span></p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {macros.map(([l, v, c, bg], i) => (
            <motion.div key={l} initial={{ opacity: 0, scaleX: 0.6 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: 0.15 + i * 0.1, type: 'spring', damping: 20, stiffness: 90 }}
              style={{ transformOrigin: he ? 'right' : 'left', padding: '12px 14px', borderRadius: 16, backgroundColor: bg, display: 'flex', alignItems: 'center', gap: 10, color: c }}>
              <span style={{ width: 10, height: 10, borderRadius: 10, backgroundColor: c }} />
              <span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>{l}</span>
              <span style={{ fontSize: 18, fontWeight: 700 }} dir="ltr">{v}.0 g</span>
            </motion.div>
          ))}
        </div>
      </div>
      {t.planMeals.slice(0, 3).map(([type, title, kcal, p, c, f], i) => {
        const Icon = [Sun, SunHalf, Moon][i];
        const open = i === 1 && step >= 1;
        return (
          <motion.div key={title} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 + i * 0.08, type: 'spring', damping: 20, stiffness: 100 }}
            style={{ margin: '12px 16px 0', backgroundColor: APP.s1, borderRadius: 32, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: APP.s2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={24} color={APP.muted} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: APP.muted }}>{type}</p>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
              </div>
              <motion.span animate={{ rotate: open ? (he ? -90 : 90) : 0 }} style={{ fontSize: 22, color: APP.muted, display: 'inline-block' }}>{he ? '‹' : '›'}</motion.span>
            </div>
            <div style={{ marginTop: 8, paddingInlineStart: 62, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700 }}>
              <span style={{ backgroundColor: 'rgba(52,199,89,.15)', color: APP.accent, borderRadius: 8, padding: '3px 8px', fontSize: 12, fontWeight: 800 }}>{kcal} {t.kcalUnit}</span>
              <span style={{ color: APP.protein }}>{p}g</span>
              <span style={{ color: APP.carbs }}>{c}g</span>
              <span style={{ color: APP.fat }}>{f}g</span>
            </div>
            <AnimatePresence initial={false}>
              {open ? (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={{ duration: 0.45 }} style={{ overflow: 'hidden' }}>
                  <div style={{ marginTop: 12, borderRadius: 16, backgroundColor: 'rgba(59,130,246,.12)', color: '#60A5FA', padding: '10px 14px', fontSize: 14, fontWeight: 700 }}>
                    🔄 {t.alt}
                    {t.alts.map((a) => <p key={a} style={{ margin: '4px 0 0', fontWeight: 600 }}>● {a}</p>)}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        );
      })}
      <TabBar active={0} />
    </div>
  );
}

/* ---------- frame ---------- */

function StatusBar() {
  return (
    <div style={{ height: STATUS, padding: '6px 30px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 16, fontWeight: 600 }} dir="ltr">
      <span>9:41</span>
      <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="18" height="11" viewBox="0 0 16 10" fill="currentColor" aria-hidden="true"><rect x="0" y="7" width="3" height="3" rx=".7" /><rect x="4.3" y="5" width="3" height="5" rx=".7" /><rect x="8.6" y="2.5" width="3" height="7.5" rx=".7" /><rect x="12.9" y="0" width="3" height="10" rx=".7" /></svg>
        <svg width="26" height="12" viewBox="0 0 24 11" fill="none" aria-hidden="true"><rect x=".5" y=".5" width="20" height="10" rx="3" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="15" height="7" rx="1.6" fill="currentColor" /></svg>
      </span>
    </div>
  );
}

const SCREENS = { nutrition: Nutrition, training: Training, chat: Chat, plan: Plan };

/** One live app screen, filling a PhoneFrame's screen area. */
export function AppScreen({ screen = 'nutrition', language }) {
  const he = language === 'hebrew';
  const t = T[he ? 'hebrew' : 'english'];
  const boxRef = useRef(null);
  const [scale, setScale] = useState(0.7);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const fit = () => setScale(el.clientWidth / W);
    fit();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const Screen = SCREENS[screen] || Nutrition;
  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden" style={{ backgroundColor: APP.base }} aria-hidden="true" dir="ltr">
      <div style={{ width: W, height: H + STATUS, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'relative', color: APP.text, fontFamily: SYS, backgroundColor: APP.base }} dir={he ? 'rtl' : 'ltr'}>
        <StatusBar />
        <Screen t={t} he={he} />
      </div>
    </div>
  );
}
