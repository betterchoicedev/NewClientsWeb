/** Page shell background only — ad/card colors come from the palette unchanged */

export const LAYOUT_PAGE_BG_DARK = 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900';
export const LAYOUT_PAGE_BG_LIGHT = 'bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-100';

export function getLayoutPageBackgroundClass(isLightMode) {
  return isLightMode ? LAYOUT_PAGE_BG_LIGHT : LAYOUT_PAGE_BG_DARK;
}

export function buildLayoutThemeStyles(colors = {}) {
  return {
    '--theme-surface': colors.surface || 'rgba(24, 20, 18, 0.85)',
    '--theme-primary': colors.primary || '#E29578',
    '--theme-secondary': colors.secondary || '#3E3026',
    '--theme-accent': colors.accent || '#FFDAB9',
    '--theme-text': colors.textMain || '#FFFDFB',
    '--theme-text-muted': colors.textMuted || '#CDBBAA',
    '--theme-text-on-primary': colors.textOnPrimary || '#FFFFFF',
    '--theme-text-on-secondary': colors.textOnSecondary || '#FFFFFF',
  };
}
