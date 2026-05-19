// API URL helper (auth token attached via installAuthFetch)
const getApiUrl = () => process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';

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