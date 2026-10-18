import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { CalendarDays, MessageCircle, Mic, HeartHandshake, Utensils, History, Target } from 'lucide-react';
import { BETI_ART, MOMENTS, ASK, DAY, IS_EXAMPLE } from './beti';
import { focusClass } from '../../components/brand/ui';

const FADE = { duration: 0.4, ease: 'easeOut' };
const pick = (o, language) => (o ? o[language] || o.english : '');

function ExampleTag({ language }) {
  if (!IS_EXAMPLE) return null;
  return (
    <span className="inline-flex rounded-full border border-dashed border-bc-border px-2.5 py-1 text-[11px] font-semibold text-bc-muted">
      {language === 'hebrew' ? 'דוגמה להמחשה' : 'Illustrative example'}
    </span>
  );
}

function Bubble({ from, children }) {
  const beti = from === 'beti';
  return (
    <div className={`flex items-end gap-2 ${beti ? '' : 'flex-row-reverse'}`}>
      {beti ? <img src={BETI_ART.avatar} alt="" width="32" height="32" className="h-8 w-8 flex-none rounded-full" /> : null}
      <p
        className={`max-w-[85%] rounded-[20px] px-4 py-2.5 text-[15px] font-semibold leading-snug ${
          beti ? 'bg-bc-surface border border-bc-border text-bc-text rounded-es-[6px]' : 'bg-bc-accent text-bc-on-accent rounded-ee-[6px]'
        }`}
      >
        {children}
      </p>
    </div>
  );
}

/* ---------- When life happens ---------- */

export function Moments({ language }) {
  const he = language === 'hebrew';
  const [open, setOpen] = useState(MOMENTS[0].key);
  const active = MOMENTS.find((m) => m.key === open) || MOMENTS[0];

  return (
    <section className="border-t border-bc-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
        <p className="text-[13px] font-bold text-bc-accent">{he ? 'כשהחיים קורים' : 'When life happens'}</p>
        <h2 className="mt-3 font-choice font-medium text-[32px] sm:text-[52px] leading-[1.06] text-bc-text max-w-3xl">
          {he ? 'יום לא מושלם הוא לא סיבה להתחיל מחדש.' : 'An imperfect day is no reason to start over.'}
        </h2>
        <p className="mt-4 text-[17px] sm:text-[19px] font-semibold text-bc-muted max-w-2xl">
          {he
            ? 'אתם מספרים ל-Beti מה קרה. היא לא שופטת, היא מסדרת את הצעד הבא.'
            : 'Tell Beti what happened. She doesn’t judge; she lines up the next step.'}
        </p>

        <div className="mt-12 grid lg:grid-cols-[1fr_1.1fr] gap-6 lg:gap-10 items-start">
          <div className="flex flex-col gap-3" role="tablist" aria-label={he ? 'רגעים' : 'Moments'}>
            {MOMENTS.map((m) => {
              const selected = m.key === open;
              return (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setOpen(m.key)}
                  className={`flex items-center justify-between gap-4 rounded-bc-card border px-6 py-5 text-start transition-colors duration-200 ${focusClass} ${
                    selected ? 'border-bc-accent bg-[var(--bc-accent-well)]' : 'border-bc-border bg-bc-surface hover:border-bc-muted'
                  }`}
                >
                  <span className="font-choice font-medium text-[22px] sm:text-[26px] text-bc-text">{pick(m.title, language)}</span>
                  <span className="text-[13px] font-semibold text-bc-muted tabular-nums">{he ? m.time : m.timeEn || m.time}</span>
                </button>
              );
            })}
          </div>

          <div className="relative rounded-bc-card border border-bc-border bg-bc-canvas p-5 sm:p-7 min-h-[320px]">
            <div className="flex items-center justify-between mb-5">
              <span className="flex items-center gap-2 text-[14px] font-bold text-bc-text">
                <img src={BETI_ART.avatar} alt="" width="28" height="28" className="h-7 w-7 rounded-full" /> Beti
              </span>
              <ExampleTag language={language} />
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={active.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="flex flex-col gap-3">
                <Bubble from="you">{pick(active.you, language)}</Bubble>
                {active.beti.map((b, i) => (
                  <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...FADE, delay: 0.35 + i * 0.45 }}>
                    <Bubble from="beti">{pick(b, language)}</Bubble>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Beti: what she knows, what she does, ask her ---------- */

const KNOWS = [
  { icon: Target, text: { hebrew: 'התוכנית והיעדים שלכם', english: 'Your plan and targets' } },
  { icon: Utensils, text: { hebrew: 'מה אכלתם היום', english: 'What you ate today' } },
  { icon: History, text: { hebrew: 'השבוע האחרון שלכם', english: 'Your last seven days' } },
];

const DOES = [
  { icon: Utensils, text: { hebrew: 'מציעה את הארוחה הבאה, עם כמויות ומאקרו', english: 'Suggests your next meal, with amounts and macros' } },
  { icon: Mic, text: { hebrew: 'עונה בכתיבה או בקול', english: 'Answers by text or by voice' } },
  { icon: MessageCircle, text: { hebrew: 'בודקת מה שלומכם בוואטסאפ, אם תרצו', english: 'Checks in on WhatsApp, if you want her to' } },
  { icon: HeartHandshake, text: { hebrew: 'לא שופטת. אף פעם.', english: 'Never judges. Ever.' } },
];

export function BetiSection({ language }) {
  const he = language === 'hebrew';
  const [ask, setAsk] = useState(ASK[0].key);
  const current = ASK.find((a) => a.key === ask) || ASK[0];

  return (
    <section className="border-t border-bc-border" style={{ backgroundColor: 'var(--bc-accent-well)' }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="flex items-center gap-4">
            <img src={BETI_ART.wave} alt={he ? 'Beti, המאמנת' : 'Beti, the coach'} width="120" height="126" className="h-[120px] w-auto" />
            <div>
              <p className="text-[13px] font-bold text-bc-accent">{he ? 'המאמנת שלכם' : 'Your coach'}</p>
              <h2 className="mt-1 font-choice font-medium text-[34px] sm:text-[52px] leading-[1.04] text-bc-text">
                {he ? 'Beti נשארת איתכם.' : 'Beti stays with you.'}
              </h2>
            </div>
          </div>
          <p className="mt-6 text-[17px] sm:text-[19px] font-semibold text-bc-muted max-w-xl">
            {he
              ? 'היא יודעת מה התוכנית, מה כבר אכלתם, ואיך נראה השבוע. אז כל תשובה שלה מתאימה ליום שלכם, לא ליום ממוצע.'
              : 'She knows the plan, what you’ve eaten, and how your week went. So every answer fits your day, not an average one.'}
          </p>

          <p className="mt-8 text-[13px] font-bold text-bc-text">{he ? 'מה היא יודעת' : 'What she knows'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {KNOWS.map((k) => {
              const Icon = k.icon;
              return (
                <span key={k.text.english} className="inline-flex items-center gap-2 rounded-full border border-bc-border bg-bc-surface px-4 py-2 text-[14px] font-semibold text-bc-text">
                  <Icon size={16} aria-hidden="true" className="text-bc-accent" />
                  {pick(k.text, language)}
                </span>
              );
            })}
          </div>

          <p className="mt-8 text-[13px] font-bold text-bc-text">{he ? 'מה היא עושה' : 'What she does'}</p>
          <ul className="mt-3 flex flex-col gap-3">
            {DOES.map((d) => {
              const Icon = d.icon;
              return (
                <li key={d.text.english} className="flex items-center gap-3 text-[16px] font-semibold text-bc-text">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-bc-surface text-bc-accent border border-bc-border">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  {pick(d.text, language)}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Ask Beti */}
        <div className="rounded-bc-card border border-bc-border bg-bc-canvas p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <p className="font-choice font-medium text-[22px] text-bc-text">{he ? 'שאלו את Beti' : 'Ask Beti'}</p>
            <ExampleTag language={language} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {ASK.map((a) => (
              <button
                key={a.key}
                type="button"
                aria-pressed={a.key === ask}
                onClick={() => setAsk(a.key)}
                className={`rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors duration-150 ${focusClass} ${
                  a.key === ask ? 'border-bc-accent bg-[var(--bc-accent-well)] text-bc-text' : 'border-bc-border text-bc-muted hover:text-bc-text'
                }`}
              >
                {pick(a.q, language)}
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={current.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE} className="mt-6 flex flex-col gap-3 min-h-[240px]">
              <Bubble from="you">{pick(current.q, language)}</Bubble>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...FADE, delay: 0.4 }} className="flex flex-col gap-3">
                <Bubble from="beti">{pick(current.a, language)}</Bubble>
                {current.card ? (
                  <div className="ms-10 rounded-[20px] border border-bc-border bg-bc-surface p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] font-bold text-bc-muted">{he ? 'פירוט תזונתי' : 'Nutritional breakdown'}</span>
                      <span className="font-choice font-medium text-[22px] text-bc-text" dir="ltr">{current.card.kcal} kcal</span>
                    </div>
                    <div className="mt-2 flex gap-2 text-[12px] font-bold">
                      {[['p', 'protein', 'חלבון', 'Protein'], ['c', 'carbs', 'פחמימות', 'Carbs'], ['f', 'fat', 'שומן', 'Fat']].map(([k, v, h, e]) => (
                        <span key={k} className="rounded-full px-2.5 py-1" style={{ backgroundColor: `var(--bc-${v}-well)`, color: `var(--bc-${v})` }}>
                          {he ? h : e} <span dir="ltr">{current.card[k]}g</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/* ---------- The day loop ---------- */

function DayStep({ step, index, language, onActive }) {
  const ref = useRef(null);
  const centered = useInView(ref, { margin: '-45% 0px -45% 0px' });
  useEffect(() => {
    if (centered) onActive(index);
  }, [centered, index, onActive]);
  return (
    <div ref={ref} className="relative ps-10 pb-12 last:pb-0">
      <span className="absolute start-[11px] top-2 bottom-0 w-px bg-bc-border" aria-hidden="true" />
      <span className="absolute start-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-bc-accent" aria-hidden="true">
        <span className="h-2 w-2 rounded-full bg-bc-on-accent" />
      </span>
      <p className="text-[13px] font-bold text-bc-muted tabular-nums" dir="ltr" style={{ textAlign: 'start' }}>
        {step.time}
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-choice font-medium text-[22px] sm:text-[26px] text-bc-text">{pick(step.meal, language)}</span>
        {step.kcal ? <span className="text-[14px] font-semibold text-bc-muted" dir="ltr">{step.kcal} kcal</span> : null}
        <span className="rounded-full border border-bc-border px-2.5 py-0.5 text-[12px] font-semibold text-bc-muted">{pick(step.how, language)}</span>
      </div>
      <div className="mt-3 max-w-md">
        <Bubble from="beti">{pick(step.beti, language)}</Bubble>
      </div>
    </div>
  );
}

export function DayLoop({ language }) {
  const he = language === 'hebrew';
  const [active, setActive] = useState(0);
  const eaten = DAY.steps.slice(0, active + 1).reduce((s, x) => s + x.kcal, 0);
  const pct = Math.min(100, Math.round((eaten / DAY.targetKcal) * 100));
  const done = active === DAY.steps.length - 1;

  return (
    <section className="border-t border-bc-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 sm:pt-28">
        <p className="text-[13px] font-bold text-bc-accent">{he ? 'יום אחד' : 'One day'}</p>
        <h2 className="mt-3 font-choice font-medium text-[32px] sm:text-[52px] leading-[1.06] text-bc-text max-w-3xl">
          {he ? 'צילמתם. Beti התאימה. היום נסגר במסלול.' : 'You snapped. Beti adjusted. The day closed on track.'}
        </h2>
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20 grid lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-16">
        <div className="lg:sticky lg:top-28 self-start rounded-bc-card border border-bc-border bg-bc-surface p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <CalendarDays size={20} aria-hidden="true" className="text-bc-muted" />
            <ExampleTag language={language} />
          </div>
          <p className="mt-6 text-[13px] font-bold text-bc-muted">{he ? 'היום שלכם' : 'Your day'}</p>
          <p className="mt-1 font-choice font-medium text-[44px] sm:text-[56px] leading-none text-bc-text tabular-nums" dir="ltr" style={{ textAlign: 'start' }}>
            {eaten.toLocaleString('en-US')}
            <span className="text-[18px] text-bc-muted"> / {DAY.targetKcal.toLocaleString('en-US')} kcal</span>
          </p>
          <div className="mt-5 h-3 rounded-full bg-bc-surface2 overflow-hidden" aria-hidden="true">
            <motion.div className="h-full rounded-full bg-bc-accent" animate={{ width: `${pct}%` }} transition={{ duration: 0.4, ease: 'easeOut' }} />
          </div>
          <div className="mt-6 flex items-center gap-3 min-h-[64px]">
            <img src={done ? BETI_ART.cheer : BETI_ART.thumb} alt="" width="64" height="64" className="h-16 w-auto" />
            <p className="text-[15px] font-semibold text-bc-text">
              {done
                ? he ? 'בתוך היעד, גם עם השווארמה.' : 'On target, shawarma and all.'
                : he ? `נשארו ${(DAY.targetKcal - eaten).toLocaleString('en-US')} קק״ל` : `${(DAY.targetKcal - eaten).toLocaleString('en-US')} kcal left`}
            </p>
          </div>
        </div>
        <div>
          {DAY.steps.map((s, i) => (
            <DayStep key={s.time} step={s} index={i} language={language} onActive={setActive} />
          ))}
        </div>
      </div>
    </section>
  );
}
