import React from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { useOnboardingStore } from '../onboarding.store';
import { isOnboardingHebrew } from '../onboardingLocale';

/** @deprecated Prefer GlassPrimaryButton */
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold text-white bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20';

export const btnSecondary = (isDark) =>
  `inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold border backdrop-blur-md transition-all duration-300 disabled:opacity-50 ${
    isDark
      ? 'border-white/15 text-slate-100 bg-white/5 hover:bg-white/10'
      : 'border-white/70 text-slate-700 bg-white/40 hover:bg-white/60'
  }`;

export const btnGhost = (isDark) =>
  `inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150 ${
    isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-black/5'
  }`;

/**
 * Primary liquid-glass CTA with LTR transparent sweep on hover.
 */
export function GlassPrimaryButton({ children, className = '', disabled, ...props }) {
  const { isDarkMode } = useTheme();
  return (
    <button
      type="button"
      disabled={disabled}
      className={`group relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm sm:text-base font-bold tracking-wide transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] border backdrop-blur-xl disabled:opacity-50 disabled:pointer-events-none disabled:hover:scale-100 ${
        isDarkMode
          ? 'text-white border-white/25 bg-gradient-to-br from-emerald-400/80 via-emerald-600/75 to-teal-700/85 shadow-[0_8px_32px_rgba(16,185,129,0.28),inset_0_1px_0_rgba(255,255,255,0.25)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.38),inset_0_1px_0_rgba(255,255,255,0.3)]'
          : 'text-white border-white/60 bg-gradient-to-br from-emerald-400/90 via-emerald-500/85 to-teal-600/90 shadow-[0_8px_32px_rgba(16,185,129,0.28),inset_0_1px_0_rgba(255,255,255,0.45)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.36),inset_0_1px_0_rgba(255,255,255,0.5)]'
      } ${className}`}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/3 z-[1] w-1/2 -translate-x-full -skew-x-12 transition-transform duration-700 ease-out group-hover:translate-x-[280%] group-disabled:hidden"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.32) 50%, rgba(255,255,255,0.06) 70%, transparent 100%)',
          boxShadow: '0 0 28px rgba(255,255,255,0.14)',
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[55%] bg-gradient-to-b from-white/30 to-transparent opacity-80"
      />
    </button>
  );
}

/**
 * Secondary liquid-glass button (Back / secondary actions).
 */
export function GlassSecondaryButton({ children, className = '', disabled, ...props }) {
  const { isDarkMode } = useTheme();
  return (
    <button
      type="button"
      disabled={disabled}
      className={`relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm sm:text-base font-bold border backdrop-blur-xl transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none ${
        isDarkMode
          ? 'border-white/20 text-slate-100 bg-white/[0.07] hover:bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
          : 'border-white/80 text-slate-700 bg-white/50 hover:bg-white/70 shadow-[0_4px_20px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.7)]'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Premium squircle liquid-glass modal used for the entire onboarding flow.
 * @param {'default'|'immersive'} variant - immersive tightens padding (welcome).
 */
export default function OnboardingPanel({
  children,
  footer,
  maxWidthClass = 'max-w-lg',
  hideHeader = false,
  variant = 'default',
  panelClassName = '',
  bodyClassName = '',
  footerClassName = '',
}) {
  const { isDarkMode } = useTheme();
  const language = useOnboardingStore((s) => s.answers.language);
  const isHe = isOnboardingHebrew(language);
  const immersive = variant === 'immersive' || hideHeader;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      dir={isHe ? 'rtl' : 'ltr'}
    >
      {/* Dimmed + blurred stage */}
      <div
        className={`absolute inset-0 backdrop-blur-xl ${
          isDarkMode ? 'bg-slate-950/60' : 'bg-emerald-950/25'
        }`}
      />
      {/* Soft stage bloom so the glass card refracts color */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-24 left-1/4 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-50"
          style={{
            background: isDarkMode
              ? 'radial-gradient(circle, rgba(16,185,129,0.28) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(16,185,129,0.35) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-0 right-1/5 w-[24rem] h-[24rem] rounded-full blur-3xl opacity-40"
          style={{
            background: isDarkMode
              ? 'radial-gradient(circle, rgba(45,212,191,0.18) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(20,184,166,0.28) 0%, transparent 70%)',
          }}
        />
      </div>

      <div
        className={`relative w-full ${maxWidthClass} max-h-[min(94vh,760px)] flex flex-col overflow-hidden rounded-[1.85rem] border ${
          isDarkMode
            ? 'bg-slate-900/45 border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.04)_inset]'
            : 'bg-white/45 border-white/70 shadow-[0_24px_80px_rgba(15,23,42,0.14),0_0_0_1px_rgba(255,255,255,0.55)_inset]'
        } backdrop-blur-2xl ${panelClassName}`}
      >
        {/* Specular rim / top glass sheen */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[1.85rem]"
          style={{
            background: isDarkMode
              ? 'linear-gradient(165deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 28%, transparent 55%)'
              : 'linear-gradient(165deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.2) 32%, transparent 58%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 h-px rounded-full"
          style={{
            background: isDarkMode
              ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)',
          }}
        />

        <div
          className={`relative z-[1] flex-1 min-h-0 overflow-y-auto overscroll-contain ${
            immersive ? 'px-0 py-0' : 'px-5 pt-5 pb-4'
          } ${isDarkMode ? 'text-slate-100' : 'text-slate-900'} ${bodyClassName}`}
        >
          {children}
        </div>

        {footer && (
          <div
            className={`relative z-[1] shrink-0 ${
              immersive
                ? 'px-6 pb-7 pt-2'
                : `px-5 py-4 border-t ${
                    isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-white/50 bg-white/20'
                  } backdrop-blur-md`
            } ${footerClassName}`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
