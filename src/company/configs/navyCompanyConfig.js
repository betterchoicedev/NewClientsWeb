const navyCompanyConfig = {
  key: 'navy',
    onboarding: {
    ...defaultCompanyConfig.onboarding,
    showUsageBasedOffer: false,
    showUsageOfferPaidCta: false,
    setPendingPaymentAfterSubmit: false,
    sendWelcomeDuringOnboarding: false,
    sendWelcomeAfterSuccessfulPaymentOnly: true,
    mealPlanTrigger: 'immediately_after_last_question'
  },
  theme: {
    heroGradientDark: 'from-slate-900 via-blue-950 to-slate-900',
    heroGradientLight: 'from-blue-50 via-slate-50 to-cyan-100',
    accentText: 'text-cyan-400 dark:text-cyan-400 light:text-blue-800',
    ctaButton: 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white',
    whatsappHeader: 'bg-[#1e3a8a] dark:bg-blue-950'
  },
  content: {
    heroTitle: {
      english: 'Navy Tactical Performance Portal',
      hebrew: 'פורטל ביצועי טקטיקה - חיל הים'
    },
    heroSubtitle: {
      english: 'Operational fueling blueprints optimized for high-intensity physical conditioning metrics.',
      hebrew: 'תוכניות הזנה מבצעיות המותאמות אישית למדדי כושר קרבי בעצימות גבוהה.'
    },
    heroParagraph: {
      english: 'Access high-efficiency macronutrient targets engineered to accelerate recovery thresholds and sustain cognitive physical power.',
      hebrew: 'קבלו גישה ליעדי תזונה בעלי יעילות גבוהה המתוכננים להאצת תהליכי התאוששות ושימור כוח פיזי ומנטלי במצבי קיצון.'
    },
    ctaText: {
      english: 'Initialize Deployment Plan →',
      hebrew: 'התחל תוכנית פריסה ←'
    }
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
  }
};

export default navyCompanyConfig;