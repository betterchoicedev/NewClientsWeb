import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import AddIngredientModal from '../AddIngredientModal';
import IngredientPortionModal from '../IngredientPortionModal';
import TrainingPlanTab from './TrainingPlanTab';
import { translateMenu } from '../../services/translateService';
import {
  CREATE_MEAL_PLAN_API_URL,
  getTrainingPlan,
  getClientMealPlan,
  WeeklyMealSchedule,
  CalendarPicker,
} from '../../pages/ProfilePage';

// My Plan Tab Component
const MyPlanTab = ({ themeClasses, t, userCode, language, clientRegion }) => {
  const { settings } = useSettings();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('mealPlan'); // 'mealPlan' or 'trainingPlan'
  const [loading, setLoading] = useState(true);
  const [planData, setPlanData] = useState(null);
  const [originalPlanData, setOriginalPlanData] = useState(null);
  const [error, setError] = useState('');
  const [allPlans, setAllPlans] = useState([]); // All meal plans
  const [selectedDay, setSelectedDay] = useState(new Date().getDay()); // Default to today
  const [expandedMeals, setExpandedMeals] = useState({});
  const [expandedAlternatives, setExpandedAlternatives] = useState({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [trainingPlanData, setTrainingPlanData] = useState(null);
  const [trainingPlanLoading, setTrainingPlanLoading] = useState(false);
  const [trainingPlanError, setTrainingPlanError] = useState('');
  
  // Menu generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState('');
  const [clientData, setClientData] = useState(null);
  const [isContactingDietitian, setIsContactingDietitian] = useState(false);
  
  // Helper function to format numbers with decimal places
  const formatNumber = (num) => {
    if (settings.decimalPlaces === 0) {
      return Math.round(num).toString();
    }
    return num.toFixed(settings.decimalPlaces);
  };
  
  // Helper function to convert weight based on weightUnit setting
  const convertWeight = (grams) => {
    if (settings.weightUnit === 'ounces') {
      // Convert grams to ounces (1 gram = 0.035274 ounces)
      return grams * 0.035274;
    }
    return grams; // Return grams if weightUnit is 'grams'
  };
  
  // Helper function to get weight unit label
  const getWeightUnit = () => {
    return settings.weightUnit === 'ounces' ? 'oz' : 'g';
  };
  
  // Helper function to format weight with unit
  const formatWeight = (grams) => {
    const value = convertWeight(grams);
    const unit = getWeightUnit();
    return `${formatNumber(value)}${unit}`;
  };
  
  // Helper function to format portion display
  const formatPortion = (ingredient) => {
    const portion = ingredient['portionSI(gram)'] || 0;
    const household = ingredient.household_measure || '';
    const convertedPortion = convertWeight(portion);
    const unit = getWeightUnit();
    
    if (settings.portionDisplay === 'grams') {
      return `${formatNumber(convertedPortion)}${unit}`;
    } else if (settings.portionDisplay === 'household') {
      return household || `${formatNumber(convertedPortion)}${unit}`;
    } else { // both
      if (household) {
        return `${household} (${formatNumber(convertedPortion)}${unit})`;
      }
      return `${formatNumber(convertedPortion)}${unit}`;
    }
  };
  const [isAddIngredientModalVisible, setIsAddIngredientModalVisible] = useState(false);
  const [selectedMealIndex, setSelectedMealIndex] = useState(null);
  const [isEditPortionModalVisible, setIsEditPortionModalVisible] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [editingIngredientIndex, setEditingIngredientIndex] = useState(null);
  // Alternative meal editing state
  const [selectedAlternativeMealIndex, setSelectedAlternativeMealIndex] = useState(null);
  const [selectedAlternativeType, setSelectedAlternativeType] = useState(null); // 'alternative' or 'alternatives'
  const [selectedAlternativeIndex, setSelectedAlternativeIndex] = useState(null); // For alternatives array
  const [isAddAlternativeIngredientModalVisible, setIsAddAlternativeIngredientModalVisible] = useState(false);
  const [isEditAlternativePortionModalVisible, setIsEditAlternativePortionModalVisible] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');

  // Load training plan when trainingPlan sub-tab is active
  useEffect(() => {
    const loadTrainingPlan = async () => {
      if (!userCode || activeSubTab !== 'trainingPlan') {
        return;
      }

      if (trainingPlanData) {
        return; // Already loaded
      }

      try {
        setTrainingPlanLoading(true);
        setTrainingPlanError('');
        const { data, error } = await getTrainingPlan(userCode);
        
        if (error) {
          console.error('Error loading training plan:', error);
          setTrainingPlanError(error.message);
        } else {
          setTrainingPlanData(data);
        }
      } catch (err) {
        console.error('Error loading training plan:', err);
        setTrainingPlanError(err.message || 'Failed to load training plan');
      } finally {
        setTrainingPlanLoading(false);
      }
    };

    loadTrainingPlan();
  }, [userCode, activeSubTab, trainingPlanData]);

  // Helper function to get meal plan for a specific day
  const getMealPlanForDay = (dayIndex, plans) => {
    if (!plans || !Array.isArray(plans)) return null;
    
    // Find the first plan that is active for this day
    const dayPlan = plans.find(plan => {
      // If active_days is null, it means it's active every day
      if (plan.active_days === null) return true;
      
      // Handle both string and number arrays (database might return strings)
      const activeDays = Array.isArray(plan.active_days) 
        ? plan.active_days.map(day => typeof day === 'string' ? parseInt(day, 10) : day)
        : [];
      
      return activeDays.includes(dayIndex);
    });
    
    return dayPlan || null;
  };

  // Process and set meal plan data for a specific plan
  const processAndSetMealPlan = async (planDataItem) => {
    if (!planDataItem || !planDataItem.meal_plan) {
      return null;
    }

    let mealPlan = planDataItem.meal_plan;

    // Use totals from meal_plan (meal_plans_and_schemas.meal_plan column) when present
    const rawTotals = mealPlan.totals && typeof mealPlan.totals === 'object' ? mealPlan.totals : null;
    const totalsFromPlan = rawTotals != null && (typeof rawTotals.calories === 'number' || !isNaN(Number(rawTotals.calories)))
      ? {
          calories: Number(rawTotals.calories),
          protein: Number(rawTotals.protein ?? 0),
          carbs: Number(rawTotals.carbs ?? 0),
          fat: Number(rawTotals.fat ?? 0)
        }
      : null;
    
    if (mealPlan && mealPlan.meals) {
      // Translate meal plan if language is Hebrew
      if (language === 'hebrew') {
        try {
          setIsTranslating(true);
          console.log('🌐 Starting translation for meal plan with', mealPlan.meals.length, 'meals');
          
          const translatedMealPlan = await translateMenu(mealPlan, 'he');
          
          if (translatedMealPlan && translatedMealPlan.meals) {
            mealPlan = translatedMealPlan;
            console.log('✅ Meal plan translated to Hebrew successfully');
          }
        } catch (translateError) {
          console.error('❌ Translation error (using original):', translateError);
        } finally {
          setIsTranslating(false);
        }
      }

      // Prefer totals from meal_plan column (meal_plans_and_schemas), else calculate from meals
      const totals = totalsFromPlan || mealPlan.meals.reduce((acc, meal) => {
        if (meal.main && meal.main.nutrition) {
          acc.calories += meal.main.nutrition.calories || 0;
          acc.protein += meal.main.nutrition.protein || 0;
          acc.carbs += meal.main.nutrition.carbs || 0;
          acc.fat += meal.main.nutrition.fat || 0;
        }
        return acc;
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

      return {
        ...planDataItem,
        totals,
        meals: mealPlan.meals,
        note: mealPlan.note || '' // Include notes from meal plan
      };
    } else if (mealPlan && mealPlan.template) {
      // Prefer totals from meal_plan column, else calculate from template
      const totals = totalsFromPlan || mealPlan.template.reduce((acc, meal) => {
        acc.calories += meal.main.calories;
        acc.protein += meal.main.protein;
        acc.carbs += meal.main.carbs;
        acc.fat += meal.main.fat;
        return acc;
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

      return {
        ...planDataItem,
        totals,
        meals: mealPlan.template,
        note: mealPlan.note || '' // Include notes from meal plan
      };
    }

    // Meal plan has totals but no meals/template (e.g. schema-only); still return plan with totals
    if (totalsFromPlan) {
      return {
        ...planDataItem,
        totals: totalsFromPlan,
        meals: [],
        note: mealPlan.note || ''
      };
    }
    
    return null;
  };

  // Effect to load all meal plans
  useEffect(() => {
    const loadMealPlan = async () => {
      if (!userCode) {
        setError('User code not available');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await getClientMealPlan(userCode);
        
        if (error) {
          console.error('Error loading meal plan:', error);
          setError(error.message);
        } else if (data) {
          // Store all plans
          const plans = data.allPlans || [];
          setAllPlans(plans);
          
          // Get meal plan for selected day (default to today)
          const dayPlan = getMealPlanForDay(selectedDay, plans);
          
          if (dayPlan) {
            const processedPlan = await processAndSetMealPlan(dayPlan);
            if (processedPlan) {
              setPlanData(processedPlan);
              // Initialize notes value
              setNotesValue(processedPlan.note || '');
              
              // Store original dietitian plan if user has edited plan
              if (dayPlan.dietitian_meal_plan && dayPlan.dietitian_meal_plan.meals && dayPlan.isClientEdited) {
                const originalTotals = dayPlan.dietitian_meal_plan.meals.reduce((acc, meal) => {
                  if (meal.main && meal.main.nutrition) {
                    acc.calories += meal.main.nutrition.calories || 0;
                    acc.protein += meal.main.nutrition.protein || 0;
                    acc.carbs += meal.main.nutrition.carbs || 0;
                    acc.fat += meal.main.nutrition.fat || 0;
                  }
                  return acc;
                }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

                setOriginalPlanData({
                  ...dayPlan,
                  totals: originalTotals,
                  meals: dayPlan.dietitian_meal_plan.meals,
                  isClientEdited: false
                });
              }
            } else {
              setError('No meal plan template found');
            }
          } else {
            setError('No active meal plan found for selected day');
          }
        } else {
          setError('No active meal plan found');
        }
      } catch (err) {
        console.error('Unexpected error loading meal plan:', err);
        setError('Failed to load meal plan');
      } finally {
        setLoading(false);
      }
    };

    loadMealPlan();
  }, [userCode, language]);

  // Effect to update plan data when selected day changes
  useEffect(() => {
    const updatePlanForDay = async () => {
      if (!allPlans || allPlans.length === 0) return;
      
      // Reset notes editing state when day changes
      setIsEditingNotes(false);
      
      const dayPlan = getMealPlanForDay(selectedDay, allPlans);
      
      if (dayPlan) {
        const processedPlan = await processAndSetMealPlan(dayPlan);
        if (processedPlan) {
          setPlanData(processedPlan);
          // Update notes value when plan changes
          setNotesValue(processedPlan.note || '');
          
          // Store original dietitian plan if user has edited plan
          if (dayPlan.dietitian_meal_plan && dayPlan.dietitian_meal_plan.meals && dayPlan.isClientEdited) {
            const originalTotals = dayPlan.dietitian_meal_plan.meals.reduce((acc, meal) => {
              if (meal.main && meal.main.nutrition) {
                acc.calories += meal.main.nutrition.calories || 0;
                acc.protein += meal.main.nutrition.protein || 0;
                acc.carbs += meal.main.nutrition.carbs || 0;
                acc.fat += meal.main.nutrition.fat || 0;
              }
              return acc;
            }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

            setOriginalPlanData({
              ...dayPlan,
              totals: originalTotals,
              meals: dayPlan.dietitian_meal_plan.meals,
              isClientEdited: false
            });
          }
        }
      } else {
        setPlanData(null);
      }
    };

    updatePlanForDay();
  }, [selectedDay, allPlans, language]);

  // Load client data for menu generation
  useEffect(() => {
    const loadClientData = async () => {
      if (!userCode) return;
      
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
        const response = await fetch(`${apiUrl}/api/profile/client-data-full?userCode=${encodeURIComponent(userCode)}`);
        const result = await response.json();
        
        if (!response.ok) {
          console.error('Error loading client data:', result.error);
          return;
        }
        
        setClientData(result.data);
      } catch (err) {
        console.error('Error fetching client data:', err);
      }
    };
    
    loadClientData();
  }, [userCode]);

  // Function to calculate totals from meals
  const calculateMainTotals = (menu) => {
    if (!menu || !menu.meals) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    
    return menu.meals.reduce((acc, meal) => {
      if (meal.main && meal.main.nutrition) {
        acc.calories += meal.main.nutrition.calories || 0;
        acc.protein += meal.main.nutrition.protein || 0;
        acc.carbs += meal.main.nutrition.carbs || 0;
        acc.fat += meal.main.nutrition.fat || 0;
      }
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  // Generate menu function
  const generateMenu = async () => {
    if (!userCode || !clientData) {
      setError(language === 'hebrew' ? 'נתוני משתמש חסרים' : 'User data missing');
      return;
    }

    // Check if client has daily_target_total_calories
    if (!clientData.daily_target_total_calories) {
      setError(language === 'hebrew' 
        ? 'אנא השלם את תהליך ההזנה הראשוני כדי לחשב יעדים תזונתיים'
        : 'Please complete the onboarding process to calculate nutritional targets');
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);
      setGenerationProgress(0);
      setGenerationStep(language === 'hebrew' ? 'מתחיל...' : 'Initializing...');

      console.log('🧠 Generating menu for user:', userCode);
      console.log('🔍 Client data:', clientData);

      // Single-step meal plan generation (same flow as onboarding modal)
      setGenerationProgress(10);
      setGenerationStep(language === 'hebrew' ? '🍽️ יוצר ארוחות מותאמות אישית...' : '🍽️ Creating personalized meals...');

      // Gradual progress animation
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 99) {
            clearInterval(progressInterval);
            return 99;
          }
          return prev + 1;
        });
      }, 2000);

      const createRes = await fetch(CREATE_MEAL_PLAN_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_code: userCode })
      });

      clearInterval(progressInterval);

      if (!createRes.ok) {
        const errText = await createRes.text().catch(() => '');
        console.error('❌ Create meal plan API error response:', errText);
        throw new Error(language === 'hebrew'
          ? `שגיאה ביצירת תפריט (${createRes.status})`
          : `Unable to create menu (Error ${createRes.status})`);
      }

      const raw = await createRes.json();

      if (raw.error) {
        throw new Error(typeof raw.error === 'string' ? raw.error : JSON.stringify(raw.error));
      }

      const payload = raw.data ?? raw.result ?? raw;

      const menu =
        payload.menu ??
        payload.meals ??
        payload.meal_plan?.meals ??
        (Array.isArray(payload.meal_plan) ? payload.meal_plan : null);

      if (!menu || !Array.isArray(menu)) {
        throw new Error(language === 'hebrew' ? 'לא נוצרו ארוחות' : 'No meals were created');
      }

      const template =
        payload.template ?? payload.schema ?? payload.meal_plan?.template ?? null;

      setGenerationProgress(60);
      setGenerationStep(language === 'hebrew' ? '🔢 מחשב ערכים תזונתיים...' : '🔢 Calculating nutrition values...');

      const menuData = {
        meals: menu,
        totals:
          payload.totals ??
          payload.meal_plan?.totals ??
          calculateMainTotals({ meals: menu }),
        note: payload.note ?? payload.meal_plan?.note ?? ''
      };

      setGenerationProgress(70);
      setGenerationStep(language === 'hebrew' ? '💾 שומר תפריט...' : '💾 Saving menu...');

      // Auto-save to both databases immediately
      console.log('💾 Auto-saving menu data:', menuData);
      
      const newPlanId = crypto.randomUUID();
      const now = new Date().toISOString();
      const dailyCalories = clientData.daily_target_total_calories || null;
      const macros = clientData.macros || null;
      
      // Get client name for meal plan name
      const clientName = clientData.full_name || 
                        (clientData.first_name && clientData.last_name ? `${clientData.first_name} ${clientData.last_name}`.trim() : '') ||
                        clientData.first_name || 
                        clientData.last_name || 
                        'Client';
      const mealPlanName = `${clientName}'s Meal Plan`;

      // Save to both databases via API
      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
      const saveResponse = await fetch(`${apiUrl}/api/profile/meal-plan/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: newPlanId,
          userCode,
          mealPlanName,
          template,
          menuData,
          dailyCalories,
          macros
        })
      });

      const saveResult = await saveResponse.json();

      if (!saveResponse.ok) {
        console.error('❌ Error saving meal plan:', saveResult.error);
        throw new Error(language === 'hebrew' 
          ? 'שגיאה בשמירת תוכנית התזונה'
          : 'Error saving meal plan');
      }

      console.log('✅ Menu saved successfully to both databases!');

      setGenerationProgress(85);
      setGenerationStep(language === 'hebrew' ? '🌐 מכין תצוגה...' : '🌐 Preparing display...');

      // Translate if needed
      if (language === 'hebrew') {
        setGenerationStep(language === 'hebrew' ? '🌐 מתרגם לעברית...' : '🌐 Translating to Hebrew...');
        const translatedMenu = await translateMenu(menuData, 'he');
        setPlanData({
          meal_plan: translatedMenu,
          totals: menuData.totals,
          meals: translatedMenu.meals
        });
      } else {
        setPlanData({
          meal_plan: menuData,
          totals: menuData.totals,
          meals: menuData.meals
        });
      }

      setGenerationProgress(100);
      setGenerationStep(language === 'hebrew' ? '🎉 התפריט מוכן ונשמר!' : '🎉 Menu saved successfully!');

      // Clear progress and reload to show the saved meal plan
      setTimeout(() => {
        setGenerationProgress(0);
        setGenerationStep('');
        setError(null);
        window.location.reload();
      }, 1500);

    } catch (err) {
      console.error("Error generating menu:", err);
      setError(err.message || (language === 'hebrew' 
        ? 'שגיאה ביצירת תפריט. אנא נסה שוב.'
        : 'Error generating menu. Please try again.'));
      setGenerationProgress(0);
      setGenerationStep('');
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className={`${themeClasses.textSecondary}`}>
            {isTranslating 
              ? (language === 'hebrew' ? 'מתרגם תוכנית תזונה...' : 'Translating meal plan...') 
              : t.profile.myPlanTab.loading
            }
          </p>
        </div>
      </div>
    );
  }

  if (error || !planData) {
    return (
      <div className={`min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn flex items-center justify-center`}>
        <div className="max-w-2xl w-full">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/25 animate-pulse">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
        </div>
          </div>

          {/* Title */}
          <h2 className={`${themeClasses.textPrimary} text-3xl sm:text-4xl font-bold text-center mb-4`}>
            {language === 'hebrew' ? 'אין תוכנית תזונה זמינה' : 'No Meal Plan Available'}
          </h2>

          {/* Description */}
          <div className={`${themeClasses.textSecondary} text-center space-y-4 mb-8`}>
            <p className="text-lg sm:text-xl">
              {language === 'hebrew' 
                ? 'עדיין אין לכם תוכנית תזונה מותאמת אישית.'
                : 'You don\'t have a personalized meal plan yet.'
              }
            </p>
            
      </div>

          {/* Generate Menu Button - Only show if onboarding is fully completed */}
          {clientData && 
           clientData.onboarding_completed && 
           clientData.meal_plan_structure && 
           clientData.meal_plan_structure.length > 0 && (
            <div className="mb-8">
              <button
                onClick={generateMenu}
                disabled={isGenerating}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg ${
                  isGenerating
                    ? 'bg-gray-600 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 transform hover:scale-105'
                } text-white flex items-center justify-center gap-3`}
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    <span>{generationStep || (language === 'hebrew' ? 'יוצר תפריט...' : 'Generating Menu...')}</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">🎯</span>
                    <span>{language === 'hebrew' ? 'צור תפריט אוטומטי' : 'Generate Automatic Menu'}</span>
                  </>
                )}
              </button>
              
              {/* Progress Bar */}
              {isGenerating && generationProgress > 0 && (
                <div className="mt-4">
                  <div className="w-full bg-gray-700/50 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-3 rounded-full transition-all duration-500 ease-out shadow-lg shadow-emerald-500/50"
                      style={{ width: `${generationProgress}%` }}
                    ></div>
                  </div>
                  <p className={`${themeClasses.textSecondary} text-sm text-center mt-2`}>
                    {Math.round(generationProgress)}% - {generationStep}
                  </p>
                </div>
              )}
              
              {/* Error Message */}
              {error && !isGenerating && (
                <div className="mt-4 p-4 bg-red-500/10 border-2 border-red-500/30 text-red-400 rounded-xl backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">{error}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Onboarding Required Message */}
          {clientData && !clientData.onboarding_completed && (
            <div className="mb-8">
              <div className={`${themeClasses.bgSecondary} rounded-xl p-6 border-2 border-amber-500/50 shadow-lg`}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className={`${themeClasses.textPrimary} font-bold text-lg mb-2`}>
                      {language === 'hebrew' ? 'השלם את תהליך ההזנה הראשוני' : 'Complete Your Onboarding'}
                    </h3>
                    <p className={`${themeClasses.textSecondary} text-sm mb-3`}>
                      {language === 'hebrew'
                        ? 'כדי ליצור תפריט אוטומטי, אנא השלם את כל השדות בתהליך ההזנה הראשוני בעמוד הפרופיל.'
                        : 'To generate an automatic menu, please complete all fields in the onboarding process on your profile page.'}
                    </p>
                    <p className={`${themeClasses.textSecondary} text-xs`}>
                      {language === 'hebrew'
                        ? 'דרוש: פרטים אישיים, משקל וגובה, מטרות, העדפות תזונתיות, ומבנה ארוחות.'
                        : 'Required: Personal details, weight & height, goals, dietary preferences, and meal structure.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Calculate macro percentages based on calories (not grams)
  // Protein: 4 calories per gram, Carbs: 4 calories per gram, Fat: 9 calories per gram
  const proteinCalories = planData.totals.protein * 4;
  const carbsCalories = planData.totals.carbs * 4;
  const fatCalories = planData.totals.fat * 9;
  const totalMacroCalories = proteinCalories + carbsCalories + fatCalories;
  
  const proteinPercentage = totalMacroCalories > 0 ? Math.round((proteinCalories / totalMacroCalories) * 100) : 0;
  const carbsPercentage = totalMacroCalories > 0 ? Math.round((carbsCalories / totalMacroCalories) * 100) : 0;
  const fatPercentage = totalMacroCalories > 0 ? Math.round((fatCalories / totalMacroCalories) * 100) : 0;

  // Get meal icons
  const getMealIcon = (mealName) => {
    const name = mealName.toLowerCase();
    if (name.includes('breakfast') || name.includes('בוקר')) return '🌅';
    if (name.includes('lunch') || name.includes('צהריים')) return '☀️';
    if (name.includes('dinner') || name.includes('ערב')) return '🌙';
    if (name.includes('snack') || name.includes('חטיף')) return '🍎';
    return '🍽️';
  };

  // Get meal color
  const getMealColor = (mealName) => {
    const name = mealName.toLowerCase();
    if (name.includes('breakfast') || name.includes('בוקר')) return 'text-yellow-400';
    if (name.includes('lunch') || name.includes('צהריים')) return 'text-orange-400';
    if (name.includes('dinner') || name.includes('ערב')) return 'text-blue-400';
    if (name.includes('snack') || name.includes('חטיף')) return 'text-purple-400';
    return 'text-emerald-400';
  };

  // Toggle meal expansion
  const toggleMealExpansion = (mealIndex) => {
    setExpandedMeals(prev => ({
      ...prev,
      [mealIndex]: !prev[mealIndex]
    }));
  };

  // Toggle alternatives expansion
  const toggleAlternativesExpansion = (mealIndex) => {
    setExpandedAlternatives(prev => ({
      ...prev,
      [mealIndex]: !prev[mealIndex]
    }));
  };

  // Open add ingredient modal
  const handleOpenAddIngredient = (mealIndex) => {
    setSelectedMealIndex(mealIndex);
    setIsAddIngredientModalVisible(true);
  };

  // Open add ingredient modal for alternative meal
  const handleOpenAddAlternativeIngredient = (mealIndex, alternativeType, alternativeIndex = null) => {
    setSelectedAlternativeMealIndex(mealIndex);
    setSelectedAlternativeType(alternativeType);
    setSelectedAlternativeIndex(alternativeIndex);
    setIsAddAlternativeIngredientModalVisible(true);
  };

  // Helper function to ensure originalPlanData is set before making edits
  const ensureOriginalPlanData = () => {
    if (!originalPlanData && planData) {
      // Store the current plan as the original before first edit
      const originalTotals = planData.totals || planData.meals.reduce((acc, meal) => {
        if (meal.main && meal.main.nutrition) {
          acc.calories += meal.main.nutrition.calories || 0;
          acc.protein += meal.main.nutrition.protein || 0;
          acc.carbs += meal.main.nutrition.carbs || 0;
          acc.fat += meal.main.nutrition.fat || 0;
        }
        return acc;
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

      setOriginalPlanData({
        ...planData,
        totals: originalTotals,
        meals: JSON.parse(JSON.stringify(planData.meals)), // Deep clone
        isClientEdited: false
      });
    }
  };

  // Add ingredient to meal
  const handleAddIngredient = async (ingredient) => {
    if (selectedMealIndex === null || !planData) return;

    try {
      // Ensure original plan data is stored before making edits
      ensureOriginalPlanData();

      // Clone the current plan data
      const updatedPlanData = { ...planData };
      const updatedMeals = [...updatedPlanData.meals];
      const mealToUpdate = { ...updatedMeals[selectedMealIndex] };

      // Initialize ingredients array if it doesn't exist
      if (!mealToUpdate.main.ingredients) {
        mealToUpdate.main.ingredients = [];
      }

      // Add the new ingredient
      mealToUpdate.main.ingredients = [...mealToUpdate.main.ingredients, ingredient];

      // Update nutrition values
      const currentNutrition = mealToUpdate.main.nutrition || {};
      mealToUpdate.main.nutrition = {
        calories: (currentNutrition.calories || 0) + ingredient.calories,
        protein: (currentNutrition.protein || 0) + ingredient.protein,
        carbs: (currentNutrition.carbs || 0) + ingredient.carbs,
        fat: (currentNutrition.fat || 0) + ingredient.fat,
      };

      // Update the meal in the meals array
      updatedMeals[selectedMealIndex] = mealToUpdate;
      updatedPlanData.meals = updatedMeals;

      // Recalculate totals
      const newTotals = updatedMeals.reduce(
        (acc, meal) => {
          if (meal.main && meal.main.nutrition) {
            acc.calories += meal.main.nutrition.calories || 0;
            acc.protein += meal.main.nutrition.protein || 0;
            acc.carbs += meal.main.nutrition.carbs || 0;
            acc.fat += meal.main.nutrition.fat || 0;
          }
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      updatedPlanData.totals = newTotals;
      updatedPlanData.isClientEdited = true; // Mark as edited

      // Update local state
      setPlanData(updatedPlanData);

      // Save to database
      await saveMealPlanToDatabase(updatedPlanData, updatedMeals);

      // Show success message
      alert(
        language === 'hebrew'
          ? 'המרכיב נוסף בהצלחה לתוכנית'
          : 'Ingredient added successfully to the meal plan'
      );
    } catch (error) {
      console.error('Error adding ingredient:', error);
      alert(
        language === 'hebrew'
          ? 'לא ניתן להוסיף את המרכיב. נסה שוב.'
          : 'Failed to add ingredient. Please try again.'
      );
    }
  };

  // Handle edit ingredient
  const handleEditIngredient = (mealIndex, ingredientIndex, ingredient) => {
    setSelectedMealIndex(mealIndex);
    setEditingIngredientIndex(ingredientIndex);
    setEditingIngredient({
      ...ingredient,
      displayName: ingredient.item || ingredient.name || 'Unknown item',
      calories: ingredient.calories || 0,
      protein: ingredient.protein || 0,
      carbs: ingredient.carbs || 0,
      fat: ingredient.fat || 0,
    });
    setIsEditPortionModalVisible(true);
  };

  // Handle update ingredient portion
  const handleUpdateIngredientPortion = async ({ quantity: quantityNum, householdMeasure }) => {
    if (selectedMealIndex === null || editingIngredientIndex === null || !planData || !editingIngredient) return;

    try {
      // Ensure original plan data is stored before making edits
      ensureOriginalPlanData();

      // Clone the current plan data
      const updatedPlanData = { ...planData };
      const updatedMeals = [...updatedPlanData.meals];
      const mealToUpdate = { ...updatedMeals[selectedMealIndex] };

      // Get the old ingredient to subtract its nutrition
      const oldIngredient = mealToUpdate.main.ingredients[editingIngredientIndex];

      // Calculate new scaled nutrition values based on the original 100g values
      const originalScale = (oldIngredient['portionSI(gram)'] || 100) / 100;
      const original100gCalories = oldIngredient.calories / originalScale;
      const original100gProtein = oldIngredient.protein / originalScale;
      const original100gCarbs = oldIngredient.carbs / originalScale;
      const original100gFat = oldIngredient.fat / originalScale;

      // Now calculate new values with the new quantity
      const newScale = quantityNum / 100;
      const updatedIngredient = {
        UPC: oldIngredient.UPC || null,
        item: oldIngredient.item,
        'brand of pruduct': oldIngredient['brand of pruduct'] || '',
        household_measure: householdMeasure,
        'portionSI(gram)': quantityNum,
        calories: Math.round(original100gCalories * newScale),
        protein: Math.round(original100gProtein * newScale * 10) / 10,
        carbs: Math.round(original100gCarbs * newScale * 10) / 10,
        fat: Math.round(original100gFat * newScale * 10) / 10,
      };

      // Update the ingredient in the array
      mealToUpdate.main.ingredients[editingIngredientIndex] = updatedIngredient;

      // Recalculate meal nutrition (sum all ingredients)
      mealToUpdate.main.nutrition = mealToUpdate.main.ingredients.reduce(
        (acc, ing) => ({
          calories: acc.calories + (ing.calories || 0),
          protein: acc.protein + (ing.protein || 0),
          carbs: acc.carbs + (ing.carbs || 0),
          fat: acc.fat + (ing.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      // Update the meal in the meals array
      updatedMeals[selectedMealIndex] = mealToUpdate;
      updatedPlanData.meals = updatedMeals;

      // Recalculate totals
      const newTotals = updatedMeals.reduce(
        (acc, meal) => {
          if (meal.main && meal.main.nutrition) {
            acc.calories += meal.main.nutrition.calories || 0;
            acc.protein += meal.main.nutrition.protein || 0;
            acc.carbs += meal.main.nutrition.carbs || 0;
            acc.fat += meal.main.nutrition.fat || 0;
          }
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      updatedPlanData.totals = newTotals;
      updatedPlanData.isClientEdited = true; // Mark as edited

      // Update local state
      setPlanData(updatedPlanData);

      // Save to database
      await saveMealPlanToDatabase(updatedPlanData, updatedMeals);

      // Close modal and reset
      setIsEditPortionModalVisible(false);
      setEditingIngredient(null);
      setEditingIngredientIndex(null);

      // Show success message
      alert(
        language === 'hebrew'
          ? 'המרכיב עודכן בהצלחה'
          : 'Ingredient updated successfully'
      );
    } catch (error) {
      console.error('Error updating ingredient:', error);
      alert(
        language === 'hebrew'
          ? 'לא ניתן לעדכן את המרכיב. נסה שוב.'
          : 'Failed to update ingredient. Please try again.'
      );
    }
  };

  // Handle delete ingredient
  const handleDeleteIngredient = async (mealIndex, ingredientIndex) => {
    if (!planData) return;

    if (!window.confirm(
      language === 'hebrew'
        ? 'האם אתה בטוח שברצונך למחוק מרכיב זה?'
        : 'Are you sure you want to delete this ingredient?'
    )) {
      return;
    }

    try {
      // Ensure original plan data is stored before making edits
      ensureOriginalPlanData();

      // Clone the current plan data
      const updatedPlanData = { ...planData };
      const updatedMeals = [...updatedPlanData.meals];
      const mealToUpdate = { ...updatedMeals[mealIndex] };

      // Remove the ingredient
      mealToUpdate.main.ingredients.splice(ingredientIndex, 1);

      // Recalculate meal nutrition (sum remaining ingredients)
      mealToUpdate.main.nutrition = mealToUpdate.main.ingredients.reduce(
        (acc, ing) => ({
          calories: acc.calories + (ing.calories || 0),
          protein: acc.protein + (ing.protein || 0),
          carbs: acc.carbs + (ing.carbs || 0),
          fat: acc.fat + (ing.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      // Update the meal in the meals array
      updatedMeals[mealIndex] = mealToUpdate;
      updatedPlanData.meals = updatedMeals;

      // Recalculate totals
      const newTotals = updatedMeals.reduce(
        (acc, meal) => {
          if (meal.main && meal.main.nutrition) {
            acc.calories += meal.main.nutrition.calories || 0;
            acc.protein += meal.main.nutrition.protein || 0;
            acc.carbs += meal.main.nutrition.carbs || 0;
            acc.fat += meal.main.nutrition.fat || 0;
          }
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      updatedPlanData.totals = newTotals;
      updatedPlanData.isClientEdited = true; // Mark as edited

      // Update local state
      setPlanData(updatedPlanData);

      // Save to database
      await saveMealPlanToDatabase(updatedPlanData, updatedMeals);

      // Show success message
      alert(
        language === 'hebrew'
          ? 'המרכיב נמחק בהצלחה'
          : 'Ingredient deleted successfully'
      );
    } catch (error) {
      console.error('Error deleting ingredient:', error);
      alert(
        language === 'hebrew'
          ? 'לא ניתן למחוק את המרכיב. נסה שוב.'
          : 'Failed to delete ingredient. Please try again.'
      );
    }
  };

  // Save meal plan to database
  const saveMealPlanToDatabase = async (updatedPlanData, updatedMeals) => {
    if (!userCode || !updatedPlanData.id) return;

    try {
      // Prepare the meal plan object to save
      const mealPlanToSave = {
        meals: updatedMeals,
        totals: updatedPlanData.totals,
        note: updatedPlanData.note || '',
      };

      // Save via API
      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
      const response = await fetch(`${apiUrl}/api/profile/meal-plan/save-edited`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: updatedPlanData.id,
          mealPlan: mealPlanToSave,
          userCode: userCode
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error saving meal plan:', result.error);
        throw new Error(result.error);
      }

      console.log('✅ Meal plan saved successfully for today');
    } catch (error) {
      console.error('Error in saveMealPlanToDatabase:', error);
      throw error;
    }
  };

  // Add ingredient to alternative meal
  const handleAddAlternativeIngredient = async (ingredient) => {
    if (selectedAlternativeMealIndex === null || !planData || selectedAlternativeType === null) return;

    try {
      ensureOriginalPlanData();

      const updatedPlanData = { ...planData };
      const updatedMeals = [...updatedPlanData.meals];
      const mealToUpdate = { ...updatedMeals[selectedAlternativeMealIndex] };

      let alternativeMeal;
      if (selectedAlternativeType === 'alternative') {
        alternativeMeal = mealToUpdate.alternative;
      } else if (selectedAlternativeType === 'alternatives' && selectedAlternativeIndex !== null) {
        alternativeMeal = mealToUpdate.alternatives[selectedAlternativeIndex];
      }

      if (!alternativeMeal) return;

      // Initialize ingredients array if it doesn't exist
      if (!alternativeMeal.ingredients) {
        alternativeMeal.ingredients = [];
      }

      // Add the new ingredient
      alternativeMeal.ingredients = [...alternativeMeal.ingredients, ingredient];

      // Update nutrition values
      const currentNutrition = alternativeMeal.nutrition || {};
      alternativeMeal.nutrition = {
        calories: (currentNutrition.calories || 0) + ingredient.calories,
        protein: (currentNutrition.protein || 0) + ingredient.protein,
        carbs: (currentNutrition.carbs || 0) + ingredient.carbs,
        fat: (currentNutrition.fat || 0) + ingredient.fat,
      };

      // Update the meal in the meals array
      updatedMeals[selectedAlternativeMealIndex] = mealToUpdate;
      updatedPlanData.meals = updatedMeals;

      // Recalculate totals (only from main meals)
      const newTotals = updatedMeals.reduce(
        (acc, meal) => {
          if (meal.main && meal.main.nutrition) {
            acc.calories += meal.main.nutrition.calories || 0;
            acc.protein += meal.main.nutrition.protein || 0;
            acc.carbs += meal.main.nutrition.carbs || 0;
            acc.fat += meal.main.nutrition.fat || 0;
          }
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      updatedPlanData.totals = newTotals;
      updatedPlanData.isClientEdited = true;

      setPlanData(updatedPlanData);
      await saveMealPlanToDatabase(updatedPlanData, updatedMeals);

      setIsAddAlternativeIngredientModalVisible(false);
      setSelectedAlternativeMealIndex(null);
      setSelectedAlternativeType(null);
      setSelectedAlternativeIndex(null);

      alert(
        language === 'hebrew'
          ? 'המרכיב נוסף בהצלחה לארוחה החלופית'
          : 'Ingredient added successfully to the alternative meal'
      );
    } catch (error) {
      console.error('Error adding alternative ingredient:', error);
      alert(
        language === 'hebrew'
          ? 'לא ניתן להוסיף את המרכיב. נסה שוב.'
          : 'Failed to add ingredient. Please try again.'
      );
    }
  };

  // Handle edit alternative ingredient
  const handleEditAlternativeIngredient = (mealIndex, alternativeType, alternativeIndex, ingredientIndex, ingredient) => {
    setSelectedAlternativeMealIndex(mealIndex);
    setSelectedAlternativeType(alternativeType);
    setSelectedAlternativeIndex(alternativeIndex);
    setEditingIngredientIndex(ingredientIndex);
    setEditingIngredient({
      ...ingredient,
      displayName: ingredient.item || ingredient.name || 'Unknown item',
      calories: ingredient.calories || 0,
      protein: ingredient.protein || 0,
      carbs: ingredient.carbs || 0,
      fat: ingredient.fat || 0,
    });
    setIsEditAlternativePortionModalVisible(true);
  };

  // Handle update alternative ingredient portion
  const handleUpdateAlternativeIngredientPortion = async ({ quantity: quantityNum, householdMeasure }) => {
    if (selectedAlternativeMealIndex === null || editingIngredientIndex === null || !planData || !editingIngredient || selectedAlternativeType === null) return;

    try {
      ensureOriginalPlanData();

      const updatedPlanData = { ...planData };
      const updatedMeals = [...updatedPlanData.meals];
      const mealToUpdate = { ...updatedMeals[selectedAlternativeMealIndex] };

      let alternativeMeal;
      if (selectedAlternativeType === 'alternative') {
        alternativeMeal = mealToUpdate.alternative;
      } else if (selectedAlternativeType === 'alternatives' && selectedAlternativeIndex !== null) {
        alternativeMeal = mealToUpdate.alternatives[selectedAlternativeIndex];
      }

      if (!alternativeMeal || !alternativeMeal.ingredients) return;

      const oldIngredient = alternativeMeal.ingredients[editingIngredientIndex];

      const originalScale = (oldIngredient['portionSI(gram)'] || 100) / 100;
      const original100gCalories = oldIngredient.calories / originalScale;
      const original100gProtein = oldIngredient.protein / originalScale;
      const original100gCarbs = oldIngredient.carbs / originalScale;
      const original100gFat = oldIngredient.fat / originalScale;

      const newScale = quantityNum / 100;
      const updatedIngredient = {
        UPC: oldIngredient.UPC || null,
        item: oldIngredient.item,
        'brand of product': oldIngredient['brand of product'] || '',
        household_measure: householdMeasure,
        'portionSI(gram)': quantityNum,
        calories: Math.round(original100gCalories * newScale),
        protein: Math.round(original100gProtein * newScale * 10) / 10,
        carbs: Math.round(original100gCarbs * newScale * 10) / 10,
        fat: Math.round(original100gFat * newScale * 10) / 10,
      };

      alternativeMeal.ingredients[editingIngredientIndex] = updatedIngredient;

      // Recalculate alternative meal nutrition
      alternativeMeal.nutrition = alternativeMeal.ingredients.reduce(
        (acc, ing) => ({
          calories: acc.calories + (ing.calories || 0),
          protein: acc.protein + (ing.protein || 0),
          carbs: acc.carbs + (ing.carbs || 0),
          fat: acc.fat + (ing.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      updatedMeals[selectedAlternativeMealIndex] = mealToUpdate;
      updatedPlanData.meals = updatedMeals;

      // Recalculate totals (only from main meals)
      const newTotals = updatedMeals.reduce(
        (acc, meal) => {
          if (meal.main && meal.main.nutrition) {
            acc.calories += meal.main.nutrition.calories || 0;
            acc.protein += meal.main.nutrition.protein || 0;
            acc.carbs += meal.main.nutrition.carbs || 0;
            acc.fat += meal.main.nutrition.fat || 0;
          }
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      updatedPlanData.totals = newTotals;
      updatedPlanData.isClientEdited = true;

      setPlanData(updatedPlanData);
      await saveMealPlanToDatabase(updatedPlanData, updatedMeals);

      setIsEditAlternativePortionModalVisible(false);
      setEditingIngredient(null);
      setEditingIngredientIndex(null);
      setSelectedAlternativeMealIndex(null);
      setSelectedAlternativeType(null);
      setSelectedAlternativeIndex(null);

      alert(
        language === 'hebrew'
          ? 'המרכיב עודכן בהצלחה'
          : 'Ingredient updated successfully'
      );
    } catch (error) {
      console.error('Error updating alternative ingredient:', error);
      alert(
        language === 'hebrew'
          ? 'לא ניתן לעדכן את המרכיב. נסה שוב.'
          : 'Failed to update ingredient. Please try again.'
      );
    }
  };

  // Handle delete alternative ingredient
  const handleDeleteAlternativeIngredient = async (mealIndex, alternativeType, alternativeIndex, ingredientIndex) => {
    if (!planData) return;

    if (!window.confirm(
      language === 'hebrew'
        ? 'האם אתה בטוח שברצונך למחוק מרכיב זה?'
        : 'Are you sure you want to delete this ingredient?'
    )) {
      return;
    }

    try {
      ensureOriginalPlanData();

      const updatedPlanData = { ...planData };
      const updatedMeals = [...updatedPlanData.meals];
      const mealToUpdate = { ...updatedMeals[mealIndex] };

      let alternativeMeal;
      if (alternativeType === 'alternative') {
        alternativeMeal = mealToUpdate.alternative;
      } else if (alternativeType === 'alternatives' && alternativeIndex !== null) {
        alternativeMeal = mealToUpdate.alternatives[alternativeIndex];
      }

      if (!alternativeMeal || !alternativeMeal.ingredients) return;

      alternativeMeal.ingredients.splice(ingredientIndex, 1);

      // Recalculate alternative meal nutrition
      alternativeMeal.nutrition = alternativeMeal.ingredients.reduce(
        (acc, ing) => ({
          calories: acc.calories + (ing.calories || 0),
          protein: acc.protein + (ing.protein || 0),
          carbs: acc.carbs + (ing.carbs || 0),
          fat: acc.fat + (ing.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      updatedMeals[mealIndex] = mealToUpdate;
      updatedPlanData.meals = updatedMeals;

      // Recalculate totals (only from main meals)
      const newTotals = updatedMeals.reduce(
        (acc, meal) => {
          if (meal.main && meal.main.nutrition) {
            acc.calories += meal.main.nutrition.calories || 0;
            acc.protein += meal.main.nutrition.protein || 0;
            acc.carbs += meal.main.nutrition.carbs || 0;
            acc.fat += meal.main.nutrition.fat || 0;
          }
          return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      updatedPlanData.totals = newTotals;
      updatedPlanData.isClientEdited = true;

      setPlanData(updatedPlanData);
      await saveMealPlanToDatabase(updatedPlanData, updatedMeals);

      alert(
        language === 'hebrew'
          ? 'המרכיב נמחק בהצלחה'
          : 'Ingredient deleted successfully'
      );
    } catch (error) {
      console.error('Error deleting alternative ingredient:', error);
      alert(
        language === 'hebrew'
          ? 'לא ניתן למחוק את המרכיב. נסה שוב.'
          : 'Failed to delete ingredient. Please try again.'
      );
    }
  };

  // Switch to original plan (with confirmation and clearing edited plan)
  const handleViewOriginalPlan = async () => {
    if (!originalPlanData || !planData) return;

    if (!window.confirm(
      language === 'hebrew'
        ? 'השינויים שביצעת לא יישמרו. האם אתה בטוח?'
        : 'Your changes will not be saved. Are you sure?'
    )) {
      return;
    }

    try {
      // Clear the edited plan from database via API
      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
      const response = await fetch(`${apiUrl}/api/profile/meal-plan/clear-edited`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: planData.id })
      });

      if (!response.ok) {
        console.error('Error clearing edited plan');
      }

      // Update local state to show original plan
      setPlanData(originalPlanData);
      setOriginalPlanData(null); // Clear original data so button won't show

      alert(
        language === 'hebrew'
          ? 'חזרת לתפריט המקורי של הדיאטנית'
          : 'Returned to dietitian\'s original plan'
      );
    } catch (error) {
      console.error('Error returning to original:', error);
      alert(
        language === 'hebrew'
          ? 'לא ניתן לחזור לתפריט המקורי'
          : 'Could not return to original plan'
      );
    }
  };

  // Handle contact dietitian button click
  const handleContactDietitian = async () => {
    if (!userCode || !user) {
      alert(
        language === 'hebrew'
          ? 'שגיאה: לא ניתן לזהות את המשתמש'
          : 'Error: Unable to identify user'
      );
      return;
    }

    try {
      setIsContactingDietitian(true);

      const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';

      // Get provider_id from chat_users table
      const providerResponse = await fetch(`${apiUrl}/api/profile/provider?userCode=${encodeURIComponent(userCode)}`);
      const providerResult = await providerResponse.json();

      if (!providerResponse.ok) {
        throw new Error(
          language === 'hebrew'
            ? 'לא נמצא דיאטנית משויכת'
            : 'No associated dietitian found'
        );
      }

      const providerId = providerResult.provider_id;
      if (!providerId) {
        throw new Error(
          language === 'hebrew'
            ? 'לא נמצא דיאטנית משויכת'
            : 'No associated dietitian found'
        );
      }

      // Check if a request already exists for this client
      const requestKey = 'personalized_meal_plan_request';
      const requestTitle = language === 'hebrew'
        ? 'בקשה לתוכנית תזונה מותאמת'
        : 'Request for Personalized Meal Plan';
      
      const checkResponse = await fetch(
        `${apiUrl}/api/profile/system-message-exists?` + 
        `providerId=${encodeURIComponent(providerId)}&` +
        `userCode=${encodeURIComponent(userCode)}&` +
        `userId=${encodeURIComponent(user?.id || '')}&` +
        `messageType=${encodeURIComponent('info')}&` +
        `requestKey=${encodeURIComponent(requestKey)}`
      );
      const checkResult = await checkResponse.json();

      if (checkResponse.ok && checkResult.exists) {
        // Request already exists
        alert(
          language === 'hebrew'
            ? 'הבקשה כבר נשלחה בעבר. ניצור איתכם קשר בקרוב!'
            : 'Request already sent. We will contact you soon!'
        );
        setIsContactingDietitian(false);
        return;
      }

      // Create system message in secondary database
      const messageResponse = await fetch(`${apiUrl}/api/profile/system-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: requestTitle,
          content: language === 'hebrew'
            ? `הלקוח ${userCode} מבקש תוכנית תזונה מותאמת ומדויקת יותר.\nrequest_key:${requestKey}`
            : `Client ${userCode} is requesting a better and more precise personalized meal plan.\nrequest_key:${requestKey}`,
          messageType: 'info',
          priority: 'medium',
          directedTo: providerId,
          userId: user?.id || null
        })
      });

      const messageResult = await messageResponse.json();

      if (!messageResponse.ok) {
        console.error('Error creating system message:', messageResult.error);
        throw new Error(
          language === 'hebrew'
            ? `שגיאה בשליחת הבקשה: ${messageResult.error || 'שגיאה לא ידועה'}`
            : `Error sending request: ${messageResult.error || 'Unknown error'}`
        );
      }

      // Show success message
      alert(
        language === 'hebrew'
          ? 'ניצור איתכם קשר בקרוב!'
          : 'We will contact you soon!'
      );
    } catch (error) {
      console.error('Error contacting dietitian:', error);
      alert(
        error.message ||
        (language === 'hebrew'
          ? 'שגיאה בשליחת הבקשה. אנא נסה שוב מאוחר יותר.'
          : 'Error sending request. Please try again later.')
      );
    } finally {
      setIsContactingDietitian(false);
    }
  };

  return (
    <div className={`min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn`}>
      {/* Sub-tabs Navigation */}
      <div className={`mb-4 sm:mb-6 flex gap-1 sm:gap-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <button
          onClick={() => setActiveSubTab('mealPlan')}
          className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all duration-300 border-b-2 ${
            activeSubTab === 'mealPlan'
              ? `${themeClasses.textPrimary} border-emerald-500`
              : `${themeClasses.textSecondary} border-transparent hover:border-emerald-500/50`
          }`}
        >
          {language === 'hebrew' ? 'תוכנית תזונה' : 'Meal Plan'}
        </button>
        <button
          onClick={() => setActiveSubTab('trainingPlan')}
          className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all duration-300 border-b-2 ${
            activeSubTab === 'trainingPlan'
              ? `${themeClasses.textPrimary} border-emerald-500`
              : `${themeClasses.textSecondary} border-transparent hover:border-emerald-500/50`
          }`}
        >
          {language === 'hebrew' ? 'תוכנית אימונים' : 'Training Plan'}
        </button>
      </div>

      {/* Training Plan Sub-tab Content */}
      {activeSubTab === 'trainingPlan' && (
        <TrainingPlanTab
          themeClasses={themeClasses}
          language={language}
          trainingPlanData={trainingPlanData}
          loading={trainingPlanLoading}
          error={trainingPlanError}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Meal Plan Sub-tab Content */}
      {activeSubTab === 'mealPlan' && (
        <>
      {/* Weekly Meal Schedule Overlay */}
      {allPlans && allPlans.length > 0 && !(allPlans.length === 1 && allPlans[0].active_days === null) && (
        <WeeklyMealSchedule 
          allPlans={allPlans}
          selectedDay={selectedDay}
          onDaySelect={setSelectedDay}
          language={language}
          themeClasses={themeClasses}
        />
      )}

      {/* No meal plan message for selected day */}
      {allPlans && allPlans.length > 0 && !planData && !loading && (
        <div className={`mb-6 p-6 rounded-xl border ${themeClasses.borderPrimary} ${themeClasses.bgCard} text-center`}>
          <p className={`${themeClasses.textSecondary} text-lg`}>
            {language === 'hebrew' 
              ? 'אין תפריט זמין ליום זה' 
              : 'No meal plan available for this day'}
          </p>
        </div>
      )}
      
      {/* Daily Summary Section */}
      <div className="mb-6 sm:mb-8 md:mb-10 lg:mb-12 animate-slideInUp relative rounded-xl p-4 sm:p-6" style={{
        borderLeft: '3px solid',
        borderLeftColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
        borderRight: '2px solid',
        borderRightColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
        borderTop: '2px solid',
        borderTopColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
        borderBottom: '2px solid',
        borderBottomColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
        boxShadow: isDarkMode 
          ? 'inset 1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)' 
          : 'inset 1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}>
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none rounded-xl" />
        <div className="relative z-10">
        <div className="flex items-center justify-between mb-4 sm:mb-6 md:mb-8">
          <div className="flex items-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg shadow-emerald-500/25 animate-pulse">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
              </svg>
            </div>
            <div>
              <h2 className={`${themeClasses.textPrimary} text-xl sm:text-2xl md:text-3xl font-bold tracking-tight`}>
                {language === 'hebrew' ? 'סיכום יומי' : 'Daily Summary'}
              </h2>
              <p className={`${themeClasses.textSecondary} text-sm sm:text-base mt-0.5 sm:mt-1`}>
                {planData.meal_plan_name || (language === 'hebrew' ? 'סה"כ ארוחות מתוכננות' : 'Total planned meals')}
                {planData.isClientEdited && (
                  <span className="text-emerald-500 font-bold ml-2">
                    • {language === 'hebrew' ? 'עריכה אישית' : 'Personalized'}
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
          {/* Translation Indicator */}
          {isTranslating && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span className="text-blue-400 text-xs sm:text-sm font-medium">
                {language === 'hebrew' ? 'מתרגם...' : 'Translating...'}
              </span>
            </div>
          )}
            
            {/* Reset Button */}
            {originalPlanData && (
              <button
                onClick={handleViewOriginalPlan}
                className="flex items-center gap-2 px-3 py-2 bg-red-500/15 border border-red-500/30 rounded-lg hover:bg-red-500/25 transition-colors"
              >
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-red-500 text-xs sm:text-sm font-semibold">
                  {language === 'hebrew' ? 'אפס' : 'Reset'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className={`grid gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8 ${
          settings.showCalories && settings.showMacros 
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' 
            : settings.showCalories || settings.showMacros
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-1 sm:grid-cols-2'
        }`}>
          {/* Total Calories Card */}
          {settings.showCalories && (
          <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl sm:rounded-2xl p-5 sm:p-6 md:p-8 shadow-xl shadow-teal-500/20 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-teal-500/30 animate-bounceIn text-center sm:text-left">
            <div className="text-white text-4xl sm:text-4xl md:text-5xl font-bold tracking-tight animate-countUp">{planData.totals.calories.toLocaleString()}</div>
            <div className="text-teal-100 text-base sm:text-lg font-semibold mt-1 sm:mt-2">
              {language === 'hebrew' ? 'קלוריות' : 'Calories'}
            </div>
          </div>
          )}

          {/* Protein Card */}
          {settings.showMacros && (
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-xl shadow-purple-500/20 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/30 animate-bounceIn text-center sm:text-left" style={{ animationDelay: '0.1s' }}>
              <div className="text-white text-3xl sm:text-3xl md:text-4xl font-bold tracking-tight">{formatWeight(planData.totals.protein)}</div>
            <div className="text-purple-100 text-base sm:text-lg font-semibold mt-1">
              {language === 'hebrew' ? 'חלבון' : 'Protein'}
            </div>
            <div className="text-purple-200 text-xs sm:text-sm mt-1 sm:mt-2">
              {proteinPercentage}% {language === 'hebrew' ? 'מהמקרו' : 'of macros'}
            </div>
          </div>
          )}

          {/* Carbs Card */}
          {settings.showMacros && (
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-xl shadow-blue-500/20 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/30 animate-bounceIn text-center sm:text-left" style={{ animationDelay: '0.2s' }}>
              <div className="text-white text-3xl sm:text-3xl md:text-4xl font-bold tracking-tight">{formatWeight(planData.totals.carbs)}</div>
            <div className="text-blue-100 text-base sm:text-lg font-semibold mt-1">
              {language === 'hebrew' ? 'פחמימות' : 'Carbs'}
            </div>
            <div className="text-blue-200 text-xs sm:text-sm mt-1 sm:mt-2">
              {carbsPercentage}% {language === 'hebrew' ? 'מהמקרו' : 'of macros'}
            </div>
          </div>
          )}

          {/* Fat Card */}
          {settings.showMacros && (
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-xl shadow-amber-500/20 transform hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/30 animate-bounceIn text-center sm:text-left" style={{ animationDelay: '0.3s' }}>
              <div className="text-white text-3xl sm:text-3xl md:text-4xl font-bold tracking-tight">{formatWeight(planData.totals.fat)}</div>
            <div className="text-amber-100 text-base sm:text-lg font-semibold mt-1">
              {language === 'hebrew' ? 'שומן' : 'Fat'}
            </div>
            <div className="text-amber-200 text-xs sm:text-sm mt-1 sm:mt-2">
              {fatPercentage}% {language === 'hebrew' ? 'מהמקרו' : 'of macros'}
            </div>
          </div>
          )}
        </div>
        </div>
        </div>

        {/* Macro Distribution Bar */}
        {settings.showMacros && (
        <div className="mb-6 sm:mb-8 md:mb-10 lg:mb-12 animate-slideInUp relative rounded-xl p-4 sm:p-6" style={{ animationDelay: '0.4s', 
          borderLeft: '3px solid',
          borderLeftColor: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
          borderRight: '2px solid',
          borderRightColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
          borderTop: '2px solid',
          borderTopColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
          borderBottom: '2px solid',
          borderBottomColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
          boxShadow: isDarkMode 
            ? 'inset 1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)' 
            : 'inset 1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}>
          {/* Decorative gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none rounded-xl" />
          <div className="relative z-10">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <span className={`${themeClasses.textPrimary} text-base sm:text-lg md:text-xl font-semibold tracking-tight`}>
              {language === 'hebrew' ? 'התפלגות מקרו' : 'Macro Distribution'}
            </span>
            <span className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium`}>
              {language === 'hebrew' ? 'מקרו' : 'macros'}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className={`${themeClasses.bgCard} rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg`}>
            <div className="flex h-8 sm:h-10 rounded-lg sm:rounded-xl overflow-hidden shadow-inner">
              <div 
                className="bg-gradient-to-r from-purple-600 to-purple-500 flex items-center justify-center text-white text-xs sm:text-sm font-semibold transition-all duration-1000 ease-out animate-progressBar"
                style={{ width: `${proteinPercentage}%` }}
              >
                {proteinPercentage > 15 && (
                  <div className="flex items-center">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full mr-1 sm:mr-2 animate-pulse"></div>
                    <span className="hidden sm:inline">{language === 'hebrew' ? 'חלבון' : 'Protein'} </span>{proteinPercentage}%
                  </div>
                )}
              </div>
              <div 
                className="bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center text-white text-xs sm:text-sm font-semibold transition-all duration-1000 ease-out animate-progressBar"
                style={{ width: `${carbsPercentage}%` }}
              >
                {carbsPercentage > 15 && (
                  <div className="flex items-center">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full mr-1 sm:mr-2 animate-pulse"></div>
                    <span className="hidden sm:inline">{language === 'hebrew' ? 'פחמימות' : 'Carbs'} </span>{carbsPercentage}%
                  </div>
                )}
              </div>
              <div 
                className="bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white text-xs sm:text-sm font-semibold transition-all duration-1000 ease-out animate-progressBar"
                style={{ width: `${fatPercentage}%` }}
              >
                {fatPercentage > 15 && (
                  <div className="flex items-center">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full mr-1 sm:mr-2 animate-pulse"></div>
                    <span className="hidden sm:inline">{language === 'hebrew' ? 'שומן' : 'Fat'} </span>{fatPercentage}%
                  </div>
                )}
              </div>
            </div>

            {/* Labels Below */}
            <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 mt-3 sm:mt-4">
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-purple-500 rounded-full mr-2 animate-pulse"></div>
                <span className={`${themeClasses.textPrimary} text-xs sm:text-sm font-medium`}>
                  {language === 'hebrew' ? 'חלבון' : 'Protein'} {proteinPercentage}%
                </span>
              </div>
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
                <span className={`${themeClasses.textPrimary} text-xs sm:text-sm font-medium`}>
                  {language === 'hebrew' ? 'פחמימות' : 'Carbs'} {carbsPercentage}%
                </span>
              </div>
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-amber-500 rounded-full mr-2 animate-pulse"></div>
                <span className={`${themeClasses.textPrimary} text-xs sm:text-sm font-medium`}>
                  {language === 'hebrew' ? 'שומן' : 'Fat'} {fatPercentage}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
        )}
        
 {/* Show message for auto-made plans (when dietitian_id is null) */}
 {planData.dietitian_id === null && (
          <div className="mb-8 sm:mb-10 md:mb-12 animate-slideInUp" style={{ animationDelay: '0.6s' }}>
            <div className="relative rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 border-4 border-blue-500/60 shadow-2xl overflow-hidden" style={{
              background: isDarkMode 
                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.2) 100%)'
                : 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.15) 100%)',
              backdropFilter: 'blur(10px)'
            }}>
              {/* Decorative gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-indigo-500/10 pointer-events-none" />
              
              <div className="relative z-10 flex items-start gap-5 sm:gap-6 md:gap-8">
                <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/50 animate-pulse">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 pt-1 sm:pt-2">
                  <h4 className={`${themeClasses.textPrimary} text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 tracking-tight`}>
                    {language === 'hebrew' ? '💡 רוצים תוכנית תזונה מותאמת יותר?' : '💡 Want a More Personalized Meal Plan?'}
                  </h4>
                  <p className={`${themeClasses.textPrimary} text-base sm:text-lg md:text-xl leading-relaxed font-medium mb-4 sm:mb-6`}>
                    {language === 'hebrew'
                      ? 'אם תרצו תוכנית תזונה טובה ומדויקת יותר, תוכלו ליצור קשר עם הדיאטניות שלנו.'
                      : 'If you want a better and more precise meal plan, you can contact our dietitians.'}
                  </p>
                  <button
                    onClick={handleContactDietitian}
                    disabled={isContactingDietitian}
                    className={`w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all duration-200 shadow-lg transform hover:scale-105 ${
                      isContactingDietitian
                        ? 'bg-gray-600 cursor-not-allowed opacity-60'
                        : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white'
                    } flex items-center justify-center gap-2 sm:gap-3`}
                  >
                    {isContactingDietitian ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>{language === 'hebrew' ? 'שולח...' : 'Sending...'}</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>{language === 'hebrew' ? 'צור קשר עם דיאטנית' : 'Contact Dietitian'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      
      {/* Today Section */}
      <div className="animate-slideInUp" style={{ animationDelay: '0.5s' }}>
         <div className="flex items-center mb-6 sm:mb-8">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg shadow-emerald-500/25 animate-pulse">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
            </svg>
          </div>
      <div>
            <h3 className={`${themeClasses.textPrimary} text-2xl sm:text-3xl font-bold tracking-tight`}>
              {language === 'hebrew' ? 'היום' : 'Today'}
            </h3>
            <p className={`${themeClasses.textSecondary} text-sm sm:text-base mt-1`}>
              {planData.meals.length} {language === 'hebrew' ? 'ארוחות מתוכננות' : 'meals planned'}
            </p>
          </div>
        </div>

       
        {/* Meals */}
        <div className="space-y-3 sm:space-y-4">
          {planData.meals.map((meal, index) => {
            const mealCalories = meal.main.nutrition?.calories || meal.main.calories || 0;
            const mealProtein = meal.main.nutrition?.protein || meal.main.protein || 0;
            const mealCarbs = meal.main.nutrition?.carbs || meal.main.carbs || 0;
            const mealFat = meal.main.nutrition?.fat || meal.main.fat || 0;
            
            // Calculate meal macro percentages based on calories (not grams)
            const mealProteinCalories = mealProtein * 4;
            const mealCarbsCalories = mealCarbs * 4;
            const mealFatCalories = mealFat * 9;
            const mealTotalMacroCalories = mealProteinCalories + mealCarbsCalories + mealFatCalories;
            
            const mealProteinPercent = mealTotalMacroCalories > 0 ? Math.round((mealProteinCalories / mealTotalMacroCalories) * 100) : 0;
            const mealCarbsPercent = mealTotalMacroCalories > 0 ? Math.round((mealCarbsCalories / mealTotalMacroCalories) * 100) : 0;
            const mealFatPercent = mealTotalMacroCalories > 0 ? Math.round((mealFatCalories / mealTotalMacroCalories) * 100) : 0;
            const isExpanded = expandedMeals[index] === true; // Default to collapsed

            return (
              <div 
                key={index} 
                className={`${themeClasses.bgCard} border border-emerald-500/30 rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl shadow-emerald-500/10 transform hover:scale-[1.02] transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/20 animate-slideInUp group`}
                style={{ animationDelay: `${0.6 + index * 0.1}s` }}
              >
                {/* Meal Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mr-3 sm:mr-4 shadow-lg shadow-emerald-500/25">
                      <span className="text-xl sm:text-2xl group-hover:animate-bounce transition-transform duration-300">{getMealIcon(meal.meal)}</span>
                  </div>
                    <div className="text-left">
                      <p className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium mb-1`}>
                        {meal.meal}
                      </p>
                      <h4 className={`${themeClasses.textPrimary} text-base sm:text-lg md:text-xl font-bold tracking-tight`}>
                        {meal.main?.meal_title || meal.main?.meal_name || meal.main?.title || meal.meal}
                      </h4>
                    </div>
                    </div>
                  <div className="flex items-center gap-2 sm:gap-4 self-end sm:self-auto">
                    <button 
                      onClick={() => toggleMealExpansion(index)}
                      className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center hover:bg-slate-600 transition-all duration-300 hover:scale-110 shadow-md"
                    >
                      <svg 
                        className={`w-5 h-5 text-white transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    </div>
                </div>

                {/* Nutritional Summary */}
                <div className="mb-4 sm:mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                    {settings.showCalories && (
                      <div className="text-emerald-400 text-3xl sm:text-4xl font-bold tracking-tight animate-countUp">{mealCalories.toLocaleString()}</div>
                    )}
                    {settings.showMacros && (
                    <div className={`${themeClasses.textPrimary} text-sm sm:text-base`}>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <span className="font-semibold whitespace-nowrap">{formatWeight(mealProtein)} {language === 'hebrew' ? 'חלבון' : 'Protein'}</span>
                        <span className={`${themeClasses.textMuted} hidden sm:inline`}>•</span>
                          <span className="font-semibold whitespace-nowrap">{formatWeight(mealCarbs)} {language === 'hebrew' ? 'פחמימות' : 'Carbs'}</span>
                        <span className={`${themeClasses.textMuted} hidden sm:inline`}>•</span>
                          <span className="font-semibold whitespace-nowrap">{formatWeight(mealFat)} {language === 'hebrew' ? 'שומן' : 'Fat'}</span>
                      </div>
                    </div>
                    )}
                  </div>
                </div>

                {/* Collapsible Content */}
                <div className={`transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                  {/* Macro Breakdown Bars */}
                  {settings.showMacros && (
                    <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                      <div className="flex items-center gap-2 sm:gap-0">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 bg-purple-500 rounded-full sm:mr-4 animate-pulse"></div>
                        <span className={`${themeClasses.textPrimary} text-sm sm:text-base font-semibold sm:mr-4 w-12 sm:w-16`}>
                          {language === 'hebrew' ? 'חלבון' : 'Protein'}
                        </span>
                        <div className="flex-1 bg-slate-700 rounded-full h-2 sm:h-3 shadow-inner">
                          <div 
                            className="bg-gradient-to-r from-purple-600 to-purple-500 h-2 sm:h-3 rounded-full transition-all duration-1000 ease-out shadow-sm"
                            style={{ width: `${mealProteinPercent}%` }}
                          ></div>
                    </div>
                        <span className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium ml-2 sm:ml-4 whitespace-nowrap`}>{formatWeight(mealProtein)} ({mealProteinPercent}%)</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-0">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 bg-blue-500 rounded-full sm:mr-4 animate-pulse"></div>
                        <span className={`${themeClasses.textPrimary} text-sm sm:text-base font-semibold sm:mr-4 w-12 sm:w-16`}>
                          {language === 'hebrew' ? 'פחמימות' : 'Carbs'}
                        </span>
                        <div className="flex-1 bg-slate-700 rounded-full h-2 sm:h-3 shadow-inner">
                          <div 
                            className="bg-gradient-to-r from-blue-600 to-blue-500 h-2 sm:h-3 rounded-full transition-all duration-1000 ease-out shadow-sm"
                            style={{ width: `${mealCarbsPercent}%` }}
                          ></div>
                      </div>
                        <span className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium ml-2 sm:ml-4 whitespace-nowrap`}>{formatWeight(mealCarbs)} ({mealCarbsPercent}%)</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-0">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 bg-amber-500 rounded-full sm:mr-4 animate-pulse"></div>
                        <span className={`${themeClasses.textPrimary} text-sm sm:text-base font-semibold sm:mr-4 w-12 sm:w-16`}>
                          {language === 'hebrew' ? 'שומן' : 'Fat'}
                        </span>
                        <div className="flex-1 bg-slate-700 rounded-full h-2 sm:h-3 shadow-inner">
                          <div 
                            className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 sm:h-3 rounded-full transition-all duration-1000 ease-out shadow-sm"
                            style={{ width: `${mealFatPercent}%` }}
                          ></div>
                      </div>
                        <span className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium ml-2 sm:ml-4 whitespace-nowrap`}>{formatWeight(mealFat)} ({mealFatPercent}%)</span>
                      </div>
                    </div>
                  )}

                  {/* Ingredients */}
                  <div className={`${themeClasses.bgSecondary} rounded-2xl p-4 sm:p-6`}>
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className="flex items-center">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mr-2 sm:mr-3 shadow-lg shadow-emerald-500/25">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                        </svg>
                      </div>
                      <span className={`${themeClasses.textPrimary} text-base sm:text-lg font-bold tracking-tight`}>
                        {language === 'hebrew' ? 'מרכיבים' : 'Ingredients'}
                      </span>
                      {meal.main && meal.main.ingredients && (
                        <span className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium ml-2 sm:ml-3`}>
                          {meal.main.ingredients.length} {language === 'hebrew' ? 'פריטים' : 'Items'}
                        </span>
                      )}
                      </div>
                      <button
                        onClick={() => handleOpenAddIngredient(index)}
                        className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 rounded-full flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-md hover:shadow-lg"
                        title={language === 'hebrew' ? 'הוסף מרכיב' : 'Add ingredient'}
                      >
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Actual ingredients from meal data */}
                    {meal.main && meal.main.ingredients && meal.main.ingredients.length > 0 ? (
                      <div className="space-y-2 sm:space-y-3">
                        {meal.main.ingredients.map((ingredient, idx) => (
                          <div 
                            key={idx}
                            className={`flex flex-col sm:flex-row items-start sm:items-center ${themeClasses.textSecondary} text-xs sm:text-sm md:text-base group`}
                          >
                            <div className="flex items-center w-full sm:w-auto">
                              <div className="w-2 h-2 sm:w-3 sm:h-3 bg-emerald-500 rounded-full mr-2 sm:mr-4 animate-pulse flex-shrink-0 mt-1.5 sm:mt-0"></div>
                              <span className="font-medium flex-1 sm:flex-none">
                                {ingredient.item || ingredient.name || 'Unknown item'}
                                {language === 'hebrew' && ' - '}
                              </span>
                            </div>
                            <div className={`flex items-center justify-between sm:justify-end w-full sm:w-auto mt-1 sm:mt-0 ${language === 'hebrew' ? 'sm:mr-2' : 'sm:ml-2'}`}>
                              <span className="font-semibold sm:whitespace-nowrap">
                                {ingredient.household_measure ? (
                                  <>
                                    {ingredient.household_measure}
                                    <span className="text-xs opacity-70 ml-1">({formatWeight(ingredient['portionSI(gram)'] || 0)})</span>
                                  </>
                                ) : (
                                  formatPortion(ingredient)
                                )}
                              </span>
                              <div className="flex items-center gap-1 ml-2 sm:ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleEditIngredient(index, idx, ingredient)}
                                  className="w-6 h-6 sm:w-7 sm:h-7 bg-blue-500 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
                                  title={language === 'hebrew' ? 'ערוך' : 'Edit'}
                                >
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteIngredient(index, idx)}
                                  className="w-6 h-6 sm:w-7 sm:h-7 bg-red-500 rounded-lg flex items-center justify-center hover:bg-red-600 transition-colors"
                                  title={language === 'hebrew' ? 'מחק' : 'Delete'}
                                >
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className={`${themeClasses.textMuted} text-sm italic`}>
                          {language === 'hebrew' ? 'אין מרכיבים זמינים' : 'No ingredients available'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Alternative Meal Button */}
                  {(meal.alternative || (meal.alternatives && meal.alternatives.length > 0)) && (
                    <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-emerald-500/20">
                      <button
                        onClick={() => toggleAlternativesExpansion(index)}
                        className={`w-full flex items-center justify-between ${themeClasses.bgSecondary} rounded-xl p-4 sm:p-5 hover:${themeClasses.bgPrimary} transition-all duration-300 group`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                            <svg 
                              className={`w-5 h-5 text-white transition-transform duration-300 ${expandedAlternatives[index] ? 'rotate-180' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          <div className="text-left">
                            <span className={`${themeClasses.textPrimary} text-sm sm:text-base font-bold`}>
                              {(() => {
                                const altCount = (meal.alternative ? 1 : 0) + (meal.alternatives ? meal.alternatives.length : 0);
                                const hasMultiple = altCount > 1;
                                return hasMultiple 
                                  ? (language === 'hebrew' ? 'ארוחות חלופיות' : 'Alternative Meals')
                                  : (language === 'hebrew' ? 'ארוחה חלופית' : 'Alternative Meal');
                              })()}
                            </span>
                            <p className={`${themeClasses.textSecondary} text-xs sm:text-sm mt-0.5`}>
                              {meal.alternative 
                                ? (language === 'hebrew' ? 'לחץ כדי לראות' : 'Click to view')
                                : `${meal.alternatives.length} ${language === 'hebrew' ? 'אפשרויות' : 'options'}`
                              }
                            </p>
                          </div>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Alternative Meal(s) Display */}
                  {expandedAlternatives[index] && (meal.alternative || (meal.alternatives && meal.alternatives.length > 0)) && (
                    <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
                      {/* Single alternative */}
                      {meal.alternative && (
                        <div className={`${themeClasses.bgSecondary} border border-blue-500/30 rounded-2xl p-4 sm:p-6 shadow-lg`}>
                          <div className="mb-4">
                            <h5 className={`${themeClasses.textPrimary} text-base sm:text-lg font-bold mb-2`}>
                              {meal.alternative.meal_title || meal.alternative.meal_name || meal.meal}
                            </h5>
                            {meal.alternative.nutrition && (settings.showCalories || settings.showMacros) && (
                              <div className="flex flex-wrap gap-3 sm:gap-4 text-sm sm:text-base">
                                {settings.showCalories && (
                                  <span className="text-emerald-400 font-bold">{meal.alternative.nutrition.calories || 0} {language === 'hebrew' ? 'קלוריות' : 'cal'}</span>
                                )}
                                {settings.showMacros && (
                                  <>
                                    <span className={`${themeClasses.textSecondary}`}>
                                      {formatWeight(meal.alternative.nutrition.protein || 0)} {language === 'hebrew' ? 'חלבון' : 'P'}
                                    </span>
                                    <span className={`${themeClasses.textSecondary}`}>
                                      {formatWeight(meal.alternative.nutrition.carbs || 0)} {language === 'hebrew' ? 'פחמימות' : 'C'}
                                    </span>
                                    <span className={`${themeClasses.textSecondary}`}>
                                      {formatWeight(meal.alternative.nutrition.fat || 0)} {language === 'hebrew' ? 'שומן' : 'F'}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          <div className={`${themeClasses.bgSecondary} rounded-2xl p-4 sm:p-6`}>
                            <div className="flex items-center justify-between mb-3 sm:mb-4">
                              <div className="flex items-center">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-2 sm:mr-3 shadow-lg shadow-blue-500/25">
                                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                                  </svg>
                                </div>
                                <span className={`${themeClasses.textPrimary} text-base sm:text-lg font-bold tracking-tight`}>
                                  {language === 'hebrew' ? 'מרכיבים' : 'Ingredients'}
                                </span>
                                {meal.alternative && meal.alternative.ingredients && (
                                  <span className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium ml-2 sm:ml-3`}>
                                    {meal.alternative.ingredients.length} {language === 'hebrew' ? 'פריטים' : 'Items'}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleOpenAddAlternativeIngredient(index, 'alternative')}
                                className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors shadow-md hover:shadow-lg"
                                title={language === 'hebrew' ? 'הוסף מרכיב' : 'Add ingredient'}
                              >
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            </div>
                            
                            {meal.alternative && meal.alternative.ingredients && meal.alternative.ingredients.length > 0 ? (
                              <div className="space-y-2 sm:space-y-3">
                                {meal.alternative.ingredients.map((ingredient, idx) => (
                                  <div 
                                    key={idx}
                                    className={`flex flex-col sm:flex-row items-start sm:items-center ${themeClasses.textSecondary} text-xs sm:text-sm md:text-base group`}
                                  >
                                    <div className="flex items-center w-full sm:w-auto">
                                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full mr-2 sm:mr-4 animate-pulse flex-shrink-0 mt-1.5 sm:mt-0"></div>
                                      <span className="font-medium flex-1 sm:flex-none">
                                        {ingredient.item || ingredient.name || 'Unknown item'}
                                        {language === 'hebrew' && ' - '}
                                      </span>
                                    </div>
                                    <div className={`flex items-center justify-between sm:justify-end w-full sm:w-auto mt-1 sm:mt-0 ${language === 'hebrew' ? 'sm:mr-2' : 'sm:ml-2'}`}>
                                      <span className="font-semibold sm:whitespace-nowrap">
                                        {ingredient.household_measure ? (
                                          <>
                                            {ingredient.household_measure}
                                            <span className="text-xs opacity-70 ml-1">({formatWeight(ingredient['portionSI(gram)'] || 0)})</span>
                                          </>
                                        ) : (
                                          formatPortion(ingredient)
                                        )}
                                      </span>
                                      <div className="flex items-center gap-1 ml-2 sm:ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => handleEditAlternativeIngredient(index, 'alternative', null, idx, ingredient)}
                                          className="w-6 h-6 sm:w-7 sm:h-7 bg-blue-500 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
                                          title={language === 'hebrew' ? 'ערוך' : 'Edit'}
                                        >
                                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => handleDeleteAlternativeIngredient(index, 'alternative', null, idx)}
                                          className="w-6 h-6 sm:w-7 sm:h-7 bg-red-500 rounded-lg flex items-center justify-center hover:bg-red-600 transition-colors"
                                          title={language === 'hebrew' ? 'מחק' : 'Delete'}
                                        >
                                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <p className={`${themeClasses.textMuted} text-sm italic`}>
                                  {language === 'hebrew' ? 'אין מרכיבים זמינים' : 'No ingredients available'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Multiple alternatives */}
                      {meal.alternatives && meal.alternatives.length > 0 && meal.alternatives.map((alt, altIdx) => (
                        <div key={altIdx} className={`${themeClasses.bgSecondary} border border-blue-500/30 rounded-2xl p-4 sm:p-6 shadow-lg`}>
                          <div className="mb-4">
                            <h5 className={`${themeClasses.textPrimary} text-base sm:text-lg font-bold mb-2`}>
                              {alt.meal_title || alt.meal_name || meal.meal}
                            </h5>
                            {alt.nutrition && (settings.showCalories || settings.showMacros) && (
                              <div className="flex flex-wrap gap-3 sm:gap-4 text-sm sm:text-base">
                                {settings.showCalories && (
                                  <span className="text-emerald-400 font-bold">{alt.nutrition.calories || 0} {language === 'hebrew' ? 'קלוריות' : 'cal'}</span>
                                )}
                                {settings.showMacros && (
                                  <>
                                    <span className={`${themeClasses.textSecondary}`}>
                                      {formatWeight(alt.nutrition.protein || 0)} {language === 'hebrew' ? 'חלבון' : 'P'}
                                    </span>
                                    <span className={`${themeClasses.textSecondary}`}>
                                      {formatWeight(alt.nutrition.carbs || 0)} {language === 'hebrew' ? 'פחמימות' : 'C'}
                                    </span>
                                    <span className={`${themeClasses.textSecondary}`}>
                                      {formatWeight(alt.nutrition.fat || 0)} {language === 'hebrew' ? 'שומן' : 'F'}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          <div className={`${themeClasses.bgSecondary} rounded-2xl p-4 sm:p-6`}>
                            <div className="flex items-center justify-between mb-3 sm:mb-4">
                              <div className="flex items-center">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-2 sm:mr-3 shadow-lg shadow-blue-500/25">
                                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                                  </svg>
                                </div>
                                <span className={`${themeClasses.textPrimary} text-base sm:text-lg font-bold tracking-tight`}>
                                  {language === 'hebrew' ? 'מרכיבים' : 'Ingredients'}
                                </span>
                                {alt.ingredients && (
                                  <span className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium ml-2 sm:ml-3`}>
                                    {alt.ingredients.length} {language === 'hebrew' ? 'פריטים' : 'Items'}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleOpenAddAlternativeIngredient(index, 'alternatives', altIdx)}
                                className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors shadow-md hover:shadow-lg"
                                title={language === 'hebrew' ? 'הוסף מרכיב' : 'Add ingredient'}
                              >
                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            </div>
                            
                            {alt.ingredients && alt.ingredients.length > 0 ? (
                              <div className="space-y-2 sm:space-y-3">
                                {alt.ingredients.map((ingredient, idx) => (
                                  <div 
                                    key={idx}
                                    className={`flex flex-col sm:flex-row items-start sm:items-center ${themeClasses.textSecondary} text-xs sm:text-sm md:text-base group`}
                                  >
                                    <div className="flex items-center w-full sm:w-auto">
                                      <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded-full mr-2 sm:mr-4 animate-pulse flex-shrink-0 mt-1.5 sm:mt-0"></div>
                                      <span className="font-medium flex-1 sm:flex-none">
                                        {ingredient.item || ingredient.name || 'Unknown item'}
                                        {language === 'hebrew' && ' - '}
                                      </span>
                                    </div>
                                    <div className={`flex items-center justify-between sm:justify-end w-full sm:w-auto mt-1 sm:mt-0 ${language === 'hebrew' ? 'sm:mr-2' : 'sm:ml-2'}`}>
                                      <span className="font-semibold sm:whitespace-nowrap">
                                        {ingredient.household_measure ? (
                                          <>
                                            {ingredient.household_measure}
                                            <span className="text-xs opacity-70 ml-1">({formatWeight(ingredient['portionSI(gram)'] || 0)})</span>
                                          </>
                                        ) : (
                                          formatPortion(ingredient)
                                        )}
                                      </span>
                                      <div className="flex items-center gap-1 ml-2 sm:ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => handleEditAlternativeIngredient(index, 'alternatives', altIdx, idx, ingredient)}
                                          className="w-6 h-6 sm:w-7 sm:h-7 bg-blue-500 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
                                          title={language === 'hebrew' ? 'ערוך' : 'Edit'}
                                        >
                                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => handleDeleteAlternativeIngredient(index, 'alternatives', altIdx, idx)}
                                          className="w-6 h-6 sm:w-7 sm:h-7 bg-red-500 rounded-lg flex items-center justify-center hover:bg-red-600 transition-colors"
                                          title={language === 'hebrew' ? 'מחק' : 'Delete'}
                                        >
                                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <p className={`${themeClasses.textMuted} text-sm italic`}>
                                  {language === 'hebrew' ? 'אין מרכיבים זמינים' : 'No ingredients available'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
{/* Notes Section */}
{planData && (
        <div className="mb-6 sm:mb-8 md:mb-10 lg:mb-12 animate-slideInUp relative rounded-xl p-4 sm:p-6" style={{
          borderLeft: '3px solid',
          borderLeftColor: isDarkMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
          borderRight: '2px solid',
          borderRightColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
          borderTop: '2px solid',
          borderTopColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
          borderBottom: '2px solid',
          borderBottomColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
          boxShadow: isDarkMode 
            ? 'inset 1px 0 0 rgba(59, 130, 246, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)' 
            : 'inset 1px 0 0 rgba(59, 130, 246, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 pointer-events-none rounded-xl" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-blue-500/25">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className={`${themeClasses.textPrimary} text-lg sm:text-xl font-bold`}>
                  {language === 'hebrew' ? 'הערות' : 'Notes'}
                </h3>
              </div>
              {!isEditingNotes && (
                <button
                  onClick={() => {
                    setIsEditingNotes(true);
                    setNotesValue(planData.note || '');
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {language === 'hebrew' ? 'ערוך' : 'Edit'}
                </button>
              )}
            </div>

            {isEditingNotes ? (
              <div className="space-y-3">
                <textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder={language === 'hebrew' ? 'הוסף הערות לתפריט...' : 'Add notes to your meal plan...'}
                  className={`w-full p-3 rounded-lg border ${themeClasses.borderPrimary} ${themeClasses.bgCard} ${themeClasses.textPrimary} resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]`}
                  rows={4}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setIsEditingNotes(false);
                      setNotesValue(planData.note || '');
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {language === 'hebrew' ? 'ביטול' : 'Cancel'}
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const updatedPlanData = { ...planData, note: notesValue };
                        const updatedMeals = [...planData.meals];
                        await saveMealPlanToDatabase(updatedPlanData, updatedMeals);
                        setPlanData(updatedPlanData);
                        setIsEditingNotes(false);
                      } catch (error) {
                        console.error('Error saving notes:', error);
                        alert(language === 'hebrew' ? 'שגיאה בשמירת ההערות' : 'Error saving notes');
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                  >
                    {language === 'hebrew' ? 'שמור' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className={`${themeClasses.bgCard} rounded-lg p-4 min-h-[60px]`}>
                {planData.note ? (
                  <p className={`${themeClasses.textPrimary} whitespace-pre-wrap`}>{planData.note}</p>
                ) : (
                  <p className={`${themeClasses.textSecondary} italic`}>
                    {language === 'hebrew' ? 'אין הערות' : 'No notes'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Ingredient Modal */}
      <AddIngredientModal
        visible={isAddIngredientModalVisible}
        onClose={() => {
          setIsAddIngredientModalVisible(false);
          setSelectedMealIndex(null);
        }}
        onAddIngredient={handleAddIngredient}
        mealName={selectedMealIndex !== null && planData?.meals[selectedMealIndex]?.meal}
        clientRegion={clientRegion}
        userCode={userCode}
      />

      {/* Edit Ingredient Portion Modal */}
      <IngredientPortionModal
        visible={isEditPortionModalVisible}
        onClose={() => {
          setIsEditPortionModalVisible(false);
          setEditingIngredient(null);
          setEditingIngredientIndex(null);
        }}
        onConfirm={handleUpdateIngredientPortion}
        ingredient={editingIngredient}
        clientRegion={clientRegion}
      />

      {/* Add Alternative Ingredient Modal */}
      <AddIngredientModal
        visible={isAddAlternativeIngredientModalVisible}
        onClose={() => {
          setIsAddAlternativeIngredientModalVisible(false);
          setSelectedAlternativeMealIndex(null);
          setSelectedAlternativeType(null);
          setSelectedAlternativeIndex(null);
        }}
        onAddIngredient={handleAddAlternativeIngredient}
        mealName={selectedAlternativeMealIndex !== null && planData?.meals[selectedAlternativeMealIndex]?.meal}
        clientRegion={clientRegion}
        userCode={userCode}
      />

      {/* Edit Alternative Ingredient Portion Modal */}
      <IngredientPortionModal
        visible={isEditAlternativePortionModalVisible}
        onClose={() => {
          setIsEditAlternativePortionModalVisible(false);
          setEditingIngredient(null);
          setEditingIngredientIndex(null);
          setSelectedAlternativeMealIndex(null);
          setSelectedAlternativeType(null);
          setSelectedAlternativeIndex(null);
        }}
        onConfirm={handleUpdateAlternativeIngredientPortion}
        ingredient={editingIngredient}
        clientRegion={clientRegion}
      />
        </>
      )}
    </div>
  );
};

// Macro Summary Circles Component with Tooltips
export const MacroSummaryCircles = ({ 
  totalCalories, totalProtein, totalCarbs, totalFat, 
  dailyGoals, caloriesPercent, proteinPercent, carbsPercent, fatPercent,
  settings, isDarkMode, themeClasses, language, formatWeight 
}) => {
  const [hoveredElement, setHoveredElement] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);

  const handleMouseMove = (e) => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredElement(null);
  };

  const getTooltipContent = () => {
    if (!hoveredElement) return null;

    switch (hoveredElement) {
      case 'calories':
        return {
          label: language === 'hebrew' ? 'קלוריות' : 'Calories',
          current: totalCalories.toLocaleString(),
          target: dailyGoals.calories.toLocaleString(),
          percent: caloriesPercent,
          color: '#10b981'
        };
      case 'protein':
        return {
          label: language === 'hebrew' ? 'חלבון' : 'Protein',
          current: formatWeight(totalProtein),
          target: formatWeight(dailyGoals.protein),
          percent: proteinPercent,
          color: '#a855f7'
        };
      case 'carbs':
        return {
          label: language === 'hebrew' ? 'פחמימות' : 'Carbs',
          current: formatWeight(totalCarbs),
          target: formatWeight(dailyGoals.carbs),
          percent: carbsPercent,
          color: '#3b82f6'
        };
      case 'fat':
        return {
          label: language === 'hebrew' ? 'שומן' : 'Fat',
          current: formatWeight(totalFat),
          target: formatWeight(dailyGoals.fat),
          percent: fatPercent,
          color: '#f59e0b'
        };
      default:
        return null;
    }
  };

  const tooltipContent = getTooltipContent();

  const outerRadius = 120;
  const innerRadius = 100;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const circumference = 2 * Math.PI * innerRadius;
  const segmentLength = circumference / 3;

  // Calculate lengths
  const caloriesNormalLength = Math.min(caloriesPercent, 100) / 100 * outerCircumference;
  const caloriesOverflowLength = caloriesPercent > 100 ? ((caloriesPercent - 100) / 100) * outerCircumference : 0;
  const proteinNormalLength = Math.min(proteinPercent, 100) / 100 * segmentLength;
  const proteinOverflowLength = proteinPercent > 100 ? (proteinPercent - 100) / 100 * segmentLength : 0;
  const carbsNormalLength = Math.min(carbsPercent, 100) / 100 * segmentLength;
  const carbsOverflowLength = carbsPercent > 100 ? (carbsPercent - 100) / 100 * segmentLength : 0;
  const fatNormalLength = Math.min(fatPercent, 100) / 100 * segmentLength;
  const fatOverflowLength = fatPercent > 100 ? (fatPercent - 100) / 100 * segmentLength : 0;

  return (
    <div className="relative w-64 h-64 sm:w-80 sm:h-80 mb-8">
      <svg 
        ref={svgRef}
        className="transform -rotate-90 w-full h-full" 
        viewBox="0 0 280 280"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Outer Circle Background (Calories) */}
        <circle
          cx="140"
          cy="140"
          r={outerRadius}
          fill="none"
          stroke={isDarkMode ? 'rgba(100, 100, 100, 0.15)' : 'rgba(200, 200, 200, 0.2)'}
          strokeWidth="16"
        />
        
        {/* Inner Circle Background (Macros) */}
        <circle
          cx="140"
          cy="140"
          r={innerRadius}
          fill="none"
          stroke={isDarkMode ? 'rgba(100, 100, 100, 0.15)' : 'rgba(200, 200, 200, 0.2)'}
          strokeWidth="16"
        />
        
        {/* Outer Circle - Calories Progress */}
        {settings.showCalories && (
          <>
            {caloriesNormalLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={outerRadius}
                fill="none"
                stroke="#10b981"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${caloriesNormalLength} ${outerCircumference}`}
                strokeDashoffset={0}
                opacity={1}
                className="transition-all duration-1000 ease-out"
              />
            )}
            {caloriesOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={outerRadius}
                fill="none"
                stroke="#059669"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${caloriesOverflowLength} ${outerCircumference}`}
                strokeDashoffset={0}
                opacity={1}
                className="transition-all duration-1000 ease-out"
                style={{ animation: 'flicker 1.5s ease-in-out infinite' }}
              />
            )}
            {/* Invisible hover area for calories */}
            <circle
              cx="140"
              cy="140"
              r={outerRadius}
              fill="none"
              stroke="transparent"
              strokeWidth="24"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredElement('calories')}
            />
          </>
        )}
        
        {/* Inner Circle - Macros */}
        {settings.showMacros && (
          <>
            {/* Step 1: Render all normal portions (0-100%) */}
            {proteinNormalLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#a855f7"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${proteinNormalLength} ${circumference}`}
                strokeDashoffset="0"
                opacity={1}
                className="transition-all duration-1000 ease-out"
              />
            )}
            {carbsNormalLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${carbsNormalLength} ${circumference}`}
                strokeDashoffset={-segmentLength}
                opacity={1}
                className="transition-all duration-1000 ease-out"
              />
            )}
            {fatNormalLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${fatNormalLength} ${circumference}`}
                strokeDashoffset={-segmentLength * 2}
                opacity={1}
                className="transition-all duration-1000 ease-out"
              />
            )}
            
            {/* Step 2: Render all overflow borders */}
            {proteinOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray={`${proteinOverflowLength} ${circumference}`}
                strokeDashoffset={0 - proteinNormalLength}
                opacity={1}
                className="transition-all duration-1000 ease-out"
                style={{ animation: 'flicker 1.5s ease-in-out infinite' }}
              />
            )}
            {carbsOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray={`${carbsOverflowLength} ${circumference}`}
                strokeDashoffset={-segmentLength - carbsNormalLength}
                opacity={1}
                className="transition-all duration-1000 ease-out"
                style={{ animation: 'flicker 1.5s ease-in-out infinite' }}
              />
            )}
            {fatOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#a855f7"
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray={`${fatOverflowLength} ${circumference}`}
                strokeDashoffset={0}
                opacity={1}
                className="transition-all duration-1000 ease-out"
                style={{ animation: 'flicker 1.5s ease-in-out infinite' }}
              />
            )}
            
            {/* Step 3: Render all overflow main arcs */}
            {proteinOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#a855f7"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${proteinOverflowLength} ${circumference}`}
                strokeDashoffset={0 - proteinNormalLength}
                opacity={1}
                className="transition-all duration-1000 ease-out"
                style={{ animation: 'flicker 1.5s ease-in-out infinite' }}
              />
            )}
            {carbsOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${carbsOverflowLength} ${circumference}`}
                strokeDashoffset={-segmentLength - carbsNormalLength}
                opacity={1}
                className="transition-all duration-1000 ease-out"
                style={{ animation: 'flicker 1.5s ease-in-out infinite' }}
              />
            )}
            {fatOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${fatOverflowLength} ${circumference}`}
                strokeDashoffset={0}
                opacity={1}
                className="transition-all duration-1000 ease-out"
                style={{ animation: 'flicker 1.5s ease-in-out infinite' }}
              />
            )}

            {/* Invisible hover areas for macros - normal portions */}
            {proteinNormalLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="transparent"
                strokeWidth="24"
                strokeDasharray={`${proteinNormalLength} ${circumference}`}
                strokeDashoffset="0"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredElement('protein')}
              />
            )}
            {carbsNormalLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="transparent"
                strokeWidth="24"
                strokeDasharray={`${carbsNormalLength} ${circumference}`}
                strokeDashoffset={-segmentLength}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredElement('carbs')}
              />
            )}
            {fatNormalLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="transparent"
                strokeWidth="24"
                strokeDasharray={`${fatNormalLength} ${circumference}`}
                strokeDashoffset={-segmentLength * 2}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredElement('fat')}
              />
            )}
            {/* Invisible hover areas for macros - overflow portions */}
            {proteinOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="transparent"
                strokeWidth="24"
                strokeDasharray={`${proteinOverflowLength} ${circumference}`}
                strokeDashoffset={0 - proteinNormalLength}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredElement('protein')}
              />
            )}
            {carbsOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="transparent"
                strokeWidth="24"
                strokeDasharray={`${carbsOverflowLength} ${circumference}`}
                strokeDashoffset={-segmentLength - carbsNormalLength}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredElement('carbs')}
              />
            )}
            {fatOverflowLength > 0 && (
              <circle
                cx="140"
                cy="140"
                r={innerRadius}
                fill="none"
                stroke="transparent"
                strokeWidth="24"
                strokeDasharray={`${fatOverflowLength} ${circumference}`}
                strokeDashoffset={0}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredElement('fat')}
              />
            )}
          </>
        )}
      </svg>
      
      {/* Center Score */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className={`${themeClasses.textPrimary} text-7xl sm:text-8xl font-extralight mb-3 tracking-tight`}>
          {totalCalories.toLocaleString()}
        </div>
      </div>

      {/* Tooltip */}
      {tooltipContent && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: `${mousePosition.x + 15}px`,
            top: `${mousePosition.y - 50}px`,
            transform: 'translateY(-50%)'
          }}
        >
          <div
            className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg shadow-xl border-2 p-3 min-w-[160px]`}
            style={{ borderColor: tooltipContent.color }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: tooltipContent.color }}
              />
              <span className={`${themeClasses.textPrimary} font-semibold text-sm`}>
                {tooltipContent.label}
              </span>
            </div>
            <div className={`${themeClasses.textPrimary} text-lg font-bold mb-1`}>
              {tooltipContent.current} / {tooltipContent.target}
            </div>
            <div className={`${themeClasses.textSecondary} text-xs`}>
              {tooltipContent.percent}% {language === 'hebrew' ? 'הושלם' : 'complete'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPlanTab;
