import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { updatePassword } from '../supabase/auth';
import { supabase } from '../supabase/supabaseClient';

function ResetPasswordPage() {
  const { language, direction, t, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme, themeClasses } = useTheme();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check if user has a valid recovery session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          setValidSession(false);
          setError(language === 'hebrew' 
            ? 'קישור איפוס הסיסמה לא תקין או פג תוקפו. אנא בקש קישור חדש.' 
            : 'Invalid or expired password reset link. Please request a new one.');
        } else {
          setValidSession(true);
        }
      } catch (err) {
        console.error('Session check error:', err);
        setValidSession(false);
        setError(language === 'hebrew' 
          ? 'שגיאה בבדיקת הקישור' 
          : 'Error checking link');
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, [language]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear errors when user types
    setError('');
  };

  const validatePassword = () => {
    if (formData.password.length < 6) {
      setError(language === 'hebrew' 
        ? 'הסיסמה חייבת להכיל לפחות 6 תווים' 
        : 'Password must be at least 6 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError(language === 'hebrew' 
        ? 'הסיסמאות אינן תואמות' 
        : 'Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!validatePassword()) {
      setLoading(false);
      return;
    }

    try {
      const { error } = await updatePassword(formData.password);
      
      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (err) {
      console.error('Password update error:', err);
      setError(language === 'hebrew' 
        ? 'אירעה שגיאה בעדכון הסיסמה' 
        : 'An error occurred while updating password');
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
          
          {checkingSession ? (
            // Loading State
            <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-8 text-center`}>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
              <p className={themeClasses.textSecondary}>
                {language === 'hebrew' ? 'בודק קישור...' : 'Verifying link...'}
              </p>
            </div>
          ) : !validSession ? (
            // Invalid Session State
            <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-8 text-center`}>
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>
                {language === 'hebrew' ? 'קישור לא תקין' : 'Invalid Link'}
              </h2>
              <p className={`${themeClasses.textSecondary} mb-6`}>
                {error}
              </p>
              <Link 
                to="/login"
                className={`inline-block ${themeClasses.btnPrimary} text-white px-6 py-3 rounded-full font-semibold transition-all duration-300`}
              >
                {language === 'hebrew' ? 'חזרה להתחברות' : 'Back to Login'}
              </Link>
            </div>
          ) : success ? (
            // Success State
            <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-8 text-center`}>
              <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                <span className="text-5xl text-white">✓</span>
              </div>
              <h2 className={`text-2xl sm:text-3xl font-bold ${themeClasses.textPrimary} mb-4`}>
                {language === 'hebrew' ? 'הסיסמה עודכנה בהצלחה! 🎉' : 'Password Updated Successfully! 🎉'}
              </h2>
              <p className={`${themeClasses.textSecondary} mb-6`}>
                {language === 'hebrew' 
                  ? 'הסיסמה שלך עודכנה. מעביר אותך לעמוד ההתחברות...' 
                  : 'Your password has been updated. Redirecting you to login...'}
              </p>
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              </div>
            </div>
          ) : (
            // Reset Password Form
            <>
              <div className="text-center">
                <div className="text-6xl mb-4">🔐</div>
                <h2 className={`text-2xl sm:text-3xl font-bold ${themeClasses.textPrimary} mb-2`}>
                  {language === 'hebrew' ? 'צור סיסמה חדשה' : 'Create New Password'}
                </h2>
                <p className={`${themeClasses.textSecondary} text-sm sm:text-base`}>
                  {language === 'hebrew' ? 'הכנס את הסיסמה החדשה שלך למטה' : 'Enter your new password below'}
                </p>
              </div>

              <form className="mt-6 sm:mt-8 space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
                <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-4 sm:p-6 md:p-8`}>
                  <div className="space-y-6">
                    {/* Error Message */}
                    {error && (
                      <div className="px-4 py-3 bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-500 rounded-lg">
                        <p className="text-red-700 text-sm font-medium">{error}</p>
                      </div>
                    )}

                    {/* Password Requirements */}
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-l-4 border-purple-500">
                      <p className={`text-sm ${isDarkMode ? 'text-purple-900' : 'text-purple-900'} font-semibold mb-2`}>
                        {language === 'hebrew' ? '📋 דרישות סיסמה:' : '📋 Password Requirements:'}
                      </p>
                      <ul className={`text-xs ${isDarkMode ? 'text-purple-900' : 'text-purple-900'} space-y-1`}>
                        <li>• {language === 'hebrew' ? 'לפחות 6 תווים' : 'At least 6 characters'}</li>
                        <li>• {language === 'hebrew' ? 'מומלץ: שילוב אותיות, מספרים וסימנים' : 'Recommended: Mix of letters, numbers & symbols'}</li>
                      </ul>
                    </div>

                    <div>
                      <label htmlFor="password" className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                        {language === 'hebrew' ? 'סיסמה חדשה' : 'New Password'}
                      </label>
                      <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        className={`w-full px-4 py-3 ${themeClasses.inputBg} border-2 rounded-xl ${themeClasses.inputFocus} transition-all duration-300`}
                        placeholder={language === 'hebrew' ? 'הכנס סיסמה חדשה' : 'Enter new password'}
                        value={formData.password}
                        onChange={handleInputChange}
                        minLength={6}
                      />
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                        {language === 'hebrew' ? 'אשר סיסמה' : 'Confirm Password'}
                      </label>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        required
                        className={`w-full px-4 py-3 ${themeClasses.inputBg} border-2 rounded-xl ${themeClasses.inputFocus} transition-all duration-300`}
                        placeholder={language === 'hebrew' ? 'הכנס שוב את הסיסמה' : 'Enter password again'}
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        minLength={6}
                      />
                    </div>

                    <div>
                      <button
                        type="submit"
                        disabled={loading}
                        className={`w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-4 rounded-xl font-bold hover:from-purple-600 hover:to-pink-600 focus:outline-none focus:ring-4 focus:ring-purple-300 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg`}
                      >
                        {loading ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {language === 'hebrew' ? 'מעדכן...' : 'Updating...'}
                          </span>
                        ) : (
                          <>
                            {language === 'hebrew' ? '✨ עדכן סיסמה' : '✨ Update Password'}
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-center">
                      <Link 
                        to="/login" 
                        className={`text-sm font-medium text-emerald-600 hover:text-emerald-500 transition-colors duration-300`}
                      >
                        {language === 'hebrew' ? 'חזרה להתחברות' : 'Back to Login'}
                      </Link>
                    </div>
                  </div>
                </div>
              </form>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className={`${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900' : 'bg-gradient-to-br from-emerald-50 via-green-50 to-amber-50'} py-6 sm:py-8`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 md:gap-8 mb-2 md:mb-0 text-center">
              <Link 
                to="/privacy-policy" 
                className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-emerald-700 hover:text-emerald-800'} transition-colors duration-300 text-sm`}
              >
                {t.footer.privacy}
              </Link>
              <Link 
                to="/terms" 
                className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-emerald-700 hover:text-emerald-800'} transition-colors duration-300 text-sm`}
              >
                {t.footer.terms}
              </Link>
            </div>
            <div className={`${isDarkMode ? 'text-gray-400' : 'text-emerald-600/80'} text-center`}>
              <p className="text-xs sm:text-sm">{t.footer.copyright}</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default ResetPasswordPage;

