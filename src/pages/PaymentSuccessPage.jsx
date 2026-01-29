import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useStripe } from '../context/StripeContext';

const PaymentSuccessPage = () => {
  const { language, direction } = useLanguage();
  const { themeClasses } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const { getCheckoutSession } = useStripe();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      setError(language === 'hebrew' ? 'מזהה הפעלה חסר' : 'Missing session ID');
      setLoading(false);
      return;
    }

    fetchSessionData();
  }, [sessionId, language]);

  const fetchSessionData = async () => {
    try {
      setLoading(true);
      const data = await getCheckoutSession(sessionId);
      setSessionData(data);

      // WhatsApp welcome for onboarding upsell is sent once by the server Stripe webhook
      // (customer.subscription.created) — do not send again here to avoid duplicate template.

      // If user isn't authenticated, redirect to login after showing success
      if (!isAuthenticated) {
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              message: language === 'hebrew' 
                ? 'התשלום בוצע בהצלחה! אנא התחבר כדי לגשת לתוכן שלך.'
                : 'Payment successful! Please log in to access your content.'
            } 
          });
        }, 5000);
      }
    } catch (error) {
      console.error('Error fetching session data:', error);
      setError(error.message || (language === 'hebrew' ? 'שגיאה בטעינת נתוני התשלום' : 'Error loading payment data'));
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount, currency = 'USD') => {
    if (!amount) return '';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0
    }).format(amount / 100);
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${themeClasses.background}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {language === 'hebrew' ? 'מאמת תשלום...' : 'Verifying payment...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${themeClasses.background}`}>
        <div className="max-w-md mx-auto text-center px-4">
          <div className="bg-red-100 dark:bg-red-900/20 rounded-full p-4 w-16 h-16 mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
            {language === 'hebrew' ? 'שגיאה' : 'Error'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Link
            to="/pricing"
            className="inline-flex items-center px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors duration-200"
          >
            {language === 'hebrew' ? 'חזור למחירים' : 'Back to Pricing'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen relative overflow-hidden ${themeClasses.background} ${themeClasses.text}`} dir={direction}>
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-10 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-green-400 rounded-full mix-blend-multiply filter blur-xl animate-bounce animation-delay-2000"></div>
          <div className="absolute top-3/4 right-1/4 w-32 h-32 bg-emerald-400 rounded-full mix-blend-multiply filter blur-xl animate-bounce animation-delay-4000"></div>
          <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-teal-400 rounded-full mix-blend-multiply filter blur-xl animate-bounce animation-delay-6000"></div>
        </div>
        
        {/* Floating particles */}
        <div className="absolute inset-0">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-green-400 rounded-full opacity-30 animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Success Animation */}
          <div className="text-center mb-12 animate-fadeInUp">
            <div className="relative mx-auto w-32 h-32 mb-8">
              <div className="absolute inset-0 bg-green-100 dark:bg-green-900/30 rounded-full animate-ping"></div>
              <div className="absolute inset-2 bg-green-200 dark:bg-green-800/50 rounded-full animate-pulse"></div>
              <div className="relative flex items-center justify-center w-32 h-32 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full shadow-2xl shadow-green-500/50">
                <svg className="w-16 h-16 text-white animate-checkmark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              {/* Celebration confetti */}
              <div className="absolute -top-4 -left-4 text-2xl animate-bounce animation-delay-1000">🎊</div>
              <div className="absolute -top-2 -right-6 text-xl animate-bounce animation-delay-2000">✨</div>
              <div className="absolute -bottom-2 -left-6 text-xl animate-bounce animation-delay-3000">🎉</div>
              <div className="absolute -bottom-4 -right-4 text-2xl animate-bounce animation-delay-4000">🌟</div>
            </div>

            <div className="space-y-4 animate-slideInUp animation-delay-500">
              <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 bg-clip-text text-transparent mb-6">
                {language === 'hebrew' ? '🎉 תשלום בוצע בהצלחה!' : '🎉 Payment Successful!'}
              </h1>
              
              <p className="text-2xl md:text-3xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
                {language === 'hebrew' 
                  ? 'תודה לך על הרכישה!' 
                  : 'Thank you for your purchase!'
                }
              </p>
              
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
                {language === 'hebrew' 
                  ? 'קיבלת אישור בדואל עם פרטי ההזמנה והגישה. המסע שלך מתחיל עכשיו!'
                  : 'You\'ve received an email confirmation with order details and access information. Your journey starts now!'
                }
              </p>
            </div>
          </div>

          {/* Payment Details Card */}
          {sessionData && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 mb-8 border border-gray-200/50 dark:border-gray-700/50 animate-fadeInUp animation-delay-1000">
              <div className="flex items-center justify-center mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {language === 'hebrew' ? 'פרטי התשלום' : 'Payment Details'}
                  </h3>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">
                    {language === 'hebrew' ? 'מזהה הזמנה:' : 'Order ID:'}
                  </span>
                  <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {sessionData.id}
                  </span>
                </div>
                
                {sessionData.amount_total && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">
                      {language === 'hebrew' ? 'סכום:' : 'Amount:'}
                    </span>
                    <span className="font-semibold text-lg">
                      {formatAmount(sessionData.amount_total, sessionData.currency)}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">
                    {language === 'hebrew' ? 'סטטוס:' : 'Status:'}
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {language === 'hebrew' ? 'שולם' : 'Paid'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600 dark:text-gray-400">
                    {language === 'hebrew' ? 'תאריך:' : 'Date:'}
                  </span>
                  <span>
                    {new Date().toLocaleDateString(language === 'hebrew' ? 'he-IL' : 'en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* What's Next Section */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-semibold mb-4 text-blue-800 dark:text-blue-300">
              {language === 'hebrew' ? '🚀 מה הלאה?' : '🚀 What\'s Next?'}
            </h3>
            <div className="space-y-3 text-blue-700 dark:text-blue-300">
              <div className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">1</span>
                <div>
                  <p className="font-medium">
                    {language === 'hebrew' ? 'בדוק את הדואל שלך' : 'Check Your Email'}
                  </p>
                  <p className="text-sm opacity-90">
                    {language === 'hebrew' 
                      ? 'קיבלת הוראות גישה ופרטי התחברות'
                      : 'You\'ve received access instructions and login details'
                    }
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">2</span>
                <div>
                  <p className="font-medium">
                    {language === 'hebrew' ? 'השלם את הפרופיל שלך' : 'Complete Your Profile'}
                  </p>
                  <p className="text-sm opacity-90">
                    {language === 'hebrew' 
                      ? 'נתונים נוספים יעזרו לנו להתאים עבורך תוכן מיטבי'
                      : 'Additional information helps us provide optimal content for you'
                    }
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5">3</span>
                <div>
                  <p className="font-medium">
                    {language === 'hebrew' ? 'התחל את המסע שלך' : 'Start Your Journey'}
                  </p>
                  <p className="text-sm opacity-90">
                    {language === 'hebrew' 
                      ? 'גש לתכנים, כלים ותמיכה מקצועית'
                      : 'Access content, tools, and professional support'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid gap-4 md:grid-cols-2 animate-fadeInUp animation-delay-1500">
            {isAuthenticated ? (
              <Link
                to="/profile"
                className="group relative overflow-hidden bg-gradient-to-r from-blue-500 via-purple-600 to-indigo-600 hover:from-blue-600 hover:via-purple-700 hover:to-indigo-700 text-white font-bold py-6 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-2xl hover:shadow-purple-500/25"
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                <div className="relative flex items-center justify-center space-x-2">
                  <span className="text-2xl">👤</span>
                  <span className="text-lg">
                    {language === 'hebrew' ? 'עבור לפרופיל שלך' : 'Go to Your Profile'}
                  </span>
                </div>
              </Link>
            ) : (
              <Link
                to="/login"
                className="group relative overflow-hidden bg-gradient-to-r from-blue-500 via-purple-600 to-indigo-600 hover:from-blue-600 hover:via-purple-700 hover:to-indigo-700 text-white font-bold py-6 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-2xl hover:shadow-purple-500/25"
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                <div className="relative flex items-center justify-center space-x-2">
                  <span className="text-2xl">🔐</span>
                  <span className="text-lg">
                    {language === 'hebrew' ? 'התחבר לחשבון' : 'Log In to Your Account'}
                  </span>
                </div>
              </Link>
            )}
            
            <Link
              to="/"
              className="group relative overflow-hidden bg-white/10 dark:bg-gray-800/50 backdrop-blur-xl border-2 border-gray-300/30 dark:border-gray-600/30 hover:border-gray-400/50 dark:hover:border-gray-500/50 text-gray-700 dark:text-gray-200 font-bold py-6 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-xl"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-gray-200/20 to-gray-300/20 dark:from-gray-700/20 dark:to-gray-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-center justify-center space-x-2">
                <span className="text-2xl">🏠</span>
                <span className="text-lg">
                  {language === 'hebrew' ? 'חזור לדף הבית' : 'Back to Home'}
                </span>
              </div>
            </Link>
          </div>

          {/* Support Section */}
          <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-center">
            <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">
              {language === 'hebrew' ? 'נתקלת בבעיה?' : 'Need Help?'}
            </h4>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
              {language === 'hebrew' 
                ? 'הצוות שלנו זמין לעזרה 24/7'
                : 'Our support team is available 24/7'
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a 
                href="mailto:info@betterchoice.live" 
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 text-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                {language === 'hebrew' ? 'שלח מייל' : 'Email Support'}
              </a>
              <a 
                href="tel:+972-50-123-4567" 
                className="inline-flex items-center justify-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200 text-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                {language === 'hebrew' ? 'התקשר' : 'Call Us'}
              </a>
            </div>
          </div>

          {/* Auto-redirect notice for non-authenticated users */}
          {!isAuthenticated && (
            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-yellow-800 dark:text-yellow-300 text-sm text-center">
                {language === 'hebrew' 
                  ? '⏱️ תועבר אוטומטית לדף ההתחברות בעוד כמה שניות...'
                  : '⏱️ You will be redirected to the login page in a few seconds...'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
