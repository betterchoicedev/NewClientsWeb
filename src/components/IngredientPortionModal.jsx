import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

// Convert measurement using AI API
const convertMeasurementWithAI = async (ingredient, fromMeasurement, toType, targetLang = 'en', client = { region: 'israel' }) => {
  try {
    console.log('🤖 Converting measurement with AI:', { ingredient: ingredient.item || ingredient.name, fromMeasurement, toType, targetLang });

    const response = await fetch('https://dietitian-be.azurewebsites.net/api/convert-measurement', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ingredient: ingredient.item || ingredient.name,
        brand: ingredient['brand of pruduct'] || ingredient.brand || '',
        fromMeasurement,
        toType, // 'grams' or 'household'
        targetLang,
        region: (client && client.region) ? client.region : 'israel'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Measurement conversion API error:', errorText);
      throw new Error(`Failed to convert measurement: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ AI measurement conversion result:', result);
    return result;
  } catch (error) {
    console.error('❌ Error in measurement conversion:', error);
    throw error;
  }
};

const IngredientPortionModal = ({ visible, onClose, onConfirm, ingredient, clientRegion, hideHouseholdMeasure = false }) => {
  const { language, t } = useLanguage();
  const { themeClasses } = useTheme();
  const [quantity, setQuantity] = useState(100);
  const [householdMeasure, setHouseholdMeasure] = useState('');
  const [convertingMeasure, setConvertingMeasure] = useState(false);

  useEffect(() => {
    if (visible && ingredient) {
      setQuantity(ingredient['portionSI(gram)'] || 100);
      setHouseholdMeasure(ingredient.household_measure || '');
      setConvertingMeasure(false);
    }
  }, [visible, ingredient]);

  // Convert from grams to household measure
  const handleConvertToHousehold = async () => {
    if (!ingredient || !quantity || quantity <= 0) {
      alert(language === 'hebrew' ? 'אנא הזן כמות בגרם' : 'Please enter a quantity in grams');
      return;
    }

    try {
      setConvertingMeasure(true);
      const result = await convertMeasurementWithAI(
        ingredient,
        `${quantity}g`,
        'household',
        language === 'hebrew' ? 'he' : 'en',
        { region: clientRegion || 'israel' }
      );

      console.log('📦 Conversion result (grams to household):', result);
      
      if (result) {
        const measure = result.converted_measurement || 
                       result.household_measure || 
                       result.measure || 
                       result.householdMeasure || 
                       result.text || 
                       result.result ||
                       (typeof result === 'string' ? result : '');
        
        if (measure && measure.trim()) {
          console.log('✅ Setting household measure to:', measure);
          setHouseholdMeasure(measure.trim());
        } else {
          console.warn('⚠️ No household measure found in result:', JSON.stringify(result, null, 2));
          alert(language === 'hebrew' ? 'לא ניתן להמיר את המידה' : 'Could not convert measurement');
        }
      }
    } catch (error) {
      console.error('Error converting measurement:', error);
      alert(language === 'hebrew' ? 'שגיאה בהמרת המידה. נסה שוב.' : 'Error converting measurement. Please try again.');
    } finally {
      setConvertingMeasure(false);
    }
  };

  // Convert from household measure to grams
  const handleConvertToGrams = async () => {
    if (!ingredient || !householdMeasure || !householdMeasure.trim()) {
      alert(language === 'hebrew' ? 'אנא הזן מידה ביתית' : 'Please enter a household measure');
      return;
    }

    try {
      setConvertingMeasure(true);
      const result = await convertMeasurementWithAI(
        ingredient,
        householdMeasure.trim(),
        'grams',
        language === 'hebrew' ? 'he' : 'en',
        { region: clientRegion || 'israel' }
      );

      console.log('📦 Conversion result (household to grams):', result);
      
      if (result) {
        // The API should return grams in converted_measurement or similar field
        const gramsText = result.converted_measurement || 
                         result.grams || 
                         result.measure || 
                         result.text || 
                         result.result ||
                         (typeof result === 'string' ? result : '');
        
        // Extract numeric value from the result (e.g., "100g" -> 100)
        if (gramsText) {
          const gramsMatch = gramsText.toString().match(/(\d+(?:\.\d+)?)/);
          if (gramsMatch) {
            const gramsValue = parseFloat(gramsMatch[1]);
            console.log('✅ Setting quantity to:', gramsValue);
            setQuantity(gramsValue);
          } else {
            console.warn('⚠️ Could not extract grams from result:', gramsText);
            alert(language === 'hebrew' ? 'לא ניתן להמיר את המידה' : 'Could not convert measurement');
          }
        } else {
          console.warn('⚠️ No grams found in result:', JSON.stringify(result, null, 2));
          alert(language === 'hebrew' ? 'לא ניתן להמיר את המידה' : 'Could not convert measurement');
        }
      }
    } catch (error) {
      console.error('Error converting measurement:', error);
      alert(language === 'hebrew' ? 'שגיאה בהמרת המידה. נסה שוב.' : 'Error converting measurement. Please try again.');
    } finally {
      setConvertingMeasure(false);
    }
  };

  const handleConfirm = () => {
    if (!ingredient) return;
    onConfirm({ quantity, householdMeasure });
  };

  if (!visible || !ingredient) return null;

  // Calculate original 100g values
  const originalScale = (ingredient['portionSI(gram)'] || 100) / 100;
  const original100gCalories = (ingredient.calories || 0) / originalScale;
  const original100gProtein = (ingredient.protein || 0) / originalScale;
  const original100gCarbs = (ingredient.carbs || 0) / originalScale;
  const original100gFat = (ingredient.fat || 0) / originalScale;

  // Calculate new values
  const newScale = quantity / 100;
  const newCalories = Math.round(original100gCalories * newScale);
  const newProtein = Math.round(original100gProtein * newScale * 10) / 10;
  const newCarbs = Math.round(original100gCarbs * newScale * 10) / 10;
  const newFat = Math.round(original100gFat * newScale * 10) / 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className={`${themeClasses.bgCard} rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className={`${themeClasses.textPrimary} text-2xl font-bold`}>
              {language === 'hebrew' ? 'ערוך כמות' : 'Edit Portion'}
            </h2>
            <p className={`${themeClasses.textSecondary} text-sm mt-1`}>
              {ingredient.item || ingredient.name || 'Unknown item'}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`${themeClasses.textSecondary} hover:${themeClasses.textPrimary} transition-colors`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div>
              <label className={`${themeClasses.textPrimary} block text-sm font-semibold mb-2`}>
                {language === 'hebrew' ? 'כמות (גרם)' : 'Quantity (grams)'}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  min="1"
                  className={`flex-1 px-4 py-3 rounded-lg border-2 ${themeClasses.inputBg} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
                />
                {!hideHouseholdMeasure && (
                  <button
                    onClick={handleConvertToHousehold}
                    disabled={convertingMeasure || !quantity || quantity <= 0}
                    className={`px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap`}
                    title={language === 'hebrew' ? 'המר למידה ביתית' : 'Convert to household measure'}
                  >
                    {convertingMeasure ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <span className="text-sm">→ {language === 'hebrew' ? 'ביתית' : 'Household'}</span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {!hideHouseholdMeasure && (
              <div>
                <label className={`${themeClasses.textPrimary} block text-sm font-semibold mb-2`}>
                  {language === 'hebrew' ? 'מידה ביתית' : 'Household Measure'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={householdMeasure}
                    onChange={(e) => setHouseholdMeasure(e.target.value)}
                    placeholder={language === 'hebrew' ? 'לדוגמה: 1 כוס, 2 כפות' : 'e.g., 1 cup, 2 tbsp'}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 ${themeClasses.inputBg} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
                  />
                  <button
                    onClick={handleConvertToGrams}
                    disabled={convertingMeasure || !householdMeasure || !householdMeasure.trim()}
                    className={`px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap`}
                    title={language === 'hebrew' ? 'המר לגרם' : 'Convert to grams'}
                  >
                    {convertingMeasure ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <span className="text-sm">→ {language === 'hebrew' ? 'גרם' : 'Grams'}</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Current vs New Nutrition */}
            <div className={`${themeClasses.bgSecondary} rounded-lg p-4`}>
              <h3 className={`${themeClasses.textPrimary} font-semibold mb-3`}>
                {language === 'hebrew' ? 'ערכים תזונתיים' : 'Nutritional Values'}
              </h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className={themeClasses.textSecondary}>
                    {language === 'hebrew' ? 'קלוריות: ' : 'Calories: '}
                  </span>
                  <div className="flex gap-2">
                    <span className={themeClasses.textMuted} style={{ textDecoration: 'line-through' }}>
                      {ingredient.calories || 0}
                    </span>
                    <span className={`${themeClasses.textPrimary} font-semibold`}>
                      → {newCalories}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className={themeClasses.textSecondary}>
                    {language === 'hebrew' ? 'חלבון: ' : 'Protein: '}
                  </span>
                  <div className="flex gap-2">
                    <span className={themeClasses.textMuted} style={{ textDecoration: 'line-through' }}>
                      {ingredient.protein || 0}g
                    </span>
                    <span className={`${themeClasses.textPrimary} font-semibold`}>
                      → {newProtein}g
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className={themeClasses.textSecondary}>
                    {language === 'hebrew' ? 'פחמימות: ' : 'Carbs: '}
                  </span>
                  <div className="flex gap-2">
                    <span className={themeClasses.textMuted} style={{ textDecoration: 'line-through' }}>
                      {ingredient.carbs || 0}g
                    </span>
                    <span className={`${themeClasses.textPrimary} font-semibold`}>
                      → {newCarbs}g
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className={themeClasses.textSecondary}>
                    {language === 'hebrew' ? 'שומן: ' : 'Fat: '}
                  </span>
                  <div className="flex gap-2">
                    <span className={themeClasses.textMuted} style={{ textDecoration: 'line-through' }}>
                      {ingredient.fat || 0}g
                    </span>
                    <span className={`${themeClasses.textPrimary} font-semibold`}>
                      → {newFat}g
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className={`px-6 py-2 rounded-lg ${themeClasses.bgSecondary} ${themeClasses.textPrimary} hover:opacity-80 transition-opacity`}
          >
            {language === 'hebrew' ? 'ביטול' : 'Cancel'}
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            {language === 'hebrew' ? 'שמור' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IngredientPortionModal;

