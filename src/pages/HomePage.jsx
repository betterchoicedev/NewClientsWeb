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
import { GoalScene } from '../features/marketing/home/Scenes';
import { AppScreen } from '../features/marketing/home/AppScreens';
import AppFeatures from '../features/marketing/home/AppFeatures';
import OnYourSide from '../features/marketing/home/OnYourSide';
import FoodBand from '../features/marketing/home/FoodBand';
import AdShorts from '../features/marketing/home/AdShorts';
import CoachChat from '../features/marketing/home/CoachChat';
import LogWays from '../features/marketing/home/LogWays';
import StickerTile from '../features/marketing/home/StickerTile';
import { KitchenScene, DinnerScene } from '../features/marketing/home/Illustrations';

// Home (/): the BetterMe "products" spirit with our product, drawn instead
// of photographed: first-person vector scenes (your hand, your table, your
// plate), the real app recreated as live vector screens, a warm canvas in
// light and dark.

const FADE = { duration: 0.5, ease: 'easeOut' };
const smooth = () => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
const pick = (o, language) => (o ? o[language] || o.english : '');

const copy = {
  hebrew: {
    title1: 'עשו את',
    titleGreen: 'הבחירה',
    title2: 'הטובה יותר.',
    triad: 'תפריט אישי. אימונים מותאמים. מאמן AI שתמיד זמין.',
    cta: 'הורידו בחינם',
    more: 'איך זה עובד',
    note: '3 ימים חינם, ביטול בכל רגע.',
    programsTitle: 'בחרו מטרה. התפריט נבנה סביבה.',
    getStarted: 'לתפריט לדוגמה',
    scanEyebrow: 'סריקה',
    scanTitle: 'צלמו. זה רשום.',
    scanBody: 'הסריקה מזהה כל מזון, מודדת ומחשבת. אתם רק אוכלים.',
    scanLink: 'איך הסריקה עובדת',
    worldTitle: 'הכירו את העולם של BetterChoice',
    joinInvite: 'הצטרפו עם ההזמנה',
    toDownload: 'להורדה',
    finalTitle: 'התפריט שלכם מחכה.',
    finalBody: 'מתחילים ב-3 ימים חינם, ב-App Store וב-Google Play.',
    dinnerCaption: 'גם בארוחת שישי. התפריט מתאים לחיים, לא להפך.',
  },
  english: {
    title1: 'Make the',
    titleGreen: 'better choice.',
    title2: '',
    triad: 'A personal meal plan. Workouts that fit. An AI coach that’s always there.',
    cta: 'Download free',
    more: 'How it works',
    note: '3 days free, cancel anytime.',
    programsTitle: 'Pick a goal. The plan is built around it.',
    getStarted: 'See a sample plan',
    scanEyebrow: 'Scan',
    scanTitle: 'Snap it. It’s logged.',
    scanBody: 'The scan identifies every food, measures and does the math. You just eat.',
    scanLink: 'How the scan works',
    worldTitle: 'Meet the BetterChoice world',
    joinInvite: 'Join with your invite',
    toDownload: 'Download',
    finalTitle: 'Your plan is waiting.',
    finalBody: 'Start with 3 free days, on the App Store and Google Play.',
    dinnerCaption: 'Friday dinner included. The plan fits your life, not the other way around.',
  },
};

// Program cards map to the app's real goals (GOAL_OPTIONS); "Get started"
// pre-selects that goal in the plan preview. Promises are about the plan.
const PROGRAMS = [
  { goal: 'recomp', title: { hebrew: 'פחות שומן, אותו שריר', english: 'Lose fat, keep muscle' }, line: { hebrew: 'תפריט עשיר בחלבון ואימונים שנבנים סביבכם', english: 'A protein-forward plan and workouts built around you' } },
  { goal: 'muscle', title: { hebrew: 'בניית שריר', english: 'Build muscle' }, line: { hebrew: 'החלבון לא יספור את עצמו. יעד חלבון ותוכנית כוח.', english: 'Protein won’t count itself. A protein target and a strength plan.' } },
  { goal: 'lose', title: { hebrew: 'ירידה במשקל', english: 'Lose weight' }, line: { hebrew: 'בלי לספור כל ביס. תפריט שמתאים לשעות ולטעם שלכם.', english: 'Without counting every bite. A plan that fits your hours and taste.' } },
  { goal: 'maintain', title: { hebrew: 'שמירה על משקל', english: 'Maintain' }, line: { hebrew: 'לאכול טוב, בלי לספור כל ביס', english: 'Eat well, without counting every bite' } },
];

const WORLD = [
  { scene: 'maintain', label: { hebrew: 'אפליקציה', english: 'App' }, name: { hebrew: 'BetterChoice לאייפון ולאנדרואיד', english: 'BetterChoice for iPhone and Android' }, kind: 'download' },
  { scene: 'lose', label: { hebrew: 'עם הדיאטנית שלכם', english: 'With your dietitian' }, name: { hebrew: 'קיבלתם קישור הזמנה? הכל מתחבר', english: 'Got an invite link? It all connects' }, kind: 'signup' },
  { scene: 'muscle', label: { hebrew: 'אימונים', english: 'Training' }, name: { hebrew: 'שש תוכניות, בבית או בחדר כושר', english: 'Six plans, at home or at the gym' }, kind: 'download' },
];

/**
 * Mounts a heavy section only when it comes near the screen (the page is long and
 * React drawing all of it at load blocked the main thread). Reserves roughly its
 * height meanwhile. Sections other parts link into (plan story, download) are not deferred.
 */
function Deferred({ children, minHeight }) {
  const ref = React.useRef(null);
  const [show, setShow] = React.useState(typeof IntersectionObserver === 'undefined');
  React.useEffect(() => {
    if (show) return undefined;
    const el = ref.current;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setShow(true); }, { rootMargin: '800px 0px' });
    io.observe(el);
    // An in-page jump (download, scan) mounts everything first so the target doesn't move mid-scroll.
    const all = () => setShow(true);
    window.addEventListener('bc:reveal-all', all);
    return () => { io.disconnect(); window.removeEventListener('bc:reveal-all', all); };
  }, [show]);
  return show ? children : <div ref={ref} aria-hidden="true" style={{ minHeight }} />;
}

/* ---------- Hero: your hand, your table, the app ---------- */

// Split hero: the promise on one side, the moment on the other (your table,
// your plate, the app in your hand), so the scene is above the fold.
function SceneHero({ language }) {
  const c = copy[language] || copy.english;
  const scrollToPrograms = () => document.getElementById('programs')?.scrollIntoView({ behavior: smooth(), block: 'start' });
  return (
    <section className="bg-bc-canvas overflow-x-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-14 pb-12 grid lg:grid-cols-[0.95fr_1.1fr] gap-10 lg:gap-14 items-center lg:min-h-[calc(100svh-64px)]">
        <div className="text-center lg:text-start">
          <h1 className="font-choice font-medium text-[44px] sm:text-[64px] xl:text-[72px] leading-[1.04] tracking-[-0.02em] text-bc-text">
            {c.title1}
            <br />
            <span className="sm:whitespace-nowrap"><span className="text-bc-accent-text">{c.titleGreen}</span> {c.title2}</span>
          </h1>
          <p className="mt-5 text-[18px] sm:text-[22px] font-semibold text-bc-text opacity-80 max-w-xl mx-auto lg:mx-0">{c.triad}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3">
            <DownloadLink className={`${primaryButton} px-9 !font-medium font-choice text-[16px]`}>{c.cta}</DownloadLink>
            <button type="button" onClick={scrollToPrograms} className={`inline-flex min-h-[48px] items-center rounded-full border border-[color-mix(in_srgb,var(--bc-text)_40%,transparent)] px-8 text-[16px] font-semibold text-bc-text hover:bg-[color-mix(in_srgb,var(--bc-text)_6%,transparent)] ${focusClass}`}>
              {c.more}
            </button>
          </div>
          <p className="mt-4 text-[13px] font-semibold text-bc-muted">{c.note}</p>
        </div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...FADE, delay: 0.15 }}
          className="relative isolate h-[420px] sm:h-[540px] lg:h-[600px] mb-16 sm:mb-10">
          <div className="absolute inset-0 overflow-hidden rounded-[40px] border border-bc-border">
            <KitchenScene className="absolute inset-0 h-full w-full" />
          </div>
          {/* meals floating off the scene: breakfast by day (light), dinner by night (dark) */}
          {[
            [['avocado-toast'], ['ramen'], '-top-6 -left-4 sm:-left-8', 0, '!w-[72px] !h-[72px] sm:!w-[96px] sm:!h-[96px]'],
            [['shakshuka-with-bread'], ['grilled-salmon-plate'], 'bottom-24 -left-5 sm:-left-10', 1.2, '!w-[64px] !h-[64px] sm:!w-[88px] sm:!h-[88px]'],
            [['cappuccino'], ['sushi-roll-plate'], '-top-8 right-[30%]', 2.1, '!w-[60px] !h-[60px] sm:!w-[80px] sm:!h-[80px]'],
          ].map(([day, night, pos, d, sz]) => (
            <div key={pos} className={`absolute ${pos} z-10 hx-bob`} style={{ '--a': '-8px', '--dur': '4.5s', '--d': `${d}s` }}>
              <span className="hx-day"><StickerTile slugs={day} size={96} delay={0.4 + d * 0.2} className={sz} /></span>
              <span className="hx-night"><StickerTile slugs={night} size={96} delay={0.4 + d * 0.2} className={sz} /></span>
            </div>
          ))}
          <div className="absolute -bottom-12 sm:-bottom-10 right-[8%] sm:-right-6 origin-bottom-right scale-[0.54] sm:scale-[0.62] -rotate-[5deg]">
            <PhoneFrame label={language === 'hebrew' ? 'אפליקציית BetterChoice' : 'BetterChoice app'} className="shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)]">
              <AppScreen screen="nutrition" language={language} eager />
            </PhoneFrame>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- Programs: illustrated goal cards ---------- */

// Each goal's example day: daily calories, macro split (the app's diet
// styles), and three meals from the dietitian food stickers. Illustrative.
const GOAL_DAY = {
  recomp: { kcal: 1950, split: [40, 30, 30], meals: [['omelette', 'cottage-cheese'], ['quinoa', 'chicken-breast', 'broccoli'], ['protein-yogurt', 'almonds', 'walnuts']] },
  muscle: { kcal: 2450, split: [40, 30, 30], meals: [['oats', 'banana'], ['pasta', 'chicken-breast', 'bell-pepper'], ['salmon', 'sweet-potato', 'broccoli']] },
  lose: { kcal: 1750, split: [30, 40, 30], meals: [['shakshuka-with-bread'], ['white-rice', 'chicken-breast', 'cucumber'], ['yogurt', 'strawberries', 'blueberries']] },
  maintain: { kcal: 2150, split: [30, 40, 30], meals: [['avocado-toast'], ['hummus', 'pita'], ['grilled-salmon-plate']] },
};

function Programs({ language }) {
  const c = copy[language] || copy.english;
  const he = language === 'hebrew';
  const start = (goal) => {
    window.dispatchEvent(new CustomEvent('bc:pick-goal', { detail: goal }));
    document.getElementById('try-it')?.scrollIntoView({ behavior: smooth(), block: 'start' });
  };
  const macroNames = he ? ['חלבון', 'פחמימות', 'שומן'] : ['Protein', 'Carbs', 'Fat'];
  const macroKeys = ['protein', 'carbs', 'fat'];
  return (
    <section id="programs" className="scroll-mt-16 bg-bc-canvas border-t border-bc-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
        <h2 className="mx-auto max-w-3xl text-center font-choice font-medium text-[34px] sm:text-[54px] leading-[1.06] text-bc-text">{c.programsTitle}</h2>
        <div className="mt-12 grid md:grid-cols-2 gap-5">
          {PROGRAMS.map((p, i) => {
            const day = GOAL_DAY[p.goal];
            return (
              <article
                key={p.goal}
                className="group overflow-hidden rounded-bc-card border border-bc-border bg-bc-surface flex flex-col transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.35)]"
              >
                <div className="relative overflow-hidden">
                  <GoalScene goal={p.goal} className="block w-full aspect-[3/2] transition-transform duration-700 group-hover:scale-[1.04]" />
                  {/* the day's target, pinned on the scene */}
                  <span className="absolute top-4 start-4 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[14px] font-bold text-bc-text shadow-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--bc-surface) 88%, transparent)', backdropFilter: 'blur(6px)' }}>
                    <span className="h-2 w-2 rounded-full bg-bc-accent" aria-hidden="true" />
                    <span className="tabular-nums" dir="ltr">~{day.kcal.toLocaleString('en-US')}</span> {he ? 'קק״ל ביום' : 'kcal a day'}
                  </span>
                </div>
                <div className="p-6 sm:p-8 flex flex-col gap-2 flex-1">
                  <p className="font-choice text-[15px] text-bc-muted tabular-nums">{String(i + 1).padStart(2, '0')}</p>
                  <h3 className="font-choice font-medium text-[28px] sm:text-[34px] leading-[1.1] text-bc-text">{pick(p.title, language)}</h3>
                  <p className="text-[16px] sm:text-[17px] font-semibold text-bc-muted">{pick(p.line, language)}</p>
                  {/* macro split */}
                  <div className="mt-4">
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full" dir="ltr" aria-hidden="true">
                      {day.split.map((v, k) => <span key={k} style={{ width: `${v}%`, backgroundColor: `var(--bc-${macroKeys[k]})` }} />)}
                    </div>
                    <p className="mt-2 flex flex-wrap gap-x-4 text-[13px] font-bold text-bc-text">
                      {day.split.map((v, k) => (
                        <span key={k} className="inline-flex items-center gap-1.5">
                          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: `var(--bc-${macroKeys[k]})` }} />
                          {macroNames[k]} <span dir="ltr">{v}%</span>
                        </span>
                      ))}
                    </p>
                  </div>
                  {/* an example day */}
                  <div className="mt-4 flex items-center gap-3 rounded-[20px] border border-bc-border bg-bc-canvas px-4 py-3">
                    <span className="text-[13px] font-bold text-bc-muted">{he ? 'יום לדוגמה' : 'A sample day'}</span>
                    <span className="flex flex-1 justify-end gap-1">
                      {day.meals.map((m, k) => (
                        <span key={k} className="transition-transform duration-300 group-hover:-translate-y-1" style={{ transitionDelay: `${k * 60}ms` }}>
                          <StickerTile slugs={m} size={56} inView delay={k * 0.12} />
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => start(p.goal)}
                      className={`inline-flex min-h-[44px] items-center rounded-full border border-[color-mix(in_srgb,var(--bc-text)_40%,transparent)] px-6 text-[15px] font-semibold text-bc-text hover:bg-[color-mix(in_srgb,var(--bc-text)_6%,transparent)] ${focusClass}`}
                    >
                      {c.getStarted}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
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
                <span className="mt-2 inline-flex text-[15px] font-semibold text-bc-text underline underline-offset-4 decoration-bc-border group-hover:decoration-bc-accent">{w.kind === 'signup' ? c.joinInvite : c.toDownload}</span>
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
    <section id="download" className="scroll-mt-20 bg-bc-canvas border-t border-bc-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 sm:pt-24 pb-28 flex flex-col items-center text-center">
        <h2 className="font-choice font-medium text-[38px] sm:text-[60px] leading-[1.05] text-bc-text">{c.finalTitle}</h2>
        <p className="mt-4 text-[17px] sm:text-[19px] font-semibold text-bc-muted">{c.finalBody}</p>
        <StoreBadges className="mt-8 justify-center" />
        <div className="mt-12 w-full overflow-hidden rounded-[40px] border border-bc-border aspect-[16/10] sm:aspect-[5/2]">
          <DinnerScene className="block h-full w-full" />
        </div>
        <p className="mt-4 text-[14px] font-semibold text-bc-muted">{c.dinnerCaption}</p>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { language } = useLanguage();
  return (
    <MotionConfig reducedMotion="user">
      <MarketingShell className="theme-warm">
        <SceneHero language={language} />
        <CoachChat language={language} />
        <Programs language={language} />
        <PlanStory language={language} stickers />
        <Deferred minHeight="560px"><FoodBand language={language} /></Deferred>
        <Deferred minHeight="900px"><AppFeatures language={language} /></Deferred>
        <Deferred minHeight="1200px"><OnYourSide language={language} /></Deferred>
        <Deferred minHeight="760px"><AdShorts language={language} /></Deferred>
        <Deferred minHeight="900px"><LogWays language={language} /></Deferred>
        <Deferred minHeight="1800px"><ScanStory language={language} /></Deferred>
        <Deferred minHeight="700px"><World language={language} /></Deferred>
        <Deferred minHeight="700px"><Pricing language={language} /></Deferred>
        <Deferred minHeight="700px"><Faq language={language} /></Deferred>
        <FinalScene language={language} />
        <StickyDownload language={language} />
      </MarketingShell>
    </MotionConfig>
  );
}
