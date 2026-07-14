import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useStripe } from '../context/StripeContext';
import PricingCard from '../components/PricingCard';
import { getAllProducts, getProductsByCategory } from '../config/stripe-products';

const PricingPage = () => {
  const { language, direction } = useLanguage();
  const { themeClasses } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const { getCustomerSubscriptions, error } = useStripe();
  
  const [activeTab, setActiveTab] = useState('all');
  const [userSubscriptions, setUserSubscriptions] = useState([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);

  const allProducts = getAllProducts();
  
  // Get products by category
  const premiumProducts = getProductsByCategory('premium');
  const completeProducts = getProductsByCategory('complete');
  const nutritionProducts = getProductsByCategory('nutrition');
  const contentProducts = getProductsByCategory('content');
  const consultationProducts = getProductsByCategory('consultation');

  // Fetch user's current subscriptions
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchUserSubscriptions();
    }
  }, [isAuthenticated, user]);

  const fetchUserSubscriptions = async () => {
    try {
      setLoadingSubscriptions(true);
      const subscriptions = await getCustomerSubscriptions(user.id);
      setUserSubscriptions(subscriptions || []);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      setUserSubscriptions([]);
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  const hasActiveSubscription = (productId) => {
    return userSubscriptions.some(sub => 
      sub.status === 'active' && 
      sub.items?.data?.some(item => item.price.product === productId)
    );
  };

  const getFilteredProducts = () => {
    switch (activeTab) {
      case 'premium':
        return premiumProducts;
      case 'complete':
        return completeProducts;
      case 'nutrition':
        return nutritionProducts;
      case 'content':
        return contentProducts;
      case 'consultation':
        return consultationProducts;
      default:
        return allProducts;
    }
  };

  const tabs = [
    { id: 'all', label: language === 'hebrew' ? 'הכל' : 'All Plans', count: allProducts.length },
    { id: 'premium', label: language === 'hebrew' ? 'פרימיום' : 'Premium', count: premiumProducts.length },
    { id: 'complete', label: language === 'hebrew' ? 'מלא' : 'Complete', count: completeProducts.length },
    { id: 'nutrition', label: language === 'hebrew' ? 'תזונה' : 'Nutrition', count: nutritionProducts.length },
    { id: 'content', label: language === 'hebrew' ? 'תוכן' : 'Content', count: contentProducts.length },
    { id: 'consultation', label: language === 'hebrew' ? 'יעוץ' : 'Consultation', count: consultationProducts.length },
  ].filter(tab => tab.count > 0);

  const filteredProducts = getFilteredProducts();

  return (
    <div className={`min-h-screen ${themeClasses.background} ${themeClasses.text}`} dir={direction}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {language === 'hebrew' ? 'בחר את התוכנית המתאימה לך' : 'Choose Your Perfect Plan'}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
            {language === 'hebrew' 
              ? 'השג את היעדים התזונתיים שלך עם המומחים שלנו. תוכניות מותאמות אישית לכל צורך ותקציב.'
              : 'Achieve your nutrition goals with our expert team. Personalized plans for every need and budget.'
            }
          </p>
        </div>

        {/* Current Subscriptions Alert */}
        {isAuthenticated && userSubscriptions.length > 0 && (
          <div className="mb-8 p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="font-semibold text-green-800 dark:text-green-300 text-lg">
                  {language === 'hebrew' ? 'המנויים הפעילים שלך' : 'Your Active Subscriptions'}
                </h3>
                <div className="mt-2 space-y-1">
                  {userSubscriptions
                    .filter(sub => sub.status === 'active')
                    .map((sub, index) => (
                      <div key={index} className="flex items-center text-green-700 dark:text-green-400">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">
                          {sub.items?.data?.[0]?.price?.nickname || 'Active Plan'}
                        </span>
                        <span className="ml-2 text-sm opacity-75">
                          - {language === 'hebrew' ? 'מתחדש ב' : 'Renews'} {new Date(sub.current_period_end * 1000).toLocaleDateString()}
                        </span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Category Tabs */}
        {tabs.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-6 py-3 rounded-full font-medium transition-all duration-200 transform hover:scale-105
                  ${activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                  }
                `}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                    activeTab === tab.id 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {filteredProducts.map((product) => (
            <div key={product.id} className="relative">
              {/* Active Badge */}
              {hasActiveSubscription(product.id) && (
                <div className="absolute -top-3 -right-3 z-20">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {language === 'hebrew' ? 'פעיל' : 'Active'}
                  </span>
                </div>
              )}
              
              <PricingCard
                product={product}
                className={hasActiveSubscription(product.id) ? 'opacity-75' : ''}
              />
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-14 h-14 mx-auto mb-4 text-gray-400 dark:text-gray-500 opacity-60" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {language === 'hebrew' ? 'לא נמצאו תוכניות' : 'No Plans Found'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {language === 'hebrew' 
                ? 'נסה לבחור קטגוריה אחרת או חזור לכל התוכניות'
                : 'Try selecting a different category or return to all plans'
              }
            </p>
          </div>
        )}

        {/* FAQ Section */}
        <div className="mt-20 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            {language === 'hebrew' ? 'שאלות נפוצות' : 'Frequently Asked Questions'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                q: language === 'hebrew' ? 'האם אוכל לבטל בכל עת?' : 'Can I cancel anytime?',
                a: language === 'hebrew' 
                  ? 'כן, אתה יכול לבטל את המנוי שלך בכל עת ללא עמלות נוספות. הגישה תימשך עד סוף התקופה ששולמה.'
                  : 'Yes, you can cancel your subscription at any time with no additional fees. Access continues until the end of your paid period.'
              },
              {
                q: language === 'hebrew' ? 'איך מתבצע התשלום?' : 'How does billing work?',
                a: language === 'hebrew' 
                  ? 'התשלום מתבצע באופן אוטומטי בכל חודש או בהתאם לתוכנית שבחרת. נשלח לך קבלה בדואל לאחר כל תשלום.'
                  : 'Billing is automatic monthly or according to your chosen plan. You\'ll receive an email receipt after each payment.'
              },
              {
                q: language === 'hebrew' ? 'מה כלול בתוכנית?' : 'What\'s included in each plan?',
                a: language === 'hebrew' 
                  ? 'כל תוכנית כוללת גישה לפיצ\'רים הרשומים בה. אתה יכול לשדרג או לשנות תוכנית בכל עת.'
                  : 'Each plan includes access to the features listed. You can upgrade or change plans at any time.'
              },
              {
                q: language === 'hebrew' ? 'יש תמיכה טכנית?' : 'Is technical support available?',
                a: language === 'hebrew' 
                  ? 'כן, יש לנו צוות תמיכה זמין 24/7 דרך דואל, צ\'אט ואפילו וידאו קול לפי הצורך.'
                  : 'Yes, we have a support team available 24/7 via email, chat, and even video calls when needed.'
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">
                  {faq.q}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Support */}
        <div className="mt-12 text-center bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-8">
          <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            {language === 'hebrew' ? 'צריך עזרה בבחירת התוכנית?' : 'Need Help Choosing a Plan?'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
            {language === 'hebrew' 
              ? 'הצוות שלנו כאן כדי לעזור לך למצוא את התוכנית המושלמת לצרכים שלך. צור קשר וקבל ייעוץ מותאם אישית.'
              : 'Our team is here to help you find the perfect plan for your needs. Get in touch for personalized recommendations.'
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="mailto:info@betterchoice.live" 
              className="inline-flex items-center px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              {language === 'hebrew' ? 'שלח דואל' : 'Send Email'}
            </a>
            <a 
              href="tel:+972-50-123-4567" 
              className="inline-flex items-center px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-lg transition-colors duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              {language === 'hebrew' ? 'התקשר עכשיו' : 'Call Now'}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
