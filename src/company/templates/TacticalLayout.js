import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import ScarcityWidget from '../../components/ScarcityWidget';

function TacticalLayout({ config, manager, campaign, navigate, hash }) {
  const { language } = useLanguage();

  const content = config?.content || {};
  const themeSettings = config?.ui?.themeSettings || {};

  const title = content.heroTitle?.[language] || 'Tactical Portal';
  const subtitle = content.heroSubtitle?.[language] || '';
  const paragraph = content.heroParagraph?.[language] || '';
  const ctaText = content.ctaText?.[language] || 'Execute Init';

  return (
    <main className="flex-1 flex items-center justify-center p-4 md:p-8 animate-fadeIn select-none">
      {/* 🛠️ Brutalist Panel leveraging exact inner background, border hex configurations, and typography rules */}
      <div className={`max-w-3xl w-full rounded-none border-2 p-8 md:p-12 text-left relative overflow-hidden transition-all duration-500 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.8)] ${themeSettings.innerBorder || 'border-zinc-700'} bg-gradient-to-r ${themeSettings.innerBgGradient || 'from-[#0d0d0d] via-[#141414] to-[#0d0d0d]'}`}>
        
        {/* Tactical Ambient Layout Targets */}
        <div className="absolute top-0 right-0 p-3 text-[9px] text-zinc-600 tracking-widest font-mono opacity-60">
          SYS.LOC // 0x48FA_LN
        </div>
        <div className="absolute bottom-0 right-0 p-3 text-[8px] text-zinc-700 font-mono tracking-tighter opacity-40">
          [CONNECTED_NODES_ACTIVE]
        </div>

        {/* Dynamic Authenticated segment tracking client labels */}
        {manager?.name && (
          <div className={`text-xs uppercase border-b pb-4 mb-8 flex justify-between items-center font-mono tracking-wider ${themeSettings.innerBorder || 'border-zinc-800'} text-zinc-500`}>
            <span>[ AUTHENTICATED ACCESS ROUTE ]</span>
            <span className={`font-black tracking-wide ${themeSettings.accentTextColor || 'text-amber-400'}`}>
              ID // {manager.name.toUpperCase()}
            </span>
          </div>
        )}

        {/* Primary Data Stream Texts */}
        <div className="space-y-6">
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white font-mono flex items-center gap-2">
            <span className="text-zinc-600 font-normal">&gt;</span> {title}
          </h1>

          {/* Injected Typography Font Weights & Font Styles */}
          <h2 className={`text-base md:text-xl font-bold leading-relaxed uppercase ${themeSettings.accentTextColor || 'text-zinc-300'}`}>
            // {subtitle}
          </h2>

          {paragraph && (
            <p className="text-zinc-400 font-sans text-sm md:text-base leading-relaxed border-l-2 pl-4 py-1.5 border-zinc-800">
              {paragraph}
            </p>
          )}
        </div>

        {/* Action Button Container Block */}
        <div className="mt-10 pt-8 border-t border-zinc-900/80">
          <button
            onClick={() => navigate(`/signup${hash}`)}
            className={`w-full py-4.5 rounded-none text-center font-black tracking-widest cursor-pointer text-sm md:text-base ${themeSettings.ctaButtonClass || 'border border-white text-white uppercase'}`}
          >
            {ctaText}
          </button>
        </div>

        {/* Scarcity Widget integration layer */}
        {campaign?.isSmartLink && (
          <div className="mt-8 font-sans w-full">
            <ScarcityWidget campaign={campaign} themeSettings={themeSettings} />
          </div>
        )}
      </div>
    </main>
  );
}

export default TacticalLayout;