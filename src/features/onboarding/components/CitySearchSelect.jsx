import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, MapPin, Search } from 'lucide-react';
import { searchCities } from '../api/onboardingApi';
import SearchableSelect from './SearchableSelect';
import { COUNTRY_OPTIONS } from '../countryOptions';
import { formatCityLabel } from '../cityDisplayUtils';
import { glassMenuClass, glassMenuHeaderClass, glassOptionClass } from './glassStyles';

const MENU_MAX_H = 280;
const SEARCH_LIMIT = 12;
const DEBOUNCE_MS = 320;

function isConfidentHit(rows, q) {
  if (!rows?.length) return false;
  if (rows.length === 1) return true;
  const needle = q.trim().toLowerCase();
  const top = rows[0];
  const name = String(top.name || '').toLowerCase();
  const ascii = String(top.asciiname || '').toLowerCase();
  return name === needle || ascii === needle;
}

function mergeFullHits(optimistic, full) {
  if (!optimistic?.geonameid || !full?.length) return full || [];
  const rest = full.filter((c) => c.geonameid !== optimistic.geonameid);
  const stillThere = full.some((c) => c.geonameid === optimistic.geonameid);
  if (stillThere) return [optimistic, ...rest];
  return full;
}

/**
 * Progressive disclosure: Country must be selected before city search is active.
 * Optimistic search: confident single hit paints ASAP; full list loads in background.
 */
export default function CitySearchSelect({
  value,
  timezone,
  countryCode,
  onCountryChange,
  onSelect,
  isHe = false,
  isDark,
  inputClass,
}) {
  const cityEnabled = Boolean(countryCode);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!value) {
      setSelectedLabel('');
    }
  }, [value]);

  useEffect(() => {
    if (!open || !cityEnabled) return undefined;
    const q = query.trim();
    if (q.length < 1) {
      if (abortRef.current) abortRef.current.abort();
      setHits([]);
      setLoading(false);
      setLoadingMore(false);
      return undefined;
    }

    setLoading(true);
    setLoadingMore(false);

    const t = setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;
      const reqCountry = countryCode;
      const reqQ = q;
      const phase = { optimistic: null, full: null };

      const apply = () => {
        if (signal.aborted) return;
        if (phase.full) {
          setHits(mergeFullHits(phase.optimistic, phase.full));
          return;
        }
        if (phase.optimistic) {
          setHits([phase.optimistic]);
        }
      };

      const quickPromise = searchCities(reqQ, {
        country: reqCountry,
        mode: 'quick',
        limit: 2,
        signal,
      })
        .then((quick) => {
          if (signal.aborted) return;
          const quickRows = quick.data || [];
          if (isConfidentHit(quickRows, reqQ)) {
            phase.optimistic = quickRows[0];
            apply();
            if (!phase.full) {
              setLoading(false);
              setLoadingMore(true);
            }
          }
        })
        .catch((e) => {
          if (e?.name === 'AbortError') return;
        });

      const fullPromise = searchCities(reqQ, {
        country: reqCountry,
        mode: 'full',
        limit: SEARCH_LIMIT,
        signal,
      })
        .then((full) => {
          if (signal.aborted) return;
          phase.full = full.data || [];
          apply();
        })
        .catch((e) => {
          if (e?.name === 'AbortError') return;
          if (!phase.optimistic) setHits([]);
        });

      Promise.allSettled([quickPromise, fullPromise]).then(() => {
        if (signal.aborted) return;
        setLoading(false);
        setLoadingMore(false);
      });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(t);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query, open, countryCode, cityEnabled]);

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
  }, [open, hits.length, loading, loadingMore]);

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

  const pick = (c) => {
    const label = c.display_label || formatCityLabel(c);
    setSelectedLabel(label);
    onSelect({
      city: c.name,
      timezone: c.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      meta: c,
    });
    setOpen(false);
    setQuery('');
    setHits([]);
    setLoadingMore(false);
  };

  const countryOptions = COUNTRY_OPTIONS.map((c) => ({
    value: c.code,
    label: `${c.label} (${c.code})`,
  }));

  const showInitialSpinner = query.trim().length >= 1 && loading && hits.length === 0;
  const showEmpty = query.trim().length >= 1 && !loading && !loadingMore && hits.length === 0;

  const menu =
    open && cityEnabled && menuStyle
      ? createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className={`flex flex-col ${glassMenuClass(isDark)}`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className={glassMenuHeaderClass(isDark)}>
              <Search size={16} className="opacity-50 shrink-0" aria-hidden />
              <input
                autoFocus
                className={`w-full bg-transparent outline-none text-sm py-0.5 ${
                  isDark
                    ? 'text-white placeholder:text-slate-500'
                    : 'text-slate-900 placeholder:text-slate-400'
                }`}
                placeholder={isHe ? 'הקלד לחיפוש עיר...' : 'Type to search cities...'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <ul
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-1"
              style={{ maxHeight: (menuStyle.maxHeight || MENU_MAX_H) - 48 }}
              role="listbox"
            >
              {query.trim().length < 1 && (
                <li className={`px-4 py-3 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {isHe ? 'הקלד לחיפוש עיר' : 'Type to search cities'}
                </li>
              )}
              {showInitialSpinner && (
                <li className={`px-4 py-3 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {isHe ? 'מחפש...' : 'Searching...'}
                </li>
              )}
              {showEmpty && (
                <li className={`px-4 py-3 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {isHe ? 'לא נמצאו ערים' : 'No cities found'}
                </li>
              )}
              {hits.map((c) => (
                <li key={c.geonameid}>
                  <button
                    type="button"
                    role="option"
                    className={`w-full min-h-11 text-start px-4 py-3 text-sm transition-colors duration-150 flex items-start gap-2 ${glassOptionClass(false, isDark)}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(c)}
                  >
                    <MapPin size={14} className="mt-0.5 shrink-0 opacity-50" aria-hidden />
                    <span>
                      <span className="font-medium">{c.display_label || formatCityLabel(c)}</span>
                      {c.timezone ? (
                        <span
                          className={`block text-xs mt-0.5 ${
                            isDark ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          {c.timezone}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
              {loadingMore && hits.length > 0 && (
                <li className={`px-4 py-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {isHe ? 'טוען עוד…' : 'Loading more…'}
                </li>
              )}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {isHe ? '1. בחרו מדינה' : '1. Select country'}
        </p>
        <SearchableSelect
          options={countryOptions}
          value={countryCode || ''}
          onChange={(code) => onCountryChange(code)}
          placeholder={isHe ? 'בחרו מדינה' : 'Select country'}
          searchPlaceholder={isHe ? 'חיפוש מדינות...' : 'Search countries...'}
          emptyText={isHe ? 'לא נמצאו תוצאות' : 'No matches'}
          matchesLabel={(n) => (isHe ? `${n} תוצאות` : `${n} match${n === 1 ? '' : 'es'}`)}
          isDark={isDark}
          inputClass={inputClass}
        />
      </div>

      <div className={`space-y-2 ${cityEnabled ? '' : 'opacity-50'}`}>
        <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {isHe ? '2. בחרו עיר' : '2. Select city'}
        </p>
        <button
          ref={triggerRef}
          type="button"
          disabled={!cityEnabled}
          onClick={() => cityEnabled && setOpen((v) => !v)}
          className={`${inputClass} min-h-11 flex items-center justify-between gap-2 text-start disabled:cursor-not-allowed`}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-disabled={!cityEnabled}
        >
          <span className="flex items-center gap-2 min-w-0">
            <MapPin size={16} className="shrink-0 opacity-50" aria-hidden />
            <span className={`truncate ${value ? '' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {!cityEnabled
                ? isHe
                  ? 'בחרו מדינה תחילה'
                  : 'Select a country first'
                : selectedLabel || value || (isHe ? 'בחרו עיר מהרשימה' : 'Select a city from the list')}
            </span>
          </span>
          <ChevronDown
            size={18}
            className={`shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {menu}
        <p className={`text-xs px-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {cityEnabled
            ? isHe
              ? 'פתחו את התפריט וחפשו — בחירה מהרשימה מגדירה גם את אזור הזמן'
              : 'Open the menu and search — picking a result also sets your timezone'
            : isHe
              ? 'בחרו מדינה למעלה כדי להפעיל חיפוש ערים'
              : 'Choose a country above to enable city search'}
        </p>
        {value && timezone ? (
          <p className={`text-xs px-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {isHe ? 'אזור זמן' : 'Timezone'}: {timezone}
          </p>
        ) : null}
      </div>
    </div>
  );
}
