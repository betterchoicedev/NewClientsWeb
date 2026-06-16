/**
 * API client — all backend calls go through here with Bearer JWT.
 * No Supabase keys or clients in the browser.
 */

import { API_BASE_URL } from '../config/api';

const SESSION_KEY = 'bc_auth_session';

export const getApiUrl = () => API_BASE_URL;

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredSession(session) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new Event('bc-auth-changed'));
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event('bc-auth-changed'));
}

export function clearStoredSession() {
  setStoredSession(null);
}

export function getAccessToken() {
  return getStoredSession()?.access_token ?? null;
}

export function getAuthHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * @param {string} path - e.g. '/api/auth/me'
 * @param {RequestInit & { skipAuth?: boolean, parseJson?: boolean }} options
 */
export async function apiFetch(path, options = {}) {
  const { skipAuth = false, parseJson = true, headers: optHeaders, ...fetchOptions } = options;
  const url = path.startsWith('http') ? path : `${getApiUrl()}${path}`;

  const headers = {
    ...(fetchOptions.body && !(fetchOptions.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...optHeaders,
  };

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (!parseJson) {
    return response;
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(result.error || result.message || `Request failed (${response.status})`);
    err.status = response.status;
    err.data = result;
    throw err;
  }

  return result;
}

export function saveSessionFromAuthResponse(authPayload) {
  const session = authPayload?.session ?? authPayload;
  if (!session?.access_token) return false;
  setStoredSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
  });
  return true;
}

export function parseHashParams() {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return {};
  return Object.fromEntries(new URLSearchParams(hash));
}

/** True if URL hash contains Supabase OAuth tokens (after Google sign-in). */
export function hasOAuthHash() {
  return window.location.hash.includes('access_token=');
}

/**
 * Save session from #access_token=… in the URL (Supabase implicit OAuth).
 * Returns true if tokens were consumed.
 */
export function consumeOAuthHashIfPresent() {
  if (!hasOAuthHash()) return false;

  const params = parseHashParams();
  const access_token = params.access_token;
  const refresh_token = params.refresh_token;

  if (!access_token || !refresh_token) return false;

  saveSessionFromAuthResponse({
    access_token,
    refresh_token,
    expires_at: params.expires_at ? Number(params.expires_at) : undefined,
    expires_in: params.expires_in ? Number(params.expires_in) : undefined,
  });

  const cleanUrl =
    window.location.pathname + window.location.search;
  window.history.replaceState(null, '', cleanUrl || '/');
  return true;
}
