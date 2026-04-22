-- Phase 4: Review/deploy states + richer approval context targets
begin;

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

-- Content review lifecycle (separate from content_status which is pipeline)
alter table public.content_assets add column if not exists review_status public.review_status not null default 'draft';
create index if not exists content_assets_review_status_idx on public.content_assets(organization_id, review_status, created_at desc);

-- Email review lifecycle
alter table public.email_templates add column if not exists status text not null default 'draft';
alter table public.email_templates add column if not exists review_status public.review_status not null default 'draft';
create index if not exists email_templates_review_status_idx on public.email_templates(organization_id, review_status, created_at desc);

alter table public.email_sequences add column if not exists review_status public.review_status not null default 'draft';
create index if not exists email_sequences_review_status_idx on public.email_sequences(organization_id, review_status, created_at desc);

-- Tracking links (affiliate CTA activation)
alter table public.affiliate_links add column if not exists review_status public.review_status not null default 'draft';
create index if not exists affiliate_links_review_status_idx on public.affiliate_links(organization_id, review_status, created_at desc);

-- Approvals: optional target pointer for downstream state transitions
alter table public.approvals add column if not exists target_entity_type text;
alter table public.approvals add column if not exists target_entity_id uuid;
create index if not exists approvals_target_idx on public.approvals(organization_id, target_entity_type, target_entity_id);

commit;

