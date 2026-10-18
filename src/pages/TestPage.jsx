import React from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import MarketingShell from '../components/brand/MarketingShell';
import DownloadLink from '../components/brand/DownloadLink';
import StoreBadges from '../components/brand/StoreBadges';
import { focusClass, primaryButton } from '../components/brand/ui';
import PlanStory from '../features/marketing/PlanStory';
import ScanStory from '../features/marketing/ScanStory';
import { Pricing, Faq, StickyDownload } from '../features/marketing/Sections';

// TEST (/test): the BetterMe "products" spirit with our product. People-first
// photography, outcome cards, short triads, a light warm canvas. The production
// landing (/) is untouched.
//
// Photos: Unsplash, free license (no attribution required), picked 2026-10-18:
// hero-cooking photo-1556911073-a517e752729c, card-man-cooking photo-1556911220-dabc1f02913a,
// card-pushups photo-1758599880050-b33b1fbf3713, card-bowl photo-1723744910344-370bc4305972,
// card-couple-kitchen photo-1758523417426-2544532fd8d1, scan-phone photo-1568031814106-ac1b1cc12b71,
// world-chopping photo-1636647511729-6703539ba71f, world-yoga photo-1758599879067-f99a68ea57ee,
// world-salad photo-1595786802424-d6efbc413db5, final-workout photo-1758599880557-e3a27500265e.

const FADE = { duration: 0.5, ease: 'easeOut' };
const pick = (o, language) => (o ? o[language] || o.english : '');
const P = (name) => `/test-photos/${name}.jpg`;

const copy = {
  hebrew: {
    title1: 'עשו את',
    titleGreen: 'הבחירה',
    title2: 'הטובה יותר.',
    triad: 'תפריט אישי. אימונים מותאמים. מאמנת שתמיד שם.',
    cta: 'הורידו בחינם',
    more: 'איך זה עובד',
    note: '3 ימים חינם, ביטול בכל רגע.',
    programsTitle: 'התוכניות הפופולריות ב-BetterChoice',
    getStarted: 'התחילו',
    scanEyebrow: 'סריקה',
    scanTitle: 'צלמו. זה רשום.',
    scanBody: 'הסריקה מזהה כל מזון, מודדת ומחשבת. אתם רק אוכלים.',
    scanLink: 'איך הסריקה עובדת',
    worldTitle: 'הכירו את העולם של BetterChoice',
    learnMore: 'למידע נוסף',
    finalTitle: 'התפריט שלכם מחכה.',
    finalBody: 'מתחילים ב-3 ימים חינם, ב-App Store וב-Google Play.',
  },
  english: {
    title1: 'Make the',
    titleGreen: 'better choice.',
    title2: '',
    triad: 'A personal meal plan. Workouts that fit. A coach who’s always there.',
    cta: 'Download free',
    more: 'How it works',
    note: '3 days free, cancel anytime.',
    programsTitle: 'The most popular plans in BetterChoice',
    getStarted: 'Get started',
    scanEyebrow: 'Scan',
    scanTitle: 'Snap it. It’s logged.',
    scanBody: 'The scan identifies every food, measures and does the math. You just eat.',
    scanLink: 'How the scan works',
    worldTitle: 'Meet the BetterChoice world',
    learnMore: 'Learn more',
    finalTitle: 'Your plan is waiting.',
    finalBody: 'Start with 3 free days, on the App Store and Google Play.',
  },
};

// Program cards map to the app's real goals (GOAL_OPTIONS); "Get started"
// pre-selects that goal in the plan preview below. Promises are about the plan,
// never about the body (no weight-loss promises).
const PROGRAMS = [
  {
    goal: 'recomp',
    photo: P('card-man-cooking'),
    title: { hebrew: 'פחות שומן, אותו שריר:', english: 'Lose fat, keep muscle:' },
    line: { hebrew: 'תפריט עשיר בחלבון ואימונים שנבנים סביבכם', english: 'A protein-forward plan and workouts built around you' },
    pos: '60% 40%',
  },
  {
    goal: 'muscle',
    photo: P('card-pushups'),
    title: { hebrew: 'בניית שריר:', english: 'Build muscle:' },
    line: { hebrew: 'יותר חלבון, ותוכנית אימונים של יומיים עד ארבעה בשבוע', english: 'More protein, and a two-to-four-day training plan' },
    pos: '50% 60%',
  },
  {
    goal: 'lose',
    photo: P('card-bowl'),
    title: { hebrew: 'ירידה במשקל:', english: 'Lose weight:' },
    line: { hebrew: 'תפריט שמתאים לשעות ולטעם שלכם', english: 'A plan that fits your hours and your taste' },
    pos: '50% 50%',
  },
  {
    goal: 'maintain',
    photo: P('card-couple-kitchen'),
    title: { hebrew: 'שמירה על משקל:', english: 'Maintain:' },
    line: { hebrew: 'לאכול טוב, בלי לספור כל ביס', english: 'Eat well, without counting every bite' },
    pos: '50% 40%',
  },
];

const WORLD = [
  {
    photo: P('world-salad'),
    label: { hebrew: 'אפליקציה', english: 'App' },
    name: { hebrew: 'BetterChoice לאייפון ולאנדרואיד', english: 'BetterChoice for iPhone and Android' },
    kind: 'download',
  },
  {
    photo: P('world-chopping'),
    label: { hebrew: 'עם הדיאטנית שלכם', english: 'With your dietitian' },
    name: { hebrew: 'קיבלתם קישור הזמנה? הכל מתחבר', english: 'Got an invite link? It all connects' },
    kind: 'signup',
  },
  {
    photo: P('world-yoga'),
    label: { hebrew: 'אימונים', english: 'Training' },
    name: { hebrew: 'שש תוכניות, בבית או בחדר כושר', english: 'Six plans, at home or at the gym' },
    kind: 'download',
  },
];

function PhotoHero({ language }) {
  const c = copy[language] || copy.english;
  const scrollToPrograms = () => document.getElementById('programs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <section className="relative isolate min-h-[calc(100svh-64px)] flex items-center justify-center overflow-hidden">
      <img src={P('hero-cooking')} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" style={{ objectPosition: '30% 40%' }} />
      {/* flat scrim for legibility over the photo */}
      <div className="absolute inset-0 -z-10 bg-[#0B1410]/55" aria-hidden="true" />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={FADE} className="mx-auto max-w-4xl px-4 sm:px-6 py-20 text-center text-white">
        <h1 className="font-choice font-medium text-[46px] sm:text-[76px] lg:text-[92px] leading-[1.02] tracking-[-0.02em]">
          {c.title1}
          <br />
          <span className="text-[#3DDC6F]">{c.titleGreen}</span> {c.title2}
        </h1>
        <p className="mt-6 text-[18px] sm:text-[22px] font-semibold text-white/90">{c.triad}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <DownloadLink className={`${primaryButton} px-9 !font-medium font-choice text-[16px]`}>{c.cta}</DownloadLink>
          <button type="button" onClick={scrollToPrograms} className={`inline-flex min-h-[48px] items-center rounded-full border border-white/70 px-8 text-[16px] font-semibold text-white hover:bg-white/10 ${focusClass}`}>
            {c.more}
          </button>
        </div>
        <p className="mt-4 text-[13px] font-semibold text-white/75">{c.note}</p>
      </motion.div>
    </section>
  );
}

function Programs({ language }) {
  const c = copy[language] || copy.english;
  const start = (goal) => {
    window.dispatchEvent(new CustomEvent('bc:pick-goal', { detail: goal }));
    document.getElementById('try-it')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <section id="programs" className="scroll-mt-16 bg-bc-canvas">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
        <h2 className="mx-auto max-w-3xl text-center font-choice font-medium text-[34px] sm:text-[54px] leading-[1.06] text-bc-text">{c.programsTitle}</h2>
        <div className="mt-12 flex flex-col gap-5">
          {PROGRAMS.map((p, i) => (
            <motion.article
              key={p.goal}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={FADE}
              className="relative isolate overflow-hidden rounded-bc-card min-h-[340px] sm:min-h-[420px] flex items-end"
            >
              <img src={p.photo} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover" style={{ objectPosition: p.pos }} />
              {/* soft fade from the bottom so text stays readable without a hard edge */}
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0B1410]/80 via-[#0B1410]/30 to-transparent" aria-hidden="true" />
              <div className="p-7 sm:p-10 text-white">
                <p className="font-choice text-[15px] text-white/75 tabular-nums">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="mt-1 font-choice font-medium text-[30px] sm:text-[44px] leading-[1.05]">{pick(p.title, language)}</h3>
                <p className="mt-2 text-[16px] sm:text-[20px] font-semibold text-white/90 max-w-xl">{pick(p.line, language)}</p>
                <button
                  type="button"
                  onClick={() => start(p.goal)}
                  className={`mt-6 inline-flex min-h-[44px] items-center rounded-full bg-white px-7 text-[15px] font-semibold text-[#13251D] hover:opacity-90 ${focusClass}`}
                >
                  {c.getStarted}
                </button>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScanSplit({ language }) {
  const c = copy[language] || copy.english;
  const Arrow = language === 'hebrew' ? ArrowLeft : ArrowRight;
  return (
    <section className="bg-bc-band">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 grid lg:grid-cols-2 gap-10 items-center">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.3 }} transition={FADE}
          className="overflow-hidden rounded-bc-card aspect-[4/3]">
          <img src={P('scan-phone')} alt="" loading="lazy" className="h-full w-full object-cover" />
        </motion.div>
        <div>
          <p className="inline-flex rounded-full border border-bc-border px-3 py-1 text-[13px] font-bold text-bc-accent-text">{c.scanEyebrow}</p>
          <h2 className="mt-4 font-choice font-medium text-[36px] sm:text-[56px] leading-[1.04] text-bc-text">{c.scanTitle}</h2>
          <p className="mt-4 text-[18px] sm:text-[20px] font-semibold text-bc-muted max-w-lg">{c.scanBody}</p>
          <button
            type="button"
            onClick={() => document.getElementById('scan-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={`mt-6 inline-flex min-h-[44px] items-center gap-2 text-[16px] font-bold text-bc-text underline underline-offset-4 decoration-bc-border hover:decoration-bc-accent rounded ${focusClass}`}
          >
            {c.scanLink} <Arrow size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

function World({ language }) {
  const c = copy[language] || copy.english;
  return (
    <section className="bg-bc-canvas border-t border-bc-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
        <h2 className="text-center font-choice font-medium text-[32px] sm:text-[48px] leading-[1.08] text-bc-text">{c.worldTitle}</h2>
        <div className="mt-12 grid md:grid-cols-3 gap-4">
          {WORLD.map((w) => {
            const inner = (
              <>
                <div className="overflow-hidden rounded-[24px] aspect-[4/3]">
                  <img src={w.photo} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                </div>
                <p className="mt-4 text-[13px] font-bold text-bc-muted">{pick(w.label, language)}</p>
                <p className="mt-1 font-choice font-medium text-[22px] text-bc-text">{pick(w.name, language)}</p>
                <span className="mt-2 inline-flex text-[15px] font-semibold text-bc-text underline underline-offset-4 decoration-bc-border group-hover:decoration-bc-accent">{c.learnMore}</span>
              </>
            );
            return w.kind === 'signup' ? (
              <Link key={w.name.english} to="/signup" className={`group block rounded-bc-card ${focusClass}`}>{inner}</Link>
            ) : (
              <DownloadLink key={w.name.english} className={`group block rounded-bc-card ${focusClass}`}>{inner}</DownloadLink>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalPhoto({ language }) {
  const c = copy[language] || copy.english;
  return (
    <section id="download" className="relative isolate overflow-hidden scroll-mt-20">
      <img src={P('final-workout')} alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover" style={{ objectPosition: '50% 45%' }} />
      <div className="absolute inset-0 -z-10 bg-[#0B1410]/60" aria-hidden="true" />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-28 sm:py-36 flex flex-col items-center text-center text-white">
        <h2 className="font-choice font-medium text-[38px] sm:text-[60px] leading-[1.05]">{c.finalTitle}</h2>
        <p className="mt-4 text-[17px] sm:text-[19px] font-semibold text-white/85">{c.finalBody}</p>
        <StoreBadges className="mt-8 justify-center" />
      </div>
    </section>
  );
}

export default function TestPage() {
  const { language } = useLanguage();
  return (
    <MotionConfig reducedMotion="user">
      <MarketingShell className="theme-warm">
        <PhotoHero language={language} />
        <Programs language={language} />
        <PlanStory language={language} />
        <ScanSplit language={language} />
        <ScanStory language={language} />
        <World language={language} />
        <Pricing language={language} />
        <Faq language={language} />
        <FinalPhoto language={language} />
        <StickyDownload language={language} />
      </MarketingShell>
    </MotionConfig>
  );
}
