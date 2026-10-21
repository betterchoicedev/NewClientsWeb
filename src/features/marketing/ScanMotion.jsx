import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { PhoneFrame } from './PhoneFrame';

// The scan, as motion graphics in the style of the campaign video (camera,
// labels, the LiDAR depth sweep, the result card counting up), built here
// over one real photo. Each step plays once when it is reached, then holds,
// so reading a step never means watching a loop. Values are illustrative.

const APP = { bg: '#0B0F0D', card: '#FFFFFF', text: '#0E1A14', muted: '#6B7570', green: '#34C759', protein: '#AF52DE', carbs: '#0A84FF', fat: '#FF9500' };
const SYS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Arial, sans-serif';
const PHOTO = `${process.env.PUBLIC_URL || ''}/scan/burger.webp`;
const PHOTO_TOP = 9; // % of the screen
const PHOTO_H = 61;

const T = {
  hebrew: {
    ai: 'ניתוח AI', modes: ['וידאו', 'תמונה', 'ברקוד'],
    labels: [['המבורגר בקר', 96], ['צ׳יפס', 92], ['קטשופ', 88]],
    lidar: 'LiDAR · מודדים עומק', volume: 'נפח הקציצה: 210 מ״ל',
    dish: 'המבורגר בקר', from: 'זוהה מהתמונה · מדויק יותר עם חיישן עומק', kcal: 'קלוריות',
    macros: ['חלבון', 'פחמימות', 'שומן'],
    items: [['קציצת בקר', '200 ג׳', 440], ['לחמניית בריוש', '1 יח׳', 250], ['רטבים וירקות', '60 ג׳', 60], ['צ׳יפס', '10 יח׳', 24]],
    fit: 'נכנס ליעד היום · נשארו 820 קק״ל',
  },
  english: {
    ai: 'AI analysis', modes: ['Video', 'Photo', 'Barcode'],
    labels: [['Beef burger', 96], ['Fries', 92], ['Ketchup', 88]],
    lidar: 'LiDAR · measuring depth', volume: 'Patty volume: 210 ml',
    dish: 'Beef burger', from: 'Identified from the photo · more precise with the depth sensor', kcal: 'calories',
    macros: ['Protein', 'Carbs', 'Fat'],
    items: [['Beef patty', '200 g', 440], ['Brioche bun', '1 unit', 250], ['Sauces and veg', '60 g', 60], ['Fries', '10 pcs', 24]],
    fit: 'Fits today’s target · 820 kcal left',
  },
};

// boxes in % of the photo
const BOXES = [
  { x: 8, y: 14, w: 80, h: 56 },
  { x: 0, y: 55, w: 42, h: 36 },
  { x: 88, y: 56, w: 12, h: 22 },
];

function useCountUp(to, on, ms = 1400) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!on) return undefined;
    if (reduce) { setN(to); return undefined; }
    let raf; const t0 = performance.now();
    const tick = (t) => { const k = Math.min(1, (t - t0) / ms); setN(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, on, ms, reduce]);
  return n;
}

function StatusBar() {
  return (
    <div className="absolute inset-x-0 top-0 flex items-center justify-between px-[7%] text-white" style={{ height: '6.7%' }} dir="ltr" aria-hidden="true">
      <span className="text-[11px] font-semibold">12:30</span>
      <span className="flex items-center gap-1">
        <svg width="14" height="9" viewBox="0 0 16 10" fill="currentColor"><rect x="0" y="7" width="3" height="3" rx=".7" /><rect x="4.3" y="5" width="3" height="5" rx=".7" /><rect x="8.6" y="2.5" width="3" height="7.5" rx=".7" /><rect x="12.9" y="0" width="3" height="10" rx=".7" /></svg>
        <svg width="20" height="10" viewBox="0 0 24 11" fill="none"><rect x=".5" y=".5" width="20" height="10" rx="3" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="15" height="7" rx="1.6" fill="currentColor" /></svg>
      </span>
    </div>
  );
}

/** Depth mesh over the burger: a dot grid revealed by a sweep, coloured by "height". */
function DepthMesh({ play }) {
  const cols = 22, rows = 14;
  const dots = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = (c + 0.5) / cols, y = (r + 0.5) / rows;
    const dx = (x - 0.5) / 0.5, dy = (y - 0.45) / 0.55;
    const h = Math.max(0, 1 - dx * dx * 0.9 - dy * dy * 0.8); // a dome: higher in the middle
    if (h <= 0.04) continue;
    dots.push({ x: x * 100, y: y * 100, h, r });
  }
  const color = (h) => (h > 0.7 ? '#34C759' : h > 0.4 ? '#22D3EE' : '#0A84FF');
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute" style={{ left: '11%', top: '15%', width: '76%', height: '54%' }} aria-hidden="true">
      {dots.map((d, i) => (
        <motion.circle key={i} cx={d.x} cy={d.y} r={0.9 + d.h * 0.7} fill={color(d.h)}
          initial={{ opacity: 0 }} animate={play ? { opacity: [0, 1, 0.85] } : { opacity: 0.85 }}
          transition={{ duration: 0.5, delay: play ? 0.15 + (d.r / rows) * 1.3 : 0 }} />
      ))}
    </svg>
  );
}

export default function ScanMotion({ stepKey, language, className = '' }) {
  const t = T[language] || T.english;
  const he = language === 'hebrew';
  const ref = useRef(null);
  const seen = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const play = seen && !reduce; // animate once per step, the first time it is on screen
  const step = stepKey;
  const total = t.items.reduce((s, i) => s + i[2], 0);
  const kcal = useCountUp(total, step === 'plan' && seen);
  const macros = [42, 48, 46];

  return (
    <div ref={ref} className={`flex items-center justify-center rounded-bc-card py-8 ${className}`} style={{ backgroundColor: 'var(--scene-bg)' }}>
      <PhoneFrame>
        <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: APP.bg, fontFamily: SYS }} dir={he ? 'rtl' : 'ltr'} aria-hidden="true">
          <StatusBar />
          {/* the photo */}
          <motion.div className="absolute inset-x-0 overflow-hidden" style={{ top: `${PHOTO_TOP}%`, height: `${PHOTO_H}%` }}
            initial={step === 'snap' && play ? { scale: 1.12 } : false} animate={{ scale: step === 'snap' ? 1 : 1.02 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}>
            <img src={PHOTO} alt="" className="h-full w-full object-cover" draggable={false} />

            {/* identify: boxes draw in, labels pop */}
            {step === 'identify' ? BOXES.map((b, i) => (
              <motion.div key={i} className="absolute rounded-[10px]" style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`, border: '2px dashed #34C759', boxShadow: '0 0 0 1px rgba(0,0,0,.15)' }}
                initial={play ? { opacity: 0, scale: 1.08 } : false} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, delay: play ? 0.2 + i * 0.35 : 0 }}>
                <motion.span className="absolute -top-3 start-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-extrabold text-[#04120A]" style={{ backgroundColor: '#34C759' }}
                  initial={play ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 14, stiffness: 220, delay: play ? 0.45 + i * 0.35 : 0 }}>
                  {t.labels[i][0]} · <span dir="ltr">{t.labels[i][1]}%</span>
                </motion.span>
              </motion.div>
            )) : null}

            {/* measure: the sweep line runs once, the mesh stays */}
            {step === 'measure' ? (
              <>
                <DepthMesh play={play} />
                {play ? (
                  <motion.div className="absolute inset-x-[8%] h-[3px] rounded-full" style={{ backgroundColor: '#34C759', boxShadow: '0 0 14px 3px rgba(52,199,89,.7)' }}
                    initial={{ top: '12%', opacity: 1 }} animate={{ top: '72%', opacity: [1, 1, 0] }} transition={{ duration: 1.7, ease: 'easeInOut' }} />
                ) : null}
                <motion.span className="absolute bottom-3 start-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white"
                  initial={play ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: play ? 1.8 : 0 }}>
                  {t.volume}
                </motion.span>
              </>
            ) : null}

            {/* snap: the shutter flash */}
            {step === 'snap' && play ? (
              <motion.div className="absolute inset-0 bg-white" initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 0.9, 0] }} transition={{ duration: 1.6, times: [0, 0.6, 0.68, 1] }} />
            ) : null}
          </motion.div>

          {/* top chip */}
          <span className="absolute end-3 rounded-full px-2.5 py-1 text-[10px] font-extrabold text-white" style={{ top: '10.5%', backgroundColor: APP.green }}>
            ✦ {step === 'measure' ? t.lidar : t.ai}
          </span>

          {/* camera controls */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3" style={{ top: `${PHOTO_TOP + PHOTO_H}%`, paddingTop: '4%' }}>
            <div className="flex gap-4 text-[10px] font-bold">
              {t.modes.map((m, i) => <span key={m} style={{ color: i === 1 ? '#F7B733' : '#9AA39E' }}>{m}</span>)}
            </div>
            <motion.span className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-white"
              animate={step === 'snap' && play ? { scale: [1, 1, 0.86, 1] } : { scale: 1 }} transition={{ duration: 1.6, times: [0, 0.55, 0.66, 0.8] }}>
              <span className="h-9 w-9 rounded-full bg-white" />
            </motion.span>
          </div>

          {/* plan fit: the result card slides up and counts */}
          <AnimatePresence>
            {step === 'plan' ? (
              <motion.div className="absolute inset-x-2 bottom-2 rounded-[22px] p-3.5 shadow-2xl" style={{ backgroundColor: APP.card, color: APP.text, top: '30%' }}
                initial={play ? { y: '105%' } : false} animate={{ y: 0 }} transition={{ type: 'spring', damping: 20, stiffness: 140 }}>
                <div className="flex items-start gap-2.5">
                  <img src={PHOTO} alt="" className="h-11 w-11 flex-none rounded-[10px] object-cover" draggable={false} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-extrabold leading-tight">{t.dish}</p>
                    <p className="text-[9px] font-semibold leading-snug" style={{ color: APP.green }}>✦ {t.from}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-[34px] font-extrabold leading-none tabular-nums">{kcal}</span>
                  <span className="text-[12px] font-semibold" style={{ color: APP.muted }}>{t.kcal}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {macros.map((g, i) => (
                    <div key={i}>
                      <p className="text-[9px] font-bold" style={{ color: [APP.protein, APP.carbs, APP.fat][i] }}>{t.macros[i]}</p>
                      <p className="text-[13px] font-extrabold" dir="ltr" style={{ textAlign: 'start' }}>{g}g</p>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-black/5">
                        <motion.div className="h-full rounded-full" style={{ backgroundColor: [APP.protein, APP.carbs, APP.fat][i] }}
                          initial={play ? { width: '0%' } : false} animate={{ width: `${[64, 52, 78][i]}%` }} transition={{ duration: 1, delay: play ? 0.4 + i * 0.12 : 0 }} />
                      </div>
                    </div>
                  ))}
                </div>
                <ul className="mt-2.5 divide-y divide-black/5 border-t border-black/5">
                  {t.items.map(([name, amount, k], i) => (
                    <motion.li key={name} className="flex items-center justify-between py-1.5 text-[11px]"
                      initial={play ? { opacity: 0, x: he ? 12 : -12 } : false} animate={{ opacity: 1, x: 0 }} transition={{ delay: play ? 0.9 + i * 0.15 : 0 }}>
                      <span className="font-bold">{name} <span className="font-semibold" style={{ color: APP.muted }}>· {amount}</span></span>
                      <span className="font-extrabold tabular-nums" dir="ltr">{k}</span>
                    </motion.li>
                  ))}
                </ul>
                <motion.p className="mt-2 rounded-full px-2.5 py-1.5 text-center text-[11px] font-extrabold" style={{ backgroundColor: 'rgba(52,199,89,.14)', color: '#1F8A3C' }}
                  initial={play ? { opacity: 0, scale: 0.9 } : false} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 200, delay: play ? 1.7 : 0 }}>
                  ✓ {t.fit}
                </motion.p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </PhoneFrame>
    </div>
  );
}
