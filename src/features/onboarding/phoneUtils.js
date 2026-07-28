/** Digits-only local phone input (country code is selected separately). */
export function sanitizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Per-prefix local digit rules. Length is checked on the national number
 * (after optional leading-zero strip for countries like IL).
 */
export const PHONE_DIGIT_RULES = {
  '+972': { min: 9, max: 9, inputMaxLength: 10, stripLeadingZero: true },
};

export const DEFAULT_PHONE_DIGIT_RULE = { min: 7, max: 15 };

export function getPhoneDigitRule(countryCode = '+972') {
  return PHONE_DIGIT_RULES[countryCode] || DEFAULT_PHONE_DIGIT_RULE;
}

/** Local digits used for length validation (strips IL leading 0 when applicable). */
export function normalizeLocalPhoneDigits(phone, countryCode = '+972') {
  let digits = sanitizePhoneDigits(phone);
  if (!digits) return '';
  const rule = getPhoneDigitRule(countryCode);
  if (rule.stripLeadingZero && digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  return digits;
}

export function getPhoneInputMaxLength(countryCode = '+972') {
  const rule = getPhoneDigitRule(countryCode);
  return rule.inputMaxLength ?? rule.max;
}

/** Match server normalizePhone() in onboarding.service.js */
export function normalizeOnboardingPhone(phone, countryCode = '+972') {
  const localDigits = normalizeLocalPhoneDigits(phone, countryCode);
  if (!localDigits) return '';
  return countryCode + localDigits;
}

export function isValidPhoneDigits(phone, countryCode = '+972') {
  const localDigits = normalizeLocalPhoneDigits(phone, countryCode);
  const { min, max } = getPhoneDigitRule(countryCode);
  return localDigits.length >= min && localDigits.length <= max;
}

export function getPhoneDigitValidationMessage(countryCode = '+972', isHe = false) {
  const rule = getPhoneDigitRule(countryCode);
  if (rule.stripLeadingZero && rule.min === rule.max) {
    return isHe
      ? `נא להזין ${rule.min} ספרות ללא האפס המוביל (למשל 501234567)`
      : `Enter ${rule.min} digits without the leading 0 (e.g. 501234567)`;
  }
  const { min, max } = rule;
  if (min === max) {
    return isHe
      ? `מספר הטלפון חייב להכיל בדיוק ${min} ספרות`
      : `Phone number must be exactly ${min} digits`;
  }
  return isHe
    ? `מספר הטלפון חייב להכיל ${min}–${max} ספרות`
    : `Phone number must be ${min}–${max} digits`;
}
