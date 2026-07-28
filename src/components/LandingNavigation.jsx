import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Minimal conversion-focused nav for campaign landing pages.
 * Presentational only — parent supplies theme + toggle handlers to avoid HMR hook-signature issues.
 */
function LandingNavigation({
  companyName = 'BetterChoice',
  logoUrl = '',
  themeStyle = {},
  isDarkMode = true,
  language = 'english',
  onToggleTheme,
  onToggleLanguage,
}) {
  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-[var(--theme-glass-border)] bg-[var(--theme-glass-bg)] backdrop-blur-xl backdrop-saturate-150 shadow-[0_4px_24px_-4px_var(--theme-glow-primary),inset_0_1px_0_var(--theme-glass-sheen)]"
      style={themeStyle}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-[4.5rem]">
          <Link to="/" className="flex items-center gap-2.5 group min-w-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--theme-glass-border)] bg-[color-mix(in_srgb,var(--theme-secondary)_20%,transparent)] overflow-hidden shrink-0">
              <img
                src={logoUrl || '/favicon.ico'}
                alt=""
                className="w-full h-full object-contain p-1"
              />
            </div>
            <span className="text-base md:text-lg font-bold tracking-tight text-[var(--theme-text)] truncate">
              {companyName}
            </span>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              className="w-9 h-9 rounded-full flex items-center justify-center border border-[var(--theme-glass-border)] bg-[color-mix(in_srgb,var(--theme-secondary)_18%,transparent)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors"
              title={isDarkMode ? 'Light mode' : 'Dark mode'}
            >
              {isDarkMode ? (
                <svg className="w-4 h-4 text-[var(--theme-accent)]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={onToggleLanguage}
              className="w-9 h-9 rounded-full flex items-center justify-center border border-[var(--theme-glass-border)] bg-[color-mix(in_srgb,var(--theme-primary)_12%,transparent)] text-[var(--theme-accent)] font-bold text-xs hover:bg-[color-mix(in_srgb,var(--theme-primary)_18%,transparent)] transition-colors"
            >
              {language === 'hebrew' ? 'EN' : 'ע'}
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}

export default LandingNavigation;
