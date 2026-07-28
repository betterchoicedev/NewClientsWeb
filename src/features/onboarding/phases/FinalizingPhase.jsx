import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { useOnboardingStore, PHASES } from '../onboarding.store';
import { getOnboardingStatus } from '../api/onboardingApi';
import { isOnboardingHebrew } from '../onboardingLocale';
import OnboardingPanel from '../components/OnboardingPanel';

const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 120000;

export default function FinalizingPhase({ onComplete }) {
  const { isDarkMode } = useTheme();
  const language = useOnboardingStore((s) => s.answers.language);
  const forcePhase = useOnboardingStore((s) => s.forcePhase);
  const setError = useOnboardingStore((s) => s.setError);
  const isHe = isOnboardingHebrew(language);
  const [statusText, setStatusText] = useState('');
  const startedAtRef = useRef(Date.now());
  const completedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId;

    const finish = () => {
      if (completedRef.current || cancelled) return;
      completedRef.current = true;
      forcePhase(PHASES.DONE);
      onComplete?.(true);
    };

    const poll = async () => {
      if (completedRef.current || cancelled) return;

      if (Date.now() - startedAtRef.current > MAX_WAIT_MS) {
        setError(
          isHe
            ? 'יצירת תוכנית הארוחות לוקחת יותר מהרגיל — נסו שוב בעוד רגע'
            : 'Meal plan creation is taking longer than usual — please wait a moment'
        );
        return;
      }

      try {
        const status = await getOnboardingStatus();
        if (cancelled || completedRef.current) return;

        if (status.mealPlanReady) {
          setStatusText(isHe ? 'התוכנית מוכנה!' : 'Your plan is ready!');
          finish();
          return;
        }

        setStatusText(
          isHe ? 'מכינים את תוכנית הארוחות שלך...' : 'Creating your meal plan...'
        );
      } catch {
        if (!cancelled) {
          setStatusText(
            isHe ? 'ממתינים לשרת... מנסים שוב' : 'Waiting for server... retrying'
          );
        }
      }
    };

    poll();
    intervalId = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [forcePhase, isHe, onComplete, setError]);

  return (
    <OnboardingPanel maxWidthClass="max-w-lg" hideHeader>
      <div className="text-center space-y-6 py-12 px-4">
        <div className="relative mx-auto w-20 h-20" aria-hidden>
          <div
            className="absolute inset-0 rounded-full border-[3px] border-emerald-500/25"
            style={{ transform: 'translateZ(0)' }}
          />
          <div
            className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-emerald-400 border-r-teal-500 animate-spin"
            style={{ transform: 'translateZ(0)', animationDuration: '1.1s' }}
          />
          <div
            className="absolute inset-3 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-500/10 backdrop-blur-sm"
            style={{
              transform: 'translateZ(0)',
              animation: 'obFinalizePulse 2.4s ease-in-out infinite',
            }}
          />
        </div>

        <div className="space-y-2" style={{ animation: 'obFinalizeFade 600ms ease-out both' }}>
          <h2 className={`text-xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {isHe ? 'יוצרים את תוכנית הארוחות שלך' : 'Creating your meal plan'}
          </h2>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {statusText || (isHe ? 'רגע אחד, אנחנו על זה' : 'Just a moment, we are on it')}
          </p>
        </div>

        <style>{`
          @keyframes obFinalizePulse {
            0%, 100% { opacity: 0.55; transform: scale(1) translateZ(0); }
            50% { opacity: 1; transform: scale(1.06) translateZ(0); }
          }
          @keyframes obFinalizeFade {
            from { opacity: 0; transform: translateY(8px) translateZ(0); }
            to { opacity: 1; transform: translateY(0) translateZ(0); }
          }
        `}</style>
      </div>
    </OnboardingPanel>
  );
}
