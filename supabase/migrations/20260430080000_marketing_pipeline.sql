begin;

-- AiWorkers Marketing Team Pipeline (stage-based marketing OS)

-- Core pipeline tables
create table if not exists public.marketing_pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  provider text not null default 'hybrid', -- openclaw | internal_llm | hybrid
  approval_mode text not null default 'required', -- required | auto_draft
  input jsonb not null default '{}'::jsonb,
  status text not null default 'pending', -- pending | running | completed | failed | needs_approval
  current_stage text, -- research | strategy | creation | execution | optimization
  started_at timestamptz,
  finished_at timestamptz,
  warnings text[] not null default '{}'::text[],
  errors text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_pipeline_runs_org_idx on public.marketing_pipeline_runs(organization_id, created_at desc);
create index if not exists marketing_pipeline_runs_campaign_idx on public.marketing_pipeline_runs(campaign_id, created_at desc);

create table if not exists public.marketing_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pipeline_run_id uuid not null references public.marketing_pipeline_runs(id) on delete cascade,
  stage_key text not null, -- research | strategy | creation | execution | optimization
  status text not null default 'pending', -- pending | running | completed | failed | needs_approval
  assigned_workers text[] not null default '{}'::text[],
  started_at timestamptz,
  finished_at timestamptz,
  output_summary text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pipeline_run_id, stage_key)
);
create index if not exists marketing_pipeline_stages_run_idx on public.marketing_pipeline_stages(pipeline_run_id, stage_key);

create table if not exists public.marketing_pipeline_stage_outputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pipeline_run_id uuid not null references public.marketing_pipeline_runs(id) on delete cascade,
  stage_id uuid not null references public.marketing_pipeline_stages(id) on delete cascade,
  output_type text not null default 'stage.output',
  content jsonb not null default '{}'::jsonb,
  created_record_refs jsonb not null default '[]'::jsonb, -- [{table,id,label?}]
  created_at timestamptz not null default now()
);
create index if not exists marketing_pipeline_stage_outputs_stage_idx on public.marketing_pipeline_stage_outputs(stage_id, created_at desc);

create table if not exists public.marketing_pipeline_stage_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pipeline_run_id uuid not null references public.marketing_pipeline_runs(id) on delete cascade,
  stage_id uuid references public.marketing_pipeline_stages(id) on delete cascade,
  level text not null default 'info', -- info | warn | error
  message text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists marketing_pipeline_stage_logs_run_idx on public.marketing_pipeline_stage_logs(pipeline_run_id, created_at asc);
create index if not exists marketing_pipeline_stage_logs_stage_idx on public.marketing_pipeline_stage_logs(stage_id, created_at asc);

-- Worker skills (markdown instructions + output traces)
create table if not exists public.ai_worker_skills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  skill_key text not null,
  stage_key text,
  name text not null,
  markdown text not null,
  status text not null default 'enabled',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, skill_key)
);
create index if not exists ai_worker_skills_org_idx on public.ai_worker_skills(organization_id, skill_key);

create table if not exists public.ai_worker_skill_outputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pipeline_run_id uuid references public.marketing_pipeline_runs(id) on delete cascade,
  stage_id uuid references public.marketing_pipeline_stages(id) on delete cascade,
  skill_key text not null,
  status text not null default 'completed', -- pending | running | completed | failed
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  provider text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ai_worker_skill_outputs_run_idx on public.ai_worker_skill_outputs(pipeline_run_id, created_at desc);
create index if not exists ai_worker_skill_outputs_stage_idx on public.ai_worker_skill_outputs(stage_id, created_at desc);

-- Missing marketing tables (create-if-missing)
create table if not exists public.lead_capture_forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  funnel_id uuid references public.funnels(id) on delete set null,
  funnel_step_id uuid references public.funnel_steps(id) on delete set null,
  name text not null,
  status text not null default 'draft', -- draft | active | archived
  schema jsonb not null default '{}'::jsonb,
  integrations jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lead_capture_forms_org_idx on public.lead_capture_forms(organization_id, created_at desc);
create index if not exists lead_capture_forms_campaign_idx on public.lead_capture_forms(campaign_id, created_at desc);

create table if not exists public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  platform text not null, -- tiktok | youtube_shorts | facebook | instagram | google_display | linkedin | etc
  format text not null default 'short_video', -- short_video | image | carousel | text
  status text not null default 'draft', -- draft | approved | active | archived
  headline text,
  primary_text text,
  script_markdown text,
  media_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ad_creatives_org_idx on public.ad_creatives(organization_id, created_at desc);
create index if not exists ad_creatives_campaign_idx on public.ad_creatives(campaign_id, created_at desc);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  name text not null,
  status text not null default 'draft', -- draft | enabled | disabled
  trigger jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists automation_rules_org_idx on public.automation_rules(organization_id, created_at desc);
create index if not exists automation_rules_campaign_idx on public.automation_rules(campaign_id, created_at desc);

create table if not exists public.campaign_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  status text not null default 'draft', -- draft | published | archived
  title text not null,
  recommendation_markdown text,
  recommendation_json jsonb not null default '{}'::jsonb,
  created_by_agent_run_id uuid references public.agent_runs(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists campaign_recommendations_org_idx on public.campaign_recommendations(organization_id, created_at desc);
create index if not exists campaign_recommendations_campaign_idx on public.campaign_recommendations(campaign_id, created_at desc);

-- RLS
alter table public.marketing_pipeline_runs enable row level security;
alter table public.marketing_pipeline_stages enable row level security;
alter table public.marketing_pipeline_stage_outputs enable row level security;
alter table public.marketing_pipeline_stage_logs enable row level security;
alter table public.ai_worker_skills enable row level security;
alter table public.ai_worker_skill_outputs enable row level security;
alter table public.lead_capture_forms enable row level security;
alter table public.ad_creatives enable row level security;
alter table public.automation_rules enable row level security;
alter table public.campaign_recommendations enable row level security;

-- Policies (org-scoped select for members, mutate for operators)
drop policy if exists marketing_pipeline_runs_select_member on public.marketing_pipeline_runs;
create policy marketing_pipeline_runs_select_member on public.marketing_pipeline_runs
  for select using (public.is_org_member(organization_id));
drop policy if exists marketing_pipeline_runs_mutate_operator on public.marketing_pipeline_runs;
create policy marketing_pipeline_runs_mutate_operator on public.marketing_pipeline_runs
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists marketing_pipeline_stages_select_member on public.marketing_pipeline_stages;
create policy marketing_pipeline_stages_select_member on public.marketing_pipeline_stages
  for select using (public.is_org_member(organization_id));
drop policy if exists marketing_pipeline_stages_mutate_operator on public.marketing_pipeline_stages;
create policy marketing_pipeline_stages_mutate_operator on public.marketing_pipeline_stages
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists marketing_pipeline_stage_outputs_select_member on public.marketing_pipeline_stage_outputs;
create policy marketing_pipeline_stage_outputs_select_member on public.marketing_pipeline_stage_outputs
  for select using (public.is_org_member(organization_id));
drop policy if exists marketing_pipeline_stage_outputs_mutate_operator on public.marketing_pipeline_stage_outputs;
create policy marketing_pipeline_stage_outputs_mutate_operator on public.marketing_pipeline_stage_outputs
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists marketing_pipeline_stage_logs_select_member on public.marketing_pipeline_stage_logs;
create policy marketing_pipeline_stage_logs_select_member on public.marketing_pipeline_stage_logs
  for select using (public.is_org_member(organization_id));
drop policy if exists marketing_pipeline_stage_logs_mutate_operator on public.marketing_pipeline_stage_logs;
create policy marketing_pipeline_stage_logs_mutate_operator on public.marketing_pipeline_stage_logs
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists ai_worker_skills_select_member on public.ai_worker_skills;
create policy ai_worker_skills_select_member on public.ai_worker_skills
  for select using (public.is_org_member(organization_id));
drop policy if exists ai_worker_skills_mutate_operator on public.ai_worker_skills;
create policy ai_worker_skills_mutate_operator on public.ai_worker_skills
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists ai_worker_skill_outputs_select_member on public.ai_worker_skill_outputs;
create policy ai_worker_skill_outputs_select_member on public.ai_worker_skill_outputs
  for select using (public.is_org_member(organization_id));
drop policy if exists ai_worker_skill_outputs_mutate_operator on public.ai_worker_skill_outputs;
create policy ai_worker_skill_outputs_mutate_operator on public.ai_worker_skill_outputs
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists lead_capture_forms_select_member on public.lead_capture_forms;
create policy lead_capture_forms_select_member on public.lead_capture_forms
  for select using (public.is_org_member(organization_id));
drop policy if exists lead_capture_forms_mutate_operator on public.lead_capture_forms;
create policy lead_capture_forms_mutate_operator on public.lead_capture_forms
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists ad_creatives_select_member on public.ad_creatives;
create policy ad_creatives_select_member on public.ad_creatives
  for select using (public.is_org_member(organization_id));
drop policy if exists ad_creatives_mutate_operator on public.ad_creatives;
create policy ad_creatives_mutate_operator on public.ad_creatives
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists automation_rules_select_member on public.automation_rules;
create policy automation_rules_select_member on public.automation_rules
  for select using (public.is_org_member(organization_id));
drop policy if exists automation_rules_mutate_operator on public.automation_rules;
create policy automation_rules_mutate_operator on public.automation_rules
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

drop policy if exists campaign_recommendations_select_member on public.campaign_recommendations;
create policy campaign_recommendations_select_member on public.campaign_recommendations
  for select using (public.is_org_member(organization_id));
drop policy if exists campaign_recommendations_mutate_operator on public.campaign_recommendations;
create policy campaign_recommendations_mutate_operator on public.campaign_recommendations
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

commit;

