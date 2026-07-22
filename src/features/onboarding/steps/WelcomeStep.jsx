import React from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { useOnboardingStore, PHASES } from '../onboarding.store';
import { isOnboardingHebrew } from '../onboardingLocale';
import OnboardingPanel, { GlassPrimaryButton } from '../components/OnboardingPanel';

export default function WelcomeStep({ onStart }) {
  const { isDarkMode } = useTheme();
  const forcePhase = useOnboardingStore((s) => s.forcePhase);
  const language = useOnboardingStore((s) => s.answers.language);
  const companyName = useOnboardingStore((s) => s.companyName);
  const isHe = isOnboardingHebrew(language);
  const brand = (companyName && String(companyName).trim()) || 'BetterChoice';

  const start = () => {
    forcePhase(PHASES.QUESTIONS);
    onStart?.();
  };

  return (
    <OnboardingPanel
      variant="immersive"
      maxWidthClass="max-w-lg"
      footer={
        <GlassPrimaryButton className="w-full" onClick={start}>
          {isHe ? 'התחלה' : 'Start'}
        </GlassPrimaryButton>
      }
    >
      <div className="relative min-h-[min(48vh,380px)] flex flex-col items-center justify-center text-center px-8 pt-14 pb-4 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: isDarkMode
              ? 'radial-gradient(ellipse at 30% 20%, rgba(16,185,129,0.22), transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(20,184,166,0.14), transparent 50%)'
              : 'radial-gradient(ellipse at 30% 20%, rgba(16,185,129,0.18), transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(45,212,191,0.16), transparent 50%)',
            animation: 'obWelcomeDrift 12s ease-in-out infinite alternate',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: isDarkMode
              ? 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)'
              : 'radial-gradient(rgba(6,78,59,0.07) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
          }}
        />

        <div
          className="relative z-[1] flex flex-col items-center gap-4 max-w-sm"
          style={{ animation: 'obWelcomeRise 650ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
        >
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
            {brand}
          </h1>
          <p
            className={`text-sm sm:text-base font-medium leading-relaxed max-w-[17.5rem] ${
              isDarkMode ? 'text-slate-300' : 'text-slate-600'
            }`}
            style={{ animation: 'obWelcomeRise 650ms cubic-bezier(0.22, 1, 0.36, 1) 100ms both' }}
          >
            {isHe
              ? 'כמה שאלות קצרות, ואז בחירת תוכנית ותשלום.'
              : 'A few short questions, then plan selection and payment.'}
          </p>
        </div>

        <style>{`
          @keyframes obWelcomeRise {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes obWelcomeDrift {
            from { transform: translate3d(0, 0, 0) scale(1); }
            to { transform: translate3d(12px, -8px, 0) scale(1.05); }
          }
        `}</style>
      </div>
    </OnboardingPanel>
  );
}
