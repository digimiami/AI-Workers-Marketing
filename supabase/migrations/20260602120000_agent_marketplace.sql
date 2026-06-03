-- Platform agent marketplace: catalog, skills, org licenses, provisioning
begin;

create table if not exists public.agent_catalog (
  slug text primary key,
  title text not null,
  short_title text not null,
  tagline text not null default '',
  openclaw_agent_key text not null,
  description text not null default '',
  stripe_price_id text,
  monthly_price_cents int not null default 29900,
  trial_days int not null default 14,
  included_skill_keys text[] not null default '{}'::text[],
  status text not null default 'active',
  sort_order int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_skills (
  id uuid primary key default gen_random_uuid(),
  skill_key text not null unique,
  name text not null,
  category text not null default 'General',
  description text not null default '',
  markdown text not null default '',
  agent_slug text references public.agent_catalog(slug) on delete set null,
  version int not null default 1,
  status text not null default 'published',
  rating numeric(2,1) not null default 4.8,
  install_count int not null default 0,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_skills_agent_idx on public.platform_skills(agent_slug, status);
create index if not exists platform_skills_category_idx on public.platform_skills(category, status);

create table if not exists public.organization_agent_licenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_catalog_slug text not null references public.agent_catalog(slug),
  status text not null default 'pending',
  source text not null default 'stripe',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  provisioned_agent_id uuid references public.agents(id) on delete set null,
  provisioned_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, agent_catalog_slug)
);

create index if not exists org_agent_licenses_org_idx
  on public.organization_agent_licenses(organization_id, status);
create index if not exists org_agent_licenses_slug_idx
  on public.organization_agent_licenses(agent_catalog_slug);

alter table public.agent_catalog enable row level security;
alter table public.platform_skills enable row level security;
alter table public.organization_agent_licenses enable row level security;

-- Public read of active catalog + published skills (for marketing + app)
drop policy if exists agent_catalog_public_read on public.agent_catalog;
create policy agent_catalog_public_read on public.agent_catalog
  for select using (status = 'active');

drop policy if exists platform_skills_public_read on public.platform_skills;
create policy platform_skills_public_read on public.platform_skills
  for select using (status = 'published');

drop policy if exists org_agent_licenses_select on public.organization_agent_licenses;
create policy org_agent_licenses_select on public.organization_agent_licenses
  for select using (public.is_org_member(organization_id));

drop policy if exists org_agent_licenses_mutate on public.organization_agent_licenses;
create policy org_agent_licenses_mutate on public.organization_agent_licenses
  for all using (public.is_org_operator(organization_id));

-- Seed marketplace agents (maps marketing slugs → OpenClaw runtime keys)
insert into public.agent_catalog (slug, title, short_title, tagline, openclaw_agent_key, description, sort_order, included_skill_keys)
values
  ('social-media-agent', 'Social Media AI Worker', 'Social Media', 'Ship consistent social presence without burning out your team.', 'publishing_worker', 'Content, scheduling, trends, hashtags, community, analytics.', 1, array['social-scheduler', 'content-writer-pro']),
  ('youtube-agent', 'YouTube AI Worker', 'YouTube', 'From topic ideation to published videos—with SEO baked in.', 'video_worker', 'Topics, scripts, thumbnails, SEO, publishing, analytics.', 2, array['youtube-script-kit', 'seo-audit-engine']),
  ('email-agent', 'Email Marketing AI Worker', 'Email Marketing', 'Campaigns, sequences, and revenue—without the manual grind.', 'lead_nurture_worker', 'Campaigns, newsletters, segmentation, automation, A/B tests.', 3, array['email-sequence-builder', 'content-writer-pro']),
  ('seo-agent', 'SEO AI Worker', 'SEO', 'Rankings grow when research, content, and technical fixes move together.', 'content_strategist', 'Keyword research, on-page, technical audits, competitors, linking.', 4, array['seo-audit-engine', 'competitor-radar']),
  ('ads-agent', 'Advertising AI Worker', 'Advertising', 'Spend smarter across Google and Meta with creative testing built in.', 'ad_creative_worker', 'Google/Meta ads, budget optimization, creative testing, reporting.', 5, array['ads-creative-lab', 'competitor-radar']),
  ('store-agent', 'Ecommerce AI Worker', 'Ecommerce', 'Catalog velocity, inventory signals, and revenue lifts—in one worker.', 'conversion_worker', 'Product research, descriptions, inventory, orders, upsells.', 6, array['product-copy-gen', 'competitor-radar']),
  ('support-agent', 'Customer Support AI Worker', 'Customer Support', 'Resolve faster, onboard smoother, and keep sentiment visible.', 'chat_closer_worker', 'Live chat, tickets, FAQ automation, onboarding, sentiment.', 7, array['support-triage', 'sentiment-monitor']),
  ('research-agent', 'Research AI Worker', 'Research', 'Market clarity delivered as briefs—not endless browser tabs.', 'opportunity_scout', 'Market research, competitors, trends, reports, opportunities.', 8, array['competitor-radar', 'content-writer-pro']),
  ('content-agent', 'Content AI Worker', 'Content', 'Blogs, landing pages, and calendars—aligned to revenue goals.', 'content_strategist', 'Blog writing, articles, social posts, sales copy, landing pages.', 9, array['content-writer-pro', 'social-scheduler']),
  ('sales-agent', 'Sales AI Worker', 'Sales', 'Pipeline motion—from prospect research to CRM hygiene.', 'appointment_setter_worker', 'Lead gen, prospect research, outreach, follow-ups, CRM updates.', 10, array['crm-sync', 'email-sequence-builder'])
on conflict (slug) do update set
  title = excluded.title,
  short_title = excluded.short_title,
  tagline = excluded.tagline,
  openclaw_agent_key = excluded.openclaw_agent_key,
  description = excluded.description,
  sort_order = excluded.sort_order,
  included_skill_keys = excluded.included_skill_keys,
  updated_at = now();

insert into public.platform_skills (skill_key, name, category, description, markdown, agent_slug, featured)
values
  ('content-writer-pro', 'Content Writer Pro', 'Content', 'Long-form articles and brand-voice drafts.', E'# Content Writer Pro\n\nWrite on-brand content with citations and structured outlines.\n\n## Rules\n- Match brand voice from org settings\n- Cite sources when making claims\n- Output markdown with H2/H3 structure', 'content-agent', true),
  ('social-scheduler', 'Social Scheduler', 'Marketing', 'Cross-platform calendar and best-time posting.', E'# Social Scheduler\n\nPlan and queue posts across channels with UTM discipline.', 'social-media-agent', true),
  ('seo-audit-engine', 'SEO Audit Engine', 'Analytics', 'Technical crawl and prioritized fix backlog.', E'# SEO Audit Engine\n\nRun technical audits and produce dev-ready tickets.', 'seo-agent', true),
  ('ads-creative-lab', 'Ads Creative Lab', 'Marketing', 'Variant generation and hook testing.', E'# Ads Creative Lab\n\nGenerate ad variants with platform-specific specs.', 'ads-agent', true),
  ('email-sequence-builder', 'Email Sequence Builder', 'Automation', 'Nurture flows with branching and wait steps.', E'# Email Sequence Builder\n\nBuild nurture sequences with approval gates on send.', 'email-agent', false),
  ('crm-sync', 'CRM Sync', 'Sales', 'Bi-directional lead updates and activity logging.', E'# CRM Sync\n\nSync leads, stages, and notes with your CRM.', 'sales-agent', false),
  ('support-triage', 'Support Triage', 'Support', 'Intent classification and priority scoring.', E'# Support Triage\n\nClassify tickets and suggest macros.', 'support-agent', true),
  ('product-copy-gen', 'Product Copy Gen', 'Ecommerce', 'SKU-aware product descriptions.', E'# Product Copy Gen\n\nWrite unique PDP copy per variant.', 'store-agent', false),
  ('youtube-script-kit', 'YouTube Script Kit', 'Content', 'Hook-first outlines and retention beats.', E'# YouTube Script Kit\n\nScript with hooks, chapters, and B-roll notes.', 'youtube-agent', true),
  ('competitor-radar', 'Competitor Radar', 'Analytics', 'Pricing moves and positioning diffs.', E'# Competitor Radar\n\nTrack competitor offers, ads, and content gaps.', 'research-agent', false),
  ('workflow-orchestrator', 'Workflow Orchestrator', 'Automation', 'Multi-agent handoffs and approval gates.', E'# Workflow Orchestrator\n\nChain workers with SLAs and human gates.', null, true),
  ('sentiment-monitor', 'Sentiment Monitor', 'Support', 'Real-time tone scoring across channels.', E'# Sentiment Monitor\n\nAlert on negative sentiment trends.', 'support-agent', false)
on conflict (skill_key) do nothing;

commit;
