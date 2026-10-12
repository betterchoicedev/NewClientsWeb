import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronRight, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { apiFetch } from '../lib/apiClient';
import { normalizePhoneForDatabase } from '../supabase/auth';
import AccountShell from '../components/brand/AccountShell';
import {
  card,
  field,
  fieldLabel,
  focusClass,
  primaryButton,
  secondaryButton,
  textButton,
  titleFont,
} from '../components/brand/ui';

// Account settings mirror the app's settings screen (BetterApp/app/pages/settings.tsx):
// personal details, subscription and the Stripe portal, language, appearance,
// legal links, and delete account. Nothing here does what the app cannot do.

const SECTION_IDS = ['details', 'subscription', 'language', 'appearance', 'legal', 'delete'];

const copy = {
  english: {
    pageTitle: 'Account settings',
    sections: {
      details: 'Personal details',
      subscription: 'Subscription',
      language: 'Language',
      appearance: 'Appearance',
      legal: 'Privacy & terms',
      delete: 'Delete account',
    },
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    phone: 'Phone',
    emailHint: 'Your sign-in email. Contact support to change it.',
    bodyHint: 'Age, body, and goals are edited in the app, so your targets stay in sync.',
    save: 'Save changes',
    saving: 'Saving…',
    saved: 'Saved',
    saveFailed: 'Could not save. Try again.',
    nameRequired: 'Add your first name.',
    loadFailed: 'Could not load your details.',
    retry: 'Try again',
    yourPlan: 'Your plan',
    noPlan: 'No active plan',
    noPlanDetail: 'Plans are available in the app. Billing shows up here after you subscribe.',
    monthly: 'Monthly',
    yearly: 'Yearly',
    plan: 'Plan',
    trial: 'trial',
    renews: 'renews',
    firstCharge: 'first charge',
    endsDetail: (date) =>
      date ? `Access stays until ${date}. You will not be charged again.` : 'Your plan ends when this period closes. You will not be charged again.',
    manageBilling: 'Manage billing',
    opening: 'Opening…',
    portalFailed: 'Could not open billing. Try again.',
    noBillingAccount: 'There is no billing account for this sign-in yet.',
    cancelPlan: 'Cancel subscription',
    canceling: 'Canceling…',
    cancelTitle: 'Cancel subscription?',
    cancelBody: 'Your plan stays active until the end of this billing period. You will not be charged again.',
    keepPlan: 'Keep plan',
    confirmCancel: 'Cancel subscription',
    cancelFailed: 'Could not cancel. Try again.',
    subLoadFailed: 'Could not load your subscription.',
    english: 'English',
    hebrew: 'עברית',
    light: 'Light',
    dark: 'Dark',
    languageHint: 'Website language',
    appearanceHint: 'Light or dark look for the website',
    privacy: 'Privacy policy',
    terms: 'Terms of service',
    accessibility: 'Accessibility statement',
    deleteBody: 'Permanently delete your account and all data. This cannot be undone.',
    deleteButton: 'Delete my account',
    deleteTitle: 'Delete account?',
    deleteConfirmBody: 'This erases your account and all your data, on the web and in the app. Type DELETE to confirm.',
    deleteInputLabel: 'Type DELETE',
    deleteConfirm: 'Delete permanently',
    deleting: 'Deleting…',
    deleteFailed: 'Could not delete your account. Try again.',
    cancel: 'Cancel',
    getApp: 'Use BetterChoice on your phone',
  },
  hebrew: {
    pageTitle: 'הגדרות חשבון',
    sections: {
      details: 'פרטים אישיים',
      subscription: 'מנוי',
      language: 'שפה',
      appearance: 'מראה',
      legal: 'פרטיות ותנאים',
      delete: 'מחיקת חשבון',
    },
    firstName: 'שם פרטי',
    lastName: 'שם משפחה',
    email: 'אימייל',
    phone: 'טלפון',
    emailHint: 'האימייל להתחברות. לשינוי פנו לתמיכה.',
    bodyHint: 'גיל, נתוני גוף ויעדים נערכים באפליקציה, כדי שהיעדים שלכם יישארו מעודכנים.',
    save: 'שמירת שינויים',
    saving: 'שומר…',
    saved: 'נשמר',
    saveFailed: 'השמירה נכשלה. נסו שוב.',
    nameRequired: 'הוסיפו שם פרטי.',
    loadFailed: 'לא הצלחנו לטעון את הפרטים.',
    retry: 'נסו שוב',
    yourPlan: 'המנוי שלך',
    noPlan: 'אין מנוי פעיל',
    noPlanDetail: 'המנויים זמינים באפליקציה. אחרי הרשמה למנוי, החיוב יופיע כאן.',
    monthly: 'חודשי',
    yearly: 'שנתי',
    plan: 'מנוי',
    trial: 'תקופת ניסיון',
    renews: 'חידוש',
    firstCharge: 'חיוב ראשון',
    endsDetail: (date) =>
      date ? `הגישה נשארת עד ${date}. לא יתבצע חיוב נוסף.` : 'המנוי יסתיים בסוף התקופה. לא יתבצע חיוב נוסף.',
    manageBilling: 'ניהול חיוב',
    opening: 'פותח…',
    portalFailed: 'לא הצלחנו לפתוח את החיוב. נסו שוב.',
    noBillingAccount: 'עדיין אין חשבון חיוב עבור ההתחברות הזו.',
    cancelPlan: 'ביטול מנוי',
    canceling: 'מבטל…',
    cancelTitle: 'לבטל את המנוי?',
    cancelBody: 'המנוי יישאר פעיל עד סוף תקופת החיוב הנוכחית. לא יתבצע חיוב נוסף.',
    keepPlan: 'השארת המנוי',
    confirmCancel: 'ביטול מנוי',
    cancelFailed: 'הביטול נכשל. נסו שוב.',
    subLoadFailed: 'לא הצלחנו לטעון את המנוי.',
    english: 'English',
    hebrew: 'עברית',
    light: 'בהיר',
    dark: 'כהה',
    languageHint: 'שפת האתר',
    appearanceHint: 'מראה בהיר או כהה לאתר',
    privacy: 'מדיניות פרטיות',
    terms: 'תנאי שימוש',
    accessibility: 'הצהרת נגישות',
    deleteBody: 'מחיקה לצמיתות של החשבון וכל הנתונים. לא ניתן לבטל.',
    deleteButton: 'מחיקת החשבון שלי',
    deleteTitle: 'למחוק את החשבון?',
    deleteConfirmBody: 'פעולה זו מוחקת את החשבון ואת כל הנתונים, באתר ובאפליקציה. הקלידו DELETE לאישור.',
    deleteInputLabel: 'הקלידו DELETE',
    deleteConfirm: 'מחיקה לצמיתות',
    deleting: 'מוחק…',
    deleteFailed: 'מחיקת החשבון נכשלה. נסו שוב.',
    cancel: 'ביטול',
    getApp: 'השתמשו ב-BetterChoice בטלפון',
  },
};

const FADE = { duration: 0.4, ease: 'easeOut' };

function Section({ id, title, children, tone }) {
  return (
    <motion.section
      id={id}
      aria-labelledby={`${id}-title`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={FADE}
      className={`scroll-mt-24 p-6 sm:p-8 ${
        tone === 'danger' ? 'rounded-bc-card border bg-bc-danger-well' : card
      }`}
      style={tone === 'danger' ? { borderColor: 'color-mix(in srgb, var(--bc-danger) 30%, transparent)' } : undefined}
    >
      <h2
        id={`${id}-title`}
        className={`text-[17px] font-bold ${tone === 'danger' ? 'text-bc-danger' : 'text-bc-text'}`}
      >
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex p-1 rounded-bc-button border border-bc-border">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            lang={option.lang}
            onClick={() => !selected && onChange(option.value)}
            className={`min-h-[40px] min-w-[96px] px-4 rounded-[20px] text-[15px] font-semibold transition-colors duration-150 ${focusClass} ${
              selected ? 'bg-bc-surface2 text-bc-text' : 'text-bc-muted hover:text-bc-text'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Dialog({ titleId, title, body, children, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const focusable = panelRef.current?.querySelector('input, button');
    focusable?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={FADE}
        className={`relative w-full max-w-md p-6 sm:p-8 ${card}`}
      >
        <h2 id={titleId} className="text-[22px] font-bold text-bc-text">{title}</h2>
        <p className="mt-2 text-[15px] font-semibold text-bc-muted leading-relaxed">{body}</p>
        <div className="mt-6">{children}</div>
      </motion.div>
    </div>
  );
}

function formatDate(value, language) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(language === 'hebrew' ? 'he-IL' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function DetailsSection({ c, user }) {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [initial, setInitial] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [email, setEmail] = useState('');
  const [userCode, setUserCode] = useState('');
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [saveError, setSaveError] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await apiFetch(`/api/profile/load?userId=${encodeURIComponent(user.id)}`).catch((err) => {
        if (err.status === 404) return { data: null };
        throw err;
      });
      const client = result?.data || null;
      let chatUser = null;
      if (client?.user_code) {
        chatUser = await apiFetch(`/api/profile/chat-user?userCode=${encodeURIComponent(client.user_code)}`)
          .then((r) => r?.data || null)
          .catch(() => null);
      }
      const fullName = chatUser?.full_name || client?.full_name || '';
      const [first = '', ...rest] = fullName.trim().split(/\s+/);
      const next = {
        firstName: first || user.user_metadata?.first_name || '',
        lastName: rest.join(' ') || (first ? '' : user.user_metadata?.last_name || ''),
        phone: chatUser?.phone_number || client?.phone || '',
      };
      setInitial(next);
      setForm(next);
      setEmail(chatUser?.email || client?.email || user.email || '');
      setUserCode(client?.user_code || '');
      setStatus('ready');
    } catch (error) {
      console.error('Error loading account details:', error);
      setStatus('error');
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty =
    initial &&
    (form.firstName !== initial.firstName || form.lastName !== initial.lastName || form.phone !== initial.phone);

  const onChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    if (saveState !== 'saving') setSaveState('idle');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!dirty || saveState === 'saving') return;
    if (!form.firstName.trim()) {
      setSaveState('error');
      setSaveError(c.nameRequired);
      return;
    }
    setSaveState('saving');
    setSaveError('');
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    const phone = form.phone ? normalizePhoneForDatabase(form.phone) : null;
    const updatedAt = new Date().toISOString();
    try {
      // /api/profile/save updates only the columns it receives.
      await apiFetch('/api/profile/save', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          profileData: { user_id: user.id, email: email || user.email, full_name: fullName, phone, updated_at: updatedAt },
        }),
      });
      if (userCode) {
        await apiFetch('/api/profile/sync-chat-user', {
          method: 'POST',
          body: JSON.stringify({
            userCode,
            chatUserData: { full_name: fullName, phone_number: phone, whatsapp_number: phone, updated_at: updatedAt },
          }),
        }).catch((err) => console.error('Error syncing chat user:', err));
      }
      const next = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: phone || '' };
      setInitial(next);
      setForm(next);
      setSaveState('saved');
    } catch (error) {
      console.error('Error saving account details:', error);
      setSaveState('error');
      setSaveError(c.saveFailed);
    }
  };

  if (status === 'loading') {
    return (
      <div className="space-y-4" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 rounded-bc-field bg-bc-surface2 animate-pulse" />
        ))}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-[15px] font-semibold text-bc-muted">{c.loadFailed}</p>
        <button type="button" onClick={load} className={secondaryButton}>{c.retry}</button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="account-first-name" className={fieldLabel}>{c.firstName}</label>
          <input id="account-first-name" className={field} value={form.firstName} onChange={onChange('firstName')} autoComplete="given-name" />
        </div>
        <div>
          <label htmlFor="account-last-name" className={fieldLabel}>{c.lastName}</label>
          <input id="account-last-name" className={field} value={form.lastName} onChange={onChange('lastName')} autoComplete="family-name" />
        </div>
        <div>
          <label htmlFor="account-phone" className={fieldLabel}>{c.phone}</label>
          <input id="account-phone" type="tel" dir="ltr" className={`${field} rtl:text-right`} value={form.phone} onChange={onChange('phone')} autoComplete="tel" />
        </div>
        <div>
          <label htmlFor="account-email" className={fieldLabel}>{c.email}</label>
          <input id="account-email" type="email" dir="ltr" className={`${field} rtl:text-right`} value={email} readOnly aria-describedby="account-email-hint" />
          <p id="account-email-hint" className="mt-2 text-[12px] font-semibold text-bc-muted">{c.emailHint}</p>
        </div>
      </div>
      <p className="mt-5 text-[13px] font-semibold text-bc-muted">{c.bodyHint}</p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={!dirty || saveState === 'saving'} className={primaryButton}>
          {saveState === 'saving' ? c.saving : c.save}
        </button>
        <span aria-live="polite" className="text-[13px] font-semibold">
          {saveState === 'saved' ? <span className="text-bc-muted">{c.saved}</span> : null}
          {saveState === 'error' ? <span className="text-bc-danger">{saveError}</span> : null}
        </span>
      </div>
    </form>
  );
}

function SubscriptionSection({ c, language }) {
  const [status, setStatus] = useState('loading');
  const [subscription, setSubscription] = useState(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await apiFetch('/api/stripe/my-subscription');
      setSubscription(result?.subscription || null);
      setStatus('ready');
    } catch (error) {
      console.error('Error loading subscription:', error);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openPortal = async () => {
    if (portalBusy) return;
    setPortalBusy(true);
    setMessage('');
    try {
      const result = await apiFetch('/api/stripe/create-portal-session', { method: 'POST', body: '{}' });
      if (!result?.url) throw new Error('No portal URL');
      window.location.assign(result.url);
    } catch (error) {
      console.error('Error opening billing portal:', error);
      setMessage(error.status === 404 ? c.noBillingAccount : c.portalFailed);
      setPortalBusy(false);
    }
  };

  const closeConfirm = useCallback(() => {
    if (!cancelBusy) setConfirmOpen(false);
  }, [cancelBusy]);

  const cancelPlan = async () => {
    setCancelBusy(true);
    setMessage('');
    try {
      const result = await apiFetch('/api/stripe/cancel-my-subscription', { method: 'POST', body: '{}' });
      setSubscription(result?.subscription || subscription);
      setConfirmOpen(false);
    } catch (error) {
      console.error('Error canceling subscription:', error);
      setMessage(c.cancelFailed);
      setConfirmOpen(false);
    } finally {
      setCancelBusy(false);
    }
  };

  if (status === 'loading') {
    return <div className="h-16 rounded-bc-field bg-bc-surface2 animate-pulse" aria-busy="true" />;
  }

  if (status === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-[15px] font-semibold text-bc-muted">{c.subLoadFailed}</p>
        <button type="button" onClick={load} className={secondaryButton}>{c.retry}</button>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div>
        <p className="text-[15px] font-bold text-bc-text">{c.noPlan}</p>
        <p className="mt-1 text-[15px] font-semibold text-bc-muted">{c.noPlanDetail}</p>
      </div>
    );
  }

  const planName =
    subscription.plan === 'monthly' ? c.monthly : subscription.plan === 'yearly' ? c.yearly : c.plan;
  const periodEnd = formatDate(subscription.currentPeriodEnd, language);
  const trialing = subscription.status === 'trialing';
  const detail = subscription.cancelAtPeriodEnd
    ? c.endsDetail(periodEnd)
    : [planName, trialing ? c.trial : null, periodEnd ? `${trialing ? c.firstCharge : c.renews} ${periodEnd}` : null]
        .filter(Boolean)
        .join(' · ');

  return (
    <div>
      <p className="text-[15px] font-bold text-bc-text">{c.yourPlan}</p>
      <p className="mt-1 text-[15px] font-semibold text-bc-muted">{detail}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={openPortal} disabled={portalBusy} className={secondaryButton}>
          {portalBusy ? c.opening : c.manageBilling}
          {!portalBusy ? <ExternalLink size={16} aria-hidden="true" /> : null}
        </button>
        {!subscription.cancelAtPeriodEnd ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={cancelBusy}
            className={`${textButton} text-bc-danger`}
          >
            {cancelBusy ? c.canceling : c.cancelPlan}
          </button>
        ) : null}
      </div>
      {message ? (
        <p role="alert" className="mt-3 text-[13px] font-semibold text-bc-danger">{message}</p>
      ) : null}

      {confirmOpen ? (
        <Dialog titleId="cancel-plan-title" title={c.cancelTitle} body={c.cancelBody} onClose={closeConfirm}>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={closeConfirm} disabled={cancelBusy} className={secondaryButton}>
              {c.keepPlan}
            </button>
            <button
              type="button"
              onClick={cancelPlan}
              disabled={cancelBusy}
              className={`${secondaryButton} text-bc-danger`}
              style={{ borderColor: 'var(--bc-danger)' }}
            >
              {cancelBusy ? c.canceling : c.confirmCancel}
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function DeleteSection({ c }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
    setConfirmText('');
    setError('');
  }, [busy]);

  const onDelete = async (event) => {
    event.preventDefault();
    if (confirmText !== 'DELETE' || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/auth/account', { method: 'DELETE' });
      await signOut();
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Delete account error:', err);
      setError(c.deleteFailed);
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-[15px] font-semibold text-bc-text">{c.deleteBody}</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${secondaryButton} mt-5 text-bc-danger`}
        style={{ borderColor: 'var(--bc-danger)' }}
      >
        <AlertTriangle size={16} aria-hidden="true" />
        {c.deleteButton}
      </button>

      {open ? (
        <Dialog titleId="delete-account-title" title={c.deleteTitle} body={c.deleteConfirmBody} onClose={close}>
          <form onSubmit={onDelete}>
            <label htmlFor="delete-confirm" className={fieldLabel}>{c.deleteInputLabel}</label>
            <input
              id="delete-confirm"
              dir="ltr"
              autoComplete="off"
              className={field}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            {error ? <p role="alert" className="mt-3 text-[13px] font-semibold text-bc-danger">{error}</p> : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={close} disabled={busy} className={secondaryButton}>{c.cancel}</button>
              <button
                type="submit"
                disabled={confirmText !== 'DELETE' || busy}
                className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-bc-button bg-[#ef4444] text-white text-[15px] font-bold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? c.deleting : c.deleteConfirm}
              </button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}

export default function AccountPage() {
  const { user } = useAuth();
  const { language, toggleLanguage, isTransitioning } = useLanguage();
  const { isDarkMode, toggleTheme } = useTheme();
  const c = copy[language] || copy.english;

  const legalLinks = [
    { to: '/privacy-policy', label: c.privacy },
    { to: '/terms', label: c.terms },
    { to: '/accessibility-statement', label: c.accessibility },
  ];

  return (
    <AccountShell>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 lg:py-14 lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
        <aside className="hidden lg:block">
          <nav aria-label={c.pageTitle} className="sticky top-28 flex flex-col gap-1">
            {SECTION_IDS.map((id) => (
              <a
                key={id}
                href={`#${id}`}
                className={`px-4 py-2.5 rounded-bc-field text-[15px] font-semibold transition-colors ${focusClass} ${
                  id === 'delete' ? 'text-bc-danger hover:bg-bc-danger-well' : 'text-bc-muted hover:text-bc-text hover:bg-bc-surface'
                }`}
              >
                {c.sections[id]}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 max-w-2xl">
          <h1 className={`text-[32px] leading-tight text-bc-text font-choice font-medium`}>
            {c.pageTitle}
          </h1>
          {user?.email ? (
            <p className="mt-1 text-[15px] font-semibold text-bc-muted" dir="ltr" style={{ textAlign: 'start' }}>
              {user.email}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-6">
            <Section id="details" title={c.sections.details}>
              {user ? <DetailsSection c={c} user={user} /> : null}
            </Section>

            <Section id="subscription" title={c.sections.subscription}>
              <SubscriptionSection c={c} language={language} />
            </Section>

            <Section id="language" title={c.sections.language}>
              <p className="mb-4 text-[13px] font-semibold text-bc-muted">{c.languageHint}</p>
              <Segmented
                label={c.sections.language}
                value={language}
                onChange={(next) => {
                  if (next !== language && !isTransitioning) toggleLanguage();
                }}
                options={[
                  { value: 'english', label: c.english, lang: 'en' },
                  { value: 'hebrew', label: c.hebrew, lang: 'he' },
                ]}
              />
            </Section>

            <Section id="appearance" title={c.sections.appearance}>
              <p className="mb-4 text-[13px] font-semibold text-bc-muted">{c.appearanceHint}</p>
              <Segmented
                label={c.sections.appearance}
                value={isDarkMode ? 'dark' : 'light'}
                onChange={(next) => {
                  if ((next === 'dark') !== isDarkMode) toggleTheme();
                }}
                options={[
                  { value: 'light', label: c.light },
                  { value: 'dark', label: c.dark },
                ]}
              />
            </Section>

            <Section id="legal" title={c.sections.legal}>
              <ul className="-mx-2">
                {legalLinks.map((link, index) => (
                  <li key={link.to} className={index > 0 ? 'border-t border-bc-border' : ''}>
                    <Link
                      to={link.to}
                      className={`flex items-center justify-between min-h-[48px] px-2 rounded-bc-field text-[15px] font-semibold text-bc-text hover:opacity-80 ${focusClass}`}
                    >
                      {link.label}
                      <ChevronRight size={18} aria-hidden="true" className="text-bc-muted rtl:-scale-x-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="delete" title={c.sections.delete} tone="danger">
              <DeleteSection c={c} />
            </Section>
          </div>
        </div>
      </div>
    </AccountShell>
  );
}
