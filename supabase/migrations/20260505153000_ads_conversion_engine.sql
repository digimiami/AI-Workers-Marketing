begin;

-- Landing pages may store extra structured metadata (variant ids, worker refs).
alter table public.landing_pages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.bridge_pages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Canonical landing variants table (separate from funnel-step landing_pages snapshots).
create table if not exists public.landing_page_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  funnel_id uuid references public.funnels(id) on delete set null,
  funnel_step_id uuid references public.funnel_steps(id) on delete set null,
  variant_key text not null,
  angle text,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, campaign_id, variant_key)
);

create index if not exists landing_page_variants_org_campaign_idx
  on public.landing_page_variants (organization_id, campaign_id, created_at desc);

create index if not exists landing_page_variants_step_idx
  on public.landing_page_variants (funnel_step_id);

-- Paid ads hierarchy + performance snapshots + provider tokens (encrypted JSON blobs at app layer).
create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  platform text not null, -- google | meta | tiktok
  provider_campaign_id text,
  name text not null,
  objective text,
  status text not null default 'draft',
  daily_budget numeric,
  destination_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_campaigns_org_campaign_idx
  on public.ad_campaigns (organization_id, campaign_id, created_at desc);

create table if not exists public.ad_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ad_campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  provider_ad_set_id text,
  name text not null,
  budget numeric,
  audience jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_sets_campaign_idx
  on public.ad_sets (ad_campaign_id, created_at desc);

create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ad_campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  ad_set_id uuid references public.ad_sets(id) on delete set null,
  provider_ad_id text,
  headline text,
  primary_text text,
  description text,
  cta text,
  creative_url text,
  destination_url text,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ads_campaign_idx
  on public.ads (ad_campaign_id, created_at desc);

create index if not exists ads_set_idx
  on public.ads (ad_set_id, created_at desc);

create table if not exists public.ad_performance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  platform text not null,
  ad_id uuid references public.ads(id) on delete set null,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  spend numeric not null default 0,
  leads bigint not null default 0,
  conversions bigint not null default 0,
  cpc numeric,
  cpl numeric,
  ctr numeric,
  metadata jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create index if not exists ad_performance_events_org_campaign_idx
  on public.ad_performance_events (organization_id, campaign_id, captured_at desc);

create index if not exists ad_performance_events_ad_idx
  on public.ad_performance_events (ad_id, captured_at desc);

create table if not exists public.ad_provider_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  status text not null default 'disconnected',
  account_id text,
  account_name text,
  encrypted_tokens jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create index if not exists ad_provider_connections_org_idx
  on public.ad_provider_connections (organization_id, created_at desc);

-- RLS (match existing org-scoped patterns)
alter table public.landing_page_variants enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_sets enable row level security;
alter table public.ads enable row level security;
alter table public.ad_performance_events enable row level security;
alter table public.ad_provider_connections enable row level security;

drop policy if exists landing_page_variants_select_member on public.landing_page_variants;
create policy landing_page_variants_select_member on public.landing_page_variants
  for select using (public.is_org_member(organization_id));
drop policy if exists landing_page_variants_mutate_operator on public.landing_page_variants;
create policy landing_page_variants_mutate_operator on public.landing_page_variants
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists ad_campaigns_select_member on public.ad_campaigns;
create policy ad_campaigns_select_member on public.ad_campaigns
  for select using (public.is_org_member(organization_id));
drop policy if exists ad_campaigns_mutate_operator on public.ad_campaigns;
create policy ad_campaigns_mutate_operator on public.ad_campaigns
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists ad_sets_select_member on public.ad_sets;
create policy ad_sets_select_member on public.ad_sets
  for select using (public.is_org_member(organization_id));
drop policy if exists ad_sets_mutate_operator on public.ad_sets;
create policy ad_sets_mutate_operator on public.ad_sets
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists ads_select_member on public.ads;
create policy ads_select_member on public.ads
  for select using (public.is_org_member(organization_id));
drop policy if exists ads_mutate_operator on public.ads;
create policy ads_mutate_operator on public.ads
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists ad_performance_events_select_member on public.ad_performance_events;
create policy ad_performance_events_select_member on public.ad_performance_events
  for select using (public.is_org_member(organization_id));
drop policy if exists ad_performance_events_mutate_operator on public.ad_performance_events;
create policy ad_performance_events_mutate_operator on public.ad_performance_events
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists ad_provider_connections_select_member on public.ad_provider_connections;
create policy ad_provider_connections_select_member on public.ad_provider_connections
  for select using (public.is_org_member(organization_id));
drop policy if exists ad_provider_connections_mutate_operator on public.ad_provider_connections;
create policy ad_provider_connections_mutate_operator on public.ad_provider_connections
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

commit;
