import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Bell, Camera, Mic, ScanBarcode, Type } from 'lucide-react';
import { focusClass } from '../../../components/brand/ui';
import StickerTile from './StickerTile';

// "Log it your way", from the campaign ads ("מצלמים, אומרים או כותבים"): the
// headline strikes out the old chores, then the four ways to log a meal in the
// app's add-meal sheet (photo, barcode, voice, text, in its tile colors), each
// with a small loop, plus smart reminders. The photo card links to the scan story.

const copy = {
  hebrew: {
    eyebrow: 'מתעדים איך שנוח',
    strikes: ['בלי לחפש.', 'בלי לשקול.', 'בלי לספור.'],
    body: 'מצלמים, סורקים, אומרים או כותבים. האפליקציה מוצאת את הערכים ורושמת.',
    scanLink: 'איך הסריקה עובדת',
    reminders: 'ותזכורות חכמות בזמן הנכון: לפני ארוחה, אחרי אימון, כשמשהו נשכח.',
    ways: [
      ['מצלמים את הצלחת', 'קלוריות ומאקרו מתמונה, ובאייפון עם LiDAR גם נפח.'],
      ['סורקים ברקוד', 'כל מוצר מהסופר נרשם בשנייה, בלי להקליד.'],
      ['אומרים מה אכלתם', 'מדברים, והאפליקציה רושמת.'],
      ['או כותבים שורה', 'משפט אחד מספיק, גם בעברית.'],
    ],
    voice: 'אכלתי שתי ביצים, סלט ופרוסה',
    text: 'חביתה, לחם מלא וקפה',
    product: 'חטיף חלבון',
  },
  english: {
    eyebrow: 'Log it your way',
    strikes: ['No searching.', 'No weighing.', 'No counting.'],
    body: 'Snap, scan, say it or type it. The app finds the values and logs it.',
    scanLink: 'How the scan works',
    reminders: 'And smart reminders at the right time: before a meal, after a workout, when something slipped.',
    ways: [
      ['Snap your plate', 'Calories and macros from a photo, and on iPhone with LiDAR, volume too.'],
      ['Scan a barcode', 'Anything from the store is logged in a second, no typing.'],
      ['Say what you ate', 'Talk, and the app writes it down.'],
      ['Or type a line', 'One sentence is enough.'],
    ],
    voice: 'Two eggs, a salad and a slice of bread',
    text: 'Omelette, wholegrain bread and coffee',
    product: 'Protein bar',
  },
};

// app add-meal tile colors (AddIngredientModal): photo, barcode, voice, text
const TILES = [
  { icon: Camera, color: '#8B5CF6' },
  { icon: ScanBarcode, color: '#34C759' },
  { icon: Mic, color: '#6366F1' },
  { icon: Type, color: '#10B981' },
];

function Strike({ children, delay, rtl }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-block">
      {children}
      <motion.span
        aria-hidden="true"
        className="absolute inset-x-0 top-[55%] h-[0.09em] rounded-full bg-bc-accent"
        style={{ transformOrigin: rtl ? 'right' : 'left' }}
        initial={{ scaleX: reduce ? 1 : 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay }}
      />
    </span>
  );
}

function PhotoDemo() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto h-28 w-28">
      <StickerTile slugs={['poke-bowl']} size={112} inView />
      {!reduce ? (
        <motion.span aria-hidden="true" className="absolute inset-x-2 h-[3px] rounded-full bg-bc-accent"
          animate={{ top: ['18%', '82%', '18%'] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }} />
      ) : null}
      {[
        { top: 4, left: 4, borderTopWidth: 2, borderLeftWidth: 2 },
        { top: 4, right: 4, borderTopWidth: 2, borderRightWidth: 2 },
        { bottom: 4, left: 4, borderBottomWidth: 2, borderLeftWidth: 2 },
        { bottom: 4, right: 4, borderBottomWidth: 2, borderRightWidth: 2 },
      ].map((pos, i) => (
        <span key={i} aria-hidden="true" className="absolute h-5 w-5 rounded-[3px]" style={{ ...pos, borderStyle: 'solid', borderColor: 'var(--bc-text)', opacity: 0.5 }} />
      ))}
    </div>
  );
}

function BarcodeDemo({ c }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto flex h-28 w-40 items-center justify-center" dir="ltr">
      <div className="rounded-[14px] px-3 py-2.5 text-center shadow-sm" style={{ background: '#F2B43C' }}>
        <p className="text-[11px] font-extrabold text-[#3B2A05]">{c.product}</p>
        <div className="mt-1.5 flex h-9 items-end gap-[2px] rounded bg-white px-1.5 py-1">
          {[3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 3, 1, 2, 1, 3].map((w, i) => <span key={i} className="h-full bg-black" style={{ width: w }} />)}
        </div>
      </div>
      {!reduce ? (
        <motion.span aria-hidden="true" className="absolute h-[2px] w-36 rounded-full" style={{ background: '#ef4444', boxShadow: '0 0 8px #ef4444' }}
          animate={{ y: [-16, 18, -16] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
      ) : null}
    </div>
  );
}

function VoiceDemo({ c }) {
  const reduce = useReducedMotion();
  return (
    <div className="mx-auto flex h-28 w-full max-w-[220px] flex-col items-center justify-center gap-3">
      <div className="flex h-10 items-center gap-[3px]" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <motion.span key={i} className="w-[3px] rounded-full" style={{ background: '#6366F1' }}
            initial={{ height: 8 }} animate={reduce ? { height: 8 + (i % 5) * 5 } : { height: [8, 10 + ((i * 7) % 24), 8] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: (i % 6) * 0.08 }} />
        ))}
      </div>
      <p className="text-center text-[13px] font-semibold text-bc-text">“{c.voice}”</p>
    </div>
  );
}

function TextDemo({ c }) {
  const reduce = useReducedMotion();
  const full = c.text;
  const [n, setN] = React.useState(reduce ? full.length : 0);
  React.useEffect(() => {
    if (reduce) return undefined;
    let i = 0;
    const id = setInterval(() => { i = i >= full.length + 12 ? 0 : i + 1; setN(Math.min(i, full.length)); }, 110);
    return () => clearInterval(id);
  }, [full, reduce]);
  return (
    <div className="mx-auto flex h-28 w-full max-w-[230px] items-center">
      <div className="w-full rounded-[16px] border border-bc-border bg-bc-canvas px-3 py-3 text-[14px] font-semibold text-bc-text">
        {full.slice(0, n)}<span className="ms-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-bc-accent animate-pulse" aria-hidden="true" />
      </div>
    </div>
  );
}

export default function LogWays({ language }) {
  const c = copy[language] || copy.english;
  const he = language === 'hebrew';
  const Arrow = he ? ArrowLeft : ArrowRight;
  const smooth = () => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
  const toScan = () => { window.dispatchEvent(new Event('bc:reveal-all')); setTimeout(() => document.getElementById('scan-title')?.scrollIntoView({ behavior: smooth(), block: 'start' }), 60); };
  const demos = [<PhotoDemo />, <BarcodeDemo c={c} />, <VoiceDemo c={c} />, <TextDemo c={c} />];
  return (
    <section className="bg-bc-canvas border-t border-bc-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
        <div className="max-w-3xl">
          <p className="inline-flex rounded-full border border-bc-border px-3 py-1 text-[13px] font-bold text-bc-accent-text">{c.eyebrow}</p>
          <h2 className="mt-6 font-choice font-medium text-[38px] sm:text-[60px] leading-[1.06] text-bc-text">
            {c.strikes.map((w, i) => (
              <React.Fragment key={w}>
                <Strike delay={0.2 + i * 0.35} rtl={he}>{w}</Strike>
                {i < c.strikes.length - 1 ? <br /> : null}
              </React.Fragment>
            ))}
          </h2>
          <p className="mt-5 text-[18px] sm:text-[20px] font-semibold text-bc-muted max-w-xl">{c.body}</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.ways.map(([title, line], i) => {
            const { icon: Icon, color } = TILES[i];
            return (
              <article key={title} className="flex flex-col rounded-bc-card border border-bc-border bg-bc-surface p-5">
                <div aria-hidden="true">{demos[i]}</div>
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[14px] text-white" style={{ backgroundColor: color }}>
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="text-[18px] font-bold text-bc-text">{title}</h3>
                </div>
                <p className="mt-2 text-[15px] font-semibold text-bc-muted">{line}</p>
                {i === 0 ? (
                  <button type="button" onClick={toScan} className={`mt-3 inline-flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-bold text-bc-text underline underline-offset-4 decoration-bc-border hover:decoration-bc-accent rounded ${focusClass}`}>
                    {c.scanLink} <Arrow size={16} aria-hidden="true" />
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
        <p className="mt-6 flex items-start gap-2 text-[15px] font-semibold text-bc-muted">
          <Bell size={18} aria-hidden="true" className="mt-0.5 flex-none text-bc-accent-text" />
          {c.reminders}
        </p>
      </div>
    </section>
  );
}
