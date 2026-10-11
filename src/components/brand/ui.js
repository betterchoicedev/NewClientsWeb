// Class strings for the BetterApp component rules (BetterApp/DESIGN.md).
// Separation is a 1px border; these surfaces never get a drop shadow.

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bc-accent)]';

/** Filled accent, dark label, radius 24, min height 48. One per view. */
export const primaryButton =
  `inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-bc-button bg-bc-accent text-bc-on-accent text-[15px] font-bold transition-opacity duration-150 hover:opacity-90 active:opacity-75 disabled:opacity-50 disabled:cursor-not-allowed ${focusRing}`;

/** 1px border, no fill. */
export const secondaryButton =
  `inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-bc-button border border-bc-border text-bc-text text-[15px] font-semibold transition-opacity duration-150 hover:opacity-80 active:opacity-60 disabled:opacity-50 disabled:cursor-not-allowed ${focusRing}`;

/** Text-only action. */
export const textButton =
  `inline-flex items-center justify-center gap-2 min-h-[44px] px-3 rounded-bc-button text-bc-text text-[15px] font-semibold transition-opacity duration-150 hover:opacity-70 active:opacity-50 ${focusRing}`;

/** Round icon control (theme, etc). */
export const iconButton =
  `inline-flex items-center justify-center w-11 h-11 rounded-full border border-bc-border text-bc-text transition-opacity duration-150 hover:opacity-80 active:opacity-60 ${focusRing}`;

/** Surface card: radius 32, 1px border. */
export const card = 'bg-bc-surface border border-bc-border rounded-bc-card';

/** Field: radius 16, 1px border, accent border on focus. */
export const field =
  'w-full min-h-[48px] px-4 rounded-bc-field border border-bc-border bg-bc-canvas text-bc-text text-[15px] font-semibold placeholder:text-bc-muted outline-none transition-colors duration-150 focus:border-bc-accent disabled:opacity-60';

export const fieldLabel = 'block text-[13px] font-semibold text-bc-muted mb-2';

export const focusClass = focusRing;

/** Choice Sans is Latin only: apply it to titles only when the UI is English. */
export const titleFont = (language) => (language === 'hebrew' ? '' : 'font-choice');
