-- Run once on the MAIN Supabase project (same database as clients / membership_pricing).
--
-- One switch for the payment step of normal signups (no company / invite link):
--   active_flow = 'free_month'  ->  free month, no credit card, app locks when it ends until they pay
--   active_flow = 'card_trial'  ->  today's flow: card at checkout, short Stripe trial, then auto-charge
--
-- Switch:  update public.paywall_settings set active_flow = 'card_trial' where id = 1;
--          update public.paywall_settings set active_flow = 'free_month' where id = 1;
-- Length:  update public.paywall_settings set free_month_days = 30 where id = 1;
--
-- Users who signed up through a company / invite link keep their company's pricing.
-- Users already in a free month keep it until it ends, whatever the switch says.

create table if not exists public.paywall_settings (
  id integer primary key default 1 check (id = 1),
  active_flow text not null default 'free_month' check (active_flow in ('free_month', 'card_trial')),
  free_month_days integer not null default 30 check (free_month_days between 1 and 365),
  updated_at timestamptz not null default now()
);

insert into public.paywall_settings (id, active_flow, free_month_days)
values (1, 'free_month', 30)
on conflict (id) do nothing;

alter table public.paywall_settings enable row level security;

-- Set when the user starts the free month. A user gets it only once.
alter table public.clients add column if not exists app_trial_started_at timestamptz;

create index if not exists clients_free_month_expiry_idx
  on public.clients (subscription_expires_at)
  where subscription_type = 'free_month' and subscription_status = 'trialing';

comment on table public.paywall_settings is 'Payment flow for normal signups: free_month (no card) or card_trial. Change active_flow to switch.';
