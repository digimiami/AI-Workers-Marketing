-- OpenClaw internal tool execution logs
create table if not exists public.openclaw_tool_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trace_id text not null,
  actor_type text not null default 'user', -- user | system
  actor_user_id uuid references auth.users(id) on delete set null,
  system_actor_id text,
  agent_id uuid references public.agents(id) on delete set null,
  run_id uuid references public.agent_runs(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  tool_name text not null,
  role_mode text,
  approval_mode text,
  approval_required boolean not null default false,
  approval_id uuid references public.approvals(id) on delete set null,
  ok boolean not null default false,
  error_code text,
  error_message text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists openclaw_tool_calls_org_created_idx
  on public.openclaw_tool_calls(organization_id, created_at desc);
create index if not exists openclaw_tool_calls_trace_idx
  on public.openclaw_tool_calls(organization_id, trace_id, created_at desc);
create index if not exists openclaw_tool_calls_run_idx
  on public.openclaw_tool_calls(organization_id, run_id, created_at desc);

alter table public.openclaw_tool_calls enable row level security;

-- Members can read tool-call history for their org
drop policy if exists openclaw_tool_calls_select_member on public.openclaw_tool_calls;
create policy openclaw_tool_calls_select_member on public.openclaw_tool_calls
  for select
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = openclaw_tool_calls.organization_id
        and m.user_id = auth.uid()
    )
  );

-- Operators can insert tool-call logs (also allows server-side writes with user session)
drop policy if exists openclaw_tool_calls_insert_operator on public.openclaw_tool_calls;
create policy openclaw_tool_calls_insert_operator on public.openclaw_tool_calls
  for insert
  with check (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = openclaw_tool_calls.organization_id
        and m.user_id = auth.uid()
        and m.role in ('admin','operator')
    )
  );

-- No direct updates/deletes from clients
