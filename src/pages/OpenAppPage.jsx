import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import AppStoreBadges from '../components/brand/StoreBadges';
import { AuthShell } from '../components/brand/AuthShell';
import { primaryButton } from '../components/brand/ui';

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
  const { language } = useLanguage();
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
    const existed = Boolean(meta);
    const previous = meta ? meta.getAttribute('content') : null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'apple-itunes-app');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', metaContent);

    return () => {
      if (!existed) meta.remove();
      else if (previous) meta.setAttribute('content', previous);
    };
  }, [isIOS]);

  const title = status === 'opening'
    ? (hebrew ? 'פותחים את האפליקציה' : 'Opening the app')
    : (hebrew ? 'פתיחת האפליקציה' : 'Open the app');
  const body = status === 'opening'
    ? (hebrew
      ? 'הקישור פותח את BetterChoice AI עכשיו.'
      : 'This link is opening BetterChoice AI now.')
    : (isPhone
      ? (hebrew
        ? 'הקישור הזה פותח את BetterChoice AI בטלפון.'
        : 'This link opens BetterChoice AI on your phone.')
      : (hebrew
        ? 'פתחו את הקישור הזה מהטלפון. מכאן אפשר גם להוריד את האפליקציה.'
        : 'Open this link on your phone. You can also download the app from here.'));
  const openLabel = status === 'opening'
    ? (hebrew ? 'פותחים…' : 'Opening…')
    : (hebrew ? 'פתיחת האפליקציה' : 'Open the app');
  const missedMessage = offline
    ? (hebrew
      ? 'האפליקציה לא נפתחה, ואין חיבור להורדה. אם היא מותקנת, נסו שוב כשהדף עדיין פתוח.'
      : 'The app didn’t open, and you’re offline so the stores can’t load. If it’s installed, try again.')
    : (hebrew
      ? 'האפליקציה לא נפתחה. אם היא לא מותקנת, הורידו אותה:'
      : 'The app didn’t open. If it isn’t installed, download it:');

  return (
    <AuthShell title={title} subtitle={body}>
      <a
        href={APP_SCHEME}
        onClick={attemptOpen}
        aria-busy={status === 'opening'}
        className={`${primaryButton} w-full`}
      >
        {openLabel}
      </a>

      <div className="mt-8 pt-8 border-t border-bc-border flex flex-col items-center text-center" aria-live="polite">
        {status === 'not-opened' && (
          <p className="mb-4 text-[15px] font-semibold text-bc-text">
            {missedMessage}
          </p>
        )}
        {status === 'opened' && (
          <p className="mb-4 text-[15px] font-semibold text-bc-muted">
            {hebrew ? 'אם חזרתם לכאן, אפשר לפתוח שוב.' : 'If you’re back here, you can open it again.'}
          </p>
        )}
        <p className="mb-3 text-[13px] font-semibold text-bc-muted">
          {hebrew ? 'או הורידו את האפליקציה' : 'Or download the app'}
        </p>
        <AppStoreBadges className="justify-center" />
      </div>
    </AuthShell>
  );
}

export default OpenAppPage;
