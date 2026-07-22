import React, { useMemo } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { formatMoneyFromCents } from '../utils/commercePricing';

export default function CartSummary({ products = [], totals, appliedPromo, isHe, className = '' }) {
  const { isDarkMode } = useTheme();
  const lines = useMemo(() => products.map((p) => ({
    id: p.configId || p.id,
    name: isHe ? (p.nameHebrew || p.name) : p.name,
    cents: p.prices?.[0]?.amountUSD ?? p.prices?.[0]?.amount ?? 0,
    interval: p.prices?.[0]?.interval || p.interval,
  })), [products, isHe]);

  if (!lines.length) return null;

  return (
    <aside
      className={`rounded-2xl border p-4 space-y-3 ${
        isDarkMode ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200/80 bg-white/60'
      } ${className}`}
      aria-label={isHe ? 'סיכום הזמנה' : 'Order summary'}
    >
      <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
        {isHe ? 'סיכום' : 'Summary'}
      </h3>
      <ul className="space-y-2">
        {lines.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-3 text-sm">
            <span className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{line.name}</span>
            <span className={`font-semibold shrink-0 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {formatMoneyFromCents(line.cents)}
              {line.interval ? (
                <span className={`text-xs font-normal ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  /{line.interval}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <div className={`border-t pt-3 space-y-1.5 text-sm ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
        <div className="flex justify-between">
          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{isHe ? 'סכום ביניים' : 'Subtotal'}</span>
          <span>{formatMoneyFromCents(totals.subtotalCents)}</span>
        </div>
        {appliedPromo?.valid && totals.discountCents > 0 ? (
          <div className="flex justify-between text-emerald-500">
            <span>
              {isHe ? 'הנחה' : 'Discount'}
              {appliedPromo.code ? ` (${appliedPromo.code})` : ''}
            </span>
            <span>-{formatMoneyFromCents(totals.discountCents)}</span>
          </div>
        ) : null}
        <div className={`flex justify-between font-bold text-base pt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          <span>{isHe ? 'סה״כ' : 'Total'}</span>
          <span>{formatMoneyFromCents(totals.totalCents)}</span>
        </div>
      </div>
    </aside>
  );
}
