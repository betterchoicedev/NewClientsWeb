import React, { useEffect, useRef, useState } from 'react';
import { focusClass } from '../../components/brand/ui';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Camera, ScanSearch, Ruler, Target } from 'lucide-react';
import { FOODS, TOTALS, PLAN, IS_EXAMPLE } from './scanExample';
import ScanMotion from './ScanMotion';

// The hero feature, explained: a sticky, scroll-driven stage drawn in flat
// vectors. Depth is an ILLUSTRATION of how the scan works (the app does not
// show a depth view on screen). Numbers come from scanExample.js.

const FADE = { duration: 0.4, ease: 'easeOut' };

const STEPS = [
  {
    key: 'snap',
    icon: Camera,
    label: { hebrew: 'צלמו', english: 'Snap' },
    line: {
      hebrew: 'מצלמים את הצלחת, או בוחרים תמונה מהגלריה. אפשר להוסיף מילה של הקשר.',
      english: 'Photograph your plate, or pick one from your gallery. Add a word of context if you like.',
    },
  },
  {
    key: 'identify',
    icon: ScanSearch,
    label: { hebrew: 'זיהוי', english: 'Identify' },
    line: {
      hebrew: 'ה-AI מזהה כל מזון בנפרד, סופר יחידות, ומראה מה ראה ובאיזו ודאות.',
      english: 'The AI names every food separately, counts pieces, and shows what it saw and how sure it is.',
    },
  },
  {
    key: 'measure',
    icon: Ruler,
    label: { hebrew: 'מדידה', english: 'Measure' },
    line: {
      hebrew: 'באייפון עם חיישן עומק, האפליקציה מודדת כמה האוכל מתרומם מעל הצלחת, והופכת את זה לגרמים.',
      english: 'On iPhones with a depth sensor, the app measures how high the food rises above the plate, and turns that into grams.',
    },
  },
  {
    key: 'plan',
    icon: Target,
    label: { hebrew: 'מול התוכנית שלכם', english: 'Against your plan' },
    short: { hebrew: 'התאמה', english: 'Plan fit' },
    line: {
      hebrew: 'כל ארוחה נבדקת מול התוכנית שלכם, עם טיפ לארוחה הבאה. טעיתם? מתקנים גרמים בלחיצה.',
      english: 'Every meal is checked against your plan, with a tip for the next one. Off? Fix the grams in a tap.',
    },
  },
];

const copy = {
  hebrew: {
    eyebrow: 'הסריקה',
    title: 'הסריקה שמודדת, לא מנחשת.',
    mechanism: 'ה-AI מזהה. החיישן מודד. הקוד מחשב.',
    example: 'דוגמה להמחשה',
    depthNote: 'המחשה של סריקת העומק',
    grams: 'ג׳',
    kcal: 'קק״ל',
    total: 'סה״כ',
    planFit: 'מתאים ליעד הצהריים',
    p: 'חלבון',
    c: 'פחמימות',
    f: 'שומן',
    fits: (k, t) => `${k} מתוך ${t} קק״ל`,
  },
  english: {
    eyebrow: 'The scan',
    title: 'The scan that measures, not guesses.',
    mechanism: 'The AI names it. The sensor measures it. The code does the math.',
    example: 'Illustrative example',
    depthNote: 'Illustration of the depth scan',
    grams: 'g',
    kcal: 'kcal',
    total: 'Total',
    planFit: 'Fits your lunch target',
    p: 'Protein',
    c: 'Carbs',
    f: 'Fat',
    fits: (k, t) => `${k} of ${t} kcal`,
  },
};

const pick = (o, language) => o[language] || o.english;
const fmt = (n) => (Math.round(n * 10) / 10).toString();

/* ---------- The stage (SVG plate + overlays for the current step) ---------- */

function Plate() {
  return (
    <g>
      <circle cx="200" cy="210" r="170" fill="var(--bc-surface)" stroke="var(--bc-border)" strokeWidth="2" />
      <circle cx="200" cy="210" r="140" fill="none" stroke="var(--bc-border)" strokeWidth="1.5" />
      {/* rice: a mound */}
      <path d="M78 245 Q90 165 140 160 Q192 156 198 210 Q200 252 150 258 Q100 262 78 245 Z" fill="#F3EEDC" />
      <g fill="#E4DCC2">
        {[[110, 205], [135, 190], [158, 215], [125, 232], [170, 238], [100, 228], [150, 180]].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="9" height="4" rx="2" transform={`rotate(${(x * 7) % 60 - 30} ${x} ${y})`} />
        ))}
      </g>
      {/* chicken breast */}
      <path d="M212 150 Q220 108 270 106 Q326 108 326 146 Q322 186 268 190 Q216 190 212 150 Z" fill="#D9A066" />
      <path d="M232 132 L300 126 M228 152 L306 146 M238 170 L296 166" stroke="#B97E45" strokeWidth="5" strokeLinecap="round" />
      {/* chopped salad */}
      {[
        ['#E0533D', 214, 222], ['#5BAE4B', 240, 214], ['#E0533D', 268, 226], ['#5BAE4B', 292, 240],
        ['#F2E3A0', 226, 248], ['#5BAE4B', 254, 252], ['#E0533D', 282, 264], ['#5BAE4B', 230, 276],
        ['#F2E3A0', 262, 282], ['#E0533D', 296, 286], ['#5BAE4B', 248, 296],
      ].map(([fill, x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="20" height="20" rx="4" fill={fill} transform={`rotate(${(x + y) % 40 - 20} ${x + 10} ${y + 10})`} />
      ))}
      {/* tahini */}
      <path d="M128 296 Q132 274 156 276 Q182 278 182 296 Q178 316 152 316 Q128 314 128 296 Z" fill="#E9D6AE" />
    </g>
  );
}

export function Stage({ step, language }) {
  const c = pick(copy, language);
  const reduceMotion = useReducedMotion();
  const at = (k) => STEPS.findIndex((s) => s.key === k) <= step;
  const isPlan = STEPS[step].key === 'plan';
  const showBoxes = at('identify') && !isPlan;
  const showDepth = at('measure') && !isPlan;
  const showCalc = STEPS[step].key === 'measure';
  const showCard = STEPS[step].key === 'plan';
  const rice = FOODS[0];

  return (
    <div className="relative w-full max-w-[460px] aspect-square" aria-hidden="true">
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
        <Plate />

        {/* camera frame (snap) */}
        <AnimatePresence>
          {step === 0 && (
            <motion.g key="frame" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE}
              stroke="var(--bc-accent)" strokeWidth="4" fill="none" strokeLinecap="round">
              <path d="M24 70 V28 H66" /><path d="M334 28 H376 V70" /><path d="M376 330 V372 H334" /><path d="M66 372 H24 V330" />
            </motion.g>
          )}
        </AnimatePresence>

        {/* depth bands: contour rings over mounded foods + a sweep line */}
        <AnimatePresence>
          {showDepth && (
            <motion.g key="depth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE}>
              {FOODS.filter((f) => f.mounded).map((f) => {
                const cx = f.box.x + f.box.w / 2;
                const cy = f.box.y + f.box.h / 2;
                return [0.95, 0.72, 0.5, 0.28].map((s, i) => (
                  <ellipse key={`${f.key}-${s}`} cx={cx} cy={cy + 4} rx={(f.box.w / 2) * s} ry={(f.box.h / 2) * s * 0.8}
                    fill="var(--bc-accent)" fillOpacity={0.1 + i * 0.1} stroke="var(--bc-accent)" strokeOpacity="0.8" strokeWidth="1.5" />
                ));
              })}
              {reduceMotion ? (
                <line x1="30" x2="370" y1="210" y2="210" stroke="var(--bc-accent)" strokeWidth="3" />
              ) : (
                <motion.g animate={{ y: [0, 300, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
                  <line x1="30" x2="370" y1="60" y2="60" stroke="var(--bc-accent)" strokeWidth="3" />
                </motion.g>
              )}
            </motion.g>
          )}
        </AnimatePresence>

        {/* identification boxes */}
        <AnimatePresence>
          {showBoxes && (
            <motion.g key="boxes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE}>
              {FOODS.map((f) => (
                <rect key={f.key} x={f.box.x} y={f.box.y} width={f.box.w} height={f.box.h} rx="10"
                  fill="none" stroke="var(--bc-text)" strokeWidth="2" strokeDasharray="6 5" />
              ))}
            </motion.g>
          )}
        </AnimatePresence>
      </svg>

      {/* box labels (HTML so Hebrew shapes and the font render properly) */}
      <AnimatePresence>
        {showBoxes &&
          FOODS.map((f) => (
            <motion.span key={`l-${f.key}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE}
              className="absolute -translate-y-full whitespace-nowrap rounded-full bg-bc-text px-2.5 py-1 text-[11px] font-bold text-bc-canvas"
              style={{ left: `${(f.box.x / 400) * 100}%`, top: `${(f.box.y / 400) * 100}%`, marginTop: -4 }}>
              {pick(f.name, language)} · <span dir="ltr">{f.confidence}%</span>
            </motion.span>
          ))}
      </AnimatePresence>

      {showDepth ? (
        <span className="absolute bottom-1 start-1 rounded-full bg-bc-surface border border-bc-border px-2.5 py-1 text-[11px] font-semibold text-bc-muted">
          {c.depthNote}
        </span>
      ) : null}

      {/* calculation card */}
      <AnimatePresence>
        {showCalc && (
          <motion.div key="calc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE}
            className="absolute inset-x-6 bottom-6 rounded-[24px] border border-bc-border bg-bc-surface p-5">
            <p className="text-[13px] font-semibold text-bc-muted">{pick(rice.name, language)}</p>
            <p className="mt-1 font-choice font-medium text-[26px] sm:text-[30px] text-bc-text tabular-nums" dir="ltr">
              {rice.volumeMl} ml × {rice.density} = <span className="text-bc-accent-text">{rice.grams} g</span>
            </p>
            <p className="mt-1 text-[12px] font-semibold text-bc-muted">
              {language === 'hebrew' ? 'נפח מהעומק × צפיפות האורז' : 'volume from depth × rice density'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* result card */}
      <AnimatePresence>
        {showCard && (
          <motion.div key="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE}
            className="absolute inset-3 sm:inset-5 rounded-[28px] border border-bc-border bg-bc-surface p-4 sm:p-5 flex flex-col">
            <ul className="divide-y divide-bc-border">
              {FOODS.map((f) => (
                <li key={f.key} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-[14px] font-bold text-bc-text">{pick(f.name, language)}</span>
                  <span className="text-[13px] font-semibold text-bc-muted tabular-nums" dir="ltr">
                    {f.grams} g · {f.kcal} kcal
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-3 border-t border-bc-border">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-bold text-bc-muted">{c.total}</span>
                <span className="font-choice font-medium text-[24px] text-bc-text tabular-nums" dir="ltr">{TOTALS.kcal} kcal</span>
              </div>
              <div className="mt-2 flex gap-2 text-[12px] font-bold">
                {[['p', 'protein'], ['c', 'carbs'], ['f', 'fat']].map(([k, v]) => (
                  <span key={k} className="rounded-full px-2.5 py-1" style={{ backgroundColor: `var(--bc-${v}-well)`, color: 'var(--bc-text)', boxShadow: `inset 0 0 0 1.5px var(--bc-${v})` }}>
                    {c[k]} <span dir="ltr">{fmt(TOTALS[k])}g</span>
                  </span>
                ))}
              </div>
              <p className="mt-3 rounded-[16px] bg-[var(--bc-accent-well)] px-3 py-2 text-[13px] font-semibold text-bc-text">
                <span className="text-bc-accent-text">● </span>{c.planFit} ({c.fits(TOTALS.kcal, PLAN.slotKcal)}). {pick(PLAN.tip, language)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

/* ---------- Scroll steps ---------- */

function Step({ step, index, language, onActive, active }) {
  const ref = useRef(null);
  const centered = useInView(ref, { margin: '-50% 0px -50% 0px' });
  useEffect(() => {
    if (centered) onActive(index);
  }, [centered, index, onActive]);
  const Icon = step.icon;

  return (
    <div ref={ref} data-scan-step={index} className="py-14 lg:py-0 lg:min-h-[70vh] flex flex-col justify-center border-t border-bc-border first:border-0 lg:border-0">
      <p className={`flex items-center gap-2 text-[13px] font-bold transition-colors duration-[400ms] ${active ? 'text-bc-accent-text' : 'text-bc-muted'}`}>
        <span className="font-choice tabular-nums" dir="ltr">{String(index + 1).padStart(2, '0')}</span>
        <Icon size={16} aria-hidden="true" />
        {pick(step.label, language)}
      </p>
      <p className="mt-3 font-choice font-medium text-[24px] sm:text-[30px] leading-[1.25] text-bc-text max-w-[30rem]">
        {pick(step.line, language)}
      </p>
    </div>
  );
}

// Phones: one full-width phone with the four steps as buttons above it
// (tap, or swipe the phone), the step's line under the buttons.
function MobileScan({ language }) {
  const [i, setI] = useState(0);
  const touch = useRef(null);
  const he = language === 'hebrew';
  const go = (n) => setI(Math.max(0, Math.min(STEPS.length - 1, n)));
  const onTouchStart = (e) => { touch.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touch.current == null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    touch.current = null;
    if (Math.abs(dx) < 40) return;
    const forward = he ? dx > 0 : dx < 0; // in Hebrew the next step is to the left
    go(i + (forward ? 1 : -1));
  };
  const step = STEPS[i];
  return (
    <div className="lg:hidden mt-8">
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={he ? 'שלבי הסריקה' : 'Scan steps'}>
        {STEPS.map((s, k) => {
          const Icon = s.icon;
          const on = k === i;
          return (
            <button key={s.key} type="button" onClick={() => go(k)} aria-pressed={on}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-[16px] border px-1 text-[12px] font-bold transition-colors ${focusClass} ${on ? 'border-bc-accent bg-[var(--bc-accent-well)] text-bc-text' : 'border-bc-border text-bc-muted'}`}>
              <Icon size={18} aria-hidden="true" className={on ? 'text-bc-accent-text' : ''} />
              {pick(s.short || s.label, language)}
            </button>
          );
        })}
      </div>
      <p className="mt-4 min-h-[84px] font-choice font-medium text-[19px] leading-[1.35] text-bc-text" aria-live="polite">
        <span className="me-2 font-choice text-[14px] text-bc-accent-text tabular-nums" dir="ltr">{String(i + 1).padStart(2, '0')}</span>
        {pick(step.line, language)}
      </p>
      <div className="mt-2 flex justify-center" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <ScanMotion stepKey={step.key} language={language} bare />
      </div>
    </div>
  );
}

export default function ScanStory({ language }) {
  const c = pick(copy, language);
  const [active, setActive] = useState(0);

  return (
    <section aria-labelledby="scan-title" className="border-t border-bc-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 sm:pt-28">
        <p className="inline-flex rounded-full border border-bc-border px-3 py-1 text-[13px] font-bold text-bc-accent-text">{c.eyebrow}</p>
        <h2 id="scan-title" className="mt-3 font-choice font-medium text-[36px] sm:text-[56px] leading-[1.05] tracking-[-0.01em] text-bc-text max-w-3xl">
          {c.title}
        </h2>
        <p className="mt-4 font-choice text-[18px] sm:text-[22px] text-bc-muted">{c.mechanism}</p>
        <details className="group mt-5 max-w-2xl rounded-[20px] border border-bc-border bg-bc-surface px-5 py-4">
          <summary className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-3 rounded text-[15px] font-bold text-bc-text ${focusClass}`}>
            {language === 'hebrew' ? 'איך זה עובד?' : 'How does it work?'}
            <span className="text-bc-muted transition-transform duration-200 group-open:rotate-45" aria-hidden="true">+</span>
          </summary>
          <div className="mt-3 flex flex-col gap-2 text-[15px] font-semibold text-bc-muted leading-relaxed">
            <p>{language === 'hebrew' ? 'ה-AI מזהה כל מזון וסופר יחידות. הוא לא מתבקש לנחש קלוריות.' : 'The AI identifies each food and counts pieces. It is never asked to guess calories.'}</p>
            <p>
              {language === 'hebrew' ? 'באייפון עם חיישן עומק, הקוד מוצא את משטח הצלחת, מודד את גובה האוכל ומחשב: ' : 'On iPhones with a depth sensor, the code finds the plate surface, measures the food’s height and computes: '}
              <span className="font-choice text-bc-text" dir="ltr">volume × density = grams</span>.
            </p>
            <p>{language === 'hebrew' ? 'בשאר הטלפונים הכמות מוערכת מהתמונה ומגודל הצלחת. ובכל מקרה אפשר לתקן גרמים בלחיצה.' : 'On other phones the amount is estimated from the photo and the plate size. Either way, you can fix the grams in a tap.'}</p>
          </div>
        </details>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:grid lg:grid-cols-2 lg:gap-16">
        <div className="hidden lg:block lg:py-[12vh]">
          {STEPS.map((s, i) => (
            <Step key={s.key} step={s} index={i} language={language} onActive={setActive} active={active === i} />
          ))}
        </div>
        <MobileScan language={language} />
        <div className="hidden lg:block">
          <div className="sticky top-16 h-[calc(100vh-64px)] flex items-center justify-center">
            <ScanMotion stepKey={STEPS[active].key} language={language} className="w-full max-w-[460px]" />
          </div>
        </div>
      </div>
      {IS_EXAMPLE ? (
        <p className="mx-auto max-w-6xl px-4 sm:px-6 pb-12 pt-6 text-[12px] font-semibold text-bc-muted">
          {language === 'hebrew' ? 'המנה, הכמויות והערכים כאן להמחשה.' : 'The meal, amounts and values here are illustrative.'}
        </p>
      ) : null}
    </section>
  );
}
