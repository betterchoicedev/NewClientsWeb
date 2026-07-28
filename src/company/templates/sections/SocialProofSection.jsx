import React from 'react';
import { Quote } from 'lucide-react';
import { glassCardClass, sectionShellClass, sectionSubtitleClass, sectionTitleClass } from './glassStyles';

export default function SocialProofSection({ content, variant = 'default' }) {
  const { sectionTitle, sectionSubtitle, testimonials } = content.socialProof;

  if (!testimonials?.length) return null;

  const isTactical = variant === 'tactical';

  return (
    <div className={sectionShellClass()}>
      <div className="text-center mb-10 md:mb-12">
        <h2 className={`${sectionTitleClass()} ${isTactical ? 'font-mono uppercase' : ''}`}>
          {isTactical ? `[ ${sectionTitle} ]` : sectionTitle}
        </h2>
        {sectionSubtitle && (
          <p className={`${sectionSubtitleClass()} mx-auto`}>{sectionSubtitle}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
        {testimonials.map((item, idx) => (
          <article
            key={idx}
            className={`${glassCardClass('p-6 md:p-7 flex flex-col hover:-translate-y-1')} ${
              isTactical ? 'rounded-none border-2 border-[var(--theme-primary)]' : ''
            }`}
          >
            <Quote className="w-8 h-8 mb-4 text-[color-mix(in_srgb,var(--theme-primary)_50%,transparent)]" />
            <p className="text-sm leading-relaxed flex-1 mb-6 text-[var(--theme-text)]">&ldquo;{item.quote}&rdquo;</p>
            <div className="flex items-center gap-3 pt-4 border-t border-[var(--theme-glass-border)]">
              {item.avatarUrl ? (
                <img
                  src={item.avatarUrl}
                  alt={item.name}
                  className="w-10 h-10 rounded-full object-cover border border-[var(--theme-glass-border)]"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] border border-[color-mix(in_srgb,var(--theme-primary)_35%,transparent)] flex items-center justify-center text-xs font-bold text-[var(--theme-primary)]">
                  {item.initials}
                </div>
              )}
              <div>
                <p className="font-bold text-sm text-[var(--theme-text)]">{item.name}</p>
                <p className="text-xs text-[var(--theme-accent)]">{item.role}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
