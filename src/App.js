import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { StripeProvider } from './context/StripeContext';
import { SettingsProvider } from './context/SettingsContext';
import CookieConsent from './components/CookieConsent';
import AccessibilityWidget from './components/AccessibilityWidget';
import WebsiteTour from './components/WebsiteTour';
import './App.css';

const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const WaitingListPage = lazy(() => import('./pages/WaitingListPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const WhatsAppRegisterPage = lazy(() => import('./pages/WhatsAppRegisterPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const KnowledgePage = lazy(() => import('./pages/KnowledgePage'));
const RecipesPage = lazy(() => import('./pages/RecipesPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage'));
const PaymentCancelPage = lazy(() => import('./pages/PaymentCancelPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const AccessibilityStatementPage = lazy(() => import('./pages/AccessibilityStatementPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function RouteFallback() {
  return (
    <div
      className="route-fallback"
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        minHeight: '40vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.75,
      }}
    >
      Loading…
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StripeProvider>
          <LanguageProvider>
            <SettingsProvider>
            <Router>
              <div className="App">
                <CookieConsent />
                <AccessibilityWidget />
                <WebsiteTour />
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/waiting-list" element={<WaitingListPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/register/:phoneNumber" element={<WhatsAppRegisterPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/knowledge" element={<KnowledgePage />} />
                    <Route path="/recipes" element={<RecipesPage />} />
                    <Route path="/pricing" element={<PricingPage />} />
                    <Route path="/payment-success" element={<PaymentSuccessPage />} />
                    <Route path="/payment-cancel" element={<PaymentCancelPage />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                    <Route path="/terms" element={<TermsOfServicePage />} />
                    <Route path="/accessibility-statement" element={<AccessibilityStatementPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </div>
            </Router>
            </SettingsProvider>
          </LanguageProvider>
        </StripeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
