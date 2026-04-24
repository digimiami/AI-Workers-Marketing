-- Older deployments may predate init.sql's campaigns.metadata column.
-- Idempotent: safe on databases that already have metadata from 20260415220000_init.sql.

alter table public.campaigns
  add column if not exists metadata jsonb default '{}'::jsonb;

update public.campaigns
set metadata = coalesce(metadata, '{}'::jsonb)
where metadata is null;

alter table public.campaigns
  alter column metadata set default '{}'::jsonb;

alter table public.campaigns
  alter column metadata set not null;
