import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Accessibility, FileText, Heading, Link2, Pause, RotateCcw, Type, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// Colors: site pages use the BetterApp tokens. On /landing the company page sets
// its DB-configured colors as --theme-* variables on its own root, so the widget
// reads them from there and follows each company's palette.
const SITE_COLORS = {
  '--aw-accent': 'var(--bc-accent)',
  '--aw-on-accent': 'var(--bc-on-accent)',
  '--aw-surface': 'var(--bc-surface)',
  '--aw-well': 'var(--bc-surface-2)',
  '--aw-text': 'var(--bc-text)',
  '--aw-muted': 'var(--bc-muted)',
  '--aw-border': 'var(--bc-border)',
};

function readLandingColors() {
  const root = document.querySelector('[data-landing-scroll]')?.parentElement;
  if (!root) return null;
  const cs = getComputedStyle(root);
  const v = (name) => cs.getPropertyValue(name).trim();
  const primary = v('--theme-primary');
  if (!primary) return null;
  const text = v('--theme-text') || '#FFFFFF';
  return {
    '--aw-accent': primary,
    '--aw-on-accent': v('--theme-text-on-primary') || '#FFFFFF',
    '--aw-surface': v('--theme-surface') || '#181412',
    '--aw-well': `color-mix(in srgb, ${text} 10%, transparent)`,
    '--aw-text': text,
    '--aw-muted': v('--theme-text-muted') || text,
    '--aw-border': `color-mix(in srgb, ${primary} 30%, transparent)`,
  };
}

/**
 * Accessibility Widget - Required by Israeli Law
 * Provides users with accessibility customization options
 */
const AccessibilityWidget = () => {
  const { language, direction } = useLanguage();
  const location = useLocation();
  const [colors, setColors] = useState(SITE_COLORS);
  const [isOpen, setIsOpen] = useState(false);

  // On /landing, wait for the campaign's theme to load, then take its colors.
  useEffect(() => {
    if (location.pathname !== '/landing') {
      setColors(SITE_COLORS);
      return undefined;
    }
    let tries = 0;
    const apply = () => {
      const landing = readLandingColors();
      if (landing) setColors(landing);
      return Boolean(landing);
    };
    if (apply()) return undefined;
    const id = setInterval(() => {
      tries += 1;
      if (apply() || tries > 40) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [location.pathname, location.hash]);
  const [fontSize, setFontSize] = useState(100);
  const [contrast, setContrast] = useState('normal');
  const [highlightLinks, setHighlightLinks] = useState(false);
  const [cursor, setCursor] = useState('normal');
  const [readableFont, setReadableFont] = useState(false);
  const [stopAnimations, setStopAnimations] = useState(false);
  const [highlightHeadings, setHighlightHeadings] = useState(false);

  // Load saved preferences
  useEffect(() => {
    const savedPrefs = localStorage.getItem('accessibilityPrefs');
    if (savedPrefs) {
      const prefs = JSON.parse(savedPrefs);
      setFontSize(prefs.fontSize || 100);
      setContrast(prefs.contrast || 'normal');
      setHighlightLinks(prefs.highlightLinks || false);
      setCursor(prefs.cursor || 'normal');
      setReadableFont(prefs.readableFont || false);
      setStopAnimations(prefs.stopAnimations || false);
      setHighlightHeadings(prefs.highlightHeadings || false);
      applyAccessibilitySettings(prefs);
    }
  }, []);

  // Save preferences
  const savePreferences = (prefs) => {
    localStorage.setItem('accessibilityPrefs', JSON.stringify(prefs));
  };

  // Apply settings to document
  const applyAccessibilitySettings = (prefs) => {
    const root = document.documentElement;
    
    // Font size
    root.style.fontSize = `${prefs.fontSize}%`;
    
    // Contrast
    root.setAttribute('data-contrast', prefs.contrast);
    
    // Highlight links
    if (prefs.highlightLinks) {
      root.classList.add('highlight-links');
    } else {
      root.classList.remove('highlight-links');
    }
    
    // Cursor size
    root.setAttribute('data-cursor', prefs.cursor);
    
    // Readable font
    if (prefs.readableFont) {
      root.classList.add('readable-font');
    } else {
      root.classList.remove('readable-font');
    }

    // Stop animations
    if (prefs.stopAnimations) {
      root.classList.add('stop-animations');
    } else {
      root.classList.remove('stop-animations');
    }

    // Highlight headings
    if (prefs.highlightHeadings) {
      root.classList.add('highlight-headings');
    } else {
      root.classList.remove('highlight-headings');
    }
  };

  // Increase font size
  const increaseFontSize = () => {
    const newSize = Math.min(fontSize + 10, 200);
    setFontSize(newSize);
    const prefs = { fontSize: newSize, contrast, highlightLinks, cursor, readableFont, stopAnimations, highlightHeadings };
    applyAccessibilitySettings(prefs);
    savePreferences(prefs);
  };

  // Decrease font size
  const decreaseFontSize = () => {
    const newSize = Math.max(fontSize - 10, 80);
    setFontSize(newSize);
    const prefs = { fontSize: newSize, contrast, highlightLinks, cursor, readableFont, stopAnimations, highlightHeadings };
    applyAccessibilitySettings(prefs);
    savePreferences(prefs);
  };

  // Toggle contrast
  const toggleContrast = (mode) => {
    setContrast(mode);
    const prefs = { fontSize, contrast: mode, highlightLinks, cursor, readableFont, stopAnimations, highlightHeadings };
    applyAccessibilitySettings(prefs);
    savePreferences(prefs);
  };

  // Toggle link highlight
  const toggleLinkHighlight = () => {
    const newValue = !highlightLinks;
    setHighlightLinks(newValue);
    const prefs = { fontSize, contrast, highlightLinks: newValue, cursor, readableFont, stopAnimations, highlightHeadings };
    applyAccessibilitySettings(prefs);
    savePreferences(prefs);
  };

  // Toggle cursor size
  const toggleCursor = (size) => {
    setCursor(size);
    const prefs = { fontSize, contrast, highlightLinks, cursor: size, readableFont, stopAnimations, highlightHeadings };
    applyAccessibilitySettings(prefs);
    savePreferences(prefs);
  };

  // Toggle readable font
  const toggleReadableFont = () => {
    const newValue = !readableFont;
    setReadableFont(newValue);
    const prefs = { fontSize, contrast, highlightLinks, cursor, readableFont: newValue, stopAnimations, highlightHeadings };
    applyAccessibilitySettings(prefs);
    savePreferences(prefs);
  };

  // Toggle animations
  const toggleAnimations = () => {
    const newValue = !stopAnimations;
    setStopAnimations(newValue);
    const prefs = { fontSize, contrast, highlightLinks, cursor, readableFont, stopAnimations: newValue, highlightHeadings };
    applyAccessibilitySettings(prefs);
    savePreferences(prefs);
  };

  // Toggle heading highlight
  const toggleHeadingHighlight = () => {
    const newValue = !highlightHeadings;
    setHighlightHeadings(newValue);
    const prefs = { fontSize, contrast, highlightLinks, cursor, readableFont, stopAnimations, highlightHeadings: newValue };
    applyAccessibilitySettings(prefs);
    savePreferences(prefs);
  };

  // Reset all settings
  const resetSettings = () => {
    const defaultPrefs = {
      fontSize: 100,
      contrast: 'normal',
      highlightLinks: false,
      cursor: 'normal',
      readableFont: false,
      stopAnimations: false,
      highlightHeadings: false
    };
    setFontSize(100);
    setContrast('normal');
    setHighlightLinks(false);
    setCursor('normal');
    setReadableFont(false);
    setStopAnimations(false);
    setHighlightHeadings(false);
    applyAccessibilitySettings(defaultPrefs);
    savePreferences(defaultPrefs);
  };

  const text = {
    hebrew: {
      title: 'נגישות',
      increaseFontSize: 'הגדל גופן',
      decreaseFontSize: 'הקטן גופן',
      contrast: 'ניגודיות',
      normalContrast: 'רגיל',
      highContrast: 'גבוהה',
      invertContrast: 'הפוך',
      highlightLinks: 'הדגש קישורים',
      highlightHeadings: 'הדגש כותרות',
      cursor: 'סמן עכבר',
      normalCursor: 'רגיל',
      bigCursor: 'גדול',
      readableFont: 'גופן קריא',
      stopAnimations: 'עצור אנימציות',
      reset: 'אפס הגדרות',
      close: 'סגור',
      statement: 'הצהרת נגישות'
    },
    english: {
      title: 'Accessibility',
      increaseFontSize: 'Increase Font',
      decreaseFontSize: 'Decrease Font',
      contrast: 'Contrast',
      normalContrast: 'Normal',
      highContrast: 'High',
      invertContrast: 'Invert',
      highlightLinks: 'Highlight Links',
      highlightHeadings: 'Highlight Headings',
      cursor: 'Cursor',
      normalCursor: 'Normal',
      bigCursor: 'Large',
      readableFont: 'Readable Font',
      stopAnimations: 'Stop Animations',
      reset: 'Reset Settings',
      close: 'Close',
      statement: 'Accessibility Statement'
    }
  };

  // Escape closes the panel.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const t = text[language === 'hebrew' ? 'hebrew' : 'english'];

  const side = direction === 'rtl' ? 'left-4' : 'right-4';
  const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aw-accent)]';
  const option = (selected) =>
    `min-h-[40px] px-3 rounded-[16px] text-[14px] font-semibold border transition-colors duration-150 ${focus} ${
      selected
        ? 'bg-[var(--aw-accent)] text-[var(--aw-on-accent)] border-transparent'
        : 'bg-[var(--aw-well)] text-[var(--aw-text)] border-transparent hover:border-[var(--aw-border)]'
    }`;
  const toggleRow = (selected) => `w-full flex items-center justify-between gap-3 py-2.5 ${option(selected)} px-4`;
  const label = 'block text-[13px] font-semibold text-[var(--aw-muted)] mb-2';

  return (
    <div style={colors}>
      {/* Accessibility button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`aw-launcher fixed ${side} bottom-20 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--aw-accent)] text-[var(--aw-on-accent)] shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition-opacity duration-150 hover:opacity-90 active:opacity-75 ${focus}`}
        aria-label={t.title}
        aria-expanded={isOpen}
        title={t.title}
      >
        <Accessibility size={24} aria-hidden="true" />
      </button>

      {/* Accessibility panel */}
      {isOpen && (
        <div
          className={`fixed ${side} bottom-36 z-50 w-80 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded-[24px] border border-[var(--aw-border)] bg-[var(--aw-surface)] p-5 text-start text-[var(--aw-text)]`}
          role="dialog"
          aria-label={t.title}
          dir={direction}
        >
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--aw-border)]">
            <h2 className="text-[17px] font-bold flex items-center gap-2">
              <Accessibility size={18} aria-hidden="true" />
              {t.title}
            </h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-[var(--aw-muted)] hover:text-[var(--aw-text)] ${focus}`}
              aria-label={t.close}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="mb-4">
            <span className={label}>{t.increaseFontSize} / {t.decreaseFontSize}</span>
            <div className="flex items-center gap-2" dir="ltr">
              <button type="button" onClick={decreaseFontSize} className={`flex-1 ${option(false)} text-[17px] font-bold`} aria-label={t.decreaseFontSize}>
                A-
              </button>
              <span className="min-w-[3rem] text-center text-[14px] font-semibold tabular-nums">{fontSize}%</span>
              <button type="button" onClick={increaseFontSize} className={`flex-1 ${option(false)} text-[17px] font-bold`} aria-label={t.increaseFontSize}>
                A+
              </button>
            </div>
          </div>

          <div className="mb-4">
            <span className={label}>{t.contrast}</span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.contrast}>
              {[
                ['normal', t.normalContrast],
                ['high', t.highContrast],
                ['invert', t.invertContrast],
              ].map(([mode, name]) => (
                <button key={mode} type="button" role="radio" aria-checked={contrast === mode} onClick={() => toggleContrast(mode)} className={option(contrast === mode)}>
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {[
              [highlightLinks, toggleLinkHighlight, t.highlightLinks, Link2],
              [readableFont, toggleReadableFont, t.readableFont, Type],
              [highlightHeadings, toggleHeadingHighlight, t.highlightHeadings, Heading],
              [stopAnimations, toggleAnimations, t.stopAnimations, Pause],
            ].map(([on, onToggle, name, Icon]) => (
              <button key={name} type="button" aria-pressed={on} onClick={onToggle} className={toggleRow(on)}>
                <span>{name}</span>
                <Icon size={18} aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="mb-4">
            <span className={label}>{t.cursor}</span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.cursor}>
              {[
                ['normal', t.normalCursor],
                ['large', t.bigCursor],
              ].map(([size, name]) => (
                <button key={size} type="button" role="radio" aria-checked={cursor === size} onClick={() => toggleCursor(size)} className={option(cursor === size)}>
                  {name}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={resetSettings}
            className={`w-full min-h-[44px] mb-3 flex items-center justify-center gap-2 rounded-[24px] border border-[var(--aw-border)] text-[14px] font-semibold text-[var(--aw-text)] hover:opacity-80 ${focus}`}
          >
            <RotateCcw size={16} aria-hidden="true" />
            {t.reset}
          </button>

          <Link
            to="/accessibility-statement"
            className={`flex items-center justify-center gap-2 text-[14px] font-semibold text-[var(--aw-text)] underline underline-offset-4 decoration-[var(--aw-border)] hover:decoration-[var(--aw-accent)] rounded ${focus}`}
            onClick={() => setIsOpen(false)}
          >
            <FileText size={16} aria-hidden="true" />
            {t.statement}
          </Link>

          <div className="mt-3 pt-3 border-t border-[var(--aw-border)]">
            <p className="text-[12px] font-semibold text-[var(--aw-muted)] text-center">
              {language === 'hebrew' ? 'לחצו Tab לניווט עם מקלדת' : 'Press Tab for keyboard navigation'}
            </p>
          </div>
        </div>
      )}

      {/* Accessibility CSS Styles */}
      <style>{`
        /* High Contrast Mode */
        :root[data-contrast="high"] {
          filter: contrast(150%);
        }

        /* Invert Colors Mode */
        :root[data-contrast="invert"] {
          filter: invert(100%) hue-rotate(180deg);
        }

        :root[data-contrast="invert"] img,
        :root[data-contrast="invert"] video {
          filter: invert(100%) hue-rotate(180deg);
        }

        /* Highlight Links */
        .highlight-links a {
          background-color: yellow !important;
          color: black !important;
          padding: 2px 4px !important;
          font-weight: bold !important;
        }

        /* Large Cursor */
        :root[data-cursor="large"],
        :root[data-cursor="large"] * {
          cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="black" stroke="white" stroke-width="1" d="M5 3l14 9-5 1-2 5z"/></svg>') 0 0, auto !important;
        }

        /* Readable Font */
        .readable-font,
        .readable-font * {
          font-family: Arial, Helvetica, sans-serif !important;
          letter-spacing: 0.05em !important;
          line-height: 1.8 !important;
        }

        /* Stop Animations - Required by Israeli Law */
        .stop-animations,
        .stop-animations *,
        .stop-animations *::before,
        .stop-animations *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }

        /* Highlight Headings - Navigation Aid */
        .highlight-headings h1,
        .highlight-headings h2,
        .highlight-headings h3,
        .highlight-headings h4,
        .highlight-headings h5,
        .highlight-headings h6 {
          background-color: #fbbf24 !important;
          color: #000000 !important;
          padding: 8px 12px !important;
          border-left: 4px solid #f59e0b !important;
          margin-bottom: 16px !important;
          font-weight: bold !important;
        }
      `}</style>
    </div>
  );
};

export default AccessibilityWidget;

