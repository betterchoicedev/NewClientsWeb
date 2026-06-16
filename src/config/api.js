const PRODUCTION = {
  clientsApi: 'https://newclientsweb-615263253386.me-west1.run.app',
  dietitianApi: 'https://newdietitianweb-615263253386.europe-west3.run.app',
};

export const API_BASE_URL = (
  process.env.REACT_APP_API_URL || PRODUCTION.clientsApi
).replace(/\/$/, '');

function normalizeApiBase(url) {
  const base = (url || '').replace(/\/$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
}

/** Client app API (auth, profile, food logs, etc.). */
export const CLIENT_API_URL = normalizeApiBase(API_BASE_URL);

/** Landing validate — served by the dietitian API only. */
export const LANDING_API_URL = normalizeApiBase(
  process.env.REACT_APP_LANDING_API_URL ||
  process.env.REACT_APP_DIETITIAN_API_URL ||
  PRODUCTION.dietitianApi
);

export function landingApiPath(path) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${LANDING_API_URL}${suffix}`;
}
