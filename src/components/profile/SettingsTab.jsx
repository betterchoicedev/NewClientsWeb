import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';

const SettingsTab = ({ themeClasses, language, userCode }) => {
  const { settings, updateSetting } = useSettings();
  const { isDarkMode, toggleTheme } = useTheme();
  const { toggleLanguage } = useLanguage();
  const [saving, setSaving] = useState(false);

  const {
    showCalories,
    showMacros,
    portionDisplay,
    measurementSystem,
    weightUnit,
    decimalPlaces,
    loading,
  } = settings;

  const handleToggle = async (key, value) => {
    try {
      setSaving(true);
      // Convert snake_case to camelCase for context
      const camelCaseKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

      // For user_language, handle it specially
      if (key === 'user_language') {
        toggleLanguage(value);
        // Update in database via profile update
        if (userCode) {
          const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
          const response = await fetch(`${apiUrl}/api/profile/update-language`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userCode, language: value })
          });

          if (!response.ok) {
            console.error('Error updating language');
          }
        }
      } else {
        // Update via context (instant UI update)
        await updateSetting(camelCaseKey, value);
      }
    } catch (err) {
      console.error('Error updating setting:', err);
      alert(
        language === 'hebrew' ? 'שגיאה בשמירת ההגדרה' : 'Error saving setting'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-8">
        {/* Display Preferences */}
        <div>
          <h2 className={`${themeClasses.textPrimary} text-xl font-bold mb-4`}>
            {language === 'hebrew' ? 'העדפות תצוגה' : 'Display Preferences'}
          </h2>

          <div className="space-y-4">
            {/* Show Calories */}
            <div className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className={`${themeClasses.textPrimary} font-semibold block mb-1`}>
                    {language === 'hebrew' ? 'הצג קלוריות' : 'Show Calories'}
                  </label>
                  <p className={`${themeClasses.textSecondary} text-sm`}>
                    {language === 'hebrew'
                      ? 'הצג את ספירת הקלוריות בארוחות'
                      : 'Display calorie count in meals'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCalories}
                    onChange={(e) => handleToggle('show_calories', e.target.checked)}
                    disabled={saving}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* Show Macros */}
            <div className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className={`${themeClasses.textPrimary} font-semibold block mb-1`}>
                    {language === 'hebrew' ? 'הצג מקרו' : 'Show Macros'}
                  </label>
                  <p className={`${themeClasses.textSecondary} text-sm`}>
                    {language === 'hebrew'
                      ? 'הצג חלבון, פחמימות ושומן'
                      : 'Display protein, carbs, and fat'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMacros}
                    onChange={(e) => handleToggle('show_macros', e.target.checked)}
                    disabled={saving}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* Portion Display */}
            <div className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}>
              <div className="flex-1">
                <label className={`${themeClasses.textPrimary} font-semibold block mb-1`}>
                  {language === 'hebrew' ? 'תצוגת מנות' : 'Portion Display'}
                </label>
                <p className={`${themeClasses.textSecondary} text-sm mb-3`}>
                  {language === 'hebrew'
                    ? 'איך להציג כמויות מזון בארוחות באתר'
                    : 'How to display food quantities in meals on the website'}
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  {['grams', 'household', 'both'].map((option) => (
                    <button
                      key={option}
                      onClick={() => handleToggle('portion_display', option)}
                      disabled={saving}
                      className={`flex-1 px-4 py-3 sm:py-2 rounded-lg border-2 transition-all text-sm sm:text-base font-medium min-h-[44px] sm:min-h-0 ${
                        portionDisplay === option
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                          : `${themeClasses.borderPrimary} ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:border-emerald-300`
                      }`}
                    >
                      {option === 'grams'
                        ? (language === 'hebrew' ? 'יחידות מידה נפוצות' : 'Common Units')
                        : option === 'household'
                        ? (language === 'hebrew' ? 'מידות מטבח' : 'Kitchen Measurements')
                        : (language === 'hebrew' ? 'שניהם' : 'Both')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Measurement Units */}
        <div>
          <h2 className={`${themeClasses.textPrimary} text-xl font-bold mb-4`}>
            {language === 'hebrew' ? 'יחידות מדידה' : 'Measurement Units'}
          </h2>

          <div className="space-y-4">
            {/* Measurement System */}
            <div className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}>
              <div className="flex-1">
                <label className={`${themeClasses.textPrimary} font-semibold block mb-1`}>
                  {language === 'hebrew' ? 'מערכת מדידה' : 'Measurement System'}
                </label>
                <p className={`${themeClasses.textSecondary} text-sm mb-3`}>
                  {language === 'hebrew'
                    ? 'מטרי או אימפריאלי'
                    : 'Metric or Imperial'}
                </p>
                <div className="flex gap-2">
                  {['metric', 'imperial'].map((option) => (
                    <button
                      key={option}
                      onClick={() => handleToggle('measurement_system', option)}
                      disabled={saving}
                      className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                        measurementSystem === option
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                          : `${themeClasses.borderPrimary} ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:border-emerald-300`
                      }`}
                    >
                      {option === 'metric'
                        ? (language === 'hebrew' ? 'מטרי' : 'Metric')
                        : (language === 'hebrew' ? 'אימפריאלי' : 'Imperial')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Weight Unit */}
            <div className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}>
              <div className="flex-1">
                <label className={`${themeClasses.textPrimary} font-semibold block mb-1`}>
                  {language === 'hebrew' ? 'יחידת משקל' : 'Weight Unit'}
                </label>
                <p className={`${themeClasses.textSecondary} text-sm mb-3`}>
                  {language === 'hebrew'
                    ? 'גרמים או אונקיות'
                    : 'Grams or ounces'}
                </p>
                <div className="flex gap-2">
                  {['grams', 'ounces'].map((option) => (
                    <button
                      key={option}
                      onClick={() => handleToggle('weight_unit', option)}
                      disabled={saving}
                      className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                        weightUnit === option
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                          : `${themeClasses.borderPrimary} ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:border-emerald-300`
                      }`}
                    >
                      {option === 'grams'
                        ? (language === 'hebrew' ? 'גרמים (g)' : 'Grams (g)')
                        : (language === 'hebrew' ? 'אונקיות (oz)' : 'Ounces (oz)')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Number Format */}
        <div>
          <h2 className={`${themeClasses.textPrimary} text-xl font-bold mb-4`}>
            {language === 'hebrew' ? 'עיצוב מספרים' : 'Number Format'}
          </h2>

          <div className="space-y-4">
            {/* Decimal Places */}
            <div className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}>
              <div className="flex-1">
                <label className={`${themeClasses.textPrimary} font-semibold block mb-1`}>
                  {language === 'hebrew' ? 'ספרות אחרי הנקודה' : 'Decimal Places'}
                </label>
                <p className={`${themeClasses.textSecondary} text-sm mb-3`}>
                  {language === 'hebrew'
                    ? 'מספר ספרות לאחר הנקודה העשרונית'
                    : 'Number of digits after decimal point'}
                </p>
                <div className="flex gap-2">
                  {[0, 1, 2].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleToggle('decimal_places', num)}
                      disabled={saving}
                      className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                        decimalPlaces === num
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                          : `${themeClasses.borderPrimary} ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:border-emerald-300`
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* App Settings */}
        <div>
          <h2 className={`${themeClasses.textPrimary} text-xl font-bold mb-4`}>
            {language === 'hebrew' ? 'הגדרות אפליקציה' : 'App Settings'}
          </h2>

          <div className="space-y-4">
            {/* Dark Mode */}
            <div className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className={`${themeClasses.textPrimary} font-semibold block mb-1`}>
                    {language === 'hebrew' ? 'מצב כהה' : 'Dark Mode'}
                  </label>
                  <p className={`${themeClasses.textSecondary} text-sm`}>
                    {language === 'hebrew'
                      ? 'החלף בין מצב כהה ומצב בהיר'
                      : 'Switch between dark and light mode'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDarkMode}
                    onChange={toggleTheme}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* Language */}
            <div className={`${themeClasses.bgCard} rounded-lg p-4 border ${themeClasses.borderPrimary}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className={`${themeClasses.textPrimary} font-semibold block mb-1`}>
                    {language === 'hebrew' ? 'שפה' : 'Language'}
                  </label>
                  <p className={`${themeClasses.textSecondary} text-sm`}>
                    {language === 'hebrew' ? 'עברית / English' : 'Hebrew / English'}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const newLanguage = language === 'hebrew' ? 'english' : 'hebrew';
                    toggleLanguage();
                    await handleToggle('user_language', newLanguage);
                  }}
                  disabled={saving}
                  className={`px-6 py-2 rounded-lg border-2 ${themeClasses.borderPrimary} ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:border-emerald-300 transition-all`}
                >
                  {language === 'hebrew' ? 'EN' : 'עב'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
