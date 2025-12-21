import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Navigation from '../components/Navigation';

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

  return (
    <div className={`min-h-screen ${themeClasses.bgPrimary} language-transition language-text-transition flex flex-col`} dir={direction} style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar" style={{ minHeight: 0 }}>
        {/* Hero Section */}
        <div className="relative bg-gradient-to-b from-slate-800 via-slate-900 to-black py-12 sm:py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Logo */}
            <div className="mb-6 sm:mb-8">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/25 animate-pulse">
                <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                </svg>
              </div>
            </div>

            {/* Main Heading */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-emerald-400 mb-4 sm:mb-6 px-2 animate-fadeIn">
              {language === 'hebrew' ? 'דיוק בינה מלאכותית, הדרכה קלינית מומחית' : 'AI Precision, Expert Clinical Guidance'}
            </h1>

            {/* Description */}
            <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4 text-base sm:text-lg text-slate-300 px-2 animate-slideInUp">
              <p>
                {language === 'hebrew' 
                  ? 'BetterChoice נוסדה ב-2025 מתוך צורך אמיתי: לספק לאנשים גישה לתזונה מדויקת, מקצועית ומותאמת אישית'
                  : 'BetterChoice was founded in 2025 from a real need: to provide people access to accurate, professional, and personalized nutrition'
                }
              </p>
              <p>
                {language === 'hebrew'
                  ? 'מדויק, מקצועי ומותאם אישית – בדיוק מה שכל אדם צריך לאורח חיים בריא'
                  : 'Precise, professional, and personally tailored – exactly what every person needs for a healthy lifestyle'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Mission & Vision Section */}
        <div className="py-12 sm:py-16 md:py-20 bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 md:gap-12">
              {/* Mission Card */}
              <div className={`${themeClasses.bgCard} rounded-2xl p-8 shadow-xl border border-slate-700 hover:border-emerald-500/30 transition-all duration-300 animate-slideInUp`}>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/25">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-4">
                    {language === 'hebrew' ? 'המשימה שלנו' : 'Our Mission'}
                  </h2>
                </div>
                
                <div className="space-y-4">
                  {[
                    language === 'hebrew' ? 'טכנולוגיית בינה מלאכותית מתקדמת לתזונה מותאמת אישית' : 'Advanced AI technology for personalized nutrition',
                    language === 'hebrew' ? 'דיאטנים קליניים מורשים עם מומחיות מוכחת' : 'Licensed clinical dietitians with proven expertise',
                    language === 'hebrew' ? 'גישות מבוססות ראיות ומחקר מדעי' : 'Evidence-based approaches and scientific research',
                    language === 'hebrew' ? 'תמיכה מקיפה לאורך המסע שלך' : 'Comprehensive support throughout your journey',
                    language === 'hebrew' ? 'גישה מותאמת אישית לכל אדם' : 'Personalized approach for every individual',
                    language === 'hebrew' ? 'מדע תזונה מבוסס ראיות' : 'Evidence-based nutrition science',
                    language === 'hebrew' ? 'מומחיות קלינית מקצועית' : 'Professional clinical expertise',
                    language === 'hebrew' ? 'תמיכה והדרכה מתמשכים' : 'Continuous support and guidance'
                  ].map((item, index) => (
                    <div key={index} className="flex items-start">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <p className="text-slate-300">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vision Card */}
              <div className={`${themeClasses.bgCard} rounded-2xl p-8 shadow-xl border border-slate-700 hover:border-emerald-500/30 transition-all duration-300 animate-slideInUp`} style={{ animationDelay: '0.2s' }}>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/25">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-4">
                    {language === 'hebrew' ? 'החזון שלנו' : 'Our Vision'}
                  </h2>
                </div>
                
                <div className="space-y-6">
                  <p className="text-slate-300 text-lg leading-relaxed">
                    {language === 'hebrew'
                      ? 'להפוך תזונה בריאה לנגישה ומותאמת אישית לכולם, תוך שילוב הטכנולוגיה המתקדמת ביותר עם מומחיות קלינית מוכחת.'
                      : 'To make healthy nutrition accessible and personalized for everyone, combining the most advanced technology with proven clinical expertise.'
                    }
                  </p>
                  
                  <div className="space-y-3">
                    {[
                      language === 'hebrew' ? 'אינטגרציה של טכנולוגיית בינה מלאכותית מתקדמת' : 'Advanced AI technology integration',
                      language === 'hebrew' ? 'מתודולוגיות קליניות מוכחות' : 'Proven clinical methodologies',
                      language === 'hebrew' ? 'תוכניות תזונה מותאמות אישית' : 'Personalized nutrition plans',
                      language === 'hebrew' ? 'ניטור בריאות מקיף' : 'Comprehensive health monitoring'
                    ].map((item, index) => (
                      <div key={index} className="flex items-start">
                        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                          <span className="text-white text-xs font-bold">A</span>
                        </div>
                        <p className="text-slate-300">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Journey Section */}
        <div className="py-12 sm:py-16 md:py-20 bg-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12 md:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-emerald-400 mb-3 sm:mb-4 animate-fadeIn">
                {language === 'hebrew' ? 'המסע שלנו' : 'Our Journey'}
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-slate-300 px-2 animate-slideInUp">
                {language === 'hebrew' ? 'המסע המותאם אישית שלך לבריאות טובה יותר מתחיל כאן' : 'Your personalized journey to better health starts here'}
              </p>
            </div>

            {/* Journey Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-12 md:mb-16">
              {[
                {
                  number: '1',
                  icon: (
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                  ),
                  title: language === 'hebrew' ? 'הערכה אישית' : 'Personal Assessment',
                  description: language === 'hebrew' 
                    ? 'ייעוץ מקיף עם דיאטן מורשה להבנת הצרכים, המטרות והמגבלות שלך'
                    : 'Comprehensive consultation with a licensed dietitian to understand your needs, goals and limitations'
                },
                {
                  number: '2',
                  icon: (
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                    </svg>
                  ),
                  title: language === 'hebrew' ? 'תכנון מותאם' : 'Customized Planning',
                  description: language === 'hebrew'
                    ? 'יצירת תוכנית תזונה אישית בהתבסס על הנתונים שלך עם תמיכת בינה מלאכותית חכמה'
                    : 'Creating a personal nutrition plan based on your data with smart AI support'
                },
                {
                  number: '3',
                  icon: (
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/>
                    </svg>
                  ),
                  title: language === 'hebrew' ? 'יישום והדרכה' : 'Implementation & Guidance',
                  description: language === 'hebrew'
                    ? 'התחלת יישום עם ניטור צמוד, הדרכה ותמיכה יומית'
                    : 'Starting implementation with close monitoring, guidance and daily support'
                },
                {
                  number: '4',
                  icon: (
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                  ),
                  title: language === 'hebrew' ? 'ניטור והתאמה' : 'Monitoring & Adjustment',
                  description: language === 'hebrew'
                    ? 'ניטור מתמשך של התקדמות והתאמת התוכנית בהתאם לצרכים משתנים'
                    : 'Ongoing monitoring of progress and adjusting the plan according to changing needs'
                }
              ].map((step, index) => (
                <div 
                  key={index} 
                  className={`${themeClasses.bgCard} rounded-2xl p-6 text-center shadow-xl border border-slate-700 hover:border-emerald-500/30 transition-all duration-300 animate-slideInUp`}
                  style={{ animationDelay: `${0.1 * index}s` }}
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/25">
                    <span className="text-white text-lg font-bold">{step.number}</span>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/25">
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>

            {/* Progress Bar */}
            <div className="relative">
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full animate-progressBar"></div>
              </div>
              <div className="flex justify-between mt-4">
                <span className="text-slate-300 text-sm font-medium">
                  {language === 'hebrew' ? 'התחלה' : 'Start'}
                </span>
                <span className="text-slate-300 text-sm font-medium">
                  {language === 'hebrew' ? 'השלמה' : 'Complete'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Team Section */}
        <div className="py-12 sm:py-16 md:py-20 bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12 md:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-emerald-400 mb-3 sm:mb-4 animate-fadeIn">
                {language === 'hebrew' ? 'הצוות שלנו' : 'Our Team'}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 md:gap-12">
              {/* Gal Becker */}
              <div className={`${themeClasses.bgCard} rounded-2xl p-8 shadow-xl border border-slate-700 hover:border-emerald-500/30 transition-all duration-300 animate-slideInUp`}>
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto mb-6 relative">
                    <img 
                      src="/gal.jpg" 
                      alt="Gal Becker" 
                      className="w-full h-full rounded-full object-cover shadow-lg shadow-emerald-500/25 border-4 border-emerald-500/20"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center absolute inset-0 shadow-lg shadow-emerald-500/25" style={{display: 'none'}}>
                      <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Gal Becker</h3>
                  <p className="text-emerald-400 text-lg font-semibold mb-4">
                    {language === 'hebrew' ? 'דיאטנית קלינית מורשית' : 'Licensed Clinical Dietitian'}
                  </p>
                  <p className="text-slate-300 mb-6">
                    {language === 'hebrew' 
                      ? 'מומחית בתזונת ספורט וירידה במשקל עם שנים של ניסיון עם אלפי מטופלים'
                      : 'Expert in sports nutrition and weight loss with years of experience with thousands of patients'
                    }
                  </p>
                  <div className="text-left">
                    <h4 className="text-white font-bold mb-2">
                      {language === 'hebrew' ? 'ניסיון' : 'Experience'}
                    </h4>
                    <p className="text-slate-300">
                      {language === 'hebrew' ? 'תואר שני במדעי התזונה' : 'Master\'s degree in Nutrition Sciences'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Yarden Ovadia */}
              <div className={`${themeClasses.bgCard} rounded-2xl p-8 shadow-xl border border-slate-700 hover:border-emerald-500/30 transition-all duration-300 animate-slideInUp`} style={{ animationDelay: '0.2s' }}>
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto mb-6 relative">
                    <img 
                      src="/yarden.png" 
                      alt="Yarden Ovadia" 
                      className="w-full h-full rounded-full object-cover shadow-lg shadow-emerald-500/25 border-4 border-emerald-500/20"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center absolute inset-0 shadow-lg shadow-emerald-500/25" style={{display: 'none'}}>
                      <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Yarden Ovadia</h3>
                  <p className="text-emerald-400 text-lg font-semibold mb-4">
                    {language === 'hebrew' ? 'דיאטן קליני ומאמן כושר' : 'Clinical Dietitian and Fitness Trainer'}
                  </p>
                  <p className="text-slate-300 mb-6">
                    {language === 'hebrew' 
                      ? 'אימון כוח ותזונת ספורט'
                      : 'Strength training and sports nutrition'
                    }
                  </p>
                  <div className="text-left">
                    <h4 className="text-white font-bold mb-2">
                      {language === 'hebrew' ? 'ניסיון' : 'Experience'}
                    </h4>
                    <p className="text-slate-300">
                      {language === 'hebrew' ? 'דיאטן קליני' : 'Clinical Dietitian'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="py-12 sm:py-16 md:py-20 bg-gradient-to-r from-emerald-600 to-emerald-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 sm:mb-6 animate-fadeIn">
              {language === 'hebrew' ? 'צור קשר' : 'Contact Us'}
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-emerald-100 mb-8 sm:mb-10 md:mb-12 px-2 animate-slideInUp">
              {language === 'hebrew' 
                ? 'מוכנים להתחיל את המסע שלכם לבריאות טובה יותר? צרו איתנו קשר היום!'
                : 'Ready to start your journey to better health? Contact us today!'
              }
            </p>

            {/* Contact Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-10 md:mb-12">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 animate-slideInUp">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                  </svg>
                </div>
                <p className="text-white font-semibold">050-2420905</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 animate-slideInUp" style={{ animationDelay: '0.1s' }}>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                  </svg>
                </div>
                <p className="text-white font-semibold">info@betterchoice.live</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 animate-slideInUp" style={{ animationDelay: '0.2s' }}>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                  </svg>
                </div>
                <p className="text-white font-semibold">Maskit 10, Herzliya</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slideInUp" style={{ animationDelay: '0.3s' }}>
              <Link 
                to="/signup"
                className="bg-white text-emerald-600 font-semibold py-4 px-8 rounded-xl hover:bg-emerald-50 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                {language === 'hebrew' ? 'בחר תוכנית' : 'Choose Plan'}
              </Link>
              <Link 
                to="/contact"
                className="bg-slate-800 text-white font-semibold py-4 px-8 rounded-xl hover:bg-slate-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/>
                </svg>
                {language === 'hebrew' ? 'צור קשר' : 'Contact Us'}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AboutPage;
