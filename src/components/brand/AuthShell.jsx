import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { Mark, Wordmark } from './Logo';
import { CouchScene } from '../../features/marketing/home/Illustrations';
import { StreakPill } from '../../features/marketing/home/OnYourSide';
import { field, fieldLabel, focusClass, iconButton, textButton } from './ui';

// Auth screens in the site design: the form in a 480px column (mark at 56, then
// the wordmark at 22, 32px before the form) next to a drawn scene from the home
// page: the evening check-in on the couch, with the streak. On phones the scene
// is a short strip above the form.

const FADE = { duration: 0.4, ease: 'easeOut' };

export function AuthShell({ title, subtitle, children, footer = true }) {
  const { language, direction, toggleLanguage } = useLanguage();
  const { isDarkMode, toggleTheme } = useTheme();
  const isHebrew = language === 'hebrew';
  const legalLink = `text-[13px] font-semibold text-bc-muted hover:text-bc-text transition-colors rounded ${focusClass}`;

  return (
    <div dir={direction} className="min-h-screen flex flex-col bg-bc-canvas text-bc-text font-system text-start">
      <header className="h-16 px-6 flex items-center justify-between">
        <Link to="/" aria-label={isHebrew ? 'דף הבית של BetterChoice' : 'BetterChoice home'} className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg ${focusClass}`}>
          <Mark size={28} />
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLanguage}
            lang={isHebrew ? 'en' : 'he'}
            aria-label={isHebrew ? 'English · החלפה לאנגלית' : 'עברית · Switch to Hebrew'}
            className={`${textButton} px-3`}
          >
            {isHebrew ? 'English' : 'עברית'}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDarkMode ? (isHebrew ? 'מעבר למצב בהיר' : 'Switch to light mode') : isHebrew ? 'מעבר למצב כהה' : 'Switch to dark mode'}
            className={iconButton}
          >
            {isDarkMode ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 pt-2 lg:pt-6 pb-12 grid lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] gap-10 lg:gap-16 items-start lg:items-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={FADE}
          className="w-full max-w-[480px] mx-auto lg:mx-0 flex flex-col"
        >
          <SceneArt className="lg:hidden mb-8 h-36 rounded-[28px]" pill={false} />
          <div className="flex flex-col items-center gap-3">
            <Mark size={56} />
            <Wordmark height={22} />
          </div>
          {title ? (
            <h1 className={`mt-8 text-center text-[28px] leading-tight text-bc-text font-choice font-medium`}>
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p className="mt-2 text-center text-[15px] font-semibold text-bc-muted">{subtitle}</p>
          ) : null}
          <div className="mt-8">{children}</div>
        </motion.div>
        <motion.aside
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...FADE, delay: 0.1 }}
          className="hidden lg:block"
          aria-hidden="true"
        >
          <SceneArt className="aspect-[8/5] rounded-[40px]" pill />
          <p className="mt-5 text-center font-choice font-medium text-[22px] text-bc-text">
            {isHebrew ? 'התפריט, היומן והמאמנת. הכל מחכה באפליקציה.' : 'Your plan, your log and your coach, all in the app.'}
          </p>
        </motion.aside>
      </main>

      {footer ? (
        <footer className="px-6 pb-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link to="/privacy-policy" className={legalLink}>{isHebrew ? 'פרטיות' : 'Privacy'}</Link>
          <Link to="/terms" className={legalLink}>{isHebrew ? 'תנאי שימוש' : 'Terms'}</Link>
          <Link to="/accessibility-statement" className={legalLink}>{isHebrew ? 'נגישות' : 'Accessibility'}</Link>
        </footer>
      ) : null}
    </div>
  );
}

/** The couch scene from the home page, framed; `pill` adds the streak flame. */
function SceneArt({ className = '', pill }) {
  return (
    <div className={`relative overflow-hidden border border-bc-border ${className}`} aria-hidden="true">
      <CouchScene className="absolute inset-0 h-full w-full" />
      {pill ? (
        <div className="absolute" style={{ left: '29%', top: '44%' }} dir="ltr">
          <StreakPill count={12} size={1.3} />
        </div>
      ) : null}
    </div>
  );
}

/** Labeled field: 13/600 label, 1px border, radius 16, accent border on focus. */
export function AuthField({ id, label, action, hint, ...inputProps }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={fieldLabel}>{label}</label>
        {action}
      </div>
      <input id={id} name={inputProps.name || id} className={field} {...inputProps} />
      {hint ? <p className="mt-2 text-[12px] font-semibold text-bc-muted">{hint}</p> : null}
    </div>
  );
}

/** Inline message. Error uses the semantic danger color; success uses the accent well. */
export function AuthNotice({ tone = 'error', children }) {
  const styles =
    tone === 'error'
      ? { backgroundColor: 'var(--bc-danger-well)', color: 'var(--bc-danger)' }
      : { backgroundColor: 'var(--bc-accent-well)', color: 'var(--bc-text)' };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className="rounded-bc-field px-4 py-3 text-[14px] font-semibold" style={styles}>
      {children}
    </div>
  );
}

/** "or" divider between the form and the Google button. */
export function AuthDivider({ label }) {
  return (
    <div className="flex items-center gap-3 my-6" aria-hidden="true">
      <span className="h-px flex-1 bg-bc-border" />
      <span className="text-[13px] font-semibold text-bc-muted">{label}</span>
      <span className="h-px flex-1 bg-bc-border" />
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
