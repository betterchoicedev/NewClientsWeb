import defaultCompanyConfig from './defaultCompanyConfig';

const fitmamaCompanyConfig = {
  ...defaultCompanyConfig,
  key: 'fitmama',
  onboarding: {
    ...defaultCompanyConfig.onboarding,
    includeNursingStatusQuestion: true
  }
};

export default fitmamaCompanyConfig;

