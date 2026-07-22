import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Tag } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { useOnboardingStore, PHASES } from '../onboarding.store';
import { validateCompanyPromo, applyBypassPromo } from '../api/onboardingApi';
import { isOnboardingHebrew } from '../onboardingLocale';
import { useOnboardingCommerce } from '../hooks/useOnboardingCommerce';
import { promoAppliesToSelection } from '../utils/commercePricing';
import OnboardingPanel, { GlassPrimaryButton, GlassSecondaryButton } from '../components/OnboardingPanel';
import CartSummary from '../components/CartSummary';
import { glassInputClass } from '../components/glassStyles';

export default function PromoCodePhase() {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const language = useOnboardingStore((s) => s.answers.language);
  const companyId = useOnboardingStore((s) => s.companyId);
  const setCompany = useOnboardingStore((s) => s.setCompany);
  const forcePhase = useOnboardingStore((s) => s.forcePhase);
  const setError = useOnboardingStore((s) => s.setError);
  const error = useOnboardingStore((s) => s.error);
  const isHe = isOnboardingHebrew(language);

  const {
    selectedProductIds,
    selectedProducts,
    appliedPromo,
    totals,
    setAppliedPromo,
    clearPromo,
  } = useOnboardingCommerce(user?.id);

  const [code, setCode] = useState(appliedPromo?.code || '');
  const [validating, setValidating] = useState(false);
  const [applyingBypass, setApplyingBypass] = useState(false);

  const handleApply = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError(isHe ? 'הזינו קוד קופון' : 'Enter a promo code');
      return;
    }
    setValidating(true);
    setError(null);
    try {
      const result = await validateCompanyPromo({
        code: trimmed,
        companyId,
        productIds: selectedProductIds,
      });
      if (!result?.valid) {
        throw new Error(result?.error || (isHe ? 'קוד לא תקין' : 'Invalid promo code'));
      }
      if (!promoAppliesToSelection(result, selectedProductIds)) {
        throw new Error(isHe ? 'הקוד לא חל על המוצרים שנבחרו' : 'Code does not apply to selected products');
      }
      setAppliedPromo(result);
      if (result.companyConfig || result.companyName) {
        setCompany({
          companyConfig: result.companyConfig,
          companyName: result.companyName,
          companyId: result.companyId,
          includeNursingStatus: result.companyConfig?.onboarding?.includeNursingStatusQuestion !== false,
        });
      }
    } catch (e) {
      clearPromo();
      setError(e.message);
    } finally {
      setValidating(false);
    }
  };

  const handleContinue = async () => {
    setError(null);
    if (appliedPromo?.type === 'bypass' && appliedPromo?.valid) {
      setApplyingBypass(true);
      try {
        await applyBypassPromo({
          code: appliedPromo.code,
          companyId: appliedPromo.companyId,
          productIds: selectedProductIds,
        });
        forcePhase(PHASES.PWA);
      } catch (e) {
        setError(e.message || (isHe ? 'לא ניתן להפעיל את הקוד' : 'Could not apply bypass code'));
      } finally {
        setApplyingBypass(false);
      }
      return;
    }
    forcePhase(PHASES.PAYMENT);
  };

  const handleSkip = () => {
    clearPromo();
    setCode('');
    setError(null);
    forcePhase(PHASES.PAYMENT);
  };

  return (
    <OnboardingPanel
      maxWidthClass="max-w-2xl"
      footer={
        <div className="space-y-3">
          <GlassPrimaryButton
            className="w-full min-h-[3.25rem]"
            disabled={validating || applyingBypass || !selectedProductIds.length}
            onClick={handleContinue}
          >
            {applyingBypass
              ? isHe
                ? 'מפעיל קוד...'
                : 'Applying code...'
              : appliedPromo?.type === 'bypass'
                ? isHe
                  ? 'המשך'
                  : 'Continue'
                : isHe
                  ? 'המשך לתשלום'
                  : 'Continue to payment'}
            <ArrowRight size={18} aria-hidden />
          </GlassPrimaryButton>
          <GlassSecondaryButton className="w-full min-h-[3rem]" onClick={() => forcePhase(PHASES.PRODUCTS)}>
            <ArrowLeft size={16} aria-hidden />
            {isHe ? 'חזרה לבחירת מוצר' : 'Back to products'}
          </GlassSecondaryButton>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <h2 className={`text-xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {isHe ? 'קוד קופון' : 'Promo code'}
          </h2>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            {isHe ? 'הזינו קוד אם יש לכם — אפשר לדלג' : 'Apply a code if you have one — or skip'}
          </p>
        </div>

        <CartSummary products={selectedProducts} totals={totals} appliedPromo={appliedPromo} isHe={isHe} />

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className={`${glassInputClass(isDarkMode)} flex-1 min-h-[3.25rem] uppercase`}
            placeholder={isHe ? 'קוד קופון' : 'Promo code'}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleApply();
              }
            }}
          />
          <GlassSecondaryButton
            className="min-h-[3.25rem] px-6 shrink-0"
            disabled={validating || !code.trim()}
            onClick={handleApply}
          >
            <Tag size={16} aria-hidden />
            {validating ? (isHe ? 'בודק...' : 'Checking...') : isHe ? 'החל' : 'Apply'}
          </GlassSecondaryButton>
        </div>

        <button
          type="button"
          onClick={handleSkip}
          className={`w-full py-3 text-sm font-semibold rounded-xl transition-colors ${
            isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {isHe ? 'אין לי קוד — המשך לתשלום' : "I don't have a code — continue to payment"}
        </button>

        {appliedPromo?.valid ? (
          <p className={`text-sm font-medium ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
            {appliedPromo.type === 'bypass'
              ? isHe
                ? `✓ קוד ${appliedPromo.code} מעניק גישה חינמית`
                : `✓ Code ${appliedPromo.code} grants free access`
              : isHe
                ? `✓ קוד ${appliedPromo.code} — ${appliedPromo.percentageOff}% הנחה`
                : `✓ Code ${appliedPromo.code} — ${appliedPromo.percentageOff}% off`}
          </p>
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
