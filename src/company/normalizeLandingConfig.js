/**
 * Normalizes companies.config JSONB for landing page templates.
 * Applies defaults only for missing keys — saved builder config always wins.
 */
export function normalizeLandingConfig(rawCompanyConfig = {}) {
  const raw = rawCompanyConfig && typeof rawCompanyConfig === 'object' ? rawCompanyConfig : {};

  const themeRaw = raw.ui?.themeSettings || raw.themeSettings || {};
  const rawColors = themeRaw.colors || {};

  const defaultColors = {
    surface: 'rgba(24, 20, 18, 0.85)',
    primary: '#C86B4C',
    secondary: '#9C442E',
    accent: '#FFDAB9',
    textMain: '#FFFDFB',
    textMuted: '#E8DED5',
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#FFFFFF',
  };

  const contentDefaults = {
    heroTitle: { english: 'Welcome', hebrew: 'ברוכים הבאים' },
    heroSubtitle: { english: '', hebrew: '' },
    heroParagraph: { english: '', hebrew: '' },
    ctaText: { english: 'Continue', hebrew: 'המשך' },
    features: { english: [], hebrew: [] },
  };

  const rawContent = raw.content || {};

  return {
    ui: {
      layout: raw.ui?.layout || raw.layout || 'centered',
      themeSettings: {
        ...themeRaw,
        colors: { ...defaultColors, ...rawColors },
      },
    },
    content: {
      ...contentDefaults,
      ...rawContent,
      heroTitle: { ...contentDefaults.heroTitle, ...(rawContent.heroTitle || {}) },
      heroSubtitle: { ...contentDefaults.heroSubtitle, ...(rawContent.heroSubtitle || {}) },
      heroParagraph: { ...contentDefaults.heroParagraph, ...(rawContent.heroParagraph || {}) },
      ctaText: { ...contentDefaults.ctaText, ...(rawContent.ctaText || {}) },
      features: {
        english: rawContent.features?.english ?? contentDefaults.features.english,
        hebrew: rawContent.features?.hebrew ?? contentDefaults.features.hebrew,
      },
    },
  };
}

export function hasSavedLandingConfig(rawCompanyConfig = {}) {
  const raw = rawCompanyConfig && typeof rawCompanyConfig === 'object' ? rawCompanyConfig : {};
  const colors = raw.ui?.themeSettings?.colors || raw.themeSettings?.colors || {};
  const content = raw.content || {};
  return Boolean(
    raw.ui?.layout ||
    raw.layout ||
    colors.primary ||
    content.heroTitle?.english ||
    content.heroTitle?.hebrew ||
    content.heroSubtitle?.english ||
    content.heroSubtitle?.hebrew ||
    content.ctaText?.english ||
    content.ctaText?.hebrew
  );
}
