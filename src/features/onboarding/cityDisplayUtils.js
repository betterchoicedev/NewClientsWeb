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
export function formatCityLabel(row = {}) {
  const { name, asciiname, alternatenames, country_code } = row || {};
  const en = (asciiname || name || '').trim();
  if (!en) return '';
  const local = pickLocalName({ name, asciiname, alternatenames, country_code });
  if (!local || local.toLowerCase() === en.toLowerCase()) return en;
  return `${en} - ${local}`;
}
