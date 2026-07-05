const stripe = require('../../config/stripe');
const { clientDB, adminDB } = require('../../config/db');
const { isDigitalOnlyPlan, getDigitalOnlyAmount } = require('../../utils/helpers');
const { DIGITAL_ONLY_PRICE_ID, BOI_EXCHANGE_RATES_URL } = require('../../utils/constants');
const { handleCheckoutCompleted, handleSubscriptionCreated } = require('../../services/stripe.service');

async function getExchangeRates(req, res) {
  try {
    const response = await fetch(BOI_EXCHANGE_RATES_URL);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.warn('BOI exchange rates fetch failed:', err.message);
    res.status(502).json({ error: 'Failed to fetch exchange rates' });
  }
}

async function checkCommitmentPeriods(req, res) {
  try {
    const { data: subscriptions, error: fetchError } = await clientDB
      .from('stripe_subscriptions')
      .select('*')
      .eq('status', 'active')
      .not('commitment_end_date', 'is', null)
      .not('cancel_at_period_end', 'eq', true);

    if (fetchError) return res.status(500).json({ error: 'Failed to fetch subscriptions' });

    const now = new Date();
    let cancelledCount = 0;
    const results = [];

    for (const sub of subscriptions || []) {
      const commitmentEndDate = new Date(sub.commitment_end_date);
      if (now >= commitmentEndDate) {
        try {
          const updatedSubscription = await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
          const { error: updateError } = await clientDB.from('stripe_subscriptions').update({ cancel_at_period_end: true, updated_at: new Date().toISOString() }).eq('stripe_subscription_id', sub.stripe_subscription_id);
          if (!updateError) {
            cancelledCount++;
            results.push({ subscriptionId: sub.stripe_subscription_id, commitmentEndDate: commitmentEndDate.toISOString(), periodEndDate: new Date(updatedSubscription.current_period_end * 1000).toISOString(), status: 'cancelled_at_period_end' });
          }
        } catch (error) {
          results.push({ subscriptionId: sub.stripe_subscription_id, error: error.message });
        }
      }
    }

    res.json({ message: `Checked ${subscriptions?.length || 0} subscriptions. Auto-cancelled ${cancelledCount}.`, checked: subscriptions?.length || 0, cancelled: cancelledCount, results });
  } catch (error) {
    console.error('❌ Error checking commitment periods:', error);
    res.status(500).json({ error: error.message || 'Failed to check commitment periods' });
  }
}

async function syncToDatabase(req, res) {
  try {
    const { customerId } = req.body;
    if (!customerId) return res.status(400).json({ error: 'Customer ID (user_id) is required' });

    const customers = await stripe.customers.list({ limit: 100 });
    const matchingCustomers = customers.data.filter(c => c.metadata?.user_id === customerId);

    if (matchingCustomers.length === 0) return res.json({ message: 'No Stripe customer found for this user', synced: 0 });

    let syncedCount = 0;

    for (const customer of matchingCustomers) {
      const subscriptions = await stripe.subscriptions.list({ customer: customer.id, expand: ['data.items.data.price'] });

      for (const subscription of subscriptions.data) {
        const priceId = subscription.items.data[0]?.price?.id;
        const productId = subscription.items.data[0]?.price?.product;
        const amount = subscription.items.data[0]?.price?.unit_amount / 100;
        const currency = subscription.items.data[0]?.price?.currency?.toUpperCase() || 'USD';

        let subscriptionType = 'unknown';
        if (productId === 'prod_SbI1Lu7FWbybUO') subscriptionType = 'nutrition_training_once_month';
        else if (productId === 'prod_SbI1dssS5NElLZ') subscriptionType = 'nutrition_only';
        else if (productId === 'prod_SbI1AIv2A46oJ9') subscriptionType = 'nutrition_training';
        else if (productId === 'prod_SbI0A23T20wul3') subscriptionType = 'nutrition_only_2x_month';
        else if (isDigitalOnlyPlan(productId, priceId)) subscriptionType = 'digital_only';

        // Commitment period mapping
        const COMMITMENT_MONTHS_MAP = {
          'price_1Rg5R8HIeYfvCylDJ4Xfg5hr': 3, 'price_1Rg5R8HIeYfvCylDxX2PsOrR': 6,
          'price_1Rg5R6HIeYfvCylDcsV3T2Kr': 3, 'price_1Rg5R6HIeYfvCylDxuQODpK4': 6,
          'price_1Rg5R4HIeYfvCylDAshP6FOk': 3, 'price_1Rg5R4HIeYfvCylDy1OT1YJc': 6,
          'price_1Rg5QtHIeYfvCylDyXHY5X6G': 3, 'price_1Rg5QtHIeYfvCylDwr9v599a': 6,
        };

        const commitmentMonths = COMMITMENT_MONTHS_MAP[priceId] || null;
        const currentDate = new Date(subscription.current_period_start * 1000);
        let commitmentEndDate = null;

        if (commitmentMonths) {
          commitmentEndDate = new Date(currentDate);
          commitmentEndDate.setMonth(commitmentEndDate.getMonth() + commitmentMonths);
        }

        const finalAmount = isDigitalOnlyPlan(productId, priceId) ? getDigitalOnlyAmount(subscription) : amount;

        const { error: subscriptionError } = await clientDB.from('stripe_subscriptions').upsert([{
          user_id: customerId,
          stripe_customer_id: subscription.customer,
          stripe_subscription_id: subscription.id,
          stripe_product_id: productId,
          stripe_price_id: priceId,
          subscription_type: subscriptionType,
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end || false,
          amount_total: finalAmount,
          currency,
          commitment_months: commitmentMonths,
          commitment_end_date: commitmentEndDate ? commitmentEndDate.toISOString() : null,
          can_cancel: commitmentEndDate ? new Date() >= commitmentEndDate : true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }], { onConflict: 'stripe_subscription_id', ignoreDuplicates: false });

        if (!subscriptionError) syncedCount++;
      }

      const sessions = await stripe.checkout.sessions.list({ customer: customer.id, limit: 10 });
      for (const session of sessions.data) {
        if (session.payment_status === 'paid') {
          const paymentData = {
            user_id: customerId,
            stripe_checkout_session_id: session.id,
            stripe_subscription_id: session.subscription,
            amount: session.amount_total ? session.amount_total / 100 : 0,
            currency: session.currency?.toUpperCase() || 'USD',
            status: 'succeeded',
            payment_method_type: session.payment_method_types?.[0] || 'card',
            created_at: new Date(session.created * 1000).toISOString(),
          };

          const { error: paymentError } = await clientDB.from('stripe_payments').upsert([paymentData], { onConflict: 'stripe_checkout_session_id', ignoreDuplicates: false });
          if (!paymentError) syncedCount++;
        }
      }
    }

    res.json({ message: `Successfully synced ${syncedCount} records to database`, synced: syncedCount });
  } catch (error) {
    console.error('❌ Error syncing to database:', error);
    res.status(500).json({ error: error.message || 'Failed to sync to database' });
  }
}

async function createCheckoutSession(req, res) {
  try {
    const { priceId, mode = 'subscription', customerId, customerEmail, successUrl, cancelUrl, promoCode, metadata = {} } = req.body;
    if (!priceId) return res.status(400).json({ error: 'Price ID is required' });

    const lineItem = priceId === DIGITAL_ONLY_PRICE_ID ? { price: priceId } : { price: priceId, quantity: 1 };

    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: [lineItem],
      mode,
      success_url: successUrl || 'https://betterchoice.one/payment-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl || 'https://betterchoice.one/payment-cancel',
      metadata: { priceId, ...metadata },
      allow_promotion_codes: true,
    };

    if (promoCode && typeof promoCode === 'string' && promoCode.trim()) {
      try {
        const promoLookup = await stripe.promotionCodes.list({ code: promoCode.trim().toUpperCase(), active: true, limit: 1 });
        const stripePromoCode = promoLookup?.data?.[0];
        if (stripePromoCode?.id) {
          sessionConfig.discounts = [{ promotion_code: stripePromoCode.id }];
          delete sessionConfig.allow_promotion_codes;
        }
      } catch (promoLookupError) {
        console.warn('⚠️ Failed to lookup/apply Stripe promo code:', promoLookupError?.message);
      }
    }

    if (customerId || customerEmail) {
      try {
        if (customerId) {
          const customers = await stripe.customers.list({ limit: 100 });
          const existingCustomer = customers.data.find(c => c.metadata?.user_id === customerId);
          if (existingCustomer) {
            sessionConfig.customer = existingCustomer.id;
          } else {
            const customer = await stripe.customers.create({ email: customerEmail, metadata: { user_id: customerId } });
            sessionConfig.customer = customer.id;
          }
        } else if (customerEmail) {
          sessionConfig.customer_email = customerEmail;
        }
      } catch (customerError) {
        console.error('Error handling customer:', customerError);
      }
    }

    if (mode === 'subscription') {
      sessionConfig.subscription_data = { metadata: { user_id: customerId || 'anonymous', price_id: priceId, created_at: new Date().toISOString(), ...metadata } };
    } else if (mode === 'payment') {
      sessionConfig.payment_intent_data = { metadata: { user_id: customerId || 'anonymous', price_id: priceId, created_at: new Date().toISOString(), ...metadata } };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
}

async function getCheckoutSession(req, res) {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId, { expand: ['line_items', 'customer', 'subscription'] });
    res.json(session);
  } catch (error) {
    console.error('Error retrieving checkout session:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve checkout session' });
  }
}

async function createPaymentIntent(req, res) {
  try {
    const { amount, currency = 'usd', customerId, metadata = {} } = req.body;
    if (!amount || amount < 50) return res.status(400).json({ error: 'Amount must be at least 50 cents' });

    const paymentIntentConfig = {
      amount: Math.round(amount),
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: { ...metadata, created_at: new Date().toISOString() },
    };

    if (customerId) {
      const customers = await stripe.customers.list({ limit: 100 });
      const existingCustomer = customers.data.find(c => c.metadata?.user_id === customerId);
      if (existingCustomer) paymentIntentConfig.customer = existingCustomer.id;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentConfig);
    res.json({ clientSecret: paymentIntent.client_secret, id: paymentIntent.id });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: error.message || 'Failed to create payment intent' });
  }
}

async function validateAccessCode(req, res) {
  try {
    const { code, user_id, user_code } = req.body || {};
    if (!code || typeof code !== 'string') return res.status(400).json({ valid: false, error: 'Code is required' });
    if (!adminDB) return res.status(500).json({ valid: false, error: 'Chat database not configured' });

    const normalizedCode = code.trim().toUpperCase();
    const nowIso = new Date().toISOString();

    const { data: accessCode, error: codeError } = await adminDB.from('onboarding_access_codes').select('*').eq('code', normalizedCode).eq('is_active', true).maybeSingle();
    if (codeError) return res.status(500).json({ valid: false, error: 'Failed to validate code' });
    if (!accessCode) return res.status(404).json({ valid: false, error: 'Code is invalid or unavailable' });

    const now = new Date(nowIso);
    if (accessCode.valid_from && new Date(accessCode.valid_from) > now) return res.status(400).json({ valid: false, error: 'Code is not active yet' });
    if (accessCode.valid_until && new Date(accessCode.valid_until) < now) return res.status(400).json({ valid: false, error: 'Code has expired' });

    const usedCount = Number(accessCode.used_count || 0);
    const maxUses = accessCode.max_uses == null ? null : Number(accessCode.max_uses);
    if (maxUses != null && usedCount >= maxUses) return res.status(400).json({ valid: false, error: 'Code usage limit reached' });

    const updates = { used_count: usedCount + 1, last_used_at: nowIso, updated_at: nowIso };

    let resolvedUserCode = user_code || null;
    if (!resolvedUserCode && user_id) {
      const { data: clientData } = await clientDB.from('clients').select('user_code').eq('user_id', user_id).maybeSingle();
      resolvedUserCode = clientData?.user_code || null;
    }
    if (resolvedUserCode) {
      const { data: chatUserData } = await adminDB.from('chat_users').select('id').eq('user_code', resolvedUserCode).maybeSingle();
      if (chatUserData?.id) updates.last_used_by_user_id = chatUserData.id;
    }

    const { error: updateError } = await adminDB.from('onboarding_access_codes').update(updates).eq('id', accessCode.id);
    if (updateError) return res.status(500).json({ valid: false, error: 'Failed to apply code usage' });

    return res.json({ valid: true, code: normalizedCode, message: 'Code validated successfully' });
  } catch (error) {
    console.error('❌ Error in validate-access-code:', error);
    return res.status(500).json({ valid: false, error: 'Internal server error', message: error.message });
  }
}

async function getSubscriptions(req, res) {
  try {
    const { customerId } = req.query;
    if (!customerId) return res.status(400).json({ error: 'Customer ID is required' });

    const customers = await stripe.customers.list({ limit: 100 });
    const matchingCustomers = customers.data.filter(c => c.metadata?.user_id === customerId);
    if (matchingCustomers.length === 0) return res.json({ subscriptions: [] });

    let allSubscriptions = [];
    for (const customer of matchingCustomers) {
      const subscriptions = await stripe.subscriptions.list({ customer: customer.id, expand: ['data.items.data.price', 'data.latest_invoice'] });
      allSubscriptions = allSubscriptions.concat(subscriptions.data);
    }

    res.json({ subscriptions: allSubscriptions });
  } catch (error) {
    console.error('Error retrieving subscriptions:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve subscriptions' });
  }
}

async function _removeUserFromStripeUsageLog(userId) {
  if (!userId) return;
  try {
    const { data: client } = await clientDB.from('clients').select('user_code').eq('user_id', userId).maybeSingle();
    const userCode = client?.user_code;
    if (!userCode) return;
    const { error } = await clientDB.from('stripe_usage_log').delete().eq('user_code', userCode);
    if (error) console.warn('⚠️ stripe_usage_log delete failed:', error.message);
    else console.log('✅ Removed stripe_usage_log row for user_code:', userCode);
  } catch (e) {
    console.warn('⚠️ removeUserFromStripeUsageLog:', e.message);
  }
}

async function cancelSubscription(req, res) {
  try {
    const { subscriptionId } = req.params;
    const { cancelAtPeriodEnd = true } = req.body;

    const subscription = cancelAtPeriodEnd
      ? await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
      : await stripe.subscriptions.cancel(subscriptionId);

    const userId = subscription.metadata?.user_id;
    if (!userId) {
      const { data: row } = await clientDB.from('stripe_subscriptions').select('user_id').eq('stripe_subscription_id', subscriptionId).maybeSingle();
      if (row?.user_id) await _removeUserFromStripeUsageLog(row.user_id);
    } else {
      await _removeUserFromStripeUsageLog(userId);
    }

    res.json(subscription);
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
  }
}

async function reactivateSubscription(req, res) {
  try {
    const subscription = await stripe.subscriptions.update(req.params.subscriptionId, { cancel_at_period_end: false });
    res.json(subscription);
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({ error: error.message || 'Failed to reactivate subscription' });
  }
}

async function updatePaymentMethod(req, res) {
  try {
    const { subscriptionId } = req.params;
    const { paymentMethodId } = req.body;
    if (!paymentMethodId) return res.status(400).json({ error: 'Payment method ID is required' });

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await stripe.customers.update(subscription.customer, { invoice_settings: { default_payment_method: paymentMethodId } });
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, { default_payment_method: paymentMethodId });
    res.json(updatedSubscription);
  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({ error: error.message || 'Failed to update payment method' });
  }
}

async function processCheckoutSession(req, res) {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Session ID is required' });

    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription', 'line_items'] });

    if (session.payment_status === 'paid') {
      await handleCheckoutCompleted(session, { clientDB });

      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription, { expand: ['items.data.price'] });
        const { sendWhatsAppWelcomeByUserId } = require('../../services/whatsapp.service');
        await handleSubscriptionCreated(subscription, { clientDB, adminDB, sendWhatsAppWelcomeByUserId });
      }

      res.json({ success: true, message: 'Checkout session processed successfully', sessionId: session.id, subscriptionId: session.subscription });
    } else {
      res.json({ success: false, message: 'Payment not completed', paymentStatus: session.payment_status });
    }
  } catch (error) {
    console.error('❌ Error processing checkout session:', error);
    res.status(500).json({ error: error.message || 'Failed to process checkout session' });
  }
}

module.exports = {
  getExchangeRates, checkCommitmentPeriods, syncToDatabase,
  createCheckoutSession, getCheckoutSession, createPaymentIntent,
  validateAccessCode, getSubscriptions, cancelSubscription,
  reactivateSubscription, updatePaymentMethod, processCheckoutSession,
};
