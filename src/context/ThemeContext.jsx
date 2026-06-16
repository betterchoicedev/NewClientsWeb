import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage first, then default to dark
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    // Default to dark theme
    return true;
  });

  useEffect(() => {
    // Update localStorage when theme changes
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    
    // Update document class for Tailwind dark mode
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Update theme-color meta so mobile browser chrome (status bar, address bar) matches app
    const themeColor = isDarkMode ? '#111827' : '#e0e7ff';
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', themeColor);
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const value = {
    isDarkMode,
    toggleTheme,
    themeClasses: {
      // Background colors
      bgPrimary: isDarkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100',
      bgSecondary: isDarkMode ? 'bg-gray-800' : 'bg-white',
      bgCard: isDarkMode ? 'bg-gray-800' : 'bg-white',
      bgHeader: isDarkMode ? 'bg-gradient-to-r from-gray-800 to-gray-900' : 'bg-gradient-to-r from-emerald-600 to-teal-600',
      
      // Text colors
      textPrimary: isDarkMode ? 'text-white' : 'text-gray-900',
      textSecondary: isDarkMode ? 'text-gray-300' : 'text-gray-600',
      textMuted: isDarkMode ? 'text-gray-400' : 'text-gray-500',
      
      // Border colors
      borderPrimary: isDarkMode ? 'border-gray-700' : 'border-gray-300',
      borderSecondary: isDarkMode ? 'border-gray-600' : 'border-gray-200',
      
      // Input colors
      inputBg: isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900',
      inputFocus: isDarkMode ? 'focus:ring-emerald-400 focus:border-emerald-400' : 'focus:ring-emerald-500 focus:border-emerald-500',
      inputText: isDarkMode ? 'text-white placeholder:text-gray-400' : 'text-gray-900 placeholder:text-gray-500',
      
      // Button colors
      btnPrimary: isDarkMode ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700',
      btnSecondary: isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800',
      btnOutline: isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50',
      
      // Shadow colors
      shadowCard: isDarkMode ? 'shadow-2xl shadow-gray-900/50' : 'shadow-xl',
      shadowHover: isDarkMode ? 'hover:shadow-2xl hover:shadow-gray-900/50' : 'hover:shadow-2xl',
      
      // Special sections
      sectionBg: isDarkMode ? 'bg-gray-800' : 'bg-gray-50',
      footerBg: isDarkMode ? 'bg-gray-900' : 'bg-gray-900',
      
      // Status colors
      successBg: isDarkMode ? 'bg-green-900/50 border-green-700 text-green-300' : 'bg-green-50 border-green-200 text-green-700',
      errorBg: isDarkMode ? 'bg-red-900/50 border-red-700 text-red-300' : 'bg-red-50 border-red-200 text-red-700',
    }
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
