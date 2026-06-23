import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function ScarcityWidget({ campaign }) {
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
    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-4 rounded-xl bg-black/20 backdrop-blur-sm border border-[var(--theme-secondary)]">
      {campaign.slotsRemaining !== null && (
        <div className="flex items-center gap-3">
          <span className="text-xl animate-pulse drop-shadow-lg">🔥</span>
          <div className={language === 'hebrew' ? 'text-right' : 'text-left'}>
            <p className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-widest font-bold">
              {language === 'hebrew' ? 'מקומות נותרו' : 'Slots Available'}
            </p>
            <p className="text-sm md:text-base font-bold text-[var(--theme-accent)]">
              {language === 'hebrew'
                ? `נותרו רק עוד ${campaign.slotsRemaining} מקומות`
                : `Only ${campaign.slotsRemaining} slots left`}
            </p>
          </div>
        </div>
      )}

      {campaign.slotsRemaining !== null && campaign.expiresAt && (
        <div className="hidden sm:block w-px h-8 bg-[var(--theme-secondary)]" />
      )}

      {campaign.expiresAt && (
        <div className="flex items-center gap-3">
          <span className="text-xl drop-shadow-lg">⏳</span>
          <div className={language === 'hebrew' ? 'text-right' : 'text-left'}>
            <p className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-widest font-bold">
              {language === 'hebrew' ? 'זמן מוגבל' : 'Limited Offer'}
            </p>
            <p className="text-sm md:text-base font-bold text-[var(--theme-text)]">
              {getRemainingTimeText(campaign.expiresAt)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
