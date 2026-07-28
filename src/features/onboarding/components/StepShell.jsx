import React from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { useOnboardingStore } from '../onboarding.store';
import { isOnboardingHebrew } from '../onboardingLocale';
import OnboardingPanel, { GlassPrimaryButton, GlassSecondaryButton } from './OnboardingPanel';

/**
 * Question-step chrome — inherits premium liquid glass from OnboardingPanel.
 * Minimal header: thin progress + title.
 */
export default function StepShell({
  title,
  stepIndex,
  totalSteps,
  onBack,
  onNext,
  nextLabel,
  backLabel,
  nextDisabled,
  loading,
  error,
  children,
  hideNav = false,
}) {
  const { isDarkMode } = useTheme();
  const language = useOnboardingStore((s) => s.answers.language);
  const isHe = isOnboardingHebrew(language);
  const progress = totalSteps > 0 ? ((stepIndex + 1) / totalSteps) * 100 : 0;

  const footer = hideNav ? null : (
    <div className="flex gap-3">
      <GlassSecondaryButton className="flex-1" onClick={onBack} disabled={loading}>
        {backLabel || (isHe ? 'חזרה' : 'Back')}
      </GlassSecondaryButton>
      <GlassPrimaryButton className="flex-1" onClick={onNext} disabled={nextDisabled || loading}>
        {loading ? (isHe ? 'טוען...' : 'Loading...') : (nextLabel || (isHe ? 'המשך' : 'Continue'))}
      </GlassPrimaryButton>
    </div>
  );

  return (
    <OnboardingPanel footer={footer}>
      <div className="space-y-4">
        <div>
          <div
            className={`h-1.5 rounded-full overflow-hidden backdrop-blur-sm ${
              isDarkMode ? 'bg-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]' : 'bg-emerald-900/10 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]'
            }`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.45)] transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          {title && (
            <h2 className={`mt-3 text-xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {title}
            </h2>
          )}
        </div>

        {error && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm backdrop-blur-md ${
              isDarkMode
                ? 'border-red-400/25 bg-red-950/35 text-red-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                : 'border-red-200/80 bg-red-50/70 text-red-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]'
            }`}
            role="alert"
          >
            {error}
          </div>
        )}

        {children}
      </div>
    </OnboardingPanel>
  );
}
