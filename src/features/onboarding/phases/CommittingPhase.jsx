import React from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { useOnboardingStore } from '../onboarding.store';
import { isOnboardingHebrew } from '../onboardingLocale';
import OnboardingPanel from '../components/OnboardingPanel';

export default function CommittingPhase() {
  const { isDarkMode } = useTheme();
  const language = useOnboardingStore((s) => s.answers.language);
  const isHe = isOnboardingHebrew(language);

  return (
    <OnboardingPanel maxWidthClass="max-w-lg">
      <div className="text-center space-y-4 py-10">
        <div className="w-10 h-10 mx-auto border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className={`text-base font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {isHe ? 'שומרים את הפרטים שלך...' : 'Saving your profile...'}
        </p>
        <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {isHe ? 'רגע אחד' : 'Just a moment'}
        </p>
      </div>
    </OnboardingPanel>
  );
}
