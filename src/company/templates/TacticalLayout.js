import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import ScarcityWidget from '../../components/ScarcityWidget';

function TacticalLayout({ config, manager, campaign, navigate, hash }) {
  const { language } = useLanguage();
  const content = config?.content || {};
  const colors = config?.ui?.themeSettings?.colors || {};

  const themeStyles = {
    '--theme-surface': colors.surface || 'rgba(24, 20, 18, 0.85)',
    '--theme-primary': colors.primary || '#E29578',
    '--theme-secondary': colors.secondary || '#3E3026',
    '--theme-accent': colors.accent || '#FFDAB9',
    '--theme-text': colors.textMain || '#FFFDFB',
    '--theme-text-muted': colors.textMuted || '#CDBBAA',
    '--theme-text-on-primary': colors.textOnPrimary || '#FFFFFF',
  };

  const title = content.heroTitle?.[language] || 'Tactical Portal';
  const subtitle = content.heroSubtitle?.[language] || '';
  const paragraph = content.heroParagraph?.[language] || '';
  const ctaText = content.ctaText?.[language] || 'Execute Init';
  const features = content.features?.[language] || [];

  return (
    <main dir={language === 'hebrew' ? 'rtl' : 'ltr'} style={themeStyles} className="flex-1 flex items-center justify-center p-4 md:p-8 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 min-h-screen select-none font-mono">
      <div className="max-w-3xl w-full bg-[var(--theme-surface)] backdrop-blur-xl border-4 border-[var(--theme-primary)] p-8 md:p-12 relative transition-all duration-500 shadow-[12px_12px_0px_0px_var(--theme-primary)]">
        
        <div className="absolute top-0 end-0 p-4 text-xs font-bold text-[var(--theme-primary)]">
          STATUS: <span className="text-[var(--theme-accent)]">AWAITING_INPUT</span>
        </div>

        {manager?.name && (
          <div className="text-sm uppercase border-b-2 border-[var(--theme-primary)] pb-4 mb-8 flex justify-between items-center font-bold text-[var(--theme-text-muted)]">
            <span>[ AUTHENTICATED ]</span>
            <span className="text-[var(--theme-primary)]">
              ID // {manager.name.toUpperCase()}
            </span>
          </div>
        )}

        <div className="space-y-6">
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-[var(--theme-text)] flex items-center gap-3">
            <span className="text-[var(--theme-primary)]">&gt;</span> {title}
          </h1>

          <h2 className="text-base md:text-xl font-bold leading-relaxed text-stone-900 bg-[var(--theme-primary)] p-3 inline-block">
            {'// '}{subtitle}
          </h2>

          {paragraph && (
            <p className="text-[var(--theme-text)] font-sans text-base leading-relaxed border-s-4 ps-4 py-2 border-[var(--theme-primary)] font-medium bg-[var(--theme-secondary)]/50">
              {paragraph}
            </p>
          )}

          {features.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
              {features.map((feature, idx) => (
                <div key={idx} className="border-2 border-[var(--theme-secondary)] p-3 text-xs font-bold text-[var(--theme-text-muted)] flex items-start gap-2 uppercase tracking-wide bg-black/20">
                  <span className="text-[var(--theme-primary)]">[{idx + 1}]</span>
                  {feature}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-12">
          <button
            onClick={() => navigate(`/signup${hash}`)}
            className="w-full py-5 text-center font-black tracking-widest uppercase text-lg border-4 border-[var(--theme-primary)] bg-[var(--theme-primary)] text-[var(--theme-text-on-primary)] hover:bg-transparent hover:text-[var(--theme-primary)] transition-colors duration-200"
          >
            {ctaText}
          </button>
        </div>

        {(campaign?.isSmartLink || campaign?.slotsRemaining != null || campaign?.expiresAt) && (
          <div className="mt-8 pt-6 border-t-2 border-[var(--theme-primary)] border-dashed w-full">
            <ScarcityWidget campaign={campaign} />
          </div>
        )}
      </div>
    </main>
  );
}

export default TacticalLayout;