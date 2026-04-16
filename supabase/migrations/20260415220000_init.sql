-- AiWorkers.vip — initial schema (Supabase/Postgres)
-- Apply via Supabase migrations. Designed for Vercel + Supabase.

begin;

-- Extensions
create extension if not exists pgcrypto;

-- Enums
do $$ begin
  create type public.app_role as enum ('admin','operator','viewer','client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_status as enum ('draft','active','paused','completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_type as enum ('affiliate','lead_gen','internal_test','client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.funnel_status as enum ('draft','active','paused','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_status as enum ('draft','approved','scheduled','published','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.approval_status as enum ('pending','approved','rejected','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.agent_status as enum ('enabled','disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.agent_run_status as enum ('queued','running','succeeded','failed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.email_log_status as enum ('queued','sent','failed');
exception when duplicate_object then null; end $$;

-- Core org + auth mapping
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_members_org_idx on public.organization_members(organization_id);
create index if not exists organization_members_user_idx on public.organization_members(user_id);

-- Settings + flags
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);
create index if not exists settings_org_key_idx on public.settings(organization_id, key);

-- Campaigns
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  type public.campaign_type not null default 'affiliate',
  status public.campaign_status not null default 'draft',
  target_audience text,
  description text,
  funnel_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaigns_org_idx on public.campaigns(organization_id);
create index if not exists campaigns_status_idx on public.campaigns(status);

-- Affiliate offers/links/clicks
create table if not exists public.affiliate_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  network text,
  payout_details text,
  terms_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists affiliate_offers_org_idx on public.affiliate_offers(organization_id);

create table if not exists public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  offer_id uuid references public.affiliate_offers(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  label text,
  destination_url text not null,
  utm_defaults jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists affiliate_links_org_idx on public.affiliate_links(organization_id);
create index if not exists affiliate_links_campaign_idx on public.affiliate_links(campaign_id);

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  affiliate_link_id uuid references public.affiliate_links(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  funnel_id uuid,
  funnel_step_id uuid,
  source_page text,
  source_content_asset_id uuid,
  utm jsonb not null default '{}'::jsonb,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_clicks_link_idx on public.affiliate_clicks(affiliate_link_id);
create index if not exists affiliate_clicks_campaign_idx on public.affiliate_clicks(campaign_id);
create index if not exists affiliate_clicks_created_idx on public.affiliate_clicks(created_at desc);

-- Funnels and pages
create table if not exists public.funnels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  name text not null,
  status public.funnel_status not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists funnels_org_idx on public.funnels(organization_id);
create index if not exists funnels_campaign_idx on public.funnels(campaign_id);

alter table public.campaigns
  add constraint campaigns_funnel_fk foreign key (funnel_id) references public.funnels(id) on delete set null;

create table if not exists public.funnel_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  step_index int not null,
  name text not null,
  step_type text not null, -- e.g. landing, bridge, thank_you, checkout, etc.
  slug text not null,
  is_public boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (funnel_id, slug)
);
create index if not exists funnel_steps_funnel_idx on public.funnel_steps(funnel_id, step_index);

create table if not exists public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  funnel_step_id uuid not null references public.funnel_steps(id) on delete cascade,
  title text not null,
  description text,
  blocks jsonb not null default '[]'::jsonb, -- structured sections
  seo jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists landing_pages_step_idx on public.landing_pages(funnel_step_id);

create table if not exists public.bridge_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  funnel_step_id uuid not null references public.funnel_steps(id) on delete cascade,
  title text not null,
  description text,
  blocks jsonb not null default '[]'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bridge_pages_step_idx on public.bridge_pages(funnel_step_id);

create table if not exists public.cta_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  funnel_id uuid not null references public.funnels(id) on delete cascade,
  name text not null,
  button_text text not null,
  destination_type text not null, -- affiliate_link | internal_route | external_url
  destination_value text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cta_variants_funnel_idx on public.cta_variants(funnel_id);

create table if not exists public.lead_magnets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  storage_path text, -- Supabase Storage object path
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lead_magnets_org_idx on public.lead_magnets(organization_id);

-- Leads
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  email text not null,
  phone text,
  full_name text,
  status text not null default 'new',
  score int not null default 0,
  source_page text,
  source_content_asset_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);
create index if not exists leads_org_idx on public.leads(organization_id);
create index if not exists leads_campaign_idx on public.leads(campaign_id);
create index if not exists leads_created_idx on public.leads(created_at desc);

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists lead_events_lead_idx on public.lead_events(lead_id, created_at desc);

create table if not exists public.conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  conversion_type text not null,
  value_cents int,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists conversions_campaign_idx on public.conversions(campaign_id, created_at desc);

-- Email system
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  subject text not null,
  body_markdown text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sequence_id uuid not null references public.email_sequences(id) on delete cascade,
  step_index int not null,
  delay_minutes int not null default 0,
  template_id uuid references public.email_templates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sequence_id, step_index)
);
create index if not exists email_sequence_steps_seq_idx on public.email_sequence_steps(sequence_id, step_index);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  sequence_id uuid references public.email_sequences(id) on delete set null,
  sequence_step_id uuid references public.email_sequence_steps(id) on delete set null,
  to_email text not null,
  subject text not null,
  provider text not null default 'resend',
  provider_message_id text,
  status public.email_log_status not null default 'queued',
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists email_logs_org_idx on public.email_logs(organization_id, created_at desc);

-- Content system
create table if not exists public.content_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  funnel_id uuid references public.funnels(id) on delete set null,
  title text not null,
  status public.content_status not null default 'draft',
  angles jsonb not null default '[]'::jsonb,
  script_markdown text,
  captions jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_assets_campaign_idx on public.content_assets(campaign_id, created_at desc);

create table if not exists public.content_platform_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_asset_id uuid not null references public.content_assets(id) on delete cascade,
  platform text not null, -- tiktok, instagram, youtube_shorts, linkedin, x
  caption text,
  hashtags jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_platform_variants_asset_idx on public.content_platform_variants(content_asset_id);

create table if not exists public.content_publish_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_asset_id uuid not null references public.content_assets(id) on delete cascade,
  platform text not null,
  scheduled_for timestamptz,
  status text not null default 'queued',
  provider_job_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_publish_queue_org_idx on public.content_publish_queue(organization_id, scheduled_for);

-- Analytics events
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  source text not null default 'internal',
  session_id text,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_name_idx on public.analytics_events(event_name);
create index if not exists analytics_events_created_idx on public.analytics_events(created_at desc);
create index if not exists analytics_events_campaign_idx on public.analytics_events(campaign_id, created_at desc);

-- OpenClaw agents + runs + logs
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null, -- stable identifier, e.g. opportunity_scout
  name text not null,
  description text,
  status public.agent_status not null default 'enabled',
  approval_required boolean not null default false,
  allowed_tools jsonb not null default '[]'::jsonb,
  input_schema jsonb not null default '{}'::jsonb,
  output_schema jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);
create index if not exists agents_org_idx on public.agents(organization_id);

create table if not exists public.agent_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete cascade,
  name text not null,
  system_prompt text not null,
  style_rules text,
  forbidden_claims text,
  output_format text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_templates_agent_idx on public.agent_templates(agent_id);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  status public.agent_run_status not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  output_summary text,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists agent_runs_agent_idx on public.agent_runs(agent_id, created_at desc);

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  task_type text not null,
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_tasks_run_idx on public.agent_tasks(run_id);

create table if not exists public.agent_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  level text not null default 'info',
  message text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_logs_run_idx on public.agent_logs(run_id, created_at desc);

create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, key)
);

create table if not exists public.agent_outputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  output_type text not null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_outputs_run_idx on public.agent_outputs(run_id);

-- Approvals + queue
create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  status public.approval_status not null default 'pending',
  approval_type text not null, -- publish | email_send | affiliate_activation | chatbot_template | claim_copy
  reason_required boolean not null default true,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  decided_by_user_id uuid references auth.users(id) on delete set null,
  decision_reason text,
  payload jsonb not null default '{}'::jsonb,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists approvals_org_status_idx on public.approvals(organization_id, status, created_at desc);

-- Logs / auditing
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_org_idx on public.audit_logs(organization_id, created_at desc);

-- RLS
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.settings enable row level security;
alter table public.campaigns enable row level security;
alter table public.affiliate_offers enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.funnels enable row level security;
alter table public.funnel_steps enable row level security;
alter table public.landing_pages enable row level security;
alter table public.bridge_pages enable row level security;
alter table public.cta_variants enable row level security;
alter table public.lead_magnets enable row level security;
alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.conversions enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_sequences enable row level security;
alter table public.email_sequence_steps enable row level security;
alter table public.email_logs enable row level security;
alter table public.content_assets enable row level security;
alter table public.content_platform_variants enable row level security;
alter table public.content_publish_queue enable row level security;
alter table public.analytics_events enable row level security;
alter table public.agents enable row level security;
alter table public.agent_templates enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.agent_logs enable row level security;
alter table public.agent_memory enable row level security;
alter table public.agent_outputs enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_logs enable row level security;

-- Policies (org membership based)
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_operator(org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.role in ('admin','operator')
  );
$$;

-- organizations: members can read their org
drop policy if exists org_select_member on public.organizations;
create policy org_select_member on public.organizations
  for select
  using (public.is_org_member(id));

-- profiles: user can read/update own profile
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid());

-- organization_members: members can read; admins/operators can manage
drop policy if exists org_members_select_member on public.organization_members;
create policy org_members_select_member on public.organization_members
  for select using (public.is_org_member(organization_id));

drop policy if exists org_members_mutate_operator on public.organization_members;
create policy org_members_mutate_operator on public.organization_members
  for insert with check (public.is_org_operator(organization_id));

drop policy if exists org_members_update_operator on public.organization_members;
create policy org_members_update_operator on public.organization_members
  for update using (public.is_org_operator(organization_id));

drop policy if exists org_members_delete_operator on public.organization_members;
create policy org_members_delete_operator on public.organization_members
  for delete using (public.is_org_operator(organization_id));

-- Generic helper macro-like pattern: org-scoped tables
-- We write explicit policies for clarity and to keep future audits simple.

-- settings
drop policy if exists settings_select_member on public.settings;
create policy settings_select_member on public.settings
  for select using (public.is_org_member(organization_id));
drop policy if exists settings_mutate_operator on public.settings;
create policy settings_mutate_operator on public.settings
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

-- campaigns
drop policy if exists campaigns_select_member on public.campaigns;
create policy campaigns_select_member on public.campaigns
  for select using (public.is_org_member(organization_id));
drop policy if exists campaigns_mutate_operator on public.campaigns;
create policy campaigns_mutate_operator on public.campaigns
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

-- funnels, steps, pages, CTAs, magnets
drop policy if exists funnels_select_member on public.funnels;
create policy funnels_select_member on public.funnels
  for select using (public.is_org_member(organization_id));
drop policy if exists funnels_mutate_operator on public.funnels;
create policy funnels_mutate_operator on public.funnels
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists funnel_steps_select_member on public.funnel_steps;
create policy funnel_steps_select_member on public.funnel_steps
  for select using (public.is_org_member(organization_id));
drop policy if exists funnel_steps_mutate_operator on public.funnel_steps;
create policy funnel_steps_mutate_operator on public.funnel_steps
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists landing_pages_select_member on public.landing_pages;
create policy landing_pages_select_member on public.landing_pages
  for select using (public.is_org_member(organization_id));
drop policy if exists landing_pages_mutate_operator on public.landing_pages;
create policy landing_pages_mutate_operator on public.landing_pages
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists bridge_pages_select_member on public.bridge_pages;
create policy bridge_pages_select_member on public.bridge_pages
  for select using (public.is_org_member(organization_id));
drop policy if exists bridge_pages_mutate_operator on public.bridge_pages;
create policy bridge_pages_mutate_operator on public.bridge_pages
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists cta_variants_select_member on public.cta_variants;
create policy cta_variants_select_member on public.cta_variants
  for select using (public.is_org_member(organization_id));
drop policy if exists cta_variants_mutate_operator on public.cta_variants;
create policy cta_variants_mutate_operator on public.cta_variants
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists lead_magnets_select_member on public.lead_magnets;
create policy lead_magnets_select_member on public.lead_magnets
  for select using (public.is_org_member(organization_id));
drop policy if exists lead_magnets_mutate_operator on public.lead_magnets;
create policy lead_magnets_mutate_operator on public.lead_magnets
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

-- offers/links
drop policy if exists affiliate_offers_select_member on public.affiliate_offers;
create policy affiliate_offers_select_member on public.affiliate_offers
  for select using (public.is_org_member(organization_id));
drop policy if exists affiliate_offers_mutate_operator on public.affiliate_offers;
create policy affiliate_offers_mutate_operator on public.affiliate_offers
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists affiliate_links_select_member on public.affiliate_links;
create policy affiliate_links_select_member on public.affiliate_links
  for select using (public.is_org_member(organization_id));
drop policy if exists affiliate_links_mutate_operator on public.affiliate_links;
create policy affiliate_links_mutate_operator on public.affiliate_links
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

-- leads, events, conversions
drop policy if exists leads_select_member on public.leads;
create policy leads_select_member on public.leads
  for select using (public.is_org_member(organization_id));
drop policy if exists leads_mutate_operator on public.leads;
create policy leads_mutate_operator on public.leads
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists lead_events_select_member on public.lead_events;
create policy lead_events_select_member on public.lead_events
  for select using (public.is_org_member(organization_id));
drop policy if exists lead_events_mutate_operator on public.lead_events;
create policy lead_events_mutate_operator on public.lead_events
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists conversions_select_member on public.conversions;
create policy conversions_select_member on public.conversions
  for select using (public.is_org_member(organization_id));
drop policy if exists conversions_mutate_operator on public.conversions;
create policy conversions_mutate_operator on public.conversions
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

-- email system
drop policy if exists email_templates_select_member on public.email_templates;
create policy email_templates_select_member on public.email_templates
  for select using (public.is_org_member(organization_id));
drop policy if exists email_templates_mutate_operator on public.email_templates;
create policy email_templates_mutate_operator on public.email_templates
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists email_sequences_select_member on public.email_sequences;
create policy email_sequences_select_member on public.email_sequences
  for select using (public.is_org_member(organization_id));
drop policy if exists email_sequences_mutate_operator on public.email_sequences;
create policy email_sequences_mutate_operator on public.email_sequences
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists email_sequence_steps_select_member on public.email_sequence_steps;
create policy email_sequence_steps_select_member on public.email_sequence_steps
  for select using (public.is_org_member(organization_id));
drop policy if exists email_sequence_steps_mutate_operator on public.email_sequence_steps;
create policy email_sequence_steps_mutate_operator on public.email_sequence_steps
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists email_logs_select_member on public.email_logs;
create policy email_logs_select_member on public.email_logs
  for select using (public.is_org_member(organization_id));
drop policy if exists email_logs_mutate_operator on public.email_logs;
create policy email_logs_mutate_operator on public.email_logs
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

-- content
drop policy if exists content_assets_select_member on public.content_assets;
create policy content_assets_select_member on public.content_assets
  for select using (public.is_org_member(organization_id));
drop policy if exists content_assets_mutate_operator on public.content_assets;
create policy content_assets_mutate_operator on public.content_assets
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists content_platform_variants_select_member on public.content_platform_variants;
create policy content_platform_variants_select_member on public.content_platform_variants
  for select using (public.is_org_member(organization_id));
drop policy if exists content_platform_variants_mutate_operator on public.content_platform_variants;
create policy content_platform_variants_mutate_operator on public.content_platform_variants
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists content_publish_queue_select_member on public.content_publish_queue;
create policy content_publish_queue_select_member on public.content_publish_queue
  for select using (public.is_org_member(organization_id));
drop policy if exists content_publish_queue_mutate_operator on public.content_publish_queue;
create policy content_publish_queue_mutate_operator on public.content_publish_queue
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

-- agents
drop policy if exists agents_select_member on public.agents;
create policy agents_select_member on public.agents
  for select using (public.is_org_member(organization_id));
drop policy if exists agents_mutate_operator on public.agents;
create policy agents_mutate_operator on public.agents
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists agent_templates_select_member on public.agent_templates;
create policy agent_templates_select_member on public.agent_templates
  for select using (public.is_org_member(organization_id));
drop policy if exists agent_templates_mutate_operator on public.agent_templates;
create policy agent_templates_mutate_operator on public.agent_templates
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists agent_runs_select_member on public.agent_runs;
create policy agent_runs_select_member on public.agent_runs
  for select using (public.is_org_member(organization_id));
drop policy if exists agent_runs_mutate_operator on public.agent_runs;
create policy agent_runs_mutate_operator on public.agent_runs
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists agent_tasks_select_member on public.agent_tasks;
create policy agent_tasks_select_member on public.agent_tasks
  for select using (public.is_org_member(organization_id));
drop policy if exists agent_tasks_mutate_operator on public.agent_tasks;
create policy agent_tasks_mutate_operator on public.agent_tasks
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists agent_logs_select_member on public.agent_logs;
create policy agent_logs_select_member on public.agent_logs
  for select using (public.is_org_member(organization_id));
drop policy if exists agent_logs_mutate_operator on public.agent_logs;
create policy agent_logs_mutate_operator on public.agent_logs
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists agent_memory_select_member on public.agent_memory;
create policy agent_memory_select_member on public.agent_memory
  for select using (public.is_org_member(organization_id));
drop policy if exists agent_memory_mutate_operator on public.agent_memory;
create policy agent_memory_mutate_operator on public.agent_memory
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists agent_outputs_select_member on public.agent_outputs;
create policy agent_outputs_select_member on public.agent_outputs
  for select using (public.is_org_member(organization_id));
drop policy if exists agent_outputs_mutate_operator on public.agent_outputs;
create policy agent_outputs_mutate_operator on public.agent_outputs
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

-- approvals + audit logs
drop policy if exists approvals_select_member on public.approvals;
create policy approvals_select_member on public.approvals
  for select using (public.is_org_member(organization_id));
drop policy if exists approvals_mutate_operator on public.approvals;
create policy approvals_mutate_operator on public.approvals
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists audit_logs_select_member on public.audit_logs;
create policy audit_logs_select_member on public.audit_logs
  for select using (public.is_org_member(organization_id));
drop policy if exists audit_logs_insert_operator on public.audit_logs;
create policy audit_logs_insert_operator on public.audit_logs
  for insert with check (public.is_org_operator(organization_id));

-- Public affiliate clicks + analytics ingestion (no auth) will be done via service role from API routes.
-- Keep RLS strict; server routes will use service role when needed.

commit;

