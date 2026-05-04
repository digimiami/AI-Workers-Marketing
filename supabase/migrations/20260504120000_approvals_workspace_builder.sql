-- Approvals: columns used by create_approval_item / pipeline (avoid missing-column crashes).
-- Note: status + created_at already exist on public.approvals (approval_status enum + timestamptz).

alter table public.approvals
  add column if not exists target_entity_id uuid,
  add column if not exists target_entity_type text,
  add column if not exists action text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;
