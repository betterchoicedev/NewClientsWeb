# Architecture

How the clients website and the Clients API are put together: which services exist, how a request flows, and where things live. For setup see [README.md](README.md). For agent rules see [CLAUDE.md](CLAUDE.md).

## System overview

```
┌──────────────────────────────┐     ┌──────────────────────────────┐
│ Clients website (CRA)        │     │ BetterApp mobile app (Expo)  │
│ betterchoice.one → GCS bucket│     │ separate repo                │
│ this repo: src/, public/     │     │                              │
└──────────────┬───────────────┘     └───────┬──────────────┬───────┘
               │  Bearer <Supabase access token>              │
               ▼                             ▼              ▼
┌─────────────────────────────────────────────┐   ┌────────────────────────┐
│ Clients API (Node/Express)                  │   │ AI backend (FastAPI)   │
│ this repo: server/ → Cloud Run              │   │ BetterApp/backendapi   │
│ "newclientsweb", me-west1                   │   │ "ai-chatbot-app"       │
└──┬──────────┬──────────┬────────┬────────┬──┘   └────────────────────────┘
   │          │          │        │        │
   │          │          │        │        └──▶ Meal-plan builder (Cloud Run,
   │          │          │        │             europe-west3)
   │          │          │        └───────────▶ LLMs: DeepSeek endpoint,
   │          │          │                      Azure OpenAI
   │          │          └────────────────────▶ WhatsApp Cloud API (templates)
   │          └───────────────────────────────▶ Stripe (checkout, portal,
   │                                            webhook ◀── Stripe events)
   ▼
┌──────────────────────────────────────────────────────┐
│ Supabase                                             │
│  • Clients DB (clientDB): auth, clients, billing     │
│  • Chat DB    (adminDB):  chat_users, food logs,     │
│                           meal plans, companies …    │
└──────────────────────────────────────────────────────┘
```

Key points:

- **The browser holds no secrets and never talks to Supabase.** `src/supabase/supabaseClient.js` exports `null`. Every call goes to the Clients API with a Bearer token.
- **One API, two clients.** The website and the BetterApp mobile app both call this API. The app resolves it in `BetterApp/src/core/api/api-config.ts` (`PRODUCTION_API_ORIGIN`, override `EXPO_PUBLIC_API_BASE_URL`).
- **No staging.** Local runs use production data. See [README.md](README.md#there-is-no-staging-everything-is-production).

### Databases

BetterChoice has exactly two Supabase projects, shared by all its systems. Use these names everywhere.

| Canonical name | Code name here | Env vars | Holds |
|---|---|---|---|
| **Clients DB** | `clientDB` (service role), `supabaseAuth` (anon) | `REACT_APP_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REACT_APP_SUPABASE_ANON_KEY` | client auth users, `clients`, `client_meal_plans`, Stripe/billing tables, `membership_pricing`, `paywall_settings`, `contact_messages`, profile pictures |
| **Chat DB** | `adminDB` | `CHAT_SUPABASE_URL`, `CHAT_SUPABASE_SERVICE_ROLE_KEY` | `chat_users`, `food_logs`, `meal_plans_and_schemas`, staff `profiles`, `companies`, `registration_rules`, training, health, LifeOS tables |

Other names you will see: "main project" or "main Supabase" means the Clients DB. "chat/admin project", "chat Supabase" or `chatSupabase` means the Chat DB. BetterApp's `backendapi` calls the Clients DB its "auth project" (`CLIENT_SUPABASE_*`) and the Chat DB its "data project" (`SUPABASE_*`).

Clients are linked across the two by `user_code`: `clients.user_code` (Clients DB) matches `chat_users.user_code` (Chat DB). There is no cross-project transaction, so writes to both are ordered with compensation (see [server/modules/onboarding/SCHEMA.md](server/modules/onboarding/SCHEMA.md)).

---

## Website (`src/`)

### Layout

```
src/
  index.js               Entry: installs the auth fetch patch, registers the service worker (prod only)
  App.js                 All routes (React Router)
  lib/
    apiClient.js         API base URL (hard-coded to production), apiFetch, session in localStorage
    installAuthFetch.js  Patches window.fetch to add the Bearer token to API calls
  context/
    AuthContext.jsx      Current user, loaded from the stored session via /api/auth/me
    LanguageContext.jsx  Hebrew + English strings, t(), direction (rtl/ltr)
    ThemeContext.jsx     Light / dark
  supabase/
    auth.js              Auth helpers that call /api/auth/* (name is historical)
    secondaryClient.js   Meal-plan API helpers (name is historical)
  pages/                 One file per route: HomePage (home), Login, Signup, Landing, Account,
                         AuthCallback, ResetPassword, OpenApp, WhatsAppRegister, DeleteAccount, legal
  components/
    brand/               Shells (Marketing, Auth, Account), RequireAuth, store badges, download link
    OAuthHashHandler.jsx Picks up #access_token from OAuth / recovery redirects on any route
    CookieConsent, AccessibilityWidget, navigation
  features/
    marketing/           Home page sections, footage, pricing, phone mockups
    onboarding/          onboardingCompanyContext: carries the company/campaign from a landing link
  company/               Company campaign landing pages (see below)
public/
  _redirects, _headers   Netlify leftovers, ignored by the live host (GCS)
  service-worker.js      Network-first HTML, cache-first /static
  get/, delete-account/  Static pages (store landing, account deletion)
```

### Routes

| Path | Page |
|---|---|
| `/` | Marketing home (`HomePage.jsx`) |
| `/he`, `/en` | Set language, then go home |
| `/login`, `/signup`, `/reset-password`, `/auth/callback` | Auth |
| `/landing#d=…` | Company campaign landing page |
| `/account` | Account and subscription (needs sign-in) |
| `/app` | Open-the-app page |
| `/register/:phoneNumber` | WhatsApp registration |
| `/delete-account` | Account deletion |
| `/privacy-policy`, `/terms`, `/accessibility-statement` | Legal |

Old paths (`/profile`, `/pricing`, `/payment-success`, …) redirect to `/` or `/account`.

### Conventions

- **API calls** go through `apiFetch` in `src/lib/apiClient.js` (or plain `fetch`, which `installAuthFetch.js` patches).
- **Text** comes from `LanguageContext.jsx` via `t()`. Hebrew is RTL. Every change must work in both languages.
- **Styling** is Tailwind plus the shared class helpers in `src/components/brand/ui.js`.

---

## Auth flow

Sign-in runs on the server against the Clients DB's Supabase Auth. Clients never hold Supabase keys.

**Email and password (website and app).** `POST /api/auth/login` returns a Supabase session. The website stores it in `localStorage` under `bc_auth_session`. The app stores it on the device. Both send `Authorization: Bearer <access_token>`. `POST /api/auth/refresh` refreshes it. `GET /api/auth/me` returns the user.

**Google on the website.** `GET /api/auth/google` redirects to Google through Supabase, which returns to `{FRONTEND_URL}/auth/callback#access_token=…`. `AuthCallbackPage` / `OAuthHashHandler` save the session and create the `clients` row if missing.

**Google in the app.** `POST /api/auth/oauth/google/start` returns the OAuth URL. Supabase redirects to `/api/auth/oauth/mobile-callback`, which exchanges the code and deep-links to `betterchoicemobile://auth/callback#access_token=…`. The app then calls `POST /api/auth/oauth/google/finalize`. Every host that serves the mobile callback must be in the Supabase Auth redirect allow-list.

**Apple in the app.** The app sends Apple's identity token to `/api/auth/oauth/apple/verify` (existing account) or `/api/auth/oauth/apple/exchange` (new account). The server signs in with `signInWithIdToken`.

**Password reset.** `POST /api/auth/reset-password`. Mobile users land on `/api/auth/recovery/mobile-callback`, which deep-links to `betterchoicemobile://reset-password?…`.

### `apiAuthGuard`

[server/middleware/auth.js](server/middleware/auth.js) defines it. It runs on every request after the session routes:

1. Non-`/api/` paths and `OPTIONS` pass.
2. Paths in `PUBLIC_API_PREFIXES` pass with no token: login, signup, check-email/phone/user-code, OAuth callbacks and exchanges, reset/recovery, `/api/webhooks/`, `/api/exchange-rates`, `/api/waiting-list/`, `/api/contact`, `/api/ingredient-reports`, the macro SVG endpoints, `/api/db/registration-links`, `/api/onboarding/classify-activity`, `/health`.
3. Paths in `PROTECTED_API_PREFIXES` run `requireAuth`: `/api/user/`, `/api/profile/`, `/api/onboarding/`, `/api/food-logs`, `/api/meal-plan*`, `/api/stripe/*` (most), `/api/auth/me`, and others.
4. Anything else passes the guard. Those routes must add `requireAuth` themselves.

`requireAuth` verifies the token with Supabase and sets `req.userId`, `req.authUser`, `req.clientRecord` and `req.userCode`. Helpers `assertOwnUserCode`, `assertSelfUserId`, `verifyFoodLogOwnership` and `verifyCalendarEventOwnership` check that a request only touches the caller's data.

---

## Clients API (`server/`)

### Layout

```
server/
  server.js              Entry: middlewares → billing (raw-body webhook) → JSON parser →
                         session routes → apiAuthGuard → modules → 404 / error handler;
                         starts the free-month sweep
  config/                db.js (clientDB, supabaseAuth, adminDB), env.js (PORT, mobile redirect), stripe.js
  middleware/auth.js     Auth factory: requireAuth, ownership helpers, apiAuthGuard
  middlewares/           auth.js (wired instance, import from here), security.js (headers, CORS, logger)
  routes/authSession.js  Session and OAuth routes (/api/auth/me, refresh, google, callbacks, recovery)
  modules/<name>/        <name>.routes.js (thin) + <name>.controller.js (+ .service.js for onboarding)
  services/              ai, stripe (webhook), company-offer, membership-pricing, paywall-flow,
                         svg (macro summary images), whatsapp
  utils/                 constants (Stripe IDs, external URLs, LLM schemas), helpers, meal structure
  sql/                   Table and column scripts to apply by hand in Supabase
  scripts/               Admin scripts (create-company-offer, Stripe test-clock e2e)
  tests/                 node:test unit tests
```

### Modules

All routes mount under `/api`.

| Module | Representative endpoints |
|---|---|
| Session (`routes/authSession.js`) | `GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/google`, `GET /auth/oauth/callback`, `GET /auth/oauth/mobile-callback`, `POST /auth/oauth/exchange`, `POST /auth/reset-password`, `POST /auth/update-password` |
| `auth` | `POST /auth/signup`, `/auth/login`, `/auth/create-client`, `/auth/check-email`, `/auth/oauth/apple/verify`, `/auth/oauth/google/start`, `GET/PUT /auth/client/:userId`, `DELETE /auth/account` |
| `onboarding` | `POST /onboarding/draft`, `/save-step`, `/commit`, `/init-commerce`, `/validate-promo`, `/apply-bypass-promo`, `/grant-free-month`, `/redeem-access-code`, `GET /onboarding/status`, `/paywall-flow` |
| `profile` | `GET/POST /user/settings`, `/onboarding/update-client`, `/onboarding/start-async-meal-plan`, `/onboarding/auto-generate-meals`, `GET /profile/load`, `/profile/meal-plan`, `/profile/chat-user/me`, `POST /profile/save-*`, `/profile/upload-image`, `GET /cities/search` |
| `food` | `GET/POST/PUT/DELETE /food-logs`, `POST /food-logs/analyze-image`, `/food-logs/analyze-text`, `GET /foods/search` |
| `tracking` | `/calendar-events`, `/daily-xp/today`, `/daily-xp/weekly`, `/weight-logs`, `POST /health/ingest`, `GET /health/summary` |
| `coaching` | `/chat-messages`, `/messages`, `/meal-plan`, `/meal-plan-history`, `/training-plan`, `/companies`, `/assign-client-company` |
| `billing` | `POST /webhooks/stripe`, `/stripe/create-checkout-session`, `/stripe/create-portal-session`, `GET /stripe/my-subscription`, `/stripe/membership-prices`, `POST /stripe/cancel-my-subscription`, `/subscription/validate-access-code`, `GET /exchange-rates` |
| `marketing` | `POST /landing/validate`, `/db/registration-links/find`, `/waiting-list/*`, `/contact`, `GET /macro-summary-svg`, `/weekly-macro-summary-svg`, `POST /whatsapp/send-welcome` |

`GET /health` sits outside `/api`.

---

## Key flows

**Company campaign landing pages.** A company manager shares a link like `betterchoice.one/landing#d=<base64>`. The hash holds a `link_id` and/or `manager_id`. `LandingPage.jsx` decodes it and calls `POST /api/landing/validate`, which reads `registration_rules` (slots, expiry) and the manager's `profiles` row with its `companies.config` (Chat DB). The config picks a layout from `src/company/templates/` (`centered`, `split`, `tactical`) through `getTemplate()`, plus colors and content. `saveOnboardingCompanyContext` carries the company into signup. `src/company/getCompanyConfig.js` is a legacy fallback that returns safe defaults; the real config comes from the database. Signups without a link are put under the BetterChoice company (`BETTERCHOICE_COMPANY_ID` in `utils/constants.js`).

**Onboarding (draft and commit).** Onboarding runs in the mobile app against `/api/onboarding/*`. `draft` and `save-step` autosave answers to `chat_users.onboarding_data` (Chat DB) after each step, so a user can resume. `commit` validates the answers, makes sure a `clients` row and a `chat_users` row exist, and writes profile and nutrition fields to both. `GET /onboarding/status` returns the phase, subscription state and paywall data the app needs.

**Promo and access codes.** Company promo codes live in `companies.config.pricing` (`validate-promo`, `apply-bypass-promo`). Generic access codes live in `onboarding_access_codes` (Chat DB) and are redeemed with `redeem-access-code`, which grants access without payment.

**Free month.** `paywall_settings.active_flow` (Clients DB, see `sql/paywall_flows.sql`) switches normal signups between `free_month` (no card) and `card_trial` (card at checkout, short Stripe trial). Company-link users always get `card_trial` with their company's pricing. `grant-free-month` claims the month once per user, writes the entitlement to `clients` and `chat_users`, finishes onboarding and sends the WhatsApp welcome. The sweep in `server.js` (`expireFreeMonths`, every 15 minutes) ends free months that have passed; `/onboarding/status` also ends them on the spot.

**Meal-plan generation.** `POST /onboarding/start-async-meal-plan` returns `{ queued: true }` at once, then builds the plan in the background (`services/ai.service.js` → the meal-plan builder service on Cloud Run → `meal_plans_and_schemas` and `client_meal_plans`). Onboarding commit, access-code redemption, a bypass promo and a paid subscription start the same job. If it fails, the error is only logged. [to be confirmed: how clients wait for the plan]

**Stripe.**
- Checkout: `POST /stripe/create-checkout-session` builds a subscription checkout from `membership_pricing` or the user's company offer (`services/company-offer.js`). The app passes `returnToApp` to get `betterchoicemobile://onboarding?checkout=…` return URLs.
- Portal: `POST /stripe/create-portal-session` opens the Stripe customer portal.
- Webhook: `POST /api/webhooks/stripe` is mounted before `express.json()` so the raw body can be verified with `STRIPE_WEBHOOK_SECRET`. `services/stripe.service.js` handles `checkout.session.completed`, `customer.subscription.created|updated|deleted` and `invoice.payment_succeeded|failed`. It updates `stripe_subscriptions` and `stripe_payments`, mirrors subscription status to `clients` and `chat_users`, finishes onboarding and sends the WhatsApp welcome.
- Usage billing by active days runs in BetterApp's `backendapi`, which reads the offer rule copied onto the subscription metadata.

**WhatsApp.** `services/whatsapp.service.js` sends the welcome template (`welcome_message_paid_clients`, Hebrew variant `…_hebrew`) through the WhatsApp Cloud API after payment or a free month. Conversations with the coach run in BetterApp's AI backend, not here.

**AI.** `services/ai.service.js` and the profile controller call OpenAI-compatible endpoints over HTTP:

| Use | Provider / env |
|---|---|
| Food photo analysis (vision), macro lookup, plan match, text meal analysis | `DEEPSEEK_*` endpoint |
| Meal-plan edit by request (`/profile/meal-plan/ai-update`) | Azure OpenAI (`AZURE_OPENAI_*`) |
| Activity classification, onboarding meal suggestions | `CLASSIFY_ACTIVITY_*` (default model `gpt-4o-mini`) |
| Full meal-plan generation | Meal-plan builder service (`CREATE_MEAL_PLAN_API_URL` in `utils/constants.js`) |

**Account deletion.** `DELETE /api/auth/account` cancels Stripe billing, deletes the user's rows in both projects and removes the auth user.

---

## Deployment

The API runs on Cloud Run (`newclientsweb`, `me-west1`) from the root [Dockerfile](Dockerfile). The website is a static build in a Google Cloud Storage bucket. There is no CI. See [README.md](README.md#deploying).

---

## Where to put new code

| You are adding… | Put it in |
|---|---|
| A website page | `src/pages/<Name>Page.jsx` + a route in `src/App.js` |
| Website text | `src/context/LanguageContext.jsx`, both `hebrew` and `english` |
| A website call to the API | `apiFetch` from `src/lib/apiClient.js` |
| A company landing layout | `src/company/templates/<Name>Layout.js` + register it in `templates/index.js` |
| An API endpoint | `server/modules/<module>/<module>.routes.js` (thin) → `<module>.controller.js`; logic shared across modules in `server/services/` |
| A new protected path prefix | `PROTECTED_API_PREFIXES` in `server/middleware/auth.js`, and `requireAuth` on the route |
| A public endpoint | `PUBLIC_API_PREFIXES`, only after review |
| Pure logic | `server/services/` or `server/utils/` + a test in `server/tests/` |
| A table or column | `server/sql/<name>.sql`, applied by hand in the right Supabase project before deploy |
| A new API env var | the Cloud Run service, and tell the team; document it in [README.md](README.md#environment-variables) |
