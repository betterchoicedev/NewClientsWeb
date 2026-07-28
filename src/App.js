import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import SignupPage from './pages/SignupPage';
import WaitingListPage from './pages/WaitingListPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import WhatsAppRegisterPage from './pages/WhatsAppRegisterPage';
import ProfilePage from './pages/ProfilePage';
import AboutPage from './pages/AboutPage';
import KnowledgePage from './pages/KnowledgePage';
import RecipesPage from './pages/RecipesPage';
import PricingPage from './pages/PricingPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentCancelPage from './pages/PaymentCancelPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import AccessibilityStatementPage from './pages/AccessibilityStatementPage';
import DeleteAccountPage from './pages/DeleteAccountPage';
import NotFoundPage from './pages/NotFoundPage';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { StripeProvider } from './context/StripeContext';
import { SettingsProvider } from './context/SettingsContext';
import { OnboardingEntitlementProvider } from './features/onboarding/OnboardingEntitlementContext';
import EntitlementGuard from './features/onboarding/EntitlementGuard';
import CookieConsent from './components/CookieConsent';
import AccessibilityWidget from './components/AccessibilityWidget';
import WebsiteTour from './components/WebsiteTour';
import OAuthHashHandler from './components/OAuthHashHandler';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <OnboardingEntitlementProvider>
          <StripeProvider>
            <LanguageProvider>
              <SettingsProvider>
              <Router>
                <EntitlementGuard>
                  <div className="App">
                    <OAuthHashHandler />
                    <CookieConsent />
                    <AccessibilityWidget />
                    <WebsiteTour />
                    <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/auth/callback" element={<AuthCallbackPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/waiting-list" element={<WaitingListPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/register/:phoneNumber" element={<WhatsAppRegisterPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/c/:companySlug/profile" element={<ProfilePage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/knowledge" element={<KnowledgePage />} />
                  <Route path="/recipes" element={<RecipesPage />} />
                  <Route path="/landing" element={<LandingPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/payment-success" element={<PaymentSuccessPage />} />
                  <Route path="/payment-cancel" element={<PaymentCancelPage />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                  <Route path="/terms" element={<TermsOfServicePage />} />
                  <Route path="/accessibility-statement" element={<AccessibilityStatementPage />} />
                  <Route path="/delete-account" element={<DeleteAccountPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
                  </div>
                </EntitlementGuard>
              </Router>
              </SettingsProvider>
            </LanguageProvider>
          </StripeProvider>
        </OnboardingEntitlementProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
