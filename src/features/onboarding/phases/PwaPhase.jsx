import React, { useState } from 'react';
import { Smartphone } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useOnboardingStore, PHASES } from '../onboarding.store';
import { isOnboardingHebrew } from '../onboardingLocale';
import OnboardingPanel, { GlassPrimaryButton, btnGhost } from '../components/OnboardingPanel';
import { completeOnboardingAfterPayment } from '../api/onboardingApi';
import AppStoreBadges from '../components/AppStoreBadges';

export default function PwaPhase({ onComplete }) {
  const { isDarkMode } = useTheme();
  const language = useOnboardingStore((s) => s.answers.language);
  const isHe = isOnboardingHebrew(language);
  const forcePhase = useOnboardingStore((s) => s.forcePhase);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  React.useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const finish = async () => {
    try {
      await completeOnboardingAfterPayment();
    } catch (e) {
      console.warn('[PwaPhase] complete onboarding failed', e);
    }
    forcePhase(PHASES.DONE);
    onComplete?.(true);
  };

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
    finish();
  };

  return (
    <OnboardingPanel
      maxWidthClass="max-w-lg"
      footer={
        <div className="space-y-2">
          {deferredPrompt && (
            <GlassPrimaryButton className="w-full" onClick={install}>
              {isHe ? 'הוסף עכשיו' : 'Install now'}
            </GlassPrimaryButton>
          )}
          <button type="button" onClick={finish} className={`w-full ${btnGhost(isDarkMode)}`}>
            {isHe ? 'דלג' : 'Skip'}
          </button>
        </div>
      }
    >
      <div className="text-center space-y-6 py-6">
        <div
          className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center border backdrop-blur-md ${
            isDarkMode
              ? 'bg-white/5 border-white/15 text-emerald-300'
              : 'bg-white/50 border-white/70 text-emerald-700'
          }`}
        >
          <Smartphone size={28} aria-hidden />
        </div>
        <div className="space-y-2">
          <h2 className={`text-xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {isHe ? 'התקנת האפליקציה' : 'Install the app'}
          </h2>
          <p className={`text-sm font-medium leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {isHe
              ? 'הורידו את האפליקציה או הוסיפו למסך הבית לגישה מהירה לתוכנית ולמעקב.'
              : 'Download the app or add to your home screen for quick access to your plan and tracking.'}
          </p>
        </div>

        <div className="space-y-3 w-full px-1 sm:px-2">
          <p className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {isHe ? 'הורדה מהחנות' : 'Download from the store'}
          </p>
          <AppStoreBadges />
        </div>
      </div>
    </OnboardingPanel>
  );
}
