const sharp = require('sharp');

// ─── Stripe helpers ───────────────────────────────────────────────────────────
const { DIGITAL_ONLY_PRODUCT_ID, DIGITAL_ONLY_PRICE_ID, DIGITAL_ONLY_BASE_AMOUNT_USD } = require('./constants');

function isDigitalOnlyPlan(productId, priceId) {
  return productId === DIGITAL_ONLY_PRODUCT_ID || priceId === DIGITAL_ONLY_PRICE_ID;
}

function getDigitalOnlyAmount(subscription) {
  const coupon = subscription?.discount?.coupon;
  let amount = DIGITAL_ONLY_BASE_AMOUNT_USD;
  if (coupon?.percent_off != null) {
    amount = amount * (1 - (coupon.percent_off / 100));
  } else if (coupon?.amount_off != null) {
    amount = amount - (coupon.amount_off / 100);
  }
  return Number(Math.max(0, amount).toFixed(2));
}

// ─── Date / time helpers ──────────────────────────────────────────────────────
function parseTimeToFloat(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return h + (Number.isFinite(m) ? m / 60 : 0);
}

function isIsoDate(value) {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}T/.test(value);
}

function isYmd(value) {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// ─── JWT decode (no signature verification) ───────────────────────────────────
function decodeJwtPayloadServer(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 3) return {};
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(decoded) || {};
  } catch {
    return {};
  }
}

// ─── Meal-plan totals helper ──────────────────────────────────────────────────
function calculateMainTotalsFromMeals(meals) {
  if (!Array.isArray(meals)) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }
  return meals.reduce((acc, meal) => {
    if (meal?.main?.nutrition) {
      acc.calories += meal.main.nutrition.calories || 0;
      acc.protein  += meal.main.nutrition.protein  || 0;
      acc.carbs    += meal.main.nutrition.carbs    || 0;
      acc.fat      += meal.main.nutrition.fat      || 0;
    }
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

// ─── Image helpers ────────────────────────────────────────────────────────────
async function compressFoodImage(buffer) {
  return await sharp(buffer)
    .rotate()
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

const ANALYZE_IMAGE_LOG = '[analyze-image]';

function logAnalyzeImage(step, payload) {
  if (payload === undefined) {
    console.log(`${ANALYZE_IMAGE_LOG} ${step}`);
    return;
  }
  const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);
  console.log(`${ANALYZE_IMAGE_LOG} ${step} ${detail}`);
}

function summarizeBase64Field(label, raw) {
  if (raw == null) return { field: label, present: false };
  if (typeof raw !== 'string') {
    return { field: label, present: true, invalid: true, typeof: typeof raw };
  }
  const mimeMatch = raw.match(/^data:([^;]+);base64,/);
  const base64Len = raw.replace(/^data:[^;]+;base64,/, '').length;
  return {
    field: label,
    present: true,
    mime: mimeMatch ? mimeMatch[1] : '(raw base64, no data-uri prefix)',
    base64Chars: base64Len,
    approxBytes: Math.round(base64Len * 0.75),
  };
}

// ─── LiDAR / depth-map helpers ────────────────────────────────────────────────
function readFloat16LE(buffer, offset) {
  const bits = buffer.readUInt16LE(offset);
  const sign     = (bits & 0x8000) >> 15;
  const exponent = (bits & 0x7c00) >> 10;
  const fraction =  bits & 0x03ff;
  if (exponent === 0) {
    if (fraction === 0) return sign ? -0 : 0;
    return (sign ? -1 : 1) * Math.pow(2, -14) * (fraction / 1024);
  }
  if (exponent === 0x1f) return fraction ? NaN : (sign ? -Infinity : Infinity);
  return (sign ? -1 : 1) * Math.pow(2, exponent - 15) * (1 + fraction / 1024);
}

function decodeRawDepthBuffer(rawBuffer, depthMeta) {
  if (!depthMeta || typeof depthMeta !== 'object') return null;
  const width  = Number(depthMeta.width);
  const height = Number(depthMeta.height);
  const pixelFormat = depthMeta.pixelFormat;
  if (!width || !height || !pixelFormat) return null;

  const totalPx = width * height;
  if (totalPx <= 0) return null;

  if (pixelFormat === 'depth-32-bit') {
    const expectedBytes = totalPx * 4;
    if (rawBuffer.length < expectedBytes) {
      logAnalyzeImage('LiDAR/depth skipped', `depth-32-bit buffer too small (${rawBuffer.length} < ${expectedBytes})`);
      return null;
    }
    const depthValues = new Float64Array(totalPx);
    for (let i = 0; i < totalPx; i++) {
      const metres = rawBuffer.readFloatLE(i * 4);
      depthValues[i] = Number.isFinite(metres) && metres > 0 ? metres * 1000 : 0;
    }
    return { depthValues, width, height, depthEncoding: 'depth-32-bit float32 LE (m→mm)', bytesPerPx: 4 };
  }

  if (pixelFormat === 'depth-16-bit') {
    const expectedBytes = totalPx * 2;
    if (rawBuffer.length < expectedBytes) {
      logAnalyzeImage('LiDAR/depth skipped', `depth-16-bit buffer too small (${rawBuffer.length} < ${expectedBytes})`);
      return null;
    }
    const depthValues = new Float64Array(totalPx);
    for (let i = 0; i < totalPx; i++) {
      const metres = readFloat16LE(rawBuffer, i * 2);
      depthValues[i] = Number.isFinite(metres) && metres > 0 ? metres * 1000 : 0;
    }
    return { depthValues, width, height, depthEncoding: 'depth-16-bit float16 LE (m→mm)', bytesPerPx: 2 };
  }

  logAnalyzeImage('LiDAR/depth skipped', `unsupported depth pixelFormat: ${pixelFormat}`);
  return null;
}

async function processDepthMap(depthBase64, depthMeta) {
  try {
    const depthSummary = summarizeBase64Field('depthData', depthBase64);
    logAnalyzeImage('LiDAR/depth map received', {
      ...depthSummary,
      meta: depthMeta ? {
        width:       depthMeta.width       ?? null,
        height:      depthMeta.height      ?? null,
        pixelFormat: depthMeta.pixelFormat ?? null,
        bytesPerRow: depthMeta.bytesPerRow ?? null,
      } : null,
    });

    const base64Data = depthBase64.replace(/^data:[^;]+;base64,/, '');
    const rawBuffer  = Buffer.from(base64Data, 'base64');
    if (!rawBuffer.length) {
      logAnalyzeImage('LiDAR/depth skipped', 'decoded depth buffer is empty');
      return null;
    }

    let width, height, depthValues, depthEncoding, bytesPerPx;

    const rawDecoded = decodeRawDepthBuffer(rawBuffer, depthMeta);
    if (rawDecoded) {
      ({ depthValues, width, height, depthEncoding, bytesPerPx } = rawDecoded);
    } else if (depthMeta?.width && depthMeta?.height) {
      return null;
    } else {
      const { data, info } = await sharp(rawBuffer).grayscale().raw().toBuffer({ resolveWithObject: true });
      width  = info.width;
      height = info.height;
      const totalPx = width * height;
      if (totalPx === 0) { logAnalyzeImage('LiDAR/depth skipped', 'depth map has zero pixels'); return null; }

      bytesPerPx = data.length / totalPx;
      if (bytesPerPx >= 2) {
        depthEncoding = '16-bit uint16 LE (expected LiDAR mm)';
        depthValues   = new Float64Array(totalPx);
        for (let i = 0; i < totalPx; i++) depthValues[i] = data.readUInt16LE(i * 2);
      } else {
        depthEncoding = '8-bit grayscale (scaled to ~0-5000mm)';
        depthValues   = new Float64Array(totalPx);
        for (let i = 0; i < totalPx; i++) depthValues[i] = data[i] * (5000 / 255);
      }
    }

    const totalPx = width * height;
    if (totalPx === 0) { logAnalyzeImage('LiDAR/depth skipped', 'depth map has zero pixels'); return null; }

    const maxRaw = Math.max(...depthValues.slice(0, Math.min(1000, totalPx)));
    let scaledMetresToMm = false;
    if (!rawDecoded && maxRaw <= 10) {
      scaledMetresToMm = true;
      for (let i = 0; i < totalPx; i++) depthValues[i] *= 1000;
    }

    logAnalyzeImage('LiDAR/depth decoded', {
      rawBytes: rawBuffer.length, width, height,
      bytesPerPx: bytesPerPx ?? Math.round((rawBuffer.length / totalPx) * 100) / 100,
      depthEncoding,
      maxRawSample:    Math.round(maxRaw * 100) / 100,
      scaledMetresToMm,
    });

    const BUCKET_MM = 5;
    const MAX_DEPTH_MM = 2500;
    const FOREGROUND_THRESHOLD_MM = 12;
    const buckets = new Int32Array(Math.ceil(MAX_DEPTH_MM / BUCKET_MM));

    const histColStart = Math.floor(width  * 0.25);
    const histColEnd   = Math.floor(width  * 0.75);
    const histRowStart = Math.floor(height * 0.25);
    const histRowEnd   = Math.floor(height * 0.75);

    for (let row = histRowStart; row < histRowEnd; row++) {
      for (let col = histColStart; col < histColEnd; col++) {
        const v = depthValues[row * width + col];
        if (v > 0 && v < MAX_DEPTH_MM) buckets[Math.floor(v / BUCKET_MM)]++;
      }
    }

    let peakBucket = 0, peakCount = 0;
    for (let b = 0; b < buckets.length; b++) {
      if (buckets[b] > peakCount) { peakCount = buckets[b]; peakBucket = b; }
    }
    const plateSurfaceMm = (peakBucket + 0.5) * BUCKET_MM;

    const plausibleDistance = plateSurfaceMm >= 150 && plateSurfaceMm <= 1200;
    if (!plausibleDistance) {
      logAnalyzeImage('LiDAR/depth unreliable', { reason: 'implausible plate distance', plateSurfaceMm: Math.round(plateSurfaceMm) });
      const sampleValues = depthValues.slice(
        (histRowStart * width + histColStart),
        (histRowStart * width + histColStart) + Math.min(5000, (histRowEnd - histRowStart) * (histColEnd - histColStart))
      );
      const validSamples = Array.from(sampleValues).filter(v => v > 0 && v < MAX_DEPTH_MM);
      if (validSamples.length === 0) return null;
      validSamples.sort((a, b) => a - b);
      const medianDist = validSamples[Math.floor(validSamples.length / 2)];
      const roughMax   = Math.max(...validSamples.slice(-Math.floor(validSamples.length * 0.05)));
      return {
        totalVolumeCm3: null,
        avgElevationMm: Math.round(medianDist > 0 ? Math.min(roughMax - medianDist, 200) : 0),
        maxElevationMm: Math.round(Math.min(roughMax - (validSamples[0] ?? 0), 300)),
        volumeReliable: false,
        plateSurfaceMm: Math.round(plateSurfaceMm),
      };
    }

    const foodColStart = Math.floor(width  * 0.20);
    const foodColEnd   = Math.floor(width  * 0.80);
    const foodRowStart = Math.floor(height * 0.20);
    const foodRowEnd   = Math.floor(height * 0.80);
    const centerPx     = (foodColEnd - foodColStart) * (foodRowEnd - foodRowStart);

    let foodAreaPx = 0, elevationSum = 0, maxElevationMm = 0;
    for (let row = foodRowStart; row < foodRowEnd; row++) {
      for (let col = foodColStart; col < foodColEnd; col++) {
        const v = depthValues[row * width + col];
        if (v <= 0 || v >= MAX_DEPTH_MM) continue;
        const elevMm = plateSurfaceMm - v;
        if (elevMm >= FOREGROUND_THRESHOLD_MM) {
          foodAreaPx++;
          elevationSum += elevMm;
          if (elevMm > maxElevationMm) maxElevationMm = elevMm;
        }
      }
    }

    if (foodAreaPx === 0) {
      logAnalyzeImage('LiDAR/depth skipped', { reason: 'no foreground food pixels', plateSurfaceMm: Math.round(plateSurfaceMm) });
      return null;
    }

    const avgElevationMm = elevationSum / foodAreaPx;
    const SENSOR_HFOV_DEG = 60;
    const referenceDist   = Math.min(Math.max(plateSurfaceMm, 200), 1200);
    const halfWidthMm     = Math.tan((SENSOR_HFOV_DEG / 2) * (Math.PI / 180)) * referenceDist;
    const pixelWidthMm    = (2 * halfWidthMm) / width;
    const pixelAreaCm2    = Math.pow(pixelWidthMm / 10, 2);

    const foodAreaCm2    = foodAreaPx * pixelAreaCm2;
    const avgElevationCm = avgElevationMm / 10;
    const totalVolumeCm3 = foodAreaCm2 * avgElevationCm;

    const volumeReliable =
      avgElevationMm  >= 5   && avgElevationMm  <= 100  &&
      totalVolumeCm3  >= 50  && totalVolumeCm3  <= 3000 &&
      (foodAreaPx / centerPx) <= 0.65;

    const metrics = {
      totalVolumeCm3: volumeReliable ? Math.round(totalVolumeCm3 * 10) / 10 : null,
      avgElevationMm: Math.round(avgElevationMm),
      maxElevationMm: Math.round(maxElevationMm),
      volumeReliable,
      plateSurfaceMm: Math.round(plateSurfaceMm),
    };

    logAnalyzeImage('LiDAR/depth metrics computed', {
      ...metrics,
      foodAreaPx,
      foodAreaCm2:   Math.round(foodAreaCm2 * 10) / 10,
      foodFraction:  Math.round((foodAreaPx / centerPx) * 100) + '%',
      referenceDist: Math.round(referenceDist),
    });

    return metrics;
  } catch (err) {
    logAnalyzeImage('LiDAR/depth error (non-fatal)', err.message);
    return null;
  }
}

// ─── Text sanitizers ──────────────────────────────────────────────────────────
const { MAX_USER_CAPTION_LENGTH, MAX_FOOD_TEXT_LENGTH } = require('./constants');

function sanitizeUserCaption(rawCaption) {
  if (typeof rawCaption !== 'string') return '';
  const collapsed = rawCaption.replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';
  return collapsed.length > MAX_USER_CAPTION_LENGTH
    ? collapsed.slice(0, MAX_USER_CAPTION_LENGTH)
    : collapsed;
}

function sanitizeFoodText(rawText) {
  if (typeof rawText !== 'string') return '';
  const collapsed = rawText.replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';
  return collapsed.length > MAX_FOOD_TEXT_LENGTH
    ? collapsed.slice(0, MAX_FOOD_TEXT_LENGTH)
    : collapsed;
}

function sanitizePlanIngredient(ing) {
  if (!ing || typeof ing !== 'object') return null;
  const safe = {};
  if (typeof ing.item === 'string' && ing.item.trim()) {
    safe.item = ing.item.trim().slice(0, 120);
  } else {
    return null;
  }
  const brand = ing['brand of pruduct'] ?? ing.brand;
  if (typeof brand === 'string' && brand.trim()) safe.brand = brand.trim().slice(0, 80);
  const grams = ing['portionSI(gram)'] ?? ing.grams;
  if (typeof grams === 'number' && Number.isFinite(grams)) safe.grams = Math.round(grams * 10) / 10;
  if (typeof ing.household_measure === 'string' && ing.household_measure.trim()) {
    safe.household_measure = ing.household_measure.trim().slice(0, 120);
  }
  const macros = {};
  if (typeof ing.calories === 'number') macros.calories = ing.calories;
  if (typeof ing.protein  === 'number') macros.protein  = ing.protein;
  if (typeof ing.carbs    === 'number') macros.carbs    = ing.carbs;
  if (typeof ing.fat      === 'number') macros.fat      = ing.fat;
  if (Object.keys(macros).length) safe.macros = macros;
  return safe;
}

function sanitizePlanVariant(variant) {
  if (!variant || typeof variant !== 'object') return null;
  const safe = {};
  if (typeof variant.meal_title === 'string' && variant.meal_title.trim())
    safe.meal_title = variant.meal_title.trim().slice(0, 200);
  if (typeof variant.main_protein_source === 'string' && variant.main_protein_source.trim())
    safe.main_protein_source = variant.main_protein_source.trim().slice(0, 100);
  if (variant.nutrition && typeof variant.nutrition === 'object') {
    const n = variant.nutrition;
    safe.nutrition = {
      calories: typeof n.calories === 'number' ? n.calories : null,
      protein:  typeof n.protein  === 'number' ? n.protein  : null,
      carbs:    typeof n.carbs    === 'number' ? n.carbs    : null,
      fat:      typeof n.fat      === 'number' ? n.fat      : null,
    };
  }
  if (Array.isArray(variant.ingredients)) {
    safe.ingredients = variant.ingredients.slice(0, 25).map(sanitizePlanIngredient).filter(Boolean);
  }
  if (!safe.meal_title && !(safe.ingredients && safe.ingredients.length)) return null;
  return safe;
}

function sanitizePlanMeal(planMeal) {
  if (!planMeal || typeof planMeal !== 'object') return null;
  const main        = sanitizePlanVariant(planMeal.main);
  const alternative = sanitizePlanVariant(planMeal.alternative);
  if (!main && !alternative) return null;

  let mealName = null;
  if (typeof planMeal.meal === 'string' && planMeal.meal.trim()) {
    mealName = planMeal.meal.trim().slice(0, 100);
  } else if (typeof planMeal.main?.meal_name === 'string' && planMeal.main.meal_name.trim()) {
    mealName = planMeal.main.meal_name.trim().slice(0, 100);
  } else if (typeof planMeal.alternative?.meal_name === 'string' && planMeal.alternative.meal_name.trim()) {
    mealName = planMeal.alternative.meal_name.trim().slice(0, 100);
  }

  return { meal_name: mealName, main, alternative };
}

function formatPlanMealForPrompt(planMeal) {
  if (!planMeal) return '';

  const renderVariant = (label, v) => {
    if (!v) return `  ${label}: (not provided)`;
    const lines = [`  ${label}: ${v.meal_title || '(untitled)'}`];
    if (v.nutrition) {
      const n = v.nutrition;
      const fmt = (x) => (x == null ? '?' : x);
      lines.push(`    Target totals: ${fmt(n.calories)} kcal | P ${fmt(n.protein)}g | C ${fmt(n.carbs)}g | F ${fmt(n.fat)}g`);
    }
    if (v.main_protein_source) lines.push(`    Main protein: ${v.main_protein_source}`);
    if (v.ingredients && v.ingredients.length) {
      lines.push(`    Ingredients:`);
      v.ingredients.forEach((ing) => {
        const parts = [ing.item];
        if (ing.brand) parts.push(`(${ing.brand})`);
        if (ing.grams != null) parts.push(`${ing.grams}g`);
        if (ing.household_measure) parts.push(`— ${ing.household_measure}`);
        lines.push(`      • ${parts.join(' ')}`);
      });
    }
    return lines.join('\n');
  };

  const header = planMeal.meal_name
    ? `**CLIENT MEAL-PLAN ENTRY (what this "${planMeal.meal_name}" *should* be):**`
    : `**CLIENT MEAL-PLAN ENTRY (what this meal *should* be):**`;

  return `\n${header}\n${renderVariant('MAIN', planMeal.main)}\n${renderVariant('ALTERNATIVE', planMeal.alternative)}\n`;
}

module.exports = {
  isDigitalOnlyPlan,
  getDigitalOnlyAmount,
  parseTimeToFloat,
  isIsoDate,
  isYmd,
  decodeJwtPayloadServer,
  calculateMainTotalsFromMeals,
  compressFoodImage,
  logAnalyzeImage,
  summarizeBase64Field,
  readFloat16LE,
  decodeRawDepthBuffer,
  processDepthMap,
  sanitizeUserCaption,
  sanitizeFoodText,
  sanitizePlanIngredient,
  sanitizePlanVariant,
  sanitizePlanMeal,
  formatPlanMealForPrompt,
};
