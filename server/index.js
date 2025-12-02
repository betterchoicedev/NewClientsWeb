require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client for server-side operations
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY
);

console.log('Supabase connection:', process.env.REACT_APP_SUPABASE_URL ? 'Configured' : 'Missing URL');

const app = express();
function normalizePort(value) {
  const port = parseInt(value, 10);
  if (Number.isNaN(port)) {
    return value; // named pipe
  }
  if (port >= 0) {
    return port;
  }
  return false;
}

const PORT = normalizePort(
  process.env.PORT ||
  process.env.HTTP_PLATFORM_PORT ||
  '8080'
);

// Middleware - Temporary permissive CORS for debugging
app.use(cors({
  origin: true, // Allow all origins temporarily for debugging
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Raw body parser for webhooks (BEFORE express.json())
app.use('/api/webhooks', express.raw({ type: 'application/json' }));

// JSON parser for other routes
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Manual sync endpoint - sync existing Stripe data to database
app.post('/api/stripe/sync-to-database', async (req, res) => {
  try {
    const { customerId } = req.body;
    
    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID (user_id) is required' });
    }
    
    console.log('🔄 Manually syncing Stripe data to database for user:', customerId);
    
    // Find Stripe customer
    const customers = await stripe.customers.list({
      limit: 100
    });
    
    const matchingCustomers = customers.data.filter(customer => 
      customer.metadata && customer.metadata.user_id === customerId
    );
    
    if (matchingCustomers.length === 0) {
      return res.json({ message: 'No Stripe customer found for this user', synced: 0 });
    }
    
    let syncedCount = 0;
    
    // Sync subscriptions for each customer
    for (const customer of matchingCustomers) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        expand: ['data.items.data.price']
      });
      
      for (const subscription of subscriptions.data) {
        // Get product and price info
        const priceId = subscription.items.data[0]?.price?.id;
        const productId = subscription.items.data[0]?.price?.product;
        const amount = subscription.items.data[0]?.price?.unit_amount / 100;
        const currency = subscription.items.data[0]?.price?.currency?.toUpperCase() || 'USD';
        
        // Determine subscription type based on product ID
        let subscriptionType = 'unknown';
        if (productId === 'prod_SbI1Lu7FWbybUO') subscriptionType = 'better_pro';
        else if (productId === 'prod_SbI1dssS5NElLZ') subscriptionType = 'podcast_consultation';
        else if (productId === 'prod_SbI1AIv2A46oJ9') subscriptionType = 'nutrition_training';
        else if (productId === 'prod_SbI0A23T20wul3') subscriptionType = 'nutrition_only';
        
        // Determine commitment period based on exact price ID mapping
        let commitmentMonths = null; // Default no commitment 
        const currentDate = new Date(subscription.current_period_start * 1000);
        
        // Only BetterPro plans have commitment periods
        if (priceId === 'price_1Rg5R8HIeYfvCylDJ4Xfg5hr') {
          commitmentMonths = 3; // BetterPro 3-Month Plan
        } else if (priceId === 'price_1Rg5R8HIeYfvCylDxX2PsOrR') {
          commitmentMonths = 6; // BetterPro 6-Month Plan
        }
        // Other products (Nutrition, Training, etc.) have no commitment period
        
        // Calculate commitment end date (only if there's a commitment period)
        let commitmentEndDate = null;
        let canCancel = true; // Default: can cancel anytime
        
        if (commitmentMonths) {
          commitmentEndDate = new Date(currentDate);
          commitmentEndDate.setMonth(commitmentEndDate.getMonth() + commitmentMonths);
          canCancel = new Date() >= commitmentEndDate; // Can only cancel after commitment period
        }
        
        const subscriptionData = {
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
          amount_total: amount,
          currency: currency,
          commitment_months: commitmentMonths,
          commitment_end_date: commitmentEndDate ? commitmentEndDate.toISOString() : null,
          can_cancel: canCancel,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Insert or update subscription
        const { error: subscriptionError } = await supabase
          .from('stripe_subscriptions')
          .upsert([subscriptionData], { 
            onConflict: 'stripe_subscription_id',
            ignoreDuplicates: false 
          });
        
        if (subscriptionError) {
          console.error('❌ Error saving subscription:', subscriptionError);
        } else {
          console.log('✅ Subscription synced:', subscription.id);
          syncedCount++;
        }
      }
      
      // Also sync recent payments/checkout sessions
      const sessions = await stripe.checkout.sessions.list({
        customer: customer.id,
        limit: 10
      });
      
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
            created_at: new Date(session.created * 1000).toISOString()
          };
          
          const { error: paymentError } = await supabase
            .from('stripe_payments')
            .upsert([paymentData], { 
              onConflict: 'stripe_checkout_session_id',
              ignoreDuplicates: false 
            });
          
          if (paymentError) {
            // If foreign key error, try with null user_id
            if (paymentError.code === '23503' && paymentData.user_id) {
              console.warn('⚠️ Foreign key constraint error. Retrying sync with null user_id...');
              paymentData.user_id = null;
              const { error: retryError } = await supabase
                .from('stripe_payments')
                .upsert([paymentData], { 
                  onConflict: 'stripe_checkout_session_id',
                  ignoreDuplicates: false 
                });
              
              if (retryError) {
                console.error('❌ Error saving payment even with null user_id:', retryError);
              } else {
                console.log('✅ Payment synced (with null user_id):', session.id);
                syncedCount++;
              }
            } else {
              console.error('❌ Error saving payment:', paymentError);
            }
          } else {
            console.log('✅ Payment synced:', session.id);
            syncedCount++;
          }
        }
      }
    }
    
    res.json({ 
      message: `Successfully synced ${syncedCount} records to database`,
      synced: syncedCount 
    });
    
  } catch (error) {
    console.error('❌ Error syncing to database:', error);
    res.status(500).json({ error: error.message || 'Failed to sync to database' });
  }
});

// ====================================
// STRIPE CHECKOUT ROUTES
// ====================================

// Create checkout session
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { 
      priceId, 
      mode = 'subscription',
      customerId,
      customerEmail,
      successUrl,
      cancelUrl,
      metadata = {}
    } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }

    console.log('Creating checkout session for price:', priceId, 'mode:', mode);

    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: mode,
      // Use BetterChoice production domain as default for redirects
      // Still allow overriding via successUrl/cancelUrl in the request body
      success_url: successUrl || `https://betterchoice.one/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `https://betterchoice.one/payment-cancel`,
      metadata: {
        priceId,
        ...metadata
      },
      // Allow promotion codes
      allow_promotion_codes: true,
    };

    // Handle customer
    if (customerId || customerEmail) {
      try {
        // First try to find existing customer
        if (customerId) {
          const customers = await stripe.customers.list({
            limit: 100 // Get customers to search through
          });

          // Filter by metadata on our side
          const existingCustomer = customers.data.find(customer => 
            customer.metadata && customer.metadata.user_id === customerId
          );

          if (existingCustomer) {
            sessionConfig.customer = existingCustomer.id;
            console.log('Found existing customer:', existingCustomer.id);
          } else {
            // Create new customer
            const customer = await stripe.customers.create({
              email: customerEmail,
              metadata: { user_id: customerId }
            });
            sessionConfig.customer = customer.id;
            console.log('Created new customer:', customer.id);
          }
        } else if (customerEmail) {
          sessionConfig.customer_email = customerEmail;
        }
      } catch (customerError) {
        console.error('Error handling customer:', customerError);
        // Continue without customer - not critical
      }
    }

    // Add subscription-specific config
    if (mode === 'subscription') {
      sessionConfig.subscription_data = {
        metadata: {
          user_id: customerId || 'anonymous',
          price_id: priceId,
          created_at: new Date().toISOString(),
          ...metadata
        }
      };
    } else if (mode === 'payment') {
      sessionConfig.payment_intent_data = {
        metadata: {
          user_id: customerId || 'anonymous',
          price_id: priceId,
          created_at: new Date().toISOString(),
          ...metadata
        }
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    
    console.log('Checkout session created:', session.id);
    
    res.json({ 
      sessionId: session.id,
      url: session.url 
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create checkout session' 
    });
  }
});

// Get checkout session details
app.get('/api/stripe/checkout-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'customer', 'subscription']
    });
    
    res.json(session);
  } catch (error) {
    console.error('Error retrieving checkout session:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to retrieve checkout session' 
    });
  }
});

// ====================================
// PAYMENT INTENT ROUTES
// ====================================

// Create payment intent for custom checkout
app.post('/api/stripe/create-payment-intent', async (req, res) => {
  try {
    const { 
      amount, 
      currency = 'usd',
      customerId,
      metadata = {}
    } = req.body;

    if (!amount || amount < 50) { // Stripe minimum is $0.50
      return res.status(400).json({ error: 'Amount must be at least 50 cents' });
    }

    console.log('Creating payment intent for amount:', amount, currency);

    const paymentIntentConfig = {
      amount: Math.round(amount), // Ensure integer
      currency: currency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        ...metadata,
        created_at: new Date().toISOString()
      }
    };

    // Add customer if provided
    if (customerId) {
      try {
        const customers = await stripe.customers.list({
          limit: 100 // Get customers to search through
        });

        // Filter by metadata on our side
        const existingCustomer = customers.data.find(customer => 
          customer.metadata && customer.metadata.user_id === customerId
        );

        if (existingCustomer) {
          paymentIntentConfig.customer = existingCustomer.id;
        }
      } catch (error) {
        console.error('Error finding customer:', error);
      }
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentConfig);

    console.log('Payment intent created:', paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create payment intent' 
    });
  }
});

// ====================================
// SUBSCRIPTION MANAGEMENT ROUTES
// ====================================

// Get customer subscriptions
app.get('/api/stripe/subscriptions', async (req, res) => {
  try {
    const { customerId } = req.query;
    
    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    console.log('Fetching subscriptions for customer:', customerId);
    
    // Find Stripe customer by user_id metadata
    // Note: customers.list doesn't support metadata filtering, so we get recent customers and filter
    const customers = await stripe.customers.list({
      limit: 100 // Get more customers to search through
    });

    // Filter customers by metadata on our side
    const matchingCustomers = customers.data.filter(customer => 
      customer.metadata && customer.metadata.user_id === customerId
    );

    if (matchingCustomers.length === 0) {
      return res.json({ subscriptions: [] });
    }

    let allSubscriptions = [];
    
    // Get subscriptions for all matching customers
    for (const customer of matchingCustomers) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        expand: ['data.items.data.price', 'data.latest_invoice']
      });
      allSubscriptions = allSubscriptions.concat(subscriptions.data);
    }
    
    console.log(`Found ${allSubscriptions.length} subscriptions`);
    
    res.json({ subscriptions: allSubscriptions });
  } catch (error) {
    console.error('Error retrieving subscriptions:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to retrieve subscriptions' 
    });
  }
});

// Cancel subscription
app.post('/api/stripe/subscriptions/:subscriptionId/cancel', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { cancelAtPeriodEnd = true } = req.body;
    
    console.log('Cancelling subscription:', subscriptionId, 'at period end:', cancelAtPeriodEnd);

    let subscription;
    
    if (cancelAtPeriodEnd) {
      // Cancel at period end
      subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    } else {
      // Cancel immediately
      subscription = await stripe.subscriptions.cancel(subscriptionId);
    }
    
    console.log('Subscription cancelled:', subscription.id, 'status:', subscription.status);
    
    res.json(subscription);
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to cancel subscription' 
    });
  }
});

// Reactivate subscription
app.post('/api/stripe/subscriptions/:subscriptionId/reactivate', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    console.log('Reactivating subscription:', subscriptionId);

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });
    
    console.log('Subscription reactivated:', subscription.id);
    
    res.json(subscription);
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to reactivate subscription' 
    });
  }
});

// Update subscription payment method
app.post('/api/stripe/subscriptions/:subscriptionId/payment-method', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { paymentMethodId } = req.body;
    
    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method ID is required' });
    }

    console.log('Updating payment method for subscription:', subscriptionId);

    // Get subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Update customer's default payment method
    await stripe.customers.update(subscription.customer, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    // Update subscription's default payment method
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      default_payment_method: paymentMethodId
    });
    
    console.log('Payment method updated for subscription:', subscriptionId);
    
    res.json(updatedSubscription);
  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to update payment method' 
    });
  }
});

// ====================================
// WEBHOOK HANDLING
// ====================================

// Stripe webhooks handler
app.post('/api/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  console.log('🎯 Webhook received from IP:', req.ip || req.headers['x-forwarded-for']);
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('❌ STRIPE_WEBHOOK_SECRET is not configured!');
    return res.status(500).send('Webhook secret not configured');
  }

  try {
    event = stripe.webhooks.constructEvent(
      req.body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    console.log('✅ Webhook verified:', event.type, event.id);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    console.error('Headers:', req.headers);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('💳 Checkout session completed:', event.data.object.id);
        await handleCheckoutCompleted(event.data.object);
        break;
      
      case 'customer.subscription.created':
        console.log('🔄 Subscription created:', event.data.object.id);
        await handleSubscriptionCreated(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        console.log('🔄 Subscription updated:', event.data.object.id);
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        console.log('❌ Subscription deleted:', event.data.object.id);
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        console.log('✅ Payment succeeded:', event.data.object.id);
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        console.log('❌ Payment failed:', event.data.object.id);
        await handlePaymentFailed(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Manual endpoint to process a checkout session (backup if webhook fails)
app.post('/api/stripe/process-checkout-session', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    console.log('🔄 Manually processing checkout session:', sessionId);
    
    // Retrieve full session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'line_items']
    });
    
    console.log('📋 Session retrieved:', session.id, 'Status:', session.payment_status);
    
    // Process the checkout completion
    if (session.payment_status === 'paid') {
      await handleCheckoutCompleted(session);
      
      // If subscription exists, process it too
      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription, {
          expand: ['items.data.price']
        });
        await handleSubscriptionCreated(subscription);
      }
      
      res.json({ 
        success: true, 
        message: 'Checkout session processed successfully',
        sessionId: session.id,
        subscriptionId: session.subscription 
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Payment not completed',
        paymentStatus: session.payment_status 
      });
    }
    
  } catch (error) {
    console.error('❌ Error processing checkout session:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to process checkout session' 
    });
  }
});

// ====================================
// WEBHOOK HANDLER FUNCTIONS
// ====================================

async function handleCheckoutCompleted(session) {
  console.log('🎉 Processing checkout completion:', session.id);
  
  try {
    // Extract user information
    let userId = session.metadata?.user_id || session.client_reference_id;
    const customerEmail = session.customer_details?.email || session.customer_email;
    
    console.log('Checkout completed for user:', userId, 'email:', customerEmail);
    
    // If no userId but we have email, try to find user in clients table
    if (!userId && customerEmail) {
      console.log('🔍 No user_id found, searching for client by email:', customerEmail);
      const { data: clientData } = await supabase
        .from('clients')
        .select('user_id')
        .eq('email', customerEmail)
        .single();
      
      if (clientData?.user_id) {
        userId = clientData.user_id;
        console.log('✅ Found client, using user_id:', userId);
      }
    }
    
    // Note: We'll rely on database constraints. If user doesn't exist, 
    // the insert will fail and we'll retry with null user_id
    
    // Save payment record
    const paymentData = {
      user_id: userId || null,
      stripe_checkout_session_id: session.id,
      stripe_subscription_id: session.subscription,
      amount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency?.toUpperCase() || 'USD',
      status: 'succeeded',
      payment_method_type: session.payment_method_types?.[0] || 'card',
      created_at: new Date().toISOString()
    };
    
    console.log('💾 Saving payment to Supabase:', paymentData);
    
    const { data, error: paymentError } = await supabase
      .from('stripe_payments')
      .insert([paymentData])
      .select();
    
    if (paymentError) {
      console.error('❌ Error saving payment to Supabase:', paymentError);
      console.error('Payment error code:', paymentError.code, 'userId:', userId);
      
      // If foreign key error, the user_id might not exist in auth.users
      // This should not happen if database constraints are properly configured
      if (paymentError.code === '23503') {
        console.error('⚠️ Foreign key constraint error - user_id may not exist in auth.users');
        console.error('   Please verify that the foreign key points to auth.users, not users table');
      }
      
      console.error('Payment data that failed:', paymentData);
    } else {
      console.log('✅ Payment record saved successfully:', data);
    }
    
    // If this is a subscription, it will be handled by handleSubscriptionCreated
    
  } catch (error) {
    console.error('❌ Error processing checkout completion:', error);
    console.error('Full error stack:', error.stack);
  }
}

async function handleSubscriptionCreated(subscription) {
  console.log('🔄 Processing subscription creation:', subscription.id);
  
  try {
    // Extract user_id from subscription metadata
    const userId = subscription.metadata?.user_id;
    
    if (!userId) {
      console.warn('⚠️ No user_id found in subscription metadata');
      return;
    }
    
    console.log('Creating subscription for user:', userId);
    
    // Get product and price info
    const priceId = subscription.items.data[0]?.price?.id;
    const productId = subscription.items.data[0]?.price?.product;
    const amount = subscription.items.data[0]?.price?.unit_amount / 100;
    const currency = subscription.items.data[0]?.price?.currency?.toUpperCase() || 'USD';
    
    // Determine subscription type based on product ID
    let subscriptionType = 'unknown';
    if (productId === 'prod_SbI1Lu7FWbybUO') subscriptionType = 'better_pro';
    else if (productId === 'prod_SbI1dssS5NElLZ') subscriptionType = 'podcast_consultation';
    else if (productId === 'prod_SbI1AIv2A46oJ9') subscriptionType = 'nutrition_training';
    else if (productId === 'prod_SbI0A23T20wul3') subscriptionType = 'nutrition_only';
    
    // Determine commitment period based on exact price ID mapping
    let commitmentMonths = null; // Default no commitment
    const currentDate = new Date(subscription.current_period_start * 1000);
    
    // Only BetterPro plans have commitment periods
    if (priceId === 'price_1Rg5R8HIeYfvCylDJ4Xfg5hr') {
      commitmentMonths = 3; // BetterPro 3-Month Plan
    } else if (priceId === 'price_1Rg5R8HIeYfvCylDxX2PsOrR') {
      commitmentMonths = 6; // BetterPro 6-Month Plan
    }
    // Other products (Nutrition, Training, etc.) have no commitment period
    
    // Calculate commitment end date (only if there's a commitment period)
    let commitmentEndDate = null;
    let canCancel = true; // Default: can cancel anytime
    
    if (commitmentMonths) {
      commitmentEndDate = new Date(currentDate);
      commitmentEndDate.setMonth(commitmentEndDate.getMonth() + commitmentMonths);
      canCancel = new Date() >= commitmentEndDate; // Can only cancel after commitment period
    }
    
    const subscriptionData = {
      user_id: userId,
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      stripe_product_id: productId,
      stripe_price_id: priceId,
      subscription_type: subscriptionType,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      amount_total: amount,
      currency: currency,
      commitment_months: commitmentMonths,
      commitment_end_date: commitmentEndDate ? commitmentEndDate.toISOString() : null,
      can_cancel: canCancel,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('📋 Subscription data to save:', subscriptionData);
    
    // Note: We'll rely on database constraints. If user doesn't exist, 
    // the insert will fail and we'll retry with null user_id
    
    console.log('💾 Saving subscription to Supabase...');
    
    const { data: insertedData, error: subscriptionError } = await supabase
      .from('stripe_subscriptions')
      .insert([subscriptionData])
      .select();
    
    if (subscriptionError) {
      console.error('❌ Error saving subscription:', subscriptionError);
      console.error('Subscription data that failed:', subscriptionData);
      
      // If foreign key error, the user_id might not exist in auth.users
      // This should not happen if database constraints are properly configured
      if (subscriptionError.code === '23503') {
        console.error('⚠️ Foreign key constraint error - user_id may not exist in auth.users');
        console.error('   Please verify that the foreign key points to auth.users, not users table');
      }
    } else {
      console.log('✅ Subscription record saved successfully:', insertedData);
    }
    
  } catch (error) {
    console.error('❌ Error processing subscription creation:', error);
    console.error('Full error stack:', error.stack);
  }
}

async function handleSubscriptionUpdated(subscription) {
  console.log('🔄 Processing subscription update:', subscription.id);
  
  try {
    const userId = subscription.metadata?.user_id;
    
    if (!userId) {
      console.warn('⚠️ No user_id found in subscription metadata');
    }
    
    console.log('Updating subscription for user:', userId);
    
    // Get product and price info for commitment tracking
    const priceId = subscription.items.data[0]?.price?.id;
    
    // Determine commitment period based on exact price ID mapping
    let commitmentMonths = null; // Default no commitment
    const currentDate = new Date(subscription.current_period_start * 1000);
    
    // Only BetterPro plans have commitment periods
    if (priceId === 'price_1Rg5R8HIeYfvCylDJ4Xfg5hr') {
      commitmentMonths = 3; // BetterPro 3-Month Plan
    } else if (priceId === 'price_1Rg5R8HIeYfvCylDxX2PsOrR') {
      commitmentMonths = 6; // BetterPro 6-Month Plan
    }
    // Other products (Nutrition, Training, etc.) have no commitment period
    
    // Calculate commitment end date (only if there's a commitment period)
    let commitmentEndDate = null;
    let canCancel = true; // Default: can cancel anytime
    
    if (commitmentMonths) {
      commitmentEndDate = new Date(currentDate);
      commitmentEndDate.setMonth(commitmentEndDate.getMonth() + commitmentMonths);
      canCancel = new Date() >= commitmentEndDate; // Can only cancel after commitment period
    }
    
    // Update subscription record
    const updateData = {
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      commitment_months: commitmentMonths,
      commitment_end_date: commitmentEndDate ? commitmentEndDate.toISOString() : null,
      can_cancel: canCancel,
      updated_at: new Date().toISOString()
    };
    
    const { error: updateError } = await supabase
      .from('stripe_subscriptions')
      .update(updateData)
      .eq('stripe_subscription_id', subscription.id);
    
    if (updateError) {
      console.error('❌ Error updating subscription:', updateError);
    } else {
      console.log('✅ Subscription updated successfully');
    }
    
  } catch (error) {
    console.error('❌ Error processing subscription update:', error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  console.log('❌ Processing subscription deletion:', subscription.id);
  
  try {
    const userId = subscription.metadata?.user_id;
    
    if (!userId) {
      console.warn('⚠️ No user_id found in subscription metadata');
    }
    
    console.log('Marking subscription as deleted for user:', userId);
    
    // Update subscription status to cancelled
    const { error: deleteError } = await supabase
      .from('stripe_subscriptions')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);
    
    if (deleteError) {
      console.error('❌ Error marking subscription as cancelled:', deleteError);
    } else {
      console.log('✅ Subscription marked as cancelled successfully');
    }
    
  } catch (error) {
    console.error('❌ Error processing subscription deletion:', error);
  }
}

async function handlePaymentSucceeded(invoice) {
  console.log('✅ Processing successful payment:', invoice.id);
  
  try {
    if (invoice.subscription) {
      console.log('Payment for subscription:', invoice.subscription);
      
      // Get subscription details to find user
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const userId = subscription.metadata?.user_id;
      
      if (userId) {
        // Save payment record
        const paymentData = {
          user_id: userId,
          stripe_payment_intent_id: invoice.payment_intent,
          stripe_subscription_id: invoice.subscription,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency?.toUpperCase() || 'USD',
          status: 'succeeded',
          payment_method_type: 'card', // Default since we don't have detailed info
          created_at: new Date(invoice.created * 1000).toISOString()
        };
        
        const { error: paymentError } = await supabase
          .from('stripe_payments')
          .insert([paymentData]);
        
        if (paymentError) {
          // If foreign key error, try with null user_id
          if (paymentError.code === '23503') {
            console.warn('⚠️ Foreign key constraint error. Retrying payment with null user_id...');
            paymentData.user_id = null;
            const { error: retryError } = await supabase
              .from('stripe_payments')
              .insert([paymentData]);
            
            if (retryError) {
              console.error('❌ Error saving payment even with null user_id:', retryError);
            } else {
              console.log('✅ Payment record saved successfully (with null user_id)');
            }
          } else {
            console.error('❌ Error saving payment record:', paymentError);
          }
        } else {
          console.log('✅ Payment record saved successfully');
        }
        
        // Update subscription status to active if it was past_due
        const { error: updateError } = await supabase
          .from('stripe_subscriptions')
          .update({ 
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', invoice.subscription);
        
        if (updateError) {
          console.error('❌ Error updating subscription status:', updateError);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error processing payment success:', error);
  }
}

async function handlePaymentFailed(invoice) {
  console.log('❌ Processing failed payment:', invoice.id);
  
  try {
    if (invoice.subscription) {
      console.log('Failed payment for subscription:', invoice.subscription);
      
      // Get subscription details to find user
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const userId = subscription.metadata?.user_id;
      
      if (userId) {
        // Save failed payment record
        const paymentData = {
          user_id: userId,
          stripe_payment_intent_id: invoice.payment_intent,
          stripe_subscription_id: invoice.subscription,
          amount: invoice.amount_due / 100,
          currency: invoice.currency?.toUpperCase() || 'USD',
          status: 'failed',
          payment_method_type: 'card',
          created_at: new Date(invoice.created * 1000).toISOString()
        };
        
        const { error: paymentError } = await supabase
          .from('stripe_payments')
          .insert([paymentData]);
        
        if (paymentError) {
          // If foreign key error, try with null user_id
          if (paymentError.code === '23503') {
            console.warn('⚠️ Foreign key constraint error. Retrying failed payment with null user_id...');
            paymentData.user_id = null;
            const { error: retryError } = await supabase
              .from('stripe_payments')
              .insert([paymentData]);
            
            if (retryError) {
              console.error('❌ Error saving failed payment even with null user_id:', retryError);
            } else {
              console.log('✅ Failed payment record saved (with null user_id)');
            }
          } else {
            console.error('❌ Error saving failed payment record:', paymentError);
          }
        } else {
          console.log('✅ Failed payment record saved');
        }
        
        // Update subscription status to past_due
        const { error: updateError } = await supabase
          .from('stripe_subscriptions')
          .update({ 
            status: 'past_due',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', invoice.subscription);
        
        if (updateError) {
          console.error('❌ Error updating subscription to past_due:', updateError);
        } else {
          console.log('✅ Subscription marked as past_due');
        }
      }
    }
  } catch (error) {
    console.error('❌ Error processing payment failure:', error);
  }
}

// ====================================
// CONTACT FORM ENDPOINT
// ====================================

app.post('/api/contact', async (req, res) => {
  try {
    const { fullName, email, phone, message, timestamp } = req.body;

    // Basic validation
    if (!fullName || !email || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Full name, email, and message are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        message: 'Please provide a valid email address'
      });
    }

    // Get client IP and user agent
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Save to Supabase
    const { data, error } = await supabase
      .from('contact_messages')
      .insert([
        {
          full_name: fullName,
          email: email,
          phone: phone || null,
          message: message,
          ip_address: ipAddress,
          user_agent: userAgent,
          created_at: timestamp || new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to save contact message'
      });
    }

    console.log('📧 Contact message saved to Supabase:', {
      id: data[0]?.id,
      fullName,
      email,
      phone: phone || 'Not provided',
      ip: ipAddress
    });

    res.status(200).json({
      success: true,
      message: 'Contact form submitted successfully',
      id: data[0]?.id
    });

  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process contact form'
    });
  }
});

// ====================================
// ERROR HANDLING
// ====================================

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ====================================
// SERVER STARTUP
// ====================================

const serverInstance = app.listen(PORT, () => {
  const addressInfo = serverInstance.address();
  const displayPort = typeof addressInfo === 'string' ? addressInfo : addressInfo?.port;
  console.log(`🚀 Stripe API server running on port ${displayPort}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💳 Stripe API Version: ${stripe.VERSION || 'latest'}`);
  
  // Verify Stripe configuration
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('⚠️  WARNING: STRIPE_SECRET_KEY not found in environment');
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn('⚠️  WARNING: STRIPE_WEBHOOK_SECRET not found in environment');
  }
});
