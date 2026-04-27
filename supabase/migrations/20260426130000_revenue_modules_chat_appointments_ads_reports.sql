-- Revenue modules: Chat closer, appointments, ad creative generations, weekly reports, worker metrics
begin;

-- Enums
do $$ begin
  create type public.chat_conversation_status as enum ('open','qualified','converted','handoff_requested','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_status as enum ('pending','invited','booked','rescheduled','no_show','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('draft','generated','sent','failed');
exception when duplicate_object then null; end $$;

-- Chat
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  funnel_id uuid references public.funnels(id) on delete set null,
  funnel_step_id uuid references public.funnel_steps(id) on delete set null,
  session_id text,
  status public.chat_conversation_status not null default 'open',
  lead_id uuid references public.leads(id) on delete set null,
  lead_score int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chat_conversations_org_idx on public.chat_conversations(organization_id, created_at desc);
create index if not exists chat_conversations_campaign_idx on public.chat_conversations(campaign_id, created_at desc);
create index if not exists chat_conversations_lead_idx on public.chat_conversations(lead_id, created_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  role text not null, -- user | assistant | system
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_conv_idx on public.chat_messages(conversation_id, created_at asc);

-- Appointments
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  status public.appointment_status not null default 'pending',
  provider text not null default 'internal',
  booking_url text,
  scheduled_at timestamptz,
  timezone text,
  owner_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointments_org_idx on public.appointments(organization_id, created_at desc);
create index if not exists appointments_lead_idx on public.appointments(lead_id, created_at desc);

create table if not exists public.booking_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  event_type text not null, -- invite_sent | booked | reminder_sent | no_show | rescheduled | cancelled
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists booking_logs_org_idx on public.booking_logs(organization_id, created_at desc);

-- Ad creative generations
create table if not exists public.ad_creative_generations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  platform text not null, -- facebook | instagram | tiktok | youtube_shorts | google_display | linkedin
  tone text,
  goal text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  status text not null default 'generated',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ad_creative_generations_org_idx on public.ad_creative_generations(organization_id, created_at desc);

-- Weekly reports
create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  week_start date not null,
  week_end date not null,
  status public.report_status not null default 'draft',
  report_markdown text,
  report_json jsonb not null default '{}'::jsonb,
  generated_by_agent_run_id uuid references public.agent_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, campaign_id, week_start)
);
create index if not exists weekly_reports_org_idx on public.weekly_reports(organization_id, created_at desc);

create table if not exists public.report_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_id uuid not null references public.weekly_reports(id) on delete cascade,
  channel text not null default 'email',
  to_address text,
  status public.report_status not null default 'draft',
  email_log_id uuid references public.email_logs(id) on delete set null,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists report_deliveries_org_idx on public.report_deliveries(organization_id, created_at desc);

-- Worker metrics (coarse, computed/updated by services)
create table if not exists public.worker_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  worker_key text not null,
  metric_key text not null,
  metric_value numeric not null default 0,
  window_start timestamptz,
  window_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (organization_id, campaign_id, worker_key, metric_key)
);
create index if not exists worker_metrics_org_idx on public.worker_metrics(organization_id, updated_at desc);

-- RLS: same migration as DDL so policies never run before tables exist.
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.appointments enable row level security;
alter table public.booking_logs enable row level security;
alter table public.ad_creative_generations enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.report_deliveries enable row level security;
alter table public.worker_metrics enable row level security;

drop policy if exists chat_conversations_select_member on public.chat_conversations;
create policy chat_conversations_select_member on public.chat_conversations
  for select using (public.is_org_member(organization_id));
drop policy if exists chat_conversations_mutate_operator on public.chat_conversations;
create policy chat_conversations_mutate_operator on public.chat_conversations
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists chat_messages_select_member on public.chat_messages;
create policy chat_messages_select_member on public.chat_messages
  for select using (public.is_org_member(organization_id));
drop policy if exists chat_messages_mutate_operator on public.chat_messages;
create policy chat_messages_mutate_operator on public.chat_messages
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists appointments_select_member on public.appointments;
create policy appointments_select_member on public.appointments
  for select using (public.is_org_member(organization_id));
drop policy if exists appointments_mutate_operator on public.appointments;
create policy appointments_mutate_operator on public.appointments
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists booking_logs_select_member on public.booking_logs;
create policy booking_logs_select_member on public.booking_logs
  for select using (public.is_org_member(organization_id));
drop policy if exists booking_logs_mutate_operator on public.booking_logs;
create policy booking_logs_mutate_operator on public.booking_logs
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists ad_creative_generations_select_member on public.ad_creative_generations;
create policy ad_creative_generations_select_member on public.ad_creative_generations
  for select using (public.is_org_member(organization_id));
drop policy if exists ad_creative_generations_mutate_operator on public.ad_creative_generations;
create policy ad_creative_generations_mutate_operator on public.ad_creative_generations
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists weekly_reports_select_member on public.weekly_reports;
create policy weekly_reports_select_member on public.weekly_reports
  for select using (public.is_org_member(organization_id));
drop policy if exists weekly_reports_mutate_operator on public.weekly_reports;
create policy weekly_reports_mutate_operator on public.weekly_reports
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists report_deliveries_select_member on public.report_deliveries;
create policy report_deliveries_select_member on public.report_deliveries
  for select using (public.is_org_member(organization_id));
drop policy if exists report_deliveries_mutate_operator on public.report_deliveries;
create policy report_deliveries_mutate_operator on public.report_deliveries
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists worker_metrics_select_member on public.worker_metrics;
create policy worker_metrics_select_member on public.worker_metrics
  for select using (public.is_org_member(organization_id));
drop policy if exists worker_metrics_mutate_operator on public.worker_metrics;
create policy worker_metrics_mutate_operator on public.worker_metrics
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

commit;

