# BetterChoice Stripe Server

Express.js server for handling Stripe payments and subscriptions for the BetterChoice application.

## Setup

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Environment Variables
Create a `.env` file in the server directory with the following variables:

```bash
# Stripe Configuration (from your Stripe Dashboard)
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# WhatsApp Configuration (Facebook Graph API)
WA_TOKEN=your_whatsapp_access_token_here
# Alternative variable name (also supported)
WHATSAPP_TOKEN=your_whatsapp_access_token_here

# Server Configuration  
PORT=3001
NODE_ENV=development
```

### 3. Get Your Stripe Keys

1. **Secret Key**: 
   - Go to [Stripe Dashboard → Developers → API keys](https://dashboard.stripe.com/apikeys)
   - Copy the "Secret key" (starts with `sk_test_` for test mode)

2. **Webhook Secret**:
   - Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
   - Create a new webhook endpoint: `http://localhost:3001/api/webhooks/stripe`
   - Select these events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copy the webhook signing secret (starts with `whsec_`)

### 4. Frontend Environment Variables
Add to your React app's `.env` file:

```bash
# Stripe Configuration
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Your actual Stripe Product and Price IDs
REACT_APP_STRIPE_BETTER_PRO_PRODUCT_ID=prod_SbI1Lu7FWbybUO
REACT_APP_STRIPE_PODCAST_PRODUCT_ID=prod_SbI1dssS5NElLZ
REACT_APP_STRIPE_NUTRITION_TRAINING_PRODUCT_ID=prod_SbI1AIv2A46oJ9
REACT_APP_STRIPE_NUTRITION_ONLY_PRODUCT_ID=prod_SbI0A23T20wul3
REACT_APP_STRIPE_CONSULTATION_PRODUCT_ID=prod_SbI1dssS5NElLZ

# Price IDs
REACT_APP_STRIPE_BETTER_PRO_PRICE_ID_1=price_1Rg5R8HIeYfvCylDJ4Xfg5hr
REACT_APP_STRIPE_BETTER_PRO_PRICE_ID_2=price_1Rg5R8HIeYfvCylDxX2PsOrR
REACT_APP_STRIPE_PODCAST_PRICE_ID=price_1Rg5R6HIeYfvCylDcsV3T2Kr
REACT_APP_STRIPE_NUTRITION_TRAINING_MONTHLY_PRICE_ID_1=price_1Rg5R4HIeYfvCylDy1OT1YJc
REACT_APP_STRIPE_NUTRITION_TRAINING_MONTHLY_PRICE_ID_2=price_1Rg5R4HIeYfvCylDAshP6FOk
REACT_APP_STRIPE_NUTRITION_TRAINING_BIWEEKLY_PRICE_ID=price_1Rg5RGHIeYfvCylDxuQODpK4
REACT_APP_STRIPE_NUTRITION_ONLY_MONTHLY_PRICE_ID_1=price_1Rg5QtHIeYfvCylDyXHY5X6G
REACT_APP_STRIPE_NUTRITION_ONLY_MONTHLY_PRICE_ID_2=price_1Rg5QtHIeYfvCylDwr9v599a
REACT_APP_STRIPE_NUTRITION_ONLY_BIWEEKLY_PRICE_ID=price_1Rg5RGHIeYfvCylDxuQODpK4
REACT_APP_STRIPE_CONSULTATION_PRICE_ID=price_1Rg5R6HIeYfvCylDcsV3T2Kr
```

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will run on `http://localhost:3001` by default.

## API Endpoints

### Stripe Checkout
- `POST /api/stripe/create-checkout-session` - Create Stripe checkout session
- `GET /api/stripe/checkout-session/:sessionId` - Get checkout session details

### Payment Intents
- `POST /api/stripe/create-payment-intent` - Create payment intent for custom checkout

### Subscription Management
- `GET /api/stripe/subscriptions?customerId=USER_ID` - Get customer subscriptions
- `POST /api/stripe/subscriptions/:id/cancel` - Cancel subscription
- `POST /api/stripe/subscriptions/:id/reactivate` - Reactivate subscription
- `POST /api/stripe/subscriptions/:id/payment-method` - Update payment method

### Webhooks
- `POST /api/webhooks/stripe` - Stripe webhook endpoint

### WhatsApp
- `POST /api/whatsapp/send-welcome-message` - Send WhatsApp welcome message template

### Health Check
- `GET /health` - Server health check

## Testing the Integration

1. **Start the server**: `npm run dev`
2. **Start your React app**: `npm start` (in the main project directory)
3. **Visit**: `http://localhost:3000/pricing`
4. **Test payment flow** with Stripe test cards:
   - Success: `4242424242424242`
   - Declined: `4000000000000002`

## Webhook Testing

Use Stripe CLI to test webhooks locally:

```bash
# Install Stripe CLI
# Forward events to local endpoint
stripe listen --forward-to localhost:3001/api/webhooks/stripe

# Copy the webhook signing secret and add to your .env file
```

## Production Deployment

1. **Environment**: Set `NODE_ENV=production`
2. **HTTPS**: Use HTTPS for webhook endpoints
3. **CORS**: Configure allowed origins
4. **Webhook URL**: Update to your production domain
5. **Keys**: Use live Stripe keys (`sk_live_` and `pk_live_`)

## Security Notes

- Never commit `.env` files to version control
- Use different Stripe keys for test/production environments
- Validate webhook signatures for security
- Use HTTPS in production
- Implement rate limiting and request validation

## Database Integration

To integrate with your Supabase database, add these environment variables:

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Then modify the webhook handlers in `index.js` to update your database when subscriptions change.
