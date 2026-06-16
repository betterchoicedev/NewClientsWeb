import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

/**
 * Accessibility Widget - Required by Israeli Law
 * Provides users with accessibility customization options
 */
const AccessibilityWidget = () => {
  const { language, direction } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
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

  const t = text[language === 'hebrew' ? 'hebrew' : 'english'];

  return (
    <>
      {/* Accessibility Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed ${direction === 'rtl' ? 'left-4' : 'right-4'} bottom-20 z-50 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300`}
        aria-label={t.title}
        aria-expanded={isOpen}
        title={t.title}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </button>

      {/* Accessibility Panel */}
      {isOpen && (
        <div 
          className={`fixed ${direction === 'rtl' ? 'left-4' : 'right-4'} bottom-36 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-80 max-h-96 overflow-y-auto border-2 border-blue-600`}
          role="dialog"
          aria-label={t.title}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {t.title}
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
              aria-label={t.close}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Font Size Controls */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t.increaseFontSize} / {t.decreaseFontSize}
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={decreaseFontSize}
                className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-4 py-2 rounded-lg font-bold text-xl"
                aria-label={t.decreaseFontSize}
              >
                A-
              </button>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[3rem] text-center">
                {fontSize}%
              </span>
              <button
                onClick={increaseFontSize}
                className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-4 py-2 rounded-lg font-bold text-xl"
                aria-label={t.increaseFontSize}
              >
                A+
              </button>
            </div>
          </div>

          {/* Contrast Controls */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t.contrast}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => toggleContrast('normal')}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  contrast === 'normal'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {t.normalContrast}
              </button>
              <button
                onClick={() => toggleContrast('high')}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  contrast === 'high'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {t.highContrast}
              </button>
              <button
                onClick={() => toggleContrast('invert')}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  contrast === 'invert'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {t.invertContrast}
              </button>
            </div>
          </div>

          {/* Toggle Options */}
          <div className="space-y-2 mb-4">
            {/* Highlight Links */}
            <button
              onClick={toggleLinkHighlight}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium ${
                highlightLinks
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <span>{t.highlightLinks}</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </button>

            {/* Readable Font */}
            <button
              onClick={toggleReadableFont}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium ${
                readableFont
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <span>{t.readableFont}</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>

            {/* Highlight Headings */}
            <button
              onClick={toggleHeadingHighlight}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium ${
                highlightHeadings
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <span>{t.highlightHeadings}</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </button>

            {/* Stop Animations */}
            <button
              onClick={toggleAnimations}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium ${
                stopAnimations
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <span>{t.stopAnimations}</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>

          {/* Cursor Size */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t.cursor}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => toggleCursor('normal')}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  cursor === 'normal'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {t.normalCursor}
              </button>
              <button
                onClick={() => toggleCursor('large')}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  cursor === 'large'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {t.bigCursor}
              </button>
            </div>
          </div>

          {/* Reset Button */}
          <button
            onClick={resetSettings}
            className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 mb-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t.reset}
          </button>

          {/* Accessibility Statement Link */}
          <Link
            to="/accessibility-statement"
            className="block w-full text-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium underline"
            onClick={() => setIsOpen(false)}
          >
            📄 {t.statement}
          </Link>

          {/* Keyboard Shortcut Info */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {language === 'hebrew' 
                ? 'לחץ Tab לניווט עם מקלדת' 
                : 'Press Tab for keyboard navigation'}
            </p>
          </div>
        </div>
      )}

      {/* Accessibility CSS Styles */}
      <style jsx>{`
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
    </>
  );
};

export default AccessibilityWidget;

