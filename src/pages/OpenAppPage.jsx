import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import AppStoreBadges from '../features/onboarding/components/AppStoreBadges';

const APP_SCHEME = 'betterchoicemobile://';
const APPLE_APP_ID = '6770512379';
const OPEN_ATTEMPT_MS = 1600;

function detectPlatform() {
  const userAgent = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
  const isAndroidDevice = /android/i.test(userAgent);
  const isIOSDevice =
    /iphone|ipad|ipod/i.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return { isIOSDevice, isAndroidDevice };
}

function OpenAppPage() {
  const { language, direction, toggleLanguage } = useLanguage();
  const { isDarkMode, themeClasses } = useTheme();
  const [isIOS, setIsIOS] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const [status, setStatus] = useState('opening');
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const attemptTimer = useRef(null);
  const hideListener = useRef(null);
  const hebrew = language === 'hebrew';

  const attemptOpen = () => {
    setStatus('opening');
    window.clearTimeout(attemptTimer.current);
    if (hideListener.current) {
      document.removeEventListener('visibilitychange', hideListener.current);
    }
    const onHide = () => {
      if (document.hidden) setStatus('opened');
    };
    hideListener.current = onHide;
    document.addEventListener('visibilitychange', onHide);
    attemptTimer.current = window.setTimeout(() => {
      document.removeEventListener('visibilitychange', onHide);
      if (document.visibilityState === 'visible') setStatus('not-opened');
    }, OPEN_ATTEMPT_MS);
    window.location.href = APP_SCHEME;
  };

  useEffect(() => {
    attemptOpen();
    return () => {
      window.clearTimeout(attemptTimer.current);
      if (hideListener.current) {
        document.removeEventListener('visibilitychange', hideListener.current);
      }
    };
  }, []);

  useEffect(() => {
    const { isIOSDevice, isAndroidDevice } = detectPlatform();
    setIsIOS(isIOSDevice);
    setIsPhone(isIOSDevice || isAndroidDevice);
  }, []);

  useEffect(() => {
    const sync = () => setOffline(navigator.onLine === false);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  useEffect(() => {
    if (!isIOS) return undefined;

    const metaContent = `app-id=${APPLE_APP_ID}, app-argument=https://betterchoice.one/app`;
    let meta = document.querySelector('meta[name="apple-itunes-app"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'apple-itunes-app');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', metaContent);

    return () => {
      if (created) meta.remove();
    };
  }, [isIOS]);

  const title = status === 'opening'
    ? (hebrew ? 'פותחים את האפליקציה' : 'Opening the app')
    : (hebrew ? 'פתח את האפליקציה' : 'Open the app');
  const body = status === 'opening'
    ? (hebrew
      ? 'הקישור פותח את BetterChoice AI עכשיו.'
      : 'This link is opening BetterChoice AI now.')
    : (isPhone
      ? (hebrew
        ? 'הקישור הזה פותח את BetterChoice AI בטלפון.'
        : 'This link opens BetterChoice AI on your phone.')
      : (hebrew
        ? 'פתח את הקישור הזה מהטלפון. מכאן אפשר גם להוריד את האפליקציה.'
        : 'Open this link on your phone. You can also download the app from here.'));
  const openLabel = status === 'opening'
    ? (hebrew ? 'פותח…' : 'Opening…')
    : title;
  const missedMessage = offline
    ? (hebrew
      ? 'האפליקציה לא נפתחה, ואין חיבור להורדה. אם היא מותקנת, נסה שוב כשהדף עדיין פתוח.'
      : 'The app didn’t open, and you’re offline so the stores can’t load. If it’s installed, try again.')
    : (hebrew
      ? 'האפליקציה לא נפתחה. אם היא לא מותקנת, הורד אותה:'
      : 'The app didn’t open. If it isn’t installed, download it:');

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-10 ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950' : 'bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white'}`} dir={direction}>
      <main className={`w-full max-w-md ${isDarkMode ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white/80 border-white/50'} backdrop-blur-xl border rounded-3xl shadow-2xl p-8 sm:p-10 text-center`}>
        <div className="mb-6 flex justify-center">
          <div className={`p-4 rounded-full ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-100'}`}>
            <img src="/favicon.ico" alt="" className="h-12 w-12 rounded-xl" />
          </div>
        </div>
        <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${themeClasses.textPrimary} mb-4`}>
          {title}
        </h1>
        <p className={`${themeClasses.textSecondary} mb-8 leading-relaxed`}>
          {body}
        </p>

        <a
          href={APP_SCHEME}
          onClick={attemptOpen}
          aria-busy={status === 'opening'}
          className="flex items-center justify-center min-h-11 w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 px-6 rounded-xl font-bold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 active:scale-[0.98] transition-all duration-300"
        >
          {openLabel}
        </a>

        <div className="mt-8" aria-live="polite">
          {status === 'not-opened' && (
            <p className={`mb-4 text-sm font-medium ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
              {missedMessage}
            </p>
          )}
          {status === 'opened' && (
            <p className={`mb-4 text-sm font-medium ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
              {hebrew ? 'אם חזרת לכאן, אפשר לפתוח שוב.' : 'If you’re back here, you can open it again.'}
            </p>
          )}
          <p className={`mb-3 text-sm font-medium ${themeClasses.textSecondary}`}>
            {hebrew ? 'או הורד את האפליקציה' : 'Or download the app'}
          </p>
          <AppStoreBadges />
        </div>

        <button
          type="button"
          onClick={toggleLanguage}
          className={`mt-8 min-h-11 px-4 text-sm font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${isDarkMode ? 'text-slate-400 hover:text-emerald-400' : 'text-gray-500 hover:text-emerald-600'}`}
        >
          {hebrew ? 'English' : 'עברית'}
        </button>
      </main>
    </div>
  );
}

export default OpenAppPage;
