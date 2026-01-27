require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

// Initialize Supabase client for main project (Stripe, clients, etc.)
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Initialize Supabase client for authentication (uses anon key for user sign-in)
const supabaseAuth = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Initialize Supabase client for chat project (chat_users table)
// Make sure to configure CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY
const chatSupabaseUrl = process.env.CHAT_SUPABASE_URL;
const chatSupabaseServiceRoleKey = process.env.CHAT_SUPABASE_SERVICE_ROLE_KEY;

const chatSupabase = chatSupabaseUrl && chatSupabaseServiceRoleKey
  ? createClient(chatSupabaseUrl, chatSupabaseServiceRoleKey)
  : null;

console.log('Supabase connection:', process.env.REACT_APP_SUPABASE_URL ? 'Configured' : 'Missing URL');
console.log('Chat/Secondary Supabase (registration_rules):', chatSupabase ? 'Configured' : 'Not configured – set CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY');

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

// Check and auto-cancel subscriptions past their commitment period
app.post('/api/stripe/check-commitment-periods', async (req, res) => {
  try {
    console.log('🔍 Checking subscriptions past their commitment period...');
    
    // Get all active subscriptions with commitment periods
    const { data: subscriptions, error: fetchError } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .eq('status', 'active')
      .not('commitment_end_date', 'is', null)
      .not('cancel_at_period_end', 'eq', true);
    
    if (fetchError) {
      console.error('❌ Error fetching subscriptions:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
    
    const now = new Date();
    let cancelledCount = 0;
    const results = [];
    
    for (const sub of subscriptions || []) {
      const commitmentEndDate = new Date(sub.commitment_end_date);
      
      if (now >= commitmentEndDate) {
        try {
          console.log(`⏰ Commitment period ended for subscription ${sub.stripe_subscription_id}. Auto-cancelling...`);
          
          // Cancel at period end in Stripe
          const updatedSubscription = await stripe.subscriptions.update(sub.stripe_subscription_id, {
            cancel_at_period_end: true
          });
          
          // Update database
          const { error: updateError } = await supabase
            .from('stripe_subscriptions')
            .update({ 
              cancel_at_period_end: true,
              updated_at: new Date().toISOString()
            })
            .eq('stripe_subscription_id', sub.stripe_subscription_id);
          
          if (updateError) {
            console.error(`❌ Error updating subscription ${sub.stripe_subscription_id}:`, updateError);
          } else {
            cancelledCount++;
            results.push({
              subscriptionId: sub.stripe_subscription_id,
              commitmentEndDate: commitmentEndDate.toISOString(),
              periodEndDate: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
              status: 'cancelled_at_period_end'
            });
            console.log(`✅ Auto-cancelled subscription ${sub.stripe_subscription_id}. Payments will stop on ${new Date(updatedSubscription.current_period_end * 1000).toISOString()}`);
          }
        } catch (error) {
          console.error(`❌ Error cancelling subscription ${sub.stripe_subscription_id}:`, error);
          results.push({
            subscriptionId: sub.stripe_subscription_id,
            error: error.message
          });
        }
      }
    }
    
    res.json({
      message: `Checked ${subscriptions?.length || 0} subscriptions. Auto-cancelled ${cancelledCount} subscriptions past their commitment period.`,
      checked: subscriptions?.length || 0,
      cancelled: cancelledCount,
      results
    });
    
  } catch (error) {
    console.error('❌ Error checking commitment periods:', error);
    res.status(500).json({ error: error.message || 'Failed to check commitment periods' });
  }
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
        if (productId === 'prod_SbI1Lu7FWbybUO') subscriptionType = 'nutrition_training_once_month';
        else if (productId === 'prod_SbI1dssS5NElLZ') subscriptionType = 'nutrition_only';
        else if (productId === 'prod_SbI1AIv2A46oJ9') subscriptionType = 'nutrition_training';
        else if (productId === 'prod_SbI0A23T20wul3') subscriptionType = 'nutrition_only_2x_month';
        
        // Determine commitment period based on exact price ID mapping
        let commitmentMonths = null; // Default no commitment 
        const currentDate = new Date(subscription.current_period_start * 1000);
        
        // Nutrition + Training (once/month) plans (using BetterPro price IDs)
        if (priceId === 'price_1Rg5R8HIeYfvCylDJ4Xfg5hr') {
          commitmentMonths = 3; // Nutrition + Training once/month 3-Month Plan
        } else if (priceId === 'price_1Rg5R8HIeYfvCylDxX2PsOrR') {
          commitmentMonths = 6; // Nutrition + Training once/month 6-Month Plan
        }
        // Nutrition Only plans
        else if (priceId === 'price_1Rg5R6HIeYfvCylDcsV3T2Kr') {
          commitmentMonths = 3; // Nutrition Only 3-Month Plan
        } else if (priceId === 'price_1Rg5R6HIeYfvCylDxuQODpK4') {
          commitmentMonths = 6; // Nutrition Only 6-Month Plan
        }
        // Nutrition + Training plans
        else if (priceId === 'price_1Rg5R4HIeYfvCylDAshP6FOk') {
          commitmentMonths = 3; // Nutrition + Training 3-Month Plan
        } else if (priceId === 'price_1Rg5R4HIeYfvCylDy1OT1YJc') {
          commitmentMonths = 6; // Nutrition + Training 6-Month Plan
        }
        // Nutrition Only 2x/month plans
        else if (priceId === 'price_1Rg5QtHIeYfvCylDyXHY5X6G') {
          commitmentMonths = 3; // Nutrition Only 2x/month 3-Month Plan
        } else if (priceId === 'price_1Rg5QtHIeYfvCylDwr9v599a') {
          commitmentMonths = 6; // Nutrition Only 2x/month 6-Month Plan
        }
        
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

// Helper function to update clients table subscription info by email
async function updateClientsSubscription(customerEmail, subscriptionStatus, subscriptionType, subscriptionExpiresAt) {
  if (!customerEmail) {
    return;
  }

  try {
    // Find client by email
    const { data: client, error: findError } = await supabase
      .from('clients')
      .select('id')
      .eq('email', customerEmail)
      .maybeSingle();

    if (findError) {
      console.warn(`⚠️ Error finding client with email: ${customerEmail}`, findError);
      return;
    }

    if (!client) {
      console.warn(`⚠️ Could not find client with email: ${customerEmail}`);
      return;
    }

    // Update client by id
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        subscription_status: subscriptionStatus || 'none',
        subscription_type: subscriptionType,
        subscription_expires_at: subscriptionExpiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', client.id);

    if (updateError) {
      console.error('❌ Error updating clients subscription info:', updateError);
    } else {
      console.log(`✅ clients subscription info updated for email: ${customerEmail}`);
    }
  } catch (error) {
    console.error('❌ Error in updateClientsSubscription:', error);
  }
}

// Helper function to update chat_users subscription info by email
async function updateChatUserSubscription(customerEmail, subscriptionStatus, subscriptionType, subscriptionExpiresAt) {
  if (!chatSupabase || !customerEmail) {
    if (!chatSupabase) {
      console.warn('⚠️ chatSupabase client not configured, skipping chat_users update');
    }
    return;
  }

  try {
    // Find chat_user by email
    const { data: chatUser, error: findError } = await chatSupabase
      .from('chat_users')
      .select('id')
      .eq('email', customerEmail)
      .single();

    if (findError || !chatUser) {
      console.warn(`⚠️ Could not find chat_user with email: ${customerEmail}`, findError);
      return;
    }

    // Update chat_user by id
    const { error: updateError } = await chatSupabase
      .from('chat_users')
      .update({
        subscription_status: subscriptionStatus,
        subscription_type: subscriptionType,
        subscription_expires_at: subscriptionExpiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', chatUser.id);

    if (updateError) {
      console.error('❌ Error updating chat_users subscription info:', updateError);
    } else {
      console.log(`✅ chat_users subscription info updated for email: ${customerEmail}`);
    }
  } catch (error) {
    console.error('❌ Error in updateChatUserSubscription:', error);
  }
}

// Helper function to update both clients and chat_users subscription info
async function updateSubscriptionInfo(customerEmail, subscriptionStatus, subscriptionType, subscriptionExpiresAt) {
  // Update both tables in parallel
  await Promise.all([
    updateClientsSubscription(customerEmail, subscriptionStatus, subscriptionType, subscriptionExpiresAt),
    updateChatUserSubscription(customerEmail, subscriptionStatus, subscriptionType, subscriptionExpiresAt)
  ]);
}

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
    if (productId === 'prod_SbI1Lu7FWbybUO') subscriptionType = 'nutrition_training_once_month';
    else if (productId === 'prod_SbI1dssS5NElLZ') subscriptionType = 'nutrition_only';
    else if (productId === 'prod_SbI1AIv2A46oJ9') subscriptionType = 'nutrition_training';
    else if (productId === 'prod_SbI0A23T20wul3') subscriptionType = 'nutrition_only_2x_month';
    
    // Determine commitment period based on exact price ID mapping
    let commitmentMonths = null; // Default no commitment
    // Use subscription created date (when subscription was first created) for commitment calculation
    const subscriptionStartDate = new Date(subscription.created * 1000);
    
    // Nutrition + Training (once/month) plans (using BetterPro price IDs)
    if (priceId === 'price_1Rg5R8HIeYfvCylDJ4Xfg5hr') {
      commitmentMonths = 3; // Nutrition + Training once/month 3-Month Plan
    } else if (priceId === 'price_1Rg5R8HIeYfvCylDxX2PsOrR') {
      commitmentMonths = 6; // Nutrition + Training once/month 6-Month Plan
    }
    // Nutrition Only plans
    else if (priceId === 'price_1Rg5R6HIeYfvCylDcsV3T2Kr') {
      commitmentMonths = 3; // Nutrition Only 3-Month Plan
    } else if (priceId === 'price_1Rg5R6HIeYfvCylDxuQODpK4') {
      commitmentMonths = 6; // Nutrition Only 6-Month Plan
    }
    // Nutrition + Training plans
    else if (priceId === 'price_1Rg5R4HIeYfvCylDAshP6FOk') {
      commitmentMonths = 3; // Nutrition + Training 3-Month Plan
    } else if (priceId === 'price_1Rg5R4HIeYfvCylDy1OT1YJc') {
      commitmentMonths = 6; // Nutrition + Training 6-Month Plan
    }
    // Nutrition Only 2x/month plans
    else if (priceId === 'price_1Rg5QtHIeYfvCylDyXHY5X6G') {
      commitmentMonths = 3; // Nutrition Only 2x/month 3-Month Plan
    } else if (priceId === 'price_1Rg5QtHIeYfvCylDwr9v599a') {
      commitmentMonths = 6; // Nutrition Only 2x/month 6-Month Plan
    }
    
    // Calculate commitment end date from subscription start date (only if there's a commitment period)
    let commitmentEndDate = null;
    let canCancel = true; // Default: can cancel anytime
    
    if (commitmentMonths) {
      commitmentEndDate = new Date(subscriptionStartDate);
      commitmentEndDate.setMonth(commitmentEndDate.getMonth() + commitmentMonths);
      canCancel = new Date() >= commitmentEndDate; // Can only cancel after commitment period
      console.log(`📅 Commitment period: ${commitmentMonths} months from ${subscriptionStartDate.toISOString()} to ${commitmentEndDate.toISOString()}`);
      
      // Set cancel_at in Stripe so it automatically stops charging at commitment end
      // This ensures payments stop even if the customer never visits the website again
      try {
        const cancelAtTimestamp = Math.floor(commitmentEndDate.getTime() / 1000);
        await stripe.subscriptions.update(subscription.id, {
          cancel_at: cancelAtTimestamp
        });
        console.log(`🛑 Stripe subscription ${subscription.id} will auto-cancel at ${commitmentEndDate.toISOString()} (cancel_at: ${cancelAtTimestamp})`);
      } catch (err) {
        console.error('❌ Failed to set cancel_at on subscription:', err);
      }
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

      // Also update clients and chat_users subscription info
      // Get customer email from Stripe
      try {
        const customer = await stripe.customers.retrieve(subscription.customer);
        const customerEmail = customer.email;
        
        if (customerEmail) {
          await updateSubscriptionInfo(
            customerEmail,
            subscription.status,
            subscriptionType,
            commitmentEndDate ? commitmentEndDate.toISOString() : null
          );
        } else {
          console.warn('⚠️ No email found for customer:', subscription.customer);
        }
      } catch (customerError) {
        console.error('❌ Error retrieving customer for subscription info update:', customerError);
      }
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
    
    // Get existing subscription from database to get original start date
    const { data: existingSubscription } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .eq('stripe_subscription_id', subscription.id)
      .single();
    
    // Get product and price info for commitment tracking
    const price = subscription.items.data[0]?.price;
    const priceId = price?.id;
    const productId = price?.product;
    
    // Determine commitment period based on exact price ID mapping
    let commitmentMonths = null; // Default no commitment
    // Use subscription created date from Stripe (when subscription was first created)
    // This is the correct date to calculate commitment period from
    const subscriptionStartDate = new Date(subscription.created * 1000);
    
    // Nutrition + Training (once/month) plans (using BetterPro price IDs)
    if (priceId === 'price_1Rg5R8HIeYfvCylDJ4Xfg5hr') {
      commitmentMonths = 3; // Nutrition + Training once/month 3-Month Plan
    } else if (priceId === 'price_1Rg5R8HIeYfvCylDxX2PsOrR') {
      commitmentMonths = 6; // Nutrition + Training once/month 6-Month Plan
    }
    // Nutrition Only plans
    else if (priceId === 'price_1Rg5R6HIeYfvCylDcsV3T2Kr') {
      commitmentMonths = 3; // Nutrition Only 3-Month Plan
    } else if (priceId === 'price_1Rg5R6HIeYfvCylDxuQODpK4') {
      commitmentMonths = 6; // Nutrition Only 6-Month Plan
    }
    // Nutrition + Training plans
    else if (priceId === 'price_1Rg5R4HIeYfvCylDAshP6FOk') {
      commitmentMonths = 3; // Nutrition + Training 3-Month Plan
    } else if (priceId === 'price_1Rg5R4HIeYfvCylDy1OT1YJc') {
      commitmentMonths = 6; // Nutrition + Training 6-Month Plan
    }
    // Nutrition Only 2x/month plans
    else if (priceId === 'price_1Rg5QtHIeYfvCylDyXHY5X6G') {
      commitmentMonths = 3; // Nutrition Only 2x/month 3-Month Plan
    } else if (priceId === 'price_1Rg5QtHIeYfvCylDwr9v599a') {
      commitmentMonths = 6; // Nutrition Only 2x/month 6-Month Plan
    }

    // Determine subscription type based on product ID (same mapping as on create)
    let subscriptionType = 'unknown';
    if (productId === 'prod_SbI1Lu7FWbybUO') subscriptionType = 'nutrition_training_once_month';
    else if (productId === 'prod_SbI1dssS5NElLZ') subscriptionType = 'nutrition_only';
    else if (productId === 'prod_SbI1AIv2A46oJ9') subscriptionType = 'nutrition_training';
    else if (productId === 'prod_SbI0A23T20wul3') subscriptionType = 'nutrition_only_2x_month';
    
    // Calculate commitment end date - use stored value if exists, otherwise calculate from start date
    let commitmentEndDate = null;
    let canCancel = true; // Default: can cancel anytime
    
    if (commitmentMonths) {
      // Use stored commitment_end_date if it exists (calculated at creation), otherwise calculate it
      if (existingSubscription?.commitment_end_date) {
        commitmentEndDate = new Date(existingSubscription.commitment_end_date);
      } else {
        commitmentEndDate = new Date(subscriptionStartDate);
        commitmentEndDate.setMonth(commitmentEndDate.getMonth() + commitmentMonths);
      }
      
      const now = new Date();
      canCancel = now >= commitmentEndDate; // Can only cancel after commitment period
    }
    
    // Update subscription record
    const finalCancelAtPeriodEnd = subscription.cancel_at_period_end || false;
    
    // Update subscription record
    const updateData = {
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: finalCancelAtPeriodEnd,
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

      // Also update clients and chat_users subscription info
      // Get customer email from Stripe
      try {
        const customer = await stripe.customers.retrieve(subscription.customer);
        const customerEmail = customer.email;
        
        if (customerEmail) {
          await updateSubscriptionInfo(
            customerEmail,
            subscription.status,
            subscriptionType,
            commitmentEndDate ? commitmentEndDate.toISOString() : null
          );
        } else {
          console.warn('⚠️ No email found for customer:', subscription.customer);
        }
      } catch (customerError) {
        console.error('❌ Error retrieving customer for subscription info update:', customerError);
      }
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
    
    // Get product and price info to calculate commitment_end_date
    const price = subscription.items.data[0]?.price;
    const priceId = price?.id;
    const currentDate = new Date(subscription.current_period_start * 1000);
    
    // Determine commitment period based on exact price ID mapping
    let commitmentMonths = null;
    // Nutrition + Training (once/month) plans (using BetterPro price IDs)
    if (priceId === 'price_1Rg5R8HIeYfvCylDJ4Xfg5hr') {
      commitmentMonths = 3; // Nutrition + Training once/month 3-Month Plan
    } else if (priceId === 'price_1Rg5R8HIeYfvCylDxX2PsOrR') {
      commitmentMonths = 6; // Nutrition + Training once/month 6-Month Plan
    }
    // Nutrition Only plans
    else if (priceId === 'price_1Rg5R6HIeYfvCylDcsV3T2Kr') {
      commitmentMonths = 3; // Nutrition Only 3-Month Plan
    } else if (priceId === 'price_1Rg5R6HIeYfvCylDxuQODpK4') {
      commitmentMonths = 6; // Nutrition Only 6-Month Plan
    }
    // Nutrition + Training plans
    else if (priceId === 'price_1Rg5R4HIeYfvCylDAshP6FOk') {
      commitmentMonths = 3; // Nutrition + Training 3-Month Plan
    } else if (priceId === 'price_1Rg5R4HIeYfvCylDy1OT1YJc') {
      commitmentMonths = 6; // Nutrition + Training 6-Month Plan
    }
    // Nutrition Only 2x/month plans
    else if (priceId === 'price_1Rg5QtHIeYfvCylDyXHY5X6G') {
      commitmentMonths = 3; // Nutrition Only 2x/month 3-Month Plan
    } else if (priceId === 'price_1Rg5QtHIeYfvCylDwr9v599a') {
      commitmentMonths = 6; // Nutrition Only 2x/month 6-Month Plan
    }
    
    // Calculate commitment end date (only if there's a commitment period)
    let commitmentEndDate = null;
    if (commitmentMonths) {
      commitmentEndDate = new Date(currentDate);
      commitmentEndDate.setMonth(commitmentEndDate.getMonth() + commitmentMonths);
    }
    
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

      // Also update clients and chat_users subscription info
      // Get customer email from Stripe
      try {
        const customer = await stripe.customers.retrieve(subscription.customer);
        const customerEmail = customer.email;
        
        if (customerEmail) {
          await updateSubscriptionInfo(
            customerEmail,
            'cancelled',
            null,
            commitmentEndDate ? commitmentEndDate.toISOString() : null
          );
        } else {
          console.warn('⚠️ No email found for customer:', subscription.customer);
        }
      } catch (customerError) {
        console.error('❌ Error retrieving customer for subscription info update:', customerError);
      }
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
// USER API ENDPOINTS
// ====================================

// Get user_code by email
app.get('/api/user/user-code', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    console.log('🔍 Fetching user_code for email:', email);

    const { data: clientData, error } = await supabase
      .from('clients')
      .select('user_code')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.json({ data: null });
      }
      console.error('❌ Error fetching user_code:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch user_code',
        message: error.message 
      });
    }

    res.json({ data: clientData });
  } catch (error) {
    console.error('❌ Error in user/user-code endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Get user language preference by user_id
app.get('/api/user/language', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    console.log('🌐 Fetching user language for user_id:', user_id);

    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('user_language')
      .eq('user_id', user_id)
      .single();

    if (clientError) {
      if (clientError.code === 'PGRST116') {
        // No rows returned - return null
        return res.json({ data: null });
      }
      console.error('❌ Error fetching user language:', clientError);
      return res.status(500).json({ 
        error: 'Failed to fetch user language',
        message: clientError.message 
      });
    }

    res.json({ data: clientData });
  } catch (error) {
    console.error('❌ Error in user/language endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Get user settings by user_code
app.get('/api/user/settings', async (req, res) => {
  try {
    const { user_code } = req.query;

    if (!user_code) {
      return res.status(400).json({ error: 'user_code is required' });
    }

    console.log('⚙️ Fetching settings for user_code:', user_code);

    const { data, error } = await supabase
      .from('clients')
      .select('show_calories, show_macros, portion_display, measurement_system, weight_unit, decimal_places')
      .eq('user_code', user_code)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.json({ data: null });
      }
      console.error('❌ Error fetching settings:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch settings',
        message: error.message 
      });
    }

    res.json({ data });
  } catch (error) {
    console.error('❌ Error in user/settings endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Update user settings
app.post('/api/user/settings', async (req, res) => {
  try {
    const { user_code, settings } = req.body;

    if (!user_code) {
      return res.status(400).json({ error: 'user_code is required' });
    }

    if (!settings) {
      return res.status(400).json({ error: 'settings is required' });
    }

    console.log('💾 Updating settings for user_code:', user_code);

    const { error } = await supabase
      .from('clients')
      .update(settings)
      .eq('user_code', user_code);

    if (error) {
      console.error('❌ Error updating settings:', error);
      return res.status(500).json({ 
        error: 'Failed to update settings',
        message: error.message 
      });
    }

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('❌ Error in user/settings update endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// ====================================
// ONBOARDING API ENDPOINTS
// ====================================

// Get client data by user_id
app.get('/api/onboarding/client-data', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    console.log('📋 Fetching client data for user_id:', user_id);

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - not an error, just no data
        return res.json({ data: null });
      }
      console.error('❌ Error fetching client data:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch client data',
        message: error.message 
      });
    }

    res.json({ data });
  } catch (error) {
    console.error('❌ Error in onboarding/client-data endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Get chat user meal data by user_code
app.get('/api/onboarding/chat-user-meal-data', async (req, res) => {
  try {
    const { user_code } = req.query;

    if (!user_code) {
      return res.status(400).json({ error: 'user_code is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    console.log('📋 Fetching chat user meal data for user_code:', user_code);

    const { data: chatData, error: chatError } = await chatSupabase
      .from('chat_users')
      .select('number_of_meals, meal_plan_structure')
      .eq('user_code', user_code)
      .single();

    if (chatError) {
      if (chatError.code === 'PGRST116') {
        // No rows returned - not an error, just no data
        return res.json({ data: null });
      }
      console.error('❌ Error fetching chat user meal data:', chatError);
      return res.status(500).json({ 
        error: 'Failed to fetch chat user meal data',
        message: chatError.message 
      });
    }

    res.json({ data: chatData });
  } catch (error) {
    console.error('❌ Error in onboarding/chat-user-meal-data endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Check if phone number exists
app.post('/api/onboarding/check-phone', async (req, res) => {
  try {
    const { phone, user_id, user_code } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'phone is required' });
    }

    console.log('📞 Checking phone existence:', phone);

    // Check in clients table
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('phone, user_id')
      .eq('phone', phone)
      .maybeSingle();

    // If found and it's not the current user's phone, it exists
    if (clientData && clientData.user_id !== user_id) {
      return res.json({ exists: true, table: 'clients' });
    }

    // Check in chat_users table (if secondary DB is available)
    if (chatSupabase) {
      // Check phone_number column
      const { data: chatUserDataByPhone } = await chatSupabase
        .from('chat_users')
        .select('phone_number, whatsapp_number, user_code')
        .eq('phone_number', phone)
        .maybeSingle();

      // Check whatsapp_number column
      const { data: chatUserDataByWhatsApp } = await chatSupabase
        .from('chat_users')
        .select('phone_number, whatsapp_number, user_code')
        .eq('whatsapp_number', phone)
        .maybeSingle();

      const chatUserData = chatUserDataByPhone || chatUserDataByWhatsApp;

      // If found and it's not the current user's phone (check by user_code if available)
      if (chatUserData) {
        // If we have userCode, check if it matches
        if (user_code && chatUserData.user_code === user_code) {
          // It's the same user, so it's okay
          return res.json({ exists: false });
        } else if (!user_code || chatUserData.user_code !== user_code) {
          // Different user has this phone number
          return res.json({ exists: true, table: 'chat_users' });
        }
      }
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('❌ Error in onboarding/check-phone endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Update client data
app.post('/api/onboarding/update-client', async (req, res) => {
  try {
    const { user_id, clientData } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    if (!clientData) {
      return res.status(400).json({ error: 'clientData is required' });
    }

    console.log('💾 Updating client data for user_id:', user_id);

    const { data: updateData, error: profileError } = await supabase
      .from('clients')
      .update(clientData)
      .eq('user_id', user_id)
      .select();

    if (profileError) {
      console.error('❌ Error updating client:', profileError);
      return res.status(500).json({ 
        error: 'Failed to update client',
        message: profileError.message 
      });
    }

    res.json({ data: updateData });
  } catch (error) {
    console.error('❌ Error in onboarding/update-client endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Update chat user data
app.post('/api/onboarding/update-chat-user', async (req, res) => {
  try {
    const { user_code, chatUserData } = req.body;

    if (!user_code) {
      return res.status(400).json({ error: 'user_code is required' });
    }

    if (!chatUserData) {
      return res.status(400).json({ error: 'chatUserData is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    console.log('💾 Updating chat user data for user_code:', user_code);

    // Find chat user by user_code
    const { data: chatUser, error: chatUserError } = await chatSupabase
      .from('chat_users')
      .select('id')
      .eq('user_code', user_code)
      .single();

    if (chatUserError || !chatUser) {
      console.error('❌ Chat user not found:', chatUserError);
      return res.status(404).json({ 
        error: 'Chat user not found',
        message: chatUserError?.message 
      });
    }

    // Update chat user
    const { error: chatUpdateError } = await chatSupabase
      .from('chat_users')
      .update(chatUserData)
      .eq('id', chatUser.id);

    if (chatUpdateError) {
      console.error('❌ Error updating chat user:', chatUpdateError);
      return res.status(500).json({ 
        error: 'Failed to update chat user',
        message: chatUpdateError.message 
      });
    }

    res.json({ success: true, message: 'Chat user updated successfully' });
  } catch (error) {
    console.error('❌ Error in onboarding/update-chat-user endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// ====================================
// WHATSAPP API ROUTES
// ====================================

// Send WhatsApp welcome message
app.post('/api/whatsapp/send-welcome-message', async (req, res) => {
  try {
    const { phone, language } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Get WhatsApp token from environment variable
    const waToken = process.env.WA_TOKEN || process.env.WHATSAPP_TOKEN;
    
    if (!waToken) {
      console.error('❌ WhatsApp token not configured');
      return res.status(500).json({ 
        error: 'WhatsApp service not configured',
        message: 'WA_TOKEN environment variable is missing' 
      });
    }

    // Determine template name and language code based on user's language
    let templateName = 'welcome_message_paid_clients';
    let languageCode = 'en';
    
    if (language === 'he' || language === 'hebrew') {
      templateName = 'welcome_message_paid_clients_hebrew';
      languageCode = 'he';
    }

    // Facebook Graph API endpoint
    const url = 'https://graph.facebook.com/v22.0/656545780873051/messages';

    // Prepare request body
    const body = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode }
      }
    };

    console.log('📱 Sending WhatsApp welcome message:', {
      to: phone,
      template: templateName,
      language: languageCode
    });

    // Send request to Facebook Graph API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${waToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('❌ WhatsApp API error:', responseData);
      return res.status(response.status).json({ 
        error: 'Failed to send WhatsApp message',
        message: responseData.error?.message || 'Unknown error',
        details: responseData
      });
    }

    console.log('✅ WhatsApp welcome message sent successfully:', responseData);
    
    res.json({ 
      success: true, 
      message: 'WhatsApp message sent successfully',
      data: responseData
    });
  } catch (error) {
    console.error('❌ Error in WhatsApp send-welcome-message endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// ====================================
// PROFILE PAGE API ROUTES
// ====================================

// Get active client meal plan
app.get('/api/profile/meal-plan', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    const { data, error } = await supabase
      .from('client_meal_plans')
      .select('*')
      .eq('user_code', userCode)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({ data });
  } catch (error) {
    console.error('Error fetching client meal plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update client meal plan (clear old edited plan)
app.post('/api/profile/meal-plan/clear-edited', async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    const { error } = await supabase
      .from('client_meal_plans')
      .update({
        client_edited_meal_plan: null,
        edited_plan_date: null,
      })
      .eq('id', planId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing edited meal plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update client meal plan (save edited plan)
app.post('/api/profile/meal-plan/save-edited', async (req, res) => {
  try {
    const { planId, mealPlan } = req.body;
    if (!planId || !mealPlan) {
      return res.status(400).json({ error: 'Plan ID and meal plan data are required' });
    }

    const today = new Date().toISOString();
    const { error } = await supabase
      .from('client_meal_plans')
      .update({
        client_edited_meal_plan: mealPlan,
        edited_plan_date: today,
      })
      .eq('id', planId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving edited meal plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get client data for onboarding check
app.get('/api/profile/client', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({ data });
  } catch (error) {
    console.error('Error fetching client data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Load profile data from clients table
app.get('/api/profile/load', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({ data });
  } catch (error) {
    console.error('Error loading profile data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Load chat_users data
app.get('/api/profile/chat-user', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('chat_users')
      .select('medical_conditions, client_preference, food_allergies, full_name, email, phone_number, region, city, timezone, age, gender, date_of_birth, language')
      .eq('user_code', userCode)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({ data });
  } catch (error) {
    console.error('Error loading chat_users data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save profile data
app.post('/api/profile/save', async (req, res) => {
  try {
    const { userId, profileData } = req.body;
    if (!userId || !profileData) {
      return res.status(400).json({ error: 'User ID and profile data are required' });
    }

    // Check if record exists
    const { data: existingData, error: checkError } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    let result;
    if (!existingData) {
      // Insert new record
      result = await supabase
        .from('clients')
        .insert(profileData)
        .select();
    } else {
      // Update existing record
      result = await supabase
        .from('clients')
        .update(profileData)
        .eq('user_id', userId)
        .select();
    }

    const { data, error } = result;
    if (error) throw error;

    res.json({ data });
  } catch (error) {
    console.error('Error saving profile data:', error);
    res.status(500).json({ error: error.message, code: error.code });
  }
});

// Sync profile data to chat_users
app.post('/api/profile/sync-chat-user', async (req, res) => {
  try {
    const { userCode, chatUserData } = req.body;
    if (!userCode || !chatUserData) {
      return res.status(400).json({ error: 'User code and chat user data are required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    // Get chat_users id
    const { data: chatUser, error: chatUserError } = await chatSupabase
      .from('chat_users')
      .select('id')
      .eq('user_code', userCode)
      .maybeSingle();

    if (chatUserError) throw chatUserError;
    if (!chatUser) {
      return res.status(404).json({ error: 'Chat user not found' });
    }

    // Update chat_users
    const { error } = await chatSupabase
      .from('chat_users')
      .update(chatUserData)
      .eq('id', chatUser.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error syncing to chat_users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save profile image URL
app.post('/api/profile/save-image-url', async (req, res) => {
  try {
    const { userId, imageUrl } = req.body;
    if (!userId || !imageUrl) {
      return res.status(400).json({ error: 'User ID and image URL are required' });
    }

    // Check if record exists
    const { data: existingData, error: checkError } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingData) {
      // Insert new record with minimal data
      const { error: insertError } = await supabase
        .from('clients')
        .insert({
          user_id: userId,
          profile_image_url: imageUrl,
          updated_at: new Date().toISOString()
        });

      if (insertError) throw insertError;
    } else {
      // Update existing record
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          profile_image_url: imageUrl,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving profile image URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user_code from clients table
app.get('/api/profile/user-code', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const { data, error } = await supabase
      .from('clients')
      .select('user_code')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({ user_code: data?.user_code || null });
  } catch (error) {
    console.error('Error fetching user_code:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload profile image (with cropping on server)
app.post('/api/profile/upload-image', async (req, res) => {
  try {
    const { userId, imageData, bucketName } = req.body;
    if (!userId || !imageData) {
      return res.status(400).json({ error: 'User ID and image data are required' });
    }

    // Get user_code
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('user_code')
      .eq('user_id', userId)
      .maybeSingle();

    if (clientError || !clientData) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userCode = clientData.user_code;
    if (!userCode) {
      return res.status(400).json({ error: 'User code not found' });
    }

    // Decode base64 image
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate filename
    const timestamp = Date.now();
    const filename = `${userCode}/${timestamp}.jpeg`;

    // Upload to Supabase Storage
    const bucket = bucketName || process.env.REACT_APP_SUPABASE_STORAGE_BUCKET_NAME || 'profile-pictures';
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filename, buffer, {
        contentType: 'image/jpeg',
        upsert: false,
        cacheControl: '3600',
        metadata: {
          userId: userId,
          userCode: userCode,
          uploadedAt: new Date().toISOString()
        }
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);

    res.json({ publicUrl: urlData.publicUrl, path: uploadData.path });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Load client data for meal plan generation (from chat_users and clients)
app.get('/api/profile/client-data-full', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    // Load from chat_users
    const { data: chatData, error: chatError } = await chatSupabase
      .from('chat_users')
      .select('*')
      .eq('user_code', userCode)
      .maybeSingle();

    if (chatError && chatError.code !== 'PGRST116') {
      throw chatError;
    }

    // Load from clients
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('onboarding_completed')
      .eq('user_code', userCode)
      .maybeSingle();

    if (clientsError && clientsError.code !== 'PGRST116') {
      throw clientsError;
    }

    // Merge the data
    const mergedData = {
      ...chatData,
      onboarding_completed: clientsData?.onboarding_completed || false
    };

    res.json({ data: mergedData });
  } catch (error) {
    console.error('Error loading client data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save meal plan to both databases
app.post('/api/profile/meal-plan/create', async (req, res) => {
  try {
    const { planId, userCode, mealPlanName, template, menuData, dailyCalories, macros } = req.body;
    if (!planId || !userCode || !mealPlanName || !menuData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const now = new Date().toISOString();

    // Save to meal_plans_and_schemas (secondary database)
    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { error: secondaryError } = await chatSupabase
      .from('meal_plans_and_schemas')
      .insert({
        id: planId,
        record_type: 'meal_plan',
        user_code: userCode,
        meal_plan_name: mealPlanName,
        schema: template,
        meal_plan: menuData,
        status: 'active',
        daily_total_calories: dailyCalories,
        macros_target: macros,
        active_from: now,
        created_at: now,
        updated_at: now
      });

    if (secondaryError) throw secondaryError;

    // Save to client_meal_plans (main database)
    const { error: mainError } = await supabase
      .from('client_meal_plans')
      .insert({
        id: planId,
        user_code: userCode,
        original_meal_plan_id: planId,
        meal_plan_name: mealPlanName,
        dietitian_meal_plan: menuData,
        active: true,
        daily_total_calories: dailyCalories,
        macros_target: macros,
        created_at: now,
        updated_at: now
      });

    if (mainError) {
      // Rollback secondary save
      await chatSupabase
        .from('meal_plans_and_schemas')
        .delete()
        .eq('id', planId);
      throw mainError;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error creating meal plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get provider_id from chat_users
app.get('/api/profile/provider', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('chat_users')
      .select('provider_id')
      .eq('user_code', userCode)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({ provider_id: data?.provider_id || null });
  } catch (error) {
    console.error('Error fetching provider_id:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if system message already exists
app.get('/api/profile/system-message-exists', async (req, res) => {
  try {
    const { providerId, userCode, title } = req.query;
    if (!providerId || !userCode || !title) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('system_messages')
      .select('id')
      .eq('directed_to', providerId)
      .eq('message_type', 'info')
      .eq('title', title)
      .ilike('content', `%${userCode}%`)
      .eq('is_active', true);

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({ exists: data && data.length > 0 });
  } catch (error) {
    console.error('Error checking system message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create system message
app.post('/api/profile/system-message', async (req, res) => {
  try {
    const { title, content, messageType, priority, directedTo } = req.body;
    if (!title || !content || !directedTo) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('system_messages')
      .insert({
        title,
        content,
        message_type: messageType || 'info',
        priority: priority || 'medium',
        is_active: true,
        directed_to: directedTo
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error creating system message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user language in clients table
app.post('/api/profile/update-language', async (req, res) => {
  try {
    const { userCode, language } = req.body;
    if (!userCode || !language) {
      return res.status(400).json({ error: 'User code and language are required' });
    }

    const { error } = await supabase
      .from('clients')
      .update({ user_language: language })
      .eq('user_code', userCode);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating language:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================
// SECONDARY CLIENT API ROUTES (Food Logs, Chat, Weight, etc.)
// ====================================

// Get food logs
app.get('/api/food-logs', async (req, res) => {
  try {
    const { userCode, date } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    // Get user_id from chat_users
    const { data: userData, error: userError } = await chatSupabase
      .from('chat_users')
      .select('id')
      .eq('user_code', userCode)
      .maybeSingle();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get food logs
    let query = chatSupabase
      .from('food_logs')
      .select('*')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false });

    if (date) {
      query = query.eq('log_date', date);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ data });
  } catch (error) {
    console.error('Error fetching food logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create food log
app.post('/api/food-logs', async (req, res) => {
  try {
    const { userCode, foodLogData } = req.body;
    if (!userCode || !foodLogData) {
      return res.status(400).json({ error: 'User code and food log data are required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    // Get user_id from chat_users
    const { data: userData, error: userError } = await chatSupabase
      .from('chat_users')
      .select('id')
      .eq('user_code', userCode)
      .maybeSingle();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create food log
    const insertData = {
      user_id: userData.id,
      meal_label: foodLogData.meal_label,
      food_items: foodLogData.food_items || [],
      log_date: foodLogData.log_date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };

    const { data, error } = await chatSupabase
      .from('food_logs')
      .insert([insertData])
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error creating food log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update food log
app.put('/api/food-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { foodLogData } = req.body;
    
    if (!foodLogData) {
      return res.status(400).json({ error: 'Food log data is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    if (foodLogData.meal_label !== undefined) updateData.meal_label = foodLogData.meal_label;
    if (foodLogData.food_items !== undefined) updateData.food_items = foodLogData.food_items;
    if (foodLogData.image_url !== undefined) updateData.image_url = foodLogData.image_url;
    if (foodLogData.total_calories !== undefined) updateData.total_calories = foodLogData.total_calories;
    if (foodLogData.total_protein_g !== undefined) updateData.total_protein_g = foodLogData.total_protein_g;
    if (foodLogData.total_carbs_g !== undefined) updateData.total_carbs_g = foodLogData.total_carbs_g;
    if (foodLogData.total_fat_g !== undefined) updateData.total_fat_g = foodLogData.total_fat_g;
    if (foodLogData.log_date !== undefined) updateData.log_date = foodLogData.log_date;

    const { data, error } = await chatSupabase
      .from('food_logs')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error updating food log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete food log
app.delete('/api/food-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('food_logs')
      .delete()
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error deleting food log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get chat messages
app.get('/api/chat-messages', async (req, res) => {
  try {
    const { userCode, beforeTimestamp } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    // Get user_id from chat_users
    const { data: userData, error: userError } = await chatSupabase
      .from('chat_users')
      .select('id')
      .eq('user_code', userCode)
      .maybeSingle();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get conversations
    const { data: conversations, error: conversationsError } = await chatSupabase
      .from('chat_conversations')
      .select('id')
      .eq('user_id', userData.id)
      .order('started_at', { ascending: false });

    if (conversationsError) throw conversationsError;

    if (!conversations || conversations.length === 0) {
      return res.json({ data: [] });
    }

    const conversationIds = conversations.map(conv => conv.id);
    
    let query = chatSupabase
      .from('chat_messages')
      .select('*')
      .in('conversation_id', conversationIds);

    if (beforeTimestamp) {
      query = query.lt('created_at', beforeTimestamp);
    }

    query = query.order('created_at', { ascending: false }).limit(20);

    const { data: messages, error: messagesError } = await query;
    if (messagesError) throw messagesError;

    res.json({ data: messages || [] });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create chat message
app.post('/api/chat-messages', async (req, res) => {
  try {
    const { userCode, messageData } = req.body;
    if (!userCode || !messageData) {
      return res.status(400).json({ error: 'User code and message data are required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    // Get user_id from chat_users
    const { data: userData, error: userError } = await chatSupabase
      .from('chat_users')
      .select('id')
      .eq('user_code', userCode)
      .maybeSingle();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get or create conversation
    let { data: conversation, error: conversationError } = await chatSupabase
      .from('chat_conversations')
      .select('id')
      .eq('user_id', userData.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conversation) {
      const { data: newConversation, error: createError } = await chatSupabase
        .from('chat_conversations')
        .insert([{
          user_id: userData.id,
          started_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (createError) throw createError;
      conversation = newConversation;
    }

    // Create message
    const messageInsert = {
      conversation_id: conversation.id,
      role: messageData.role || 'user',
      topic: messageData.topic,
      extension: messageData.extension,
      attachments: messageData.attachments,
      created_at: new Date().toISOString()
    };

    if (messageData.role === 'assistant') {
      messageInsert.message = messageData.message;
    } else {
      messageInsert.content = messageData.content;
    }

    const { data, error } = await chatSupabase
      .from('chat_messages')
      .insert([messageInsert])
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error creating chat message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get weight logs
app.get('/api/weight-logs', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('weight_logs')
      .select('*')
      .eq('user_code', userCode)
      .order('measurement_date', { ascending: true });

    if (error) throw error;
    res.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching weight logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create weight log
app.post('/api/weight-logs', async (req, res) => {
  try {
    const { userCode, weightLogData } = req.body;
    if (!userCode || !weightLogData) {
      return res.status(400).json({ error: 'User code and weight log data are required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const insertData = {
      user_code: userCode,
      measurement_date: weightLogData.measurement_date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };

    if (weightLogData.weight_kg !== undefined && weightLogData.weight_kg !== null && weightLogData.weight_kg !== '') {
      insertData.weight_kg = parseFloat(weightLogData.weight_kg);
    }
    if (weightLogData.body_fat_percentage !== undefined && weightLogData.body_fat_percentage !== null && weightLogData.body_fat_percentage !== '') {
      insertData.body_fat_percentage = parseFloat(weightLogData.body_fat_percentage);
    }
    if (weightLogData.waist_circumference_cm !== undefined && weightLogData.waist_circumference_cm !== null && weightLogData.waist_circumference_cm !== '') {
      insertData.waist_circumference_cm = parseFloat(weightLogData.waist_circumference_cm);
    }
    if (weightLogData.hip_circumference_cm !== undefined && weightLogData.hip_circumference_cm !== null && weightLogData.hip_circumference_cm !== '') {
      insertData.hip_circumference_cm = parseFloat(weightLogData.hip_circumference_cm);
    }
    if (weightLogData.arm_circumference_cm !== undefined && weightLogData.arm_circumference_cm !== null && weightLogData.arm_circumference_cm !== '') {
      insertData.arm_circumference_cm = parseFloat(weightLogData.arm_circumference_cm);
    }
    if (weightLogData.neck_circumference_cm !== undefined && weightLogData.neck_circumference_cm !== null && weightLogData.neck_circumference_cm !== '') {
      insertData.neck_circumference_cm = parseFloat(weightLogData.neck_circumference_cm);
    }

    const { data, error } = await chatSupabase
      .from('weight_logs')
      .insert([insertData])
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error creating weight log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search foods
app.get('/api/foods/search', async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const isHebrewQuery = /[\u0590-\u05FF]/.test(query);
    const queryWords = query.trim().split(/\s+/).filter(word => word.length > 0);
    let allData = [];
    
    if (queryWords.length === 1) {
      const word = queryWords[0];
      const startsWithPattern = `${word}%`;
      const containsPattern = `%${word}%`;
      const searchColumn = isHebrewQuery ? 'name' : 'english_name';
      
      const { data: startsWithData } = await chatSupabase
        .from('ingridientsroee')
        .select('id, name, english_name, calories_energy, protein_g, fat_g, carbohydrates_g')
        .ilike(searchColumn, startsWithPattern)
        .limit(50);
      
      if (startsWithData) {
        allData = startsWithData;
      }
      
      if (allData.length < 20) {
        const { data: containsData } = await chatSupabase
          .from('ingridientsroee')
          .select('id, name, english_name, calories_energy, protein_g, fat_g, carbohydrates_g')
          .ilike(searchColumn, containsPattern)
          .limit(50);
        
        if (containsData) {
          const existingIds = new Set(allData.map(item => item.id));
          const newItems = containsData.filter(item => !existingIds.has(item.id));
          allData = [...allData, ...newItems];
        }
      }
    } else {
      const searchColumn = isHebrewQuery ? 'name' : 'english_name';
      const wordsConditions = queryWords.map(word => 
        `${searchColumn}.ilike.%${word}%`
      );
      
      const { data: wordsData } = await chatSupabase
        .from('ingridientsroee')
        .select('id, name, english_name, calories_energy, protein_g, fat_g, carbohydrates_g')
        .or(wordsConditions.join(','))
        .limit(200);
      
      if (wordsData) {
        allData = wordsData.filter(item => {
          const searchText = isHebrewQuery 
            ? ((item.name || '').toLowerCase())
            : ((item.english_name || '').toLowerCase());
          
          return queryWords.every(word => 
            searchText.includes(word.toLowerCase())
          );
        });
      }
    }
    
    // Transform and limit data
    const transformedData = allData.slice(0, parseInt(limit)).map(ingredient => ({
      id: ingredient.id,
      name: isHebrewQuery ? (ingredient.name || ingredient.english_name || '') : (ingredient.english_name || ingredient.name || ''),
      item: isHebrewQuery ? (ingredient.name || ingredient.english_name || '') : (ingredient.english_name || ingredient.name || ''),
      english_name: ingredient.english_name || '',
      calories: ingredient.calories_energy || 0,
      protein: ingredient.protein_g || 0,
      fat: ingredient.fat_g || 0,
      carbs: ingredient.carbohydrates_g || 0,
      brand: '',
      household_measure: '',
      'portionSI(gram)': 100,
      UPC: null
    }));
    
    res.json({ data: transformedData });
  } catch (error) {
    console.error('Error searching foods:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get companies with managers
app.get('/api/companies', async (req, res) => {
  try {
    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('companies')
      .select('id, name, managers:profiles!profiles_company_id_fkey(id, name, role)')
      .order('name', { ascending: true });

    if (error) throw error;

    const formattedCompanies = (data || []).map((company) => ({
      id: company.id,
      name: company.name,
      managers: (company.managers || []).filter((manager) => manager.role === 'company_manager')
    }));

    res.json({ data: formattedCompanies });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get client company assignment
app.get('/api/client-company-assignment', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('chat_users')
      .select('provider_id, provider:profiles!chat_users_provider_id_fkey(id, name, company_id)')
      .eq('user_code', userCode)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data: data || null });
  } catch (error) {
    console.error('Error fetching client assignment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Assign client to company
app.post('/api/assign-client-company', async (req, res) => {
  try {
    const { userCode, companyId } = req.body;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    let managerId = null;

    if (companyId) {
      const { data: manager, error: managerError } = await chatSupabase
        .from('profiles')
        .select('id')
        .eq('company_id', companyId)
        .eq('role', 'company_manager')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (managerError) throw managerError;

      if (!manager) {
        return res.status(404).json({ error: 'No manager found for the selected company' });
      }

      managerId = manager.id;
    }

    const { data, error } = await chatSupabase
      .from('chat_users')
      .update({ provider_id: managerId })
      .eq('user_code', userCode)
      .select('provider_id')
      .maybeSingle();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error assigning client to company:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get training plan by user code
app.get('/api/training-plan', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('training_plans')
      .select('*')
      .eq('user_code', userCode)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error fetching training plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get meal plan by user code
app.get('/api/meal-plan', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('meal_plans_and_schemas')
      .select('*')
      .eq('user_code', userCode)
      .eq('record_type', 'meal_plan')
      .eq('status', 'active')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error fetching meal plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get meal plan schemas
app.get('/api/meal-plan-schemas', async (req, res) => {
  try {
    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('meal_plans_and_schemas')
      .select('*')
      .eq('record_type', 'schema')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error fetching meal plan schemas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create meal plan
app.post('/api/meal-plan', async (req, res) => {
  try {
    const { dietitianId, userCode, mealPlanData } = req.body;
    if (!userCode || !mealPlanData) {
      return res.status(400).json({ error: 'User code and meal plan data are required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('meal_plans_and_schemas')
      .insert([{
        record_type: 'meal_plan',
        dietitian_id: dietitianId,
        user_code: userCode,
        meal_plan_name: mealPlanData.meal_plan_name,
        meal_plan: mealPlanData.meal_plan,
        status: mealPlanData.status || 'draft',
        active_from: mealPlanData.active_from,
        active_until: mealPlanData.active_until,
        daily_total_calories: mealPlanData.daily_total_calories,
        macros_target: mealPlanData.macros_target,
        recommendations: mealPlanData.recommendations,
        dietary_restrictions: mealPlanData.dietary_restrictions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error creating meal plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update meal plan
app.put('/api/meal-plan/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { mealPlanData } = req.body;
    
    if (!mealPlanData) {
      return res.status(400).json({ error: 'Meal plan data is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('meal_plans_and_schemas')
      .update({
        meal_plan_name: mealPlanData.meal_plan_name,
        meal_plan: mealPlanData.meal_plan,
        status: mealPlanData.status,
        active_from: mealPlanData.active_from,
        active_until: mealPlanData.active_until,
        daily_total_calories: mealPlanData.daily_total_calories,
        macros_target: mealPlanData.macros_target,
        recommendations: mealPlanData.recommendations,
        dietary_restrictions: mealPlanData.dietary_restrictions,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error updating meal plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get meal plan history
app.get('/api/meal-plan-history', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('meal_plans_and_schemas')
      .select('*')
      .eq('user_code', userCode)
      .eq('record_type', 'meal_plan')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error fetching meal plan history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get messages
app.get('/api/messages', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send message
app.post('/api/messages', async (req, res) => {
  try {
    const { userId, messageData } = req.body;
    if (!userId || !messageData) {
      return res.status(400).json({ error: 'User ID and message data are required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('messages')
      .insert([{
        user_id: userId,
        ...messageData,
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark message as read
app.put('/api/messages/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get food by ID
app.get('/api/foods/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data, error } = await chatSupabase
      .from('ingridientsroee')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error fetching food by ID:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug meal plans
app.get('/api/debug/meal-plans', async (req, res) => {
  try {
    const { userCode } = req.query;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const { data: allPlans, error: allError } = await chatSupabase
      .from('meal_plans_and_schemas')
      .select('*')
      .eq('user_code', userCode)
      .eq('record_type', 'meal_plan');

    const { data: allPlansInDb, error: allDbError } = await chatSupabase
      .from('meal_plans_and_schemas')
      .select('user_code, status, record_type, meal_plan_name')
      .eq('record_type', 'meal_plan')
      .limit(10);

    res.json({ data: { allPlans, allPlansInDb }, allError, allDbError });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================
// REGISTRATION LINKS API (find + increment)
// Used by SignupPage for #d=base64(JSON{link_id,manager_id,...}) and #d=base64(manager_id).
// ====================================

app.post('/api/db/registration-links/find', async (req, res) => {
  try {
    const { link_id, manager_id } = req.body || {};
    if (!link_id && !manager_id) {
      return res.status(400).json({ error: 'Either link_id or manager_id is required' });
    }
    // registration_rules lives in the secondary (chat) Supabase project
    if (!chatSupabase) {
      return res.status(503).json({ error: 'Registration links require CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY' });
    }
    const regDb = chatSupabase;
    let row = null;
    if (link_id) {
      const { data, error } = await regDb
        .from('registration_rules')
        .select('id, link_id, manager_id, max_slots, current_count, expires_at, is_active')
        .eq('link_id', link_id)
        .maybeSingle();
      if (!error) row = data;
    } else {
      const { data, error } = await regDb
        .from('registration_rules')
        .select('id, manager_id, max_slots, current_count, expires_at, is_active')
        .eq('manager_id', manager_id)
        .maybeSingle();
      if (!error) row = data;
    }
    if (!row) {
      return res.status(404).json({ error: 'Registration link not found' });
    }
    return res.json({ ...row, link_id: row.link_id ?? null });
  } catch (e) {
    console.error('Error in registration-links find:', e);
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/db/registration-links/find?link_id=... or ?manager_id=... (same logic as POST, for flexibility)
app.get('/api/db/registration-links/find', async (req, res) => {
  try {
    const link_id = req.query.link_id || null;
    const manager_id = req.query.manager_id || null;
    if (!link_id && !manager_id) {
      return res.status(400).json({ error: 'Either link_id or manager_id is required (query: ?link_id= or ?manager_id=)' });
    }
    if (!chatSupabase) {
      return res.status(503).json({ error: 'Registration links require CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY' });
    }
    const regDb = chatSupabase;
    let row = null;
    if (link_id) {
      const { data, error } = await regDb.from('registration_rules')
        .select('id, link_id, manager_id, max_slots, current_count, expires_at, is_active')
        .eq('link_id', link_id).maybeSingle();
      if (!error) row = data;
    } else {
      const { data, error } = await regDb.from('registration_rules')
        .select('id, manager_id, max_slots, current_count, expires_at, is_active')
        .eq('manager_id', manager_id).maybeSingle();
      if (!error) row = data;
    }
    if (!row) return res.status(404).json({ error: 'Registration link not found' });
    return res.json({ ...row, link_id: row.link_id ?? null });
  } catch (e) {
    console.error('Error in registration-links find (GET):', e);
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/db/registration-links/:idOrLinkId/increment', async (req, res) => {
  try {
    const { idOrLinkId } = req.params;
    if (!idOrLinkId) return res.status(400).json({ error: 'idOrLinkId is required' });
    if (!chatSupabase) {
      return res.status(503).json({ error: 'Registration links require CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY' });
    }
    const regDb = chatSupabase;
    const isNumericId = /^\d+$/.test(String(idOrLinkId));
    let q = regDb.from('registration_rules').select('id, current_count');
    if (isNumericId) q = q.eq('id', parseInt(idOrLinkId, 10));
    else q = q.eq('link_id', idOrLinkId);
    const { data: existing, error: fetchErr } = await q.maybeSingle();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Registration link not found' });
    const newCount = (existing.current_count || 0) + 1;
    let upd = regDb.from('registration_rules').update({ current_count: newCount });
    if (isNumericId) upd = upd.eq('id', parseInt(idOrLinkId, 10));
    else upd = upd.eq('link_id', idOrLinkId);
    const { error: updateErr } = await upd;
    if (updateErr) {
      console.error('Error incrementing registration link:', updateErr);
      return res.status(500).json({ error: 'Failed to increment' });
    }
    return res.json({ ok: true, current_count: newCount });
  } catch (e) {
    console.error('Error in registration-links increment:', e);
    return res.status(500).json({ error: e.message });
  }
});

// ====================================
// AUTH API ROUTES
// ====================================

// Sign up with email and password
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, userData = {}, invitationToken, providerId, managerLinkData } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    console.log('📝 Attempting signup for email:', email);

    // Check if email already exists
    const normalizedEmail = email.toLowerCase().trim();
    const { data: existingClient } = await supabase
      .from('clients')
      .select('email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingClient) {
      return res.status(400).json({ 
        error: 'This email is already registered. Please use a different email or login.',
        code: 400
      });
    }

    // Resolve registration link: #d=base64(JSON{link_id,manager_id,...}) or #d=base64(manager_id) or legacy integer id.
    // registration_rules is in the secondary (chat) Supabase project only.
    const regDb = chatSupabase;
    let managerId = null;
    let registrationRule = null;
    let linkIdFromToken = null;
    let managerIdFromToken = null;

    if (invitationToken) {
      try {
        const decoded = Buffer.from(invitationToken, 'base64').toString('utf-8');
        try {
          const obj = JSON.parse(decoded);
          if (obj && obj.link_id) { linkIdFromToken = obj.link_id; managerIdFromToken = obj.manager_id || null; }
          else if (obj && obj.manager_id) managerIdFromToken = obj.manager_id;
        } catch (_) { managerIdFromToken = decoded; }
      } catch (_) {}
    }
    if (!linkIdFromToken && managerLinkData?.link_id) linkIdFromToken = managerLinkData.link_id;
    if (!managerIdFromToken && managerLinkData?.manager_id) managerIdFromToken = managerLinkData.manager_id;

    if (linkIdFromToken || managerIdFromToken) {
      if (!regDb) {
        return res.status(503).json({ error: 'Registration links require CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY' });
      }
      try {
        let row = null;
        if (linkIdFromToken) {
          const { data, error } = await regDb.from('registration_rules')
            .select('id, link_id, manager_id, max_slots, current_count, expires_at, is_active')
            .eq('link_id', linkIdFromToken).maybeSingle();
          if (!error) row = data;
        } else {
          const numericId = /^\d+$/.test(String(managerIdFromToken)) ? parseInt(managerIdFromToken, 10) : null;
          if (numericId != null) {
            const { data } = await regDb.from('registration_rules')
              .select('id, manager_id, max_slots, current_count, expires_at, is_active')
              .eq('id', numericId).maybeSingle();
            row = data;
          }
          if (!row) {
            const { data } = await regDb.from('registration_rules')
              .select('id, manager_id, max_slots, current_count, expires_at, is_active')
              .eq('manager_id', managerIdFromToken).maybeSingle();
            row = data;
          }
        }
        if (row) {
          if (!row.is_active) return res.status(400).json({ error: 'This registration link is no longer active', code: 400 });
          if (row.expires_at && new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'This registration link has expired', code: 400 });
          if (row.max_slots != null && (row.current_count || 0) >= row.max_slots) return res.status(400).json({ error: `This registration link has reached the maximum number of slots (${row.max_slots})`, code: 400 });
          if (chatSupabase) {
            const { data: managerExists, error: me } = await chatSupabase.from('profiles').select('id').eq('id', row.manager_id).maybeSingle();
            if (me || !managerExists) return res.status(400).json({ error: 'Invalid manager ID in registration link', code: 400 });
          }
          registrationRule = row;
          managerId = row.manager_id;
          console.log('✅ Registration link validated:', { id: row.id, link_id: row.link_id, manager_id: managerId });
        }
      } catch (e) { console.error('⚠️ Error resolving registration link:', e); }
    }

    // Validate invitation token if provided (for regular waiting list invitations)
    if (invitationToken && !registrationRule) {
      try {
        // Decode the token (it's base64 encoded UUID)
        const decodedToken = Buffer.from(invitationToken, 'base64').toString('utf-8');
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        
        if (uuidRegex.test(decodedToken)) {
          const { data: invitationData } = await supabase
            .from('waiting_list')
            .select('id, email, invitation_used_at')
            .eq('invitation_token', decodedToken)
            .maybeSingle();

          if (!invitationData) {
            return res.status(400).json({ 
              error: 'Invalid invitation token',
              code: 400
            });
          }

          if (invitationData.invitation_used_at) {
            return res.status(400).json({ 
              error: 'This invitation has already been used',
              code: 400
            });
          }
        }
      } catch (tokenError) {
        console.error('⚠️ Error validating invitation token:', tokenError);
        // Continue without token validation if it fails (for backward compatibility)
      }
    }

    // Sign up using Supabase Auth client (with anon key)
    const { data: signupData, error: signupError } = await supabaseAuth.auth.signUp({
      email: normalizedEmail,
      password: password,
      options: {
        data: {
          first_name: userData.first_name,
          last_name: userData.last_name,
          phone: userData.phone,
          newsletter: userData.newsletter,
          full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
        }
      }
    });

    if (signupError) {
      console.error('❌ Signup error:', signupError.message);
      return res.status(400).json({ 
        error: signupError.message || 'Failed to create account',
        code: signupError.status || 400
      });
    }

    if (!signupData || !signupData.user) {
      return res.status(400).json({ 
        error: 'Failed to create user account',
        code: 400
      });
    }

    console.log('✅ Signup successful for user:', signupData.user.id);

    // Increment: find row by link_id (when limited) or id, then update both current_count and is_active.
    if (registrationRule && regDb) {
      try {
        const linkIdToUse = linkIdFromToken || registrationRule.link_id;
        const useLinkId = !!linkIdToUse;
        // 1) Find row by link_id or id to read current_count
        let q = regDb.from('registration_rules').select('current_count, max_slots, is_active');
        if (useLinkId) q = q.eq('link_id', linkIdToUse); else q = q.eq('id', registrationRule.id);
        const { data: cur, error: fe } = await q.maybeSingle();
        if (fe) {
          console.error('❌ Error fetching registration_rules for increment:', fe.message, fe.code);
        } else if (cur != null) {
          const newCount = (cur.current_count || 0) + 1;
          const setInactive = (cur.max_slots != null) && (newCount >= cur.max_slots);
          const updatePayload = { current_count: newCount };
          if (setInactive) updatePayload.is_active = false;
          // 2) Update: current_count always, is_active when link is full (same WHERE: link_id or id)
          let upd = regDb.from('registration_rules').update(updatePayload);
          if (useLinkId) upd = upd.eq('link_id', linkIdToUse); else upd = upd.eq('id', registrationRule.id);
          const { error: ue } = await upd;
          if (ue) {
            console.error('❌ Error incrementing registration link:', ue.message, ue.code, ue.details);
          } else {
            console.log('✅ Registration link incremented (signup):', useLinkId ? { link_id: linkIdToUse } : { id: registrationRule.id }, 'new_count:', newCount, updatePayload.is_active === false ? ', is_active=false' : '');
          }
        } else {
          console.warn('⚠️ registration_rules row not found for increment:', useLinkId ? { link_id: linkIdToUse } : { id: registrationRule.id });
        }
      } catch (e) {
        console.error('❌ Exception incrementing registration link:', e);
      }
    }

    // Generate unique user code
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let userCode = null;
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts && !userCode) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += letters.charAt(Math.floor(Math.random() * letters.length));
      }

      const { data: codeCheck } = await supabase
        .from('clients')
        .select('user_code')
        .eq('user_code', code)
        .maybeSingle();

      if (!codeCheck) {
        userCode = code;
        break;
      }
      attempts++;
    }

    if (!userCode) {
      console.error('❌ Failed to generate unique user code');
      return res.status(500).json({ 
        error: 'Failed to generate unique user code',
        code: 500
      });
    }

    // Determine final provider ID
    // Priority: manager_id from manager link > providerId from request > default provider
    let finalProviderId = null;
    
    if (managerId) {
      // Use manager_id from manager link
      finalProviderId = managerId;
      console.log('✅ Using manager ID from link:', managerId);
    } else if (providerId && (typeof providerId === 'string' && providerId.trim().length > 0)) {
      // Use provided providerId (legacy support)
      finalProviderId = providerId.trim();
      console.log('✅ Using provided provider ID:', finalProviderId);
    } else {
      // Get default provider
      if (chatSupabase) {
        const betterChoiceCompanyId = '4ab37b7b-dff1-4ee5-9920-0281e0c6468a';
        const { data: defaultManagerData } = await chatSupabase
          .from('profiles')
          .select('id')
          .eq('company_id', betterChoiceCompanyId)
          .eq('role', 'company_manager')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (defaultManagerData) {
          finalProviderId = defaultManagerData.id;
          console.log('✅ Using default provider ID:', finalProviderId);
        }
      }
    }

    // Normalize phone number
    const normalizePhoneForDatabase = (phone) => {
      if (!phone) return '';
      return phone.replace(/[\s\-\(\)\.]/g, '');
    };
    const normalizedPhone = userData.phone ? normalizePhoneForDatabase(userData.phone) : null;

    // Create client record
    const clientInsertData = {
      user_id: signupData.user.id,
      full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      user_code: userCode,
      status: 'active'
    };

    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .insert([clientInsertData])
      .select();

    if (clientError) {
      console.error('❌ Error creating client record:', clientError);
      return res.status(500).json({ 
        error: 'Account created but failed to create client record. Please contact support.',
        code: 500
      });
    }

    // Create chat_users record if secondary DB is available
    let chatUserCreated = false;
    let chatUserDataResult = null;

    if (chatSupabase && clientData && clientData[0]) {
      try {
        const chatUserData = {
          user_code: userCode,
          full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
          email: normalizedEmail,
          phone_number: normalizedPhone,
          whatsapp_number: normalizedPhone,
          platform: userData.platform || 'whatsapp',
          provider_id: finalProviderId || null,
          activated: true,
          is_verified: false,
          language: 'en',
          created_at: new Date().toISOString()
        };

        const { data: chatUserResult, error: chatUserError } = await chatSupabase
          .from('chat_users')
          .insert([chatUserData])
          .select();

        if (!chatUserError) {
          chatUserCreated = true;
          chatUserDataResult = chatUserResult;
        }
      } catch (chatError) {
        console.error('⚠️ Error creating chat user (non-critical):', chatError);
      }
    }


    // Mark invitation as used if token was provided (for waiting list invitations)
    if (invitationToken && !registrationRule) {
      try {
        const decodedToken = Buffer.from(invitationToken, 'base64').toString('utf-8');
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        
        if (uuidRegex.test(decodedToken)) {
          await supabase
            .from('waiting_list')
            .update({ 
              invitation_used_at: new Date().toISOString()
            })
            .eq('invitation_token', decodedToken);
        }
      } catch (tokenError) {
        console.error('⚠️ Error marking invitation as used (non-critical):', tokenError);
      }
    }

    console.log('✅ Client record created successfully');

    // Return signup data
    res.json({
      data: {
        user: signupData.user,
        session: signupData.session
      },
      client: clientData && clientData[0] ? clientData[0] : null,
      chatUserCreated,
      chatUserData: chatUserDataResult,
      error: null
    });

  } catch (error) {
    console.error('❌ Unexpected signup error:', error);
    res.status(500).json({ 
      error: error.message || 'An error occurred during signup',
      code: 500
    });
  }
});

// Sign in with email and password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    console.log('🔐 Attempting login for email:', email);

    // Sign in using Supabase Auth client (with anon key)
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: password
    });

    if (error) {
      console.error('❌ Login error:', error.message);
      return res.status(401).json({ 
        error: error.message || 'Invalid email or password',
        code: error.status || 401
      });
    }

    if (!data || !data.user) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        code: 401
      });
    }

    console.log('✅ Login successful for user:', data.user.id);

    // Fetch user's language preference directly from database
    let languageData = null;
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('user_language')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (!clientError && clientData) {
        languageData = clientData;
      }
    } catch (langError) {
      console.error('⚠️ Error fetching language preference (non-critical):', langError);
      // Continue even if language fetch fails
    }

    // Return session data and user info
    res.json({
      data: {
        user: data.user,
        session: data.session
      },
      language: languageData,
      error: null
    });

  } catch (error) {
    console.error('❌ Unexpected login error:', error);
    res.status(500).json({ 
      error: error.message || 'An error occurred during login',
      code: 500
    });
  }
});

// Check if email exists
app.post('/api/auth/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase();
    
    // Check PRIMARY database (clients table)
    const { data: primaryData, error: primaryError } = await supabase
      .from('clients')
      .select('email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (primaryError && primaryError.code !== 'PGRST116') {
      throw primaryError;
    }

    if (primaryData) {
      return res.json({ exists: true });
    }

    // Check SECONDARY database (chat_users table)
    if (chatSupabase) {
      const { data: secondaryData, error: secondaryError } = await chatSupabase
        .from('chat_users')
        .select('email')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (secondaryError && secondaryError.code !== 'PGRST116') {
        throw secondaryError;
      }

      if (secondaryData) {
        return res.json({ exists: true });
      }
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if phone exists
app.post('/api/auth/check-phone', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone is required' });
    }

    // Check PRIMARY database (clients table)
    const { data: primaryData, error: primaryError } = await supabase
      .from('clients')
      .select('phone')
      .eq('phone', phone)
      .maybeSingle();

    if (primaryError && primaryError.code !== 'PGRST116') {
      throw primaryError;
    }

    if (primaryData) {
      return res.json({ exists: true });
    }

    // Check SECONDARY database (chat_users table)
    if (chatSupabase) {
      const { data: secondaryDataByPhone, error: secondaryError1 } = await chatSupabase
        .from('chat_users')
        .select('phone_number, whatsapp_number')
        .eq('phone_number', phone)
        .maybeSingle();

      if (secondaryError1 && secondaryError1.code !== 'PGRST116') {
        throw secondaryError1;
      }

      if (secondaryDataByPhone) {
        return res.json({ exists: true });
      }

      const { data: secondaryDataByWhatsApp, error: secondaryError2 } = await chatSupabase
        .from('chat_users')
        .select('phone_number, whatsapp_number')
        .eq('whatsapp_number', phone)
        .maybeSingle();

      if (secondaryError2 && secondaryError2.code !== 'PGRST116') {
        throw secondaryError2;
      }

      if (secondaryDataByWhatsApp) {
        return res.json({ exists: true });
      }
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('Error checking phone:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if user code exists
app.post('/api/auth/check-user-code', async (req, res) => {
  try {
    const { userCode } = req.body;
    if (!userCode) {
      return res.status(400).json({ error: 'User code is required' });
    }

    // Check PRIMARY database
    const { data: primaryData, error: primaryError } = await supabase
      .from('clients')
      .select('user_code')
      .eq('user_code', userCode)
      .maybeSingle();

    if (primaryError && primaryError.code !== 'PGRST116') {
      throw primaryError;
    }

    if (primaryData) {
      return res.json({ exists: true });
    }

    // Check SECONDARY database
    if (chatSupabase) {
      const { data: secondaryData, error: secondaryError } = await chatSupabase
        .from('chat_users')
        .select('user_code')
        .eq('user_code', userCode)
        .maybeSingle();

      if (secondaryError && secondaryError.code !== 'PGRST116') {
        throw secondaryError;
      }

      if (secondaryData) {
        return res.json({ exists: true });
      }
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('Error checking user code:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check registration rule availability (for frontend validation)
app.get('/api/auth/check-registration-rule', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    try {
      const decodedToken = Buffer.from(token, 'base64').toString('utf-8');
      
      // Check if it's an integer (registration rule ID - SERIAL)
      const integerId = parseInt(decodedToken, 10);
      let registrationRule = null;
      
      if (!isNaN(integerId) && integerId > 0) {
        // Look up by ID
        const { data, error } = await chatSupabase
          .from('registration_rules')
          .select('id, manager_id, max_slots, current_count, expires_at, is_active')
          .eq('id', integerId)
          .maybeSingle();
        
        if (!error && data) {
          registrationRule = data;
        }
      } else {
        // Look up by manager_id (VARCHAR)
        const { data, error } = await chatSupabase
          .from('registration_rules')
          .select('id, manager_id, max_slots, current_count, expires_at, is_active')
          .eq('manager_id', decodedToken)
          .maybeSingle();
        
        if (!error && data) {
          registrationRule = data;
        }
      }

      if (!registrationRule) {
        return res.status(404).json({ 
          error: 'Registration rule not found',
          available: false
        });
      }

      // Check if rule is active
      if (!registrationRule.is_active) {
        return res.status(400).json({ 
          error: 'This registration link is no longer active',
          available: false,
          is_active: false
        });
      }

      // Check expiry date
      if (registrationRule.expires_at) {
        const expiryDate = new Date(registrationRule.expires_at);
        const now = new Date();
        if (expiryDate < now) {
          return res.status(400).json({ 
            error: 'This registration link has expired',
            available: false,
            expired: true
          });
        }
      }

      // Check max_slots limit
      const isAvailable = registrationRule.max_slots === null || 
                         registrationRule.current_count < registrationRule.max_slots;

      return res.json({
        available: isAvailable,
        registration_rule: {
          id: registrationRule.id,
          manager_id: registrationRule.manager_id,
          max_slots: registrationRule.max_slots,
          current_count: registrationRule.current_count,
          remaining_slots: registrationRule.max_slots !== null 
            ? Math.max(0, registrationRule.max_slots - registrationRule.current_count)
            : null,
          expires_at: registrationRule.expires_at,
          is_active: registrationRule.is_active
        },
        error: isAvailable ? null : `This registration link has reached the maximum number of slots (${registrationRule.max_slots})`
      });
    } catch (decodeError) {
      console.error('Error decoding token:', decodeError);
      return res.status(400).json({ error: 'Invalid token format' });
    }
  } catch (error) {
    console.error('Error checking registration rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get default provider (company manager)
app.get('/api/auth/default-provider', async (req, res) => {
  try {
    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    const betterChoiceCompanyId = '4ab37b7b-dff1-4ee5-9920-0281e0c6468a';
    
    const { data: managerData, error: managerError } = await chatSupabase
      .from('profiles')
      .select('id')
      .eq('company_id', betterChoiceCompanyId)
      .eq('role', 'company_manager')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (managerError && managerError.code !== 'PGRST116') {
      throw managerError;
    }

    res.json({ provider_id: managerData?.id || null });
  } catch (error) {
    console.error('Error getting default provider:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create client record (used after OAuth signup, e.g. Google; also by WhatsAppRegisterPage, OnboardingModal)
app.post('/api/auth/create-client', async (req, res) => {
  try {
    const { userId, userData, userCode, providerId, invitationToken, managerLinkData } = req.body;
    if (!userId || !userData || !userCode) {
      return res.status(400).json({ error: 'User ID, user data, and user code are required' });
    }

    const clientInsertData = {
      user_id: userId,
      full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
      email: userData.email,
      phone: userData.phone,
      user_code: userCode,
      status: 'active'
    };

    const { data, error } = await supabase
      .from('clients')
      .insert([clientInsertData])
      .select();

    if (error) throw error;

    // Resolve registration link from invitationToken/managerLinkData (OAuth e.g. Google signup) and increment current_count.
    // registration_rules is in the secondary (chat) Supabase project only.
    const regDb = chatSupabase;
    let registrationRule = null;
    let linkIdFromToken = null;
    let managerIdFromToken = null;
    if (invitationToken) {
      try {
        const decoded = Buffer.from(invitationToken, 'base64').toString('utf-8');
        try {
          const obj = JSON.parse(decoded);
          if (obj && obj.link_id) { linkIdFromToken = obj.link_id; managerIdFromToken = obj.manager_id || null; }
          else if (obj && obj.manager_id) managerIdFromToken = obj.manager_id;
        } catch (_) { managerIdFromToken = decoded; }
      } catch (_) {}
    }
    if (!linkIdFromToken && managerLinkData?.link_id) linkIdFromToken = managerLinkData.link_id;
    if (!managerIdFromToken && managerLinkData?.manager_id) managerIdFromToken = managerLinkData.manager_id;

    if (linkIdFromToken || managerIdFromToken) {
      if (!regDb) {
        return res.status(503).json({ error: 'Registration links require CHAT_SUPABASE_URL and CHAT_SUPABASE_SERVICE_ROLE_KEY' });
      }
      try {
        let row = null;
        if (linkIdFromToken) {
          const { data: r, error: re } = await regDb.from('registration_rules').select('id, link_id, manager_id, max_slots, current_count, expires_at, is_active').eq('link_id', linkIdFromToken).maybeSingle();
          if (!re) row = r;
        } else {
          const numericId = /^\d+$/.test(String(managerIdFromToken)) ? parseInt(managerIdFromToken, 10) : null;
          if (numericId != null) {
            const { data: r } = await regDb.from('registration_rules').select('id, manager_id, max_slots, current_count, expires_at, is_active').eq('id', numericId).maybeSingle();
            row = r;
          }
          if (!row) {
            const { data: r } = await regDb.from('registration_rules').select('id, manager_id, max_slots, current_count, expires_at, is_active').eq('manager_id', managerIdFromToken).maybeSingle();
            row = r;
          }
        }
        if (row) registrationRule = row;
      } catch (e) { console.error('⚠️ create-client: resolve registration link:', e); }
    }

    if (registrationRule && regDb) {
      try {
        const linkIdToUse = linkIdFromToken || registrationRule.link_id;
        const useLinkId = !!linkIdToUse;
        let q = regDb.from('registration_rules').select('current_count, max_slots, is_active');
        if (useLinkId) q = q.eq('link_id', linkIdToUse); else q = q.eq('id', registrationRule.id);
        const { data: cur, error: fe } = await q.maybeSingle();
        if (!fe && cur != null) {
          const newCount = (cur.current_count || 0) + 1;
          const setInactive = (cur.max_slots != null) && (newCount >= cur.max_slots);
          const updatePayload = { current_count: newCount };
          if (setInactive) updatePayload.is_active = false;
          let upd = regDb.from('registration_rules').update(updatePayload);
          if (useLinkId) upd = upd.eq('link_id', linkIdToUse); else upd = upd.eq('id', registrationRule.id);
          const { error: ue } = await upd;
          if (ue) console.error('❌ create-client: increment registration link:', ue.message);
          else console.log('✅ create-client: registration link incremented (Google/OAuth)', useLinkId ? { link_id: linkIdToUse } : { id: registrationRule.id }, 'new_count:', newCount, setInactive ? ', is_active=false' : '');
        }
      } catch (e) { console.error('❌ create-client: exception incrementing registration link:', e); }
    }

    // Also create record in chat_users table (secondary database)
    let chatUserCreated = false;
    let chatUserDataResult = null;
    
    if (chatSupabase && data && data[0]) {
      try {
        const chatUserData = {
          user_code: userCode,
          full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
          email: userData.email,
          phone_number: userData.phone,
          whatsapp_number: userData.phone,
          platform: userData.platform || 'whatsapp',
          provider_id: providerId || null,
          activated: true,
          is_verified: false,
          language: 'en',
          created_at: new Date().toISOString()
        };

        const { data: chatUserResult, error: chatUserError } = await chatSupabase
          .from('chat_users')
          .insert([chatUserData])
          .select();

        if (!chatUserError) {
          chatUserCreated = true;
          chatUserDataResult = chatUserResult;
        }
      } catch (chatError) {
        console.error('Error creating chat user:', chatError);
      }
    }

    res.json({ 
      data, 
      chatUserCreated,
      chatUserData: chatUserDataResult
    });
  } catch (error) {
    console.error('Error creating client record:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get client record
app.get('/api/auth/client/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data });
  } catch (error) {
    console.error('Error getting client record:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update client record
app.put('/api/auth/client/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { updates } = req.body;
    
    if (!updates) {
      return res.status(400).json({ error: 'Updates are required' });
    }

    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('user_id', userId)
      .select();

    if (error) throw error;

    // If secondary DB is available and we have user_code, also update chat_users
    if (chatSupabase && data && data[0] && data[0].user_code) {
      try {
        const { data: chatUser, error: chatUserError } = await chatSupabase
          .from('chat_users')
          .select('id')
          .eq('user_code', data[0].user_code)
          .maybeSingle();

        if (!chatUserError && chatUser) {
          const chatUpdates = {};
          
          if (updates.full_name) chatUpdates.full_name = updates.full_name;
          if (updates.email) chatUpdates.email = updates.email;
          if (updates.phone) {
            chatUpdates.phone_number = updates.phone;
            chatUpdates.whatsapp_number = updates.phone;
          }
          if (updates.region) chatUpdates.region = updates.region;
          if (updates.city) chatUpdates.city = updates.city;
          if (updates.timezone) chatUpdates.timezone = updates.timezone;
          if (updates.age) chatUpdates.age = updates.age;
          if (updates.gender) chatUpdates.gender = updates.gender;
          if (updates.birth_date) chatUpdates.date_of_birth = updates.birth_date;
          if (updates.food_allergies) chatUpdates.food_allergies = updates.food_allergies;
          if (updates.updated_at) chatUpdates.updated_at = updates.updated_at;

          if (Object.keys(chatUpdates).length > 0) {
            await chatSupabase
              .from('chat_users')
              .update(chatUpdates)
              .eq('id', chatUser.id);
          }
        }
      } catch (syncError) {
        console.error('Error syncing to chat_users:', syncError);
      }
    }

    res.json({ data });
  } catch (error) {
    console.error('Error updating client record:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================
// WAITING LIST API ROUTES
// ====================================

// Submit waiting list entry
app.post('/api/waiting-list/submit', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, goal, message } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'First name, last name, and email are required'
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

    const normalizedEmail = email.toLowerCase();

    // Check if email already exists in waiting list
    const { data: existingEntry, error: checkError } = await supabase
      .from('waiting_list')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingEntry) {
      return res.status(400).json({
        error: 'Email already registered',
        message: 'This email is already on the waiting list'
      });
    }

    // Save to Supabase
    const { data, error } = await supabase
      .from('waiting_list')
      .insert([
        {
          first_name: firstName,
          last_name: lastName,
          email: normalizedEmail,
          phone: phone || null,
          goal: goal || null,
          message: message || null,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error('Error saving waiting list entry:', error);
      throw error;
    }

    res.json({ 
      success: true, 
      data,
      message: 'Successfully joined waiting list'
    });
  } catch (error) {
    console.error('Error submitting waiting list entry:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to submit waiting list entry' 
    });
  }
});

// Validate invitation token
app.get('/api/waiting-list/validate-token', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Token is required' 
      });
    }

    // Decode the token (it's base64 encoded UUID)
    let decodedToken;
    try {
      decodedToken = Buffer.from(token, 'base64').toString('utf-8');
      // Validate it looks like a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(decodedToken)) {
        return res.status(400).json({ 
          valid: false, 
          error: 'Invalid token format' 
        });
      }
    } catch (decodeError) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Invalid token format' 
      });
    }

    // Check if token exists in waiting_list table
    // The token should match the invitation_token field (stored as UUID string)
    const { data, error } = await supabase
      .from('waiting_list')
      .select('id, email, first_name, last_name, invitation_sent_at, invitation_used_at')
      .eq('invitation_token', decodedToken)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return res.json({ 
        valid: false, 
        error: 'Invalid or expired invitation token' 
      });
    }

    // Check if token has already been used
    if (data.invitation_used_at) {
      return res.json({ 
        valid: false, 
        error: 'This invitation has already been used',
        used: true
      });
    }

    res.json({ 
      valid: true, 
      data: {
        id: data.id,
        email: data.email,
        firstName: data.first_name,
        lastName: data.last_name
      }
    });
  } catch (error) {
    console.error('Error validating invitation token:', error);
    res.status(500).json({ 
      valid: false,
      error: error.message || 'Failed to validate token' 
    });
  }
});

// Mark invitation as used
app.post('/api/waiting-list/mark-used', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ 
        error: 'Token is required' 
      });
    }

    // Decode the token (it's base64 encoded UUID)
    let decodedToken;
    try {
      decodedToken = Buffer.from(token, 'base64').toString('utf-8');
      // Validate it looks like a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(decodedToken)) {
        return res.status(400).json({ 
          error: 'Invalid token format' 
        });
      }
    } catch (decodeError) {
      return res.status(400).json({ 
        error: 'Invalid token format' 
      });
    }

    // Update the waiting_list entry to mark invitation as used
    const { data, error } = await supabase
      .from('waiting_list')
      .update({ 
        invitation_used_at: new Date().toISOString()
      })
      .eq('invitation_token', decodedToken)
      .select();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ 
        error: 'Invitation token not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Invitation marked as used' 
    });
  } catch (error) {
    console.error('Error marking invitation as used:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to mark invitation as used' 
    });
  }
});

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
// MACRO SUMMARY SVG ENDPOINT
// ====================================

// Generate macro summary SVG for a specific date
app.get('/api/macro-summary-svg', async (req, res) => {
  try {
    const { user_code, phone_number, date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    if (!user_code && !phone_number) {
      return res.status(400).json({ error: 'Either user_code or phone_number is required' });
    }

    if (!chatSupabase) {
      return res.status(500).json({ error: 'Chat database not configured' });
    }

    console.log('📊 Generating macro summary SVG for:', { user_code, phone_number, date });

    // Find user in chat_users table
    let userQuery = chatSupabase
      .from('chat_users')
      .select('id, user_code, language')
      .limit(1);

    if (user_code) {
      userQuery = userQuery.eq('user_code', user_code);
    } else if (phone_number) {
      userQuery = userQuery.eq('phone', phone_number);
    }

    const { data: userData, error: userError } = await userQuery.single();

    if (userError || !userData) {
      console.error('❌ User not found:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userData.id;
    const userCode = userData.user_code;
    const userLanguage = userData.language || 'en';

    // Get food logs for the date
    const { data: foodLogs, error: logsError } = await chatSupabase
      .from('food_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('log_date', date);

    if (logsError) {
      console.error('❌ Error fetching food logs:', logsError);
      return res.status(500).json({ error: 'Failed to fetch food logs' });
    }

    // Calculate totals from food logs
    const totalCalories = (foodLogs || []).reduce((sum, log) => {
      let logCalories = 0;
      if (log.food_items) {
        try {
          const foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
          if (Array.isArray(foodItems)) {
            logCalories = foodItems.reduce((itemSum, item) => itemSum + (item.cals || 0), 0);
          }
        } catch (e) {
          console.error('Error parsing food_items:', e);
        }
      }
      return sum + logCalories + (log.total_calories || 0);
    }, 0);

    const totalProtein = (foodLogs || []).reduce((sum, log) => {
      let logProtein = 0;
      if (log.food_items) {
        try {
          const foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
          if (Array.isArray(foodItems)) {
            logProtein = foodItems.reduce((itemSum, item) => itemSum + (item.p || 0), 0);
          }
        } catch (e) {
          console.error('Error parsing food_items:', e);
        }
      }
      return sum + logProtein + (log.total_protein_g || 0);
    }, 0);

    const totalCarbs = (foodLogs || []).reduce((sum, log) => {
      let logCarbs = 0;
      if (log.food_items) {
        try {
          const foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
          if (Array.isArray(foodItems)) {
            logCarbs = foodItems.reduce((itemSum, item) => itemSum + (item.c || 0), 0);
          }
        } catch (e) {
          console.error('Error parsing food_items:', e);
        }
      }
      return sum + logCarbs + (log.total_carbs_g || 0);
    }, 0);

    const totalFat = (foodLogs || []).reduce((sum, log) => {
      let logFat = 0;
      if (log.food_items) {
        try {
          const foodItems = typeof log.food_items === 'string' ? JSON.parse(log.food_items) : log.food_items;
          if (Array.isArray(foodItems)) {
            logFat = foodItems.reduce((itemSum, item) => itemSum + (item.f || 0), 0);
          }
        } catch (e) {
          console.error('Error parsing food_items:', e);
        }
      }
      return sum + logFat + (log.total_fat_g || 0);
    }, 0);

    // Get meal plan targets
    const { data: mealPlanData } = await chatSupabase
      .from('meal_plans_and_schemas')
      .select('*')
      .eq('user_code', userCode)
      .eq('record_type', 'meal_plan')
      .eq('status', 'active')
      .single();

    let dailyGoals = {
      calories: 2000,
      protein: 150,
      carbs: 250,
      fat: 65
    };

    if (mealPlanData) {
      if (mealPlanData.macros_target) {
        dailyGoals = {
          calories: mealPlanData.daily_total_calories || 2000,
          protein: mealPlanData.macros_target.protein || 150,
          carbs: mealPlanData.macros_target.carbs || 250,
          fat: mealPlanData.macros_target.fat || 65
        };
      } else if (mealPlanData.meal_plan && mealPlanData.meal_plan.meals) {
        const totals = mealPlanData.meal_plan.meals.reduce((acc, meal) => {
          if (meal.main && meal.main.nutrition) {
            acc.calories += meal.main.nutrition.calories || 0;
            acc.protein += meal.main.nutrition.protein || 0;
            acc.carbs += meal.main.nutrition.carbs || 0;
            acc.fat += meal.main.nutrition.fat || 0;
          }
          return acc;
        }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

        dailyGoals = {
          calories: totals.calories || mealPlanData.daily_total_calories || 2000,
          protein: totals.protein || 150,
          carbs: totals.carbs || 250,
          fat: totals.fat || 65
        };
      }
    }

    // Calculate percentages
    const caloriesPercent = Math.round((totalCalories / dailyGoals.calories) * 100);
    const proteinPercent = Math.round((totalProtein / dailyGoals.protein) * 100);
    const carbsPercent = Math.round((totalCarbs / dailyGoals.carbs) * 100);
    const fatPercent = Math.round((totalFat / dailyGoals.fat) * 100);

    // Generate SVG
    const outerRadius = 120;
    const innerRadius = 100;
    const outerCircumference = 2 * Math.PI * outerRadius;
    const circumference = 2 * Math.PI * innerRadius;
    const segmentLength = circumference / 3;

    // Calculate lengths
    const caloriesNormalLength = Math.min(caloriesPercent, 100) / 100 * outerCircumference;
    const caloriesOverflowLength = caloriesPercent > 100 ? ((caloriesPercent - 100) / 100) * outerCircumference : 0;
    const proteinNormalLength = Math.min(proteinPercent, 100) / 100 * segmentLength;
    const proteinOverflowLength = proteinPercent > 100 ? (proteinPercent - 100) / 100 * segmentLength : 0;
    const carbsNormalLength = Math.min(carbsPercent, 100) / 100 * segmentLength;
    const carbsOverflowLength = carbsPercent > 100 ? (carbsPercent - 100) / 100 * segmentLength : 0;
    const fatNormalLength = Math.min(fatPercent, 100) / 100 * segmentLength;
    const fatOverflowLength = fatPercent > 100 ? (fatPercent - 100) / 100 * segmentLength : 0;

    // Format weight helper
    const formatWeight = (grams) => {
      return `${Math.round(grams)}g`;
    };

    // Generate SVG string
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 450">
  <g transform="rotate(-90 140 140)">
  <!-- Outer Circle Background (Calories) -->
  <circle
    cx="140"
    cy="140"
    r="${outerRadius}"
    fill="none"
    stroke="rgba(200, 200, 200, 0.2)"
    stroke-width="16"
  />
  
  <!-- Inner Circle Background (Macros) -->
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="rgba(200, 200, 200, 0.2)"
    stroke-width="16"
  />
  
  <!-- Outer Circle - Calories Progress -->
  ${caloriesNormalLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${outerRadius}"
    fill="none"
    stroke="#10b981"
    stroke-width="16"
    stroke-linecap="round"
    stroke-dasharray="${caloriesNormalLength} ${outerCircumference}"
    stroke-dashoffset="0"
    opacity="1"
  />` : ''}
  ${caloriesOverflowLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${outerRadius}"
    fill="none"
    stroke="#059669"
    stroke-width="16"
    stroke-linecap="round"
    stroke-dasharray="${caloriesOverflowLength} ${outerCircumference}"
    stroke-dashoffset="0"
    opacity="1"
  />` : ''}
  
  <!-- Inner Circle - Macros -->
  ${proteinNormalLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="#a855f7"
    stroke-width="16"
    stroke-linecap="round"
    stroke-dasharray="${proteinNormalLength} ${circumference}"
    stroke-dashoffset="0"
    opacity="1"
  />` : ''}
  ${carbsNormalLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="#3b82f6"
    stroke-width="16"
    stroke-linecap="round"
    stroke-dasharray="${carbsNormalLength} ${circumference}"
    stroke-dashoffset="${-segmentLength}"
    opacity="1"
  />` : ''}
  ${fatNormalLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="#f59e0b"
    stroke-width="16"
    stroke-linecap="round"
    stroke-dasharray="${fatNormalLength} ${circumference}"
    stroke-dashoffset="${-segmentLength * 2}"
    opacity="1"
  />` : ''}
  
  <!-- Overflow borders -->
  ${proteinOverflowLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="#3b82f6"
    stroke-width="20"
    stroke-linecap="round"
    stroke-dasharray="${proteinOverflowLength} ${circumference}"
    stroke-dashoffset="${0 - proteinNormalLength}"
    opacity="1"
  />` : ''}
  ${carbsOverflowLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="#f59e0b"
    stroke-width="20"
    stroke-linecap="round"
    stroke-dasharray="${carbsOverflowLength} ${circumference}"
    stroke-dashoffset="${-segmentLength - carbsNormalLength}"
    opacity="1"
  />` : ''}
  ${fatOverflowLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="#a855f7"
    stroke-width="20"
    stroke-linecap="round"
    stroke-dasharray="${fatOverflowLength} ${circumference}"
    stroke-dashoffset="0"
    opacity="1"
  />` : ''}
  
  <!-- Overflow main arcs -->
  ${proteinOverflowLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="#a855f7"
    stroke-width="16"
    stroke-linecap="round"
    stroke-dasharray="${proteinOverflowLength} ${circumference}"
    stroke-dashoffset="${0 - proteinNormalLength}"
    opacity="1"
  />` : ''}
  ${carbsOverflowLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="#3b82f6"
    stroke-width="16"
    stroke-linecap="round"
    stroke-dasharray="${carbsOverflowLength} ${circumference}"
    stroke-dashoffset="${-segmentLength - carbsNormalLength}"
    opacity="1"
  />` : ''}
  ${fatOverflowLength > 0 ? `
  <circle
    cx="140"
    cy="140"
    r="${innerRadius}"
    fill="none"
    stroke="#f59e0b"
    stroke-width="16"
    stroke-linecap="round"
    stroke-dasharray="${fatOverflowLength} ${circumference}"
    stroke-dashoffset="0"
    opacity="1"
  />` : ''}
  
  </g>
  
  <!-- Center Calories Text (rendered on top, not rotated) -->
  <text
    x="140"
    y="160"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
    font-size="68"
    font-weight="200"
    fill="#1f2937"
    letter-spacing="-0.02em"
  >${totalCalories.toLocaleString()}</text>
  
  <!-- Macro Details List -->
  <g transform="translate(0, 300)">
    ${userLanguage === 'he' ? `
    <!-- Calories (RTL - inverted) -->
    <g transform="translate(50, 0)">
      <text x="0" y="12" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="14" font-weight="500" fill="#1f2937">
        ${totalCalories.toLocaleString()} / ${dailyGoals.calories.toLocaleString()}
      </text>
      <circle cx="184" cy="8" r="6" fill="#10b981"/>
      <text x="170" y="12" text-anchor="end" font-family="system-ui, Arial, sans-serif" font-size="14" fill="#6b7280">
        קלוריות
      </text>
    </g>
    
    <!-- Protein (RTL - inverted) -->
    <g transform="translate(50, 30)">
      <text x="0" y="12" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="14" font-weight="500" fill="#1f2937">
        ${formatWeight(totalProtein)} / ${formatWeight(dailyGoals.protein)}
      </text>
      <circle cx="184" cy="8" r="6" fill="#a855f7"/>
      <text x="170" y="12" text-anchor="end" font-family="system-ui, Arial, sans-serif" font-size="14" fill="#6b7280">
        חלבון
      </text>
    </g>
    
    <!-- Carbs (RTL - inverted) -->
    <g transform="translate(50, 60)">
      <text x="0" y="12" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="14" font-weight="500" fill="#1f2937">
        ${formatWeight(totalCarbs)} / ${formatWeight(dailyGoals.carbs)}
      </text>
      <circle cx="184" cy="8" r="6" fill="#3b82f6"/>
      <text x="170" y="12" text-anchor="end" font-family="system-ui, Arial, sans-serif" font-size="14" fill="#6b7280">
        פחמימות
      </text>
    </g>
    
    <!-- Fat (RTL - inverted) -->
    <g transform="translate(50, 90)">
      <text x="0" y="12" text-anchor="start" font-family="system-ui, Arial, sans-serif" font-size="14" font-weight="500" fill="#1f2937">
        ${formatWeight(totalFat)} / ${formatWeight(dailyGoals.fat)}
      </text>
      <circle cx="184" cy="8" r="6" fill="#f59e0b"/>
      <text x="170" y="12" text-anchor="end" font-family="system-ui, Arial, sans-serif" font-size="14" fill="#6b7280">
        שומן
      </text>
    </g>
    ` : `
    <!-- Calories -->
    <g transform="translate(50, 0)">
      <circle cx="6" cy="8" r="6" fill="#10b981"/>
      <text x="20" y="12" font-family="system-ui, Arial, sans-serif" font-size="14" fill="#6b7280">
        Calories
      </text>
      <text x="180" y="12" text-anchor="end" font-family="system-ui, Arial, sans-serif" font-size="14" font-weight="500" fill="#1f2937">
        ${totalCalories.toLocaleString()} / ${dailyGoals.calories.toLocaleString()}
      </text>
    </g>
    
    <!-- Protein -->
    <g transform="translate(50, 30)">
      <circle cx="6" cy="8" r="6" fill="#a855f7"/>
      <text x="20" y="12" font-family="system-ui, Arial, sans-serif" font-size="14" fill="#6b7280">
        Protein
      </text>
      <text x="180" y="12" text-anchor="end" font-family="system-ui, Arial, sans-serif" font-size="14" font-weight="500" fill="#1f2937">
        ${formatWeight(totalProtein)} / ${formatWeight(dailyGoals.protein)}
      </text>
    </g>
    
    <!-- Carbs -->
    <g transform="translate(50, 60)">
      <circle cx="6" cy="8" r="6" fill="#3b82f6"/>
      <text x="20" y="12" font-family="system-ui, Arial, sans-serif" font-size="14" fill="#6b7280">
        Carbs
      </text>
      <text x="180" y="12" text-anchor="end" font-family="system-ui, Arial, sans-serif" font-size="14" font-weight="500" fill="#1f2937">
        ${formatWeight(totalCarbs)} / ${formatWeight(dailyGoals.carbs)}
      </text>
    </g>
    
    <!-- Fat -->
    <g transform="translate(50, 90)">
      <circle cx="6" cy="8" r="6" fill="#f59e0b"/>
      <text x="20" y="12" font-family="system-ui, Arial, sans-serif" font-size="14" fill="#6b7280">
        Fat
      </text>
      <text x="180" y="12" text-anchor="end" font-family="system-ui, Arial, sans-serif" font-size="14" font-weight="500" fill="#1f2937">
        ${formatWeight(totalFat)} / ${formatWeight(dailyGoals.fat)}
      </text>
    </g>
    `}
  </g>
</svg>`;

    // Convert SVG to PNG using sharp
    // Use a larger size for better quality, adjust height proportionally (450/280 * 1200)
    const pngBuffer = await sharp(Buffer.from(svg))
      .resize(1200, 1929, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toBuffer();

    // Set content type to PNG image
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(pngBuffer);

  } catch (error) {
    console.error('❌ Error generating macro summary SVG:', error);
    res.status(500).json({ 
      error: 'Failed to generate macro summary SVG',
      message: error.message 
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
