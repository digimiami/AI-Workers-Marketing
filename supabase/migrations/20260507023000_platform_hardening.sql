begin;

-- Centralized logs for API/job/AI/ads failures and operational audit breadcrumbs.
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  level text not null default 'info', -- debug | info | warn | error
  category text not null default 'system', -- api | job | ai | ads | billing | security | automation
  message text not null,
  context jsonb not null default '{}'::jsonb,
  request_id text,
  duration_ms int,
  created_at timestamptz not null default now()
);

create index if not exists logs_org_created_idx on public.logs(organization_id, created_at desc);
create index if not exists logs_campaign_created_idx on public.logs(campaign_id, created_at desc);
create index if not exists logs_category_level_idx on public.logs(category, level, created_at desc);

-- AI usage + prompt cache for rate limiting and cost control.
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  plan text not null default 'free',
  provider text not null default 'unknown',
  model text,
  cache_hit boolean not null default false,
  prompt_hash text,
  input_tokens int,
  output_tokens int,
  estimated_cost_cents numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_org_user_created_idx on public.ai_usage(organization_id, user_id, created_at desc);
create index if not exists ai_usage_prompt_hash_idx on public.ai_usage(prompt_hash, created_at desc);

create table if not exists public.ai_cache (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  prompt_hash text not null,
  provider text not null default 'unknown',
  model text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, prompt_hash)
);

create index if not exists ai_cache_hash_idx on public.ai_cache(prompt_hash);
create index if not exists ai_cache_expires_idx on public.ai_cache(expires_at);

-- Referral growth loop.
create table if not exists public.referral_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  code text not null unique,
  destination_url text,
  reward_credits int not null default 0,
  clicks int not null default 0,
  signups int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists referral_links_org_idx on public.referral_links(organization_id, created_at desc);

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  referral_link_id uuid references public.referral_links(id) on delete set null,
  referred_user_id uuid references auth.users(id) on delete set null,
  event_type text not null, -- click | signup | conversion | credit_awarded
  credits_awarded int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists referral_events_link_idx on public.referral_events(referral_link_id, created_at desc);

-- Affiliate partner commissions over conversion events.
create table if not exists public.affiliate_partners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  code text not null unique,
  commission_rate numeric not null default 0.2,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  affiliate_partner_id uuid references public.affiliate_partners(id) on delete set null,
  conversion_id uuid references public.conversions(id) on delete set null,
  amount_cents int not null default 0,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists affiliate_partners_org_idx on public.affiliate_partners(organization_id, created_at desc);
create index if not exists affiliate_commissions_org_idx on public.affiliate_commissions(organization_id, created_at desc);

-- Add nullable user ownership columns for scale-oriented filtering where legacy schema omitted them.
alter table public.campaigns add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.funnels add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.funnel_steps add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.landing_pages add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.ads add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.leads add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.analytics_events add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.conversions add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Hot-path indexes.
create index if not exists campaigns_user_idx on public.campaigns(user_id) where user_id is not null;
create index if not exists campaigns_org_user_created_idx on public.campaigns(organization_id, user_id, created_at desc);
create index if not exists leads_user_idx on public.leads(user_id) where user_id is not null;
create index if not exists leads_campaign_created_idx on public.leads(campaign_id, created_at desc);
create index if not exists analytics_events_user_idx on public.analytics_events(user_id) where user_id is not null;
create index if not exists analytics_events_campaign_name_created_idx on public.analytics_events(campaign_id, event_name, created_at desc);
create index if not exists ads_user_idx on public.ads(user_id) where user_id is not null;
create index if not exists ads_campaign_created_idx on public.ads(ad_campaign_id, created_at desc);

-- RLS
alter table public.logs enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_cache enable row level security;
alter table public.referral_links enable row level security;
alter table public.referral_events enable row level security;
alter table public.affiliate_partners enable row level security;
alter table public.affiliate_commissions enable row level security;

drop policy if exists logs_select_member on public.logs;
create policy logs_select_member on public.logs for select using (organization_id is null or public.is_org_member(organization_id));
drop policy if exists logs_mutate_operator on public.logs;
create policy logs_mutate_operator on public.logs for all using (organization_id is null or public.is_org_operator(organization_id))
  with check (organization_id is null or public.is_org_operator(organization_id));

drop policy if exists ai_usage_select_member on public.ai_usage;
create policy ai_usage_select_member on public.ai_usage for select using (organization_id is null or public.is_org_member(organization_id));
drop policy if exists ai_usage_mutate_operator on public.ai_usage;
create policy ai_usage_mutate_operator on public.ai_usage for all using (organization_id is null or public.is_org_operator(organization_id))
  with check (organization_id is null or public.is_org_operator(organization_id));

drop policy if exists ai_cache_select_member on public.ai_cache;
create policy ai_cache_select_member on public.ai_cache for select using (organization_id is null or public.is_org_member(organization_id));
drop policy if exists ai_cache_mutate_operator on public.ai_cache;
create policy ai_cache_mutate_operator on public.ai_cache for all using (organization_id is null or public.is_org_operator(organization_id))
  with check (organization_id is null or public.is_org_operator(organization_id));

drop policy if exists referral_links_select_member on public.referral_links;
create policy referral_links_select_member on public.referral_links for select using (public.is_org_member(organization_id));
drop policy if exists referral_links_mutate_operator on public.referral_links;
create policy referral_links_mutate_operator on public.referral_links for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists referral_events_select_member on public.referral_events;
create policy referral_events_select_member on public.referral_events for select using (organization_id is null or public.is_org_member(organization_id));
drop policy if exists referral_events_mutate_operator on public.referral_events;
create policy referral_events_mutate_operator on public.referral_events for all using (organization_id is null or public.is_org_operator(organization_id))
  with check (organization_id is null or public.is_org_operator(organization_id));

drop policy if exists affiliate_partners_select_member on public.affiliate_partners;
create policy affiliate_partners_select_member on public.affiliate_partners for select using (public.is_org_member(organization_id));
drop policy if exists affiliate_partners_mutate_operator on public.affiliate_partners;
create policy affiliate_partners_mutate_operator on public.affiliate_partners for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists affiliate_commissions_select_member on public.affiliate_commissions;
create policy affiliate_commissions_select_member on public.affiliate_commissions for select using (public.is_org_member(organization_id));
drop policy if exists affiliate_commissions_mutate_operator on public.affiliate_commissions;
create policy affiliate_commissions_mutate_operator on public.affiliate_commissions for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

commit;

