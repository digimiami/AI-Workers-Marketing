-- Org-scoped cloud API tokens for machine clients (OpenClaw, agents).
-- Plain tokens are never stored; only SHA-256 hex of the secret.
-- Access from app server via service role only (RLS enabled, no client policies).

create table if not exists public.organization_cloud_api_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null default 'Cloud API',
  token_hash text not null,
  token_prefix text not null,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz,
  expires_at timestamptz
);

create unique index if not exists organization_cloud_api_tokens_hash_active_uidx
  on public.organization_cloud_api_tokens (token_hash)
  where revoked_at is null;

create index if not exists organization_cloud_api_tokens_org_idx
  on public.organization_cloud_api_tokens (organization_id);

alter table public.organization_cloud_api_tokens enable row level security;

comment on table public.organization_cloud_api_tokens is
  'Bearer tokens for POST /api/v1/cloud/tools/run and /api/openclaw/tools/run; verified server-side with service role.';
