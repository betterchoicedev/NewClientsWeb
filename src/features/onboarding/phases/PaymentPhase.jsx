import React, { useState } from 'react';
import { CreditCard, KeyRound } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useOnboardingStore, PHASES } from '../onboarding.store';
import { createCheckoutSession, redeemAccessCode } from '../api/onboardingApi';
import { isOnboardingHebrew } from '../onboardingLocale';
import OnboardingPanel, { GlassPrimaryButton, GlassSecondaryButton } from '../components/OnboardingPanel';
import { glassInputClass } from '../components/glassStyles';

export default function PaymentPhase() {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const language = useOnboardingStore((s) => s.answers.language);
  const isHe = isOnboardingHebrew(language);
  const userCode = useOnboardingStore((s) => s.userCode);
  const forcePhase = useOnboardingStore((s) => s.forcePhase);
  const setError = useOnboardingStore((s) => s.setError);
  const error = useOnboardingStore((s) => s.error);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [code, setCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const handleCheckout = async () => {
    if (!user?.id) {
      setError(isHe ? 'משתמש לא מחובר' : 'Not signed in');
      return;
    }
    if (!userCode) {
      setError(isHe ? 'חסר קוד משתמש — נסה שוב' : 'User code missing — please retry onboarding');
      return;
    }
    setCheckoutLoading(true);
    setError(null);
    try {
      const data = await createCheckoutSession();
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

  const handleRedeem = async () => {
    setCodeLoading(true);
    setError(null);
    try {
      const status = await redeemAccessCode(code);
      if (!status.valid && status.error) throw new Error(status.error);
      forcePhase(PHASES.PWA);
    } catch (e) {
      setError(e.message || (isHe ? 'קוד לא תקין' : 'Invalid code'));
    } finally {
      setCodeLoading(false);
    }
  };

  return (
    <OnboardingPanel
      maxWidthClass="max-w-lg"
      footer={
        <div className="space-y-3">
          <GlassPrimaryButton className="w-full" disabled={checkoutLoading || !userCode} onClick={handleCheckout}>
            <CreditCard size={18} aria-hidden />
            {checkoutLoading
              ? isHe
                ? 'מעביר לתשלום...'
                : 'Redirecting...'
              : isHe
                ? 'המשך לתשלום'
                : 'Continue to payment'}
          </GlassPrimaryButton>
          <GlassSecondaryButton className="w-full" onClick={() => setShowCode((v) => !v)}>
            <KeyRound size={16} aria-hidden />
            {isHe ? 'יש לך קוד גישה?' : 'Have an access code?'}
          </GlassSecondaryButton>
        </div>
      }
    >
      <div className="space-y-4">
        <h2 className={`text-xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {isHe ? 'המשך עם תמיכה תזונתית' : 'Continue with nutrition support'}
        </h2>
        <p className={`text-sm font-medium leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
          {isHe
            ? 'הפרופיל נשמר. בחר מנוי או הזן קוד גישה כדי להמשיך.'
            : 'Your profile is saved. Choose a plan or enter an access code to continue.'}
        </p>
        {userCode && (
          <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {isHe ? 'קוד משתמש' : 'User code'}: {userCode}
          </p>
        )}
        {error && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm backdrop-blur-md ${
              isDarkMode
                ? 'border-red-400/25 bg-red-950/40 text-red-200'
                : 'border-red-200/80 bg-red-50/80 text-red-700'
            }`}
          >
            {error}
          </div>
        )}
        {showCode && (
          <div className="space-y-2">
            <input
              className={glassInputClass(isDarkMode)}
              placeholder={isHe ? 'קוד גישה' : 'Access code'}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <GlassSecondaryButton
              className="w-full"
              disabled={codeLoading || !code.trim()}
              onClick={handleRedeem}
            >
              {codeLoading ? (isHe ? 'בודק...' : 'Checking...') : isHe ? 'הפעל קוד' : 'Redeem code'}
            </GlassSecondaryButton>
          </div>
        )}
      </div>
    </OnboardingPanel>
  );
}
