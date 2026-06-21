import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import ScarcityWidget from '../../components/ScarcityWidget';

function SplitLayout({ config, manager, campaign, navigate, hash }) {
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

  const title = content.heroTitle?.[language] || 'Welcome Member';
  const subtitle = content.heroSubtitle?.[language] || '';
  const paragraph = content.heroParagraph?.[language] || '';
  const ctaText = content.ctaText?.[language] || 'Claim Access';
  const features = content.features?.[language] || [];

  return (
    <main dir={language === 'hebrew' ? 'rtl' : 'ltr'} style={themeStyles} className="flex-1 w-full min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex items-center p-4 md:p-8 animate-fadeIn">
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-0 rounded-[2rem] shadow-2xl overflow-hidden bg-[var(--theme-surface)] backdrop-blur-xl border border-[var(--theme-secondary)]">
        
        {/* Left Column: Presentation */}
        <div className="lg:col-span-7 p-8 md:p-14 flex flex-col justify-center space-y-8">
          {manager?.name && (
            <div className="self-start px-4 py-2 rounded-full bg-[var(--theme-secondary)] border border-[var(--theme-primary)]/10 text-sm font-bold text-[var(--theme-text-on-secondary)]">
              ✨ {language === 'hebrew' ? 'ליווי מקצועי ע"י:' : 'Professional Guide:'} <span className="text-[var(--theme-accent)] mx-1">{manager.name}</span>
            </div>
          )}

          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[var(--theme-text)] leading-tight">
              {title}
            </h1>
            <p className="text-xl md:text-2xl font-bold leading-relaxed text-[var(--theme-primary)]">
              {subtitle}
            </p>
            {paragraph && (
              <p className="text-[var(--theme-text-muted)] text-base font-medium leading-relaxed max-w-xl">
                {paragraph}
              </p>
            )}
          </div>

          {features.length > 0 && (
            <ul className="space-y-4 pt-2">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-3 text-[var(--theme-text)] font-semibold">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--theme-primary)] flex items-center justify-center text-[var(--theme-text-on-primary)] text-sm font-bold">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Action Panel — border-s flips to the correct side in RTL */}
        <div className="lg:col-span-5 bg-black/20 p-8 md:p-12 flex flex-col justify-center relative border-s border-[var(--theme-secondary)]">
          
          <div className="bg-[var(--theme-secondary)]/40 rounded-2xl p-6 shadow-sm border border-[var(--theme-secondary)] text-center mb-8">
            <h3 className="font-black text-[var(--theme-text)] text-sm uppercase tracking-widest mb-2">
              {language === 'hebrew' ? 'הפעלת הרשמה מאובטחת' : 'Secure Account Activation'}
            </h3>
            <p className="text-xs text-[var(--theme-text-muted)] font-medium mb-6">
              {language === 'hebrew' ? 'הפרטים שלך נשמרים בסודיות מוחלטת' : 'Your data is strictly confidential.'}
            </p>
            
            <button
              onClick={() => navigate(`/signup${hash}`)}
              className="w-full py-5 rounded-xl text-center text-lg shadow-xl shadow-[var(--theme-primary)]/10 transform active:scale-[0.98] hover:-translate-y-1 transition-all duration-300 bg-[var(--theme-primary)] text-[var(--theme-text-on-primary)] font-black"
            >
              {ctaText}
            </button>
          </div>

          <div className="flex flex-col items-center justify-center text-center gap-2">
             <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--theme-surface)] bg-[var(--theme-secondary)] flex items-center justify-center text-[8px] text-[var(--theme-text-on-secondary)] font-bold">JD</div>
                <div className="w-8 h-8 rounded-full border-2 border-[var(--theme-surface)] bg-[var(--theme-primary)] flex items-center justify-center text-[8px] text-[var(--theme-text-on-primary)] font-bold">AM</div>
                <div className="w-8 h-8 rounded-full border-2 border-[var(--theme-surface)] bg-[var(--theme-accent)] flex items-center justify-center text-[8px] text-stone-900 font-bold">SL</div>
             </div>
             <p className="text-xs font-bold text-[var(--theme-text-muted)]">
                {language === 'hebrew' ? 'הצטרפו לקהילת הלקוחות המצליחים שלנו.' : 'Join a growing community of successful clients.'}
             </p>
          </div>

          {(campaign?.isSmartLink || campaign?.slotsRemaining != null || campaign?.expiresAt) && (
            <div className="mt-8 border-t border-[var(--theme-secondary)] pt-6 w-full">
              <ScarcityWidget campaign={campaign} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default SplitLayout;
