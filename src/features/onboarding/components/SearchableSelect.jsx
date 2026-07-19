import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { glassMenuClass, glassMenuHeaderClass, glassOptionClass } from './glassStyles';

const MENU_MAX_H = 280;

function rankMatch(label, val, q) {
  if (label.startsWith(q)) return 0;
  if (val.startsWith(q)) return 1;
  if (label.includes(q)) return 2;
  if (val.includes(q)) return 3;
  return 4;
}

/**
 * Searchable single-select that portals its menu to document.body so it is
 * never clipped by the onboarding panel overflow.
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  isDark,
  inputClass,
  getLabel = (o) => o.label,
  getValue = (o) => o.value,
  emptyText = 'No matches',
  matchesLabel,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => getValue(o) === value);
  const selectedLabel = selected ? getLabel(selected) : '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options
      .map((o) => {
        const label = String(getLabel(o)).toLowerCase();
        const val = String(getValue(o)).toLowerCase();
        const rank = rankMatch(label, val, q);
        return { o, rank, label };
      })
      .filter((row) => row.rank < 4)
      .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
      .map((row) => row.o);
  }, [options, query, getLabel, getValue]);

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < MENU_MAX_H + 16 && spaceAbove > spaceBelow;
    const height = Math.min(MENU_MAX_H, openUp ? spaceAbove - 12 : spaceBelow - 12);

    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      zIndex: 200,
      maxHeight: Math.max(160, height),
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 8 }
        : { top: rect.bottom + 8 }),
    });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePosition();
    const onWin = () => updatePosition();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open, query, filtered.length]);

  useEffect(() => {
    if (!open) return undefined;
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [query, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  const matchCountText =
    query.trim() &&
    (matchesLabel
      ? matchesLabel(filtered.length)
      : `${filtered.length} match${filtered.length === 1 ? '' : 'es'}`);

  const menu =
    open && menuStyle
      ? createPortal(
          <div ref={menuRef} style={menuStyle} className={`flex flex-col ${glassMenuClass(isDark)}`}>
            <div className={glassMenuHeaderClass(isDark)}>
              <Search size={16} className="opacity-50 shrink-0" aria-hidden />
              <input
                autoFocus
                className={`w-full bg-transparent outline-none text-sm py-0.5 ${
                  isDark
                    ? 'text-white placeholder:text-slate-500'
                    : 'text-slate-900 placeholder:text-slate-400'
                }`}
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {matchCountText ? (
              <p
                className={`shrink-0 px-4 py-1.5 text-[11px] font-medium border-b ${
                  isDark ? 'text-slate-400 border-white/10' : 'text-slate-500 border-white/50'
                }`}
              >
                {matchCountText}
              </p>
            ) : null}
            <ul
              ref={listRef}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-1"
              style={{ maxHeight: (menuStyle.maxHeight || MENU_MAX_H) - (matchCountText ? 72 : 48) }}
            >
              {filtered.length === 0 && (
                <li className={`px-4 py-3 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {emptyText}
                </li>
              )}
              {filtered.map((o) => {
                const v = getValue(o);
                const active = v === value;
                return (
                  <li key={v}>
                    <button
                      type="button"
                      className={`w-full min-h-11 text-start px-4 py-3 text-sm transition-colors duration-150 ${glassOptionClass(
                        active,
                        isDark
                      )}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange(v, o);
                        setOpen(false);
                        setQuery('');
                      }}
                    >
                      {getLabel(o)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputClass} flex items-center justify-between gap-2 text-start`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={selectedLabel ? '' : isDark ? 'text-slate-500' : 'text-slate-400'}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {menu}
    </div>
  );
}
