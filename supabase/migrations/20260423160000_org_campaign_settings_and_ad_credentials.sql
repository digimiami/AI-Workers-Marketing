-- Org-scoped campaign + ads settings (limits, pixel id, timezone) and encrypted ad credentials.

create table if not exists public.organization_campaign_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  monthly_budget_cents int,
  daily_spend_limit_cents int,
  default_pixel_id text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

alter table public.organization_campaign_settings enable row level security;

drop policy if exists org_campaign_settings_select_member on public.organization_campaign_settings;
create policy org_campaign_settings_select_member on public.organization_campaign_settings
  for select using (public.is_org_member(organization_id));

drop policy if exists org_campaign_settings_mutate_operator on public.organization_campaign_settings;
create policy org_campaign_settings_mutate_operator on public.organization_campaign_settings
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

-- Encrypted platform tokens/credentials (application-layer encryption).
-- Prefer this table name going forward; it replaces organization_platform_credentials.
create table if not exists public.organization_ad_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null, -- facebook | google_ads | tiktok
  encrypted jsonb not null default '{}'::jsonb,
  status jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, platform)
);

create index if not exists organization_ad_credentials_org_idx
  on public.organization_ad_credentials(organization_id);

alter table public.organization_ad_credentials enable row level security;

drop policy if exists org_ad_creds_select_member on public.organization_ad_credentials;
create policy org_ad_creds_select_member on public.organization_ad_credentials
  for select using (public.is_org_member(organization_id));

drop policy if exists org_ad_creds_mutate_operator on public.organization_ad_credentials;
create policy org_ad_creds_mutate_operator on public.organization_ad_credentials
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

comment on table public.organization_campaign_settings is
  'Org-level campaign defaults and spend limits (non-sensitive).';

comment on table public.organization_ad_credentials is
  'Encrypted ad platform credentials per org. Decrypt only on server; never expose plaintext to clients.';

