import React from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { formatMoneyFromCents, getProductPriceCents } from '../utils/commercePricing';

export default function ProductCard({ product, selected, onSelect, isHe }) {
  const { isDarkMode } = useTheme();
  const priceCents = getProductPriceCents(product);
  const interval = product.prices?.[0]?.interval || product.interval;
  const name = isHe ? (product.nameHebrew || product.name) : product.name;
  const description = isHe ? (product.descriptionHebrew || product.description) : product.description;
  const productId = product.configId || product.id;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(productId)}
      className={`w-full text-left rounded-2xl border p-5 min-h-[5.5rem] transition-all active:scale-[0.99] ${
        selected
          ? isDarkMode
            ? 'border-emerald-400/50 bg-emerald-500/10 ring-2 ring-emerald-500/30'
            : 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20'
          : isDarkMode
            ? 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
            : 'border-slate-200 bg-white/70 hover:bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`font-bold text-base ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{name}</p>
          {description ? (
            <p className={`text-sm mt-1 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {description}
            </p>
          ) : null}
          <p className={`mt-3 text-lg font-extrabold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
            {formatMoneyFromCents(priceCents)}
            {interval ? (
              <span className={`text-xs font-semibold ml-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                /{interval}
              </span>
            ) : null}
          </p>
        </div>
        <div
          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
            selected
              ? 'border-emerald-500'
              : isDarkMode
                ? 'border-white/20'
                : 'border-slate-300'
          }`}
        >
          {selected ? <span className="w-3.5 h-3.5 rounded-full bg-emerald-500" aria-hidden /> : null}
        </div>
      </div>
    </button>
  );
}
