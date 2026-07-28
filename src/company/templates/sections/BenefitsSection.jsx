import React from 'react';
import { Target, Zap, Users, Sparkles } from 'lucide-react';
import { glassCardClass, sectionShellClass, sectionSubtitleClass, sectionTitleClass } from './glassStyles';

const ICON_MAP = { Target, Zap, Users, Sparkles };

function resolveIcon(iconName) {
  return ICON_MAP[iconName] || Sparkles;
}

export default function BenefitsSection({ content, variant = 'default' }) {
  const { sectionTitle, sectionSubtitle, items } = content.benefits;

  if (!items?.length) return null;

  const isTactical = variant === 'tactical';

  return (
    <div className={sectionShellClass()}>
      <div className="text-center mb-10 md:mb-12">
        <h2 className={`${sectionTitleClass()} ${isTactical ? 'font-mono uppercase tracking-tight' : ''}`}>
          {isTactical ? `// ${sectionTitle}` : sectionTitle}
        </h2>
        {sectionSubtitle && (
          <p className={`${sectionSubtitleClass()} mx-auto`}>{sectionSubtitle}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
        {items.map((item, idx) => {
          const Icon = resolveIcon(item.icon);
          return (
            <article
              key={idx}
              className={`${glassCardClass('p-6 md:p-8 group hover:-translate-y-1 hover:shadow-2xl hover:shadow-[var(--theme-glow-primary)]/20')} ${
                isTactical ? 'rounded-none border-2 border-[var(--theme-primary)]' : ''
              }`}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 border bg-[color-mix(in_srgb,var(--theme-primary)_15%,transparent)] border-[color-mix(in_srgb,var(--theme-primary)_30%,transparent)] text-[var(--theme-primary)] group-hover:scale-110 transition-transform duration-300">
                <Icon className="w-6 h-6" />
              </div>
              <h3
                className={`text-lg font-bold mb-2 text-[var(--theme-text)] ${
                  isTactical ? 'font-mono uppercase text-sm tracking-wide' : ''
                }`}
              >
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--theme-text-muted)]">{item.description}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
