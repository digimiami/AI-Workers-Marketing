-- AI Workers Mission Control — sessions, unified memory, recommendations, integration registry
begin;

do $$ begin
  create type public.memory_namespace as enum (
    'user',
    'business',
    'campaign',
    'conversation',
    'task',
    'agent'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.integration_provider as enum (
    'meta_ads',
    'google_ads',
    'tiktok_ads',
    'linkedin_ads',
    'hubspot',
    'gohighlevel',
    'pipedrive',
    'resend',
    'mailchimp',
    'brevo',
    'google_analytics',
    'google_search_console',
    'posthog',
    'microsoft_clarity',
    'n8n',
    'zapier',
    'make',
    'mcp',
    'vercel',
    'stripe',
    'zernio'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.integration_status as enum ('disconnected', 'pending', 'connected', 'error');
exception when duplicate_object then null; end $$;

-- Command Center sessions (operator-facing NL control plane)
create table if not exists public.mission_control_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  title text not null default 'Mission Control',
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mission_control_sessions_org_idx
  on public.mission_control_sessions(organization_id, updated_at desc);

create table if not exists public.mission_control_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.mission_control_sessions(id) on delete cascade,
  role text not null, -- user | assistant | system | worker
  content text not null,
  worker_key text,
  intent text,
  plan jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mission_control_messages_session_idx
  on public.mission_control_messages(session_id, created_at asc);

-- Unified business memory (extends agent_memory with org-wide namespaces)
create table if not exists public.business_memory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  namespace public.memory_namespace not null default 'business',
  scope_id uuid,
  memory_key text not null,
  value jsonb not null default '{}'::jsonb,
  source text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, namespace, scope_id, memory_key)
);

create index if not exists business_memory_org_ns_idx
  on public.business_memory(organization_id, namespace, updated_at desc);

-- Integration connection registry (complements organization_platform_credentials)
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider public.integration_provider not null,
  status public.integration_status not null default 'disconnected',
  display_name text,
  credentials_ref text,
  config jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create index if not exists integration_connections_org_idx
  on public.integration_connections(organization_id, status);

-- AI-generated recommendations for Mission Control executive view
create table if not exists public.mission_control_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  category text not null, -- revenue | leads | campaigns | funnel | workers | integrations
  priority int not null default 50,
  title text not null,
  body text not null,
  action_href text,
  action_label text,
  metadata jsonb not null default '{}'::jsonb,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mission_control_recommendations_org_idx
  on public.mission_control_recommendations(organization_id, dismissed_at, priority desc);

-- Orchestrated multi-worker playbooks
create table if not exists public.mission_playbooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid references public.mission_control_sessions(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  intent text not null,
  status text not null default 'planned', -- planned | running | completed | failed
  steps jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mission_playbooks_org_idx
  on public.mission_playbooks(organization_id, created_at desc);

alter table public.mission_control_sessions enable row level security;
alter table public.mission_control_messages enable row level security;
alter table public.business_memory enable row level security;
alter table public.integration_connections enable row level security;
alter table public.mission_control_recommendations enable row level security;
alter table public.mission_playbooks enable row level security;

drop policy if exists mission_control_sessions_select on public.mission_control_sessions;
create policy mission_control_sessions_select on public.mission_control_sessions
  for select using (public.is_org_member(organization_id));
drop policy if exists mission_control_sessions_mutate on public.mission_control_sessions;
create policy mission_control_sessions_mutate on public.mission_control_sessions
  for all using (public.is_org_operator(organization_id));

drop policy if exists mission_control_messages_select on public.mission_control_messages;
create policy mission_control_messages_select on public.mission_control_messages
  for select using (public.is_org_member(organization_id));
drop policy if exists mission_control_messages_mutate on public.mission_control_messages;
create policy mission_control_messages_mutate on public.mission_control_messages
  for all using (public.is_org_operator(organization_id));

drop policy if exists business_memory_select on public.business_memory;
create policy business_memory_select on public.business_memory
  for select using (public.is_org_member(organization_id));
drop policy if exists business_memory_mutate on public.business_memory;
create policy business_memory_mutate on public.business_memory
  for all using (public.is_org_operator(organization_id));

drop policy if exists integration_connections_select on public.integration_connections;
create policy integration_connections_select on public.integration_connections
  for select using (public.is_org_member(organization_id));
drop policy if exists integration_connections_mutate on public.integration_connections;
create policy integration_connections_mutate on public.integration_connections
  for all using (public.is_org_operator(organization_id));

drop policy if exists mission_control_recommendations_select on public.mission_control_recommendations;
create policy mission_control_recommendations_select on public.mission_control_recommendations
  for select using (public.is_org_member(organization_id));
drop policy if exists mission_control_recommendations_mutate on public.mission_control_recommendations;
create policy mission_control_recommendations_mutate on public.mission_control_recommendations
  for all using (public.is_org_operator(organization_id));

drop policy if exists mission_playbooks_select on public.mission_playbooks;
create policy mission_playbooks_select on public.mission_playbooks
  for select using (public.is_org_member(organization_id));
drop policy if exists mission_playbooks_mutate on public.mission_playbooks;
create policy mission_playbooks_mutate on public.mission_playbooks
  for all using (public.is_org_operator(organization_id));

commit;
