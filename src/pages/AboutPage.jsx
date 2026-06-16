import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Navigation from '../components/Navigation';

// --- Framer Motion Variants ---
const fadeUpVariant = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
};

const staggerContainerVariant = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 }
  }
};

const scaleUpVariant = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};

const AboutPage = () => {
  const { language, direction, toggleLanguage } = useLanguage();
  const { isDarkMode, toggleTheme, themeClasses } = useTheme();

  // Prevent body scrolling to avoid double scrollbars
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const isHebrew = language === 'hebrew';

  // Base glass classes for dynamic theming
  const glassCard = isDarkMode 
    ? 'bg-slate-800/40 border-slate-700/50 backdrop-blur-xl shadow-2xl' 
    : 'bg-white/60 border-white/50 backdrop-blur-xl shadow-xl';

  const timelineSteps = [
    {
      number: '1',
      icon: (
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
        </svg>
      ),
      title: isHebrew ? 'הערכה אישית' : 'Personal Assessment',
      description: isHebrew 
        ? 'ייעוץ מקיף עם דיאטן מורשה להבנת הצרכים, המטרות והמגבלות שלך'
        : 'Comprehensive consultation with a licensed dietitian to understand your needs, goals and limitations'
    },
    {
      number: '2',
      icon: (
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
        </svg>
      ),
      title: isHebrew ? 'תכנון מותאם' : 'Customized Planning',
      description: isHebrew
        ? 'יצירת תוכנית תזונה אישית בהתבסס על הנתונים שלך עם תמיכת בינה מלאכותית חכמה'
        : 'Creating a personal nutrition plan based on your data with smart AI support'
    },
    {
      number: '3',
      icon: (
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/>
        </svg>
      ),
      title: isHebrew ? 'יישום והדרכה' : 'Implementation & Guidance',
      description: isHebrew
        ? 'התחלת יישום עם ניטור צמוד, הדרכה ותמיכה יומית'
        : 'Starting implementation with close monitoring, guidance and daily support'
    },
    {
      number: '4',
      icon: (
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
        </svg>
      ),
      title: isHebrew ? 'ניטור והתאמה' : 'Monitoring & Adjustment',
      description: isHebrew
        ? 'ניטור מתמשך של התקדמות והתאמת התוכנית בהתאם לצרכים משתנים'
        : 'Ongoing monitoring of progress and adjusting the plan according to changing needs'
    }
  ];

  return (
    <div className={`min-h-screen ${themeClasses.bgPrimary} language-transition language-text-transition flex flex-col`} dir={direction} style={{ height: '100vh', overflow: 'hidden' }}>
      <Navigation />

      <main className={`flex-1 overflow-y-auto custom-scrollbar ${isDarkMode ? 'bg-slate-950' : 'bg-[#f4f9f5]'}`} style={{ minHeight: 0 }}>
        
        {/* Ambient Background Glow */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-500/10 rounded-full blur-[120px]" />
        </div>

        {/* Hero Section */}
        <motion.div 
          initial="hidden" 
          whileInView="visible" 
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainerVariant}
          className="relative z-10 py-16 sm:py-24 md:py-32"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            
            <motion.div variants={scaleUpVariant} className="mb-8">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(16,185,129,0.3)] backdrop-blur-md border border-white/20">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                </svg>
              </div>
            </motion.div>

            <motion.h1 variants={fadeUpVariant} className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-6 px-2`}>
              {isHebrew ? 'דיוק בינה מלאכותית,' : 'AI Precision,'}
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-green-400 mt-2">
                {isHebrew ? 'הדרכה קלינית מומחית' : 'Expert Clinical Guidance'}
              </span>
            </motion.h1>

            <motion.div variants={fadeUpVariant} className={`max-w-3xl mx-auto space-y-4 text-lg sm:text-xl ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} px-2 leading-relaxed`}>
              <p>
                {isHebrew 
                  ? 'BetterChoice נוסדה ב-2025 מתוך צורך אמיתי: לספק לאנשים גישה לתזונה מדויקת, מקצועית ומותאמת אישית'
                  : 'BetterChoice was founded in 2025 from a real need: to provide people access to accurate, professional, and personalized nutrition'
                }
              </p>
              <p className="font-medium">
                {isHebrew
                  ? 'מדויק, מקצועי ומותאם אישית - בדיוק מה שכל אדם צריך לאורח חיים בריא'
                  : 'Precise, professional, and personally tailored - exactly what every person needs for a healthy lifestyle'
                }
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* About BetterChoice AI Section */}
        <div className="relative z-10 py-20 bg-emerald-900/5 dark:bg-emerald-500/5 border-y border-emerald-500/10 backdrop-blur-3xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              
              <motion.div 
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainerVariant}
              >
                <motion.h3 variants={fadeUpVariant} className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-6`}>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-green-400">
                    {isHebrew ? 'אודות BetterChoice AI' : 'About BetterChoice AI'}
                  </span>
                </motion.h3>
                <motion.p variants={fadeUpVariant} className={`text-lg ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} mb-6 leading-relaxed`}>
                  {isHebrew
                    ? 'BetterChoice AI הוא פתרון תזונה מהפכני המשלב בינה מלאכותית מתקדמת עם מומחיות של דיאטנים קליניים מורשים. אנו מספקים הנחיה תזונתית מותאמת אישית, מבוססת נתונים ומדע, המסייעת לך לשפר את רמות האנרגיה, הריכוז והבריאות הכללית.'
                    : 'BetterChoice AI is a revolutionary nutrition solution that combines advanced artificial intelligence with the expertise of licensed clinical dietitians. We provide hyper-personalized, data-driven, and science-backed nutrition guidance that helps you improve energy levels, focus, and overall health.'}
                </motion.p>
                <motion.p variants={fadeUpVariant} className={`text-lg ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} mb-10 leading-relaxed`}>
                  {isHebrew
                    ? 'הטכנולוגיה שלנו משתמשת ב-Spatial AI, Digital Health Twin ומדע תזונה משולב כדי ליצור תוכניות מציאותיות המתאימות לאורח החיים שלך, תוך הבטחת בטיחות ופיקוח קליני מתמיד.'
                    : 'Our technology uses Spatial AI, Digital Health Twin, and integrated nutrition science to create realistic plans that fit your actual lifestyle, while ensuring safety and continuous clinical supervision.'}
                </motion.p>
                
                <motion.div variants={staggerContainerVariant} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    isHebrew ? 'בינה מלאכותית מתקדמת' : 'Advanced AI Technology',
                    isHebrew ? 'דיאטנים קליניים מורשים' : 'Licensed Clinical Dietitians',
                    isHebrew ? 'תמיכה 24/7' : '24/7 Support',
                    isHebrew ? 'פיקוח קליני' : 'Clinical Supervision'
                  ].map((feat, idx) => (
                    <motion.div key={idx} variants={fadeUpVariant} className="flex items-center space-x-3 space-x-reverse">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                      <span className={`font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{feat}</span>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>

              <motion.div 
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={scaleUpVariant}
                className={`${glassCard} rounded-3xl p-10 lg:p-12 border ${isDarkMode ? 'border-emerald-500/20' : 'border-white/60'}`}
              >
                <div className="text-center">
                  <div className="text-6xl mb-8 drop-shadow-lg">🏆</div>
                  <h4 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-8`}>
                    {isHebrew ? 'הישגים' : 'Achievements'}
                  </h4>
                  <div className="space-y-4">
                    {[
                      { num: '15,000+', label: isHebrew ? 'משתמשים מרוצים' : 'Satisfied Users' },
                      { num: '98%', label: isHebrew ? 'שיעור הצלחה' : 'Success Rate' },
                      { num: '50+', label: isHebrew ? 'דיאטנים קליניים' : 'Clinical Dietitians' }
                    ].map((stat, idx) => (
                      <motion.div 
                        key={idx}
                        whileHover={{ scale: 1.02 }}
                        className={`rounded-2xl p-5 border ${isDarkMode ? 'bg-slate-900/50 border-slate-700/50' : 'bg-white/80 border-white'} shadow-sm transition-colors`}
                      >
                        <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-green-400 mb-1">{stat.num}</div>
                        <div className={`font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{stat.label}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Mission & Vision Section */}
        <div className="relative z-10 py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainerVariant}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12"
            >
              {/* Mission Card */}
              <motion.div variants={fadeUpVariant} whileHover={{ y: -5 }} className={`${glassCard} rounded-[2rem] p-10 lg:p-12 border`}>
                <div className="mb-10 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {isHebrew ? 'המשימה שלנו' : 'Our Mission'}
                  </h2>
                </div>
                
                <div className="space-y-5">
                  {[
                    isHebrew ? 'טכנולוגיית בינה מלאכותית מתקדמת לתזונה מותאמת אישית' : 'Advanced AI technology for personalized nutrition',
                    isHebrew ? 'דיאטנים קליניים מורשים עם מומחיות מוכחת' : 'Licensed clinical dietitians with proven expertise',
                    isHebrew ? 'גישות מבוססות ראיות ומחקר מדעי' : 'Evidence-based approaches and scientific research',
                    isHebrew ? 'תמיכה מקיפה לאורך המסע שלך' : 'Comprehensive support throughout your journey',
                    isHebrew ? 'גישה מותאמת אישית לכל אדם' : 'Personalized approach for every individual',
                    isHebrew ? 'מדע תזונה מבוסס ראיות' : 'Evidence-based nutrition science',
                    isHebrew ? 'מומחיות קלינית מקצועית' : 'Professional clinical expertise',
                    isHebrew ? 'תמיכה והדרכה מתמשכים' : 'Continuous support and guidance'
                  ].map((item, index) => (
                    <div key={index} className="flex items-start space-x-4 space-x-reverse">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2.5 flex-shrink-0"></div>
                      <p className={`text-lg ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{item}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Vision Card */}
              <motion.div variants={fadeUpVariant} whileHover={{ y: -5 }} className={`${glassCard} rounded-[2rem] p-10 lg:p-12 border`}>
                <div className="mb-10 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {isHebrew ? 'החזון שלנו' : 'Our Vision'}
                  </h2>
                </div>
                
                <div className="space-y-8">
                  <p className={`text-xl ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} leading-relaxed font-medium text-center`}>
                    "{isHebrew
                      ? 'להפוך תזונה בריאה לנגישה ומותאמת אישית לכולם, תוך שילוב הטכנולוגיה המתקדמת ביותר עם מומחיות קלינית מוכחת.'
                      : 'To make healthy nutrition accessible and personalized for everyone, combining the most advanced technology with proven clinical expertise.'
                    }"
                  </p>
                  
                  <div className="space-y-5 pt-4 border-t border-slate-500/20">
                    {[
                      isHebrew ? 'אינטגרציה של טכנולוגיית בינה מלאכותית מתקדמת' : 'Advanced AI technology integration',
                      isHebrew ? 'מתודולוגיות קליניות מוכחות' : 'Proven clinical methodologies',
                      isHebrew ? 'תוכניות תזונה מותאמות אישית' : 'Personalized nutrition plans',
                      isHebrew ? 'ניטור בריאות מקיף' : 'Comprehensive health monitoring'
                    ].map((item, index) => (
                      <div key={index} className="flex items-center space-x-4 space-x-reverse">
                        <div className="w-8 h-8 bg-emerald-500/10 rounded-full flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
                          <span className="text-emerald-500 text-xs font-bold">A</span>
                        </div>
                        <p className={`text-lg ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* The Timeline / Journey Section */}
        <div className="relative z-10 py-24 bg-gradient-to-b from-transparent via-emerald-900/5 to-transparent dark:via-emerald-500/5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
              className="text-center mb-16 lg:mb-24"
            >
              <h2 className={`text-4xl md:text-5xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-6`}>
                {isHebrew ? 'המסע שלנו' : 'Our Journey'}
              </h2>
              <p className={`text-xl ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {isHebrew ? 'המסע המותאם אישית שלך לבריאות טובה יותר מתחיל כאן' : 'Your personalized journey to better health starts here'}
              </p>
            </motion.div>

            {/* Immersive Vertical Timeline */}
            <div className="relative">
              {timelineSteps.map((step, index) => (
                <motion.div 
                  key={index}
                  initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
                  variants={staggerContainerVariant}
                  className="grid grid-cols-[3rem_1fr] md:grid-cols-[5rem_1fr] gap-4 md:gap-8 mb-12 lg:mb-16 relative"
                >
                  {/* Timeline Graphic Container (Handles RTL/LTR naturally via grid) */}
                  <div className="relative flex flex-col items-center">
                    {/* Background Line */}
                    <div className="w-[2px] h-full bg-slate-200 dark:bg-slate-800 absolute top-0"></div>
                    
                    {/* Animated Fill Line */}
                    <motion.div 
                      initial={{ scaleY: 0 }}
                      whileInView={{ scaleY: 1 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ duration: 1, ease: "easeInOut" }}
                      className="w-[2px] h-full bg-gradient-to-b from-emerald-400 to-emerald-600 absolute top-0 origin-top"
                    ></motion.div>
                    
                    {/* Animated Node */}
                    <motion.div 
                      variants={scaleUpVariant}
                      className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)] z-10 sticky top-1/2 -mt-6 md:-mt-7 border-4 border-[#f4f9f5] dark:border-slate-950"
                    >
                      <span className="text-white font-bold text-lg">{step.number}</span>
                    </motion.div>
                  </div>

                  {/* Content Card */}
                  <motion.div 
                    variants={fadeUpVariant}
                    whileHover={{ scale: 1.01 }}
                    className={`${glassCard} rounded-2xl p-6 md:p-8 border mt-4`}
                  >
                    <div className="flex items-center space-x-4 space-x-reverse mb-4">
                      <div className="w-12 h-12 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0 text-emerald-600 dark:text-emerald-400">
                         {React.cloneElement(step.icon, { className: 'w-6 h-6 text-emerald-500' })}
                      </div>
                      <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{step.title}</h3>
                    </div>
                    <p className={`text-lg ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} leading-relaxed ps-16`}>{step.description}</p>
                  </motion.div>
                </motion.div>
              ))}
            </div>

          </div>
        </div>

        {/* Team Section */}
        <div className="relative z-10 py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
              className="text-center mb-16 lg:mb-24"
            >
              <h2 className={`text-4xl md:text-5xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {isHebrew ? 'הצוות שלנו' : 'Our Team'}
              </h2>
            </motion.div>

            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainerVariant}
              className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 lg:px-12"
            >
              {/* Gal Becker */}
              <motion.div variants={fadeUpVariant} whileHover={{ y: -8 }} className={`${glassCard} rounded-[2rem] p-10 relative overflow-hidden group`}>
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-emerald-500/20 to-transparent"></div>
                <div className="text-center relative z-10 mt-4">
                  <div className="w-32 h-32 mx-auto mb-8 relative">
                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-400 to-green-300 rounded-full blur-md opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-emerald-400 to-emerald-600 relative z-10">
                      <img 
                        src="/gal.jpg" 
                        alt="Gal Becker" 
                        className="w-full h-full rounded-full object-cover border-4 border-white dark:border-slate-800"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div className="w-full h-full rounded-full bg-slate-800 items-center justify-center border-4 border-white dark:border-slate-800" style={{display: 'none'}}>
                         <span className="text-4xl font-bold text-white">GB</span>
                      </div>
                    </div>
                  </div>
                  <h3 className={`text-3xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-2`}>Gal Becker</h3>
                  <p className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-green-500 text-xl font-bold mb-6">
                    {isHebrew ? 'דיאטנית קלינית מורשית' : 'Licensed Clinical Dietitian'}
                  </p>
                  <p className={`text-lg ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} mb-8 leading-relaxed px-4`}>
                    {isHebrew 
                      ? 'מומחית בתזונת ספורט וירידה במשקל עם שנים של ניסיון עם אלפי מטופלים'
                      : 'Expert in sports nutrition and weight loss with years of experience with thousands of patients'
                    }
                  </p>
                  <div className={`text-start px-6 py-4 rounded-xl ${isDarkMode ? 'bg-slate-900/50' : 'bg-white/80'} border border-slate-200 dark:border-slate-700`}>
                    <h4 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-1`}>
                      {isHebrew ? 'ניסיון' : 'Experience'}
                    </h4>
                    <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isHebrew ? 'תואר שני במדעי התזונה' : 'Master\'s degree in Nutrition Sciences'}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Yarden Ovadia */}
              <motion.div variants={fadeUpVariant} whileHover={{ y: -8 }} className={`${glassCard} rounded-[2rem] p-10 relative overflow-hidden group`}>
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-emerald-500/20 to-transparent"></div>
                <div className="text-center relative z-10 mt-4">
                  <div className="w-32 h-32 mx-auto mb-8 relative">
                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-400 to-green-300 rounded-full blur-md opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-emerald-400 to-emerald-600 relative z-10">
                      <img 
                        src="/yarden.png" 
                        alt="Yarden Ovadia" 
                        className="w-full h-full rounded-full object-cover border-4 border-white dark:border-slate-800"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div className="w-full h-full rounded-full bg-slate-800 items-center justify-center border-4 border-white dark:border-slate-800" style={{display: 'none'}}>
                         <span className="text-4xl font-bold text-white">YO</span>
                      </div>
                    </div>
                  </div>
                  <h3 className={`text-3xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-2`}>Yarden Ovadia</h3>
                  <p className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-green-500 text-xl font-bold mb-6">
                    {isHebrew ? 'דיאטן קליני ומאמן כושר' : 'Clinical Dietitian and Fitness Trainer'}
                  </p>
                  <p className={`text-lg ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} mb-8 leading-relaxed px-4`}>
                    {isHebrew 
                      ? 'אימון כוח ותזונת ספורט'
                      : 'Strength training and sports nutrition'
                    }
                  </p>
                  <div className={`text-start px-6 py-4 rounded-xl ${isDarkMode ? 'bg-slate-900/50' : 'bg-white/80'} border border-slate-200 dark:border-slate-700`}>
                    <h4 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-1`}>
                      {isHebrew ? 'ניסיון' : 'Experience'}
                    </h4>
                    <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isHebrew ? 'דיאטן קליני' : 'Clinical Dietitian'}
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Contact CTA Section */}
        <div className={`relative z-10 py-24 ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-emerald-900/40 to-slate-900' : 'bg-gradient-to-br from-emerald-500 via-green-500 to-emerald-600'}`}>
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainerVariant}
            className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
          >
            <motion.h2 variants={fadeUpVariant} className={`text-4xl md:text-5xl font-extrabold ${isDarkMode ? 'text-white' : 'text-white'} mb-6`}>
              {isHebrew ? 'צור קשר' : 'Contact Us'}
            </motion.h2>
            <motion.p variants={fadeUpVariant} className={`text-xl ${isDarkMode ? 'text-emerald-200' : 'text-emerald-50'} mb-12 max-w-2xl mx-auto`}>
              {isHebrew 
                ? 'מוכנים להתחיל את המסע שלכם לבריאות טובה יותר? צרו איתנו קשר היום!'
                : 'Ready to start your journey to better health? Contact us today!'
              }
            </motion.p>

            <motion.div variants={staggerContainerVariant} className="flex flex-col sm:flex-row justify-center items-center gap-6 mb-16">
              <motion.div whileHover={{ scale: 1.05 }} className={`flex-1 w-full max-w-xs ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/10 border-white/20'} backdrop-blur-xl rounded-3xl p-8 border shadow-2xl`}>
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-md">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                  </svg>
                </div>
                <p className="text-white text-lg font-bold tracking-wide">info@betterchoice.live</p>
              </motion.div>

              <motion.div whileHover={{ scale: 1.05 }} className={`flex-1 w-full max-w-xs ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/10 border-white/20'} backdrop-blur-xl rounded-3xl p-8 border shadow-2xl`}>
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-md">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                  </svg>
                </div>
                <p className="text-white text-lg font-bold tracking-wide">Maskit 10, Herzliya</p>
              </motion.div>
            </motion.div>

            <motion.div variants={fadeUpVariant} className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link 
                to="/signup"
                className="bg-white text-emerald-600 font-extrabold text-lg py-5 px-10 rounded-2xl hover:bg-emerald-50 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] flex items-center justify-center"
              >
                <svg className="w-6 h-6 mr-3 rtl:ml-3 rtl:mr-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                {isHebrew ? 'בחר תוכנית' : 'Choose Plan'}
              </Link>
              <Link 
                to="/contact"
                className={`${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-emerald-700 hover:bg-emerald-800'} text-white font-extrabold text-lg py-5 px-10 rounded-2xl transition-all duration-300 shadow-xl hover:shadow-2xl flex items-center justify-center border border-white/10`}
              >
                <svg className="w-6 h-6 mr-3 rtl:ml-3 rtl:mr-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/>
                </svg>
                {isHebrew ? 'צור קשר' : 'Contact Us'}
              </Link>
            </motion.div>
          </motion.div>
        </div>
        
      </main>
    </div>
  );
};

export default AboutPage;