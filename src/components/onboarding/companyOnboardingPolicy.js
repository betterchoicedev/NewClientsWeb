import { getCompanyConfig, normalizeCompanyName } from '../../company/getCompanyConfig';

export const getCompanyOnboardingPolicy = (companyName = '') => {
  const config = getCompanyConfig(companyName);
  return {
    normalizedCompanyName: normalizeCompanyName(companyName),
    companyKey: config.key || 'default',
    ...config.onboarding
  };
};

