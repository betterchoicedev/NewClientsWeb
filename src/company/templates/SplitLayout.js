import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import ScarcityWidget from '../../components/ScarcityWidget';

function SplitLayout({ config, manager, campaign, navigate, hash }) {
  const { language } = useLanguage();

  const content = config?.content || {};
  const themeSettings = config?.ui?.themeSettings || {};

  const title = content.heroTitle?.[language] || 'Welcome Member';
  const subtitle = content.heroSubtitle?.[language] || '';
  const paragraph = content.heroParagraph?.[language] || '';
  const ctaText = content.ctaText?.[language] || 'Claim Access';

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8 md:py-14 flex items-center animate-fadeIn">
      {/* 🛠️ The custom gradient from the config is explicitly contained inside this central panel layout card */}
      <div className={`w-full grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 rounded-3xl p-8 md:p-12 border shadow-2xl transition-all duration-300 ${themeSettings.innerBorder || 'border-white/10'} bg-gradient-to-br ${themeSettings.innerBgGradient || 'from-zinc-950/80 to-zinc-900/90'}`}>
        
        {/* Left Column: Presentation Content Stream */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
          {manager?.name && (
            <div className="self-start px-3 py-1.5 rounded-full bg-black/30 border border-white/5 text-xs font-semibold text-zinc-300 tracking-wide">
              👤 {language === 'hebrew' ? 'מנהלת קהילה זמינה עבורך:' : 'Available Community Leader:'} <strong className="text-white font-bold ml-1">{manager.name}</strong>
            </div>
          )}

          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight drop-shadow-md">
            {title}
          </h1>

          {/* Injects the dynamic text color setting matching the client design config (e.g., text-rose-200) */}
          <p className={`text-lg md:text-2xl font-semibold leading-relaxed drop-shadow-sm ${themeSettings.accentTextColor || 'text-zinc-200'}`}>
            {subtitle}
          </p>

          {paragraph && (
            <p className="text-zinc-300/90 text-sm md:text-base font-normal leading-relaxed max-w-xl">
              {paragraph}
            </p>
          )}
        </div>

        {/* Right Column: Transaction Action Panel Card Container */}
        <div className="lg:col-span-5 bg-white/[0.03] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col justify-center shadow-2xl relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          
          <h3 className="text-center font-bold text-zinc-400 text-xs tracking-widest uppercase mb-6">
            {language === 'hebrew' ? 'הפעלת הרשמה מאובטחת' : 'Secure Account Activation'}
          </h3>
          
          {/* 🛠️ Dynamic CTA configurations matching custom inputs */}
          <button
            onClick={() => navigate(`/signup${hash}`)}
            className={`w-full py-4 rounded-xl text-center shadow-md transform active:scale-[0.99] hover:scale-[1.01] transition-all duration-300 ${themeSettings.ctaButtonClass || 'bg-white text-black font-bold'}`}
          >
            {ctaText}
          </button>

          {campaign?.isSmartLink && (
            <div className="mt-8 border-t border-white/5 pt-6 w-full">
              <ScarcityWidget campaign={campaign} themeSettings={themeSettings} />
            </div>
          )}
        </div>

      </div>
    </main>
  );
}

export default SplitLayout;