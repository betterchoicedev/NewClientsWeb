# Multi-Tenant Routing Decision (Subdomain vs Subdirectory)

## Goal
Keep signup as a single shared flow, and route each user into their company subdirectory **after login/signup**.
Current scope is routing only (no theme/UI customization yet), so each company can have:
- its own onboarding flow
- its own pricing page
- its own profile/dashboard experience
- optional custom behavior later

Example current link:
`https://betterchoice.one/signup#d=...`

## Existing Data Flow (Today)
From your current signup flow:
1. `#d` is decoded to get `manager_id` (or `link_id` -> `manager_id`).
2. `manager_id` is used as `providerId`.
3. Signup API creates/links user and writes provider association.

Business lookup needed for tenant:
1. `chat_users.provider_id`
2. `profiles.company_id` (by provider)
3. `companies.name` (or better: `slug`)

## Decision Summary
Use **subdirectory first** (recommended), and optionally add subdomain support later.
Keep **one shared `SignupPage`** for all companies.
For now, do **not** change colors/themes per company.

Recommended URL shape:
- `https://betterchoice.one/signup#d=...` (shared)
- `https://betterchoice.one/c/{companySlug}/onboarding`
- `https://betterchoice.one/c/{companySlug}/pricing`
- `https://betterchoice.one/c/{companySlug}/profile`

## Why Subdirectory Is Better for Your Current Stage
### Advantages
- Faster implementation with your current React Router setup.
- No DNS/wildcard cert/proxy complexity right now.
- Easier local development and QA.
- Single deploy pipeline and simpler incident handling.
- Invite links can include company context immediately.

### Tradeoffs
- Slightly weaker brand separation vs true subdomains.
- Cookie/session isolation is shared by default (usually fine for B2B tenant UX).

## When Subdomain Becomes Better
Move to subdomain (`{company}.betterchoice.one`) when you need one or more:
- stronger brand separation per company
- separate auth/session boundaries
- company-specific integrations/cookies/security policies
- region/infrastructure isolation later

## Recommended Architecture
## 1) Add Tenant Slug
In `companies` table, add:
- `slug` (unique, URL-safe, immutable after set)
- optional `onboarding_config` JSON (later)
- optional `pricing_config` JSON (later)

Do not use `name` directly in URL; use `slug`.

## 2) Resolve Tenant in Two Ways
### A. Signup resolution (shared signup route)
On `SignupPage`, decode `#d` and resolve provider/company in backend:
- `manager_id` (or invite `link_id` -> `manager_id`)
- provider profile -> `company_id`
- company row -> `slug`

Persist tenant context after successful signup/login:
- in JWT/session metadata, or
- in `clients/chat_users` + fetched on app bootstrap

Then redirect to tenant area:
- `/c/{companySlug}/onboarding` (or `/c/{companySlug}/profile` based on your flow)

### B. URL tenant routes (post-signup pages)
Tenant-aware routes are used for app pages after signup:
- `/c/:companySlug/onboarding`
- `/c/:companySlug/pricing`
- `/c/:companySlug/profile`

## 3) Validate Invite vs Route Tenant
When invite exists, backend must verify:
- invite `manager_id` belongs to a real provider/company
- if user reaches a tenant route, route `companySlug` must match resolved company
- if mismatch -> reject with "Invalid tenant context"

This prevents cross-company link misuse.

## 4) Tenant Resolution Endpoint (Routing Scope)
Add backend endpoint:
- `GET /api/tenant/by-provider/:providerId`
or
- `GET /api/tenant/by-user/:userId`

Returns minimal routing data:
- `company_id`
- `company_slug`

Frontend uses this only to redirect to the correct `/c/{slug}/...` path.

## 5) Frontend Route Strategy
Add parallel tenant-aware routes while preserving old routes:
- `/signup` (shared, canonical)
- `/c/:companySlug/onboarding`
- `/c/:companySlug/pricing`
- `/c/:companySlug/profile`

Migration rule:
- invite links continue using shared signup.
- tenant routing starts only after provider/company is known.

## Data Query Example (Backend)
Given `manager_id`:

```sql
select c.id, c.slug, c.name
from profiles p
join companies c on c.id = p.company_id
where p.id = :manager_id
limit 1;
```

If you must start from `chat_users.provider_id`, same target:
- `provider_id` -> provider profile -> `company_id` -> company row

## Link Format Recommendation
Keep signup links shared:
- `https://betterchoice.one/signup#d=...`

And consider extending encoded payload to include:
- `company_slug`
- `company_id`
- signed token fields (HMAC/JWT) to prevent tampering

Backend should still verify all fields server-side.

## Rollout Plan (Safe)
### Phase 1 - Foundation
- add `companies.slug`
- add tenant resolution endpoint
- add tenant routes in frontend

### Phase 2 - Signup Resolution
- on `/signup#d=...`, resolve provider -> company and store tenant context
- after signup/login redirect to `/c/{slug}/onboarding`
- add strict backend validation for invite-company consistency

### Phase 3 - Tenant UX
- switch onboarding/pricing behavior per tenant when needed
- keep shared components, branch only where needed

### Phase 4 - Optional Subdomain
- support `{slug}.betterchoice.one` at edge/proxy level
- internally rewrite to `/c/{slug}` so frontend/backend logic stays the same

## Practical Recommendation for Your Boss
1. Keep **one signup page** for everyone (`/signup`).
2. Resolve provider company during signup from invite/provider data.
3. After signup/login, route user into tenant area (`/c/{slug}/...`).
4. For now, keep the same theme/colors for all companies.
5. Add subdomain later only if business/branding/security requires it.

This gives the fastest delivery with low risk, while keeping a clean path to subdomains in the future.
