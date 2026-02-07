// Stripe Products and Prices Configuration
// Real product and price IDs from your Stripe Dashboard

export const STRIPE_PRODUCTS = {
  BETTER_PRO: 'prod_SbI1Lu7FWbybUO',
  NUTRITION_ONLY: 'prod_SbI1dssS5NElLZ', 
  NUTRITION_TRAINING: 'prod_SbI1AIv2A46oJ9',
  NUTRITION_TRAINING_ONCE_MONTH: 'prod_SbI1Lu7FWbybUO',
  NUTRITION_ONLY_2X_MONTH: 'prod_SbI0A23T20wul3',
  CONSULTATION: 'prod_SSzustraPd40C1',
  DIGITAL_ONLY: 'prod_TrcVkwBC0wmqKp', // Usage-based: 26+ days in a row = free, max $48/mo
};

export const STRIPE_PRICES = {
  // BetterPro - 2 pricing options
  BETTER_PRO_OPTION_1: 'price_1Rg5R8HIeYfvCylDJ4Xfg5hr',
  BETTER_PRO_OPTION_2: 'price_1Rg5R8HIeYfvCylDxX2PsOrR',
  
  // Nutrition Only - 2 pricing options (commitment periods)
  NUTRITION_ONLY_3_MONTHS: 'price_1Rg5R6HIeYfvCylDcsV3T2Kr',
  NUTRITION_ONLY_6_MONTHS: 'price_1Rg5R6HIeYfvCylDxuQODpK4',
  
  // Nutrition + Training (2x/month) - 2 pricing options (commitment periods)
  NUTRITION_TRAINING_6_MONTHS: 'price_1Rg5R4HIeYfvCylDy1OT1YJc',
  NUTRITION_TRAINING_3_MONTHS: 'price_1Rg5R4HIeYfvCylDAshP6FOk',
  
  // Nutrition + Training (once/month) - 2 pricing options (commitment periods) - using BetterPro price IDs
  NUTRITION_TRAINING_ONCE_3_MONTHS: 'price_1Rg5R8HIeYfvCylDJ4Xfg5hr',
  NUTRITION_TRAINING_ONCE_6_MONTHS: 'price_1Rg5R8HIeYfvCylDxX2PsOrR',
  
  // Nutrition Only 2x/month - 2 pricing options (commitment periods)
  NUTRITION_ONLY_2X_3_MONTHS: 'price_1Rg5QtHIeYfvCylDyXHY5X6G',
  NUTRITION_ONLY_2X_6_MONTHS: 'price_1Rg5QtHIeYfvCylDwr9v599a',
  
  // Consultation - $650 (One-time payment)
  CONSULTATION: 'price_1RY3uZHIeYfvCylD4mylbEP4',

  // Digital Only - Usage-based (26+ days in a row = free, max $48/mo)
  DIGITAL_ONLY: 'price_1SyHX0HIeYfvCylDZyb1Lb3L'
};

// Product configuration with metadata
export const PRODUCT_CONFIG = {
  [STRIPE_PRODUCTS.NUTRITION_TRAINING]: {
    name: 'Nutrition + Training - 2x Month',
    nameHebrew: 'תזונה + אימונים - פעמיים בחודש',
    description: 'Combined guidance for complete connection between nutrition and movement',
    descriptionHebrew: 'ליווי משולב למי שרוצה חיבור מלא בין תזונה לתנועה',
    frequencyDescription: 'One session every two weeks. Suitable for those who want closer guidance, precision and high presence of our dietician/nutritionist throughout the process.',
    frequencyDescriptionHebrew: 'פגישה אחת לשבועיים. מתאימה למי שרוצה ליווי צמוד יותר, דיוק ונוכחות גבוהה של הדיאטן/נית שלנו לאורך הדרך',
    features: [
      'Personalized meal plan',
      'Personalized training plan (fitness level, availability and preferences)',
      'Connection between eating, training and daily routine'
    ],
    featuresHebrew: [
      'בניית תוכנית תזונה אישית',
      'בניית תוכנית אימונים מותאמת (רמת כושר, זמינות והעדפות)',
      'חיבור בין האכילה לאימונים ולשגרה היומית'
    ],
    category: 'complete',
    prices: [
      {
        id: STRIPE_PRICES.NUTRITION_TRAINING_6_MONTHS,
        name: '6 Month Plan',
        nameHebrew: 'תוכנית 6 חודשים',
        description: 'Deep process, stable and habit-based over time',
        descriptionHebrew: 'תהליך עמוק, יציב ומבוסס הרגלים לאורך זמן',
        interval: 'month',
        interval_count: 1,
        commitment: 6,
        amount: 75000, // ₪750/month in agorot
        amountUSD: 21400, // $214/month in cents
        currency: 'ILS',
        popular: true
      },
      {
        id: STRIPE_PRICES.NUTRITION_TRAINING_3_MONTHS,
        name: '3 Month Plan',
        nameHebrew: 'תוכנית 3 חודשים',
        description: 'Focused process, creating foundation and momentum',
        descriptionHebrew: 'תהליך ממוקד, יצירת בסיס והנעה',
        interval: 'month', 
        interval_count: 1,
        commitment: 3,
        amount: 83000, // ₪830/month in agorot
        amountUSD: 23700, // $237/month in cents
        currency: 'ILS',
        popular: false
      }
    ]
  },
  
  [STRIPE_PRODUCTS.NUTRITION_TRAINING_ONCE_MONTH]: {
    name: 'Nutrition + Training',
    nameHebrew: 'תזונה + אימונים',
    description: 'Combined guidance for complete connection between nutrition and movement',
    descriptionHebrew: 'ליווי משולב למי שרוצה חיבור מלא בין תזונה לתנועה',
    frequencyDescription: 'One session per month. Suitable for those who prefer intervals, gradual work and higher independence.',
    frequencyDescriptionHebrew: 'פגישה אחת לחודש. מתאימה למי שמעדיף מרווחים, עבודה הדרגתית ועצמאות גבוהה יותר',
    features: [
      'Personalized meal plan',
      'Personalized training plan (fitness level, availability and preferences)',
      'Connection between eating, training and daily routine'
    ],
    featuresHebrew: [
      'בניית תוכנית תזונה אישית',
      'בניית תוכנית אימונים מותאמת (רמת כושר, זמינות והעדפות)',
      'חיבור בין האכילה לאימונים ולשגרה היומית'
    ],
    category: 'complete',
    prices: [
      {
        id: STRIPE_PRICES.NUTRITION_TRAINING_ONCE_6_MONTHS,
        name: '6 Month Plan',
        nameHebrew: 'תוכנית 6 חודשים',
        description: 'Deep process, stable and habit-based over time',
        descriptionHebrew: 'תהליך עמוק, יציב ומבוסס הרגלים לאורך זמן',
        interval: 'month',
        interval_count: 1,
        commitment: 6,
        amount: 60000, // ₪600/month in agorot
        amountUSD: 17100, // $171/month in cents (600 ÷ 3.5)
        currency: 'ILS',
        popular: true
      },
      {
        id: STRIPE_PRICES.NUTRITION_TRAINING_ONCE_3_MONTHS,
        name: '3 Month Plan',
        nameHebrew: 'תוכנית 3 חודשים',
        description: 'Focused process, creating foundation and momentum',
        descriptionHebrew: 'תהליך ממוקד, יצירת בסיס והנעה',
        interval: 'month',
        interval_count: 1,
        commitment: 3,
        amount: 68000, // ₪680/month in agorot
        amountUSD: 19400, // $194/month in cents (680 ÷ 3.5)
        currency: 'ILS',
        popular: false
      }
    ]
  },
  
  [STRIPE_PRODUCTS.NUTRITION_ONLY]: {
    name: 'Nutrition Only',
    nameHebrew: 'תזונה בלבד',
    description: 'Personal nutrition guidance with comprehensive support',
    descriptionHebrew: 'ליווי תזונתי אישי ומעמיק',
    frequencyDescription: 'One session per month. Suitable for those who prefer intervals, gradual work and higher independence.',
    frequencyDescriptionHebrew: 'פגישה אחת לחודש. מתאימה למי שמעדיף מרווחים, עבודה הדרגתית ועצמאות גבוהה יותר',
    features: [
      'Personalized meal plan based on goals, lifestyle and preferences',
      'Regular follow-up sessions',
      'Adjustments and changes along the way'
    ],
    featuresHebrew: [
      'בניית תכנית תזונה מותאמת אישית לפי מטרות, אורח חיים והעדפות',
      'פגישות מעקב קבועות',
      'התאמות ושינויים לאורך הדרך'
    ],
    category: 'nutrition',
    prices: [
      {
        id: STRIPE_PRICES.NUTRITION_ONLY_3_MONTHS,
        name: '3 Month Plan',
        nameHebrew: 'תוכנית 3 חודשים',
        description: 'Focused process, creating foundation and momentum',
        descriptionHebrew: 'תהליך ממוקד, יצירת בסיס והנעה',
        interval: 'month',
        interval_count: 1,
        commitment: 3,
        amount: 58000, // ₪580/month in agorot
        amountUSD: 16600, // $166/month in cents
        currency: 'ILS',
        popular: false
      },
      {
        id: STRIPE_PRICES.NUTRITION_ONLY_6_MONTHS,
        name: '6 Month Plan', 
        nameHebrew: 'תוכנית 6 חודשים',
        description: 'Deep process, stable and habit-based over time',
        descriptionHebrew: 'תהליך עמוק, יציב ומבוסס הרגלים לאורך זמן',
        interval: 'month',
        interval_count: 1,
        commitment: 6,
        amount: 50000, // ₪500/month in agorot
        amountUSD: 14300, // $143/month in cents
        currency: 'ILS',
        discount: '14% off',
        popular: true
      }
    ]
  },
  
  [STRIPE_PRODUCTS.NUTRITION_ONLY_2X_MONTH]: {
    name: 'Nutrition Only - 2x Month',
    nameHebrew: 'תזונה בלבד - פעמיים בחודש',
    description: 'Personal nutrition guidance with bi-monthly sessions',
    descriptionHebrew: 'ליווי תזונתי אישי ומעמיק',
    frequencyDescription: 'One session every two weeks. Suitable for those who want closer guidance, precision and high presence of our dietician/nutritionist throughout the process.',
    frequencyDescriptionHebrew: 'פגישה אחת לשבועיים. מתאימה למי שרוצה ליווי צמוד יותר, דיוק ונוכחות גבוהה של הדיאטן/נית שלנו לאורך הדרך',
    features: [
      'Personalized meal plan based on goals, lifestyle and preferences',
      'Regular follow-up sessions',
      'Adjustments and changes along the way'
    ],
    featuresHebrew: [
      'בניית תכנית תזונה מותאמת אישית לפי מטרות, אורח חיים והעדפות',
      'פגישות מעקב קבועות',
      'התאמות ושינויים לאורך הדרך'
    ],
    category: 'nutrition',
    prices: [
      {
        id: STRIPE_PRICES.NUTRITION_ONLY_2X_3_MONTHS,
        name: '3 Month Plan',
        nameHebrew: 'תוכנית 3 חודשים',
        description: 'Focused process, creating foundation and momentum',
        descriptionHebrew: 'תהליך ממוקד, יצירת בסיס והנעה',
        interval: 'month',
        interval_count: 1,
        commitment: 3,
        amount: 73000, // ₪730/month in agorot
        amountUSD: 20900, // $209/month in cents
        currency: 'ILS',
        popular: false
      },
      {
        id: STRIPE_PRICES.NUTRITION_ONLY_2X_6_MONTHS,
        name: '6 Month Plan',
        nameHebrew: 'תוכנית 6 חודשים',
        description: 'Deep process, stable and habit-based over time',
        descriptionHebrew: 'תהליך עמוק, יציב ומבוסס הרגלים לאורך זמן',
        interval: 'month',
        interval_count: 1,
        commitment: 6,
        amount: 65000, // ₪650/month in agorot
        amountUSD: 18600, // $186/month in cents
        currency: 'ILS',
        discount: '11% off',
        popular: true
      }
    ]
  },
  
  [STRIPE_PRODUCTS.CONSULTATION]: {
    name: 'One-on-One Consultation',
    nameHebrew: 'יעוץ אישי',
    description: 'Personal consultation with nutrition expert',
    descriptionHebrew: 'יעוץ אישי עם מומחה תזונה',
    features: [
      '60-minute session',
      'Personalized recommendations',
      'Follow-up support',
      'Action plan',
      'Progress evaluation'
    ],
    featuresHebrew: [
      'מפגש של 60 דקות',
      'המלצות מותאמות אישית',
      'תמיכה המשך',
      'תוכנית פעולה',
      'הערכת התקדמות'
    ],
    category: 'consultation',
    prices: [
      {
        id: STRIPE_PRICES.CONSULTATION,
        name: 'Single Session',
        nameHebrew: 'מפגש יחיד',
        interval: null, // One-time payment
        amount: 65000, // ₪650.00 in agorot
        amountUSD: 18600, // $186.00 in cents
        currency: 'ILS',
        popular: true
      }
    ]
  },

  [STRIPE_PRODUCTS.DIGITAL_ONLY]: {
    name: 'Digital Only',
    nameHebrew: 'דיגיטלי בלבד',
    description: 'Our goal is your health. If you stay consistent with the system - completely free. Each day of use is money, but you can miss a couple of days a month and still get everything for free!',
    descriptionHebrew: 'המטרה שלנו היא שתהיו בריאים. לכן, אם תתמידו בשימוש במערכת - חינם לגמרי. כל יום שימוש שווה כסף, אבל מותר לכם כמה ימים בחודש ועדיין לקבל את כל השירות בחינם!',
    features: [
      'Our goal is your health - completely free if you stay consistent',
      'Each day of use is money, but you can miss a couple of days',
      'Payment only required if goal is not met (max $48/mo)',
      'Cancel the charge at any time'
    ],
    featuresHebrew: [
      'המטרה שלנו היא שתהיו בריאים – חינם לגמרי למתמידים',
      'כל יום שימוש שווה כסף, אך ניתן לפספס מספר ימים בחודש',
      'חיוב רק אם לא עומדים ביעד ההתמדה (מקסימום $48 לחודש)',
      'ניתן לבטל את החיוב בכל שלב'
    ],
    category: 'content',
    prices: [
      {
        id: STRIPE_PRICES.DIGITAL_ONLY,
        name: 'Usage-based',
        nameHebrew: 'לפי שימוש',
        description: 'Max $48/mo if consistency goal not met',
        descriptionHebrew: 'מקסימום $48 לחודש אם לא עומדים ביעד ההתמדה',
        interval: 'month',
        interval_count: 1,
        amount: 4800,
        amountUSD: 4800,
        currency: 'USD',
        popular: true
      }
    ]
}
};

// Helper functions
export const getProduct = (productId) => {
  return PRODUCT_CONFIG[productId];
};

export const getAllProducts = () => {
  return Object.keys(PRODUCT_CONFIG).map(productId => ({
    id: productId,
    ...PRODUCT_CONFIG[productId]
  }));
};

export const getProductsByCategory = (category) => {
  return getAllProducts().filter(product => product.category === category);
};

export const getPriceById = (priceId) => {
  for (const product of getAllProducts()) {
    const price = product.prices?.find(p => p.id === priceId);
    if (price) {
      return { ...price, product: product };
    }
  }
  return null;
};

// Stripe configuration
export const STRIPE_CONFIG = {
  publishableKey: process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY,
  options: {
    success_url: `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${window.location.origin}/payment-cancel`,
  }
};
