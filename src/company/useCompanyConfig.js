import { useMemo } from 'react';
import { getCompanyConfig } from './getCompanyConfig';

export const useCompanyConfig = (companyName) => {
  return useMemo(() => getCompanyConfig(companyName), [companyName]);
};

