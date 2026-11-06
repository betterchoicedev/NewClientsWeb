# BetterChoice Clients Web + Clients API

This repo holds two things:

| Folder | What | Stack |
|---|---|---|
| repo root (`src/`, `public/`) | The clients website, [betterchoice.one](https://betterchoice.one): marketing home, signup/login, company campaign landing pages, account and billing, legal pages | Create React App (React 19), plain JSX, Tailwind |
| `server/` | The **Clients API**: the main Node API for this website **and** the BetterApp mobile app (sign-in/OAuth, profile, onboarding, food logs, meal plans, billing and the Stripe webhook, coaching, tracking) | Node, Express, Supabase, Stripe |

It is one of several BetterChoice systems. Start with the hub doc: [BetterApp ONBOARDING.md](https://github.com/betterchoicedev/BetterApp/blob/main/ONBOARDING.md).

More docs:

- [ARCHITECTURE.md](ARCHITECTURE.md): how the code is organized and how requests flow
- [CLAUDE.md](CLAUDE.md): rules for AI coding agents working in this repo
- [server/README.md](server/README.md): older Stripe setup notes (partly outdated: it mentions `index.js` and port 3001)
- [server/modules/onboarding/SCHEMA.md](server/modules/onboarding/SCHEMA.md): onboarding persistence notes
- [md/MULTI_TENANT_ROUTING_DECISION.md](md/MULTI_TENANT_ROUTING_DECISION.md): company routing decision
- [md/onboarding-progress-and-payment-code-requirements.md](md/onboarding-progress-and-payment-code-requirements.md): onboarding and access-code requirements

---

## There is no staging. Everything is production.

There is **no staging environment**. Local development uses the same Supabase projects, Stripe account and WhatsApp number as live users.

- **The website always calls the production API.** The base URL is hard-coded in [src/lib/apiClient.js](src/lib/apiClient.js) (`getApiUrl()`). `npm run dev` on your laptop still talks to the live Clients API. `package.json` also proxies to production (`"proxy"`).
- **A local API uses production databases.** `npm start` with the shared `.env` reads and writes live user data.
- **A local API runs live background work.** The free-month expiry sweep starts with the process (see [Gotchas](#gotchas)).

Safe-practice rules:

1. Use your own test account. Never sign in as, edit or delete a real user.
2. Don't run write requests (signup, onboarding commit, checkout, delete account, food-log writes) unless you mean to change production.
3. Never run scripts in `server/scripts/` without `--dry-run` first, and only with sign-off from the team.
4. Use Stripe test cards only where the team has said the flow is in test mode. Otherwise assume charges are real. [to be confirmed: which Stripe mode each key uses]
5. Don't set `NODE_ENV=development` on a local API: it turns on a dev-only endpoint (`/api/onboarding/opt-out`) that edits production data.
6. If you point the website at a local API by editing `getApiUrl()`, never commit that change.
7. When in doubt, ask before you hit an endpoint that writes.

---

## Prerequisites

| Tool | Version | Used for |
|---|---|---|
| Node.js | 18 (same as the Docker image) or 20 | website and API |
| npm | comes with Node | installing packages (the repo has a `package-lock.json`) |
| gcloud CLI | latest | deploying the API (team members with access only) |

Also ask the team for:

- the root `.env` values
- access to the two Supabase projects (read-only to start)
- Google Cloud viewer access, if you need to read the API logs

---

## Install

```bash
git clone https://github.com/betterchoicedev/NewClientsWeb.git
cd NewClientsWeb
npm install
# then create .env in the repo root with the values the team gives you
```

One `npm install` at the root covers both the website and the API. Don't run `npm install` inside `server/` (see [Gotchas](#gotchas)).

---

## Environment variables

One `.env` in the repo root is read by both the website build and the API (`require('dotenv').config()`). Never commit it. `.gitignore` excludes it.

### Website (`REACT_APP_*`)

CRA bakes every `REACT_APP_*` variable that the frontend code references **into the public JS bundle**. Never reference a secret from `src/`.

| Variable | Purpose |
|---|---|
| `REACT_APP_API_URL` | Read only by `LandingPage.jsx` and `SignupPage.jsx`. `apiClient.js` ignores it (commented out) |
| `REACT_APP_STRIPE_*`, `REACT_APP_TRANSLATE_API_URL`, `REACT_APP_SUPABASE_SECONDARY_*` | Present in `.env` but not read by current code [to be confirmed: safe to remove] |

### API (`server/`)

Some API variables carry a `REACT_APP_` prefix for historical reasons. They are read **only by the server** today.

| Variable | Purpose |
|---|---|
| `REACT_APP_SUPABASE_URL` | Clients DB URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Clients DB anon key, used to verify user tokens and run sign-in |
| `SUPABASE_SERVICE_ROLE_KEY` | Clients DB service-role key (server only) |
| `REACT_APP_SUPABASE_STORAGE_BUCKET_NAME` | Profile picture bucket (default `profile-pictures`) |
| `CHAT_SUPABASE_URL`, `CHAT_SUPABASE_SERVICE_ROLE_KEY` | Chat DB URL and service-role key |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook signatures |
| `WA_TOKEN` (or `WHATSAPP_TOKEN`) | WhatsApp Cloud API token for welcome templates |
| `DEEPSEEK_ENDPOINT`, `DEEPSEEK_API_KEY`, `DEEPSEEK_DEPLOYMENT`, `DEEPSEEK_TEXT_DEPLOYMENT` | Food photo and text analysis LLM |
| `AZURE_OPENAI_API_BASE`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT` | AI meal-plan edits |
| `CLASSIFY_ACTIVITY_BASE`, `CLASSIFY_ACTIVITY_KEY`, `CLASSIFY_ACTIVITY_DEPLOYMENT`, `OPENAI_API_KEY` | Activity classification and onboarding meal suggestions |
| `FRONTEND_URL` (or `REACT_APP_FRONTEND_URL`) | Website origin for OAuth redirects (default `http://localhost:3000`) |
| `API_PUBLIC_URL` | Public API origin, if it can't be read from the request |
| `MOBILE_OAUTH_REDIRECT`, `MOBILE_RESET_REDIRECT` | Mobile deep links (defaults `betterchoicemobile://auth/callback`, `betterchoicemobile://reset-password`) |
| `PORT` | Listen port (default `8080`) |
| `NODE_ENV` | `test` skips the free-month sweep. `development` enables dev-only endpoints |

The full set used in production lives on the Cloud Run service, not in `.env`. [to be confirmed: the complete Cloud Run variable list]

---

## Common commands

| Command | What it does |
|---|---|
| `npm run dev` | Website dev server (`react-scripts start`, http://localhost:3000). Calls the **production** API |
| `npm start` | **The API**, not the website (`node server/server.js`, port 8080) |
| `npm run build` | Production website build into `build/` |
| `node --test "server/tests/**/*.test.js"` | API unit tests (Node's built-in runner, offline fakes) |
| `curl http://localhost:8080/health` | API health check |

---

## Testing

- **API**: tests live in `server/tests/*.test.js` and use `node:test` with in-memory fakes for Supabase and Stripe. They don't touch production.

  ```bash
  node --test "server/tests/**/*.test.js"   # a bare folder fails on Windows with Node 24
  node --test server/tests/paywallFlow.test.js   # one file
  ```

- **Website**: there is no maintained test suite. `src/App.test.js` is CRA boilerplate and fails. Test UI changes by hand in Hebrew and English, light and dark, desktop and phone width.

Include test results in your PR description.

---

## Deploying

There is **no CI**. `.github/workflows/` is empty. Deploys are manual.

### API: Cloud Run

| | |
|---|---|
| Service | `newclientsweb` |
| Region | `me-west1` |
| GCP project number | `615263253386` (project ID `production-eu1`) |
| Image | root [Dockerfile](Dockerfile): `node:18-slim`, `npm install --only=production`, `node server/server.js` |
| URL | `https://newclientsweb-615263253386.me-west1.run.app` |

```bash
# from the repo root [to be confirmed: exact command and flags the team uses]
gcloud run deploy newclientsweb --source . --region me-west1
```

- `.dockerignore` excludes `src/`, `public/` and `build/`, so the image only holds the API.
- Env vars and secrets are set on the Cloud Run service. `.env` is not deployed.
- Check `GET /health` after the deploy.
- The mobile app calls this service. Old app versions stay in use for weeks, so every deploy must be backward compatible.

### Website: Google Cloud Storage

- `betterchoice.one` is a static build (`npm run build` → `build/`) served from a Google Cloud Storage bucket. The lead developer deploys it. You don't need deploy access.
- **[public/_redirects](public/_redirects) and [public/_headers](public/_headers) are Netlify files from an older host. The bucket ignores them.** Their redirects, security headers and `Cache-Control` rules do not apply in production. Response headers come from each object's metadata in the bucket.
- So after a deploy, browsers and the CDN may serve the old `index.html` for up to an hour, the bucket's default cache time for public objects. Keep this in mind when you test a release.

---

## Gotchas

- **`npm start` runs the API, not the website.** Use `npm run dev` for the website.
- **`server/package.json` is stale.** Its `start` script points to `index.js`, which doesn't exist. Run the API from the root.
- **`server/node_modules` is committed** (Express 4.21, Stripe SDK 13). Node resolves `server/` code against it first, locally and in the Docker image, so the API runs on those versions, not the root `package.json` ones (Express 5, Stripe 19). Packages not in that folder (`@supabase/supabase-js`, `openai`, `sharp`) come from the root. Don't add, update or delete files there without a plan.
- **`server/middleware/` vs `server/middlewares/`.** `middleware/auth.js` is the auth factory. `middlewares/auth.js` wires it to the DB clients, and `middlewares/security.js` holds headers, CORS and the request logger. Import auth from `middlewares/auth`.
- **`server_old/` is dead.** It is an old copy of the API. Don't edit or import it.
- **The root `.env` holds API settings too**, not only website ones.
- **The free-month sweep runs inside the API process.** Every 15 minutes, `server.js` ends no-card free months whose date has passed. A local `npm start` with the production `.env` does this against production. It is skipped only when `NODE_ENV=test`.
- **Service worker history.** An old service worker cached `index.html` cache-first, which left users on a blank page after deploys. Comments in `public/_headers` describe a server-side fix, but that file isn't applied in production (see [Deploying](#deploying)). [public/service-worker.js](public/service-worker.js) now fetches HTML network-first. If you change caching, bump `CACHE_NAME`. The worker only registers in production builds.
- **UI strings.** Most text lives in [src/context/LanguageContext.jsx](src/context/LanguageContext.jsx) (`t()`), in Hebrew and English. Some pages still inline `language === 'hebrew' ? … : …`.
- **The home page is `HomePage.jsx`.** `/` renders `src/pages/HomePage.jsx`. `HomePage.jsx` is not routed.
- **`server/web.config` and `server/iisnode.yml`** are leftovers from an older IIS host. [to be confirmed: safe to remove]

---

<div align="center">
  <i>Proprietary. © BetterChoice. All rights reserved.</i>
</div>
