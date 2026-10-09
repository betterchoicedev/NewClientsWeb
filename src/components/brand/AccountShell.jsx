import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { Lockup } from './Logo';
import { textButton, focusClass } from './ui';

/** Signed-in pages: wordmark and log out. Settings only, no marketing sections. */
export default function AccountShell({ children }) {
  const { language, direction } = useLanguage();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const isHebrew = language === 'hebrew';

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      setSigningOut(false);
    }
  };

  return (
    <div dir={direction} className="min-h-screen flex flex-col bg-bc-canvas text-bc-text font-system text-start">
      <header className="sticky top-0 z-40 bg-bc-surface border-b border-bc-border">
        <div className="mx-auto max-w-5xl h-16 px-4 sm:px-6 flex items-center justify-between">
          <Link
            to="/"
            aria-label={isHebrew ? 'דף הבית של BetterChoice' : 'BetterChoice home'}
            className={`flex items-center rounded-lg ${focusClass}`}
          >
            <Lockup height={20} />
          </Link>
          <button type="button" onClick={handleLogout} disabled={signingOut} className={textButton}>
            <LogOut size={18} aria-hidden="true" className="rtl:-scale-x-100" />
            {signingOut ? (isHebrew ? 'מתנתק…' : 'Logging out…') : isHebrew ? 'התנתקות' : 'Log out'}
          </button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
