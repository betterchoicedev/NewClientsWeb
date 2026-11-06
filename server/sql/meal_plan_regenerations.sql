-- Chat DB (adminDB). "Not happy with your meal plan? Tell us what to change."
-- One row per client request for a new AI meal plan (max 3 that are not 'failed').
-- Written only by the Clients API (service role): POST /api/meal-plan/regenerate.
-- Already applied in production on 2026-10-30; kept here for the record.

create table if not exists public.meal_plan_regenerations (
  id          uuid primary key default gen_random_uuid(),
  user_code   text not null,
  notes       text not null check (char_length(notes) between 1 and 1000),
  status      text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  error       text,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists meal_plan_regenerations_user_code_idx
  on public.meal_plan_regenerations (user_code, created_at desc);

-- No policies: only the service role reads and writes it.
alter table public.meal_plan_regenerations enable row level security;

-- One request at a time per client (the API answers 409 in_progress on a second one).
create unique index if not exists meal_plan_regenerations_one_pending_idx
  on public.meal_plan_regenerations (user_code) where status = 'pending';
