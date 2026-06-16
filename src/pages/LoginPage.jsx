import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { signInWithGoogle, resetPassword, signIn } from '../supabase/auth';

// --- Framer Motion Variants ---
const fadeUpVariant = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
};

const modalBackdropVariant = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.3 } }
};

const modalContentVariant = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", damping: 25, stiffness: 300 } },
  exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } }
};

function LoginPage() {
  const { language, direction, t, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { isDarkMode, toggleTheme, themeClasses } = useTheme();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [socialLoading, setSocialLoading] = useState(false);
  
  // Forgot Password Modal State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/profile');
    }
  }, [isAuthenticated, navigate]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleGoogleSignIn = async () => {
    setSocialLoading(true);
    setError('');
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setError(language === 'hebrew' 
          ? 'שגיאה בהתחברות עם Google. אנא נסה שוב.' 
          : 'Error signing in with Google. Please try again.');
        setSocialLoading(false);
      }
    } catch (err) {
      console.error('Google sign in error:', err);
      setError(language === 'hebrew' 
        ? 'שגיאה בהתחברות עם Google' 
        : 'Error signing in with Google');
      setSocialLoading(false);
    }
  };

  const handleForgotPasswordClick = (e) => {
    e.preventDefault();
    setShowForgotPassword(true);
    setResetEmail(formData.email); 
    setResetSuccess(false);
    setResetError('');
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError('');
    
    try {
      const { error } = await resetPassword(resetEmail);
      
      if (error) {
        setResetError(language === 'hebrew' 
          ? 'שגיאה בשליחת קישור איפוס סיסמה. אנא נסה שוב.' 
          : 'Error sending password reset link. Please try again.');
      } else {
        setResetSuccess(true);
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setResetError(language === 'hebrew' 
        ? 'אירעה שגיאה. אנא נסה שוב.' 
        : 'An error occurred. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPassword(false);
    // Slight delay to allow unmount animation to finish before clearing state
    setTimeout(() => {
      setResetEmail('');
      setResetSuccess(false);
      setResetError('');
    }, 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: signInError, language: langPref } = await signIn(
        formData.email,
        formData.password
      );

      if (signInError) {
        setError(signInError.message || (language === 'hebrew' ? 'שגיאה בהתחברות' : 'Login failed'));
        setLoading(false);
        return;
      }

      if (!data?.session) {
        setError(language === 'hebrew' ? 'שגיאה בהתחברות' : 'Login failed');
        setLoading(false);
        return;
      }

      const result = { language: langPref };

      // Login successful - sync language preference if available
      if (result.language?.user_language) {
        const languageMap = {
          'en': 'english',
          'he': 'hebrew',
          'english': 'english',
          'hebrew': 'hebrew'
        };
        const webLanguage = languageMap[result.language.user_language.toLowerCase()] || 'english';
        
        if (language !== webLanguage) {
          toggleLanguage();
        }
      }

      navigate('/profile');
    } catch (err) {
      console.error('Login error:', err);
      setError(language === 'hebrew' ? 'אירעה שגיאה בהתחברות' : 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  // Base styling dynamically reacting to theme context
  const glassCardClasses = isDarkMode 
    ? 'bg-slate-900/60 border-slate-700/50 backdrop-blur-xl shadow-2xl shadow-emerald-900/20' 
    : 'bg-white/70 border-white/60 backdrop-blur-xl shadow-2xl shadow-emerald-500/10';

  const glassInputClasses = isDarkMode
    ? 'bg-slate-800/50 border-slate-700 text-white focus:border-emerald-500 focus:bg-slate-800 focus:ring-emerald-500/20'
    : 'bg-white/50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:bg-white focus:ring-emerald-500/20';

  return (
    <div className={`relative min-h-screen flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-[#f4f9f5]'} language-transition language-text-transition overflow-hidden`} dir={direction}>
      
      {/* Ambient Animated Background Orbs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-green-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
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
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={toggleTheme}
                className={`w-10 h-10 flex items-center justify-center rounded-full font-medium transition-colors shadow-sm backdrop-blur-md border ${isDarkMode ? 'bg-slate-800/80 text-yellow-400 hover:bg-slate-700 border-slate-700' : 'bg-white/80 text-gray-600 hover:bg-white border-emerald-100'}`}
              >
                {isDarkMode ? '☀️' : '🌙'}
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={toggleLanguage}
                className={`w-10 h-10 flex items-center justify-center rounded-full font-bold transition-colors shadow-sm ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}
              >
                {language === 'hebrew' ? 'EN' : 'עב'}
              </motion.button>
            </div>
          </div>
        </nav>
      </motion.header>

      {/* Main Form Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial="hidden" animate="visible" variants={staggerContainer}
          className="max-w-md w-full"
        >
          <motion.div variants={fadeUpVariant} className="text-center mb-8">
            <h2 className={`text-3xl sm:text-4xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-3 tracking-tight`}>
              {language === 'hebrew' ? 'ברוכים הבאים' : 'Welcome back'}
            </h2>
            <p className={`text-base font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {language === 'hebrew' ? 'התחבר כדי להמשיך לחשבון שלך' : 'Sign in to continue to your account'}
            </p>
          </motion.div>

          <motion.form 
            variants={fadeUpVariant} 
            onSubmit={handleSubmit}
            className={`${glassCardClasses} rounded-[2rem] border p-6 sm:p-8 md:p-10`}
          >
            <div className="space-y-6">
              
              {/* Animated Error Banner */}
              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0, x: [-5, 5, -5, 5, 0] }}
                    exit={{ opacity: 0, height: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium flex items-center mb-6">
                      <svg className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {error}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email Input */}
              <div className="space-y-2 group">
                <label htmlFor="email" className={`block text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  {t.contact.form.email}
                </label>
                <div className="relative">
                  <input
                    id="email" name="email" type="email" autoComplete="email" required
                    className={`w-full px-4 py-3.5 border rounded-xl outline-none focus:ring-4 transition-all duration-300 ${glassInputClasses}`}
                    placeholder={language === 'hebrew' ? 'name@example.com' : 'name@example.com'}
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2 group">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className={`block text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    {language === 'hebrew' ? 'סיסמה' : 'Password'}
                  </label>
                  <button 
                    type="button" onClick={handleForgotPasswordClick}
                    className="text-sm font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                  >
                    {language === 'hebrew' ? 'שכחת סיסמה?' : 'Forgot password?'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password" name="password" type="password" autoComplete="current-password" required
                    className={`w-full px-4 py-3.5 border rounded-xl outline-none focus:ring-4 transition-all duration-300 ${glassInputClasses}`}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {/* Primary Submit Button */}
              <motion.button
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                type="submit"
                disabled={loading}
                className="w-full relative group overflow-hidden bg-gradient-to-r from-emerald-500 to-green-600 text-white py-4 px-4 rounded-xl font-bold shadow-lg shadow-emerald-500/25 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                {loading ? (
                   <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-3 rtl:ml-3 rtl:mr-0 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {language === 'hebrew' ? 'מתחבר...' : 'Signing in...'}
                  </span>
                ) : (
                  t.buttons.login
                )}
              </motion.button>

              <div className="text-center pt-2">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {language === 'hebrew' ? 'אין לך חשבון?' : "Don't have an account?"}
                </span>
                <Link 
                  to="/signup" 
                  className={`text-sm font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors ${direction === 'rtl' ? 'mr-2' : 'ml-2'}`}
                >
                  {t.buttons.signup}
                </Link>
              </div>
            </div>

            {/* Social Login Divider */}
            <div className="mt-8 relative">
              <div className="absolute inset-0 flex items-center">
                <div className={`w-full border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`} />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className={`px-4 font-medium ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-500'} rounded-full border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                  {language === 'hebrew' ? 'או התחבר באמצעות' : 'Or continue with'}
                </span>
              </div>
            </div>

            {/* Google OAuth Button */}
            <div className="mt-8">
              <motion.button
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                type="button"
                onClick={handleGoogleSignIn}
                disabled={socialLoading}
                className={`w-full flex items-center justify-center gap-3 py-3.5 px-4 border rounded-xl font-bold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-70 disabled:cursor-not-allowed ${
                  isDarkMode 
                    ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700 hover:border-slate-600' 
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {socialLoading ? (
                  <svg className="animate-spin h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Google</span>
                  </>
                )}
              </motion.button>
            </div>
          </motion.form>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className={`relative z-10 py-6 border-t ${isDarkMode ? 'border-slate-800/50 bg-slate-900/30' : 'border-emerald-100/50 bg-white/30'} backdrop-blur-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex gap-6 text-sm font-medium">
              <a href="#privacy" className={`${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'} transition-colors`}>{t.footer.privacy}</a>
              <a href="#terms" className={`${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'} transition-colors`}>{t.footer.terms}</a>
            </div>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
              {t.footer.copyright}
            </p>
          </div>
        </div>
      </footer>

      {/* Forgot Password Modal (AnimatePresence) */}
      <AnimatePresence>
        {showForgotPassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
            {/* Modal Backdrop */}
            <motion.div 
              variants={modalBackdropVariant} initial="hidden" animate="visible" exit="exit"
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={closeForgotPasswordModal}
            />

            {/* Modal Body */}
            <motion.div 
              variants={modalContentVariant} initial="hidden" animate="visible" exit="exit"
              className={`relative w-full max-w-lg overflow-hidden rounded-[2rem] border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-white'}`}
            >
              <div className="relative px-6 py-8 sm:px-10 sm:py-10">
                
                {/* Close Button */}
                <button 
                  onClick={closeForgotPasswordModal}
                  className="absolute top-6 right-6 rtl:left-6 rtl:right-auto text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <AnimatePresence mode="wait">
                  {!resetSuccess ? (
                    <motion.form 
                      key="reset-form"
                      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }}
                      onSubmit={handleResetPassword}
                    >
                      <div className="mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/50 dark:to-green-900/50 rounded-2xl flex items-center justify-center mb-6">
                           <span className="text-3xl">🔐</span>
                        </div>
                        <h3 className={`text-2xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-2`}>
                          {language === 'hebrew' ? 'איפוס סיסמה' : 'Reset Password'}
                        </h3>
                        <p className={`text-base ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          {language === 'hebrew' 
                            ? 'הכנס את כתובת האימייל שלך ונשלח לך קישור מאובטח לאיפוס הסיסמה.' 
                            : "Enter your email address and we'll send you a secure link to reset your password."}
                        </p>
                      </div>

                      <div className="mb-6 space-y-2">
                        <label htmlFor="reset-email" className={`block text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                          {language === 'hebrew' ? 'כתובת אימייל' : 'Email Address'}
                        </label>
                        <input
                          id="reset-email" name="reset-email" type="email" required
                          className={`w-full px-4 py-3.5 border rounded-xl outline-none focus:ring-4 transition-all duration-300 ${glassInputClasses}`}
                          placeholder={language === 'hebrew' ? 'הכנס את האימייל שלך' : 'Enter your email'}
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                        />
                      </div>

                      <AnimatePresence>
                        {resetError && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            className="mb-6 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium"
                          >
                            {resetError}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex gap-4">
                        <motion.button
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          type="submit" disabled={resetLoading}
                          className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white py-3.5 px-6 rounded-xl font-bold shadow-lg shadow-emerald-500/25 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          {resetLoading ? (
                            <span className="flex items-center justify-center">
                              <svg className="animate-spin h-5 w-5 mr-2 rtl:ml-2 rtl:mr-0 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              {language === 'hebrew' ? 'שולח...' : 'Sending...'}
                            </span>
                          ) : (
                            language === 'hebrew' ? 'שלח קישור' : 'Send Link'
                          )}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          type="button" onClick={closeForgotPasswordModal}
                          className={`flex-1 py-3.5 px-6 rounded-xl font-bold border transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                        >
                          {language === 'hebrew' ? 'ביטול' : 'Cancel'}
                        </motion.button>
                      </div>
                    </motion.form>
                  ) : (
                    <motion.div 
                      key="success-state"
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", damping: 20, stiffness: 300 }}
                      className="text-center py-6"
                    >
                      <motion.div 
                        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                        className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-500/30"
                      >
                        <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </motion.div>
                      <h4 className={`text-2xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'} mb-3`}>
                        {language === 'hebrew' ? 'נשלח בהצלחה!' : 'Email Sent Successfully!'}
                      </h4>
                      <p className={`text-base ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} mb-8 max-w-sm mx-auto`}>
                        {language === 'hebrew' 
                          ? 'בדוק את תיבת המייל שלך (ואת תיקיית הספאם). קישור האיפוס יפוג בעוד שעה.' 
                          : "Check your inbox (and spam folder). The reset link will expire in 1 hour."}
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        type="button" onClick={closeForgotPasswordModal}
                        className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-3.5 px-6 rounded-xl font-bold shadow-lg shadow-emerald-500/25 focus:outline-none transition-all"
                      >
                        {language === 'hebrew' ? 'הבנתי, תודה!' : 'Got it, thanks!'}
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LoginPage;