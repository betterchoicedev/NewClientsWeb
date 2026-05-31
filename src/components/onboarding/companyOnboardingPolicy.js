import { getCompanyConfig, normalizeCompanyName } from '../../company/getCompanyConfig';

/**
 * Resolves the active onboarding rules for a specific client tenant.
 */
export const getCompanyOnboardingPolicy = (companyName = '') => {
  const config = getCompanyConfig(companyName);
  return {
    normalizedCompanyName: normalizeCompanyName(companyName),
    companyKey: config.key || 'default',
    ...config.onboarding
  };
};