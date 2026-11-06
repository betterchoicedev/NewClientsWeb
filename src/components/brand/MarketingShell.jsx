import React from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Lockup, Mark } from './Logo';
import DownloadLink from './DownloadLink';
import { iconButton, secondaryButton, textButton, focusClass } from './ui';

const copy = {
  english: {
    download: 'Download',
    login: 'Log in',
    account: 'Account',
    otherLanguage: 'עברית',
    otherLanguageLabel: 'Switch to Hebrew',
    toLight: 'Switch to light mode',
    toDark: 'Switch to dark mode',
    home: 'BetterChoice home',
    privacy: 'Privacy',
    terms: 'Terms',
    accessibility: 'Accessibility',
    legal: 'Legal',
  },
  hebrew: {
    download: 'הורדה',
    login: 'התחברות',
    account: 'חשבון',
    otherLanguage: 'English',
    otherLanguageLabel: 'החלפה לאנגלית',
    toLight: 'מעבר למצב בהיר',
    toDark: 'מעבר למצב כהה',
    home: 'דף הבית של BetterChoice',
    privacy: 'פרטיות',
    terms: 'תנאי שימוש',
    accessibility: 'נגישות',
    legal: 'מידע משפטי',
  },
};

export function MarketingHeader() {
  const { language, toggleLanguage } = useLanguage();
  const { isDarkMode, toggleTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const c = copy[language] || copy.english;

  // NAV_THEME surface1 is the app's nav bar container: it sets the bar apart from the canvas hero.
  return (
    <header className="sticky top-0 z-40 bg-bc-surface border-b border-bc-border">
      <div className="mx-auto max-w-6xl h-16 px-4 sm:px-6 flex items-center justify-between gap-2">
        <Link to="/" aria-label={c.home} className={`flex items-center min-h-[44px] min-w-[44px] rounded-lg ${focusClass}`}>
          <span className="sm:hidden"><Mark size={28} /></span>
          <span className="hidden sm:inline-flex"><Lockup height={22} /></span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={`${c.otherLanguage} · ${c.otherLanguageLabel}`}
            lang={language === 'hebrew' ? 'en' : 'he'}
            className={`${textButton} px-2 sm:px-3 whitespace-nowrap`}
          >
            {c.otherLanguage}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDarkMode ? c.toLight : c.toDark}
            title={isDarkMode ? c.toLight : c.toDark}
            className={iconButton}
          >
            {isDarkMode ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
          <Link to={isAuthenticated ? '/account' : '/login'} className={`${textButton} px-2 sm:px-3 whitespace-nowrap`}>
            {isAuthenticated ? c.account : c.login}
          </Link>
          {/* very narrow phones: the sticky download bar does this job */}
          <DownloadLink className={`${secondaryButton} max-[399px]:!hidden whitespace-nowrap`}>{c.download}</DownloadLink>
        </nav>
      </div>
    </header>
  );
}

function MarketingFooter() {
  const { language } = useLanguage();
  const c = copy[language] || copy.english;
  const linkClass = `inline-flex items-center min-h-[44px] text-[13px] font-semibold text-bc-muted hover:text-bc-text transition-colors rounded ${focusClass}`;

  return (
    <footer className="border-t border-bc-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Lockup height={18} />
        <nav aria-label={c.legal} className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link to="/privacy-policy" className={linkClass}>{c.privacy}</Link>
          <Link to="/terms" className={linkClass}>{c.terms}</Link>
          <Link to="/accessibility-statement" className={linkClass}>{c.accessibility}</Link>
          <span className="text-[13px] font-semibold text-bc-muted">© {new Date().getFullYear()} BetterChoice</span>
        </nav>
      </div>
    </footer>
  );
}

/** Public pages: wordmark, language, theme, Download, Log in. No feature navigation. */
export default function MarketingShell({ children, className = '' }) {
  const { direction } = useLanguage();
  return (
    <div dir={direction} className={`min-h-screen flex flex-col bg-bc-canvas text-bc-text font-system text-start ${className}`}>
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
