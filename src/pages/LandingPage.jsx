import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Navigation from '../components/Navigation';

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
            manager_id = decodedPayload.manager_id;
            link_id = decodedPayload.link_id;
            max_clients = decodedPayload.max_clients;
            expiry_date = decodedPayload.expiry_date;
          } else {
            manager_id = decodedString;
          }
        } catch (e) {
          console.error('Base64 Decoding Fault:', e);
          throw new Error('INVALID_TOKEN_STRUCTURE');
        }

        if (!manager_id) {
          throw new Error('INVALID_TOKEN_STRUCTURE');
        }

        if (expiry_date && new Date(expiry_date) < new Date()) {
          const err = new Error('CAMPAIGN_EXPIRED');
          err.status = 410;
          throw err;
        }

        const apiUrl = process.env.REACT_APP_API_URL || '';
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

        // 🛠️ FIX BUG 2: Map structural fallbacks to handle both nested or flat DB configuration profiles
        const rawCompanyConfig = resData.company.config || {};
        const safeConfig = {
          ui: {
            layout: rawCompanyConfig.ui?.layout || rawCompanyConfig.layout || 'centered',
            themeSettings: rawCompanyConfig.ui?.themeSettings || rawCompanyConfig.themeSettings || {
              colors: {
                surface: "#ffffff",
                primary: "#10b981",
                secondary: "#a7f3d0",
                accent: "#34d399",
                textMain: "#064e3b",
                textMuted: "#4b5563"
              }
            }
          },
          content: rawCompanyConfig.content || {
            heroTitle: { english: 'Welcome', hebrew: 'ברוכים הבאים' },
            heroSubtitle: { english: '', hebrew: '' },
            ctaText: { english: 'Continue', hebrew: 'המשך' }
          }
        };

        setCompanySlug(resData.company.slug);
        setManagerData(resData.manager);
        setDbConfig(safeConfig);
        
        setCampaignData({
          isSmartLink: !!resData.campaign?.isSmartLink,
          maxSlots: serverMaxSlots,
          slotsRemaining: resData.campaign?.slotsRemaining,
          expiresAt: expiry_date || resData.campaign?.expiresAt
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

  if (isValidating) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-400 animate-spin" />
          <p className="text-emerald-400 font-mono tracking-widest text-xs uppercase safe animate-pulse">
            SECURE_HANDSHAKE_INIT // VALIDATING
          </p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900" dir={direction}>
        <Navigation />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-stone-950/60 backdrop-blur-xl border border-rose-500/20 rounded-[2rem] p-8 md:p-12 shadow-2xl text-center transition-all duration-300">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-6 animate-pulse">
              ⚠️
            </div>
            <h2 className="text-2xl font-black text-white mb-3 tracking-tight">
              {language === 'hebrew' ? 'גישה מוגבלת' : 'Access Restricted'}
            </h2>
            <p className="text-stone-300 font-medium text-sm leading-relaxed mb-8 px-2">
              {errorMessage}
            </p>
            <button 
              onClick={() => navigate('/')} 
              className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold text-sm tracking-wide shadow-lg hover:from-emerald-600 hover:to-green-700 transition-all duration-300 transform active:scale-95"
            >
              {language === 'hebrew' ? 'חזרה לדף הבית' : 'Return to Safe Base'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  const SelectedTemplate = getTemplate(dbConfig?.ui?.layout);

  return (
    <div 
      className="min-h-screen language-transition language-text-transition flex flex-col" 
      dir={direction} 
      style={{ height: '100vh', overflow: 'hidden' }}
    >
      <Navigation />
      
      <main 
        className="flex-1 overflow-y-auto custom-scrollbar flex flex-col bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900" 
        style={{ minHeight: 0 }}
      >
        <SelectedTemplate 
          config={dbConfig}
          campaign={campaignData}
          manager={managerData}
          companySlug={companySlug}
          navigate={navigate}
          hash={location.hash}
        />
      </main>
    </div>
  );
}