import React, { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import { getFoodLogs, createFoodLog, updateFoodLog, deleteFoodLog } from '../../supabase/secondaryClient';
import AddIngredientModal from '../AddIngredientModal';
import IngredientPortionModal from '../IngredientPortionModal';
import { MacroSummaryCircles } from './MyPlanTab';
import { translateMenu } from '../../services/translateService';
import {
  getClientMealPlan,
  normalizeFoodItem,
  parseFoodItems,
  WeightProgressComponent,
  FoodLogProgressComponent,
  WeeklySummaryComponent,
} from '../../pages/ProfilePage';

// Daily Log Tab Component
const DailyLogTab = ({ themeClasses, t, userCode, language, clientRegion, direction }) => {
  const { settings } = useSettings();
  const { isDarkMode } = useTheme();
  const [activeSubTab, setActiveSubTab] = useState('dailyLog'); // 'dailyLog', 'analytics', or 'weeklySummary'
  const [foodLogs, setFoodLogs] = useState([]);
  const [mealPlanTargets, setMealPlanTargets] = useState(null);
  const [mealPlanMeals, setMealPlanMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddFood, setShowAddFood] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isAddIngredientModalVisible, setIsAddIngredientModalVisible] = useState(false);
  const [selectedMealForIngredient, setSelectedMealForIngredient] = useState(null);
  const [isEditPortionModalVisible, setIsEditPortionModalVisible] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [editingLogId, setEditingLogId] = useState(null);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mealWindow, setMealWindow] = useState({ first_meal_time: 7.0, last_meal_time: 23.0 });
  const [showComparison, setShowComparison] = useState({}); // Track which meals have comparison visible
  
  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, []);

  // Load meal window from API
  useEffect(() => {
    const loadMealWindow = async () => {
      if (!userCode) return;
      
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
        const response = await fetch(`${apiUrl}/api/profile/meal-window?userCode=${encodeURIComponent(userCode)}`);
        const result = await response.json();
        
        if (!response.ok) {
          console.error('Error loading meal window:', result.error);
          // Use defaults
          return;
        }
        
        if (result.data) {
          setMealWindow({
            first_meal_time: result.data.first_meal_time || 7.0,
            last_meal_time: result.data.last_meal_time || 23.0
          });
        }
      } catch (err) {
        console.error('Error loading meal window:', err);
        // Use defaults
      }
    };
    
    loadMealWindow();
  }, [userCode]);

  // Helper function to parse time string to float (hour + minute/60)
  const parseTimeToFloat = (timeValue) => {
    if (typeof timeValue === 'number') {
      return timeValue;
    }
    
    if (typeof timeValue === 'string') {
      // Try parsing as HH:MM format
      const parts = timeValue.split(':');
      if (parts.length === 2) {
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        if (!isNaN(hours) && !isNaN(minutes)) {
          return hours + (minutes / 60);
        }
      }
      // Try parsing as float string
      const floatValue = parseFloat(timeValue);
      if (!isNaN(floatValue)) {
        return floatValue;
      }
    }
    
    return 7.0; // Default fallback
  };

  // Helper function to get current time as float
  const getCurrentTimeFloat = () => {
    const now = currentTime;
    return now.getHours() + (now.getMinutes() / 60);
  };

  // Helper function to extract meal names from meal plan (for slot calculation)
  const getMealNamesFromPlan = () => {
    if (!mealPlanMeals || mealPlanMeals.length === 0) {
      return [];
    }
    
    // Extract meal names - try different possible field names
    const mealNames = mealPlanMeals.map(meal => {
      if (typeof meal === 'string') {
        return meal;
      }
      if (typeof meal === 'object' && meal !== null) {
        return (
          meal.meal_name ||
          meal.mealName ||
          meal.name ||
          meal.meal ||
          meal.main?.meal_name ||
          meal.main?.mealName ||
          meal.alternative?.meal_name ||
          'Unknown'
        );
      }
      return 'Unknown';
    }).filter(name => name && name !== 'Unknown');
    
    return mealNames;
  };

  // Function to get current meal info (returns both category and display name)
  const getCurrentMealInfo = () => {
    try {
      const mealNames = getMealNamesFromPlan();
      const numMeals = mealNames.length;
      
      // If no meals in plan, use fallback
      if (numMeals === 0) {
        const fallback = getMealLabelFallback();
        return { category: fallback, displayName: fallback, mealIndex: -1 };
      }
      
      const now = getCurrentTimeFloat();
      const wakeTime = mealWindow.first_meal_time || 7.0;
      const sleepTime = mealWindow.last_meal_time || 23.0;
      
      // Check if before wake time
      if (now < wakeTime) {
        return { category: 'Early Morning', displayName: 'Early Morning', mealIndex: -1 };
      }
      
      // Check if after sleep time
      if (now > sleepTime) {
        return { category: 'Late Night', displayName: 'Late Night', mealIndex: -1 };
      }
      
      // Calculate meal slot
      const windowSize = sleepTime - wakeTime;
      const slotDuration = windowSize / numMeals;
      let index = Math.floor((now - wakeTime) / slotDuration);
      index = Math.min(index, numMeals - 1);
      
      // Get the meal at this index
      const mealAtIndex = mealPlanMeals[index];
      if (!mealAtIndex) {
        return { category: getMealLabelFallback(), displayName: getMealLabelFallback(), mealIndex: -1 };
      }
      
      // Extract meal category and display name
      let mealCategory = 'other';
      let displayName = 'Unknown';
      
      if (typeof mealAtIndex === 'object' && mealAtIndex !== null) {
        mealCategory = mealAtIndex.meal || 'other';
        displayName = mealAtIndex.main?.meal_title || 
                     mealAtIndex.main?.meal_name || 
                     mealAtIndex.meal_name || 
                     mealAtIndex.mealName || 
                     mealAtIndex.meal || 
                     'Unknown';
      } else if (typeof mealAtIndex === 'string') {
        mealCategory = mealAtIndex;
        displayName = mealAtIndex;
      }
      
      return { category: mealCategory, displayName: displayName, mealIndex: index };
    } catch (err) {
      console.error('Error getting current meal:', err);
      const fallback = getMealLabelFallback();
      return { category: fallback, displayName: fallback, mealIndex: -1 };
    }
  };

  // Function to determine current meal based on time using meal plan and time window
  const getCurrentMeal = () => {
    const mealInfo = getCurrentMealInfo();
    return mealInfo.category;
  };

  // Fallback meal label logic
  const getMealLabelFallback = () => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 11) {
      return 'Breakfast';
    }
    if (hour >= 11 && hour < 16) {
      return 'Lunch';
    }
    if (hour >= 16 && hour < 22) {
      return 'Dinner';
    }
    return 'Late Snack';
  };
  
  // Helper function to format numbers with decimal places
  const formatNumber = (num) => {
    // Convert to number and handle invalid values
    const number = typeof num === 'number' ? num : parseFloat(num);
    if (isNaN(number) || number === null || number === undefined) {
      return '0';
    }
    if (settings.decimalPlaces === 0) {
      return Math.round(number).toString();
    }
    return number.toFixed(settings.decimalPlaces);
  };
  
  // Helper function to convert weight based on weightUnit setting
  const convertWeight = (grams) => {
    // Convert to number and handle invalid values
    const number = typeof grams === 'number' ? grams : parseFloat(grams);
    if (isNaN(number) || number === null || number === undefined) {
      return 0;
    }
    if (settings.weightUnit === 'ounces') {
      // Convert grams to ounces (1 gram = 0.035274 ounces)
      return number * 0.035274;
    }
    return number; // Return grams if weightUnit is 'grams'
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

  const navigateWeek = (direction) => {
    const currentDate = new Date(selectedDate);
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    setSelectedDate(newDate.toISOString().split('T')[0]);
  };

  useEffect(() => {
    const loadData = async () => {
      if (!userCode) {
        setError('User code not available');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Load food logs
        const { data: foodLogsData, error: foodLogsError } = await getFoodLogs(userCode, selectedDate);
        
        if (foodLogsError) {
          console.error('Error loading food logs:', foodLogsError);
          setError(foodLogsError.message);
        } else {
          setFoodLogs(foodLogsData || []);
        }

        // Load meal plan targets and meals
        const { data: mealPlanData, error: mealPlanError } = await getClientMealPlan(userCode);
        
        if (mealPlanError) {
          console.error('Error loading meal plan:', mealPlanError);
          // Don't set error for meal plan, just use defaults
          // Keep existing meals if available, otherwise set to empty
          if (mealPlanMeals.length === 0) {
            setMealPlanMeals([]);
          }
        } else if (mealPlanData) {
          // Extract targets from meal plan
          const mealPlan = mealPlanData.meal_plan;
          let targets = {
            calories: mealPlanData.daily_total_calories || 2000,
            protein: 150,
            carbs: 250,
            fat: 65
          };

          // Try to get macros from macros_target field
          if (mealPlanData.macros_target) {
            targets = {
              calories: mealPlanData.daily_total_calories || 2000,
              protein: mealPlanData.macros_target.protein || 150,
              carbs: mealPlanData.macros_target.carbs || 250,
              fat: mealPlanData.macros_target.fat || 65
            };
          } else if (mealPlan && mealPlan.meals) {
            // Calculate targets from meal plan totals
            const totals = mealPlan.meals.reduce((acc, meal) => {
              if (meal.main && meal.main.nutrition) {
                acc.calories += meal.main.nutrition.calories || 0;
                acc.protein += meal.main.nutrition.protein || 0;
                acc.carbs += meal.main.nutrition.carbs || 0;
                acc.fat += meal.main.nutrition.fat || 0;
              }
              return acc;
            }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

            targets = {
              calories: totals.calories || mealPlanData.daily_total_calories || 2000,
              protein: totals.protein || 150,
              carbs: totals.carbs || 250,
              fat: totals.fat || 65
            };
          }

          setMealPlanTargets(targets);
          
          // Store meal plan meals for displaying meal titles
          if (mealPlan && mealPlan.meals && mealPlan.meals.length > 0) {
            // Store original meal categories before translation (for matching with food logs)
            // Food logs use English categories: "breakfast", "lunch", "dinner", "snacks"
            const originalMealCategories = mealPlan.meals.map(m => m.meal);
            console.log('📝 DailyLogTab: Original meal categories:', originalMealCategories);
            
            // Translate meal plan if language is Hebrew
            let mealsToStore = mealPlan.meals;
            if (language === 'hebrew') {
              try {
                setIsTranslating(true);
                console.log('🌐 DailyLogTab: Starting translation for meal plan with', mealPlan.meals.length, 'meals');
                const translatedMealPlan = await translateMenu(mealPlan, 'he');
                
                // Only use translated meals if they exist and have the same structure
                if (translatedMealPlan && translatedMealPlan.meals && translatedMealPlan.meals.length > 0) {
                  console.log('✅ DailyLogTab: Translation successful');
                  console.log('📋 DailyLogTab: Translated meal categories:', translatedMealPlan.meals.map(m => m.meal));
                  console.log('📋 DailyLogTab: Sample translated meal_name:', translatedMealPlan.meals[0]?.main?.meal_name || translatedMealPlan.meals[0]?.main?.meal_title);
                  
                  // Verify the structure is correct before using
                  if (translatedMealPlan.meals[0]?.meal && translatedMealPlan.meals[0]?.main) {
                    // IMPORTANT: Preserve original English meal categories for matching with food logs
                    // Only translate the display name (meal_name), not the category (meal)
                    mealsToStore = translatedMealPlan.meals.map((translatedMeal, index) => {
                      const originalCategory = originalMealCategories[index];
                      console.log(`🔄 DailyLogTab: Restoring category ${index}: "${translatedMeal.meal}" -> "${originalCategory}"`);
                      return {
                        ...translatedMeal,
                        meal: originalCategory || translatedMeal.meal // Restore original English category
                      };
                    });
                    console.log('✅ DailyLogTab: Final meal categories after restore:', mealsToStore.map(m => m.meal));
                  } else {
                    console.warn('⚠️ DailyLogTab: Translated meals have incorrect structure, using original');
                  }
                } else {
                  console.warn('⚠️ DailyLogTab: Translation returned no meals or empty array, using original');
                }
              } catch (translateError) {
                console.error('❌ DailyLogTab: Translation error (using original):', translateError);
                // Continue with original meal plan
              } finally {
                setIsTranslating(false);
              }
            }
            
            console.log('💾 DailyLogTab: Storing meals:', mealsToStore.length, 'meals');
            console.log('💾 DailyLogTab: Final categories to store:', mealsToStore.map(m => m.meal));
            setMealPlanMeals(mealsToStore);
          } else {
            // Fallback to default meals if no meal plan
            console.log('📝 DailyLogTab: No meals in meal plan, keeping existing or using defaults');
            // Only clear if we don't have any meals already
            if (mealPlanMeals.length === 0) {
              setMealPlanMeals([]);
            }
          }
        } else {
          // No meal plan found, keep existing meals if available
          console.log('📝 DailyLogTab: No meal plan data found');
          if (mealPlanMeals.length === 0) {
            setMealPlanMeals([]);
          }
        }
      } catch (err) {
        console.error('Unexpected error loading data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userCode, selectedDate, language]);

  // Delete entire meal (food log entry)
  const handleDeleteMeal = async (logId) => {
    if (!window.confirm(
      language === 'hebrew'
        ? 'האם אתה בטוח שברצונך למחוק את כל הרשומה?'
        : 'Are you sure you want to delete this entire log entry?'
    )) {
      return;
    }

    try {
      setProcessing(true);
      const { error } = await deleteFoodLog(logId);
      
      if (error) {
        console.error('Error deleting food log:', error);
        alert(
          language === 'hebrew'
            ? 'שגיאה במחיקת הרשומה'
            : 'Error deleting log entry'
        );
      } else {
        // Reload food logs
        const { data: foodLogsData, error: foodLogsError } = await getFoodLogs(userCode, selectedDate);
        if (!foodLogsError) {
          setFoodLogs(foodLogsData || []);
        }
      }
    } catch (err) {
      console.error('Unexpected error deleting food log:', err);
      alert(
        language === 'hebrew'
          ? 'שגיאה במחיקת הרשומה'
          : 'Error deleting log entry'
      );
    } finally {
      setProcessing(false);
    }
  };

  // Delete ingredient from a meal
  const handleDeleteIngredient = async (logId, itemIndex) => {
    try {
      setProcessing(true);
      
      // Find the log entry
      const log = foodLogs.find(l => l.id === logId);
      if (!log) return;

      // Parse food_items - preserve original format for saving
      let foodItems = [];
      if (log.food_items) {
        try {
          foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
        } catch (e) {
          console.error('Error parsing food_items:', e);
          return;
        }
      }

      // Remove the ingredient - work with original array structure
      if (Array.isArray(foodItems) && itemIndex >= 0 && itemIndex < foodItems.length) {
        foodItems.splice(itemIndex, 1);
      }

      // If no items left, delete the entire log
      if (foodItems.length === 0) {
        await handleDeleteMeal(logId);
        return;
      }

      // Preserve the original format - if it was an array, keep it as an array
      // Supabase JSONB will handle the conversion automatically
      // Don't stringify it - pass the array directly
      const foodItemsToSave = foodItems;
      const totals = computeTotalsFromFoodItems(foodItemsToSave);

      // Update the food log with recalculated totals
      const { error } = await updateFoodLog(logId, {
        food_items: foodItemsToSave,
        meal_label: log.meal_label || 'snacks',
        image_url: log.image_url || null,
        log_date: log.log_date || selectedDate,
        total_calories: Math.round(totals.totalCalories),
        total_protein_g: Math.round(totals.totalProtein),
        total_carbs_g: Math.round(totals.totalCarbs),
        total_fat_g: Math.round(totals.totalFat)
      });

      if (error) {
        console.error('Error updating food log:', error);
        alert(
          language === 'hebrew'
            ? 'שגיאה במחיקת המרכיב'
            : 'Error deleting ingredient'
        );
      } else {
        // Reload food logs
        const { data: foodLogsData, error: foodLogsError } = await getFoodLogs(userCode, selectedDate);
        if (!foodLogsError) {
          setFoodLogs(foodLogsData || []);
        }
      }
    } catch (err) {
      console.error('Unexpected error deleting ingredient:', err);
      alert(
        language === 'hebrew'
          ? 'שגיאה במחיקת המרכיב'
          : 'Error deleting ingredient'
      );
    } finally {
      setProcessing(false);
    }
  };

  // Move meal to different category
  const handleMoveMeal = async (logId, newMealLabel) => {
    try {
      setProcessing(true);
      
      // Find the log entry
      const log = foodLogs.find(l => l.id === logId);
      if (!log) return;

      // Only update the meal_label - don't touch any other fields
      const { error } = await updateFoodLog(logId, {
        meal_label: newMealLabel
      });

      if (error) {
        console.error('Error moving meal:', error);
        alert(
          language === 'hebrew'
            ? 'שגיאה בהעברת הארוחה'
            : 'Error moving meal'
        );
      } else {
        // Reload food logs
        const { data: foodLogsData, error: foodLogsError } = await getFoodLogs(userCode, selectedDate);
        if (!foodLogsError) {
          setFoodLogs(foodLogsData || []);
        }
      }
    } catch (err) {
      console.error('Unexpected error moving meal:', err);
      alert(
        language === 'hebrew'
          ? 'שגיאה בהעברת הארוחה'
          : 'Error moving meal'
      );
    } finally {
      setProcessing(false);
    }
  };

  // Update meal time
  const handleUpdateMealTime = async (logId, newTimeString) => {
    try {
      setProcessing(true);
      
      // Find the log entry
      const log = foodLogs.find(l => l.id === logId);
      if (!log) {
        console.error('Log not found:', logId);
        setProcessing(false);
        return;
      }

      // Parse the new time string (format: "HH:MM")
      const [hours, minutes] = newTimeString.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        alert(
          language === 'hebrew'
            ? 'פורמט זמן לא תקין'
            : 'Invalid time format'
        );
        setProcessing(false);
        return;
      }

      // Create a new date with the log_date (the day the food was eaten) and new time
      // Use log_date for the date portion to ensure we use the correct day the food was eaten
      const dateString = log.log_date || log.created_at?.split('T')[0] || selectedDate;
      const newDateTime = new Date(dateString);
      newDateTime.setHours(hours, minutes, 0, 0);

      console.log('Updating meal time:', {
        logId,
        newTimeString,
        dateString,
        newDateTime: newDateTime.toISOString()
      });

      // Update the food log with the new updated_at time
      const { error } = await updateFoodLog(logId, {
        updated_at: newDateTime.toISOString()
      });

      if (error) {
        console.error('Error updating meal time:', error);
        alert(
          language === 'hebrew'
            ? 'שגיאה בעדכון זמן הארוחה'
            : 'Error updating meal time'
        );
      } else {
        // Reload food logs
        const { data: foodLogsData, error: foodLogsError } = await getFoodLogs(userCode, selectedDate);
        if (!foodLogsError) {
          setFoodLogs(foodLogsData || []);
        }
      }
    } catch (err) {
      console.error('Unexpected error updating meal time:', err);
      alert(
        language === 'hebrew'
          ? 'שגיאה בעדכון זמן הארוחה'
          : 'Error updating meal time'
      );
    } finally {
      setProcessing(false);
    }
  };

  // Open add ingredient modal
  const handleOpenAddIngredient = (mealCategory) => {
    setSelectedMealForIngredient(mealCategory);
    setIsAddIngredientModalVisible(true);
  };

  // Compute totals from food_items array (supports both macros and legacy c/p/f/cals format)
  const computeTotalsFromFoodItems = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
      return { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 };
    }
    return items.reduce((acc, item) => {
      if (item.macros && typeof item.macros === 'object') {
        acc.totalCalories += Number(item.macros.calories || 0);
        acc.totalProtein += Number(item.macros.protein_g || 0);
        acc.totalCarbs += Number(item.macros.carbs_g || 0);
        acc.totalFat += Number(item.macros.fat_g || 0);
      } else {
        acc.totalCalories += Number(item.cals || 0);
        acc.totalProtein += Number(item.p || 0);
        acc.totalCarbs += Number(item.c || 0);
        acc.totalFat += Number(item.f || 0);
      }
      return acc;
    }, { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 });
  };

  // Add ingredient to food log
  const handleAddIngredient = async (ingredient) => {
    if (!selectedMealForIngredient || !userCode) return;

    try {
      setProcessing(true);

      // Convert ingredient from AddIngredientModal to food_items schema: name, macros, confidence, visual_evidence, portion_estimate
      const grams = Number(ingredient['portionSI(gram)'] || 0);
      const portionEstimate = ingredient.household_measure?.trim()
        ? ingredient.household_measure.trim()
        : (language === 'hebrew' ? `כ-${grams} גרם` : `~${grams}g`);
      const foodItem = {
        name: ingredient.item || ingredient.name || 'Unknown Item',
        macros: {
          fat_g: Math.round(Number(ingredient.fat || 0) * 10) / 10,
          carbs_g: Math.round(Number(ingredient.carbs || 0) * 10) / 10,
          calories: Math.round(Number(ingredient.calories || 0)),
          protein_g: Math.round(Number(ingredient.protein || 0) * 10) / 10
        },
        confidence: 0.8,
        visual_evidence: language === 'hebrew' ? 'הזנה ידנית' : 'Manual entry',
        portion_estimate: portionEstimate
      };

      console.log('Converted food item:', JSON.stringify(foodItem, null, 2));

      // Find the most recent food log entry for this meal category and date
      const existingLogs = groupedLogs[selectedMealForIngredient] || [];
      const mostRecentLog = existingLogs.length > 0 ? existingLogs[0] : null; // First by log_date then created_at desc

      if (mostRecentLog) {
        // Add ingredient to existing log
        let foodItems = [];
        if (mostRecentLog.food_items) {
          try {
            foodItems = typeof mostRecentLog.food_items === 'string' 
              ? JSON.parse(mostRecentLog.food_items) 
              : mostRecentLog.food_items;
          } catch (e) {
            console.error('Error parsing food_items:', e);
            foodItems = [];
          }
        }

        // Add new food item
        foodItems.push(foodItem);
        const totals = computeTotalsFromFoodItems(foodItems);

        // Update the food log with food_items and total columns
        const { error } = await updateFoodLog(mostRecentLog.id, {
          food_items: foodItems,
        total_calories: Math.round(totals.totalCalories),
        total_protein_g: Math.round(totals.totalProtein),
        total_carbs_g: Math.round(totals.totalCarbs),
        total_fat_g: Math.round(totals.totalFat)
      });

        if (error) {
          console.error('Error updating food log:', error);
          alert(
            language === 'hebrew'
              ? 'שגיאה בהוספת המרכיב'
              : 'Error adding ingredient'
          );
        } else {
          // Reload food logs
          const { data: foodLogsData, error: foodLogsError } = await getFoodLogs(userCode, selectedDate);
          if (!foodLogsError) {
            setFoodLogs(foodLogsData || []);
          }
          alert(
            language === 'hebrew'
              ? 'המרכיב נוסף בהצלחה'
              : 'Ingredient added successfully'
          );
        }
      } else {
        // Create new food log entry with food_items and totals
        const foodItemsForNew = [foodItem];
        const totals = computeTotalsFromFoodItems(foodItemsForNew);
        const newFoodLog = {
          meal_label: selectedMealForIngredient,
          food_items: foodItemsForNew,
          log_date: selectedDate,
          total_calories: Math.round(totals.totalCalories),
          total_protein_g: Math.round(totals.totalProtein),
          total_carbs_g: Math.round(totals.totalCarbs),
          total_fat_g: Math.round(totals.totalFat)
        };

        console.log('Creating new food log with data:', JSON.stringify(newFoodLog, null, 2));
        console.log('User code:', userCode);
        console.log('Selected date:', selectedDate);

        const { data: createdLog, error } = await createFoodLog(userCode, newFoodLog);

        if (error) {
          console.error('Error creating food log:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          alert(
            language === 'hebrew'
              ? `שגיאה ביצירת רשומה חדשה: ${error.message || 'Unknown error'}`
              : `Error creating new log entry: ${error.message || 'Unknown error'}`
          );
        } else {
          // Reload food logs
          const { data: foodLogsData, error: foodLogsError } = await getFoodLogs(userCode, selectedDate);
          if (!foodLogsError) {
            setFoodLogs(foodLogsData || []);
          }
          alert(
            language === 'hebrew'
              ? 'המרכיב נוסף בהצלחה'
              : 'Ingredient added successfully'
          );
        }
      }
    } catch (err) {
      console.error('Unexpected error adding ingredient:', err);
      alert(
        language === 'hebrew'
          ? 'שגיאה בהוספת המרכיב'
          : 'Error adding ingredient'
      );
    } finally {
      setProcessing(false);
    }
  };

  // Handle edit ingredient portion
  const handleEditIngredient = (logId, itemIndex, item) => {
    // Convert food item format to ingredient format expected by IngredientPortionModal
    // Extract grams from quantity string (e.g., "100g" -> 100)
    // Daily log only uses grams, no household measure
    const quantityStr = item.quantity || '100g';
    const gramsMatch = quantityStr.toString().match(/(\d+(?:\.\d+)?)/);
    const grams = gramsMatch ? parseFloat(gramsMatch[1]) : 100;
    
    // Calculate original 100g values to properly scale nutrition
    const originalScale = grams / 100;
    const original100gCalories = (item.cals || 0) / originalScale;
    const original100gProtein = (item.p || 0) / originalScale;
    const original100gCarbs = (item.c || 0) / originalScale;
    const original100gFat = (item.f || 0) / originalScale;
    
    // Create ingredient object in the format expected by IngredientPortionModal
    // Daily log only uses grams, so household_measure is empty
    const ingredient = {
      item: item.name || 'Unknown Item',
      name: item.name || 'Unknown Item',
      'portionSI(gram)': grams,
      household_measure: '', // Daily log doesn't use household measure
      calories: item.cals || 0,
      protein: item.p || 0,
      carbs: item.c || 0,
      fat: item.f || 0,
      // Store original 100g values for proper scaling
      _original100gCalories: original100gCalories,
      _original100gProtein: original100gProtein,
      _original100gCarbs: original100gCarbs,
      _original100gFat: original100gFat
    };
    
    setEditingLogId(logId);
    setEditingItemIndex(itemIndex);
    setEditingIngredient(ingredient);
    setIsEditPortionModalVisible(true);
  };

  // Handle update ingredient portion
  const handleUpdateIngredientPortion = async ({ quantity: quantityNum, householdMeasure }) => {
    if (editingLogId === null || editingItemIndex === null || !editingIngredient) return;

    try {
      setProcessing(true);
      
      // Find the log entry
      const log = foodLogs.find(l => l.id === editingLogId);
      if (!log) return;

      // Parse food_items - preserve original format for saving
      let foodItems = [];
      if (log.food_items) {
        try {
          foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
        } catch (e) {
          console.error('Error parsing food_items:', e);
          return;
        }
      }

      // Get the old ingredient and normalize it for calculations
      const oldItemRaw = foodItems[editingItemIndex];
      if (!oldItemRaw) return;
      const oldItem = normalizeFoodItem(oldItemRaw);

      // Calculate new nutrition values
      // Use original 100g values if available, otherwise calculate from current values
      const originalScale = (editingIngredient['portionSI(gram)'] || 100) / 100;
      const original100gCalories = editingIngredient._original100gCalories || (oldItem.cals || 0) / originalScale;
      const original100gProtein = editingIngredient._original100gProtein || (oldItem.p || 0) / originalScale;
      const original100gCarbs = editingIngredient._original100gCarbs || (oldItem.c || 0) / originalScale;
      const original100gFat = editingIngredient._original100gFat || (oldItem.f || 0) / originalScale;

      // Calculate new values with the new quantity
      // Daily log only uses grams, so always save as "Xg" format
      const newScale = quantityNum / 100;
      
      // Preserve original format structure when updating
      // If original had macros object, keep that structure; otherwise use flat structure
      const updatedItem = oldItemRaw.macros ? {
        ...oldItemRaw,
        macros: {
          ...oldItemRaw.macros,
          calories: Math.round(original100gCalories * newScale),
          protein_g: Math.round(original100gProtein * newScale * 10) / 10,
          carbs_g: Math.round(original100gCarbs * newScale * 10) / 10,
          fat_g: Math.round(original100gFat * newScale * 10) / 10
        },
        portion_estimate: `${quantityNum}g`
      } : {
        ...oldItemRaw,
        cals: Math.round(original100gCalories * newScale),
        p: Math.round(original100gProtein * newScale * 10) / 10,
        c: Math.round(original100gCarbs * newScale * 10) / 10,
        f: Math.round(original100gFat * newScale * 10) / 10,
        quantity: `${quantityNum}g` // Daily log always uses grams format
      };

      // Update the item in the array
      foodItems[editingItemIndex] = updatedItem;
      const totals = computeTotalsFromFoodItems(foodItems);

      // Update the food log with recalculated totals
      const { error } = await updateFoodLog(editingLogId, {
        food_items: foodItems,
        meal_label: log.meal_label || 'snacks',
        image_url: log.image_url || null,
        log_date: log.log_date || selectedDate,
        total_calories: Math.round(totals.totalCalories),
        total_protein_g: Math.round(totals.totalProtein),
        total_carbs_g: Math.round(totals.totalCarbs),
        total_fat_g: Math.round(totals.totalFat)
      });

      if (error) {
        console.error('Error updating food log:', error);
        alert(
          language === 'hebrew'
            ? 'שגיאה בעדכון המרכיב'
            : 'Error updating ingredient'
        );
      } else {
        // Reload food logs
        const { data: foodLogsData, error: foodLogsError } = await getFoodLogs(userCode, selectedDate);
        if (!foodLogsError) {
          setFoodLogs(foodLogsData || []);
        }
        alert(
          language === 'hebrew'
            ? 'המרכיב עודכן בהצלחה'
            : 'Ingredient updated successfully'
        );
      }

      // Close modal and reset
      setIsEditPortionModalVisible(false);
      setEditingIngredient(null);
      setEditingLogId(null);
      setEditingItemIndex(null);
    } catch (err) {
      console.error('Unexpected error updating ingredient:', err);
      alert(
        language === 'hebrew'
          ? 'שגיאה בעדכון המרכיב'
          : 'Error updating ingredient'
      );
    } finally {
      setProcessing(false);
    }
  };

  // Calculate totals from food logs using food_items JSON column
  const totalCalories = foodLogs.reduce((sum, log) => {
    const foodItems = parseFoodItems(log);
    const logCalories = foodItems.reduce((itemSum, item) => itemSum + (item.cals || 0), 0);
    // Fallback to old column only if food_items is empty or not available
    return sum + (logCalories > 0 ? logCalories : (log.total_calories || 0));
  }, 0);
  
  const totalProtein = foodLogs.reduce((sum, log) => {
    const foodItems = parseFoodItems(log);
    const logProtein = foodItems.reduce((itemSum, item) => itemSum + (item.p || 0), 0);
    // Fallback to old column only if food_items is empty or not available
    return sum + (logProtein > 0 ? logProtein : (log.total_protein_g || 0));
  }, 0);
  
  const totalCarbs = foodLogs.reduce((sum, log) => {
    const foodItems = parseFoodItems(log);
    const logCarbs = foodItems.reduce((itemSum, item) => itemSum + (item.c || 0), 0);
    // Fallback to old column only if food_items is empty or not available
    return sum + (logCarbs > 0 ? logCarbs : (log.total_carbs_g || 0));
  }, 0);
  
  const totalFat = foodLogs.reduce((sum, log) => {
    const foodItems = parseFoodItems(log);
    const logFat = foodItems.reduce((itemSum, item) => itemSum + (item.f || 0), 0);
    // Fallback to old column only if food_items is empty or not available
    return sum + (logFat > 0 ? logFat : (log.total_fat_g || 0));
  }, 0);

  // Get meals from meal plan, or fallback to default meals
  // Always add "other" as the last meal regardless of how many meals exist
  const meals = mealPlanMeals.length > 0 
    ? [...mealPlanMeals.map(meal => meal.meal), 'other'] // Extract meal categories from meal plan and add "other"
    : ['breakfast', 'lunch', 'dinner', 'snacks', 'other']; // Fallback to default with "other"
  
  // Create a map of meal category to meal title
  const mealTitleMap = mealPlanMeals.reduce((acc, meal) => {
    if (meal && meal.meal) {
      const mealName = meal.main?.meal_title || meal.main?.meal_name || meal.main?.title || meal.meal;
      acc[meal.meal] = mealName;
      console.log(`📋 DailyLogTab: Meal mapping - ${meal.meal} -> ${mealName}`);
    }
    return acc;
  }, {});

  // Group food logs by meal
  // If a meal_label doesn't match any meal category, add it to "other"
  const groupedLogs = meals.reduce((acc, meal) => {
    acc[meal] = [];
    return acc;
  }, {});

  // Group food logs by meal_label; only include logs for the selected date by log_date
  const logsForSelectedDate = (foodLogs || []).filter(
    (log) => (log.log_date || '').split('T')[0] === selectedDate
  );
  logsForSelectedDate.forEach(log => {
    const logMealLabel = (log.meal_label || '').trim();
    const logMealLabelLower = logMealLabel.toLowerCase();
    
    // First try exact match (case-sensitive) - meal_label matches meal plan format exactly
    let matchedMeal = meals.find(meal => meal.trim() === logMealLabel);
    
    // If no exact match, try case-insensitive match
    if (!matchedMeal) {
      matchedMeal = meals.find(meal => meal.trim().toLowerCase() === logMealLabelLower);
    }
    
    // If still no match, check for Hebrew variations
    if (!matchedMeal) {
      if (logMealLabelLower === 'בוקר' || logMealLabelLower === 'ארוחת בוקר') matchedMeal = 'breakfast';
      else if (logMealLabelLower === 'צהריים' || logMealLabelLower === 'צהרים' || logMealLabelLower === 'ארוחת צהריים') matchedMeal = 'lunch';
      else if (logMealLabelLower === 'ערב' || logMealLabelLower === 'ארוחת ערב') matchedMeal = 'dinner';
      else if (logMealLabelLower === 'חטיפים' || logMealLabelLower === 'חטיף') matchedMeal = 'snacks';
      else if (logMealLabelLower === 'אחר') matchedMeal = 'other';
    }
    
    if (matchedMeal && groupedLogs[matchedMeal]) {
      // Add to the matched meal category
      groupedLogs[matchedMeal].push(log);
    } else {
      // If no match found, add to "other"
      if (groupedLogs['other']) {
        groupedLogs['other'].push(log);
      }
    }
  });

  if (loading || isTranslating) {
  return (
      <div className={`min-h-screen p-8 animate-fadeIn`}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className={`${themeClasses.textSecondary}`}>
              {isTranslating 
                ? (language === 'hebrew' ? 'מתרגם תוכנית תזונה...' : 'Translating meal plan...') 
                : 'Loading food logs...'
              }
            </p>
      </div>
        </div>
        </div>
    );
  }

  // Calculate completion percentage using meal plan targets
  const dailyGoals = mealPlanTargets || {
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 65
  };

  const caloriesPercent = Math.round((totalCalories / dailyGoals.calories) * 100);
  const proteinPercent = Math.round((totalProtein / dailyGoals.protein) * 100);
  const carbsPercent = Math.round((totalCarbs / dailyGoals.carbs) * 100);
  const fatPercent = Math.round((totalFat / dailyGoals.fat) * 100);

  const overallPercent = Math.round((caloriesPercent + proteinPercent + carbsPercent + fatPercent) / 4);

  // Generate week dates
  const generateWeekDates = (selectedDate) => {
    const date = new Date(selectedDate);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const startOfWeek = new Date(date);
    
    // Regions that start the week on Sunday:
    // United States, Canada, most of the Americas (like Brazil, Mexico, Colombia), 
    // Japan, South Korea, India, Indonesia, Pakistan, the Philippines, Israel
    const sundayStartRegions = [
      'north_america',      // United States, Canada
      'mexico',             // Mexico
      'latam_south_america', // Brazil, Colombia, South America
      'japan',              // Japan
      'korea',              // South Korea
      'india_south_asia',   // India, Pakistan
      'indonesia_malaysia', // Indonesia
      'southeast_asia',     // Philippines
      'israel'              // Israel
    ];
    
    // Check if region should start from Sunday (case-insensitive)
    const startFromSunday = clientRegion && sundayStartRegions.some(region => 
      region.toLowerCase() === clientRegion.toLowerCase()
    );
    
    if (startFromSunday) {
      // Start from Sunday (dayOfWeek 0)
      startOfWeek.setDate(date.getDate() - dayOfWeek);
    } else {
      // Start from Monday (dayOfWeek 1)
      startOfWeek.setDate(date.getDate() - dayOfWeek + 1);
    }
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      weekDates.push(currentDate);
    }
    return weekDates;
  };

  const weekDates = generateWeekDates(selectedDate);
  const selectedDateObj = new Date(selectedDate);
  // JavaScript getDay() returns: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  const dayNames = language === 'hebrew' 
    ? ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'יום שבת'] // Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = language === 'hebrew'
    ? ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className={`min-h-screen p-4 sm:p-6 md:p-8 animate-fadeIn`}>
      {/* Sub-tabs Navigation */}
      <div className={`mb-4 sm:mb-6 flex gap-1 sm:gap-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <button
          onClick={() => setActiveSubTab('dailyLog')}
          className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all duration-300 border-b-2 ${
            activeSubTab === 'dailyLog'
              ? `${themeClasses.textPrimary} border-emerald-500`
              : `${themeClasses.textSecondary} border-transparent hover:border-emerald-500/50`
          }`}
        >
          {language === 'hebrew' ? 'יומן יומי' : 'Daily Log'}
        </button>
        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all duration-300 border-b-2 ${
            activeSubTab === 'analytics'
              ? `${themeClasses.textPrimary} border-emerald-500`
              : `${themeClasses.textSecondary} border-transparent hover:border-emerald-500/50`
          }`}
        >
          {language === 'hebrew' ? 'אנליטיקה' : 'Analytics'}
        </button>
        <button
          onClick={() => setActiveSubTab('weeklySummary')}
          className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all duration-300 border-b-2 ${
            activeSubTab === 'weeklySummary'
              ? `${themeClasses.textPrimary} border-emerald-500`
              : `${themeClasses.textSecondary} border-transparent hover:border-emerald-500/50`
          }`}
        >
          {language === 'hebrew' ? 'סיכום שבועי' : 'Weekly Summary'}
        </button>
      </div>

      {/* Analytics Sub-tab Content */}
      {activeSubTab === 'analytics' && (
        <>
          <WeightProgressComponent 
            userCode={userCode} 
            themeClasses={themeClasses} 
            language={language}
            isDarkMode={isDarkMode}
          />
          
          <FoodLogProgressComponent 
            userCode={userCode} 
            themeClasses={themeClasses} 
            language={language}
            isDarkMode={isDarkMode}
            onAddLog={() => setActiveSubTab('dailyLog')}
          />
        </>
      )}

      {/* Weekly Summary Sub-tab Content */}
      {activeSubTab === 'weeklySummary' && (
        <WeeklySummaryComponent
          userCode={userCode}
          themeClasses={themeClasses}
          language={language}
          isDarkMode={isDarkMode}
          settings={settings}
          clientRegion={clientRegion}
          direction={direction}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          onDateClick={() => setActiveSubTab('dailyLog')}
        />
      )}

      {/* Daily Log Sub-tab Content */}
      {activeSubTab === 'dailyLog' && (
        <>
      {/* Date Selector Section */}
      <div className="mb-6 sm:mb-8 md:mb-10 lg:mb-12 animate-slideInUp relative rounded-xl p-3 sm:p-4 md:p-6" style={{
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
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h2 className={`${themeClasses.textPrimary} text-xl sm:text-2xl md:text-3xl font-bold tracking-tight mb-1 sm:mb-2`}>
            {dayNames[selectedDateObj.getDay()]}, {monthNames[selectedDateObj.getMonth()]} {selectedDateObj.getDate()}
          </h2>
          <p className={`${themeClasses.textSecondary} text-xs sm:text-sm md:text-base`}>
            {language === 'hebrew' ? 'בחר תאריך כדי לראות את יומן התזונה שלך' : 'Choose a date to view your nutrition log'}
          </p>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => navigateWeek('prev')}
              className={`w-8 h-8 sm:w-10 sm:h-10 ${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-lg flex items-center justify-center transition-all duration-300 active:scale-95`}
            >
              <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button 
              onClick={() => navigateWeek('next')}
              className={`w-8 h-8 sm:w-10 sm:h-10 ${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} rounded-lg flex items-center justify-center transition-all duration-300 active:scale-95`}
            >
              <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${themeClasses.textPrimary} ${direction === 'rtl' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <button 
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg transition-all duration-300 text-xs sm:text-sm active:scale-95"
          >
            {language === 'hebrew' ? 'היום' : 'Today'}
          </button>
        </div>

        {/* Week Calendar - Scrollable on mobile */}
        <div className="overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 mb-4 sm:mb-6 md:mb-8">
          <div className="flex gap-2 sm:gap-3 min-w-max sm:min-w-0">
            {weekDates.map((date, index) => {
              const isSelected = date.toISOString().split('T')[0] === selectedDate;
              const dayName = dayNames[date.getDay()];
              const dayNumber = date.getDate();
              
              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(date.toISOString().split('T')[0])}
                  className={`flex-shrink-0 w-14 sm:w-16 md:flex-1 md:min-w-0 p-2 sm:p-3 md:p-4 rounded-xl transition-all duration-300 active:scale-95 ${
                    isSelected 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' 
                      : `${themeClasses.bgSecondary} hover:${themeClasses.bgPrimary} ${themeClasses.textSecondary}`
                  }`}
                >
                  <div className="text-center">
                    <div className="text-xs sm:text-sm font-medium">{dayName}</div>
                    <div className="text-base sm:text-lg md:text-xl font-bold mt-0.5 sm:mt-1">{dayNumber}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        </div>
      </div>

      {/* Macro Summary Section - Apple Style PAI */}
      <div className="mb-8 sm:mb-10 md:mb-12 animate-slideInUp" style={{ animationDelay: '0.3s' }}>
        <div className={`${themeClasses.bgCard} rounded-3xl p-8 sm:p-12 shadow-2xl border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h3 className={`${themeClasses.textPrimary} text-xl sm:text-2xl font-semibold`}>
              {language === 'hebrew' ? 'סיכום מקרו' : 'Macro Summary'}
            </h3>
            <div className={`${themeClasses.textSecondary} text-sm sm:text-base`}>
              {overallPercent}% {language === 'hebrew' ? 'הושלם' : 'complete'}
            </div>
          </div>

          {/* Circular Score Display */}
          <div className="flex flex-col items-center justify-center py-8">
            {/* Two Concentric Circles - Apple Style */}
            <MacroSummaryCircles
              totalCalories={totalCalories}
              totalProtein={totalProtein}
              totalCarbs={totalCarbs}
              totalFat={totalFat}
              dailyGoals={dailyGoals}
              caloriesPercent={caloriesPercent}
              proteinPercent={proteinPercent}
              carbsPercent={carbsPercent}
              fatPercent={fatPercent}
              settings={settings}
              isDarkMode={isDarkMode}
              themeClasses={themeClasses}
              language={language}
              formatWeight={formatWeight}
            />

            {/* Macro Details - Minimal List */}
            <div className="w-full max-w-md space-y-3 mt-4">
              {settings.showCalories && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full mr-3"></div>
                    <span className={`${themeClasses.textSecondary} text-sm`}>
                      {language === 'hebrew' ? 'קלוריות' : 'Calories'}
                    </span>
                  </div>
                  <span className={`${themeClasses.textPrimary} text-sm font-medium`}>
                    {totalCalories.toLocaleString()} / {dailyGoals.calories.toLocaleString()}
                  </span>
                </div>
              )}
              
              {settings.showMacros && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-purple-500 rounded-full mr-3"></div>
                      <span className={`${themeClasses.textSecondary} text-sm`}>
                        {language === 'hebrew' ? 'חלבון' : 'Protein'}
                      </span>
                    </div>
                    <span className={`${themeClasses.textPrimary} text-sm font-medium`}>
                      {formatWeight(totalProtein)} / {formatWeight(dailyGoals.protein)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                      <span className={`${themeClasses.textSecondary} text-sm`}>
                        {language === 'hebrew' ? 'פחמימות' : 'Carbs'}
                      </span>
                    </div>
                    <span className={`${themeClasses.textPrimary} text-sm font-medium`}>
                      {formatWeight(totalCarbs)} / {formatWeight(dailyGoals.carbs)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-amber-500 rounded-full mr-3"></div>
                      <span className={`${themeClasses.textSecondary} text-sm`}>
                        {language === 'hebrew' ? 'שומן' : 'Fat'}
                      </span>
                    </div>
                    <span className={`${themeClasses.textPrimary} text-sm font-medium`}>
                      {formatWeight(totalFat)} / {formatWeight(dailyGoals.fat)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Current Meal Indicator - Only show if client has a meal plan */}
      {selectedDate === new Date().toISOString().split('T')[0] && 
       mealPlanMeals && mealPlanMeals.length > 0 && (() => {
        const mealInfo = getCurrentMealInfo();
        const currentMealLower = mealInfo.category.toLowerCase();
        
        // Get meal icon
        const getMealIcon = () => {
          if (currentMealLower.includes('breakfast') || currentMealLower.includes('בוקר') || currentMealLower === 'early morning') {
            return '🌅';
          } else if (currentMealLower.includes('lunch') || currentMealLower.includes('צהריים')) {
            return '☀️';
          } else if (currentMealLower.includes('dinner') || currentMealLower.includes('ערב')) {
            return '🌙';
          } else if (currentMealLower.includes('snack') || currentMealLower.includes('חטיף') || currentMealLower === 'late snack' || currentMealLower === 'late night') {
            return '🍎';
          }
          return '🍽️';
        };
        
        // Get meal display name - use the displayName from mealInfo, or fallback to mealTitleMap
        const getMealDisplayName = () => {
          // If we have a display name from mealInfo, use it
          if (mealInfo.displayName && mealInfo.displayName !== 'Unknown') {
            return mealInfo.displayName;
          }
          
          // Try to find in mealTitleMap
          if (mealTitleMap[mealInfo.category]) {
            return mealTitleMap[mealInfo.category];
          }
          
          // Try translation
          if (t.profile.dailyLogTab.meals[mealInfo.category]) {
            return t.profile.dailyLogTab.meals[mealInfo.category];
          }
          
          // Return category as fallback
          return mealInfo.category;
        };
        
        return (
          <div className="mt-12 animate-slideInUp" style={{ animationDelay: '0.75s' }}>
            <div className={`${themeClasses.bgCard} border-2 border-emerald-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden`}>
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10 pointer-events-none" />
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg animate-pulse">
                  <span className="text-3xl">{getMealIcon()}</span>
                </div>
                <div className="flex-1">
                  <p className={`${themeClasses.textSecondary} text-sm mb-1`}>
                    {language === 'hebrew' ? 'עכשיו זמן ל' : 'Time for'}
                  </p>
                  <p className={`${themeClasses.textPrimary} text-xl font-bold`}>
                    {getMealDisplayName()}
                  </p>
                  <p className={`${themeClasses.textMuted} text-xs mt-1`}>
                    {currentTime.toLocaleTimeString(language === 'hebrew' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Meals Section */}
      <div className="mt-12 animate-slideInUp" style={{ animationDelay: '0.8s' }}>
        <div className="flex items-center mb-8">
          <div>
            <h3 className={`${themeClasses.textPrimary} text-2xl font-bold tracking-tight`}>
              {language === 'hebrew' ? 'ארוחות' : 'Meals'}
            </h3>
            <p className={`${themeClasses.textSecondary} text-base mt-1`}>
              {language === 'hebrew' ? 'רשומות המזון שלך עבור' : 'Your food entries for'} {dayNames[selectedDateObj.getDay()]}, {monthNames[selectedDateObj.getMonth()]} {selectedDateObj.getDate()}
            </p>
          </div>
        </div>

      <div className="space-y-6">
          {meals.map((meal, index) => {
            const mealLogs = groupedLogs[meal] || [];
            const getMealIcon = (mealName) => {
              const name = mealName.toLowerCase();
              if (name.includes('breakfast') || name.includes('בוקר')) return '🌅';
              if (name.includes('lunch') || name.includes('צהריים')) return '☀️';
              if (name.includes('dinner') || name.includes('ערב')) return '🌙';
              if (name.includes('snack') || name.includes('חטיף')) return '🍎';
              if (name === 'other' || name.includes('אחר')) return '🍽️';
              return '🍽️';
            };

            const getMealColor = (mealName) => {
              const name = mealName.toLowerCase();
              if (name.includes('breakfast') || name.includes('בוקר')) return 'from-yellow-500 to-orange-500';
              if (name.includes('lunch') || name.includes('צהריים')) return 'from-orange-500 to-red-500';
              if (name.includes('dinner') || name.includes('ערב')) return 'from-blue-500 to-purple-500';
              if (name.includes('snack') || name.includes('חטיף')) return 'from-purple-500 to-pink-500';
              if (name === 'other' || name.includes('אחר')) return 'from-emerald-500 to-teal-500';
              return 'from-emerald-500 to-teal-500';
            };

          return (
              <div 
                key={meal} 
                className={`${themeClasses.bgCard} border border-blue-500/30 rounded-2xl p-6 shadow-xl shadow-blue-500/10 transform hover:scale-[1.01] transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 animate-slideInUp lg:relative group`}
                style={{ 
                  animationDelay: `${0.9 + index * 0.1}s`,
                }}
              >
                {/* Mobile-only enhanced styling */}
                <div className="lg:hidden absolute inset-0 rounded-2xl pointer-events-none" style={{
                  borderLeft: '4px solid',
                  borderLeftColor: meal.includes('breakfast') || meal.includes('בוקר') ? 'rgba(251, 191, 36, 0.4)' :
                                  meal.includes('lunch') || meal.includes('צהריים') ? 'rgba(249, 115, 22, 0.4)' :
                                  meal.includes('dinner') || meal.includes('ערב') ? 'rgba(59, 130, 246, 0.4)' :
                                  meal.includes('snack') || meal.includes('חטיף') ? 'rgba(168, 85, 247, 0.4)' :
                                  'rgba(16, 185, 129, 0.4)',
                  borderRight: '2px solid',
                  borderRightColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                  borderTop: '2px solid',
                  borderTopColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                  borderBottom: '2px solid',
                  borderBottomColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                  boxShadow: isDarkMode 
                    ? 'inset 1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)' 
                    : 'inset 1px 0 0 rgba(16, 185, 129, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }} />
                
                {/* Decorative gradient overlay - Mobile only */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none lg:hidden rounded-2xl" />
                
                <div className="relative z-10">
                <div className="flex items-center mb-4 sm:mb-6">
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 lg:w-12 lg:h-12 bg-gradient-to-br ${getMealColor(meal)} rounded-2xl lg:rounded-xl flex items-center justify-center mr-4 shadow-xl lg:shadow-lg`}>
                    <span className="text-3xl sm:text-4xl lg:text-2xl group-hover:animate-bounce transition-transform duration-300">{getMealIcon(meal)}</span>
                  </div>
                      <div className="flex-1">
                    <p className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium mb-1 uppercase tracking-wide`}>
                      {meal}
                    </p>
                  </div>
                  {/* Add Ingredient Button */}
                  <button
                    onClick={() => handleOpenAddIngredient(meal)}
                    disabled={processing}
                    className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500 rounded-full flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    title={language === 'hebrew' ? 'הוסף מרכיב' : 'Add ingredient'}
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                {mealLogs.length > 0 ? (
                  <div className="space-y-2">
                    {meal !== 'other' && (
                      <div className="flex items-center justify-between mb-4 mt-2">
                        <p className={`text-emerald-400 font-bold text-base sm:text-lg md:text-xl ${language === 'hebrew' ? 'text-right' : 'text-left'} border-b-2 border-emerald-500/30 pb-2 flex-1`}>
                          {language === 'hebrew' ? 'מה שאכלת' : 'What You Ate'}
                        </p>
                        {/* Comparison Button */}
                        {mealPlanMeals.find(m => m.meal === meal) && (
                          <button
                            onClick={() => setShowComparison(prev => ({ ...prev, [meal]: !prev[meal] }))}
                            className={`ml-4 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                              showComparison[meal]
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30'
                            }`}
                            title={language === 'hebrew' ? 'השווה עם התוכנית' : 'Compare with plan'}
                          >
                            {showComparison[meal] 
                              ? (language === 'hebrew' ? 'הסתר השוואה' : 'Hide Comparison')
                              : (language === 'hebrew' ? 'השווה עם התוכנית' : 'Compare with Plan')
                            }
                          </button>
                        )}
                      </div>
                    )}
                    {mealLogs.map((log, logIndex) => {
                      // Parse food_items JSON using helper function
                      const foodItems = parseFoodItems(log);
                      const logCaloriesFromItems = foodItems.reduce((sum, item) => sum + (item.cals || 0), 0);
                      const logProteinFromItems = foodItems.reduce((sum, item) => sum + (item.p || 0), 0);
                      const logCarbsFromItems = foodItems.reduce((sum, item) => sum + (item.c || 0), 0);
                      const logFatFromItems = foodItems.reduce((sum, item) => sum + (item.f || 0), 0);
                      // Use food_items totals if available, otherwise fallback to old columns
                      const logCalories = logCaloriesFromItems > 0 ? logCaloriesFromItems : (log.total_calories || 0);
                      const logProtein = logProteinFromItems > 0 ? logProteinFromItems : (log.total_protein_g || 0);
                      const logCarbs = logCarbsFromItems > 0 ? logCarbsFromItems : (log.total_carbs_g || 0);
                      const logFat = logFatFromItems > 0 ? logFatFromItems : (log.total_fat_g || 0);
                      
                      return (
                      <div 
                        key={log.id} 
                          className={`${themeClasses.bgSecondary} border-2 border-emerald-500/20 lg:border lg:border-gray-600/20 rounded-2xl lg:rounded-xl p-4 sm:p-5 lg:p-3 transform hover:scale-[1.01] transition-all duration-300 lg:duration-200 shadow-lg hover:shadow-xl lg:shadow-md lg:hover:shadow-lg hover:border-emerald-500/40 animate-slideInUp mb-3 relative overflow-hidden`}
                        style={{ 
                          animationDelay: `${1.0 + index * 0.1 + logIndex * 0.05}s`,
                        }}
                      >
                        {/* Mobile-only gradient background */}
                        <div className="lg:hidden absolute inset-0 rounded-2xl pointer-events-none" style={{
                          background: isDarkMode 
                            ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)'
                            : 'linear-gradient(135deg, rgba(241, 245, 249, 0.9) 0%, rgba(226, 232, 240, 0.9) 100%)'
                        }} />
                        
                        {/* Subtle gradient overlay - Mobile only */}
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none rounded-2xl lg:hidden" />
                        
                        <div className="relative z-10">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <p className={`${themeClasses.textMuted} text-xs`}>
                                {language === 'hebrew' ? 'נרשם ב' : 'Logged at'} {new Date(log.created_at).toLocaleTimeString()}
                              </p>
                              {log.image_url && (
                                <div className="w-6 h-6 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded flex items-center justify-center border border-emerald-500/30">
                                  <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Time input */}
                              <input
                                type="time"
                                defaultValue={(() => {
                                  // Use updated_at if available, otherwise use created_at
                                  const dateString = log.updated_at || log.created_at;
                                  const date = new Date(dateString);
                                  const hours = String(date.getHours()).padStart(2, '0');
                                  const minutes = String(date.getMinutes()).padStart(2, '0');
                                  return `${hours}:${minutes}`;
                                })()}
                                onBlur={async (e) => {
                                  const newTime = e.target.value;
                                  if (newTime && newTime.trim() !== '') {
                                    // Get current time from log to compare
                                    const dateString = log.updated_at || log.created_at;
                                    const currentDate = new Date(dateString);
                                    const currentHours = String(currentDate.getHours()).padStart(2, '0');
                                    const currentMinutes = String(currentDate.getMinutes()).padStart(2, '0');
                                    const currentTime = `${currentHours}:${currentMinutes}`;
                                    
                                    // Only update if time actually changed
                                    if (newTime !== currentTime) {
                                      await handleUpdateMealTime(log.id, newTime);
                                    }
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.target.blur();
                                  }
                                }}
                                disabled={processing}
                                className={`text-xs px-2 py-1 rounded ${themeClasses.bgSecondary} ${themeClasses.textPrimary} border border-gray-600/30 hover:border-emerald-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-20`}
                                title={language === 'hebrew' ? 'שנה זמן ארוחה' : 'Change meal time'}
                              />
                              {/* Move meal dropdown */}
                              <select
                                value={log.meal_label}
                                onChange={(e) => handleMoveMeal(log.id, e.target.value)}
                                disabled={processing}
                                className={`text-xs px-2 py-1 rounded ${themeClasses.bgSecondary} ${themeClasses.textPrimary} border border-gray-600/30 hover:border-emerald-500/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {meals.map((mealCategory) => (
                                  <option key={mealCategory} value={mealCategory}>
                                    {t.profile.dailyLogTab.meals[mealCategory] || mealCategory}
                                  </option>
                                ))}
                              </select>
                              {/* Delete meal button */}
                              <button
                                onClick={() => handleDeleteMeal(log.id)}
                                disabled={processing}
                                className="w-6 h-6 flex items-center justify-center rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={language === 'hebrew' ? 'מחק רשומה' : 'Delete entry'}
                              >
                                <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex-1">
                            {foodItems.length > 0 ? (
                              <div className="space-y-1.5">
                                {foodItems.map((item, itemIndex) => (
                                  <div 
                                    key={itemIndex} 
                                    className={`${themeClasses.bgCard} rounded-lg p-2.5 border border-gray-600/20 hover:border-emerald-500/30 transition-all duration-200`}
                                  >
                                    <div className="flex items-start justify-between mb-1">
                                      <div className="flex-1 min-w-0">
                                        <p className={`${themeClasses.textPrimary} font-medium text-sm truncate`}>
                                          {item.name || 'Unknown Item'}
                                        </p>
                                        {item.quantity && (
                                          <p className={`${themeClasses.textMuted} text-xs mt-0.5`}>
                                            {item.quantity}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 ml-2">
                                        {/* Edit ingredient button */}
                                        <button
                                          onClick={() => handleEditIngredient(log.id, itemIndex, item)}
                                          disabled={processing}
                                          className="w-5 h-5 flex items-center justify-center rounded bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 hover:border-blue-500/50 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                          title={language === 'hebrew' ? 'ערוך כמות' : 'Edit portion'}
                                        >
                                          <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                          </svg>
                                        </button>
                                        {/* Delete ingredient button */}
                                        <button
                                          onClick={() => handleDeleteIngredient(log.id, itemIndex)}
                                          disabled={processing}
                                          className="w-5 h-5 flex items-center justify-center rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500/50 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                          title={language === 'hebrew' ? 'מחק מרכיב' : 'Delete ingredient'}
                                        >
                                          <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-wrap text-xs">
                                      {settings.showCalories && (
                                        <span className="text-emerald-400 font-medium">{item.cals || 0} {language === 'hebrew' ? 'קל' : 'cal'}</span>
                                      )}
                                      {settings.showMacros && (
                                        <>
                                          <span className="text-purple-400 font-medium">{formatWeight(item.p || 0)} {language === 'hebrew' ? 'חלבון' : 'protein'}</span>
                                          <span className="text-amber-400 font-medium">{formatWeight(item.f || 0)} {language === 'hebrew' ? 'שומן' : 'fat'}</span>
                                          <span className="text-blue-400 font-medium">{formatWeight(item.c || 0)} {language === 'hebrew' ? 'פחמימות' : 'carbs'}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {/* Total for this log entry */}
                                <div className={`${themeClasses.bgSecondary} rounded-lg lg:rounded-lg p-2.5 lg:p-2.5 border border-emerald-500/30 lg:border-emerald-500/30 mt-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 lg:from-transparent lg:to-transparent relative overflow-hidden rounded-xl lg:rounded-lg p-4 lg:p-2.5 mt-3 lg:mt-2 border-2 lg:border border-emerald-500/40 lg:border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 lg:from-emerald-500/10 lg:to-teal-500/10 shadow-lg lg:shadow-none`}>
                                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10 pointer-events-none rounded-xl lg:hidden" />
                                  <div className="relative z-10">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lg:flex lg:items-center lg:justify-between">
                                      <p className={`${themeClasses.textPrimary} font-bold text-sm uppercase tracking-wider flex items-center gap-2 lg:text-xs lg:font-bold lg:uppercase lg:tracking-wide lg:flex lg:items-center lg:gap-0`}>
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse lg:hidden"></span>
                                        {language === 'hebrew' ? 'סה"כ' : 'Total'}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm lg:flex lg:items-center lg:gap-3 lg:text-xs">
                                        {settings.showCalories && (
                                          <div className="flex flex-col items-center sm:items-end lg:flex-row lg:items-center">
                                            <span className="text-emerald-400 font-bold text-lg lg:text-base">{logCalories}</span>
                                            <span className="text-emerald-500/70 text-xs font-medium lg:text-emerald-400 lg:ml-1 lg:font-bold">{language === 'hebrew' ? ' קל' : ' cal'}</span>
                                          </div>
                                        )}
                                        {settings.showMacros && (
                                          <>
                                            <div className="flex flex-col items-center sm:items-end lg:flex-row lg:items-center">
                                              <span className="text-purple-400 font-bold text-base">{formatWeight(logProtein)}</span>
                                              <span className="text-purple-500/70 text-xs font-medium lg:text-purple-400 lg:ml-1 lg:font-bold">{language === 'hebrew' ? ' חלבון' : ' protein'}</span>
                                            </div>
                                            <div className="flex flex-col items-center sm:items-end lg:flex-row lg:items-center">
                                              <span className="text-amber-400 font-bold text-base">{formatWeight(logFat)}</span>
                                              <span className="text-amber-500/70 text-xs font-medium lg:text-amber-400 lg:ml-1 lg:font-bold">{language === 'hebrew' ? ' שומן' : ' fat'}</span>
                                            </div>
                                            <div className="flex flex-col items-center sm:items-end lg:flex-row lg:items-center">
                                              <span className="text-blue-400 font-bold text-base">{formatWeight(logCarbs)}</span>
                                              <span className="text-blue-500/70 text-xs font-medium lg:text-blue-400 lg:ml-1 lg:font-bold">{language === 'hebrew' ? ' פחמימות' : ' carbs'}</span>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* Empty meal entry fallback - no food items logged yet (matches health diary empty state) */
                              <div className={`${language === 'hebrew' ? 'text-right' : 'text-left'}`}>
                                <p className={`${themeClasses.textPrimary} font-medium text-sm mb-2`}>
                                  {language === 'hebrew' ? 'רשומת מזון' : 'Food Log'}
                                </p>
                                {log.image_url && (
                                  <div className="inline-flex w-6 h-6 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded flex items-center justify-center border border-emerald-500/30 mb-2">
                                    <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>
                                    </svg>
                                  </div>
                                )}
                                <div className="flex flex-wrap items-center gap-3 text-xs">
                                  {settings.showCalories && (
                                    <span className="text-emerald-400 font-medium">0 {language === 'hebrew' ? 'קל' : 'cal'}</span>
                                  )}
                                  {settings.showMacros && (
                                    <>
                                      <span className="text-purple-400 font-medium">{formatWeight(0)} {language === 'hebrew' ? 'חלבון' : 'protein'}</span>
                                      <span className="text-amber-400 font-medium">{formatWeight(0)} {language === 'hebrew' ? 'שומן' : 'fat'}</span>
                                      <span className="text-blue-400 font-medium">{formatWeight(0)} {language === 'hebrew' ? 'פחמימות' : 'carbs'}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      );
                    })}
                    
                    {/* Comparison Section - Show meal plan */}
                    {showComparison[meal] && meal !== 'other' && (() => {
                      const planMeal = mealPlanMeals.find(m => m.meal === meal);
                      if (!planMeal) return null;
                      
                      // Get plan meal data
                      const planMealName = planMeal.main?.meal_title || planMeal.main?.meal_name || planMeal.main?.title || mealTitleMap[meal] || meal;
                      const planIngredients = planMeal.main?.ingredients || [];
                      const planCalories = planMeal.main?.nutrition?.calories || planMeal.main?.calories || 0;
                      const planProtein = planMeal.main?.nutrition?.protein || planMeal.main?.protein || 0;
                      const planCarbs = planMeal.main?.nutrition?.carbs || planMeal.main?.carbs || 0;
                      const planFat = planMeal.main?.nutrition?.fat || planMeal.main?.fat || 0;
                      
                      // Get alternative meal data
                      const hasAlternative = planMeal.alternative && (planMeal.alternative.ingredients || planMeal.alternative.nutrition);
                      const altMealName = hasAlternative ? (planMeal.alternative.meal_title || planMeal.alternative.meal_name || planMeal.alternative.title || (language === 'hebrew' ? 'ארוחה חלופית' : 'Alternative Meal')) : null;
                      const altIngredients = hasAlternative ? (planMeal.alternative.ingredients || []) : [];
                      const altCalories = hasAlternative ? (planMeal.alternative.nutrition?.calories || planMeal.alternative.calories || 0) : 0;
                      const altProtein = hasAlternative ? (planMeal.alternative.nutrition?.protein || planMeal.alternative.protein || 0) : 0;
                      const altCarbs = hasAlternative ? (planMeal.alternative.nutrition?.carbs || planMeal.alternative.carbs || 0) : 0;
                      const altFat = hasAlternative ? (planMeal.alternative.nutrition?.fat || planMeal.alternative.fat || 0) : 0;
                      
                      // Helper function to format portion (similar to formatPortion in MealPlanTab)
                      const formatIngredientPortion = (ing) => {
                        const portion = ing['portionSI(gram)'] || 0;
                        const household = ing.household_measure || '';
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
                      
                      // Helper function to render meal content
                      const renderMealContent = (mealName, ingredients, calories, protein, carbs, fat) => (
                        <>
                          <p className={`${themeClasses.textPrimary} font-medium text-base mb-4 ${language === 'hebrew' ? 'text-right' : 'text-left'}`}>
                            {mealName}
                          </p>
                          
                          {/* Ingredients */}
                          {ingredients.length > 0 && (
                            <div className="mb-4">
                              <p className={`${themeClasses.textSecondary} text-xs font-medium mb-2 ${language === 'hebrew' ? 'text-right' : 'text-left'}`}>
                                {language === 'hebrew' ? 'מרכיבים:' : 'Ingredients:'}
                              </p>
                              <div className="space-y-1.5">
                                {ingredients.map((ing, idx) => {
                                  const ingredientName = ing.item || ing.name || 'Unknown item';
                                  const portion = formatIngredientPortion(ing);
                                  return (
                                    <div key={idx} className={`${themeClasses.bgSecondary} rounded p-2.5 text-xs ${language === 'hebrew' ? 'text-right' : 'text-left'}`}>
                                      <div className="flex items-center justify-between">
                                        <span className={themeClasses.textPrimary}>
                                          {ingredientName}
                                        </span>
                                        <span className={`${themeClasses.textSecondary} font-semibold ml-2 ${language === 'hebrew' ? 'mr-2 ml-0' : ''}`}>
                                          {portion}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Macros */}
                          <div className={`${themeClasses.bgSecondary} rounded-lg p-3 mt-3`}>
                            <p className={`${themeClasses.textSecondary} text-xs font-medium mb-2 ${language === 'hebrew' ? 'text-right' : 'text-left'}`}>
                              {language === 'hebrew' ? 'מאקרו-נוטריינטים:' : 'Macros:'}
                            </p>
                            <div className="flex flex-wrap gap-3 text-xs">
                              {settings.showCalories && (
                                <span className="text-emerald-400 font-medium">{Math.round(calories)} {language === 'hebrew' ? 'קל' : 'cal'}</span>
                              )}
                              {settings.showMacros && (
                                <>
                                  <span className="text-purple-400 font-medium">{formatWeight(protein)} {language === 'hebrew' ? 'חלבון' : 'protein'}</span>
                                  <span className="text-amber-400 font-medium">{formatWeight(fat)} {language === 'hebrew' ? 'שומן' : 'fat'}</span>
                                  <span className="text-blue-400 font-medium">{formatWeight(carbs)} {language === 'hebrew' ? 'פחמימות' : 'carbs'}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      );
                      
                      return (
                        <div className={`${themeClasses.bgSecondary} rounded-2xl lg:rounded-xl p-4 sm:p-5 lg:p-4 border-2 border-blue-500/30 mt-4 mb-4 relative overflow-hidden`}>
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 pointer-events-none rounded-2xl" />
                          <div className="relative z-10">
                            <h3 className={`${themeClasses.textPrimary} font-bold text-lg sm:text-xl mb-4 ${language === 'hebrew' ? 'text-right' : 'text-left'} border-b-2 border-blue-500/30 pb-2`}>
                              {language === 'hebrew' ? '📋 לפי התוכנית' : '📋 Plan Meal'}
                            </h3>
                            
                            <div className={`${themeClasses.bgCard} rounded-xl p-4 border border-blue-500/20`}>
                              {/* Main Meal */}
                              {renderMealContent(planMealName, planIngredients, planCalories, planProtein, planCarbs, planFat)}
                              
                              {/* Alternative Meal */}
                              {hasAlternative && (
                                <>
                                  <div className="flex items-center my-4">
                                    <div className="flex-1 border-t border-blue-500/30"></div>
                                    <span className={`${themeClasses.textPrimary} font-bold px-3 text-sm ${language === 'hebrew' ? 'text-right' : 'text-left'}`}>
                                      {language === 'hebrew' ? 'או' : 'OR'}
                                    </span>
                                    <div className="flex-1 border-t border-blue-500/30"></div>
                                  </div>
                                  {renderMealContent(altMealName, altIngredients, altCalories, altProtein, altCarbs, altFat)}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Total summary for this meal category - only show if more than 1 meal */}
                    {mealLogs.length > 1 && (() => {
                      let mealTotalCalories = 0;
                      let mealTotalProtein = 0;
                      let mealTotalCarbs = 0;
                      let mealTotalFat = 0;
                      
                      mealLogs.forEach((log) => {
                        const foodItems = parseFoodItems(log);
                        const logCaloriesFromItems = foodItems.reduce((sum, item) => sum + (item.cals || 0), 0);
                        const logProteinFromItems = foodItems.reduce((sum, item) => sum + (item.p || 0), 0);
                        const logCarbsFromItems = foodItems.reduce((sum, item) => sum + (item.c || 0), 0);
                        const logFatFromItems = foodItems.reduce((sum, item) => sum + (item.f || 0), 0);
                        // Use food_items totals if available, otherwise fallback to old columns
                        mealTotalCalories += logCaloriesFromItems > 0 ? logCaloriesFromItems : (log.total_calories || 0);
                        mealTotalProtein += logProteinFromItems > 0 ? logProteinFromItems : (log.total_protein_g || 0);
                        mealTotalCarbs += logCarbsFromItems > 0 ? logCarbsFromItems : (log.total_carbs_g || 0);
                        mealTotalFat += logFatFromItems > 0 ? logFatFromItems : (log.total_fat_g || 0);
                      });
                      
                      return (
                        <div className={`${themeClasses.bgSecondary} rounded-xl lg:rounded-xl p-4 lg:p-4 border-2 border-emerald-500/40 lg:border-2 lg:border-emerald-500/40 mt-4 bg-gradient-to-r from-emerald-500/15 to-teal-500/15 lg:from-emerald-500/15 lg:to-teal-500/15 shadow-lg lg:shadow-lg relative overflow-hidden rounded-2xl lg:rounded-xl p-5 lg:p-4 border-2 lg:border-2 border-emerald-500/50 lg:border-emerald-500/40 bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-emerald-500/20 lg:from-emerald-500/15 lg:to-teal-500/15 shadow-xl lg:shadow-lg`}>
                          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 via-transparent to-teal-500/15 pointer-events-none rounded-2xl lg:hidden" />
                          <div className="relative z-10">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 lg:flex lg:items-center lg:justify-between">
                              <div className="flex items-center gap-2 lg:gap-2">
                                <div className={`w-8 h-8 lg:w-8 lg:h-8 bg-gradient-to-br ${getMealColor(meal)} rounded-lg lg:rounded-lg flex items-center justify-center lg:shadow-lg w-12 h-12 rounded-xl shadow-lg`}>
                                  <span className="text-lg lg:text-lg text-2xl">{getMealIcon(meal)}</span>
                                </div>
                                <p className={`${themeClasses.textPrimary} font-bold text-sm uppercase tracking-wide lg:text-sm lg:font-bold lg:uppercase lg:tracking-wide text-base`}>
                                  {mealTitleMap[meal] || t.profile.dailyLogTab.meals[meal] || meal} {language === 'hebrew' ? 'סה"כ' : 'Total'}
                                </p>
                              </div>
                              <div className="flex items-center gap-4 text-sm lg:flex lg:items-center lg:gap-4 lg:text-sm flex-wrap items-center gap-4 sm:gap-6">
                                {settings.showCalories && (
                                  <span className="text-emerald-400 font-bold lg:text-emerald-400 lg:font-bold flex flex-col items-center sm:items-end text-xl">
                                    <span className="lg:inline">{Math.round(mealTotalCalories)}</span>
                                    <span className="text-emerald-500/70 text-xs font-medium lg:text-emerald-400 lg:ml-1 lg:font-bold lg:inline">{language === 'hebrew' ? ' קל' : ' cal'}</span>
                                  </span>
                                )}
                                {settings.showMacros && (
                                  <>
                                    <span className="text-purple-400 font-bold lg:text-purple-400 lg:font-bold flex flex-col items-center sm:items-end text-lg">
                                      <span className="lg:inline">{formatWeight(mealTotalProtein)}</span>
                                      <span className="text-purple-500/70 text-xs font-medium lg:text-purple-400 lg:ml-1 lg:font-bold lg:inline">{language === 'hebrew' ? ' חלבון' : ' protein'}</span>
                                    </span>
                                    <span className="text-amber-400 font-bold lg:text-amber-400 lg:font-bold flex flex-col items-center sm:items-end text-lg">
                                      <span className="lg:inline">{formatWeight(mealTotalFat)}</span>
                                      <span className="text-amber-500/70 text-xs font-medium lg:text-amber-400 lg:ml-1 lg:font-bold lg:inline">{language === 'hebrew' ? ' שומן' : ' fat'}</span>
                                    </span>
                                    <span className="text-blue-400 font-bold lg:text-blue-400 lg:font-bold flex flex-col items-center sm:items-end text-lg">
                                      <span className="lg:inline">{formatWeight(mealTotalCarbs)}</span>
                                      <span className="text-blue-500/70 text-xs font-medium lg:text-blue-400 lg:ml-1 lg:font-bold lg:inline">{language === 'hebrew' ? ' פחמימות' : ' carbs'}</span>
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                </div>
              ) : (
                  <div className="text-center py-8">
                    <div className={`w-16 h-16 ${themeClasses.bgSecondary} rounded-xl flex items-center justify-center mx-auto mb-4`}>
                      <svg className={`w-8 h-8 ${themeClasses.textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <p className={`${themeClasses.textSecondary} italic text-lg`}>{t.profile.dailyLogTab.noEntries}</p>
                    <p className={`${themeClasses.textMuted} text-sm mt-2`}>{t.profile.dailyLogTab.addFirstEntry}</p>
                  </div>
              )}
                {mealLogs.length === 0 && (
                  <h4 className={`${themeClasses.textPrimary} text-lg sm:text-xl md:text-2xl lg:text-base sm:text-lg md:text-xl font-bold tracking-tight mt-4`}>
                    {language === 'hebrew' ? 'על פי התוכנית שלך - ' : 'Your Plan - '}{mealTitleMap[meal] || t.profile.dailyLogTab.meals[meal] || meal}
                  </h4>
                )}
                </div>
              </div>
          );
        })}
        </div>
      </div>
        </>
      )}

      {/* Add Ingredient Modal */}
      <AddIngredientModal
        visible={isAddIngredientModalVisible}
        onClose={() => {
          setIsAddIngredientModalVisible(false);
          setSelectedMealForIngredient(null);
        }}
        onAddIngredient={handleAddIngredient}
        mealName={selectedMealForIngredient ? (t.profile.dailyLogTab.meals[selectedMealForIngredient] || selectedMealForIngredient) : null}
        clientRegion={clientRegion}
        userCode={userCode}
      />

      {/* Edit Ingredient Portion Modal */}
      <IngredientPortionModal
        visible={isEditPortionModalVisible}
        onClose={() => {
          setIsEditPortionModalVisible(false);
          setEditingIngredient(null);
          setEditingLogId(null);
          setEditingItemIndex(null);
        }}
        onConfirm={handleUpdateIngredientPortion}
        ingredient={editingIngredient}
        clientRegion={clientRegion}
        hideHouseholdMeasure={true}
      />
    </div>
  );
};


export default DailyLogTab;
