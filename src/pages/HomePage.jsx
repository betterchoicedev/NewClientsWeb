import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import * as CookieConsent from 'vanilla-cookieconsent';
import Navigation from '../components/Navigation';
import { supabase, supabaseSecondary } from '../supabase/supabaseClient';
import { useStripe } from '../context/StripeContext';
import { STRIPE_PRODUCTS, PRODUCT_CONFIG } from '../config/stripe-products';

function HomePage() {
  const { language, direction, toggleLanguage, t } = useLanguage();
  const { user, isAuthenticated, userDisplayName, loading } = useAuth();
  const { isDarkMode, toggleTheme, themeClasses } = useTheme();
  const { createCheckoutSession, loading: stripeLoading } = useStripe();
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [showPlanDetailsModal, setShowPlanDetailsModal] = useState(false);
  const [commitmentPeriod, setCommitmentPeriod] = useState(3);
  const [showUSD, setShowUSD] = useState(false);
  
  // Contact form state
  const [contactForm, setContactForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    message: ''
  });
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  
  // Chat mode state (photo, voice, text)
  const [chatMode, setChatMode] = useState('photo');
  
  // Chat animation state
  const [chatAnimation, setChatAnimation] = useState({
    showImage: false,
    showVoiceMessage: false,
    showTextMessage: false,
    showTyping: false,
    showBotMessage: false,
    showButtons: false
  });

  // Format price based on currency
  const formatPrice = (priceILS, priceUSD) => {
    if (showUSD) {
      return `$${Math.round(priceUSD / 100)}`;
    } else {
      return `₪${Math.round(priceILS / 100)}`;
    }
  };

  // Get products
  const nutritionOnlyProduct = PRODUCT_CONFIG[STRIPE_PRODUCTS.NUTRITION_ONLY];
  const nutritionOnly2xProduct = PRODUCT_CONFIG[STRIPE_PRODUCTS.NUTRITION_ONLY_2X_MONTH];
  const nutritionTrainingProduct = PRODUCT_CONFIG[STRIPE_PRODUCTS.NUTRITION_TRAINING];
  const betterProProduct = PRODUCT_CONFIG[STRIPE_PRODUCTS.NUTRITION_TRAINING_ONCE_MONTH];

  // Get price based on commitment period
  const getPrice = (product, commitment) => {
    const price = product.prices?.find(p => p.commitment === commitment);
    return price ? { ILS: price.amount, USD: price.amountUSD, priceId: price.id } : null;
  };

  // Handle plan selection - redirect to login if not authenticated, otherwise create checkout
  const handlePlanSelect = async (productId) => {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }

    const product = PRODUCT_CONFIG[productId];
    if (!product) return;

    const price = getPrice(product, commitmentPeriod);
    if (!price) return;

    try {
      await createCheckoutSession(price.priceId, {
        customerId: user?.id,
        customerEmail: user?.email,
      });
    } catch (error) {
      console.error('Purchase error:', error);
      alert(error.message || (language === 'hebrew' ? 'שגיאה בתהליך התשלום' : 'Payment error occurred'));
    }
  };


  // Contact form handlers
  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingContact(true);

    try {
      // Normalize phone number if provided (remove spaces and dashes)
      const normalizedPhone = contactForm.phone ? contactForm.phone.replace(/[\s\-\(\)\.]/g, '') : null;
      
      // Send directly to Supabase
      const { data, error } = await supabase
        .from('contact_messages')
        .insert([
          {
            full_name: contactForm.fullName,
            email: contactForm.email,
            phone: normalizedPhone,
            message: contactForm.message,
            user_agent: navigator.userAgent,
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw new Error('Failed to save message');
      }

      alert(language === 'hebrew' ? 
        'ההודעה נשלחה בהצלחה! נחזור בהקדם.' : 
        'Your message has been sent successfully! We will get back to you soon.'
      );
      
      // Reset form
      setContactForm({
        fullName: '',
        email: '',
        phone: '',
        message: ''
      });

    } catch (error) {
      console.error('Error sending contact message:', error);
      alert(language === 'hebrew' ? 
        'שגיאה בשליחת ההודעה. אפשר לנסות שוב או ליצור קשר בטלפון.' : 
        'Error sending message. Please try again or contact us by phone.'
      );
    } finally {
      setIsSubmittingContact(false);
    }
  };

  // Prevent body scrolling to avoid double scrollbars
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Chat animation sequence
  useEffect(() => {
    // Reset animation
    setChatAnimation({
      showImage: false,
      showVoiceMessage: false,
      showTextMessage: false,
      showTyping: false,
      showBotMessage: false,
      showButtons: false
    });

    let timers = [];
    let loopTimer;

    if (chatMode === 'photo') {
      // Photo mode animation
      timers.push(setTimeout(() => {
        setChatAnimation(prev => ({ ...prev, showImage: true }));
      }, 500));

      timers.push(setTimeout(() => {
        setChatAnimation(prev => ({ ...prev, showTyping: true }));
      }, 2000));

      timers.push(setTimeout(() => {
        setChatAnimation(prev => ({ ...prev, showTyping: false, showBotMessage: true }));
      }, 3500));

      timers.push(setTimeout(() => {
        setChatAnimation(prev => ({ ...prev, showButtons: true }));
      }, 4500));

      // Loop animation every 15 seconds
      loopTimer = setInterval(() => {
        setChatAnimation({
          showImage: false,
          showVoiceMessage: false,
          showTextMessage: false,
          showTyping: false,
          showBotMessage: false,
          showButtons: false
        });

        setTimeout(() => {
          setChatAnimation(prev => ({ ...prev, showImage: true }));
        }, 500);

        setTimeout(() => {
          setChatAnimation(prev => ({ ...prev, showTyping: true }));
        }, 2000);

        setTimeout(() => {
          setChatAnimation(prev => ({ ...prev, showTyping: false, showBotMessage: true }));
        }, 3500);

        setTimeout(() => {
          setChatAnimation(prev => ({ ...prev, showButtons: true }));
        }, 15000);
      }, 15000);
    } else if (chatMode === 'voice') {
      // Voice mode animation
      timers.push(setTimeout(() => {
        setChatAnimation(prev => ({ ...prev, showVoiceMessage: true }));
      }, 500));

      timers.push(setTimeout(() => {
        setChatAnimation(prev => ({ ...prev, showTyping: true }));
      }, 2500));

      timers.push(setTimeout(() => {
        setChatAnimation(prev => ({ ...prev, showTyping: false, showBotMessage: true }));
      }, 4000));

      timers.push(setTimeout(() => {
        setChatAnimation(prev => ({ ...prev, showButtons: true }));
      }, 5000));

      // Loop animation every 16 seconds
      loopTimer = setInterval(() => {
        setChatAnimation({
          showImage: false,
          showVoiceMessage: false,
          showTextMessage: false,
          showTyping: false,
          showBotMessage: false,
          showButtons: false
        });

        setTimeout(() => {
          setChatAnimation(prev => ({ ...prev, showVoiceMessage: true }));
        }, 500);

        setTimeout(() => {
          setChatAnimation(prev => ({ ...prev, showTyping: true }));
        }, 2500);

        setTimeout(() => {
          setChatAnimation(prev => ({ ...prev, showTyping: false, showBotMessage: true }));
        }, 4000);

        setTimeout(() => {
          setChatAnimation(prev => ({ ...prev, showButtons: true }));
        }, 5000);
      }, 16000);
    } else if (chatMode === 'text') {
      // Text mode animation
      timers.push(setTimeout(() => {
        setChatAnimation(prev => ({ ...prev, showTextMessage: true }));
      }, 500));

      timers.push(setTimeout(() => {
        setChatAnimation(prev => ({ ...prev, showTyping: true }));
      }, 2000));

      timers.push(setTimeout(() => {
        setChatAnimation(prev => ({ ...prev, showTyping: false, showBotMessage: true }));
      }, 3500));

      timers.push(setTimeout(() => {
        setChatAnimation(prev => ({ ...prev, showButtons: true }));
      }, 4500));

      // Loop animation every 15 seconds
      loopTimer = setInterval(() => {
        setChatAnimation({
          showImage: false,
          showVoiceMessage: false,
          showTextMessage: false,
          showTyping: false,
          showBotMessage: false,
          showButtons: false
        });

        setTimeout(() => {
          setChatAnimation(prev => ({ ...prev, showTextMessage: true }));
        }, 500);

        setTimeout(() => {
          setChatAnimation(prev => ({ ...prev, showTyping: true }));
        }, 2000);

        setTimeout(() => {
          setChatAnimation(prev => ({ ...prev, showTyping: false, showBotMessage: true }));
        }, 3500);

        setTimeout(() => {
          setChatAnimation(prev => ({ ...prev, showButtons: true }));
        }, 4500);
      }, 15000);
    }

    return () => {
      timers.forEach(timer => clearTimeout(timer));
      if (loopTimer) clearInterval(loopTimer);
    };
  }, [chatMode]);

  return (
    <div className={`min-h-screen ${themeClasses.bgPrimary} language-transition language-text-transition flex flex-col`} dir={direction} style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto custom-scrollbar ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900' : 'bg-gradient-to-br from-emerald-50 via-green-50 to-amber-50'}`} style={{ minHeight: 0 }}>
        {/* Hero Section */}
        <section data-tour="hero-section" className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center">
            {/* Natural, welcoming greeting */}
            
            
            <h1 className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold mb-6 sm:mb-8 leading-tight`}>
              <span className={`${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
                {language === 'hebrew' ? 'BetterChoice AI' : 'BetterChoice AI'}
              </span>
              <br />
              <span className={`${themeClasses.textPrimary} text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal whitespace-nowrap`}>
                {language === 'hebrew' 
                  ? 'תזונה שעובדת בשבילך, כל יום.' 
                  : 'Nutrition that works for you, every day.'}
              </span>
            </h1>
            
            {/* Warm, inviting value prop */}
            <p className={`text-xl sm:text-2xl md:text-3xl ${isDarkMode ? 'text-emerald-200' : 'text-emerald-700'} mb-6 sm:mb-8 leading-relaxed max-w-4xl mx-auto px-2 font-medium`}>
              {language === 'hebrew' 
                ? 'מפסיקים להילחם באוכל. מתחילים להזין את החיים.'
                : 'Stop fighting your food. Start fueling your life.'}
            </p>
            
            <p className={`text-lg sm:text-xl md:text-2xl ${themeClasses.textSecondary} mb-6 sm:mb-8 leading-relaxed max-w-4xl mx-auto px-2`}>
              {language === 'hebrew' 
                ? 'דמיינו שאתם קמים בבוקר בתחושת קלילות, ביטחון, ושליטה אמיתית. לא עוד "דיאטה" - פשוט בחירות טובות יותר שנשארות לאורך זמן.'
                : 'Imagine waking up feeling light, confident, and finally in control. No more "diets"-just better choices that actually last.'}
            </p>
            
            <p className={`text-base sm:text-lg ${themeClasses.textSecondary} mb-10 sm:mb-12 leading-relaxed max-w-3xl mx-auto px-2 italic`}>
              {language === 'hebrew'
                ? 'הגיע הזמן לאהוב את מה שאתם רואים במראה, ובעיקר את איך שאתם מרגישים עם עצמכם.'
                : 'It\'s time to love what you see in the mirror and how you feel in your skin.'}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 justify-center mb-8 sm:mb-10 px-2">
              <button 
                onClick={() => {
                  if (!isAuthenticated) {
                    window.location.href = '/login';
                  } else {
                    window.location.href = '/profile';
                  }
                }}
                className={`${isDarkMode 
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500' 
                  : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700'
                } text-white px-10 sm:px-12 py-4 sm:py-5 rounded-full text-lg sm:text-xl font-medium transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center w-full sm:w-auto`}
              >
                <span className="mr-2 text-xl">✨</span>
                {language === 'hebrew' ? 'אני מוכן להרגיש טוב יותר' : 'I\'m ready to feel better'}
                <span className="ml-2">→</span>
              </button>
             
            </div>
            {/* Low-risk CTA */}
            <div className="text-center mb-8 sm:mb-10">
              
            </div>
            {/* Trust micro-copy */}
           
            {/* Scroll indicator arrow */}
            <div className="flex flex-col items-center mt-8 mb-4">
              <button
                onClick={() => {
                  const chatSection = document.getElementById('chat-preview-section');
                  if (chatSection) {
                    chatSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="flex flex-col items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity duration-300 group"
                aria-label={language === 'hebrew' ? 'גלול למטה' : 'Scroll down'}
              >
                <p className={`text-sm font-medium transition-colors ${
                  isDarkMode 
                    ? 'text-gray-300 group-hover:text-white' 
                    : 'text-gray-600 group-hover:text-gray-900'
                }`}>
                  {language === 'hebrew' ? 'המשיכו לגלול' : 'Keep scrolling'}
                </p>
                <div className="animate-bounce-down">
                  <svg 
                    width="32" 
                    height="32" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke={isDarkMode ? 'white' : 'black'} 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className="opacity-60 group-hover:opacity-100 transition-opacity"
                  >
                    <path d="M12 5v14M19 12l-7 7-7-7" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* Chat Preview Section */}
        <section id="chat-preview-section" className="py-8 sm:py-12">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* WhatsApp-style container */}
            <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-[#e5ddd5]'} rounded-2xl shadow-2xl overflow-hidden`} style={{
              backgroundImage: isDarkMode ? 'none' : 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'grid\' width=\'100\' height=\'100\' patternUnits=\'userSpaceOnUse\'%3E%3Cpath d=\'M 100 0 L 0 0 0 100\' fill=\'none\' stroke=\'%23d4d4d4\' stroke-width=\'0.5\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'100\' height=\'100\' fill=\'url(%23grid)\'/%3E%3C/svg%3E")',
              backgroundSize: '50px 50px'
            }}>
              {/* WhatsApp header */}
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-[#075e54]'} px-4 py-3`}>
                {/* Mode buttons */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setChatMode('photo')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      chatMode === 'photo'
                        ? 'bg-green-500 text-white shadow-md'
                        : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-white/20 text-white/80 hover:bg-white/30'
                    }`}
                  >
                    📷 {language === 'hebrew' ? 'תמונה' : 'Photo'}
                  </button>
                  <button
                    onClick={() => setChatMode('voice')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      chatMode === 'voice'
                        ? 'bg-green-500 text-white shadow-md'
                        : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-white/20 text-white/80 hover:bg-white/30'
                    }`}
                  >
                    🎤 {language === 'hebrew' ? 'קול/טקסט' : 'Voice/Text'}
                  </button>
                  <button
                    onClick={() => setChatMode('text')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      chatMode === 'text'
                        ? 'bg-green-500 text-white shadow-md'
                        : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-white/20 text-white/80 hover:bg-white/30'
                    }`}
                  >
                    💬 {language === 'hebrew' ? 'טקסט' : 'Text'}
                  </button>
                </div>
                {/* Bot info */}
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center mr-3">
                    <span className="text-white text-xl">🤖</span>
                  </div>
                  <div>
                    <p className={`${isDarkMode ? 'text-gray-100' : 'text-white'} font-semibold`}>BetterChoice AI</p>
                    <p className={`${isDarkMode ? 'text-gray-400' : 'text-green-100'} text-xs`}>
                      {language === 'hebrew' ? 'מחובר' : 'Online'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Chat messages */}
              <div className="p-4 space-y-3 min-h-[500px] relative" dir="ltr">
                {/* Photo Mode */}
                {chatMode === 'photo' && (
                  <>
                    {/* User sends image */}
                    <div 
                      className={`flex justify-end transition-all duration-500 ${
                        chatAnimation.showImage 
                          ? 'opacity-100 translate-x-0' 
                          : 'opacity-0 translate-x-4'
                      }`}
                      style={{
                        animation: chatAnimation.showImage ? 'slideInRight 0.5s ease-out' : 'none'
                      }}
                    >
                      <div className="max-w-[75%]">
                        <div className={`${isDarkMode ? 'bg-green-700' : 'bg-[#dcf8c6]'} rounded-lg rounded-tr-none p-2 shadow-sm`}>
                          <img 
                            src="/Porcupine-Meatballs-Fork.jpg" 
                            alt={language === 'hebrew' ? 'ארוחה' : 'Meal'}
                            className="rounded-lg w-full h-auto max-h-64 object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'block';
                            }}
                          />
                          <div style={{display: 'none'}} className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} rounded-lg p-8 text-center`}>
                            <span className="text-4xl">🍽️</span>
                          </div>
                        </div>
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1 text-right`}>
                          {language === 'hebrew' ? '14:32' : '2:32 PM'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Typing indicator */}
                    {chatAnimation.showTyping && (
                      <div 
                        className="flex justify-start animate-fadeIn"
                        style={{
                          animation: 'fadeIn 0.3s ease-in'
                        }}
                      >
                        <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-white'} rounded-lg rounded-tl-none p-3 shadow-sm`}>
                          <div className="flex space-x-1">
                            <div className={`w-2 h-2 ${isDarkMode ? 'bg-gray-400' : 'bg-gray-500'} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }}></div>
                            <div className={`w-2 h-2 ${isDarkMode ? 'bg-gray-400' : 'bg-gray-500'} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }}></div>
                            <div className={`w-2 h-2 ${isDarkMode ? 'bg-gray-400' : 'bg-gray-500'} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Bot response - Photo mode */}
                    {chatAnimation.showBotMessage && (
                      <div 
                        className={`flex justify-start transition-all duration-500 ${
                          chatAnimation.showBotMessage 
                            ? 'opacity-100 translate-x-0' 
                            : 'opacity-0 -translate-x-4'
                        }`}
                        style={{
                          animation: chatAnimation.showBotMessage ? 'slideInLeft 0.5s ease-out' : 'none'
                        }}
                      >
                        <div className="max-w-[85%]">
                          <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-white'} rounded-lg rounded-tl-none p-4 shadow-sm`}>
                            <div className={`${isDarkMode ? 'text-gray-100' : 'text-gray-800'} text-sm space-y-2`}>
                              <div>
                                <span className="font-semibold">*{language === 'hebrew' ? 'ציון' : 'Rating'}*</span>: 8/10
                              </div>
                              <div>
                                <span className="font-semibold">*{language === 'hebrew' ? 'סיבה' : 'Reason'}*</span>: {language === 'hebrew' 
                                  ? 'כמות גבוהה של קלוריות, פחמימות פשוטות ושומן. חסרים ירקות.'
                                  : 'High in calories, simple carbohydrates, and fats. Lacking vegetables.'}
                              </div>
                              <div>
                                <span className="font-semibold">*{language === 'hebrew' ? 'התאמה לתוכנית' : 'Plan Match'}*</span>: 😊 {language === 'hebrew' ? 'בחירה טובה' : 'Good choice'}
                              </div>
                              <div className="pt-2 border-t border-gray-300">
                                <span className="font-semibold">📊 *{language === 'hebrew' ? 'ניתוח' : 'Analysis'}*</span>:
                                <div className="mt-2 text-xs space-y-1 font-mono">
                                  <div>{language === 'hebrew' ? 'סה״כ' : 'Total'}: 1202 {language === 'hebrew' ? 'קק״ל' : 'kcal'} | 60ג&apos; {language === 'hebrew' ? 'חלבון' : 'protein'} | 126ג&apos; {language === 'hebrew' ? 'פחמימה' : 'carbs'} | 44ג&apos; {language === 'hebrew' ? 'שומן' : 'fat'}</div>
                                  <div>1. {language === 'hebrew' ? 'קציצות ברוטב עגבניות (כ-5 קציצות (240ג&apos;) עם 175ג&apos; רוטב)' : 'Meatballs in tomato sauce (~5 meatballs (240g) with 175g sauce)'}: 812 {language === 'hebrew' ? 'קק״ל' : 'kcal'} | 52ג&apos; {language === 'hebrew' ? 'P' : 'P'} | 42ג&apos; {language === 'hebrew' ? 'C' : 'C'} | 43ג&apos; {language === 'hebrew' ? 'F' : 'F'}</div>
                                  <div>2. {language === 'hebrew' ? 'אורז לבן (כ-300ג&apos;)' : 'White rice (~300g)'}: 390 {language === 'hebrew' ? 'קק״ל' : 'kcal'} | 8ג&apos; {language === 'hebrew' ? 'P' : 'P'} | 84ג&apos; {language === 'hebrew' ? 'C' : 'C'} | 1ג&apos; {language === 'hebrew' ? 'F' : 'F'}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Action buttons - Photo mode */}
                          <div 
                            className={`mt-3 space-y-2 transition-all duration-500 ${
                              chatAnimation.showButtons 
                                ? 'opacity-100 translate-y-0' 
                                : 'opacity-0 translate-y-4'
                            }`}
                            style={{
                              animation: chatAnimation.showButtons ? 'slideUp 0.5s ease-out' : 'none'
                            }}
                          >
                            <button className={`w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2`}>
                              <span>📝</span>
                              <span>{language === 'hebrew' ? 'תיעוד ארוחה זו' : 'Log this meal'}</span>
                            </button>
                            <button className={`w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2`}>
                              <span>📝</span>
                              <span>{language === 'hebrew' ? 'תיעוד עם חצי מנת אורז' : 'Log with half-portion of rice'}</span>
                            </button>
                            <button className={`w-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 hover:from-green-600 hover:via-emerald-600 hover:to-green-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2`}>
                              <span>✨</span>
                              <span>{language === 'hebrew' ? 'איך להפוך את הארוחה ל-BetterChoice?' : 'How can I make this meal a BetterChoice?'}</span>
                            </button>
                          </div>
                          
                          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                            {language === 'hebrew' ? '14:33' : '2:33 PM'}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Voice Mode */}
                {chatMode === 'voice' && (
                  <>
                    {/* User sends voice message */}
                    <div 
                      className={`flex justify-end transition-all duration-500 ${
                        chatAnimation.showVoiceMessage 
                          ? 'opacity-100 translate-x-0' 
                          : 'opacity-0 translate-x-4'
                      }`}
                      style={{
                        animation: chatAnimation.showVoiceMessage ? 'slideInRight 0.5s ease-out' : 'none'
                      }}
                    >
                      <div className="max-w-[75%]">
                        <div className={`${isDarkMode ? 'bg-green-700' : 'bg-[#dcf8c6]'} rounded-lg rounded-tr-none p-3 shadow-sm flex items-center gap-3`}>
                          <div className="flex items-center gap-1">
                            <div className="w-1 h-4 bg-green-600 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-1 h-6 bg-green-600 rounded-full animate-pulse" style={{ animationDelay: '100ms' }}></div>
                            <div className="w-1 h-5 bg-green-600 rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></div>
                            <div className="w-1 h-7 bg-green-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                            <div className="w-1 h-4 bg-green-600 rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></div>
                            <div className="w-1 h-6 bg-green-600 rounded-full animate-pulse" style={{ animationDelay: '500ms' }}></div>
                          </div>
                          <span className="text-xs font-medium">0:05</span>
                          <span className="text-lg">🎤</span>
                        </div>
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1 text-right`}>
                          {language === 'hebrew' ? '14:32' : '2:32 PM'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Typing indicator */}
                    {chatAnimation.showTyping && (
                      <div 
                        className="flex justify-start animate-fadeIn"
                        style={{
                          animation: 'fadeIn 0.3s ease-in'
                        }}
                      >
                        <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-white'} rounded-lg rounded-tl-none p-3 shadow-sm`}>
                          <div className="flex space-x-1">
                            <div className={`w-2 h-2 ${isDarkMode ? 'bg-gray-400' : 'bg-gray-500'} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }}></div>
                            <div className={`w-2 h-2 ${isDarkMode ? 'bg-gray-400' : 'bg-gray-500'} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }}></div>
                            <div className={`w-2 h-2 ${isDarkMode ? 'bg-gray-400' : 'bg-gray-500'} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Bot response - Voice mode */}
                    {chatAnimation.showBotMessage && (
                      <div 
                        className={`flex justify-start transition-all duration-500 ${
                          chatAnimation.showBotMessage 
                            ? 'opacity-100 translate-x-0' 
                            : 'opacity-0 -translate-x-4'
                        }`}
                        style={{
                          animation: chatAnimation.showBotMessage ? 'slideInLeft 0.5s ease-out' : 'none'
                        }}
                      >
                        <div className="max-w-[85%]">
                          <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-white'} rounded-lg rounded-tl-none p-4 shadow-sm`}>
                            <div className={`${isDarkMode ? 'text-gray-100' : 'text-gray-800'} text-sm space-y-2`}>
                              <div>
                                <span className="font-semibold">*{language === 'hebrew' ? 'ציון' : 'Rating'}*</span>: 6/10
                              </div>
                              <div>
                                <span className="font-semibold">*{language === 'hebrew' ? 'סיבה' : 'Reason'}*</span>: {language === 'hebrew' 
                                  ? 'ערך קלורי ושומן גבוהים מאוד, בעיקר בשל כמות גדולה של גבינת שמנת.'
                                  : 'Very high in calories and fat, primarily due to the large amount of cream cheese.'}
                              </div>
                              <div>
                                <span className="font-semibold">*{language === 'hebrew' ? 'התאמה לתוכנית' : 'Plan Match'}*</span>: ❌ {language === 'hebrew' ? 'בחירה פחות מומלצת' : 'Poor choice'}
                              </div>
                              <div className="pt-2 border-t border-gray-300">
                                <span className="font-semibold">📊 *{language === 'hebrew' ? 'ניתוח' : 'Analysis'}*</span>:
                                <div className="mt-2 text-xs space-y-1 font-mono">
                                  <div>{language === 'hebrew' ? 'סה״כ' : 'Total'}: 1020 {language === 'hebrew' ? 'קק״ל' : 'kcal'} | 43ג&apos; {language === 'hebrew' ? 'חלבון' : 'protein'} | 67ג&apos; {language === 'hebrew' ? 'פחמימה' : 'carbs'} | 70ג&apos; {language === 'hebrew' ? 'שומן' : 'fat'}</div>
                                  <div>1. {language === 'hebrew' ? 'טוסט חיטה מלאה עם גבינת שמנת (כ-230ג&apos;)' : 'Whole wheat toast with cream cheese (~230g)'}: 720 {language === 'hebrew' ? 'קק״ל' : 'kcal'} | 25ג&apos; {language === 'hebrew' ? 'P' : 'P'} | 65ג&apos; {language === 'hebrew' ? 'C' : 'C'} | 45ג&apos; {language === 'hebrew' ? 'F' : 'F'}</div>
                                  <div>2. {language === 'hebrew' ? 'חביתה פשוטה (כ-200ג&apos;)' : 'Simple omelet (~200g)'}: 300 {language === 'hebrew' ? 'קק״ל' : 'kcal'} | 18ג&apos; {language === 'hebrew' ? 'P' : 'P'} | 2ג&apos; {language === 'hebrew' ? 'C' : 'C'} | 25ג&apos; {language === 'hebrew' ? 'F' : 'F'}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Action buttons - Voice mode */}
                          <div 
                            className={`mt-3 space-y-2 transition-all duration-500 ${
                              chatAnimation.showButtons 
                                ? 'opacity-100 translate-y-0' 
                                : 'opacity-0 translate-y-4'
                            }`}
                            style={{
                              animation: chatAnimation.showButtons ? 'slideUp 0.5s ease-out' : 'none'
                            }}
                          >
                            <button className={`w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2`}>
                              <span>📝</span>
                              <span>{language === 'hebrew' ? 'תיעוד ארוחה זו' : 'Log this meal'}</span>
                            </button>
                            <button className={`w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2`}>
                              <span>🧀</span>
                              <span>{language === 'hebrew' ? 'הפחתת כמות הגבינה' : 'Reduce the amount of cheese'}</span>
                            </button>
                          </div>
                          
                          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                            {language === 'hebrew' ? '14:33' : '2:33 PM'}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Text Mode */}
                {chatMode === 'text' && (
                  <>
                    {/* User sends text message */}
                    <div 
                      className={`flex justify-end transition-all duration-500 ${
                        chatAnimation.showTextMessage 
                          ? 'opacity-100 translate-x-0' 
                          : 'opacity-0 translate-x-4'
                      }`}
                      style={{
                        animation: chatAnimation.showTextMessage ? 'slideInRight 0.5s ease-out' : 'none'
                      }}
                    >
                      <div className="max-w-[75%]">
                        <div className={`${isDarkMode ? 'bg-green-700' : 'bg-[#dcf8c6]'} rounded-lg rounded-tr-none p-3 shadow-sm`}>
                          <p className={`${isDarkMode ? 'text-white' : 'text-gray-800'} text-sm`}>
                            {language === 'hebrew' 
                              ? 'אכלתי קרפ 240ג&apos; עם חלב מרוכז ממותק.'
                              : 'I ate a 240g crepe with sweetened condensed milk.'}
                          </p>
                        </div>
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1 text-right`}>
                          {language === 'hebrew' ? '14:32' : '2:32 PM'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Typing indicator */}
                    {chatAnimation.showTyping && (
                      <div 
                        className="flex justify-start animate-fadeIn"
                        style={{
                          animation: 'fadeIn 0.3s ease-in'
                        }}
                      >
                        <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-white'} rounded-lg rounded-tl-none p-3 shadow-sm`}>
                          <div className="flex space-x-1">
                            <div className={`w-2 h-2 ${isDarkMode ? 'bg-gray-400' : 'bg-gray-500'} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }}></div>
                            <div className={`w-2 h-2 ${isDarkMode ? 'bg-gray-400' : 'bg-gray-500'} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }}></div>
                            <div className={`w-2 h-2 ${isDarkMode ? 'bg-gray-400' : 'bg-gray-500'} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Bot response - Text mode */}
                    {chatAnimation.showBotMessage && (
                      <div 
                        className={`flex justify-start transition-all duration-500 ${
                          chatAnimation.showBotMessage 
                            ? 'opacity-100 translate-x-0' 
                            : 'opacity-0 -translate-x-4'
                        }`}
                        style={{
                          animation: chatAnimation.showBotMessage ? 'slideInLeft 0.5s ease-out' : 'none'
                        }}
                      >
                        <div className="max-w-[85%]">
                          <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-white'} rounded-lg rounded-tl-none p-4 shadow-sm`}>
                            <div className={`${isDarkMode ? 'text-gray-100' : 'text-gray-800'} text-sm space-y-2`}>
                              <div>
                                <span className="font-semibold">*{language === 'hebrew' ? 'ציון' : 'Rating'}*</span>: 3/10
                              </div>
                              <div>
                                <span className="font-semibold">*{language === 'hebrew' ? 'סיבה' : 'Reason'}*</span>: {language === 'hebrew' 
                                  ? 'עשיר בסוכר ופחמימות פשוטות, בעל ערך תזונתי נמוך.'
                                  : 'High in sugar and simple carbohydrates with low nutritional value.'}
                              </div>
                              <div>
                                <span className="font-semibold">*{language === 'hebrew' ? 'התאמה לתוכנית' : 'Plan Match'}*</span>: ❌ {language === 'hebrew' ? 'בחירה לא מומלצת' : 'Very poor choice'}
                              </div>
                              <div className="pt-2 border-t border-gray-300">
                                <span className="font-semibold">📊 *{language === 'hebrew' ? 'ניתוח' : 'Analysis'}*</span>:
                                <div className="mt-2 text-xs space-y-1 font-mono">
                                  <div>{language === 'hebrew' ? 'סה״כ' : 'Total'}: 500 {language === 'hebrew' ? 'קק״ל' : 'kcal'} | 12ג&apos; {language === 'hebrew' ? 'חלבון' : 'protein'} | 75ג&apos; {language === 'hebrew' ? 'פחמימה' : 'carbs'} | 28ג&apos; {language === 'hebrew' ? 'שומן' : 'fat'}</div>
                                  <div>1. {language === 'hebrew' ? 'קרפ שוקולד עם חלב מרוכז ממותק (כ-240ג&apos;)' : 'Chocolate crepe with sweetened condensed milk (~240g)'}: 500 {language === 'hebrew' ? 'קק״ל' : 'kcal'} | 12ג&apos; {language === 'hebrew' ? 'P' : 'P'} | 75ג&apos; {language === 'hebrew' ? 'C' : 'C'} | 28ג&apos; {language === 'hebrew' ? 'F' : 'F'}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Action buttons - Text mode */}
                          <div 
                            className={`mt-3 space-y-2 transition-all duration-500 ${
                              chatAnimation.showButtons 
                                ? 'opacity-100 translate-y-0' 
                                : 'opacity-0 translate-y-4'
                            }`}
                            style={{
                              animation: chatAnimation.showButtons ? 'slideUp 0.5s ease-out' : 'none'
                            }}
                          >
                            <button className={`w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2`}>
                              <span>📝</span>
                              <span>{language === 'hebrew' ? 'תיעוד ארוחה זו' : 'Log this meal'}</span>
                            </button>
                            <button className={`w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2`}>
                              <span>🚫</span>
                              <span>{language === 'hebrew' ? 'ללא חלב מרוכז' : 'Remove condensed milk'}</span>
                            </button>
                            <button className={`w-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 hover:from-green-600 hover:via-emerald-600 hover:to-green-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2`}>
                              <span>🥞</span>
                              <span>{language === 'hebrew' ? 'חצי מנה' : 'Half portion'}</span>
                            </button>
                          </div>
                          
                          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                            {language === 'hebrew' ? '14:33' : '2:33 PM'}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* CSS Animations */}
              <style>{`
                @keyframes slideInRight {
                  from {
                    opacity: 0;
                    transform: translateX(20px);
                  }
                  to {
                    opacity: 1;
                    transform: translateX(0);
                  }
                }
                
                @keyframes slideInLeft {
                  from {
                    opacity: 0;
                    transform: translateX(-20px);
                  }
                  to {
                    opacity: 1;
                    transform: translateX(0);
                  }
                }
                
                @keyframes slideUp {
                  from {
                    opacity: 0;
                    transform: translateY(10px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
                
                @keyframes fadeIn {
                  from {
                    opacity: 0;
                  }
                  to {
                    opacity: 1;
                  }
                }
                
                @keyframes bounce-down {
                  0%, 100% {
                    transform: translateY(0);
                  }
                  50% {
                    transform: translateY(10px);
                  }
                }
                
                @keyframes bounce-slow {
                  0%, 100% {
                    transform: translateY(0) scale(1);
                  }
                  25% {
                    transform: translateY(-8px) scale(1.05);
                  }
                  50% {
                    transform: translateY(0) scale(1);
                  }
                  75% {
                    transform: translateY(-4px) scale(1.02);
                  }
                }
                
                @keyframes shake {
                  0%, 100% {
                    transform: translateX(0) rotate(0deg);
                  }
                  10%, 30%, 50%, 70%, 90% {
                    transform: translateX(-5px) rotate(-2deg);
                  }
                  20%, 40%, 60%, 80% {
                    transform: translateX(5px) rotate(2deg);
                  }
                }
                
                @keyframes slideInFromButton {
                  from {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.7);
                  }
                  to {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                  }
                }
                
                .animate-bounce-down {
                  animation: bounce-down 1.5s ease-in-out infinite;
                }
                
                .animate-bounce-slow {
                  animation: bounce-slow 2s ease-in-out infinite;
                }
                
                .animate-bounce-slow:hover {
                  animation: shake 0.5s ease-in-out;
                }
                
                .animate-slideInFromButton {
                  animation: slideInFromButton 0.5s ease-out forwards;
                }
              `}</style>
            </div>
            
            <div className="mt-4 text-center">
              <p className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} italic`}>
                {language === 'hebrew' ? 'דוגמה לשיחה אמיתית ב-WhatsApp' : 'Example of a real WhatsApp conversation'}
              </p>
            </div>
          </div>
        </section>

        {/* Why Choose BetterChoice Section */}
        <section className="py-12 sm:py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 sm:mb-16">
              <h3 className={`text-3xl sm:text-4xl md:text-5xl font-semibold ${themeClasses.textPrimary} mb-4`}>
                <span className={isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}>
                  {language === 'hebrew' ? 'למה BetterChoice?' : 'Why BetterChoice?'}
                </span>
              </h3>
              <p className={`text-lg sm:text-xl ${themeClasses.textSecondary} mt-4 max-w-2xl mx-auto`}>
                {language === 'hebrew' 
                  ? 'כי תזונה טובה צריכה להיות פשוטה, אישית ותמיד שם בשבילך.'
                  : 'Because good nutrition should be simple, personal, and always there for you.'}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-12">
              {/* Point 1 */}
              <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-6 border-l-4 ${isDarkMode ? 'border-emerald-400' : 'border-emerald-500'} hover:shadow-lg transition-shadow duration-300`}>
                <div className="flex items-start mb-4">
                  <div className="text-3xl mr-4">💬</div>
                  <div className="flex-1">
                    <h4 className={`text-xl font-semibold ${themeClasses.textPrimary} mb-2`}>
                      {language === 'hebrew' ? 'תזונה מותאמת אישית, בכל רגע' : 'Nutrition Tailored to You, Anytime'}
                    </h4>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} leading-relaxed`}>
                  {language === 'hebrew' 
                    ? 'יש לך שאלה? פשוט שואלים. מקבלים תשובה מותאמת אישית עכשיו - מה לאכול? מתי? וכמה?'
                    : 'Have a question? Just ask. Get a personalized answer instantly - what to eat, when, and how much.'}
                </p>
              </div>
              
              {/* Point 2 */}
              <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-6 border-l-4 ${isDarkMode ? 'border-emerald-400' : 'border-emerald-500'} hover:shadow-lg transition-shadow duration-300`}>
                <div className="flex items-start mb-4">
                  <div className="text-3xl mr-4">🌱</div>
                  <div className="flex-1">
                    <h4 className={`text-xl font-semibold ${themeClasses.textPrimary} mb-2`}>
                      {language === 'hebrew' ? 'תכנית שגדלה איתך' : 'A Plan That Grows With You'}
                    </h4>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} leading-relaxed`}>
                  {language === 'hebrew'
                    ? 'אנחנו לומדים את ההרגלים, סדר היום והפעילות שלך - ומתאימים את עצמנו אליך. לא עוד תפריטים נוקשים שלא עובדים במציאות.'
                    : 'We learn your habits, routine, and activity levels to adapt to you. No more rigid meal plans that don\'t work.'}
                </p>
              </div>
              
              {/* Point 3 */}
              <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-6 border-l-4 ${isDarkMode ? 'border-emerald-400' : 'border-emerald-500'} hover:shadow-lg transition-shadow duration-300`}>
                <div className="flex items-start mb-4">
                  <div className="text-3xl mr-4">👩‍⚕️</div>
                  <div className="flex-1">
                    <h4 className={`text-xl font-semibold ${themeClasses.textPrimary} mb-2`}>
                      {language === 'hebrew' ? 'ליווי של דיאטניות קליניות' : 'Guided by Clinical Dietitians'}
                    </h4>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} leading-relaxed`}>
                  {language === 'hebrew'
                    ? 'מאחורי כל המלצה עומדת דיאטנית אמיתית. ייעוצים חודשיים ופיקוח מקצועי מבטיחים תוכנית בטוחה ויעילה.'
                    : 'Behind every recommendation is a real dietitian. Monthly consultations and professional oversight ensure your plan is safe and effective.'}
                </p>
              </div>
              
              {/* Point 4 */}
              <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-6 border-l-4 ${isDarkMode ? 'border-emerald-400' : 'border-emerald-500'} hover:shadow-lg transition-shadow duration-300`}>
                <div className="flex items-start mb-4">
                  <div className="text-3xl mr-4">💚</div>
                  <div className="flex-1">
                    <h4 className={`text-xl font-semibold ${themeClasses.textPrimary} mb-2`}>
                      {language === 'hebrew' ? 'מחובר לחיים שלך' : 'Connected to Your Life'}
                    </h4>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} leading-relaxed`}>
                  {language === 'hebrew'
                    ? 'התזונה מתעדכנת לפי איכות השינה, כמות הצעדים והתחושה האישית שלך - כדי לספק המלצות שמתאימות למצבך האמיתי.'
                    : 'Nutrition updates based on your sleep, steps, and well-being to provide recommendations that match your current reality.'}
                </p>
              </div>
              
              {/* Point 5 */}
              <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-6 border-l-4 ${isDarkMode ? 'border-emerald-400' : 'border-emerald-500'} hover:shadow-lg transition-shadow duration-300`}>
                <div className="flex items-start mb-4">
                  <div className="text-3xl mr-4">✨</div>
                  <div className="flex-1">
                    <h4 className={`text-xl font-semibold ${themeClasses.textPrimary} mb-2`}>
                      {language === 'hebrew' ? 'פשוט, יעיל, ומותאם לך' : 'Simple, Effective, Made for You'}
                    </h4>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} leading-relaxed`}>
                  {language === 'hebrew'
                    ? 'כלים חכמים שעוזרים לך לבחור נכון, להתאים את התזונה לאורח החיים שלך ולייצר שינויים קטנים עם השפעה גדולה - ללא מאמץ מיותר.'
                    : 'Smart tools that help you choose correctly, adapt nutrition to your lifestyle, and make small changes with big impact - without the frustration.'}
                </p>
              </div>
              
              {/* Point 6 - Differentiation */}
              <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-6 border-l-4 ${isDarkMode ? 'border-emerald-400' : 'border-emerald-500'} hover:shadow-lg transition-shadow duration-300`}>
                <div className="flex items-start mb-4">
                  <div className="text-3xl mr-4">🌿</div>
                  <div className="flex-1">
                    <h4 className={`text-xl font-semibold ${themeClasses.textPrimary} mb-2`}>
                      {language === 'hebrew' ? 'שינוי אמיתי, צעד אחר צעד' : 'Real Change, Step by Step'}
                    </h4>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} leading-relaxed`}>
                  {language === 'hebrew'
                    ? 'אנחנו לא בונים "תפריט נוקשה". אנחנו עוזרים לך לקבל החלטה אחת טובה יותר בכל פעם - וזה מה שיוצר שינוי אמיתי.'
                    : 'We don\'t create rigid menus. We help you make one better decision at a time, leading to lasting change.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Emotional Transformation Section */}
        <section className="py-12 sm:py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 sm:mb-16">
              <h3 className={`text-3xl sm:text-4xl md:text-5xl font-bold ${themeClasses.textPrimary} mb-4`}>
                <span className={isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}>
                  {language === 'hebrew' ? 'השינוי שאתם מרגישים' : 'The Transformation You Feel'}
                </span>
              </h3>
              <p className={`text-lg sm:text-xl ${themeClasses.textSecondary} max-w-3xl mx-auto`}>
                {language === 'hebrew' 
                  ? 'זה לא רק על מה שאתם מקבלים - זה על איך שאתם מרגישים'
                  : 'It\'s not just about what you get-it\'s about how you feel'}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
              {/* Weight Change: From Frustration to Freedom */}
              <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-8 hover:shadow-2xl transition-all duration-300 border-l-4 ${isDarkMode ? 'border-emerald-400' : 'border-emerald-500'}`}>
                <div className="flex items-start mb-4">
                  <div className="text-4xl mr-4">🦋</div>
                  <div className="flex-1">
                    <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-3`}>
                      {language === 'hebrew' ? 'מתסכול לחופש' : 'From Frustration to Freedom'}
                    </h4>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} text-lg leading-relaxed mb-4`}>
                  {language === 'hebrew'
                    ? 'מפסיקים להילחם באוכל. מתחילים להזין את החיים.'
                    : 'Stop fighting your food. Start fueling your life.'}
                </p>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'דמיינו שאתם קמים בבוקר בתחושת קלילות, ביטחון ושליטה אמיתית. לא עוד "דיאטה" - אלא פשוט בחירות טובות יותר שנשארות לאורך זמן. הגיע הזמן לאהוב את מה שאתם רואים במראה, ובעיקר את איך שאתם מרגישים עם עצמכם.'
                    : 'Imagine waking up feeling light, confident, and finally in control. No more "diets"-just better choices that actually last. It\'s time to love what you see in the mirror and, more importantly, how you feel in your skin.'}
                </p>
              </div>
              
              {/* Higher Energy: From Survival to Vitality */}
              <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-8 hover:shadow-2xl transition-all duration-300 border-l-4 ${isDarkMode ? 'border-yellow-400' : 'border-yellow-500'}`}>
                <div className="flex items-start mb-4">
                  <div className="text-4xl mr-4">⚡</div>
                  <div className="flex-1">
                    <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-3`}>
                      {language === 'hebrew' ? 'מהישרדות לחיוניות' : 'From Survival to Vitality'}
                    </h4>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} text-lg leading-relaxed mb-4`}>
                  {language === 'hebrew'
                    ? 'מפסיקים לעבוד על "על ריק".'
                    : 'Stop running on empty.'}
                </p>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'לא עוד נפילות אנרגיה בצהריים או תחושת "זומבי". דמיינו שיש לכם את החיוניות לכבוש את היעדים בעבודה, ועדיין שישאר לכם המון כוח לאנשים שאתם הכי אוהבים בבית. תחזירו לעצמכם את הניצוץ.'
                    : 'No more afternoon crashes or "zombie mode." Imagine having the vibrant energy to crush your goals at work and still have plenty left for the people who matter most at home. Get your spark back.'}
                </p>
              </div>
              
              {/* Tightening: From Hidden to Proud */}
              <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-8 hover:shadow-2xl transition-all duration-300 border-l-4 ${isDarkMode ? 'border-blue-400' : 'border-blue-500'}`}>
                <div className="flex items-start mb-4">
                  <div className="text-4xl mr-4">💪</div>
                  <div className="flex-1">
                    <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-3`}>
                      {language === 'hebrew' ? 'מהסתרה לגאווה' : 'From Hidden to Proud'}
                    </h4>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} text-lg leading-relaxed mb-4`}>
                  {language === 'hebrew'
                    ? 'מרגישים את החוזק מבפנים.'
                    : 'Feel the strength beneath the surface.'}
                </p>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'זאת התחושה שהבגדים יושבים בדיוק במקום, שהגוף מרגיש אסוף, חטוב וחזק. חיטוב הוא לא רק מראה - הוא הביטחון השקט שנובע מהידיעה שהגוף שלכם בשיאו.'
                    : 'It\'s that feeling of your clothes fitting perfectly and your body feeling "held" and firm. Tightening isn\'t just about looks; it\'s about the quiet confidence of knowing your body is at its peak.'}
                </p>
              </div>
              
              {/* Muscle Mass: From Effort to Power */}
              <div className={`${themeClasses.bgCard} rounded-2xl ${themeClasses.shadowCard} p-8 hover:shadow-2xl transition-all duration-300 border-l-4 ${isDarkMode ? 'border-purple-400' : 'border-purple-500'}`}>
                <div className="flex items-start mb-4">
                  <div className="text-4xl mr-4">🏆</div>
                  <div className="flex-1">
                    <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-3`}>
                      {language === 'hebrew' ? 'ממאמץ לכוח' : 'From Effort to Power'}
                    </h4>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} text-lg leading-relaxed mb-4`}>
                  {language === 'hebrew'
                    ? 'בונים גוף שיכול לעשות הכל.'
                    : 'Build a body that can handle anything.'}
                </p>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'יש גאווה מיוחדת בלראות את עצמך מתחזק משבוע לשבוע. לבנות את השרירים שיסחבו אתכם דרך אתגרי החיים בקלות. זה לא רק נפח - זה כוח אמיתי שהרווחתם ביושר.'
                    : 'There is a unique pride in watching yourself grow stronger every week. Build the muscle that carries you through life\'s challenges with ease. It\'s more than just mass-it\'s pure, earned power.'}
                </p>
              </div>
            </div>
            
            {/* CTA Button */}
            <div className="text-center mt-12 sm:mt-16">
              <button 
                onClick={() => {
                  if (!isAuthenticated) {
                    window.location.href = '/login';
                  } else {
                    window.location.href = '/profile';
                  }
                }}
                className={`${isDarkMode 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400' 
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                } text-white px-8 sm:px-12 py-4 sm:py-5 rounded-full text-lg sm:text-xl font-semibold transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl`}
              >
                {language === 'hebrew' ? 'התחל את השינוי שלך' : 'Start Your Transformation'}
              </button>
            </div>
          </div>
        </section>

        {/* Closing Statement Section */}
        <section className="py-16 sm:py-20 md:py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="mb-6">
              <span className="text-5xl sm:text-6xl">🌿</span>
            </div>
            <h3 className={`text-3xl sm:text-4xl md:text-5xl font-semibold ${themeClasses.textPrimary} mb-6 leading-tight`}>
              <span className={isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}>
                {language === 'hebrew' ? 'BetterChoice' : 'BetterChoice'}
              </span>
              <br />
              <span className={`${themeClasses.textPrimary} text-2xl sm:text-3xl md:text-4xl font-normal`}>
                {language === 'hebrew' 
                  ? 'תזונה פשוטה. בחירות טובות יותר. כל יום.' 
                  : 'Simple nutrition. Better choices. Every day.'}
              </span>
            </h3>
            <p className={`text-lg sm:text-xl ${themeClasses.textSecondary} max-w-2xl mx-auto italic`}>
              {language === 'hebrew'
                ? 'כי כל החלטה טובה מובילה לשינוי אמיתי'
                : 'Because every good choice leads to real change'}
            </p>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-12 sm:py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 sm:mb-16">
              <h3 className={`text-3xl sm:text-4xl md:text-5xl font-semibold ${themeClasses.textPrimary} mb-4`}>
                <span className={isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}>
                  {language === 'hebrew' ? 'איך זה עובד?' : 'How It Works'}
                </span>
              </h3>
              <p className={`text-lg sm:text-xl ${themeClasses.textSecondary} mt-4 max-w-2xl mx-auto`}>
                {language === 'hebrew' 
                  ? 'פשוט, טבעי ומותאם עבורך.'
                  : 'Simple, natural, and tailored to you.'}
              </p>
            </div>
            
            {/* Flow Layout */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-6 md:gap-8 mb-8">
              {/* Step 1 */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 border-t-4 border-green-500 ${themeClasses.shadowHover} transition-shadow duration-300 flex-1 max-w-xs text-center`}>
                <div className="text-sm font-bold text-green-600 mb-2">{language === 'hebrew' ? 'שלב 1:' : 'Step 1:'}</div>
                <div className="text-4xl mb-4">💬</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>
                  {language === 'hebrew' ? 'מדברים בוואטסאפ' : 'Chat on WhatsApp'}
                </h4>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'שואלים מה כדאי לאכול עכשיו ומקבלים תשובה מיידית.'
                    : 'Ask what to eat right now and get an immediate response.'}
                </p>
              </div>
              
              {/* Arrow */}
              <div className={`text-3xl ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} hidden md:block`}>
                {language === 'hebrew' ? '←' : '→'}
              </div>
              
              {/* Step 2 */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 border-t-4 border-green-500 ${themeClasses.shadowHover} transition-shadow duration-300 flex-1 max-w-xs text-center`}>
                <div className="text-sm font-bold text-green-600 mb-2">{language === 'hebrew' ? 'שלב 2:' : 'Step 2:'}</div>
                <div className="text-4xl mb-4">🎯</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>
                  {language === 'hebrew' ? 'מקבלים המלצה אישית' : 'Get Instant Recommendations'}
                </h4>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'תשובה המותאמת לגוף שלך, למטרות ולמצב הנוכחי.'
                    : 'Receive answers tailored to your body, goals, and current situation.'}
                </p>
              </div>
              
              {/* Arrow */}
              <div className={`text-3xl ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} hidden md:block`}>
                {language === 'hebrew' ? '←' : '→'}
              </div>
              
              {/* Step 3 */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 border-t-4 border-green-500 ${themeClasses.shadowHover} transition-shadow duration-300 flex-1 max-w-xs text-center`}>
                <div className="text-sm font-bold text-green-600 mb-2">{language === 'hebrew' ? 'שלב 3:' : 'Step 3:'}</div>
                <div className="text-4xl mb-4">🧠</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>
                  {language === 'hebrew' ? 'המערכת לומדת אותך' : 'The System Learns You'}
                </h4>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'כל שיחה משפרת את הדיוק והבנת ההרגלים והצרכים שלך.'
                    : 'Every interaction improves our understanding of your habits and needs.'}
                </p>
              </div>
              
              {/* Arrow */}
              <div className={`text-3xl ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} hidden md:block`}>
                {language === 'hebrew' ? '←' : '→'}
              </div>
              
              {/* Step 4 */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 border-t-4 border-green-500 ${themeClasses.shadowHover} transition-shadow duration-300 flex-1 max-w-xs text-center`}>
                <div className="text-sm font-bold text-green-600 mb-2">{language === 'hebrew' ? 'שלב 4:' : 'Step 4:'}</div>
                <div className="text-4xl mb-4">🔄</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>
                  {language === 'hebrew' ? 'התוכנית מתעדכנת אוטומטית' : 'Your Plan Updates Automatically'}
                </h4>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'ההמלצות משתנות בהתאם להתקדמות ולשינויים באורח החיים.'
                    : 'Recommendations evolve based on your progress and lifestyle changes.'}
                </p>
              </div>
            </div>
            
            {/* Flow Summary */}
            <div className="text-center mt-8">
              <p className={`text-lg sm:text-xl ${themeClasses.textSecondary} max-w-3xl mx-auto`}>
                {language === 'hebrew'
                  ? 'מדברים בוואטסאפ ← המלצה מיידית ← המערכת לומדת ← התוכנית מתעדכנת'
                  : 'Chat on WhatsApp → Get Instant Recommendations → System Learns → Plan Updates Automatically'}
              </p>
            </div>
          </div>
        </section>


        {/* Testimonials Section */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-4`}>{t.testimonials.title}</h3>
              <p className={`text-xl ${themeClasses.textSecondary}`}>{t.testimonials.subtitle}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="flex items-center mb-4">
                  <div className={`w-12 h-12 ${isDarkMode ? 'bg-gray-700' : 'bg-indigo-100'} rounded-full flex items-center justify-center mr-4`}>
                    <span className={`${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} font-bold text-lg`}>{t.testimonials.sarah.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h5 className={`font-bold ${themeClasses.textPrimary}`}>{t.testimonials.sarah.name}</h5>
                    <p className={`${themeClasses.textSecondary} text-sm`}>{t.testimonials.sarah.location}</p>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} italic`}>
                  "{t.testimonials.sarah.text}"
                </p>
                <div className="flex text-yellow-400 mt-4">
                  ⭐⭐⭐⭐⭐
                </div>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="flex items-center mb-4">
                  <div className={`w-12 h-12 ${isDarkMode ? 'bg-gray-700' : 'bg-indigo-100'} rounded-full flex items-center justify-center mr-4`}>
                    <span className={`${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} font-bold text-lg`}>{t.testimonials.michael.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h5 className={`font-bold ${themeClasses.textPrimary}`}>{t.testimonials.michael.name}</h5>
                    <p className={`${themeClasses.textSecondary} text-sm`}>{t.testimonials.michael.location}</p>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} italic`}>
                  "{t.testimonials.michael.text}"
                </p>
                <div className="flex text-yellow-400 mt-4">
                  ⭐⭐⭐⭐⭐
                </div>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6`}>
                <div className="flex items-center mb-4">
                  <div className={`w-12 h-12 ${isDarkMode ? 'bg-gray-700' : 'bg-indigo-100'} rounded-full flex items-center justify-center mr-4`}>
                    <span className={`${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} font-bold text-lg`}>{t.testimonials.rachel.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h5 className={`font-bold ${themeClasses.textPrimary}`}>{t.testimonials.rachel.name}</h5>
                    <p className={`${themeClasses.textSecondary} text-sm`}>{t.testimonials.rachel.location}</p>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} italic`}>
                  "{t.testimonials.rachel.text}"
                </p>
                <div className="flex text-yellow-400 mt-4">
                  ⭐⭐⭐⭐⭐
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section data-tour="pricing-section" className="py-20" id="know-your-numbers">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-4 relative">
              <h3 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-4`}>
                {language === 'hebrew' ? 'תוכניות המנוי שלנו' : 'Our Subscription Plans'}
              </h3>
              <p className={`text-xl ${themeClasses.textSecondary} mb-8`}>
                {language === 'hebrew' ? 'זה לא רק תוכנית - זה השינוי שאתם רוצים להרגיש.' : 'It\'s not just a plan-it\'s the transformation you want to feel.'}
              </p>
              
              {/* Toggle Controls */}
              <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-8 sm:mb-12`}>
                {/* Commitment Toggle */}
                <div className={`${themeClasses.bgCard} rounded-2xl p-2 border-2 ${themeClasses.borderPrimary} w-full sm:w-auto`}>
                  <div className="flex">
                    <button 
                      onClick={() => setCommitmentPeriod(3)}
                      className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 ${
                        commitmentPeriod === 3 
                          ? 'bg-emerald-500 text-white shadow-lg' 
                          : `${themeClasses.textSecondary} hover:${themeClasses.textPrimary}`
                      }`}
                    >
                      {language === 'hebrew' ? '3 חודשים' : '3 Months'}
                    </button>
                    <button 
                      onClick={() => setCommitmentPeriod(6)}
                      className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 relative ${
                        commitmentPeriod === 6 
                          ? 'bg-emerald-500 text-white shadow-lg' 
                          : `${themeClasses.textSecondary} hover:${themeClasses.textPrimary}`
                      }`}
                    >
                      {language === 'hebrew' ? '6 חודשים' : '6 Months'}
                      <span className="absolute -top-2 -right-2 bg-orange-400 text-white text-xs px-2 py-1 rounded-full">
                        {language === 'hebrew' ? 'חיסכון' : 'Save'}
                      </span>
                    </button>
                  </div>
                </div>
                
                {/* Currency Toggle */}
                <div className={`${themeClasses.bgCard} rounded-2xl p-2 border-2 ${themeClasses.borderPrimary} w-full sm:w-auto`}>
                  <div className="flex">
                    <button 
                      onClick={() => setShowUSD(false)}
                      className={`flex-1 sm:flex-none px-4 py-2 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 ${
                        !showUSD 
                          ? 'bg-blue-500 text-white shadow-lg' 
                          : `${themeClasses.textSecondary} hover:${themeClasses.textPrimary}`
                      }`}
                    >
                      ₪ ILS
                    </button>
                    <button 
                      onClick={() => setShowUSD(true)}
                      className={`flex-1 sm:flex-none px-4 py-2 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 ${
                        showUSD 
                          ? 'bg-blue-500 text-white shadow-lg' 
                          : `${themeClasses.textSecondary} hover:${themeClasses.textPrimary}`
                      }`}
                    >
                      $ USD
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Press Me Button */}
              <div className="flex justify-center mb-0">
                <button
                  onClick={() => setShowPlanDetailsModal(true)}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-5 py-2.5 rounded-full font-semibold text-base shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-300 animate-bounce-slow relative group z-10"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xl">😊</span>
                    <span>{language === 'hebrew' ? 'לחץ עליי!' : 'Press Me!'}</span>
                  </span>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-300 rounded-full animate-ping"></span>
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              {/* Basic Plan - Nutrition Only (1x/month) */}
              {nutritionOnlyProduct && (() => {
                const price = getPrice(nutritionOnlyProduct, commitmentPeriod);
                if (!price) return null;
                return (
                  <div className={`${themeClasses.bgCard} border-2 border-blue-400/50 rounded-xl p-6 md:p-8 hover:border-blue-500 hover:shadow-lg transition-all duration-300 relative overflow-hidden`}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                    <div className="text-center">
                      <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>
                        {language === 'hebrew' ? nutritionOnlyProduct.nameHebrew : nutritionOnlyProduct.name}
                      </h4>
                      <div className={`text-4xl font-bold ${themeClasses.textPrimary} mb-6`}>
                        {formatPrice(price.ILS, price.USD)}
                        <span className={`text-lg ${themeClasses.textSecondary}`}>
                          {language === 'hebrew' ? ' לחודש' : '/month'}
                        </span>
                      </div>
                      <ul className="space-y-3 mb-8 text-right" dir={language === 'hebrew' ? 'rtl' : 'ltr'}>
                        {(language === 'hebrew' ? nutritionOnlyProduct.featuresHebrew : nutritionOnlyProduct.features).map((feature, index) => (
                          <li key={index} className="flex items-center">
                            <span className="text-blue-500 mr-3 font-bold">✓</span>
                            <span className={themeClasses.textSecondary}>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <button 
                        onClick={() => handlePlanSelect(STRIPE_PRODUCTS.NUTRITION_ONLY)}
                        disabled={stripeLoading}
                        className={`w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3 rounded-lg font-semibold transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 ${stripeLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {language === 'hebrew' ? 'התחל את השינוי שלי' : 'Start my transformation'}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Nutrition Only - 2x Month */}
              {nutritionOnly2xProduct && (() => {
                const price = getPrice(nutritionOnly2xProduct, commitmentPeriod);
                if (!price) return null;
                return (
                  <div className={`${themeClasses.bgCard} border-2 border-teal-400/50 rounded-xl p-6 md:p-8 hover:border-teal-500 hover:shadow-lg transition-all duration-300 relative overflow-hidden`}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-cyan-500"></div>
                    <div className="text-center">
                      <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>
                        {language === 'hebrew' ? nutritionOnly2xProduct.nameHebrew : nutritionOnly2xProduct.name}
                      </h4>
                      <div className={`text-4xl font-bold ${themeClasses.textPrimary} mb-6`}>
                        {formatPrice(price.ILS, price.USD)}
                        <span className={`text-lg ${themeClasses.textSecondary}`}>
                          {language === 'hebrew' ? ' לחודש' : '/month'}
                        </span>
                      </div>
                      <ul className="space-y-3 mb-8 text-right" dir={language === 'hebrew' ? 'rtl' : 'ltr'}>
                        {(language === 'hebrew' ? nutritionOnly2xProduct.featuresHebrew : nutritionOnly2xProduct.features).map((feature, index) => (
                          <li key={index} className="flex items-center">
                            <span className="text-teal-500 mr-3 font-bold">✓</span>
                            <span className={themeClasses.textSecondary}>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <button 
                        onClick={() => handlePlanSelect(STRIPE_PRODUCTS.NUTRITION_ONLY_2X_MONTH)}
                        disabled={stripeLoading}
                        className={`w-full bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white py-3 rounded-lg font-semibold transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 ${stripeLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {language === 'hebrew' ? 'התחל את השינוי שלי' : 'Start my transformation'}
                      </button>
                    </div>
                  </div>
                );
              })()}
              
              {/* Professional Plan - Nutrition + Training (2x/month) */}
              {nutritionTrainingProduct && (() => {
                const price = getPrice(nutritionTrainingProduct, commitmentPeriod);
                if (!price) return null;
                return (
                  <div className="bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 rounded-xl p-6 md:p-8 text-white relative shadow-2xl transform hover:scale-105 transition-all duration-300">
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                      <span className="bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold shadow-lg">
                        {language === 'hebrew' ? 'הכי פופולרי' : 'Most Popular'}
                      </span>
                    </div>
                    <div className="text-center">
                      <h4 className="text-2xl font-bold mb-4">
                        {language === 'hebrew' ? nutritionTrainingProduct.nameHebrew : nutritionTrainingProduct.name}
                      </h4>
                      <div className="text-4xl font-bold mb-6">
                        {formatPrice(price.ILS, price.USD)}
                        <span className="text-lg opacity-90">
                          {language === 'hebrew' ? ' לחודש' : '/month'}
                        </span>
                      </div>
                      <ul className="space-y-3 mb-8 text-right" dir={language === 'hebrew' ? 'rtl' : 'ltr'}>
                        {(language === 'hebrew' ? nutritionTrainingProduct.featuresHebrew : nutritionTrainingProduct.features).map((feature, index) => (
                          <li key={index} className="flex items-center">
                            <span className="text-yellow-300 mr-3 font-bold text-lg">✓</span>
                            <span className="text-white/95">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <button 
                        onClick={() => handlePlanSelect(STRIPE_PRODUCTS.NUTRITION_TRAINING)}
                        disabled={stripeLoading}
                        className={`w-full bg-white text-emerald-600 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${stripeLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {language === 'hebrew' ? 'התחל את השינוי שלי' : 'Start my transformation'}
                      </button>
                    </div>
                  </div>
                );
              })()}
              
              {/* Premium Plan - BetterPro (Nutrition + Training 1x/month) */}
              {betterProProduct && (() => {
                const price = getPrice(betterProProduct, commitmentPeriod);
                if (!price) return null;
                const threeMonthPrice = getPrice(betterProProduct, 3);
                const sixMonthPrice = getPrice(betterProProduct, 6);
                const savings = threeMonthPrice && sixMonthPrice ? {
                  ILS: threeMonthPrice.ILS - sixMonthPrice.ILS,
                  USD: threeMonthPrice.USD - sixMonthPrice.USD
                } : null;
                return (
                  <div className={`${themeClasses.bgCard} border-2 border-purple-500/70 rounded-xl p-6 md:p-8 hover:border-purple-500 hover:shadow-xl transition-all duration-300 relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 bg-gradient-to-br from-purple-500 to-purple-700 text-white px-3 py-1 text-xs font-bold rounded-bl-lg shadow-lg">
                      {language === 'hebrew' ? 'פרימיום' : 'Premium'}
                    </div>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600"></div>
                    <div className="text-center">
                      <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>
                        {language === 'hebrew' ? betterProProduct.nameHebrew : betterProProduct.name}
                      </h4>
                      <div className={`mb-6`}>
                        <div className={`text-4xl font-bold ${themeClasses.textPrimary}`}>
                          {formatPrice(price.ILS, price.USD)}
                        </div>
                        <div className="flex flex-col items-center">
                          <span className={`text-lg ${themeClasses.textSecondary}`}>
                            {language === 'hebrew' ? ' לחודש' : '/month'}
                          </span>
                          <span className={`text-xs ${themeClasses.textMuted} mt-1`}>
                            {language === 'hebrew' 
                              ? `(${commitmentPeriod === 3 ? 'במסלול 3 חודשים' : 'במסלול 6 חודשים'})` 
                              : `(${commitmentPeriod === 3 ? '3-month plan' : '6-month plan'})`
                            }
                          </span>
                          {commitmentPeriod === 6 && savings && (
                            <div className="text-sm text-emerald-500 font-semibold mt-1">
                              {language === 'hebrew' 
                                ? (showUSD ? `חיסכון של $${Math.round(savings.USD / 100)} בכל חודש` : `חיסכון של ₪${Math.round(savings.ILS / 100)} בכל חודש`)
                                : (showUSD ? `Save up to $${Math.round(savings.USD / 100)}/month` : `Save up to ₪${Math.round(savings.ILS / 100)}/month`)
                              }
                            </div>
                          )}
                        </div>
                      </div>
                      <ul className="space-y-3 mb-8 text-right" dir={language === 'hebrew' ? 'rtl' : 'ltr'}>
                        {(language === 'hebrew' ? betterProProduct.featuresHebrew : betterProProduct.features).map((feature, index) => (
                          <li key={index} className="flex items-center">
                            <span className="text-purple-500 mr-3 font-bold">✓</span>
                            <span className={themeClasses.textSecondary}>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <button 
                        onClick={() => handlePlanSelect(STRIPE_PRODUCTS.NUTRITION_TRAINING_ONCE_MONTH)}
                        disabled={stripeLoading}
                        className={`w-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 hover:from-purple-600 hover:via-pink-600 hover:to-purple-700 text-white py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${stripeLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {language === 'hebrew' ? 'התחל את השינוי שלי' : 'Start my transformation'}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
            
           
          </div>

          {/* Plan Details Thinking Bubble */}
          {showPlanDetailsModal && (
            <>
              {/* Light background overlay */}
              <div 
                className="fixed inset-0 bg-black bg-opacity-20 z-40 transition-opacity duration-300"
                onClick={() => setShowPlanDetailsModal(false)}
              ></div>
              
              {/* Thinking Bubble - centered on screen */}
              <div 
                className="fixed z-50 top-1/2 left-1/2 animate-slideInFromButton"
              >
                <div className={`${themeClasses.bgCard} rounded-2xl shadow-2xl border-2 border-emerald-400/50 max-w-lg w-[90vw] sm:w-[500px] relative`} dir={direction}>
                  
                  {/* Close button */}
                  <button
                    onClick={() => setShowPlanDetailsModal(false)}
                    className={`absolute top-3 ${language === 'hebrew' ? 'left-3' : 'right-3'} text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-xl font-bold z-10`}
                  >
                    ×
                  </button>

                  {/* Header */}
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-4 rounded-t-2xl">
                    <h3 className={`text-xl font-bold text-white text-center`}>
                      {language === 'hebrew' ? 'מה כל תוכנית כוללת' : 'What Every Plan Includes'}
                    </h3>
                  </div>

                  {/* Content */}
                  <div className="px-5 py-5 max-h-[65vh] overflow-y-auto">
                    <div className="space-y-5">
                      {/* Comprehensive First Session */}
                      <div>
                        <h4 className={`text-lg font-bold ${themeClasses.textPrimary} mb-2`}>
                          {language === 'hebrew' ? 'פגישה ראשונה מקיפה:' : 'Comprehensive First Session:'}
                        </h4>
                        <ul className={`space-y-1.5 ${themeClasses.textSecondary} text-sm list-disc list-inside`}>
                          <li>{language === 'hebrew' ? 'היכרות מעמיקה' : 'In-depth introduction'}</li>
                          <li>{language === 'hebrew' ? 'בניית תכנית תזונה מותאמת אישית' : 'Building a personalized nutrition plan'}</li>
                          <li>{language === 'hebrew' ? 'בתוכניות משולבות - גם בניית תכנית אימונים' : 'For combined plans - also building a training plan'}</li>
                        </ul>
                      </div>

                      {/* Follow-up Sessions */}
                      <div>
                        <h4 className={`text-lg font-bold ${themeClasses.textPrimary} mb-2`}>
                          {language === 'hebrew' ? 'פגישות מעקב:' : 'Follow-up Sessions:'}
                        </h4>
                        <ul className={`space-y-2 ${themeClasses.textSecondary} text-sm`}>
                          <li>
                            <span className="font-semibold">{language === 'hebrew' ? 'פגישה אחת לשבועיים:' : 'One session every two weeks:'}</span>{' '}
                            {language === 'hebrew' 
                              ? 'מתאימה למי שרוצה ליווי צמוד יותר, דיוק ונוכחות גבוהה של הדיאטן/נית שלנו לאורך הדרך.'
                              : 'Suitable for those who want closer guidance, precision and high presence of our dietician/nutritionist throughout the process.'}
                          </li>
                          <li>
                            <span className="font-semibold">{language === 'hebrew' ? 'פגישה אחת לחודש:' : 'One session per month:'}</span>{' '}
                            {language === 'hebrew' 
                              ? 'מתאימה למי שמעדיף מרווחים, עבודה הדרגתית ועצמאות גבוהה יותר.'
                              : 'Suitable for those who prefer intervals, gradual work and higher independence.'}
                          </li>
                        </ul>
                      </div>

                      {/* Personal WhatsApp Guidance */}
                      <div>
                        <h4 className={`text-lg font-bold ${themeClasses.textPrimary} mb-2`}>
                          {language === 'hebrew' ? 'ליווי אישי ב-WhatsApp:' : 'Personal WhatsApp Guidance:'}
                        </h4>
                        <ul className={`space-y-1.5 ${themeClasses.textSecondary} text-sm list-disc list-inside`}>
                          <li>{language === 'hebrew' ? 'מענה על שאלות' : 'Answering questions'}</li>
                          <li>{language === 'hebrew' ? 'התייעצויות שוטפות' : 'Ongoing consultations'}</li>
                          <li>{language === 'hebrew' ? 'דיוקים בזמן אמת' : 'Real-time adjustments'}</li>
                        </ul>
                      </div>

                      {/* Personal Adjustments */}
                      <div>
                        <h4 className={`text-lg font-bold ${themeClasses.textPrimary} mb-2`}>
                          {language === 'hebrew' ? 'התאמות אישיות:' : 'Personal Adjustments:'}
                        </h4>
                        <p className={`${themeClasses.textSecondary} text-sm`}>
                          {language === 'hebrew' 
                            ? 'לפי התקדמות, תחושות ומציאות משתנה'
                            : 'According to progress, feelings and changing reality'}
                        </p>
                      </div>

                      {/* Commitment Periods */}
                      <div>
                        <h4 className={`text-lg font-bold ${themeClasses.textPrimary} mb-2`}>
                          {language === 'hebrew' ? 'תקופות מחויבות:' : 'Commitment Periods:'}
                        </h4>
                        <ul className={`space-y-1.5 ${themeClasses.textSecondary} text-sm`}>
                          <li>
                            <span className="font-semibold">3 {language === 'hebrew' ? 'חודשים:' : 'months:'}</span>{' '}
                            {language === 'hebrew' 
                              ? 'תהליך ממוקד, יצירת בסיס והנעה'
                              : 'Focused process, creating foundation and momentum'}
                          </li>
                          <li>
                            <span className="font-semibold">6 {language === 'hebrew' ? 'חודשים:' : 'months:'}</span>{' '}
                            {language === 'hebrew' 
                              ? 'תהליך עמוק, יציב ומבוסס הרגלים לאורך זמן'
                              : 'Deep process, stable and habit-based over time'}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>


        {/* Stats Section */}
        <section className={`py-12 sm:py-16 md:py-20 ${isDarkMode ? 'bg-gradient-to-r from-emerald-700 via-green-700 to-emerald-800' : 'bg-gradient-to-r from-emerald-400 via-green-500 to-emerald-500'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8 text-center">
              <div className="text-white">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1 sm:mb-2">15K+</div>
                <div className="text-sm sm:text-base md:text-xl opacity-90">
                  {language === 'hebrew' ? 'משתמשים מרוצים' : 'Satisfied Users'}
                </div>
              </div>
              <div className="text-white">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1 sm:mb-2">98%</div>
                <div className="text-sm sm:text-base md:text-xl opacity-90">
                  {language === 'hebrew' ? 'שיעור הצלחה' : 'Success Rate'}
                </div>
              </div>
              <div className="text-white">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1 sm:mb-2">24/7</div>
                <div className="text-sm sm:text-base md:text-xl opacity-90">
                  {language === 'hebrew' ? 'תמיכה זמינה' : 'Available Support'}
                </div>
              </div>
              <div className="text-white">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1 sm:mb-2">50+</div>
                <div className="text-sm sm:text-base md:text-xl opacity-90">
                  {language === 'hebrew' ? 'דיאטנים קליניים' : 'Clinical Dietitians'}
                </div>
              </div>
            </div>
          </div>
        </section>



        {/* Celebrations Section */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-4`}>{t.celebrations.title}</h3>
              <p className={`text-xl ${themeClasses.textSecondary}`}>{t.celebrations.subtitle}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 ${themeClasses.shadowHover} transition-shadow duration-300`}>
                <div className="flex items-center mb-4">
                  <div className={`w-12 h-12 ${isDarkMode ? 'bg-yellow-900' : 'bg-yellow-100'} rounded-full flex items-center justify-center mr-4`}>
                    <span className="text-yellow-600 text-2xl">🎉</span>
                  </div>
                  <div>
                    <div className={`font-bold ${themeClasses.textPrimary}`}>{t.celebrations.sarah.name}</div>
                    <div className={`${themeClasses.textMuted} text-sm`}>{t.celebrations.sarah.time}</div>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} mb-4`}>"{t.celebrations.sarah.message}"</p>
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2 space-x-reverse">
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                  </div>
                  <span className={`${themeClasses.textMuted} text-sm`}>{t.celebrations.sarah.comments}</span>
                </div>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 ${themeClasses.shadowHover} transition-shadow duration-300`}>
                <div className="flex items-center mb-4">
                  <div className={`w-12 h-12 ${isDarkMode ? 'bg-green-900' : 'bg-green-100'} rounded-full flex items-center justify-center mr-4`}>
                    <span className="text-green-600 text-2xl">🏃‍♂️</span>
                  </div>
                  <div>
                    <div className={`font-bold ${themeClasses.textPrimary}`}>{t.celebrations.michael.name}</div>
                    <div className={`${themeClasses.textMuted} text-sm`}>{t.celebrations.michael.time}</div>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} mb-4`}>"{t.celebrations.michael.message}"</p>
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2 space-x-reverse">
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                  </div>
                  <span className={`${themeClasses.textMuted} text-sm`}>{t.celebrations.michael.comments}</span>
                </div>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 ${themeClasses.shadowHover} transition-shadow duration-300`}>
                <div className="flex items-center mb-4">
                  <div className={`w-12 h-12 ${isDarkMode ? 'bg-blue-900' : 'bg-blue-100'} rounded-full flex items-center justify-center mr-4`}>
                    <span className="text-blue-600 text-2xl">💪</span>
                  </div>
                  <div>
                    <div className={`font-bold ${themeClasses.textPrimary}`}>{t.celebrations.rachel.name}</div>
                    <div className={`${themeClasses.textMuted} text-sm`}>{t.celebrations.rachel.time}</div>
                  </div>
                </div>
                <p className={`${themeClasses.textSecondary} mb-4`}>"{t.celebrations.rachel.message}"</p>
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2 space-x-reverse">
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                    <span className="text-yellow-500">⭐</span>
                  </div>
                  <span className={`${themeClasses.textMuted} text-sm`}>{t.celebrations.rachel.comments}</span>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-12">
              <button 
                onClick={() => {
                  alert(language === 'hebrew' ? 'תכונת שיתוף ההישגים תגיע בקרוב!' : 'Achievement sharing feature coming soon!');
                }}
                className={`bg-gray-400 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 shadow-lg opacity-75 cursor-not-allowed relative`}
              >
                <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                  {language === 'hebrew' ? 'בקרוב' : 'Soon'}
                </span>
                {language === 'hebrew' ? 'שיתוף הישגים - בקרוב' : 'Share Achievement - Coming Soon'}
              </button>
            </div>
          </div>
        </section>


        {/* Professional Platform Section */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-4`}>
                {t.professionalPlatform.title}
              </h3>
              <h4 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-8`}>
                <span className="text-blue-400">{t.professionalPlatform.subtitle}</span>
              </h4>
            </div>
            
            <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-8 mb-16`}>
              <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-8 text-center`}>{t.professionalPlatform.challenges.title}</h4>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h5 className={`text-xl font-bold text-blue-400 mb-4`}>{t.professionalPlatform.challenges.oldReality.title}</h5>
                  <div className="space-y-3">
                    {t.professionalPlatform.challenges.oldReality.points.map((point, index) => (
                      <div key={index} className="flex items-start">
                        <div className="w-2 h-2 bg-red-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                        <p className={`${themeClasses.textSecondary}`}>{point}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h5 className={`text-xl font-bold text-green-500 mb-4`}>{t.professionalPlatform.challenges.newReality.title}</h5>
                  <div className="space-y-3">
                    {t.professionalPlatform.challenges.newReality.points.map((point, index) => (
                      <div key={index} className="flex items-start">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                        <p className={`${themeClasses.textSecondary}`}>{point}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 text-center`}>
                <div className="text-4xl mb-4">⏰</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.professionalPlatform.benefits.savesTime.title}</h4>
                <p className={themeClasses.textSecondary}>{t.professionalPlatform.benefits.savesTime.description}</p>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 text-center`}>
                <div className="text-4xl mb-4">📈</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.professionalPlatform.benefits.improvesResults.title}</h4>
                <p className={themeClasses.textSecondary}>{t.professionalPlatform.benefits.improvesResults.description}</p>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 text-center`}>
                <div className="text-4xl mb-4">👥</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.professionalPlatform.benefits.expandsAudience.title}</h4>
                <p className={themeClasses.textSecondary}>{t.professionalPlatform.benefits.expandsAudience.description}</p>
              </div>
              
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 text-center`}>
                <div className="text-4xl mb-4">🎯</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>{t.professionalPlatform.benefits.focusesOnGoals.title}</h4>
                <p className={themeClasses.textSecondary}>{t.professionalPlatform.benefits.focusesOnGoals.description}</p>
              </div>
            </div>
            
            <div className={`bg-gradient-to-r from-blue-500 to-green-500 rounded-xl p-8 mb-16`}>
              <h4 className={`text-3xl font-bold text-white mb-8 text-center`}>{t.professionalPlatform.platform.title}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center">
                  <h5 className={`text-xl font-bold text-blue-200 mb-3`}>{t.professionalPlatform.platform.features.contentCreation.title}</h5>
                  <p className="text-white">{t.professionalPlatform.platform.features.contentCreation.description}</p>
                </div>
                <div className="text-center">
                  <h5 className={`text-xl font-bold text-green-200 mb-3`}>{t.professionalPlatform.platform.features.wideDistribution.title}</h5>
                  <p className="text-white">{t.professionalPlatform.platform.features.wideDistribution.description}</p>
                </div>
                <div className="text-center">
                  <h5 className={`text-xl font-bold text-purple-200 mb-3`}>{t.professionalPlatform.platform.features.performanceTracking.title}</h5>
                  <p className="text-white">{t.professionalPlatform.platform.features.performanceTracking.description}</p>
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <p className={`${themeClasses.textSecondary} text-sm`}>{t.professionalPlatform.footer}</p>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact-section" className="py-12 sm:py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12 md:mb-16">
              <h3 className={`text-2xl sm:text-3xl md:text-4xl font-bold ${themeClasses.textPrimary} mb-3 sm:mb-4`}>{t.contact.title}</h3>
              <p className={`text-base sm:text-lg md:text-xl ${themeClasses.textSecondary} px-2`}>{t.contact.subtitle}</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 md:gap-12">
              <div>
                <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-6`}>{t.contact.form.title}</h4>
                <form className="space-y-6" onSubmit={handleContactSubmit}>
                  <div>
                    <label className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>{t.contact.form.fullName}</label>
                    <input 
                      type="text" 
                      name="fullName"
                      value={contactForm.fullName}
                      onChange={handleContactChange}
                      required
                      className={`w-full px-4 py-3 ${themeClasses.bgCard} ${themeClasses.borderPrimary} border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${themeClasses.textPrimary}`} 
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>{t.contact.form.email}</label>
                    <input 
                      type="email" 
                      name="email"
                      value={contactForm.email}
                      onChange={handleContactChange}
                      required
                      className={`w-full px-4 py-3 ${themeClasses.bgCard} ${themeClasses.borderPrimary} border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${themeClasses.textPrimary}`} 
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>{t.contact.form.phone}</label>
                    <input 
                      type="tel" 
                      name="phone"
                      value={contactForm.phone}
                      onChange={handleContactChange}
                      className={`w-full px-4 py-3 ${themeClasses.bgCard} ${themeClasses.borderPrimary} border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${themeClasses.textPrimary}`} 
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${themeClasses.textPrimary} mb-2`}>{t.contact.form.message}</label>
                    <textarea 
                      rows="4" 
                      name="message"
                      value={contactForm.message}
                      onChange={handleContactChange}
                      required
                      className={`w-full px-4 py-3 ${themeClasses.bgCard} ${themeClasses.borderPrimary} border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${themeClasses.textPrimary}`}
                    ></textarea>
                  </div>
                  <button 
                    type="submit" 
                    disabled={isSubmittingContact}
                    className={`w-full ${isSubmittingContact ? 'bg-gray-400 cursor-not-allowed' : themeClasses.btnPrimary} text-white py-3 rounded-lg font-semibold transition-all duration-300`}
                  >
                    {isSubmittingContact ? 
                      (language === 'hebrew' ? 'שליחה...' : 'Sending...') : 
                      t.buttons.sendMessage
                    }
                  </button>
                </form>
              </div>
              
              <div className="space-y-8">
                <div className={`${themeClasses.bgCard} rounded-xl p-6`}>
                  <h5 className={`text-xl font-bold ${themeClasses.textPrimary} mb-4`}>{t.contact.details.title}</h5>
                  <div className="space-y-4">
                    <div className="flex items-center">
                     
                     
                    </div>
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mr-4">
                        <span className="text-white text-lg">✉️</span>
                      </div>
                      <div>
                        <div className={`font-semibold ${themeClasses.textPrimary}`}>{t.contact.details.email}</div>
                        <div className={themeClasses.textSecondary}>
                          <a href="mailto:info@betterchoice.live" className="hover:text-emerald-600">
                            info@betterchoice.live
                          </a>
                        </div>
                        <div className={`${themeClasses.textMuted} text-sm`}>{language === 'hebrew' ? 'מענה תוך 24 שעות' : 'Response within 24 hours'}</div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mr-4">
                        <span className="text-white text-lg">📍</span>
                      </div>
                      <div>
                        <div className={`font-semibold ${themeClasses.textPrimary}`}>{t.contact.details.address}</div>
                        <div className={themeClasses.textSecondary}>{language === 'hebrew' ? 'משכית 10, הרצליה, ישראל' : 'Maskit 10, Herzliya, Israel'}</div>
                        <div className={`${themeClasses.textMuted} text-sm`}>{language === 'hebrew' ? 'ביקור לפי תיאום מראש' : 'Visit by appointment only'}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className={`${themeClasses.bgCard} rounded-xl p-6`}>
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mr-4">
                      <span className="text-white text-lg">🕒</span>
                    </div>
                    <h5 className={`text-xl font-bold ${themeClasses.textPrimary}`}>{t.contact.hours.title}</h5>
                  </div>
                  <div className={`space-y-2 ${themeClasses.textSecondary}`}>
                    <div className="flex justify-between">
                      <span>{language === 'hebrew' ? 'א-ה' : 'Sun-Thu'}</span>
                      <span>{language === 'hebrew' ? '8:00-18:00' : '8:00-18:00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'hebrew' ? 'ו' : 'Fri'}</span>
                      <span>{language === 'hebrew' ? '8:00-14:00' : '8:00-14:00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'hebrew' ? 'ש' : 'Sat'}</span>
                      <span>{language === 'hebrew' ? 'סגור' : 'Closed'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 sm:py-10 md:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 md:gap-8 mb-4 md:mb-0 text-center sm:text-left">
                <Link 
                  to="/privacy-policy" 
                  className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-emerald-700 hover:text-emerald-800'} transition-colors duration-300 text-sm sm:text-base`}
                >
                  {t.footer.privacy}
                </Link>
                <Link 
                  to="/terms" 
                  className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-emerald-700 hover:text-emerald-800'} transition-colors duration-300 text-sm sm:text-base`}
                >
                  {t.footer.terms}
                </Link>
                <button
                  onClick={() => {
                    try {
                      CookieConsent.showPreferences();
                    } catch (error) {
                      console.error('Cookie consent error:', error);
                    }
                  }}
                  className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-emerald-700 hover:text-emerald-800'} transition-colors duration-300 cursor-pointer text-sm sm:text-base`}
                >
                  {language === 'hebrew' ? 'הגדרות עוגיות' : 'Cookie Settings'}
                </button>
              </div>
              <div className={`${isDarkMode ? 'text-gray-400' : 'text-emerald-600/80'} text-center`}>
                <p className="text-xs sm:text-sm">{t.footer.copyright}</p>
              </div>
            </div>
          </div>
        </footer>
      </main>

    </div>
  );
}

export default HomePage;
