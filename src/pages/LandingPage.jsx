import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Navigation from '../components/Navigation';
import { motion, AnimatePresence } from 'framer-motion';

// Import our highly scalable Template Factory
import { getTemplate } from '../company/templates';

export default function LandingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, direction } = useLanguage();
  const { isDarkMode } = useTheme();

  const [isValidating, setIsValidating] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [managerData, setManagerData] = useState(null);
  const [campaignData, setCampaignData] = useState(null);
  const [companySlug, setCompanySlug] = useState('default');
  const [dbConfig, setDbConfig] = useState(null);

  useEffect(() => {
    const validateCampaign = async () => {
      try {
        setIsValidating(true);
        setErrorMessage(null);

        const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
        let rawHashToken = hashParams.get('d');
        
        if (!rawHashToken) {
          throw new Error('INVALID_TOKEN_STRUCTURE');
        }

        // 🛠️ FIX BUG 1: Convert corrupted spaces back to valid base64 '+' signs
        const sanitizedHashToken = rawHashToken.replace(/ /g, '+');

        let manager_id = null;
        let link_id = null;
        let max_clients = null;
        let expiry_date = null;

        try {
          let decodedString = atob(sanitizedHashToken).trim();
          
          if (!decodedString.startsWith('{') && decodedString.includes('"manager_id"')) {
            decodedString = '{"link_id":"' + decodedString;
          }

          if (decodedString.startsWith('{')) {
            const decodedPayload = JSON.parse(decodedString);
            manager_id = decodedPayload.manager_id || null;
            link_id = decodedPayload.link_id || null;
            max_clients = decodedPayload.max_clients || null;
            expiry_date = decodedPayload.expiry_date || null;
          } else {
            manager_id = decodedString;
          }
        } catch (e) {
          console.error('Base64 Decoding Fault:', e);
          throw new Error('INVALID_TOKEN_STRUCTURE');
        }

        if (!manager_id && !link_id) {
          throw new Error('INVALID_TOKEN_STRUCTURE');
        }

        if (expiry_date && new Date(expiry_date) < new Date()) {
          const err = new Error('CAMPAIGN_EXPIRED');
          err.status = 410;
          throw err;
        }

        const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';        
        const response = await fetch(`${apiUrl}/api/landing/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ managerId: manager_id, linkId: link_id })
        });

        const resData = await response.json();

        if (!response.ok) {
          const err = new Error(resData.error || 'Validation failure');
          err.status = response.status;
          throw err;
        }

        const serverMaxSlots = resData.campaign?.maxSlots || max_clients;
        const serverCurrentCount = resData.campaign?.currentCount || 0;

        if (serverMaxSlots && serverCurrentCount >= serverMaxSlots) {
          const errorInstance = new Error('REGISTRATION_LIMIT_REACHED');
          errorInstance.status = 403;
          throw errorInstance;
        }

        // Now manager_id is reliably populated from backend if we only sent link_id
        if (!manager_id && resData.manager?.id) {
          manager_id = resData.manager.id;
        }

        // 🛠️ FIX BUG 2: Map structural fallbacks to handle both nested or flat DB configuration profiles
        const rawCompanyConfig = resData.company.config || {};
        const rawColors =
          rawCompanyConfig.ui?.themeSettings?.colors ||
          rawCompanyConfig.themeSettings?.colors ||
          {};
        const safeConfig = {
          ui: {
            layout: rawCompanyConfig.ui?.layout || rawCompanyConfig.layout || 'centered',
            themeSettings: {
              colors: {
                surface: rawColors.surface || 'rgba(24, 20, 18, 0.85)',
                primary: rawColors.primary || '#E29578',
                textOnPrimary: rawColors.textOnPrimary || '#FFFFFF',
                secondary: rawColors.secondary || '#3E3026',
                textOnSecondary: rawColors.textOnSecondary || '#FFFFFF',
                accent: rawColors.accent || '#FFDAB9',
                textMain: rawColors.textMain || '#FFFDFB',
                textMuted: rawColors.textMuted || '#CDBBAA',
              },
            },
          },
          content: rawCompanyConfig.content || {
            heroTitle: { english: 'Welcome', hebrew: 'ברוכים הבאים' },
            heroSubtitle: { english: '', hebrew: '' },
            heroParagraph: { english: '', hebrew: '' },
            ctaText: { english: 'Continue', hebrew: 'המשך' },
            features: { english: [], hebrew: [] },
          },
        };

        setCompanySlug(resData.company.slug);
        setManagerData(resData.manager);
        setDbConfig(safeConfig);
        
        const tokenLimitedLink = !!(link_id && (max_clients != null || expiry_date));
        const resolvedMaxSlots = serverMaxSlots ?? (max_clients != null ? Number(max_clients) : null);
        const resolvedCurrentCount = resData.campaign?.currentCount ?? 0;
        const resolvedSlotsRemaining =
          resData.campaign?.slotsRemaining ??
          (resolvedMaxSlots != null ? Math.max(0, resolvedMaxSlots - resolvedCurrentCount) : null);

        setCampaignData({
          isSmartLink: !!resData.campaign?.isSmartLink || tokenLimitedLink,
          maxSlots: resolvedMaxSlots,
          slotsRemaining: resolvedSlotsRemaining,
          expiresAt: expiry_date || resData.campaign?.expiresAt,
          skipPricing: !!resData.campaign?.skipPricing,
        });

      } catch (err) {
        console.error('Landing Page Exception Caught:', err);
        if (err.message === 'INVALID_TOKEN_STRUCTURE') {
          setErrorMessage(language === 'hebrew' ? 'מבנה קישור לא חוקי' : 'Invalid link structure.');
        } else if (err.status === 410 || err.message === 'CAMPAIGN_EXPIRED') {
          setErrorMessage(language === 'hebrew' ? 'פג תוקף הקמפיין' : 'Campaign expired.');
        } else if (err.status === 403 || err.message === 'REGISTRATION_LIMIT_REACHED') {
          setErrorMessage(language === 'hebrew' ? 'מכסת ההרשמה מלאה' : 'Registration full.');
        } else {
          setErrorMessage(language === 'hebrew' ? 'שגיאת אימות נתונים' : 'Database verification failure.');
        }
      } finally {
        setIsValidating(false);
      }
    };

    validateCampaign();
  }, [location.hash, language]);

  // Safely retrieve template only if we have configurations to prevent factory execution errors during load
  const SelectedTemplate = (!isValidating && !errorMessage) ? getTemplate(dbConfig?.ui?.layout) : null;

  return (
    <div 
      className={`min-h-screen language-transition language-text-transition flex flex-col ${
        isDarkMode 
          ? 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900' 
          : 'bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-100'
      }`} 
      dir={direction} 
      style={{ height: '100vh', overflow: 'hidden' }}
    >
      <AnimatePresence>
        {!isValidating && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="z-50 shrink-0"
          >
            <Navigation />
          </motion.div>
        )}
      </AnimatePresence>
      
      <main 
        className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative z-10" 
        style={{ minHeight: 0 }}
      >
        <AnimatePresence mode="wait">
          {isValidating ? (
            <motion.div 
              key="validating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, filter: 'blur(10px)', scale: 1.05 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              className="flex-1 flex items-center justify-center w-full h-full"
            >
              <div className="flex flex-col items-center gap-6">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className={`w-14 h-14 rounded-full border-4 ${
                    isDarkMode ? 'border-emerald-500/20 border-t-emerald-400' : 'border-emerald-600/20 border-t-emerald-600'
                  } shadow-[0_0_15px_rgba(52,211,153,0.3)]`} 
                />
                <motion.p 
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className={`font-mono tracking-[0.2em] text-xs uppercase font-semibold ${
                    isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                  }`}
                >
                  SECURE_HANDSHAKE_INIT // VALIDATING
                </motion.p>
              </div>
            </motion.div>
          ) : errorMessage ? (
            <motion.div 
              key="error"
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }}
              className="flex-1 flex items-center justify-center p-4 w-full h-full"
            >
              <div className={`max-w-md w-full backdrop-blur-xl border rounded-[2rem] p-8 md:p-12 shadow-[0_0_40px_rgba(225,29,72,0.15)] text-center transition-all duration-300 relative overflow-hidden ${
                isDarkMode 
                  ? 'bg-slate-900/60 border-rose-500/30' 
                  : 'bg-white/80 border-rose-400/40'
              }`}>
                {/* Soft glowing ambient orb for premium depth */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-rose-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none" />

                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: [0, 8, -8, 0] }}
                  transition={{ duration: 0.6, type: 'spring', bounce: 0.6, delay: 0.1 }}
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-inner border ${
                    isDarkMode 
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                      : 'bg-rose-100 text-rose-600 border-rose-200'
                  }`}
                >
                  ⚠️
                </motion.div>
                
                <h2 className={`text-2xl font-black mb-3 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {language === 'hebrew' ? 'גישה מוגבלת' : 'Access Restricted'}
                </h2>
                
                <p className={`font-medium text-sm leading-relaxed mb-8 px-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  {errorMessage}
                </p>
                
                <motion.button 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/')} 
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm tracking-wide shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 relative overflow-hidden group"
                >
                  <span className="relative z-10">{language === 'hebrew' ? 'חזרה לדף הבית' : 'Return to Safe Base'}</span>
                  <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="template"
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -20 }}
              transition={{ duration: 0.6, type: 'spring', bounce: 0.2 }}
              className="flex-1 flex flex-col w-full min-h-full"
            >
              {SelectedTemplate && (
                <SelectedTemplate 
                  config={dbConfig}
                  campaign={campaignData}
                  manager={managerData}
                  companySlug={companySlug}
                  navigate={navigate}
                  hash={location.hash}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}