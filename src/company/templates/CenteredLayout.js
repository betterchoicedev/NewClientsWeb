import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import ScarcityWidget from '../../components/ScarcityWidget';

function CenteredLayout({ config, manager, campaign, navigate, hash }) {
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
    '--theme-text-on-secondary': colors.textOnSecondary || '#FFFFFF',
  };

  const title = content.heroTitle?.[language] || 'BetterChoice Portal';
  const subtitle = content.heroSubtitle?.[language] || '';
  const paragraph = content.heroParagraph?.[language] || '';
  const ctaText = content.ctaText?.[language] || 'Get Started';
  const features = content.features?.[language] || [];

  return (
    <main style={themeStyles} className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 w-full min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 animate-fadeIn">
      <div className="w-full max-w-3xl mx-auto bg-[var(--theme-surface)] backdrop-blur-xl rounded-[2rem] p-8 md:p-14 shadow-2xl border border-[var(--theme-secondary)] relative overflow-hidden transition-all duration-300">
        
        <div className="flex justify-center mb-6">
          <span className="px-4 py-1.5 rounded-full bg-[var(--theme-secondary)] text-[var(--theme-accent)] text-xs font-bold tracking-widest uppercase border border-[var(--theme-primary)]/20">
            {language === 'hebrew' ? 'שלב 1 מתוך 3: הפעלה' : 'Step 1 of 3: Activation'}
          </span>
        </div>

        <div className="text-center">
          {manager?.name && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--theme-secondary)] border border-[var(--theme-primary)]/20 text-sm font-semibold text-[var(--theme-accent)] mb-6 tracking-wide">
              <span className="h-2 w-2 rounded-full bg-[var(--theme-primary)] animate-pulse" />
              <span>
                {language === 'hebrew' ? 'יועצת פעילה:' : 'Active consultant:'} <strong>{manager.name}</strong>
              </span>
            </div>
          )}

          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-[var(--theme-text)] leading-tight">
            {title}
          </h1>
          
          <p className="text-xl md:text-2xl font-bold mb-4 max-w-xl mx-auto leading-snug text-[var(--theme-accent)]">
            {subtitle}
          </p>

          {paragraph && (
            <p className="text-[var(--theme-text-muted)] text-base md:text-lg mb-8 max-w-xl mx-auto font-medium leading-relaxed">
              {paragraph}
            </p>
          )}
        </div>

        {features.length > 0 && (
          <div className="flex flex-col items-center gap-3 mb-10 max-w-md mx-auto">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 w-full bg-[var(--theme-secondary)]/50 px-4 py-3 rounded-xl border border-[var(--theme-secondary)]">
                <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-[var(--theme-primary)] text-[var(--theme-text-on-primary)] font-bold text-sm">
                  ✓
                </div>
                <span className="text-[var(--theme-text)] font-semibold text-sm md:text-base">{feature}</span>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 flex flex-col items-center">
          <button
            onClick={() => navigate(`/signup${hash}`)}
            className="w-full sm:w-4/5 px-10 py-5 rounded-2xl text-xl font-black transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0 shadow-xl shadow-[var(--theme-primary)]/10 bg-[var(--theme-primary)] text-[var(--theme-text-on-primary)] hover:opacity-90"
          >
            {ctaText}
          </button>
          
          <span className="mt-4 text-[var(--theme-text-muted)] text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
            🔒 {language === 'hebrew' ? 'חיבור מאובטח ומוצפן' : 'Secure & Encrypted Connection'}
          </span>
        </div>

        {(campaign?.isSmartLink || campaign?.slotsRemaining != null || campaign?.expiresAt) && (
          <div className="mt-10 border-t border-[var(--theme-secondary)] pt-8 w-full">
            <ScarcityWidget campaign={campaign} />
          </div>
        )}
      </div>
    </main>
  );
}

export default CenteredLayout;