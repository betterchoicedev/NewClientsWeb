import React from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import ScarcityWidget from '../../components/ScarcityWidget';
import { getLocalizedLandingContent } from './landingContent';
import LandingSections from './sections/LandingSections';
import LandingFlow from './sections/LandingFlow';
import HeroFlowBridge, { HERO_CONTENT_CLASS, HERO_VIEWPORT_CLASS } from './sections/HeroFlowBridge';
import { glassCardClass, primaryButtonClass } from './sections/glassStyles';

function CenteredLayout({ config, manager, campaign, navigate, hash }) {
  const { language } = useLanguage();
  const colors = config?.ui?.themeSettings?.colors || {};
  const content = getLocalizedLandingContent(config?.content, language);
  const { hero } = content;

  const handleCta = () => navigate(`/signup${hash}`);

  return (
    <LandingFlow colors={colors}>
      <section className={HERO_VIEWPORT_CLASS}>
        <div className={HERO_CONTENT_CLASS}>
          <div
            className={`${glassCardClass('w-full max-w-4xl mx-auto p-5 sm:p-8 md:p-10 lg:p-12 relative z-10')} border-[color-mix(in_srgb,var(--theme-secondary)_35%,transparent)]`}
          >
            <div className="flex justify-center mb-4 md:mb-6">
              <span className="px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-[color-mix(in_srgb,var(--theme-secondary)_45%,transparent)] text-[var(--theme-accent)] text-[10px] md:text-xs font-bold tracking-widest uppercase border border-[var(--theme-glass-border)] backdrop-blur-sm">
                {hero.badge}
              </span>
            </div>

            <div className={`${hero.imageUrl ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:gap-10 items-center' : ''}`}>
              <div className="text-center lg:text-start">
                {manager?.name && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-[color-mix(in_srgb,var(--theme-secondary)_40%,transparent)] border border-[var(--theme-glass-border)] text-xs md:text-sm font-semibold text-[var(--theme-accent)] mb-4 md:mb-6 tracking-wide backdrop-blur-sm">
                    <span className="h-2 w-2 rounded-full bg-[var(--theme-primary)] animate-pulse" />
                    <span>
                      {language === 'hebrew' ? 'יועצת פעילה:' : 'Active consultant:'}{' '}
                      <strong className="text-[var(--theme-text)]">{manager.name}</strong>
                    </span>
                  </div>
                )}

                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight mb-3 md:mb-4 text-[var(--theme-text)] leading-tight">
                  {hero.title}
                </h1>

                {hero.subtitle && (
                  <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold mb-3 md:mb-4 max-w-xl mx-auto lg:mx-0 leading-snug text-[var(--theme-accent)]">
                    {hero.subtitle}
                  </p>
                )}

                {hero.paragraph && (
                  <p className="text-sm md:text-base lg:text-lg text-[var(--theme-text-muted)] mb-6 md:mb-8 max-w-xl mx-auto lg:mx-0 font-medium leading-relaxed">
                    {hero.paragraph}
                  </p>
                )}

                <div className="pt-1 md:pt-2 flex flex-col items-center lg:items-start">
                  <button type="button" onClick={handleCta} className={primaryButtonClass('w-full sm:w-auto sm:min-w-[240px] md:min-w-[280px] text-base md:text-lg py-3 md:py-4')}>
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {hero.ctaText}
                      <ArrowRight className="w-5 h-5" />
                    </span>
                    <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                  </button>

                  <span className="mt-3 md:mt-4 text-[var(--theme-text-muted)] text-[10px] md:text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    {content.finalCta.trustNote || (language === 'hebrew' ? 'חיבור מאובטח ומוצפן' : 'Secure & Encrypted Connection')}
                  </span>
                </div>
              </div>

              {hero.imageUrl && (
                <div className="relative rounded-2xl overflow-hidden border border-[var(--theme-glass-border)] shadow-2xl shadow-[var(--theme-glow-primary)]/15 aspect-[16/10] sm:aspect-[4/3] lg:aspect-auto lg:min-h-[280px] max-h-56 sm:max-h-none mx-auto w-full">
                  <img src={hero.imageUrl} alt={hero.title} className="w-full h-full object-cover" />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(135deg, color-mix(in srgb, var(--theme-primary) 15%, transparent), transparent 60%)',
                    }}
                  />
                </div>
              )}
            </div>

            {campaign?.isSmartLink && (
              <div className="mt-6 md:mt-10 border-t border-[var(--theme-glass-border)] pt-6 md:pt-8 w-full">
                <ScarcityWidget campaign={campaign} />
              </div>
            )}
          </div>
        </div>

        <HeroFlowBridge />
      </section>

      <LandingSections content={content} onCtaClick={handleCta} campaign={campaign} variant="default" />
    </LandingFlow>
  );
}

export default CenteredLayout;
