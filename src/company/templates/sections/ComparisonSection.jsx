import React from 'react';
import { Check, X } from 'lucide-react';
import { glassCardClass, sectionShellClass, sectionSubtitleClass, sectionTitleClass } from './glassStyles';

function CellValue({ value }) {
  if (value === true) {
    return <Check className="w-5 h-5 mx-auto text-[var(--theme-primary)]" />;
  }
  if (value === false) {
    return <X className="w-5 h-5 mx-auto text-[color-mix(in_srgb,var(--theme-text-muted)_70%,transparent)]" />;
  }
  return <span className="text-xs font-semibold text-[var(--theme-text-muted)]">{value}</span>;
}

export default function ComparisonSection({ content, variant = 'default' }) {
  const { sectionTitle, sectionSubtitle, ourLabel, theirLabel, rows } = content.comparison;

  if (!rows?.length) return null;

  const isTactical = variant === 'tactical';

  return (
    <div className={sectionShellClass()}>
      <div className="text-center mb-10 md:mb-12">
        <h2 className={`${sectionTitleClass()} ${isTactical ? 'font-mono uppercase' : ''}`}>
          {isTactical ? `// ${sectionTitle}` : sectionTitle}
        </h2>
        {sectionSubtitle && (
          <p className={`${sectionSubtitleClass()} mx-auto`}>{sectionSubtitle}</p>
        )}
      </div>

      <div
        className={`${glassCardClass('overflow-hidden')} ${
          isTactical ? 'rounded-none border-4 border-[var(--theme-primary)]' : ''
        }`}
      >
        <div className="grid grid-cols-3 gap-0 border-b border-[var(--theme-glass-border)] bg-[color-mix(in_srgb,var(--theme-secondary)_20%,transparent)]">
          <div className="p-4 md:p-5" />
          <div className="p-4 md:p-5 text-center font-black text-sm md:text-base text-[var(--theme-primary)]">
            {ourLabel}
          </div>
          <div className="p-4 md:p-5 text-center font-bold text-sm md:text-base text-[var(--theme-text-muted)]">
            {theirLabel}
          </div>
        </div>

        {rows.map((row, idx) => (
          <div
            key={idx}
            className={`grid grid-cols-3 gap-0 border-b last:border-b-0 border-[var(--theme-glass-border)] ${
              idx % 2 === 0 ? 'bg-[color-mix(in_srgb,var(--theme-secondary)_12%,transparent)]' : ''
            }`}
          >
            <div
              className={`p-4 md:p-5 text-sm font-semibold text-[var(--theme-text)] ${
                isTactical ? 'font-mono text-xs uppercase' : ''
              }`}
            >
              {row.feature}
            </div>
            <div className="p-4 md:p-5 flex items-center justify-center bg-[color-mix(in_srgb,var(--theme-primary)_6%,transparent)]">
              <CellValue value={row.us} />
            </div>
            <div className="p-4 md:p-5 flex items-center justify-center">
              <CellValue value={row.them} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
