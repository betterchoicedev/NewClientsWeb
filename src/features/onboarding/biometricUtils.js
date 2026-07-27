export const LBS_PER_KG = 2.20462;

export function kgToLbs(kg) {
  const n = Number(kg);
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(Math.round(n * LBS_PER_KG * 10) / 10);
}

export function lbsToKg(lbs) {
  const n = Number(lbs);
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(Math.round((n / LBS_PER_KG) * 10) / 10);
}

/** Display weight in the user's chosen unit; answers are always stored in kg. */
export function displayWeightKg(kg, unit = 'kg') {
  if (kg == null || kg === '') return '';
  return unit === 'lbs' ? kgToLbs(kg) : String(kg);
}

/** Parse user weight input into kg for storage. */
export function parseWeightInputToKg(value, unit = 'kg') {
  if (value == null || value === '') return '';
  if (unit === 'lbs') return lbsToKg(value);
  return String(value);
}
