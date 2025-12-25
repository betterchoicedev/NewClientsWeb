# Deployment Guide for BetterChoice App

This guide explains how to deploy your React frontend and Node.js backend server to production.

## Overview

Your application consists of two parts:
1. **Frontend (React App)** - Deployed to a static hosting service (Vercel, Netlify, Azure Static Web Apps, etc.)
2. **Backend Server (Node.js/Express)** - Deployed to a server hosting service (Azure App Service, Heroku, Railway, Render, etc.)

## Current Setup

### Development Mode (Localhost)
- **Frontend**: Runs on `http://localhost:3000` (React dev server)
- **Backend**: Runs on `http://localhost:3001` (Express server)
- **Connection**: Uses proxy in `package.json` (`"proxy": "http://localhost:3001"`) to forward `/api/*` requests

### Production Mode
- **Frontend**: Deployed as static files (HTML, CSS, JS)
- **Backend**: Runs as a Node.js server on a hosting platform
- **Connection**: Frontend calls backend using `REACT_APP_API_URL` environment variable

---

## Step 1: Deploy the Backend Server

### Option A: Azure App Service (Recommended if you have web.config)

1. **Prepare for deployment:**
   ```bash
   cd server
   npm install --production
   ```

2. **Set environment variables in Azure Portal:**
   - Go to Azure Portal → Your App Service → Configuration → Application Settings
   - Add these environment variables:
     ```
     NODE_ENV=production
     PORT=8080 (or let Azure assign it)
     REACT_APP_SUPABASE_URL=your_supabase_url
     SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
     STRIPE_SECRET_KEY=sk_live_your_live_key
     STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
     CHAT_SUPABASE_URL=your_chat_supabase_url (if applicable)
     CHAT_SUPABASE_SERVICE_ROLE_KEY=your_chat_service_role_key (if applicable)
     SUPABASE_STORAGE_BUCKET_NAME=profile-pictures
     ```

3. **Deploy to Azure:**
   - Use Azure CLI, Git deployment, or FTP
   - The `web.config` file will handle the Node.js setup

4. **Get your server URL:**
   - After deployment, your server will be at: `https://your-app-name.azurewebsites.net`
   - Test it: `https://your-app-name.azurewebsites.net/health`

### Option B: Railway

1. **Connect your repository** to Railway
2. **Set root directory** to `server`
3. **Set environment variables** in Railway dashboard
4. **Deploy** - Railway will auto-detect Node.js and deploy

### Option C: Render

1. **Create a new Web Service** on Render
2. **Connect your repository**
3. **Set build command**: `npm install`
4. **Set start command**: `npm start`
5. **Set root directory**: `server`
6. **Add environment variables** in Render dashboard

### Option D: Heroku

1. **Create `Procfile` in server directory:**
   ```
   web: node index.js
   ```

2. **Deploy:**
   ```bash
   cd server
   heroku create your-app-name
   heroku config:set NODE_ENV=production
   heroku config:set REACT_APP_SUPABASE_URL=your_url
   # ... add all other env vars
   git push heroku main
   ```

---

## Step 2: Deploy the Frontend

### Option A: Vercel (Recommended for React)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Set environment variables:**
   - In Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add:
     ```
     REACT_APP_API_URL=https://your-server-url.com
     REACT_APP_SUPABASE_URL=your_supabase_url
     REACT_APP_SUPABASE_ANON_KEY=your_anon_key
     # ... all other REACT_APP_* variables
     ```

3. **Deploy:**
   ```bash
   vercel
   # Or connect GitHub repo for automatic deployments
   ```

### Option B: Netlify

1. **Create `netlify.toml` in project root:**
   ```toml
   [build]
     command = "npm run build"
     publish = "build"
   
   [[redirects]]
     from = "/api/*"
     to = "https://your-server-url.com/api/:splat"
     status = 200
     force = true
   ```

2. **Set environment variables** in Netlify Dashboard

3. **Deploy** via Git or drag-and-drop

### Option C: Azure Static Web Apps

1. **Create Static Web App** in Azure Portal
2. **Connect to your repository**
3. **Set build configuration:**
   - Build command: `npm run build`
   - App location: `/`
   - Output location: `build`
4. **Set environment variables** in Azure Portal

### Option D: Traditional Hosting (cPanel, etc.)

1. **Build the React app:**
   ```bash
   npm run build
   ```

2. **Upload the `build` folder** contents to your hosting provider

3. **Set environment variables** (if supported) or create a `.env` file in the build directory

---

## Step 3: Configure Environment Variables

### Frontend Environment Variables (`.env.production` or hosting platform)

Create `.env.production` in your project root:

```env
# API Server URL (CRITICAL - must point to your deployed server)
REACT_APP_API_URL=https://your-server-url.azurewebsites.net

# Supabase Configuration
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key

# Secondary Supabase (if applicable)
REACT_APP_SUPABASE_SECONDARY_URL=https://your-chat-project.supabase.co
REACT_APP_SUPABASE_SECONDARY_ANON_KEY=your_secondary_anon_key

# Stripe Configuration
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key
# ... all your Stripe product/price IDs
```

### Backend Environment Variables (Server hosting platform)

Set in your server hosting platform (Azure, Railway, Render, etc.):

```env
NODE_ENV=production
PORT=8080 (or platform-assigned)

# Supabase
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_STORAGE_BUCKET_NAME=profile-pictures

# Chat Supabase (if applicable)
CHAT_SUPABASE_URL=https://your-chat-project.supabase.co
CHAT_SUPABASE_SERVICE_ROLE_KEY=your_chat_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_live_your_live_key
STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret
```

---

## Step 4: Update CORS Settings

In `server/index.js`, update CORS to allow your frontend domain:

```javascript
app.use(cors({
  origin: [
    'https://your-frontend-domain.com',
    'https://www.your-frontend-domain.com',
    process.env.FRONTEND_URL // or set this as env var
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
```

Or for development, keep it permissive but restrict in production:

```javascript
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com']
    : true, // Allow all in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
```

---

## Step 5: Update Stripe Webhooks

1. **Go to Stripe Dashboard** → Webhooks
2. **Update webhook endpoint** to: `https://your-server-url.com/api/webhooks/stripe`
3. **Copy the new webhook secret** and update `STRIPE_WEBHOOK_SECRET` in your server environment variables

---

## Step 6: Test the Deployment

1. **Test backend health check:**
   ```
   https://your-server-url.com/health
   ```

2. **Test image upload:**
   - Visit your frontend
   - Try uploading a profile picture
   - Check browser console for errors
   - Verify image appears in Supabase Storage

3. **Check server logs** for any errors

---

## How Photo Upload Works in Production

1. **User uploads photo** in the React app
2. **Frontend sends request** to: `REACT_APP_API_URL/api/upload-profile-image`
   - If `REACT_APP_API_URL` is set → Uses that URL
   - If not set → Uses relative URL `/api/upload-profile-image` (won't work in production!)
3. **Backend server** receives the request
4. **Server uploads** to Supabase Storage
5. **Server returns** the public URL
6. **Frontend saves** the URL to the database

---

## Important Notes

### ⚠️ Critical Configuration

- **You MUST set `REACT_APP_API_URL`** in production frontend environment variables
- Without it, photo uploads will fail because there's no proxy in production
- The proxy in `package.json` only works in development mode

### 🔒 Security

- Never commit `.env` files to git
- Use production Stripe keys (`sk_live_`, `pk_live_`)
- Keep service role keys secure (backend only, never in frontend)
- Use HTTPS in production

### 📝 File Naming

- Photos are stored as: `{user_code}/{timestamp}.{format}`
- Example: `ABC123/1766674953494.png`
- The `user_code` is fetched from the `clients` table

---

## Troubleshooting

### Photos not uploading in production

1. Check `REACT_APP_API_URL` is set correctly
2. Check CORS settings allow your frontend domain
3. Check server logs for errors
4. Verify Supabase Storage bucket exists and is configured
5. Check browser console for network errors

### CORS errors

- Verify frontend URL is in CORS allowed origins
- Check that credentials are set correctly
- Verify OPTIONS preflight requests are handled

### Server not starting

- Check all environment variables are set
- Verify Node.js version matches `engines` in package.json
- Check server logs for specific error messages

---

## Quick Checklist

- [ ] Backend server deployed and accessible
- [ ] Backend environment variables configured
- [ ] Frontend built and deployed
- [ ] Frontend environment variables configured (especially `REACT_APP_API_URL`)
- [ ] CORS updated to allow frontend domain
- [ ] Stripe webhooks updated to production URL
- [ ] Test photo upload works
- [ ] Test health check endpoint
- [ ] HTTPS enabled on both frontend and backend

