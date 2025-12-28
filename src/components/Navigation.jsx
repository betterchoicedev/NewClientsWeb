import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { signOut } from '../supabase/auth';
import { supabase } from '../supabase/supabaseClient';

function Navigation() {
  const { language, direction, toggleLanguage, t } = useLanguage();
  const { user, isAuthenticated, userDisplayName, loading } = useAuth();
  const { isDarkMode, toggleTheme, themeClasses } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Listen for tour events to open/close mobile menu
  useEffect(() => {
    const handleOpenMobileMenu = () => {
      setMobileMenuOpen(true);
    };

    const handleCloseMobileMenu = () => {
      setMobileMenuOpen(false);
    };

    window.addEventListener('openMobileMenu', handleOpenMobileMenu);
    window.addEventListener('closeMobileMenu', handleCloseMobileMenu);

    return () => {
      window.removeEventListener('openMobileMenu', handleOpenMobileMenu);
      window.removeEventListener('closeMobileMenu', handleCloseMobileMenu);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      setMobileMenuOpen(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className={`sticky top-0 z-50 ${isDarkMode ? 'bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900' : 'bg-gradient-to-r from-emerald-50 via-green-50 to-amber-50'} shadow-md border-b ${isDarkMode ? 'border-emerald-900/50' : 'border-emerald-100/50'} backdrop-blur-md`}>
      <nav data-tour="nav" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo Section */}
          <div className="flex items-center">
            <div className="relative">
              <img src="/favicon.ico" alt="BetterChoice Logo" className="w-10 h-10 sm:w-12 sm:h-12 mr-2 sm:mr-4 rounded-xl" />
            </div>
            <div className="flex flex-col">
              <h1 className={`text-xl sm:text-2xl font-semibold ${isDarkMode ? 'text-emerald-200' : 'text-emerald-700'} leading-tight`}>BetterChoice</h1>
              <p className={`${isDarkMode ? 'text-emerald-300/80' : 'text-emerald-600/80'} text-xs font-medium hidden sm:block`}>{t.tagline}</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div data-tour="nav-links" className={`hidden lg:flex items-center ${language === 'hebrew' ? 'space-x-reverse space-x-1' : 'space-x-1'} ${isDarkMode ? 'bg-slate-800/80' : 'bg-white/80'} rounded-2xl p-2.5 backdrop-blur-md border ${isDarkMode ? 'border-emerald-800/30' : 'border-emerald-200/50'} shadow-sm`}>
            <Link 
              to="/" 
              data-tour="nav-home"
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 ${
                isActive('/') 
                  ? `${isDarkMode ? 'bg-emerald-600' : 'bg-emerald-500'} text-white font-semibold shadow-md` 
                  : `${isDarkMode ? 'text-emerald-200' : 'text-emerald-700'} hover:text-emerald-600 hover:${isDarkMode ? 'bg-slate-700/50' : 'bg-emerald-100/60'}`
              }`}
            >
              {language === 'hebrew' ? 'בית' : 'Home'}
            </Link>
            <Link 
              to="/knowledge" 
              data-tour="nav-knowledge"
              className={`px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all duration-300 ${
                isActive('/knowledge') 
                  ? `${isDarkMode ? 'bg-emerald-600' : 'bg-emerald-500'} text-white font-semibold shadow-md` 
                  : `${isDarkMode ? 'text-emerald-200' : 'text-emerald-700'} hover:text-emerald-600 hover:${isDarkMode ? 'bg-slate-700/50' : 'bg-emerald-100/60'}`
              }`}
            >
              {language === 'hebrew' ? 'ידע והשראה' : 'Knowledge & Inspiration'}
            </Link>
            <Link 
              to="/recipes" 
              data-tour="nav-recipes"
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 ${
                isActive('/recipes') 
                  ? `${isDarkMode ? 'bg-emerald-600' : 'bg-emerald-500'} text-white font-semibold shadow-md` 
                  : `${isDarkMode ? 'text-emerald-200' : 'text-emerald-700'} hover:text-emerald-600 hover:${isDarkMode ? 'bg-slate-700/50' : 'bg-emerald-100/60'}`
              }`}
            >
              {language === 'hebrew' ? 'מתכונים' : 'Recipes'}
            </Link>
            <Link 
              to="/about" 
              data-tour="nav-about"
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 ${
                isActive('/about') 
                  ? `${isDarkMode ? 'bg-emerald-600' : 'bg-emerald-500'} text-white font-semibold shadow-md` 
                  : `${isDarkMode ? 'text-emerald-200' : 'text-emerald-700'} hover:text-emerald-600 hover:${isDarkMode ? 'bg-slate-700/50' : 'bg-emerald-100/60'}`
              }`}
            >
              {language === 'hebrew' ? 'אודות' : t.nav.about}
            </Link>
          </div>

          {/* Right Side Controls */}
          <div className={`hidden lg:flex items-center ${language === 'hebrew' ? 'space-x-reverse space-x-2' : 'space-x-2'} ml-6`}>
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              data-tour="theme-toggle"
              className={`w-10 h-10 ${isDarkMode ? 'bg-slate-800/80' : 'bg-white/80'} hover:${isDarkMode ? 'bg-slate-700/80' : 'bg-white'} rounded-xl flex items-center justify-center transition-all duration-300 border ${isDarkMode ? 'border-emerald-800/30' : 'border-emerald-200/50'} backdrop-blur-md shadow-sm`}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? (
                <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd"/>
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
                </svg>
              )}
            </button>

            {/* Language Toggle */}
            <button 
              onClick={toggleLanguage}
              data-tour="language-toggle"
              className={`w-10 h-10 ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-emerald-500 hover:bg-emerald-600'} rounded-xl flex items-center justify-center transition-all duration-300 text-white font-medium text-sm shadow-md`}
            >
              {language === 'hebrew' ? 'EN' : 'ע'}
            </button>
            
            {/* Separator */}
            <div className={`w-px h-8 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
            
            {loading ? (
              <div className={`${themeClasses.bgSecondary} ${themeClasses.textSecondary} px-4 py-2 rounded-xl font-medium text-sm border ${themeClasses.borderPrimary} backdrop-blur-sm`}>
                {language === 'hebrew' ? 'טוען...' : 'Loading...'}
              </div>
            ) : isAuthenticated ? (
              <>
                {/* Profile Button */}
                <Link 
                  to="/profile"
                  data-tour="profile-button"
                  className={`${isDarkMode ? 'bg-slate-800/80' : 'bg-white/80'} hover:${isDarkMode ? 'bg-slate-700/80' : 'bg-white'} ${isDarkMode ? 'text-emerald-200' : 'text-emerald-700'} px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 border ${isDarkMode ? 'border-emerald-800/30' : 'border-emerald-200/50'} backdrop-blur-md whitespace-nowrap flex items-center gap-2 shadow-sm`}
                  title={language === 'hebrew' ? 'פרופיל' : 'Profile'}
                >
                  <svg className={`w-4 h-4 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-600'} flex-shrink-0`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                  </svg>
                  <span>{language === 'hebrew' ? 'פרופיל' : 'Profile'}</span>
                </Link>
                
                {/* Separator */}
                <div className={`w-px h-8 ${isDarkMode ? 'bg-emerald-800/30' : 'bg-emerald-200/50'}`}></div>
                
                {/* Welcome Message */}
                <div className={`${isDarkMode ? 'bg-slate-800/80' : 'bg-white/80'} ${isDarkMode ? 'text-emerald-200' : 'text-emerald-700'} px-4 py-2 rounded-xl font-medium text-sm border ${isDarkMode ? 'border-emerald-800/30' : 'border-emerald-200/50'} flex items-center backdrop-blur-md whitespace-nowrap shadow-sm`}>
                  <svg className={`w-4 h-4 ${language === 'hebrew' ? 'ml-2' : 'mr-2'} text-emerald-500 flex-shrink-0`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <span className="truncate">{language === 'hebrew' ? `שלום ${userDisplayName}` : `Hello ${userDisplayName}`}</span>
                </div>
                
                {/* Separator */}
                <div className={`w-px h-8 ${isDarkMode ? 'bg-emerald-800/30' : 'bg-emerald-200/50'}`}></div>
                
                {/* Logout Button */}
                <button 
                  onClick={handleLogout}
                  className={`${isDarkMode ? 'bg-slate-800/80' : 'bg-white/80'} hover:${isDarkMode ? 'bg-slate-700/80' : 'bg-white'} ${isDarkMode ? 'text-emerald-200' : 'text-emerald-700'} px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 border ${isDarkMode ? 'border-emerald-800/30' : 'border-emerald-200/50'} backdrop-blur-md whitespace-nowrap shadow-sm`}
                >
                  {language === 'hebrew' ? 'התנתק' : 'Logout'}
                </button>
              </>
            ) : (
              <>
                <div data-tour="auth-buttons" className="flex items-center gap-2">
                <Link to="/login" className={`${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-emerald-500 hover:bg-emerald-600'} text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 whitespace-nowrap shadow-md`}>
                  {t.buttons.login}
                </Link>
                
                {/* Separator */}
                <div className={`w-px h-8 ${isDarkMode ? 'bg-emerald-800/30' : 'bg-emerald-200/50'}`}></div>
                
                <Link to="/signup" className={`${isDarkMode ? 'bg-slate-800/80' : 'bg-white/80'} ${isDarkMode ? 'text-emerald-200' : 'text-emerald-700'} px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 border ${isDarkMode ? 'border-emerald-800/30' : 'border-emerald-200/50'} hover:${isDarkMode ? 'bg-slate-700/80' : 'bg-white'} hover:text-emerald-600 backdrop-blur-md whitespace-nowrap shadow-sm`}>
                  {t.buttons.signup}
                </Link>
                </div>
              </>
            )}
          </div>

          {/* Mobile Controls */}
          <div className="flex lg:hidden items-center space-x-2">
            {/* Theme Toggle - Mobile */}
            <button 
              onClick={toggleTheme}
              data-tour="theme-toggle"
              className={`w-10 h-10 ${isDarkMode ? 'bg-slate-800/80' : 'bg-white/80'} hover:${isDarkMode ? 'bg-slate-700/80' : 'bg-white'} rounded-xl flex items-center justify-center transition-all duration-300 border ${isDarkMode ? 'border-emerald-800/30' : 'border-emerald-200/50'} backdrop-blur-md shadow-sm`}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? (
                <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd"/>
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
                </svg>
              )}
            </button>
            
            {/* Language Toggle - Mobile */}
            <button 
              onClick={toggleLanguage}
              data-tour="language-toggle"
              className={`w-10 h-10 ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-emerald-500 hover:bg-emerald-600'} rounded-xl flex items-center justify-center transition-all duration-300 text-white font-medium text-sm shadow-md`}
            >
              {language === 'hebrew' ? 'EN' : 'ע'}
            </button>
            
            {/* Mobile Menu Button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-tour="mobile-menu-button"
              className={`w-10 h-10 ${isDarkMode ? 'bg-slate-800/80' : 'bg-white/80'} hover:${isDarkMode ? 'bg-slate-700/80' : 'bg-white'} rounded-xl flex items-center justify-center transition-all duration-300 border ${isDarkMode ? 'border-emerald-800/30' : 'border-emerald-200/50'} backdrop-blur-md shadow-sm`}
            >
              <svg className={`w-5 h-5 ${isDarkMode ? 'text-emerald-200' : 'text-emerald-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className={`lg:hidden ${isDarkMode ? 'bg-slate-900/95' : 'bg-white/95'} border-t ${isDarkMode ? 'border-emerald-900/50' : 'border-emerald-100/50'} shadow-lg backdrop-blur-md`}>
            <div className="px-4 py-4 space-y-3">
              {/* Navigation Links */}
              <div data-tour="nav-links" className="space-y-3">
              <Link 
                to="/" 
                data-tour="nav-home"
                onClick={closeMobileMenu}
                className={`block px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${
                  isActive('/') 
                    ? `${isDarkMode ? 'bg-emerald-600' : 'bg-emerald-500'} text-white shadow-md` 
                    : `${isDarkMode ? 'text-emerald-200 bg-slate-800/50' : 'text-emerald-700 bg-emerald-50/50'} hover:bg-emerald-100/60 hover:text-emerald-600`
                }`}
              >
                {language === 'hebrew' ? 'בית' : 'Home'}
              </Link>
              <Link 
                to="/knowledge" 
                data-tour="nav-knowledge"
                onClick={closeMobileMenu}
                className={`block px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${
                  isActive('/knowledge') 
                    ? `${isDarkMode ? 'bg-emerald-600' : 'bg-emerald-500'} text-white shadow-md` 
                    : `${isDarkMode ? 'text-emerald-200 bg-slate-800/50' : 'text-emerald-700 bg-emerald-50/50'} hover:bg-emerald-100/60 hover:text-emerald-600`
                }`}
              >
                {language === 'hebrew' ? 'ידע והשראה' : 'Knowledge & Inspiration'}
              </Link>
              <Link 
                to="/recipes" 
                data-tour="nav-recipes"
                onClick={closeMobileMenu}
                className={`block px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${
                  isActive('/recipes') 
                    ? `${isDarkMode ? 'bg-emerald-600' : 'bg-emerald-500'} text-white shadow-md` 
                    : `${isDarkMode ? 'text-emerald-200 bg-slate-800/50' : 'text-emerald-700 bg-emerald-50/50'} hover:bg-emerald-100/60 hover:text-emerald-600`
                }`}
              >
                {language === 'hebrew' ? 'מתכונים' : 'Recipes'}
              </Link>
              <Link 
                to="/about" 
                data-tour="nav-about"
                onClick={closeMobileMenu}
                className={`block px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${
                  isActive('/about') 
                    ? `${isDarkMode ? 'bg-emerald-600' : 'bg-emerald-500'} text-white shadow-md` 
                    : `${isDarkMode ? 'text-emerald-200 bg-slate-800/50' : 'text-emerald-700 bg-emerald-50/50'} hover:bg-emerald-100/60 hover:text-emerald-600`
                }`}
              >
                {language === 'hebrew' ? 'אודות' : t.nav.about}
              </Link>
              </div>

              {/* Divider */}
              <div className={`border-t ${isDarkMode ? 'border-emerald-900/50' : 'border-emerald-100/50'} my-3`}></div>

              {/* User Section */}
              {loading ? (
                <div className={`px-4 py-3 text-center ${isDarkMode ? 'text-emerald-300/80' : 'text-emerald-600'} text-sm`}>
                  {language === 'hebrew' ? 'טוען...' : 'Loading...'}
                </div>
              ) : isAuthenticated ? (
                <>
                  {/* Welcome Message */}
                  <div className={`px-4 py-3 ${isDarkMode ? 'bg-slate-800/50' : 'bg-emerald-50/60'} rounded-xl flex items-center justify-center`}>
                    <svg className={`w-4 h-4 ${language === 'hebrew' ? 'ml-2' : 'mr-2'} text-emerald-500`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                    <span className={`${isDarkMode ? 'text-emerald-200' : 'text-emerald-700'} font-medium text-sm`}>
                      {language === 'hebrew' ? `שלום ${userDisplayName}` : `Hello ${userDisplayName}`}
                    </span>
                  </div>
                  
                  {/* Profile Button */}
                  <Link 
                    to="/profile"
                    data-tour="profile-button"
                    onClick={closeMobileMenu}
                    className={`block px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${isDarkMode ? 'bg-slate-800/50 text-emerald-200' : 'bg-emerald-50/50 text-emerald-700'} hover:bg-emerald-100/60 hover:text-emerald-600 text-center`}
                  >
                    {language === 'hebrew' ? 'פרופיל' : 'Profile'}
                  </Link>
                  
                  {/* Logout Button */}
                  <button 
                    onClick={handleLogout}
                    className={`w-full px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${isDarkMode ? 'bg-slate-800/50 text-emerald-200' : 'bg-emerald-50/50 text-emerald-700'} hover:bg-red-50 hover:text-red-600`}
                  >
                    {language === 'hebrew' ? 'התנתק' : 'Logout'}
                  </button>
                </>
              ) : (
                <>
                  <div data-tour="auth-buttons" className="space-y-3">
                  <Link 
                    to="/login" 
                    onClick={closeMobileMenu}
                    className={`block w-full ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-emerald-500 hover:bg-emerald-600'} text-white px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 text-center shadow-md`}
                  >
                    {t.buttons.login}
                  </Link>
                  <Link 
                    to="/signup" 
                    onClick={closeMobileMenu}
                    className={`block w-full ${isDarkMode ? 'bg-slate-800/50 text-emerald-200' : 'bg-emerald-50/50 text-emerald-700'} px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 hover:bg-emerald-100/60 hover:text-emerald-600 text-center border ${isDarkMode ? 'border-emerald-800/30' : 'border-emerald-200/50'}`}
                  >
                    {t.buttons.signup}
                  </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

export default Navigation;
