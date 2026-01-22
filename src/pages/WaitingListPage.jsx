import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

function WaitingListPage() {
  const { language, direction, t, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { isDarkMode, toggleTheme, themeClasses } = useTheme();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    phoneCountryCode: '+972',
    goal: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/profile');
    }
  }, [isAuthenticated, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    // Basic validation
    if (!formData.firstName || !formData.lastName || !formData.email) {
      setError(language === 'hebrew' 
        ? 'אנא מלא את כל השדות הנדרשים' 
        : 'Please fill in all required fields');
      setLoading(false);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError(language === 'hebrew' 
        ? 'כתובת אימייל לא תקינה' 
        : 'Invalid email address');
      setLoading(false);
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';
      const response = await fetch(`${apiUrl}/api/waiting-list/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email.toLowerCase(),
          phone: formData.phone ? `${formData.phoneCountryCode}${formData.phone}` : null,
          goal: formData.goal || null,
          message: formData.message || null
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit waiting list entry');
      }

      setSuccess(true);
      // Clear form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        phoneCountryCode: '+972',
        goal: '',
        message: ''
      });
    } catch (err) {
      console.error('Waiting list submission error:', err);
      setError(
        language === 'hebrew' 
          ? 'אירעה שגיאה בהרשמה לרשימת ההמתנה. אנא נסה שוב.' 
          : 'An error occurred while joining the waiting list. Please try again.'
      );
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
        <div className="max-w-2xl w-full space-y-6 sm:space-y-8">
          <div className="text-center">
            <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold ${themeClasses.textPrimary} mb-2`}>
              {language === 'hebrew' ? 'הצטרף לרשימת ההמתנה' : 'Join the Waiting List'}
            </h2>
            <p className={`${themeClasses.textSecondary} text-sm sm:text-base px-2`}>
              {language === 'hebrew' 
                ? 'אנחנו עובדים קשה כדי להביא לך את החוויה הטובה ביותר. השאר את הפרטים שלך ונודיע לך כשנוכל להתחיל!' 
                : 'We\'re working hard to bring you the best experience. Leave your details and we\'ll notify you when we\'re ready to launch!'}
            </p>
          </div>

          {success ? (
            <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-6 sm:p-8 md:p-10 text-center`}>
              <div className="mb-4">
                <svg className="mx-auto h-16 w-16 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className={`text-xl sm:text-2xl font-bold ${themeClasses.textPrimary} mb-2`}>
                {language === 'hebrew' ? 'תודה שהצטרפת!' : 'Thanks for joining!'}
              </h3>
              <p className={`${themeClasses.textSecondary} mb-6`}>
                {language === 'hebrew' 
                  ? 'נרשמת בהצלחה לרשימת ההמתנה. נשלח לך הודעה ברגע שנוכל להתחיל!' 
                  : 'You\'ve successfully joined the waiting list. We\'ll notify you as soon as we\'re ready to launch!'}
              </p>
              <Link 
                to="/"
                className="inline-block bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all duration-300"
              >
                {language === 'hebrew' ? 'חזרה לדף הבית' : 'Back to Home'}
              </Link>
            </div>
          ) : (
            <form className="mt-6 sm:mt-8 space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
              <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-4 sm:p-6 md:p-8`}>
                <div className="space-y-6">
                  {/* Error Message */}
                  {error && (
                    <div className={`${themeClasses.errorBg} px-4 py-3 rounded-lg`}>
                      {error}
                    </div>
                  )}

                  {/* Name Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                        {language === 'hebrew' ? 'שם פרטי *' : 'First Name *'}
                      </label>
                      <input
                        id="firstName"
                        name="firstName"
                        type="text"
                        required
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-colors duration-300 ${themeClasses.inputBg} ${themeClasses.inputFocus}`}
                        placeholder={language === 'hebrew' ? 'הכנס שם פרטי' : 'Enter first name'}
                        value={formData.firstName}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                        {language === 'hebrew' ? 'שם משפחה *' : 'Last Name *'}
                      </label>
                      <input
                        id="lastName"
                        name="lastName"
                        type="text"
                        required
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-colors duration-300 ${themeClasses.inputBg} ${themeClasses.inputFocus}`}
                        placeholder={language === 'hebrew' ? 'הכנס שם משפחה' : 'Enter last name'}
                        value={formData.lastName}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                      {t.contact.form.email} *
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

                  {/* Phone */}
                  <div>
                    <label htmlFor="phone" className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                      {language === 'hebrew' ? 'טלפון' : 'Phone'} {language === 'hebrew' ? '(אופציונלי)' : '(Optional)'}
                    </label>
                    <div className="flex gap-2">
                      <select
                        name="phoneCountryCode"
                        value={formData.phoneCountryCode}
                        onChange={handleInputChange}
                        className={`px-3 py-3 border rounded-lg focus:ring-2 transition-colors duration-300 ${themeClasses.inputBg} ${themeClasses.inputFocus}`}
                      >
                        <option value="+972">+972 (IL)</option>
                        <option value="+1">+1 (US)</option>
                        <option value="+44">+44 (UK)</option>
                        <option value="+33">+33 (FR)</option>
                        <option value="+49">+49 (DE)</option>
                      </select>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        className={`flex-1 px-4 py-3 border rounded-lg focus:ring-2 transition-colors duration-300 ${themeClasses.inputBg} ${themeClasses.inputFocus}`}
                        placeholder={language === 'hebrew' ? 'מספר טלפון' : 'Phone number'}
                        value={formData.phone}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  {/* Goal */}
                  <div>
                    <label htmlFor="goal" className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                      {language === 'hebrew' ? 'מה המטרה שלך?' : 'What is your goal?'} {language === 'hebrew' ? '(אופציונלי)' : '(Optional)'}
                    </label>
                    <select
                      id="goal"
                      name="goal"
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-colors duration-300 ${themeClasses.inputBg} ${themeClasses.inputFocus}`}
                      value={formData.goal}
                      onChange={handleInputChange}
                    >
                      <option value="">{language === 'hebrew' ? 'בחר מטרה' : 'Select a goal'}</option>
                      <option value="weight_loss">{language === 'hebrew' ? 'ירידה במשקל' : 'Weight Loss'}</option>
                      <option value="weight_gain">{language === 'hebrew' ? 'עלייה במשקל' : 'Weight Gain'}</option>
                      <option value="muscle_gain">{language === 'hebrew' ? 'בניית שרירים' : 'Muscle Gain'}</option>
                      <option value="better_nutrition">{language === 'hebrew' ? 'תזונה טובה יותר' : 'Better Nutrition'}</option>
                      <option value="health_improvement">{language === 'hebrew' ? 'שיפור הבריאות' : 'Health Improvement'}</option>
                      <option value="other">{language === 'hebrew' ? 'אחר' : 'Other'}</option>
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label htmlFor="message" className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>
                      {language === 'hebrew' ? 'הודעה' : 'Message'} {language === 'hebrew' ? '(אופציונלי)' : '(Optional)'}
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={4}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 transition-colors duration-300 ${themeClasses.inputBg} ${themeClasses.inputFocus}`}
                      placeholder={language === 'hebrew' ? 'ספר לנו על עצמך...' : 'Tell us about yourself...'}
                      value={formData.message}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {loading ? (
                        language === 'hebrew' ? 'שולח...' : 'Submitting...'
                      ) : (
                        language === 'hebrew' ? 'הצטרף לרשימת ההמתנה' : 'Join Waiting List'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
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

export default WaitingListPage;

