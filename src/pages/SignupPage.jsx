import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { readOnboardingCompanyContext, saveOnboardingCompanyContext } from '../features/onboarding/onboardingCompanyContext';
import { AuthShell, AuthNotice } from '../components/brand/AuthShell';
import { primaryButton, secondaryButton } from '../components/brand/ui';

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
  const [error, setError] = useState('');
  const [invitationToken, setInvitationToken] = useState(null);
  const [hasInvitationToken, setHasInvitationToken] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [linkVerified, setLinkVerified] = useState(false);
  // On a phone, ask whether the app is installed before offering to open it.
  const [hasApp, setHasApp] = useState(false);

  const APPLE_APP_ID = '6770512379';

  const getActiveInvitationToken = () =>
    invitationToken || window.location.hash.match(/[#&]d=([^&]*)/)?.[1] || null;

  const getAppSignupUrl = () => `betterchoicemobile://signup#d=${getActiveInvitationToken()}`;

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
      setIsMobile(isIOSDevice || isAndroidDevice);
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
    const existed = Boolean(meta);
    const previous = meta ? meta.getAttribute('content') : null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'apple-itunes-app');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', metaContent);

    return () => {
      if (!existed) meta.remove();
      else if (previous) meta.setAttribute('content', previous);
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
      setLinkVerified(false);
      
      if (hasToken) {
        const token = invitationToken || window.location.hash.match(/[#&]d=([^&]*)/)?.[1];
        if (token) sessionStorage.setItem('invitation_token', token);
        let md = null;
        try { const raw = sessionStorage.getItem('manager_link_data'); if (raw) md = JSON.parse(raw); } catch (_) {}
        const apiUrl = process.env.REACT_APP_API_URL || 'https://newclientsweb-615263253386.me-west1.run.app';
        let linkValid = true;
        try {
          if (md?.link_id) {
            const r = await fetch(`${apiUrl}/api/db/registration-links/find`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link_id: md.link_id }) });
            const row = await r.json().catch(() => ({}));
            if (!r.ok || !row.manager_id) { setError(language === 'hebrew' ? 'קישור ההרשמה לא נמצא או לא תקף' : (row?.error || 'Registration link not found or invalid')); setHasInvitationToken(false); linkValid = false; }
            else if (row.expires_at && new Date(row.expires_at) < new Date()) { setError(language === 'hebrew' ? 'קישור ההרשמה פג תוקף' : 'This registration link has expired'); setHasInvitationToken(false); linkValid = false; }
            else if (row.max_slots != null && (row.current_count || 0) >= row.max_slots) { setError(language === 'hebrew' ? 'קישור ההרשמה הגיע למגבלת המשתמשים' : `This link has reached the maximum number of slots (${row.max_slots})`); setHasInvitationToken(false); linkValid = false; }
            else if (!row.is_active) { setError(language === 'hebrew' ? 'קישור ההרשמה אינו פעיל' : 'This registration link is no longer active'); setHasInvitationToken(false); linkValid = false; }
            else { sessionStorage.setItem('manager_link_data', JSON.stringify({ ...md, manager_id: row.manager_id })); }
          }
          try {
            const raw = sessionStorage.getItem('manager_link_data');
            const latest = raw ? JSON.parse(raw) : md;
            await ensureOnboardingCompanyContext(latest?.manager_id, latest?.link_id);
          } catch (_) { /* ignore */ }
          // When only manager_id (no link_id): unlimited dietitian link — no DB check, always valid
        } catch (checkError) { console.error('Error checking registration link:', checkError); }
        if (linkValid) setLinkVerified(true);
      }

      // Also extract dietitian ID if present (for referral tracking)
      // Note: This might conflict with invitation token if both use #d= parameter
      // We'll skip dietitian ID extraction if we have an invitation token
      if (!hasToken) {
        const id = getDietitianIdFromHash();
        if (id) {
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

  const isHebrew = language === 'hebrew';

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

  // Signup happens only in the app: invited visitors are sent there, never to a web form.
  return (
    <AuthShell
      key="app-only-signup"
      title={isHebrew ? 'הוזמנתם להצטרף' : "You're invited"}
      subtitle={!isMobile
        ? (isHebrew
          ? 'ההרשמה מתבצעת באפליקציית BetterChoice AI. פתחו את קישור ההזמנה בטלפון שלכם כדי להמשיך.'
          : 'Signup happens in the BetterChoice AI app. Open this invitation link on your phone to continue.')
        : hasApp
          ? (isHebrew
            ? 'פתחו את אפליקציית BetterChoice AI כדי להשלים את ההרשמה.'
            : 'Open the BetterChoice AI app to finish signing up.')
          : (isHebrew
            ? 'כבר הורדתם את אפליקציית BetterChoice AI?'
            : 'Have you already downloaded the BetterChoice AI app?')}
    >
      <div className="flex flex-col gap-3">
        {error ? <AuthNotice>{error}</AuthNotice> : null}
        {isMobile && linkVerified && hasApp ? (
          <a href={getAppSignupUrl()} className={`${primaryButton} w-full`}>
            {isHebrew ? 'פתיחה באפליקציה' : 'Open in the app'}
          </a>
        ) : null}
        {isMobile && linkVerified && !hasApp ? (
          <>
            <button type="button" onClick={() => setHasApp(true)} className={`${primaryButton} w-full`}>
              {isHebrew ? 'כן, יש לי את האפליקציה' : 'Yes, I have the app'}
            </button>
            <a href="/get" className={`${secondaryButton} w-full`}>
              {isHebrew ? 'לא, עוד לא' : 'No, not yet'}
            </a>
          </>
        ) : null}
      </div>
    </AuthShell>
  );
}

export default SignupPage;
