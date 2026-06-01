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

        let manager_id = null;
        let link_id = null;
        let max_clients = null;
        let expiry_date = null;

        try {
          let decodedString = atob(rawHashToken).trim();
          
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

        const safeConfig = {
          ui: {
            layout: resData.company.config?.ui?.layout || 'centered',
            themeSettings: resData.company.config?.ui?.themeSettings || {
              innerBorder: 'border-gray-200',
              ctaButtonClass: 'bg-emerald-500 text-white hover:bg-emerald-600',
              accentTextColor: 'text-emerald-500',
              innerBgGradient: ''
            }
          },
          content: resData.company.config?.content || {
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900" dir={direction}>
        <Navigation />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/50 rounded-2xl p-8 text-center shadow-xl">
            <span className="text-5xl block mb-4">⚠️</span>
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">
              {language === 'hebrew' ? 'גישה מוגבלת' : 'Access Restricted'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 font-medium mb-6">{errorMessage}</p>
            <button 
              onClick={() => navigate('/')} 
              className="bg-emerald-500 text-white px-6 py-2.5 rounded-full text-sm font-semibold shadow-md"
            >
              {language === 'hebrew' ? 'חזרה' : 'Return'}
            </button>
          </div>
        </main>
      </div>
    );
  }

 const SelectedTemplate = getTemplate(dbConfig.ui.layout);

  return (
    <div 
      className="min-h-screen language-transition language-text-transition flex flex-col" 
      dir={direction} 
      style={{ height: '100vh', overflow: 'hidden' }}
    >
      <Navigation />
      
      {/* 🌐 The outside background is locked to the master website theme fade */}
      <main 
        className={`flex-1 overflow-y-auto custom-scrollbar flex flex-col ${
          isDarkMode 
            ? 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900' 
            : 'bg-gradient-to-br from-emerald-50 via-green-50 to-amber-50'
        }`} 
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