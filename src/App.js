import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
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
import NotFoundPage from './pages/NotFoundPage';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { StripeProvider } from './context/StripeContext';
import { SettingsProvider } from './context/SettingsContext';
import CookieConsent from './components/CookieConsent';
import AccessibilityWidget from './components/AccessibilityWidget';
import WebsiteTour from './components/WebsiteTour';
import './App.css';

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
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
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
