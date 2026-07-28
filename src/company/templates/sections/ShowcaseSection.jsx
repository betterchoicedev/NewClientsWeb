import React, { useState } from 'react';
import { CheckCircle2, Monitor } from 'lucide-react';
import { glassCardClass, glassPanelClass, sectionShellClass, sectionSubtitleClass, sectionTitleClass } from './glassStyles';

export default function ShowcaseSection({ content, variant = 'default' }) {
  const { sectionTitle, sectionSubtitle, imageUrl, highlights } = content.showcase;
  const [activeIdx, setActiveIdx] = useState(0);

  if (!highlights?.length) return null;

  const isTactical = variant === 'tactical';
  const active = highlights[activeIdx] || highlights[0];
  const displayImage = imageUrl || content.hero?.imageUrl;

  return (
    <div className={sectionShellClass()}>
      <div className="text-center mb-10 md:mb-12">
        <h2 className={`${sectionTitleClass()} ${isTactical ? 'font-mono uppercase' : ''}`}>
          {isTactical ? `> ${sectionTitle}` : sectionTitle}
        </h2>
        {sectionSubtitle && (
          <p className={`${sectionSubtitleClass()} mx-auto`}>{sectionSubtitle}</p>
        )}
      </div>

      <div
        className={`${glassCardClass('p-4 md:p-6 lg:p-8')} ${
          isTactical ? 'rounded-none border-4 border-[var(--theme-primary)]' : ''
        }`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-center">
          <div
            className={`${glassPanelClass('aspect-video flex items-center justify-center overflow-hidden relative')} ${
              isTactical ? 'rounded-none border-2' : ''
            }`}
          >
            {displayImage ? (
              <img src={displayImage} alt={sectionTitle} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-4 p-8 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-[color-mix(in_srgb,var(--theme-primary)_18%,transparent)] text-[var(--theme-primary)]">
                  <Monitor className="w-8 h-8" />
                </div>
                <p className="text-sm font-medium text-[var(--theme-text-muted)]">{active.title}</p>
              </div>
            )}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(to top, color-mix(in srgb, var(--theme-secondary) 50%, transparent), transparent)',
              }}
            />
          </div>

          <div className="space-y-3">
            {highlights.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 ${
                  activeIdx === idx
                    ? 'bg-[color-mix(in_srgb,var(--theme-primary)_14%,transparent)] border-[color-mix(in_srgb,var(--theme-primary)_40%,transparent)]'
                    : 'bg-[color-mix(in_srgb,var(--theme-secondary)_18%,transparent)] border-[var(--theme-glass-border)] hover:bg-[color-mix(in_srgb,var(--theme-primary)_8%,transparent)]'
                } ${isTactical ? 'rounded-none font-mono' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      activeIdx === idx ? 'text-[var(--theme-primary)]' : 'text-[var(--theme-text-muted)]'
                    }`}
                  />
                  <div>
                    <h3 className="font-bold text-sm mb-1 text-[var(--theme-text)]">{item.title}</h3>
                    <p className="text-xs leading-relaxed text-[var(--theme-text-muted)]">{item.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
