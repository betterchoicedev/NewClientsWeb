import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import SignupPage from './pages/SignupPage';
import OpenAppPage from './pages/OpenAppPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import WhatsAppRegisterPage from './pages/WhatsAppRegisterPage';
import AccountPage from './pages/AccountPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import AccessibilityStatementPage from './pages/AccessibilityStatementPage';
import DeleteAccountPage from './pages/DeleteAccountPage';
import NotFoundPage from './pages/NotFoundPage';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import RequireAuth from './components/brand/RequireAuth';
import CookieConsent from './components/CookieConsent';
import AccessibilityWidget from './components/AccessibilityWidget';
import OAuthHashHandler from './components/OAuthHashHandler';
import './App.css';

/** /he and /en: shareable links (ads, SEO) that set the language, then show the landing page. */
function LanguageRedirect({ lang }) {
  const { setLanguage, setDirection } = useLanguage();
  React.useEffect(() => {
    try { localStorage.setItem('language', lang); } catch (e) { /* storage blocked */ }
    setLanguage(lang);
    setDirection(lang === 'hebrew' ? 'rtl' : 'ltr');
  }, [lang, setLanguage, setDirection]);
  return <Navigate to="/" replace />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
          <Router>
            <div className="App">
              <OAuthHashHandler />
              <CookieConsent />
              <AccessibilityWidget />
              <Routes>
                {/* Marketing */}
                <Route path="/" element={<HomePage />} />
                <Route path="/he" element={<LanguageRedirect lang="hebrew" />} />
                <Route path="/en" element={<LanguageRedirect lang="english" />} />
                <Route path="/app" element={<OpenAppPage />} />

                {/* Account access */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/register/:phoneNumber" element={<WhatsAppRegisterPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/delete-account" element={<DeleteAccountPage />} />

                {/* Account settings (protected) */}
                <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
                <Route path="/profile" element={<Navigate to="/account" replace />} />
                <Route path="/c/:companySlug/profile" element={<Navigate to="/account" replace />} />
                {/* Stripe checkout returns: billing lives in account settings now */}
                <Route path="/payment-success" element={<Navigate to="/account" replace />} />
                <Route path="/payment-cancel" element={<Navigate to="/account" replace />} />

                {/* Company campaign pages (unchanged) */}
                <Route path="/landing" element={<LandingPage />} />

                {/* Legal */}
                <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                <Route path="/terms" element={<TermsOfServicePage />} />
                <Route path="/accessibility-statement" element={<AccessibilityStatementPage />} />

                {/* Retired public surfaces */}
                <Route path="/knowledge" element={<Navigate to="/" replace />} />
                <Route path="/recipes" element={<Navigate to="/" replace />} />
                <Route path="/about" element={<Navigate to="/" replace />} />
                <Route path="/waiting-list" element={<Navigate to="/" replace />} />
                <Route path="/pricing" element={<Navigate to="/" replace />} />

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </div>
          </Router>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
