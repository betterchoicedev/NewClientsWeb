/** Shared Liquid Glass utility classes — driven by client JSON theme CSS variables */

export function glassCardClass(extra = '') {
  return [
    'rounded-3xl border backdrop-blur-xl transition-all duration-500',
    'bg-[var(--theme-glass-bg)] border-[var(--theme-glass-border)]',
    'shadow-xl shadow-[var(--theme-glow-primary)]/10',
    'hover:border-[color-mix(in_srgb,var(--theme-primary)_35%,transparent)]',
    extra,
  ].join(' ');
}

export function glassPanelClass(extra = '') {
  return [
    'rounded-2xl border backdrop-blur-md transition-all duration-300',
    'bg-[color-mix(in_srgb,var(--theme-secondary)_25%,transparent)]',
    'border-[color-mix(in_srgb,var(--theme-primary)_15%,transparent)]',
    extra,
  ].join(' ');
}

export function sectionShellClass(extra = '') {
  return `relative w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 ${extra}`;
}

export function sectionTitleClass() {
  return 'text-3xl md:text-4xl font-black tracking-tight mb-3 text-[var(--theme-text)]';
}

export function sectionSubtitleClass() {
  return 'text-base md:text-lg max-w-2xl text-[var(--theme-text-muted)]';
}

export function sectionEyebrowClass() {
  return 'inline-block px-3 py-1 mb-4 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-[var(--theme-accent)] border border-[var(--theme-glass-border)] bg-[color-mix(in_srgb,var(--theme-secondary)_30%,transparent)]';
}

export function primaryButtonClass(extra = '') {
  return [
    'inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-black text-lg',
    'bg-[var(--theme-primary)] text-[var(--theme-text-on-primary)]',
    'shadow-lg shadow-[var(--theme-glow-primary)]/30 hover:opacity-90 hover:-translate-y-0.5',
    'active:translate-y-0 transition-all duration-300 relative overflow-hidden group',
    extra,
  ].join(' ');
}

export function bodyTextClass() {
  return 'text-sm leading-relaxed text-[var(--theme-text-muted)]';
}

export function headingTextClass() {
  return 'text-[var(--theme-text)]';
}

export function accentTextClass() {
  return 'text-[var(--theme-accent)]';
}
