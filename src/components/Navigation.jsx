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
    <header className={`sticky top-0 z-50 ${isDarkMode ? themeClasses.bgHeader : 'bg-gradient-to-r from-emerald-500 to-teal-600'} shadow-xl border-b ${themeClasses.borderPrimary} backdrop-blur-sm`}>
      <nav data-tour="nav" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo Section */}
          <div className="flex items-center">
            <div className="relative">
              <img src="/favicon.ico" alt="BetterChoice Logo" className="w-10 h-10 sm:w-12 sm:h-12 mr-2 sm:mr-4 rounded-xl shadow-lg shadow-emerald-500/25" />
            </div>
            <div className="flex flex-col">
              <h1 className={`text-xl sm:text-2xl font-bold ${isDarkMode ? themeClasses.textPrimary : 'text-white'} leading-tight`}>BetterChoice</h1>
              <p className="text-emerald-300 text-xs font-medium hidden sm:block">{t.tagline}</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div data-tour="nav-links" className={`hidden lg:flex items-center ${language === 'hebrew' ? 'space-x-reverse space-x-1' : 'space-x-1'} ${isDarkMode ? themeClasses.bgSecondary : 'bg-white/95'} rounded-2xl p-2.5 backdrop-blur-sm border ${isDarkMode ? themeClasses.borderPrimary : 'border-white/30'} shadow-lg`}>
            <Link 
              to="/" 
              data-tour="nav-home"
              className={`px-3 py-1 rounded-lg font-medium text-sm transition-all duration-300 ${
                isActive('/') 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold shadow-lg shadow-emerald-500/25' 
                  : `${isDarkMode ? themeClasses.textPrimary : 'text-gray-800'} hover:text-emerald-500 hover:${isDarkMode ? themeClasses.bgPrimary : 'bg-emerald-50'}`
              }`}
            >
              {language === 'hebrew' ? 'בית' : 'Home'}
            </Link>
            <Link 
              to="/knowledge" 
              data-tour="nav-knowledge"
              className={`px-3 py-1 rounded-lg font-medium text-sm whitespace-nowrap transition-all duration-300 ${
                isActive('/knowledge') 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold shadow-lg shadow-emerald-500/25' 
                  : `${isDarkMode ? themeClasses.textPrimary : 'text-gray-800'} hover:text-emerald-500 hover:${isDarkMode ? themeClasses.bgPrimary : 'bg-emerald-50'}`
              }`}
            >
              {language === 'hebrew' ? 'ידע והשראה' : 'Knowledge & Inspiration'}
            </Link>
            <Link 
              to="/recipes" 
              data-tour="nav-recipes"
              className={`px-3 py-1 rounded-lg font-medium text-sm transition-all duration-300 ${
                isActive('/recipes') 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold shadow-lg shadow-emerald-500/25' 
                  : `${isDarkMode ? themeClasses.textPrimary : 'text-gray-800'} hover:text-emerald-500 hover:${isDarkMode ? themeClasses.bgPrimary : 'bg-emerald-50'}`
              }`}
            >
              {language === 'hebrew' ? 'מתכונים' : 'Recipes'}
            </Link>
            <Link 
              to="/about" 
              data-tour="nav-about"
              className={`px-3 py-1 rounded-lg font-medium text-sm transition-all duration-300 ${
                isActive('/about') 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold shadow-lg shadow-emerald-500/25' 
                  : `${isDarkMode ? themeClasses.textPrimary : 'text-gray-800'} hover:text-emerald-500 hover:${isDarkMode ? themeClasses.bgPrimary : 'bg-emerald-50'}`
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
              className={`w-10 h-10 ${isDarkMode ? themeClasses.bgSecondary : 'bg-white/95'} hover:${isDarkMode ? themeClasses.bgPrimary : 'bg-white'} rounded-xl flex items-center justify-center transition-all duration-300 border ${isDarkMode ? themeClasses.borderPrimary : 'border-white/30'} backdrop-blur-sm`}
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
              className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-xl flex items-center justify-center transition-all duration-300 text-white font-semibold text-sm"
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
                  className={`w-10 h-10 ${isDarkMode ? themeClasses.bgSecondary : 'bg-white/95'} hover:${isDarkMode ? themeClasses.bgPrimary : 'bg-white'} rounded-xl flex items-center justify-center transition-all duration-300 border ${isDarkMode ? themeClasses.borderPrimary : 'border-white/30'} backdrop-blur-sm`}
                  title={language === 'hebrew' ? 'פרופיל' : 'Profile'}
                >
                  <svg className={`w-5 h-5 ${isDarkMode ? themeClasses.textPrimary : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                  </svg>
                </Link>
                
                {/* Separator */}
                <div className={`w-px h-8 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                
                {/* Welcome Message */}
                <div className={`${isDarkMode ? themeClasses.bgCard : 'bg-white/95'} ${isDarkMode ? themeClasses.textPrimary : 'text-gray-800'} px-4 py-2 rounded-xl font-medium text-sm border ${isDarkMode ? themeClasses.borderPrimary : 'border-white/30'} flex items-center backdrop-blur-sm whitespace-nowrap`}>
                  <svg className={`w-4 h-4 ${language === 'hebrew' ? 'ml-2' : 'mr-2'} text-emerald-500 flex-shrink-0`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <span className="truncate">{language === 'hebrew' ? `שלום ${userDisplayName}` : `Hello ${userDisplayName}`}</span>
                </div>
                
                {/* Separator */}
                <div className={`w-px h-8 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                
                {/* Logout Button */}
                <button 
                  onClick={handleLogout}
                  className={`${isDarkMode ? themeClasses.bgSecondary : 'bg-white/95'} hover:${isDarkMode ? themeClasses.bgPrimary : 'bg-white'} ${isDarkMode ? themeClasses.textPrimary : 'text-gray-800'} px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 border ${isDarkMode ? themeClasses.borderPrimary : 'border-white/30'} backdrop-blur-sm whitespace-nowrap`}
                >
                  {language === 'hebrew' ? 'התנתק' : 'Logout'}
                </button>
              </>
            ) : (
              <>
                <div data-tour="auth-buttons" className="flex items-center gap-2">
                <Link to="/login" className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 whitespace-nowrap">
                  {t.buttons.login}
                </Link>
                
                {/* Separator */}
                <div className={`w-px h-8 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                
                <Link to="/signup" className={`${isDarkMode ? themeClasses.bgCard : 'bg-white/95'} ${isDarkMode ? themeClasses.textPrimary : 'text-gray-800'} px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 border ${isDarkMode ? themeClasses.borderPrimary : 'border-white/30'} hover:${isDarkMode ? themeClasses.bgSecondary : 'bg-white'} backdrop-blur-sm whitespace-nowrap`}>
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
              className={`w-10 h-10 ${isDarkMode ? themeClasses.bgSecondary : 'bg-white/95'} hover:${isDarkMode ? themeClasses.bgPrimary : 'bg-white'} rounded-xl flex items-center justify-center transition-all duration-300 border ${isDarkMode ? themeClasses.borderPrimary : 'border-white/30'} backdrop-blur-sm`}
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
              className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-xl flex items-center justify-center transition-all duration-300 text-white font-semibold text-sm"
            >
              {language === 'hebrew' ? 'EN' : 'ע'}
            </button>
            
            {/* Mobile Menu Button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-tour="mobile-menu-button"
              className={`w-10 h-10 ${isDarkMode ? themeClasses.bgSecondary : 'bg-white/95'} hover:${isDarkMode ? themeClasses.bgPrimary : 'bg-white'} rounded-xl flex items-center justify-center transition-all duration-300 border ${isDarkMode ? themeClasses.borderPrimary : 'border-white/30'} backdrop-blur-sm`}
            >
              <svg className={`w-5 h-5 ${isDarkMode ? themeClasses.textPrimary : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className={`lg:hidden ${isDarkMode ? themeClasses.bgCard : 'bg-white'} border-t ${isDarkMode ? themeClasses.borderPrimary : 'border-gray-200'} shadow-lg`}>
            <div className="px-4 py-4 space-y-3">
              {/* Navigation Links */}
              <div data-tour="nav-links" className="space-y-3">
              <Link 
                to="/" 
                data-tour="nav-home"
                onClick={closeMobileMenu}
                className={`block px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${
                  isActive('/') 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md' 
                    : `${isDarkMode ? themeClasses.textPrimary + ' ' + themeClasses.bgSecondary : 'text-gray-800 bg-gray-50'} hover:bg-emerald-50 hover:text-emerald-600`
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
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md' 
                    : `${isDarkMode ? themeClasses.textPrimary + ' ' + themeClasses.bgSecondary : 'text-gray-800 bg-gray-50'} hover:bg-emerald-50 hover:text-emerald-600`
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
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md' 
                    : `${isDarkMode ? themeClasses.textPrimary + ' ' + themeClasses.bgSecondary : 'text-gray-800 bg-gray-50'} hover:bg-emerald-50 hover:text-emerald-600`
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
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md' 
                    : `${isDarkMode ? themeClasses.textPrimary + ' ' + themeClasses.bgSecondary : 'text-gray-800 bg-gray-50'} hover:bg-emerald-50 hover:text-emerald-600`
                }`}
              >
                {language === 'hebrew' ? 'אודות' : t.nav.about}
              </Link>
              </div>

              {/* Divider */}
              <div className={`border-t ${isDarkMode ? themeClasses.borderPrimary : 'border-gray-200'} my-3`}></div>

              {/* User Section */}
              {loading ? (
                <div className={`px-4 py-3 text-center ${isDarkMode ? themeClasses.textSecondary : 'text-gray-600'} text-sm`}>
                  {language === 'hebrew' ? 'טוען...' : 'Loading...'}
                </div>
              ) : isAuthenticated ? (
                <>
                  {/* Welcome Message */}
                  <div className={`px-4 py-3 ${isDarkMode ? themeClasses.bgSecondary : 'bg-emerald-50'} rounded-xl flex items-center justify-center`}>
                    <svg className={`w-4 h-4 ${language === 'hebrew' ? 'ml-2' : 'mr-2'} text-emerald-500`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                    <span className={`${isDarkMode ? themeClasses.textPrimary : 'text-gray-800'} font-medium text-sm`}>
                      {language === 'hebrew' ? `שלום ${userDisplayName}` : `Hello ${userDisplayName}`}
                    </span>
                  </div>
                  
                  {/* Profile Button */}
                  <Link 
                    to="/profile"
                    data-tour="profile-button"
                    onClick={closeMobileMenu}
                    className={`block px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${isDarkMode ? themeClasses.bgSecondary + ' ' + themeClasses.textPrimary : 'bg-gray-50 text-gray-800'} hover:bg-emerald-50 hover:text-emerald-600 text-center`}
                  >
                    {language === 'hebrew' ? 'פרופיל' : 'Profile'}
                  </Link>
                  
                  {/* Logout Button */}
                  <button 
                    onClick={handleLogout}
                    className={`w-full px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${isDarkMode ? themeClasses.bgSecondary + ' ' + themeClasses.textPrimary : 'bg-gray-50 text-gray-800'} hover:bg-red-50 hover:text-red-600`}
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
                    className="block w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 text-center"
                  >
                    {t.buttons.login}
                  </Link>
                  <Link 
                    to="/signup" 
                    onClick={closeMobileMenu}
                    className={`block w-full ${isDarkMode ? themeClasses.bgSecondary + ' ' + themeClasses.textPrimary : 'bg-gray-50 text-gray-800'} px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 hover:bg-emerald-50 hover:text-emerald-600 text-center`}
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
