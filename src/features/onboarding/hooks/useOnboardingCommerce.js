import { useCallback, useEffect, useMemo } from 'react';
import { useOnboardingStore } from '../onboarding.store';
import { resolveCatalogProducts, computeCartTotals, promoAppliesToSelection } from '../utils/commercePricing';

const STORAGE_PREFIX = 'onboarding_commerce_';

function readStorage(userId) {
  if (!userId) return null;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorage(userId, payload) {
  if (!userId) return;
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

export function useOnboardingCommerce(userId) {
  const companyConfig = useOnboardingStore((s) => s.companyConfig);
  const selectedProductIds = useOnboardingStore((s) => s.selectedProductIds);
  const appliedPromo = useOnboardingStore((s) => s.appliedPromo);
  const setSelectedProductIds = useOnboardingStore((s) => s.setSelectedProductIds);
  const setAppliedPromo = useOnboardingStore((s) => s.setAppliedPromo);
  const hydrateCommerce = useOnboardingStore((s) => s.hydrateCommerce);

  const catalog = useMemo(() => resolveCatalogProducts(companyConfig), [companyConfig]);

  const selectedProducts = useMemo(
    () => catalog.filter((p) => selectedProductIds.includes(p.configId || p.id)),
    [catalog, selectedProductIds]
  );

  const totals = useMemo(
    () => computeCartTotals(selectedProducts, appliedPromo),
    [selectedProducts, appliedPromo]
  );

  useEffect(() => {
    if (!userId) return;
    const stored = readStorage(userId);
    if (stored) hydrateCommerce(stored);
  }, [userId, hydrateCommerce]);

  useEffect(() => {
    if (!userId) return;
    writeStorage(userId, { selectedProductIds, appliedPromo });
  }, [userId, selectedProductIds, appliedPromo]);

  const clearPromo = useCallback(() => setAppliedPromo(null), [setAppliedPromo]);

  const selectProduct = useCallback(
    (productId) => {
      if (!productId) return;
      const next = selectedProductIds[0] === productId ? selectedProductIds : [productId];
      setSelectedProductIds(next);
      if (appliedPromo && !promoAppliesToSelection(appliedPromo, next)) {
        setAppliedPromo(null);
      }
    },
    [selectedProductIds, appliedPromo, setSelectedProductIds, setAppliedPromo]
  );

  return {
    catalog,
    selectedProductIds,
    selectedProducts,
    appliedPromo,
    totals,
    selectProduct,
    setSelectedProductIds,
    setAppliedPromo,
    clearPromo,
  };
}
