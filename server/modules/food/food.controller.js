const { adminDB } = require('../../config/db');
const { verifyFoodLogOwnership } = require('../../middlewares/auth');
const { INGREDIENT_REPORT_TYPES } = require('../../utils/constants');
const { compressFoodImage, processDepthMap, sanitizePlanMeal, sanitizeFoodText, summarizeBase64Field } = require('../../utils/helpers');
const {
  buildFoodImagePrompt, callFoodVisionLLM, buildFoodTextPrompt, callFoodTextLLM,
  callMacroLookupLLM, callPlanMatchLLM,
  computeMealTotals, computeWeightsFromVisionReport,
  buildFoodAnalysisResponseBody, buildImageAnalysisResponseBody,
} = require('../../services/ai.service');

const ANALYZE_IMAGE_LOG = '[analyze-image]';
function logAnalyzeImage(step, payload) {
  if (payload === undefined) { console.log(`${ANALYZE_IMAGE_LOG} ${step}`); return; }
  console.log(`${ANALYZE_IMAGE_LOG} ${step} ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
}

// ─── Food Logs CRUD ───────────────────────────────────────────────────────────

async function getFoodLogs(req, res) {
  try {
    const { userCode, date } = req.query;
    if (!userCode) return res.status(400).json({ error: 'User code is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    const { data: userData, error: userError } = await adminDB.from('chat_users').select('id').eq('user_code', userCode).maybeSingle();
    if (userError || !userData) return res.status(404).json({ error: 'User not found' });

    let query = adminDB.from('food_logs').select('*').eq('user_id', userData.id).order('log_date', { ascending: false }).order('created_at', { ascending: false });
    if (date) query = query.eq('log_date', date);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error fetching food logs:', error);
    res.status(500).json({ error: error.message });
  }
}

async function createFoodLog(req, res) {
  try {
    const { userCode, foodLogData } = req.body;
    if (!userCode || !foodLogData) return res.status(400).json({ error: 'User code and food log data are required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    const { data: userData, error: userError } = await adminDB.from('chat_users').select('id').eq('user_code', userCode).maybeSingle();
    if (userError || !userData) return res.status(404).json({ error: 'User not found' });

    const insertData = {
      user_id: userData.id,
      meal_label: foodLogData.meal_label || null,
      food_items: foodLogData.food_items || null,
      image_url: foodLogData.image_url || null,
      total_calories: foodLogData.total_calories || null,
      total_protein_g: foodLogData.total_protein_g || null,
      total_carbs_g: foodLogData.total_carbs_g || null,
      total_fat_g: foodLogData.total_fat_g || null,
      log_date: foodLogData.log_date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };

    const { data, error } = await adminDB.from('food_logs').insert([insertData]).select();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error creating food log:', error);
    res.status(500).json({ error: error.message });
  }
}

async function updateFoodLog(req, res) {
  try {
    const { id } = req.params;
    const { foodLogData } = req.body;
    if (!foodLogData) return res.status(400).json({ error: 'Food log data is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    if (!req.userCode || !(await verifyFoodLogOwnership(id, req.userCode))) return res.status(403).json({ error: 'Forbidden' });

    const updateData = { updated_at: new Date().toISOString() };
    const fields = ['meal_label', 'food_items', 'image_url', 'total_calories', 'total_protein_g', 'total_carbs_g', 'total_fat_g', 'log_date', 'created_at', 'updated_at'];
    for (const field of fields) {
      if (foodLogData[field] !== undefined) updateData[field] = foodLogData[field];
    }

    const { data, error } = await adminDB.from('food_logs').update(updateData).eq('id', id).select();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error updating food log:', error);
    res.status(500).json({ error: error.message });
  }
}

async function deleteFoodLog(req, res) {
  try {
    const { id } = req.params;
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    if (!req.userCode || !(await verifyFoodLogOwnership(id, req.userCode))) return res.status(403).json({ error: 'Forbidden' });

    const { data, error } = await adminDB.from('food_logs').delete().eq('id', id).select();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error deleting food log:', error);
    res.status(500).json({ error: error.message });
  }
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────

async function analyzeImage(req, res) {
  const requestId = Date.now().toString(36);
  try {
    const { imageData, mealLabel, userCaption, planMeal, depthData, depthMeta } = req.body || {};

    logAnalyzeImage(`[${requestId}] → request`, {
      rgb: summarizeBase64Field('imageData', imageData),
      lidar: summarizeBase64Field('depthData', depthData),
      depthMeta: depthMeta ?? null,
      mealLabel: mealLabel ?? null,
      userCaption: typeof userCaption === 'string' && userCaption.trim() ? `${userCaption.trim().length} chars` : null,
      planMeal: planMeal ? 'present' : 'absent',
    });

    if (!imageData || typeof imageData !== 'string') {
      return res.status(400).json({ error: 'imageData (base64 string) is required' });
    }

    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const rawBuffer = Buffer.from(base64Data, 'base64');
    if (!rawBuffer.length) return res.status(400).json({ error: 'imageData decoded to an empty buffer' });

    let compressed;
    try {
      compressed = await compressFoodImage(rawBuffer);
    } catch (compressErr) {
      return res.status(400).json({ error: 'Could not decode/compress image', message: compressErr.message });
    }

    let depthMetrics = null;
    if (depthData && typeof depthData === 'string') {
      depthMetrics = await processDepthMap(depthData, depthMeta);
    }

    const cleanPlanMeal = sanitizePlanMeal(planMeal);

    logAnalyzeImage(`[${requestId}] step 1/5`, 'calling vision LLM');
    const prompt = buildFoodImagePrompt(mealLabel, userCaption, depthMetrics);
    const visionReport = await callFoodVisionLLM(compressed, prompt);

    if (!visionReport.is_food || !Array.isArray(visionReport.food_items) || visionReport.food_items.length === 0) {
      return res.status(422).json({ error: 'not_food', message: visionReport.not_food_reason || 'The provided image does not contain food items.' });
    }

    const { weightedItems, anyDepthCalibrated } = computeWeightsFromVisionReport(visionReport, depthMetrics);
    logAnalyzeImage(`[${requestId}] step 2/5 done`, { anyDepthCalibrated });

    logAnalyzeImage(`[${requestId}] step 3/5`, 'calling macro lookup LLM');
    const macroReport = await callMacroLookupLLM(weightedItems);

    const computedTotals = computeMealTotals(weightedItems, macroReport);
    logAnalyzeImage(`[${requestId}] step 4/5 done`, { computedTotals });

    let planMatchReport = null;
    if (cleanPlanMeal) {
      logAnalyzeImage(`[${requestId}] step 5/5`, 'calling plan-match LLM');
      planMatchReport = await callPlanMatchLLM(computedTotals, cleanPlanMeal);
    }

    const responseBody = buildImageAnalysisResponseBody(visionReport, weightedItems, macroReport, planMatchReport, depthMetrics);
    logAnalyzeImage(`[${requestId}] ✓ response`, { itemCount: responseBody.items.length });
    return res.json(responseBody);
  } catch (error) {
    logAnalyzeImage(`[${requestId}] ✗ error`, error.message);
    console.error('❌ Error in POST /api/food-logs/analyze-image:', error);
    return res.status(500).json({ error: 'Failed to analyze food image', message: error.message });
  }
}

async function analyzeText(req, res) {
  try {
    const { text, mealLabel, planMeal } = req.body || {};
    if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text (food description string) is required' });

    const cleanText = sanitizeFoodText(text);
    if (!cleanText) return res.status(400).json({ error: 'text is empty after sanitization' });

    const cleanPlanMeal = sanitizePlanMeal(planMeal);
    const prompt = buildFoodTextPrompt(mealLabel, cleanText, cleanPlanMeal);
    const llmReport = await callFoodTextLLM(prompt);

    if (!llmReport.is_food || !Array.isArray(llmReport.food_items) || llmReport.food_items.length === 0) {
      return res.status(422).json({ error: 'not_food', message: llmReport.not_food_reason || 'The provided text does not describe food items.' });
    }

    return res.json(buildFoodAnalysisResponseBody(llmReport, !!cleanPlanMeal));
  } catch (error) {
    console.error('❌ Error in POST /api/food-logs/analyze-text:', error);
    return res.status(500).json({ error: 'Failed to analyze food text', message: error.message });
  }
}

// ─── Food Database ────────────────────────────────────────────────────────────

async function searchFoods(req, res) {
  try {
    const { query, limit = 20 } = req.query;
    if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Valid search query is required' });
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });

    const cleanQuery = query.trim();
    if (!cleanQuery) return res.json({ data: [] });

    const isHebrewQuery = /[\u0590-\u05FF]/.test(cleanQuery);
    const searchColumn = isHebrewQuery ? 'name' : 'english_name';
    const queryWords = [...new Set(cleanQuery.split(/\s+/).filter(w => w.length > 0))];
    const maxLimit = Math.min(parseInt(limit) || 20, 50);

    let dbQuery = adminDB.from('ingridientsroee').select('id, name, english_name, calories_energy, protein_g, fat_g, carbohydrates_g');
    queryWords.forEach(word => { dbQuery = dbQuery.ilike(searchColumn, `%${word}%`); });

    const { data: rawData, error } = await dbQuery.limit(maxLimit + 10);
    if (error) throw error;
    if (!rawData || rawData.length === 0) return res.json({ data: [] });

    const lowerQuery = cleanQuery.toLowerCase();
    const sortedData = rawData.sort((a, b) => {
      const valA = (isHebrewQuery ? a.name : a.english_name)?.toLowerCase() || '';
      const valB = (isHebrewQuery ? b.name : b.english_name)?.toLowerCase() || '';
      if (valA === lowerQuery) return -1;
      if (valB === lowerQuery) return 1;
      const aStarts = valA.startsWith(lowerQuery);
      const bStarts = valB.startsWith(lowerQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return valA.length - valB.length;
    });

    const transformedData = sortedData.slice(0, maxLimit).map(ingredient => {
      const primaryName = isHebrewQuery ? ingredient.name : ingredient.english_name;
      const secondaryName = isHebrewQuery ? ingredient.english_name : ingredient.name;
      const displayName = primaryName || secondaryName || '';
      return {
        id: ingredient.id,
        name: displayName,
        item: displayName,
        english_name: ingredient.english_name || '',
        calories: Number(ingredient.calories_energy) || 0,
        protein: Number(ingredient.protein_g) || 0,
        fat: Number(ingredient.fat_g) || 0,
        carbs: Number(ingredient.carbohydrates_g) || 0,
        brand: '',
        household_measure: '',
        'portionSI(gram)': 100,
        UPC: null,
      };
    });

    res.json({ data: transformedData });
  } catch (error) {
    console.error('Error searching foods:', error);
    res.status(500).json({ error: 'Internal server error processing search' });
  }
}

async function getFoodById(req, res) {
  try {
    if (!adminDB) return res.status(500).json({ error: 'Chat database not configured' });
    const { data, error } = await adminDB.from('ingridientsroee').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error fetching food by ID:', error);
    res.status(500).json({ error: error.message });
  }
}

async function submitIngredientReport(req, res) {
  try {
    const { foodId, foodSnapshot, reportType, description, userCode } = req.body;
    if (!foodId) return res.status(400).json({ error: 'foodId is required' });
    if (!reportType || !INGREDIENT_REPORT_TYPES.includes(reportType)) return res.status(400).json({ error: 'reportType is required and must be one of: ' + INGREDIENT_REPORT_TYPES.join(', ') });
    if (!adminDB) return res.status(503).json({ error: 'Database not configured for ingredient reports' });

    const { data, error } = await adminDB.from('ingredient_reports').insert([{
      food_id: String(foodId),
      food_snapshot: foodSnapshot || null,
      report_type: reportType,
      description: description && String(description).trim() ? String(description).trim() : null,
      reporter_user_code: userCode && String(userCode).trim() ? String(userCode).trim() : null,
      ip_address: req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown',
      user_agent: req.headers['user-agent'] || 'unknown',
    }]).select('id, created_at');

    if (error) return res.status(500).json({ error: 'Failed to save report' });
    res.status(200).json({ success: true, id: data?.[0]?.id });
  } catch (err) {
    console.error('ingredient-reports error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getFoodLogs, createFoodLog, updateFoodLog, deleteFoodLog,
  analyzeImage, analyzeText,
  searchFoods, getFoodById,
  submitIngredientReport,
};
