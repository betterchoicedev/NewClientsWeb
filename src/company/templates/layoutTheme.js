/** Page shell + theme CSS variables driven by client JSON palette */

export const LAYOUT_PAGE_BG_DARK = 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900';
export const LAYOUT_PAGE_BG_LIGHT = 'bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-100';

export function getLayoutPageBackgroundClass(isLightMode) {
  return isLightMode ? LAYOUT_PAGE_BG_LIGHT : LAYOUT_PAGE_BG_DARK;
}

/**
 * Builds inline page background from client theme colors for a seamless scroll canvas.
 */
export function buildLayoutPageBackgroundStyle(colors = {}, isLightMode = false) {
  const primary = colors.primary || '#E29578';
  const secondary = colors.secondary || '#3E3026';
  const accent = colors.accent || '#FFDAB9';

  if (isLightMode) {
    return {
      background: `linear-gradient(180deg, color-mix(in srgb, ${primary} 12%, #f8fafc) 0%, color-mix(in srgb, ${accent} 8%, #f1f5f9) 35%, color-mix(in srgb, ${secondary} 6%, #f8fafc) 70%, color-mix(in srgb, ${primary} 10%, #f1f5f9) 100%)`,
    };
  }

  return {
    background: `linear-gradient(180deg, color-mix(in srgb, ${secondary} 90%, #020617) 0%, color-mix(in srgb, ${primary} 18%, #0f172a) 40%, color-mix(in srgb, ${secondary} 85%, #020617) 75%, color-mix(in srgb, ${accent} 12%, #0f172a) 100%)`,
  };
}

export function buildLayoutThemeStyles(colors = {}) {
  const surface = colors.surface || 'rgba(24, 20, 18, 0.85)';
  const primary = colors.primary || '#E29578';
  const secondary = colors.secondary || '#3E3026';
  const accent = colors.accent || '#FFDAB9';

  return {
    '--theme-surface': surface,
    '--theme-primary': primary,
    '--theme-secondary': secondary,
    '--theme-accent': accent,
    '--theme-text': colors.textMain || '#FFFDFB',
    '--theme-text-muted': colors.textMuted || '#CDBBAA',
    '--theme-text-on-primary': colors.textOnPrimary || '#FFFFFF',
    '--theme-text-on-secondary': colors.textOnSecondary || '#FFFFFF',
    '--theme-glass-bg': `color-mix(in srgb, ${surface} 72%, transparent)`,
    '--theme-glass-border': `color-mix(in srgb, ${primary} 22%, transparent)`,
    '--theme-glass-highlight': `color-mix(in srgb, ${accent} 35%, transparent)`,
    '--theme-glass-sheen': 'rgba(255, 255, 255, 0.22)',
    '--theme-glow-primary': `color-mix(in srgb, ${primary} 28%, transparent)`,
    '--theme-glow-accent': `color-mix(in srgb, ${accent} 22%, transparent)`,
    '--theme-glow-secondary': `color-mix(in srgb, ${secondary} 40%, transparent)`,
  };
}
