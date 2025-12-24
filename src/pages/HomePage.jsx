import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import * as CookieConsent from 'vanilla-cookieconsent';
import Navigation from '../components/Navigation';
import { supabase, supabaseSecondary } from '../supabase/supabaseClient';

function HomePage() {
  const { language, direction, toggleLanguage, t } = useLanguage();
  const { user, isAuthenticated, userDisplayName, loading } = useAuth();
  const { isDarkMode, toggleTheme, themeClasses } = useTheme();
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
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

  // Handle plan selection - redirect to login if not authenticated
  const handlePlanSelect = (planType) => {
    if (!isAuthenticated) {
      // Redirect to login page
      window.location.href = '/login';
    } else {
      // Handle plan selection for authenticated users
      // You can add plan selection logic here
      console.log(`Selected plan: ${planType}`);
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
      <main className="flex-1 overflow-y-auto custom-scrollbar" style={{ minHeight: 0 }}>
        {/* Hero Section */}
        <section data-tour="hero-section" className={`py-12 sm:py-16 md:py-20 px-4 sm:px-6 lg:px-8 ${isDarkMode ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-green-50 to-emerald-50'}`}>
          <div className="max-w-5xl mx-auto text-center">
            <h1 className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 sm:mb-8`}>
              <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                {language === 'hebrew' ? 'BetterChoice AI' : 'BetterChoice AI'}
              </span>
              <br />
              <span className={`${themeClasses.textPrimary} text-3xl sm:text-4xl md:text-5xl lg:text-6xl`}>
                {language === 'hebrew' ? 'תזונה שתפורה עבורך' : 'Nutrition Tailored to You'}
              </span>
            </h1>
            
            {/* Value Prop Line */}
            <p className={`text-xl sm:text-2xl md:text-3xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'} mb-6 sm:mb-8 leading-relaxed max-w-4xl mx-auto px-2`}>
              {language === 'hebrew' 
                ? 'שואלים - ומקבלים תשובה מותאמת ומבוססת לך.'
                : 'Just Ask - and get an answer tailored TO YOU.'}
            </p>
            <p className={`text-lg sm:text-xl md:text-2xl ${themeClasses.textSecondary} mb-8 sm:mb-10 leading-relaxed max-w-4xl mx-auto px-2`}>
              {language === 'hebrew' 
                ? 'תזונה, כושר ויומן מזון וכושר - הכל בצ\'אט AI אחד.'
                : 'Nutrition & fitness Planner , Follow up Journal - all in one AI chat.'}
            </p>
            <p className={`text-base sm:text-lg md:text-xl ${themeClasses.textSecondary} mb-8 sm:mb-10 leading-relaxed max-w-3xl mx-auto px-2`}>
              {language === 'hebrew'
                ? ' טכנולוגיה חכמה משולבת עם דיאטניות קלינית עבור הדרכה יומיומית פשוטה, מדויקת ויעילה - המובילה לשינוי אמיתי ולאורח חיים מאוזן.'
                : 'smart technology combined with clinical dietitian to provide simple, accurate, and effective daily guidance - leading to real change and a balanced lifestyle.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-6 sm:mb-8 px-2">
              <button 
                onClick={() => {
                  if (!isAuthenticated) {
                    window.location.href = '/login';
                  } else {
                    window.location.href = '/profile';
                  }
                }}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 sm:px-10 py-4 sm:py-5 rounded-full text-lg sm:text-xl font-semibold transform hover:-translate-y-1 transition-all duration-300 shadow-xl hover:shadow-2xl flex items-center justify-center w-full sm:w-auto"
              >
                <span className="mr-2">🤖</span>
                {language === 'hebrew' ? 'התחל עכשיו' : 'Get Started'}
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
                  {language === 'hebrew' ? 'המשך לגלול' : 'Keep scrolling'}
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
        <section id="chat-preview-section" className={`py-8 sm:py-12 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
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
                      {language === 'hebrew' ? 'מקוון' : 'online'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Chat messages */}
              <div className="p-4 space-y-3 min-h-[500px] relative">
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
                                  ? 'עשירה מאוד בקלוריות, פחמימות פשוטות ושומן. חסרה בירקות.'
                                  : 'Very rich in calories, simple carbohydrates and fat. Lacking vegetables.'}
                              </div>
                              <div>
                                <span className="font-semibold">*{language === 'hebrew' ? 'התאמה לתוכנית' : 'Plan Match'}*</span>: 😊 {language === 'hebrew' ? 'בחירה טובה' : 'Good choice'}
                              </div>
                              <div className="pt-2 border-t border-gray-300">
                                <span className="font-semibold">📊 *{language === 'hebrew' ? 'ניתוח' : 'Analysis'}*</span>:
                                <div className="mt-2 text-xs space-y-1 font-mono">
                                  <div>{language === 'hebrew' ? 'סה״כ' : 'Total'}: 1202 {language === 'hebrew' ? 'קק״ל' : 'kcal'} | 60{language === 'hebrew' ? 'ג' : 'g'} {language === 'hebrew' ? 'חלבון' : 'protein'} | 126{language === 'hebrew' ? 'ג' : 'g'} {language === 'hebrew' ? 'פחמימה' : 'carbs'} | 44{language === 'hebrew' ? 'ג' : 'g'} {language === 'hebrew' ? 'שומן' : 'fat'}</div>
                                  <div>1. {language === 'hebrew' ? 'קציצות ברוטב עגבניות (כ-5 קציצות (240ג) עם 175ג רוטב)' : 'Meatballs in tomato sauce (~5 meatballs (240g) with 175g sauce)'}: 812 {language === 'hebrew' ? 'קק״ל' : 'kcal'} | 52 {language === 'hebrew' ? 'חלבון' : 'protein'} 42 {language === 'hebrew' ? 'פחמימה' : 'carbs'} 43 {language === 'hebrew' ? 'שומן' : 'fat'}</div>
                                  <div>2. {language === 'hebrew' ? 'אורז לבן (כ-300ג)' : 'White rice (~300g)'}: 390 {language === 'hebrew' ? 'קק״ל' : 'kcal'} | 8 {language === 'hebrew' ? 'חלבון' : 'protein'} 84 {language === 'hebrew' ? 'פחמימה' : 'carbs'} 1 {language === 'hebrew' ? 'שומן' : 'fat'}</div>
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
                              <span>{language === 'hebrew' ? 'תתעד ארוחה זו' : 'Log this meal'}</span>
                            </button>
                            <button className={`w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2`}>
                              <span>📝</span>
                              <span>{language === 'hebrew' ? 'תתעד עם חצי מנת אורז' : 'Log with half portion of rice'}</span>
                            </button>
                            <button className={`w-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 hover:from-green-600 hover:via-emerald-600 hover:to-green-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2`}>
                              <span>✨</span>
                              <span>{language === 'hebrew' ? 'איך להפוך את הארוחה ל-BetterChoice?' : 'How to make this meal BetterChoice?'}</span>
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
                                  ? 'עשיר מאוד בקלוריות ושומן, בעיקר בגלל כמות גדולה מאוד של גבינת שמנת.'
                                  : 'Very rich in calories and fat, mainly due to a very large amount of cream cheese.'}
                              </div>
                              <div>
                                <span className="font-semibold">*{language === 'hebrew' ? 'התאמה לתוכנית' : 'Plan Match'}*</span>: ❌ {language === 'hebrew' ? 'בחירה גרועה' : 'Poor choice'}
                              </div>
                              <div className="pt-2 border-t border-gray-300">
                                <span className="font-semibold">📊 *{language === 'hebrew' ? 'ניתוח' : 'Analysis'}*</span>:
                                <div className="mt-2 text-xs space-y-1 font-mono">
                                  <div>{language === 'hebrew' ? 'סה״כ' : 'Total'}: 1020 {language === 'hebrew' ? 'קק״ל' : 'kcal'} | 43{language === 'hebrew' ? 'ג' : 'g'} {language === 'hebrew' ? 'חלבון' : 'protein'} | 67{language === 'hebrew' ? 'ג' : 'g'} {language === 'hebrew' ? 'פחמימה' : 'carbs'} | 70{language === 'hebrew' ? 'ג' : 'g'} {language === 'hebrew' ? 'שומן' : 'fat'}</div>
                                  <div>1. {language === 'hebrew' ? 'טוסט חיטה מלאה עם גבינת שמנת (כ-230ג)' : 'Whole wheat toast with cream cheese (~230g)'}: 720 {language === 'hebrew' ? 'קק״ל' : 'kcal'} | 25 {language === 'hebrew' ? 'חלבון' : 'protein'} 65 {language === 'hebrew' ? 'פחמימה' : 'carbs'} 45 {language === 'hebrew' ? 'שומן' : 'fat'}</div>
                                  <div>2. {language === 'hebrew' ? 'חביתה פשוטה (כ-200ג)' : 'Simple omelet (~200g)'}: 300 {language === 'hebrew' ? 'קק״ל' : 'kcal'} | 18 {language === 'hebrew' ? 'חלבון' : 'protein'} 2 {language === 'hebrew' ? 'פחמימה' : 'carbs'} 25 {language === 'hebrew' ? 'שומן' : 'fat'}</div>
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
                              <span>{language === 'hebrew' ? 'תתעד ארוחה זו' : 'Log this meal'}</span>
                            </button>
                            <button className={`w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2`}>
                              <span>🧀</span>
                              <span>{language === 'hebrew' ? 'הפחת כמות גבינה' : 'Reduce amount of cheese'}</span>
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
                              ? 'אכלתי קרפ 240ג עם חלב מרוכז ממותק'
                              : 'I ate a 240g crepe with sweetened condensed milk'}
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
                                  ? 'עשיר מאוד בסוכר ופחמימות פשוטות, עם ערך תזונתי נמוך.'
                                  : 'Very rich in sugar and simple carbohydrates, with low nutritional value.'}
                              </div>
                              <div>
                                <span className="font-semibold">*{language === 'hebrew' ? 'התאמה לתוכנית' : 'Plan Match'}*</span>: ❌ {language === 'hebrew' ? 'בחירה גרועה מאוד' : 'Very poor choice'}
                              </div>
                              <div className="pt-2 border-t border-gray-300">
                                <span className="font-semibold">📊 *{language === 'hebrew' ? 'ניתוח' : 'Analysis'}*</span>:
                                <div className="mt-2 text-xs space-y-1 font-mono">
                                  <div>{language === 'hebrew' ? 'סה״כ' : 'Total'}: 500 {language === 'hebrew' ? 'קק״ל' : 'kcal'} | 12{language === 'hebrew' ? 'ג' : 'g'} {language === 'hebrew' ? 'חלבון' : 'protein'} | 75{language === 'hebrew' ? 'ג' : 'g'} {language === 'hebrew' ? 'פחמימה' : 'carbs'} | 28{language === 'hebrew' ? 'ג' : 'g'} {language === 'hebrew' ? 'שומן' : 'fat'}</div>
                                  <div>1. {language === 'hebrew' ? 'קרפ שוקולד עם חלב מרוכז ממותק (כ-240ג)' : 'Chocolate crepe with sweetened condensed milk (~240g)'}: 500 {language === 'hebrew' ? 'קק״ל' : 'kcal'} | 12 {language === 'hebrew' ? 'חלבון' : 'protein'} 75 {language === 'hebrew' ? 'פחמימה' : 'carbs'} 28 {language === 'hebrew' ? 'שומן' : 'fat'}</div>
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
                              <span>{language === 'hebrew' ? 'תתעד ארוחה זו' : 'Log this meal'}</span>
                            </button>
                            <button className={`w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2`}>
                              <span>🚫</span>
                              <span>{language === 'hebrew' ? 'ללא חלב מרוכז' : 'No condensed milk'}</span>
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
                
                .animate-bounce-down {
                  animation: bounce-down 1.5s ease-in-out infinite;
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

        {/* Why Choose BetterChoice AI Section */}
        <section className={`py-12 sm:py-16 md:py-20 ${themeClasses.sectionBg}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 sm:mb-16">
              <h3 className={`text-3xl sm:text-4xl md:text-5xl font-bold ${themeClasses.textPrimary} mb-4`}>
                <span className={isDarkMode ? 'text-green-400' : 'text-green-600'}>
                  {language === 'hebrew' ? 'למה לבחור BetterChoice AI?' : 'Why Choose BetterChoice AI?'}
                </span>
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-12">
              {/* Point 1 */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 border-l-4 border-green-500`}>
                <div className="flex items-start mb-4">
                  <div className="text-3xl mr-4">🧠</div>
                  <div className="flex-1">
                    <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-2`}>
                      {language === 'hebrew' ? 'תזונה מותאמת אישית ברמה אחרת, בכל רגע' : 'Hyper-Personalized Nutrition, Anytime'}
                    </h4>
                  </div>
                </div>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew' 
                    ? 'מאמן תזונה אישי ב-AI זמין ב-WhatsApp למענה מיידי, פשוט וזמין: מה לאכול? מתי? כמה? תשובות בזמן אמת.'
                    : 'Personal AI nutrition coach available on WhatsApp for instant, simple, and accessible answers: What to eat? When? How much? Real-time responses.'}
                </p>
              </div>
              
              {/* Point 2 */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 border-l-4 border-green-500`}>
                <div className="flex items-start mb-4">
                  <div className="text-3xl mr-4">🍽️</div>
                  <div className="flex-1">
                    <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-2`}>
                      {language === 'hebrew' ? 'תכנית שמתעדכנת איתך' : 'A Plan That Updates With You'}
                    </h4>
                  </div>
                </div>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'המערכת לומדת את הרגלי האכילה, סדר היום ורמת הפעילות - ומתאימה את עצמה באופן דינמי. לא עוד תפריטים שלא שורדים שבוע.'
                    : 'The system learns eating habits, daily schedule and activity level to adapt dynamically. No more meal plans that don\'t last a week.'}
                </p>
              </div>
              
              {/* Point 3 */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 border-l-4 border-green-500`}>
                <div className="flex items-start mb-4">
                  <div className="text-3xl mr-4">👩‍⚕️</div>
                  <div className="flex-1">
                    <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-2`}>
                      {language === 'hebrew' ? 'תמיכה של דיאטניות קליניות' : 'Support from Clinical Dietitians'}
                    </h4>
                  </div>
                </div>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'מאחורי כל המלצה עומד בן אדם אנושי. ייעוצים חודשיים ופיקוח מקצועי מבטיחים תכנית בטוחה, יעילה ומותאמת אישית.'
                    : 'Behind every recommendation stands a human. Monthly consultations and professional supervision ensure a safe, effective, and personalized plan.'}
                </p>
              </div>
              
              {/* Point 4 */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 border-l-4 border-green-500`}>
                <div className="flex items-start mb-4">
                  <div className="text-3xl mr-4">📱</div>
                  <div className="flex-1">
                    <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-2`}>
                      {language === 'hebrew' ? 'אינטגרציה עם Apple Watch' : 'Apple Watch Integration'}
                    </h4>
                  </div>
                </div>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'התזונה מתעדכנת על פי שינה, צעדים, סטרס ונתוני בריאות - כדי לתת המלצות שמדויקות למצב האמיתי.'
                    : 'Nutrition updates based on sleep, steps, stress, and health data - to provide recommendations that are accurate to your real situation.'}
                </p>
              </div>
              
              {/* Point 5 */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 border-l-4 border-green-500`}>
                <div className="flex items-start mb-4">
                  <div className="text-3xl mr-4">🔬</div>
                  <div className="flex-1">
                    <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-2`}>
                      {language === 'hebrew' ? 'טכנולוגיה שמחזירה שליטה' : 'Technology That Returns Control'}
                    </h4>
                  </div>
                </div>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'AI מתקדם, Digital Health Twin ומודלים ביולוגיים מאפשרים: חיזוי תוצאות, התאמות חכמות, שינויים בעלי השפעה גבוהה. כל זה ללא מאמץ וללא תסכול.'
                    : 'Advanced AI, Digital Health Twin, and biological models enable: outcome prediction, smart adjustments, high-impact changes. All without effort and without frustration.'}
                </p>
              </div>
              
              {/* Point 6 - Differentiation */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 border-l-4 border-green-500`}>
                <div className="flex items-start mb-4">
                  <div className="text-3xl mr-4">🎯</div>
                  <div className="flex-1">
                    <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-2`}>
                      {language === 'hebrew' ? 'מיני־שינויים בעלי ROI גבוה' : 'High-ROI Mini-Changes'}
                    </h4>
                  </div>
                </div>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'אנחנו לא עושים \'תפריט\'. אנחנו עושים החלטה אחת טובה יותר בכל פעם - וזה מצטבר לשינוי אמיתי.'
                    : 'We don\'t make a \'meal plan\'. We make one better decision at a time - and it adds up to real change.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Results Section */}
        <section className={`py-12 sm:py-16 md:py-20 ${themeClasses.sectionBg}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 sm:mb-16">
              <h3 className={`text-3xl sm:text-4xl md:text-5xl font-bold ${themeClasses.textPrimary} mb-4`}>
                <span className={isDarkMode ? 'text-green-400' : 'text-green-600'}>
                  {language === 'hebrew' ? 'התוצאות שאנשים מרגישים' : 'Results People Feel'}
                </span>
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              {/* Result 1 */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 text-center hover:shadow-2xl transition-shadow duration-300`}>
                <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-3xl">⚡</span>
                </div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>
                  {language === 'hebrew' ? 'יותר יציבות אנרגטית' : 'More Energy Stability'}
                </h4>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'פחות נפילות אנרגיה במהלך היום, ריכוז משופר.'
                    : 'Fewer energy crashes during the day, improved focus.'}
                </p>
              </div>
              
              {/* Result 2 */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 text-center hover:shadow-2xl transition-shadow duration-300`}>
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-3xl">🥗</span>
                </div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>
                  {language === 'hebrew' ? 'פחות נשנושים בערב' : 'Less Evening Snacking'}
                </h4>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'החלטות נכונות יותר במהלך היום מובילות לבחירות טובות יותר גם בערב.'
                    : 'Better decisions during the day lead to better choices in the evening too.'}
                </p>
              </div>
              
              {/* Result 3 */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 text-center hover:shadow-2xl transition-shadow duration-300`}>
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-3xl">🔄</span>
                </div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>
                  {language === 'hebrew' ? 'יותר עקביות' : 'More Consistency'}
                </h4>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'הרגלים שנוצרים בהדרגה ונשארים לאורך זמן.'
                    : 'Habits that develop gradually and last over time.'}
                </p>
              </div>
              
              {/* Result 4 */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 text-center hover:shadow-2xl transition-shadow duration-300`}>
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white text-3xl">😴</span>
                </div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>
                  {language === 'hebrew' ? 'שינה טובה יותר' : 'Better Sleep'}
                </h4>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'תזונה מאוזנת תורמת לאיכות שינה טובה יותר.'
                    : 'Balanced nutrition contributes to better sleep quality.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Closing Statement Section */}
        <section className={`py-12 sm:py-16 md:py-20 ${isDarkMode ? 'bg-gradient-to-br from-gray-800 to-gray-900' : 'bg-gradient-to-br from-green-50 to-emerald-50'}`}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h3 className={`text-3xl sm:text-4xl md:text-5xl font-bold ${themeClasses.textPrimary} mb-4`}>
              <span className={isDarkMode ? 'text-green-400' : 'text-green-600'}>
                {language === 'hebrew' ? 'BetterChoice AI - תזונה פשוטה, בחירות טובות יותר.' : 'BetterChoice AI — Simple nutrition, Better Choices.'}
              </span>
            </h3>
          </div>
        </section>

        {/* How It Works Section */}
        <section className={`py-12 sm:py-16 md:py-20 ${themeClasses.sectionBg}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 sm:mb-16">
              <h3 className={`text-3xl sm:text-4xl md:text-5xl font-bold ${themeClasses.textPrimary} mb-4`}>
                <span className={isDarkMode ? 'text-green-400' : 'text-green-600'}>
                  {language === 'hebrew' ? 'איך זה עובד' : 'How It Works'}
                </span>
              </h3>
            </div>
            
            {/* Flow Layout */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-6 md:gap-8 mb-8">
              {/* Step 1 */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 border-t-4 border-green-500 ${themeClasses.shadowHover} transition-shadow duration-300 flex-1 max-w-xs text-center`}>
                <div className="text-sm font-bold text-green-600 mb-2">{language === 'hebrew' ? 'שלב 1' : 'Step 1'}</div>
                <div className="text-4xl mb-4">💬</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>
                  {language === 'hebrew' ? 'מדברים בוואטסאפ' : 'Talk on WhatsApp'}
                </h4>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'שואלים מה לאכול עכשיו ומקבלים תשובה מיידית.'
                    : 'Ask what to eat now and get an instant answer.'}
                </p>
              </div>
              
              {/* Arrow */}
              <div className={`text-3xl ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} hidden md:block`}>
                {language === 'hebrew' ? '←' : '→'}
              </div>
              
              {/* Step 2 */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 border-t-4 border-green-500 ${themeClasses.shadowHover} transition-shadow duration-300 flex-1 max-w-xs text-center`}>
                <div className="text-sm font-bold text-green-600 mb-2">{language === 'hebrew' ? 'שלב 2' : 'Step 2'}</div>
                <div className="text-4xl mb-4">🎯</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>
                  {language === 'hebrew' ? 'מקבלים המלצה עכשיו' : 'Get Recommendation Now'}
                </h4>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'תשובה מותאמת לגוף, למטרות ולמצב הנוכחי.'
                    : 'Answer tailored to your body, goals, and current situation.'}
                </p>
              </div>
              
              {/* Arrow */}
              <div className={`text-3xl ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} hidden md:block`}>
                {language === 'hebrew' ? '←' : '→'}
              </div>
              
              {/* Step 3 */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 border-t-4 border-green-500 ${themeClasses.shadowHover} transition-shadow duration-300 flex-1 max-w-xs text-center`}>
                <div className="text-sm font-bold text-green-600 mb-2">{language === 'hebrew' ? 'שלב 3' : 'Step 3'}</div>
                <div className="text-4xl mb-4">🧠</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>
                  {language === 'hebrew' ? 'המערכת לומדת אותך' : 'System Learns You'}
                </h4>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'כל שיחה משפרת את ההבנה של הרגלים וצרכים.'
                    : 'Every conversation improves understanding of habits and needs.'}
                </p>
              </div>
              
              {/* Arrow */}
              <div className={`text-3xl ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} hidden md:block`}>
                {language === 'hebrew' ? '←' : '→'}
              </div>
              
              {/* Step 4 */}
              <div className={`${themeClasses.bgCard} rounded-xl ${themeClasses.shadowCard} p-6 border-t-4 border-green-500 ${themeClasses.shadowHover} transition-shadow duration-300 flex-1 max-w-xs text-center`}>
                <div className="text-sm font-bold text-green-600 mb-2">{language === 'hebrew' ? 'שלב 4' : 'Step 4'}</div>
                <div className="text-4xl mb-4">🔄</div>
                <h4 className={`text-xl font-bold ${themeClasses.textPrimary} mb-3`}>
                  {language === 'hebrew' ? 'התוכנית מתעדכנת אוטומטית' : 'Plan Updates Automatically'}
                </h4>
                <p className={themeClasses.textSecondary}>
                  {language === 'hebrew'
                    ? 'ההמלצות משתנות בהתאם להתקדמות ולשינויים.'
                    : 'Recommendations change based on progress and changes.'}
                </p>
              </div>
            </div>
            
            {/* Flow Summary */}
            <div className="text-center mt-8">
              <p className={`text-lg sm:text-xl ${themeClasses.textSecondary} max-w-3xl mx-auto`}>
                {language === 'hebrew'
                  ? 'מדברים בוואטסאפ → מקבלים המלצה עכשיו → המערכת לומדת אותך → התוכנית מתעדכנת אוטומטית'
                  : 'Talk on WhatsApp → Get recommendation now → System learns you → Plan updates automatically'}
              </p>
            </div>
          </div>
        </section>


        {/* Testimonials Section */}
        <section className={`py-20 ${themeClasses.sectionBg}`}>
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
        <section data-tour="pricing-section" className={`py-20 ${themeClasses.bgSecondary}`} id="know-your-numbers">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className={`text-4xl font-bold ${themeClasses.textPrimary} mb-4`}>
                {language === 'hebrew' ? 'תוכניות המנוי שלנו' : 'Our Subscription Plans'}
              </h3>
              <p className={`text-xl ${themeClasses.textSecondary} mb-8`}>
                {language === 'hebrew' ? 'אפשר לבחור את התוכנית המתאימה' : 'Choose the plan that fits you best'}
              </p>
              
              {/* Toggle Controls */}
              <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-8 sm:mb-12`}>
                {/* Commitment Toggle */}
                <div className={`${themeClasses.bgCard} rounded-2xl p-2 border-2 ${themeClasses.borderPrimary} w-full sm:w-auto`}>
                  <div className="flex">
                    <button 
                      onClick={() => setCommitmentPeriod && setCommitmentPeriod(3)}
                      className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 ${
                        (commitmentPeriod || 3) === 3 
                          ? 'bg-emerald-500 text-white shadow-lg' 
                          : `${themeClasses.textSecondary} hover:${themeClasses.textPrimary}`
                      }`}
                    >
                      {language === 'hebrew' ? '3 חודשים' : '3 Months'}
                    </button>
                    <button 
                      onClick={() => setCommitmentPeriod && setCommitmentPeriod(6)}
                      className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 relative ${
                        (commitmentPeriod || 3) === 6 
                          ? 'bg-emerald-500 text-white shadow-lg' 
                          : `${themeClasses.textSecondary} hover:${themeClasses.textPrimary}`
                      }`}
                    >
                      {language === 'hebrew' ? '6 חודשים' : '6 Months'}
                      <span className="absolute -top-2 -right-2 bg-orange-400 text-white text-xs px-2 py-1 rounded-full">
                        {language === 'hebrew' ? 'חסכון' : 'Save'}
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
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {/* Basic Plan - Nutrition Only */}
              <div className={`${themeClasses.bgCard} border-2 ${themeClasses.borderPrimary} rounded-xl p-6 md:p-8 hover:border-emerald-500 transition-colors duration-300`}>
                <div className="text-center">
                  <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>
                    {language === 'hebrew' ? 'בסיסי' : 'Basic'}
                  </h4>
                  <div className={`text-4xl font-bold ${themeClasses.textPrimary} mb-6`}>
                    {formatPrice(58000, 16600)}
                    <span className={`text-lg ${themeClasses.textSecondary}`}>
                      {language === 'hebrew' ? '/חודש' : '/month'}
                    </span>
                  </div>
                  <ul className="space-y-3 mb-8 text-right" dir={language === 'hebrew' ? 'rtl' : 'ltr'}>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'תוכניות ארוחות מותאמות' : 'Custom meal plans'}
                      </span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'ניתוח תזונתי' : 'Nutritional analysis'}
                      </span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'מעקב התקדמות' : 'Progress tracking'}
                      </span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'תמיכה במייל' : 'Email support'}
                      </span>
                    </li>
                  </ul>
                  <button 
                    onClick={() => handlePlanSelect('basic')}
                    className={`w-full ${themeClasses.btnSecondary} py-3 rounded-lg font-semibold transition-colors duration-300`}
                  >
                    {language === 'hebrew' ? 'בחירת תוכנית' : 'Select Plan'}
                  </button>
                </div>
              </div>
              
              {/* Professional Plan - Nutrition + Training */}
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 md:p-8 text-white relative mt-8 md:mt-0">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
                    {language === 'hebrew' ? 'הכי פופולרי' : 'Most Popular'}
                  </span>
                </div>
                <div className="text-center">
                  <h4 className="text-2xl font-bold mb-4">
                    {language === 'hebrew' ? 'מקצועי' : 'Professional'}
                  </h4>
                  <div className="text-4xl font-bold mb-6">
                    {formatPrice(83000, 23700)}
                    <span className="text-lg opacity-80">
                      {language === 'hebrew' ? '/חודש' : '/month'}
                    </span>
                  </div>
                  <ul className="space-y-3 mb-8 text-right" dir={language === 'hebrew' ? 'rtl' : 'ltr'}>
                    <li className="flex items-center">
                      <span className="text-green-300 mr-3">✓</span>
                      <span>{language === 'hebrew' ? 'כל מה שיש בבסיסי +' : 'Everything in Basic +'}</span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-300 mr-3">✓</span>
                      <span>{language === 'hebrew' ? 'תוכניות אימון מותאמות' : 'Custom workout plans'}</span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-300 mr-3">✓</span>
                      <span>{language === 'hebrew' ? 'תמיכת מאמן אישי' : 'Personal trainer support'}</span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-300 mr-3">✓</span>
                      <span>{language === 'hebrew' ? 'מפגשים חודשיים' : 'Monthly sessions'}</span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-300 mr-3">✓</span>
                      <span>{language === 'hebrew' ? 'תמיכה בצ׳אט' : 'Chat support'}</span>
                    </li>
                  </ul>
                  <button 
                    onClick={() => handlePlanSelect('professional')}
                    className="w-full bg-white text-emerald-600 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-300"
                  >
                    {language === 'hebrew' ? 'בחירת תוכנית' : 'Select Plan'}
                  </button>
                </div>
              </div>
              
              {/* Premium Plan - BetterPro with commitment pricing */}
              <div className={`${themeClasses.bgCard} border-2 border-purple-500 rounded-xl p-6 md:p-8 hover:border-purple-400 transition-colors duration-300 relative overflow-hidden`}>
                <div className="absolute top-0 right-0 bg-purple-500 text-white px-3 py-1 text-xs font-bold">
                  {language === 'hebrew' ? 'פרימיום' : 'Premium'}
                </div>
                <div className="text-center">
                  <h4 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-4`}>
                    {language === 'hebrew' ? 'BetterPro' : 'BetterPro'}
                  </h4>
                  <div className={`mb-6`}>
                    <div className={`text-4xl font-bold ${themeClasses.textPrimary}`}>
                      {(commitmentPeriod || 3) === 3 
                        ? formatPrice(68000, 19400) 
                        : formatPrice(60000, 17100)
                      }
                    </div>
                    <span className={`text-lg ${themeClasses.textSecondary}`}>
                      {language === 'hebrew' ? '/חודש' : '/month'}
                    </span>
                    {(commitmentPeriod || 3) === 6 && (
                      <div className="text-sm text-green-500 font-semibold mt-1">
                        {language === 'hebrew' 
                          ? (showUSD ? 'חסכון של $23 לחודש' : 'חסכון של ₪80 לחודש')
                          : (showUSD ? 'Save $23/month' : 'Save ₪80/month')
                        }
                      </div>
                    )}
                  </div>
                  <ul className="space-y-3 mb-8 text-right" dir={language === 'hebrew' ? 'rtl' : 'ltr'}>
                    <li className="flex items-center">
                      <span className="text-purple-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'כל מה שיש במקצועי +' : 'Everything in Professional +'}
                      </span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-purple-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'תכנון ארוחות מתקדם' : 'Advanced meal planning'}
                      </span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-purple-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'תמיכה בעדיפות' : 'Priority support'}
                      </span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-purple-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'מפגשים שבועיים' : 'Weekly sessions'}
                      </span>
                    </li>
                    <li className="flex items-center">
                      <span className="text-purple-500 mr-3">✓</span>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'גישה לכל התכונות' : 'Access to all features'}
                      </span>
                    </li>
                  </ul>
                  <div className={`text-xs ${themeClasses.textMuted} mb-4`}>
                    {language === 'hebrew' 
                      ? `התחייבות ל-${(commitmentPeriod || 3)} חודשים` 
                      : `${(commitmentPeriod || 3)}-month commitment`
                    }
                  </div>
                  <button 
                    onClick={() => handlePlanSelect('betterpro')}
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all duration-300 shadow-lg"
                  >
                    {language === 'hebrew' ? 'בחירת תוכנית' : 'Select Plan'}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-12">
              <p className={`${themeClasses.textMuted} text-sm`}>
                {language === 'hebrew' 
                  ? 'כל התוכניות כוללות אפשרות ביטול בכל עת' 
                  : 'All plans include cancellation option at any time'
                }
              </p>
            </div>
          </div>
        </section>


        {/* Stats Section */}
        <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600">
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
        <section className={`py-20 ${isDarkMode ? 'bg-gradient-to-r from-gray-800 to-gray-900' : 'bg-gradient-to-r from-yellow-50 to-orange-50'}`}>
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
        <section className={`py-20 ${themeClasses.sectionBg}`}>
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
        <section id="contact-section" className={`py-12 sm:py-16 md:py-20 ${themeClasses.bgSecondary}`}>
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
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mr-4">
                        <span className="text-white text-lg">📞</span>
                      </div>
                      <div>
                        <div className={`font-semibold ${themeClasses.textPrimary}`}>{t.contact.details.phone}</div>
                        <div className={themeClasses.textSecondary}>050-2420905</div>
                        <div className={`${themeClasses.textMuted} text-sm`}>{language === 'hebrew' ? 'זמינים א-ה 8:00-18:00' : 'Available Sun-Thu 8:00-18:00'}</div>
                      </div>
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
        <footer className={`${themeClasses.footerBg} text-white py-8 sm:py-10 md:py-12`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 md:gap-8 mb-4 md:mb-0 text-center sm:text-left">
                <Link 
                  to="/privacy-policy" 
                  className="text-gray-300 hover:text-white transition-colors duration-300 text-sm sm:text-base"
                >
                  {t.footer.privacy}
                </Link>
                <Link 
                  to="/terms" 
                  className="text-gray-300 hover:text-white transition-colors duration-300 text-sm sm:text-base"
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
                  className="text-gray-300 hover:text-white transition-colors duration-300 cursor-pointer text-sm sm:text-base"
                >
                  {language === 'hebrew' ? 'הגדרות עוגיות' : 'Cookie Settings'}
                </button>
              </div>
              <div className="text-gray-400 text-center">
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
