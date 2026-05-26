const fitmamaCompanyConfig = {
  key: 'fitmama',
    onboarding: {
    ...defaultCompanyConfig.onboarding,
    includeNursingStatusQuestion: true
    },
  theme: {
    heroGradientDark: 'from-slate-900 via-rose-950 to-slate-900',
    heroGradientLight: 'from-pink-50 via-rose-50 to-amber-50',
    accentText: 'text-pink-400 dark:text-pink-300 light:text-rose-700',
    ctaButton: 'bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white',
    whatsappHeader: 'bg-[#b91c1c] dark:bg-rose-900'
  },
  content: {
    heroTitle: {
      english: 'Welcome Fit Mama Member!',
      hebrew: 'ברוכה הבאה לקהילת פיט מאמא!'
    },
    heroSubtitle: {
      english: 'Your personalized onboarding track is active. Let’s jumpstart your postpartum routines together.',
      hebrew: 'תוכנית האימונים והתזונה המותאמת שלך מוכנה. בואי נתחיל את המסע המשותף שלנו כבר עכשיו.'
    },
    heroParagraph: {
      english: 'No restrictive diets, no unrealistic gym hours—just smart, highly targeted nutrition built around your busy schedule.',
      hebrew: 'בלי דיאטות קיצוניות, בלי שעות לא הגיוניות בחדר הכושר - פשוט תזונה חכמה וממוקדת שנבנתה סביב סדר היום העמוס שלך אמא.'
    },
    ctaText: {
      english: 'Claim My Onboarding Access →',
      hebrew: 'הפעילי את החשבון שלך כאן ←'
    }
  }
};

export default fitmamaCompanyConfig;