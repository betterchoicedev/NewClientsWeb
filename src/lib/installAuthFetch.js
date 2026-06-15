/**
 * Patches global fetch to attach Bearer token for same-origin API calls.
 */
import { getAccessToken, getApiUrl } from './apiClient';

const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/check-email',
  '/api/auth/check-phone',
  '/api/auth/check-user-code',
  '/api/auth/check-registration-rule',
  '/api/auth/default-provider',
  '/api/auth/google',
  '/api/auth/oauth/callback',
  '/api/auth/reset-password',
  '/api/auth/recovery/session',
  '/api/webhooks/',
  '/api/exchange-rates',
  '/api/waiting-list/',
  '/api/contact',
  '/api/ingredient-reports',
  '/api/db/registration-links/find',
];

function isPublicApiUrl(urlString) {
  try {
    const path = new URL(urlString, window.location.origin).pathname;
    return PUBLIC_API_PATHS.some((p) => path.startsWith(p));
  } catch {
    return false;
  }
}

function shouldAttachAuth(urlString) {
  const apiBase = getApiUrl();
  if (!urlString.includes('/api/')) return false;
  if (!urlString.startsWith(apiBase) && !urlString.startsWith('/api/')) return false;
  if (isPublicApiUrl(urlString)) return false;
  return true;
}

const originalFetch = window.fetch.bind(window);

window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  const resolvedUrl = url.startsWith('/api/')
    ? `${getApiUrl()}${url}`
    : url;

  if (shouldAttachAuth(resolvedUrl) || shouldAttachAuth(url)) {
    const token = getAccessToken();
    if (token) {
      const headers = new Headers(init.headers || {});
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      init = { ...init, headers };
    }
  }

  if (url.startsWith('/api/') && !url.startsWith('http')) {
    const base = getApiUrl();
    const sameOrigin =
      typeof window !== 'undefined' && base === window.location.origin;
    return originalFetch(sameOrigin ? url : `${base}${url}`, init);
  }

  return originalFetch(input, init);
};
