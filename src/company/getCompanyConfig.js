// Clean, decoupled legacy resolver
// All static imports have been removed. The app now uses Supabase DB for dynamic configs.

const legacyDefaultConfig = {
  ui: {
    layout: "default",
    themeSettings: {}
  },
  content: {},
  theme: {
    bgPrimary: "bg-stone-50 dark:bg-stone-900",
    textPrimary: "text-stone-900 dark:text-white"
  },
  // Safe baselines so the onboarding engine never crashes during migration
  onboarding: {
    mealPlanTrigger: "after_subscription_path",
    showUsageBasedOffer: true,
    sendWelcomeDuringOnboarding: true,
    includeNursingStatusQuestion: true,
    setPendingPaymentAfterSubmit: true
  }
};

export const normalizeCompanyName = (companyName = '') => String(companyName || '').trim().toLowerCase();

export const getCompanyConfig = (companyName = '') => {
  const normalizedCompanyName = normalizeCompanyName(companyName);
  
  // Return a safe fallback so legacy components don't crash during the DB migration
  return {
    ...legacyDefaultConfig,
    normalizedCompanyName
  };
};