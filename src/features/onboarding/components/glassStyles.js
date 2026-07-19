/** Shared liquid-glass styles for onboarding dropdowns, triggers, and options. */

export function glassMenuClass(isDark) {
  return [
    'overflow-hidden rounded-2xl border backdrop-blur-2xl',
    isDark
      ? 'bg-slate-900/70 border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.1)]'
      : 'bg-white/65 border-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.85)]',
  ].join(' ');
}

export function glassMenuHeaderClass(isDark) {
  return [
    'shrink-0 flex items-center gap-2 px-3 py-2.5 border-b backdrop-blur-md',
    isDark ? 'border-white/10 bg-white/[0.04]' : 'border-white/50 bg-white/30',
  ].join(' ');
}

export function glassOptionClass(active, isDark) {
  if (active) {
    return isDark
      ? 'bg-emerald-500/25 text-emerald-100 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.25)]'
      : 'bg-emerald-500/15 text-emerald-900 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]';
  }
  return isDark
    ? 'text-slate-200 hover:bg-white/[0.08] active:bg-white/[0.12]'
    : 'text-slate-800 hover:bg-white/55 active:bg-white/75';
}

export function glassInputClass(isDark) {
  return [
    'w-full rounded-2xl border px-4 py-3 text-base outline-none transition-all duration-200',
    'backdrop-blur-xl focus:ring-2 focus:ring-emerald-500/35',
    isDark
      ? 'bg-white/[0.06] border-white/15 text-white placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus:border-emerald-400/40'
      : 'bg-white/50 border-white/70 text-slate-900 placeholder:text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] focus:border-emerald-400/50',
  ].join(' ');
}

export function glassOptionBtnClass(active, isDark) {
  return [
    'w-full min-h-11 py-3 px-4 rounded-2xl text-start text-sm font-medium border transition-all duration-150 backdrop-blur-md',
    active
      ? isDark
        ? 'bg-emerald-500/25 border-emerald-400/35 text-emerald-100'
        : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-900'
      : isDark
        ? 'border-white/15 text-slate-200 bg-white/[0.04] hover:bg-white/[0.09]'
        : 'border-white/70 text-slate-800 bg-white/40 hover:bg-white/65',
  ].join(' ');
}

export function glassChipClass(active, isDark) {
  return [
    'min-h-11 px-3 py-2 rounded-xl text-sm font-medium border transition-all duration-150 backdrop-blur-md',
    active
      ? isDark
        ? 'bg-emerald-500/25 border-emerald-400/35 text-emerald-100'
        : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-900'
      : isDark
        ? 'border-white/15 text-slate-300 bg-white/[0.04] hover:bg-white/[0.09]'
        : 'border-white/70 text-slate-700 bg-white/40 hover:bg-white/65',
  ].join(' ');
}
