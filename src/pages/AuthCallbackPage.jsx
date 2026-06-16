import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { consumeOAuthHashIfPresent } from '../lib/apiClient';
import { bootstrapClientRecordIfMissing } from '../supabase/auth';

function AuthCallbackPage() {
  const navigate = useNavigate();
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
      // sessionStorage invitation context) BEFORE landing on /profile. Without this,
      // Google sign-ups arrive at the OnboardingModal with no user_code, which
      // breaks the company resolution chain (user_code -> chat_users.provider_id
      // -> profiles.company_id -> companies.config). We never block navigation on
      // failure; the modal still works in its legacy "create at completion" mode.
      try {
        await bootstrapClientRecordIfMissing();
      } catch (e) {
        console.warn('[AuthCallback] client bootstrap failed (non-blocking):', e);
      }

      navigate('/profile', { replace: true });
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
      <div className="text-center">
        {error ? <p className="text-red-300">{error}</p> : <p>Signing you in…</p>}
      </div>
    </div>
  );
}

export default AuthCallbackPage;
