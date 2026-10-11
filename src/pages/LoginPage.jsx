import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogle, resetPassword, signIn } from '../supabase/auth';
import { AuthShell, AuthField, AuthNotice, AuthDivider, GoogleIcon } from '../components/brand/AuthShell';
import { card, primaryButton, secondaryButton, focusClass } from '../components/brand/ui';

function LoginPage() {
  const { language, toggleLanguage } = useLanguage();
  const isHebrew = language === 'hebrew';
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [socialLoading, setSocialLoading] = useState(false);
  
  // Forgot Password Modal State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/account');
    }
  }, [isAuthenticated, navigate]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleGoogleSignIn = async () => {
    setSocialLoading(true);
    setError('');
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setError(language === 'hebrew' 
          ? 'שגיאה בהתחברות עם Google. נסו שוב.' 
          : 'Error signing in with Google. Please try again.');
        setSocialLoading(false);
      }
    } catch (err) {
      console.error('Google sign in error:', err);
      setError(language === 'hebrew' 
        ? 'שגיאה בהתחברות עם Google' 
        : 'Error signing in with Google');
      setSocialLoading(false);
    }
  };

  const handleForgotPasswordClick = (e) => {
    e.preventDefault();
    setShowForgotPassword(true);
    setResetEmail(formData.email); 
    setResetSuccess(false);
    setResetError('');
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError('');
    
    try {
      const { error } = await resetPassword(resetEmail);
      
      if (error) {
        setResetError(language === 'hebrew' 
          ? 'שגיאה בשליחת קישור איפוס סיסמה. נסו שוב.' 
          : 'Error sending password reset link. Please try again.');
      } else {
        setResetSuccess(true);
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setResetError(language === 'hebrew' 
        ? 'אירעה שגיאה. נסו שוב.' 
        : 'An error occurred. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPassword(false);
    // Slight delay to allow unmount animation to finish before clearing state
    setTimeout(() => {
      setResetEmail('');
      setResetSuccess(false);
      setResetError('');
    }, 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: signInError, language: langPref } = await signIn(
        formData.email,
        formData.password
      );

      if (signInError) {
        setError(signInError.message || (language === 'hebrew' ? 'שגיאה בהתחברות' : 'Login failed'));
        setLoading(false);
        return;
      }

      if (!data?.session) {
        setError(language === 'hebrew' ? 'שגיאה בהתחברות' : 'Login failed');
        setLoading(false);
        return;
      }

      const result = { language: langPref };

      // Login successful - sync language preference if available
      if (result.language?.user_language) {
        const languageMap = {
          'en': 'english',
          'he': 'hebrew',
          'english': 'english',
          'hebrew': 'hebrew'
        };
        const webLanguage = languageMap[result.language.user_language.toLowerCase()] || 'english';
        
        if (language !== webLanguage) {
          toggleLanguage();
        }
      }

      navigate('/account');
    } catch (err) {
      console.error('Login error:', err);
      setError(language === 'hebrew' ? 'אירעה שגיאה בהתחברות' : 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const linkClass = `font-semibold text-bc-text underline underline-offset-4 decoration-bc-border hover:decoration-bc-accent rounded ${focusClass}`;

  return (
    <AuthShell
      title={isHebrew ? 'ברוכים השבים' : 'Welcome back'}
      subtitle={isHebrew ? 'התחברו לניהול החשבון שלכם' : 'Log in to manage your account'}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {error ? <AuthNotice>{error}</AuthNotice> : null}
        <AuthField
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          required
          label={isHebrew ? 'אימייל' : 'Email'}
          placeholder="name@example.com"
          value={formData.email}
          onChange={handleInputChange}
        />
        <AuthField
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          required
          label={isHebrew ? 'סיסמה' : 'Password'}
          value={formData.password}
          onChange={handleInputChange}
          action={
            <button type="button" onClick={handleForgotPasswordClick} className={`mb-2 text-[13px] font-semibold text-bc-muted hover:text-bc-text rounded ${focusClass}`}>
              {isHebrew ? 'שכחתם סיסמה?' : 'Forgot password?'}
            </button>
          }
        />
        <button type="submit" disabled={loading || socialLoading} className={`${primaryButton} w-full mt-2`}>
          {loading ? (isHebrew ? 'מתחבר…' : 'Logging in…') : isHebrew ? 'התחברות' : 'Log in'}
        </button>
      </form>

      <AuthDivider label={isHebrew ? 'או' : 'or'} />

      <button type="button" onClick={handleGoogleSignIn} disabled={loading || socialLoading} className={`${secondaryButton} w-full min-h-[48px]`}>
        <GoogleIcon />
        {socialLoading ? (isHebrew ? 'מתחבר…' : 'Connecting…') : isHebrew ? 'המשך עם Google' : 'Continue with Google'}
      </button>

      <p className="mt-8 text-center text-[15px] font-semibold text-bc-muted">
        {isHebrew ? 'אין לכם חשבון? ' : 'New to BetterChoice? '}
        <Link to="/#download" className={linkClass}>{isHebrew ? 'הורידו את האפליקציה' : 'Download the app'}</Link>
      </p>

      {showForgotPassword ? (
        <ResetDialog
          isHebrew={isHebrew}
          email={resetEmail}
          setEmail={setResetEmail}
          loading={resetLoading}
          success={resetSuccess}
          error={resetError}
          onSubmit={handleResetPassword}
          onClose={closeForgotPasswordModal}
        />
      ) : null}
    </AuthShell>
  );
}

function ResetDialog({ isHebrew, email, setEmail, loading, success, error, onSubmit, onClose }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    panelRef.current?.querySelector('input, button')?.focus();
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={`relative w-full max-w-md p-6 sm:p-8 ${card}`}
      >
        <h2 id="reset-title" className="text-[22px] font-bold text-bc-text">
          {success ? (isHebrew ? 'בדקו את האימייל' : 'Check your email') : isHebrew ? 'איפוס סיסמה' : 'Reset password'}
        </h2>
        {success ? (
          <>
            <p className="mt-2 text-[15px] font-semibold text-bc-muted">
              {isHebrew ? `שלחנו קישור לאיפוס סיסמה אל ${email}.` : `We sent a password reset link to ${email}.`}
            </p>
            <button type="button" onClick={onClose} className={`${primaryButton} w-full mt-6`}>
              {isHebrew ? 'סגירה' : 'Done'}
            </button>
          </>
        ) : (
          <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-4">
            <p className="text-[15px] font-semibold text-bc-muted">
              {isHebrew ? 'הזינו את האימייל של החשבון ונשלח קישור לאיפוס.' : 'Enter your account email and we will send a reset link.'}
            </p>
            {error ? <AuthNotice>{error}</AuthNotice> : null}
            <AuthField
              id="reset-email"
              type="email"
              dir="ltr"
              autoComplete="email"
              required
              label={isHebrew ? 'אימייל' : 'Email'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="flex flex-wrap justify-end gap-3 mt-2">
              <button type="button" onClick={onClose} className={secondaryButton}>{isHebrew ? 'ביטול' : 'Cancel'}</button>
              <button type="submit" disabled={loading || !email} className={primaryButton}>
                {loading ? (isHebrew ? 'שולח…' : 'Sending…') : isHebrew ? 'שליחת קישור' : 'Send link'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

export default LoginPage;
