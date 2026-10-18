import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { CouchScene } from './Illustrations';

// "On your side": the human parts of the app, recreated from BetterApp main.
// StreakFlame (header pill + milestone celebration), ScoreRings (health and
// goal fit, with the no-guilt "plan twin" chip) and DayCompleteCelebration.
// Dark app palette, as the app ships.

const APP = {
  base: '#121915',
  s1: '#1A241F',
  border: '#3E4F47',
  text: '#EEF3F0',
  muted: '#9FB3A8',
  accent: '#81C784',
  fat: '#FF9F0A',
  fatBg: 'rgba(255,149,0,.15)',
  info: '#60A5FA',
  infoBg: 'rgba(59,130,246,.1)',
  infoBorder: 'rgba(59,130,246,.2)',
};
const SYS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Arial, sans-serif';

const copy = {
  hebrew: {
    eyebrow: 'בצד שלכם',
    title: 'אפליקציה שמפרגנת.',
    body: 'רצף שגדל איתכם, חגיגה כשסוגרים יום, וציון שלא שופט. גם ארוחה שלא מהתפריט נחשבת, אם היא בול במטרה.',
    streakTitle: (n) => `${n} ימים ברצף!`,
    streakBody: 'אתם בוערים. המשיכו ככה!',
    health: 'בריאות',
    goal: 'התאמה למטרה',
    twin: '🎯 תאום תפריט: מחוץ לתפריט, בול במטרה',
    perfect: 'יום מושלם!',
    perfectBody: 'תיעדתם את כל הארוחות להיום. עקביות היא המפתח להצלחה.',
    streakBadge: (n) => `${n} ימי רצף 🔥`,
    cont: 'המשך',
    cards: [
      ['רצף יומי', 'כל יום שמתעדים מוסיף להבה. ביום ה-3, ה-7, ה-14 וה-30 חוגגים.'],
      ['ציון לכל ארוחה', 'בריאות והתאמה למטרה, מ-1 עד 10. בלי אשמה, גם כשיצאתם מהתפריט.'],
      ['יום מושלם', 'סגרתם את כל הארוחות של היום? האפליקציה חוגגת איתכם.'],
    ],
  },
  english: {
    eyebrow: 'On your side',
    title: 'An app that cheers you on.',
    body: 'A streak that grows with you, a celebration when you close the day, and a score that never judges. Even an off-menu meal counts if it hits your target.',
    streakTitle: (n) => `${n}-day streak!`,
    streakBody: "You're on fire. Keep it going!",
    health: 'Health',
    goal: 'Goal fit',
    twin: '🎯 Plan twin: off-menu, on target',
    perfect: 'Perfect Day!',
    perfectBody: 'You logged every planned meal today. Consistency is the key to success.',
    streakBadge: (n) => `${n} day streak 🔥`,
    cont: 'Continue',
    cards: [
      ['Daily streak', 'Every day you log adds a flame. Days 3, 7, 14 and 30 get a celebration.'],
      ['A score for every meal', 'Health and goal fit, 1 to 10. No guilt, even when you go off-menu.'],
      ['Perfect day', 'Closed every meal today? The app celebrates with you.'],
    ],
  },
};

function useLoop(ref, ms) {
  // A tick that restarts each time the card scrolls into view.
  const reduce = useReducedMotion();
  const inView = useInView(ref, { amount: 0.5 });
  const [on, setOn] = useState(!!reduce);
  useEffect(() => {
    if (reduce) { setOn(true); return undefined; }
    if (!inView) { setOn(false); return undefined; }
    const id = setTimeout(() => setOn(true), ms);
    return () => clearTimeout(id);
  }, [inView, reduce, ms]);
  return on;
}

/* ---------- StreakFlame pill (header) ---------- */

export function StreakPill({ count, pop = false, size = 1 }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      animate={pop && !reduce ? { scale: [1, 1.45, 1], rotate: [0, -16, 16, 0] } : { scale: 1 }}
      transition={{ duration: 0.6 }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 * size, borderRadius: 999, padding: `${4 * size}px ${10 * size}px`, backgroundColor: APP.fatBg, color: APP.fat, fontSize: 15 * size, fontWeight: 800, fontFamily: SYS, fontVariantNumeric: 'tabular-nums' }}
    >
      <motion.span
        animate={reduce ? {} : { scale: [1, 1.12, 0.96, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        style={{ display: 'inline-block', fontSize: 16 * size }}
      >
        🔥
      </motion.span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={count} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}>
          {count}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

function StreakCard({ c }) {
  const ref = useRef(null);
  const on = useLoop(ref, 900);
  const n = on ? 7 : 6;
  return (
    <div ref={ref} className="flex h-full flex-col items-center justify-center gap-4 p-5">
      <StreakPill count={n} pop={on} size={1.4} />
      <AnimatePresence>
        {on ? (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 16, stiffness: 160, delay: 0.35 }}
            style={{ width: '100%', backgroundColor: APP.s1, border: `1px solid ${APP.border}`, borderRadius: 24, padding: 16, textAlign: 'center' }}
          >
            <p style={{ margin: 0, fontSize: 30 }}>🔥</p>
            <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 800, color: APP.text }}>{c.streakTitle(n)}</p>
            <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 600, color: APP.muted }}>{c.streakBody}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ---------- ScoreRings ---------- */

function ScoreRing({ score, color, emoji, label, on, delay }) {
  const SIZE = 104, STROKE = 10, R = (SIZE - STROKE) / 2, C = 2 * Math.PI * R;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} aria-hidden="true">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE} fill="none" />
          <motion.circle
            cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={color} strokeWidth={STROKE} fill="none" strokeLinecap="round"
            strokeDasharray={C} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: on ? C * (1 - score / 10) : C }}
            transition={{ duration: 0.8, ease: 'easeOut', delay }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'center', paddingTop: 34 }} dir="ltr">
          <span style={{ fontSize: 32, fontWeight: 800, color: APP.text }}>{score}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: APP.muted }}>/10</span>
        </div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: APP.text }}>{emoji} {label}</span>
    </div>
  );
}

function ScoreCard({ c }) {
  const ref = useRef(null);
  const on = useLoop(ref, 400);
  return (
    <div ref={ref} className="flex h-full flex-col items-center justify-center gap-4 p-5">
      <div style={{ display: 'flex', gap: 22 }}>
        <ScoreRing score={8.5} color={APP.accent} emoji="🌿" label={c.health} on={on} delay={0} />
        <ScoreRing score={9} color={APP.info} emoji="🎯" label={c.goal} on={on} delay={0.35} />
      </div>
      <motion.span
        initial={{ opacity: 0, y: 6 }}
        animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ delay: 1.2, duration: 0.4 }}
        style={{ borderRadius: 999, padding: '6px 12px', backgroundColor: APP.infoBg, border: `1px solid ${APP.infoBorder}`, color: APP.info, fontSize: 13, fontWeight: 700, textAlign: 'center' }}
      >
        {c.twin}
      </motion.span>
    </div>
  );
}

/* ---------- DayCompleteCelebration ---------- */

const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  x: (i * 37) % 100,
  d: (i % 6) * 0.18,
  c: ['#81C784', '#FF9F0A', '#60A5FA', '#AF52DE', '#F4D35E'][i % 5],
  r: (i * 47) % 360,
}));

function PerfectCard({ c }) {
  const ref = useRef(null);
  const on = useLoop(ref, 500);
  const reduce = useReducedMotion();
  return (
    <div ref={ref} className="relative flex h-full items-center justify-center overflow-hidden p-5" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      {on && !reduce
        ? CONFETTI.map((p, i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              initial={{ y: -20, opacity: 1, rotate: 0 }}
              animate={{ y: 360, opacity: [1, 1, 0], rotate: p.r }}
              transition={{ duration: 2.4, delay: p.d, ease: 'easeIn' }}
              style={{ position: 'absolute', top: 0, left: `${p.x}%`, width: 8, height: 12, borderRadius: 2, backgroundColor: p.c }}
            />
          ))
        : null}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={on ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
        transition={{ type: 'spring', damping: 16, stiffness: 160, delay: 0.2 }}
        style={{ width: '100%', backgroundColor: APP.s1, border: `1px solid ${APP.border}`, borderRadius: 32, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
      >
        <span style={{ fontSize: 40, marginBottom: -6 }}>🌟</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: APP.text }}>{c.perfect}</span>
        <span style={{ fontSize: 14, lineHeight: '20px', color: APP.muted, textAlign: 'center' }}>{c.perfectBody}</span>
        <span style={{ backgroundColor: APP.base, borderRadius: 20, padding: '6px 14px', fontSize: 14, fontWeight: 700, color: APP.text }}>{c.streakBadge(7)}</span>
        <span style={{ alignSelf: 'stretch', textAlign: 'center', backgroundColor: '#34C759', color: '#1C1C1E', borderRadius: 24, padding: '11px 0', fontSize: 15, fontWeight: 800 }}>{c.cont}</span>
      </motion.div>
    </div>
  );
}

/* ---------- section ---------- */

export default function OnYourSide({ language }) {
  const c = copy[language] || copy.english;
  const he = language === 'hebrew';
  const sceneRef = useRef(null);
  const sceneOn = useLoop(sceneRef, 1200);
  const Cards = [StreakCard, ScoreCard, PerfectCard];

  return (
    <section className="bg-bc-band border-t border-bc-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
        <div className="grid lg:grid-cols-[1fr_1.15fr] gap-10 lg:gap-14 items-center">
          <div>
            <p className="inline-flex rounded-full border border-bc-border px-3 py-1 text-[13px] font-bold text-bc-accent-text">{c.eyebrow}</p>
            <h2 className="mt-6 font-choice font-medium text-[36px] sm:text-[56px] leading-[1.04] text-bc-text">{c.title}</h2>
            <p className="mt-5 text-[18px] sm:text-[20px] font-semibold text-bc-muted max-w-lg">{c.body}</p>
          </div>
          <div ref={sceneRef} className="relative overflow-hidden rounded-[40px] border border-bc-border aspect-[8/5]">
            <CouchScene className="absolute inset-0 h-full w-full" />
            {/* the streak pops above the phone in the scene */}
            <motion.div
              className="absolute"
              style={{ left: '29%', top: '44%' }}
              initial={{ opacity: 0, y: 10 }}
              animate={sceneOn ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 14, stiffness: 160 }}
              dir="ltr"
            >
              <StreakPill count={sceneOn ? 12 : 11} pop={sceneOn} size={1.3} />
            </motion.div>
          </div>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {Cards.map((Card, i) => (
            <div key={c.cards[i][0]} className="rounded-bc-card border border-bc-border bg-bc-surface overflow-hidden">
              <div className="h-[300px]" style={{ backgroundColor: APP.base, fontFamily: SYS }} dir={he ? 'rtl' : 'ltr'}>
                <Card c={c} />
              </div>
              <div className="p-6">
                <h3 className="font-choice font-medium text-[22px] text-bc-text">{c.cards[i][0]}</h3>
                <p className="mt-2 text-[16px] font-semibold text-bc-muted">{c.cards[i][1]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
