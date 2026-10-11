import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { establishRecoverySession, updatePassword } from '../supabase/auth';
import { parseHashParams } from '../lib/apiClient';
import { AuthShell, AuthField, AuthNotice } from '../components/brand/AuthShell';
import { primaryButton } from '../components/brand/ui';

function ResetPasswordPage() {
  const { language } = useLanguage();
  const isHebrew = language === 'hebrew';
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const initRecovery = async () => {
      try {
        const params = parseHashParams();
        const access_token = params.access_token;
        const refresh_token = params.refresh_token;

        if (access_token && refresh_token) {
          const { error: sessionError } = await establishRecoverySession(
            access_token,
            refresh_token
          );
          if (sessionError) {
            setValidSession(false);
            setError(
              language === 'hebrew'
                ? 'קישור איפוס הסיסמה לא תקין או פג תוקפו. בקשו קישור חדש.'
                : 'Invalid or expired password reset link. Please request a new one.'
            );
          } else {
            setValidSession(true);
            window.history.replaceState(null, '', window.location.pathname);
          }
        } else {
          setValidSession(false);
          setError(
            language === 'hebrew'
              ? 'קישור איפוס הסיסמה לא תקין או פג תוקפו. בקשו קישור חדש.'
              : 'Invalid or expired password reset link. Please request a new one.'
          );
        }
      } catch (err) {
        console.error('Session check error:', err);
        setValidSession(false);
        setError(
          language === 'hebrew' ? 'שגיאה בבדיקת הקישור' : 'Error checking link'
        );
      } finally {
        setCheckingSession(false);
      }
    };

    initRecovery();
  }, [language]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const validatePassword = () => {
    if (formData.password.length < 6) {
      setError(
        language === 'hebrew'
          ? 'הסיסמה חייבת להכיל לפחות 6 תווים'
          : 'Password must be at least 6 characters'
      );
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError(
        language === 'hebrew' ? 'הסיסמאות אינן תואמות' : 'Passwords do not match'
      );
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!validatePassword()) {
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await updatePassword(formData.password);
      if (updateError) {
        setError(
          language === 'hebrew'
            ? 'שגיאה בעדכון הסיסמה. נסו שוב.'
            : 'Error updating password. Please try again.'
        );
      } else {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 3000);
      }
    } catch (err) {
      console.error('Password update error:', err);
      setError(
        language === 'hebrew' ? 'אירעה שגיאה. נסו שוב.' : 'An error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <AuthShell footer={false}>
        <div role="status" className="flex flex-col items-center gap-4">
          <span className="h-8 w-8 rounded-full border-2 border-bc-border border-t-bc-accent animate-spin" aria-hidden="true" />
          <p className="text-[15px] font-semibold text-bc-muted">
            {isHebrew ? 'בודקים את הקישור…' : 'Checking your link…'}
          </p>
        </div>
      </AuthShell>
    );
  }

  if (!validSession) {
    return (
      <AuthShell
        title={isHebrew ? 'הקישור לא תקין' : 'This link is not valid'}
        subtitle={isHebrew ? 'בקשו קישור חדש ממסך ההתחברות.' : 'Request a new one from the login screen.'}
      >
        <div className="flex flex-col gap-6">
          {error ? <AuthNotice>{error}</AuthNotice> : null}
          <Link to="/login" className={`${primaryButton} w-full`}>
            {isHebrew ? 'חזרה להתחברות' : 'Back to login'}
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell
        title={isHebrew ? 'הסיסמה עודכנה' : 'Password updated'}
        subtitle={isHebrew ? 'מעבירים אתכם להתחברות…' : 'Taking you to login…'}
      >
        <AuthNotice tone="success">
          {isHebrew ? 'אפשר להתחבר עכשיו עם הסיסמה החדשה.' : 'You can now log in with your new password.'}
        </AuthNotice>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={isHebrew ? 'בחירת סיסמה חדשה' : 'Set a new password'}
      subtitle={isHebrew ? 'לפחות 6 תווים.' : 'At least 6 characters.'}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error ? <AuthNotice>{error}</AuthNotice> : null}
        <AuthField
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          required
          label={isHebrew ? 'סיסמה חדשה' : 'New password'}
          value={formData.password}
          onChange={handleInputChange}
        />
        <AuthField
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          required
          label={isHebrew ? 'אימות סיסמה' : 'Confirm password'}
          value={formData.confirmPassword}
          onChange={handleInputChange}
        />
        <button type="submit" disabled={loading} className={`${primaryButton} w-full mt-2`}>
          {loading ? (isHebrew ? 'שומרים…' : 'Saving…') : isHebrew ? 'עדכון סיסמה' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  );
}

export default ResetPasswordPage;
