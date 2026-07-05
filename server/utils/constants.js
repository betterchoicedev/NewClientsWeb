// ─── Stripe Product / Price IDs ───────────────────────────────────────────────
const DIGITAL_ONLY_PRODUCT_ID = 'prod_TrcVkwBC0wmqKp';
const DIGITAL_ONLY_PRICE_ID   = 'price_1SyHX0HIeYfvCylDZyb1Lb3L';
const DIGITAL_ONLY_BASE_AMOUNT_USD = 48;

// ─── External API URLs ────────────────────────────────────────────────────────
const CREATE_MEAL_PLAN_API_URL = 'https://meal-plan-builder-615263253386.europe-west3.run.app/api/create-meal-plan';
const BOI_EXCHANGE_RATES_URL   = 'https://boi.org.il/PublicApi/GetExchangeRates?asXml=false';

// ─── Health ingest ────────────────────────────────────────────────────────────
const HEALTH_MAX_EVENTS_PER_REQUEST = 500;

// ─── Ingredient report types ──────────────────────────────────────────────────
const INGREDIENT_REPORT_TYPES = ['misinformation', 'incorrect_values', 'wrong_name', 'wrong_portion', 'other'];

// ─── Meal-plan JSON schemas (used for Azure OpenAI structured output) ─────────
const nutritionSchema = {
  type: 'object',
  properties: {
    fat:      { type: 'number' },
    carbs:    { type: 'number' },
    protein:  { type: 'number' },
    calories: { type: 'number' }
  },
  required: ['fat', 'carbs', 'protein', 'calories'],
  additionalProperties: false
};

const ingredientSchema = {
  type: 'object',
  properties: {
    UPC:                 { type: ['string', 'null'] },
    fat:                 { type: 'number' },
    item:                { type: 'string' },
    carbs:               { type: 'number' },
    protein:             { type: 'number' },
    calories:            { type: 'number' },
    'portionSI(gram)':   { type: 'number' },
    'brand of pruduct':  { type: 'string' },
    household_measure:   { type: 'string' }
  },
  required: [
    'UPC', 'fat', 'item', 'carbs', 'protein', 'calories',
    'portionSI(gram)', 'brand of pruduct', 'household_measure'
  ],
  additionalProperties: false
};

const mealDetailsSchema = {
  type: 'object',
  properties: {
    meal_name:          { type: 'string' },
    nutrition:          nutritionSchema,
    meal_title:         { type: 'string' },
    ingredients:        { type: 'array', items: ingredientSchema },
    main_protein_source:{ type: 'string' }
  },
  required: ['meal_name', 'nutrition', 'meal_title', 'ingredients', 'main_protein_source'],
  additionalProperties: false
};

const mealOptionSchema = {
  type: 'object',
  properties: {
    main:        mealDetailsSchema,
    meal:        { type: 'string' },
    alternative: mealDetailsSchema
  },
  required: ['main', 'meal', 'alternative'],
  additionalProperties: false
};

const mealPlanSchema = {
  type: 'object',
  properties: {
    note:   { type: 'string' },
    meals:  { type: 'array', items: mealOptionSchema },
    totals: nutritionSchema
  },
  required: ['note', 'meals', 'totals'],
  additionalProperties: false
};

// ─── Food analysis LLM schemas ────────────────────────────────────────────────
const FOOD_IMAGE_LLM_SCHEMA = {
  name: 'food_image_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      is_food: {
        type: 'boolean',
        description: 'True only when the image clearly contains food, beverages or a packaged food product that can be quantified.'
      },
      not_food_reason: {
        type: ['string', 'null'],
        description: 'Short reason when is_food is false. null when is_food is true.'
      },
      meal_label:   { type: ['string', 'null'] },
      info_message: { type: ['string', 'null'] },
      dietary_warnings: {
        type: ['array', 'null'],
        items: { type: 'string' }
      },
      food_items: {
        type: ['array', 'null'],
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name:           { type: 'string' },
            visual_evidence: {
              type: 'string',
              description: 'Short justification: cues used to identify the item and infer its weight & density (1-2 sentences max).'
            },
            estimated_weight_g: { type: 'number' },
            is_beverage: {
              type: 'boolean',
              description: 'True for drinks / liquids people normally measure in volume. False for solid food.'
            },
            estimated_volume_ml: {
              type: ['number', 'null'],
              description: 'Volume in milliliters. MUST be filled when is_beverage is true. MUST be null when is_beverage is false.'
            },
            estimated_volume_cm3: {
              type: 'number',
              description: 'Estimated volume of this food item in cm³ from shape/geometry analysis.'
            },
            density_gcm3: {
              type: 'number',
              description: 'Bulk density of this food in g/cm³.'
            },
            confidence: { type: 'number', description: '0..1 confidence in identification + portion estimate.' }
          },
          required: ['name', 'visual_evidence', 'estimated_volume_cm3', 'density_gcm3', 'estimated_weight_g', 'is_beverage', 'estimated_volume_ml', 'confidence']
        }
      },
      overall_health_score: {
        type: ['number', 'null'],
        description: '0-10 general nutritional quality of the meal in the photo. Null when is_food is false.'
      },
      overall_health_score_reason: {
        type: ['string', 'null'],
        description: 'Short (1 sentence) justification for overall_health_score. Null when is_food is false.'
      }
    },
    required: [
      'is_food', 'not_food_reason', 'meal_label', 'info_message', 'dietary_warnings', 'food_items',
      'overall_health_score', 'overall_health_score_reason'
    ]
  }
};

const FOOD_MACRO_LLM_SCHEMA = {
  name: 'food_macro_lookup',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            macros_per_100g: {
              type: 'object',
              additionalProperties: false,
              properties: {
                calories_per_100g: { type: 'number' },
                protein_per_100g:  { type: 'number' },
                carbs_per_100g:    { type: 'number' },
                fat_per_100g:      { type: 'number' }
              },
              required: ['calories_per_100g', 'protein_per_100g', 'carbs_per_100g', 'fat_per_100g']
            }
          },
          required: ['name', 'macros_per_100g']
        }
      }
    },
    required: ['items']
  }
};

const PLAN_MATCH_LLM_SCHEMA = {
  name: 'plan_match_scoring',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      plan_match_score:   { type: 'number',          description: '0–10 adherence score.' },
      plan_match_reason:  { type: 'string',          description: '1-sentence justification.' },
      plan_match_variant: { type: 'string',          description: '"main", "alternative", or "none".' }
    },
    required: ['plan_match_score', 'plan_match_reason', 'plan_match_variant']
  }
};

const FOOD_TEXT_LLM_SCHEMA = {
  name: 'food_text_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      is_food: {
        type: 'boolean',
        description: 'True only when the text clearly describes food, beverages, or a packaged food product that can be quantified.'
      },
      not_food_reason:      { type: ['string', 'null'] },
      meal_label:           { type: ['string', 'null'] },
      info_message:         { type: ['string', 'null'] },
      dietary_warnings:     { type: ['array', 'null'], items: { type: 'string' } },
      food_items: {
        type: ['array', 'null'],
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name:                { type: 'string' },
            visual_evidence:     { type: 'string' },
            estimated_weight_g:  { type: 'number' },
            is_beverage: {
              type: 'boolean',
              description: 'True for drinks / liquids people normally measure in volume. False for solid food.'
            },
            estimated_volume_ml: { type: ['number', 'null'] },
            confidence:          { type: 'number', description: '0..1 confidence.' },
            macros_per_100g: {
              type: 'object',
              additionalProperties: false,
              properties: {
                calories_per_100g: { type: 'number' },
                protein_per_100g:  { type: 'number' },
                carbs_per_100g:    { type: 'number' },
                fat_per_100g:      { type: 'number' }
              },
              required: ['calories_per_100g', 'protein_per_100g', 'carbs_per_100g', 'fat_per_100g']
            }
          },
          required: ['name', 'visual_evidence', 'estimated_weight_g', 'is_beverage', 'estimated_volume_ml', 'confidence', 'macros_per_100g']
        }
      },
      overall_health_score:        { type: ['number', 'null'] },
      overall_health_score_reason: { type: ['string', 'null'] },
      plan_match_score:    { type: ['number', 'null'] },
      plan_match_reason:   { type: ['string', 'null'] },
      plan_match_variant:  { type: ['string', 'null'] }
    },
    required: [
      'is_food', 'not_food_reason', 'meal_label', 'info_message', 'dietary_warnings', 'food_items',
      'overall_health_score', 'overall_health_score_reason',
      'plan_match_score', 'plan_match_reason', 'plan_match_variant'
    ]
  }
};

// ─── LLM prompt limits ────────────────────────────────────────────────────────
const MAX_USER_CAPTION_LENGTH = 500;
const MAX_FOOD_TEXT_LENGTH    = 1500;

module.exports = {
  DIGITAL_ONLY_PRODUCT_ID,
  DIGITAL_ONLY_PRICE_ID,
  DIGITAL_ONLY_BASE_AMOUNT_USD,
  CREATE_MEAL_PLAN_API_URL,
  BOI_EXCHANGE_RATES_URL,
  HEALTH_MAX_EVENTS_PER_REQUEST,
  INGREDIENT_REPORT_TYPES,
  nutritionSchema,
  ingredientSchema,
  mealDetailsSchema,
  mealOptionSchema,
  mealPlanSchema,
  FOOD_IMAGE_LLM_SCHEMA,
  FOOD_MACRO_LLM_SCHEMA,
  PLAN_MATCH_LLM_SCHEMA,
  FOOD_TEXT_LLM_SCHEMA,
  MAX_USER_CAPTION_LENGTH,
  MAX_FOOD_TEXT_LENGTH,
};
