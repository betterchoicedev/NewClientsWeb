import React, { useEffect, useState } from 'react';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useOnboardingStore, PHASES } from '../onboarding.store';
import { completeOnboardingAfterPayment, createCheckoutSession, getOnboardingStatus } from '../api/onboardingApi';
import { useOnboardingEntitlement } from '../OnboardingEntitlementContext';
import { isOnboardingHebrew } from '../onboardingLocale';
import { useOnboardingCommerce } from '../hooks/useOnboardingCommerce';
import OnboardingPanel, { GlassPrimaryButton, GlassSecondaryButton } from '../components/OnboardingPanel';
import CartSummary from '../components/CartSummary';

export default function PaymentPhase({ onComplete }) {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const { refresh: refreshEntitlement } = useOnboardingEntitlement();
  const language = useOnboardingStore((s) => s.answers.language);
  const companyId = useOnboardingStore((s) => s.companyId);
  const userCode = useOnboardingStore((s) => s.userCode);
  const forcePhase = useOnboardingStore((s) => s.forcePhase);
  const setError = useOnboardingStore((s) => s.setError);
  const error = useOnboardingStore((s) => s.error);
  const isHe = isOnboardingHebrew(language);

  const { selectedProductIds, selectedProducts, appliedPromo, totals } = useOnboardingCommerce(user?.id);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId;

    const finishAfterPayment = async () => {
      try {
        await completeOnboardingAfterPayment();
      } catch (e) {
        console.warn('[PaymentPhase] complete onboarding failed', e);
      }
      await refreshEntitlement();
      if (cancelled) return;
      setPolling(false);
      forcePhase(PHASES.DONE);
      onComplete?.(true);
    };

    const poll = async () => {
      try {
        const status = await getOnboardingStatus();
        if (cancelled) return;
        if (status.subscriptionStatus === 'active' || status.completed) {
          await finishAfterPayment();
        }
      } catch {
        /* retry */
      }
    };

    poll();
    intervalId = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [forcePhase, onComplete, refreshEntitlement]);

  const primaryPriceId = selectedProducts[0]?.prices?.[0]?.id;

  const handleCheckout = async () => {
    if (!user?.id) {
      setError(isHe ? 'משתמש לא מחובר' : 'Not signed in');
      return;
    }
    if (!selectedProductIds.length || !primaryPriceId) {
      setError(isHe ? 'בחרו מוצר לפני התשלום' : 'Select a product before checkout');
      return;
    }
    setCheckoutLoading(true);
    setError(null);
    try {
      const data = await createCheckoutSession({
        priceId: primaryPriceId,
        promoCode: appliedPromo?.type === 'discount' ? appliedPromo.code : undefined,
        companyId,
        productIds: selectedProductIds,
        metadata: { from: 'onboarding_commerce' },
      });
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error(data.error || (isHe ? 'שגיאה ביצירת תשלום' : 'Failed to create checkout'));
    } catch (e) {
      setError(e.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <OnboardingPanel
      maxWidthClass="max-w-2xl"
      footer={
        <div className="space-y-3">
          <GlassPrimaryButton
            className="w-full min-h-[3.25rem]"
            disabled={checkoutLoading || polling || !userCode || !selectedProductIds.length}
            onClick={handleCheckout}
          >
            <CreditCard size={18} aria-hidden />
            {checkoutLoading
              ? isHe
                ? 'מעביר לתשלום...'
                : 'Redirecting...'
              : isHe
                ? 'שלם עכשיו'
                : 'Pay now'}
          </GlassPrimaryButton>
          <GlassSecondaryButton className="w-full min-h-[3rem]" onClick={() => forcePhase(PHASES.PROMO)}>
            <ArrowLeft size={16} aria-hidden />
            {isHe ? 'חזרה לקופון' : 'Back to promo'}
          </GlassSecondaryButton>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <h2 className={`text-xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {isHe ? 'תשלום מאובטח' : 'Secure checkout'}
          </h2>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            {isHe
              ? 'לאחר אישור התשלום תוכלו להמשיך להשתמש באפליקציה'
              : 'After payment is confirmed you can continue using the app'}
          </p>
        </div>

        <CartSummary products={selectedProducts} totals={totals} appliedPromo={appliedPromo} isHe={isHe} />

        {polling ? (
          <p className={`text-xs ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
            {isHe ? 'מאמתים תשלום...' : 'Confirming payment...'}
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
