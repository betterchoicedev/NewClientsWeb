import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import {
  glassMenuClass,
  glassOptionClass,
  ONBOARDING_DROPDOWN_MENU_Z,
  ONBOARDING_DROPDOWN_SCRIM_Z,
  ONBOARDING_FOOTER_CLEARANCE_PX,
} from './glassStyles';

const MENU_MAX_H = 280;
const OPTION_CLS =
  'w-full min-h-11 px-4 py-3 text-start text-sm font-medium transition-colors duration-150 flex items-center touch-manipulation';

/**
 * Locale-ordered DOB selects (EN: Month/Day/Year, HE: Day/Month/Year).
 * Partial day/month/year kept in local state so each tap registers immediately.
 * Value emitted as YYYY-MM-DD only when all three parts are set.
 */
const MONTHS_EN = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const MONTHS_HE = [
  { value: '1', label: 'ינואר' },
  { value: '2', label: 'פברואר' },
  { value: '3', label: 'מרץ' },
  { value: '4', label: 'אפריל' },
  { value: '5', label: 'מאי' },
  { value: '6', label: 'יוני' },
  { value: '7', label: 'יולי' },
  { value: '8', label: 'אוגוסט' },
  { value: '9', label: 'ספטמבר' },
  { value: '10', label: 'אוקטובר' },
  { value: '11', label: 'נובמבר' },
  { value: '12', label: 'דצמבר' },
];

function daysInMonth(month, year) {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (!m) return 31;
  if (!y) return 31;
  return new Date(y, m, 0).getDate();
}

function parseIso(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return { day: '', month: '', year: '' };
  const [y, m, d] = iso.slice(0, 10).split('-');
  return { day: String(parseInt(d, 10)), month: String(parseInt(m, 10)), year: y };
}

function toIso(day, month, year) {
  if (!day || !month || !year) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function PickerSelect({
  label,
  placeholder,
  value,
  displayValue,
  options,
  onChange,
  isDark,
  inputClass,
  flexClass = 'flex-1',
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - ONBOARDING_FOOTER_CLEARANCE_PX;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < MENU_MAX_H + 16 && spaceAbove > spaceBelow;
    const height = Math.min(MENU_MAX_H, openUp ? spaceAbove - 12 : Math.max(spaceBelow - 12, 120));
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 96),
      zIndex: ONBOARDING_DROPDOWN_MENU_Z,
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
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    // Capture phase so outside taps never reach onboarding footer buttons underneath
    document.addEventListener('pointerdown', onDoc, true);
    return () => document.removeEventListener('pointerdown', onDoc, true);
  }, [open]);

  const selectValue = (v) => {
    onChange(v);
    setOpen(false);
  };

  const menu =
    open && menuStyle
      ? createPortal(
          <>
            <div
              aria-hidden
              className="fixed inset-0 touch-none"
              style={{ zIndex: ONBOARDING_DROPDOWN_SCRIM_Z }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
              }}
            />
            <div
              ref={menuRef}
              style={menuStyle}
              className={glassMenuClass(isDark)}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <ul
                className="overflow-y-auto overscroll-contain py-1"
                style={{ maxHeight: menuStyle.maxHeight }}
                role="listbox"
              >
                {options.map((o) => {
                  const active = String(o.value) === String(value);
                  return (
                    <li key={o.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`${OPTION_CLS} ${glassOptionClass(active, isDark)}`}
                        onPointerDown={(e) => {
                          // Commit on pointerdown so the choice registers before any close race
                          e.preventDefault();
                          e.stopPropagation();
                          selectValue(o.value);
                        }}
                      >
                        {o.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <div className={`${flexClass} min-w-0 space-y-1`}>
      <span className={`block text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        className={`${inputClass} min-h-11 flex items-center justify-between gap-1 text-start`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className={`truncate ${value ? '' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {displayValue || placeholder}
        </span>
        <ChevronDown size={16} className={`shrink-0 opacity-60 ${open ? 'rotate-180' : ''}`} />
      </button>
      {menu}
    </div>
  );
}

export default function DateOfBirthSelect({ value, onChange, isHe = false, isDark, inputClass }) {
  const parsed = parseIso(value);
  const [day, setDay] = useState(parsed.day);
  const [month, setMonth] = useState(parsed.month);
  const [year, setYear] = useState(parsed.year);

  // Sync from parent when a complete ISO value arrives (e.g. draft restore)
  useEffect(() => {
    const next = parseIso(value);
    if (value && next.day && next.month && next.year) {
      setDay(next.day);
      setMonth(next.month);
      setYear(next.year);
    }
  }, [value]);

  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: currentYear - 1900 + 1 }, (_, i) => String(currentYear - i)),
    [currentYear]
  );
  const maxDay = daysInMonth(month, year);
  const days = useMemo(
    () => Array.from({ length: maxDay }, (_, i) => String(i + 1)),
    [maxDay]
  );
  const months = isHe ? MONTHS_HE : MONTHS_EN;

  const commit = (nextDay, nextMonth, nextYear) => {
    let d = nextDay;
    let m = nextMonth;
    let y = nextYear;
    const max = daysInMonth(m, y);
    if (d && parseInt(d, 10) > max) d = String(max);
    setDay(d);
    setMonth(m);
    setYear(y);
    const iso = toIso(d, m, y);
    // Emit only when complete so partial taps still show in the UI
    if (iso) onChange(iso);
  };

  const monthLabel = months.find((m) => m.value === month)?.label;

  const monthSelect = (
    <PickerSelect
      key="month"
      label={isHe ? 'חודש' : 'Month'}
      placeholder={isHe ? 'חודש' : 'MM'}
      value={month}
      displayValue={monthLabel}
      options={months}
      onChange={(v) => commit(day, v, year)}
      isDark={isDark}
      inputClass={inputClass}
      flexClass="flex-[1.4]"
    />
  );
  const daySelect = (
    <PickerSelect
      key="day"
      label={isHe ? 'יום' : 'Day'}
      placeholder={isHe ? 'יום' : 'DD'}
      value={day}
      displayValue={day ? day.padStart(2, '0') : ''}
      options={days.map((d) => ({ value: d, label: d.padStart(2, '0') }))}
      onChange={(v) => commit(v, month, year)}
      isDark={isDark}
      inputClass={inputClass}
    />
  );
  const yearSelect = (
    <PickerSelect
      key="year"
      label={isHe ? 'שנה' : 'Year'}
      placeholder={isHe ? 'שנה' : 'YYYY'}
      value={year}
      displayValue={year}
      options={years.map((y) => ({ value: y, label: y }))}
      onChange={(v) => commit(day, month, v)}
      isDark={isDark}
      inputClass={inputClass}
    />
  );

  const order = isHe ? [daySelect, monthSelect, yearSelect] : [monthSelect, daySelect, yearSelect];

  return (
    <div className="flex gap-2">{order}</div>
  );
}
