import React, { useState } from 'react';
import { useStripe } from '../context/StripeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const PricingCard = ({ product, selectedPriceId, onPriceSelect, className = '', hasActiveSubscription = false, hasAnyActiveSubscription = false }) => {
  const { createCheckoutSession, loading, error } = useStripe();
  const { user, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const { themeClasses } = useTheme();
  
  // Get 6-month price ID for default selection, or first price if no 6-month option
  const getDefaultPriceId = () => {
    if (selectedPriceId) return selectedPriceId;
    const sixMonthPrice = product.prices?.find(p => p.commitment === 6);
    return sixMonthPrice?.id || product.prices?.[0]?.id;
  };
  
  const [selectedPrice, setSelectedPrice] = useState(getDefaultPriceId());
  const [showUSD, setShowUSD] = useState(false);
  
  // Check if this is a consultation product (can always be purchased)
  const isConsultation = product.name.toLowerCase().includes('consultation') || 
                         product.nameHebrew?.includes('יעוץ');
  
  // Determine if this product should be blocked
  const isBlocked = hasAnyActiveSubscription && !isConsultation;

  const handlePriceSelect = (priceId) => {
    setSelectedPrice(priceId);
    if (onPriceSelect) {
      onPriceSelect(priceId, product);
    }
  };

  const handlePurchase = async () => {
    if (!isAuthenticated) {
      alert(language === 'hebrew' ? 'יש להתחבר תחילה' : 'Please log in first');
      return;
    }

    // Check if user should be blocked from purchasing (has any active subscription and this is not a consultation)
    if (isBlocked) {
      alert(language === 'hebrew' ? 
        'יש לך כבר מנוי פעיל. ניתן לרכוש רק יעוץ אישי.' : 
        'You already have an active subscription. You can only purchase consultations.');
      return;
    }

    if (!selectedPrice) {
      alert(language === 'hebrew' ? 'אנא בחר תוכנית מחיר' : 'Please select a pricing option');
      return;
    }

    try {
      await createCheckoutSession(selectedPrice, {
        customerId: user?.id,
        customerEmail: user?.email,
      });
    } catch (error) {
      console.error('Purchase error:', error);
      alert(error.message || (language === 'hebrew' ? 'שגיאה בתהליך התשלום' : 'Payment error occurred'));
    }
  };

  const formatPrice = (priceObj) => {
    if (!priceObj) return 'Contact for pricing';
    
    const currentAmount = showUSD ? priceObj.amountUSD : priceObj.amount;
    const currentCurrency = showUSD ? 'USD' : 'ILS';
    
    if (!currentAmount) return 'Contact for pricing';
    
    // Amount is in cents/agorot, convert to main currency
    const price = currentAmount / 100;
    
    if (currentCurrency === 'ILS') {
      // Format Israeli Shekel with ₪ symbol
      return `₪${price.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    } else {
      // Format USD with $ symbol
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: price % 1 === 0 ? 0 : 2
      }).format(price);
    }
  };

  const getPopularBadge = () => (
    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
      <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg">
        {language === 'hebrew' ? 'פופולרי' : 'Popular'}
      </span>
    </div>
  );


  // Find if any price is marked as popular
  const hasPopularPrice = product.prices?.some(price => price.popular);
  const selectedPriceObj = product.prices?.find(price => price.id === selectedPrice);

  // Calculate savings for 6-month plan
  const calculateSavings = () => {
    if (!product.prices || product.prices.length < 2) return null;
    
    const threeMonthPrice = product.prices.find(p => p.commitment === 3);
    const sixMonthPrice = product.prices.find(p => p.commitment === 6);
    
    if (!threeMonthPrice || !sixMonthPrice) return null;
    
    const threeMonthAmount = showUSD ? threeMonthPrice.amountUSD : threeMonthPrice.amount;
    const sixMonthAmount = showUSD ? sixMonthPrice.amountUSD : sixMonthPrice.amount;
    const currency = showUSD ? 'USD' : 'ILS';
    
    // Total cost: 3-month plan for 6 months (2 cycles) vs 6-month plan
    const totalThreeMonth = (threeMonthAmount / 100) * 6; // 3 months * 2 = 6 months
    const totalSixMonth = (sixMonthAmount / 100) * 6;
    const savings = totalThreeMonth - totalSixMonth;
    
    if (savings <= 0) return null;
    
    return { savings, currency };
  };

  const savings = calculateSavings();

  return (
    <div className={`relative ${themeClasses.bgCard} rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border ${themeClasses.borderPrimary} ${className}`}>
      {hasPopularPrice && selectedPriceObj?.popular && getPopularBadge()}

      <div className="p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className={`text-xl font-bold ${themeClasses.textPrimary} mb-2`}>
                {language === 'hebrew' ? (product.nameHebrew || product.name) : product.name}
              </h3>
              <p className={`${themeClasses.textSecondary} text-sm`}>
                {language === 'hebrew' ? (product.descriptionHebrew || product.description) : product.description}
              </p>
            </div>
            
            {/* Currency Switcher */}
            <button
              onClick={() => setShowUSD(!showUSD)}
              className={`ml-4 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                showUSD 
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' 
                  : 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
              } hover:scale-105`}
            >
              {showUSD ? '$' : '₪'}
            </button>
          </div>
        </div>

        {/* Price Options */}
        {isBlocked ? (
          // Blocked due to existing subscription message
          <div className="mb-6 text-center p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-600">
            <div className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
              🚫 {language === 'hebrew' ? 'לא זמין' : 'Not Available'}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {language === 'hebrew' ? 
                'יש לך כבר מנוי פעיל. ניתן לרכוש רק יעוץ אישי.' : 
                'You have an active subscription. Only consultations available.'
              }
            </div>
          </div>
        ) : hasActiveSubscription ? (
          // Already have this specific product
          <div className="mb-6 text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className={`text-lg font-semibold ${themeClasses.textPrimary} mb-2`}>
              ✅ {language === 'hebrew' ? 'מנוי פעיל' : 'Active Subscription'}
            </div>
            <div className={`text-sm ${themeClasses.textSecondary}`}>
              {language === 'hebrew' ? 
                'יש לך כבר מנוי פעיל לתוכנית זו' : 
                'You already have an active subscription for this plan'
              }
            </div>
          </div>
        ) : product.prices && product.prices.length > 1 ? (
          <div className="mb-6">
            <label className={`block text-sm font-medium ${themeClasses.textSecondary} mb-3`}>
              {language === 'hebrew' ? 'בחר תוכנית:' : 'Choose Plan:'}
            </label>
            <div className="space-y-2">
              {/* Sort prices: 6-month first, then 3-month */}
              {[...product.prices].sort((a, b) => {
                const aCommitment = a.commitment || 0;
                const bCommitment = b.commitment || 0;
                return bCommitment - aCommitment; // 6-month (6) comes before 3-month (3)
              }).map((price) => (
                <label
                  key={price.id}
                  className={`
                    flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors
                    ${selectedPrice === price.id 
                      ? `border-blue-500 ${themeClasses.bgSecondary} ring-2 ring-blue-200 dark:ring-blue-800` 
                      : `${themeClasses.borderPrimary} hover:${themeClasses.bgSecondary}`
                    }
                  `}
                >
                  <div className="flex items-center">
                    <input
                      type="radio"
                      name={`price-${product.id}`}
                      value={price.id}
                      checked={selectedPrice === price.id}
                      onChange={() => handlePriceSelect(price.id)}
                      className="mr-3 text-blue-600"
                    />
                    <div>
                      {price.commitment && (
                        <div className={`font-medium ${themeClasses.textPrimary}`}>
                          {price.commitment} {language === 'hebrew' ? 'חודשי מחויבות' : 'month commitment'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${themeClasses.textPrimary}`}>
                      {formatPrice(price)}
                      {price.interval && (
                        <span className={`text-sm ${themeClasses.textMuted}`}>
                          /{language === 'hebrew' ? (price.interval === 'month' ? 'חודש' : price.interval) : price.interval}
                        </span>
                      )}
                    </div>
                    {price.commitment === 6 && savings && (
                      <div className={`text-xs text-green-600 dark:text-green-400 font-medium mt-1`}>
                        {language === 'hebrew' ? 'חיסכון של: ' : 'Saves: '}
                        {savings.currency === 'ILS' 
                          ? `₪${Math.round(savings.savings).toLocaleString('he-IL')}`
                          : `$${Math.round(savings.savings).toLocaleString('en-US')}`
                        }
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        ) : (
          // Single price display
          <div className="text-center mb-6">
            {product.prices?.[0] && (
              <div>
                <span className={`text-3xl font-bold ${themeClasses.textPrimary}`}>
                  {formatPrice(product.prices[0])}
                </span>
                {product.prices[0].interval && (
                  <span className={`${themeClasses.textSecondary} ml-1`}>
                    /{language === 'hebrew' ? (product.prices[0].interval === 'month' ? 'חודש' : product.prices[0].interval) : product.prices[0].interval}
                  </span>
                )}
                {product.prices[0].commitment && (
                  <div className={`text-sm ${themeClasses.textMuted} mt-2`}>
                    {product.prices[0].commitment} {language === 'hebrew' ? 'חודשי מחויבות' : 'month commitment'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Features */}
        {product.features && (
          <ul className="space-y-3 mb-6 text-sm">
            {(language === 'hebrew' ? (product.featuresHebrew || product.features) : product.features).map((feature, index) => (
              <li key={index} className={`flex items-center ${themeClasses.textSecondary}`}>
                <svg className="w-4 h-4 text-green-500 dark:text-green-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        )}

        {/* CTA Button */}
        <button
          onClick={handlePurchase}
          disabled={loading || !selectedPrice || isBlocked}
          className={`
            w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 transform hover:scale-105
            ${isBlocked
              ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : hasActiveSubscription
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : selectedPriceObj?.popular || hasPopularPrice
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg'
                  : 'bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900'
            }
            disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
          `}
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              {language === 'hebrew' ? 'טוען...' : 'Loading...'}
            </div>
          ) : isBlocked ? (
            language === 'hebrew' ? 'לא זמין' : 'Not Available'
          ) : hasActiveSubscription ? (
            language === 'hebrew' ? 'מנוי פעיל' : 'Active Subscription'
          ) : (
            <>
              {product.category === 'consultation' 
                ? (language === 'hebrew' ? 'קבע יעוץ' : 'Book Consultation')
                : (language === 'hebrew' ? 'התחל עכשיו' : 'Get Started')
              }
            </>
          )}
        </button>

        {/* Error Display */}
        {error && (
          <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Additional Info */}
        {product.category === 'consultation' && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {language === 'hebrew' 
                ? '💡 יועץ התזונה שלנו יחזור אליך תוך 24 שעות לתיאום הפגישה'
                : '💡 Our nutrition expert will contact you within 24 hours to schedule your session'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PricingCard;
