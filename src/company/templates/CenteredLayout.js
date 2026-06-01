import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import ScarcityWidget from '../../components/ScarcityWidget';

function CenteredLayout({ config, manager, campaign, navigate, hash }) {
  const { language } = useLanguage();

  const content = config?.content || {};
  const themeSettings = config?.ui?.themeSettings || {};

  const title = content.heroTitle?.[language] || 'BetterChoice Portal';
  const subtitle = content.heroSubtitle?.[language] || '';
  const paragraph = content.heroParagraph?.[language] || '';
  const ctaText = content.ctaText?.[language] || 'Get Started';

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 text-center max-w-4xl mx-auto w-full animate-fadeIn">
      {/* 🛠️ Dynamic Card Panel utilizing inner container background parameters */}
      <div className={`w-full backdrop-blur-xl rounded-3xl p-8 md:p-14 border shadow-2xl relative overflow-hidden transition-all duration-300 ${themeSettings.innerBorder || 'border-zinc-800'} bg-gradient-to-b ${themeSettings.innerBgGradient || 'from-zinc-950/80 via-zinc-900/90 to-zinc-950/80'}`}>
        
        {/* Subtle decorative internal glow matrix */}
        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        
        {/* Manager Badge Info */}
        {manager?.name && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/5 text-xs font-medium text-zinc-400 mb-8 tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {language === 'hebrew' ? 'יועץ פעיל המוקצה עבורך:' : 'Active consultant assigned:'} <strong className="text-white">{manager.name}</strong>
            </span>
          </div>
        )}

        {/* Hero Headers */}
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-400 leading-tight">
          {title}
        </h1>
        
        {/* Injected Accent Text Utility Class Styles */}
        <p className={`text-xl md:text-3xl font-bold mb-6 max-w-2xl mx-auto leading-snug drop-shadow-sm ${themeSettings.accentTextColor || 'text-emerald-400'}`}>
          {subtitle}
        </p>

        {paragraph && (
          <p className="text-zinc-400 text-base md:text-lg mb-10 max-w-xl mx-auto font-medium leading-relaxed opacity-90">
            {paragraph}
          </p>
        )}

        {/* Action Button Element matching client-specific inputs */}
        <div className="pt-2">
          <button
            onClick={() => navigate(`/signup${hash}`)}
            className={`w-full sm:w-auto px-10 py-4.5 rounded-xl text-lg font-bold transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl ${themeSettings.ctaButtonClass || 'bg-emerald-500 text-white'}`}
          >
            {ctaText}
          </button>
        </div>

        {/* Scarcity / Urgency Metrics Pipeline */}
        {campaign?.isSmartLink && (
          <div className="mt-10 border-t border-white/5 pt-8 w-full">
            <ScarcityWidget campaign={campaign} themeSettings={themeSettings} />
          </div>
        )}
      </div>
    </main>
  );
}

export default CenteredLayout;