-- Run once on the MAIN Supabase project (same database as clients / stripe_subscriptions).
-- After this row exists, it is the price the app shows and the price new checkouts charge.
-- Change monthly_dollars to 20 for $20/month. Change yearly_dollars to 144 for $144/year.
-- People who already subscribed stay on the price they signed up with.

create table if not exists public.membership_pricing (
  id integer primary key default 1 check (id = 1),
  monthly_dollars numeric not null,
  yearly_dollars numeric not null,
  monthly_price_id text not null,
  yearly_price_id text not null,
  updated_at timestamptz not null default now()
);

insert into public.membership_pricing (
  id, monthly_dollars, yearly_dollars, monthly_price_id, yearly_price_id
) values (
  1,
  15,
  144,
  'price_1UKyzmHIeYfvCylDHxx1erob',
  'price_1UKyznHIeYfvCylDkwDqipAl'
)
on conflict (id) do nothing;

alter table public.membership_pricing enable row level security;

comment on table public.membership_pricing is 'Current BetterChoice membership prices. Edit monthly_dollars / yearly_dollars; the server creates a new Stripe Price when the amount changes.';
