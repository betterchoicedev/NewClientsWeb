import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Navigation from '../components/Navigation';

const NotFoundPage = () => {
  const { language, direction } = useLanguage();
  const { isDarkMode, themeClasses } = useTheme();

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
      <main className={`flex-1 overflow-y-auto custom-scrollbar flex items-center justify-center ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900' : 'bg-gradient-to-br from-emerald-50 via-green-50 to-amber-50'}`} style={{ minHeight: 0 }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          {/* 404 Icon/Number */}
          <div className="mb-8">
            <div className="text-9xl font-bold text-emerald-500/20 mb-4">
              404
            </div>
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/25">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          {/* Message */}
          <h1 className={`text-3xl sm:text-4xl md:text-5xl font-bold ${themeClasses.textPrimary} mb-4`}>
            {language === 'hebrew' 
              ? 'העמוד לא קיים' 
              : 'Page Not Found'}
          </h1>
          
          <p className={`text-lg sm:text-xl ${themeClasses.textSecondary} mb-8`}>
            {language === 'hebrew'
              ? 'אנו מצטערים, אבל העמוד שחיפשת לא קיים.'
              : 'We\'re sorry, but the page you are looking for does not exist.'}
          </p>

          {/* Back to Home Button */}
          <Link
            to="/"
            className="inline-flex items-center justify-center bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-4 rounded-lg font-semibold hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-xl"
          >
            <svg className={`w-5 h-5 ${direction === 'rtl' ? 'ml-2' : 'mr-2'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {language === 'hebrew' ? 'חזרה לעמוד הבית' : 'Go to Home Page'}
          </Link>
        </div>
      </main>
    </div>
  );
};

export default NotFoundPage;

