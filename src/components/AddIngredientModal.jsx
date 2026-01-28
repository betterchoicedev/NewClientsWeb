import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { searchFoods } from '../supabase/secondaryClient';
import { getWeightValidation } from '../utils/weightValidation';

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

const AddIngredientModal = ({ visible, onClose, onAddIngredient, mealName, clientRegion }) => {
  const { language, t } = useLanguage();
  const { themeClasses } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [convertingMeasure, setConvertingMeasure] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState(100);
  const [householdMeasure, setHouseholdMeasure] = useState('');

  // Real-time weight validation when quantity (grams) changes - shown in modal before Add
  const weightValidation = selectedFood ? getWeightValidation(quantity, language) : null;

  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedFood(null);
      setQuantity(100);
      setHouseholdMeasure('');
      setConvertingMeasure(false);
    }
  }, [visible]);

  // Convert from grams to household measure
  const handleConvertToHousehold = async () => {
    if (!selectedFood || !quantity || quantity <= 0) {
      alert(language === 'hebrew' ? 'אנא הזן כמות בגרם' : 'Please enter a quantity in grams');
      return;
    }

    try {
      setConvertingMeasure(true);
      const result = await convertMeasurementWithAI(
        selectedFood,
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
    if (!selectedFood || !householdMeasure || !householdMeasure.trim()) {
      alert(language === 'hebrew' ? 'אנא הזן מידה ביתית' : 'Please enter a household measure');
      return;
    }

    try {
      setConvertingMeasure(true);
      const result = await convertMeasurementWithAI(
        selectedFood,
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

  useEffect(() => {
    const searchFood = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await searchFoods(searchQuery, 20);
        if (error) {
          console.error('Error searching foods:', error);
          setSearchResults([]);
        } else {
          setSearchResults(data || []);
        }
      } catch (err) {
        console.error('Unexpected error searching foods:', err);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      searchFood();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleSelectFood = (food) => {
    setSelectedFood(food);
    setQuantity(100); // Default to 100g
    setHouseholdMeasure(''); // Clear household measure
  };

  const handleAdd = () => {
    if (!selectedFood) return;

    // Calculate nutrition for the specified quantity
    const scale = quantity / 100; // Assuming food data is per 100g
    const ingredient = {
      UPC: selectedFood.upc || null,
      item: selectedFood.name || selectedFood.item,
      'brand of pruduct': selectedFood.brand || '',
      household_measure: householdMeasure || selectedFood.household_measure || '',
      'portionSI(gram)': quantity,
      calories: Math.round((selectedFood.calories || 0) * scale),
      protein: Math.round(((selectedFood.protein || 0) * scale) * 10) / 10,
      carbs: Math.round(((selectedFood.carbs || 0) * scale) * 10) / 10,
      fat: Math.round(((selectedFood.fat || 0) * scale) * 10) / 10,
    };

    onAddIngredient(ingredient);
    onClose();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className={`${themeClasses.bgCard} rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            {mealName ? (
              <>
                <h2 className={`${themeClasses.textPrimary} text-3xl font-bold mb-1`}>
                  {mealName}
                </h2>
                <p className={`${themeClasses.textSecondary} text-sm`}>
                  {language === 'hebrew' ? 'הוסף מרכיב' : 'Add Ingredient'}
                </p>
              </>
            ) : (
              <h2 className={`${themeClasses.textPrimary} text-3xl font-bold mb-1`}>
                {language === 'hebrew' ? 'הוסף מרכיב' : 'Add Ingredient'}
              </h2>
            )}
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
          {/* Search - Only show if no ingredient is selected */}
          {!selectedFood && (
            <div className="mb-6">
              <label className={`${themeClasses.textPrimary} block text-sm font-semibold mb-2`}>
                {language === 'hebrew' ? 'חפש מרכיב' : 'Search Ingredient'}
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'hebrew' ? 'הקלד שם מרכיב...' : 'Type ingredient name...'}
                className={`w-full px-4 py-3 rounded-lg border-2 ${themeClasses.inputBg} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
              />
            </div>
          )}

          {/* Search Results - Only show if no ingredient is selected */}
          {!selectedFood && (
            <>
              {loading && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto"></div>
                  <p className={`${themeClasses.textSecondary} mt-2`}>
                    {language === 'hebrew' ? 'מחפש...' : 'Searching...'}
                  </p>
                </div>
              )}

              {!loading && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <div className="text-center py-8">
                  <p className={`${themeClasses.textSecondary}`}>
                    {language === 'hebrew' ? 'לא נמצאו תוצאות' : 'No results found'}
                  </p>
                </div>
              )}

              {!loading && searchResults.length > 0 && (
                <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                  {searchResults.map((food) => (
                    <button
                      key={food.id}
                      onClick={() => handleSelectFood(food)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedFood?.id === food.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                          : `${themeClasses.bgSecondary} border-gray-200 dark:border-gray-700 hover:border-emerald-300`
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className={`${themeClasses.textPrimary} font-semibold`}>
                            {food.name || food.item}
                          </p>
                          {food.brand && (
                            <p className={`${themeClasses.textSecondary} text-sm`}>
                              {food.brand}
                            </p>
                          )}
                          <div className="flex gap-4 mt-2 text-xs">
                            <span className={themeClasses.textSecondary}>
                              {food.calories || 0} {language === 'hebrew' ? 'קלוריות' : 'cal'}
                            </span>
                            <span className={themeClasses.textSecondary}>
                              {food.protein || 0}g {language === 'hebrew' ? 'חלבון' : 'protein'}
                            </span>
                          </div>
                        </div>
                        {selectedFood?.id === food.id && (
                          <div className="ml-4">
                            <svg className="w-6 h-6 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Selected Food Details */}
          {selectedFood && (
            <div className={`${themeClasses.bgSecondary} rounded-lg p-4 mb-6`}>
              <h3 className={`${themeClasses.textPrimary} font-semibold mb-3`}>
                {language === 'hebrew' ? 'פרטי המרכיב' : 'Ingredient Details'}
              </h3>
              
              <div className="space-y-4">
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
                      className={`flex-1 px-4 py-2 rounded-lg border-2 ${themeClasses.inputBg} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
                    />
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
                  </div>
                  {/* Real-time weight validation - shown as user changes grams */}
                  {weightValidation && (
                    <div className={`mt-2 p-3 rounded-lg flex items-center gap-2 ${
                      weightValidation.severity === 'error'
                        ? 'bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400'
                        : 'bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400'
                    }`}>
                      <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        {weightValidation.severity === 'error' ? (
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        )}
                      </svg>
                      <span className="text-sm font-medium">{weightValidation.message}</span>
                    </div>
                  )}
                </div>

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
                      className={`flex-1 px-4 py-2 rounded-lg border-2 ${themeClasses.inputBg} ${themeClasses.textPrimary} focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800`}
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

                {/* Calculated Nutrition */}
                <div className={`${themeClasses.bgCard} rounded-lg p-3`}>
                  <p className={`${themeClasses.textSecondary} text-sm mb-2`}>
                    {language === 'hebrew' ? 'ערכים תזונתיים (לכמות שנבחרה)' : 'Nutritional Values (for selected quantity)'}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'קלוריות: ' : 'Calories: '}
                      </span>
                      <span className={`${themeClasses.textPrimary} font-semibold`}>
                        {Math.round((selectedFood.calories || 0) * (quantity / 100))}
                      </span>
                    </div>
                    <div>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'חלבון: ' : 'Protein: '}
                      </span>
                      <span className={`${themeClasses.textPrimary} font-semibold`}>
                        {Math.round(((selectedFood.protein || 0) * (quantity / 100)) * 10) / 10}g
                      </span>
                    </div>
                    <div>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'פחמימות: ' : 'Carbs: '}
                      </span>
                      <span className={`${themeClasses.textPrimary} font-semibold`}>
                        {Math.round(((selectedFood.carbs || 0) * (quantity / 100)) * 10) / 10}g
                      </span>
                    </div>
                    <div>
                      <span className={themeClasses.textSecondary}>
                        {language === 'hebrew' ? 'שומן: ' : 'Fat: '}
                      </span>
                      <span className={`${themeClasses.textPrimary} font-semibold`}>
                        {Math.round(((selectedFood.fat || 0) * (quantity / 100)) * 10) / 10}g
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
            onClick={handleAdd}
            disabled={!selectedFood}
            className={`px-6 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {language === 'hebrew' ? 'הוסף' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddIngredientModal;

