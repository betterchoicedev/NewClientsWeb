import React from 'react';
import { useLanguage } from '../context/LanguageContext';

/**
 * Self-contained scarcity widget.
 * Renders a slots-remaining + time-remaining row.
 *
 * Props:
 *   campaign     – { slotsRemaining, expiresAt, isMock? }
 *   rowClassName – override className for the flex row
 */
export default function ScarcityWidget({ campaign, rowClassName }) {
  const { language } = useLanguage();

  if (!campaign) return null;

  const slotsRemaining = campaign.slotsRemaining ?? null;
  const expiresAt      = campaign.expiresAt
    ?? (campaign.isMock ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() : null);

  if (slotsRemaining == null && !expiresAt) return null;

  function getRemainingTimeText(ts) {
    if (!ts) return null;
    const ms = new Date(ts) - new Date();
    if (ms <= 0) return language === 'hebrew' ? 'הסתיים' : 'Expired';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days  = Math.floor(hours / 24);
    if (days > 30)  return language === 'hebrew' ? `כ-${Math.floor(days / 30)} חודשים` : `~${Math.floor(days / 30)} months left`;
    if (days  > 0)  return language === 'hebrew' ? `נותרו עוד ${days} ימים`            : `${days} days left`;
    if (hours > 0)  return language === 'hebrew' ? `נותרו עוד ${hours} שעות`           : `${hours} hours left`;
    return language === 'hebrew' ? 'דקות אחרונות!' : 'Mins left!';
  }

  const defaultRowClass =
    'flex flex-col sm:flex-row items-center justify-center gap-6 p-4 rounded-xl bg-black/20 backdrop-blur-sm border border-[var(--theme-secondary)]/50';

  return (
    <div className={rowClassName ?? defaultRowClass}>
      {slotsRemaining != null && (
          <div className="flex items-center gap-3">
            <span className="text-xl animate-pulse drop-shadow-[0_0_8px_var(--theme-primary)]">🔥</span>
            <div className="text-start">
              <p className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-widest font-bold">
                {language === 'hebrew' ? 'מקומות נותרו' : 'Slots Available'}
              </p>
              <p className="text-sm md:text-base font-black text-[var(--theme-primary)]">
                {language === 'hebrew'
                  ? `נותרו רק עוד ${slotsRemaining} מקומות`
                  : `Only ${slotsRemaining} slots left`}
              </p>
            </div>
          </div>
        )}

        {slotsRemaining != null && expiresAt && (
          <div className="hidden sm:block w-px h-8 border-s border-[var(--theme-secondary)]" />
        )}

        {expiresAt && (
          <div className="flex items-center gap-3">
            <span className="text-xl drop-shadow-lg">⏳</span>
            <div className="text-start">
              <p className="text-[10px] text-[var(--theme-text-muted)] uppercase tracking-widest font-bold">
                {language === 'hebrew' ? 'זמן מוגבל' : 'Limited Offer'}
              </p>
              <p className="text-sm md:text-base font-bold text-[var(--theme-text)]">
                {getRemainingTimeText(expiresAt)}
              </p>
            </div>
          </div>
        )}
    </div>
  );
}
