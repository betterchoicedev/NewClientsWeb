import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Navigation from '../components/Navigation';

const KnowledgePage = () => {
  const { language, t, direction, toggleLanguage } = useLanguage();
  const { isDarkMode, toggleTheme, themeClasses } = useTheme();

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
        ? "זה מפריך את המיתוס של \"הכל או כלום\" — מראה שתנועה \"כלשהי\" כבר מביאה יתרונות בריאותיים מדידים."
        : "It debunks the \"all or nothing\" myth — showing that *some* movement already brings measurable health benefits.",
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
        ? "מספק נוסחת \"מינון-תגובה\" ברורה — אפשר לכמת תוצאות לפי דקות של פעילות גופנית."
        : "Provides a clear \"dose-response\" formula — you can quantify results per minutes of exercise.",
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
        ? "מראה סינרגיה — דיאטה + פעילות גופנית יחד עולות בביצועים על כל אחד בנפרד."
        : "Shows synergy — diet + exercise together outperform either alone.",
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
        ? "חורג מעבר למניעת מחלות — מחבר תזונה לשביעות רצון מהחיים ורווחה רגשית."
        : "Goes beyond disease prevention — connects diet to *life satisfaction* and emotional well-being.",
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
        ? "מדגים את ההשפעה הניתנת למדידה בעולם האמיתי של הדרכה מקצועית — לא רק \"עזרה עצמית\"."
        : "Demonstrates the measurable real-world effect of professional guidance — not just \"self-help.\"",
      icon: "👨‍⚕️"
    }
  ];

  return (
    <div className={`min-h-screen ${themeClasses.bgPrimary} language-transition language-text-transition flex flex-col`} dir={direction} style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto custom-scrollbar ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900' : 'bg-gradient-to-br from-emerald-50 via-green-50 to-amber-50'}`} style={{ minHeight: 0 }}>
        {/* Hero Section */}
        <div className="relative py-12 sm:py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Icon */}
            <div className="mb-6 sm:mb-8">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/25 animate-pulse">
                <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            </div>

            {/* Main Heading */}
            <h1 className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} mb-4 sm:mb-6 px-2 animate-fadeIn`}>
              {t.knowledgePage?.title || (language === 'hebrew' ? 'ידע והשראה' : 'Knowledge & Inspiration')}
            </h1>

            {/* Subtitle */}
            <p className={`text-base sm:text-lg md:text-xl ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} mb-6 sm:mb-8 max-w-3xl mx-auto px-2`}>
              {t.knowledgePage?.subtitle || (language === 'hebrew' 
                ? 'מחקרים מדעיים מובילים בתחום התזונה, הבריאות והפעילות הגופנית'
                : 'Leading Scientific Research in Nutrition, Health, and Physical Activity'
              )}
            </p>
          </div>
        </div>

        {/* Studies Section */}
        <div className="py-12 sm:py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-center mb-8 sm:mb-12 md:mb-16">
              <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} mb-3 sm:mb-4`}>
                {t.knowledgePage?.sectionTitle || (language === 'hebrew' ? 'מחקרים מדעיים מובילים' : 'Evidence-Based Scientific Studies')}
              </h2>
              <p className={`text-base sm:text-lg ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} max-w-3xl mx-auto px-2`}>
                {t.knowledgePage?.sectionDescription || (language === 'hebrew'
                  ? 'חמישה מחקרים מדעיים מוכחים ומעניינים שמראים את הקשר בין תזונה, פעילות גופנית ובריאות'
                  : 'Five well-known, evidence-based, and genuinely interesting scientific papers on nutrition, health, and exercise'
                )}
              </p>
            </div>

            {/* Studies Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
              {studies.map((study, index) => (
                <div 
                  key={study.id}
                  className={`${themeClasses.bgCard} rounded-2xl p-6 shadow-xl border ${isDarkMode ? 'border-slate-700 hover:border-emerald-500/30' : 'border-slate-200 hover:border-emerald-500/50'} transition-all duration-300 animate-slideInUp h-full flex flex-col`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Study Icon */}
                  <div className="text-4xl mb-4 text-center">
                    {study.icon}
                  </div>

                  {/* Study Title */}
                  <h3 className={`${themeClasses.textPrimary} text-lg font-bold mb-4 line-clamp-3 flex-shrink-0`}>
                    {study.title}
                  </h3>

                  {/* Publication Info */}
                  <div className="mb-4 flex-shrink-0">
                    {study.pubmedId ? (
                      <div className="flex items-center text-sm text-blue-400">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd"/>
                        </svg>
                        <span>PubMed ID: {study.pubmedId}</span>
                      </div>
                    ) : (
                      <div className="text-sm text-blue-400">
                        <svg className="w-4 h-4 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd"/>
                        </svg>
                        <span>{study.journal}</span>
                      </div>
                    )}
                  </div>

                  {/* Key Findings */}
                  <div className="mb-4 flex-grow">
                    <h4 className={`${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} font-semibold text-sm mb-2 uppercase tracking-wide`}>
                      {t.knowledgePage?.keyFindings || (language === 'hebrew' ? 'ממצאים עיקריים:' : 'Key Findings:')}
                    </h4>
                    <p className={`${isDarkMode ? 'text-slate-300' : 'text-slate-600'} text-sm leading-relaxed`}>
                      {study.keyFindings}
                    </p>
                  </div>

                  {/* Why Interesting */}
                  <div className="mb-6 flex-grow">
                    <h4 className={`${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'} font-semibold text-sm mb-2 uppercase tracking-wide`}>
                      {t.knowledgePage?.whyInteresting || (language === 'hebrew' ? 'למה זה מעניין:' : 'Why it\'s interesting:')}
                    </h4>
                    <p className={`${isDarkMode ? 'text-slate-300' : 'text-slate-600'} text-sm leading-relaxed`}>
                      {study.whyInteresting}
                    </p>
                  </div>

                  {/* Read More Button */}
                  <div className="flex-shrink-0">
                    <a
                      href={study.pubmedLink || study.journalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
                    >
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                      </svg>
                      {t.knowledgePage?.readFullStudy || (language === 'hebrew' ? 'קרא במלואו' : 'Read Full Study')}
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Additional Info Section */}
            <div className="mt-16 text-center">
              <div className={`${themeClasses.bgCard} rounded-2xl p-8 border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'} max-w-4xl mx-auto`}>
                <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} mb-4`}>
                  {t.knowledgePage?.moreStudiesTitle || (language === 'hebrew' ? 'מחקרים נוספים בקרוב' : 'More Studies Coming Soon')}
                </h3>
                <p className={`${isDarkMode ? 'text-slate-300' : 'text-slate-600'} text-lg`}>
                  {t.knowledgePage?.moreStudiesDescription || (language === 'hebrew'
                    ? 'אנו מוסיפים בקביעות מחקרים חדשים ומעודכנים מהספרות המדעית המובילה בעולם'
                    : 'We regularly add new and updated research from the world\'s leading scientific literature'
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Back to Home Button */}
        <div className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Link
              to="/"
              className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
              </svg>
              {t.knowledgePage?.backToHome || (language === 'hebrew' ? 'חזרה לעמוד הבית' : 'Back to Home')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default KnowledgePage;
