/**
 * @typedef {Object} LocalizedString
 * @property {string} [english]
 * @property {string} [hebrew]
 */

/**
 * @typedef {Object} BenefitItem
 * @property {LocalizedString} title
 * @property {LocalizedString} description
 * @property {string} [icon] Lucide icon name
 */

/**
 * @typedef {Object} ShowcaseHighlight
 * @property {LocalizedString} title
 * @property {LocalizedString} description
 */

/**
 * @typedef {Object} Testimonial
 * @property {string} name
 * @property {LocalizedString} role
 * @property {LocalizedString} quote
 * @property {string} [avatarUrl]
 * @property {string} [initials]
 */

/**
 * @typedef {Object} ComparisonRow
 * @property {LocalizedString} feature
 * @property {boolean|string} us
 * @property {boolean|string} them
 */

/**
 * @typedef {Object} FaqItem
 * @property {LocalizedString} question
 * @property {LocalizedString} answer
 */

/**
 * @typedef {Object} LandingPageContent
 * @property {Object} hero
 * @property {LocalizedString} hero.title
 * @property {LocalizedString} hero.subtitle
 * @property {LocalizedString} hero.paragraph
 * @property {LocalizedString} [hero.badge]
 * @property {LocalizedString} hero.ctaText
 * @property {string} [hero.imageUrl]
 * @property {Object} benefits
 * @property {LocalizedString} benefits.sectionTitle
 * @property {LocalizedString} benefits.sectionSubtitle
 * @property {BenefitItem[]} benefits.items
 * @property {Object} showcase
 * @property {LocalizedString} showcase.sectionTitle
 * @property {LocalizedString} showcase.sectionSubtitle
 * @property {string} [showcase.imageUrl]
 * @property {ShowcaseHighlight[]} showcase.highlights
 * @property {Object} socialProof
 * @property {LocalizedString} socialProof.sectionTitle
 * @property {Testimonial[]} socialProof.testimonials
 * @property {Object} comparison
 * @property {LocalizedString} comparison.sectionTitle
 * @property {LocalizedString} comparison.ourLabel
 * @property {LocalizedString} comparison.theirLabel
 * @property {ComparisonRow[]} comparison.rows
 * @property {Object} finalCta
 * @property {LocalizedString} finalCta.title
 * @property {LocalizedString} finalCta.subtitle
 * @property {LocalizedString} finalCta.ctaText
 * @property {LocalizedString} [finalCta.trustNote]
 * @property {Object} faq
 * @property {LocalizedString} faq.sectionTitle
 * @property {FaqItem[]} faq.items
 */

const DEFAULT_BENEFITS_EN = [
  {
    title: 'Personalized Guidance',
    description: 'Get a plan built around your goals — not a one-size-fits-all template.',
    icon: 'Target',
  },
  {
    title: 'Faster Results',
    description: 'Stay accountable with clear milestones so you see progress every week.',
    icon: 'Zap',
  },
  {
    title: 'Expert Support',
    description: 'Work with a dedicated consultant who answers questions when it matters.',
    icon: 'Users',
  },
];

const DEFAULT_BENEFITS_HE = [
  {
    title: 'ליווי אישי',
    description: 'תוכנית שמותאמת למטרות שלך — לא תבנית גנרית.',
    icon: 'Target',
  },
  {
    title: 'תוצאות מהירות יותר',
    description: 'מעקב ברור אחרי התקדמות עם אבני דרך שבועיות.',
    icon: 'Zap',
  },
  {
    title: 'תמיכה מקצועית',
    description: 'יועץ/ת ייעודי/ת שזמין/ה כשצריך תשובות.',
    icon: 'Users',
  },
];

const DEFAULT_SHOWCASE_HIGHLIGHTS_EN = [
  { title: 'Smart meal tracking', description: 'Log meals in seconds and see macros instantly.' },
  { title: 'Progress dashboard', description: 'Visualize trends and celebrate wins along the way.' },
  { title: 'Direct messaging', description: 'Ask your consultant questions without leaving the app.' },
];

const DEFAULT_SHOWCASE_HIGHLIGHTS_HE = [
  { title: 'מעקב ארוחות חכם', description: 'תיעוד מהיר וצפייה במאקרו בזמן אמת.' },
  { title: 'לוח התקדמות', description: 'מגמות ויזואליות והצלחות לאורך הדרך.' },
  { title: 'הודעות ישירות', description: 'שאלות ליועץ/ת בלי לעזוב את האפליקציה.' },
];

const DEFAULT_TESTIMONIALS = [
  {
    name: 'Sarah L.',
    role: { english: 'Lost 12kg in 4 months', hebrew: 'ירידה של 12 ק"ג ב-4 חודשים' },
    quote: {
      english: 'Finally a program that fits my lifestyle. The guidance was clear and motivating.',
      hebrew: 'סוף סוף תוכנית שמתאימה לאורח החיים שלי. הליווי היה ברור ומעודד.',
    },
    initials: 'SL',
  },
  {
    name: 'David M.',
    role: { english: 'Better energy & habits', hebrew: 'אנרגיה והרגלים טובים יותר' },
    quote: {
      english: 'I stopped guessing and started following a plan that actually works.',
      hebrew: 'הפסקתי לנחש והתחלתי לעבוד לפי תוכנית שבאמת עובדת.',
    },
    initials: 'DM',
  },
  {
    name: 'Rachel K.',
    role: { english: 'Busy professional', hebrew: 'עובדת עסוקה' },
    quote: {
      english: 'The app made it easy to stay consistent even on hectic weeks.',
      hebrew: 'האפליקציה עזרה לי להישאר עקבית גם בשבועות עמוסים.',
    },
    initials: 'RK',
  },
];

const DEFAULT_COMPARISON_ROWS = [
  { feature: { english: 'Personal consultant', hebrew: 'יועץ/ת אישי/ת' }, us: true, them: false },
  { feature: { english: 'Custom meal plan', hebrew: 'תוכנית תזונה מותאמת' }, us: true, them: false },
  { feature: { english: 'Progress tracking', hebrew: 'מעקב התקדמות' }, us: true, them: true },
  { feature: { english: '24/7 app access', hebrew: 'גישה לאפליקציה 24/7' }, us: true, them: false },
  { feature: { english: 'Ongoing adjustments', hebrew: 'התאמות שוטפות' }, us: true, them: false },
];

const DEFAULT_FAQ_EN = [
  {
    question: 'How does registration work?',
    answer: 'Click the CTA, complete a short signup, and your consultant will activate your personalized plan.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes. All connections are encrypted and your information is kept strictly confidential.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Subscription terms depend on your plan. Your consultant can walk you through options before you commit.',
  },
  {
    question: 'What if spots are limited?',
    answer: 'Campaign links may have a cap. Register early to secure your slot before it fills up.',
  },
];

const DEFAULT_FAQ_HE = [
  {
    question: 'איך ההרשמה עובדת?',
    answer: 'לחצו על הכפתור, מלאו הרשמה קצרה, והיועץ/ת יפעיל/ת את התוכנית האישית שלכם.',
  },
  {
    question: 'האם המידע שלי מאובטח?',
    answer: 'כן. כל החיבורים מוצפנים והמידע נשמר בסודיות מוחלטת.',
  },
  {
    question: 'האם אפשר לבטל בכל עת?',
    answer: 'תנאי המנוי תלויים בתוכנית. היועץ/ת יסביר/תסביר את האפשרויות לפני ההתחייבות.',
  },
  {
    question: 'מה אם המקומות מוגבלים?',
    answer: 'קישורי קמפיין עשויים להיות מוגבלים. הרשמו מוקדם כדי לשריין מקום.',
  },
];

function loc(value, language, fallback = '') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value[language] || value.english || value.hebrew || fallback;
}

function buildBenefitItems(rawItems, language) {
  const defaults = language === 'hebrew' ? DEFAULT_BENEFITS_HE : DEFAULT_BENEFITS_EN;
  const source = Array.isArray(rawItems) && rawItems.length > 0 ? rawItems : defaults;

  return source.map((item, index) => {
    const fallback = defaults[index] || defaults[0];
    if (typeof item === 'string') {
      return {
        title: item,
        description: '',
        icon: fallback?.icon || 'Sparkles',
      };
    }
    return {
      title: loc(item.title, language, fallback?.title || ''),
      description: loc(item.description, language, fallback?.description || ''),
      icon: item.icon || fallback?.icon || 'Sparkles',
    };
  });
}

function buildShowcaseHighlights(rawItems, language) {
  const defaults = language === 'hebrew' ? DEFAULT_SHOWCASE_HIGHLIGHTS_HE : DEFAULT_SHOWCASE_HIGHLIGHTS_EN;
  const source = Array.isArray(rawItems) && rawItems.length > 0 ? rawItems : defaults;

  return source.map((item, index) => {
    const fallback = defaults[index] || defaults[0];
    if (typeof item === 'string') {
      return { title: item, description: '' };
    }
    return {
      title: loc(item.title, language, fallback?.title || ''),
      description: loc(item.description, language, fallback?.description || ''),
    };
  });
}

/**
 * Merges legacy flat hero fields with the new nested landing content schema.
 * @param {Record<string, unknown>} rawContent
 * @returns {LandingPageContent}
 */
export function normalizeLandingContent(rawContent = {}) {
  const hero = rawContent.hero || {};
  const benefits = rawContent.benefits || {};
  const showcase = rawContent.showcase || {};
  const socialProof = rawContent.socialProof || {};
  const comparison = rawContent.comparison || {};
  const finalCta = rawContent.finalCta || {};
  const faq = rawContent.faq || {};

  const legacyFeatures = rawContent.features || { english: [], hebrew: [] };

  return {
    hero: {
      title: hero.title || rawContent.heroTitle || { english: 'Welcome', hebrew: 'ברוכים הבאים' },
      subtitle: hero.subtitle || rawContent.heroSubtitle || { english: '', hebrew: '' },
      paragraph: hero.paragraph || rawContent.heroParagraph || { english: '', hebrew: '' },
      badge: hero.badge || {
        english: 'Step 1 of 3: Activation',
        hebrew: 'שלב 1 מתוך 3: הפעלה',
      },
      ctaText: hero.ctaText || rawContent.ctaText || { english: 'Get Started', hebrew: 'התחל עכשיו' },
      imageUrl: hero.imageUrl || '',
    },
    benefits: {
      sectionEyebrow: benefits.sectionEyebrow || {
        english: 'Benefits',
        hebrew: 'יתרונות',
      },
      sectionTitle: benefits.sectionTitle || {
        english: 'Why This Works For You',
        hebrew: 'למה זה עובד בשבילך',
      },
      sectionSubtitle: benefits.sectionSubtitle || {
        english: 'Real outcomes — not just features.',
        hebrew: 'תוצאות אמיתיות — לא רק פיצ\'רים.',
      },
      items: benefits.items || legacyFeatures,
    },
    showcase: {
      sectionEyebrow: showcase.sectionEyebrow || {
        english: 'Product',
        hebrew: 'מוצר',
      },
      sectionTitle: showcase.sectionTitle || {
        english: 'See It In Action',
        hebrew: 'ראו את זה בפעולה',
      },
      sectionSubtitle: showcase.sectionSubtitle || {
        english: 'Everything you need to stay on track — in one place.',
        hebrew: 'כל מה שצריך כדי להישאר במסלול — במקום אחד.',
      },
      imageUrl: showcase.imageUrl || '',
      highlights: showcase.highlights || [],
    },
    socialProof: {
      sectionEyebrow: socialProof.sectionEyebrow || {
        english: 'Testimonials',
        hebrew: 'המלצות',
      },
      sectionTitle: socialProof.sectionTitle || {
        english: 'Trusted By Real Clients',
        hebrew: 'לקוחות אמיתיים סומכים עלינו',
      },
      sectionSubtitle: socialProof.sectionSubtitle || {
        english: 'Join a growing community of successful clients.',
        hebrew: 'הצטרפו לקהילת הלקוחות המצליחים שלנו.',
      },
      testimonials: socialProof.testimonials || DEFAULT_TESTIMONIALS,
    },
    comparison: {
      sectionEyebrow: comparison.sectionEyebrow || {
        english: 'Compare',
        hebrew: 'השוואה',
      },
      sectionTitle: comparison.sectionTitle || {
        english: 'Why Choose Us',
        hebrew: 'למה לבחור בנו',
      },
      sectionSubtitle: comparison.sectionSubtitle || {
        english: 'See how we stack up against generic alternatives.',
        hebrew: 'ראו איך אנחנו לעומת חלופות גנריות.',
      },
      ourLabel: comparison.ourLabel || { english: 'BetterChoice', hebrew: 'BetterChoice' },
      theirLabel: comparison.theirLabel || { english: 'Generic Apps', hebrew: 'אפליקציות גנריות' },
      rows: comparison.rows || DEFAULT_COMPARISON_ROWS,
    },
    finalCta: {
      sectionEyebrow: finalCta.sectionEyebrow || {
        english: 'Get Started',
        hebrew: 'התחילו',
      },
      title: finalCta.title || {
        english: 'Ready to Start Your Journey?',
        hebrew: 'מוכנים להתחיל את המסע?',
      },
      subtitle: finalCta.subtitle || {
        english: 'Join today and get personalized guidance from day one.',
        hebrew: 'הצטרפו היום וקבלו ליווי אישי מהיום הראשון.',
      },
      ctaText: finalCta.ctaText || rawContent.ctaText || { english: 'Claim Your Spot', hebrew: 'שריינו מקום' },
      trustNote: finalCta.trustNote || {
        english: 'Secure & encrypted connection',
        hebrew: 'חיבור מאובטח ומוצפן',
      },
    },
    faq: {
      sectionEyebrow: faq.sectionEyebrow || {
        english: 'FAQ',
        hebrew: 'שאלות',
      },
      sectionTitle: faq.sectionTitle || {
        english: 'Frequently Asked Questions',
        hebrew: 'שאלות נפוצות',
      },
      sectionSubtitle: faq.sectionSubtitle || {
        english: 'Everything you need to know before joining.',
        hebrew: 'כל מה שצריך לדעת לפני ההצטרפות.',
      },
      items: faq.items || (rawContent.faqItems) || { english: DEFAULT_FAQ_EN, hebrew: DEFAULT_FAQ_HE },
    },
  };
}

/**
 * Resolves localized landing content for rendering.
 * @param {Record<string, unknown>} rawContent
 * @param {'english'|'hebrew'} language
 */
export function getLocalizedLandingContent(rawContent, language) {
  const normalized = normalizeLandingContent(rawContent);

  const faqSource = normalized.faq.items;
  const faqItems = Array.isArray(faqSource)
    ? faqSource
    : (faqSource[language] || faqSource.english || DEFAULT_FAQ_EN);

  return {
    hero: {
      title: loc(normalized.hero.title, language, 'Welcome'),
      subtitle: loc(normalized.hero.subtitle, language, ''),
      paragraph: loc(normalized.hero.paragraph, language, ''),
      badge: loc(normalized.hero.badge, language, ''),
      ctaText: loc(normalized.hero.ctaText, language, 'Get Started'),
      imageUrl: normalized.hero.imageUrl,
    },
    benefits: {
      sectionEyebrow: loc(normalized.benefits.sectionEyebrow, language),
      sectionTitle: loc(normalized.benefits.sectionTitle, language),
      sectionSubtitle: loc(normalized.benefits.sectionSubtitle, language),
      items: buildBenefitItems(normalized.benefits.items?.[language] || normalized.benefits.items, language),
    },
    showcase: {
      sectionEyebrow: loc(normalized.showcase.sectionEyebrow, language),
      sectionTitle: loc(normalized.showcase.sectionTitle, language),
      sectionSubtitle: loc(normalized.showcase.sectionSubtitle, language),
      imageUrl: normalized.showcase.imageUrl,
      highlights: buildShowcaseHighlights(
        normalized.showcase.highlights?.[language] || normalized.showcase.highlights,
        language
      ),
    },
    socialProof: {
      sectionEyebrow: loc(normalized.socialProof.sectionEyebrow, language),
      sectionTitle: loc(normalized.socialProof.sectionTitle, language),
      sectionSubtitle: loc(normalized.socialProof.sectionSubtitle, language),
      testimonials: (normalized.socialProof.testimonials || []).map((t) => ({
        name: t.name,
        role: loc(t.role, language, ''),
        quote: loc(t.quote, language, ''),
        avatarUrl: t.avatarUrl,
        initials: t.initials || t.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
      })),
    },
    comparison: {
      sectionEyebrow: loc(normalized.comparison.sectionEyebrow, language),
      sectionTitle: loc(normalized.comparison.sectionTitle, language),
      sectionSubtitle: loc(normalized.comparison.sectionSubtitle, language),
      ourLabel: loc(normalized.comparison.ourLabel, language, 'Us'),
      theirLabel: loc(normalized.comparison.theirLabel, language, 'Them'),
      rows: (normalized.comparison.rows || []).map((row) => ({
        feature: loc(row.feature, language, ''),
        us: row.us,
        them: row.them,
      })),
    },
    finalCta: {
      sectionEyebrow: loc(normalized.finalCta.sectionEyebrow, language),
      title: loc(normalized.finalCta.title, language),
      subtitle: loc(normalized.finalCta.subtitle, language),
      ctaText: loc(normalized.finalCta.ctaText, language, 'Get Started'),
      trustNote: loc(normalized.finalCta.trustNote, language, ''),
    },
    faq: {
      sectionEyebrow: loc(normalized.faq.sectionEyebrow, language),
      sectionTitle: loc(normalized.faq.sectionTitle, language),
      sectionSubtitle: loc(normalized.faq.sectionSubtitle, language),
      items: faqItems.map((item) => ({
        question: loc(item.question, language, typeof item.question === 'string' ? item.question : ''),
        answer: loc(item.answer, language, typeof item.answer === 'string' ? item.answer : ''),
      })),
    },
  };
}

/** Default content block used when API config is missing section data. */
export const DEFAULT_LANDING_CONTENT = normalizeLandingContent({});
