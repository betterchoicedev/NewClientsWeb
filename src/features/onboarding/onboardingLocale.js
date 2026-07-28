/**
 * Onboarding UI is Hebrew only when preferred language is `he`.
 * All other preferred languages keep English UI; AI chat uses the stored code.
 */
export function isOnboardingHebrew(langCode) {
  return String(langCode || '').toLowerCase() === 'he';
}

/** Sync app LanguageContext from preferred-language code. */
export function applyPreferredLanguageToApp(langCode, { setLanguage, setDirection }) {
  const he = isOnboardingHebrew(langCode);
  const next = he ? 'hebrew' : 'english';
  const dir = he ? 'rtl' : 'ltr';
  try {
    setLanguage?.(next);
    setDirection?.(dir);
    localStorage.setItem('language', next);
  } catch (_) {
    /* ignore */
  }
}
