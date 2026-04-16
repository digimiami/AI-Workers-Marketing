-- OpenClaw orchestration: run statuses, campaign agents, schedules, template flags, approval link

begin;

-- New run lifecycle enum (replaces agent_run_status on agent_runs)
do $$ begin
  create type public.openclaw_run_status as enum (
    'pending',
    'running',
    'success',
    'failed',
    'approved',
    'rejected'
  );
exception when duplicate_object then null; end $$;

alter table public.agent_runs add column if not exists status_v2 public.openclaw_run_status;

update public.agent_runs
set status_v2 = case status::text
  when 'queued' then 'pending'::public.openclaw_run_status
  when 'running' then 'running'::public.openclaw_run_status
  when 'succeeded' then 'success'::public.openclaw_run_status
  when 'failed' then 'failed'::public.openclaw_run_status
  when 'cancelled' then 'rejected'::public.openclaw_run_status
  else 'pending'::public.openclaw_run_status
end
where status_v2 is null;

alter table public.agent_runs alter column status_v2 set default 'pending'::public.openclaw_run_status;
alter table public.agent_runs alter column status_v2 set not null;

alter table public.agent_runs drop column if exists status cascade;
alter table public.agent_runs rename column status_v2 to status;

do $$ begin
  drop type public.agent_run_status;
exception when undefined_object then null; end $$;

-- Optional: template used for this run
alter table public.agent_runs add column if not exists template_id uuid references public.agent_templates(id) on delete set null;

-- Approvals can reference a specific agent run
alter table public.approvals add column if not exists agent_run_id uuid references public.agent_runs(id) on delete set null;
create index if not exists approvals_agent_run_idx on public.approvals(agent_run_id) where agent_run_id is not null;

-- Per-agent prompt templates: versioning + default flag
alter table public.agent_templates add column if not exists is_default boolean not null default false;
alter table public.agent_templates add column if not exists version int not null default 1;
alter table public.agent_templates add column if not exists campaign_context text;
alter table public.agent_templates add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Campaign ↔ agent assignment (many-to-many with config)
create table if not exists public.campaign_agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  priority int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, agent_id)
);
create index if not exists campaign_agents_org_idx on public.campaign_agents(organization_id);
create index if not exists campaign_agents_campaign_idx on public.campaign_agents(campaign_id);

-- Scheduled agent executions (cron-friendly; runner invoked via Vercel Cron or external worker)
create table if not exists public.agent_scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  name text not null,
  cron_expression text not null,
  timezone text not null default 'UTC',
  payload jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_agent_run_id uuid references public.agent_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_scheduled_tasks_org_idx on public.agent_scheduled_tasks(organization_id);
create index if not exists agent_scheduled_tasks_next_idx on public.agent_scheduled_tasks(next_run_at) where enabled = true;

-- RLS
alter table public.campaign_agents enable row level security;
alter table public.agent_scheduled_tasks enable row level security;

drop policy if exists campaign_agents_select_member on public.campaign_agents;
create policy campaign_agents_select_member on public.campaign_agents
  for select using (public.is_org_member(organization_id));
drop policy if exists campaign_agents_mutate_operator on public.campaign_agents;
create policy campaign_agents_mutate_operator on public.campaign_agents
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists agent_scheduled_tasks_select_member on public.agent_scheduled_tasks;
create policy agent_scheduled_tasks_select_member on public.agent_scheduled_tasks
  for select using (public.is_org_member(organization_id));
drop policy if exists agent_scheduled_tasks_mutate_operator on public.agent_scheduled_tasks;
create policy agent_scheduled_tasks_mutate_operator on public.agent_scheduled_tasks
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

commit;
