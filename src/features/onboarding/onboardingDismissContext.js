import { createContext, useContext } from 'react';

const OnboardingDismissContext = createContext(null);

export function OnboardingDismissProvider({ onDismiss, children }) {
  return (
    <OnboardingDismissContext.Provider value={onDismiss}>
      {children}
    </OnboardingDismissContext.Provider>
  );
}

export function useOnboardingDismiss() {
  return useContext(OnboardingDismissContext);
}
