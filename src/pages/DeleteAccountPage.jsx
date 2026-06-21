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
    intro: 'To delete your BetterChoice AI account and all associated data, please follow these steps:',
    steps: [
      <>Go to your <Link to="/profile" className="font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors">Profile Page</Link> and <Link to="/login" className="font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors">log in</Link>.</>,
      'Navigate to the profile tab.',
      'Click on the Delete Account button.'
    ],
    assistance: (
      <>
        If you can&apos;t log in or need assistance, you can also request account deletion by emailing us at{' '}
        <a
          href="mailto:info@betterchoice.live"
          className="font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
        >
          info@betterchoice.live
        </a>
        .
      </>
    )
  },
  hebrew: {
    title: 'בקשת מחיקת חשבון',
    intro: 'כדי למחוק את חשבון BetterChoice AI שלך ואת כל הנתונים המשויכים, אנא בצע את השלבים הבאים:',
    steps: [
      <>עבור ל<Link to="/profile" className="font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors">דף הפרופיל</Link> שלך ו<Link to="/login" className="font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors">התחבר</Link>.</>,
      'נווט ללשונית הפרופיל.',
      'לחץ על כפתור מחיקת החשבון.'
    ],
    assistance: (
      <>
        אם אינך יכול להתחבר או שאתה זקוק לעזרה, תוכל גם לבקש מחיקת חשבון על ידי שליחת אימייל אל{' '}
        <a
          href="mailto:info@betterchoice.live"
          className="font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
        >
          info@betterchoice.live
        </a>
        .
      </>
    )
  }
};

function DeleteAccountPage() {
  const { language, direction, t, toggleLanguage } = useLanguage();
  const { isDarkMode, toggleTheme } = useTheme();

  const pageContent = language === 'hebrew' ? content.hebrew : content.english;

  const glassCardClasses = isDarkMode
    ? 'bg-slate-900/60 border-slate-700/50 backdrop-blur-xl shadow-2xl shadow-emerald-900/20'
    : 'bg-white/70 border-white/60 backdrop-blur-xl shadow-2xl shadow-emerald-500/10';

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
          className="max-w-md w-full"
        >
          <motion.div variants={fadeUpVariant} className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/50 dark:to-orange-900/50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <span className="text-3xl" aria-hidden="true">🗑️</span>
            </div>
            <h2 className={`text-3xl sm:text-4xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-3 tracking-tight`}>
              {pageContent.title}
            </h2>
          </motion.div>

          <motion.div
            variants={fadeUpVariant}
            className={`${glassCardClasses} rounded-[2rem] border p-6 sm:p-8 md:p-10`}
          >
            <p className={`text-base font-medium leading-relaxed mb-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              {pageContent.intro}
            </p>

            <ol className={`space-y-4 mb-8 ${direction === 'rtl' ? 'pr-5' : 'pl-5'} list-decimal marker:font-bold marker:text-emerald-600 dark:marker:text-emerald-400`}>
              {pageContent.steps.map((step, index) => (
                <li
                  key={index}
                  className={`text-base font-medium leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}
                >
                  {step}
                </li>
              ))}
            </ol>

            <div className={`pt-6 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <p className={`text-base font-medium leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {pageContent.assistance}
              </p>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/login" className="flex-1">
                <motion.span
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  className="block w-full text-center bg-gradient-to-r from-emerald-500 to-green-600 text-white py-3.5 px-4 rounded-xl font-bold shadow-lg shadow-emerald-500/25 transition-all"
                >
                  {language === 'hebrew' ? 'התחברות' : 'Log In'}
                </motion.span>
              </Link>
              <Link to="/profile" className="flex-1">
                <motion.span
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  className={`block w-full text-center py-3.5 px-4 rounded-xl font-bold border transition-all ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {language === 'hebrew' ? 'דף פרופיל' : 'Profile Page'}
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
