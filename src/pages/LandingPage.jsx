import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { getCompanyConfig } from '../company/configs/companyConfigResolver';
import defaultCompanyConfig from '../company/configs/defaultCompanyConfig';
import Navigation from '../components/Navigation';

function LandingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, direction } = useLanguage();
  const { isDarkMode, themeClasses } = useTheme();

  const [isValidating, setIsValidating] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [companySlug, setCompanySlug] = useState('default');
  const [managerData, setManagerData] = useState(null);
  const [campaignData, setCampaignData] = useState(null);

  const [chatAnimation, setChatAnimation] = useState({
    showImage: false, showTyping: false, showBotMessage: false
  });

  useEffect(() => {
    const handleInboundVerification = async () => {
      try {
        setIsValidating(true);
        setErrorMessage(null);

        const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
        let rawHashToken = hashParams.get('d');

        if (!rawHashToken) {
          throw new Error('INVALID_TOKEN_STRUCTURE');
        }

        let manager_id = null;
        let link_id = null;
        let max_clients = null;
        let expiry_date = null;

        try {
          let decodedString = atob(rawHashToken).trim();
          
          // 🔧 String Sanitization Guardrail: Fixes the malformed BetterChoice Base64 chunk
          if (!decodedString.startsWith('{') && decodedString.includes('"manager_id"')) {
            decodedString = '{"link_id":"' + decodedString;
          }

          // 🔀 Polymorphic Parsing Engine: Auto-detects between JSON layout objects and raw UUID string tokens
          if (decodedString.startsWith('{')) {
            const decodedPayload = JSON.parse(decodedString);
            manager_id = decodedPayload.manager_id;
            link_id = decodedPayload.link_id;
            max_clients = decodedPayload.max_clients;
            expiry_date = decodedPayload.expiry_date;
          } else {
            // Simple Link Fallback branch - string contains purely the manager uuid mapping signature
            manager_id = decodedString;
          }
        } catch (e) {
          console.error('Base64 Decoding Fault:', e);
          throw new Error('INVALID_TOKEN_STRUCTURE');
        }

        if (!manager_id) {
          throw new Error('INVALID_TOKEN_STRUCTURE');
        }

        // 🕒 Constraint Check 1: Expiration Date Validation (Only evaluated if supplied by a smart link)
        if (expiry_date) {
          const expirationTarget = new Date(expiry_date);
          if (expirationTarget < new Date()) {
            const err = new Error('CAMPAIGN_EXPIRED');
            err.status = 410;
            throw err;
          }
        }

        // 🌐 Fetch Database Metrics to verify Live current_count vs max_slots
        const apiUrl = process.env.REACT_APP_API_URL || '';
        const response = await fetch(`${apiUrl}/api/landing/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ managerId: manager_id, linkId: link_id })
        });

        const data = await response.json();

        if (!response.ok) {
          const errorInstance = new Error(data.error || 'Validation failure');
          errorInstance.status = response.status;
          throw errorInstance;
        }

        // 📊 Constraint Check 2: Max Allowance Verification (Only enforced if limits are actively active)
        const serverMaxSlots = data.campaign?.maxSlots || max_clients;
        const serverCurrentCount = data.campaign?.currentCount || 0;

        if (serverMaxSlots && serverCurrentCount >= serverMaxSlots) {
          const errorInstance = new Error('REGISTRATION_LIMIT_REACHED');
          errorInstance.status = 403;
          throw errorInstance;
        }

        // Synchronize successful payload response models to UI state
        setCompanySlug(data.company.slug);
        setManagerData(data.manager);
        
        // Populate dynamic scarcity telemetry only if this instance represents a true smart link campaign
        setCampaignData({
          isSmartLink: !!link_id,
          maxSlots: serverMaxSlots || 30,
          slotsRemaining: serverMaxSlots ? Math.max(0, serverMaxSlots - serverCurrentCount) : null,
          expiresAt: expiry_date || data.campaign?.expiresAt
        });

      } catch (err) {
        console.error('Landing Page Exception Caught:', err);
        if (err.message === 'INVALID_TOKEN_STRUCTURE') {
          setErrorMessage(language === 'hebrew' ? 'מבנה קישור לא חוקי' : 'Invalid link structure.');
        } else if (err.status === 410 || err.message === 'CAMPAIGN_EXPIRED') {
          setErrorMessage(language === 'hebrew' ? 'פג תוקף הקמפיין' : 'This campaign tracking link has expired.');
        } else if (err.status === 403 || err.message === 'REGISTRATION_LIMIT_REACHED') {
          setErrorMessage(language === 'hebrew' ? 'מכסת ההרשמה מלאה' : 'All available registration slots have been filled.');
        } else {
          setErrorMessage(language === 'hebrew' ? 'שגיאת אימות נתונים' : 'Database verification connection failure.');
        }
      } finally {
        setIsValidating(false);
      }
    };

    handleInboundVerification();
  }, [location.hash, language]);

  useEffect(() => {
    setChatAnimation({ showImage: false, showTyping: false, showBotMessage: false });
    let timers = [];
    timers.push(setTimeout(() => setChatAnimation(p => ({ ...p, showImage: true })), 500));
    timers.push(setTimeout(() => setChatAnimation(p => ({ ...p, showTyping: true })), 1800));
    timers.push(setTimeout(() => setChatAnimation(p => ({ ...p, showTyping: false, showBotMessage: true })), 3200));
    return () => timers.forEach(clearTimeout);
  }, [companySlug]);

  const getRemainingTimeText = (expiryTimestamp) => {
    if (!expiryTimestamp) return null;
    const differenceInMs = new Date(expiryTimestamp) - new Date();
    if (differenceInMs <= 0) return language === 'hebrew' ? 'הסתיים' : 'Expired';
    
    const totalHours = Math.floor(differenceInMs / (1000 * 60 * 60));
    const totalDays = Math.floor(totalHours / 24);

    if (totalDays > 30) {
      const months = Math.floor(totalDays / 30);
      return language === 'hebrew' ? `נותרו כ-${months} חודשים` : `~${months} months left`;
    }
    if (totalDays > 0) {
      return language === 'hebrew' ? `נותרו עוד ${totalDays} ימים` : `${totalDays} days left`;
    }
    if (totalHours > 0) {
      return language === 'hebrew' ? `נותרו עוד ${totalHours} שעות` : `${totalHours} hours left`;
    }
    return language === 'hebrew' ? 'דקות אחרונות!' : 'Mins left!';
  };

  const activeConfig = getCompanyConfig(companySlug) || defaultCompanyConfig;
  const contentData = activeConfig?.content || defaultCompanyConfig.content;
  const themeData = activeConfig?.theme || defaultCompanyConfig.theme;

  const titleObj = contentData?.heroTitle || { english: 'Welcome', hebrew: 'ברוכים הבאים' };
  const subtitleObj = contentData?.heroSubtitle || { english: '', hebrew: '' };
  const paragraphObj = contentData?.heroParagraph || { english: '', hebrew: '' };
  const ctaObj = contentData?.ctaText || { english: 'Proceed', hebrew: 'המשך' };

  if (isValidating) {
    return (
      <div className={`min-h-screen ${themeClasses.bgPrimary} flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className={`min-h-screen ${themeClasses.bgPrimary} flex flex-col`} dir={direction}>
        <Navigation />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/50 rounded-2xl p-8 text-center shadow-xl">
            <span className="text-5xl block mb-4">⚠️</span>
            <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-2">
              {language === 'hebrew' ? 'גישה מוגבלת' : 'Access Restricted'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 font-medium mb-6">{errorMessage}</p>
            <button onClick={() => navigate('/')} className="bg-emerald-500 text-white px-6 py-2.5 rounded-full text-sm font-semibold shadow-md">
              {language === 'hebrew' ? 'חזרה' : 'Return'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.bgPrimary} flex flex-col`} dir={direction} style={{ height: '100vh', overflow: 'hidden' }}>
      <Navigation />
      <main className={`flex-1 overflow-y-auto custom-scrollbar ${isDarkMode ? themeData.heroGradientDark : themeData.heroGradientLight}`} style={{ minHeight: 0 }}>
        
        <section className="py-16 sm:py-20 px-4 max-w-5xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold mb-6 leading-tight">
            <span className={themeData.accentText || 'text-emerald-500'}>
              {language === 'hebrew' ? titleObj.hebrew : titleObj.english}
            </span>
            <br />
            <span className={`${themeClasses.textPrimary} text-2xl sm:text-3xl md:text-4xl font-normal`}>
              Partner Invite via: <span className="font-bold text-emerald-500">{managerData?.name || 'Partner'}</span>
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-emerald-700 dark:text-emerald-200 mb-6 max-w-4xl mx-auto font-medium">
            {language === 'hebrew' ? subtitleObj.hebrew : subtitleObj.english}
          </p>

          <p className={`text-lg ${themeClasses.textSecondary} mb-8 max-w-3xl mx-auto`}>
            {language === 'hebrew' ? paragraphObj.hebrew : paragraphObj.english}
          </p>

          {/* Scarcity Banner Container Element - Safely reveals only when smart campaign telemetry properties are present */}
          {campaignData?.isSmartLink && campaignData?.slotsRemaining !== null && (
            <div className="max-w-md mx-auto mb-8 bg-amber-500/10 dark:bg-amber-400/5 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-around gap-4 animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="text-2xl animate-pulse">🔥</span>
                <div className={language === 'hebrew' ? 'text-right' : 'text-left'}>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">
                    {language === 'hebrew' ? 'מקומות נותרו' : 'Slots Available'}
                  </p>
                  <p className="text-base font-bold text-amber-600 dark:text-amber-400">
                    {language === 'hebrew' 
                      ? `נותרו רק עוד ${campaignData.slotsRemaining} מקומות`
                      : `Only ${campaignData.slotsRemaining} slots left`}
                  </p>
                </div>
              </div>
              <div className="hidden sm:block w-px h-8 bg-gray-300 dark:bg-gray-800"></div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">⏳</span>
                <div className={language === 'hebrew' ? 'text-right' : 'text-left'}>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">
                    {language === 'hebrew' ? 'זמן מוגבל' : 'Limited Offer'}
                  </p>
                  <p className="text-base font-bold text-gray-700 dark:text-gray-300">
                    {getRemainingTimeText(campaignData.expiresAt) || (language === 'hebrew' ? 'זמן מוגבל' : 'Limited time')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-center mb-12">
            <button 
              onClick={() => navigate(`/signup${location.hash}`)} 
              className={`${themeData.ctaButton || 'bg-emerald-500 text-white'} px-12 py-5 rounded-full text-xl font-medium transform hover:scale-105 transition-all duration-300 shadow-xl`}
            >
              {language === 'hebrew' ? ctaObj.hebrew : ctaObj.english}
            </button>
          </div>
        </section>

        {/* WhatsApp Preview Simulator Container */}
        <section className="pb-20 max-w-2xl mx-auto px-4">
          <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-[#e5ddd5]'} rounded-2xl shadow-2xl overflow-hidden`}>
            <div className={`${themeData.whatsappHeader || 'bg-[#075e54]'} px-4 py-4 flex items-center`}>
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center mr-3">
                <span className="text-white text-xl">🤖</span>
              </div>
              <div>
                <p className="text-white font-semibold">{companySlug.toUpperCase()} Dashboard Portal</p>
                <p className="text-green-100 text-xs">{language === 'hebrew' ? 'מחובר' : 'Online'}</p>
              </div>
            </div>
            <div className="p-4 space-y-3 min-h-[180px]" dir="ltr">
              {chatAnimation.showImage && (
                <div className="flex justify-end animate-fadeIn">
                  <div className={`${isDarkMode ? 'bg-green-700' : 'bg-[#dcf8c6]'} rounded-lg p-3 max-w-[75%] shadow-sm text-sm text-gray-800 dark:text-white`}>
                    📷 Onboarding Pipeline Connected.
                  </div>
                </div>
              )}
              {chatAnimation.showTyping && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-2.5 shadow-sm text-xs text-gray-400">typing...</div>
                </div>
              )}
              {chatAnimation.showBotMessage && (
                <div className="flex justify-start animate-fadeIn">
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-4 max-w-[85%] shadow-sm text-sm text-gray-800 dark:text-gray-100">
                    Configuration identity mapped to application viewport theme styles.
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

export default LandingPage;