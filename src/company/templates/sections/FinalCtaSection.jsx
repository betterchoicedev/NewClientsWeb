import React from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { glassCardClass, primaryButtonClass, sectionShellClass } from './glassStyles';

export default function FinalCtaSection({ content, onCtaClick, campaign, variant = 'default' }) {
  const { language } = useLanguage();
  const { title, subtitle, ctaText, trustNote } = content.finalCta;
  const isTactical = variant === 'tactical';

  return (
    <div className={sectionShellClass()}>
      <div
        className={`${glassCardClass('relative overflow-hidden p-8 md:p-12 lg:p-16 text-center')} ${
          isTactical
            ? 'rounded-none border-4 border-[var(--theme-primary)] shadow-[8px_8px_0_0_var(--theme-primary)]'
            : ''
        }`}
      >
        <div className="relative z-10 max-w-2xl mx-auto">
          <h2
            className={`text-3xl md:text-4xl font-black mb-4 tracking-tight text-[var(--theme-text)] ${
              isTactical ? 'font-mono uppercase' : ''
            }`}
          >
            {isTactical ? `> ${title}` : title}
          </h2>
          <p className="text-base md:text-lg mb-8 text-[var(--theme-text-muted)]">{subtitle}</p>

          <button
            type="button"
            onClick={onCtaClick}
            className={`${primaryButtonClass('w-full sm:w-auto min-w-[240px]')} ${
              isTactical ? 'rounded-none uppercase tracking-widest font-mono' : ''
            }`}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {ctaText}
              <ArrowRight className="w-5 h-5" />
            </span>
            <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
          </button>

          {trustNote && (
            <p className="mt-5 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 text-[var(--theme-text-muted)]">
              <Lock className="w-3.5 h-3.5" />
              {trustNote}
            </p>
          )}

          {campaign?.isSmartLink && campaign?.slotsRemaining != null && (
            <p className="mt-3 text-sm font-bold text-[var(--theme-accent)]">
              {language === 'hebrew'
                ? `${campaign.slotsRemaining} מקומות נותרו`
                : `${campaign.slotsRemaining} ${campaign.slotsRemaining === 1 ? 'spot' : 'spots'} remaining`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
