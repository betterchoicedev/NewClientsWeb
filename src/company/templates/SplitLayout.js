import React from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import ScarcityWidget from '../../components/ScarcityWidget';
import { getLocalizedLandingContent } from './landingContent';
import LandingSections from './sections/LandingSections';
import LandingFlow from './sections/LandingFlow';
import HeroFlowBridge, { HERO_CONTENT_CLASS, HERO_VIEWPORT_CLASS } from './sections/HeroFlowBridge';
import { glassCardClass, glassPanelClass, primaryButtonClass } from './sections/glassStyles';

function SplitLayout({ config, manager, campaign, navigate, hash }) {
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
            className={`${glassCardClass('max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-0')} border-[color-mix(in_srgb,var(--theme-secondary)_35%,transparent)]`}
          >
            <div className="lg:col-span-7 p-5 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center space-y-4 md:space-y-6">
              {manager?.name && (
                <div className="self-start px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-[color-mix(in_srgb,var(--theme-secondary)_40%,transparent)] border border-[var(--theme-glass-border)] text-xs md:text-sm font-bold text-[var(--theme-text-on-secondary)] backdrop-blur-sm">
                  ✨ {language === 'hebrew' ? 'ליווי מקצועי ע"י:' : 'Professional Guide:'}{' '}
                  <span className="text-[var(--theme-accent)] ml-1 mr-1">{manager.name}</span>
                </div>
              )}

              <div className="space-y-2 md:space-y-3">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight text-[var(--theme-text)] leading-tight">
                  {hero.title}
                </h1>
                {hero.subtitle && (
                  <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold leading-snug text-[var(--theme-primary)]">
                    {hero.subtitle}
                  </p>
                )}
                {hero.paragraph && (
                  <p className="text-sm md:text-base text-[var(--theme-text-muted)] font-medium leading-relaxed max-w-xl">
                    {hero.paragraph}
                  </p>
                )}
              </div>

              {content.benefits.items.length > 0 && (
                <ul className="grid grid-cols-1 gap-2 pt-1 md:pt-2">
                  {content.benefits.items.slice(0, 3).map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-sm md:text-base text-[var(--theme-text)] font-semibold leading-snug"
                    >
                      <span className="flex-shrink-0 w-5 h-5 md:w-6 md:h-6 mt-0.5 rounded-full bg-[var(--theme-primary)] flex items-center justify-center text-[var(--theme-text-on-primary)] text-xs font-bold">
                        ✓
                      </span>
                      <span>{item.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="lg:col-span-5 p-5 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center relative border-t lg:border-t-0 lg:border-s lg:border-[var(--theme-glass-border)] bg-[color-mix(in_srgb,var(--theme-secondary)_15%,transparent)] backdrop-blur-md">
              {hero.imageUrl ? (
                <div className={`${glassPanelClass('mb-5 md:mb-6 overflow-hidden aspect-video max-h-48 sm:max-h-none')} p-0`}>
                  <img src={hero.imageUrl} alt={hero.title} className="w-full h-full object-cover" />
                </div>
              ) : null}

              <div className="bg-[color-mix(in_srgb,var(--theme-secondary)_30%,transparent)] rounded-2xl p-4 md:p-6 shadow-sm border border-[var(--theme-glass-border)] text-center mb-5 md:mb-6 backdrop-blur-sm">
                <h3 className="font-black text-[var(--theme-text)] text-xs md:text-sm uppercase tracking-widest mb-2">
                  {language === 'hebrew' ? 'הפעלת הרשמה מאובטחת' : 'Secure Account Activation'}
                </h3>
                <p className="text-xs text-[var(--theme-text-muted)] font-medium mb-4 md:mb-6">
                  {content.finalCta.trustNote || (language === 'hebrew' ? 'הפרטים שלך נשמרים בסודיות מוחלטת' : 'Your data is strictly confidential.')}
                </p>

                <button type="button" onClick={handleCta} className={primaryButtonClass('w-full text-base md:text-lg py-3 md:py-4')}>
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {hero.ctaText}
                    <ArrowRight className="w-5 h-5" />
                  </span>
                  <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                </button>
              </div>

              <div className="hidden md:flex flex-col items-center justify-center text-center gap-2">
                <div className="flex -space-x-2 rtl:space-x-reverse">
                  {content.socialProof.testimonials.slice(0, 3).map((t, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-[var(--theme-glass-border)] bg-[color-mix(in_srgb,var(--theme-primary)_70%,transparent)] flex items-center justify-center text-[8px] text-[var(--theme-text-on-primary)] font-bold"
                    >
                      {t.initials}
                    </div>
                  ))}
                </div>
                <p className="text-xs font-bold text-[var(--theme-text-muted)]">
                  {content.socialProof.sectionSubtitle || content.socialProof.sectionTitle}
                </p>
              </div>

              <span className="mt-3 md:mt-4 text-[var(--theme-text-muted)] text-[10px] md:text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                {language === 'hebrew' ? 'חיבור מאובטח' : 'Secure connection'}
              </span>

              {campaign?.isSmartLink && (
                <div className="mt-5 md:mt-6 border-t border-[var(--theme-glass-border)] pt-5 md:pt-6 w-full">
                  <ScarcityWidget campaign={campaign} />
                </div>
              )}
            </div>
          </div>
        </div>

        <HeroFlowBridge />
      </section>

      <LandingSections content={content} onCtaClick={handleCta} campaign={campaign} variant="split" />
    </LandingFlow>
  );
}

export default SplitLayout;
