-- Phase X: Runtime fixes for public funnel + analytics + email outbox + approvals
begin;

-- Ensure review_status enum exists (older deployments may be missing it).
do $$ begin
  create type public.review_status as enum (
    'draft',
    'review_required',
    'approved',
    'rejected',
    'ready_to_deploy',
    'deployed'
  );
exception when duplicate_object then null; end $$;

-- 1) analytics_events: add missing columns used by app code
alter table public.analytics_events
  add column if not exists funnel_id uuid references public.funnels(id) on delete set null;

alter table public.analytics_events
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='analytics_events' and column_name='properties'
  ) then
    update public.analytics_events
    set metadata = coalesce(metadata, properties, '{}'::jsonb)
    where (metadata is null or metadata = '{}'::jsonb);
  end if;
exception when undefined_column then null; end $$;

create index if not exists analytics_events_funnel_idx on public.analytics_events(funnel_id, created_at desc);

-- 2) funnel_steps: add review_status for approvals/deploy workflow
alter table public.funnel_steps
  add column if not exists review_status public.review_status not null default 'draft';
create index if not exists funnel_steps_review_status_idx
  on public.funnel_steps(organization_id, review_status, created_at desc);

-- 3) email_sequences: connect to campaign so lead capture can enroll
alter table public.email_sequences
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
create index if not exists email_sequences_campaign_idx
  on public.email_sequences(organization_id, campaign_id, created_at desc);

-- 4) email_logs: first-class scheduling + retry/locking (outbox pattern)
alter table public.email_logs
  add column if not exists scheduled_for timestamptz,
  add column if not exists attempt_count int not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text;

-- Backfill scheduling from metadata when present
update public.email_logs
set scheduled_for = coalesce(
  scheduled_for,
  nullif((metadata->>'scheduled_for')::text, '')::timestamptz
)
where scheduled_for is null and metadata ? 'scheduled_for';

update public.email_logs
set next_attempt_at = coalesce(next_attempt_at, scheduled_for, created_at)
where next_attempt_at is null;

create index if not exists email_logs_due_idx
  on public.email_logs(organization_id, status, next_attempt_at);

-- 5) email unsubscribes
create table if not exists public.email_unsubscribes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  email text not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);
create index if not exists email_unsubscribes_org_idx on public.email_unsubscribes(organization_id, created_at desc);

commit;

