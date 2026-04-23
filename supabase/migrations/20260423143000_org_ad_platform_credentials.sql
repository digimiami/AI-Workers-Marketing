-- Org-scoped ad platform credentials (encrypted at application layer).
-- Stored as JSON blobs (ciphertext + iv + tag), never plaintext.

create table if not exists public.organization_platform_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null, -- facebook | google_ads | tiktok
  encrypted jsonb not null default '{}'::jsonb,
  status jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, platform)
);

create index if not exists organization_platform_credentials_org_idx
  on public.organization_platform_credentials(organization_id);

alter table public.organization_platform_credentials enable row level security;

-- Only allow operators to read/write their org’s rows (still encrypted).
drop policy if exists org_platform_creds_select_member on public.organization_platform_credentials;
create policy org_platform_creds_select_member on public.organization_platform_credentials
  for select using (public.is_org_member(organization_id));

drop policy if exists org_platform_creds_mutate_operator on public.organization_platform_credentials;
create policy org_platform_creds_mutate_operator on public.organization_platform_credentials
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

comment on table public.organization_platform_credentials is
  'Encrypted ad platform credentials per org. Decrypt only on server; never expose plaintext to clients.';

