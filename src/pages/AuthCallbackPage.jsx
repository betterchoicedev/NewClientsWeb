import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { consumeOAuthHashIfPresent } from '../lib/apiClient';
import { bootstrapClientRecordIfMissing } from '../supabase/auth';
import { useLanguage } from '../context/LanguageContext';
import { AuthShell, AuthNotice } from '../components/brand/AuthShell';

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isHebrew = language === 'hebrew';
  const [error, setError] = useState('');
  // Guards against React 18 StrictMode double-invocation of the effect.
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      const consumed = consumeOAuthHashIfPresent();
      if (!consumed) {
        setError('Sign-in failed. Please try again.');
        setTimeout(() => navigate('/login'), 2500);
        return;
      }

      // Create the clients + chat_users rows (with provider_id resolved from the
      // sessionStorage invitation context) BEFORE landing on /account. Without this,
      // Google sign-ups arrive at onboarding with no user_code, which
      // breaks the company resolution chain (user_code -> chat_users.provider_id
      // -> profiles.company_id -> companies.config). We never block navigation on
      // failure; the modal still works in its legacy "create at completion" mode.
      try {
        await bootstrapClientRecordIfMissing();
      } catch (e) {
        console.warn('[AuthCallback] client bootstrap failed (non-blocking):', e);
      }

      navigate('/account', { replace: true });
    })();
  }, [navigate]);

  if (error) {
    return (
      <AuthShell
        footer={false}
        title={isHebrew ? 'ההתחברות לא הצליחה' : 'Sign-in didn’t work'}
        subtitle={isHebrew ? 'מחזירים אתכם למסך ההתחברות…' : 'Taking you back to login…'}
      >
        <AuthNotice>{isHebrew ? 'ההתחברות נכשלה. נסו שוב.' : error}</AuthNotice>
      </AuthShell>
    );
  }

  return (
    <AuthShell footer={false}>
      <div role="status" className="flex flex-col items-center gap-4">
        <span className="h-8 w-8 rounded-full border-2 border-bc-border border-t-bc-accent animate-spin" aria-hidden="true" />
        <p className="text-[15px] font-semibold text-bc-muted">
          {isHebrew ? 'מחברים אתכם…' : 'Signing you in…'}
        </p>
      </div>
    </AuthShell>
  );
}

export default AuthCallbackPage;
