import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Navigation from '../components/Navigation';
import { motion } from 'framer-motion';

// --- Framer Motion Variants ---
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const fadeUpVariant = {
  hidden: { opacity: 0, y: 40 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.6, ease: "easeOut" } 
  }
};

const KnowledgePage = () => {
  const { language, t, direction } = useLanguage();
  const { isDarkMode, themeClasses } = useTheme();

  // Prevent body scrolling to avoid double scrollbars
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const studies = [
    {
      id: 1,
      title: language === 'hebrew' 
        ? "יתרונות בריאותיים של פעילות גופנית: סקירה שיטתית של סקירות שיטתיות נוכחיות (2016)"
        : "Health Benefits of Physical Activity: A Systematic Review of Current Systematic Reviews (2016)",
      pubmedId: "28708630",
      pubmedLink: "https://pubmed.ncbi.nlm.nih.gov/28708630/",
      keyFindings: language === 'hebrew'
        ? "אפילו כמויות קטנות של פעילות גופנית סדירה (<150 דקות/שבוע) קשורות לירידה בתמותה כללית ובסיכון למחלות כרוניות."
        : "Even small amounts of regular exercise (<150 min/week) are linked with lower all-cause mortality and chronic disease risk.",
      whyInteresting: language === 'hebrew'
        ? "זה מפריך את המיתוס של \"הכל או כלום\" - מראה שתנועה \"כלשהי\" כבר מביאה יתרונות בריאותיים מדידים."
        : "It debunks the \"all or nothing\" myth - showing that *some* movement already brings measurable health benefits.",
      icon: "💪"
    },
    {
      id: 2,
      title: language === 'hebrew'
        ? "פעילות גופנית אירובית וירידה במשקל במבוגרים: סקירה שיטתית ומטא-אנליזה (2024)"
        : "Aerobic Exercise and Weight Loss in Adults: A Systematic Review and Meta-Analysis (2024)",
      journal: language === 'hebrew' ? "JAMA Network Open" : "JAMA Network Open",
      journalLink: "https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2828487",
      keyFindings: language === 'hebrew'
        ? "על פני 116 מחקרים אקראיים מבוקרים (n = 6,880), כל 30 דקות נוספות של פעילות אירובית שבועית הביאו לירידה של ~0.52 ק\"ג במשקל."
        : "Across 116 RCTs (n = 6,880), every additional 30 minutes of aerobic exercise per week resulted in ~0.52 kg of weight loss.",
      whyInteresting: language === 'hebrew'
        ? "מספק נוסחת \"מינון-תגובה\" ברורה - אפשר לכמת תוצאות לפי דקות של פעילות גופנית."
        : "Provides a clear \"dose-response\" formula - you can quantify results per minutes of exercise.",
      icon: "🏃"
    },
    {
      id: 3,
      title: language === 'hebrew'
        ? "יעילות דיאטה ופעילות גופנית בטיפול בהשמנה במבוגרים: סקירה שיטתית (2023)"
        : "Effectiveness of Diet and Exercise in the Management of Obesity in Adults: A Systematic Review (2023)",
      pubmedId: "37084486",
      pubmedLink: "https://pubmed.ncbi.nlm.nih.gov/37084486/",
      keyFindings: language === 'hebrew'
        ? "שילוב תזונה מותאמת אישית עם ≥175 דקות פעילות גופנית שבועית מביא ליתרונות הירידה במשקל והבריאות הגדולים ביותר."
        : "Combining personalized nutrition with ≥175 minutes of exercise per week yields the greatest weight-loss and health benefits.",
      whyInteresting: language === 'hebrew'
        ? "מראה סינרגיה - דיאטה + פעילות גופנית יחד עולות בביצועים על כל אחד בנפרד."
        : "Shows synergy - diet + exercise together outperform either alone.",
      icon: "🥗"
    },
    {
      id: 4,
      title: language === 'hebrew'
        ? "הקשר בין דפוסי תזונה לאיכות חיים הקשורה לבריאות: סקירה שיטתית (2020)"
        : "Association Between Dietary Patterns and Health-Related Quality of Life: A Systematic Review (2020)",
      journal: language === 'hebrew' 
        ? "Health and Quality of Life Outcomes (BMC)"
        : "Health and Quality of Life Outcomes (BMC)",
      journalLink: "https://hqlo.biomedcentral.com/articles/10.1186/s12955-020-01581-z",
      keyFindings: language === 'hebrew'
        ? "דיאטות \"בריאות\" או \"ים-תיכוניות\" נמצאות בקורלציה חזקה עם ציוני רווחה גופנית ונפשית גבוהים יותר."
        : "\"Healthy\" or \"Mediterranean\" diets correlate strongly with higher physical and mental well-being scores.",
      whyInteresting: language === 'hebrew'
        ? "חורג מעבר למניעת מחלות - מחבר תזונה לשביעות רצון מהחיים ורווחה רגשית."
        : "Goes beyond disease prevention - connects diet to *life satisfaction* and emotional well-being.",
      icon: "🧠"
    },
    {
      id: 5,
      title: language === 'hebrew'
        ? "השפעת התערבויות תזונה ופעילות גופנית המועברות על ידי מטפלים למבוגרים (2023)"
        : "Impact of Nutrition and Physical Activity Interventions Delivered by Practitioners for Adults (2023)",
      pubmedId: "35565696",
      pubmedLink: "https://pubmed.ncbi.nlm.nih.gov/35565696/",
      keyFindings: language === 'hebrew'
        ? "התערבויות אורח חיים על ידי תזונאים או מאמני כושר מעלות משמעותיות צריכת פירות/ירקות ופעילות גופנית, ומקטינות היקף מותניים."
        : "Lifestyle interventions by nutritionists or exercise coaches significantly increase fruit/vegetable intake, physical activity, and reduce waist circumference.",
      whyInteresting: language === 'hebrew'
        ? "מדגים את ההשפעה הניתנת למדידה בעולם האמיתי של הדרכה מקצועית - לא רק \"עזרה עצמית\"."
        : "Demonstrates the measurable real-world effect of professional guidance - not just \"self-help.\"",
      icon: "👨‍⚕️"
    }
  ];

  return (
    <div className={`min-h-screen transition-colors duration-500 font-sans flex flex-col ${themeClasses.bgPrimary}`} dir={direction} style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto custom-scrollbar ${isDarkMode ? 'bg-[#0f172a]' : 'bg-slate-50'}`} style={{ minHeight: 0 }}>
        
        {/* Editorial Hero Section */}
        <section className="relative pt-16 pb-12 sm:pt-24 sm:pb-20 overflow-hidden">
          {/* Subtle Glow background */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-full opacity-30 pointer-events-none">
            <div className={`absolute -top-10 left-20 w-80 h-80 rounded-full filter blur-[100px] ${isDarkMode ? 'bg-emerald-900/50' : 'bg-emerald-200/50'}`}></div>
          </div>

          <motion.div 
            className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10"
            initial="hidden" animate="visible" variants={staggerContainer}
          >
            {/* Animated Icon */}
            <motion.div variants={fadeUpVariant} className="mb-8 flex justify-center">
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-[2rem] flex items-center justify-center shadow-2xl rotate-3 transform transition-transform hover:rotate-0 duration-500 ${isDarkMode ? 'bg-slate-800 border border-slate-700 shadow-emerald-900/20' : 'bg-white border border-slate-100 shadow-emerald-500/10'}`}>
                <svg className={`w-10 h-10 sm:w-12 sm:h-12 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </motion.div>

            {/* Main Heading */}
            <motion.h1 variants={fadeUpVariant} className={`text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {t.knowledgePage?.title || (language === 'hebrew' ? 'ידע והשראה' : 'Knowledge & Inspiration')}
            </motion.h1>

            {/* Subtitle */}
            <motion.p variants={fadeUpVariant} className={`text-lg sm:text-xl md:text-2xl font-medium leading-relaxed max-w-3xl mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {t.knowledgePage?.subtitle || (language === 'hebrew' 
                ? 'מחקרים מדעיים מובילים בתחום התזונה, הבריאות והפעילות הגופנית'
                : 'Leading Scientific Research in Nutrition, Health, and Physical Activity'
              )}
            </motion.p>
          </motion.div>
        </section>

        {/* Studies Grid Section */}
        <section className="py-12 sm:py-16">
          <motion.div 
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainer}
          >
            {/* Section Header */}
            <motion.div variants={fadeUpVariant} className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6 border-slate-200 dark:border-slate-800">
              <div>
                <h2 className={`text-2xl sm:text-3xl font-extrabold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  {t.knowledgePage?.sectionTitle || (language === 'hebrew' ? 'מחקרים מדעיים מובילים' : 'Evidence-Based Scientific Studies')}
                </h2>
              </div>
              <p className={`text-sm sm:text-base font-medium max-w-md ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                {t.knowledgePage?.sectionDescription || (language === 'hebrew'
                  ? 'חמישה מחקרים מדעיים מוכחים ומעניינים שמראים את הקשר בין תזונה, פעילות גופנית ובריאות'
                  : 'Five well-known, evidence-based, and genuinely interesting scientific papers on nutrition, health, and exercise'
                )}
              </p>
            </motion.div>

            {/* Studies Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {studies.map((study) => (
                <motion.div 
                  key={study.id}
                  variants={fadeUpVariant}
                  whileHover={{ y: -8 }}
                  className={`flex flex-col h-full rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border ${isDarkMode ? 'bg-slate-800/80 border-slate-700/80 shadow-slate-900/50' : 'bg-white border-slate-100 shadow-slate-200/50 backdrop-blur-sm'}`}
                >
                  {/* Card Header: Icon & Badge */}
                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                      {study.icon}
                    </div>
                    {/* Publication Badge */}
                    {study.pubmedId ? (
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd"/>
                        </svg>
                        <span>PubMed: {study.pubmedId}</span>
                      </div>
                    ) : (
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
                        </svg>
                        <span className="truncate max-w-[100px]">{study.journal}</span>
                      </div>
                    )}
                  </div>

                  {/* Study Title */}
                  <h3 className={`text-xl font-bold mb-6 leading-snug flex-shrink-0 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    {study.title}
                  </h3>

                  {/* Content Sections */}
                  <div className="flex-grow flex flex-col gap-5 mb-8">
                    {/* Key Findings */}
                    <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-slate-700/30' : 'bg-slate-50'}`}>
                      <h4 className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        {t.knowledgePage?.keyFindings || (language === 'hebrew' ? 'ממצאים עיקריים' : 'Key Findings')}
                      </h4>
                      <p className={`text-sm leading-relaxed font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        {study.keyFindings}
                      </p>
                    </div>

                    {/* Why Interesting */}
                    <div className="px-1 border-l-2 border-amber-400 pl-4" dir={language === 'hebrew' ? 'rtl' : 'ltr'} style={{ borderLeftWidth: language === 'hebrew' ? '0' : '2px', borderRightWidth: language === 'hebrew' ? '2px' : '0', borderRightColor: language === 'hebrew' ? '#fbbf24' : 'transparent' }}>
                      <h4 className={`text-xs font-black uppercase tracking-widest mb-1.5 ${isDarkMode ? 'text-amber-400' : 'text-amber-500'}`}>
                        {t.knowledgePage?.whyInteresting || (language === 'hebrew' ? 'למה זה מעניין' : 'Why it\'s interesting')}
                      </h4>
                      <p className={`text-sm leading-relaxed italic ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {study.whyInteresting}
                      </p>
                    </div>
                  </div>

                  {/* Footer/Button */}
                  <div className="mt-auto pt-5 border-t border-slate-200 dark:border-slate-700/60">
                    <a
                      href={study.pubmedLink || study.journalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-center gap-2 w-full py-3.5 bg-slate-100 hover:bg-emerald-500 dark:bg-slate-700 dark:hover:bg-emerald-500 text-slate-700 hover:text-white dark:text-slate-200 dark:hover:text-white text-sm font-bold rounded-xl transition-all duration-300"
                    >
                      <span>{t.knowledgePage?.readFullStudy || (language === 'hebrew' ? 'קרא במלואו' : 'Read Full Study')}</span>
                      <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Additional Info / Future Studies */}
            <motion.div variants={fadeUpVariant} className="mt-20 text-center">
              <div className={`rounded-3xl p-10 max-w-3xl mx-auto border ${isDarkMode ? 'bg-slate-800/50 border-slate-700 shadow-inner' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
                <div className="text-4xl mb-4 opacity-50">🔬</div>
                <h3 className={`text-2xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {t.knowledgePage?.moreStudiesTitle || (language === 'hebrew' ? 'מחקרים נוספים בקרוב' : 'More Studies Coming Soon')}
                </h3>
                <p className={`text-base font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t.knowledgePage?.moreStudiesDescription || (language === 'hebrew'
                    ? 'אנו עוקבים באופן רציף אחרי הספרות המדעית המובילה בעולם ומוסיפים מחקרים חדשים המאמתים את שיטות הטיפול שלנו.'
                    : 'We continuously monitor the world\'s leading scientific literature and add new studies validating our treatment methods.'
                  )}
                </p>
              </div>
            </motion.div>

            {/* Back to Home Action */}
            <motion.div variants={fadeUpVariant} className="mt-16 pb-16 text-center">
              <Link
                to="/"
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-sm uppercase tracking-wide rounded-full transition-all duration-300 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: language === 'hebrew' ? 'rotate(180deg)' : 'none' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                {t.knowledgePage?.backToHome || (language === 'hebrew' ? 'חזרה לעמוד הבית' : 'Back to Home')}
              </Link>
            </motion.div>

          </motion.div>
        </section>

      </main>
    </div>
  );
};

export default KnowledgePage;