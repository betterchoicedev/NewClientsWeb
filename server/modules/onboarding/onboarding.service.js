/**
 * Onboarding persistence: draft, commit (compensating dual-write), status, access-code redeem.
 * clientDB = main Supabase; adminDB = chat Supabase (separate projects).
 */
const crypto = require('crypto');
const { createAndSaveOnboardingMealPlanForUser } = require('../../services/ai.service');
const { buildMealPlanStructure, sortMealPlanStructure } = require('../../utils/mealStructure');

const VALID_PHASES = new Set(['welcome', 'products', 'promo', 'payment', 'questions', 'committing', 'pwa', 'done']);
const MAX_DRAFT_BYTES = 48 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ACTIVITY_MULT = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

function isEmpty(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function calculateAgeFromDob(dob) {
  if (!dob) return null;
  let y, m, d;
  if (/^\d{4}-\d{2}-\d{2}/.test(dob)) {
    [y, m, d] = dob.split('-').map(Number);
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(dob)) {
    const parts = dob.split('-').map(Number);
    d = parts[0];
    m = parts[1];
    y = parts[2];
  } else {
    return null;
  }
  const birth = new Date(y, m - 1, d);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const md = today.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}

function toYYYYMMDD(dob) {
  if (!dob) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(dob)) return dob.slice(0, 10);
  if (/^\d{2}-\d{2}-\d{4}$/.test(dob)) {
    const [d, m, y] = dob.split('-');
    return `${y}-${m}-${d}`;
  }
  return null;
}

function normalizePhone(phone, countryCode = '+972') {
  if (!phone || !String(phone).trim()) return null;
  let p = String(phone).replace(/[\s\-().]/g, '');
  if (p.startsWith('0') && countryCode === '+972') {
    p = countryCode + p.substring(1);
  } else if (!p.startsWith('+')) {
    p = (countryCode || '+972') + p;
  }
  return p;
}

function isDigitsOnlyPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

async function isPhoneTaken(phone, userId, userCode, { clientDB, adminDB }) {
  if (!phone) return false;

  const { data: clientData } = await clientDB
    .from('clients')
    .select('phone, user_id')
    .eq('phone', phone)
    .maybeSingle();
  if (clientData && clientData.user_id !== userId) return true;

  if (!adminDB) return false;

  const { data: byPhone } = await adminDB
    .from('chat_users')
    .select('phone_number, user_code')
    .eq('phone_number', phone)
    .maybeSingle();
  const { data: byWA } = await adminDB
    .from('chat_users')
    .select('whatsapp_number, user_code')
    .eq('whatsapp_number', phone)
    .maybeSingle();
  const chatUserData = byPhone || byWA;
  if (!chatUserData) return false;
  if (userCode && chatUserData.user_code === userCode) return false;
  return true;
}

function calculateBMR(age, gender, weightKg, heightCm) {
  if (!age || !gender || !weightKg || !heightCm) return null;
  const w = Number(weightKg);
  const h = Number(heightCm);
  if (gender === 'male') return 88.362 + 13.397 * w + 4.799 * h - 5.677 * age;
  if (gender === 'female') return 447.593 + 9.247 * w + 3.098 * h - 4.330 * age;
  return 88.362 + 13.397 * w + 4.799 * h - 5.677 * age;
}

function recomputeDailyCalories(answers) {
  const age = calculateAgeFromDob(answers.date_of_birth);
  const gender = answers.gender === 'other' ? 'male' : answers.gender;
  const weightKg = answers.weight_kg != null && answers.weight_kg !== '' ? parseFloat(answers.weight_kg) : null;
  const heightCm = answers.height_cm != null && answers.height_cm !== '' ? parseFloat(answers.height_cm) : null;
  const bmr = calculateBMR(age, gender, weightKg, heightCm);
  if (!bmr) return null;
  let tdee = bmr * (ACTIVITY_MULT[answers.activity_level] || 1.2);
  if (answers.gender === 'female') {
    if (answers.nursing_status === 'exclusive') tdee += 500;
    else if (answers.nursing_status === 'partial') tdee += 300;
  }
  const goal = answers.goal;
  if (goal === 'lose' || goal === 'cut') tdee -= 500;
  else if (goal === 'gain' || goal === 'muscle') tdee += 300;
  return Math.round(Math.max(1200, Math.min(6000, tdee)));
}

function recomputeMacros(calories, goal) {
  if (!calories) return { protein: null, carbs: null, fat: null };
  let pPct = 0.3;
  let cPct = 0.4;
  let fPct = 0.3;
  if (goal === 'muscle' || goal === 'cut') {
    pPct = 0.35;
    cPct = 0.35;
    fPct = 0.3;
  }
  return {
    protein: Math.round((calories * pPct) / 4),
    carbs: Math.round((calories * cPct) / 4),
    fat: Math.round((calories * fPct) / 9),
  };
}

function clampClientCalories(answers) {
  const serverCal = recomputeDailyCalories(answers);
  const clientCal = answers.daily_calories != null ? Number(answers.daily_calories) : null;
  let dailyCalories = serverCal;
  if (serverCal == null && clientCal != null && Number.isFinite(clientCal)) {
    dailyCalories = Math.round(Math.max(1200, Math.min(6000, clientCal)));
  } else if (serverCal != null && clientCal != null && Number.isFinite(clientCal)) {
    // Allow mild client tweak within ±15% of server computation
    const lo = Math.round(serverCal * 0.85);
    const hi = Math.round(serverCal * 1.15);
    dailyCalories = Math.round(Math.max(lo, Math.min(hi, clientCal)));
  }
  let macros = recomputeMacros(dailyCalories, answers.goal);
  if (
    answers.macros
    && answers.macros.protein != null
    && answers.macros.carbs != null
    && answers.macros.fat != null
  ) {
    macros = {
      protein: Number(answers.macros.protein) || 0,
      carbs: Number(answers.macros.carbs) || 0,
      fat: Number(answers.macros.fat) || 0,
    };
  }
  return { dailyCalories, macros };
}

async function generateUniqueUserCode(clientDB) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let attempts = 0; attempts < 100; attempts++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += letters.charAt(crypto.randomInt(0, letters.length));
    }
    const { data } = await clientDB.from('clients').select('user_code').eq('user_code', code).maybeSingle();
    if (!data) return code;
  }
  throw new Error('Failed to generate unique user code');
}

async function resolveSkipPayment(userId, { clientDB }) {
  if (!userId || !UUID_RE.test(String(userId))) return false;
  try {
    if (clientDB?.auth?.admin?.getUserById) {
      const { data, error } = await clientDB.auth.admin.getUserById(userId);
      if (!error && data?.user) {
        const meta = data.user.user_metadata || {};
        const app = data.user.app_metadata || {};
        if (meta.skip_pricing === true || app.skip_pricing === true) return true;
      }
    }
  } catch (e) {
    console.warn('resolveSkipPayment auth lookup failed:', e?.message || e);
  }
  return false;
}

async function ensureClientAndChatUser(userId, { clientDB, adminDB, email }) {
  const { data: existing, error } = await clientDB
    .from('clients')
    .select('id, user_id, user_code, email, onboarding_completed, subscription_status, subscription_type')
    .eq('user_id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  if (existing?.user_code) {
    if (adminDB) {
      const { data: chat } = await adminDB.from('chat_users').select('id, user_code').eq('user_code', existing.user_code).maybeSingle();
      if (!chat) {
        await adminDB.from('chat_users').insert([{
          user_code: existing.user_code,
          email: existing.email || email || null,
          updated_at: new Date().toISOString(),
        }]);
      }
    }
    return existing;
  }

  const userCode = await generateUniqueUserCode(clientDB);
  const insertRow = {
    user_id: userId,
    user_code: userCode,
    email: email || null,
    status: 'active',
    onboarding_completed: false,
    updated_at: new Date().toISOString(),
  };

  const { data: created, error: insertErr } = await clientDB.from('clients').insert([insertRow]).select().single();
  if (insertErr) throw insertErr;

  if (adminDB) {
    const { error: chatErr } = await adminDB.from('chat_users').insert([{
      user_code: userCode,
      email: email || null,
      updated_at: new Date().toISOString(),
    }]);
    if (chatErr) {
      console.error('ensureClientAndChatUser: chat_users insert failed, compensating clients delete', chatErr);
      await clientDB.from('clients').delete().eq('user_id', userId);
      throw new Error('Failed to create chat_users row');
    }
  }

  return created;
}

function mapAnswersToPayloads(answers = {}, { markOnboardingDone = false } = {}) {
  const age = calculateAgeFromDob(answers.date_of_birth);
  const birthDate = toYYYYMMDD(answers.date_of_birth);
  const phone = normalizePhone(answers.phone, answers.phoneCountryCode || '+972');
  const fullName = `${answers.first_name || ''} ${answers.last_name || ''}`.trim() || null;
  const weightKg = answers.weight_kg != null && answers.weight_kg !== '' ? parseFloat(answers.weight_kg) : null;
  const heightCm = answers.height_cm != null && answers.height_cm !== '' ? parseFloat(answers.height_cm) : null;
  const targetWeight = answers.target_weight != null && answers.target_weight !== '' ? parseFloat(answers.target_weight) : null;
  const { dailyCalories, macros } = clampClientCalories(answers);
  const mealPlanStructure = buildMealPlanStructure({
    ...answers,
    daily_calories: dailyCalories,
    macros,
  });
  const genderForBmr = answers.gender === 'other' ? 'male' : answers.gender;
  const bmr = calculateBMR(age, genderForBmr, weightKg, heightCm);

  const regionValue =
    answers.region === 'other' && answers.region_other
      ? String(answers.region_other).trim()
      : answers.region || null;

  const genderValue =
    answers.gender === 'other' && answers.gender_other
      ? String(answers.gender_other).trim()
      : answers.gender || null;

  const mergeOtherList = (list, otherText) => {
    const arr = Array.isArray(list) ? [...list] : [];
    const filtered = arr.filter((v) => v !== 'other');
    if (arr.includes('other') && otherText && String(otherText).trim()) {
      filtered.push(String(otherText).trim());
    }
    return filtered.length ? filtered : (arr.length ? arr.filter((v) => v !== 'other') : null);
  };

  const foodAllergiesArr = mergeOtherList(answers.food_allergies, answers.allergies_other);
  const foodAllergies = foodAllergiesArr && foodAllergiesArr.length ? foodAllergiesArr.join(', ') : null;
  const foodLimitations = mergeOtherList(answers.food_limitations, answers.limitations_other);

  const clientData = {
    onboarding_completed: false,
    updated_at: new Date().toISOString(),
  };
  if (answers.first_name) clientData.first_name = answers.first_name;
  if (answers.last_name) clientData.last_name = answers.last_name;
  if (fullName) clientData.full_name = fullName;
  if (phone) clientData.phone = phone;
  if (answers.language) clientData.user_language = answers.language;
  if (answers.city) clientData.city = answers.city;
  if (regionValue) clientData.region = regionValue;
  if (answers.timezone) clientData.timezone = answers.timezone;
  if (birthDate) clientData.birth_date = birthDate;
  if (age != null) clientData.age = age;
  if (genderValue) clientData.gender = genderValue;
  if (weightKg != null) clientData.current_weight = weightKg;
  if (targetWeight != null) clientData.target_weight = targetWeight;
  if (heightCm != null) clientData.height = heightCm;
  if (foodAllergies !== null) clientData.food_allergies = foodAllergies;
  if (answers.food_limitations !== undefined) clientData.food_limitations = foodLimitations;
  if (answers.activity_level) clientData.activity_level = answers.activity_level;
  if (answers.goal) clientData.goal = answers.goal;
  if (answers.medical_conditions !== undefined) clientData.medical_conditions = answers.medical_conditions || null;
  if (answers.custom_answers && typeof answers.custom_answers === 'object') {
    clientData.custom_answers = answers.custom_answers;
  }
  if (answers.client_preference) {
    clientData.client_preference = { dietary_preferences: String(answers.client_preference).trim() };
    clientData.dietary_preferences = String(answers.client_preference).trim();
  }

  const chatUserData = {
    language: answers.language || undefined,
    user_language: answers.language || undefined,
    city: answers.city || undefined,
    region: regionValue || undefined,
    timezone: answers.timezone || undefined,
    date_of_birth: birthDate || undefined,
    age: age != null ? age : undefined,
    gender: genderValue || undefined,
    nursing_status: answers.gender === 'female' ? (answers.nursing_status || null) : null,
    weight_kg: weightKg,
    height_cm: heightCm,
    food_allergies: foodAllergies,
    food_limitations: foodLimitations,
    medical_conditions: answers.medical_conditions || null,
    Activity_level: answers.activity_level || undefined,
    goal: answers.goal || undefined,
    first_meal_time: answers.first_meal_time || undefined,
    last_meal_time: answers.last_meal_time || undefined,
    number_of_meals: answers.number_of_meals ? parseInt(answers.number_of_meals, 10) : undefined,
    meal_plan_structure: mealPlanStructure ? sortMealPlanStructure(mealPlanStructure) : undefined,
    daily_target_total_calories: dailyCalories || undefined,
    base_daily_total_calories: bmr != null ? Math.round(bmr) : undefined,
    macros: macros || undefined,
    client_preference: answers.client_preference
      ? { dietary_preferences: String(answers.client_preference).trim() }
      : undefined,
    phone_number: phone || undefined,
    whatsapp_number: phone || undefined,
    full_name: fullName || undefined,
    onboarding_done: Boolean(markOnboardingDone),
    updated_at: new Date().toISOString(),
  };

  if (answers.custom_answers && typeof answers.custom_answers === 'object') {
    chatUserData.custom_answers = answers.custom_answers;
  }
  if (answers.activity_description) {
    chatUserData.user_context = answers.activity_description;
  }

  // Strip undefined keys for cleaner updates
  Object.keys(chatUserData).forEach((k) => {
    if (chatUserData[k] === undefined) delete chatUserData[k];
  });

  return { clientData, chatUserData, phone, fullName };
}

function validateCommitAnswers(answers) {
  const required = ['first_name', 'last_name', 'language'];
  const missing = required.filter((f) => isEmpty(answers?.[f]));
  if (missing.length) {
    return { ok: false, error: `Missing required fields: ${missing.join(', ')}` };
  }
  return { ok: true };
}

async function saveDraft(userId, { draft, phase, stepIndex, email }, { clientDB, adminDB }) {
  const draftStr = JSON.stringify(draft && typeof draft === 'object' ? draft : {});
  if (Buffer.byteLength(draftStr, 'utf8') > MAX_DRAFT_BYTES) {
    const err = new Error('Draft payload too large');
    err.status = 413;
    throw err;
  }

  const client = await ensureClientAndChatUser(userId, { clientDB, adminDB, email });
  const draftPayload = {
    ...(draft && typeof draft === 'object' ? draft : {}),
    stepIndex: typeof stepIndex === 'number' ? stepIndex : draft?.stepIndex,
    phase: phase && VALID_PHASES.has(phase) ? phase : draft?.phase,
    savedAt: new Date().toISOString(),
  };

  const { data, error } = await adminDB
    .from('chat_users')
    .update({
      onboarding_data: JSON.stringify(draftPayload),
      updated_at: new Date().toISOString(),
    })
    .eq('user_code', client.user_code)
    .select('user_code')
    .single();

  if (error) throw error;
  return { ok: true, userCode: data.user_code, savedAt: draftPayload.savedAt };
}

const STEP_FIELD_MAP = {
  language: { clientKeys: ['user_language'], chatKeys: ['language', 'user_language'] },
  name: { clientKeys: ['first_name', 'last_name', 'full_name'], chatKeys: ['full_name'] },
  phone: { clientKeys: ['phone'], chatKeys: ['phone_number', 'whatsapp_number'] },
  city: { clientKeys: ['city', 'region', 'timezone'], chatKeys: ['city', 'region', 'timezone'] },
  dob: { clientKeys: ['birth_date', 'age'], chatKeys: ['date_of_birth', 'age'] },
  gender: { clientKeys: ['gender'], chatKeys: ['gender', 'nursing_status'] },
  biometrics: { clientKeys: ['current_weight', 'height', 'target_weight'], chatKeys: ['weight_kg', 'height_cm'] },
  activity: { clientKeys: ['activity_level'], chatKeys: ['Activity_level', 'user_context'] },
  goal: { clientKeys: ['goal'], chatKeys: ['goal'] },
  dietary: { clientKeys: ['food_allergies', 'food_limitations'], chatKeys: ['food_allergies', 'food_limitations'] },
  preferences: { clientKeys: [], chatKeys: ['client_preference'] },
  eating_window: { clientKeys: [], chatKeys: ['first_meal_time', 'last_meal_time'] },
  calories: { clientKeys: [], chatKeys: ['daily_target_total_calories', 'macros', 'base_daily_total_calories'] },
  meals: { clientKeys: [], chatKeys: ['number_of_meals', 'meal_plan_structure'] },
  medical: { clientKeys: ['medical_conditions'], chatKeys: ['medical_conditions'] },
};

function pickPartialPayload(full, keys) {
  const out = {};
  (keys || []).forEach((k) => {
    if (full[k] !== undefined) out[k] = full[k];
  });
  return out;
}

async function mergeOnboardingDraft(userCode, { answers, stepIndex, phase, draft }, adminDB) {
  if (!adminDB || !userCode) return;

  let existing = {};
  try {
    const { data } = await adminDB
      .from('chat_users')
      .select('onboarding_data')
      .eq('user_code', userCode)
      .maybeSingle();
    if (data?.onboarding_data) {
      existing =
        typeof data.onboarding_data === 'string'
          ? JSON.parse(data.onboarding_data)
          : data.onboarding_data;
    }
  } catch (_) {
    /* ignore invalid json */
  }

  const mergedAnswers = {
    ...(existing.answers || {}),
    ...(draft?.answers && typeof draft.answers === 'object' ? draft.answers : {}),
    ...(answers && typeof answers === 'object' ? answers : {}),
  };

  const payload = {
    ...existing,
    ...(draft && typeof draft === 'object' ? draft : {}),
    answers: mergedAnswers,
    stepIndex: typeof stepIndex === 'number' ? stepIndex : existing.stepIndex,
    phase: phase && VALID_PHASES.has(phase) ? phase : existing.phase || 'questions',
    savedAt: new Date().toISOString(),
  };

  const draftStr = JSON.stringify(payload);
  if (Buffer.byteLength(draftStr, 'utf8') > MAX_DRAFT_BYTES) return;

  await adminDB
    .from('chat_users')
    .update({
      onboarding_data: draftStr,
      updated_at: new Date().toISOString(),
    })
    .eq('user_code', userCode);
}

async function saveStep(userId, { stepId, answers, stepIndex, phase, draft, email }, { clientDB, adminDB }) {
  if (!adminDB) {
    const err = new Error('Chat database not configured');
    err.status = 500;
    throw err;
  }
  if (!stepId) {
    const err = new Error('stepId is required');
    err.status = 400;
    throw err;
  }

  const client = await ensureClientAndChatUser(userId, { clientDB, adminDB, email });
  const userCode = client.user_code;

  if (stepId === 'phone') {
    const localPhone = answers?.phone;
    if (!isDigitsOnlyPhone(localPhone)) {
      const err = new Error('Phone number must contain only digits (7–15)');
      err.status = 400;
      throw err;
    }
    const normalizedPhone = normalizePhone(localPhone, answers?.phoneCountryCode || '+972');
    if (await isPhoneTaken(normalizedPhone, userId, userCode, { clientDB, adminDB })) {
      const err = new Error('This phone number is already registered');
      err.status = 409;
      throw err;
    }
  }

  const { clientData, chatUserData } = mapAnswersToPayloads(answers || {});

  let clientKeys = [];
  let chatKeys = [];
  if (String(stepId).startsWith('custom_')) {
    clientKeys = ['custom_answers'];
    chatKeys = ['custom_answers'];
  } else {
    const map = STEP_FIELD_MAP[stepId];
    if (!map) {
      const err = new Error(`Unknown stepId: ${stepId}`);
      err.status = 400;
      throw err;
    }
    clientKeys = map.clientKeys;
    chatKeys = map.chatKeys;
  }

  const partialClient = {
    ...pickPartialPayload(clientData, clientKeys),
    onboarding_completed: false,
    updated_at: new Date().toISOString(),
  };
  const partialChat = {
    ...pickPartialPayload(chatUserData, chatKeys),
    onboarding_done: false,
    updated_at: new Date().toISOString(),
  };

  const { data: beforeClient } = await clientDB
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const { error: clientErr } = await clientDB
    .from('clients')
    .update(partialClient)
    .eq('user_id', userId);
  if (clientErr) throw clientErr;

  const { data: existingChat } = await adminDB
    .from('chat_users')
    .select('id')
    .eq('user_code', userCode)
    .maybeSingle();

  let chatErr;
  if (existingChat?.id) {
    ({ error: chatErr } = await adminDB.from('chat_users').update(partialChat).eq('id', existingChat.id));
  } else {
    ({ error: chatErr } = await adminDB.from('chat_users').insert([{
      ...partialChat,
      user_code: userCode,
      email: email || client.email || null,
    }]));
  }

  if (chatErr) {
    console.error('saveStep: chat_users write failed, compensating', chatErr);
    if (beforeClient) {
      const { id: _id, ...restore } = beforeClient;
      await clientDB.from('clients').update({
        ...restore,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
    }
    const err = new Error('Failed to sync chat_users; save-step rolled back');
    err.status = 500;
    throw err;
  }

  await mergeOnboardingDraft(userCode, { answers, stepIndex, phase, draft }, adminDB);

  return { ok: true, userCode };
}

async function commitOnboarding(userId, body, { clientDB, adminDB }) {
  if (!adminDB) {
    const err = new Error('Chat database not configured');
    err.status = 500;
    throw err;
  }

  const answers = body?.answers || body || {};
  const skipPayment = await resolveSkipPayment(userId, { clientDB });
  const validation = validateCommitAnswers(answers);
  if (!validation.ok) {
    const err = new Error(validation.error);
    err.status = 400;
    throw err;
  }

  const email = body?.email || null;
  const client = await ensureClientAndChatUser(userId, { clientDB, adminDB, email });
  const userCode = client.user_code;
  if (!userCode) {
    const err = new Error('user_code could not be allocated');
    err.status = 500;
    throw err;
  }

  const { clientData, chatUserData } = mapAnswersToPayloads(answers, { markOnboardingDone: true });

  const { data: existingClient } = await clientDB
    .from('clients')
    .select('subscription_status')
    .eq('user_id', userId)
    .maybeSingle();
  const { data: existingChatStatus } = adminDB
    ? await adminDB.from('chat_users').select('subscription_status').eq('user_code', userCode).maybeSingle()
    : { data: null };

  const subscriptionStatus =
    existingChatStatus?.subscription_status || existingClient?.subscription_status || null;
  const alreadyEntitled = subscriptionStatus === 'active' || skipPayment;

  let phase = 'pwa';
  if (!alreadyEntitled) {
    clientData.subscription_status = 'pending_payment';
    chatUserData.subscription_status = 'pending_payment';
    phase = 'products';
    clientData.onboarding_completed = false;
    chatUserData.onboarding_done = false;
  } else {
    clientData.onboarding_completed = true;
    clientData.subscription_status = 'active';
    chatUserData.subscription_status = chatUserData.subscription_status || 'active';
    chatUserData.onboarding_done = true;
  }

  // Remove onboarding_draft and onboarding_phase since they don't exist on clients
  clientData.user_code = userCode;
  chatUserData.onboarding_data = '';

  const { data: beforeClient } = await clientDB
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: updatedClient, error: clientErr } = await clientDB
    .from('clients')
    .update(clientData)
    .eq('user_id', userId)
    .select('user_code, onboarding_completed, subscription_status')
    .single();

  if (clientErr) throw clientErr;
  if (!updatedClient?.user_code) {
    const err = new Error('Commit failed: user_code missing after clients update');
    err.status = 500;
    throw err;
  }

  const { data: existingChat } = await adminDB
    .from('chat_users')
    .select('id')
    .eq('user_code', userCode)
    .maybeSingle();

  let chatErr;
  if (existingChat?.id) {
    ({ error: chatErr } = await adminDB.from('chat_users').update(chatUserData).eq('id', existingChat.id));
  } else {
    ({ error: chatErr } = await adminDB.from('chat_users').insert([{ ...chatUserData, user_code: userCode }]));
  }

  if (chatErr) {
    console.error('commitOnboarding: chat_users write failed, compensating', chatErr);
    if (beforeClient) {
      const { id: _id, ...restore } = beforeClient;
      await clientDB.from('clients').update({
        ...restore,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
    }
    const err = new Error('Failed to sync chat_users; commit rolled back');
    err.status = 500;
    throw err;
  }

  setImmediate(() => {
    createAndSaveOnboardingMealPlanForUser(userId, userCode, { clientDB, adminDB }).catch((e) => {
      console.warn('⚠️ Async onboarding meal plan failed:', e?.message || e);
    });
  });

  return {
    userCode,
    phase,
    mealPlanQueued: true,
    completed: Boolean(alreadyEntitled),
    subscriptionStatus: alreadyEntitled ? 'active' : 'pending_payment',
  };
}

async function getStatus(userId, { clientDB, adminDB }) {
  const { data: client, error } = await clientDB
    .from('clients')
    .select(
      'first_name, last_name, phone, user_language, region, city, timezone, birth_date, gender, height, current_weight, target_weight, goal, measurement_system, medical_conditions, activity_level, food_allergies, food_limitations, onboarding_completed, user_code, subscription_status, subscription_type, subscription_expires_at, email'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;

  if (!client) {
    return {
      completed: false,
      phase: 'welcome',
      userCode: null,
      subscriptionStatus: null,
      subscriptionType: null,
      draft: null,
      mealPlanReady: false,
      resumeStepHint: 0,
    };
  }

  let chatUser = null;
  let onboardingDraft = null;
  if (adminDB && client.user_code) {
    const { data } = await adminDB
      .from('chat_users')
      .select('subscription_status, subscription_type, first_meal_time, last_meal_time, macros, daily_target_total_calories, nursing_status, user_context, "Activity_level", onboarding_data')
      .eq('user_code', client.user_code)
      .maybeSingle();
    chatUser = data;

    if (data?.onboarding_data) {
      try {
        onboardingDraft = JSON.parse(data.onboarding_data);
      } catch (e) {
        // ignore invalid json
      }
    }
  }

  let mealPlanReady = false;
  if (client.user_code) {
    const { data: plans } = await clientDB
      .from('client_meal_plans')
      .select('id')
      .eq('user_code', client.user_code)
      .eq('active', true)
      .limit(1);
    mealPlanReady = Array.isArray(plans) && plans.length > 0;
  }

  const subscriptionStatus = chatUser?.subscription_status || client.subscription_status || null;
  const subscriptionType = chatUser?.subscription_type || client.subscription_type || null;

  let phase = 'questions';
  if (client.onboarding_completed) phase = 'done';
  else if (subscriptionStatus === 'active') phase = 'done';
  else if (subscriptionStatus === 'pending_payment') {
    const commerce = onboardingDraft?.commerce;
    if (onboardingDraft?.phase === 'payment') phase = 'payment';
    else if (commerce?.appliedPromo?.valid && commerce.appliedPromo.type !== 'bypass') phase = 'payment';
    else if (commerce?.appliedPromo?.valid) phase = 'promo';
    else if (Array.isArray(commerce?.selectedProductIds) && commerce.selectedProductIds.length) phase = 'promo';
    else phase = 'products';
  } else if (onboardingDraft?.phase && VALID_PHASES.has(onboardingDraft.phase)) {
    phase = onboardingDraft.phase;
  } else if (
    onboardingDraft &&
    ((onboardingDraft.answers && Object.keys(onboardingDraft.answers).length > 0) ||
      typeof onboardingDraft.stepIndex === 'number')
  ) {
    phase = 'questions';
  }

  let resumeStepHint = 0;
  if (client.first_name) resumeStepHint = 1;
  if (resumeStepHint >= 1 && client.region && client.birth_date) resumeStepHint = 2;
  if (resumeStepHint >= 2 && client.height != null && client.current_weight != null && client.goal) resumeStepHint = 3;
  if (resumeStepHint >= 3 && chatUser?.user_context) resumeStepHint = 4;
  if (resumeStepHint >= 4 && (client.activity_level || chatUser?.Activity_level)) resumeStepHint = 5;
  if (resumeStepHint >= 5 && (chatUser?.daily_target_total_calories != null || onboardingDraft?.answers?.daily_calories != null)) {
    resumeStepHint = 6;
  }

  return {
    completed: client.onboarding_completed === true || subscriptionStatus === 'active',
    phase,
    userCode: client.user_code || null,
    subscriptionStatus,
    subscriptionType,
    subscriptionExpiresAt: client.subscription_expires_at || null,
    draft: onboardingDraft,
    mealPlanReady,
    resumeStepHint,
    clientSummary: {
      first_name: client.first_name,
      last_name: client.last_name,
      language: client.user_language,
      email: client.email,
    },
  };
}

async function redeemAccessCode(userId, { code }, { clientDB, adminDB }) {
  if (!code || typeof code !== 'string') {
    const err = new Error('Code is required');
    err.status = 400;
    throw err;
  }
  if (!adminDB) {
    const err = new Error('Chat database not configured');
    err.status = 500;
    throw err;
  }

  const client = await ensureClientAndChatUser(userId, { clientDB, adminDB });
  const userCode = client.user_code;
  if (!userCode) {
    const err = new Error('user_code is missing');
    err.status = 500;
    throw err;
  }

  const normalizedCode = code.trim().toUpperCase();
  const nowIso = new Date().toISOString();
  const { data: accessCode, error: codeError } = await adminDB
    .from('onboarding_access_codes')
    .select('*')
    .eq('code', normalizedCode)
    .eq('is_active', true)
    .maybeSingle();

  if (codeError) throw codeError;
  if (!accessCode) {
    const err = new Error('Code is invalid or unavailable');
    err.status = 404;
    throw err;
  }

  const now = new Date(nowIso);
  if (accessCode.valid_from && new Date(accessCode.valid_from) > now) {
    const err = new Error('Code is not active yet');
    err.status = 400;
    throw err;
  }
  if (accessCode.valid_until && new Date(accessCode.valid_until) < now) {
    const err = new Error('Code has expired');
    err.status = 400;
    throw err;
  }

  const usedCount = Number(accessCode.used_count || 0);
  const maxUses = accessCode.max_uses == null ? null : Number(accessCode.max_uses);
  if (maxUses != null && usedCount >= maxUses) {
    const err = new Error('Code usage limit reached');
    err.status = 400;
    throw err;
  }

  const { data: chatUser } = await adminDB.from('chat_users').select('id').eq('user_code', userCode).maybeSingle();
  const codeUpdates = {
    used_count: usedCount + 1,
    last_used_at: nowIso,
    updated_at: nowIso,
  };
  if (chatUser?.id) codeUpdates.last_used_by_user_id = chatUser.id;

  // Optimistic lock: only burn if used_count still matches (and under max)
  let burnQuery = adminDB
    .from('onboarding_access_codes')
    .update(codeUpdates)
    .eq('id', accessCode.id)
    .eq('used_count', usedCount)
    .eq('is_active', true);
  if (maxUses != null) {
    burnQuery = burnQuery.lt('used_count', maxUses);
  }
  const { data: burnedRows, error: updateCodeErr } = await burnQuery.select('id');
  if (updateCodeErr) throw updateCodeErr;
  if (!burnedRows || burnedRows.length === 0) {
    const err = new Error('Code usage limit reached');
    err.status = 409;
    throw err;
  }

  const expires = new Date();
  expires.setMonth(expires.getMonth() + 1);
  const expiresIso = expires.toISOString();

  const entitlement = {
    subscription_type: 'free_tier',
    subscription_status: 'active',
    subscription_expires_at: expiresIso,
    updated_at: nowIso,
  };

  const { error: clientUpErr } = await clientDB
    .from('clients')
    .update({
      ...entitlement,
      onboarding_completed: true,
    })
    .eq('user_id', userId);

  if (clientUpErr) {
    await adminDB
      .from('onboarding_access_codes')
      .update({ used_count: usedCount, updated_at: nowIso })
      .eq('id', accessCode.id)
      .eq('used_count', usedCount + 1);
    throw clientUpErr;
  }

  let chatWriteErr = null;
  if (chatUser?.id) {
    ({ error: chatWriteErr } = await adminDB.from('chat_users').update(entitlement).eq('id', chatUser.id));
  } else {
    ({ error: chatWriteErr } = await adminDB.from('chat_users').insert([{ user_code: userCode, ...entitlement }]));
  }

  if (chatWriteErr) {
    console.error('redeemAccessCode: chat_users write failed after burn', chatWriteErr);
    // Keep entitlement on clients; do not unburn — prefer limiting reuse over losing paid access
  }

  return getStatus(userId, { clientDB, adminDB });
}

/**
 * Mark onboarding complete without collecting answers (development opt-out).
 */
async function optOutOnboarding(userId, { clientDB, adminDB, email } = {}) {
  const client = await ensureClientAndChatUser(userId, { clientDB, adminDB, email });
  const nowIso = new Date().toISOString();

  const { error: clientErr } = await clientDB
    .from('clients')
    .update({
      onboarding_completed: true,
      updated_at: nowIso,
    })
    .eq('user_id', userId);

  if (clientErr) throw clientErr;

  if (adminDB && client?.user_code) {
    const { error: chatErr } = await adminDB
      .from('chat_users')
      .update({
        onboarding_done: true,
        onboarding_data: '',
        updated_at: nowIso,
      })
      .eq('user_code', client.user_code);

    if (chatErr) console.warn('optOutOnboarding: chat_users update failed', chatErr);
  }

  return getStatus(userId, { clientDB, adminDB });
}

/**
 * Mark onboarding complete after paid Stripe subscription (webhook source of truth).
 */
async function completeOnboardingAfterPaidSubscription(userId, { clientDB, adminDB }) {
  if (!userId) return;

  const client = await ensureClientAndChatUser(userId, { clientDB, adminDB });
  const userCode = client.user_code;
  const nowIso = new Date().toISOString();

  const { error: clientErr } = await clientDB
    .from('clients')
    .update({
      onboarding_completed: true,
      updated_at: nowIso,
    })
    .eq('user_id', userId);

  if (clientErr) throw clientErr;

  if (adminDB && userCode) {
    const { error: chatErr } = await adminDB
      .from('chat_users')
      .update({
        onboarding_done: true,
        onboarding_data: '',
        updated_at: nowIso,
      })
      .eq('user_code', userCode);

    if (chatErr) throw chatErr;
  }
}

function parseCompanyConfig(config) {
  if (!config) return {};
  if (typeof config === 'string') {
    try {
      return JSON.parse(config);
    } catch {
      return {};
    }
  }
  return config;
}

function extractRawCustomProducts(companyConfig) {
  const config = parseCompanyConfig(companyConfig);
  const pricing = config?.pricing;
  if (!pricing || typeof pricing !== 'object') return [];

  const candidateLists = [
    pricing.customProducts,
    pricing.products,
    pricing.plans,
    pricing.custom_plans,
  ].filter(Array.isArray);

  return candidateLists.flat();
}

function isPromoEntryActive(entry) {
  return entry?.active !== false;
}

async function fetchCompanies({ adminDB, clientDB, companyId }) {
  const sources = [adminDB, clientDB].filter(Boolean);
  const byId = new Map();
  for (const db of sources) {
    let query = db.from('companies').select('id, name, config');
    if (companyId) query = query.eq('id', companyId);
    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      data.forEach((row) => byId.set(row.id, row));
    } else if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
      console.warn('fetchCompanies:', error.message);
    }
  }
  return [...byId.values()];
}

async function assignClientToCompanyManager(userId, companyId, { clientDB, adminDB }) {
  if (!adminDB || !companyId) return;
  const client = await ensureClientAndChatUser(userId, { clientDB, adminDB });
  if (!client?.user_code) return;
  const { data: manager } = await adminDB
    .from('profiles')
    .select('id')
    .eq('company_id', companyId)
    .eq('role', 'company_manager')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!manager?.id) return;
  await adminDB.from('chat_users').update({ provider_id: manager.id, updated_at: new Date().toISOString() }).eq('user_code', client.user_code);
}

async function resolveUserCompany(userId, { clientDB, adminDB }) {
  if (!adminDB || !userId) return null;

  const { data: client } = await clientDB
    .from('clients')
    .select('user_code')
    .eq('user_id', userId)
    .maybeSingle();
  if (!client?.user_code) return null;

  const { data: chatUser } = await adminDB
    .from('chat_users')
    .select('provider_id')
    .eq('user_code', client.user_code)
    .maybeSingle();
  if (!chatUser?.provider_id) return null;

  const { data: provider } = await adminDB
    .from('profiles')
    .select('company_id')
    .eq('id', chatUser.provider_id)
    .maybeSingle();
  if (!provider?.company_id) return null;

  const rows = await fetchCompanies({ adminDB, clientDB, companyId: provider.company_id });
  const company = rows[0];
  if (!company) return null;

  return {
    companyId: company.id,
    companyName: company.name,
    companyConfig: parseCompanyConfig(company.config),
  };
}

async function initCommerceSession(userId, { email, companyId: hintedCompanyId }, { clientDB, adminDB }) {
  const client = await ensureClientAndChatUser(userId, { clientDB, adminDB, email });
  let company = await resolveUserCompany(userId, { clientDB, adminDB });

  if (!company && hintedCompanyId) {
    const rows = await fetchCompanies({ adminDB, clientDB, companyId: hintedCompanyId });
    const row = rows[0];
    if (row) {
      company = {
        companyId: row.id,
        companyName: row.name,
        companyConfig: parseCompanyConfig(row.config),
      };
    }
  }

  const companyConfig = company?.companyConfig || null;
  const customProducts = extractRawCustomProducts(companyConfig);

  return {
    userCode: client.user_code,
    companyId: company?.companyId || null,
    companyName: company?.companyName || null,
    companyConfig,
    customProducts,
  };
}

async function validateCompanyPromo(userId, { code, companyId, productIds = [] }, { clientDB, adminDB }) {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Code is required' };
  }
  if (!adminDB && !clientDB) {
    const err = new Error('Company database not configured');
    err.status = 500;
    throw err;
  }

  const normalized = code.trim().toUpperCase();
  const companies = await fetchCompanies({ adminDB, clientDB, companyId });
  const selectedIds = Array.isArray(productIds) ? productIds.map(String) : [];

  for (const company of companies) {
    const config = parseCompanyConfig(company.config);
    const pricing = config?.pricing || {};

    const bypass = (pricing.bypassCodes || []).find(
      (entry) => isPromoEntryActive(entry) && String(entry.code || '').toUpperCase() === normalized
    );
    if (bypass) {
      if (bypass.expiresAt && new Date(bypass.expiresAt) < new Date()) {
        continue;
      }
      return {
        valid: true,
        type: 'bypass',
        code: normalized,
        companyId: company.id,
        companyName: company.name,
        companyConfig: config,
        productIds: selectedIds,
      };
    }

    const promo = (pricing.promoCodes || []).find(
      (entry) =>
        isPromoEntryActive(entry) &&
        String(entry.promoCodeText || entry.code || '').toUpperCase() === normalized
    );
    if (promo) {
      const promoProductIds = Array.isArray(promo.productIds) ? promo.productIds.map(String) : [];
      if (promoProductIds.length && selectedIds.length && !selectedIds.some((id) => promoProductIds.includes(id))) {
        return { valid: false, error: 'Code does not apply to selected products' };
      }
      return {
        valid: true,
        type: 'discount',
        code: normalized,
        percentageOff: Number(promo.percentageOff) || 0,
        productIds: promoProductIds,
        stripePromotionCodeId: promo.stripePromotionCodeId || null,
        companyId: company.id,
        companyName: company.name,
        companyConfig: config,
      };
    }
  }

  return { valid: false, error: 'Code is invalid or unavailable' };
}

async function applyBypassPromo(userId, { code, companyId, productIds = [] }, { clientDB, adminDB, email }) {
  const validation = await validateCompanyPromo(userId, { code, companyId, productIds }, { clientDB, adminDB });
  if (!validation.valid || validation.type !== 'bypass') {
    const err = new Error(validation.error || 'Bypass code is invalid');
    err.status = 400;
    throw err;
  }

  const client = await ensureClientAndChatUser(userId, { clientDB, adminDB, email });
  const userCode = client.user_code;
  if (!userCode) {
    const err = new Error('user_code is missing');
    err.status = 500;
    throw err;
  }

  const nowIso = new Date().toISOString();
  const expires = new Date();
  expires.setMonth(expires.getMonth() + 1);
  const entitlement = {
    subscription_type: 'free_tier',
    subscription_status: 'active',
    subscription_expires_at: expires.toISOString(),
    updated_at: nowIso,
  };

  await clientDB.from('clients').update({ ...entitlement, onboarding_completed: false }).eq('user_id', userId);

  const { data: chatUser } = await adminDB.from('chat_users').select('id').eq('user_code', userCode).maybeSingle();
  if (chatUser?.id) {
    await adminDB.from('chat_users').update(entitlement).eq('id', chatUser.id);
  } else {
    await adminDB.from('chat_users').insert([{ user_code: userCode, ...entitlement }]);
  }

  if (validation.companyId) {
    await assignClientToCompanyManager(userId, validation.companyId, { clientDB, adminDB });
  }

  return getStatus(userId, { clientDB, adminDB });
}

module.exports = {
  VALID_PHASES,
  saveDraft,
  saveStep,
  commitOnboarding,
  getStatus,
  redeemAccessCode,
  optOutOnboarding,
  completeOnboardingAfterPaidSubscription,
  ensureClientAndChatUser,
  mapAnswersToPayloads,
  generateUniqueUserCode,
  initCommerceSession,
  validateCompanyPromo,
  applyBypassPromo,
};
