import React from 'react';
import { sectionEyebrowClass } from './glassStyles';

/**
 * Section wrapper — clean spacing only; no bridge gradients that clash on scroll.
 */
export default function FlowSection({
  children,
  eyebrow,
  isFirst = false,
  isLast = false,
  variant = 'default',
}) {
  const isTactical = variant === 'tactical';

  return (
    <section
      className={`relative ${isFirst ? 'mt-2 md:mt-4' : ''} ${isLast ? 'pb-20 md:pb-28' : 'pb-4 md:pb-6'}`}
    >
      <div className={`relative z-10 py-10 md:py-14 ${isFirst ? 'pt-4 md:pt-6' : ''}`}>
        {eyebrow && !isTactical && (
          <div className="text-center mb-2">
            <span className={sectionEyebrowClass()}>{eyebrow}</span>
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
