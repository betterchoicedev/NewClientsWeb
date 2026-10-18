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
import ScanStory, { Stage } from '../features/marketing/ScanStory';
import { Pricing, Faq, StickyDownload } from '../features/marketing/Sections';
import { PhoneFrame } from '../features/marketing/PhoneFrame';
import { GoalScene, HeroTable, HandBack, HandFront } from '../features/marketing/test/Scenes';
import { AppScreen } from '../features/marketing/test/AppScreens';
import AppFeatures from '../features/marketing/test/AppFeatures';

// TEST (/test): the BetterMe "products" spirit with our product, drawn instead
// of photographed: first-person vector scenes (your hand, your table, your
// plate), the real app recreated as live vector screens, a warm canvas in
// light and dark. The production landing (/) is untouched.

const FADE = { duration: 0.5, ease: 'easeOut' };
const pick = (o, language) => (o ? o[language] || o.english : '');

const copy = {
  hebrew: {
    title1: 'עשו את',
    titleGreen: 'הבחירה',
    title2: 'הטובה יותר.',
    triad: 'תפריט אישי. אימונים מותאמים. מאמנת שתמיד שם.',
    cta: 'הורידו בחינם',
    more: 'איך זה עובד',
    note: '3 ימים חינם, ביטול בכל רגע.',
    programsTitle: 'בחרו מטרה. התפריט נבנה סביבה.',
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
    programsTitle: 'Pick a goal. The plan is built around it.',
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
// pre-selects that goal in the plan preview. Promises are about the plan.
const PROGRAMS = [
  { goal: 'recomp', title: { hebrew: 'פחות שומן, אותו שריר', english: 'Lose fat, keep muscle' }, line: { hebrew: 'תפריט עשיר בחלבון ואימונים שנבנים סביבכם', english: 'A protein-forward plan and workouts built around you' } },
  { goal: 'muscle', title: { hebrew: 'בניית שריר', english: 'Build muscle' }, line: { hebrew: 'יותר חלבון, ותוכנית אימונים של יומיים עד ארבעה בשבוע', english: 'More protein, and a two-to-four-day training plan' } },
  { goal: 'lose', title: { hebrew: 'ירידה במשקל', english: 'Lose weight' }, line: { hebrew: 'תפריט שמתאים לשעות ולטעם שלכם', english: 'A plan that fits your hours and your taste' } },
  { goal: 'maintain', title: { hebrew: 'שמירה על משקל', english: 'Maintain' }, line: { hebrew: 'לאכול טוב, בלי לספור כל ביס', english: 'Eat well, without counting every bite' } },
];

const WORLD = [
  { scene: 'maintain', label: { hebrew: 'אפליקציה', english: 'App' }, name: { hebrew: 'BetterChoice לאייפון ולאנדרואיד', english: 'BetterChoice for iPhone and Android' }, kind: 'download' },
  { scene: 'lose', label: { hebrew: 'עם הדיאטנית שלכם', english: 'With your dietitian' }, name: { hebrew: 'קיבלתם קישור הזמנה? הכל מתחבר', english: 'Got an invite link? It all connects' }, kind: 'signup' },
  { scene: 'muscle', label: { hebrew: 'אימונים', english: 'Training' }, name: { hebrew: 'שש תוכניות, בבית או בחדר כושר', english: 'Six plans, at home or at the gym' }, kind: 'download' },
];

/* ---------- Hero: your hand, your table, the app ---------- */

function HeldPhone({ language, screen = 'nutrition', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <HandBack className="absolute -bottom-[60px] -end-[92px] w-[300px] sm:w-[340px] z-0 rtl:-scale-x-100" />
      <motion.div className="relative z-10" style={{ rotate: -4 }}>
        <PhoneFrame label={language === 'hebrew' ? 'אפליקציית BetterChoice' : 'BetterChoice app'}>
          <AppScreen screen={screen} language={language} />
        </PhoneFrame>
      </motion.div>
      <HandFront className="absolute -bottom-[70px] -start-[86px] w-[300px] sm:w-[340px] z-20 rtl:-scale-x-100" />
    </div>
  );
}

// Split hero: the promise on one side, the moment on the other (your table,
// your plate, the app in your hand), so the scene is above the fold.
function SceneHero({ language }) {
  const c = copy[language] || copy.english;
  const scrollToPrograms = () => document.getElementById('programs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <section className="bg-bc-canvas">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-14 pb-12 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center lg:min-h-[calc(100svh-64px)]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={FADE} className="text-center lg:text-start">
          <h1 className="font-choice font-medium text-[44px] sm:text-[64px] xl:text-[72px] leading-[1.04] tracking-[-0.02em] text-bc-text">
            {c.title1}
            <br />
            <span className="sm:whitespace-nowrap"><span className="text-bc-accent-text">{c.titleGreen}</span> {c.title2}</span>
          </h1>
          <p className="mt-5 text-[18px] sm:text-[22px] font-semibold text-bc-text/80 max-w-xl mx-auto lg:mx-0">{c.triad}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3">
            <DownloadLink className={`${primaryButton} px-9 !font-medium font-choice text-[16px]`}>{c.cta}</DownloadLink>
            <button type="button" onClick={scrollToPrograms} className={`inline-flex min-h-[48px] items-center rounded-full border border-bc-text/40 px-8 text-[16px] font-semibold text-bc-text hover:bg-bc-text/5 ${focusClass}`}>
              {c.more}
            </button>
          </div>
          <p className="mt-4 text-[13px] font-semibold text-bc-muted">{c.note}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...FADE, delay: 0.15 }}
          className="relative isolate overflow-hidden rounded-[40px] h-[460px] sm:h-[560px] lg:h-[620px] flex justify-center border border-bc-border">
          <HeroTable className="absolute inset-0 -z-10 h-full w-full" />
          <HeldPhone language={language} screen="nutrition" className="mt-10 sm:mt-12" />
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- Programs: illustrated goal cards ---------- */

function Programs({ language }) {
  const c = copy[language] || copy.english;
  const start = (goal) => {
    window.dispatchEvent(new CustomEvent('bc:pick-goal', { detail: goal }));
    document.getElementById('try-it')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <section id="programs" className="scroll-mt-16 bg-bc-canvas border-t border-bc-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
        <h2 className="mx-auto max-w-3xl text-center font-choice font-medium text-[34px] sm:text-[54px] leading-[1.06] text-bc-text">{c.programsTitle}</h2>
        <div className="mt-12 grid md:grid-cols-2 gap-5">
          {PROGRAMS.map((p, i) => (
            <motion.article
              key={p.goal}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={FADE}
              className="overflow-hidden rounded-bc-card border border-bc-border bg-bc-surface flex flex-col"
            >
              <GoalScene goal={p.goal} className="block w-full aspect-[3/2]" />
              <div className="p-6 sm:p-8 flex flex-col gap-2 flex-1">
                <p className="font-choice text-[15px] text-bc-muted tabular-nums">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="font-choice font-medium text-[28px] sm:text-[34px] leading-[1.1] text-bc-text">{pick(p.title, language)}</h3>
                <p className="text-[16px] sm:text-[17px] font-semibold text-bc-muted">{pick(p.line, language)}</p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => start(p.goal)}
                    className={`inline-flex min-h-[44px] items-center rounded-full bg-bc-text px-7 text-[15px] font-semibold text-bc-canvas hover:opacity-90 ${focusClass}`}
                  >
                    {c.getStarted}
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Scan teaser: the plate being read ---------- */

function ScanSplit({ language }) {
  const c = copy[language] || copy.english;
  const Arrow = language === 'hebrew' ? ArrowLeft : ArrowRight;
  return (
    <section className="bg-bc-band border-t border-bc-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 grid lg:grid-cols-2 gap-10 items-center">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.3 }} transition={FADE}
          className="overflow-hidden rounded-bc-card p-6 sm:p-10 flex justify-center" style={{ backgroundColor: 'var(--scene-bg)' }}>
          <Stage step={1} language={language} />
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
                <div className="overflow-hidden rounded-[24px] border border-bc-border">
                  <GoalScene goal={w.scene} className="block w-full aspect-[4/3] transition-transform duration-500 group-hover:scale-[1.03]" />
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

function FinalScene({ language }) {
  const c = copy[language] || copy.english;
  return (
    <section id="download" className="relative isolate overflow-hidden scroll-mt-20 border-t border-bc-border">
      <HeroTable className="absolute inset-0 -z-10 h-full w-full" />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-20 pb-56 sm:pb-64 flex flex-col items-center text-center">
        <h2 className="font-choice font-medium text-[38px] sm:text-[60px] leading-[1.05] text-bc-text">{c.finalTitle}</h2>
        <p className="mt-4 text-[17px] sm:text-[19px] font-semibold text-bc-muted">{c.finalBody}</p>
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
        <SceneHero language={language} />
        <Programs language={language} />
        <PlanStory language={language} />
        <AppFeatures language={language} />
        <ScanSplit language={language} />
        <ScanStory language={language} />
        <World language={language} />
        <Pricing language={language} />
        <Faq language={language} />
        <FinalScene language={language} />
        <StickyDownload language={language} />
      </MarketingShell>
    </MotionConfig>
  );
}
