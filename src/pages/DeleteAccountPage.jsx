import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const fadeUpVariant = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
};

const content = {
  english: {
    title: 'Account Deletion Request',
    intro:
      'You can request deletion of your BetterChoice AI account and associated personal data without installing or opening the mobile app.',
    emailTitle: 'Option 1 — Request by email',
    emailSteps: [
      'Send an email from the address linked to your BetterChoice account.',
      'Use the subject line: Account Deletion Request.',
      'Include your full name and any phone number associated with the account (if applicable).'
    ],
    emailLabel: 'Email us at',
    appTitle: 'Option 2 — Delete inside the app / website',
    appSteps: [
      <>
        Log in at the{' '}
        <Link to="/login" className="font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors">
          login page
        </Link>{' '}
        or open the BetterChoice app.
      </>,
      <>
        Go to your{' '}
        <Link to="/profile" className="font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors">
          Profile
        </Link>
        .
      </>,
      'Choose Delete Account and confirm.'
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
    timeline:
      'After we verify your request, we delete your account and associated personal data within 30 days. You will receive a confirmation email when the process is complete.'
  },
  hebrew: {
    title: 'בקשת מחיקת חשבון',
    intro:
      'ניתן לבקש מחיקת חשבון BetterChoice AI והנתונים האישיים המשויכים גם בלי להתקין או לפתוח את האפליקציה.',
    emailTitle: 'אפשרות 1 — בקשה באימייל',
    emailSteps: [
      'שלחו אימייל מכתובת המייל המקושרת לחשבון BetterChoice.',
      'בנושא כתבו: בקשת מחיקת חשבון.',
      'כללו את שמכם המלא ומספר טלפון המשויך לחשבון (אם קיים).'
    ],
    emailLabel: 'שלחו אימייל אל',
    appTitle: 'אפשרות 2 — מחיקה באתר / באפליקציה',
    appSteps: [
      <>
        התחברו ב
        <Link to="/login" className="font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors">
          דף ההתחברות
        </Link>{' '}
        או פתחו את אפליקציית BetterChoice.
      </>,
      <>
        עברו ל
        <Link to="/profile" className="font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors">
          פרופיל
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
    timeline:
      'לאחר אימות הבקשה נמחק את החשבון והנתונים האישיים המשויכים תוך 30 יום. תקבלו אימייל אישור בסיום התהליך.'
  }
};

function DeleteAccountPage() {
  const { language, direction, t, toggleLanguage } = useLanguage();
  const { isDarkMode, toggleTheme } = useTheme();

  const pageContent = language === 'hebrew' ? content.hebrew : content.english;

  const glassCardClasses = isDarkMode
    ? 'bg-slate-900/60 border-slate-700/50 backdrop-blur-xl shadow-2xl shadow-emerald-900/20'
    : 'bg-white/70 border-white/60 backdrop-blur-xl shadow-2xl shadow-emerald-500/10';

  const sectionTitleClass = `text-lg font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`;
  const bodyClass = `text-base font-medium leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`;
  const listClass = `space-y-3 ${direction === 'rtl' ? 'pr-5' : 'pl-5'} list-decimal marker:font-bold marker:text-emerald-600 dark:marker:text-emerald-400`;

  return (
    <div className={`relative min-h-screen flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-[#f4f9f5]'} language-transition language-text-transition overflow-hidden`} dir={direction}>
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-green-500/10 rounded-full blur-[120px]" />
      </div>

      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`relative z-10 ${isDarkMode ? 'bg-slate-900/50' : 'bg-white/50'} shadow-sm border-b ${isDarkMode ? 'border-slate-800/50' : 'border-emerald-100/50'} backdrop-blur-md`}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4 sm:py-5">
            <Link to="/" className="flex items-center group cursor-pointer">
              <img src="/favicon.ico" alt="BetterChoice Logo" className="w-10 h-10 sm:w-12 sm:h-12 mr-3 rounded-xl shadow-md group-hover:shadow-emerald-500/20 transition-all duration-300" />
              <div className="flex flex-col">
                <h1 className={`text-xl sm:text-2xl font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'} leading-tight tracking-tight`}>BetterChoice</h1>
              </div>
            </Link>
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleTheme}
                className={`w-10 h-10 flex items-center justify-center rounded-full font-medium transition-colors shadow-sm backdrop-blur-md border ${isDarkMode ? 'bg-slate-800/80 text-yellow-400 hover:bg-slate-700 border-slate-700' : 'bg-white/80 text-gray-600 hover:bg-white border-emerald-100'}`}
              >
                {isDarkMode ? '☀️' : '🌙'}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleLanguage}
                className={`w-10 h-10 flex items-center justify-center rounded-full font-bold transition-colors shadow-sm ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}
              >
                {language === 'hebrew' ? 'EN' : 'עב'}
              </motion.button>
            </div>
          </div>
        </nav>
      </motion.header>

      <main className="relative z-10 flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="max-w-xl w-full"
        >
          <motion.div variants={fadeUpVariant} className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/50 dark:to-orange-900/50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <span className="text-3xl" aria-hidden="true">🗑️</span>
            </div>
            <h2 className={`text-3xl sm:text-4xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-3 tracking-tight`}>
              {pageContent.title}
            </h2>
            <p className={`text-base font-medium leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              {pageContent.intro}
            </p>
          </motion.div>

          <motion.div
            variants={fadeUpVariant}
            className={`${glassCardClasses} rounded-[2rem] border p-6 sm:p-8 md:p-10 space-y-8`}
          >
            <section>
              <h3 className={sectionTitleClass}>{pageContent.emailTitle}</h3>
              <ol className={listClass}>
                {pageContent.emailSteps.map((step, index) => (
                  <li key={index} className={bodyClass}>{step}</li>
                ))}
              </ol>
              <p className={`mt-4 text-base font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {pageContent.emailLabel}{' '}
                <a
                  href="mailto:info@betterchoice.live?subject=Account%20Deletion%20Request"
                  className="font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                >
                  info@betterchoice.live
                </a>
              </p>
            </section>

            <section className={`pt-6 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <h3 className={sectionTitleClass}>{pageContent.appTitle}</h3>
              <ol className={listClass}>
                {pageContent.appSteps.map((step, index) => (
                  <li key={index} className={bodyClass}>{step}</li>
                ))}
              </ol>
            </section>

            <section className={`pt-6 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <h3 className={sectionTitleClass}>{pageContent.deletedTitle}</h3>
              <ul className={`space-y-2 ${direction === 'rtl' ? 'pr-5' : 'pl-5'} list-disc marker:text-emerald-600`}>
                {pageContent.deletedItems.map((item, index) => (
                  <li key={index} className={bodyClass}>{item}</li>
                ))}
              </ul>
            </section>

            <section className={`pt-6 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <h3 className={sectionTitleClass}>{pageContent.retainedTitle}</h3>
              <ul className={`space-y-2 ${direction === 'rtl' ? 'pr-5' : 'pl-5'} list-disc marker:text-emerald-600`}>
                {pageContent.retainedItems.map((item, index) => (
                  <li key={index} className={bodyClass}>{item}</li>
                ))}
              </ul>
            </section>

            <div className={`pt-6 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <p className={`text-base font-medium leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {pageContent.timeline}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <a href="mailto:info@betterchoice.live?subject=Account%20Deletion%20Request" className="flex-1">
                <motion.span
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  className="block w-full text-center bg-gradient-to-r from-emerald-500 to-green-600 text-white py-3.5 px-4 rounded-xl font-bold shadow-lg shadow-emerald-500/25 transition-all"
                >
                  {language === 'hebrew' ? 'שליחת בקשה באימייל' : 'Email Deletion Request'}
                </motion.span>
              </a>
              <Link to="/login" className="flex-1">
                <motion.span
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  className={`block w-full text-center py-3.5 px-4 rounded-xl font-bold border transition-all ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {language === 'hebrew' ? 'התחברות' : 'Log In'}
                </motion.span>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </main>

      <footer className={`relative z-10 py-6 border-t ${isDarkMode ? 'border-slate-800/50 bg-slate-900/30' : 'border-emerald-100/50 bg-white/30'} backdrop-blur-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex gap-6 text-sm font-medium">
              <Link to="/privacy-policy" className={`${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'} transition-colors`}>{t.footer.privacy}</Link>
              <Link to="/terms" className={`${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'} transition-colors`}>{t.footer.terms}</Link>
            </div>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
              {t.footer.copyright}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default DeleteAccountPage;
