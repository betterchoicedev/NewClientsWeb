/**
 * Returns { message, severity: 'error'|'warning' } or null.
 * - severity 'error': 10000+ g (possible kg typo)
 * - severity 'warning': >1500 g (large) or 0 < g < 5 (possible units vs grams)
 */
export function getWeightValidation(weightInGrams, language) {
  const w = parseFloat(weightInGrams);
  if (isNaN(w)) return null;

  if (w >= 10000) {
    return {
      message: language === 'hebrew'
        ? 'הזנת 10,000 גרם (10 קילו). האם הכוונה הייתה לגרמים?'
        : 'You entered 10,000 g (10 kg). Did you mean to enter 10 grams?',
      severity: 'error'
    };
  }
  if (w > 1500) {
    return {
      message: language === 'hebrew'
        ? 'כמות גדולה מהרגיל, נא לוודא שזו הכוונה'
        : 'Unusually large amount, please verify this is correct',
      severity: 'warning'
    };
  }
  if (w < 10 && w > 0) {
    return {
      message: language === 'hebrew'
        ? 'הזנת מספר נמוך מאוד. האם התכוונת ליחידות במקום גרמים?'
        : 'You entered a very small number. Did you mean units instead of grams?',
      severity: 'warning'
    };
  }
  return null;
}
