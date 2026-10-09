import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import MarketingShell from '../components/brand/MarketingShell';
import { primaryButton, secondaryButton, focusClass, titleFont } from '../components/brand/ui';

const linkClass = `font-semibold text-bc-text underline underline-offset-4 decoration-bc-border hover:decoration-bc-accent rounded ${focusClass}`;

const content = {
  english: {
    title: 'Account deletion request',
    intro:
      'You can request deletion of your BetterChoice AI account and associated personal data without installing or opening the mobile app.',
    emailTitle: 'Option 1 — Request by email',
    emailSteps: [
      'Send an email from the address linked to your BetterChoice account.',
      'Use the subject line: Account Deletion Request.',
      'Include your full name and any phone number associated with the account (if applicable).'
    ],
    emailLabel: 'Email us at',
    appTitle: 'Option 2 — Delete inside the app or website',
    appSteps: [
      <>
        Log in at the{' '}
        <Link to="/login" className={linkClass}>
          login page
        </Link>{' '}
        or open the BetterChoice app.
      </>,
      <>
        Go to your{' '}
        <Link to="/account" className={linkClass}>
          account settings
        </Link>
        .
      </>,
      'Choose Delete account and confirm.'
    ],
    deletedTitle: 'What data is deleted',
    deletedItems: [
      'Account profile details (name, email, phone, preferences)',
      'Health and nutrition inputs you provided (goals, logs, plans tied to your account)',
      'App usage data stored in your account'
    ],
    retainedTitle: 'What may be retained',
    retainedItems: [
      'Records we must keep for legal, tax, fraud-prevention, or accounting reasons (for example certain payment records)',
      'Anonymized or aggregated data that no longer identifies you'
    ],
    timelineTitle: 'Timeline',
    timeline:
      'After we verify your request, we delete your account and associated personal data within 30 days. You will receive a confirmation email when the process is complete.',
    emailCta: 'Email a deletion request',
    loginCta: 'Log in'
  },
  hebrew: {
    title: 'בקשת מחיקת חשבון',
    intro:
      'אפשר לבקש מחיקה של חשבון BetterChoice AI והנתונים האישיים המשויכים אליו גם בלי להתקין או לפתוח את האפליקציה.',
    emailTitle: 'אפשרות 1 — בקשה באימייל',
    emailSteps: [
      'שלחו אימייל מכתובת המייל המקושרת לחשבון BetterChoice.',
      'בנושא כתבו: בקשת מחיקת חשבון.',
      'כללו את שמכם המלא ומספר טלפון המשויך לחשבון (אם קיים).'
    ],
    emailLabel: 'שלחו אימייל אל',
    appTitle: 'אפשרות 2 — מחיקה באתר או באפליקציה',
    appSteps: [
      <>
        התחברו ב
        <Link to="/login" className={linkClass}>
          דף ההתחברות
        </Link>{' '}
        או פתחו את אפליקציית BetterChoice.
      </>,
      <>
        עברו ל
        <Link to="/account" className={linkClass}>
          הגדרות החשבון
        </Link>
        .
      </>,
      'בחרו מחיקת חשבון ואשרו.'
    ],
    deletedTitle: 'אילו נתונים נמחקים',
    deletedItems: [
      'פרטי פרופיל (שם, אימייל, טלפון, העדפות)',
      'נתוני בריאות ותזונה שסיפקתם (יעדים, יומנים, תוכניות המשויכות לחשבון)',
      'נתוני שימוש באפליקציה השמורים בחשבון'
    ],
    retainedTitle: 'מה עשוי להישמר',
    retainedItems: [
      'רשומות שאנו מחויבים לשמור מסיבות חוקיות, מס, מניעת הונאה או הנהלת חשבונות (למשל רשומות תשלום מסוימות)',
      'נתונים אנונימיים או מצטברים שאינם מזהים אתכם עוד'
    ],
    timelineTitle: 'לוח זמנים',
    timeline:
      'לאחר אימות הבקשה נמחק את החשבון והנתונים האישיים המשויכים תוך 30 יום. תקבלו אימייל אישור בסיום התהליך.',
    emailCta: 'שליחת בקשה באימייל',
    loginCta: 'התחברות'
  }
};

const MAILTO = 'mailto:info@betterchoice.live?subject=Account%20Deletion%20Request';

const sectionCard = 'rounded-bc-card border border-bc-border bg-bc-surface p-6 sm:p-8';
const sectionTitle = 'text-[17px] font-bold text-bc-text mb-3';
const bodyClass = 'text-[15px] font-semibold text-bc-muted leading-relaxed';
const orderedList = 'space-y-3 ps-5 list-decimal marker:font-bold marker:text-bc-accent';
const bulletList = 'space-y-2 ps-5 list-disc marker:text-bc-accent';

function DeleteAccountPage() {
  const { language } = useLanguage();
  const isHebrew = language === 'hebrew';

  const pageContent = isHebrew ? content.hebrew : content.english;

  return (
    <MarketingShell>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-16"
      >
        <h1 className={`text-[32px] leading-tight text-bc-text ${isHebrew ? 'font-bold' : `${titleFont(language)} font-medium`}`}>
          {pageContent.title}
        </h1>
        <p className={`mt-3 ${bodyClass}`}>{pageContent.intro}</p>

        <div className="mt-8 flex flex-col gap-6">
          <section className={sectionCard}>
            <h2 className={sectionTitle}>{pageContent.emailTitle}</h2>
            <ol className={orderedList}>
              {pageContent.emailSteps.map((step, index) => (
                <li key={index} className={bodyClass}>{step}</li>
              ))}
            </ol>
            <p className={`mt-4 ${bodyClass}`}>
              {pageContent.emailLabel}{' '}
              <a href={MAILTO} className={linkClass} dir="ltr">
                info@betterchoice.live
              </a>
            </p>
          </section>

          <section className={sectionCard}>
            <h2 className={sectionTitle}>{pageContent.appTitle}</h2>
            <ol className={orderedList}>
              {pageContent.appSteps.map((step, index) => (
                <li key={index} className={bodyClass}>{step}</li>
              ))}
            </ol>
          </section>

          <section className={sectionCard}>
            <h2 className={sectionTitle}>{pageContent.deletedTitle}</h2>
            <ul className={bulletList}>
              {pageContent.deletedItems.map((item, index) => (
                <li key={index} className={bodyClass}>{item}</li>
              ))}
            </ul>
          </section>

          <section className={sectionCard}>
            <h2 className={sectionTitle}>{pageContent.retainedTitle}</h2>
            <ul className={bulletList}>
              {pageContent.retainedItems.map((item, index) => (
                <li key={index} className={bodyClass}>{item}</li>
              ))}
            </ul>
          </section>

          <section className={sectionCard}>
            <h2 className={sectionTitle}>{pageContent.timelineTitle}</h2>
            <p className={bodyClass}>{pageContent.timeline}</p>
          </section>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <a href={MAILTO} className={`${primaryButton} flex-1`}>
            {pageContent.emailCta}
          </a>
          <Link to="/login" className={`${secondaryButton} flex-1 min-h-[48px]`}>
            {pageContent.loginCta}
          </Link>
        </div>
      </motion.div>
    </MarketingShell>
  );
}

export default DeleteAccountPage;
