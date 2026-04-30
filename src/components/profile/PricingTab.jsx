import React, { useEffect, useState } from 'react';
import { useStripe } from '../../context/StripeContext';
import { getAllProducts, getProductsByCategory, getProduct } from '../../config/stripe-products';
import PricingCard from '../PricingCard';

const PricingTab = ({ themeClasses, user, language }) => {
  const { getCustomerSubscriptions } = useStripe();
  const [activeCategory, setActiveCategory] = useState('all');
  const [userSubscriptions, setUserSubscriptions] = useState([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [usdExchangeRate, setUsdExchangeRate] = useState(null); // ILS per 1 USD (Bank of Israel)

  const allProducts = getAllProducts();

  // Get products by category
  const premiumProducts = getProductsByCategory('premium');
  const completeProducts = getProductsByCategory('complete');
  const nutritionProducts = getProductsByCategory('nutrition');
  const contentProducts = getProductsByCategory('content');
  const consultationProducts = getProductsByCategory('consultation');

  const [subscriptionsLastFetched, setSubscriptionsLastFetched] = useState(null);

  const fetchUserSubscriptions = async () => {
    try {
      setLoadingSubscriptions(true);
      const subscriptions = await getCustomerSubscriptions(user.id);
      setUserSubscriptions(subscriptions || []);
      setSubscriptionsLastFetched(Date.now()); // Set timestamp when data is fetched
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      setUserSubscriptions([]);
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  // Fetch user's current subscriptions
  useEffect(() => {
    const shouldFetch = user?.id &&
                       userSubscriptions.length === 0 &&
                       !loadingSubscriptions &&
                       (!subscriptionsLastFetched || Date.now() - subscriptionsLastFetched > 300000); // 5 minutes cache

    if (shouldFetch) {
      fetchUserSubscriptions();
    }
  }, [user, userSubscriptions.length, loadingSubscriptions, subscriptionsLastFetched]);

  // Fetch Bank of Israel USD exchange rate when Pricing tab is shown (ILS per 1 USD)
  // Via backend proxy to avoid CORS (boi.org.il does not allow browser cross-origin requests)
  useEffect(() => {
    let cancelled = false;
    const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
    const fetchUsdRate = async () => {
      try {
        const url = apiUrl ? `${apiUrl}/api/exchange-rates` : '/api/exchange-rates';
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled || !data?.exchangeRates) return;
        const usd = data.exchangeRates.find((r) => r.key === 'USD');
        if (usd?.currentExchangeRate) {
          setUsdExchangeRate(usd.currentExchangeRate);
        }
      } catch (err) {
        console.warn('BOI exchange rate fetch failed:', err);
      }
    };
    fetchUsdRate();
    return () => { cancelled = true; };
  }, []);

  // Manual refresh function for subscriptions (call after successful purchase)
  const refreshSubscriptions = async () => {
    setSubscriptionsLastFetched(null); // Reset timestamp to force refresh
    await fetchUserSubscriptions();
  };

  const [cancellingSubscriptionId, setCancellingSubscriptionId] = useState(null);
  const [cancelError, setCancelError] = useState(null);

  const handleCancelPlan = async (subscriptionId) => {
    if (!subscriptionId) return;
    const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
    setCancelError(null);
    setCancellingSubscriptionId(subscriptionId);
    try {
      const res = await fetch(`${apiUrl}/api/stripe/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelAtPeriodEnd: false })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel');
      await refreshSubscriptions();
    } catch (err) {
      setCancelError(err.message || (language === 'hebrew' ? 'שגיאה בביטול המנוי' : 'Error cancelling subscription'));
    } finally {
      setCancellingSubscriptionId(null);
    }
  };

  const hasActiveSubscription = (productId) => {
    return userSubscriptions.some(sub => {
      if (sub.status !== 'active') return false;

      // Check if any item in the subscription matches this product
      return sub.items?.data?.some(item => {
        const itemProductId = item.price?.product;
        return itemProductId === productId;
      });
    });
  };

  // Check if user has ANY active subscription (not consultation)
  const hasAnyActiveSubscription = () => {
    return userSubscriptions.some(sub => {
      if (sub.status !== 'active') return false;

      // Check if any item in the subscription is NOT a consultation
      return sub.items?.data?.some(item => {
        const itemProductId = item.price?.product;
        const product = getProduct(itemProductId);
        const isConsultation = product?.name?.toLowerCase().includes('consultation') ||
                              product?.nameHebrew?.includes('יעוץ');
        return !isConsultation; // Return true if it's NOT a consultation (meaning they have a non-consultation subscription)
      });
    });
  };

  const getFilteredProducts = () => {
    switch (activeCategory) {
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

  const categories = [
    { id: 'all', label: language === 'hebrew' ? 'הכל' : 'All Plans', count: allProducts.length },
    { id: 'premium', label: language === 'hebrew' ? 'פרימיום' : 'Premium', count: premiumProducts.length },
    { id: 'complete', label: language === 'hebrew' ? 'מלא' : 'Complete', count: completeProducts.length },
    { id: 'nutrition', label: language === 'hebrew' ? 'תזונה' : 'Nutrition', count: nutritionProducts.length },
    { id: 'content', label: language === 'hebrew' ? 'תוכן' : 'Content', count: contentProducts.length },
    { id: 'consultation', label: language === 'hebrew' ? 'יעוץ' : 'Consultation', count: consultationProducts.length },
  ].filter(category => category.count > 0);

  const filteredProducts = getFilteredProducts();

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn">
      {/* Header */}
      <div className="mb-8 sm:mb-10 md:mb-12 animate-slideInUp">
        <div className="flex items-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-blue-500/25 animate-pulse">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zM14 6a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2h6zM4 14a2 2 0 002 2h8a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2z" />
            </svg>
          </div>
          <div>
            <h2 className={`${themeClasses.textPrimary} text-3xl font-bold tracking-tight`}>
              {language === 'hebrew' ? 'בחר את התוכנית המתאימה לך' : 'Choose Your Perfect Plan'}
            </h2>
            <p className={`${themeClasses.textSecondary} text-base mt-1`}>
              {language === 'hebrew'
                ? 'השג את היעדים התזונתיים שלך עם המומחים שלנו. תוכניות מותאמות אישית לכל צורך ותקציב.'
                : 'Achieve your nutrition goals with our expert team. Personalized plans for every need and budget.'
              }
            </p>
          </div>
        </div>

        {/* Current Subscriptions Alert */}
        {userSubscriptions.length > 0 && (
          <div className={`${themeClasses.bgCard} border border-emerald-500/30 rounded-2xl p-6 mb-8 shadow-lg animate-slideInUp`}>
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className={`${themeClasses.textPrimary} text-lg font-semibold`}>
                {language === 'hebrew' ? 'המנויים הפעילים שלך' : 'Your Active Subscriptions'}
              </h3>
            </div>
            <div className="grid gap-3">
              {userSubscriptions.filter(sub => sub.status === 'active').map((subscription) => (
                <div key={subscription.id} className={`${themeClasses.bgSecondary} rounded-lg p-4`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className={`${themeClasses.textPrimary} font-medium`}>
                        {(() => {
                          const productId = subscription.items?.data?.[0]?.price?.product;
                          const product = getProduct(productId);
                          if (!product) return productId || 'Subscription';
                          return language === 'hebrew' ? (product.nameHebrew || product.name) : product.name;
                        })()}
                      </p>
                      <p className={`${themeClasses.textSecondary} text-sm`}>
                        {language === 'hebrew' ? 'פעיל' : 'Active'} •
                        {language === 'hebrew' ? ' מחדש ב-' : ' Renews '}{new Date(subscription.current_period_end * 1000).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-emerald-500 font-semibold">
                      {(() => {
                        const amount = subscription.items?.data?.[0]?.price?.unit_amount;
                        const currency = subscription.items?.data?.[0]?.price?.currency?.toUpperCase();
                        if (!amount) return '---';

                        const price = amount / 100;
                        if (currency === 'ILS') {
                          return `₪${price.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                        }
                        return `$${price.toFixed(2)}`;
                      })()}
                    </div>
                  </div>
                  {subscription.items?.data?.[0]?.price?.product === 'prod_TrcVkwBC0wmqKp' && (
                    <div className="mt-3 pt-3 border-t border-gray-500/30">
                      {cancelError && (
                        <p className="text-red-500 dark:text-red-400 text-sm mb-2" role="alert">{cancelError}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCancelPlan(subscription.id)}
                        disabled={cancellingSubscriptionId === subscription.id}
                        className="text-sm font-medium text-red-500 hover:text-red-400 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {cancellingSubscriptionId === subscription.id
                          ? (language === 'hebrew' ? 'מבטל...' : 'Cancelling...')
                          : (language === 'hebrew' ? 'ביטול מנוי' : 'Cancel plan')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Category Filter */}
      {categories.length > 1 && (
        <div className="mb-8 animate-slideInUp" style={{ animationDelay: '0.2s' }}>
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  activeCategory === category.id
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25'
                    : `${themeClasses.bgCard} ${themeClasses.textSecondary} hover:${themeClasses.bgSecondary} border ${themeClasses.borderPrimary}`
                }`}
              >
                {category.label}
                <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                  activeCategory === category.id
                    ? 'bg-white/20'
                    : `${themeClasses.bgSecondary}`
                }`}
                >
                  {category.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* What Every Plan Includes */}
      <div className="mb-8 animate-slideInUp" style={{ animationDelay: '0.3s' }}>
        <div className={`${themeClasses.bgCard} border ${themeClasses.borderPrimary} rounded-2xl p-6 md:p-8 shadow-lg`}>
          <h3 className={`${themeClasses.textPrimary} text-xl font-bold mb-4 ${language === 'hebrew' ? 'text-right' : 'text-left'}`}>
            {language === 'hebrew' ? 'מה כל סוג תוכנית כולל' : 'What Every Plan Includes'}
          </h3>
          {language === 'hebrew' ? (
            <div className="space-y-4 text-right">
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>פגישה ראשונה מקיפה:</h4>
                <ul className={`${themeClasses.textSecondary} space-y-1 text-sm list-disc list-inside`}>
                  <li>היכרות מעמיקה</li>
                  <li>בניית תכנית תזונה אישית</li>
                  <li>ובבחירה בתכנית משולבת - גם בניית תכנית אימונים</li>
                </ul>
              </div>
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>פגישות מעקב:</h4>
                <ul className={`${themeClasses.textSecondary} space-y-2 text-sm`}>
                  <li>
                    <span className="font-medium">פגישה אחת לשבועיים:</span> מתאימה למי שרוצה ליווי צמוד יותר, דיוק ונוכחות גבוהה של הדיאטן/נית שלנו לאורך הדרך
                  </li>
                  <li>
                    <span className="font-medium">פגישה אחת לחודש:</span> מתאימה למי שמעדיף מרווחים, עבודה הדרגתית ועצמאות גבוהה יותר
                  </li>
                </ul>
              </div>
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>ליווי אישי ב־WhatsApp לאורך כל התהליך:</h4>
                <ul className={`${themeClasses.textSecondary} space-y-1 text-sm list-disc list-inside`}>
                  <li>מענה על שאלות</li>
                  <li>התייעצויות שוטפות</li>
                  <li>דיוקים בזמן אמת (ארוחות, סיטואציות ושגרה)</li>
                </ul>
              </div>
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>התאמות ושינויים אישיים:</h4>
                <p className={`${themeClasses.textSecondary} text-sm`}>
                  בהתאם להתקדמות, לתחושות ולמציאות המשתנה
                </p>
              </div>
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>תקופות מחויבות:</h4>
                <ul className={`${themeClasses.textSecondary} space-y-1 text-sm list-disc list-inside`}>
                  <li><span className="font-medium">3 חודשים:</span> תהליך ממוקד, יצירת בסיס והנעה</li>
                  <li><span className="font-medium">6 חודשים:</span> תהליך עמוק, יציב ומבוסס הרגלים לאורך זמן</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-left">
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>Comprehensive First Session:</h4>
                <ul className={`${themeClasses.textSecondary} space-y-1 text-sm list-disc list-inside`}>
                  <li>In-depth introduction</li>
                  <li>Building a personalized nutrition plan</li>
                  <li>For combined plans - also building a training plan</li>
                </ul>
              </div>
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>Follow-up Sessions:</h4>
                <ul className={`${themeClasses.textSecondary} space-y-2 text-sm`}>
                  <li>
                    <span className="font-medium">One session every two weeks:</span> Suitable for those who want closer guidance, precision and high presence of our dietician/nutritionist throughout the process.
                  </li>
                  <li>
                    <span className="font-medium">One session per month:</span> Suitable for those who prefer intervals, gradual work and higher independence.
                  </li>
                </ul>
              </div>
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>Personal WhatsApp Guidance Throughout the Process:</h4>
                <ul className={`${themeClasses.textSecondary} space-y-1 text-sm list-disc list-inside`}>
                  <li>Answering questions</li>
                  <li>Ongoing consultations</li>
                  <li>Real-time adjustments (meals, situations and routine)</li>
                </ul>
              </div>
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>Personal Adjustments and Changes:</h4>
                <p className={`${themeClasses.textSecondary} text-sm`}>
                  According to progress, feelings and changing reality
                </p>
              </div>
              <div>
                <h4 className={`${themeClasses.textPrimary} font-semibold mb-2`}>Commitment Periods:</h4>
                <ul className={`${themeClasses.textSecondary} space-y-1 text-sm list-disc list-inside`}>
                  <li><span className="font-medium">3 months:</span> Focused process, creating foundation and momentum</li>
                  <li><span className="font-medium">6 months:</span> Deep process, stable and habit-based over time</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* USD conversion note (Bank of Israel rate) */}
      {usdExchangeRate != null && (
        <div className={`mb-6 animate-slideInUp ${themeClasses.bgCard} border ${themeClasses.borderPrimary} rounded-xl px-4 py-3 shadow-sm`} style={{ animationDelay: '0.35s' }}>
          <p className={`${themeClasses.textSecondary} text-xs sm:text-sm ${language === 'hebrew' ? 'text-right' : 'text-left'}`}>
            {language === 'hebrew' ? (
              <>השער המרה לדולר מתעדכן רק פעם ביום (בימי חול סביב 15:30–16:00, ובימי שישי סביב 12:30). אין עדכונים בשבת ובראשון. שער המרה לדולר: בנק ישראל.</>
            ) : (
              <>The exchange rate to USD is updated once a day (weekdays around 15:30–16:00, Fridays around 12:30). No updates on Saturday and Sunday. Exchange rate to USD from Bank of Israel.</>
            )}
          </p>
        </div>
      )}

      {/* Products Grid */}
      <div className="animate-slideInUp" style={{ animationDelay: '0.4s' }}>
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <div className={`w-20 h-20 ${themeClasses.bgCard} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
              <svg className={`w-10 h-10 ${themeClasses.textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className={`${themeClasses.textSecondary} text-lg`}>
              {language === 'hebrew' ? 'אין תוכניות זמינות בקטגוריה זו' : 'No plans available in this category'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 items-stretch">
            {filteredProducts.map((product, index) => (
              <div
                key={product.id}
                className="flex flex-col animate-slideInUp"
                style={{ animationDelay: `${0.5 + index * 0.1}s` }}
              >
                <div className="flex-1 flex flex-col min-h-0">
                  <PricingCard
                    product={product}
                    hasActiveSubscription={hasActiveSubscription(product.id)}
                    hasAnyActiveSubscription={hasAnyActiveSubscription()}
                    usdExchangeRate={usdExchangeRate}
                    className={`h-full flex flex-col transform hover:scale-[1.02] transition-all duration-300 ${
                      hasActiveSubscription(product.id) ? 'ring-2 ring-emerald-500' : ''
                    }`}
                  />
                </div>
                {hasActiveSubscription(product.id) && (
                  <div className="mt-3 text-center flex-shrink-0">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {language === 'hebrew' ? 'פעיל' : 'Active'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loadingSubscriptions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${themeClasses.bgCard} rounded-lg p-6`}>
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3" />
              <span className={themeClasses.textPrimary}>
                {language === 'hebrew' ? 'טוען מנויים...' : 'Loading subscriptions...'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingTab;
