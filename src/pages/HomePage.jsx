import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import * as CookieConsent from 'vanilla-cookieconsent';
import Navigation from '../components/Navigation';
import { useStripe } from '../context/StripeContext';
import { STRIPE_PRODUCTS, PRODUCT_CONFIG } from '../config/stripe-products';
import { motion, AnimatePresence } from 'framer-motion';

// --- Framer Motion Design Tokens ---
const fadeUpVariant = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 }
  }
};

const scaleInVariant = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: 'easeOut' } }
};

function HomePage() {
  const { language, direction, toggleLanguage, t } = useLanguage();
  const { user, isAuthenticated, userDisplayName, loading } = useAuth();
  const { isDarkMode, toggleTheme, themeClasses } = useTheme();
  const { createCheckoutSession, loading: stripeLoading } = useStripe();
  const navigate = useNavigate();
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [showPlanDetailsModal, setShowPlanDetailsModal] = useState(false);
  const [commitmentPeriod, setCommitmentPeriod] = useState(3);
  const [showUSD, setShowUSD] = useState(false);
  const [usdExchangeRate, setUsdExchangeRate] = useState(null);

  // Fetch Bank of Israel USD exchange rate
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

  // Redirect authenticated users to profile page
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/profile');
    }
  }, [loading, isAuthenticated, navigate]);

  // Format price based on currency
  const formatPrice = (priceILS, priceUSD) => {
    if (!showUSD) {
      return `₪${Math.round(priceILS / 100)}`;
    }
    if (usdExchangeRate != null && usdExchangeRate > 0 && priceILS != null) {
      const ilsValue = priceILS / 100;
      const usdValue = ilsValue / usdExchangeRate;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: usdValue % 1 === 0 ? 0 : 2
      }).format(usdValue);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: (priceUSD / 100) % 1 === 0 ? 0 : 2
    }).format((priceUSD || 0) / 100);
  };

  const isApproximateUsd = showUSD;
  const approxLabel = language === 'hebrew' ? 'בערך ' : 'Approx. ';

  // Get products
  const nutritionOnlyProduct = PRODUCT_CONFIG[STRIPE_PRODUCTS.NUTRITION_ONLY];
  const nutritionOnly2xProduct = PRODUCT_CONFIG[STRIPE_PRODUCTS.NUTRITION_ONLY_2X_MONTH];
  const nutritionTrainingProduct = PRODUCT_CONFIG[STRIPE_PRODUCTS.NUTRITION_TRAINING];
  const betterProProduct = PRODUCT_CONFIG[STRIPE_PRODUCTS.NUTRITION_TRAINING_ONCE_MONTH];

  const getPrice = (product, commitment) => {
    const price = product.prices?.find(p => p.commitment === commitment);
    return price ? { ILS: price.amount, USD: price.amountUSD, priceId: price.id } : null;
  };

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
      const normalizedPhone = contactForm.phone ? contactForm.phone.replace(/[\s\-().]/g, '') : null;
      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
      const response = await fetch(`${apiUrl}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: contactForm.fullName,
          email: contactForm.email,
          phone: normalizedPhone,
          message: contactForm.message,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save message');
      }

      alert(language === 'hebrew' ? 
        'ההודעה נשלחה בהצלחה! נחזור בהקדם.' : 
        'Your message has been sent successfully! We will get back to you soon.'
      );
      
      setContactForm({ fullName: '', email: '', phone: '', message: '' });
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

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
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

    const runSequence = (type) => {
      if (type === 'photo') {
        timers.push(setTimeout(() => setChatAnimation(prev => ({ ...prev, showImage: true })), 500));
        timers.push(setTimeout(() => setChatAnimation(prev => ({ ...prev, showTyping: true })), 2000));
        timers.push(setTimeout(() => setChatAnimation(prev => ({ ...prev, showTyping: false, showBotMessage: true })), 3500));
        timers.push(setTimeout(() => setChatAnimation(prev => ({ ...prev, showButtons: true })), 4500));
      } else if (type === 'voice') {
        timers.push(setTimeout(() => setChatAnimation(prev => ({ ...prev, showVoiceMessage: true })), 500));
        timers.push(setTimeout(() => setChatAnimation(prev => ({ ...prev, showTyping: true })), 2500));
        timers.push(setTimeout(() => setChatAnimation(prev => ({ ...prev, showTyping: false, showBotMessage: true })), 4000));
        timers.push(setTimeout(() => setChatAnimation(prev => ({ ...prev, showButtons: true })), 5000));
      } else if (type === 'text') {
        timers.push(setTimeout(() => setChatAnimation(prev => ({ ...prev, showTextMessage: true })), 500));
        timers.push(setTimeout(() => setChatAnimation(prev => ({ ...prev, showTyping: true })), 2000));
        timers.push(setTimeout(() => setChatAnimation(prev => ({ ...prev, showTyping: false, showBotMessage: true })), 3500));
        timers.push(setTimeout(() => setChatAnimation(prev => ({ ...prev, showButtons: true })), 4500));
      }
    };

    runSequence(chatMode);
    loopTimer = setInterval(() => {
      setChatAnimation({
        showImage: false,
        showVoiceMessage: false,
        showTextMessage: false,
        showTyping: false,
        showBotMessage: false,
        showButtons: false
      });
      runSequence(chatMode);
    }, chatMode === 'voice' ? 16000 : 15000);

    return () => {
      timers.forEach(timer => clearTimeout(timer));
      if (loopTimer) clearInterval(loopTimer);
    };
  }, [chatMode]);

  return (
    <div className={`min-h-screen ${themeClasses.bgPrimary} transition-colors duration-500 font-sans flex flex-col`} dir={direction} style={{ height: '100vh', overflow: 'hidden' }}>
      <Navigation />

      <main className={`flex-1 overflow-y-auto custom-scrollbar ${isDarkMode ? 'bg-[#0f172a]' : 'bg-slate-50'}`} style={{ minHeight: 0 }}>
        
        {/* Hero Section */}
        <section data-tour="hero-section" className="relative pt-20 pb-12 sm:pt-28 sm:pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-full opacity-20 pointer-events-none">
            <div className={`absolute top-10 left-10 w-72 h-72 rounded-full filter blur-3xl ${isDarkMode ? 'bg-emerald-900' : 'bg-emerald-200'}`}></div>
            <div className={`absolute top-20 right-10 w-72 h-72 rounded-full filter blur-3xl ${isDarkMode ? 'bg-teal-900' : 'bg-teal-200'}`}></div>
          </div>

          <motion.div 
            className="max-w-5xl mx-auto text-center relative z-10"
            initial="hidden" animate="visible" variants={staggerContainer}
          >
            <motion.h1 variants={fadeUpVariant} className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 tracking-tight leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-teal-500">
                BetterChoice AI
              </span>
              <br />
              <span className={`${isDarkMode ? 'text-slate-100' : 'text-slate-900'} text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal mt-3 block`}>
                {language === 'hebrew' ? 'תזונה שעובדת בשבילך, כל יום.' : 'Nutrition that works for you, every day.'}
              </span>
            </motion.h1>
            
            <motion.p variants={fadeUpVariant} className={`text-xl sm:text-2xl md:text-3xl font-medium mb-6 leading-relaxed max-w-4xl mx-auto ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
              {language === 'hebrew' ? 'מפסיקים להילחם באוכל. מתחילים להזין את החיים.' : 'Stop fighting your food. Start fueling your life.'}
            </motion.p>
            
            <motion.p variants={fadeUpVariant} className={`text-lg sm:text-xl md:text-2xl ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} mb-6 leading-relaxed max-w-4xl mx-auto px-2`}>
              {language === 'hebrew' 
                ? 'דמיינו שאתם קמים בבוקר בתחושת קלילות, ביטחון, ושליטה אמיתית. לא עוד "דיאטה" - פשוט בחירות טובות יותר שנשארות לאורך זמן.'
                : 'Imagine waking up feeling light, confident, and finally in control. No more "diets"-just better choices that actually last.'}
            </motion.p>

            <motion.p variants={fadeUpVariant} className={`text-base sm:text-lg ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} mb-10 leading-relaxed max-w-3xl mx-auto px-2 italic`}>
              {language === 'hebrew'
                ? 'הגיע הזמן לאהוב את מה שאתם רואים במראה, ובעיקר את איך שאתם מרגישים עם עצמכם.'
                : "It's time to love what you see in the mirror and how you feel in your skin."}
            </motion.p>
            
            <motion.div variants={fadeUpVariant} className="flex justify-center mb-12">
              <button 
                onClick={() => window.location.href = isAuthenticated ? '/profile' : '/login'}
                className="group relative inline-flex items-center justify-center px-10 py-5 text-lg font-bold text-white transition-all duration-300 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-500 ease-out -skew-x-12 -ml-8 w-1/3"></div>
                <span className="mr-3 text-2xl">✨</span>
                {language === 'hebrew' ? 'אני רוצה להרגיש טוב יותר' : "I'm ready to feel better"}
                <span className="ml-3 group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </motion.div>

            <motion.button
              variants={fadeUpVariant}
              onClick={() => document.getElementById('chat-preview-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="flex flex-col items-center gap-2 cursor-pointer mx-auto group"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className={`text-sm font-medium tracking-wide transition-colors ${isDarkMode ? 'text-slate-400 group-hover:text-emerald-400' : 'text-slate-500 group-hover:text-emerald-600'}`}>
                {language === 'hebrew' ? 'המשיכו לגלול' : 'Keep scrolling'}
              </span>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-colors ${isDarkMode ? 'text-slate-400 group-hover:text-emerald-500' : 'text-slate-500 group-hover:text-emerald-500'}`}>
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </motion.button>
          </motion.div>
        </section>

        {/* Chat Preview Section */}
        <section id="chat-preview-section" className="py-12 sm:py-16">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={scaleInVariant}
              className={`rounded-3xl shadow-2xl overflow-hidden border ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-300 bg-[#e5ddd5]'}`}
              style={!isDarkMode ? { backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cdefs%3E%3Cpattern id=\'grid\' width=\'100\' height=\'100\' patternUnits=\'userSpaceOnUse\'%3E%3Cpath d=\'M 100 0 L 0 0 0 100\' fill=\'none\' stroke=\'%23d4d4d4\' stroke-width=\'0.5\'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width=\'100\' height=\'100\' fill=\'url(%23grid)\'/%3E%3C/svg%3E")', backgroundSize: '50px 50px' } : {}}
            >
              {/* Chat Header */}
              <div className={`px-4 py-3.5 ${isDarkMode ? 'bg-slate-800 border-b border-slate-700' : 'bg-[#075e54]'}`}>
                <div className="flex gap-2 mb-3 bg-black/10 p-1 rounded-xl backdrop-blur-sm">
                  {['photo', 'voice', 'text'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setChatMode(mode)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-wide transition-all duration-300 ${
                        chatMode === mode 
                          ? 'bg-emerald-500 text-white shadow-lg scale-95' 
                          : isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-emerald-50 hover:bg-white/20'
                      }`}
                    >
                      {mode === 'photo' ? '📷 ' + (language === 'hebrew' ? 'תמונה' : 'Photo') :
                       mode === 'voice' ? '🎤 ' + (language === 'hebrew' ? 'קול/טקסט' : 'Voice/Text') :
                       '💬 ' + (language === 'hebrew' ? 'טקסט' : 'Text')}
                    </button>
                  ))}
                </div>
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center mr-3 shadow-inner border-2 border-emerald-400">
                    <span className="text-white text-xl">🤖</span>
                  </div>
                  <div>
                    <p className="font-bold text-base tracking-tight text-white">BetterChoice AI</p>
                    <p className={`text-xs font-medium flex items-center gap-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-200'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {language === 'hebrew' ? 'מחובר' : 'Online'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Chat Body Container */}
              <div className="p-4 space-y-4 min-h-[500px] relative flex flex-col justify-end" dir="ltr">
                <AnimatePresence mode="wait">
                  {/* PHOTO MODE */}
                  {chatMode === 'photo' && chatAnimation.showImage && (
                    <motion.div initial={{ opacity: 0, x: 25 }} animate={{ opacity: 1, x: 0 }} className="flex justify-end w-full">
                      <div className="max-w-[75%]">
                        <div className={`rounded-2xl rounded-tr-none p-1.5 shadow-sm ${isDarkMode ? 'bg-emerald-800' : 'bg-[#dcf8c6]'}`}>
                          <img src="/Porcupine-Meatballs-Fork.jpg" alt="Meal" className="rounded-xl w-full h-auto max-h-64 object-cover" />
                        </div>
                        <p className={`text-[10px] mt-1 text-right ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{language === 'hebrew' ? '14:32' : '2:32 PM'}</p>
                      </div>
                    </motion.div>
                  )}

                  {/* VOICE MODE */}
                  {chatMode === 'voice' && chatAnimation.showVoiceMessage && (
                    <motion.div initial={{ opacity: 0, x: 25 }} animate={{ opacity: 1, x: 0 }} className="flex justify-end w-full">
                      <div className="max-w-[75%]">
                        <div className={`rounded-2xl rounded-tr-none p-3 shadow-sm flex items-center gap-3 ${isDarkMode ? 'bg-emerald-800' : 'bg-[#dcf8c6]'}`}>
                          <div className="flex items-center gap-1">
                            {[1, 3, 2, 4, 1, 3, 2].map((h, i) => <div key={i} className="w-1 bg-emerald-600 rounded-full animate-pulse" style={{ height: `${h * 0.4}rem`, animationDelay: `${i * 80}ms` }} />)}
                          </div>
                          <span className={`text-xs font-bold ${isDarkMode ? 'text-emerald-200' : 'text-emerald-800'}`}>0:05</span>
                          <span className="text-base">🎤</span>
                        </div>
                        <p className={`text-[10px] mt-1 text-right ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{language === 'hebrew' ? '14:32' : '2:32 PM'}</p>
                      </div>
                    </motion.div>
                  )}

                  {/* TEXT MODE */}
                  {chatMode === 'text' && chatAnimation.showTextMessage && (
                    <motion.div initial={{ opacity: 0, x: 25 }} animate={{ opacity: 1, x: 0 }} className="flex justify-end w-full">
                      <div className="max-w-[75%]">
                        <div className={`rounded-2xl rounded-tr-none p-3.5 shadow-sm text-sm ${isDarkMode ? 'bg-emerald-800 text-white' : 'bg-[#dcf8c6] text-slate-800'}`}>
                          {language === 'hebrew' ? 'אכלתי קרפ 240 גרם עם חלב מרוכז ממותק.' : 'I ate a 240g crepe with sweetened condensed milk.'}
                        </div>
                        <p className={`text-[10px] mt-1 text-right ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{language === 'hebrew' ? '14:32' : '2:32 PM'}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ANIMATED TYPING INDICATOR */}
                <AnimatePresence>
                  {chatAnimation.showTyping && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex justify-start w-full">
                      <div className={`rounded-2xl rounded-tl-none p-3.5 shadow-sm flex space-x-1.5 ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}>
                        {[0, 1, 2].map((i) => (
                          <motion.div key={i} className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-slate-500' : 'bg-slate-400'}`} animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* SYSTEM / BOT RESPONSES */}
                <AnimatePresence>
                  {chatAnimation.showBotMessage && (
                    <motion.div initial={{ opacity: 0, x: -25 }} animate={{ opacity: 1, x: 0 }} className="flex justify-start w-full flex-col items-start">
                      <div className="max-w-[85%]">
                        <div className={`rounded-2xl rounded-tl-none p-4.5 shadow-sm text-sm leading-relaxed ${isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-800'}`}>
                          {chatMode === 'photo' && (
                            language === 'hebrew' ? (
                              <div className="space-y-2" dir="rtl">
                                <div><span className="font-bold text-emerald-500">ציון:</span> 8/10 <span className="font-bold text-emerald-500">סיבה:</span> כמות גבוהה של קלוריות, פחמימות פשוטות ושומן. חסרים ירקות.</div>
                                <div><span className="font-bold text-emerald-500">התאמה לתוכנית:</span> 😊 בחירה טובה</div>
                                <div className={`pt-2 border-t text-xs font-mono opacity-80 space-y-1 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                                  <div>📊 סה״כ: 1202 קק״ל | 60ג' חלבון | 126ג' פחמימה | 44ג' שומן</div>
                                  <div className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>קציצות ברוטב עגבניות (240ג'): 812 קק״ל | אורז לבן (300ג'): 390 קק״ל</div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div><span className="font-bold text-emerald-500">Rating:</span> 8/10 | <span className="font-bold text-emerald-500">Reason:</span> High in calories, simple carbohydrates, and fats. Lacking vegetables.</div>
                                <div><span className="font-bold text-emerald-500">Plan Match:</span> 😊 Good choice</div>
                                <div className={`pt-2 border-t text-xs font-mono opacity-80 space-y-1 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                                  <div>📊 Total: 1202 kcal | 60g protein | 126g carbs | 44g fat</div>
                                  <div className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Meatballs in sauce (240g): 812 kcal | White rice (300g): 390 kcal</div>
                                </div>
                              </div>
                            )
                          )}

                          {chatMode === 'voice' && (
                            language === 'hebrew' ? (
                              <div className="space-y-2" dir="rtl">
                                <div><span className="font-bold text-emerald-500">ציון:</span> 6/10 <span className="font-bold text-emerald-500">סיבה:</span> ערך קלורי ושומן גבוהים מאוד, בעיקר בשל כמות גדולה של גבינת שמנת.</div>
                                <div><span className="font-bold text-emerald-500">התאמה לתוכנית:</span> ❌ בחירה פחות מומלצת</div>
                                <div className={`pt-2 border-t text-xs font-mono opacity-80 space-y-1 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                                  <div>📊 סה״כ: 1020 קק״ל | 43ג' חלבון | 67ג' פחמימה | 70ג' שומן</div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div><span className="font-bold text-emerald-500">Rating:</span> 6/10 | <span className="font-bold text-emerald-500">Reason:</span> Very high in calories and fat, primarily due to the large amount of cream cheese.</div>
                                <div><span className="font-bold text-emerald-500">Plan Match:</span> ❌ Poor choice</div>
                                <div className={`pt-2 border-t text-xs font-mono opacity-80 space-y-1 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                                  <div>📊 Total: 1020 kcal | 43g P | 67g C | 70g F</div>
                                </div>
                              </div>
                            )
                          )}

                          {chatMode === 'text' && (
                            language === 'hebrew' ? (
                              <div className="space-y-2" dir="rtl">
                                <div><span className="font-bold text-emerald-500">ציון:</span> 3/10 <span className="font-bold text-emerald-500">סיבה:</span> עשיר בסוכר ופחמימות פשוטות, בעל ערך תזונתי נמוך.</div>
                                <div><span className="font-bold text-emerald-500">התאמה לתוכנית:</span> ❌ בחירה לא מומלצת</div>
                                <div className={`pt-2 border-t text-xs font-mono opacity-80 space-y-1 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                                  <div>📊 סה״כ: 500 קק״ל | 12ג' חלבון | 75ג' פחמימה | 28ג' שומן</div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div><span className="font-bold text-emerald-500">Rating:</span> 3/10 | <span className="font-bold text-emerald-500">Reason:</span> High in sugar and simple carbohydrates with low nutritional value.</div>
                                <div><span className="font-bold text-emerald-500">Plan Match:</span> ❌ Very poor choice</div>
                                <div className={`pt-2 border-t text-xs font-mono opacity-80 space-y-1 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                                  <div>📊 Total: 500 kcal | 12g P | 75g C | 28g F</div>
                                </div>
                              </div>
                            )
                          )}
                        </div>

                        {/* Interactive Context Action Buttons */}
                        <AnimatePresence>
                          {chatAnimation.showButtons && (
                            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-3.5 space-y-2 w-full">
                              <button className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl px-4 py-3 text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5">
                                <span>📝</span>
                                <span>{language === 'hebrew' ? 'תיעוד ארוחה זו' : 'Log this meal'}</span>
                              </button>
                              
                              {chatMode === 'photo' && (
                                <>
                                  <button className={`w-full border rounded-xl px-4 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${isDarkMode ? 'border-slate-700 text-slate-300 bg-slate-800/40 hover:bg-slate-800' : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'}`}>
                                    <span>🍽️</span>
                                    <span>{language === 'hebrew' ? 'תיעוד עם חצי מנת אורז' : 'Log with half-portion of rice'}</span>
                                  </button>
                                  <button className={`w-full border rounded-xl px-4 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${isDarkMode ? 'border-slate-700 text-emerald-400 bg-slate-800/40 hover:bg-slate-800' : 'border-slate-200 text-emerald-700 bg-white hover:bg-slate-50'}`}>
                                    <span>✨</span>
                                    <span>{language === 'hebrew' ? 'איך להפוך את הארוחה ל-BetterChoice?' : 'How can I make this meal a BetterChoice?'}</span>
                                  </button>
                                </>
                              )}

                              {chatMode === 'voice' && (
                                <button className={`w-full border rounded-xl px-4 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${isDarkMode ? 'border-slate-700 text-emerald-400 bg-slate-800/40 hover:bg-slate-800' : 'border-slate-200 text-emerald-700 bg-white hover:bg-slate-50'}`}>
                                  <span>🧀</span>
                                  <span>{language === 'hebrew' ? 'הפחתת כמות הגבינה' : 'Reduce the amount of cheese'}</span>
                                </button>
                              )}

                              {chatMode === 'text' && (
                                <>
                                  <button className={`w-full border rounded-xl px-4 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${isDarkMode ? 'border-slate-700 text-slate-300 bg-slate-800/40 hover:bg-slate-800' : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'}`}>
                                    <span>🚫</span>
                                    <span>{language === 'hebrew' ? 'ללא חלב מרוכז' : 'Remove condensed milk'}</span>
                                  </button>
                                  <button className={`w-full border rounded-xl px-4 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${isDarkMode ? 'border-slate-700 text-slate-300 bg-slate-800/40 hover:bg-slate-800' : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'}`}>
                                    <span>🥞</span>
                                    <span>{language === 'hebrew' ? 'חצי מנה' : 'Half portion'}</span>
                                  </button>
                                </>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{language === 'hebrew' ? '14:33' : '2:33 PM'}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
            
            <div className="mt-4 text-center">
              <p className={`text-xs italic ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {language === 'hebrew' ? 'דוגמה לשיחה אמיתית ב-WhatsApp' : 'Example of a real WhatsApp conversation'}
              </p>
            </div>
          </div>
        </section>

        {/* Why Choose BetterChoice Section */}
        <section className="py-16 sm:py-24">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <motion.h3 variants={fadeUpVariant} className={`text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {language === 'hebrew' ? 'למה BetterChoice?' : 'Why BetterChoice?'}
              </motion.h3>
              <motion.p variants={fadeUpVariant} className={`text-xl max-w-2xl mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {language === 'hebrew' ? 'כי תזונה טובה צריכה להיות פשוטה, אישית ותמיד שם בשבילך.' : 'Because good nutrition should be simple, personal, and always there for you.'}
              </motion.p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { icon: '💬', title: language === 'hebrew' ? 'תזונה מותאמת אישית, בכל רגע' : 'Nutrition Tailored to You, Anytime', desc: language === 'hebrew' ? 'יש לך שאלה? פשוט שואלים. מקבלים תשובה מותאמת אישית עכשיו - מה לאכול? מתי? וכמה?' : 'Have a question? Just ask. Get a personalized answer instantly - what to eat, when, and how much.' },
                { icon: '🌱', title: language === 'hebrew' ? 'תכנית שגדלה איתך' : 'A Plan That Grows With You', desc: language === 'hebrew' ? 'אנחנו לומדים את ההרגלים, סדר היום והפעילות שלך - ומתאימים את עצמנו אליך. לא עוד תפריטים נוקשים שלא עובדים במציאות.' : 'We learn your habits, routine, and activity levels to adapt to you. No more rigid meal plans that don\'t work.' },
                { icon: '👩‍⚕️', title: language === 'hebrew' ? 'ליווי של דיאטניות קליניות' : 'Guided by Clinical Dietitians', desc: language === 'hebrew' ? 'מאחורי כל המלצה עומדת דיאטנית אמיתית. ייעוצים חודשיים ופיקוח מקצועי מבטיחים תוכנית בטוחה ויעילה.' : 'Behind every recommendation is a real dietitian. Monthly consultations and professional oversight ensure your plan is safe and effective.' },
                { icon: '💚', title: language === 'hebrew' ? 'מחובר לחיים שלך' : 'Connected to Your Life', desc: language === 'hebrew' ? 'התזונה מתעדכנת לפי איכות השינה, כמות הצעדים והתחושה האישית שלך - כדי לספק המלצות שמתאימות למצבך האמיתי.' : 'Nutrition updates based on your sleep, steps, and well-being to provide recommendations that match your current reality.' },
                { icon: '✨', title: language === 'hebrew' ? 'פשוט, יעיל, ומותאם לך' : 'Simple, Effective, Made for You', desc: language === 'hebrew' ? 'כלים חכמים שעוזרים לך לבחור נכון, להתאים את התזונה לאורח החיים שלך ולייצר שינויים קטנים עם השפעה גדולה - ללא מאמץ מיותר.' : 'Smart tools that help you choose correctly, adapt nutrition to your lifestyle, and make small changes with big impact - without the frustration.' },
                { icon: '🌿', title: language === 'hebrew' ? 'שינוי אמיתי, צעד אחר צעד' : 'Real Change, Step by Step', desc: language === 'hebrew' ? 'אנחנו לא בונים "תפריט נוקשה". אנחנו עוזרים לך לקבל החלטה אחת טובה יותר בכל פעם - וזה מה שיוצר שינוי אמיתי.' : 'We don\'t create rigid menus. We help you make one better decision at a time, leading to lasting change.' }
              ].map((item, idx) => (
                <motion.div key={idx} variants={fadeUpVariant} className={`p-8 rounded-3xl border shadow-md hover:shadow-xl transition-all duration-300 backdrop-blur-sm group ${isDarkMode ? 'bg-slate-800/40 hover:bg-slate-800 border-slate-800' : 'bg-white hover:bg-slate-100/60 border-slate-200'}`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-105 transition-transform ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-500/10'}`}>
                    {item.icon}
                  </div>
                  <h4 className={`text-xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.title}</h4>
                  <p className={`leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Emotional Transformation Section */}
        <section className="py-16 sm:py-24">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <motion.h3 variants={fadeUpVariant} className={`text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {language === 'hebrew' ? 'השינוי שאתם מרגישים' : 'The Transformation You Feel'}
              </motion.h3>
              <motion.p variants={fadeUpVariant} className={`text-xl max-w-3xl mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {language === 'hebrew' ? 'זה לא רק על מה שאתם מקבלים - זה על איך שאתם מרגישים' : 'It\'s not just about what you get-it\'s about how you feel'}
              </motion.p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                { icon: '🦋', border: 'border-emerald-500', title: language === 'hebrew' ? 'מתסכול לחופש' : 'From Frustration to Freedom', sub: language === 'hebrew' ? 'מפסיקים להילחם באוכל. מתחילים להזין את החיים.' : 'Stop fighting your food. Start fueling your life.', text: language === 'hebrew' ? 'דמיינו שאתם קמים בבוקר בתחושת קלילות, ביטחון ושליטה אמיתית. לא עוד "דיאטה" - אלא פשוט בחירות טובות יותר שנשארות לאורך זמן. הגיע הזמן לאהוב את מה שאתם רואים במראה, ובעיקר את איך שאתם מרגישים עם עצמכם.' : 'Imagine waking up feeling light, confident, and finally in control. No more "diets"-just better choices that actually last. It\'s time to love what you see in the mirror and, more importantly, how you feel in your skin.' },
                { icon: '⚡', border: 'border-yellow-500', title: language === 'hebrew' ? 'מהישרדות לחיוניות' : 'From Survival to Vitality', sub: language === 'hebrew' ? 'מפסיקים לעבוד על "על ריק".' : 'Stop running on empty.', text: language === 'hebrew' ? 'לא עוד נפילות אנרגיה בצהריים או תחושת "זומבי". דמיינו שיש לכם את החיוניות לכבוש את היעדים בעבודה, ועדיין שישאר לכם המון כוח לאנשים שאתם הכי אוהבים בבית. תחזירו לעצמכם את הניצוץ.' : 'No more afternoon crashes or "zombie mode." Imagine having the vibrant energy to crush your goals at work and still have plenty left for the people who matter most at home. Get your spark back.' },
                { icon: '💪', border: 'border-blue-500', title: language === 'hebrew' ? 'מהסתרה לגאווה' : 'From Hidden to Proud', sub: language === 'hebrew' ? 'מרגישים את החוזק מבפנים.' : 'Feel the strength beneath the surface.', text: language === 'hebrew' ? 'זאת התחושה שהבגדים יושבים בדיוק במקום, שהגוף מרגיש אסוף, חטוב וחזק. חיטוב הוא לא רק מראה - הוא הביטחון השקט שנובע מהידיעה שהגוף שלכם בשיאו.' : 'It\'s that feeling of your clothes fitting perfectly and your body feeling "held" and firm. Tightening isn\'t just about looks; it\'s about the quiet confidence of knowing your body is at its peak.' },
                { icon: '🏆', border: 'border-purple-500', title: language === 'hebrew' ? 'ממאמץ לכוח' : 'From Effort to Power', sub: language === 'hebrew' ? 'בונים גוף שיכול לעשות הכל.' : 'Build a body that can handle anything.', text: language === 'hebrew' ? 'יש גאווה מיוחדת בלראות את עצמכם מתחזק משבוע לשבוע. לבנות את השרירים שיסחבו אתכם דרך אתגרי החיים בקלות. זה לא רק נפח - זה כוח אמיתי שהרווחתם ביושר.' : 'There is a unique pride in watching yourself grow stronger every week. Build the muscle that carries you through life\'s challenges with ease. It\'s more than just mass-it\'s pure, earned power.' }
              ].map((box, idx) => (
                <motion.div key={idx} variants={fadeUpVariant} className={`p-8 rounded-3xl shadow-lg border-l-4 hover:shadow-xl transition-all duration-300 ${box.border} ${isDarkMode ? 'bg-slate-800/40' : 'bg-white'}`}>
                  <div className="flex items-center mb-4">
                    <span className="text-4xl mr-4">{box.icon}</span>
                    <h4 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{box.title}</h4>
                  </div>
                  <p className={`text-base font-semibold mb-3 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{box.sub}</p>
                  <p className={`leading-relaxed text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{box.text}</p>
                </motion.div>
              ))}
            </div>
            
            <motion.div variants={fadeUpVariant} className="text-center mt-12">
              <button 
                onClick={() => window.location.href = isAuthenticated ? '/profile' : '/login'}
                className="inline-flex items-center justify-center px-10 py-4 text-lg font-bold text-white transition-all bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transform duration-300"
              >
                {language === 'hebrew' ? 'התחל את השינוי שלך' : 'Start Your Transformation'}
              </button>
            </motion.div>
          </motion.div>
        </section>

        {/* Closing Statement Section */}
        <section className={`py-16 sm:py-24 border-y ${isDarkMode ? 'border-slate-800/60' : 'border-slate-200/60'}`}>
          <div className="max-w-4xl mx-auto px-4 text-center">
            <span className="text-5xl block mb-6 animate-bounce">🌿</span>
            <h3 className={`text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">BetterChoice</span>
              <br />
              <span className="text-xl sm:text-2xl md:text-3xl font-normal opacity-80 block mt-2">
                {language === 'hebrew' ? 'תזונה פשוטה. בחירות טובות יותר. כל יום.' : 'Simple nutrition. Better choices. Every day.'}
              </span>
            </h3>
            <p className={`text-base sm:text-lg italic mt-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {language === 'hebrew' ? 'כי כל החלטה טובה מובילה לשינוי אמיתי' : 'Because every good choice leads to real change'}
            </p>
          </div>
        </section>

        {/* How It Works Section */}
        <section className={`py-16 sm:py-24 border-y ${isDarkMode ? 'bg-[#111827] border-slate-800' : 'bg-emerald-50/40 border-slate-200/60'}`}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <motion.h3 variants={fadeUpVariant} className={`text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {language === 'hebrew' ? 'איך זה עובד?' : 'How It Works'}
              </motion.h3>
              <p className={`text-lg mt-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {language === 'hebrew' ? 'פשוט, טבעי ומותאם עבורך.' : 'Simple, natural, and tailored to you.'}
              </p>
            </div>
            
            <div className="flex flex-col md:flex-row items-stretch justify-center gap-6 md:gap-4 lg:gap-8">
              {[
                { step: '1', icon: '💬', title: language === 'hebrew' ? 'מדברים בוואטסאפ' : 'Chat on WhatsApp', text: language === 'hebrew' ? 'שואלים מה כדאי לאכול עכשיו ומקבלים תשובה מיידית.' : 'Ask what to eat right now and get an immediate response.' },
                { step: '2', icon: '🎯', title: language === 'hebrew' ? 'מקבלים המלצה אישית' : 'Get Instant Recommendations', text: language === 'hebrew' ? 'תשובה המותאמת לגוף שלך, למטרות ולמצב הנוכחי.' : 'Receive answers tailored to your body, goals, and current situation.' },
                { step: '3', icon: '🧠', title: language === 'hebrew' ? 'המערכת לומדת אותך' : 'The System Learns You', text: language === 'hebrew' ? 'כל שיחה משפרת את הדיוק והבנת ההרגלים והצרכים שלך.' : 'Every interaction improves our understanding of your habits and needs.' },
                { step: '4', icon: '🔄', title: language === 'hebrew' ? 'התוכנית מתעדכנת אוטומטית' : 'Your Plan Updates Automatically', text: language === 'hebrew' ? 'ההמלצות משתנות בהתאם להתקדמות ולשינויים באורח החיים.' : 'Recommendations evolve based on your progress and lifestyle changes.' }
              ].map((stepObj, idx) => (
                <React.Fragment key={idx}>
                  <motion.div variants={fadeUpVariant} className={`p-6 rounded-2xl shadow-md border-t-4 border-emerald-500 flex-1 max-w-xs text-center flex flex-col justify-between ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}>
                    <div>
                      <div className="text-xs font-bold text-emerald-500 tracking-wide mb-2">{language === 'hebrew' ? `שלב ${stepObj.step}:` : `Step ${stepObj.step}:`}</div>
                      <div className="text-4xl mb-4">{stepObj.icon}</div>
                      <h4 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stepObj.title}</h4>
                      <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{stepObj.text}</p>
                    </div>
                  </motion.div>
                  {idx < 3 && (
                    <div className={`text-2xl hidden md:flex items-center select-none ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>
                      {language === 'hebrew' ? '←' : '→'}
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
            
            <div className={`text-center mt-12 p-4 rounded-xl max-w-2xl mx-auto backdrop-blur-sm border ${isDarkMode ? 'bg-slate-800/50 border-slate-700/40' : 'bg-white/40 border-slate-200/40'}`}>
              <p className={`text-base font-medium ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                {language === 'hebrew'
                  ? 'מדברים בוואטסאפ ← המלצה מיידית ← המערכת לומדת ← התוכנית מתעדכנת'
                  : 'Chat on WhatsApp → Get Instant Recommendations → System Learns → Plan Updates Automatically'}
              </p>
            </div>
          </motion.div>
        </section>

        {/* Testimonials Section */}
        <section className="py-16 sm:py-24">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <motion.h3 variants={fadeUpVariant} className={`text-3xl sm:text-4xl font-extrabold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.testimonials.title}</motion.h3>
              <motion.p variants={fadeUpVariant} className={`text-xl ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{t.testimonials.subtitle}</motion.p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { person: t.testimonials.sarah, key: 'S' },
                { person: t.testimonials.michael, key: 'M' },
                { person: t.testimonials.rachel, key: 'R' }
              ].map((item, idx) => (
                <motion.div key={idx} variants={fadeUpVariant} className={`p-6 rounded-2xl shadow-md border ${isDarkMode ? 'bg-slate-800 border-slate-700/60' : 'bg-white border-slate-100'}`}>
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white font-bold flex items-center justify-center mr-4 shadow-sm">
                      {item.key}
                    </div>
                    <div>
                      <h5 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.person.name}</h5>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{item.person.location}</p>
                    </div>
                  </div>
                  <p className={`italic text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    "{item.person.text}"
                  </p>
                  <div className="flex text-amber-400 mt-4 text-xs tracking-wider">⭐⭐⭐⭐★</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Pricing Section */}
        <section id="know-your-numbers" data-tour="pricing-section" className={`py-16 sm:py-24 relative overflow-hidden border-y ${isDarkMode ? 'bg-[#0f172a] border-slate-800' : 'bg-slate-100/50 border-slate-200/40'}`}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center mb-12">
              <motion.h3 variants={fadeUpVariant} className={`text-3xl sm:text-4xl font-extrabold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {language === 'hebrew' ? 'תוכניות המנוי שלנו' : 'Our Subscription Plans'}
              </motion.h3>
              <motion.p variants={fadeUpVariant} className={`text-lg mb-8 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {language === 'hebrew' ? 'זה לא רק תוכנית - זה השינוי שאתם רוצים להרגיש.' : 'It\'s not just a plan-it\'s the transformation you want to feel.'}
              </motion.p>
              
              {/* Toggles */}
              <motion.div variants={fadeUpVariant} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
                <div className={`p-1.5 rounded-full flex shadow-inner ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                  {[3, 6].map(months => (
                    <button
                      key={months}
                      onClick={() => setCommitmentPeriod(months)}
                      className={`relative px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all ${commitmentPeriod === months ? (isDarkMode ? 'bg-slate-700 text-emerald-400 shadow-md' : 'bg-white text-emerald-500 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700')}`}
                    >
                      {months} {language === 'hebrew' ? 'חודשים' : 'Months'}
                      {months === 6 && <span className="absolute -top-3 -right-2 bg-orange-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow-sm">SAVE</span>}
                    </button>
                  ))}
                </div>

                <div className={`p-1.5 rounded-full flex shadow-inner ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                  {[{ id: false, label: '₪ ILS' }, { id: true, label: '$ USD' }].map(curr => (
                    <button
                      key={curr.label}
                      onClick={() => setShowUSD(curr.id)}
                      className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all ${showUSD === curr.id ? (isDarkMode ? 'bg-slate-700 text-blue-400 shadow-md' : 'bg-white text-blue-500 shadow-sm') : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700')}`}
                    >
                      {curr.label}
                    </button>
                  ))}
                </div>
              </motion.div>
              
              <motion.div variants={fadeUpVariant} className="flex justify-center mb-4">
                <button
                  onClick={() => setShowPlanDetailsModal(true)}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-6 py-2.5 rounded-full font-bold text-sm shadow-md transition-all transform hover:scale-105"
                >
                  <span className="flex items-center gap-2">
                    <span>😊</span>
                    <span>{language === 'hebrew' ? 'לחץ עליי!' : 'Press Me!'}</span>
                  </span>
                </button>
              </motion.div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 items-stretch">
              {/* Card 1: Nutrition Only */}
              {nutritionOnlyProduct && (() => {
                const price = getPrice(nutritionOnlyProduct, commitmentPeriod);
                if (!price) return null;
                return (
                  <motion.div variants={fadeUpVariant} className={`p-6 rounded-2xl border flex flex-col justify-between transition-all duration-300 shadow-md relative overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-blue-500' : 'bg-white border-slate-200 hover:border-blue-400'}`}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                    <div>
                      <h4 className={`text-xl font-bold mb-4 text-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {language === 'hebrew' ? nutritionOnlyProduct.nameHebrew : nutritionOnlyProduct.name}
                      </h4>
                      <div className={`text-3xl font-extrabold mb-6 text-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {isApproximateUsd && <span className="text-xs font-normal opacity-70 block">{approxLabel}</span>}
                        {formatPrice(price.ILS, price.USD)}
                        <span className="text-sm font-normal opacity-70"> {language === 'hebrew' ? 'ללחודש' : '/month'}</span>
                      </div>
                      <ul className="space-y-2.5 text-sm mb-6 text-right" dir={language === 'hebrew' ? 'rtl' : 'ltr'}>
                        {(language === 'hebrew' ? nutritionOnlyProduct.featuresHebrew : nutritionOnlyProduct.features).map((feat, i) => (
                          <li key={i} className="flex items-start gap-2"><span className="text-blue-500">✓</span><span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{feat}</span></li>
                        ))}
                      </ul>
                    </div>
                    <button onClick={() => handlePlanSelect(STRIPE_PRODUCTS.NUTRITION_ONLY)} disabled={stripeLoading} className="w-full py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 shadow-sm transition-all text-sm">
                      {language === 'hebrew' ? 'התחל את השינוי שלי' : 'Start my transformation'}
                    </button>
                  </motion.div>
                );
              })()}

              {/* Card 2: Nutrition Only 2x */}
              {nutritionOnly2xProduct && (() => {
                const price = getPrice(nutritionOnly2xProduct, commitmentPeriod);
                if (!price) return null;
                return (
                  <motion.div variants={fadeUpVariant} className={`p-6 rounded-2xl border flex flex-col justify-between transition-all duration-300 shadow-md relative overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-teal-500' : 'bg-white border-slate-200 hover:border-teal-400'}`}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-teal-500"></div>
                    <div>
                      <h4 className={`text-xl font-bold mb-4 text-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {language === 'hebrew' ? nutritionOnly2xProduct.nameHebrew : nutritionOnly2xProduct.name}
                      </h4>
                      <div className={`text-3xl font-extrabold mb-6 text-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {isApproximateUsd && <span className="text-xs font-normal opacity-70 block">{approxLabel}</span>}
                        {formatPrice(price.ILS, price.USD)}
                        <span className="text-sm font-normal opacity-70"> {language === 'hebrew' ? 'ללחודש' : '/month'}</span>
                      </div>
                      <ul className="space-y-2.5 text-sm mb-6 text-right" dir={language === 'hebrew' ? 'rtl' : 'ltr'}>
                        {(language === 'hebrew' ? nutritionOnly2xProduct.featuresHebrew : nutritionOnly2xProduct.features).map((feat, i) => (
                          <li key={i} className="flex items-start gap-2"><span className="text-teal-500">✓</span><span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{feat}</span></li>
                        ))}
                      </ul>
                    </div>
                    <button onClick={() => handlePlanSelect(STRIPE_PRODUCTS.NUTRITION_ONLY_2X_MONTH)} disabled={stripeLoading} className="w-full py-3 rounded-xl font-bold text-white bg-teal-500 hover:bg-teal-600 shadow-sm transition-all text-sm">
                      {language === 'hebrew' ? 'התחל את השינוי שלי' : 'Start my transformation'}
                    </button>
                  </motion.div>
                );
              })()}

              {/* Card 3: Nutrition Training (Most Popular) */}
              {nutritionTrainingProduct && (() => {
                const price = getPrice(nutritionTrainingProduct, commitmentPeriod);
                if (!price) return null;
                return (
                  <motion.div variants={fadeUpVariant} className="bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 rounded-3xl p-6 text-white relative shadow-xl transform hover:scale-102 flex flex-col justify-between transition-all">
                    <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2 z-10">
                      <span className="bg-gradient-to-r from-yellow-400 to-orange-400 text-slate-900 px-3.5 py-0.5 rounded-full text-xs font-black shadow-md tracking-wider uppercase">
                        {language === 'hebrew' ? 'הכי פופולרי' : 'Most Popular'}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold mb-4 text-center mt-2">
                        {language === 'hebrew' ? nutritionTrainingProduct.nameHebrew : nutritionTrainingProduct.name}
                      </h4>
                      <div className="text-3xl font-extrabold mb-6 text-center">
                        {isApproximateUsd && <span className="text-xs font-normal opacity-80 block">{approxLabel}</span>}
                        {formatPrice(price.ILS, price.USD)}
                        <span className="text-sm opacity-80"> {language === 'hebrew' ? 'ללחודש' : '/month'}</span>
                      </div>
                      <ul className="space-y-2.5 text-sm mb-6 text-right" dir={language === 'hebrew' ? 'rtl' : 'ltr'}>
                        {(language === 'hebrew' ? nutritionTrainingProduct.featuresHebrew : nutritionTrainingProduct.features).map((feat, i) => (
                          <li key={i} className="flex items-start gap-2"><span className="text-yellow-300">✓</span><span className="text-emerald-50">{feat}</span></li>
                        ))}
                      </ul>
                    </div>
                    <button onClick={() => handlePlanSelect(STRIPE_PRODUCTS.NUTRITION_TRAINING)} disabled={stripeLoading} className="w-full py-3.5 rounded-xl font-bold text-emerald-700 bg-white hover:bg-slate-50 shadow-md transition-all text-sm">
                      {language === 'hebrew' ? 'התחל את השינוי שלי' : 'Start my transformation'}
                    </button>
                  </motion.div>
                );
              })()}

              {/* Card 4: BetterPro Premium */}
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
                  <motion.div variants={fadeUpVariant} className={`p-6 rounded-2xl border flex flex-col justify-between transition-all duration-300 shadow-md relative overflow-hidden ${isDarkMode ? 'bg-slate-800 border-purple-500/40 hover:border-purple-500' : 'bg-white border-purple-200 hover:border-purple-400'}`}>
                    <div className="absolute top-0 right-0 bg-gradient-to-br from-purple-500 to-pink-500 text-white px-3 py-1 text-[10px] font-bold rounded-bl-xl shadow-sm">
                      {language === 'hebrew' ? 'פרימיום' : 'Premium'}
                    </div>
                    <div>
                      <h4 className={`text-xl font-bold mb-4 text-center mt-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {language === 'hebrew' ? betterProProduct.nameHebrew : betterProProduct.name}
                      </h4>
                      <div className="text-center mb-6">
                        <div className={`text-3xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {isApproximateUsd && <span className="text-xs font-normal opacity-70 block">{approxLabel}</span>}
                          {formatPrice(price.ILS, price.USD)}
                        </div>
                        <span className={`text-xs block mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {language === 'hebrew' ? `(${commitmentPeriod === 3 ? 'במסלול 3 חודשים' : 'במסלול 6 חודשים'})` : `(${commitmentPeriod === 3 ? '3-month plan' : '6-month plan'})`}
                        </span>
                        {commitmentPeriod === 6 && savings && (
                          <div className={`text-xs font-bold mt-1.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-500'}`}>
                            {language === 'hebrew'
                              ? (showUSD ? `חיסכון חודשי מוגדל במטבע חוץ` : `חיסכון של ₪${Math.round(savings.ILS / 100)} בכל חודש`)
                              : `Save significantly every month`}
                          </div>
                        )}
                      </div>
                      <ul className="space-y-2.5 text-sm mb-6 text-right" dir={language === 'hebrew' ? 'rtl' : 'ltr'}>
                        {(language === 'hebrew' ? betterProProduct.featuresHebrew : betterProProduct.features).map((feat, i) => (
                          <li key={i} className="flex items-start gap-2"><span className="text-purple-500">✓</span><span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{feat}</span></li>
                        ))}
                      </ul>
                    </div>
                    <button onClick={() => handlePlanSelect(STRIPE_PRODUCTS.NUTRITION_TRAINING_ONCE_MONTH)} disabled={stripeLoading} className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-md transition-all text-sm">
                      {language === 'hebrew' ? 'התחל את השינוי שלי' : 'Start my transformation'}
                    </button>
                  </motion.div>
                );
              })()}
            </div>
          </motion.div>

          {/* Modal Overlay Component */}
          <AnimatePresence>
            {showPlanDetailsModal && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40" onClick={() => setShowPlanDetailsModal(false)} />
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 15 }} className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-lg">
                  <div className={`border rounded-3xl shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`} dir={direction}>
                    <button onClick={() => setShowPlanDetailsModal(false)} className={`absolute top-4 ${language === 'hebrew' ? 'left-4' : 'right-4'} text-white hover:text-slate-200 transition-colors bg-black/20 rounded-full w-8 h-8 flex items-center justify-center z-10 font-bold`}>×</button>
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-5">
                      <h3 className="text-xl font-bold text-white text-center">
                        {language === 'hebrew' ? 'מה כל תוכנית כוללת' : 'What Every Plan Includes'}
                      </h3>
                    </div>
                    <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-6">
                      <div>
                        <h4 className={`text-base font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{language === 'hebrew' ? 'פגישה ראשונה מקיפה:' : 'Comprehensive First Session:'}</h4>
                        <ul className={`space-y-1 text-sm list-disc list-inside ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          <li>{language === 'hebrew' ? 'היכרות מעמיקה' : 'In-depth introduction'}</li>
                          <li>{language === 'hebrew' ? 'בניית תכנית תזונה מותאמת אישית' : 'Building a personalized nutrition plan'}</li>
                          <li>{language === 'hebrew' ? 'בתוכניות משולבות - גם בניית תכנית אימונים' : 'For combined plans - also building a training plan'}</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className={`text-base font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{language === 'hebrew' ? 'פגישות מעקב:' : 'Follow-up Sessions:'}</h4>
                        <ul className={`space-y-3 text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          <li className={`p-3 rounded-xl ${isDarkMode ? 'bg-slate-900/60' : 'bg-slate-50'}`}><span className={`font-bold block mb-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{language === 'hebrew' ? 'פגישה אחת לשבועיים:' : 'One session every two weeks:'}</span>{language === 'hebrew' ? 'מתאימה למי שרוצה ליווי צמוד יותר, דיוק ונוכחות גבוהה של הדיאטן/נית שלנו לאורך הדרך.' : 'Suitable for those who want closer guidance, precision and high presence of our dietician/nutritionist throughout the process.'}</li>
                          <li className={`p-3 rounded-xl ${isDarkMode ? 'bg-slate-900/60' : 'bg-slate-50'}`}><span className={`font-bold block mb-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{language === 'hebrew' ? 'פגישה אחת לחודש:' : 'One session per month:'}</span>{language === 'hebrew' ? 'מתאימה למי שמעדיף מרווחים, עבודה הדרגתית ועצמאות גבוהה יותר.' : 'Suitable for those who prefer intervals, gradual work and higher independence.'}</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className={`text-base font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{language === 'hebrew' ? 'ליווי אישי ב-WhatsApp:' : 'Personal WhatsApp Guidance:'}</h4>
                        <ul className={`space-y-1 text-sm list-disc list-inside ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          <li>{language === 'hebrew' ? 'מענה על שאלות' : 'Answering questions'}</li>
                          <li>{language === 'hebrew' ? 'התייעצויות שוטפות' : 'Ongoing consultations'}</li>
                          <li>{language === 'hebrew' ? 'דיוקים בזמן אמת' : 'Real-time adjustments'}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-gradient-to-r from-emerald-600 via-green-600 to-teal-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { val: '15K+', text: language === 'hebrew' ? 'משתמשים מרוצים' : 'Satisfied Users' },
                { val: '98%', text: language === 'hebrew' ? 'שיעור הצלחה' : 'Success Rate' },
                { val: '24/7', text: language === 'hebrew' ? 'תמיכה זמינה' : 'Available Support' },
                { val: '50+', text: language === 'hebrew' ? 'דיאטנים קליניים' : 'Clinical Dietitians' }
              ].map((stat, i) => (
                <div key={i} className="text-white">
                  <div className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-1">{stat.val}</div>
                  <div className="text-xs sm:text-sm md:text-base text-emerald-100 font-medium">{stat.text}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Celebrations Section */}
        <section className="py-16 sm:py-24">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <motion.h3 variants={fadeUpVariant} className={`text-3xl sm:text-4xl font-extrabold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.celebrations.title}</motion.h3>
              <motion.p variants={fadeUpVariant} className={`text-xl ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{t.celebrations.subtitle}</motion.p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { target: t.celebrations.sarah, icon: '🎉', color: 'bg-yellow-500/10' },
                { target: t.celebrations.michael, icon: '🏃‍♂️', color: 'bg-green-500/10' },
                { target: t.celebrations.rachel, icon: '💪', color: 'bg-blue-500/10' }
              ].map((cel, idx) => (
                <motion.div key={idx} variants={fadeUpVariant} className={`p-6 rounded-2xl shadow-md border flex flex-col justify-between ${isDarkMode ? 'bg-slate-800 border-slate-700/60' : 'bg-white border-slate-100'}`}>
                  <div>
                    <div className="flex items-center mb-4">
                      <div className={`w-12 h-12 ${cel.color} rounded-xl flex items-center justify-center mr-4 text-2xl shadow-inner`}>
                        {cel.icon}
                      </div>
                      <div>
                        <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{cel.target.name}</div>
                        <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{cel.target.time}</div>
                      </div>
                    </div>
                    <p className={`text-sm italic leading-relaxed mb-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>"{cel.target.message}"</p>
                  </div>
                  <div className={`flex items-center justify-between pt-3 border-t text-xs ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
                    <span className="text-amber-400">★★★★★</span>
                    <span>{cel.target.comments}</span>
                  </div>
                </motion.div>
              ))}
            </div>
            
            <motion.div variants={fadeUpVariant} className="text-center mt-12">
              <button 
                onClick={() => alert(language === 'hebrew' ? 'תכונת שיתוף ההישגים תגיע בקרוב!' : 'Achievement sharing feature coming soon!')}
                className={`relative px-8 py-3.5 rounded-full text-base font-bold transition-all shadow-inner opacity-75 cursor-not-allowed border ${isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-200 text-slate-500 border-slate-300'}`}
              >
                <span className="absolute -top-2.5 -right-2 bg-gradient-to-r from-orange-400 to-red-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black shadow-md tracking-wide">
                  {language === 'hebrew' ? 'בקרוב' : 'SOON'}
                </span>
                {language === 'hebrew' ? 'שיתוף הישגים - בקרוב' : 'Share Achievement - Coming Soon'}
              </button>
            </motion.div>
          </motion.div>
        </section>

        {/* Professional Platform Section */}
        <section className={`py-16 sm:py-24 border-y ${isDarkMode ? 'bg-[#111827] border-slate-800' : 'bg-slate-50 border-slate-200/60'}`}>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <motion.h3 variants={fadeUpVariant} className={`text-3xl sm:text-4xl font-extrabold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {t.professionalPlatform.title}
              </motion.h3>
              <motion.h4 variants={fadeUpVariant} className="text-2xl sm:text-3xl font-extrabold text-blue-500 mb-8">
                {t.professionalPlatform.subtitle}
              </motion.h4>
            </div>
            
            <motion.div variants={fadeUpVariant} className={`rounded-3xl shadow-xl p-6 md:p-10 mb-16 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <h4 className={`text-xl font-bold mb-8 text-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.professionalPlatform.challenges.title}</h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-red-900/10 border-red-900/20' : 'bg-red-50/50 border-red-100'}`}>
                  <h5 className="text-base font-bold text-red-500 mb-4 flex items-center gap-2">⚠️ {t.professionalPlatform.challenges.oldReality.title}</h5>
                  <div className="space-y-3 text-sm">
                    {t.professionalPlatform.challenges.oldReality.points.map((point, index) => (
                      <div key={index} className="flex items-start gap-2.5">
                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{point}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-emerald-900/10 border-emerald-900/20' : 'bg-emerald-50/50 border-emerald-100'}`}>
                  <h5 className="text-base font-bold text-emerald-500 mb-4 flex items-center gap-2">✅ {t.professionalPlatform.challenges.newReality.title}</h5>
                  <div className="space-y-3 text-sm">
                    {t.professionalPlatform.challenges.newReality.points.map((point, index) => (
                      <div key={index} className="flex items-start gap-2.5">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{point}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              {[
                { icon: '⏰', b: t.professionalPlatform.benefits.savesTime },
                { icon: '📈', b: t.professionalPlatform.benefits.improvesResults },
                { icon: '👥', b: t.professionalPlatform.benefits.expandsAudience },
                { icon: '🎯', b: t.professionalPlatform.benefits.focusesOnGoals }
              ].map((benefitItem, idx) => (
                <motion.div key={idx} variants={fadeUpVariant} className={`rounded-2xl shadow-md p-6 text-center border hover:-translate-y-2 transition-transform ${isDarkMode ? 'bg-slate-800 border-slate-700/60' : 'bg-white border-slate-100'}`}>
                  <div className="text-4xl mb-4">{benefitItem.icon}</div>
                  <h4 className={`text-base font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{benefitItem.b.title}</h4>
                  <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{benefitItem.b.description}</p>
                </motion.div>
              ))}
            </div>
            
            <motion.div variants={fadeUpVariant} className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 md:p-12 shadow-xl text-white">
              <h4 className="text-2xl font-extrabold mb-8 text-center">{t.professionalPlatform.platform.title}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div className="bg-white/10 p-5 rounded-xl backdrop-blur-sm">
                  <h5 className="font-bold text-blue-200 mb-2">{t.professionalPlatform.platform.features.contentCreation.title}</h5>
                  <p className="text-blue-50 leading-relaxed text-xs">{t.professionalPlatform.platform.features.contentCreation.description}</p>
                </div>
                <div className="bg-white/10 p-5 rounded-xl backdrop-blur-sm">
                  <h5 className="font-bold text-green-200 mb-2">{t.professionalPlatform.platform.features.wideDistribution.title}</h5>
                  <p className="text-blue-50 leading-relaxed text-xs">{t.professionalPlatform.platform.features.wideDistribution.description}</p>
                </div>
                <div className="bg-white/10 p-5 rounded-xl backdrop-blur-sm">
                  <h5 className="font-bold text-purple-200 mb-2">{t.professionalPlatform.platform.features.performanceTracking.title}</h5>
                  <p className="text-blue-50 leading-relaxed text-xs">{t.professionalPlatform.platform.features.performanceTracking.description}</p>
                </div>
              </div>
            </motion.div>
            
            <div className="text-center">
              <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.professionalPlatform.footer}</p>
            </div>
          </motion.div>
        </section>

        {/* Contact Section */}
        <section id="contact-section" className="py-16 sm:py-24">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <motion.h3 variants={fadeUpVariant} className={`text-3xl sm:text-4xl font-extrabold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.contact.title}</motion.h3>
              <motion.p variants={fadeUpVariant} className={`text-xl ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{t.contact.subtitle}</motion.p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <motion.div variants={fadeUpVariant} className={`p-8 rounded-3xl shadow-xl ${isDarkMode ? 'bg-slate-800' : 'bg-white border border-slate-100'}`}>
                <h4 className={`text-xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.contact.form.title}</h4>
                <form className="space-y-5" onSubmit={handleContactSubmit}>
                  <div>
                    <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{t.contact.form.fullName}</label>
                    <input type="text" name="fullName" value={contactForm.fullName} onChange={handleContactChange} required className={`w-full px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow ${isDarkMode ? 'bg-slate-900 text-white border-none' : 'bg-slate-50 border border-slate-200'}`} />
                  </div>
                  <div>
                    <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{t.contact.form.email}</label>
                    <input type="email" name="email" value={contactForm.email} onChange={handleContactChange} required className={`w-full px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow ${isDarkMode ? 'bg-slate-900 text-white border-none' : 'bg-slate-50 border border-slate-200'}`} />
                  </div>
                  <div>
                    <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{t.contact.form.phone}</label>
                    <input type="tel" name="phone" value={contactForm.phone} onChange={handleContactChange} className={`w-full px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow ${isDarkMode ? 'bg-slate-900 text-white border-none' : 'bg-slate-50 border border-slate-200'}`} />
                  </div>
                  <div>
                    <label className={`block text-xs font-bold mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{t.contact.form.message}</label>
                    <textarea rows="4" name="message" value={contactForm.message} onChange={handleContactChange} required className={`w-full px-4 py-3.5 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow ${isDarkMode ? 'bg-slate-900 text-white border-none' : 'bg-slate-50 border border-slate-200'}`}></textarea>
                  </div>
                  <button type="submit" disabled={isSubmittingContact} className={`w-full py-3.5 rounded-xl font-bold text-white transition-all shadow-md ${isSubmittingContact ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'}`}>
                    {isSubmittingContact ? (language === 'hebrew' ? 'שליחה...' : 'Sending...') : t.buttons.sendMessage}
                  </button>
                </form>
              </motion.div>
              
              <motion.div variants={fadeUpVariant} className="space-y-6 flex flex-col justify-center">
                <div className={`rounded-2xl p-6 shadow-md ${isDarkMode ? 'bg-slate-800' : 'bg-white border border-slate-100'}`}>
                  <h5 className={`font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.contact.details.title}</h5>
                  <div className="space-y-4 text-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-sm">✉️</div>
                      <div>
                        <div className="font-bold">{t.contact.details.email}</div>
                        <a href="mailto:info@betterchoice.live" className="text-emerald-500 font-medium hover:underline">info@betterchoice.live</a>
                        <div className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{language === 'hebrew' ? 'מענה תוך 24 שעות' : 'Response within 24 hours'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-sm">📍</div>
                      <div>
                        <div className="font-bold">{t.contact.details.address}</div>
                        <div className={isDarkMode ? 'text-slate-300' : 'text-slate-500'}>{language === 'hebrew' ? 'משכית 10, הרצליה, ישראל' : 'Maskit 10, Herzliya, Israel'}</div>
                        <div className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{language === 'hebrew' ? 'ביקור לפי תיאום מראש' : 'Visit by appointment only'}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className={`rounded-2xl p-6 shadow-md ${isDarkMode ? 'bg-slate-800' : 'bg-white border border-slate-100'}`}>
                  <h5 className={`font-bold mb-4 flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}><span>🕒</span> {t.contact.hours.title}</h5>
                  <div className={`space-y-3 text-xs sm:text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    <div className={`flex justify-between border-b pb-2 ${isDarkMode ? 'border-slate-700/60' : 'border-slate-100'}`}>
                      <span>{language === 'hebrew' ? 'א-ה' : 'Sun-Thu'}</span>
                      <span>8:00-18:00</span>
                    </div>
                    <div className={`flex justify-between border-b pb-2 ${isDarkMode ? 'border-slate-700/60' : 'border-slate-100'}`}>
                      <span>{language === 'hebrew' ? 'ו' : 'Fri'}</span>
                      <span>8:00-14:00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{language === 'hebrew' ? 'ש' : 'Sat'}</span>
                      <span className={`font-bold ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>{language === 'hebrew' ? 'סגור' : 'Closed'}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className={`py-10 border-t ${isDarkMode ? 'bg-[#0f172a] border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'}`}>
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex gap-6 font-bold text-sm">
                <Link to="/privacy-policy" className="hover:text-emerald-500 transition-colors">{t.footer.privacy}</Link>
                <Link to="/terms" className="hover:text-emerald-500 transition-colors">{t.footer.terms}</Link>
                <button onClick={() => CookieConsent.showPreferences()} className="hover:text-emerald-500 transition-colors">
                  {language === 'hebrew' ? 'הגדרות עוגיות' : 'Cookie Settings'}
                </button>
             </div>
             <p className="text-sm font-medium">© {new Date().getFullYear()} BetterChoice. {t.footer.copyright}</p>
          </div>
        </footer>

      </main>
    </div>
  );
}

export default HomePage;