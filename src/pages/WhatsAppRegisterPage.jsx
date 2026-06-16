import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { signUp, createClientRecord, checkEmailExists, checkPhoneExists, normalizePhoneForDatabase } from '../supabase/auth';

function WhatsAppRegisterPage() {
  const { language, direction, t, isTransitioning, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const { phoneNumber } = useParams();
  const { isAuthenticated } = useAuth();
  const { isDarkMode, toggleTheme, themeClasses } = useTheme();
  
  // State for form data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  });
  
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Helper function to clean phone number (only keeps numbers and optional leading +)
  const cleanPhoneNumber = (phone) => {
    if (!phone) return '';
    // First normalize phone number (remove spaces, dashes, etc.)
    let normalized = normalizePhoneForDatabase(phone);
    // Strip all non-numeric characters except leading +
    const cleaned = normalized.replace(/[^\d+]/g, '');
    // Ensure + is only at the start if present
    const hasLeadingPlus = cleaned.startsWith('+');
    const digitsOnly = hasLeadingPlus ? cleaned.substring(1) : cleaned;
    // Remove any + characters that aren't at the start
    const cleanDigits = digitsOnly.replace(/\+/g, '');
    // Reconstruct with + only at the start if it was there originally
    return hasLeadingPlus ? `+${cleanDigits}` : cleanDigits;
  };

  // Helper function to validate phone number (only accepts numbers)
  const validatePhoneNumber = (phone) => {
    if (!phone) return false;
    // Clean the phone number first (removes all non-numeric except leading +)
    const cleaned = cleanPhoneNumber(phone);
    // Validate: must have optional + followed by 10-15 digits
    const phoneRegex = /^\+?\d{10,15}$/;
    return phoneRegex.test(cleaned);
  };

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Extract and validate phone number from URL
  useEffect(() => {
    if (phoneNumber) {
      // Decode URL-encoded characters
      const decodedPhone = decodeURIComponent(phoneNumber);
      
      // Check if the parameter contains any numbers - if not, redirect to home
      if (!/\d/.test(decodedPhone)) {
        navigate('/');
        return;
      }
      
      // Clean and validate phone number (only accepts numbers)
      if (validatePhoneNumber(decodedPhone)) {
        // Store the cleaned phone number (only numbers, with optional leading +)
        const cleanedPhone = cleanPhoneNumber(decodedPhone);
        setPhone(cleanedPhone);
        setPhoneError('');
      } else {
        setPhoneError(
          language === 'hebrew' 
            ? 'מספר הטלפון מה-WhatsApp אינו תקין. אנא פנה לתמיכה.' 
            : 'Invalid phone number from WhatsApp. Please contact support.'
        );
      }
    } else {
      // No phone number parameter - redirect to home
      navigate('/');
    }
  }, [phoneNumber, language, navigate]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validate phone number exists
    if (!phone) {
      setError(
        language === 'hebrew' 
          ? 'מספר טלפון לא זמין. אנא השתמש בקישור הנכון מה-WhatsApp.' 
          : 'Phone number not available. Please use the correct link from WhatsApp.'
      );
      setLoading(false);
      return;
    }

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

    // Check if email already exists in both databases
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

    // Normalize phone number (remove spaces and dashes) for database operations
    const normalizedPhone = normalizePhoneForDatabase(phone);

    // Check if phone number already exists in both databases (using normalized version)
    const phoneCheck = await checkPhoneExists(normalizedPhone);
    if (phoneCheck.exists) {
      setError(
        language === 'hebrew'
          ? 'מספר הטלפון כבר קיים במערכת. אנא השתמש במספר אחר או התחבר.'
          : 'This phone number is already registered. Please use a different number or login.'
      );
      setLoading(false);
      return;
    }

    try {
      const userData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: normalizedPhone, // Store normalized version (without spaces/dashes)
        newsletter: false, // Default to false for WhatsApp registrations
        platform: 'whatsapp' // Mark as WhatsApp registration
      };

      const { data, error } = await signUp(formData.email, formData.password, userData);
      
      if (error) {
        setError(error.message);
      } else {
        // Create client record in clients table
        if (data?.user?.id) {
          try {
            const clientResult = await createClientRecord(data.user.id, userData);
            
            if (clientResult.error) {
              setError(
                language === 'hebrew' 
                  ? 'החשבון נוצר אבל לא ניתן ליצור רשומת לקוח. אנא פנה לתמיכה.' 
                  : 'Account created but failed to create client record. Please contact support.'
              );
              return;
            }
            
            if (clientResult.data && clientResult.chatUserCreated) {
              setSuccess(
                language === 'hebrew' 
                  ? 'החשבון נוצר בהצלחה! בדוק את האימייל שלך לאישור.' 
                  : 'Account created successfully! Please check your email for confirmation.'
              );
            } else if (clientResult.data && !clientResult.chatUserCreated) {
              setError(
                language === 'hebrew' 
                  ? 'החשבון נוצר במסד הנתונים הראשי, אך לא ניתן ליצור רשומה במסד הנתונים השני. אנא פנה לתמיכה.' 
                  : 'Account created in primary database, but failed to create record in secondary database. Please contact support.'
              );
              return;
            } else {
              setError(
                language === 'hebrew' 
                  ? 'לא ניתן ליצור רשומות במסדי הנתונים. אנא פנה לתמיכה.' 
                  : 'Failed to create records in databases. Please contact support.'
              );
              return;
            }
          } catch (clientError) {
            setError(
              language === 'hebrew' 
                ? 'החשבון נוצר אבל לא ניתן ליצור רשומת לקוח. אנא פנה לתמיכה.' 
                : 'Account created but failed to create client record. Please contact support.'
            );
            return;
          }
        } else {
          setError(
            language === 'hebrew' 
              ? 'החשבון נוצר אבל לא התקבל מזהה משתמש. אנא פנה לתמיכה.' 
              : 'Account created but no user ID returned. Please contact support.'
          );
          return;
        }
        
        // Clear form
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          confirmPassword: '',
          agreeToTerms: false
        });
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (err) {
      setError(language === 'hebrew' ? 'אירעה שגיאה ביצירת החשבון' : 'An error occurred during signup');
      console.error('WhatsApp registration error:', err);
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
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-4xl">📱</span>
              <span className="text-4xl">➡️</span>
              <span className="text-4xl">✅</span>
            </div>
            <h2 className={`text-2xl sm:text-3xl font-bold ${themeClasses.textPrimary} mb-2`}>
              {language === 'hebrew' ? 'הרשמה דרך WhatsApp' : 'WhatsApp Registration'}
            </h2>
            <p className={`${themeClasses.textSecondary} text-sm sm:text-base px-2`}>
              {language === 'hebrew' 
                ? 'השלם את ההרשמה עם מספר הטלפון שלך מ-WhatsApp' 
                : 'Complete your registration with your WhatsApp phone number'}
            </p>
          </div>

          <form className="mt-6 sm:mt-8 space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
            <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-4 sm:p-6 md:p-8`}>
              <div className="space-y-6">
                {/* Error Message */}
                {(error || phoneError) && (
                  <div className={`${themeClasses.errorBg} px-4 py-3 rounded-lg`}>
                    {error || phoneError}
                  </div>
                )}

                {/* Success Message */}
                {success && (
                  <div className={`${themeClasses.successBg} px-4 py-3 rounded-lg`}>
                    {success}
                  </div>
                )}

                {/* WhatsApp Phone Number (Read-only) */}
                <div className="relative">
                  <label htmlFor="phone" className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                    {language === 'hebrew' ? 'טלפון (מ-WhatsApp)' : 'Phone (from WhatsApp)'}
                  </label>
                  <div className="relative">
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      readOnly
                      className={`w-full px-4 py-3 ${direction === 'rtl' ? 'pl-12 pr-4' : 'pr-12 pl-4'} border-2 border-emerald-400 bg-emerald-50 rounded-lg text-gray-800 font-semibold cursor-not-allowed shadow-sm`}
                      value={phone}
                    />
                    <div className={`absolute inset-y-0 ${direction === 'rtl' ? 'left-0 pl-3' : 'right-0 pr-3'} flex items-center pointer-events-none`}>
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <p className={`mt-2 text-xs ${themeClasses.textSecondary} flex items-center ${direction === 'rtl' ? 'flex-row-reverse' : ''} gap-1.5`}>
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    <span className="font-medium">
                      {language === 'hebrew' 
                        ? 'מספר אומת מ-WhatsApp' 
                        : 'Verified from WhatsApp'}
                    </span>
                  </p>
                </div>

                {/* Name Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label htmlFor="firstName" className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                      {language === 'hebrew' ? 'שם פרטי' : 'First Name'}
                    </label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      autoComplete="given-name"
                      required
                      autoFocus
                      className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors duration-300 ${themeClasses.bgPrimary} ${themeClasses.textPrimary}`}
                      placeholder={language === 'hebrew' ? 'שם פרטי' : 'First name'}
                      value={formData.firstName}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                      {language === 'hebrew' ? 'שם משפחה' : 'Last Name'}
                    </label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      autoComplete="family-name"
                      required
                      className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors duration-300 ${themeClasses.bgPrimary} ${themeClasses.textPrimary}`}
                      placeholder={language === 'hebrew' ? 'שם משפחה' : 'Last name'}
                      value={formData.lastName}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

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
                    className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors duration-300 ${themeClasses.bgPrimary} ${themeClasses.textPrimary}`}
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
                    className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors duration-300 ${themeClasses.bgPrimary} ${themeClasses.textPrimary}`}
                    placeholder={language === 'hebrew' ? 'צור סיסמה חזקה (לפחות 6 תווים)' : 'Create a strong password (min 6 characters)'}
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
                    className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors duration-300 ${themeClasses.bgPrimary} ${themeClasses.textPrimary}`}
                    placeholder={language === 'hebrew' ? 'אשר את הסיסמה שלך' : 'Confirm your password'}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                  />
                </div>

                {/* Terms Checkbox */}
                <div className={`flex items-center ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
                  <input
                    id="agreeToTerms"
                    name="agreeToTerms"
                    type="checkbox"
                    required
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                    checked={formData.agreeToTerms}
                    onChange={handleInputChange}
                  />
                  <label htmlFor="agreeToTerms" className={`${direction === 'rtl' ? 'mr-2' : 'ml-2'} block text-sm ${themeClasses.textPrimary}`}>
                    {language === 'hebrew' ? (
                      <>אני מסכים ל<Link to="/terms" className="text-emerald-600 hover:text-emerald-500 font-medium">תנאי השימוש</Link> ו<Link to="/privacy-policy" className="text-emerald-600 hover:text-emerald-500 font-medium">מדיניות הפרטיות</Link></>
                    ) : (
                      <>I agree to the <Link to="/terms" className="text-emerald-600 hover:text-emerald-500 font-medium">Terms of Service</Link> and <Link to="/privacy-policy" className="text-emerald-600 hover:text-emerald-500 font-medium">Privacy Policy</Link></>
                    )}
                  </label>
                </div>

                {/* Submit Button */}
                <div>
                  <button
                    type="submit"
                    disabled={loading || !formData.agreeToTerms || !phone || !!phoneError}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {loading ? (
                      language === 'hebrew' ? 'יוצר חשבון...' : 'Creating account...'
                    ) : (
                      language === 'hebrew' ? 'צור חשבון' : 'Create Account'
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

                {/* Alternative Signup Link */}
                <div className={`text-center pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <p className={`text-xs ${themeClasses.textSecondary} mb-2`}>
                    {language === 'hebrew' 
                      ? 'רוצה להירשם ללא WhatsApp?' 
                      : 'Want to register without WhatsApp?'}
                  </p>
                  <Link 
                    to="/signup" 
                    className="text-xs text-emerald-600 hover:text-emerald-500 transition-colors duration-300 font-medium"
                  >
                    {language === 'hebrew' ? 'עבור להרשמה רגילה' : 'Go to regular signup'}
                  </Link>
                </div>
              </div>
            </div>
          </form>
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

export default WhatsAppRegisterPage;

