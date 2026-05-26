const defaultCompanyConfig = {
  key: 'betterchoice',
    onboarding: {
    includeNursingStatusQuestion: false,
    showUsageBasedOffer: true,
    showUsageOfferPaidCta: true,
    setPendingPaymentAfterSubmit: true,
    sendWelcomeDuringOnboarding: true,
    sendWelcomeAfterSuccessfulPaymentOnly: false,
    mealPlanTrigger: 'after_subscription_path'
  },
  theme: {
    heroGradientDark: 'from-slate-900 via-emerald-950 to-slate-900',
    heroGradientLight: 'from-emerald-50 via-green-50 to-amber-50',
    accentText: 'text-emerald-400 dark:text-emerald-300 light:text-emerald-700',
    ctaButton: 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white',
    whatsappHeader: 'bg-[#075e54] dark:bg-gray-800'
  },
  content: {
    heroTitle: {
      english: 'BetterChoice AI Partner Portal',
      hebrew: 'BetterChoice AI פורטל שותפים'
    },
    heroSubtitle: {
      english: 'Nutrition that works for you, every day. Stop fighting your food. Start fueling your life.',
      hebrew: 'תזונה שעובדת בשבילך, כל יום. מפסיקים להילחם באוכל. מתחילים להזין את החיים.'
    },
    heroParagraph: {
      english: 'Imagine waking up feeling light, confident, and finally in control. No more "diets"—just better choices that actually last.',
      hebrew: 'דמיינו שאתם קמים בבוקר בתחושת קלילות, ביטחון, ושליטה אמיתית. לא עוד "דיאטה" - פשוט בחירות טובות יותר שנשארות לאורך זמן.'
    },
    ctaText: {
      english: "I'm ready to feel better →",
      hebrew: 'אני רוצה להרגיש טוב יותר ←'
    }
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
  }
};

export default defaultCompanyConfig;