const { randomUUID } = require('crypto');
const {
  FOOD_IMAGE_LLM_SCHEMA,
  FOOD_MACRO_LLM_SCHEMA,
  PLAN_MATCH_LLM_SCHEMA,
  FOOD_TEXT_LLM_SCHEMA,
  mealPlanSchema,
  CREATE_MEAL_PLAN_API_URL,
} = require('../utils/constants');
const {
  sanitizeUserCaption,
  sanitizePlanMeal,
  formatPlanMealForPrompt,
  calculateMainTotalsFromMeals,
} = require('../utils/helpers');
const { sortMealPlanMeals, sortMealPlanStructure } = require('../utils/mealStructure');

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildFoodImagePrompt(mealLabel, userCaption, depthMetrics) {
  const cleanCaption = sanitizeUserCaption(userCaption);
  const captionBlock = cleanCaption
    ? `\n* **User description (sent with the photo):** "${cleanCaption}"\n  Treat this as ground truth about the dish identity, ingredients, preparation, or portion when it does not contradict clear visual evidence. Prefer the user's wording for \`name\` and let it refine portion / density estimates.\n`
    : '';

  const meal = mealLabel ? String(mealLabel) : 'unknown';

  let depthBlock = '';
  if (depthMetrics && depthMetrics.volumeReliable && depthMetrics.totalVolumeCm3 != null) {
    depthBlock = `\n**DEPTH SENSOR DATA (LiDAR — calibrated, ±10% accuracy):**
* Total food volume above plate: ~${depthMetrics.totalVolumeCm3} cm³
* Average food height above plate: ~${depthMetrics.avgElevationMm}mm
* Peak food height: ~${depthMetrics.maxElevationMm}mm

Your per-item \`estimated_volume_cm3\` values MUST sum to approximately **${depthMetrics.totalVolumeCm3} cm³**.
Distribute proportionally to each item's visual footprint and relative bulk.\n`;
  } else if (depthMetrics) {
    depthBlock = `\n**DEPTH SENSOR DATA (LiDAR — height guidance only):**
* Average food height above plate: ~${depthMetrics.avgElevationMm}mm
* Peak food height: ~${depthMetrics.maxElevationMm}mm

Use these height values to guide your Z-axis estimates. Do NOT use them as a strict volume budget — estimate each item's volume from visual geometry as usual.\n`;
  }

  return `Act as a Lead Forensic Food Scientist and Computer Vision Specialist. Your task is to identify the food items in the image, estimate their volume and density, and rate the meal's visual quality. You do NOT compute macros or plan adherence — those are handled separately.

**CONTEXTUAL METADATA:**
* **User Meal Time:** ${meal}
${captionBlock}${depthBlock}
**STEP 0 — IMAGE TYPE GATE (execute first, before anything else):**
* Is the image clearly a single dish, multiple food items, a beverage, or a packaged food product?
  - If NO (it is not food at all – e.g. a person, scenery, document, screenshot, or quality is too poor to identify any food) → set \`is_food: false\`, fill \`not_food_reason\` with a short explanation, and set ALL other fields to \`null\`. Skip the rest of the steps.
  - If YES → set \`is_food: true\`, leave \`not_food_reason\` null, and continue to steps 1–5 below.

**WHEN is_food IS TRUE — food photo analysis protocol:**

1.  **IMAGE VALIDATION & CLASSIFICATION:**
    * **Detection:** Food, beverage, or food-adjacent object (packaging)?
    * **Image Quality Check:** Assess blur and lighting. If quality prevents accurate analysis, lower \`confidence\` accordingly.

2.  **GEOMETRIC SCALE & CONTAINER STANDARDIZATION (CRITICAL FOR ACCURACY):**
    * **Anchor Identification:** Identify standard reference objects (dinner fork ≈ 20cm, dinner plate ≈ 25-28cm, standard mug, Starbucks Grande cup, etc.).
    * **Container Geometry:** If food is in a bowl/container, estimate the container's volume first. Is the container full, half-full, or 1/4 full?
    * **Z-Axis Estimation:**${depthMetrics ? ' LiDAR height data has been provided above — prefer the measured height values over shadow-based estimation.' : ' Analyze shadows and layering to estimate height. Piled high (pyramid) or spread flat (cylinder)?'}

3.  **COMPONENT DECOMPOSITION, VOLUME & DENSITY MAPPING (CRITICAL — this is how weight is computed):**
    * Deconstruct the dish into distinct components (Protein, Starch, Veg, Sauce, etc.).
    * **Shape & Dimensions:** Approximate each component's geometric primitive (cylinder, hemisphere, slab, etc.) and its dimensions relative to the Anchor.
    * **For EACH component, output TWO mandatory fields:**
        - \`estimated_volume_cm3\`: the physical volume of the item in cm³. Compute from dimensions: cylinder πr²h, slab l×w×h, etc.${depthMetrics && depthMetrics.volumeReliable && depthMetrics.totalVolumeCm3 != null ? ` All items' volumes MUST sum to ~${depthMetrics.totalVolumeCm3} cm³ (LiDAR measurement).` : ''}
        - \`density_gcm3\`: the bulk density in g/cm³. Reference values:
            * >1.0 g/cm³ — grilled/raw meat & fish (chicken≈1.06, beef≈1.05, salmon≈1.05), hard cheese (≈1.1), hummus (≈1.05), boiled potato (≈0.90), cooked legumes (≈0.85–0.90), cooked rice (≈0.85)
            * 0.6–0.9 g/cm³ — cooked pasta (≈0.70), soft cheese (≈0.95), yogurt (≈1.0), egg (≈1.03)
            * 0.2–0.5 g/cm³ — bread/toast (≈0.25–0.30), pancake (≈0.45), waffle (≈0.40)
            * <0.2 g/cm³  — leafy salad (≈0.08), popcorn (≈0.07), puffed cereal (≈0.10)
            * Liquids/fats — water/broth (≈1.0), olive oil (≈0.92), butter (≈0.91)
    * \`estimated_weight_g\` MUST equal \`estimated_volume_cm3 × density_gcm3\` (rounded to nearest gram). Do not use any other method.
    * **Hidden Calorie & Implicit Ingredient Detection (MANDATORY SEPARATION):**
        * **Explicit Extraction:** If you detect or infer added fats (oil, butter, dressings) or significant sauces, you MUST create a distinct, separate component for them.
        * **Visual Cues (Gloss/Sheen):** If vegetables, pasta, or salads appear shiny, glossy, or have pools of liquid, explicitly add an estimated portion of "Oil", "Butter", or "Dressing".
        * **Culinary Context (Heuristics):** If the dish traditionally relies on oil or fat (e.g., Hummus, Fried Eggs, Roasted Vegetables, Mediterranean Salads), assume standard culinary preparation and add an appropriate baseline amount.
    * **Beverage Handling:**
        - Set \`is_beverage: true\` ONLY for drinks / pourable liquids that people naturally measure in volume. Soups eaten with a spoon, ice cream, yogurt in a bowl, sauces, and dressings are NOT beverages.
        - When \`is_beverage\` is true: fill \`estimated_volume_ml\` from container geometry.
        - When \`is_beverage\` is false: set \`estimated_volume_ml: null\`.

4.  **CONTEXTUAL REASONING:**
    * **Meal Label Logic:** Cross-reference contents with "${meal}".

5.  **OVERALL HEALTH SCORE (always, when is_food is true):**
    * \`overall_health_score\` (0–10): general nutritional quality. 0–3 = poor, 4–6 = mixed, 7–8 = good, 9–10 = excellent.
    * \`overall_health_score_reason\`: 1 short sentence justifying the score.

Keep all string fields short (≤ 1–2 sentences). Numbers must be plain numbers (no units, no ranges). Respond ONLY with a valid JSON object matching the schema. Do not output markdown, explanations, or repetition of steps.`;
}

function buildFoodTextPrompt(mealLabel, foodText, planMeal) {
  const planBlock = formatPlanMealForPrompt(planMeal);
  const hasPlan = !!planBlock;
  const meal = mealLabel ? String(mealLabel) : 'unknown';

  const planStep = hasPlan
    ? `
7.  **MEAL-PLAN ADHERENCE SCORE (a plan meal was supplied — produce real numbers):**
    * Compare the dish against BOTH the MAIN and the ALTERNATIVE variant above. Pick whichever the nutritional profile most resembles.
    * Score 9–10 = excellent macro and calorie match. 7–8 = good with minor deviations. 4–6 = moderate mismatch. 0–3 = complete mismatch.
    * Set \`plan_match_variant\` to \`"main"\`, \`"alternative"\`, or \`"none"\`.
    * \`plan_match_reason\`: 1 short sentence. Focus on macro/calorie comparison.`
    : `
7.  **MEAL-PLAN ADHERENCE SCORE:**
    * No plan meal was supplied. Set \`plan_match_score\`, \`plan_match_reason\`, and \`plan_match_variant\` to \`null\`.`;

  return `Act as a Lead Forensic Food Scientist and Nutrition Description Parser. Classify the user's text as food or not, parse items, estimate portions, and rate the meal.

**CONTEXTUAL METADATA:**
* **User Meal Time:** ${meal}
* **User Food Description (free text — this is the primary input):** "${foodText}"
${planBlock}
**STEP 0 — TEXT GATE (execute first):**
* Does the description clearly refer to one or more foods, beverages, or packaged food products?
  - If NO → set \`is_food: false\`, fill \`not_food_reason\`, set all other fields to \`null\`. Skip the rest.
  - If YES → set \`is_food: true\`, leave \`not_food_reason\` null, continue to steps 1–7.

**WHEN is_food IS TRUE:**

1.  **PARSE FOOD ITEMS** — Identify each distinct food/beverage.

2.  **PORTION ESTIMATION FROM WORDING (CRITICAL):**
    * Use explicit grams/ml/oz/lb/kg when provided.
    * Common defaults: "slice of bread" ≈ 30g, "cup" ≈ 240ml liquid / 150g rice, "glass/mug" ≈ 250ml, "can of soda" ≈ 330ml.
    * Final: set \`estimated_weight_g\`. For beverages: also set \`estimated_volume_ml\`.

3.  **MACRONUTRIENT BASELINES (per 100g only — backend multiplies):** Fill \`macros_per_100g\` per item.

4.  **CONFIDENCE & EVIDENCE:** \`confidence\` 0..1 and \`visual_evidence\` (paraphrasing wording used to estimate weight).

5.  **CONTEXTUAL REASONING:** Cross-reference with meal slot "${meal}".

6.  **OVERALL HEALTH SCORE** (0–10, independent of any meal plan): rate the described meal.
${planStep}

Keep all string fields short (≤ 1–2 sentences). Numbers must be plain numbers. Respond ONLY with a valid JSON object matching the schema.`;
}

function buildMacroLookupPrompt(weightedItems) {
  const itemLines = weightedItems.map((it) => `- ${it.name}`).join('\n');
  return `You are a nutritional database. For each food item listed below, return the standard USDA FoodData Central macros per 100g.
Do NOT guess or hallucinate — use established USDA or equivalent reference values only. Numbers only, no ranges.

**Items:**
${itemLines}

Return ONLY a valid JSON object matching the schema. No markdown, no explanations.`;
}

function buildPlanMatchPrompt(computedTotals, planMeal) {
  const planBlock = formatPlanMealForPrompt(planMeal);
  return `You are a nutrition coach. A user has just eaten a meal. The backend calculated their actual intake:
- Calories: ${computedTotals.calories} kcal
- Protein:  ${computedTotals.protein_g}g
- Carbs:    ${computedTotals.carbs_g}g
- Fat:      ${computedTotals.fat_g}g

${planBlock}
Compare the actual intake against BOTH the MAIN and ALTERNATIVE plan variants above. Pick whichever the actual numbers resemble most and score adherence:
- \`plan_match_score\` (0–10): 9–10 excellent, 7–8 good, 4–6 moderate mismatch, 0–3 complete mismatch.
- \`plan_match_reason\`: 1 short sentence. Focus on how the macro/calorie numbers compare.
- \`plan_match_variant\`: "main", "alternative", or "none" (use "none" only for 0–3 scores).

Return ONLY a valid JSON object matching the schema. No markdown, no explanations.`;
}

// ─── LLM callers ─────────────────────────────────────────────────────────────

async function callFoodVisionLLM(compressedJpegBuffer, prompt) {
  const apiBase = (process.env.DEEPSEEK_ENDPOINT || '').replace(/\/$/, '');
  const apiKey  = process.env.DEEPSEEK_API_KEY;
  const model   = process.env.DEEPSEEK_DEPLOYMENT;

  if (!apiBase || !apiKey || !model) {
    throw new Error('Vision LLM is not configured on the server (DEEPSEEK_ENDPOINT / DEEPSEEK_API_KEY / DEEPSEEK_DEPLOYMENT).');
  }

  const url    = `${apiBase}/chat/completions`;
  const dataUrl = `data:image/jpeg;base64,${compressedJpegBuffer.toString('base64')}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: 4000,
      reasoning_effort: 'medium',
      response_format: { type: 'json_schema', json_schema: FOOD_IMAGE_LLM_SCHEMA },
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vision LLM call failed (${response.status}): ${errText}`);
  }

  const data    = await response.json();
  const choice  = data.choices?.[0];
  const content = choice?.message?.content;
  if (!content) {
    throw new Error(`Empty content from vision LLM (finish_reason=${choice?.finish_reason}, usage=${JSON.stringify(data.usage)}).`);
  }

  try { return JSON.parse(content); } catch (e) { throw new Error(`Failed to parse vision LLM JSON: ${e.message}`); }
}

async function callFoodTextLLM(prompt) {
  const apiBase = (process.env.DEEPSEEK_ENDPOINT || '').replace(/\/$/, '');
  const apiKey  = process.env.DEEPSEEK_API_KEY;
  const model   = process.env.DEEPSEEK_TEXT_DEPLOYMENT || 'gpt-4o';

  if (!apiBase || !apiKey) {
    throw new Error('Text LLM is not configured on the server (DEEPSEEK_ENDPOINT / DEEPSEEK_API_KEY).');
  }

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey, 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_completion_tokens: 2000,
      temperature: 0.2,
      response_format: { type: 'json_schema', json_schema: FOOD_TEXT_LLM_SCHEMA },
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Text LLM call failed (${response.status}): ${errText}`);
  }

  const data    = await response.json();
  const choice  = data.choices?.[0];
  const content = choice?.message?.content;
  if (!content) throw new Error(`Empty content from text LLM (finish_reason=${choice?.finish_reason}).`);
  try { return JSON.parse(content); } catch (e) { throw new Error(`Failed to parse text LLM JSON: ${e.message}`); }
}

async function callMacroLookupLLM(weightedItems) {
  const apiBase = (process.env.DEEPSEEK_ENDPOINT || '').replace(/\/$/, '');
  const apiKey  = process.env.DEEPSEEK_API_KEY;
  const model   = process.env.DEEPSEEK_TEXT_DEPLOYMENT || 'gpt-4o';

  if (!apiBase || !apiKey) throw new Error('Macro LLM is not configured (DEEPSEEK_ENDPOINT / DEEPSEEK_API_KEY).');

  const prompt = buildMacroLookupPrompt(weightedItems);
  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey, 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_completion_tokens: 1500,
      temperature: 0.1,
      response_format: { type: 'json_schema', json_schema: FOOD_MACRO_LLM_SCHEMA },
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Macro LLM call failed (${response.status}): ${errText}`);
  }

  const data    = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Empty content from macro LLM.`);
  try { return JSON.parse(content); } catch (e) { throw new Error(`Failed to parse macro LLM JSON: ${e.message}`); }
}

async function callPlanMatchLLM(computedTotals, planMeal) {
  const apiBase = (process.env.DEEPSEEK_ENDPOINT || '').replace(/\/$/, '');
  const apiKey  = process.env.DEEPSEEK_API_KEY;
  const model   = process.env.DEEPSEEK_TEXT_DEPLOYMENT || 'gpt-4o';

  if (!apiBase || !apiKey) throw new Error('Plan match LLM is not configured (DEEPSEEK_ENDPOINT / DEEPSEEK_API_KEY).');

  const prompt = buildPlanMatchPrompt(computedTotals, planMeal);
  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey, 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_completion_tokens: 200,
      temperature: 0.1,
      response_format: { type: 'json_schema', json_schema: PLAN_MATCH_LLM_SCHEMA },
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Plan match LLM call failed (${response.status}): ${errText}`);
  }

  const data    = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Empty content from plan match LLM.`);
  try { return JSON.parse(content); } catch (e) { throw new Error(`Failed to parse plan match LLM JSON: ${e.message}`); }
}

// ─── Weight / response builders ───────────────────────────────────────────────

function computeMealTotals(weightedItems, macroReport) {
  const macroByName = new Map();
  for (const entry of (macroReport?.items || [])) {
    if (entry.name) macroByName.set(entry.name.toLowerCase(), entry.macros_per_100g || {});
  }

  let calories = 0, protein_g = 0, carbs_g = 0, fat_g = 0;
  for (const wi of weightedItems) {
    const per100 = macroByName.get((wi.name || '').toLowerCase()) || {};
    const m = wi.grams / 100;
    calories  += (Number(per100.calories_per_100g) || 0) * m;
    protein_g += (Number(per100.protein_per_100g)  || 0) * m;
    carbs_g   += (Number(per100.carbs_per_100g)    || 0) * m;
    fat_g     += (Number(per100.fat_per_100g)      || 0) * m;
  }

  return { calories: Math.round(calories), protein_g: Math.round(protein_g), carbs_g: Math.round(carbs_g), fat_g: Math.round(fat_g) };
}

function computeWeightsFromVisionReport(visionReport, depthMetrics) {
  let anyDepthCalibrated = false;

  const weightedItems = (visionReport.food_items || []).map((item) => {
    const volCm3      = Number(item.estimated_volume_cm3);
    const densityGcm3 = Number(item.density_gcm3);
    const hasDepthFields = Number.isFinite(volCm3) && volCm3 > 0 && Number.isFinite(densityGcm3) && densityGcm3 > 0;
    const useDepthVolume = depthMetrics && hasDepthFields && depthMetrics.volumeReliable !== false;

    let grams;
    if (useDepthVolume) {
      grams = Math.max(0, volCm3 * densityGcm3);
      anyDepthCalibrated = true;
    } else {
      grams = Math.max(0, Number(item.estimated_weight_g) || 0);
    }

    const isBeverage = item.is_beverage === true;
    const mlNum      = Number(item.estimated_volume_ml);

    return {
      name:                item.name,
      grams,
      is_beverage:         isBeverage,
      estimated_volume_ml: (isBeverage && Number.isFinite(mlNum) && mlNum > 0) ? mlNum : null,
      confidence:          typeof item.confidence === 'number' ? item.confidence : null,
      visual_evidence:     item.visual_evidence || null,
      depth_calibrated:    useDepthVolume,
    };
  });

  return { weightedItems, anyDepthCalibrated };
}

function buildFoodAnalysisResponseBody(llmReport, hasPlan, depthMetrics) {
  let anyDepthCalibrated = false;

  const items = (llmReport.food_items || []).map((item) => {
    const volCm3      = Number(item.estimated_volume_cm3);
    const densityGcm3 = Number(item.density_gcm3);
    const hasDepthFields = Number.isFinite(volCm3) && volCm3 > 0 && Number.isFinite(densityGcm3) && densityGcm3 > 0;

    let grams;
    if (depthMetrics && hasDepthFields) {
      grams = Math.max(0, volCm3 * densityGcm3);
      anyDepthCalibrated = true;
    } else {
      grams = Math.max(0, Number(item.estimated_weight_g) || 0);
    }

    const per100    = item.macros_per_100g || {};
    const m         = grams / 100;
    const calories  = Math.round((Number(per100.calories_per_100g) || 0) * m);
    const protein_g = Math.round((Number(per100.protein_per_100g) || 0) * m);
    const carbs_g   = Math.round((Number(per100.carbs_per_100g)   || 0) * m);
    const fat_g     = Math.round((Number(per100.fat_per_100g)     || 0) * m);

    const isBeverage = item.is_beverage === true;
    const mlNum = Number(item.estimated_volume_ml);
    const hasMl = isBeverage && Number.isFinite(mlNum) && mlNum > 0;
    const portion_estimate = hasMl ? `${Math.round(mlNum)}ml` : `${Math.round(grams)}g`;

    return { name: item.name, macros: { fat_g, carbs_g, calories, protein_g }, confidence: typeof item.confidence === 'number' ? item.confidence : null, visual_evidence: item.visual_evidence || null, portion_estimate };
  });

  const clampScore = (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    return Math.max(0, Math.min(10, Math.round(v * 10) / 10));
  };

  const overall_health_score        = clampScore(llmReport.overall_health_score);
  const overall_health_score_reason = typeof llmReport.overall_health_score_reason === 'string' ? llmReport.overall_health_score_reason : null;

  let plan_match = null;
  if (hasPlan) {
    const variantRaw = typeof llmReport.plan_match_variant === 'string' ? llmReport.plan_match_variant.toLowerCase() : null;
    const variant = (variantRaw === 'main' || variantRaw === 'alternative' || variantRaw === 'none') ? variantRaw : null;
    plan_match = { score: clampScore(llmReport.plan_match_score), reason: typeof llmReport.plan_match_reason === 'string' ? llmReport.plan_match_reason : null, variant };
  }

  return { items, overall_health_score, overall_health_score_reason, plan_match, depth_enhanced: anyDepthCalibrated };
}

function buildImageAnalysisResponseBody(visionReport, weightedItems, macroReport, planMatchReport, depthMetrics) {
  const clampScore = (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    return Math.max(0, Math.min(10, Math.round(v * 10) / 10));
  };

  const macroByName = new Map();
  for (const entry of (macroReport?.items || [])) {
    if (entry.name) macroByName.set(entry.name.toLowerCase(), entry.macros_per_100g || {});
  }

  let anyDepthCalibrated = false;

  const items = weightedItems.map((wi) => {
    const grams  = wi.grams;
    const per100 = macroByName.get((wi.name || '').toLowerCase()) || {};
    const m      = grams / 100;

    const calories  = Math.round((Number(per100.calories_per_100g) || 0) * m);
    const protein_g = Math.round((Number(per100.protein_per_100g)  || 0) * m);
    const carbs_g   = Math.round((Number(per100.carbs_per_100g)    || 0) * m);
    const fat_g     = Math.round((Number(per100.fat_per_100g)      || 0) * m);

    if (wi.depth_calibrated) anyDepthCalibrated = true;

    const hasMl = wi.is_beverage && wi.estimated_volume_ml != null && wi.estimated_volume_ml > 0;
    const portion_estimate = hasMl ? `${Math.round(wi.estimated_volume_ml)}ml` : `${Math.round(grams)}g`;

    return { name: wi.name, macros: { fat_g, carbs_g, calories, protein_g }, confidence: wi.confidence, visual_evidence: wi.visual_evidence, portion_estimate };
  });

  const overall_health_score        = clampScore(visionReport.overall_health_score);
  const overall_health_score_reason = typeof visionReport.overall_health_score_reason === 'string' ? visionReport.overall_health_score_reason : null;

  let plan_match = null;
  if (planMatchReport) {
    const variantRaw = typeof planMatchReport.plan_match_variant === 'string' ? planMatchReport.plan_match_variant.toLowerCase() : null;
    const variant = (variantRaw === 'main' || variantRaw === 'alternative' || variantRaw === 'none') ? variantRaw : null;
    plan_match = { score: clampScore(planMatchReport.plan_match_score), reason: typeof planMatchReport.plan_match_reason === 'string' ? planMatchReport.plan_match_reason : null, variant };
  }

  return { items, overall_health_score, overall_health_score_reason, plan_match, depth_enhanced: anyDepthCalibrated };
}

// ─── Meal plan generation ─────────────────────────────────────────────────────

async function generateUpdatedMealPlan(currentMealPlanStr, userRequestStr, userProfileObj) {
  const apiBase    = (process.env.AZURE_OPENAI_API_BASE || '').replace(/\/$/, '');
  const apiKey     = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!apiBase || !apiKey || !deployment) {
    throw new Error('Azure OpenAI is not configured on the server');
  }

  const systemPrompt = `
You are an expert clinical dietitian and precise data processor. Your job is to modify an existing meal plan based on a user's request while strictly maintaining nutritional balance, adhering to the User Profile, and conforming to the required schema.

RULES & GUARDRAILS:
1. USER PROFILE ADHERENCE: Strictly enforce all dietary restrictions, allergies, and preferences listed in the provided USER PROFILE. If a user's modification request violates their own profile, intelligently substitute the request with a safe, profile-compliant alternative that mimics the desired flavor profile or texture.
2. NUTRITIONAL REASONABLENESS: Adapt the user's request into a healthy, balanced meal that fits their macros.
3. MACRO & CALORIE REDISTRIBUTION: If one meal is reduced or increased, redistribute the exact macro/calorie delta across the other meals so that the full-day totals remain balanced. Adjust ingredient portions (in grams) across affected meals.
4. BRAND HANDLING: If the user explicitly requests a specific brand, place that exact brand name in the "brand of pruduct" field. For generic items, leave "brand of pruduct" as "". Always set UPC to null for generated items.
5. DATA ACCURACY: For any new ingredients added, provide realistic, mathematically accurate estimations for macros, calories, and standard household measures based on the calculated portion size in grams.
6. DAILY TOTAL INTEGRITY: Keep the daily totals as close as possible to the original daily totals (target ±100 kcal and ±10% per macro for the day)
`;

  const userPrompt = `
USER PROFILE:
${JSON.stringify(userProfileObj)}

CURRENT MEAL PLAN:
${currentMealPlanStr}

USER MODIFICATION REQUEST:
"${userRequestStr}"

INSTRUCTIONS:
Update the CURRENT MEAL PLAN to accommodate the USER MODIFICATION REQUEST. Ensure all changes strictly comply with the USER PROFILE. If a specific meal is changed in calories/macros, rebalance the removed/added calories and macros across the remaining meals by adjusting ingredient portions. Recalculate the totals.
`;

  const url = `${apiBase}/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      response_format: { type: 'json_schema', json_schema: { name: 'updated_meal_plan', strict: true, schema: mealPlanSchema } },
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Azure OpenAI meal-plan update failed (${response.status}): ${errText}`);
  }

  const data    = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Azure OpenAI returned empty content for meal-plan update');

  try { return JSON.parse(content); } catch (e) { throw new Error(`Failed to parse Azure OpenAI meal-plan JSON: ${e.message}`); }
}

async function createAndSaveOnboardingMealPlanForUser(userId, fallbackUserCode, { clientDB, adminDB }) {
  try {
    if (!adminDB) {
      console.warn('⚠️ Skipping async meal plan generation: chat database is not configured');
      return;
    }

    let resolvedUserCode = fallbackUserCode || null;
    let clientName = 'Client';

    if (userId) {
      const { data: clientRecord, error: clientError } = await clientDB
        .from('clients')
        .select('user_code, full_name, first_name, last_name')
        .eq('user_id', userId)
        .maybeSingle();

      if (clientError && clientError.code !== 'PGRST116') throw clientError;
      if (clientRecord?.user_code) resolvedUserCode = clientRecord.user_code;
      if (clientRecord?.full_name) {
        clientName = clientRecord.full_name;
      } else {
        clientName = `${clientRecord?.first_name || ''} ${clientRecord?.last_name || ''}`.trim() || clientName;
      }
    }

    if (!resolvedUserCode) {
      console.warn('⚠️ Skipping async meal plan generation: user_code is missing for user_id:', userId);
      return;
    }

    const { data: chatUserData, error: chatUserError } = await adminDB
      .from('chat_users')
      .select('daily_target_total_calories, macros, user_language, language, full_name, meal_plan_structure')
      .eq('user_code', resolvedUserCode)
      .maybeSingle();

    if (chatUserError && chatUserError.code !== 'PGRST116') throw chatUserError;
    if (chatUserData?.full_name) clientName = chatUserData.full_name;

    const dailyCalories = Number(chatUserData?.daily_target_total_calories || 0);
    const macros        = chatUserData?.macros || null;
    const userLanguage  = chatUserData?.user_language || chatUserData?.language || 'english';

    if (!dailyCalories) {
      console.warn('⚠️ Skipping async meal plan generation: missing daily_target_total_calories for user_code:', resolvedUserCode);
      return;
    }

    const { data: existingPlans, error: existingPlansError } = await clientDB
      .from('client_meal_plans')
      .select('id')
      .eq('user_code', resolvedUserCode)
      .eq('active', true)
      .limit(1);

    if (existingPlansError) throw existingPlansError;
    if (existingPlans && existingPlans.length > 0) {
      console.log('ℹ️ Active meal plan already exists, skipping for user_code:', resolvedUserCode);
      return;
    }

    console.log('🧠 Generating onboarding meal plan asynchronously for user_code:', resolvedUserCode);
    const createRes = await fetch(CREATE_MEAL_PLAN_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_code: resolvedUserCode }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => '');
      throw new Error(`Create meal plan API error (${createRes.status}): ${errText}`);
    }

    const raw = await createRes.json();
    if (raw?.error) throw new Error(typeof raw.error === 'string' ? raw.error : JSON.stringify(raw.error));

    const payload = raw?.data ?? raw?.result ?? raw;
    const menu =
      payload?.menu ??
      payload?.meals ??
      payload?.meal_plan?.meals ??
      (Array.isArray(payload?.meal_plan) ? payload.meal_plan : null);

    if (!Array.isArray(menu) || menu.length === 0) throw new Error('No meals were created by meal plan builder');

    const template = payload?.template ?? payload?.schema ?? payload?.meal_plan?.template ?? null;
    const sortedMenu = sortMealPlanMeals(menu);
    let schema = template;
    if (!schema && Array.isArray(chatUserData?.meal_plan_structure) && chatUserData.meal_plan_structure.length > 0) {
      schema = sortMealPlanStructure(chatUserData.meal_plan_structure);
    } else if (Array.isArray(schema)) {
      schema = sortMealPlanStructure(schema);
    }
    const menuData = {
      meals: sortedMenu,
      totals: payload?.totals ?? payload?.meal_plan?.totals ?? calculateMainTotalsFromMeals(sortedMenu),
      note: payload?.note ?? payload?.meal_plan?.note ?? '',
    };

    const planId         = randomUUID();
    const now            = new Date().toISOString();
    const mealPlanName   = `${clientName || 'Client'}'s Meal Plan`;

    const { error: secondaryError } = await adminDB.from('meal_plans_and_schemas').insert({
      id: planId, record_type: 'meal_plan', user_code: resolvedUserCode,
      meal_plan_name: mealPlanName, schema, meal_plan: menuData,
      status: 'active', daily_total_calories: dailyCalories, macros_target: macros,
      active_from: now, created_at: now, updated_at: now,
    });
    if (secondaryError) throw secondaryError;

    const { error: mainError } = await clientDB.from('client_meal_plans').insert({
      id: planId, user_code: resolvedUserCode, original_meal_plan_id: planId,
      meal_plan_name: mealPlanName, dietitian_meal_plan: menuData,
      active: true, daily_total_calories: dailyCalories, macros_target: macros,
      created_at: now, updated_at: now,
    });

    if (mainError) {
      await adminDB.from('meal_plans_and_schemas').delete().eq('id', planId);
      throw mainError;
    }

    console.log('✅ Async onboarding meal plan generated for user_code:', resolvedUserCode, 'language:', userLanguage);
  } catch (error) {
    console.error('❌ Async onboarding meal plan generation failed:', error.message);
  }
}

module.exports = {
  buildFoodImagePrompt,
  callFoodVisionLLM,
  buildFoodTextPrompt,
  callFoodTextLLM,
  buildMacroLookupPrompt,
  callMacroLookupLLM,
  buildPlanMatchPrompt,
  callPlanMatchLLM,
  computeMealTotals,
  computeWeightsFromVisionReport,
  buildFoodAnalysisResponseBody,
  buildImageAnalysisResponseBody,
  generateUpdatedMealPlan,
  createAndSaveOnboardingMealPlanForUser,
};
