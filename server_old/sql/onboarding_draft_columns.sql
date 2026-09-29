-- Run on the MAIN Supabase project (clients table).
-- Required for POST /api/onboarding/draft and commit phase tracking.

alter table clients
  add column if not exists onboarding_draft jsonb default null,
  add column if not exists onboarding_phase text default null;

comment on column clients.onboarding_draft is 'In-progress onboarding answers JSON (Zustand draft sync)';
comment on column clients.onboarding_phase is 'welcome | questions | committing | payment | pwa | done';
