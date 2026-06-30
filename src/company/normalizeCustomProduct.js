const localizedEnglish = (value) => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.english || value.hebrew || '';
  return String(value);
};

const localizedHebrew = (value, fallback = '') => {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.hebrew || value.english || fallback;
  return fallback;
};

export const parseCompanyConfig = (config) => {
  if (!config) return null;
  if (typeof config === 'string') {
    try {
      return JSON.parse(config);
    } catch {
      return null;
    }
  }
  return config;
};

/** Read manager-created plans from every supported config path/shape. */
export const extractRawCustomProducts = (companyConfig) => {
  const config = parseCompanyConfig(companyConfig);
  const pricing = config?.pricing;
  if (!pricing || typeof pricing !== 'object') return [];

  const candidateLists = [
    pricing.customProducts,
    pricing.products,
    pricing.plans,
    pricing.custom_plans,
  ].filter(Array.isArray);

  const merged = candidateLists.flat();
  if (merged.length > 0) return merged;

  return [];
};

const normalizeFeatureList = (items = [], toHebrew = false) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => (toHebrew ? localizedHebrew(item, localizedEnglish(item)) : localizedEnglish(item)))
    .filter(Boolean);
};

const normalizeCurrency = (currency) => String(currency || 'usd').toUpperCase();

const coercePriceList = (product) => {
  if (Array.isArray(product?.prices) && product.prices.length > 0) return product.prices;
  if (Array.isArray(product?.priceOptions) && product.priceOptions.length > 0) return product.priceOptions;
  if (Array.isArray(product?.priceTiers) && product.priceTiers.length > 0) return product.priceTiers;
  if (product?.price && typeof product.price === 'object') return [product.price];

  // Admin flat shape: stripePriceId + numeric price + currency + interval
  if (product?.stripePriceId || product?.priceId) {
    const currency = normalizeCurrency(product.currency);
    const unitPrice = typeof product.price === 'number' ? product.price : null;
    const amountCents = product.amount != null
      ? product.amount
      : (unitPrice != null ? Math.round(unitPrice * 100) : undefined);

    const priceEntry = {
      id: product.stripePriceId || product.priceId,
      currency,
      interval: product.interval || null,
      interval_count: product.interval_count || 1,
      commitment: product.commitment,
      popular: product.popular,
      name: product.priceName || product.planName,
    };

    if (currency === 'USD') {
      priceEntry.amountUSD = amountCents;
      priceEntry.amount = amountCents;
    } else {
      priceEntry.amount = amountCents;
      priceEntry.amountUSD = product.amountUSD;
    }

    return [priceEntry];
  }

  if (typeof product?.price === 'number') {
    const currency = normalizeCurrency(product.currency);
    const amountCents = Math.round(product.price * 100);
    return [{
      id: product.stripePriceId || product.priceId || `custom-price-${product.id || 'unknown'}`,
      currency,
      interval: product.interval || null,
      interval_count: product.interval_count || 1,
      amount: currency === 'USD' ? amountCents : amountCents,
      amountUSD: currency === 'USD' ? amountCents : product.amountUSD,
      name: product.planName || product.priceName,
    }];
  }

  return [];
};

const normalizePrices = (prices = [], productIndex = 0) => {
  if (!Array.isArray(prices)) return [];

  return prices.map((price, priceIndex) => {
    const nameEn = localizedEnglish(price?.name) || localizedEnglish(price?.nameHebrew) || 'Plan';
    const nameHe = localizedHebrew(price?.nameHebrew || price?.name, nameEn);
    const descriptionEn = localizedEnglish(price?.description) || localizedEnglish(price?.descriptionHebrew);
    const descriptionHe = localizedHebrew(price?.descriptionHebrew || price?.description, descriptionEn);

    return {
      ...price,
      id: price?.id || price?.stripePriceId || price?.priceId || `custom-${productIndex}-price-${priceIndex}`,
      currency: normalizeCurrency(price?.currency),
      name: nameEn,
      nameHebrew: nameHe,
      description: descriptionEn,
      descriptionHebrew: descriptionHe,
    };
  });
};

/** Admin DB products use { english, hebrew } objects; PricingCard expects flat strings. */
export const normalizeCustomProduct = (product, index = 0) => {
  if (!product || typeof product !== 'object') return null;

  const nameSource = product.name || product.title || product.label || product.planName;
  const nameEn = localizedEnglish(nameSource) || localizedEnglish(product.nameHebrew);
  const nameHe = localizedHebrew(product.nameHebrew || nameSource, nameEn);

  const prices = normalizePrices(coercePriceList(product), index);
  const fallbackName = localizedEnglish(prices[0]?.name) || `Plan ${index + 1}`;

  if (!nameEn && !nameHe && !fallbackName) return null;

  const featuresEn = normalizeFeatureList(product.features, false);
  const featuresHe = product.featuresHebrew
    ? normalizeFeatureList(product.featuresHebrew, true)
    : normalizeFeatureList(product.features, true);

  const descriptionSource = product.description || product.subtitle || product.summary;

  return {
    ...product,
    configId: product.id,
    id: product.stripeProductId || product.stripe_product_id || product.productId || product.id || `custom-product-${index}`,
    name: nameEn || nameHe || fallbackName,
    nameHebrew: nameHe || nameEn || fallbackName,
    description: localizedEnglish(descriptionSource) || localizedEnglish(product.descriptionHebrew) || '',
    descriptionHebrew: localizedHebrew(product.descriptionHebrew || descriptionSource, localizedEnglish(descriptionSource)),
    frequencyDescription: localizedEnglish(product.frequencyDescription) || localizedEnglish(product.frequencyDescriptionHebrew) || '',
    frequencyDescriptionHebrew: localizedHebrew(product.frequencyDescriptionHebrew || product.frequencyDescription, ''),
    features: featuresEn.length ? featuresEn : featuresHe,
    featuresHebrew: featuresHe.length ? featuresHe : featuresEn,
    prices,
    category: String(product.category || 'nutrition').toLowerCase(),
    isCustomProduct: true,
  };
};

export const normalizeCustomProducts = (products = []) =>
  (Array.isArray(products) ? products : [])
    .map((product, index) => normalizeCustomProduct(product, index))
    .filter(Boolean);

export const resolvePricingCatalog = (companyConfig, getDefaultProducts) => {
  const config = parseCompanyConfig(companyConfig);
  const customProducts = normalizeCustomProducts(extractRawCustomProducts(config));
  const mergeWithDefaults = config?.pricing?.mergeDefaultProducts === true;

  if (customProducts.length > 0 && !mergeWithDefaults) {
    return customProducts;
  }

  if (customProducts.length > 0) {
    return [...customProducts, ...getDefaultProducts()];
  }

  return getDefaultProducts();
};
