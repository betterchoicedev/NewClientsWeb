const { randomUUID } = require('crypto');
const OpenAI = require('openai');
const { clientDB, adminDB } = require('../../config/db');
const { parseTimeToFloat } = require('../../utils/helpers');
const { formatCityLabel } = require('../../utils/cityDisplay');
const { generateUpdatedMealPlan, createAndSaveOnboardingMealPlanForUser } = require('../../services/ai.service');

// ─── Resolve user_code helper ─────────────────────────────────────────────────
async function _resolveUserCode(authUserId, email) {
  if (!authUserId) return null;
  const { data: byUserId } = await clientDB.from('clients').select('id, user_code, user_id, email').eq('user_id', authUserId).maybeSingle();
  if (byUserId?.user_code) return byUserId.user_code;
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  const { data: byEmail } = await clientDB.from('clients').select('id, user_code, user_id').eq('email', normalizedEmail).maybeSingle();
  if (byEmail?.user_code) {
    if (byEmail.user_id !== authUserId) await clientDB.from('clients').update({ user_id: authUserId, updated_at: new Date().toISOString() }).eq('id', byEmail.id);
    return byEmail.user_code;
  }
  return null;
}

// ─── User settings ────────────────────────────────────────────────────────────

async function getUserCode(req, res) {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email is required' });
    const { data: clientData, error } = await clientDB.from('clients').select('user_code').eq('email', email).single();
    if (error) {
      if (error.code === 'PGRST116') return res.json({ data: null });
      return res.status(500).json({ error: 'Failed to fetch user_code', message: error.message });
    }
    res.json({ data: clientData });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function getUserLanguage(req, res) {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });
    const { data, error } = await clientDB.from('clients').select('user_language').eq('user_id', user_id).single();
    if (error) {
      if (error.code === 'PGRST116') return res.json({ data: null });
      return res.status(500).json({ error: 'Failed to fetch user language', message: error.message });
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function getUserSettings(req, res) {
  try {
    const { user_code } = req.query;
    if (!user_code) return res.status(400).json({ error: 'user_code is required' });
    const { data, error } = await clientDB.from('clients').select('show_calories, show_macros, portion_display, measurement_system, weight_unit, decimal_places').eq('user_code', user_code).single();
    if (error) {
      if (error.code === 'PGRST116') return res.json({ data: null });
      return res.status(500).json({ error: 'Failed to fetch settings', message: error.message });
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function updateUserSettings(req, res) {
  try {
    const { user_code, settings } = req.body;
    if (!user_code) return res.status(400).json({ error: 'user_code is required' });
    if (!settings) return res.status(400).json({ error: 'settings is required' });
    const { error } = await clientDB.from('clients').update(settings).eq('user_code', user_code);
    if (error) return res.status(500).json({ error: 'Failed to update settings', message: error.message });
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

async function getOnboardingClientData(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { data, error } = await clientDB.from('clients').select('*').eq('user_id', userId).single();
    if (error) {
      if (error.code === 'PGRST116') return res.json({ data: null });
      return res.status(500).json({ error: 'Failed to fetch client data', message: error.message });
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function getOnboardingChatUserMealData(req, res) {
  try {
    const userCode = req.userCode;
    if (!userCode) return res.status(400).json({ error: 'user_code is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const { data, error } = await adminDB.from('chat_users').select('number_of_meals, meal_plan_structure, first_meal_time, last_meal_time, client_preference').eq('user_code', userCode).single();
    if (error) {
      if (error.code === 'PGRST116') return res.json({ data: null });
      return res.status(500).json({ error: 'Failed to fetch chat user meal data', message: error.message });
    }
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function checkOnboardingPhone(req, res) {
  try {
    const { phone } = req.body;
    const user_id = req.userId;
    const user_code = req.userCode;
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    const { data: clientData } = await clientDB.from('clients').select('phone, user_id').eq('phone', phone).maybeSingle();
    if (clientData && clientData.user_id !== user_id) return res.json({ exists: true, table: 'clients' });

    if (adminDB) {
      const { data: byPhone } = await adminDB.from('chat_users').select('phone_number, user_code').eq('phone_number', phone).maybeSingle();
      const { data: byWA } = await adminDB.from('chat_users').select('whatsapp_number, user_code').eq('whatsapp_number', phone).maybeSingle();
      const chatUserData = byPhone || byWA;
      if (chatUserData) {
        if (user_code && chatUserData.user_code === user_code) return res.json({ exists: false });
        return res.json({ exists: true, table: 'chat_users' });
      }
    }
    res.json({ exists: false });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function updateOnboardingClient(req, res) {
  try {
    const user_id = req.userId;
    if (!user_id) return res.status(401).json({ error: 'Unauthorized' });
    const { clientData } = req.body;
    if (!clientData) return res.status(400).json({ error: 'clientData is required' });
    const { data, error } = await clientDB.from('clients').update(clientData).eq('user_id', user_id).select();
    if (error) return res.status(500).json({ error: 'Failed to update client', message: error.message });
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function updateOnboardingChatUser(req, res) {
  try {
    const user_code = req.userCode;
    if (!user_code) return res.status(400).json({ error: 'user_code is required' });
    const { chatUserData } = req.body;
    if (!chatUserData) return res.status(400).json({ error: 'chatUserData is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    const { data: chatUser, error: chatUserError } = await adminDB.from('chat_users').select('id').eq('user_code', user_code).single();
    if (chatUserError || !chatUser) return res.status(404).json({ error: 'Chat user not found', message: chatUserError?.message });

    const { error } = await adminDB.from('chat_users').update(chatUserData).eq('id', chatUser.id);
    if (error) return res.status(500).json({ error: 'Failed to update chat user', message: error.message });
    res.json({ success: true, message: 'Chat user updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function startAsyncMealPlan(req, res) {
  try {
    const user_id = req.userId;
    const user_code = req.userCode;
    if (!user_id && !user_code) return res.status(400).json({ error: 'user_id or user_code is required' });
    setImmediate(() => {
      createAndSaveOnboardingMealPlanForUser(user_id || null, user_code || null, { clientDB, adminDB }).catch((err) => {
        console.warn('⚠️ Async onboarding meal plan task failed:', err?.message || err);
      });
    });
    res.json({ queued: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function classifyActivity(req, res) {
  try {
    const { activityDescription } = req.body;
    if (!activityDescription || !activityDescription.trim()) return res.status(400).json({ error: 'activityDescription is required' });

    const apiKey = process.env.CLASSIFY_ACTIVITY_KEY;
    const apiBase = (process.env.CLASSIFY_ACTIVITY_BASE || '').replace(/\/$/, '');
    const model = process.env.CLASSIFY_ACTIVITY_DEPLOYMENT || 'gpt-4o-mini';

    if (!apiKey) return res.status(500).json({ error: 'CLASSIFY_ACTIVITY_KEY is not configured on the server' });

    const client = new OpenAI({
      apiKey,
      ...(apiBase ? { baseURL: apiBase } : {}),
    });

    const systemPrompt = `You are an expert fitness and nutrition routing AI. Assign the Harris-Benedict activity level from the user's description of their job(s) AND intentional exercise.

Strict levels:
- "sedentary" (1.2): Desk/seated work almost all day AND little or no intentional exercise.
- "light" (1.375): Mostly seated or light standing work with only light exercise ~1–3 days/week. NEVER use for anyone with a physically demanding job.
- "moderate" (1.55): On-feet retail/hospitality, lots of daily walking, OR moderate exercise 3–5 days/week, OR a desk-only job with regular training most weekdays. NEVER use when a physical/manual/labor job is mentioned.
- "very" (1.725): Physically demanding job (construction, warehouse, farming, lifting, trades, "physical job", manual labor, strenuous work) OR hard exercise 6–7 days/week. This is the DEFAULT whenever a physical job appears — even part-time, mornings-only, or combined with a desk job.
- "extra" (1.9): Very hard daily training AND a physical job, OR 2×/day training, OR elite-level volume.

Hard rules (never break):
1. Physical/manual/labor/strenuous job keywords ("physical job", construction, warehouse, trades, lifting, manual labor, active work, etc.) → output "very" by default. Do NOT output "moderate" or "light" for these profiles unless the user explicitly says the physical work is very mild/light AND there is no sport.
2. Physical job + ANY intentional sport or exercise (including weekends only, casual sport, gym sometimes) → MUST be "very", never "moderate".
3. Multiple jobs or split shifts: classify from the MOST demanding segment, never average. "Physical job + office afternoons" = physical job wins → "very".
4. Weekend sports ADD to job load — they never downgrade a physical job. Physical job + office job + sport on weekends → "very" (mandatory; "moderate" is wrong).
5. "light" is ONLY for genuinely low-load profiles: sedentary/light office work with light occasional exercise and NO physical job.
6. "moderate" is ONLY for non-physical occupations (desk, retail on feet, walking-heavy office) plus moderate exercise. If ANY physical job is present, "moderate" is forbidden.

Decision order:
1. Scan for physical/manual/labor keywords → if found, start at "very".
2. If physical job + any sport/exercise → lock "very".
3. Else score on-feet vs seated occupation for moderate/light.
4. Bump for exercise frequency only when no physical job is present.

Mandatory mappings (do not override):
- "physical job and an afternoon office job and sport on weekends" → "very"
- Physical 9–5 + office afternoon + weekend sport → "very"
- Physical labor with no extra gym → "very"
- Office 9–5 + weekend sport only (no physical job) → "light" or "moderate"
- Desk job + gym 4–5 days (no physical job) → "moderate" or "very"

In reasoning, cite which rule and job segment drove the level. If you considered "moderate" but a physical job was mentioned, explain why "very" was chosen instead.`;

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `User Input:\n"${activityDescription.trim()}"` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'activity_classification',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              activity_factor: { type: 'string', enum: ['sedentary', 'light', 'moderate', 'very', 'extra'] },
              reasoning: { type: 'string' },
            },
            required: ['activity_factor', 'reasoning'],
            additionalProperties: false,
          },
        },
      },
      temperature: 1,
      max_completion_tokens: 200,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return res.status(502).json({ error: 'Empty response from AI' });

    const parsed = JSON.parse(content);
    return res.json({ activity_factor: parsed.activity_factor, reasoning: parsed.reasoning });
  } catch (error) {
    console.error('[classifyActivity] AI error', error?.message || error);
    res.status(502).json({ error: 'AI classification failed', details: error?.message || String(error) });
  }
}

async function getOnboardingStatus(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { data: client, error: clientErr } = await clientDB.from('clients').select(
      'first_name, last_name, phone, user_language, region, city, timezone, birth_date, gender, height, current_weight, target_weight, goal, measurement_system, medical_conditions, activity_level, food_allergies, food_limitations, onboarding_completed, user_code',
    ).eq('user_id', userId).maybeSingle();

    if (clientErr && clientErr.code !== 'PGRST116') return res.status(500).json({ error: clientErr.message });
    if (!client) return res.json({ completed: false, step: 0, resumeData: {} });
    if (client.onboarding_completed) return res.json({ completed: true, step: 6, resumeData: {} });

    let chatUser = null;
    if (adminDB && client.user_code) {
      const { data } = await adminDB.from('chat_users').select('user_language, date_of_birth, nursing_status, Activity_level, user_context, base_daily_total_calories, macros, medical_conditions, first_meal_time, last_meal_time').eq('user_code', client.user_code).maybeSingle();
      chatUser = data;
    }

    let foodAllergies = client.food_allergies || [];
    let foodLimitations = client.food_limitations || [];
    if (typeof foodAllergies === 'string') try { foodAllergies = JSON.parse(foodAllergies); } catch { foodAllergies = []; }
    if (typeof foodLimitations === 'string') try { foodLimitations = JSON.parse(foodLimitations); } catch { foodLimitations = []; }

    let protein = null, carbs = null, fat = null;
    if (chatUser?.macros && typeof chatUser.macros === 'object') {
      const m = chatUser.macros;
      protein = typeof m.protein === 'number' ? m.protein : null;
      carbs   = typeof m.carbs   === 'number' ? m.carbs   : null;
      fat     = typeof m.fat     === 'number' ? m.fat     : null;
    }

    const resumeData = {
      language: client.user_language || chatUser?.user_language || 'en',
      firstName: client.first_name || '', lastName: client.last_name || '',
      region: client.region || '', city: client.city || '', timezone: client.timezone || '',
      dateOfBirth: client.birth_date || chatUser?.date_of_birth || '',
      gender: client.gender || 'other',
      physiologicalState: chatUser?.nursing_status || 'none',
      unitSystem: client.measurement_system || 'metric',
      heightCm: client.height ?? null, weightKg: client.current_weight ?? null,
      targetWeightKg: client.target_weight ?? null, goal: client.goal ?? null,
      medicalConditions: client.medical_conditions || chatUser?.medical_conditions || '',
      activityLevel: client.activity_level || chatUser?.Activity_level || null,
      activityDescription: chatUser?.user_context || '',
      foodAllergies, foodLimitations,
      eatingWindowStart: chatUser?.first_meal_time || '07:00',
      eatingWindowEnd: chatUser?.last_meal_time || '21:00',
      dailyCalories: chatUser?.base_daily_total_calories ?? null,
      protein, carbs, fat,
    };

    let step = 0;
    if (resumeData.firstName) step = 1;
    if (step >= 1 && resumeData.region && resumeData.dateOfBirth) step = 2;
    if (step >= 2 && resumeData.heightCm != null && resumeData.weightKg != null && resumeData.goal) step = 3;
    if (step >= 3 && resumeData.activityDescription) step = 4;
    if (step >= 4 && resumeData.activityLevel) step = 5;
    if (step >= 5 && resumeData.dailyCalories != null) step = 6;

    return res.json({ completed: false, step, resumeData });
  } catch (error) {
    console.error('GET /api/onboarding/status error:', error);
    res.status(500).json({ error: error.message || 'Failed to load onboarding status' });
  }
}

// ─── Cities ───────────────────────────────────────────────────────────────────

async function searchCities(req, res) {
  try {
    if (!adminDB) return res.status(503).json({ error: 'City search is unavailable', message: 'adminDB is not configured' });

    // Progressive disclosure: country/region must be chosen before searching 230k cities.
    const country = (req.query.country || '').toString().trim();
    const countryCodes = country
      ? country.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
      : [];
    if (countryCodes.length === 0) {
      return res.status(400).json({
        error: 'country is required',
        message: 'Pass country (ISO 3166-1 alpha-2), e.g. ?country=IL&q=Tel',
      });
    }

    const rawQ = (req.query.q || '').toString().trim();
    if (rawQ.length < 1) return res.json({ data: [] });

    const safe = rawQ.replace(/[,()*]/g, '').trim();
    if (safe.length < 1) return res.json({ data: [] });

    const mode = (req.query.mode || 'full').toString().trim().toLowerCase() === 'quick' ? 'quick' : 'full';
    const limitParam = parseInt(req.query.limit, 10);
    // quick: confident probe (max 2). full: autocomplete list (default 12, max 15).
    const limit =
      mode === 'quick'
        ? Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 2, 1), 2)
        : Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 12, 1), 15);

    // Prefix-only (no alternatenames mid-match) so indexes on name/asciiname can be used.
    const orFilter = [`name.ilike.${safe}%`, `asciiname.ilike.${safe}%`].join(',');

    let query = adminDB
      .from('cities500')
      .select(
        'geonameid, name, asciiname, alternatenames, country_code, latitude, longitude, timezone, population'
      )
      .or(orFilter)
      .order('population', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (countryCodes.length === 1) query = query.eq('country_code', countryCodes[0]);
    else query = query.in('country_code', countryCodes);

    const { data: rows, error } = await query;
    if (error) return res.status(500).json({ error: 'Failed to search cities', message: error.message });
    const data = (rows || []).map((row) => ({
      ...row,
      display_label: formatCityLabel(row),
    }));
    res.json({ data, mode });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ─── Profile meal plans ───────────────────────────────────────────────────────

async function getProfileMealPlan(req, res) {
  try {
    const { userCode } = req.query;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });
    const { data, error } = await clientDB.from('client_meal_plans').select('*').eq('user_code', userCode).eq('active', true).order('created_at', { ascending: false });
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data: data || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function clearEditedMealPlan(req, res) {
  try {
    const { planId, selectedDay } = req.body;
    if (!planId) return res.status(400).json({ error: 'Plan ID is required' });

    const { data: planData, error: planFetchError } = await clientDB.from('client_meal_plans').select('id, user_code, meal_plan_name').eq('id', planId).single();
    if (planFetchError || !planData) return res.status(404).json({ error: 'Plan not found' });

    const { error } = await clientDB.from('client_meal_plans').update({ client_edited_meal_plan: null, edited_plan_date: null }).eq('id', planId);
    if (error) throw error;

    if (adminDB) {
      const now = new Date().toISOString();
      const selectedDayNumber = Number.isInteger(selectedDay) ? selectedDay : Number(selectedDay);

      const { data: activePlans, error: activePlansError } = await adminDB.from('meal_plans_and_schemas').select('id, active_days, created_at').eq('user_code', planData.user_code).eq('record_type', 'meal_plan').eq('status', 'active').order('created_at', { ascending: false });
      if (activePlansError) throw activePlansError;

      const latestActivePlan = Array.isArray(activePlans) && activePlans.length > 0 ? activePlans[0] : null;
      const planToDelete = Array.isArray(activePlans) ? activePlans.find((plan) => {
        if (!Number.isInteger(selectedDayNumber) || selectedDayNumber < 0 || selectedDayNumber > 6) return false;
        if (!Array.isArray(plan.active_days) || plan.active_days.length === 0) return true;
        return plan.active_days.includes(selectedDayNumber);
      }) || latestActivePlan : null;

      if (planToDelete?.id) {
        const { error: deleteError } = await adminDB.from('meal_plans_and_schemas').delete().eq('id', planToDelete.id);
        if (deleteError) throw deleteError;
      }

      const { data: previousPlan } = await adminDB.from('meal_plans_and_schemas').select('id').eq('user_code', planData.user_code).eq('record_type', 'meal_plan').eq('meal_plan_name', planData.meal_plan_name).neq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (previousPlan?.id) {
        await adminDB.from('meal_plans_and_schemas').update({ status: 'active', active_from: now, active_until: null, updated_at: now }).eq('id', previousPlan.id);
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function saveEditedMealPlan(req, res) {
  try {
    const { planId, mealPlan, userCode } = req.body;
    if (!planId || !mealPlan) return res.status(400).json({ error: 'Plan ID and meal plan data are required' });

    const today = new Date().toISOString();
    const { data: planData, error: planError } = await clientDB.from('client_meal_plans').select('user_code, dietitian_meal_plan, client_edited_meal_plan').eq('id', planId).single();
    if (planError) throw planError;

    const { error: clientMealPlanError } = await clientDB.from('client_meal_plans').update({ client_edited_meal_plan: mealPlan, edited_plan_date: today }).eq('id', planId);
    if (clientMealPlanError) throw clientMealPlanError;

    if (adminDB && planData) {
      const userCodeToUse = userCode || planData.user_code;
      const { data: schemaPlan } = await adminDB.from('meal_plans_and_schemas').select('id, client_edited_meal_plan').eq('user_code', userCodeToUse).eq('record_type', 'meal_plan').eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (schemaPlan) {
        const updateField = schemaPlan.client_edited_meal_plan ? 'client_edited_meal_plan' : 'dietitian_meal_plan';
        await adminDB.from('meal_plans_and_schemas').update({ [updateField]: mealPlan, updated_at: today }).eq('id', schemaPlan.id);
      }

      const { data: chatUser } = await adminDB.from('chat_users').select('id').eq('user_code', userCodeToUse).maybeSingle();
      if (chatUser) await adminDB.from('chat_users').update({ meal_plan: mealPlan, updated_at: today }).eq('id', chatUser.id);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function aiUpdateMealPlan(req, res) {
  try {
    const { planId, userCode, requestText, selectedDay, overwriteEditedPlan = false } = req.body;
    if (!planId || !requestText || !String(requestText).trim()) return res.status(400).json({ error: 'planId and requestText are required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    const { data: planData, error: planError } = await clientDB.from('client_meal_plans').select('id, user_code, meal_plan_name, dietitian_id, daily_total_calories, macros_target, active_days, dietitian_meal_plan, client_edited_meal_plan, ai_plan_change_used, ai_plan_change_used_at').eq('id', planId).single();
    if (planError || !planData) return res.status(404).json({ error: 'Meal plan not found' });

    if (planData.ai_plan_change_used) return res.status(403).json({ error: 'AI meal plan change already used', code: 'AI_MEAL_PLAN_CHANGE_LIMIT_REACHED', usedAt: planData.ai_plan_change_used_at || null });
    if (planData.client_edited_meal_plan && !overwriteEditedPlan) return res.status(409).json({ error: 'Existing edited meal plan will be overwritten', requiresConfirmation: true });

    const resolvedUserCode = userCode || planData.user_code;
    const baseMealPlan = planData.client_edited_meal_plan || planData.dietitian_meal_plan;
    if (!baseMealPlan) return res.status(400).json({ error: 'No base meal plan found to update' });

    const [{ data: clientProfile }, { data: chatProfile }] = await Promise.all([
      clientDB.from('clients').select('food_allergies, dietary_preferences, medical_conditions, food_limitations, first_name, last_name, full_name').eq('user_code', resolvedUserCode).maybeSingle(),
      adminDB.from('chat_users').select('food_allergies, recommendations, food_limitations, medical_conditions, nursing_status, client_preference, language, user_language, full_name').eq('user_code', resolvedUserCode).maybeSingle(),
    ]);

    const userProfileObj = {
      full_name: clientProfile?.full_name || chatProfile?.full_name || `${clientProfile?.first_name || ''} ${clientProfile?.last_name || ''}`.trim(),
      diet: clientProfile?.dietary_preferences || null,
      allergies: clientProfile?.food_allergies || chatProfile?.food_allergies || [],
      limitations: clientProfile?.food_limitations || null,
      medical_conditions: clientProfile?.medical_conditions || chatProfile?.medical_conditions || null,
      recommendations: chatProfile?.recommendations || null,
      chat_food_limitations: chatProfile?.food_limitations || null,
      nursing_status: chatProfile?.nursing_status || null,
      preferences: chatProfile?.client_preference || null,
      language: chatProfile?.user_language || chatProfile?.language || 'english',
    };

    const updatedMealPlan = await generateUpdatedMealPlan(JSON.stringify(baseMealPlan), String(requestText).trim(), userProfileObj);
    const now = new Date().toISOString();

    const { error: saveMainError } = await clientDB.from('client_meal_plans').update({ client_edited_meal_plan: updatedMealPlan, edited_plan_date: now, ai_plan_change_used: true, ai_plan_change_used_at: now, updated_at: now }).eq('id', planId);
    if (saveMainError) throw saveMainError;

    const { data: activePlans } = await adminDB.from('meal_plans_and_schemas').select('id, schema, active_days').eq('user_code', resolvedUserCode).eq('record_type', 'meal_plan').eq('status', 'active').order('created_at', { ascending: false });

    const latestActivePlan = Array.isArray(activePlans) && activePlans.length > 0 ? activePlans[0] : null;
    const selectedDayNumber = Number.isInteger(selectedDay) ? selectedDay : Number(selectedDay);
    const planToExpire = Array.isArray(activePlans) ? activePlans.find((plan) => {
      if (!Number.isInteger(selectedDayNumber) || selectedDayNumber < 0 || selectedDayNumber > 6) return false;
      if (!Array.isArray(plan.active_days) || plan.active_days.length === 0) return true;
      return plan.active_days.includes(selectedDayNumber);
    }) || latestActivePlan : null;

    if (planToExpire?.id) {
      const { error: deactivateError } = await adminDB.from('meal_plans_and_schemas').update({ status: 'expired', active_until: now, updated_at: now }).eq('id', planToExpire.id);
      if (deactivateError) throw deactivateError;
    }

    const newMealPlanId = randomUUID();
    const { error: createActiveError } = await adminDB.from('meal_plans_and_schemas').insert({
      id: newMealPlanId, record_type: 'meal_plan', dietitian_id: planData.dietitian_id || null,
      user_code: resolvedUserCode, meal_plan_name: planData.meal_plan_name || 'Updated Meal Plan',
      schema: latestActivePlan?.schema || null, meal_plan: updatedMealPlan, status: 'active',
      active_from: now, active_days: planData.active_days || null,
      daily_total_calories: planData.daily_total_calories || null,
      macros_target: planData.macros_target || null, created_at: now, updated_at: now,
    });
    if (createActiveError) throw createActiveError;

    res.json({ success: true, mealPlan: updatedMealPlan });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to update meal plan with AI' });
  }
}

async function getProfileClient(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (req.query?.userId && req.query.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { data, error } = await clientDB.from('clients').select('*').eq('user_id', userId).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function loadProfile(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (req.query?.userId && req.query.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { data, error } = await clientDB.from('clients').select('*').eq('user_id', userId).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getProfileChatUser(req, res) {
  try {
    const { userCode } = req.query;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const { data, error } = await adminDB.from('chat_users').select('medical_conditions, client_preference, food_allergies, full_name, email, phone_number, region, city, timezone, age, gender, date_of_birth, language, subscription_status, subscription_type, subscription_expires_at, is_blocked, user_code, Activity_level, base_daily_total_calories, daily_target_total_calories, macros, height_cm, weight_kg').eq('user_code', userCode).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getProfileChatUserMe(req, res) {
  try {
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const userCode = req.userCode;
    if (!userCode) return res.status(404).json({ error: 'No user_code linked to this account' });
    const { data, error } = await adminDB.from('chat_users').select('*').eq('user_code', userCode).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return res.status(404).json({ error: 'Chat user not found' });
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getMealWindow(req, res) {
  try {
    const { userCode } = req.query;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const { data, error } = await adminDB.from('chat_users').select('first_meal_time, last_meal_time').eq('user_code', userCode).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    const wakeTime = data?.first_meal_time ? parseTimeToFloat(data.first_meal_time) : 7.0;
    const sleepTime = data?.last_meal_time ? parseTimeToFloat(data.last_meal_time) : 23.0;
    res.json({ data: { first_meal_time: wakeTime, last_meal_time: sleepTime } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function saveProfile(req, res) {
  try {
    const { userId, profileData } = req.body;
    if (!userId || !profileData) return res.status(400).json({ error: 'User ID and profile data are required' });

    const { data: existingData } = await clientDB.from('clients').select('id').eq('user_id', userId).maybeSingle();
    const result = !existingData
      ? await clientDB.from('clients').insert(profileData).select()
      : await clientDB.from('clients').update(profileData).eq('user_id', userId).select();

    const { data, error } = result;
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message, code: error.code });
  }
}

async function syncChatUser(req, res) {
  try {
    const { userCode, chatUserData } = req.body;
    if (!userCode || !chatUserData) return res.status(400).json({ error: 'User code and chat user data are required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const { data: chatUser, error: chatUserError } = await adminDB.from('chat_users').select('id').eq('user_code', userCode).maybeSingle();
    if (chatUserError) throw chatUserError;
    if (!chatUser) return res.status(404).json({ error: 'Chat user not found' });
    const { error } = await adminDB.from('chat_users').update(chatUserData).eq('id', chatUser.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function saveNutritional(req, res) {
  try {
    const { userCode, daily_target_total_calories, base_daily_total_calories, macros, height_cm, Activity_level } = req.body;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    const updatePayload = {};
    if (daily_target_total_calories != null) updatePayload.daily_target_total_calories = Number(daily_target_total_calories);
    if (base_daily_total_calories != null) updatePayload.base_daily_total_calories = Number(base_daily_total_calories);
    if (macros != null) updatePayload.macros = macros;
    if (height_cm != null && height_cm !== '') { const p = parseFloat(height_cm); if (!isNaN(p)) updatePayload.height_cm = p; }
    if (Activity_level != null && Activity_level !== '') updatePayload.Activity_level = Activity_level;

    if (Object.keys(updatePayload).length === 0) return res.status(400).json({ error: 'No data to update' });
    const { error } = await adminDB.from('chat_users').update(updatePayload).eq('user_code', userCode);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function savePersonal(req, res) {
  try {
    const { userId, userCode, region, city, timezone } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const clientPayload = {};
    if (region !== undefined) clientPayload.region = region || null;
    if (city !== undefined) clientPayload.city = city || null;
    if (timezone !== undefined) clientPayload.timezone = timezone || null;
    if (Object.keys(clientPayload).length === 0) return res.status(400).json({ error: 'No data to update' });
    const { error: clientError } = await clientDB.from('clients').update(clientPayload).eq('user_id', userId);
    if (clientError) throw clientError;
    if (userCode && adminDB) await adminDB.from('chat_users').update(clientPayload).eq('user_code', userCode);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function saveHealth(req, res) {
  try {
    const { userId, userCode, dietaryPreferences, foodAllergies, foodLimitations, medicalConditions } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const clientPayload = {};
    if (dietaryPreferences !== undefined) clientPayload.dietary_preferences = dietaryPreferences || null;
    if (foodAllergies !== undefined) clientPayload.food_allergies = foodAllergies || null;
    if (foodLimitations !== undefined) clientPayload.food_limitations = foodLimitations || null;
    if (medicalConditions !== undefined) clientPayload.medical_conditions = medicalConditions || null;
    if (Object.keys(clientPayload).length === 0) return res.status(400).json({ error: 'No data to update' });
    const { error: clientError } = await clientDB.from('clients').update(clientPayload).eq('user_id', userId);
    if (clientError) throw clientError;
    if (userCode && adminDB) {
      const chatPayload = {};
      if (dietaryPreferences !== undefined) chatPayload.client_preference = dietaryPreferences || null;
      if (foodAllergies !== undefined) chatPayload.food_allergies = foodAllergies || null;
      if (foodLimitations !== undefined) chatPayload.food_limitations = foodLimitations || null;
      if (medicalConditions !== undefined) chatPayload.medical_conditions = medicalConditions || null;
      await adminDB.from('chat_users').update(chatPayload).eq('user_code', userCode);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function saveImageUrl(req, res) {
  try {
    const { userId, imageUrl } = req.body;
    if (!userId || !imageUrl) return res.status(400).json({ error: 'User ID and image URL are required' });
    const { data: existing } = await clientDB.from('clients').select('id').eq('user_id', userId).maybeSingle();
    if (!existing) {
      const { error } = await clientDB.from('clients').insert({ user_id: userId, profile_image_url: imageUrl, updated_at: new Date().toISOString() });
      if (error) throw error;
    } else {
      const { error } = await clientDB.from('clients').update({ profile_image_url: imageUrl, updated_at: new Date().toISOString() }).eq('user_id', userId);
      if (error) throw error;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getProfileUserCode(req, res) {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });
    if (req.userId && userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    const email = req.authUser?.email || null;
    const userCode = await _resolveUserCode(userId, email);
    res.json({ user_code: userCode || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function uploadImage(req, res) {
  try {
    const { userId, imageData, bucketName } = req.body;
    if (!userId || !imageData) return res.status(400).json({ error: 'User ID and image data are required' });
    if (req.userId && userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });

    const { data: clientData, error: clientError } = await clientDB.from('clients').select('user_code').eq('user_id', userId).maybeSingle();
    if (clientError || !clientData) return res.status(404).json({ error: 'User profile not found' });
    const userCode = clientData.user_code;
    if (!userCode) return res.status(400).json({ error: 'User code not found' });

    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `${userCode}/${Date.now()}.jpeg`;
    const bucket = bucketName || process.env.REACT_APP_SUPABASE_STORAGE_BUCKET_NAME || 'profile-pictures';

    const { data: uploadData, error: uploadError } = await clientDB.storage.from(bucket).upload(filename, buffer, {
      contentType: 'image/jpeg', upsert: false, cacheControl: '3600',
      metadata: { userId, userCode, uploadedAt: new Date().toISOString() },
    });
    if (uploadError) throw uploadError;

    const { data: urlData } = clientDB.storage.from(bucket).getPublicUrl(uploadData.path);
    res.json({ publicUrl: urlData.publicUrl, path: uploadData.path });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getClientDataFull(req, res) {
  try {
    const { userCode } = req.query;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    const [{ data: chatData, error: chatError }, { data: clientsData, error: clientsError }] = await Promise.all([
      adminDB.from('chat_users').select('*').eq('user_code', userCode).maybeSingle(),
      clientDB.from('clients').select('onboarding_completed').eq('user_code', userCode).maybeSingle(),
    ]);
    if (chatError && chatError.code !== 'PGRST116') throw chatError;
    if (clientsError && clientsError.code !== 'PGRST116') throw clientsError;

    res.json({ data: { ...chatData, onboarding_completed: clientsData?.onboarding_completed || false } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function createMealPlan(req, res) {
  try {
    const { planId, userCode, mealPlanName, template, menuData, dailyCalories, macros } = req.body;
    if (!planId || !userCode || !mealPlanName || !menuData) return res.status(400).json({ error: 'Missing required fields' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const now = new Date().toISOString();

    const { error: secondaryError } = await adminDB.from('meal_plans_and_schemas').insert({
      id: planId, record_type: 'meal_plan', user_code: userCode, meal_plan_name: mealPlanName,
      schema: template, meal_plan: menuData, status: 'active', daily_total_calories: dailyCalories,
      macros_target: macros, active_from: now, created_at: now, updated_at: now,
    });
    if (secondaryError) throw secondaryError;

    const { error: mainError } = await clientDB.from('client_meal_plans').insert({
      id: planId, user_code: userCode, original_meal_plan_id: planId, meal_plan_name: mealPlanName,
      dietitian_meal_plan: menuData, active: true, daily_total_calories: dailyCalories,
      macros_target: macros, created_at: now, updated_at: now,
    });
    if (mainError) {
      await adminDB.from('meal_plans_and_schemas').delete().eq('id', planId);
      throw mainError;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getProvider(req, res) {
  try {
    const { userCode } = req.query;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const { data, error } = await adminDB.from('chat_users').select('provider_id').eq('user_code', userCode).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ provider_id: data?.provider_id || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function systemMessageExists(req, res) {
  try {
    const { providerId, userCode, userId, title, messageType, requestKey } = req.query;
    if (!providerId || (!userCode && !userId)) return res.status(400).json({ error: 'Missing required parameters' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    let query = adminDB.from('system_messages').select('id').eq('directed_to', providerId).eq('is_active', true);
    if (messageType) query = query.eq('message_type', messageType);
    if (title) query = query.eq('title', title);
    if (requestKey) query = query.ilike('content', `%request_key:${requestKey}%`);
    if (userId) query = query.eq('user_id', userId);
    else if (userCode) query = query.ilike('content', `%${userCode}%`);

    let { data, error } = await query;

    if ((!data || data.length === 0) && userId && userCode) {
      let fallbackQuery = adminDB.from('system_messages').select('id').eq('directed_to', providerId).eq('is_active', true).ilike('content', `%${userCode}%`);
      if (messageType) fallbackQuery = fallbackQuery.eq('message_type', messageType);
      if (title) fallbackQuery = fallbackQuery.eq('title', title);
      if (requestKey) fallbackQuery = fallbackQuery.ilike('content', `%request_key:${requestKey}%`);
      const fallbackResult = await fallbackQuery;
      if (!fallbackResult.error) data = fallbackResult.data;
    }

    if (error && error.code !== 'PGRST116') throw error;
    res.json({ exists: data && data.length > 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function upsertSystemMessage(req, res) {
  try {
    const { title, content, messageType, priority, directedTo, userId } = req.body;
    if (!title || !content || !directedTo) return res.status(400).json({ error: 'Missing required fields' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const { data, error } = await adminDB.from('system_messages').insert({ title, content, message_type: messageType || 'info', priority: priority || 'medium', is_active: true, directed_to: directedTo, user_id: userId || null }).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function updateLanguage(req, res) {
  try {
    const { userCode, language } = req.body;
    if (!userCode || !language) return res.status(400).json({ error: 'User code and language are required' });
    const { error } = await clientDB.from('clients').update({ user_language: language }).eq('user_code', userCode);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getUserCode, getUserLanguage, getUserSettings, updateUserSettings,
  getOnboardingClientData, getOnboardingChatUserMealData, checkOnboardingPhone,
  updateOnboardingClient, updateOnboardingChatUser, startAsyncMealPlan,
  classifyActivity, getOnboardingStatus, searchCities,
  getProfileMealPlan, clearEditedMealPlan, saveEditedMealPlan, aiUpdateMealPlan, createMealPlan,
  getProfileClient, loadProfile, getProfileChatUser, getProfileChatUserMe,
  getMealWindow, saveProfile, syncChatUser, saveNutritional, savePersonal,
  saveHealth, saveImageUrl, getProfileUserCode, uploadImage, getClientDataFull,
  getProvider, systemMessageExists, upsertSystemMessage, updateLanguage,
};
