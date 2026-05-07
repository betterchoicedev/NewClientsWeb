const defaultCompanyConfig = {
  key: 'default',
  theme: {
    pricingHeaderGradient: 'from-blue-500 to-purple-500',
    pricingHeaderIconGradient: 'from-blue-500 to-purple-500'
  },
  pricing: {
    enableDigitalPromoCode: false,
    showWhatEveryPlanIncludes: true,
    showExchangeRateNote: true,
    sectionOrder: ['header', 'categories', 'includes', 'exchangeRate', 'products'],
    content: {
      title: {
        hebrew: 'בחר את התוכנית המתאימה לך',
        english: 'Choose Your Perfect Plan'
      },
      subtitle: {
        hebrew: 'השג את היעדים התזונתיים שלך עם המומחים שלנו. תוכניות מותאמות אישית לכל צורך ותקציב.',
        english: 'Achieve your nutrition goals with our expert team. Personalized plans for every need and budget.'
      }
    }
  },
  onboarding: {
    includeNursingStatusQuestion: false,
    showUsageBasedOffer: true,
    showUsageOfferPaidCta: true,
    setPendingPaymentAfterSubmit: true,
    sendWelcomeDuringOnboarding: true,
    sendWelcomeAfterSuccessfulPaymentOnly: false,
    mealPlanTrigger: 'after_subscription_path'
  }
};

export default defaultCompanyConfig;

