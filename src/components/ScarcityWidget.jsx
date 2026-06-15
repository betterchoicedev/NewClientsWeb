import React from 'react';
import { useLanguage } from '../context/LanguageContext'; 

export default function ScarcityWidget({ campaign, themeSettings }) {
  const { language } = useLanguage();

  if (!campaign || (campaign.slotsRemaining == null && !campaign.expiresAt)) {
    return null;
  }

  const getRemainingTimeText = (expiryTimestamp) => {
    if (!expiryTimestamp) return null;
    const differenceInMs = new Date(expiryTimestamp) - new Date();
    if (differenceInMs <= 0) return language === 'hebrew' ? 'הסתיים' : 'Expired';
    
    const totalHours = Math.floor(differenceInMs / (1000 * 60 * 60));
    const totalDays = Math.floor(totalHours / 24);

    if (totalDays > 30) {
      const months = Math.floor(totalDays / 30);
      return language === 'hebrew' ? `נותרו כ-${months} חודשים` : `~${months} months left`;
    }
    if (totalDays > 0) {
      return language === 'hebrew' ? `נותרו עוד ${totalDays} ימים` : `${totalDays} days left`;
    }
    if (totalHours > 0) {
      return language === 'hebrew' ? `נותרו עוד ${totalHours} שעות` : `${totalHours} hours left`;
    }
    return language === 'hebrew' ? 'דקות אחרונות!' : 'Mins left!';
  };

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-center gap-6 p-4 rounded-xl bg-black/20 backdrop-blur-sm border ${themeSettings?.innerBorder || 'border-zinc-800'}`}>
      
      {campaign.slotsRemaining !== null && (
        <div className="flex items-center gap-3">
          <span className="text-xl animate-pulse drop-shadow-lg">🔥</span>
          <div className={language === 'hebrew' ? 'text-right' : 'text-left'}>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
              {language === 'hebrew' ? 'מקומות נותרו' : 'Slots Available'}
            </p>
            <p className={`text-sm md:text-base font-bold ${themeSettings?.accentTextColor || 'text-white'}`}>
              {language === 'hebrew' 
                ? `נותרו רק עוד ${campaign.slotsRemaining} מקומות`
                : `Only ${campaign.slotsRemaining} slots left`}
            </p>
          </div>
        </div>
      )}

      {campaign.slotsRemaining !== null && campaign.expiresAt && (
        <div className={`hidden sm:block w-px h-8 border-l ${themeSettings?.innerBorder || 'border-zinc-800'}`}></div>
      )}

      {campaign.expiresAt && (
        <div className="flex items-center gap-3">
          <span className="text-xl drop-shadow-lg">⏳</span>
          <div className={language === 'hebrew' ? 'text-right' : 'text-left'}>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
              {language === 'hebrew' ? 'זמן מוגבל' : 'Limited Offer'}
            </p>
            <p className="text-sm md:text-base font-bold text-zinc-300">
              {getRemainingTimeText(campaign.expiresAt)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
