import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import ScarcityWidget from '../../components/ScarcityWidget';
import { getLocalizedLandingContent } from './landingContent';
import LandingSections from './sections/LandingSections';
import LandingFlow from './sections/LandingFlow';
import HeroFlowBridge, { HERO_CONTENT_CLASS, HERO_VIEWPORT_CLASS } from './sections/HeroFlowBridge';

function TacticalLayout({ config, manager, campaign, navigate, hash }) {
  const { language } = useLanguage();
  const colors = config?.ui?.themeSettings?.colors || {};
  const content = getLocalizedLandingContent(config?.content, language);
  const { hero } = content;

  const handleCta = () => navigate(`/signup${hash}`);

  return (
    <LandingFlow colors={colors}>
      <section className={`${HERO_VIEWPORT_CLASS} font-mono`}>
        <div className={HERO_CONTENT_CLASS}>
          <div className="max-w-3xl w-full mx-auto bg-[var(--theme-glass-bg)] backdrop-blur-xl border-4 border-[var(--theme-primary)] p-5 sm:p-8 md:p-10 lg:p-12 relative transition-all duration-500 shadow-[8px_8px_0px_0px_var(--theme-primary)] md:shadow-[12px_12px_0px_0px_var(--theme-primary)]">
            <div className="absolute top-0 right-0 p-3 md:p-4 text-[10px] md:text-xs font-bold text-[var(--theme-primary)]">
              STATUS: <span className="text-[var(--theme-accent)]">AWAITING_INPUT</span>
            </div>

            {manager?.name && (
              <div className="text-xs md:text-sm uppercase border-b-2 border-[var(--theme-primary)] pb-3 md:pb-4 mb-5 md:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 font-bold text-[var(--theme-text-muted)] pt-6 sm:pt-0">
                <span>[ AUTHENTICATED ]</span>
                <span className="text-[var(--theme-primary)]">ID // {manager.name.toUpperCase()}</span>
              </div>
            )}

            <div className={`space-y-4 md:space-y-6 ${hero.imageUrl ? 'grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6' : ''}`}>
              <div className="space-y-4 md:space-y-5">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-[var(--theme-text)] flex items-start gap-2 md:gap-3 leading-tight">
                  <span className="text-[var(--theme-primary)] shrink-0">&gt;</span>
                  <span>{hero.title}</span>
                </h1>

                {hero.subtitle && (
                  <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold leading-relaxed text-[var(--theme-text-on-primary)] bg-[var(--theme-primary)] p-2.5 md:p-3 inline-block">
                    {'// '}{hero.subtitle}
                  </h2>
                )}

                {hero.paragraph && (
                  <p className="text-[var(--theme-text)] font-sans text-sm md:text-base leading-relaxed border-s-4 ps-3 md:ps-4 py-2 border-[var(--theme-primary)] font-medium bg-[color-mix(in_srgb,var(--theme-secondary)_35%,transparent)]">
                    {hero.paragraph}
                  </p>
                )}

                {content.benefits.items.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 pt-2 md:pt-4">
                    {content.benefits.items.slice(0, 4).map((item, idx) => (
                      <div
                        key={idx}
                        className="border-2 border-[var(--theme-secondary)] p-2.5 md:p-3 text-[11px] md:text-xs font-bold text-[var(--theme-text-muted)] flex items-start gap-2 uppercase tracking-wide bg-[color-mix(in_srgb,var(--theme-secondary)_25%,transparent)] backdrop-blur-sm leading-snug"
                      >
                        <span className="text-[var(--theme-primary)] shrink-0">[{idx + 1}]</span>
                        <span>{item.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {hero.imageUrl && (
                <div className="border-4 border-[var(--theme-primary)] overflow-hidden aspect-video md:aspect-auto max-h-48 sm:max-h-56 md:max-h-none">
                  <img src={hero.imageUrl} alt={hero.title} className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div className="mt-6 md:mt-10">
              <button
                type="button"
                onClick={handleCta}
                className="w-full py-3.5 md:py-5 text-center font-black tracking-widest uppercase text-base md:text-lg border-4 border-[var(--theme-primary)] bg-[var(--theme-primary)] text-[var(--theme-text-on-primary)] hover:bg-transparent hover:text-[var(--theme-primary)] transition-colors duration-200"
              >
                {hero.ctaText}
              </button>
            </div>

            {campaign?.isSmartLink && (
              <div className="mt-5 md:mt-8 pt-5 md:pt-6 border-t-2 border-[var(--theme-primary)] border-dashed w-full">
                <ScarcityWidget campaign={campaign} />
              </div>
            )}
          </div>
        </div>

        <HeroFlowBridge />
      </section>

      <LandingSections content={content} onCtaClick={handleCta} campaign={campaign} variant="tactical" />
    </LandingFlow>
  );
}

export default TacticalLayout;
