import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, ScanBarcode, Mic, Type, MessageCircle, GlassWater, ChevronDown } from 'lucide-react';
import DownloadLink from '../../components/brand/DownloadLink';
import { primaryButton, focusClass } from '../../components/brand/ui';
import { PRICING } from './pricing';

const FADE = { duration: 0.4, ease: 'easeOut' };
const pick = (o, language) => o[language] || o.english;

function SectionHead({ eyebrow, title, sub, language, center = false }) {
  return (
    <div className={center ? 'text-center flex flex-col items-center' : ''}>
      {eyebrow ? <p className="text-[13px] font-bold text-bc-accent">{pick(eyebrow, language)}</p> : null}
      <h2 className="mt-3 font-choice font-medium text-[32px] sm:text-[48px] leading-[1.08] text-bc-text max-w-3xl">{pick(title, language)}</h2>
      {sub ? <p className="mt-4 text-[17px] sm:text-[19px] font-semibold text-bc-muted max-w-2xl">{pick(sub, language)}</p> : null}
    </div>
  );
}

/* ---------- Every way to log ---------- */

const METHODS = [
  {
    icon: Camera,
    title: { hebrew: 'תמונה', english: 'Photo' },
    line: { hebrew: 'מצלמים את הצלחת, והסריקה עושה את השאר.', english: 'Snap the plate. The scan does the rest.' },
  },
  {
    icon: ScanBarcode,
    title: { hebrew: 'ברקוד', english: 'Barcode' },
    line: { hebrew: 'סורקים את האריזה ומקבלים את הערכים שלה.', english: 'Scan the package and get its values.' },
  },
  {
    icon: Mic,
    title: { hebrew: 'קול', english: 'Voice' },
    line: { hebrew: 'אומרים מה אכלתם, במילים שלכם.', english: 'Say what you ate, in your own words.' },
  },
  {
    icon: Type,
    title: { hebrew: 'טקסט', english: 'Text' },
    line: { hebrew: 'כותבים "שתי פרוסות לחם עם חומוס" וזהו.', english: 'Type "two slices of bread with hummus" and you’re done.' },
  },
  {
    icon: MessageCircle,
    title: { hebrew: 'וואטסאפ', english: 'WhatsApp' },
    line: { hebrew: 'שולחים ל-Beti תמונה או הקלטה, והיא רושמת.', english: 'Send Beti a photo or a voice note, and she logs it.' },
  },
  {
    icon: GlassWater,
    title: { hebrew: 'מים', english: 'Water' },
    line: { hebrew: 'כוס בלחיצה, עם יעד יומי.', english: 'A glass in one tap, with a daily goal.' },
  },
];

export function LogMethods({ language }) {
  return (
    <section className="border-t border-bc-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
        <SectionHead
          language={language}
          eyebrow={{ hebrew: 'רישום', english: 'Logging' }}
          title={{ hebrew: 'כל דרך לרשום, בלי להקליד טבלאות.', english: 'Every way to log, no spreadsheets.' }}
          sub={{ hebrew: 'מה שנוח לכם באותו רגע. הכל נכנס לאותו יומן.', english: 'Whatever suits the moment. It all lands in the same diary.' }}
        />
        <div className="mt-12 grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {METHODS.map((m) => {
            const Icon = m.icon;
            return (
              <motion.div
                key={m.title.english}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={FADE}
                className="rounded-bc-card border border-bc-border bg-bc-surface p-5 sm:p-7"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bc-accent-well)] text-bc-accent">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-choice font-medium text-[20px] sm:text-[24px] text-bc-text">{pick(m.title, language)}</h3>
                <p className="mt-2 text-[14px] sm:text-[15px] font-semibold text-bc-muted leading-relaxed">{pick(m.line, language)}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- Pricing ---------- */

export function Pricing({ language }) {
  const he = language === 'hebrew';
  const { trialDays, monthly, yearlyPerMonth, currency } = PRICING;
  return (
    <section className="border-t border-bc-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 grid lg:grid-cols-2 gap-10 items-center">
        <SectionHead
          language={language}
          eyebrow={{ hebrew: 'מחיר', english: 'Price' }}
          title={{ hebrew: `${PRICING.trialDays} ימים עלינו.`, english: `${PRICING.trialDays} days on us.` }}
          sub={{
            hebrew: 'מנסים את הכל. אפשר לבטל בכל רגע מהגדרות החשבון.',
            english: 'Try everything. Cancel any time from your account settings.',
          }}
        />
        <div className="rounded-bc-card border border-bc-border bg-bc-surface p-6 sm:p-8">
          <p className="font-choice font-medium text-[44px] sm:text-[56px] leading-none text-bc-text">
            {he ? `${trialDays} ${trialDays > 10 ? 'יום' : 'ימים'} חינם` : `${trialDays} ${trialDays === 1 ? 'day' : 'days'} free`}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-bc-field border border-bc-border p-4">
              <p className="text-[13px] font-semibold text-bc-muted">{he ? 'חודשי' : 'Monthly'}</p>
              <p className="mt-1 font-choice font-medium text-[28px] text-bc-text" dir="ltr">
                {currency}{monthly}
                <span className="text-[14px] text-bc-muted">{he ? ' /חודש' : ' /mo'}</span>
              </p>
            </div>
            <div className="rounded-bc-field border-2 border-bc-accent p-4">
              <p className="text-[13px] font-semibold text-bc-muted">{he ? 'שנתי' : 'Yearly'}</p>
              <p className="mt-1 font-choice font-medium text-[28px] text-bc-text" dir="ltr">
                {currency}{yearlyPerMonth}
                <span className="text-[14px] text-bc-muted">{he ? ' /חודש' : ' /mo'}</span>
              </p>
            </div>
          </div>
          <p className="mt-4 text-[13px] font-semibold text-bc-muted">
            {he ? 'המנוי השנתי מחויב פעם בשנה.' : 'The yearly plan is billed once a year.'}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */

const FAQ = [
  {
    q: { hebrew: 'איך נבנה התפריט שלי?', english: 'How is my meal plan built?' },
    a: {
      hebrew: 'בהורדה עונים על כמה שאלות: מטרה, גוף, שגרה, סגנון אכילה, אלרגיות והגבלות וחלון אכילה. מיד בסיום נבנה תפריט מלא לפי יעדי הקלוריות והמאקרו שלכם, עם חלופות לכל ארוחה.',
      english: 'When you download, you answer a few questions: goal, body, routine, eating style, allergies and limits, and eating window. Right after, a full plan is built to your calorie and macro targets, with alternatives for every meal.',
    },
  },
  {
    q: { hebrew: 'התפריט משתנה עם הזמן?', english: 'Does the plan change over time?' },
    a: {
      hebrew: 'כשהמשקל או השגרה שלכם משתנים, יעדי הקלוריות מתעדכנים, וכל ארוחה נמדדת מול היעד החדש. אפשר להחליף ולערוך ארוחות בתפריט בכל רגע.',
      english: 'When your weight or routine changes, your calorie targets update and every meal is checked against the new ones. You can swap and edit meals in the plan any time.',
    },
  },
  {
    q: { hebrew: 'כמה מדויקת הסריקה?', english: 'How accurate is the scan?' },
    a: {
      hebrew: 'זו הערכה, לא משקל מטבח. אתם רואים כל מזון בנפרד, כמה ה-AI בטוח בו ומה הוא ראה, ואפשר לתקן גרמים בלחיצה או במילים. מנות מעורבות ורטבים קשים יותר להערכה.',
      english: 'It’s an estimate, not a kitchen scale. You see every food separately, how sure the AI is and what it saw, and you can fix the grams in a tap or in words. Mixed dishes and sauces are harder to estimate.',
    },
  },
  {
    q: { hebrew: 'אילו טלפונים מודדים עומק?', english: 'Which phones measure depth?' },
    a: {
      hebrew: 'אייפונים שתומכים בחיישן עומק משתמשים בו כדי לדייק מנות כמו אורז, פסטה וסלט. בשאר הטלפונים, כולל אנדרואיד, הכמות מוערכת מהתמונה ומגודל הצלחת.',
      english: 'iPhones that support a depth sensor use it to refine portions like rice, pasta and salad. On other phones, including Android, the amount is estimated from the photo and the plate size.',
    },
  },
  {
    q: { hebrew: 'מי זאת Beti?', english: 'Who is Beti?' },
    a: {
      hebrew: 'המאמנת שבאפליקציה. היא מכירה את התוכנית שלכם ואת מה שאכלתם היום, עונה על שאלות תזונה ואימון, ומציעה מה לאכול בארוחה הבאה. זה לא ייעוץ רפואי.',
      english: 'The coach in the app. She knows your plan and what you ate today, answers nutrition and training questions, and suggests your next meal. It’s not medical advice.',
    },
  },
  {
    q: { hebrew: 'יש גם אימונים?', english: 'Is there training too?' },
    a: {
      hebrew: 'כן. שש תוכניות, לחיטוב או לבניית שריר, בין יומיים לארבעה ימים בשבוע. רושמים משקלים תוך כדי האימון.',
      english: 'Yes. Six plans, for fat loss or muscle gain, two to four days a week. You log your weights as you train.',
    },
  },
  {
    q: { hebrew: 'באילו שפות?', english: 'Which languages?' },
    a: { hebrew: 'עברית ואנגלית, כולל מימין לשמאל.', english: 'Hebrew and English, with full right-to-left support.' },
  },
  {
    q: { hebrew: 'איך מבטלים?', english: 'How do I cancel?' },
    a: {
      hebrew: 'מהגדרות החשבון, באפליקציה או באתר. הגישה נשארת עד סוף התקופה ששולמה.',
      english: 'From account settings, in the app or on the website. Access stays until the end of the paid period.',
    },
  },
];

export function Faq({ language }) {
  const [open, setOpen] = useState(0);
  return (
    <section className="border-t border-bc-border">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20 sm:py-28">
        <SectionHead language={language} eyebrow={{ hebrew: 'שאלות', english: 'Questions' }} title={{ hebrew: 'שאלות נפוצות', english: 'Common questions' }} />
        <ul className="mt-10 divide-y divide-bc-border border-y border-bc-border">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <li key={item.q.english}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className={`w-full flex items-center justify-between gap-4 py-5 text-start rounded ${focusClass}`}
                >
                  <span className="font-choice font-medium text-[18px] sm:text-[20px] text-bc-text">{pick(item.q, language)}</span>
                  <ChevronDown size={20} aria-hidden="true" className={`flex-none text-bc-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen ? (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={FADE} className="pb-5 text-[15px] sm:text-[16px] font-semibold text-bc-muted leading-relaxed">
                    {pick(item.a, language)}
                  </motion.p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ---------- Mobile sticky download bar ---------- */

export function StickyDownload({ language }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const pastHero = window.scrollY > window.innerHeight * 0.8;
      const finalBand = document.getElementById('download');
      const nearEnd = finalBand ? finalBand.getBoundingClientRect().top < window.innerHeight : false;
      setShow(pastHero && !nearEnd);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      aria-hidden={!show}
      className={`sm:hidden fixed inset-x-0 bottom-0 z-30 border-t border-bc-border bg-bc-surface px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] transition-transform duration-300 ${show ? 'translate-y-0' : 'translate-y-full'}`}
    >
      <DownloadLink tabIndex={show ? 0 : -1} className={`${primaryButton} w-full !font-medium font-choice`}>
        {language === 'hebrew' ? 'הורידו בחינם' : 'Download free'}
      </DownloadLink>
    </div>
  );
}
