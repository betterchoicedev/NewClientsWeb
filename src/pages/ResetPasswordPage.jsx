import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { establishRecoverySession, updatePassword } from '../supabase/auth';
import { parseHashParams } from '../lib/apiClient';

function ResetPasswordPage() {
  const { language, direction, t, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme, themeClasses } = useTheme();
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
                ? 'קישור איפוס הסיסמה לא תקין או פג תוקפו. אנא בקש קישור חדש.'
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
              ? 'קישור איפוס הסיסמה לא תקין או פג תוקפו. אנא בקש קישור חדש.'
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
            ? 'שגיאה בעדכון הסיסמה. אנא נסה שוב.'
            : 'Error updating password. Please try again.'
        );
      } else {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 3000);
      }
    } catch (err) {
      console.error('Password update error:', err);
      setError(
        language === 'hebrew' ? 'אירעה שגיאה. אנא נסה שוב.' : 'An error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className={`min-h-screen ${themeClasses.bgPrimary} flex items-center justify-center`} dir={direction}>
        <p className={themeClasses.textPrimary}>
          {language === 'hebrew' ? 'בודק קישור...' : 'Checking link...'}
        </p>
      </div>
    );
  }

  if (!validSession) {
    return (
      <div className={`min-h-screen ${themeClasses.bgPrimary} flex items-center justify-center p-6`} dir={direction}>
        <div className="max-w-md text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Link to="/login" className="text-emerald-600 hover:underline">
            {language === 'hebrew' ? 'חזרה להתחברות' : 'Back to login'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.bgPrimary} language-transition`} dir={direction}>
      {/* Rest of UI unchanged — reuse existing layout from original file below success state */}
      <div className="max-w-md mx-auto pt-20 px-4">
        <h1 className={`text-2xl font-bold mb-6 ${themeClasses.textPrimary}`}>
          {language === 'hebrew' ? 'איפוס סיסמה' : 'Reset password'}
        </h1>
        {success ? (
          <p className="text-emerald-600">
            {language === 'hebrew'
              ? 'הסיסמה עודכנה בהצלחה! מעביר להתחברות...'
              : 'Password updated! Redirecting to login...'}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div>
              <label className={`block mb-1 ${themeClasses.textSecondary}`}>
                {language === 'hebrew' ? 'סיסמה חדשה' : 'New password'}
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-2 rounded-lg border"
                required
              />
            </div>
            <div>
              <label className={`block mb-1 ${themeClasses.textSecondary}`}>
                {language === 'hebrew' ? 'אימות סיסמה' : 'Confirm password'}
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full px-4 py-2 rounded-lg border"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading
                ? language === 'hebrew'
                  ? 'שומר...'
                  : 'Saving...'
                : language === 'hebrew'
                  ? 'עדכן סיסמה'
                  : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ResetPasswordPage;
