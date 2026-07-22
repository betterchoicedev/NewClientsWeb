import React, { useEffect, useState } from 'react';
import { ArrowRight, Package } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { useOnboardingStore, PHASES } from '../onboarding.store';
import { initCommerceSession } from '../api/onboardingApi';
import { isOnboardingHebrew } from '../onboardingLocale';
import { useOnboardingCommerce } from '../hooks/useOnboardingCommerce';
import OnboardingPanel, { GlassPrimaryButton } from '../components/OnboardingPanel';
import ProductCard from '../components/ProductCard';
import CartSummary from '../components/CartSummary';

export default function ProductSelectionPhase() {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const language = useOnboardingStore((s) => s.answers.language);
  const companyId = useOnboardingStore((s) => s.companyId);
  const forcePhase = useOnboardingStore((s) => s.forcePhase);
  const setUserCode = useOnboardingStore((s) => s.setUserCode);
  const setCompany = useOnboardingStore((s) => s.setCompany);
  const setError = useOnboardingStore((s) => s.setError);
  const error = useOnboardingStore((s) => s.error);
  const isHe = isOnboardingHebrew(language);

  const { catalog, selectedProductIds, selectedProducts, appliedPromo, totals, selectProduct } =
    useOnboardingCommerce(user?.id);

  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        setBootstrapping(false);
        return;
      }
      try {
        const result = await initCommerceSession({ companyId });
        if (!cancelled && result?.userCode) setUserCode(result.userCode);
        if (!cancelled && result?.companyConfig) {
          setCompany({
            companyConfig: result.companyConfig,
            companyName: result.companyName,
            companyId: result.companyId,
            includeNursingStatus: result.companyConfig?.onboarding?.includeNursingStatusQuestion !== false,
          });
        }
      } catch (e) {
        if (!cancelled) setError(e.message || (isHe ? 'שגיאה בהכנת החשבון' : 'Failed to prepare account'));
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, companyId, setUserCode, setCompany, setError, isHe]);

  const handleContinue = () => {
    setError(null);
    if (!selectedProductIds.length) {
      setError(isHe ? 'בחרו תוכנית' : 'Select a plan');
      return;
    }
    forcePhase(PHASES.PROMO);
  };

  return (
    <OnboardingPanel
      maxWidthClass="max-w-2xl"
      footer={
        <GlassPrimaryButton
          className="w-full min-h-[3.25rem]"
          disabled={bootstrapping || !selectedProductIds.length}
          onClick={handleContinue}
        >
          {isHe ? 'המשך לקופון' : 'Continue to promo'}
          <ArrowRight size={18} aria-hidden />
        </GlassPrimaryButton>
      }
    >
      <div className="space-y-5">
        <div>
          <h2 className={`text-xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {isHe ? 'בחרו תוכנית' : 'Choose your plan'}
          </h2>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            {isHe ? 'בחרו תוכנית אחת להמשך' : 'Choose one plan to continue'}
          </p>
        </div>

        {bootstrapping ? (
          <div className="py-12 flex justify-center">
            <div className="w-9 h-9 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : catalog.length === 0 ? (
          <div className={`rounded-2xl border p-8 text-center ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
            <Package className={`w-10 h-10 mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
            <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
              {isHe ? 'אין מוצרים זמינים כרגע' : 'No products available right now'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-1" role="radiogroup" aria-label={isHe ? 'בחירת תוכנית' : 'Plan selection'}>
            {catalog.map((product) => (
              <ProductCard
                key={product.configId || product.id}
                product={product}
                selected={selectedProductIds[0] === (product.configId || product.id)}
                onSelect={selectProduct}
                isHe={isHe}
              />
            ))}
          </div>
        )}

        {selectedProducts.length > 0 ? (
          <CartSummary products={selectedProducts} totals={totals} appliedPromo={appliedPromo} isHe={isHe} />
        ) : null}

        {error ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              isDarkMode ? 'border-red-400/25 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {error}
          </div>
        ) : null}
      </div>
    </OnboardingPanel>
  );
}
