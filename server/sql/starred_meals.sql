-- Chat DB (adminDB, project ikkoplkcekzstlnsohby). Starred meals: a client's saved meals
-- they can log again in one tap from the camera screen (BetterChoice app).
-- Written only by the Clients API (service role):
--   GET/POST /api/starred-meals, DELETE /api/starred-meals/:id, POST /api/starred-meals/:id/log
-- NOT applied yet. Apply before deploying the server that serves these routes.

create table if not exists public.starred_meals (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.chat_users(id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 120),
  -- Same shape as food_logs.food_items: [{ name, macros{calories,protein_g,carbs_g,fat_g},
  -- portion_estimate, water_ml?, confidence, visual_evidence }]
  items              jsonb not null check (jsonb_typeof(items) = 'array'
                                           and jsonb_array_length(items) between 1 and 30),
  -- Order-free "name|portion;..." key; the API returns the existing row instead of a duplicate.
  signature          text not null,
  source             text not null default 'text' check (source in ('photo', 'barcode', 'text', 'voice')),
  -- The diary entry it was starred from, when starred from the daily log.
  source_food_log_id uuid references public.food_logs(id) on delete set null,
  total_calories     integer not null default 0,
  total_protein_g    integer not null default 0,
  total_carbs_g      integer not null default 0,
  total_fat_g        integer not null default 0,
  total_water_ml     integer not null default 0,
  created_at         timestamptz not null default now(),
  last_used_at       timestamptz,
  use_count          integer not null default 0 check (use_count >= 0)
);

create unique index if not exists starred_meals_user_signature_idx
  on public.starred_meals (user_id, signature);

create index if not exists starred_meals_user_recent_idx
  on public.starred_meals (user_id, last_used_at desc nulls last, created_at desc);

-- No policies: only the service role reads and writes it (same as meal_plan_regenerations).
-- The app never talks to this table directly.
alter table public.starred_meals enable row level security;

comment on table public.starred_meals is
  'Client starred meals for one-tap re-logging (max 50 per client, enforced by the Clients API).';
