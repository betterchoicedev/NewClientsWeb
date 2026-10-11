export const IOS_URL = 'https://apps.apple.com/il/app/betterchoice-ai-co/id6770512379';
export const ANDROID_URL = 'https://play.google.com/store/apps/details?id=live.betterchoice.betterchoiceai';

/** 'ios' | 'android' | null. iPadOS reports as Mac, so check touch points too. */
export function detectMobilePlatform() {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return null;
}

/** The store for this device, or null on desktop (where we show both badges instead). */
export function getDirectStoreUrl() {
  const platform = detectMobilePlatform();
  if (platform === 'ios') return IOS_URL;
  if (platform === 'android') return ANDROID_URL;
  return null;
}
