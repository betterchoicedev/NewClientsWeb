import defaultCompanyConfig from './defaultCompanyConfig';

const navyCompanyConfig = {
  ...defaultCompanyConfig,
  key: 'navy',
  theme: {
    ...defaultCompanyConfig.theme,
    pricingHeaderIconGradient: 'from-indigo-500 to-blue-500'
  },
  pricing: {
    ...defaultCompanyConfig.pricing,
    enableDigitalPromoCode: true,
    sectionOrder: ['header', 'categories', 'includes', 'exchangeRate', 'products'],
    content: {
      ...defaultCompanyConfig.pricing.content,
      subtitle: {
        hebrew: 'תוכניות Navy מותאמות אישית עם הטבות ייחודיות.',
        english: 'Navy-tailored plans with exclusive benefits.'
      }
    }
  },
  onboarding: {
    ...defaultCompanyConfig.onboarding,
    showUsageBasedOffer: false,
    showUsageOfferPaidCta: false,
    setPendingPaymentAfterSubmit: false,
    sendWelcomeDuringOnboarding: false,
    sendWelcomeAfterSuccessfulPaymentOnly: true,
    mealPlanTrigger: 'immediately_after_last_question'
  }
};

export default navyCompanyConfig;

