import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Moon, Sun, Sunrise, Sunset } from 'lucide-react';
import { PhoneFrame } from '../PhoneFrame';
import { focusClass } from '../../../components/brand/ui';

// "Ask anything, any hour": the coach in the app's chat style (dark, green user
// bubbles, assistant bubbles with the mark). Four moments of one day, each a
// photo or a question and a clear verdict. The status-bar clock shows the hour.
// Each conversation plays once; the day advances on its own once, then stops.
// Values are illustrative.

const APP = { bg: '#121915', s1: '#1A241F', s2: '#2E3A34', border: '#3E4F47', text: '#EEF3F0', muted: '#9FB3A8', accent: '#81C784' };
const SYS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Arial, sans-serif';
const MARK = 'M-229,-132 L-229,132 L0,265 L229,132 L229,-132 L0,-265 L-84,-216.5 L-84,-146.5 L0,-195 L169,-97.5 L169,97.5 L0,195 L-169,97.5 L-169,-167.5 Z';
const img = (n) => `${process.env.PUBLIC_URL || ''}/chat/${n}.webp`;

const MOMENTS = [
  {
    time: '07:12', icon: Sunrise, photo: 'pancakes', tone: 'yes',
    label: { hebrew: 'בוקר', english: 'Morning' },
    ask: { hebrew: 'לאכול את זה?', english: 'Should I eat this?' },
    reply: {
      hebrew: 'כן! שלושה פנקייקים בננה הם בערך 420 קק״ל ו-14 ג׳ חלבון. הוסיפו כף יוגורט חלבון ליד ותגיעו ל-30 ג׳ חלבון לבוקר.',
      english: 'Yes! Three banana pancakes are about 420 kcal and 14 g of protein. Add a spoon of protein yogurt on the side and breakfast hits 30 g of protein.',
    },
    verdict: { hebrew: 'כן, עם יוגורט ליד', english: 'Yes, with yogurt on the side' },
  },
  {
    time: '13:40', icon: Sun, photo: 'pasta', tone: 'half',
    label: { hebrew: 'צהריים', english: 'Lunch' },
    ask: { hebrew: 'אני במסעדה. להזמין את זה?', english: 'I’m at a restaurant. Order this?' },
    reply: {
      hebrew: 'אפשר, בחצי. מנת פסטה פסטו במסעדה היא כ-900 קק״ל. בקשו חצי מנה וסלט בצד, ותישארו ביעד היום.',
      english: 'Sure, half of it. A restaurant pesto pasta is around 900 kcal. Ask for a half portion and a side salad, and you stay on target today.',
    },
    verdict: { hebrew: 'חצי מנה + סלט', english: 'Half portion + salad' },
  },
  {
    time: '19:05', icon: Sunset, photo: 'chicken', tone: 'add',
    label: { hebrew: 'ערב', english: 'Evening' },
    ask: { hebrew: 'ארוחת ערב. זה מספיק?', english: 'Dinner. Is this enough?' },
    reply: {
      hebrew: 'חלבון מצוין, 52 ג׳. אבל אחרי האימון של היום חסרה פחמימה: הוסיפו שני תפוחי אדמה קטנים או פרוסת לחם מלא.',
      english: 'Great protein, 52 g. But after today’s workout you’re short on carbs: add two small potatoes or a slice of wholegrain bread.',
    },
    verdict: { hebrew: 'להוסיף פחמימה', english: 'Add some carbs' },
  },
  {
    time: '23:47', icon: Moon, photo: null, tone: 'ok',
    label: { hebrew: 'לילה', english: 'Night' },
    ask: { hebrew: 'אכלתי חצי מגש פיצה. הרסתי את הדיאטה?', english: 'I ate half a pizza tray. Did I ruin my diet?' },
    reply: {
      hebrew: 'ממש לא! חרגת היום ב-250 קק״ל, וזה בסדר. השבוע עמדת ביעד 5 ימים מתוך 6, אז ההתקדמות שלך ממשיכה.',
      english: 'Not at all! You’re 250 kcal over today, and that’s fine. You hit your target 5 of 6 days this week, so you’re still on track.',
    },
    verdict: { hebrew: 'עדיין במסלול', english: 'Still on track' },
  },
];
const TONE = { yes: ['✓', '#34C759'], half: ['◐', '#F7B733'], add: ['+', '#60A5FA'], ok: ['✓', '#34C759'] };

const copy = {
  hebrew: {
    eyebrow: 'מאמן AI · 24 שעות ביממה',
    title: 'שואלים כל דבר. בכל שעה.',
    body: 'מצלמים מנה ושואלים: לאכול או לא? מאמן ה-AI מכיר את התפריט, את היום ואת היעד שלכם, ועונה תוך שניות. גם בחצות.',
    online: 'מאמן AI · זמין 24/7',
    checking: 'בודק את היום שלך…',
    type: 'שאלו כל דבר…',
    day: 'יום אחד עם מאמן ה-AI',
  },
  english: {
    eyebrow: 'AI coach, 24/7',
    title: 'Ask anything. Any hour.',
    body: 'Snap a dish and ask: eat it or not? The AI coach knows your plan, your day and your goal, and answers in seconds. Even at midnight.',
    online: 'AI coach · available 24/7',
    checking: 'Checking your day…',
    type: 'Ask anything…',
    day: 'One day with the AI coach',
  },
};
const pick = (o, language) => (o ? o[language] || o.english : '');

function Avatar({ size = 30 }) {
  return (
    <span className="flex flex-none items-center justify-center rounded-full" style={{ width: size, height: size, backgroundColor: APP.s2 }}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="-300 -300 600 600" aria-hidden="true"><path d={MARK} fill="none" stroke={APP.accent} strokeWidth="42" /></svg>
    </span>
  );
}

function Conversation({ m, language, play }) {
  const c = copy[language] || copy.english;
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(reduce || !play ? 4 : 0); // 1 photo, 2 question, 3 typing, 4 answer
  useEffect(() => {
    if (reduce || !play) { setStage(4); return undefined; }
    setStage(0);
    const t = [setTimeout(() => setStage(1), 250), setTimeout(() => setStage(2), m.photo ? 950 : 300), setTimeout(() => setStage(3), 1500), setTimeout(() => setStage(4), 2900)];
    return () => t.forEach(clearTimeout);
  }, [m, play, reduce]);
  const pop = { initial: { opacity: 0, y: 12, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { type: 'spring', damping: 18, stiffness: 220 } };
  const [mark, color] = TONE[m.tone];
  return (
    <div className="flex flex-col gap-2.5 px-3 pt-3">
      {/* user: photo, then the question (end side) */}
      {m.photo && stage >= 1 ? (
        <motion.img {...pop} src={img(m.photo)} alt="" draggable={false}
          className="self-end w-[64%] rounded-[18px] object-cover" style={{ aspectRatio: '4 / 3', borderEndEndRadius: 6, border: `3px solid ${APP.accent}` }} />
      ) : null}
      {stage >= 2 ? (
        <motion.p {...pop} className="self-end max-w-[80%] px-3.5 py-2.5 text-[13px] font-semibold leading-snug"
          style={{ backgroundColor: APP.accent, color: APP.bg, borderRadius: 18, borderEndEndRadius: 6 }}>
          {pick(m.ask, language)}
        </motion.p>
      ) : null}
      {/* coach: typing, then the answer and the verdict */}
      {stage === 3 ? (
        <motion.div {...pop} className="flex items-center gap-2">
          <Avatar size={26} />
          <span className="flex items-center gap-1 rounded-[16px] px-3 py-2" style={{ backgroundColor: APP.s1, border: `1px solid ${APP.border}` }}>
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: APP.muted }} animate={{ y: [0, -3, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
            ))}
            <span className="ms-1.5 text-[10px] font-bold" style={{ color: APP.muted }}>{c.checking}</span>
          </span>
        </motion.div>
      ) : null}
      {stage >= 4 ? (
        <motion.div {...pop} className="flex items-start gap-2">
          <Avatar size={26} />
          <div className="max-w-[84%]">
            <p className="px-3.5 py-2.5 text-[13px] leading-snug" style={{ backgroundColor: APP.s1, color: APP.text, border: `1px solid ${APP.border}`, borderRadius: 18, borderEndStartRadius: 6 }}>
              {pick(m.reply, language)}
            </p>
            <motion.span className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-extrabold"
              style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
              initial={reduce ? false : { opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 11, stiffness: 260, delay: reduce ? 0 : 0.5 }}>
              <span aria-hidden="true">{mark}</span>{pick(m.verdict, language)}
            </motion.span>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}

export default function CoachChat({ language }) {
  const c = copy[language] || copy.english;
  const he = language === 'hebrew';
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.45 });
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const [started, setStarted] = useState(false);
  useEffect(() => { if (inView) setStarted(true); }, [inView]);

  // Walk through the day once (each conversation, then a pause), then stop.
  useEffect(() => {
    if (!auto || !inView || reduce || i >= MOMENTS.length - 1) return undefined;
    const id = setTimeout(() => setI((n) => n + 1), 6500);
    return () => clearTimeout(id);
  }, [auto, inView, reduce, i]);

  const m = MOMENTS[i];
  return (
    <section ref={ref} className="bg-bc-band border-t border-bc-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-bc-border px-3 py-1 text-[13px] font-bold text-bc-accent-text">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bc-accent opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-bc-accent" />
            </span>
            {c.eyebrow}
          </p>
          <h2 className="mt-6 font-choice font-medium text-[36px] sm:text-[56px] leading-[1.04] text-bc-text">{c.title}</h2>
          <p className="mt-5 text-[18px] sm:text-[20px] font-semibold text-bc-muted max-w-lg">{c.body}</p>
          <p className="mt-8 text-[13px] font-bold text-bc-text">{c.day}</p>
          <div className="mt-3 grid grid-cols-4 gap-2 max-w-md" role="group" aria-label={c.day}>
            {MOMENTS.map((x, k) => {
              const Icon = x.icon;
              const on = k === i;
              return (
                <button key={x.time} type="button" aria-pressed={on} onClick={() => { setAuto(false); setI(k); }}
                  className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[18px] border text-[12px] font-bold transition-colors ${focusClass} ${on ? 'border-bc-accent bg-[var(--bc-accent-well)] text-bc-text' : 'border-bc-border text-bc-muted hover:text-bc-text'}`}>
                  <Icon size={18} aria-hidden="true" className={on ? 'text-bc-accent-text' : ''} />
                  <span className="text-[15px] font-extrabold tabular-nums" dir="ltr">{x.time}</span>
                  <span>{pick(x.label, language)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center rounded-bc-card py-8" style={{ backgroundColor: 'var(--scene-bg)' }}>
          <PhoneFrame label={`${pick(m.ask, language)} ${pick(m.verdict, language)}`} className="!w-[min(300px,82vw)] lg:!w-[300px]">
            <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ backgroundColor: APP.bg, fontFamily: SYS }} dir={he ? 'rtl' : 'ltr'} aria-hidden="true">
              {/* status bar: the hour of the question */}
              <div className="flex flex-none items-center justify-between px-[8%] text-white" style={{ height: '6.7%' }} dir="ltr">
                <AnimatePresence mode="wait">
                  <motion.span key={m.time} className="text-[11px] font-semibold tabular-nums" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}>{m.time}</motion.span>
                </AnimatePresence>
                <span className="flex items-center gap-1">
                  <svg width="14" height="9" viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="7" width="3" height="3" rx=".7" /><rect x="4.3" y="5" width="3" height="5" rx=".7" /><rect x="8.6" y="2.5" width="3" height="7.5" rx=".7" /><rect x="12.9" y="0" width="3" height="10" rx=".7" /></svg>
                  <svg width="20" height="10" viewBox="0 0 24 11" fill="none"><rect x=".5" y=".5" width="20" height="10" rx="3" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="15" height="7" rx="1.6" fill="currentColor" /></svg>
                </span>
              </div>
              {/* chat header */}
              <div className="flex flex-none items-center gap-2.5 px-3 py-2.5" style={{ borderBottom: `1px solid ${APP.border}` }}>
                <Avatar size={34} />
                <div>
                  <p className="text-[14px] font-extrabold" style={{ color: APP.text }}>{he ? 'מאמן ה-AI שלך' : 'Your AI coach'}</p>
                  <p className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: '#34C759' }}>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />{c.online}
                  </p>
                </div>
              </div>
              {/* the conversation */}
              <div className="min-h-0 flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div key={m.time} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                    <Conversation m={m} language={language} play={started} />
                  </motion.div>
                </AnimatePresence>
              </div>
              {/* composer */}
              <div className="flex flex-none items-center gap-2 px-3 pb-5 pt-2" style={{ borderTop: `1px solid ${APP.border}` }}>
                <span className="flex-1 rounded-[20px] px-3 py-2 text-[12px]" style={{ backgroundColor: APP.s1, border: `1px solid ${APP.border}`, color: APP.muted }}>{c.type}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: '#6366F1' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                </span>
              </div>
            </div>
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}
