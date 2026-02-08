import { supabaseSecondary } from './supabaseClient'

// Check if secondary Supabase is available
const isSecondaryAvailable = () => {
  if (!supabaseSecondary) {
    console.warn('Secondary Supabase client is not available. Please check your environment variables.');
    return false;
  }
  return true;
};

// API URL helper
const getApiUrl = () => process.env.REACT_APP_API_URL || 'https://newclientsweb.onrender.com';

// MEAL PLANS
export const getMealPlan = async (userCode) => {
  try {
    console.log('Searching for meal plan with userCode:', userCode);
    
    const apiUrl = getApiUrl();
    const url = new URL(`${apiUrl}/api/meal-plan`);
    url.searchParams.append('userCode', userCode);

    const response = await fetch(url.toString());
    const result = await response.json();

    console.log('Meal plan query result:', result);

    if (!response.ok) {
      console.error('Error fetching meal plan:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error fetching meal plan:', error);
    return { data: null, error };
  }
};

export const getMealPlanSchemas = async () => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/meal-plan-schemas`);
    const result = await response.json();

    if (!response.ok) {
      console.error('Error fetching meal plan schemas:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error fetching meal plan schemas:', error);
    return { data: null, error };
  }
};

export const createMealPlan = async (dietitianId, userCode, mealPlanData) => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/meal-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dietitianId, userCode, mealPlanData })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error creating meal plan:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error creating meal plan:', error);
    return { data: null, error };
  }
};

export const updateMealPlan = async (mealPlanId, mealPlanData) => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/meal-plan/${mealPlanId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mealPlanData })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error updating meal plan:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error updating meal plan:', error);
    return { data: null, error };
  }
};

// FOOD LOGS
export const getFoodLogs = async (userCode, date = null) => {
  try {
    console.log('Fetching food logs for userCode:', userCode, 'date:', date);
    
    const apiUrl = getApiUrl();
    const url = new URL(`${apiUrl}/api/food-logs`);
    url.searchParams.append('userCode', userCode);
    if (date) url.searchParams.append('date', date);

    const response = await fetch(url.toString());
    const result = await response.json();

    if (!response.ok) {
      console.error('Error fetching food logs:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error fetching food logs:', error);
    return { data: null, error };
  }
};

export const createFoodLog = async (userCode, foodLogData) => {
  try {
    console.log('Creating food log for userCode:', userCode, 'data:', foodLogData);
    
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/food-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userCode, foodLogData })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error creating food log:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error creating food log:', error);
    return { data: null, error };
  }
};

export const updateFoodLog = async (foodLogId, foodLogData) => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/food-logs/${foodLogId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodLogData })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error updating food log:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error updating food log:', error);
    return { data: null, error };
  }
};

export const deleteFoodLog = async (foodLogId) => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/food-logs/${foodLogId}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error deleting food log:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error deleting food log:', error);
    return { data: null, error };
  }
};

// Daily XP (view_user_daily_xp) – via server API
export const getTodayDailyXP = async (userCode) => {
  try {
    if (!userCode) return { data: null, error: { message: 'User code is required' } };
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/daily-xp/today?userCode=${encodeURIComponent(userCode)}`);
    const result = await response.json();
    if (!response.ok) {
      return { data: null, error: { message: result.error || 'Failed to fetch today XP' } };
    }
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Error fetching today daily XP:', error);
    return { data: null, error };
  }
};

export const getWeeklyDailyXP = async (userCode) => {
  try {
    if (!userCode) return { data: null, error: { message: 'User code is required' } };
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/daily-xp/weekly?userCode=${encodeURIComponent(userCode)}`);
    const result = await response.json();
    if (!response.ok) {
      return { data: null, error: { message: result.error || 'Failed to fetch weekly XP' } };
    }
    return { data: result.data || [], error: null };
  } catch (error) {
    console.error('Error fetching weekly daily XP:', error);
    return { data: null, error };
  }
};

// CHAT MESSAGES
export const getChatMessages = async (userCode, beforeTimestamp = null) => {
  try {
    console.log('Fetching chat messages for userCode:', userCode, 'beforeTimestamp:', beforeTimestamp);
    
    const apiUrl = getApiUrl();
    const url = new URL(`${apiUrl}/api/chat-messages`);
    url.searchParams.append('userCode', userCode);
    if (beforeTimestamp) url.searchParams.append('beforeTimestamp', beforeTimestamp);

    const response = await fetch(url.toString());
    const result = await response.json();

    if (!response.ok) {
      console.error('Error fetching chat messages:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data || [], error: null };
  } catch (error) {
    console.error('Unexpected error fetching chat messages:', error);
    return { data: null, error };
  }
};

export const createChatMessage = async (userCode, messageData) => {
  try {
    console.log('Creating chat message for userCode:', userCode, 'data:', messageData);
    
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/chat-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userCode, messageData })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error creating chat message:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error creating chat message:', error);
    return { data: null, error };
  }
};

// COMPANY MANAGEMENT
export const getCompaniesWithManagers = async () => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/companies`);
    const result = await response.json();

    if (!response.ok) {
      console.error('Error fetching companies:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error fetching companies:', error);
    return { data: null, error };
  }
};

export const getClientCompanyAssignment = async (userCode) => {
  try {
    const apiUrl = getApiUrl();
    const url = new URL(`${apiUrl}/api/client-company-assignment`);
    url.searchParams.append('userCode', userCode);

    const response = await fetch(url.toString());
    const result = await response.json();

    if (!response.ok) {
      console.error('Error fetching client assignment:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data || null, error: null };
  } catch (error) {
    console.error('Unexpected error fetching client assignment:', error);
    return { data: null, error };
  }
};

export const assignClientToCompany = async (userCode, companyId) => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/assign-client-company`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userCode, companyId })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error assigning client to company:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error assigning client to company:', error);
    return { data: null, error };
  }
};

export const getUserMealPlanHistory = async (userCode) => {
  try {
    const apiUrl = getApiUrl();
    const url = new URL(`${apiUrl}/api/meal-plan-history`);
    url.searchParams.append('userCode', userCode);

    const response = await fetch(url.toString());
    const result = await response.json();

    if (!response.ok) {
      console.error('Error fetching meal plan history:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error fetching meal plan history:', error);
    return { data: null, error };
  }
};


// MESSAGES
export const getMessages = async (userId) => {
  try {
    const apiUrl = getApiUrl();
    const url = new URL(`${apiUrl}/api/messages`);
    url.searchParams.append('userId', userId);

    const response = await fetch(url.toString());
    const result = await response.json();

    if (!response.ok) {
      console.error('Error fetching messages:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error fetching messages:', error);
    return { data: null, error };
  }
};

export const sendMessage = async (userId, messageData) => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, messageData })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error sending message:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error sending message:', error);
    return { data: null, error };
  }
};

export const markMessageAsRead = async (messageId) => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/messages/${messageId}/read`, {
      method: 'PUT'
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error marking message as read:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error marking message as read:', error);
    return { data: null, error };
  }
};

// FOOD DATABASE (for searching foods)
export const searchFoods = async (query, limit = 20) => {
  try {
    console.log('🔍 Fetching suggestions from ingridientsroee table for query:', query);
    
    const apiUrl = getApiUrl();
    const url = new URL(`${apiUrl}/api/foods/search`);
    url.searchParams.append('query', query);
    url.searchParams.append('limit', limit.toString());

    const response = await fetch(url.toString());
    const result = await response.json();

    if (!response.ok) {
      console.error('Error searching foods:', result.error);
      return { data: null, error: { message: result.error } };
    }

    console.log('📊 Final transformed data:', result.data?.length || 0, 'items');
    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error searching foods:', error);
    return { data: null, error };
  }
};

// OLD IMPLEMENTATION (COMMENTED OUT FOR REFERENCE)
/*
export const searchFoods_OLD = async (query, limit = 20) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };
  
  try {
    console.log('🔍 Fetching suggestions from ingridientsroee table for query:', query);
    
    // Detect if query is in Hebrew or English
    const isHebrewQuery = /[\u0590-\u05FF]/.test(query);
    
    // Split query into individual words for better matching
    const queryWords = query.trim().split(/\s+/).filter(word => word.length > 0);
    console.log('🔍 Query words:', queryWords);
    
    // Build search conditions - run multiple queries to catch different patterns
    let allData = [];
    
    if (queryWords.length === 1) {
      // Single word: prioritize items that start with it, then contain it
      const word = queryWords[0];
      const startsWithPattern = `${word}%`;
      const containsPattern = `%${word}%`;
      
      // Determine which column to search based on language
      const searchColumn = isHebrewQuery ? 'name' : 'english_name';
      
      console.log('🎯 Query 1: items that START with the word in', searchColumn);
      const { data: startsWithData, error: startsWithError } = await supabaseSecondary
        .from('ingridientsroee')
        .select('id, name, english_name, calories_energy, protein_g, fat_g, carbohydrates_g')
        .ilike(searchColumn, startsWithPattern)
        .limit(50);
      
      if (startsWithError) {
        console.error('❌ Supabase error (starts with):', startsWithError);
      } else if (startsWithData) {
        console.log(`✅ Found ${startsWithData.length} items that START with the word`);
        allData = startsWithData;
      }
      
      // Also get items that contain the word (if we need more results)
      if (allData.length < 20) {
        console.log('🔍 Query 2: items that CONTAIN the word in', searchColumn);
        const { data: containsData, error: containsError } = await supabaseSecondary
          .from('ingridientsroee')
          .select('id, name, english_name, calories_energy, protein_g, fat_g, carbohydrates_g')
          .ilike(searchColumn, containsPattern)
          .limit(50);
        
        if (containsError) {
          console.error('❌ Supabase error (contains):', containsError);
        } else if (containsData) {
          console.log(`✅ Found ${containsData.length} items that CONTAIN the word`);
          const existingIds = new Set(allData.map(item => item.id));
          const newItems = containsData.filter(item => !existingIds.has(item.id));
          allData = [...allData, ...newItems];
        }
      }
    } else {
      // Multi-word: Search for items containing ALL words
      console.log('🔍 Searching for items containing ALL words');
      const searchColumn = isHebrewQuery ? 'name' : 'english_name';
      const wordsConditions = [];
      
      queryWords.forEach((word) => {
        const containsPattern = `%${word}%`;
        wordsConditions.push(`${searchColumn}.ilike.${containsPattern}`);
      });
      
      // Fetch items that contain at least one of the words
      const { data: wordsData, error: wordsError } = await supabaseSecondary
        .from('ingridientsroee')
        .select('id, name, english_name, calories_energy, protein_g, fat_g, carbohydrates_g')
        .or(wordsConditions.join(','))
        .limit(200); // Get many results to filter properly
      
      if (wordsError) {
        console.error('❌ Supabase error:', wordsError);
      } else if (wordsData) {
        console.log(`✅ Found ${wordsData.length} items (before filtering for all words)`);
        
        // Filter to only include items that have ALL words
        const filteredWordsData = wordsData.filter(item => {
          const searchText = isHebrewQuery 
            ? ((item.name || '').toLowerCase())
            : ((item.english_name || '').toLowerCase());
          
          // Check if all words are present in the search text
          const hasAllWords = queryWords.every(word => 
            searchText.includes(word.toLowerCase())
          );
          
          return hasAllWords;
        });
        
        console.log(`🔎 After filtering for ALL words: ${filteredWordsData.length} items`);
        allData = filteredWordsData;
      }
    }
    
    console.log(`📋 Total raw ingredients data received: ${allData.length} items`);
    
    // Apply ranking and sorting to the results
    const rankedData = allData.map(ingredient => {
      const hebrewName = (ingredient.name || '').toLowerCase();
      const englishName = (ingredient.english_name || '').toLowerCase();
      const queryLower = query.toLowerCase();
      const queryWordsLower = queryWords.map(w => w.toLowerCase());
      
      let score = 0;
      let matchedInEnglish = false;
      let matchedInHebrew = false;
      
      // Helper function to check if query matches in a name
      const checkMatch = (fullName, isEnglish) => {
        if (!fullName) return 0;
        
        let localScore = 0;
        
        // Exact match gets highest score
        if (fullName === queryLower) {
          if (isEnglish) matchedInEnglish = true;
          else matchedInHebrew = true;
          return 10000;
        }
        
        // Starts with query gets very high score
        if (fullName.startsWith(queryLower)) {
          if (isEnglish) matchedInEnglish = true;
          else matchedInHebrew = true;
          return 9000;
        }
        
        // Check if first word exactly matches the search term
        const words = fullName.split(' ');
        const firstWord = words[0];
        if (queryWordsLower.length === 1 && firstWord === queryWordsLower[0]) {
          if (isEnglish) matchedInEnglish = true;
          else matchedInHebrew = true;
          return 8500;
        }
        
        // For multi-word searches, check if phrase appears at start
        if (queryWordsLower.length > 1) {
          const queryPhrase = queryWordsLower.join(' ');
          
          if (fullName.startsWith(queryPhrase)) {
            if (isEnglish) matchedInEnglish = true;
            else matchedInHebrew = true;
            return 8800;
          }
          
          // Check if first N words match
          if (words.length >= queryWordsLower.length) {
            let allFirstWordsMatch = true;
            for (let i = 0; i < queryWordsLower.length; i++) {
              if (words[i] !== queryWordsLower[i]) {
                allFirstWordsMatch = false;
                break;
              }
            }
            if (allFirstWordsMatch) {
              if (isEnglish) matchedInEnglish = true;
              else matchedInHebrew = true;
              return 8700;
            }
          }
          
          // Phrase appears somewhere in the name
          if (fullName.includes(queryPhrase)) {
            if (isEnglish) matchedInEnglish = true;
            else matchedInHebrew = true;
            return 5000;
          }
        }
        
        // Contains exact query (but not at start)
        if (fullName.includes(queryLower)) {
          if (isEnglish) matchedInEnglish = true;
          else matchedInHebrew = true;
          return 3000;
        }
        
        // Multi-word matching: all words present
        const allWordsPresent = queryWordsLower.every(word => fullName.includes(word));
        if (allWordsPresent) {
          if (isEnglish) matchedInEnglish = true;
          else matchedInHebrew = true;
          localScore += 2000;
          
          // Bonus for words being close together
          const queryPhrase = queryWordsLower.join(' ');
          if (fullName.includes(queryPhrase)) {
            localScore += 1000;
          }
          
          // Bonus for words in order
          let wordsInOrder = true;
          let lastIndex = -1;
          for (const word of queryWordsLower) {
            const currentIndex = fullName.indexOf(word);
            if (currentIndex <= lastIndex) {
              wordsInOrder = false;
              break;
            }
            lastIndex = currentIndex;
          }
          if (wordsInOrder) {
            localScore += 500;
          }
          return localScore;
        }
        
        // Individual word matches (partial matches, lower priority)
        queryWordsLower.forEach((word) => {
          const wordIndex = words.indexOf(word);
          
          if (wordIndex === 0) {
            if (isEnglish) matchedInEnglish = true;
            else matchedInHebrew = true;
            localScore += 1000;
          } else if (wordIndex > 0) {
            if (isEnglish) matchedInEnglish = true;
            else matchedInHebrew = true;
            localScore += 500;
          } else if (fullName.includes(word)) {
            if (isEnglish) matchedInEnglish = true;
            else matchedInHebrew = true;
            localScore += 100;
          }
        });
        
        return localScore;
      };
      
      // Check both names
      const englishScore = checkMatch(englishName, true);
      const hebrewScore = checkMatch(hebrewName, false);
      
      // Use the best score
      score = Math.max(englishScore, hebrewScore);
      
      // Determine which language to display based on which matched better
      let preferEnglish = false;
      if (isHebrewQuery) {
        // For Hebrew queries, prefer Hebrew unless English is significantly better
        preferEnglish = englishScore > hebrewScore && matchedInEnglish && !matchedInHebrew;
      } else {
        // For English queries, prefer English unless Hebrew is significantly better
        preferEnglish = (englishScore >= hebrewScore && matchedInEnglish) || !matchedInHebrew;
      }
      
      return { 
        ...ingredient, 
        _searchScore: score,
        _preferEnglish: preferEnglish 
      };
    });
    
    // Sort by search score (highest first), then by name
    rankedData.sort((a, b) => {
      if (b._searchScore !== a._searchScore) {
        return b._searchScore - a._searchScore;
      }
      // Secondary sort by name
      const aName = a._preferEnglish ? (a.english_name || a.name || '') : (a.name || a.english_name || '');
      const bName = b._preferEnglish ? (b.english_name || b.name || '') : (b.name || b.english_name || '');
      return aName.localeCompare(bName);
    });
    
    // Limit results
    const limitedData = rankedData.slice(0, limit);
    
    // Transform to match expected format
    const transformedData = limitedData.map(ingredient => {
      const displayName = ingredient._preferEnglish 
        ? (ingredient.english_name || ingredient.name || '')
        : (ingredient.name || ingredient.english_name || '');
      
      return {
        id: ingredient.id,
        name: displayName,
        item: displayName,
        english_name: ingredient.english_name || '',
        calories: ingredient.calories_energy || 0,
        protein: ingredient.protein_g || 0,
        fat: ingredient.fat_g || 0,
        carbs: ingredient.carbohydrates_g || 0,
        brand: '',
        household_measure: '',
        'portionSI(gram)': 100, // Default to 100g per portion
        UPC: null
      };
    });
    
    console.log('📊 Final transformed data:', transformedData.length, 'items');
    
    return { data: transformedData, error: null };
  } catch (error) {
    console.error('Unexpected error searching foods:', error);
    return { data: null, error };
  }
};
*/

export const getFoodById = async (foodId) => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/foods/${foodId}`);
    const result = await response.json();

    if (!response.ok) {
      console.error('Error fetching food by ID:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error fetching food by ID:', error);
    return { data: null, error };
  }
};

/**
 * Report incorrect or misleading ingredient data.
 * @param {Object} params
 * @param {string|number} params.foodId - id from ingridientsroee
 * @param {Object} [params.foodSnapshot] - { name, brand, calories, protein, carbs, fat } at report time
 * @param {string} params.reportType - 'misinformation' | 'incorrect_values' | 'wrong_name' | 'wrong_portion' | 'other'
 * @param {string} [params.description] - optional details
 * @param {string} [params.userCode] - optional reporter user_code
 */
export const reportIngredient = async ({ foodId, foodSnapshot, reportType, description, userCode }) => {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/ingredient-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodId, foodSnapshot, reportType, description, userCode })
    });
    const result = await response.json();
    if (!response.ok) {
      return { data: null, error: { message: result.error || 'Failed to submit report' } };
    }
    return { data: result, error: null };
  } catch (error) {
    console.error('Error submitting ingredient report:', error);
    return { data: null, error };
  }
};

// Debug function to check meal plans
export const debugMealPlans = async (userCode) => {
  try {
    console.log('Debug: Checking all meal plans for userCode:', userCode);
    
    const apiUrl = getApiUrl();
    const url = new URL(`${apiUrl}/api/debug/meal-plans`);
    url.searchParams.append('userCode', userCode);

    const response = await fetch(url.toString());
    const result = await response.json();

    console.log('All meal plans for user:', result);

    if (!response.ok) {
      console.error('Debug error:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Debug error:', error);
    return { data: null, error };
  }
};

// WEIGHT LOGS
export const getWeightLogs = async (userCode) => {
  try {
    console.log('Fetching weight logs for userCode:', userCode);
    
    const apiUrl = getApiUrl();
    const url = new URL(`${apiUrl}/api/weight-logs`);
    url.searchParams.append('userCode', userCode);

    const response = await fetch(url.toString());
    const result = await response.json();

    if (!response.ok) {
      console.error('Error fetching weight logs:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data || [], error: null };
  } catch (error) {
    console.error('Unexpected error fetching weight logs:', error);
    return { data: null, error };
  }
};

export const createWeightLog = async (userCode, weightLogData) => {
  try {
    console.log('Creating weight log for userCode:', userCode, 'data:', weightLogData);
    
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/weight-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userCode, weightLogData })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error creating weight log:', result.error);
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (error) {
    console.error('Unexpected error creating weight log:', error);
    return { data: null, error };
  }
};