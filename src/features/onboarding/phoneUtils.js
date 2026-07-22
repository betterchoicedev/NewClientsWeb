/** Digits-only local phone input (country code is selected separately). */
export function sanitizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

/** Match server normalizePhone() in onboarding.service.js */
export function normalizeOnboardingPhone(phone, countryCode = '+972') {
  let p = sanitizePhoneDigits(phone);
  if (!p) return '';
  if (p.startsWith('0') && countryCode === '+972') {
    return countryCode + p.substring(1);
  }
  return countryCode + p;
}

export function isValidPhoneDigits(phone) {
  const digits = sanitizePhoneDigits(phone);
  return digits.length >= 7 && digits.length <= 15;
}
