import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { checkEmailExists, signInWithGoogle, signUp } from '../supabase/auth';
import { saveSessionFromAuthResponse } from '../lib/apiClient';
import { motion, AnimatePresence } from 'framer-motion';

function SignupPage() {
  const { language, direction, t, isTransitioning, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { isDarkMode, toggleTheme, themeClasses } = useTheme();
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
      const linkData = decodeRegistrationHash(base64Token);
      if (!linkData) return false;
      sessionStorage.setItem('manager_link_data', JSON.stringify({ link_id: linkData.link_id || undefined, manager_id: linkData.manager_id }));
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
      navigate('/');
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
          sessionStorage.setItem(
            'manager_link_data',
            JSON.stringify({
              link_id: linkData.link_id || undefined,
              manager_id: linkData.manager_id || undefined,
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
          ? 'שגיאה בהרשמה עם Google. אנא נסה שוב.' 
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
        ? 'נדרש קישור הזמנה תקף להרשמה. אנא השתמש בקישור ההזמנה שקיבלת.' 
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
          ? 'כתובת האימייל כבר קיימת במערכת. אנא השתמש באימייל אחר או התחבר.'
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
          ? 'החשבון נוצר בהצלחה! בדוק את האימייל שלך לאישור.' 
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

  // Framer Motion Variants
  const containerVariants = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.8, type: 'spring', bounce: 0.4, staggerChildren: 0.1, delayChildren: 0.1 } },
    exit: { opacity: 0, y: -20, scale: 0.98, transition: { duration: 0.3, ease: 'easeIn' } }
  };

  const itemVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, type: 'spring', bounce: 0.3 } }
  };

  const alertVariants = {
    initial: { opacity: 0, height: 0, y: -10, scale: 0.95 },
    animate: { opacity: 1, height: 'auto', y: 0, scale: 1, transition: { type: 'spring', bounce: 0.4, duration: 0.6 } },
    exit: { opacity: 0, height: 0, y: -10, scale: 0.95, transition: { duration: 0.2 } }
  };

  return (
    <div className={`min-h-screen flex flex-col ${themeClasses.bgPrimary} language-transition language-text-transition overflow-hidden`} dir={direction}>
      {/* Immersive Header */}
      <header className={`relative z-20 ${isDarkMode ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white/80 border-gray-200/50'} backdrop-blur-xl border-b shadow-sm`}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4 sm:py-5">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, type: 'spring' }}
              className="flex items-center"
            >
              <img src="/favicon.ico" alt="BetterChoice Logo" className="w-10 h-10 sm:w-12 sm:h-12 mr-3 sm:mr-4 rounded-xl shadow-lg ring-1 ring-black/5" />
              <div className="flex flex-col">
                <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'} leading-tight`}>BetterChoice</h1>
                <p className={`${isDarkMode ? 'text-emerald-400/80' : 'text-emerald-600/80'} text-xs sm:text-sm font-medium hidden sm:block`}>{t.tagline}</p>
              </div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, type: 'spring' }}
              className="flex gap-3 sm:gap-4 items-center"
            >
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleTheme}
                className={`p-2 sm:px-4 sm:py-2 rounded-full font-medium transition-colors duration-300 text-xs sm:text-sm shadow-sm backdrop-blur-md border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? '☀️' : '🌙'}
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleLanguage}
                className={`p-2 sm:px-4 sm:py-2 rounded-full font-medium transition-colors duration-300 text-xs sm:text-sm shadow-sm text-white ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                title={language === 'hebrew' ? 'Switch to English' : 'עבור לעברית'}
              >
                {language === 'hebrew' ? 'EN' : 'עב'}
              </motion.button>
              <Link 
                to="/" 
                className={`hidden sm:inline-block ${isDarkMode ? 'bg-slate-800 text-emerald-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-emerald-700 border-gray-200 hover:bg-gray-50'} px-4 py-2 rounded-full font-semibold transition-colors duration-300 text-sm shadow-sm backdrop-blur-md border`}
              >
                {language === 'hebrew' ? 'חזרה לבית' : 'Back to Home'}
              </Link>
            </motion.div>
          </div>
        </nav>
      </header>

      {/* Main Content with Premium Glassmorphic Layering */}
      <main className={`relative flex-1 flex items-center justify-center py-10 sm:py-16 px-4 sm:px-6 lg:px-8 ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950' : 'bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white'}`}>
        
        {/* Ambient Glow Orbs */}
        <div className="absolute top-0 -left-10 w-72 h-72 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob pointer-events-none"></div>
        <div className="absolute top-0 -right-10 w-72 h-72 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 pointer-events-none"></div>
        <div className="absolute -bottom-20 left-20 w-72 h-72 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000 pointer-events-none"></div>

        <div className="w-full max-w-md relative z-10">
          <AnimatePresence mode="wait">
            {!hasInvitationToken ? (
              <motion.div 
                key="gatekeeper"
                variants={containerVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className={`${isDarkMode ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white/80 border-white/50'} backdrop-blur-xl border rounded-3xl shadow-2xl p-8 sm:p-10 text-center relative overflow-hidden`}
              >
                <motion.div variants={itemVariants} className="mb-6 flex justify-center">
                  <div className={`p-4 rounded-full ${isDarkMode ? 'bg-amber-500/10' : 'bg-amber-100'} shadow-inner`}>
                    <svg className={`h-12 w-12 ${isDarkMode ? 'text-amber-400' : 'text-amber-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </motion.div>
                <motion.h2 variants={itemVariants} className={`text-2xl sm:text-3xl font-extrabold ${themeClasses.textPrimary} mb-4 tracking-tight`}>
                  {language === 'hebrew' ? 'נדרש קישור הזמנה' : 'Invitation Required'}
                </motion.h2>
                <motion.p variants={itemVariants} className={`${themeClasses.textSecondary} mb-8 leading-relaxed`}>
                  {language === 'hebrew' 
                    ? 'ההרשמה פתוחה רק למי שקיבל קישור הזמנה. אם אתה מעוניין להצטרף, אנא הירשם לרשימת ההמתנה.' 
                    : 'Signup is currently only available to those who have received an invitation link. If you\'re interested in joining, please join our waiting list.'}
                </motion.p>
                <AnimatePresence>
                  {error && (
                    <motion.div variants={alertVariants} initial="initial" animate="animate" exit="exit" className="overflow-hidden mb-6">
                      <div className={`${themeClasses.errorBg} px-4 py-3 rounded-xl border border-red-200/50 dark:border-red-900/50 text-sm font-medium shadow-sm`}>
                        {error}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link 
                    to="/waiting-list"
                    className="block w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 px-6 rounded-xl font-bold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all duration-300"
                  >
                    {language === 'hebrew' ? 'הצטרף לרשימת ההמתנה' : 'Join Waiting List'}
                  </Link>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div 
                key="signup-form"
                variants={containerVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <motion.div variants={itemVariants} className="text-center mb-8 px-2">
                  <h2 className={`text-3xl sm:text-4xl font-extrabold ${themeClasses.textPrimary} mb-3 tracking-tight`}>
                    {language === 'hebrew' ? 'צור חשבון חדש' : 'Create your account'}
                  </h2>
                  <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'} text-sm sm:text-base font-medium`}>
                    {language === 'hebrew' ? 'הצטרף לקהילה שלנו והתחל את המסע שלך לבריאות טובה יותר' : 'Join our community and start your journey to better health'}
                  </p>
                </motion.div>

                <motion.form variants={containerVariants} className="space-y-6" onSubmit={handleSubmit}>
                  <div className={`${isDarkMode ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white/80 border-white/50'} backdrop-blur-2xl border rounded-3xl shadow-2xl p-6 sm:p-10 relative overflow-hidden`}>
                    
                    <AnimatePresence>
                      {error && (
                        <motion.div key={error} variants={alertVariants} initial="initial" animate="animate" exit="exit" className="overflow-hidden mb-6">
                          <div className={`${themeClasses.errorBg} px-4 py-3 rounded-xl border border-red-200/50 dark:border-red-900/50 text-sm font-medium shadow-sm flex items-start gap-3`}>
                            <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{error}</span>
                          </div>
                        </motion.div>
                      )}
                      {success && (
                        <motion.div key={success} variants={alertVariants} initial="initial" animate="animate" exit="exit" className="overflow-hidden mb-6">
                          <div className={`${themeClasses.successBg} px-4 py-3 rounded-xl border border-emerald-200/50 dark:border-emerald-900/50 text-sm font-medium shadow-sm flex items-start gap-3`}>
                            <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{success}</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-5">
                      {/* Premium Floating Input: Email */}
                      <motion.div variants={itemVariants} className="relative group z-0 w-full">
                        <input
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          className={`block peer w-full px-4 pt-6 pb-2 text-sm bg-transparent border-2 ${isDarkMode ? 'border-slate-700 focus:border-emerald-500 text-white bg-slate-800/50' : 'border-gray-200 focus:border-emerald-500 text-gray-900 bg-gray-50/50'} rounded-xl appearance-none focus:outline-none focus:ring-4 ${isDarkMode ? 'focus:ring-emerald-500/20' : 'focus:ring-emerald-500/10'} transition-all duration-300 shadow-sm`}
                          placeholder=" "
                          value={formData.email}
                          onChange={handleInputChange}
                        />
                        <label
                          htmlFor="email"
                          className={`absolute text-sm font-medium ${isDarkMode ? 'text-slate-400 peer-focus:text-emerald-400' : 'text-gray-500 peer-focus:text-emerald-600'} duration-300 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] start-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 pointer-events-none`}
                        >
                          {t.contact.form.email}
                        </label>
                      </motion.div>

                      {/* Premium Floating Input: Password */}
                      <motion.div variants={itemVariants} className="relative group z-0 w-full">
                        <input
                          id="password"
                          name="password"
                          type="password"
                          autoComplete="new-password"
                          required
                          className={`block peer w-full px-4 pt-6 pb-2 text-sm bg-transparent border-2 ${isDarkMode ? 'border-slate-700 focus:border-emerald-500 text-white bg-slate-800/50' : 'border-gray-200 focus:border-emerald-500 text-gray-900 bg-gray-50/50'} rounded-xl appearance-none focus:outline-none focus:ring-4 ${isDarkMode ? 'focus:ring-emerald-500/20' : 'focus:ring-emerald-500/10'} transition-all duration-300 shadow-sm`}
                          placeholder=" "
                          value={formData.password}
                          onChange={handleInputChange}
                        />
                        <label
                          htmlFor="password"
                          className={`absolute text-sm font-medium ${isDarkMode ? 'text-slate-400 peer-focus:text-emerald-400' : 'text-gray-500 peer-focus:text-emerald-600'} duration-300 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] start-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 pointer-events-none`}
                        >
                          {language === 'hebrew' ? 'סיסמה' : 'Password'}
                        </label>
                      </motion.div>

                      {/* Premium Floating Input: Confirm Password */}
                      <motion.div variants={itemVariants} className="relative group z-0 w-full">
                        <input
                          id="confirmPassword"
                          name="confirmPassword"
                          type="password"
                          autoComplete="new-password"
                          required
                          className={`block peer w-full px-4 pt-6 pb-2 text-sm bg-transparent border-2 ${isDarkMode ? 'border-slate-700 focus:border-emerald-500 text-white bg-slate-800/50' : 'border-gray-200 focus:border-emerald-500 text-gray-900 bg-gray-50/50'} rounded-xl appearance-none focus:outline-none focus:ring-4 ${isDarkMode ? 'focus:ring-emerald-500/20' : 'focus:ring-emerald-500/10'} transition-all duration-300 shadow-sm`}
                          placeholder=" "
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                        />
                        <label
                          htmlFor="confirmPassword"
                          className={`absolute text-sm font-medium ${isDarkMode ? 'text-slate-400 peer-focus:text-emerald-400' : 'text-gray-500 peer-focus:text-emerald-600'} duration-300 transform -translate-y-3 scale-75 top-4 z-10 origin-[0] start-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3 pointer-events-none`}
                        >
                          {language === 'hebrew' ? 'אשר סיסמה' : 'Confirm Password'}
                        </label>
                      </motion.div>

                      {/* Checkboxes */}
                      <motion.div variants={itemVariants} className="space-y-4 pt-2">
                        <motion.label whileTap={{ scale: 0.98 }} className="flex items-start cursor-pointer group">
                          <div className="flex items-center h-5">
                            <input
                              id="agreeToTerms"
                              name="agreeToTerms"
                              type="checkbox"
                              required
                              className={`w-4 h-4 rounded border-2 ${isDarkMode ? 'border-slate-600 bg-slate-800 checked:bg-emerald-500 checked:border-emerald-500' : 'border-gray-300 bg-white checked:bg-emerald-600 checked:border-emerald-600'} focus:ring-emerald-500 focus:ring-2 transition-all cursor-pointer`}
                              checked={formData.agreeToTerms}
                              onChange={handleInputChange}
                            />
                          </div>
                          <div className="ms-3 text-sm">
                            <span className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                              {language === 'hebrew' ? (
                                <>אני מסכים ל<a href="#terms" className="text-emerald-500 hover:text-emerald-400 underline decoration-emerald-500/30 underline-offset-2">תנאי השימוש</a> ו<a href="#privacy" className="text-emerald-500 hover:text-emerald-400 underline decoration-emerald-500/30 underline-offset-2">מדיניות הפרטיות</a></>
                              ) : (
                                <>I agree to the <a href="#terms" className="text-emerald-600 hover:text-emerald-500 underline decoration-emerald-500/30 underline-offset-2">Terms of Service</a> and <a href="#privacy" className="text-emerald-600 hover:text-emerald-500 underline decoration-emerald-500/30 underline-offset-2">Privacy Policy</a></>
                              )}
                            </span>
                          </div>
                        </motion.label>

                        <motion.label whileTap={{ scale: 0.98 }} className="flex items-start cursor-pointer group">
                          <div className="flex items-center h-5">
                            <input
                              id="newsletter"
                              name="newsletter"
                              type="checkbox"
                              className={`w-4 h-4 rounded border-2 ${isDarkMode ? 'border-slate-600 bg-slate-800 checked:bg-emerald-500 checked:border-emerald-500' : 'border-gray-300 bg-white checked:bg-emerald-600 checked:border-emerald-600'} focus:ring-emerald-500 focus:ring-2 transition-all cursor-pointer`}
                              checked={formData.newsletter}
                              onChange={handleInputChange}
                            />
                          </div>
                          <div className="ms-3 text-sm">
                            <span className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                              {language === 'hebrew' ? 'אני רוצה לקבל עדכונים וטיפים בריאותיים באימייל' : 'I want to receive health updates and tips via email'}
                            </span>
                          </div>
                        </motion.label>
                      </motion.div>

                      <motion.div variants={itemVariants} className="pt-2">
                        <motion.button
                          whileHover={formData.agreeToTerms ? { scale: 1.02 } : {}}
                          whileTap={formData.agreeToTerms ? { scale: 0.98 } : {}}
                          type="submit"
                          disabled={loading || !formData.agreeToTerms}
                          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 px-4 rounded-xl font-bold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 focus:outline-none focus:ring-4 focus:ring-emerald-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                          {loading ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              {language === 'hebrew' ? 'יוצר חשבון...' : 'Creating account...'}
                            </span>
                          ) : (
                            t.buttons.signup
                          )}
                        </motion.button>
                      </motion.div>

                      <motion.div variants={itemVariants} className="text-center pt-2">
                        <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                          {language === 'hebrew' ? 'כבר יש לך חשבון?' : 'Already have an account?'}
                        </span>
                        <Link 
                          to="/login" 
                          className={`text-sm font-bold text-emerald-500 hover:text-emerald-400 transition-colors duration-300 ms-2 underline decoration-emerald-500/30 underline-offset-4`}
                        >
                          {t.buttons.login}
                        </Link>
                      </motion.div>
                    </div>

                    <motion.div variants={itemVariants} className="mt-8">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className={`w-full border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`} />
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className={`px-4 font-medium ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-gray-500'} rounded-full border ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                            {language === 'hebrew' ? 'או הירשם באמצעות' : 'Or sign up with'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-6">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="button"
                          onClick={handleGoogleSignUp}
                          disabled={socialLoading}
                          className={`w-full inline-flex items-center justify-center gap-3 py-3.5 px-4 border-2 ${isDarkMode ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700 hover:border-slate-600' : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50 hover:border-gray-300'} rounded-xl shadow-sm text-sm font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
                          aria-label="Sign up with Google"
                        >
                          {socialLoading ? (
                            <svg className="animate-spin h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <>
                              <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                              </svg>
                              <span>Google</span>
                            </>
                          )}
                        </motion.button>
                      </div>
                    </motion.div>
                  </div>
                </motion.form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Elegant Footer */}
      <footer className={`relative z-20 ${isDarkMode ? 'bg-slate-900 border-t border-slate-800' : 'bg-transparent border-t border-emerald-100'} py-6 sm:py-8 backdrop-blur-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 mb-2 md:mb-0 text-center">
              <a 
                href="#privacy" 
                className={`text-sm font-medium ${isDarkMode ? 'text-slate-400 hover:text-emerald-400' : 'text-emerald-700/70 hover:text-emerald-700'} transition-colors duration-300`}
              >
                {t.footer.privacy}
              </a>
              <a 
                href="#terms" 
                className={`text-sm font-medium ${isDarkMode ? 'text-slate-400 hover:text-emerald-400' : 'text-emerald-700/70 hover:text-emerald-700'} transition-colors duration-300`}
              >
                {t.footer.terms}
              </a>
            </div>
            <div className={`text-center text-sm font-medium ${isDarkMode ? 'text-slate-500' : 'text-emerald-600/60'}`}>
              <p>{t.footer.copyright}</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default SignupPage;