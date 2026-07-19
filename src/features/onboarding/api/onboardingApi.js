import { getStoredSession, getApiUrl } from '../../../lib/apiClient';

const USAGE_BASED_PRICE_ID = 'price_1SyHX0HIeYfvCylDZyb1Lb3L';

function apiBase() {
  return getApiUrl();
}

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const session = getStoredSession();
    const token = session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch (_) {
    /* ignore */
  }
  return headers;
}

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function saveDraft({ draft, phase, stepIndex }) {
  const res = await fetch(`${apiBase()}/api/onboarding/draft`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ draft, phase, stepIndex }),
  });
  return parseJson(res);
}

export async function commitOnboarding({ answers, signal } = {}) {
  const res = await fetch(`${apiBase()}/api/onboarding/commit`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ answers }),
    signal,
  });
  return parseJson(res);
}

export async function getOnboardingStatus() {
  const res = await fetch(`${apiBase()}/api/onboarding/status`, {
    method: 'GET',
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function redeemAccessCode(code) {
  const res = await fetch(`${apiBase()}/api/onboarding/redeem-access-code`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ code }),
  });
  return parseJson(res);
}

export async function createCheckoutSession({ priceId = USAGE_BASED_PRICE_ID } = {}) {
  const res = await fetch(`${apiBase()}/api/stripe/create-checkout-session`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      priceId,
      mode: 'subscription',
      metadata: { from: 'onboarding_upsell' },
    }),
  });
  return parseJson(res);
}

export async function classifyActivity(activityDescription) {
  const res = await fetch(`${apiBase()}/api/onboarding/classify-activity`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ activityDescription }),
  });
  return parseJson(res);
}

export async function searchCities(q, { limit = 12, country, mode = 'full', signal } = {}) {
  if (!country) {
    throw new Error('country is required for city search');
  }
  const resolvedMode = mode === 'quick' ? 'quick' : 'full';
  const cappedLimit =
    resolvedMode === 'quick'
      ? Math.min(Math.max(limit, 1), 2)
      : Math.min(Math.max(limit, 1), 15);
  const params = new URLSearchParams({
    q,
    limit: String(cappedLimit),
    country: String(country).toUpperCase(),
    mode: resolvedMode,
  });
  const res = await fetch(`${apiBase()}/api/cities/search?${params}`, {
    headers: authHeaders(),
    signal,
  });
  return parseJson(res);
}

export { USAGE_BASED_PRICE_ID };
