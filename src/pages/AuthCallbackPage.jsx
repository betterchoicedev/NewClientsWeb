import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseHashParams, saveSessionFromAuthResponse } from '../lib/apiClient';

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = parseHashParams();
    const access_token = params.access_token;
    const refresh_token = params.refresh_token;

    if (!access_token || !refresh_token) {
      setError('Sign-in failed. Please try again.');
      setTimeout(() => navigate('/login'), 2500);
      return;
    }

    saveSessionFromAuthResponse({
      access_token,
      refresh_token,
      expires_at: params.expires_at ? Number(params.expires_at) : undefined,
      expires_in: params.expires_in ? Number(params.expires_in) : undefined,
    });

    window.history.replaceState(null, '', window.location.pathname);
    navigate('/profile', { replace: true });
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
