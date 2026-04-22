-- Phase 5: Automation foundations (recipes, campaign automation, schedule guardrails)
begin;

-- Guardrails for scheduled runs
alter table public.agent_scheduled_tasks
  add column if not exists failure_count int not null default 0;
alter table public.agent_scheduled_tasks
  add column if not exists backoff_until timestamptz;
alter table public.agent_scheduled_tasks
  add column if not exists last_error text;

create index if not exists agent_scheduled_tasks_backoff_idx
  on public.agent_scheduled_tasks(organization_id, backoff_until)
  where backoff_until is not null;

-- Per-campaign automation settings (safe-by-default)
create table if not exists public.campaign_automation_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  automation_enabled boolean not null default false,
  auto_generate_content_drafts boolean not null default false,
  auto_run_analyst_weekly boolean not null default false,
  require_approval_before_publish boolean not null default true,
  require_approval_before_email boolean not null default true,
  auto_log_analytics_reviews boolean not null default false,
  max_runs_per_day int not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id)
);

create index if not exists campaign_automation_settings_org_idx
  on public.campaign_automation_settings(organization_id, campaign_id);

alter table public.campaign_automation_settings enable row level security;

drop policy if exists campaign_automation_settings_select_member on public.campaign_automation_settings;
create policy campaign_automation_settings_select_member on public.campaign_automation_settings
  for select using (public.is_org_member(organization_id));

drop policy if exists campaign_automation_settings_mutate_operator on public.campaign_automation_settings;
create policy campaign_automation_settings_mutate_operator on public.campaign_automation_settings
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

-- Run recipes / playbooks (reusable, non-executing definitions)
create table if not exists public.run_recipes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  default_agent_key text not null,
  default_payload jsonb not null default '{}'::jsonb,
  payload_schema jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create index if not exists run_recipes_org_idx on public.run_recipes(organization_id, key);
alter table public.run_recipes enable row level security;

drop policy if exists run_recipes_select_member on public.run_recipes;
create policy run_recipes_select_member on public.run_recipes
  for select using (public.is_org_member(organization_id));

drop policy if exists run_recipes_mutate_operator on public.run_recipes;
create policy run_recipes_mutate_operator on public.run_recipes
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

commit;

