begin;

-- Background jobs (production-safe: idempotent table + indexes + RLS).
do $$ begin
  create type public.job_status as enum ('queued','running','succeeded','failed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  type text not null, -- generate_offer | generate_landing | generate_ads | launch_ads | optimize_campaign | import_performance
  status public.job_status not null default 'queued',
  priority int not null default 100,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  attempts int not null default 0,
  max_attempts int not null default 3,
  run_after timestamptz,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_org_status_idx on public.jobs(organization_id, status, created_at desc);
create index if not exists jobs_run_after_idx on public.jobs(status, run_after asc) where status = 'queued';
create index if not exists jobs_campaign_idx on public.jobs(campaign_id, created_at desc);

-- Experiments (A/B) to attribute landing+ad variants.
do $$ begin
  create type public.experiment_status as enum ('draft','running','paused','completed');
exception when duplicate_object then null; end $$;

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  status public.experiment_status not null default 'draft',
  hypothesis text,
  primary_metric text not null default 'lead_submit',
  traffic_allocation jsonb not null default '{}'::jsonb, -- { "direct_response": 0.34, ... } for landings; or ad ids
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists experiments_org_campaign_idx on public.experiments(organization_id, campaign_id, created_at desc);

create table if not exists public.experiment_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  variant_key text not null, -- landing: direct_response|premium_trust|speed_convenience, or ad slug/id
  kind text not null default 'landing', -- landing | ad
  weight numeric not null default 0.33,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, experiment_id, variant_key)
);

create index if not exists experiment_variants_experiment_idx on public.experiment_variants(experiment_id, created_at asc);

-- Metrics snapshots (aggregated rollups for dashboards / optimization)
create table if not exists public.metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  experiment_id uuid references public.experiments(id) on delete set null,
  scope text not null default 'campaign', -- campaign | experiment | ad_campaign | landing_variant
  key text not null, -- e.g. cpl, cpa, roi, profit_cents, ctr, cv_landing
  value_numeric numeric,
  value_json jsonb not null default '{}'::jsonb,
  window_start timestamptz,
  window_end timestamptz,
  captured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists metrics_org_campaign_idx on public.metrics(organization_id, campaign_id, captured_at desc);
create index if not exists metrics_experiment_idx on public.metrics(experiment_id, captured_at desc);

-- RLS
alter table public.jobs enable row level security;
alter table public.experiments enable row level security;
alter table public.experiment_variants enable row level security;
alter table public.metrics enable row level security;

drop policy if exists jobs_select_member on public.jobs;
create policy jobs_select_member on public.jobs for select using (public.is_org_member(organization_id));
drop policy if exists jobs_mutate_operator on public.jobs;
create policy jobs_mutate_operator on public.jobs for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists experiments_select_member on public.experiments;
create policy experiments_select_member on public.experiments for select using (public.is_org_member(organization_id));
drop policy if exists experiments_mutate_operator on public.experiments;
create policy experiments_mutate_operator on public.experiments for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists experiment_variants_select_member on public.experiment_variants;
create policy experiment_variants_select_member on public.experiment_variants for select using (public.is_org_member(organization_id));
drop policy if exists experiment_variants_mutate_operator on public.experiment_variants;
create policy experiment_variants_mutate_operator on public.experiment_variants for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists metrics_select_member on public.metrics;
create policy metrics_select_member on public.metrics for select using (public.is_org_member(organization_id));
drop policy if exists metrics_mutate_operator on public.metrics;
create policy metrics_mutate_operator on public.metrics for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

commit;

