import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { signIn, signInWithGoogle, signInWithFacebook, resetPassword } from '../supabase/auth';
import { supabase } from '../supabase/supabaseClient';

function LoginPage() {
  const { language, direction, t, isTransitioning, toggleLanguage } = useLanguage();
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
      // If successful, user will be redirected by OAuth
    } catch (err) {
      console.error('Google sign in error:', err);
      setError(language === 'hebrew' 
        ? 'שגיאה בהתחברות עם Google' 
        : 'Error signing in with Google');
      setSocialLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    setSocialLoading(true);
    setError('');
    try {
      const { error } = await signInWithFacebook();
      if (error) {
        setError(language === 'hebrew' 
          ? 'שגיאה בהתחברות עם Facebook. אנא נסה שוב.' 
          : 'Error signing in with Facebook. Please try again.');
        setSocialLoading(false);
      }
      // If successful, user will be redirected by OAuth
    } catch (err) {
      console.error('Facebook sign in error:', err);
      setError(language === 'hebrew' 
        ? 'שגיאה בהתחברות עם Facebook' 
        : 'Error signing in with Facebook');
      setSocialLoading(false);
    }
  };

  const handleForgotPasswordClick = (e) => {
    e.preventDefault();
    setShowForgotPassword(true);
    setResetEmail(formData.email); // Pre-fill with login email if available
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
    setResetEmail('');
    setResetSuccess(false);
    setResetError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await signIn(formData.email, formData.password);
      
      if (error) {
        setError(error.message);
      } else {
        // Login successful - fetch user's language preference and sync
        if (data?.user?.id) {
          try {
            const { data: clientData, error: clientError } = await supabase
              .from('clients')
              .select('user_language')
              .eq('user_id', data.user.id)
              .single();

            if (!clientError && clientData?.user_language) {
              // Map language codes to web language
              const languageMap = {
                'en': 'english',
                'he': 'hebrew',
                'english': 'english',
                'hebrew': 'hebrew'
              };
              
              const webLanguage = languageMap[clientData.user_language.toLowerCase()] || 'english';
              
              // Only change if different from current language
              if (language !== webLanguage) {
                toggleLanguage();
              }
            }
          } catch (langError) {
            console.error('Error fetching language preference:', langError);
            // Continue to navigate even if language fetch fails
          }
        }

        // Navigate to profile page
        navigate('/profile');
      }
    } catch (err) {
      setError(language === 'hebrew' ? 'אירעה שגיאה בהתחברות' : 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${themeClasses.bgPrimary} language-transition language-text-transition`} dir={direction}>
      {/* Header */}
      <header className={`${themeClasses.bgHeader} shadow-lg`}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4 sm:py-6">
            <div className="flex items-center">
              <img src="/favicon.ico" alt="BetterChoice Logo" className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 mr-2 sm:mr-4 rounded-lg shadow-md" />
              <div className="flex flex-col">
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight">BetterChoice</h1>
                <p className="text-emerald-200 text-xs sm:text-sm font-medium hidden sm:block">{t.tagline}</p>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-4">
              <button 
                onClick={toggleTheme}
                className={`${isDarkMode ? 'bg-gray-700 text-yellow-400' : 'bg-white text-gray-600'} px-3 sm:px-4 py-2 rounded-full font-semibold hover:opacity-80 transition-all duration-300 text-xs sm:text-sm`}
                title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
              <button 
                onClick={toggleLanguage}
                className={`${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-600'} px-3 sm:px-4 py-2 rounded-full font-semibold hover:opacity-80 transition-all duration-300 text-xs sm:text-sm`}
                title={language === 'hebrew' ? 'Switch to English' : 'עבור לעברית'}
              >
                {language === 'hebrew' ? 'EN' : 'עב'}
              </button>
              <Link 
                to="/" 
                className="bg-white text-emerald-600 px-3 sm:px-4 md:px-6 py-2 rounded-full font-semibold hover:bg-emerald-50 transition-colors duration-300 text-xs sm:text-sm"
              >
                {language === 'hebrew' ? 'חזרה לבית' : 'Back to Home'}
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center py-6 sm:py-8 md:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 sm:space-y-8">
          <div className="text-center">
            <h2 className={`text-2xl sm:text-3xl font-bold ${themeClasses.textPrimary} mb-2`}>
              {language === 'hebrew' ? 'התחבר לחשבון שלך' : 'Sign in to your account'}
            </h2>
            <p className={`${themeClasses.textSecondary} text-sm sm:text-base`}>
              {language === 'hebrew' ? 'ברוכים הבאים חזרה!' : 'Welcome back!'}
            </p>
          </div>

          <form className="mt-6 sm:mt-8 space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
            <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-4 sm:p-6 md:p-8`}>
              <div className="space-y-6">
                {/* Error Message */}
                {error && (
                  <div className={`${themeClasses.errorBg} px-4 py-3 rounded-lg`}>
                    {error}
                  </div>
                )}
                <div>
                  <label htmlFor="email" className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                    {t.contact.form.email}
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className={`w-full px-4 py-3 ${themeClasses.inputBg} rounded-lg ${themeClasses.inputFocus} transition-colors duration-300`}
                    placeholder={language === 'hebrew' ? 'הכנס את כתובת האימייל שלך' : 'Enter your email address'}
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                </div>

                <div>
                  <label htmlFor="password" className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                    {language === 'hebrew' ? 'סיסמה' : 'Password'}
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className={`w-full px-4 py-3 ${themeClasses.inputBg} rounded-lg ${themeClasses.inputFocus} transition-colors duration-300`}
                    placeholder={language === 'hebrew' ? 'הכנס את הסיסמה שלך' : 'Enter your password'}
                    value={formData.password}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="text-right">
                  <div className="text-sm">
                    <button 
                      type="button"
                      onClick={handleForgotPasswordClick}
                      className="font-medium text-emerald-600 hover:text-emerald-500 transition-colors duration-300"
                    >
                      {language === 'hebrew' ? 'שכחת סיסמה?' : 'Forgot password?'}
                    </button>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full ${themeClasses.btnPrimary} text-white py-3 px-4 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-300 transform hover:-translate-y-1 ${themeClasses.shadowCard} ${themeClasses.shadowHover} disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                  >
                    {loading ? (
                      language === 'hebrew' ? 'מתחבר...' : 'Signing in...'
                    ) : (
                      t.buttons.login
                    )}
                  </button>
                </div>

                <div className="text-center">
                  <span className={themeClasses.textSecondary}>
                    {language === 'hebrew' ? 'אין לך חשבון?' : "Don't have an account?"}
                  </span>
                  <Link 
                    to="/signup" 
                    className={`font-medium text-emerald-600 hover:text-emerald-500 transition-colors duration-300 ${direction === 'rtl' ? 'mr-2' : 'ml-2'}`}
                  >
                    {t.buttons.signup}
                  </Link>
                </div>
              </div>
            </div>
          </form>

          {/* Social Login */}
          <div className="mt-4 sm:mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className={`w-full border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`} />
              </div>
              <div className="relative flex justify-center text-xs sm:text-sm">
                <span className={`px-3 ${themeClasses.bgCard} ${themeClasses.textSecondary}`}>
                  {language === 'hebrew' ? 'או התחבר באמצעות' : 'Or continue with'}
                </span>
              </div>
            </div>

            <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-3 sm:gap-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={socialLoading}
                className={`w-full inline-flex items-center justify-center gap-2 py-3 px-4 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-white hover:bg-gray-600' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'} rounded-lg shadow-sm text-sm font-medium transition-all duration-300 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label="Sign in with Google"
              >
                {socialLoading ? (
                  <svg className="animate-spin h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24">
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
              </button>

              <button
                type="button"
                onClick={handleFacebookSignIn}
                disabled={socialLoading}
                className={`w-full inline-flex items-center justify-center gap-2 py-3 px-4 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-white hover:bg-gray-600' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'} rounded-lg shadow-sm text-sm font-medium transition-all duration-300 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label="Sign in with Facebook"
              >
                {socialLoading ? (
                  <svg className="animate-spin h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <span>Facebook</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 md:gap-8 mb-2 md:mb-0 text-center">
              <a 
                href="#privacy" 
                className="text-gray-300 hover:text-white transition-colors duration-300 text-sm"
              >
                {t.footer.privacy}
              </a>
              <a 
                href="#terms" 
                className="text-gray-300 hover:text-white transition-colors duration-300 text-sm"
              >
                {t.footer.terms}
              </a>
            </div>
            <div className="text-gray-400 text-center">
              <p className="text-xs sm:text-sm">{t.footer.copyright}</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity backdrop-blur-sm" 
              aria-hidden="true"
              onClick={closeForgotPasswordModal}
            ></div>

            {/* Center modal */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            {/* Modal panel */}
            <div className={`inline-block align-bottom ${themeClasses.bgCard} rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full`}>
              {/* Header with Gradient */}
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-8 text-center">
                <div className="text-5xl mb-3">🔐</div>
                <h3 className="text-2xl font-bold text-white mb-2" id="modal-title">
                  {language === 'hebrew' ? 'שכחת סיסמה?' : 'Forgot Password?'}
                </h3>
                <p className="text-purple-100 text-sm">
                  {language === 'hebrew' 
                    ? 'אל דאגה! נשלח לך קישור לאיפוס הסיסמה' 
                    : "No worries! We'll send you a reset link"}
                </p>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-6">
                {!resetSuccess ? (
                  <form onSubmit={handleResetPassword}>
                    <div className="mb-6">
                      <label htmlFor="reset-email" className={`block text-sm font-semibold ${themeClasses.textPrimary} mb-2`}>
                        {language === 'hebrew' ? 'כתובת אימייל' : 'Email Address'}
                      </label>
                      <input
                        id="reset-email"
                        name="reset-email"
                        type="email"
                        required
                        className={`w-full px-4 py-3 ${themeClasses.inputBg} border-2 rounded-xl ${themeClasses.inputFocus} transition-all duration-300`}
                        placeholder={language === 'hebrew' ? 'הכנס את האימייל שלך' : 'Enter your email'}
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                      />
                    </div>

                    {/* Error Message */}
                    {resetError && (
                      <div className="mb-4 px-4 py-3 bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-500 rounded-lg">
                        <p className="text-red-700 text-sm font-medium">{resetError}</p>
                      </div>
                    )}

                    {/* Info Box */}
                    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-l-4 border-purple-500">
                      <p className={`text-sm ${isDarkMode ? 'text-purple-900' : 'text-purple-900'}`}>
                        <strong>💡 {language === 'hebrew' ? 'טיפ:' : 'Tip:'}</strong>{' '}
                        {language === 'hebrew' 
                          ? 'תקבל אימייל עם קישור לאיפוס הסיסמה. הקישור תקף לשעה אחת.' 
                          : "You'll receive an email with a password reset link. The link expires in 1 hour."}
                      </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-bold hover:from-purple-600 hover:to-pink-600 focus:outline-none focus:ring-4 focus:ring-purple-300 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
                      >
                        {resetLoading ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {language === 'hebrew' ? 'שולח...' : 'Sending...'}
                          </span>
                        ) : (
                          <>
                            {language === 'hebrew' ? '✨ שלח קישור לאיפוס' : '✨ Send Reset Link'}
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={closeForgotPasswordModal}
                        className={`flex-1 ${themeClasses.btnSecondary} py-3 px-6 rounded-xl font-semibold transition-all duration-300 hover:scale-105`}
                      >
                        {language === 'hebrew' ? 'ביטול' : 'Cancel'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="text-center">
                    {/* Success State */}
                    <div className="mb-6">
                      <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                        <span className="text-4xl">✓</span>
                      </div>
                      <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-3`}>
                        {language === 'hebrew' ? 'נשלח בהצלחה!' : 'Email Sent Successfully!'}
                      </h4>
                      <p className={`${themeClasses.textSecondary} mb-4`}>
                        {language === 'hebrew' 
                          ? 'שלחנו לך אימייל עם הוראות לאיפוס הסיסמה.' 
                          : "We've sent you an email with password reset instructions."}
                      </p>
                      <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border-l-4 border-yellow-500 mb-6 text-left">
                        <p className={`text-sm ${isDarkMode ? 'text-yellow-900' : 'text-yellow-900'}`}>
                          <strong>📧 {language === 'hebrew' ? 'לא רואה את האימייל?' : "Don't see the email?"}</strong><br />
                          {language === 'hebrew' 
                            ? 'בדוק את תיקיית הספאם או הזבל שלך.' 
                            : 'Check your spam or junk folder.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeForgotPasswordModal}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 px-6 rounded-xl font-bold hover:from-green-600 hover:to-emerald-600 focus:outline-none focus:ring-4 focus:ring-green-300 transition-all duration-300 transform hover:scale-105 shadow-lg"
                    >
                      {language === 'hebrew' ? '✨ מעולה!' : '✨ Got it!'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginPage;
