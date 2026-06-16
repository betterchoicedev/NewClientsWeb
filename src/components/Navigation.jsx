import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { signOut } from '../supabase/auth';
import { motion, AnimatePresence } from 'framer-motion';

function Navigation() {
  // Preserve all original context hooks and state logic[cite: 2]
  const { language, direction, toggleLanguage, t } = useLanguage();
  const { user, isAuthenticated, userDisplayName, loading } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Listen for tour events to open/close mobile menu[cite: 2]
  useEffect(() => {
    const handleOpenMobileMenu = () => setMobileMenuOpen(true);
    const handleCloseMobileMenu = () => setMobileMenuOpen(false);

    window.addEventListener('openMobileMenu', handleOpenMobileMenu);
    window.addEventListener('closeMobileMenu', handleCloseMobileMenu);

    return () => {
      window.removeEventListener('openMobileMenu', handleOpenMobileMenu);
      window.removeEventListener('closeMobileMenu', handleCloseMobileMenu);
    };
  }, []);

  // Preserve logout functionality via Supabase[cite: 2]
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

  // Preserve active path calculation[cite: 2]
  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  // Shared generic styles to keep the JSX clean
  const navLinkBase = "px-4 py-2.5 rounded-full font-bold text-sm transition-all duration-300";
  const mobileLinkBase = "block px-4 py-3.5 rounded-xl font-bold text-sm transition-all duration-300";

  return (
    <header className={`sticky top-0 z-50 transition-colors duration-300 backdrop-blur-lg border-b ${isDarkMode ? 'bg-[#0f172a]/90 border-slate-800 shadow-slate-900/20' : 'bg-white/90 border-slate-200 shadow-sm'}`}>
      <nav data-tour="nav" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo Section */}
          <Link to="/" onClick={closeMobileMenu} className="flex items-center gap-3 group">
            <div className={`relative flex items-center justify-center w-11 h-11 rounded-xl shadow-md overflow-hidden transition-transform group-hover:scale-105 ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-100'}`}>
              <img src="/favicon.ico" alt="BetterChoice Logo" className="w-8 h-8 object-contain" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-teal-500">
                BetterChoice
              </h1>
              <p className={`text-[10px] sm:text-xs font-semibold tracking-wide hidden sm:block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {t.tagline}
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div data-tour="nav-links" className="hidden lg:flex items-center gap-2">
            {[
              { path: '/', label: language === 'hebrew' ? 'בית' : 'Home', tour: 'nav-home' },
              { path: '/knowledge', label: language === 'hebrew' ? 'ידע והשראה' : 'Knowledge & Inspiration', tour: 'nav-knowledge' },
              { path: '/recipes', label: language === 'hebrew' ? 'מתכונים' : 'Recipes', tour: 'nav-recipes' },
              { path: '/about', label: language === 'hebrew' ? 'אודות' : t.nav.about, tour: 'nav-about' }
            ].map((link) => (
              <Link 
                key={link.path}
                to={link.path} 
                data-tour={link.tour}
                className={`${navLinkBase} ${
                  isActive(link.path) 
                    ? isDarkMode 
                      ? 'bg-emerald-500/15 text-emerald-400' 
                      : 'bg-emerald-50 text-emerald-600'
                    : isDarkMode 
                      ? 'text-slate-300 hover:text-white hover:bg-slate-800' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right Side Controls (Desktop) */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              data-tour="theme-toggle"
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'} shadow-sm`}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? (
                <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd"/>
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
                </svg>
              )}
            </button>

            {/* Language Toggle */}
            <button 
              onClick={toggleLanguage}
              data-tour="language-toggle"
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 font-bold text-xs shadow-sm border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100'}`}
            >
              {language === 'hebrew' ? 'EN' : 'ע'}
            </button>
            
            {/* Separator */}
            <div className={`w-px h-6 mx-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
            
            {loading ? (
              <div className={`px-4 py-2 rounded-full font-bold text-sm animate-pulse ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {language === 'hebrew' ? 'טוען...' : 'Loading...'}
              </div>
            ) : isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link 
                  to="/profile"
                  data-tour="profile-button"
                  className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all duration-300 border shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:border-emerald-500/50' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-emerald-500/30'}`}
                  title={language === 'hebrew' ? 'פרופיל' : 'Profile'}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-white text-[10px]">
                    {userDisplayName?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <span className="max-w-[100px] truncate">{userDisplayName}</span>
                </Link>
                
                <button 
                  onClick={handleLogout}
                  className={`px-4 py-2 rounded-full font-bold text-sm transition-all duration-300 ${isDarkMode ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-500 hover:text-red-600 hover:bg-red-50'}`}
                >
                  {language === 'hebrew' ? 'התנתק' : 'Logout'}
                </button>
              </div>
            ) : (
              <div data-tour="auth-buttons" className="flex items-center gap-3">
                <Link to="/login" className={`font-bold text-sm transition-colors px-2 ${isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                  {t.buttons.login}
                </Link>
                <Link to="/signup" className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-5 py-2 rounded-full font-bold text-sm transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                  {t.buttons.signup}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Controls & Hamburger */}
          <div className="flex lg:hidden items-center gap-2">
            <button 
              onClick={toggleTheme}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'} shadow-sm`}
            >
              {isDarkMode ? (
                <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd"/></svg>
              ) : (
                <svg className="w-4 h-4 text-slate-700" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>
              )}
            </button>
            
            <button 
              onClick={toggleLanguage}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 font-bold text-xs shadow-sm border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}
            >
              {language === 'hebrew' ? 'EN' : 'ע'}
            </button>
            
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-tour="mobile-menu-button"
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'} shadow-sm ml-1`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className={`lg:hidden overflow-hidden border-t ${isDarkMode ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-100'} shadow-2xl`}
          >
            <div className="px-4 py-6 flex flex-col gap-2">
              {/* Navigation Links */}
              {[
                { path: '/', label: language === 'hebrew' ? 'בית' : 'Home' },
                { path: '/knowledge', label: language === 'hebrew' ? 'ידע והשראה' : 'Knowledge & Inspiration' },
                { path: '/recipes', label: language === 'hebrew' ? 'מתכונים' : 'Recipes' },
                { path: '/about', label: language === 'hebrew' ? 'אודות' : t.nav.about }
              ].map((link) => (
                <Link 
                  key={link.path}
                  to={link.path} 
                  onClick={closeMobileMenu}
                  className={`${mobileLinkBase} ${
                    isActive(link.path) 
                      ? isDarkMode ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                      : isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              <div className={`h-px w-full my-4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}></div>

              {/* User Section */}
              {loading ? (
                <div className={`px-4 py-3 text-center text-sm font-bold animate-pulse ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {language === 'hebrew' ? 'טוען...' : 'Loading...'}
                </div>
              ) : isAuthenticated ? (
                <div className="flex flex-col gap-3">
                  <div className={`px-4 py-4 rounded-2xl flex items-center justify-center gap-3 border ${isDarkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                      {userDisplayName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {language === 'hebrew' ? `שלום, ${userDisplayName}` : `Hello, ${userDisplayName}`}
                    </span>
                  </div>
                  
                  <Link 
                    to="/profile"
                    onClick={closeMobileMenu}
                    className={`block px-4 py-3.5 rounded-xl font-bold text-sm text-center transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  >
                    {language === 'hebrew' ? 'הפרופיל שלי' : 'My Profile'}
                  </Link>
                  
                  <button 
                    onClick={handleLogout}
                    className={`w-full px-4 py-3.5 rounded-xl font-bold text-sm transition-colors text-center ${isDarkMode ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                  >
                    {language === 'hebrew' ? 'התנתק' : 'Logout'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Link 
                    to="/login" 
                    onClick={closeMobileMenu}
                    className={`block w-full px-4 py-3.5 rounded-xl font-bold text-sm text-center transition-colors ${isDarkMode ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50'}`}
                  >
                    {t.buttons.login}
                  </Link>
                  <Link 
                    to="/signup" 
                    onClick={closeMobileMenu}
                    className="block w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-3.5 rounded-xl font-bold text-sm text-center shadow-md"
                  >
                    {t.buttons.signup}
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default Navigation;