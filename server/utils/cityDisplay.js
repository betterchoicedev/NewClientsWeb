function hasNonLatinScript(text) {
  return /[^\u0000-\u007F]/.test(text);
}

function hasHebrewNiqqud(text) {
  return /[\u05B0-\u05BC\u05C1\u05C2\u05C4\u05C5\u05C7]/.test(text);
}

function parseAlternateNames(alternatenames) {
  if (!alternatenames) return [];
  return String(alternatenames)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isHebrewLocalName(text) {
  if (!/[\u0590-\u05EA]/.test(text) || hasHebrewNiqqud(text)) return false;
  if (/[A-Za-z]/.test(text)) return false;
  return true;
}

function scoreLocalAlternate(alt, en, countryCode) {
  const c = (alt || '').trim();
  if (!c) return -1;

  if (countryCode === 'IL') {
    if (!isHebrewLocalName(c)) return -1;
    const compactLen = c.replace(/[\s\-–]/g, '').length;
    let score = compactLen;
    if (compactLen < 2 || compactLen > 20) score -= 10;
    if ((en || '').includes(' ') && /[\s\-–]/.test(c)) score += 4;
    if (compactLen > 12) score -= 3;
    return score;
  }

  if (['SA', 'AE', 'EG', 'JO', 'LB', 'SY', 'IQ', 'KW', 'QA', 'BH', 'OM', 'YE', 'MA', 'DZ', 'TN'].includes(countryCode)) {
    if (!/[\u0600-\u06FF]/.test(c)) return -1;
    return c.replace(/[\s\-–]/g, '').length;
  }

  if (countryCode === 'RU' || countryCode === 'UA' || countryCode === 'BY') {
    if (!/[\u0400-\u04FF]/.test(c)) return -1;
    return c.length;
  }

  if (['CN', 'TW', 'HK', 'JP', 'KR'].includes(countryCode)) {
    if (!/[\u3040-\u30FF\u4E00-\u9FFF]/.test(c)) return -1;
    return c.length;
  }

  if (!hasNonLatinScript(c)) return -1;
  return c.length;
}

function pickBestAlternate(alts, en, countryCode, isDuplicate) {
  let best = '';
  let bestScore = -1;
  for (const alt of alts) {
    if (isDuplicate(alt)) continue;
    const score = scoreLocalAlternate(alt, en, countryCode);
    if (score > bestScore) {
      bestScore = score;
      best = alt;
    }
  }
  return best;
}

function pickLocalName({ name, asciiname, alternatenames, country_code } = {}) {
  const en = (asciiname || name || '').trim();
  const primary = (name || '').trim();

  if (primary && hasNonLatinScript(primary) && primary.toLowerCase() !== en.toLowerCase()) {
    return primary;
  }

  const alts = parseAlternateNames(alternatenames);
  const isDuplicate = (candidate) => {
    const c = (candidate || '').trim();
    if (!c) return true;
    if (c.toLowerCase() === en.toLowerCase()) return true;
    if (primary && c.toLowerCase() === primary.toLowerCase()) return true;
    return false;
  };

  const fromCountry = pickBestAlternate(alts, en, country_code, isDuplicate);
  if (fromCountry) return fromCountry;

  const fromAnyScript = pickBestAlternate(
    alts.filter((alt) => hasNonLatinScript(alt)),
    en,
    null,
    isDuplicate
  );
  if (fromAnyScript) return fromAnyScript;

  if (primary && !isDuplicate(primary)) return primary;
  return '';
}

/** Bilingual city label: "English - Local" (GeoNames asciiname + name/alternatenames). */
function formatCityLabel(row = {}) {
  const { name, asciiname, alternatenames, country_code } = row || {};
  const en = (asciiname || name || '').trim();
  if (!en) return '';
  const local = pickLocalName({ name, asciiname, alternatenames, country_code });
  if (!local || local.toLowerCase() === en.toLowerCase()) return en;
  return `${en} - ${local}`;
}

// Script of the user's search text → test for alternates in that same script.
// Order matters: kana/hangul are checked before han so Japanese/Korean text isn't labelled Chinese.
const QUERY_SCRIPTS = [
  { key: 'hebrew', re: /[֐-׿]/ },
  { key: 'arabic', re: /[؀-ۿݐ-ݿ]/ },
  { key: 'cyrillic', re: /[Ѐ-ӿ]/ },
  { key: 'greek', re: /[Ͱ-Ͽἀ-῿]/ },
  { key: 'kana', re: /[぀-ヿ]/ },
  { key: 'hangul', re: /[가-힯ᄀ-ᇿ]/ },
  { key: 'han', re: /[一-鿿]/ },
  { key: 'thai', re: /[฀-๿]/ },
  { key: 'devanagari', re: /[ऀ-ॿ]/ },
  { key: 'bengali', re: /[ঀ-৿]/ },
  { key: 'tamil', re: /[஀-௿]/ },
  { key: 'georgian', re: /[Ⴀ-ჿ]/ },
  { key: 'armenian', re: /[԰-֏]/ },
];

/** Detect the script of the search text; null = Latin / unknown (show name only). */
function detectQueryScript(query) {
  const text = String(query || '');
  const hit = QUERY_SCRIPTS.find((s) => s.re.test(text));
  return hit ? hit.key : null;
}

/** Lowercase, drop vowel marks / diacritics and separators so "תֵּל־אָבִיב" ≈ "תל אביב". */
function normalizeForMatch(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-֑ͯ-ׇً-ٰٟ]/g, '')
    .toLowerCase()
    .replace(/[\s\-‐-―־_'’]/g, '');
}

function scoreAlternateForScript(alt, en, script) {
  const c = (alt || '').trim();
  if (!c) return -1;
  if (script === 'hebrew') return scoreLocalAlternate(c, en, 'IL');
  const def = QUERY_SCRIPTS.find((s) => s.key === script);
  if (!def || !def.re.test(c) || /[A-Za-z]/.test(c)) return -1;
  return c.replace(/[\s\-–]/g, '').length;
}

/**
 * Label in the language the user typed: "name - <alternate in same script>".
 * Latin query, or no alternate in that script → just "name".
 *
 * Among alternates in the typed script, the one that matches the typed text wins
 * (exact, then prefix, then contains) — so "Москва" shows "Москва", not a variant
 * spelling or another language that shares the script. Hebrew keeps its
 * "fullest official name" preference (תל אביב → תל אביב-יפו).
 */
function formatCityLabelForQuery(row = {}, query = '') {
  const { name, asciiname, alternatenames } = row || {};
  const en = (name || asciiname || '').trim();
  if (!en) return { label: '', local_name: null };

  const script = detectQueryScript(query);
  if (!script) return { label: en, local_name: null };

  const q = normalizeForMatch(query);
  const candidates = [];
  for (const alt of parseAlternateNames(alternatenames)) {
    if (alt.toLowerCase() === en.toLowerCase()) continue;
    const score = scoreAlternateForScript(alt, en, script);
    if (score < 0) continue;
    const n = normalizeForMatch(alt);
    const tier = n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : 3;
    candidates.push({ alt, score, tier });
  }
  if (!candidates.length) return { label: en, local_name: null };

  // Hebrew: any alternate containing the typed text is eligible (so the fullest name wins);
  // other scripts: only the best match tier.
  const bestTier = Math.min(...candidates.map((c) => c.tier));
  const matching = candidates.filter((c) => c.tier <= 2);
  const pool = script === 'hebrew' && matching.length
    ? matching
    : candidates.filter((c) => c.tier === bestTier);
  // Hebrew: fullest official name among matches; others: exact match first, else shortest prefix match.
  const pick = pool.reduce((a, b) => {
    if (script === 'hebrew') return b.score > a.score ? b : a;
    return b.score < a.score ? b : a;
  });
  return { label: `${en} - ${pick.alt}`, local_name: pick.alt };
}

module.exports = { formatCityLabel, formatCityLabelForQuery, detectQueryScript, pickLocalName };
