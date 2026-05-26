import defaultCompanyConfig from './defaultCompanyConfig';
import fitmamaCompanyConfig from './fitmamaCompanyConfig';

const configMap = {
  default: defaultCompanyConfig,
  betterchoice: defaultCompanyConfig,
  fitmama: fitmamaCompanyConfig
};

export function getCompanyConfig(slug) {
  // Hard fallback to the raw default object if slug is missing
  if (!slug) return defaultCompanyConfig;
  
  const normalizedSlug = slug.toLowerCase().trim();
  const selectedConfig = configMap[normalizedSlug] || defaultCompanyConfig;

  // Final line of defense: if the matched config file is corrupted or missing content keys
  if (!selectedConfig || !selectedConfig.content) {
    return defaultCompanyConfig;
  }

  return selectedConfig;
}