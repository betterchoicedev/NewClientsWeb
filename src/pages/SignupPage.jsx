import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { signUp, createClientRecord, generateUniqueUserCode, checkEmailExists, signInWithGoogle } from '../supabase/auth';

function SignupPage() {
  const { language, direction, t, isTransitioning, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { isDarkMode, toggleTheme, themeClasses } = useTheme();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
    newsletter: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [socialLoading, setSocialLoading] = useState(false);
  const [dietitianId, setDietitianId] = useState(null);

  // Function to get dietitian ID from URL hash
  const getDietitianIdFromHash = () => {
    try {
      // Get the hash fragment (e.g., "#d=YWJjZGVmZ2hpams=")
      const hash = window.location.hash;
      
      if (!hash || hash.length === 0) {
        return null;
      }
      
      // Extract the 'd' parameter value using regex
      const match = hash.match(/[#&]d=([^&]*)/);
      
      if (match && match[1]) {
        const base64Value = match[1];
        
        try {
          // Decode from Base64 to get the original dietitian ID (UUID)
          const decodedId = atob(base64Value);
          
          // Validate it looks like a UUID (basic check)
          if (decodedId && decodedId.length > 0) {
            return decodedId;
          }
          return null;
        } catch (decodeError) {
          console.error('Error decoding Base64:', decodeError);
          return null;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting dietitian ID from hash:', error);
      return null;
    }
  };

  // Extract dietitian ID from URL hash on component mount and on hash changes
  useEffect(() => {
    const extractAndStoreDietitianId = () => {
      const id = getDietitianIdFromHash();
      if (id) {
        setDietitianId(id);
        // Also store in sessionStorage as backup
        sessionStorage.setItem('referral_dietitian_id', id);
      }
    };
    
    // Extract on mount
    extractAndStoreDietitianId();
    
    // Also listen for hash changes (in case hash is added after page load)
    const handleHashChange = () => {
      extractAndStoreDietitianId();
    };
    
    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleGoogleSignUp = async () => {
    setSocialLoading(true);
    setError('');
    try {
      // Store dietitian ID before OAuth redirect (hash will be lost during redirect)
      const id = dietitianId || getDietitianIdFromHash();
      if (id) {
        sessionStorage.setItem('referral_dietitian_id', id);
      }
      const { error } = await signInWithGoogle();
      if (error) {
        setError(language === 'hebrew' 
          ? 'שגיאה בהרשמה עם Google. אנא נסה שוב.' 
          : 'Error signing up with Google. Please try again.');
        setSocialLoading(false);
      }
      // If successful, user will be redirected by OAuth
    } catch (err) {
      console.error('Google sign up error:', err);
      setError(language === 'hebrew' 
        ? 'שגיאה בהרשמה עם Google' 
        : 'Error signing up with Google');
      setSocialLoading(false);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError(language === 'hebrew' ? 'הסיסמאות אינן תואמות' : 'Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    if (formData.password.length < 6) {
      setError(language === 'hebrew' ? 'הסיסמה חייבת להכיל לפחות 6 תווים' : 'Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    // Check if email already exists
    const emailCheck = await checkEmailExists(formData.email);
    if (emailCheck.exists) {
      setError(
        language === 'hebrew'
          ? 'כתובת האימייל כבר קיימת במערכת. אנא השתמש באימייל אחר או התחבר.'
          : 'This email is already registered. Please use a different email or login.'
      );
      setLoading(false);
      return;
    }

    try {
      const userData = {
        email: formData.email,
        newsletter: formData.newsletter
      };

      const { data, error } = await signUp(formData.email, formData.password, userData);
      
      if (error) {
        setError(error.message);
      } else {
        // Create client record in clients table
        if (data?.user?.id) {
          try {
            // Get dietitian ID from state or sessionStorage
            const referralDietitianId = dietitianId || sessionStorage.getItem('referral_dietitian_id');
            
            // Ensure we pass null (not empty string) if no referral ID exists
            const providerId = referralDietitianId && referralDietitianId.trim && referralDietitianId.trim() !== '' ? referralDietitianId.trim() : null;
            
            const clientResult = await createClientRecord(data.user.id, userData, providerId);
            if (clientResult.error) {
              setError(
                language === 'hebrew' 
                  ? 'החשבון נוצר אבל לא ניתן ליצור רשומת לקוח. אנא פנה לתמיכה.' 
                  : 'Account created but failed to create client record. Please contact support.'
              );
              return;
            }
            // Clear stored dietitian ID after successful creation
            if (referralDietitianId) {
              sessionStorage.removeItem('referral_dietitian_id');
              setDietitianId(null);
            }
          } catch (clientError) {
            setError(
              language === 'hebrew' 
                ? 'החשבון נוצר אבל לא ניתן ליצור רשומת לקוח. אנא פנה לתמיכה.' 
                : 'Account created but failed to create client record. Please contact support.'
            );
            return;
          }
        }

        setSuccess(
          language === 'hebrew' 
            ? 'החשבון נוצר בהצלחה! בדוק את האימייל שלך לאישור.' 
            : 'Account created successfully! Please check your email for confirmation.'
        );
        // Clear form
        setFormData({
          email: '',
          password: '',
          confirmPassword: '',
          agreeToTerms: false,
          newsletter: true
        });
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (err) {
      setError(language === 'hebrew' ? 'אירעה שגיאה ביצירת החשבון' : 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${themeClasses.bgPrimary} language-transition language-text-transition`} dir={direction}>
      {/* Header */}
      <header className={`${isDarkMode ? 'bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900' : 'bg-gradient-to-r from-emerald-50 via-green-50 to-amber-50'} shadow-md border-b ${isDarkMode ? 'border-emerald-900/50' : 'border-emerald-100/50'} backdrop-blur-md`}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4 sm:py-6">
            <div className="flex items-center">
              <img src="/favicon.ico" alt="BetterChoice Logo" className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 mr-2 sm:mr-4 rounded-lg shadow-md" />
              <div className="flex flex-col">
                <h1 className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold ${isDarkMode ? 'text-emerald-200' : 'text-emerald-700'} leading-tight`}>BetterChoice</h1>
                <p className={`${isDarkMode ? 'text-emerald-300/80' : 'text-emerald-600/80'} text-xs sm:text-sm font-medium hidden sm:block`}>{t.tagline}</p>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-4">
              <button 
                onClick={toggleTheme}
                className={`${isDarkMode ? 'bg-slate-800/80 text-yellow-400 hover:bg-slate-700/80' : 'bg-white/80 text-gray-600 hover:bg-white'} px-3 sm:px-4 py-2 rounded-full font-medium transition-all duration-300 text-xs sm:text-sm shadow-sm backdrop-blur-md border ${isDarkMode ? 'border-emerald-800/30' : 'border-emerald-200/50'}`}
                title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
              <button 
                onClick={toggleLanguage}
                className={`${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-emerald-500 hover:bg-emerald-600'} text-white px-3 sm:px-4 py-2 rounded-full font-medium transition-all duration-300 text-xs sm:text-sm shadow-md`}
                title={language === 'hebrew' ? 'Switch to English' : 'עבור לעברית'}
              >
                {language === 'hebrew' ? 'EN' : 'עב'}
              </button>
              <Link 
                to="/" 
                className={`${isDarkMode ? 'bg-slate-800/80 text-emerald-200 hover:bg-slate-700/80' : 'bg-white/80 text-emerald-700 hover:bg-white'} px-3 sm:px-4 md:px-6 py-2 rounded-full font-medium transition-colors duration-300 text-xs sm:text-sm shadow-sm backdrop-blur-md border ${isDarkMode ? 'border-emerald-800/30' : 'border-emerald-200/50'}`}
              >
                {language === 'hebrew' ? 'חזרה לבית' : 'Back to Home'}
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className={`flex-1 flex items-center justify-center py-6 sm:py-8 md:py-12 px-4 sm:px-6 lg:px-8 ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900' : 'bg-gradient-to-br from-emerald-50 via-green-50 to-amber-50'}`}>
        <div className="max-w-md w-full space-y-6 sm:space-y-8">
          <div className="text-center">
            <h2 className={`text-2xl sm:text-3xl font-bold ${themeClasses.textPrimary} mb-2`}>
              {language === 'hebrew' ? 'צור חשבון חדש' : 'Create your account'}
            </h2>
            <p className={`${themeClasses.textSecondary} text-sm sm:text-base px-2`}>
              {language === 'hebrew' ? 'הצטרף לקהילה שלנו והתחל את המסע שלך לבריאות טובה יותר' : 'Join our community and start your journey to better health'}
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

                {/* Success Message */}
                {success && (
                  <div className={`${themeClasses.successBg} px-4 py-3 rounded-lg`}>
                    {success}
                  </div>
                )}

                {/* Email */}
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
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-colors duration-300 ${themeClasses.inputBg} ${themeClasses.inputFocus}`}
                    placeholder={language === 'hebrew' ? 'הכנס את כתובת האימייל שלך' : 'Enter your email address'}
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                    {language === 'hebrew' ? 'סיסמה' : 'Password'}
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-colors duration-300 ${themeClasses.inputBg} ${themeClasses.inputFocus}`}
                    placeholder={language === 'hebrew' ? 'צור סיסמה חזקה' : 'Create a strong password'}
                    value={formData.password}
                    onChange={handleInputChange}
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirmPassword" className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                    {language === 'hebrew' ? 'אשר סיסמה' : 'Confirm Password'}
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-colors duration-300 ${themeClasses.inputBg} ${themeClasses.inputFocus}`}
                    placeholder={language === 'hebrew' ? 'אשר את הסיסמה שלך' : 'Confirm your password'}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                  />
                </div>

                {/* Checkboxes */}
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      id="agreeToTerms"
                      name="agreeToTerms"
                      type="checkbox"
                      required
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                      checked={formData.agreeToTerms}
                      onChange={handleInputChange}
                    />
                    <label htmlFor="agreeToTerms" className="mr-2 block text-sm text-gray-700">
                      {language === 'hebrew' ? (
                        <>אני מסכים ל<a href="#" className="text-emerald-600 hover:text-emerald-500">תנאי השימוש</a> ו<a href="#" className="text-emerald-600 hover:text-emerald-500">מדיניות הפרטיות</a></>
                      ) : (
                        <>I agree to the <a href="#" className="text-emerald-600 hover:text-emerald-500">Terms of Service</a> and <a href="#" className="text-emerald-600 hover:text-emerald-500">Privacy Policy</a></>
                      )}
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      id="newsletter"
                      name="newsletter"
                      type="checkbox"
                      className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                      checked={formData.newsletter}
                      onChange={handleInputChange}
                    />
                    <label htmlFor="newsletter" className="mr-2 block text-sm text-gray-700">
                      {language === 'hebrew' ? 'אני רוצה לקבל עדכונים וטיפים בריאותיים באימייל' : 'I want to receive health updates and tips via email'}
                    </label>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading || !formData.agreeToTerms}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {loading ? (
                      language === 'hebrew' ? 'יוצר חשבון...' : 'Creating account...'
                    ) : (
                      t.buttons.signup
                    )}
                  </button>
                </div>

                <div className="text-center">
                  <span className={themeClasses.textSecondary}>
                    {language === 'hebrew' ? 'כבר יש לך חשבון?' : 'Already have an account?'}
                  </span>
                  <Link 
                    to="/login" 
                    className={`font-medium text-emerald-600 hover:text-emerald-500 transition-colors duration-300 ${direction === 'rtl' ? 'mr-2' : 'ml-2'}`}
                  >
                    {t.buttons.login}
                  </Link>
                </div>
              </div>
            </div>
          </form>

          {/* Social Signup */}
          <div className="mt-4 sm:mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className={`w-full border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`} />
              </div>
              <div className="relative flex justify-center text-xs sm:text-sm">
                <span className={`px-3 ${themeClasses.bgCard} ${themeClasses.textSecondary}`}>
                  {language === 'hebrew' ? 'או הירשם באמצעות' : 'Or sign up with'}
                </span>
              </div>
            </div>

            <div className="mt-4 sm:mt-6">
              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={socialLoading}
                className={`w-full inline-flex items-center justify-center gap-2 py-3 px-4 border ${isDarkMode ? 'border-gray-600 bg-gray-700 text-white hover:bg-gray-600' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'} rounded-lg shadow-sm text-sm font-medium transition-all duration-300 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label="Sign up with Google"
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
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={`${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900' : 'bg-gradient-to-br from-emerald-50 via-green-50 to-amber-50'} py-6 sm:py-8`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 md:gap-8 mb-2 md:mb-0 text-center">
              <a 
                href="#privacy" 
                className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-emerald-700 hover:text-emerald-800'} transition-colors duration-300 text-sm`}
              >
                {t.footer.privacy}
              </a>
              <a 
                href="#terms" 
                className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-emerald-700 hover:text-emerald-800'} transition-colors duration-300 text-sm`}
              >
                {t.footer.terms}
              </a>
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

export default SignupPage;
