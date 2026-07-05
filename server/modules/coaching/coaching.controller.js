const { adminDB } = require('../../config/db');

async function getChatMessages(req, res) {
  try {
    const { userCode, beforeTimestamp } = req.query;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    const { data: userData, error: userError } = await adminDB.from('chat_users').select('id').eq('user_code', userCode).maybeSingle();
    if (userError || !userData) return res.status(404).json({ error: 'User not found' });

    const { data: conversations, error: conversationsError } = await adminDB.from('chat_conversations').select('id').eq('user_id', userData.id).order('started_at', { ascending: false });
    if (conversationsError) throw conversationsError;
    if (!conversations || conversations.length === 0) return res.json({ data: [] });

    const conversationIds = conversations.map(conv => conv.id);
    let query = adminDB.from('chat_messages').select('*').in('conversation_id', conversationIds);
    if (beforeTimestamp) query = query.lt('created_at', beforeTimestamp);
    query = query.order('created_at', { ascending: false }).limit(20);

    const { data: messages, error: messagesError } = await query;
    if (messagesError) throw messagesError;
    res.json({ data: messages || [] });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: error.message });
  }
}

async function createChatMessage(req, res) {
  try {
    const { userCode, messageData } = req.body;
    if (!userCode || !messageData) return res.status(400).json({ error: 'User code and message data are required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    const { data: userData, error: userError } = await adminDB.from('chat_users').select('id').eq('user_code', userCode).maybeSingle();
    if (userError || !userData) return res.status(404).json({ error: 'User not found' });

    let { data: conversation } = await adminDB.from('chat_conversations').select('id').eq('user_id', userData.id).order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (!conversation) {
      const { data: newConversation, error: createError } = await adminDB.from('chat_conversations').insert([{ user_id: userData.id, started_at: new Date().toISOString() }]).select().single();
      if (createError) throw createError;
      conversation = newConversation;
    }

    const messageInsert = { conversation_id: conversation.id, role: messageData.role || 'user', topic: messageData.topic, extension: messageData.extension, attachments: messageData.attachments, created_at: new Date().toISOString() };
    if (messageData.role === 'assistant') messageInsert.message = messageData.message;
    else messageInsert.content = messageData.content;

    const { data, error } = await adminDB.from('chat_messages').insert([messageInsert]).select();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error creating chat message:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getMessages(req, res) {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const { data, error } = await adminDB.from('messages').select('*').eq('user_id', userId).order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function sendMessage(req, res) {
  try {
    const { userId, messageData } = req.body;
    if (!userId || !messageData) return res.status(400).json({ error: 'User ID and message data are required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const { data, error } = await adminDB.from('messages').insert([{ user_id: userId, ...messageData, created_at: new Date().toISOString() }]).select();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function markMessageRead(req, res) {
  try {
    const { id } = req.params;
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const { data, error } = await adminDB.from('messages').update({ read_at: new Date().toISOString() }).eq('id', id).select();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getMealPlan(req, res) {
  try {
    const { userCode } = req.query;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const { data, error } = await adminDB.from('meal_plans_and_schemas').select('*').eq('user_code', userCode).eq('record_type', 'meal_plan').eq('status', 'active').maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getMealPlanSchemas(req, res) {
  try {
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const { data, error } = await adminDB.from('meal_plans_and_schemas').select('*').eq('record_type', 'schema').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function createMealPlan(req, res) {
  try {
    const { dietitianId, userCode, mealPlanData } = req.body;
    if (!userCode || !mealPlanData) return res.status(400).json({ error: 'User code and meal plan data are required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const { data, error } = await adminDB.from('meal_plans_and_schemas').insert([{
      record_type: 'meal_plan', dietitian_id: dietitianId, user_code: userCode,
      meal_plan_name: mealPlanData.meal_plan_name, meal_plan: mealPlanData.meal_plan,
      status: mealPlanData.status || 'draft', active_from: mealPlanData.active_from,
      active_until: mealPlanData.active_until, daily_total_calories: mealPlanData.daily_total_calories,
      macros_target: mealPlanData.macros_target, recommendations: mealPlanData.recommendations,
      dietary_restrictions: mealPlanData.dietary_restrictions,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }]).select();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function updateMealPlan(req, res) {
  try {
    const { id } = req.params;
    const { mealPlanData } = req.body;
    if (!mealPlanData) return res.status(400).json({ error: 'Meal plan data is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const { data, error } = await adminDB.from('meal_plans_and_schemas').update({
      meal_plan_name: mealPlanData.meal_plan_name, meal_plan: mealPlanData.meal_plan,
      status: mealPlanData.status, active_from: mealPlanData.active_from,
      active_until: mealPlanData.active_until, daily_total_calories: mealPlanData.daily_total_calories,
      macros_target: mealPlanData.macros_target, recommendations: mealPlanData.recommendations,
      dietary_restrictions: mealPlanData.dietary_restrictions,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getMealPlanHistory(req, res) {
  try {
    const { userCode } = req.query;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const { data, error } = await adminDB.from('meal_plans_and_schemas').select('*').eq('user_code', userCode).eq('record_type', 'meal_plan').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getTrainingPlan(req, res) {
  try {
    const { userCode } = req.query;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const { data, error } = await adminDB.from('training_plans').select('*').eq('user_code', userCode).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getCompanies(req, res) {
  try {
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const { data, error } = await adminDB.from('companies').select('id, name, config, managers:profiles!profiles_company_id_fkey(id, name, role)').order('name', { ascending: true });
    if (error) throw error;
    const formattedCompanies = (data || []).map((company) => ({
      id: company.id, name: company.name, config: company.config || null,
      managers: (company.managers || []).filter((m) => m.role === 'company_manager'),
    }));
    res.json({ data: formattedCompanies });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getClientCompanyAssignment(req, res) {
  try {
    const { userCode } = req.query;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    const { data: chatUserData, error: chatUserError } = await adminDB.from('chat_users').select('provider_id').eq('user_code', userCode).maybeSingle();
    if (chatUserError && chatUserError.code !== 'PGRST116') throw chatUserError;

    const providerId = chatUserData?.provider_id || null;
    if (!providerId) return res.json({ data: { provider_id: null, provider: null, company: null } });

    const { data: providerData, error: providerError } = await adminDB.from('profiles').select('id, name, company_id').eq('id', providerId).maybeSingle();
    if (providerError && providerError.code !== 'PGRST116') throw providerError;

    let companyData = null;
    if (providerData?.company_id) {
      const { data: companyRow, error: companyError } = await adminDB.from('companies').select('id, name, config').eq('id', providerData.company_id).maybeSingle();
      if (companyError && companyError.code !== 'PGRST116') throw companyError;
      companyData = companyRow || null;
    }

    res.json({ data: { provider_id: providerId, provider: providerData || null, company: companyData } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function assignClientCompany(req, res) {
  try {
    const { userCode, companyId } = req.body;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    let managerId = null;
    if (companyId) {
      const { data: manager, error: managerError } = await adminDB.from('profiles').select('id').eq('company_id', companyId).eq('role', 'company_manager').order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (managerError) throw managerError;
      if (!manager) return res.status(404).json({ error: 'No manager found for the selected company' });
      managerId = manager.id;
    }

    const { data, error } = await adminDB.from('chat_users').update({ provider_id: managerId }).eq('user_code', userCode).select('provider_id').maybeSingle();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function debugMealPlans(req, res) {
  try {
    const { userCode } = req.query;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    const { data: allPlans, error: allError } = await adminDB.from('meal_plans_and_schemas').select('*').eq('user_code', userCode).eq('record_type', 'meal_plan');
    const { data: allPlansInDb, error: allDbError } = await adminDB.from('meal_plans_and_schemas').select('user_code, status, record_type, meal_plan_name').eq('record_type', 'meal_plan').limit(10);

    res.json({ data: { allPlans, allPlansInDb }, allError, allDbError });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getChatMessages, createChatMessage,
  getMessages, sendMessage, markMessageRead,
  getMealPlan, getMealPlanSchemas, createMealPlan, updateMealPlan, getMealPlanHistory,
  getTrainingPlan,
  getCompanies, getClientCompanyAssignment, assignClientCompany,
  debugMealPlans,
};
