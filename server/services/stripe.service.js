const stripe = require('../config/stripe');
const { isDigitalOnlyPlan, getDigitalOnlyAmount } = require('../utils/helpers');
const { DIGITAL_ONLY_PRICE_ID } = require('../utils/constants');

// ─── Subscription helpers (used by several webhook handlers) ──────────────────

function resolveCommitmentMonths(priceId) {
  const map = {
    'price_1Rg5R8HIeYfvCylDJ4Xfg5hr': 3,
    'price_1Rg5R8HIeYfvCylDxX2PsOrR': 6,
    'price_1Rg5R6HIeYfvCylDcsV3T2Kr': 3,
    'price_1Rg5R6HIeYfvCylDxuQODpK4': 6,
    'price_1Rg5R4HIeYfvCylDAshP6FOk': 3,
    'price_1Rg5R4HIeYfvCylDy1OT1YJc': 6,
    'price_1Rg5QtHIeYfvCylDyXHY5X6G': 3,
    'price_1Rg5QtHIeYfvCylDwr9v599a': 6,
  };
  return map[priceId] ?? null;
}

function resolveSubscriptionType(productId, priceId) {
  if (productId === 'prod_SbI1Lu7FWbybUO') return 'nutrition_training_once_month';
  if (productId === 'prod_SbI1dssS5NElLZ') return 'nutrition_only';
  if (productId === 'prod_SbI1AIv2A46oJ9') return 'nutrition_training';
  if (productId === 'prod_SbI0A23T20wul3') return 'nutrition_only_2x_month';
  if (isDigitalOnlyPlan(productId, priceId)) return 'digital_only';
  return 'unknown';
}

async function updateClientsSubscription(customerEmail, subscriptionStatus, subscriptionType, subscriptionExpiresAt, clientDB) {
  if (!customerEmail) return;
  try {
    const { data: client, error: findError } = await clientDB.from('clients').select('id').eq('email', customerEmail).maybeSingle();
    if (findError) { console.warn(`⚠️ Error finding client with email: ${customerEmail}`, findError); return; }
    if (!client) { console.warn(`⚠️ Could not find client with email: ${customerEmail}`); return; }

    const { error: updateError } = await clientDB.from('clients').update({
      subscription_status: subscriptionStatus || 'none',
      subscription_type: subscriptionType,
      subscription_expires_at: subscriptionExpiresAt,
      updated_at: new Date().toISOString(),
    }).eq('id', client.id);

    if (updateError) console.error('❌ Error updating clients subscription info:', updateError);
    else console.log(`✅ clients subscription info updated for email: ${customerEmail}`);
  } catch (error) {
    console.error('❌ Error in updateClientsSubscription:', error);
  }
}

async function updateChatUserSubscription(customerEmail, subscriptionStatus, subscriptionType, subscriptionExpiresAt, adminDB) {
  if (!adminDB || !customerEmail) {
    if (!adminDB) console.warn('⚠️ adminDB client not configured, skipping chat_users update');
    return;
  }
  try {
    const { data: chatUser, error: findError } = await adminDB.from('chat_users').select('id').eq('email', customerEmail).single();
    if (findError || !chatUser) { console.warn(`⚠️ Could not find chat_user with email: ${customerEmail}`, findError); return; }

    const { error: updateError } = await adminDB.from('chat_users').update({
      subscription_status: subscriptionStatus,
      subscription_type: subscriptionType,
      subscription_expires_at: subscriptionExpiresAt,
      updated_at: new Date().toISOString(),
    }).eq('id', chatUser.id);

    if (updateError) console.error('❌ Error updating chat_users subscription info:', updateError);
    else console.log(`✅ chat_users subscription info updated for email: ${customerEmail}`);
  } catch (error) {
    console.error('❌ Error in updateChatUserSubscription:', error);
  }
}

async function updateClientsSubscriptionByUserId(userId, subscriptionStatus, subscriptionType, subscriptionExpiresAt, clientDB) {
  if (!userId) return false;
  try {
    const { error } = await clientDB.from('clients').update({
      subscription_status: subscriptionStatus || 'none',
      subscription_type: subscriptionType,
      subscription_expires_at: subscriptionExpiresAt,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);
    if (error) {
      console.error('❌ Error updating clients subscription by user_id:', error);
      return false;
    }
    console.log(`✅ clients subscription info updated for user_id: ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Error in updateClientsSubscriptionByUserId:', error);
    return false;
  }
}

async function updateChatUserSubscriptionByUserId(userId, subscriptionStatus, subscriptionType, subscriptionExpiresAt, { clientDB, adminDB }) {
  if (!adminDB || !userId) return false;
  try {
    const { data: client } = await clientDB.from('clients').select('user_code').eq('user_id', userId).maybeSingle();
    if (!client?.user_code) return false;
    const { error } = await adminDB.from('chat_users').update({
      subscription_status: subscriptionStatus,
      subscription_type: subscriptionType,
      subscription_expires_at: subscriptionExpiresAt,
      updated_at: new Date().toISOString(),
    }).eq('user_code', client.user_code);
    if (error) {
      console.error('❌ Error updating chat_users subscription by user_id:', error);
      return false;
    }
    console.log(`✅ chat_users subscription info updated for user_id: ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Error in updateChatUserSubscriptionByUserId:', error);
    return false;
  }
}

async function updateSubscriptionInfo(customerEmail, subscriptionStatus, subscriptionType, subscriptionExpiresAt, { clientDB, adminDB, userId }) {
  if (userId) {
    await Promise.all([
      updateClientsSubscriptionByUserId(userId, subscriptionStatus, subscriptionType, subscriptionExpiresAt, clientDB),
      updateChatUserSubscriptionByUserId(userId, subscriptionStatus, subscriptionType, subscriptionExpiresAt, { clientDB, adminDB }),
    ]);
    return;
  }
  await Promise.all([
    updateClientsSubscription(customerEmail, subscriptionStatus, subscriptionType, subscriptionExpiresAt, clientDB),
    updateChatUserSubscription(customerEmail, subscriptionStatus, subscriptionType, subscriptionExpiresAt, adminDB),
  ]);
}

async function completeOnboardingAfterPaid(userId, { clientDB, adminDB }) {
  if (!userId) return;
  const { completeOnboardingAfterPaidSubscription } = require('../modules/onboarding/onboarding.service');
  await completeOnboardingAfterPaidSubscription(userId, { clientDB, adminDB });
  console.log('✅ Onboarding marked complete after paid subscription for', userId);
}

async function removeUserFromStripeUsageLog(userId, clientDB) {
  try {
    await clientDB.from('stripe_usage_log').delete().eq('user_id', userId);
    console.log('✅ Removed user from stripe_usage_log:', userId);
  } catch (error) {
    console.error('❌ Error removing user from stripe_usage_log:', error);
  }
}

// ─── Webhook event handlers ───────────────────────────────────────────────────

async function handleCheckoutCompleted(session, { clientDB }) {
  console.log('🎉 Processing checkout completion:', session.id);
  try {
    let userId = session.metadata?.user_id || session.client_reference_id;
    const customerEmail = session.customer_details?.email || session.customer_email;

    if (!userId && customerEmail) {
      const { data: clientData } = await clientDB.from('clients').select('user_id').eq('email', customerEmail).single();
      if (clientData?.user_id) { userId = clientData.user_id; console.log('✅ Found client, using user_id:', userId); }
    }

    const paymentData = {
      user_id: userId || null,
      stripe_checkout_session_id: session.id,
      stripe_subscription_id: session.subscription,
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency?.toUpperCase() || 'USD',
      status: 'succeeded',
      payment_method_type: session.payment_method_types?.[0] || 'card',
      created_at: new Date().toISOString(),
    };

    const { error: paymentError } = await clientDB.from('stripe_payments').insert([paymentData]).select();
    if (paymentError) {
      console.error('❌ Error saving payment to Supabase:', paymentError);
      if (paymentError.code === '23503') console.error('⚠️ Foreign key constraint error - user_id may not exist in auth.users');
    } else {
      console.log('✅ Payment record saved successfully');
    }
  } catch (error) {
    console.error('❌ Error processing checkout completion:', error);
  }
}

async function handleSubscriptionCreated(subscription, { clientDB, adminDB, sendWhatsAppWelcomeByUserId }) {
  console.log('🔄 Processing subscription creation:', subscription.id);
  try {
    const userId  = subscription.metadata?.user_id;
    if (!userId) { console.warn('⚠️ No user_id found in subscription metadata'); return; }

    const priceId   = subscription.items.data[0]?.price?.id;
    const productId = subscription.items.data[0]?.price?.product;
    const amount    = subscription.items.data[0]?.price?.unit_amount / 100;
    const currency  = subscription.items.data[0]?.price?.currency?.toUpperCase() || 'USD';

    const subscriptionType   = resolveSubscriptionType(productId, priceId);
    const commitmentMonths   = resolveCommitmentMonths(priceId);
    const subscriptionStartDate = new Date(subscription.created * 1000);

    let commitmentEndDate = null;
    let canCancel = true;

    if (commitmentMonths) {
      commitmentEndDate = new Date(subscriptionStartDate);
      commitmentEndDate.setMonth(commitmentEndDate.getMonth() + commitmentMonths);
      canCancel = new Date() >= commitmentEndDate;
      console.log(`📅 Commitment period: ${commitmentMonths} months until ${commitmentEndDate.toISOString()}`);
      try {
        await stripe.subscriptions.update(subscription.id, { cancel_at: Math.floor(commitmentEndDate.getTime() / 1000) });
        console.log(`🛑 Stripe subscription ${subscription.id} will auto-cancel at ${commitmentEndDate.toISOString()}`);
      } catch (err) {
        console.error('❌ Failed to set cancel_at on subscription:', err);
      }
    }

    const finalAmount = isDigitalOnlyPlan(productId, priceId) ? getDigitalOnlyAmount(subscription) : amount;

    const subscriptionData = {
      user_id: userId,
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      stripe_product_id: productId,
      stripe_price_id: priceId,
      subscription_type: subscriptionType,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end:   new Date(subscription.current_period_end   * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      amount_total:   finalAmount,
      currency,
      commitment_months:   commitmentMonths,
      commitment_end_date: commitmentEndDate ? commitmentEndDate.toISOString() : null,
      can_cancel: canCancel,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: subscriptionError } = await clientDB.from('stripe_subscriptions').insert([subscriptionData]).select();
    if (subscriptionError) {
      console.error('❌ Error saving subscription:', subscriptionError);
      return;
    }
    console.log('✅ Subscription record saved successfully');

    try {
      const customer = await stripe.customers.retrieve(subscription.customer);
      if (customer.email || userId) {
        await updateSubscriptionInfo(
          customer.email,
          subscription.status,
          subscriptionType,
          commitmentEndDate ? commitmentEndDate.toISOString() : null,
          { clientDB, adminDB, userId }
        );
      }
    } catch (customerError) {
      console.error('❌ Error retrieving customer for subscription info update:', customerError);
    }

    const fromOnboarding =
      subscription.metadata?.from === 'onboarding_upsell' ||
      priceId === DIGITAL_ONLY_PRICE_ID;

    if (fromOnboarding && userId) {
      await completeOnboardingAfterPaid(userId, { clientDB, adminDB });
      try {
        const r = await sendWhatsAppWelcomeByUserId(userId, clientDB);
        if (r.success) console.log('📱 WhatsApp welcome sent (onboarding paid) for user:', userId);
        else console.warn('📱 WhatsApp welcome (onboarding paid) skipped or failed:', r.message);
      } catch (e) {
        console.warn('📱 WhatsApp welcome (onboarding paid) error:', e.message);
      }
    }
  } catch (error) {
    console.error('❌ Error processing subscription creation:', error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription, { clientDB, adminDB }) {
  console.log('🔄 Processing subscription update:', subscription.id);
  try {
    const userId = subscription.metadata?.user_id;
    if (!userId) console.warn('⚠️ No user_id found in subscription metadata');

    const { data: existingSubscription } = await clientDB.from('stripe_subscriptions').select('*').eq('stripe_subscription_id', subscription.id).single();

    const price     = subscription.items.data[0]?.price;
    const priceId   = price?.id;
    const productId = price?.product;
    const subscriptionType   = resolveSubscriptionType(productId, priceId);
    const commitmentMonths   = resolveCommitmentMonths(priceId);
    const subscriptionStartDate = new Date(subscription.created * 1000);

    let commitmentEndDate = null;
    let canCancel = true;

    if (commitmentMonths) {
      if (existingSubscription?.commitment_end_date) {
        commitmentEndDate = new Date(existingSubscription.commitment_end_date);
      } else {
        commitmentEndDate = new Date(subscriptionStartDate);
        commitmentEndDate.setMonth(commitmentEndDate.getMonth() + commitmentMonths);
      }
      canCancel = new Date() >= commitmentEndDate;
    }

    const finalAmount = isDigitalOnlyPlan(productId, priceId) ? getDigitalOnlyAmount(subscription) : price?.unit_amount / 100;

    const { error: updateError } = await clientDB.from('stripe_subscriptions').update({
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end:   new Date(subscription.current_period_end   * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      amount_total:    finalAmount,
      commitment_months:   commitmentMonths,
      commitment_end_date: commitmentEndDate ? commitmentEndDate.toISOString() : null,
      can_cancel: canCancel,
      updated_at: new Date().toISOString(),
    }).eq('stripe_subscription_id', subscription.id);

    if (updateError) { console.error('❌ Error updating subscription:', updateError); return; }
    console.log('✅ Subscription updated successfully');

    try {
      const customer = await stripe.customers.retrieve(subscription.customer);
      const metaUserId = subscription.metadata?.user_id || userId;
      if (customer.email || metaUserId) {
        await updateSubscriptionInfo(
          customer.email,
          subscription.status,
          subscriptionType,
          commitmentEndDate ? commitmentEndDate.toISOString() : null,
          { clientDB, adminDB, userId: metaUserId }
        );
      }
      if (
        metaUserId &&
        (subscription.metadata?.from === 'onboarding_upsell' || subscription.status === 'active') &&
        subscription.status === 'active'
      ) {
        // Idempotent: safe if already completed
        if (subscription.metadata?.from === 'onboarding_upsell') {
          await completeOnboardingAfterPaid(metaUserId, { clientDB, adminDB });
        }
      }
    } catch (customerError) {
      console.error('❌ Error retrieving customer for subscription info update:', customerError);
      throw customerError;
    }
  } catch (error) {
    console.error('❌ Error processing subscription update:', error);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription, { clientDB, adminDB }) {
  console.log('❌ Processing subscription deletion:', subscription.id);
  try {
    const { error: deleteError } = await clientDB.from('stripe_subscriptions').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    }).eq('stripe_subscription_id', subscription.id);

    if (deleteError) { console.error('❌ Error marking subscription as cancelled:', deleteError); return; }
    console.log('✅ Subscription marked as cancelled successfully');

    let uid = subscription.metadata?.user_id;
    if (!uid) {
      const { data: subRow } = await clientDB.from('stripe_subscriptions').select('user_id').eq('stripe_subscription_id', subscription.id).maybeSingle();
      uid = subRow?.user_id;
    }
    if (uid) await removeUserFromStripeUsageLog(uid, clientDB);

    try {
      const price          = subscription.items.data[0]?.price;
      const priceId        = price?.id;
      const commitmentMonths = resolveCommitmentMonths(priceId);
      const currentDate    = new Date(subscription.current_period_start * 1000);
      let commitmentEndDate = null;
      if (commitmentMonths) {
        commitmentEndDate = new Date(currentDate);
        commitmentEndDate.setMonth(commitmentEndDate.getMonth() + commitmentMonths);
      }

      const customer = await stripe.customers.retrieve(subscription.customer);
      if (customer.email) {
        await updateSubscriptionInfo(customer.email, 'cancelled', null, commitmentEndDate ? commitmentEndDate.toISOString() : null, { clientDB, adminDB });
      }
    } catch (customerError) {
      console.error('❌ Error retrieving customer for subscription info update:', customerError);
    }
  } catch (error) {
    console.error('❌ Error processing subscription deletion:', error);
  }
}

async function handlePaymentSucceeded(invoice, { clientDB }) {
  console.log('✅ Processing successful payment:', invoice.id);
  try {
    if (!invoice.subscription) return;

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    const userId = subscription.metadata?.user_id;
    if (!userId) return;

    const paymentData = {
      user_id: userId,
      stripe_payment_intent_id: invoice.payment_intent,
      stripe_subscription_id: invoice.subscription,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency?.toUpperCase() || 'USD',
      status: 'succeeded',
      payment_method_type: 'card',
      created_at: new Date(invoice.created * 1000).toISOString(),
    };

    const { error: paymentError } = await clientDB.from('stripe_payments').insert([paymentData]);
    if (paymentError) {
      if (paymentError.code === '23503') {
        console.warn('⚠️ FK constraint error. Retrying payment with null user_id...');
        paymentData.user_id = null;
        const { error: retryError } = await clientDB.from('stripe_payments').insert([paymentData]);
        if (retryError) console.error('❌ Error saving payment even with null user_id:', retryError);
        else console.log('✅ Payment record saved (with null user_id)');
      } else {
        console.error('❌ Error saving payment record:', paymentError);
      }
    } else {
      console.log('✅ Payment record saved successfully');
    }

    await clientDB.from('stripe_subscriptions').update({ status: 'active', updated_at: new Date().toISOString() }).eq('stripe_subscription_id', invoice.subscription);
  } catch (error) {
    console.error('❌ Error processing payment success:', error);
  }
}

async function handlePaymentFailed(invoice, { clientDB }) {
  console.log('❌ Processing failed payment:', invoice.id);
  try {
    if (!invoice.subscription) return;

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    const userId = subscription.metadata?.user_id;
    if (!userId) return;

    const paymentData = {
      user_id: userId,
      stripe_payment_intent_id: invoice.payment_intent,
      stripe_subscription_id: invoice.subscription,
      amount: invoice.amount_due / 100,
      currency: invoice.currency?.toUpperCase() || 'USD',
      status: 'failed',
      payment_method_type: 'card',
      created_at: new Date(invoice.created * 1000).toISOString(),
    };

    const { error: paymentError } = await clientDB.from('stripe_payments').insert([paymentData]);
    if (paymentError) {
      if (paymentError.code === '23503') {
        paymentData.user_id = null;
        const { error: retryError } = await clientDB.from('stripe_payments').insert([paymentData]);
        if (retryError) console.error('❌ Error saving failed payment even with null user_id:', retryError);
      } else {
        console.error('❌ Error saving failed payment record:', paymentError);
      }
    } else {
      console.log('✅ Failed payment record saved successfully');
    }

    await clientDB.from('stripe_subscriptions').update({ status: 'past_due', updated_at: new Date().toISOString() }).eq('stripe_subscription_id', invoice.subscription);
  } catch (error) {
    console.error('❌ Error processing payment failure:', error);
  }
}

/**
 * Build and assign the stripeWebhookHandler. Called once from the billing module
 * to avoid circular dependency (the handler must be assigned to the Express route
 * before other routes, but it references service functions that reference stripe).
 */
function buildStripeWebhookHandler({ clientDB, adminDB, sendWhatsAppWelcomeByUserId }) {
  return async function stripeWebhookHandler(req, res) {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`🎯 Received Stripe webhook event: ${event.type}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object, { clientDB });
          if (event.data.object.subscription) {
            const sub = await stripe.subscriptions.retrieve(event.data.object.subscription, { expand: ['items.data.price'] });
            await handleSubscriptionCreated(sub, { clientDB, adminDB, sendWhatsAppWelcomeByUserId });
          }
          break;
        case 'customer.subscription.created':
          await handleSubscriptionCreated(event.data.object, { clientDB, adminDB, sendWhatsAppWelcomeByUserId });
          break;
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object, { clientDB, adminDB });
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object, { clientDB, adminDB });
          break;
        case 'invoice.payment_succeeded':
          await handlePaymentSucceeded(event.data.object, { clientDB });
          break;
        case 'invoice.payment_failed':
          await handlePaymentFailed(event.data.object, { clientDB });
          break;
        default:
          console.log(`ℹ️ Unhandled Stripe event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('❌ Error processing webhook event:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  };
}

module.exports = {
  buildStripeWebhookHandler,
  resolveCommitmentMonths,
  resolveSubscriptionType,
  updateSubscriptionInfo,
  removeUserFromStripeUsageLog,
  handleCheckoutCompleted,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handlePaymentSucceeded,
  handlePaymentFailed,
};
