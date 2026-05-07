begin;

-- CRM-style pipeline stages (per organization; AiWorkers original model)
create table if not exists public.lead_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists lead_pipeline_stages_org_sort_idx
  on public.lead_pipeline_stages (organization_id, sort_order asc);

-- AI scoring snapshots (append-only style; latest row wins in app queries)
create table if not exists public.lead_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  score int not null default 0,
  stage text not null default 'new_lead',
  intent_level text,
  next_best_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lead_scores_org_lead_idx
  on public.lead_scores (organization_id, lead_id, created_at desc);

create index if not exists lead_scores_campaign_idx
  on public.lead_scores (campaign_id, created_at desc);

alter table public.lead_pipeline_stages enable row level security;
alter table public.lead_scores enable row level security;

drop policy if exists lead_pipeline_stages_select_member on public.lead_pipeline_stages;
create policy lead_pipeline_stages_select_member on public.lead_pipeline_stages
  for select using (public.is_org_member(organization_id));
drop policy if exists lead_pipeline_stages_mutate_operator on public.lead_pipeline_stages;
create policy lead_pipeline_stages_mutate_operator on public.lead_pipeline_stages
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists lead_scores_select_member on public.lead_scores;
create policy lead_scores_select_member on public.lead_scores
  for select using (public.is_org_member(organization_id));
drop policy if exists lead_scores_mutate_operator on public.lead_scores;
create policy lead_scores_mutate_operator on public.lead_scores
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

commit;
