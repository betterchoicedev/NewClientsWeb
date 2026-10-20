# CLAUDE.md

Guidance for AI coding agents in this repo. Human docs: [README.md](README.md) (setup, deploy, gotchas) and [ARCHITECTURE.md](ARCHITECTURE.md) (structure and flows). Read ARCHITECTURE.md before making structural changes.

## What this is

- **Clients website** (betterchoice.one): Create React App, React 19, plain JSX, Tailwind, in `src/` and `public/`. Hosted as a static build in a Google Cloud Storage bucket; `public/_redirects` and `public/_headers` are ignored there.
- **Clients API**: Node/Express in `server/`, entry `server/server.js`, deployed to Cloud Run as `newclientsweb`. The website **and** the BetterApp mobile app call it.
- **Databases**: two Supabase projects. **Clients DB** = `clientDB` (auth, `clients`, billing). **Chat DB** = `adminDB` (`chat_users`, food logs, meal plans, companies). See [ARCHITECTURE.md](ARCHITECTURE.md#databases).

## Commands

```bash
npm run dev                    # website (localhost:3000), calls the PRODUCTION API
npm start                      # the API (node server/server.js, port 8080), NOT the website
npm run build                  # website build into build/
node --test server/tests/      # API tests (offline fakes)
```

The dev machine is Windows. There is no lint script and no CI.

## Rules

- **Everything is production.** There is no staging. The website's API URL is hard-coded to production in `src/lib/apiClient.js`, and a local API uses the production databases, Stripe and WhatsApp. Never run requests or scripts that write data unless the user asked for that exact write. Don't change `getApiUrl()` in a commit.
- **Test every change.** For API logic, add or update a `node:test` file in `server/tests/` with in-memory fakes (see `paywallFlow.test.js`), never real clients. Run `node --test server/tests/` and report pass/fail with output. For website changes, say what you checked by hand.
- **Backward compatibility.** Old mobile app versions call this API for weeks. Never remove or rename an endpoint, request field or response field the app may read. Add new fields instead.
- **No secrets in the frontend.** `REACT_APP_*` variables referenced in `src/` are baked into the public bundle. Never reference a key, token or service-role value from `src/`. The browser never talks to Supabase or Stripe secrets directly.
- **New routes sit behind auth.** Add `requireAuth` to the route and its prefix to `PROTECTED_API_PREFIXES` in `server/middleware/auth.js`. A public route needs a deliberate reason and an entry in `PUBLIC_API_PREFIXES`. Check that the caller owns the data (`req.userId`, `req.userCode`, the ownership helpers), never an id from the body or query.
- **Import auth from `server/middlewares/auth`**, not `server/middleware/auth` (that is the factory).
- **Routes stay thin.** `<module>.routes.js` maps paths; logic goes in the controller, or in `server/services/` when shared.
- **Use the right database.** `clientDB` for the Clients DB, `adminDB` for the Chat DB. Writes that touch both must be ordered and safe to retry.
- **Schema changes** go in `server/sql/<name>.sql`. Tell the user which project to apply it to and that it must be applied before deploy.
- **New API env var**: tell the user it must be set on the Cloud Run service, and add its name to README.md.
- **Text in Hebrew and English.** Website strings go in `src/context/LanguageContext.jsx` (`t()`), with both `hebrew` and `english`. Hebrew is RTL. Keep both working when you touch copy or layout.
- **Don't edit `server_old/`** (dead copy) or `server/node_modules/` (committed; the API resolves Express and Stripe from it).
- **Never commit** `.env` or anything `.gitignore` excludes. Never print secret values.
- **Don't deploy.** Deploys are manual and owned by the team.
