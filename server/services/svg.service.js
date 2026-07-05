const sharp = require('sharp');

// ─── Shared helpers ───────────────────────────────────────────────────────────

function safeNum(v, def) {
  const n = Number(v);
  return (typeof n === 'number' && !Number.isNaN(n) && n >= 0) ? n : def;
}

function formatWeight(grams) {
  const n = Number(grams);
  return `${typeof n === 'number' && !Number.isNaN(n) ? Math.round(n) : 0}g`;
}

function sumLogsField(foodLogs, totalsField, itemsField) {
  return (foodLogs || []).reduce((sum, log) => {
    let fromItems = 0;
    if (log.food_items) {
      try {
        const items = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
        if (Array.isArray(items)) fromItems = items.reduce((s, item) => s + (item[itemsField] || 0), 0);
      } catch {}
    }
    return sum + fromItems + (log[totalsField] || 0);
  }, 0);
}

function buildRingGeometry(outerRadius, innerRadius, calPct, pPct, cPct, fPct) {
  const outerCircumference = 2 * Math.PI * outerRadius;
  const circumference      = 2 * Math.PI * innerRadius;
  const segmentLength      = circumference / 3;

  const clamp = (pct, total) => ({
    norm: Math.min(pct, 100) / 100 * total,
    over: pct > 100 ? Math.min(((pct - 100) / 100) * total, total) : 0,
  });

  const cal  = clamp(calPct, outerCircumference);
  const prot = clamp(pPct,   segmentLength);
  const carb = clamp(cPct,   segmentLength);
  const fat  = clamp(fPct,   segmentLength);

  const cxRing = 140, cyRing = 140;
  const minArcPxForPctLabel = 18;

  const polarAtPathS = (radius, sAlongPath) => {
    const th = sAlongPath / radius;
    return { x: cxRing + radius * Math.cos(th), y: cyRing + radius * Math.sin(th) };
  };

  const toScreenXY = (lx, ly) => {
    const dx = lx - cxRing; const dy = ly - cyRing;
    return { x: cxRing + dy, y: cyRing - dx };
  };

  const tangentDegScreen = (lx, ly) => {
    const { x: sx, y: sy } = toScreenXY(lx, ly);
    const psi = Math.atan2(sy - cyRing, sx - cxRing);
    let deg = (psi + Math.PI / 2) * (180 / Math.PI);
    deg = ((deg % 360) + 360) % 360;
    if (deg > 90 && deg < 270) deg -= 180;
    return deg;
  };

  const calArcTotal = cal.norm + cal.over;
  const protArcTotal = prot.norm + prot.over;
  const carbArcTotal = carb.norm + carb.over;
  const fatArcTotal  = fat.norm  + fat.over;
  const calArcForLabel = Math.min(calArcTotal, outerCircumference);

  const locCal  = calArcForLabel >= minArcPxForPctLabel ? polarAtPathS(outerRadius, calArcForLabel / 2) : null;
  const locProt = protArcTotal   >= minArcPxForPctLabel ? polarAtPathS(innerRadius, protArcTotal / 2) : null;
  const locCarb = carbArcTotal   >= minArcPxForPctLabel ? polarAtPathS(innerRadius, segmentLength + carbArcTotal / 2) : null;
  const locFat  = fatArcTotal    >= minArcPxForPctLabel ? polarAtPathS(innerRadius, 2 * segmentLength + fatArcTotal / 2) : null;

  const pctTextEl = (loc, pctStr) => {
    if (!loc) return '';
    const { x: sx, y: sy } = toScreenXY(loc.x, loc.y);
    const deg = tangentDegScreen(loc.x, loc.y);
    return `  <text transform="rotate(${deg} ${sx} ${sy})" x="${sx}" y="${sy}" dy="0.35em" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" font-size="10" font-weight="500" fill="#111827" stroke="#ffffff" stroke-width="1" stroke-linejoin="round" paint-order="stroke fill">${pctStr}</text>`;
  };

  const ringPctSvg = [
    pctTextEl(locCal, `${calPct}%`),
    pctTextEl(locProt, `${pPct}%`),
    pctTextEl(locCarb, `${cPct}%`),
    pctTextEl(locFat,  `${fPct}%`),
  ].filter(Boolean).join('\n');

  return { cal, prot, carb, fat, outerCircumference, circumference, segmentLength, ringPctSvg };
}

// ─── Daily macro summary SVG ──────────────────────────────────────────────────

async function generateDailyMacroSummary({ user_code, phone_number, date }, adminDB) {
  if (!adminDB) throw Object.assign(new Error('Chat database not configured'), { statusCode: 500 });
  if (!date) throw Object.assign(new Error('Date is required'), { statusCode: 400 });
  if (!user_code && !phone_number) throw Object.assign(new Error('Either user_code or phone_number is required'), { statusCode: 400 });

  let userQuery = adminDB.from('chat_users').select('id, user_code, language').limit(1);
  if (user_code)    userQuery = userQuery.eq('user_code', user_code);
  else if (phone_number) userQuery = userQuery.eq('phone', phone_number);

  const { data: userData, error: userError } = await userQuery.single();
  if (userError || !userData) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const userId       = userData.id;
  const userCode     = userData.user_code;
  const userLanguage = userData.language || 'en';

  const { data: foodLogs, error: logsError } = await adminDB.from('food_logs').select('*').eq('user_id', userId).eq('log_date', date);
  if (logsError) throw Object.assign(new Error('Failed to fetch food logs'), { statusCode: 500 });

  const totalCalories = sumLogsField(foodLogs, 'total_calories', 'cals');
  const totalProtein  = sumLogsField(foodLogs, 'total_protein_g', 'p');
  const totalCarbs    = sumLogsField(foodLogs, 'total_carbs_g', 'c');
  const totalFat      = sumLogsField(foodLogs, 'total_fat_g', 'f');

  const dayOfWeek = (() => { const d = new Date(date); return isNaN(d.getTime()) ? null : d.getDay(); })();

  const { data: activeMealPlans } = await adminDB.from('meal_plans_and_schemas').select('*')
    .eq('user_code', userCode).eq('record_type', 'meal_plan').eq('status', 'active');

  let mealPlanData = null;
  if (Array.isArray(activeMealPlans) && activeMealPlans.length > 0) {
    if (activeMealPlans.length === 1) {
      mealPlanData = activeMealPlans[0];
    } else {
      const matching = activeMealPlans.find((plan) => {
        const days = plan.active_days;
        if (days == null || !Array.isArray(days)) return true;
        return dayOfWeek == null || days.includes(dayOfWeek);
      });
      mealPlanData = matching || activeMealPlans[0];
    }
  }

  const defGoals = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
  let dailyGoals = { ...defGoals };

  if (mealPlanData?.meal_plan && Array.isArray(mealPlanData.meal_plan.meals)) {
    const t = mealPlanData.meal_plan.meals.reduce((acc, meal) => {
      if (meal.main?.nutrition) {
        acc.calories += Number(meal.main.nutrition.calories) || 0;
        acc.protein  += Number(meal.main.nutrition.protein)  || 0;
        acc.carbs    += Number(meal.main.nutrition.carbs)    || 0;
        acc.fat      += Number(meal.main.nutrition.fat)      || 0;
      }
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    dailyGoals = {
      calories: safeNum(t.calories, defGoals.calories),
      protein:  safeNum(t.protein,  defGoals.protein),
      carbs:    safeNum(t.carbs,    defGoals.carbs),
      fat:      safeNum(t.fat,      defGoals.fat),
    };
  }

  const caloriesPercent = dailyGoals.calories > 0 ? Math.round((totalCalories / dailyGoals.calories) * 100) : 0;
  const proteinPercent  = dailyGoals.protein  > 0 ? Math.round((totalProtein  / dailyGoals.protein)  * 100) : 0;
  const carbsPercent    = dailyGoals.carbs    > 0 ? Math.round((totalCarbs    / dailyGoals.carbs)    * 100) : 0;
  const fatPercent      = dailyGoals.fat      > 0 ? Math.round((totalFat      / dailyGoals.fat)      * 100) : 0;

  const outerRadius = 120, innerRadius = 100;
  const { cal, prot, carb, fat, outerCircumference, circumference, segmentLength, ringPctSvg } =
    buildRingGeometry(outerRadius, innerRadius, caloriesPercent, proteinPercent, carbsPercent, fatPercent);

  const innerClearR = innerRadius - 8;
  const calCenterStr = totalCalories.toLocaleString();
  const calCharFactor = 0.58;
  let centerCaloriesFontSize = 56;
  const estCalTextW = calCenterStr.length * calCharFactor * centerCaloriesFontSize;
  const maxCalW = innerClearR * 2 * 0.88;
  if (estCalTextW > maxCalW) centerCaloriesFontSize = Math.max(28, Math.floor(maxCalW / (calCenterStr.length * calCharFactor)));

  const kcalSubFont = 14;
  const hubGap = 8;
  const hubLineSpacing = centerCaloriesFontSize * 0.42 + hubGap + kcalSubFont * 0.42;
  const hubCalLineY  = -hubLineSpacing / 2;
  const hubKcalLineY =  hubLineSpacing / 2;
  const legendPadX = 28;
  const legendValueX = 118;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 460">
  <defs>
    <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" /><stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="proteinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c084fc" /><stop offset="100%" stop-color="#7e22ce" />
    </linearGradient>
    <linearGradient id="carbsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa" /><stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <linearGradient id="fatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fcd34d" /><stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#000000" flood-opacity="0.15" />
    </filter>
  </defs>

  <rect width="280" height="460" fill="#ffffff" rx="24" />
  
  <g transform="rotate(-90 140 140)">
    <circle cx="140" cy="140" r="${outerRadius}" fill="none" stroke="#f3f4f6" stroke-width="16" />
    <circle cx="140" cy="140" r="${innerRadius}" fill="none" stroke="#f3f4f6" stroke-width="16" />

    ${cal.norm > 0 ? `<circle cx="140" cy="140" r="${outerRadius}" fill="none" stroke="url(#calGrad)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${cal.norm} ${outerCircumference}" filter="url(#softShadow)" />` : ''}
    ${cal.over > 0 ? `<circle cx="140" cy="140" r="${outerRadius}" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" stroke-dasharray="${cal.over} ${outerCircumference}" /><circle cx="140" cy="140" r="${outerRadius}" fill="none" stroke="#047857" stroke-width="16" stroke-linecap="round" stroke-dasharray="${cal.over} ${outerCircumference}" />` : ''}

    ${prot.norm > 0 ? `<circle cx="140" cy="140" r="${innerRadius}" fill="none" stroke="url(#proteinGrad)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${prot.norm} ${circumference}" filter="url(#softShadow)" />` : ''}
    ${carb.norm > 0 ? `<circle cx="140" cy="140" r="${innerRadius}" fill="none" stroke="url(#carbsGrad)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${carb.norm} ${circumference}" stroke-dashoffset="${-segmentLength}" filter="url(#softShadow)" />` : ''}
    ${fat.norm  > 0 ? `<circle cx="140" cy="140" r="${innerRadius}" fill="none" stroke="url(#fatGrad)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${fat.norm} ${circumference}" stroke-dashoffset="${-segmentLength * 2}" filter="url(#softShadow)" />` : ''}

    ${prot.over > 0 ? `<circle cx="140" cy="140" r="${innerRadius}" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" stroke-dasharray="${prot.over} ${circumference}" /><circle cx="140" cy="140" r="${innerRadius}" fill="none" stroke="#7e22ce" stroke-width="16" stroke-linecap="round" stroke-dasharray="${prot.over} ${circumference}" />` : ''}
    ${carb.over > 0 ? `<circle cx="140" cy="140" r="${innerRadius}" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" stroke-dasharray="${carb.over} ${circumference}" stroke-dashoffset="${-segmentLength}" /><circle cx="140" cy="140" r="${innerRadius}" fill="none" stroke="#1d4ed8" stroke-width="16" stroke-linecap="round" stroke-dasharray="${carb.over} ${circumference}" stroke-dashoffset="${-segmentLength}" />` : ''}
    ${fat.over  > 0 ? `<circle cx="140" cy="140" r="${innerRadius}" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" stroke-dasharray="${fat.over} ${circumference}" stroke-dashoffset="${-segmentLength * 2}" /><circle cx="140" cy="140" r="${innerRadius}" fill="none" stroke="#b45309" stroke-width="16" stroke-linecap="round" stroke-dasharray="${fat.over} ${circumference}" stroke-dashoffset="${-segmentLength * 2}" />` : ''}
  </g>

${ringPctSvg}
  
  <g transform="translate(140, 140)">
    <text text-anchor="middle" dominant-baseline="central" y="${hubCalLineY}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="${centerCaloriesFontSize}" font-weight="700" fill="#111827" letter-spacing="-0.03em">${calCenterStr}</text>
    <text text-anchor="middle" dominant-baseline="central" y="${hubKcalLineY}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="${kcalSubFont}" font-weight="600" fill="#9ca3af" letter-spacing="0.05em">KCAL</text>
  </g>
  
  <g transform="translate(${legendPadX}, 310)">
    ${userLanguage === 'he' ? `
    <g transform="translate(0, 0)">
      <text x="0" y="12" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">
        ${totalCalories.toLocaleString()} <tspan fill="#9ca3af" font-weight="400">/ ${dailyGoals.calories.toLocaleString()}</tspan>
      </text>
      <g transform="translate(218, 0)"><circle cx="-40" cy="8" r="6" fill="#10b981"/>
        <text x="-30" y="12" text-anchor="end" direction="rtl" unicode-bidi="embed" xml:lang="he" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="500" fill="#4b5563">קלוריות</text></g>
    </g>
    <g transform="translate(0, 35)">
      <text x="0" y="12" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">
        ${formatWeight(totalProtein)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(dailyGoals.protein)}</tspan>
      </text>
      <g transform="translate(218, 0)"><circle cx="-40" cy="8" r="6" fill="#a855f7"/>
        <text x="-30" y="12" text-anchor="end" direction="rtl" unicode-bidi="embed" xml:lang="he" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="500" fill="#4b5563">חלבון</text></g>
    </g>
    <g transform="translate(0, 70)">
      <text x="0" y="12" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">
        ${formatWeight(totalCarbs)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(dailyGoals.carbs)}</tspan>
      </text>
      <g transform="translate(218, 0)"><circle cx="-40" cy="8" r="6" fill="#3b82f6"/>
        <text x="-30" y="12" text-anchor="end" direction="rtl" unicode-bidi="embed" xml:lang="he" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="500" fill="#4b5563">פחמימות</text></g>
    </g>
    <g transform="translate(0, 105)">
      <text x="0" y="12" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">
        ${formatWeight(totalFat)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(dailyGoals.fat)}</tspan>
      </text>
      <g transform="translate(218, 0)"><circle cx="-40" cy="8" r="6" fill="#f59e0b"/>
        <text x="-30" y="12" text-anchor="end" direction="rtl" unicode-bidi="embed" xml:lang="he" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="500" fill="#4b5563">שומן</text></g>
    </g>
    ` : `
    <g transform="translate(0, 0)">
      <circle cx="6" cy="8" r="6" fill="#10b981"/>
      <text x="20" y="13" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="500" fill="#4b5563">Calories</text>
      <text x="${legendValueX}" y="13" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">
        ${totalCalories.toLocaleString()} <tspan fill="#9ca3af" font-weight="400">/ ${dailyGoals.calories.toLocaleString()}</tspan>
      </text>
    </g>
    <g transform="translate(0, 35)">
      <circle cx="6" cy="8" r="6" fill="#a855f7"/>
      <text x="20" y="13" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="500" fill="#4b5563">Protein</text>
      <text x="${legendValueX}" y="13" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">
        ${formatWeight(totalProtein)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(dailyGoals.protein)}</tspan>
      </text>
    </g>
    <g transform="translate(0, 70)">
      <circle cx="6" cy="8" r="6" fill="#3b82f6"/>
      <text x="20" y="13" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="500" fill="#4b5563">Carbs</text>
      <text x="${legendValueX}" y="13" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">
        ${formatWeight(totalCarbs)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(dailyGoals.carbs)}</tspan>
      </text>
    </g>
    <g transform="translate(0, 105)">
      <circle cx="6" cy="8" r="6" fill="#f59e0b"/>
      <text x="20" y="13" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="500" fill="#4b5563">Fat</text>
      <text x="${legendValueX}" y="13" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">
        ${formatWeight(totalFat)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(dailyGoals.fat)}</tspan>
      </text>
    </g>
    `}
  </g>
</svg>`;

  return renderSvgOrPng(svg, 1200, Math.round((1200 * 460) / 280));
}

// ─── Weekly macro summary SVG ─────────────────────────────────────────────────

async function generateWeeklyMacroSummary({ user_code, phone_number, date }, adminDB) {
  if (!adminDB) throw Object.assign(new Error('Chat database not configured'), { statusCode: 500 });
  if (!date) throw Object.assign(new Error('Date is required'), { statusCode: 400 });
  if (!user_code && !phone_number) throw Object.assign(new Error('Either user_code or phone_number is required'), { statusCode: 400 });

  const targetDate = new Date(date);
  if (isNaN(targetDate.getTime())) throw Object.assign(new Error('Invalid date format'), { statusCode: 400 });

  const dayIndex  = targetDate.getDay();
  const startDate = new Date(targetDate);
  startDate.setDate(targetDate.getDate() - dayIndex);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  const dateStrStart = startDate.toISOString().split('T')[0];
  const dateStrEnd   = endDate.toISOString().split('T')[0];

  let userQuery = adminDB.from('chat_users').select('id, user_code, language').limit(1);
  if (user_code)    userQuery = userQuery.eq('user_code', user_code);
  else if (phone_number) userQuery = userQuery.eq('phone', phone_number);

  const { data: userData, error: userError } = await userQuery.single();
  if (userError || !userData) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const userId       = userData.id;
  const userCode     = userData.user_code;
  const userLanguage = userData.language || 'en';
  const isHe         = userLanguage === 'he';

  const { data: foodLogs }        = await adminDB.from('food_logs').select('*').eq('user_id', userId).gte('log_date', dateStrStart).lte('log_date', dateStrEnd);
  const { data: activeMealPlans } = await adminDB.from('meal_plans_and_schemas').select('*').eq('user_code', userCode).eq('record_type', 'meal_plan').eq('status', 'active');

  const daysShort  = isHe ? ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const dailyStats = Array(7).fill(0).map((_, i) => ({ label: daysShort[i], calories: 0, goal: 2000 }));
  let weeklyTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  let weeklyGoals  = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const defDaily   = { calories: 2000, protein: 150, carbs: 250, fat: 65 };

  for (let i = 0; i < 7; i++) {
    let planForDay = null;
    if (Array.isArray(activeMealPlans) && activeMealPlans.length > 0) {
      if (activeMealPlans.length === 1) {
        planForDay = activeMealPlans[0];
      } else {
        const matching = activeMealPlans.find((plan) => {
          const days = plan.active_days;
          if (days == null || !Array.isArray(days)) return true;
          return days.includes(i);
        });
        planForDay = matching || activeMealPlans[0];
      }
    }

    let dayGoals = { ...defDaily };
    if (planForDay?.meal_plan && Array.isArray(planForDay.meal_plan.meals)) {
      const mTarget = planForDay.meal_plan.meals.reduce((acc, meal) => {
        if (meal.main?.nutrition) {
          acc.c  += Number(meal.main.nutrition.calories) || 0;
          acc.p  += Number(meal.main.nutrition.protein)  || 0;
          acc.cb += Number(meal.main.nutrition.carbs)    || 0;
          acc.f  += Number(meal.main.nutrition.fat)      || 0;
        }
        return acc;
      }, { c: 0, p: 0, cb: 0, f: 0 });

      dayGoals = {
        calories: safeNum(mTarget.c, defDaily.calories),
        protein:  safeNum(mTarget.p, defDaily.protein),
        carbs:    safeNum(mTarget.cb, defDaily.carbs),
        fat:      safeNum(mTarget.f, defDaily.fat),
      };
    }

    dailyStats[i].goal  = dayGoals.calories;
    weeklyGoals.calories += dayGoals.calories;
    weeklyGoals.protein  += dayGoals.protein;
    weeklyGoals.carbs    += dayGoals.carbs;
    weeklyGoals.fat      += dayGoals.fat;
  }

  (foodLogs || []).forEach((log) => {
    const dIdx = new Date(log.log_date).getDay();
    let logCals = 0, logP = 0, logC = 0, logF = 0;
    if (log.food_items) {
      try {
        const items = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
        if (Array.isArray(items)) {
          logCals = items.reduce((sum, item) => sum + (item.cals || 0), 0);
          logP    = items.reduce((sum, item) => sum + (item.p    || 0), 0);
          logC    = items.reduce((sum, item) => sum + (item.c    || 0), 0);
          logF    = items.reduce((sum, item) => sum + (item.f    || 0), 0);
        }
      } catch {}
    }
    logCals += (log.total_calories  || 0);
    logP    += (log.total_protein_g || 0);
    logC    += (log.total_carbs_g   || 0);
    logF    += (log.total_fat_g     || 0);

    dailyStats[dIdx].calories  += logCals;
    weeklyTotals.calories      += logCals;
    weeklyTotals.protein       += logP;
    weeklyTotals.carbs         += logC;
    weeklyTotals.fat           += logF;
  });

  const daysWithCalories = dailyStats.filter((d) => d.calories > 0).length;
  const avgTotals = daysWithCalories > 0
    ? { calories: weeklyTotals.calories / daysWithCalories, protein: weeklyTotals.protein / daysWithCalories, carbs: weeklyTotals.carbs / daysWithCalories, fat: weeklyTotals.fat / daysWithCalories }
    : { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const avgGoals = { calories: weeklyGoals.calories / 7, protein: weeklyGoals.protein / 7, carbs: weeklyGoals.carbs / 7, fat: weeklyGoals.fat / 7 };

  const calPct = avgGoals.calories > 0 ? Math.round((avgTotals.calories / avgGoals.calories) * 100) : 0;
  const pPct   = avgGoals.protein  > 0 ? Math.round((avgTotals.protein  / avgGoals.protein)  * 100) : 0;
  const cPct   = avgGoals.carbs    > 0 ? Math.round((avgTotals.carbs    / avgGoals.carbs)    * 100) : 0;
  const fPct   = avgGoals.fat      > 0 ? Math.round((avgTotals.fat      / avgGoals.fat)      * 100) : 0;

  const outerRadius = 120, innerRadius = 100, cxRing = 140, cyRing = 140;
  const { cal, prot, carb, fat, outerCircumference, circumference, segmentLength, ringPctSvg } =
    buildRingGeometry(outerRadius, innerRadius, calPct, pPct, cPct, fPct);

  // Center hub
  const innerClearR = innerRadius - 8;
  const calCenterStr = Math.round(avgTotals.calories).toLocaleString();
  const calCharFactor = 0.58;
  let centerCaloriesFontSize = 56;
  const estCalTextW = calCenterStr.length * calCharFactor * centerCaloriesFontSize;
  const maxCalW = innerClearR * 2 * 0.88;
  if (estCalTextW > maxCalW) centerCaloriesFontSize = Math.max(26, Math.floor(maxCalW / (calCenterStr.length * calCharFactor)));

  const kcalSubFont = 14, hubGap = 8;
  const hubLineSpacing    = centerCaloriesFontSize * 0.42 + hubGap + kcalSubFont * 0.42;
  const hubCalLineY       = -hubLineSpacing / 2;
  const hubKcalLineY      =  hubLineSpacing / 2;
  const weeklySubFill     = '#9ca3af';
  const weeklySubLetter   = isHe ? '0.02em' : '0.05em';

  // Chart geometry
  const ringColumnW = 280, colGap = 12, rightColX = ringColumnW + colGap;
  const chartW = 576, plotPadL = 50, plotPadR = 48, plotPadT = 4, plotPadB = 24;
  const innerW = chartW - plotPadL - plotPadR;
  const innerH = 90;

  const dayCals  = dailyStats.map((d) => d.calories);
  const dayGoals = dailyStats.map((d) => (d.goal > 0 ? d.goal : 2000));
  const yMaxRaw  = Math.max(1, ...dayCals, ...dayGoals);
  const yMax     = Math.max(500, Math.ceil((yMaxRaw * 1.06) / 100) * 100);

  const xAt  = (i) => plotPadL + (innerW * i) / 6;
  const xDay = (dayIdx) => (isHe ? xAt(6 - dayIdx) : xAt(dayIdx));
  const yAt  = (val)    => plotPadT + innerH - (Math.min(Math.max(0, val), yMax) / yMax) * innerH;

  const linePts = dayCals.map((v, i) => `${xDay(i)},${yAt(v)}`).join(' ');
  const goalPts = dayGoals.map((g, i) => `${xDay(i)},${yAt(g)}`).join(' ');
  const areaD   = `M ${dayCals.map((v, i) => `${xDay(i)} ${yAt(v)}`).join(' L ')} L ${xDay(6)} ${plotPadT + innerH} L ${xDay(0)} ${plotPadT + innerH} Z`;

  const fontUi  = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const yTickVals = [0, Math.round(yMax / 2), yMax];

  const gridLinesSvg    = yTickVals.map((tv) => `<line x1="${plotPadL}" y1="${yAt(tv)}" x2="${plotPadL + innerW}" y2="${yAt(tv)}" stroke="#f3f4f6" stroke-width="1" />`).join('\n        ');
  const yAxisLabelsSvg  = yTickVals.map((tv) => `<text x="${plotPadL - 6}" y="${yAt(tv)}" text-anchor="end" dominant-baseline="middle" font-family="${fontUi}" font-size="10" font-weight="500" fill="#9ca3af">${tv.toLocaleString()}</text>`).join('\n        ');

  const insetXLabel = (cx) => {
    const edge = 20;
    if (cx > chartW - edge) return { x: chartW - 5, anchor: 'end' };
    if (cx < plotPadL + edge) return { x: plotPadL + 5, anchor: 'start' };
    return { x: cx, anchor: 'middle' };
  };

  const dotsSvg      = dayCals.map((v, i) => { const cx = xDay(i); const cy = yAt(v); const over = dayGoals[i] > 0 && v > dayGoals[i]; const fill = v <= 0 ? '#e5e7eb' : over ? '#ef4444' : '#10b981'; const stroke = v <= 0 ? '#d1d5db' : '#ffffff'; return `<circle cx="${cx}" cy="${cy}" r="5" fill="${fill}" stroke="${stroke}" stroke-width="2" />`; }).join('\n        ');
  const xLabelsSvg   = dailyStats.map((d, i) => { const cx = xDay(i); const { x, anchor } = insetXLabel(cx); return `<text x="${x}" y="${plotPadT + innerH + 16}" text-anchor="${anchor}" font-family="${fontUi}" font-size="12" font-weight="600" fill="#6b7280">${d.label}</text>`; }).join('\n        ');
  const calLabelsSvg = dayCals.map((v, i) => { const cx = xDay(i); const cy = yAt(v); const { x: lx, anchor } = insetXLabel(cx); const label = Math.round(v).toLocaleString(); const gapAbove = 11; const yAbove = cy - gapAbove; const useBelow = yAbove < plotPadT + 4; const ty = useBelow ? cy + 15 : yAbove; const baseline = useBelow ? 'hanging' : 'alphabetic'; return `<text x="${lx}" y="${ty}" text-anchor="${anchor}" dominant-baseline="${baseline}" font-family="${fontUi}" font-size="11" font-weight="700" fill="#111827" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" paint-order="stroke fill">${label}</text>`; }).join('\n        ');

  const legendValueX    = 200;
  const heLegendLabelShift = 500;
  const svgW            = ringColumnW + colGap + chartW;
  const barBlockTop     = 42;
  const chartInnerY     = 22;
  const legendTop       = 198;
  const legendBottomPad = 14;
  const svgH            = legendTop + 105 + 48 + legendBottomPad;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}">
  <defs>
    <linearGradient id="weeklyCalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" /><stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="weeklyProteinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c084fc" /><stop offset="100%" stop-color="#7e22ce" />
    </linearGradient>
    <linearGradient id="weeklyCarbsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa" /><stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <linearGradient id="weeklyFatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fcd34d" /><stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <filter id="weeklySoftShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#000000" flood-opacity="0.15" />
    </filter>
    <linearGradient id="weeklyLineAreaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#34d399" stop-opacity="0.28" /><stop offset="100%" stop-color="#34d399" stop-opacity="0" />
    </linearGradient>
  </defs>

  <rect width="${svgW}" height="${svgH}" fill="#ffffff" rx="24" />

  <g transform="rotate(-90 ${cxRing} ${cyRing})">
    <circle cx="${cxRing}" cy="${cyRing}" r="${outerRadius}" fill="none" stroke="#f3f4f6" stroke-width="16" />
    <circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="#f3f4f6" stroke-width="16" />

    ${cal.norm > 0 ? `<circle cx="${cxRing}" cy="${cyRing}" r="${outerRadius}" fill="none" stroke="url(#weeklyCalGrad)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${cal.norm} ${outerCircumference}" filter="url(#weeklySoftShadow)" />` : ''}
    ${cal.over > 0 ? `<circle cx="${cxRing}" cy="${cyRing}" r="${outerRadius}" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" stroke-dasharray="${cal.over} ${outerCircumference}" /><circle cx="${cxRing}" cy="${cyRing}" r="${outerRadius}" fill="none" stroke="#047857" stroke-width="16" stroke-linecap="round" stroke-dasharray="${cal.over} ${outerCircumference}" />` : ''}

    ${prot.norm > 0 ? `<circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="url(#weeklyProteinGrad)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${prot.norm} ${circumference}" filter="url(#weeklySoftShadow)" />` : ''}
    ${carb.norm > 0 ? `<circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="url(#weeklyCarbsGrad)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${carb.norm} ${circumference}" stroke-dashoffset="${-segmentLength}" filter="url(#weeklySoftShadow)" />` : ''}
    ${fat.norm  > 0 ? `<circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="url(#weeklyFatGrad)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${fat.norm} ${circumference}" stroke-dashoffset="${-segmentLength * 2}" filter="url(#weeklySoftShadow)" />` : ''}

    ${prot.over > 0 ? `<circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" stroke-dasharray="${prot.over} ${circumference}" /><circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="#7e22ce" stroke-width="16" stroke-linecap="round" stroke-dasharray="${prot.over} ${circumference}" />` : ''}
    ${carb.over > 0 ? `<circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" stroke-dasharray="${carb.over} ${circumference}" stroke-dashoffset="${-segmentLength}" /><circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="#1d4ed8" stroke-width="16" stroke-linecap="round" stroke-dasharray="${carb.over} ${circumference}" stroke-dashoffset="${-segmentLength}" />` : ''}
    ${fat.over  > 0 ? `<circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" stroke-dasharray="${fat.over} ${circumference}" stroke-dashoffset="${-segmentLength * 2}" /><circle cx="${cxRing}" cy="${cyRing}" r="${innerRadius}" fill="none" stroke="#b45309" stroke-width="16" stroke-linecap="round" stroke-dasharray="${fat.over} ${circumference}" stroke-dashoffset="${-segmentLength * 2}" />` : ''}
  </g>

${ringPctSvg}

  <g transform="translate(${cxRing}, ${cyRing})">
    <text text-anchor="middle" dominant-baseline="central" y="${hubCalLineY}" font-family="${fontUi}" font-size="${centerCaloriesFontSize}" font-weight="700" fill="#111827" letter-spacing="-0.03em">${calCenterStr}</text>
    <text text-anchor="middle" dominant-baseline="central" y="${hubKcalLineY}" font-family="${fontUi}" font-size="${kcalSubFont}" font-weight="600" fill="${weeklySubFill}" letter-spacing="${weeklySubLetter}">${isHe ? 'ממוצע יומי' : 'DAILY AVG'}</text>
  </g>

  <g transform="translate(${rightColX}, ${barBlockTop})">
    <text x="${isHe ? chartW : 0}" y="0" text-anchor="${isHe ? 'end' : 'start'}" dominant-baseline="text-before-edge" font-family="${fontUi}" font-size="17" font-weight="700" fill="#111827">${isHe ? 'קלוריות לפי יום' : 'Daily calories'}</text>
    <g transform="translate(0, ${chartInnerY})">
        ${gridLinesSvg}
        ${yAxisLabelsSvg}
        <path d="${areaD}" fill="url(#weeklyLineAreaGrad)" />
        <polyline fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-dasharray="4 4" stroke-linecap="round" stroke-linejoin="round" points="${goalPts}" />
        <polyline fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${linePts}" />
        ${dotsSvg}
        ${calLabelsSvg}
        ${xLabelsSvg}
    </g>
  </g>

  <g transform="translate(${rightColX}, ${legendTop})">
    ${isHe ? `
    <g transform="translate(0, 0)">
      <text x="0" y="12" text-anchor="start" font-family="${fontUi}" font-size="15" font-weight="700" fill="#111827"><tspan fill="#6b7280" font-weight="500">ממוצע </tspan>${Math.round(avgTotals.calories).toLocaleString()} <tspan fill="#9ca3af" font-weight="400">/ ${Math.round(avgGoals.calories).toLocaleString()}</tspan></text>
      <g transform="translate(${heLegendLabelShift}, 0)"><circle cx="-40" cy="8" r="6" fill="#10b981"/><text x="-30" y="12" text-anchor="end" direction="rtl" unicode-bidi="embed" xml:lang="he" font-family="${fontUi}" font-size="15" font-weight="500" fill="#4b5563">קלוריות</text></g>
    </g>
    <g transform="translate(0, 35)">
      <text x="0" y="12" text-anchor="start" font-family="${fontUi}" font-size="15" font-weight="700" fill="#111827"><tspan fill="#6b7280" font-weight="500">ממוצע </tspan>${formatWeight(avgTotals.protein)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(avgGoals.protein)}</tspan></text>
      <g transform="translate(${heLegendLabelShift}, 0)"><circle cx="-40" cy="8" r="6" fill="#a855f7"/><text x="-30" y="12" text-anchor="end" direction="rtl" unicode-bidi="embed" xml:lang="he" font-family="${fontUi}" font-size="15" font-weight="500" fill="#4b5563">חלבון</text></g>
    </g>
    <g transform="translate(0, 70)">
      <text x="0" y="12" text-anchor="start" font-family="${fontUi}" font-size="15" font-weight="700" fill="#111827"><tspan fill="#6b7280" font-weight="500">ממוצע </tspan>${formatWeight(avgTotals.carbs)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(avgGoals.carbs)}</tspan></text>
      <g transform="translate(${heLegendLabelShift}, 0)"><circle cx="-40" cy="8" r="6" fill="#3b82f6"/><text x="-30" y="12" text-anchor="end" direction="rtl" unicode-bidi="embed" xml:lang="he" font-family="${fontUi}" font-size="15" font-weight="500" fill="#4b5563">פחמימות</text></g>
    </g>
    <g transform="translate(0, 105)">
      <text x="0" y="12" text-anchor="start" font-family="${fontUi}" font-size="15" font-weight="700" fill="#111827"><tspan fill="#6b7280" font-weight="500">ממוצע </tspan>${formatWeight(avgTotals.fat)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(avgGoals.fat)}</tspan></text>
      <g transform="translate(${heLegendLabelShift}, 0)"><circle cx="-40" cy="8" r="6" fill="#f59e0b"/><text x="-30" y="12" text-anchor="end" direction="rtl" unicode-bidi="embed" xml:lang="he" font-family="${fontUi}" font-size="15" font-weight="500" fill="#4b5563">שומן</text></g>
    </g>
    ` : `
    <g transform="translate(0, 0)">
      <circle cx="6" cy="8" r="6" fill="#10b981"/>
      <text x="20" y="13" font-family="${fontUi}" font-size="15" font-weight="500" fill="#4b5563">Calories</text>
      <text x="${legendValueX}" y="13" text-anchor="start" font-family="${fontUi}" font-size="15" font-weight="700" fill="#111827"><tspan fill="#6b7280" font-weight="500">avg </tspan>${Math.round(avgTotals.calories).toLocaleString()} <tspan fill="#9ca3af" font-weight="400">/ ${Math.round(avgGoals.calories).toLocaleString()}</tspan></text>
    </g>
    <g transform="translate(0, 35)">
      <circle cx="6" cy="8" r="6" fill="#a855f7"/>
      <text x="20" y="13" font-family="${fontUi}" font-size="15" font-weight="500" fill="#4b5563">Protein</text>
      <text x="${legendValueX}" y="13" text-anchor="start" font-family="${fontUi}" font-size="15" font-weight="700" fill="#111827"><tspan fill="#6b7280" font-weight="500">avg </tspan>${formatWeight(avgTotals.protein)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(avgGoals.protein)}</tspan></text>
    </g>
    <g transform="translate(0, 70)">
      <circle cx="6" cy="8" r="6" fill="#3b82f6"/>
      <text x="20" y="13" font-family="${fontUi}" font-size="15" font-weight="500" fill="#4b5563">Carbs</text>
      <text x="${legendValueX}" y="13" text-anchor="start" font-family="${fontUi}" font-size="15" font-weight="700" fill="#111827"><tspan fill="#6b7280" font-weight="500">avg </tspan>${formatWeight(avgTotals.carbs)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(avgGoals.carbs)}</tspan></text>
    </g>
    <g transform="translate(0, 105)">
      <circle cx="6" cy="8" r="6" fill="#f59e0b"/>
      <text x="20" y="13" font-family="${fontUi}" font-size="15" font-weight="500" fill="#4b5563">Fat</text>
      <text x="${legendValueX}" y="13" text-anchor="start" font-family="${fontUi}" font-size="15" font-weight="700" fill="#111827"><tspan fill="#6b7280" font-weight="500">avg </tspan>${formatWeight(avgTotals.fat)} <tspan fill="#9ca3af" font-weight="400">/ ${formatWeight(avgGoals.fat)}</tspan></text>
    </g>
    `}
  </g>
</svg>`;

  const dailyMacroVbW = 280, dailyMacroOutW = 1200;
  const vbToOutputPx = dailyMacroOutW / dailyMacroVbW;
  return renderSvgOrPng(svg, Math.round(svgW * vbToOutputPx), Math.round(svgH * vbToOutputPx));
}

// ─── PNG rendering helper ─────────────────────────────────────────────────────

async function renderSvgOrPng(svg, outW, outH) {
  try {
    const pngBuffer = await sharp(Buffer.from(svg))
      .resize(outW, outH, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();
    return { buffer: pngBuffer, contentType: 'image/png' };
  } catch (sharpError) {
    console.warn('⚠️ SVG → PNG conversion failed, serving SVG fallback:', sharpError.message);
    return { buffer: Buffer.from(svg), contentType: 'image/svg+xml' };
  }
}

module.exports = { generateDailyMacroSummary, generateWeeklyMacroSummary };
