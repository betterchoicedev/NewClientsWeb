-- Run once on the CHAT DB (Supabase project ikkoplkcekzstlnsohby).
-- Additive only: two new tables, nothing existing is changed.

-- Plans a dietitian can pick for their clients. Admin-defined; dietitians choose, never type prices.
create table if not exists public.pricing_presets (
  id text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  name_en text not null,
  name_he text not null,
  monthly_dollars numeric not null check (monthly_dollars > 0),
  yearly_dollars numeric not null check (yearly_dollars > 0),
  -- Filled by the Clients API the first time the preset is used (Stripe Price is created then).
  monthly_price_id text,
  yearly_price_id text,
  trial_type text not null check (trial_type in ('free_month', 'card_trial', 'none')),
  trial_days integer not null default 0 check (trial_days between 0 and 60),
  sort integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-dietitian overrides. Anything left null falls back to the dietitian's company, then to BetterChoice defaults.
create table if not exists public.dietitian_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  invite_code text unique check (invite_code ~ '^[A-Z0-9-]{3,20}$'),
  display_name text,
  title text,
  photo_url text,
  welcome_message text check (char_length(welcome_message) <= 1000),
  pricing_preset_id text references public.pricing_presets(id),
  custom_steps jsonb not null default '[]'::jsonb check (jsonb_typeof(custom_steps) = 'array'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only the servers (service role) touch these tables.
alter table public.pricing_presets enable row level security;
alter table public.dietitian_settings enable row level security;

insert into public.pricing_presets
  (id, name_en, name_he, monthly_dollars, yearly_dollars, monthly_price_id, yearly_price_id, trial_type, trial_days, sort)
values
  ('standard', 'Standard', 'סטנדרט', 15, 144,
   'price_1UPHYJHIeYfvCylDx4nX2gVS', 'price_1UPHYKHIeYfvCylDuCeb8toE', 'free_month', 30, 10),
  ('standard_card_trial', 'Standard - card trial', 'סטנדרט - ניסיון עם כרטיס', 15, 144,
   'price_1UPHYJHIeYfvCylDx4nX2gVS', 'price_1UPHYKHIeYfvCylDuCeb8toE', 'card_trial', 3, 20),
  ('clinic_partner', 'Clinic Partner', 'שותף קליניקה', 12, 120, null, null, 'card_trial', 7, 30),
  ('coaching_plus', 'Coaching Plus', 'ליווי פלוס', 25, 240, null, null, 'card_trial', 14, 40)
on conflict (id) do nothing;

comment on table public.pricing_presets is 'Admin-defined plans dietitians choose from. Stripe price ids are created lazily by the Clients API.';
comment on table public.dietitian_settings is 'Per-dietitian invite code, landing info, plan preset and extra onboarding questions. Null = inherit from company.';

select id, monthly_dollars, yearly_dollars, trial_type, trial_days from public.pricing_presets order by sort;
