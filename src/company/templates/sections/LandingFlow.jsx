import React from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { buildLayoutPageBackgroundStyle, buildLayoutThemeStyles } from '../layoutTheme';

/** Unified scroll canvas — single page gradient + theme CSS variables */
export default function LandingFlow({ colors, children }) {
  const { isDarkMode } = useTheme();
  const themeStyles = {
    ...buildLayoutThemeStyles(colors),
    ...buildLayoutPageBackgroundStyle(colors, !isDarkMode),
  };

  return (
    <main
      className="relative w-full min-h-full animate-fadeIn select-none scroll-smooth text-[var(--theme-text)]"
      style={themeStyles}
    >
      <div className="relative z-10">{children}</div>
    </main>
  );
}
