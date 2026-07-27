import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { glassCardClass, sectionShellClass, sectionSubtitleClass, sectionTitleClass } from './glassStyles';

export default function FaqSection({ content, variant = 'default' }) {
  const { sectionTitle, sectionSubtitle, items } = content.faq;
  const [openIdx, setOpenIdx] = useState(0);

  if (!items?.length) return null;

  const isTactical = variant === 'tactical';

  return (
    <div className={sectionShellClass()}>
      <div className="text-center mb-10 md:mb-12">
        <h2 className={`${sectionTitleClass()} ${isTactical ? 'font-mono uppercase' : ''}`}>
          {isTactical ? `? ${sectionTitle}` : sectionTitle}
        </h2>
        {sectionSubtitle && (
          <p className={`${sectionSubtitleClass()} mx-auto`}>{sectionSubtitle}</p>
        )}
      </div>

      <div className="max-w-3xl mx-auto space-y-3">
        {items.map((item, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={idx}
              className={`${glassCardClass('overflow-hidden')} ${
                isTactical ? 'rounded-none border-2 border-[var(--theme-primary)]' : ''
              } ${isOpen ? 'border-[color-mix(in_srgb,var(--theme-primary)_35%,transparent)]' : ''}`}
            >
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? -1 : idx)}
                className="w-full flex items-center justify-between gap-4 p-5 md:p-6 text-left"
              >
                <span
                  className={`font-bold text-sm md:text-base text-[var(--theme-text)] ${
                    isTactical ? 'font-mono uppercase text-xs' : ''
                  }`}
                >
                  {item.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 shrink-0 transition-transform duration-300 text-[var(--theme-accent)] ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-5 md:px-6 pb-5 md:pb-6 text-sm leading-relaxed text-[var(--theme-text-muted)] border-t border-[var(--theme-glass-border)]">
                    {item.answer}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
