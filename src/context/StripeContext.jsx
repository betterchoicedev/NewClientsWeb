import React, { createContext, useContext, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { STRIPE_CONFIG } from '../config/stripe-products';

const StripeContext = createContext({});

// Initialize Stripe
let stripePromise;
const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_CONFIG.publishableKey);
  }
  return stripePromise;
};

export const useStripe = () => {
  const context = useContext(StripeContext);
  if (!context) {
    throw new Error('useStripe must be used within a StripeProvider');
  }
  return context;
};

export const StripeProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Clear any previous errors
  const clearError = () => setError(null);

  // Create checkout session for subscription or one-time payment
  const createCheckoutSession = async (priceId, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      // Determine if this is a subscription or one-time payment
      const { getPriceById, STRIPE_PRICES } = await import('../config/stripe-products');
      const priceInfo = getPriceById(priceId);
      
      // Check if this is specifically a consultation (one-time payment)
      const isConsultation = priceId === STRIPE_PRICES.CONSULTATION;
      const mode = isConsultation ? 'payment' : (priceInfo?.interval ? 'subscription' : 'payment');


      const requestBody = {
        priceId,
        mode,
        ...options,
        successUrl: options.successUrl || STRIPE_CONFIG.options.success_url,
        cancelUrl: options.cancelUrl || STRIPE_CONFIG.options.cancel_url,
      };

      // Call backend API to create checkout session
      const response = await fetch('https://newclientsweb-615263253386.me-west1.run.app/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to create checkout session`);
      }

      const { sessionId, url } = await response.json();

      if (url) {
        // Direct redirect URL provided
        window.location.href = url;
        return { sessionId, url };
      }

      // Use Stripe.js to redirect to checkout
      const stripe = await getStripe();
      if (!stripe) {
        throw new Error('Failed to initialize Stripe');
      }

      const { error: redirectError } = await stripe.redirectToCheckout({
        sessionId,
      });

      if (redirectError) {
        throw new Error(redirectError.message);
      }

      return { sessionId };
    } catch (err) {
      const errorMessage = err.message || 'An error occurred during checkout';
      setError(errorMessage);
      console.error('Checkout error:', err);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Create payment intent for custom checkout form
  const createPaymentIntent = async (amount, currency = 'usd', options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('https://newclientsweb-615263253386.me-west1.run.app/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to cents
          currency,
          ...options,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment intent');
      }

      const paymentIntent = await response.json();
      return paymentIntent;
    } catch (err) {
      const errorMessage = err.message || 'Failed to create payment intent';
      setError(errorMessage);
      console.error('Payment intent error:', err);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Get customer's subscriptions
  const getCustomerSubscriptions = async (customerId) => {
    try {
      const response = await fetch(`https://newclientsweb-615263253386.me-west1.run.app/api/stripe/subscriptions?customerId=${encodeURIComponent(customerId)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch subscriptions');
      }
      
      const data = await response.json();
      return data.subscriptions || [];
    } catch (err) {
      console.error('Subscriptions fetch error:', err);
      throw new Error(err.message || 'Failed to fetch subscriptions');
    }
  };

  // Cancel subscription
  const cancelSubscription = async (subscriptionId, cancelAtPeriodEnd = true) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://newclientsweb-615263253386.me-west1.run.app/api/stripe/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancelAtPeriodEnd,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }

      const result = await response.json();
      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to cancel subscription';
      setError(errorMessage);
      console.error('Cancel subscription error:', err);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Reactivate subscription
  const reactivateSubscription = async (subscriptionId) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://newclientsweb-615263253386.me-west1.run.app/api/stripe/subscriptions/${subscriptionId}/reactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reactivate subscription');
      }

      const result = await response.json();
      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to reactivate subscription';
      setError(errorMessage);
      console.error('Reactivate subscription error:', err);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Get checkout session details
  const getCheckoutSession = async (sessionId) => {
    try {
      const response = await fetch(`https://newclientsweb-615263253386.me-west1.run.app/api/stripe/checkout-session/${sessionId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch checkout session');
      }
      
      return await response.json();
    } catch (err) {
      console.error('Checkout session fetch error:', err);
      throw new Error(err.message || 'Failed to fetch checkout session');
    }
  };

  // Update payment method
  const updatePaymentMethod = async (subscriptionId, paymentMethodId) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://newclientsweb-615263253386.me-west1.run.app/api/stripe/subscriptions/${subscriptionId}/payment-method`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethodId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update payment method');
      }

      return await response.json();
    } catch (err) {
      const errorMessage = err.message || 'Failed to update payment method';
      setError(errorMessage);
      console.error('Update payment method error:', err);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    loading,
    error,
    clearError,
    getStripe,
    createCheckoutSession,
    createPaymentIntent,
    getCustomerSubscriptions,
    cancelSubscription,
    reactivateSubscription,
    getCheckoutSession,
    updatePaymentMethod,
  };

  return (
    <StripeContext.Provider value={value}>
      {children}
    </StripeContext.Provider>
  );
};
