const STORAGE_KEY = 'onboarding_company_context';

function countCustomSteps(companyConfig) {
  const steps = companyConfig?.onboarding?.customSteps;
  if (!Array.isArray(steps)) return 0;
  return steps.filter((s) => s && (s.question || s.title || s.titleEn || s.label)).length;
}

export function pickBestCompanyContext(...sources) {
  const candidates = sources.filter(Boolean);
  const withCustom = candidates.find((c) => countCustomSteps(c.companyConfig) > 0);
  if (withCustom) return withCustom;
  const withConfig = candidates.find((c) => c.companyConfig && typeof c.companyConfig === 'object');
  if (withConfig) return withConfig;
  return candidates.find((c) => c.companyId) || null;
}

export function saveOnboardingCompanyContext({ companyId, companyName, companyConfig } = {}) {
  if (!companyId && !companyConfig) return;
  try {
    const existing = readOnboardingCompanyContext();
    const nextConfig = companyConfig || existing?.companyConfig || null;
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        companyId: companyId || existing?.companyId || null,
        companyName: companyName || existing?.companyName || null,
        companyConfig: nextConfig,
        savedAt: Date.now(),
      })
    );
  } catch (_) {
    /* ignore */
  }
}

export function readOnboardingCompanyContext() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

export function clearOnboardingCompanyContext() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (_) {
    /* ignore */
  }
}
