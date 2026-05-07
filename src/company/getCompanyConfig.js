import defaultCompanyConfig from './configs/defaultCompanyConfig';
import navyCompanyConfig from './configs/navyCompanyConfig';
import fitmamaCompanyConfig from './configs/fitmamaCompanyConfig';

const COMPANY_CONFIGS = {
  navy: navyCompanyConfig,
  fitmama: fitmamaCompanyConfig
};

export const normalizeCompanyName = (companyName = '') => String(companyName || '').trim().toLowerCase();

export const getCompanyConfig = (companyName = '') => {
  const normalizedCompanyName = normalizeCompanyName(companyName);
  return COMPANY_CONFIGS[normalizedCompanyName] || {
    ...defaultCompanyConfig,
    normalizedCompanyName
  };
};

