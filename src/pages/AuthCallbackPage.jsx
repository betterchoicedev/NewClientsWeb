import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { consumeOAuthHashIfPresent } from '../lib/apiClient';

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (consumeOAuthHashIfPresent()) {
      navigate('/profile', { replace: true });
      return;
    }
    setError('Sign-in failed. Please try again.');
    setTimeout(() => navigate('/login'), 2500);
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
