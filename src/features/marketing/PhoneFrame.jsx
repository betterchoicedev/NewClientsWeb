import React, { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { FOOTAGE, footagePathHint } from './footage';

/**
 * Flat iPhone frame on the app canvas. No shadow, no 3D: a 1px keyline,
 * a dark bezel, and the screen. The screen shows `children`.
 */
export function PhoneFrame({ children, className = '', label }) {
  return (
    <div
      className={`relative aspect-[393/852] w-[248px] sm:w-[280px] lg:w-[300px] rounded-[48px] sm:rounded-[54px] bg-[#0B0F0D] border border-bc-border p-[10px] ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[38px] sm:rounded-[44px] bg-bc-canvas">
        {children}
        {/* Dynamic Island */}
        <div
          aria-hidden="true"
          className="absolute top-[10px] left-1/2 -translate-x-1/2 h-[26px] w-[88px] rounded-full bg-black"
        />
      </div>
    </div>
  );
}

// Clips are recorded at the app area below the iPhone status bar (393x795 of 393x852).
const STATUS_BAR = `${(57 / 852) * 100}%`;
const APP_DARK = '#121915'; // NAV_THEME.dark.base: clips are recorded in dark mode

/** Plain iPhone status bar so the recorded app header sits where it does on a phone. */
function StatusBar() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 top-0 flex items-center justify-between px-[6%] text-white"
      style={{ height: STATUS_BAR, backgroundColor: APP_DARK }}
    >
      <span className="text-[12px] font-semibold tabular-nums" dir="ltr">9:41</span>
      <span className="flex items-center gap-[4px]" dir="ltr">
        <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor">
          <rect x="0" y="7" width="3" height="3" rx="0.7" />
          <rect x="4.3" y="5" width="3" height="5" rx="0.7" />
          <rect x="8.6" y="2.5" width="3" height="7.5" rx="0.7" />
          <rect x="12.9" y="0" width="3" height="10" rx="0.7" />
        </svg>
        <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
          <path d="M7 2.2c2 0 3.8.8 5.1 2.1l1-1A8.6 8.6 0 0 0 7 .8 8.6 8.6 0 0 0 .9 3.3l1 1A7.2 7.2 0 0 1 7 2.2Zm0 2.8c1.2 0 2.3.5 3.1 1.3l1-1A5.8 5.8 0 0 0 7 3.6c-1.6 0-3.1.7-4.1 1.7l1 1C4.7 5.5 5.8 5 7 5Zm0 2.8c-.5 0-.9.2-1.2.5L7 9.5l1.2-1.2c-.3-.3-.7-.5-1.2-.5Z" />
        </svg>
        <svg width="24" height="11" viewBox="0 0 24 11" fill="none">
          <rect x="0.5" y="0.5" width="20" height="10" rx="3" stroke="currentColor" opacity="0.4" />
          <rect x="2" y="2" width="15" height="7" rx="1.6" fill="currentColor" />
          <rect x="21.7" y="3.6" width="1.6" height="3.8" rx="0.8" fill="currentColor" opacity="0.4" />
        </svg>
      </span>
    </div>
  );
}

/** Marked slot for a missing recording. Deliberately not a fake app screen. */
function FootagePlaceholder({ footageKey, title, icon: Icon, tint, language }) {
  const isHebrew = language === 'hebrew';
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-full rounded-[24px] border border-dashed border-bc-border px-4 py-8 flex flex-col items-center gap-3">
        {Icon ? (
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              backgroundColor: tint === 'wellness' ? 'var(--bc-wellness-well)' : 'var(--bc-surface-2)',
              color: tint === 'wellness' ? 'var(--bc-wellness)' : 'var(--bc-accent)',
            }}
          >
            <Icon size={26} aria-hidden="true" />
          </span>
        ) : null}
        <span className="text-[16px] font-bold text-bc-text">{title}</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-bc-muted">
          {isHebrew ? 'מקום לצילום מסך מהאפליקציה' : 'App footage placeholder'}
        </span>
        <code dir="ltr" className="text-[11px] text-bc-muted break-all">
          {footagePathHint(footageKey)}
        </code>
      </div>
    </div>
  );
}

/**
 * The screen content for one product section: the recording from FOOTAGE when
 * it exists and loads, otherwise the marked placeholder. Plays only in view.
 */
export function PhoneFootage({ footageKey, title, icon, tint, language }) {
  const entry = FOOTAGE[footageKey] || null;
  const src = entry?.src || null;
  const poster = entry?.poster || undefined;
  const videoRef = useRef(null);
  const inView = useInView(videoRef, { amount: 0.4 });
  const reduceMotion = useReducedMotion();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || failed) return;
    if (inView && !reduceMotion) {
      const playing = video.play();
      if (playing && typeof playing.catch === 'function') playing.catch(() => {});
    } else {
      video.pause();
    }
  }, [inView, reduceMotion, src, failed]);

  const showVideo = src && !failed;

  return (
    <>
      {showVideo ? <StatusBar /> : null}
      {showVideo ? (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          onError={() => setFailed(true)}
          className="absolute inset-x-0 bottom-0 w-full object-cover"
          style={{ top: STATUS_BAR }}
        />
      ) : null}
      {!showVideo ? (
        <FootagePlaceholder footageKey={footageKey} title={title} icon={icon} tint={tint} language={language} />
      ) : null}
    </>
  );
}
