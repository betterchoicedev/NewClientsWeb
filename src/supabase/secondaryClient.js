import { supabaseSecondary } from './supabaseClient'

// Check if secondary Supabase is available
const isSecondaryAvailable = () => {
  if (!supabaseSecondary) {
    console.warn('Secondary Supabase client is not available. Please check your environment variables.');
    return false;
  }
  return true;
};

// MEAL PLANS
export const getMealPlan = async (userCode) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };
  
  try {
    console.log('Searching for meal plan with userCode:', userCode);
    
    const { data, error } = await supabaseSecondary
      .from('meal_plans_and_schemas')
      .select('*')
      .eq('user_code', userCode)
      .eq('record_type', 'meal_plan')
      .eq('status', 'active')
      .single();

    console.log('Meal plan query result:', { data, error });

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching meal plan:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error fetching meal plan:', error);
    return { data: null, error };
  }
};

export const getMealPlanSchemas = async () => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };
  
  try {
    const { data, error } = await supabaseSecondary
      .from('meal_plans_and_schemas')
      .select('*')
      .eq('record_type', 'schema')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching meal plan schemas:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error fetching meal plan schemas:', error);
    return { data: null, error };
  }
};

export const createMealPlan = async (dietitianId, userCode, mealPlanData) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };
  
  try {
    const { data, error } = await supabaseSecondary
      .from('meal_plans_and_schemas')
      .insert([{
        record_type: 'meal_plan',
        dietitian_id: dietitianId,
        user_code: userCode,
        meal_plan_name: mealPlanData.meal_plan_name,
        meal_plan: mealPlanData.meal_plan,
        status: mealPlanData.status || 'draft',
        active_from: mealPlanData.active_from,
        active_until: mealPlanData.active_until,
        daily_total_calories: mealPlanData.daily_total_calories,
        macros_target: mealPlanData.macros_target,
        recommendations: mealPlanData.recommendations,
        dietary_restrictions: mealPlanData.dietary_restrictions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select();

    if (error) {
      console.error('Error creating meal plan:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error creating meal plan:', error);
    return { data: null, error };
  }
};

export const updateMealPlan = async (mealPlanId, mealPlanData) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };
  
  try {
    const { data, error } = await supabaseSecondary
      .from('meal_plans_and_schemas')
      .update({
        meal_plan_name: mealPlanData.meal_plan_name,
        meal_plan: mealPlanData.meal_plan,
        status: mealPlanData.status,
        active_from: mealPlanData.active_from,
        active_until: mealPlanData.active_until,
        daily_total_calories: mealPlanData.daily_total_calories,
        macros_target: mealPlanData.macros_target,
        recommendations: mealPlanData.recommendations,
        dietary_restrictions: mealPlanData.dietary_restrictions,
        updated_at: new Date().toISOString()
      })
      .eq('id', mealPlanId)
      .select();

    if (error) {
      console.error('Error updating meal plan:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error updating meal plan:', error);
    return { data: null, error };
  }
};

// FOOD LOGS
export const getFoodLogs = async (userCode, date = null) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };
  
  try {
    console.log('Fetching food logs for userCode:', userCode, 'date:', date);
    
    // First get user_id from chat_users table using user_code
    const { data: userData, error: userError } = await supabaseSecondary
      .from('chat_users')
      .select('id')
      .eq('user_code', userCode)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return { data: null, error: userError };
    }

    if (!userData) {
      return { data: null, error: { message: 'User not found' } };
    }

    // Now get food logs for this user
    let query = supabaseSecondary
      .from('food_logs')
      .select('*')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false });

    if (date) {
      query = query.eq('log_date', date);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching food logs:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error fetching food logs:', error);
    return { data: null, error };
  }
};

export const createFoodLog = async (userCode, foodLogData) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };
  
  try {
    console.log('Creating food log for userCode:', userCode, 'data:', foodLogData);
    
    // First get user_id from chat_users table using user_code
    const { data: userData, error: userError } = await supabaseSecondary
      .from('chat_users')
      .select('id')
      .eq('user_code', userCode)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return { data: null, error: userError };
    }

    if (!userData) {
      return { data: null, error: { message: 'User not found' } };
    }

    // Create food log entry - ensure all required fields have valid values
    const insertData = {
      user_id: userData.id,
      meal_label: foodLogData.meal_label,
      food_items: foodLogData.food_items || [],
      log_date: foodLogData.log_date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };

    console.log('Inserting food log data:', JSON.stringify(insertData, null, 2));

    const { data, error } = await supabaseSecondary
      .from('food_logs')
      .insert([insertData])
      .select();

    if (error) {
      console.error('Error creating food log:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.error('Failed insert data:', JSON.stringify(insertData, null, 2));
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error creating food log:', error);
    return { data: null, error };
  }
};

export const updateFoodLog = async (foodLogId, foodLogData) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };
  
  try {
    // Build update object with only provided fields
    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    // Only include fields that are explicitly provided
    if (foodLogData.meal_label !== undefined) updateData.meal_label = foodLogData.meal_label;
    if (foodLogData.food_items !== undefined) updateData.food_items = foodLogData.food_items;
    if (foodLogData.image_url !== undefined) updateData.image_url = foodLogData.image_url;
    if (foodLogData.total_calories !== undefined) updateData.total_calories = foodLogData.total_calories;
    if (foodLogData.total_protein_g !== undefined) updateData.total_protein_g = foodLogData.total_protein_g;
    if (foodLogData.total_carbs_g !== undefined) updateData.total_carbs_g = foodLogData.total_carbs_g;
    if (foodLogData.total_fat_g !== undefined) updateData.total_fat_g = foodLogData.total_fat_g;
    if (foodLogData.log_date !== undefined) updateData.log_date = foodLogData.log_date;

    const { data, error } = await supabaseSecondary
      .from('food_logs')
      .update(updateData)
      .eq('id', foodLogId)
      .select();

    if (error) {
      console.error('Error updating food log:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error updating food log:', error);
    return { data: null, error };
  }
};

export const deleteFoodLog = async (foodLogId) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };
  
  try {
    const { data, error } = await supabaseSecondary
      .from('food_logs')
      .delete()
      .eq('id', foodLogId)
      .select();

    if (error) {
      console.error('Error deleting food log:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error deleting food log:', error);
    return { data: null, error };
  }
};

// CHAT MESSAGES
export const getChatMessages = async (userCode, beforeTimestamp = null) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };
  
  try {
    console.log('Fetching chat messages for userCode:', userCode, 'beforeTimestamp:', beforeTimestamp);
    
    // First get user_id from chat_users table using user_code
    const { data: userData, error: userError } = await supabaseSecondary
      .from('chat_users')
      .select('id')
      .eq('user_code', userCode)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return { data: null, error: userError };
    }

    if (!userData) {
      return { data: null, error: { message: 'User not found' } };
    }

    // Get conversations for this user
    const { data: conversations, error: conversationsError } = await supabaseSecondary
      .from('chat_conversations')
      .select('id')
      .eq('user_id', userData.id)
      .order('started_at', { ascending: false });

    if (conversationsError) {
      console.error('Error fetching conversations:', conversationsError);
      return { data: null, error: conversationsError };
    }

    if (!conversations || conversations.length === 0) {
      return { data: [], error: null };
    }

    // Get messages for all conversations
    const conversationIds = conversations.map(conv => conv.id);
    
    // Build query for messages
    let query = supabaseSecondary
      .from('chat_messages')
      .select('*')
      .in('conversation_id', conversationIds);

    // If beforeTimestamp is provided, get messages older than that timestamp
    if (beforeTimestamp) {
      query = query.lt('created_at', beforeTimestamp);
    }

    // Order by created_at descending (newest first) and limit to 20
    query = query.order('created_at', { ascending: false }).limit(20);

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return { data: null, error: messagesError };
    }

    return { data: messages || [], error: null };
  } catch (error) {
    console.error('Unexpected error fetching chat messages:', error);
    return { data: null, error };
  }
};

export const createChatMessage = async (userCode, messageData) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };
  
  try {
    console.log('Creating chat message for userCode:', userCode, 'data:', messageData);
    
    // First get user_id from chat_users table using user_code
    const { data: userData, error: userError } = await supabaseSecondary
      .from('chat_users')
      .select('id')
      .eq('user_code', userCode)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return { data: null, error: userError };
    }

    if (!userData) {
      return { data: null, error: { message: 'User not found' } };
    }

    // Get or create conversation for this user
    let { data: conversation, error: conversationError } = await supabaseSecondary
      .from('chat_conversations')
      .select('id')
      .eq('user_id', userData.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (conversationError && conversationError.code !== 'PGRST116') {
      console.error('Error fetching conversation:', conversationError);
      return { data: null, error: conversationError };
    }

    // If no conversation exists, create one
    if (!conversation) {
      const { data: newConversation, error: createError } = await supabaseSecondary
        .from('chat_conversations')
        .insert([{
          user_id: userData.id,
          started_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (createError) {
        console.error('Error creating conversation:', createError);
        return { data: null, error: createError };
      }

      conversation = newConversation;
    }

    // Create message
    const messageInsert = {
      conversation_id: conversation.id,
      role: messageData.role || 'user',
      topic: messageData.topic,
      extension: messageData.extension,
      attachments: messageData.attachments,
      created_at: new Date().toISOString()
    };

    // Add message or content based on role
    if (messageData.role === 'assistant') {
      messageInsert.message = messageData.message;
    } else {
      messageInsert.content = messageData.content;
    }

    const { data, error } = await supabaseSecondary
      .from('chat_messages')
      .insert([messageInsert])
      .select();

    if (error) {
      console.error('Error creating chat message:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error creating chat message:', error);
    return { data: null, error };
  }
};

// COMPANY MANAGEMENT
export const getCompaniesWithManagers = async () => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };

  try {
    const { data, error } = await supabaseSecondary
      .from('companies')
      .select('id, name, managers:profiles!profiles_company_id_fkey(id, name, role)')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching companies:', error);
      return { data: null, error };
    }

    const formattedCompanies = (data || []).map((company) => ({
      id: company.id,
      name: company.name,
      managers: (company.managers || []).filter((manager) => manager.role === 'company_manager')
    }));

    return { data: formattedCompanies, error: null };
  } catch (error) {
    console.error('Unexpected error fetching companies:', error);
    return { data: null, error };
  }
};

export const getClientCompanyAssignment = async (userCode) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };

  try {
    const { data, error } = await supabaseSecondary
      .from('chat_users')
      .select('provider_id, provider:profiles!chat_users_provider_id_fkey(id, name, company_id)')
      .eq('user_code', userCode)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching client assignment:', error);
      return { data: null, error };
    }

    return { data: data || null, error: null };
  } catch (error) {
    console.error('Unexpected error fetching client assignment:', error);
    return { data: null, error };
  }
};

export const assignClientToCompany = async (userCode, companyId) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };

  try {
    let managerId = null;

    if (companyId) {
      const { data: manager, error: managerError } = await supabaseSecondary
        .from('profiles')
        .select('id')
        .eq('company_id', companyId)
        .eq('role', 'company_manager')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (managerError && managerError.code !== 'PGRST116') {
        console.error('Error fetching company manager:', managerError);
        return { data: null, error: managerError };
      }

      if (!manager) {
        const customError = { message: 'No manager found for the selected company.' };
        return { data: null, error: customError };
      }

      managerId = manager.id;
    }

    const { data, error } = await supabaseSecondary
      .from('chat_users')
      .update({ provider_id: managerId })
      .eq('user_code', userCode)
      .select('provider_id')
      .single();

    if (error) {
      console.error('Error assigning provider to client:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error assigning provider:', error);
    return { data: null, error };
  }
};

export const getUserMealPlanHistory = async (userCode) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };
  
  try {
    const { data, error } = await supabaseSecondary
      .from('meal_plans_and_schemas')
      .select('*')
      .eq('user_code', userCode)
      .eq('record_type', 'meal_plan')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching meal plan history:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error fetching meal plan history:', error);
    return { data: null, error };
  }
};


// MESSAGES
export const getMessages = async (userId) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };
  
  try {
    const { data, error } = await supabaseSecondary
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error fetching messages:', error);
    return { data: null, error };
  }
};

export const sendMessage = async (userId, messageData) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };
  
  try {
    const { data, error } = await supabaseSecondary
      .from('messages')
      .insert([{
        user_id: userId,
        ...messageData,
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) {
      console.error('Error sending message:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error sending message:', error);
    return { data: null, error };
  }
};

export const markMessageAsRead = async (messageId) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };
  
  try {
    const { data, error } = await supabaseSecondary
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId)
      .select();

    if (error) {
      console.error('Error marking message as read:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error marking message as read:', error);
    return { data: null, error };
  }
};

// FOOD DATABASE (for searching foods)
export const searchFoods = async (query, limit = 20) => {
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

export const getFoodById = async (foodId) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };
  
  try {
    const { data, error } = await supabaseSecondary
      .from('ingridientsroee')
      .select('*')
      .eq('id', foodId)
      .single();

    if (error) {
      console.error('Error fetching food by ID:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error fetching food by ID:', error);
    return { data: null, error };
  }
};

// Debug function to check meal plans
export const debugMealPlans = async (userCode) => {
  if (!isSecondaryAvailable()) return { data: null, error: { message: 'Secondary database not available' } };
  
  try {
    console.log('Debug: Checking all meal plans for userCode:', userCode);
    
    // Check all meal plans for this user (any status)
    const { data: allPlans, error: allError } = await supabaseSecondary
      .from('meal_plans_and_schemas')
      .select('*')
      .eq('user_code', userCode)
      .eq('record_type', 'meal_plan');

    console.log('All meal plans for user:', { allPlans, allError });

    // Check all meal plans in the database (for debugging)
    const { data: allPlansInDb, error: allDbError } = await supabaseSecondary
      .from('meal_plans_and_schemas')
      .select('user_code, status, record_type, meal_plan_name')
      .eq('record_type', 'meal_plan')
      .limit(10);

    console.log('All meal plans in database (first 10):', { allPlansInDb, allDbError });

    return { data: { allPlans, allPlansInDb }, error: null };
  } catch (error) {
    console.error('Debug error:', error);
    return { data: null, error };
  }
};
