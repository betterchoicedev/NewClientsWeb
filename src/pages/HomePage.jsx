import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion, useInView } from 'framer-motion';
import { BookOpen, Dumbbell, MessageCircle, Utensils } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import MarketingShell from '../components/brand/MarketingShell';
import DownloadLink from '../components/brand/DownloadLink';
import StoreBadges from '../components/brand/StoreBadges';
import { primaryButton } from '../components/brand/ui';
import { Mark, Wordmark } from '../components/brand/Logo';
import { PhoneFrame, PhoneFootage } from '../features/marketing/PhoneFrame';
import ScanStory from '../features/marketing/ScanStory';
import { LogMethods, Pricing, Faq, StickyDownload } from '../features/marketing/Sections';

// Motion rule from BetterApp/DESIGN.md: enter is a 400ms fade.
const FADE = { duration: 0.4, ease: 'easeOut' };

// Flat color, no gradient or shadow: the green well everywhere, lavender only for wellness.
const panelTint = (tint) =>
  tint === 'wellness'
    ? { fill: 'var(--bc-wellness-well)', line: 'var(--bc-wellness)' }
    : { fill: 'var(--bc-accent-well)', line: 'var(--bc-accent)' };

/** A radius-32 color panel behind a phone, with the brand hexagon drawn large inside it. */
function ColorPanel({ tint, children, className = '' }) {
  const { fill, line } = panelTint(tint);
  return (
    <div
      className={`relative overflow-hidden rounded-bc-card flex items-center justify-center px-8 py-10 sm:px-14 sm:py-12 transition-colors duration-[400ms] ${className}`}
      style={{ backgroundColor: fill }}
    >
      <Mark
        size={560}
        color={line}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-25 pointer-events-none transition-[stroke] duration-[400ms]"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

// NAV_THEME.macros, the colors the app uses for protein, carbs, and fat.
const MACROS = [
  { key: 'protein', english: 'Protein', hebrew: 'חלבון' },
  { key: 'carbs', english: 'Carbs', hebrew: 'פחמימות' },
  { key: 'fat', english: 'Fat', hebrew: 'שומן' },
];

function MacroChips({ language }) {
  return (
    <ul className="mt-6 flex flex-wrap gap-2" aria-label={language === 'hebrew' ? 'מאקרו' : 'Macros'}>
      {MACROS.map((macro) => (
        <li
          key={macro.key}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-bold"
          style={{ backgroundColor: `var(--bc-${macro.key}-well)`, color: `var(--bc-${macro.key})` }}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `var(--bc-${macro.key})` }} aria-hidden="true" />
          {macro[language] || macro.english}
        </li>
      ))}
    </ul>
  );
}

const copy = {
  english: {
    title: 'Make the better choice.',
    subhead: 'You’ve started over enough times. This time, someone stays with you.',
    features: 'Nutrition, training, and a coach, in one app.',
    cta: 'Download the app',
    platforms: 'For iPhone and Android',
    heroPhone: 'BetterChoice app on iPhone',
    tourEyebrow: 'In the app',
    tourTitle: 'Everything around the scan, in one app.',
    qr: 'On a computer? Scan to get the app.',
    finalTitle: 'Get the app.',
    finalBody: 'Available on the App Store and Google Play.',
  },
  hebrew: {
    title: 'עשו את הבחירה הטובה יותר.',
    subhead: 'התחלתם מחדש מספיק פעמים. הפעם, מישהו נשאר איתכם.',
    features: 'תזונה, אימון ומאמן, באפליקציה אחת.',
    cta: 'הורידו את האפליקציה',
    platforms: 'לאייפון ולאנדרואיד',
    heroPhone: 'אפליקציית BetterChoice באייפון',
    tourEyebrow: 'באפליקציה',
    tourTitle: 'כל מה שמסביב לסריקה, באפליקציה אחת.',
    qr: 'במחשב? סרקו כדי להוריד.',
    finalTitle: 'הורידו את האפליקציה.',
    finalBody: 'זמינה ב-App Store וב-Google Play.',
  },
};

// Order: Nutrition, Training, AI chat, Health diary. Wellness and Journey are
// "Coming soon" in the app, so they stay off the page until they ship.
const SECTIONS = [
  {
    key: 'nutrition',
    icon: Utensils,
    label: { english: 'Nutrition', hebrew: 'תזונה' },
    line: {
      english: 'A meal plan built to your calorie and macro targets, with alternatives when you want a swap.',
      hebrew: 'תפריט שנבנה ליעדי הקלוריות והמאקרו שלכם, עם חלופות כשבא לכם להחליף.',
    },
  },
  {
    key: 'training',
    icon: Dumbbell,
    label: { english: 'Training', hebrew: 'אימון' },
    line: {
      english: 'Six plans for fat loss or muscle, two to four days a week. Log your weights as you train.',
      hebrew: 'שש תוכניות לחיטוב או לשריר, יומיים עד ארבעה בשבוע. רושמים משקלים תוך כדי אימון.',
    },
  },
  {
    key: 'chat',
    icon: MessageCircle,
    label: { english: 'Beti, your coach', hebrew: 'Beti, המאמנת שלכם' },
    line: {
      english: 'Beti knows your plan and your day, and answers with both in mind. By text or voice.',
      hebrew: 'Beti מכירה את התוכנית שלכם ואת היום שלכם, ועונה בהתאם. בכתיבה או בקול.',
    },
  },
  {
    key: 'diary',
    icon: BookOpen,
    label: { english: 'Progress', hebrew: 'התקדמות' },
    line: {
      english: 'Calories and macros against your plan, your weight and measurements, and your streak.',
      hebrew: 'קלוריות ומאקרו מול התוכנית, משקל ומדידות, והרצף שלכם.',
    },
  },
];

const pick = (entry, language) => entry[language] || entry.english;

function HeroPhone({ footageKey, title, className = '' }) {
  return (
    <div className={className}>
      <PhoneFrame label={title}>
        <PhoneFootage footageKey={footageKey} title={title} language="english" />
      </PhoneFrame>
    </div>
  );
}

function Hero({ language }) {
  const c = copy[language] || copy.english;
  const isHebrew = language === 'hebrew';

  return (
    // Green well (not the canvas) so the dark app recordings don't melt into the page.
    <section className="relative overflow-hidden" style={{ backgroundColor: 'var(--bc-accent-well)' }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={FADE}
        className="mx-auto max-w-4xl px-4 sm:px-6 pt-14 sm:pt-20 flex flex-col items-center text-center"
      >
        <h1
          className={`text-bc-text text-[44px] sm:text-[72px] lg:text-[88px] leading-[1.02] tracking-[-0.02em] ${
            'font-choice font-medium'
          }`}
        >
          {isHebrew ? (
            c.title
          ) : (
            <>
              {/* "Make the" + the real wordmark. The logo's lettering replaces "better choice". */}
              <span className="sr-only">{c.title}</span>
              <span aria-hidden="true">
                Make the{' '}
                <span className="whitespace-nowrap">
                  <Wordmark height="0.74em" decorative className="inline-block align-baseline" />.
                </span>
              </span>
            </>
          )}
        </h1>
        <p className="mt-6 text-bc-text text-[20px] sm:text-[24px] leading-snug font-semibold max-w-[36rem]">
          {c.subhead}
        </p>
        <p className="mt-3 text-bc-muted text-[15px] sm:text-[17px] font-semibold">{c.features}</p>
        {/* Choice Sans ships 400/500 only and has no Hebrew, so it applies to the English label at 500. */}
        <DownloadLink className={`${primaryButton} mt-8 px-10 !font-medium font-choice text-[16px] tracking-[0.01em]`}>
          {c.cta}
        </DownloadLink>
        <span className="mt-3 text-[13px] font-semibold text-bc-muted">{c.platforms}</span>
      </motion.div>

      {/* Three real app screens, fanned flat (no 3D), cropped at the bottom like a stage. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...FADE, delay: 0.15 }}
        className="relative mt-14 h-[430px] sm:h-[560px] overflow-hidden"
        role="img"
        aria-label={c.heroPhone}
      >
        <Mark
          size={760}
          className="absolute left-1/2 top-24 -translate-x-1/2 opacity-20 pointer-events-none"
        />
        <div className="relative flex justify-center items-start" dir="ltr">
          <HeroPhone
            footageKey="training"
            title="Training"
            className="hidden sm:block mt-20 -mr-16 lg:-mr-10 rotate-[-7deg] scale-[0.88] origin-top"
          />
          <HeroPhone footageKey="hero" title="Nutrition" className="relative z-10" />
          <HeroPhone
            footageKey="diary"
            title="Analytics"
            className="hidden sm:block mt-20 -ml-16 lg:-ml-10 rotate-[7deg] scale-[0.88] origin-top"
          />
        </div>
      </motion.div>
    </section>
  );
}

function SectionBlock({ section, index, language, onActive }) {
  const ref = useRef(null);
  // Active while the block crosses the middle of the viewport.
  const centered = useInView(ref, { margin: '-50% 0px -50% 0px' });
  const isHebrew = language === 'hebrew';
  const tintColor = section.tint === 'wellness' ? 'var(--bc-wellness)' : 'var(--bc-accent)';
  const label = pick(section.label, language);

  useEffect(() => {
    if (centered) onActive(index);
  }, [centered, index, onActive]);

  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={FADE}
      aria-labelledby={`section-${section.key}`}
      className="py-16 lg:py-0 lg:min-h-[80vh] flex flex-col justify-center border-t border-bc-border lg:border-0 first:border-0"
    >
      <p
        className="self-start inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-bold"
        style={{ color: tintColor, backgroundColor: panelTint(section.tint).fill }}
      >
        <section.icon size={16} aria-hidden="true" />
        <span id={`section-${section.key}`}>{label}</span>
        <span className="font-choice tabular-nums opacity-70" dir="ltr">{String(index + 1).padStart(2, '0')}</span>
      </p>
      <h2
        className={`mt-4 text-bc-text text-[28px] sm:text-[36px] lg:text-[40px] leading-[1.15] tracking-[-0.01em] max-w-[28rem] ${
          'font-choice font-medium'
        }`}
      >
        {pick(section.line, language)}
      </h2>
      {section.key === 'nutrition' ? <MacroChips language={language} /> : null}

      {/* Below lg every block carries its own phone; on lg the sticky phone takes over. */}
      <ColorPanel tint={section.tint} className="lg:hidden mt-10">
        <PhoneFrame label={label}>
          <PhoneFootage
            footageKey={section.key}
            title={label}
            icon={section.icon}
            tint={section.tint}
            language={language}
          />
        </PhoneFrame>
      </ColorPanel>
    </motion.article>
  );
}

function ProductTour({ language }) {
  const c = copy[language] || copy.english;
  const [active, setActive] = useState(0);
  const current = SECTIONS[active];
  const currentLabel = pick(current.label, language);

  return (
    <section aria-labelledby="tour-title" className="border-t border-bc-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 sm:pt-28">
        <p className="text-[13px] font-bold text-bc-accent">{c.tourEyebrow}</p>
        <h2 id="tour-title" className="mt-3 font-choice font-medium text-[32px] sm:text-[48px] leading-[1.08] text-bc-text max-w-3xl">
          {c.tourTitle}
        </h2>
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:grid lg:grid-cols-2 lg:gap-16">
        <div className="lg:py-[10vh]">
          {SECTIONS.map((section, index) => (
            <SectionBlock
              key={section.key}
              section={section}
              index={index}
              language={language}
              onActive={setActive}
            />
          ))}
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-16 h-[calc(100vh-64px)] flex flex-col items-center justify-center gap-6">
            <ColorPanel tint={current.tint} className="w-full max-w-[480px] !py-6">
            <PhoneFrame label={currentLabel}>
              <AnimatePresence initial={false}>
                <motion.div
                  key={current.key}
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={FADE}
                >
                  <PhoneFootage
                    footageKey={current.key}
                    title={currentLabel}
                    icon={current.icon}
                    tint={current.tint}
                    language={language}
                  />
                </motion.div>
              </AnimatePresence>
            </PhoneFrame>
            </ColorPanel>
            <div className="flex items-center gap-2" aria-hidden="true">
              {SECTIONS.map((section, index) => (
                <span
                  key={section.key}
                  className="h-1.5 rounded-full transition-all duration-[400ms]"
                  style={{
                    width: index === active ? 20 : 6,
                    backgroundColor:
                      index === active
                        ? section.tint === 'wellness'
                          ? 'var(--bc-wellness)'
                          : 'var(--bc-accent)'
                        : 'var(--bc-border)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalDownload({ language }) {
  const c = copy[language] || copy.english;
  return (
    <section id="download" className="scroll-mt-20 mx-auto max-w-6xl px-4 sm:px-6 pb-20">
      {/* The closing band is flat accent with the dark label color, like the primary button. */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={FADE}
        className="relative overflow-hidden rounded-bc-card bg-bc-accent text-bc-on-accent px-6 py-16 sm:py-20 flex flex-col items-center text-center"
      >
        <Mark
          size={620}
          color="var(--bc-on-accent)"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none"
        />
        <h2 className={`relative text-[32px] sm:text-[44px] leading-[1.1] font-choice font-medium`}>
          {c.finalTitle}
        </h2>
        <p className="relative mt-3 text-[16px] sm:text-[17px] font-semibold opacity-75">{c.finalBody}</p>
        <StoreBadges className="relative mt-8 justify-center" />
        <div className="relative mt-8 hidden lg:flex items-center gap-4">
          <img src="/qr-app.svg" alt="" width="96" height="96" className="rounded-[12px] bg-white p-1.5" />
          <span className="max-w-[12rem] text-start text-[14px] font-semibold opacity-80">{c.qr}</span>
        </div>
      </motion.div>
    </section>
  );
}

export default function HomePage() {
  const { language } = useLanguage();
  const location = useLocation();

  // Header "Download" on other pages links to /#download.
  useEffect(() => {
    if (location.hash !== '#download') return;
    const id = window.requestAnimationFrame(() => {
      document.getElementById('download')?.scrollIntoView({ block: 'center' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [location.hash]);

  return (
    <MotionConfig reducedMotion="user">
      <MarketingShell>
        <Hero language={language} />
        <ScanStory language={language} />
        <LogMethods language={language} />
        <ProductTour language={language} />
        <Pricing language={language} />
        <Faq language={language} />
        <FinalDownload language={language} />
        <StickyDownload language={language} />
      </MarketingShell>
    </MotionConfig>
  );
}

