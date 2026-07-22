import {
  extractRawCustomProducts,
  normalizeCustomProducts,
  parseCompanyConfig,
} from '../../../company/normalizeCustomProduct';

export function resolveCatalogProducts(companyConfig) {
  const config = parseCompanyConfig(companyConfig);
  return normalizeCustomProducts(extractRawCustomProducts(config));
}

export function getProductPriceCents(product) {
  const price = product?.prices?.[0];
  if (!price) return 0;
  if (price.amountUSD != null) return Number(price.amountUSD);
  if (price.amount != null) return Number(price.amount);
  return 0;
}

export function formatMoneyFromCents(cents, currency = 'USD') {
  const value = (Number(cents) || 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(currency || 'USD').toUpperCase(),
    minimumFractionDigits: 2,
  }).format(value);
}

export function computeCartTotals(selectedProducts, appliedPromo) {
  const subtotalCents = selectedProducts.reduce((sum, p) => sum + getProductPriceCents(p), 0);
  if (!appliedPromo?.valid) {
    return { subtotalCents, discountCents: 0, totalCents: subtotalCents };
  }
  if (appliedPromo.type === 'bypass') {
    return { subtotalCents, discountCents: subtotalCents, totalCents: 0 };
  }
  const pct = Math.min(100, Math.max(0, Number(appliedPromo.percentageOff) || 0));
  const discountCents = Math.round(subtotalCents * (pct / 100));
  return { subtotalCents, discountCents, totalCents: Math.max(0, subtotalCents - discountCents) };
}

export function promoAppliesToSelection(appliedPromo, selectedProductIds) {
  if (!appliedPromo?.valid) return true;
  if (appliedPromo.type === 'bypass') return true;
  const allowed = appliedPromo.productIds;
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  return selectedProductIds.some((id) => allowed.includes(id));
}
