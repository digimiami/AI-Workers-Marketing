begin;

do $$ begin
  create type public.plan_key as enum ('free','starter','pro','agency');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('inactive','trialing','active','past_due','canceled','unpaid');
exception when duplicate_object then null; end $$;

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  plan public.plan_key not null default 'free',
  subscription_status public.subscription_status not null default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create index if not exists org_subscriptions_stripe_customer_idx on public.organization_subscriptions(stripe_customer_id);
create index if not exists org_subscriptions_stripe_sub_idx on public.organization_subscriptions(stripe_subscription_id);

alter table public.organization_subscriptions enable row level security;

drop policy if exists org_subscriptions_select_member on public.organization_subscriptions;
create policy org_subscriptions_select_member on public.organization_subscriptions
  for select using (public.is_org_member(organization_id));

drop policy if exists org_subscriptions_mutate_operator on public.organization_subscriptions;
create policy org_subscriptions_mutate_operator on public.organization_subscriptions
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

commit;

