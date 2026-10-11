import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { checkEmailExists, signInWithGoogle, signUp } from '../supabase/auth';
import { saveSessionFromAuthResponse } from '../lib/apiClient';
import { readOnboardingCompanyContext, saveOnboardingCompanyContext } from '../features/onboarding/onboardingCompanyContext';
import { AuthShell, AuthField, AuthNotice, AuthDivider, GoogleIcon } from '../components/brand/AuthShell';
import { primaryButton, secondaryButton, focusClass } from '../components/brand/ui';

async function ensureOnboardingCompanyContext(managerId, linkId) {
  const existing = readOnboardingCompanyContext();
  if (existing?.companyConfig?.onboarding?.customSteps?.length) return;
  if (!managerId && !linkId) return;
  const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
  try {
    const response = await fetch(`${apiUrl}/api/landing/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managerId: managerId || null, linkId: linkId || null }),
    });
    const resData = await response.json();
    if (!response.ok) return;
    saveOnboardingCompanyContext({
      companyId: resData.company?.id,
      companyName: resData.company?.name,
      companyConfig: resData.company?.config || {},
    });
  } catch (_) {
    /* ignore */
  }
}

function SignupPage() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
    newsletter: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [socialLoading, setSocialLoading] = useState(false);
  const [dietitianId, setDietitianId] = useState(null);
  const [invitationToken, setInvitationToken] = useState(null);
  const [hasInvitationToken, setHasInvitationToken] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [dismissMobileAppBridge, setDismissMobileAppBridge] = useState(false);

  const APP_STORE_URL = 'https://apps.apple.com/il/app/betterchoice-ai-co/id6770512379';
  const APPLE_APP_ID = '6770512379';

  const getActiveInvitationToken = () =>
    invitationToken || window.location.hash.match(/[#&]d=([^&]*)/)?.[1] || null;

  // iOS-only for now; extend with `|| isAndroid` when the Android app is available
  const showMobileAppBridge = isIOS && hasInvitationToken && !dismissMobileAppBridge;

  const detectPlatform = () => {
    const userAgent = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
    const isAndroidDevice = /android/i.test(userAgent);
    const isIOSDevice =
      /iphone|ipad|ipod/i.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return { isIOSDevice, isAndroidDevice };
  };

  useEffect(() => {
    const updatePlatformState = () => {
      const { isIOSDevice, isAndroidDevice } = detectPlatform();
      setIsIOS(isIOSDevice);
      setIsAndroid(isAndroidDevice);
    };

    updatePlatformState();
    window.addEventListener('resize', updatePlatformState);

    return () => window.removeEventListener('resize', updatePlatformState);
  }, []);

  useEffect(() => {
    if (!isIOS || !hasInvitationToken) return undefined;

    const token = getActiveInvitationToken();
    if (!token) return undefined;

    const metaContent = `app-id=${APPLE_APP_ID}, app-argument=https://betterchoice.one/signup#d=${token}`;
    let meta = document.querySelector('meta[name="apple-itunes-app"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'apple-itunes-app');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', metaContent);

    return () => {
      meta.remove();
    };
  }, [isIOS, hasInvitationToken, invitationToken]);

  // Decode #d= value: new limited #d=base64(JSON{link_id,manager_id,max_clients?,expiry_date?}) or old simple #d=base64(manager_id).
  // Returns { link_id?, manager_id, isLimited } or null.
  const decodeRegistrationHash = (base64Token) => {
    try {
      if (!base64Token) return null;
      const decoded = atob(base64Token);
      try {
        const obj = JSON.parse(decoded);
        if (obj && obj.link_id) {
          return { link_id: obj.link_id, manager_id: obj.manager_id || null, isLimited: true };
        }
        if (obj && obj.manager_id) {
          return { manager_id: obj.manager_id, isLimited: false };
        }
      } catch (_) {}
      return { manager_id: decoded, isLimited: false };
    } catch (e) {
      console.error('Error decoding #d=:', e);
      return null;
    }
  };

  // Check #d= in hash, decode (limited vs simple), store for find/check. Returns true if valid format.
  const checkInvitationToken = () => {
    try {
      const hash = window.location.hash;
      if (!hash) return false;
      const match = hash.match(/[#&]d=([^&]*)/);
      if (!match || !match[1]) return false;
      const base64Token = match[1];
      setInvitationToken(base64Token);
      localStorage.setItem('deferred_invitation_token', base64Token);
      const linkData = decodeRegistrationHash(base64Token);
      if (!linkData) return false;
      
      // Merge with existing to preserve manager_id if already resolved
      let existingData = {};
      try {
        const raw = sessionStorage.getItem('manager_link_data');
        if (raw) existingData = JSON.parse(raw);
      } catch (e) {}

      sessionStorage.setItem('manager_link_data', JSON.stringify({ 
        link_id: linkData.link_id || existingData.link_id || undefined, 
        manager_id: linkData.manager_id || existingData.manager_id || undefined 
      }));
      return true;
    } catch (e) {
      console.error('Error checking invitation token:', e);
      return false;
    }
  };

  // Get manager_id from #d= for referral/legacy (used when no invitation token path).
  const getDietitianIdFromHash = () => {
    try {
      const match = window.location.hash?.match(/[#&]d=([^&]*)/);
      if (!match || !match[1]) return null;
      const d = decodeRegistrationHash(match[1]);
      return d?.manager_id || null;
    } catch (e) {
      return null;
    }
  };

  // Check for invitation token and extract dietitian ID on component mount
  useEffect(() => {
    const initializeSignup = async () => {
      // Check if invitation token exists in URL (just check for #d= parameter)
      const hasToken = checkInvitationToken();
      setHasInvitationToken(hasToken);
      
      if (hasToken) {
        const token = invitationToken || window.location.hash.match(/[#&]d=([^&]*)/)?.[1];
        if (token) sessionStorage.setItem('invitation_token', token);
        let md = null;
        try { const raw = sessionStorage.getItem('manager_link_data'); if (raw) md = JSON.parse(raw); } catch (_) {}
        const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
        try {
          if (md?.link_id) {
            const r = await fetch(`${apiUrl}/api/db/registration-links/find`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link_id: md.link_id }) });
            const row = await r.json().catch(() => ({}));
            if (!r.ok || !row.manager_id) { setError(language === 'hebrew' ? 'קישור ההרשמה לא נמצא או לא תקף' : (row?.error || 'Registration link not found or invalid')); setHasInvitationToken(false); }
            else if (row.expires_at && new Date(row.expires_at) < new Date()) { setError(language === 'hebrew' ? 'קישור ההרשמה פג תוקף' : 'This registration link has expired'); setHasInvitationToken(false); }
            else if (row.max_slots != null && (row.current_count || 0) >= row.max_slots) { setError(language === 'hebrew' ? 'קישור ההרשמה הגיע למגבלת המשתמשים' : `This link has reached the maximum number of slots (${row.max_slots})`); setHasInvitationToken(false); }
            else if (!row.is_active) { setError(language === 'hebrew' ? 'קישור ההרשמה אינו פעיל' : 'This registration link is no longer active'); setHasInvitationToken(false); }
            else { sessionStorage.setItem('manager_link_data', JSON.stringify({ ...md, manager_id: row.manager_id })); }
          }
          try {
            const raw = sessionStorage.getItem('manager_link_data');
            const latest = raw ? JSON.parse(raw) : md;
            await ensureOnboardingCompanyContext(latest?.manager_id, latest?.link_id);
          } catch (_) { /* ignore */ }
          // When only manager_id (no link_id): unlimited dietitian link — no DB check, always valid
        } catch (checkError) { console.error('Error checking registration link:', checkError); }
      }

      // Also extract dietitian ID if present (for referral tracking)
      // Note: This might conflict with invitation token if both use #d= parameter
      // We'll skip dietitian ID extraction if we have an invitation token
      if (!hasToken) {
        const id = getDietitianIdFromHash();
        if (id) {
          setDietitianId(id);
          // Also store in sessionStorage as backup
          sessionStorage.setItem('referral_dietitian_id', id);
        }
      }
    };
    
    // Initialize on mount
    initializeSignup();
    
    // Also listen for hash changes (in case hash is added after page load)
    const handleHashChange = () => {
      initializeSignup();
    };
    
    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [invitationToken, language]);

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

  const handleGoogleSignUp = async () => {
    // Check if invitation token exists in URL
    if (!hasInvitationToken) {
      setError(language === 'hebrew' 
        ? 'נדרש קישור הזמנה תקף להרשמה' 
        : 'A valid invitation link is required to sign up');
      return;
    }

    setSocialLoading(true);
    setError('');
    try {
      // Persist link context to sessionStorage before OAuth redirect
      const token = invitationToken || window.location.hash.match(/[#&]d=([^&]*)/)?.[1];
      if (token) {
        sessionStorage.setItem('invitation_token', token);
      }
      if (token) {
        const linkData = decodeRegistrationHash(token);
        if (linkData) {
          // If we already resolved the manager_id in initializeSignup, keep it!
          let existingData = {};
          try {
            const raw = sessionStorage.getItem('manager_link_data');
            if (raw) existingData = JSON.parse(raw);
          } catch (e) {}

          sessionStorage.setItem(
            'manager_link_data',
            JSON.stringify({
              link_id: linkData.link_id || existingData.link_id || undefined,
              manager_id: linkData.manager_id || existingData.manager_id || undefined,
            })
          );
        }
      }
      const id = dietitianId || getDietitianIdFromHash();
      if (id) {
        sessionStorage.setItem('referral_dietitian_id', id);
      }
      const { error } = await signInWithGoogle();
      if (error) {
        setError(language === 'hebrew' 
          ? 'שגיאה בהרשמה עם Google. נסו שוב.' 
          : 'Error signing up with Google. Please try again.');
        setSocialLoading(false);
      }
    } catch (err) {
      console.error('Google sign up error:', err);
      setError(language === 'hebrew' 
        ? 'שגיאה בהרשמה עם Google' 
        : 'Error signing up with Google');
      setSocialLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if invitation token exists in URL
    if (!hasInvitationToken) {
      setError(language === 'hebrew' 
        ? 'נדרש קישור הזמנה תקף להרשמה. השתמשו בקישור ההזמנה שקיבלתם.' 
        : 'A valid invitation link is required to sign up. Please use the invitation link you received.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError(language === 'hebrew' ? 'הסיסמאות אינן תואמות' : 'Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    if (formData.password.length < 6) {
      setError(language === 'hebrew' ? 'הסיסמה חייבת להכיל לפחות 6 תווים' : 'Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    // Check if email already exists
    const emailCheck = await checkEmailExists(formData.email);
    if (emailCheck.exists) {
      setError(
        language === 'hebrew'
          ? 'כתובת האימייל כבר קיימת במערכת. השתמשו באימייל אחר או התחברו.'
          : 'This email is already registered. Please use a different email or login.'
      );
      setLoading(false);
      return;
    }

    try {
      const userData = {
        email: formData.email,
        newsletter: formData.newsletter
      };

      // Get manager link data from sessionStorage (if it's a manager link)
      const managerLinkDataStr = sessionStorage.getItem('manager_link_data');
      let managerLinkData = null;
      if (managerLinkDataStr) {
        try {
          managerLinkData = JSON.parse(managerLinkDataStr);
        } catch (e) {
          console.error('Error parsing manager link data:', e);
        }
      }

      // Get dietitian ID from state or sessionStorage (legacy support)
      const referralDietitianId = dietitianId || sessionStorage.getItem('referral_dietitian_id');
      
      let providerId = null;
      if (managerLinkData && managerLinkData.manager_id) {
        providerId = managerLinkData.manager_id;
      } else if (referralDietitianId && referralDietitianId.trim && referralDietitianId.trim() !== '') {
        providerId = referralDietitianId.trim();
      }
      
      // Get invitation token from state or sessionStorage
      const token = invitationToken || window.location.hash.match(/[#&]d=([^&]*)/)?.[1] || sessionStorage.getItem('invitation_token');

      const { data, error: signupError } = await signUp(
        formData.email,
        formData.password,
        userData,
        { invitationToken: token, providerId, managerLinkData }
      );

      if (signupError) {
        setError(signupError.message || (language === 'hebrew' ? 'שגיאה ביצירת החשבון' : 'Failed to create account'));
        setLoading(false);
        return;
      }

      if (data?.session) {
        saveSessionFromAuthResponse(data);
      }

      // Clear stored invitation token, manager link data, and dietitian ID after successful creation
      sessionStorage.removeItem('invitation_token');
      sessionStorage.removeItem('manager_link_data');
      if (referralDietitianId) {
        sessionStorage.removeItem('referral_dietitian_id');
        setDietitianId(null);
      }

      setSuccess(
        language === 'hebrew' 
          ? 'החשבון נוצר בהצלחה! בדקו את האימייל שלכם לאישור.' 
          : 'Account created successfully! Please check your email for confirmation.'
      );
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        agreeToTerms: false,
        newsletter: true
      });
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      console.error('Signup error:', err);
      setError(language === 'hebrew' ? 'אירעה שגיאה ביצירת החשבון' : 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };


  const isHebrew = language === 'hebrew';
  const linkClass = `font-semibold text-bc-text underline underline-offset-4 decoration-bc-border hover:decoration-bc-accent rounded ${focusClass}`;
  const inlineLinkClass = `text-bc-text underline underline-offset-2 decoration-bc-border hover:decoration-bc-accent rounded ${focusClass}`;
  const checkboxClass = `w-5 h-5 shrink-0 mt-0.5 accent-[var(--bc-accent)] cursor-pointer rounded ${focusClass}`;
  const checkboxLabelClass = 'flex items-start gap-3 cursor-pointer text-[14px] font-semibold text-bc-muted';

  // No valid invitation: web signup is invite-only, send people to the app.
  if (!hasInvitationToken) {
    return (
      <AuthShell
        key="gatekeeper"
        title={isHebrew ? 'נדרש קישור הזמנה' : 'Invitation required'}
        subtitle={isHebrew
          ? 'ההרשמה באתר פתוחה רק למי שקיבל קישור הזמנה. כדי להתחיל, הורידו את האפליקציה.'
          : 'Web signup is only for people with an invitation link. To get started, download the app.'}
      >
        <div className="flex flex-col gap-4">
          {error ? <AuthNotice>{error}</AuthNotice> : null}
          <Link to="/#download" className={`${primaryButton} w-full`}>
            {isHebrew ? 'הורידו את האפליקציה' : 'Download the app'}
          </Link>
        </div>
      </AuthShell>
    );
  }

  // Invited on iOS: offer to continue in the app first.
  if (showMobileAppBridge) {
    return (
      <AuthShell
        key="mobile-app-bridge"
        title={isHebrew ? 'הוזמנתם להצטרף' : "You're invited"}
        subtitle={isHebrew
          ? 'לחוויה הטובה ביותר, המשיכו את ההרשמה באפליקציית BetterChoice AI.'
          : 'For the best experience, continue signing up in the BetterChoice AI app.'}
      >
        <div className="flex flex-col gap-3">
          <a href={`betterchoicemobile://signup#d=${getActiveInvitationToken()}`} className={`${primaryButton} w-full`}>
            {isHebrew ? 'פתיחה באפליקציה' : 'Open in the app'}
          </a>
          <a href={APP_STORE_URL} className={`${secondaryButton} w-full min-h-[48px]`}>
            {isHebrew ? 'הורדה מ-App Store' : 'Download on the App Store'}
          </a>
        </div>
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setDismissMobileAppBridge(true)}
            className={`text-[15px] ${linkClass}`}
          >
            {isHebrew ? 'המשך בדפדפן' : 'Continue in the browser'}
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      key="signup-form"
      title={isHebrew ? 'יצירת חשבון' : 'Create your account'}
      subtitle={isHebrew ? 'הצטרפו והתחילו את הדרך לבריאות טובה יותר' : 'Join and start your path to better health'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error ? <AuthNotice>{error}</AuthNotice> : null}
        {success ? <AuthNotice tone="success">{success}</AuthNotice> : null}
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
          autoComplete="new-password"
          required
          label={isHebrew ? 'סיסמה' : 'Password'}
          hint={isHebrew ? 'לפחות 6 תווים' : 'At least 6 characters'}
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

        <div className="flex flex-col gap-3 pt-2">
          <label htmlFor="agreeToTerms" className={checkboxLabelClass}>
            <input
              id="agreeToTerms"
              name="agreeToTerms"
              type="checkbox"
              required
              className={checkboxClass}
              checked={formData.agreeToTerms}
              onChange={handleInputChange}
            />
            <span>
              {isHebrew ? (
                <>אני מסכים/ה ל<Link to="/terms" target="_blank" rel="noopener noreferrer" className={inlineLinkClass}>תנאי השימוש</Link> ול<Link to="/privacy-policy" target="_blank" rel="noopener noreferrer" className={inlineLinkClass}>מדיניות הפרטיות</Link></>
              ) : (
                <>I agree to the <Link to="/terms" target="_blank" rel="noopener noreferrer" className={inlineLinkClass}>Terms of Service</Link> and <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer" className={inlineLinkClass}>Privacy Policy</Link></>
              )}
            </span>
          </label>
          <label htmlFor="newsletter" className={checkboxLabelClass}>
            <input
              id="newsletter"
              name="newsletter"
              type="checkbox"
              className={checkboxClass}
              checked={formData.newsletter}
              onChange={handleInputChange}
            />
            <span>{isHebrew ? 'שלחו לי עדכונים וטיפים בריאותיים באימייל' : 'Send me health updates and tips by email'}</span>
          </label>
        </div>

        <button type="submit" disabled={loading || !formData.agreeToTerms} className={`${primaryButton} w-full mt-2`}>
          {loading ? (isHebrew ? 'יוצר חשבון…' : 'Creating account…') : isHebrew ? 'יצירת חשבון' : 'Create account'}
        </button>
      </form>

      <AuthDivider label={isHebrew ? 'או' : 'or'} />

      <button type="button" onClick={handleGoogleSignUp} disabled={socialLoading} className={`${secondaryButton} w-full min-h-[48px]`}>
        <GoogleIcon />
        {socialLoading ? (isHebrew ? 'מתחבר…' : 'Connecting…') : isHebrew ? 'המשך עם Google' : 'Continue with Google'}
      </button>

      <p className="mt-8 text-center text-[15px] font-semibold text-bc-muted">
        {isHebrew ? 'כבר יש לכם חשבון? ' : 'Already have an account? '}
        <Link to="/login" className={linkClass}>{isHebrew ? 'התחברות' : 'Log in'}</Link>
      </p>
    </AuthShell>
  );
}

export default SignupPage;
