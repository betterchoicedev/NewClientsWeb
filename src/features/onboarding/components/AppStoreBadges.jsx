import React from 'react';

const IOS_URL = 'https://apps.apple.com/il/app/betterchoice-ai-co/id6770512379';
const ANDROID_URL = 'https://play.google.com/store/apps/details?id=live.betterchoice.betterchoiceai';

const linkClass =
  'flex w-full sm:flex-1 items-center justify-center min-h-[3.5rem] px-2 py-3 rounded-xl transition-transform hover:opacity-90 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500';

const badgeClass = 'w-full h-auto max-h-14 sm:max-h-16';

function AppStoreBadgeSvg({ className = badgeClass }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 135 40"
      role="img"
      aria-hidden="true"
    >
      <rect width="135" height="40" rx="6" fill="#000" />
      <path
        fill="#fff"
        d="M24.77 20.3c-.03-3.2 2.61-4.74 2.73-4.81-1.49-2.17-3.8-2.47-4.62-2.5-1.97-.2-3.84 1.16-4.84 1.16-.99 0-2.53-1.13-4.16-1.1-2.14.03-4.12 1.24-5.22 3.16-2.23 3.86-.57 9.58 1.6 12.7 1.06 1.53 2.33 3.25 4 3.18 1.6-.06 2.2-1.04 4.13-1.04 1.93 0 2.47 1.04 4.15 1.01 1.72-.03 2.8-1.55 3.84-3.09 1.21-1.77 1.71-3.48 1.74-3.57-.04-.02-3.35-1.28-3.38-5.1zM21.3 11.5c.88-1.06 1.47-2.54 1.31-4.01-1.27.05-2.8.84-3.71 1.9-.81.94-1.52 2.44-1.33 3.88 1.4.11 2.84-.71 3.73-1.77z"
      />
      <text x="42" y="15" fill="#fff" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" fontSize="8">
        Download on the
      </text>
      <text x="42" y="28" fill="#fff" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" fontSize="14" fontWeight="600">
        App Store
      </text>
    </svg>
  );
}

function GooglePlayBadgeSvg({ className = badgeClass }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 135 40"
      role="img"
      aria-hidden="true"
    >
      <rect width="135" height="40" rx="6" fill="#000" />
      <g transform="translate(8, 8)">
        <path
          fill="#EA4335"
          d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12 3.84 21.85C3.34 21.6 3 21.09 3 20.5Z"
        />
        <path
          fill="#FBBC04"
          d="M16.81 15.12 6.05 21.34l8.49-8.49 2.27 2.27Z"
        />
        <path
          fill="#4285F4"
          d="M20.16 10.81c.34.27.59.69.59 1.19s-.22.92-.57 1.2l-2.29 1.32-2.5-2.5 2.5-2.5 2.27 1.31Z"
        />
        <path
          fill="#34A853"
          d="M6.05 2.66 16.81 8.88 14.54 11.15 6.05 2.66Z"
        />
      </g>
      <text
        x="42"
        y="14"
        fill="#fff"
        fontFamily="Roboto, 'Segoe UI', sans-serif"
        fontSize="7"
        letterSpacing="0.8"
      >
        GET IT ON
      </text>
      <text
        x="42"
        y="28"
        fill="#fff"
        fontFamily="Roboto, 'Segoe UI', sans-serif"
        fontSize="14"
        fontWeight="500"
      >
        Google Play
      </text>
    </svg>
  );
}

export default function AppStoreBadges({ className = '' }) {
  return (
    <div
      className={`flex flex-col sm:flex-row items-stretch justify-center gap-3 w-full ${className}`}
    >
      <a
        href={IOS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        aria-label="Download on the App Store"
      >
        <AppStoreBadgeSvg />
      </a>
      <a
        href={ANDROID_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        aria-label="Get it on Google Play"
      >
        <GooglePlayBadgeSvg />
      </a>
    </div>
  );
}
