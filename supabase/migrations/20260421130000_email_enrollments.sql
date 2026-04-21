-- Lead -> email sequence enrollment and queueing

create table if not exists public.email_enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  sequence_id uuid not null references public.email_sequences(id) on delete cascade,
  status text not null default 'active', -- active | paused | completed | cancelled
  enrolled_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (lead_id, sequence_id)
);

create index if not exists email_enrollments_org_idx on public.email_enrollments(organization_id, enrolled_at desc);
create index if not exists email_enrollments_lead_idx on public.email_enrollments(lead_id, enrolled_at desc);
create index if not exists email_enrollments_sequence_idx on public.email_enrollments(sequence_id, enrolled_at desc);

alter table public.email_enrollments enable row level security;

drop policy if exists email_enrollments_select_member on public.email_enrollments;
create policy email_enrollments_select_member on public.email_enrollments
  for select using (public.is_org_member(organization_id));

drop policy if exists email_enrollments_mutate_operator on public.email_enrollments;
create policy email_enrollments_mutate_operator on public.email_enrollments
  for all using (public.is_org_operator(organization_id))
  with check (public.is_org_operator(organization_id));

