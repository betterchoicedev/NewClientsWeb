import React from 'react';

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
