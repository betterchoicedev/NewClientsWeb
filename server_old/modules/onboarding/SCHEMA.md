# Onboarding persistence schema

## Main Supabase (`clients`)

Apply [`../../sql/onboarding_draft_columns.sql`](../../sql/onboarding_draft_columns.sql):

| Column | Type | Purpose |
|--------|------|---------|
| `onboarding_draft` | `jsonb` | Autosaved draft from the SPA |
| `onboarding_phase` | `text` | `welcome` \| `questions` \| `committing` \| `payment` \| `pwa` \| `done` |

Existing columns used by commit/status: `user_code`, `onboarding_completed`, `subscription_status`, `subscription_type`, `subscription_expires_at`, profile fields.

## Chat Supabase (`chat_users`)

No new columns. Commit dual-writes meal/profile fields; subscription fields updated by Stripe webhook or `redeem-access-code`.

## Dual-write note

`clientDB` and `adminDB` are separate projects. Commit uses an ordered compensating write, not a single Postgres transaction.
