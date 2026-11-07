/**
 * Starred meals: a client's saved meals they can log again in one tap.
 *
 * Rows live in the Chat DB (adminDB) table `starred_meals` (see sql/starred_meals.sql),
 * next to `food_logs`. Only this API reads and writes them (service role).
 * Every function takes the DB client as a dependency so tests can pass a fake.
 */

const MAX_STARRED_PER_USER = 50;
const MAX_ITEMS = 30;
const SOURCES = ['photo', 'barcode', 'text', 'voice'];
const ROW_COLUMNS =
  'id,user_id,name,items,signature,source,source_food_log_id,total_calories,total_protein_g,' +
  'total_carbs_g,total_fat_g,total_water_ml,created_at,last_used_at,use_count';

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || null;
  return err;
}

function num(value, { max = 100000, decimals = 1 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  const f = 10 ** decimals;
  return Math.round(Math.min(n, max) * f) / f;
}

function cleanText(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Keeps only the food-item fields the app writes to `food_logs.food_items`
 * (name, macros, portion_estimate, water_ml, confidence, visual_evidence).
 * Throws 400 when the list is empty, too long, or an item has no name.
 */
function sanitizeItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0) throw httpError(400, 'At least one item is required', 'items_required');
  if (raw.length > MAX_ITEMS) throw httpError(400, `At most ${MAX_ITEMS} items`, 'too_many_items');
  return raw.map((it) => {
    const name = cleanText(it?.name, 120);
    if (!name) throw httpError(400, 'Every item needs a name', 'item_name_required');
    const m = it?.macros && typeof it.macros === 'object' ? it.macros : {};
    const item = {
      name,
      macros: {
        calories: num(m.calories, { decimals: 0 }),
        protein_g: num(m.protein_g),
        carbs_g: num(m.carbs_g),
        fat_g: num(m.fat_g),
      },
      portion_estimate: cleanText(it?.portion_estimate, 40),
      confidence: typeof it?.confidence === 'number' && Number.isFinite(it.confidence) ? it.confidence : null,
      visual_evidence: it?.visual_evidence ? cleanText(it.visual_evidence, 300) : null,
    };
    if (typeof it?.water_ml === 'number' && Number.isFinite(it.water_ml) && it.water_ml >= 0) {
      item.water_ml = Math.round(Math.min(it.water_ml, 10000));
    }
    return item;
  });
}

/**
 * Identity of a meal: its item names and portions, order-free. The app computes the
 * same string (src/features/health-diary/utils/starred-meals.ts) to show a logged meal
 * as starred. Keep both in sync.
 */
function mealSignature(items) {
  return (Array.isArray(items) ? items : [])
    .map((it) => {
      const name = String(it?.name ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
      const portion = String(it?.portion_estimate ?? '').toLowerCase().replace(/\s+/g, '');
      return `${name}|${portion}`;
    })
    .sort()
    .join(';');
}

function totalsOf(items) {
  const t = items.reduce(
    (acc, it) => {
      acc.calories += Number(it.macros?.calories) || 0;
      acc.protein_g += Number(it.macros?.protein_g) || 0;
      acc.carbs_g += Number(it.macros?.carbs_g) || 0;
      acc.fat_g += Number(it.macros?.fat_g) || 0;
      acc.water_ml += Number(it.water_ml) || 0;
      return acc;
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, water_ml: 0 },
  );
  return {
    total_calories: Math.round(t.calories),
    total_protein_g: Math.round(t.protein_g),
    total_carbs_g: Math.round(t.carbs_g),
    total_fat_g: Math.round(t.fat_g),
    total_water_ml: Math.round(t.water_ml),
  };
}

function defaultName(items) {
  const names = items.map((it) => it.name).filter(Boolean);
  const head = names.slice(0, 2).join(', ');
  return cleanText(names.length > 2 ? `${head} +${names.length - 2}` : head, 120) || 'Meal';
}

function isYmd(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function recentFirst(a, b) {
  const ta = Date.parse(a.last_used_at || a.created_at || 0) || 0;
  const tb = Date.parse(b.last_used_at || b.created_at || 0) || 0;
  return tb - ta;
}

async function resolveChatUserId(userCode, { adminDB }) {
  if (!adminDB) throw httpError(500, 'Chat database not configured');
  if (!userCode) throw httpError(403, 'No client profile for this account', 'no_user_code');
  const { data, error } = await adminDB.from('chat_users').select('id').eq('user_code', userCode).maybeSingle();
  if (error) throw error;
  if (!data) throw httpError(404, 'User not found', 'user_not_found');
  return data.id;
}

async function listStarredMeals(userCode, deps) {
  const userId = await resolveChatUserId(userCode, deps);
  const { data, error } = await deps.adminDB
    .from('starred_meals')
    .select(ROW_COLUMNS)
    .eq('user_id', userId)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .limit(MAX_STARRED_PER_USER);
  if (error) throw error;
  return (data || []).slice().sort(recentFirst);
}

/**
 * Stars a meal. Starring the same items again returns the existing row (200) instead
 * of a duplicate, so a double tap or a retry is harmless.
 * body: { items, name?, source?, sourceFoodLogId? }
 */
async function starMeal(userCode, body, deps) {
  const userId = await resolveChatUserId(userCode, deps);
  const items = sanitizeItems(body?.items);
  const signature = mealSignature(items);

  const { data: existing, error: findError } = await deps.adminDB
    .from('starred_meals')
    .select(ROW_COLUMNS)
    .eq('user_id', userId)
    .eq('signature', signature)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return { created: false, meal: existing };

  const { data: all, error: countError } = await deps.adminDB
    .from('starred_meals')
    .select('id')
    .eq('user_id', userId);
  if (countError) throw countError;
  if ((all || []).length >= MAX_STARRED_PER_USER) {
    throw httpError(409, `You can star up to ${MAX_STARRED_PER_USER} meals`, 'limit_reached');
  }

  const source = SOURCES.includes(body?.source) ? body.source : 'text';
  const row = {
    user_id: userId,
    name: cleanText(body?.name, 120) || defaultName(items),
    items,
    signature,
    source,
    source_food_log_id: isUuid(body?.sourceFoodLogId) ? body.sourceFoodLogId : null,
    ...totalsOf(items),
    use_count: 0,
    created_at: new Date().toISOString(),
    last_used_at: null,
  };
  const { data, error } = await deps.adminDB.from('starred_meals').insert([row]).select(ROW_COLUMNS);
  if (error) {
    // Two stars of the same meal raced past the lookup: return the winner.
    if (error.code === '23505') {
      const { data: winner } = await deps.adminDB
        .from('starred_meals')
        .select(ROW_COLUMNS)
        .eq('user_id', userId)
        .eq('signature', signature)
        .maybeSingle();
      if (winner) return { created: false, meal: winner };
    }
    throw error;
  }
  return { created: true, meal: Array.isArray(data) ? data[0] : data };
}

async function findOwnStarredMeal(userId, id, deps) {
  if (!isUuid(id)) throw httpError(404, 'Starred meal not found', 'not_found');
  const { data, error } = await deps.adminDB
    .from('starred_meals')
    .select(ROW_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw httpError(404, 'Starred meal not found', 'not_found');
  return data;
}

async function unstarMeal(userCode, id, deps) {
  const userId = await resolveChatUserId(userCode, deps);
  await findOwnStarredMeal(userId, id, deps);
  const { error } = await deps.adminDB.from('starred_meals').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
  return { id };
}

/**
 * Logs a starred meal as a new food_logs row for `mealSlot` on `date`, with the same
 * items and portions (or `items`, when the client adjusted portions first), and counts the use.
 * body: { mealSlot, date, items? } → { foodLog, meal }
 */
async function logStarredMeal(userCode, id, body, deps) {
  const userId = await resolveChatUserId(userCode, deps);
  const mealSlot = cleanText(body?.mealSlot, 80);
  if (!mealSlot) throw httpError(400, 'mealSlot is required', 'meal_slot_required');
  if (!isYmd(body?.date)) throw httpError(400, 'date must be YYYY-MM-DD', 'bad_date');

  const meal = await findOwnStarredMeal(userId, id, deps);
  const items = body?.items != null ? sanitizeItems(body.items) : sanitizeItems(meal.items);
  const totals = totalsOf(items);
  const now = (deps.now ? deps.now() : new Date()).toISOString();

  const { data, error } = await deps.adminDB
    .from('food_logs')
    .insert([
      {
        user_id: userId,
        meal_label: mealSlot,
        food_items: items,
        image_url: null,
        image_data: null,
        total_calories: totals.total_calories,
        total_protein_g: totals.total_protein_g,
        total_carbs_g: totals.total_carbs_g,
        total_fat_g: totals.total_fat_g,
        log_date: body.date,
        created_at: now,
      },
    ])
    .select();
  if (error) throw error;
  const foodLog = Array.isArray(data) ? data[0] : data;

  const usage = { last_used_at: now, use_count: (Number(meal.use_count) || 0) + 1 };
  const { error: usageError } = await deps.adminDB
    .from('starred_meals')
    .update(usage)
    .eq('id', meal.id)
    .eq('user_id', userId);
  // The meal is logged either way; a missed counter is not worth failing the request.
  if (usageError) console.warn('starred meal usage update failed', usageError.message);

  return { foodLog, meal: { ...meal, ...usage } };
}

module.exports = {
  MAX_STARRED_PER_USER,
  MAX_ITEMS,
  sanitizeItems,
  mealSignature,
  totalsOf,
  isYmd,
  listStarredMeals,
  starMeal,
  unstarMeal,
  logStarredMeal,
};
