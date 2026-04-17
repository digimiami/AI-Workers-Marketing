-- Fix RLS recursion around organization membership checks.
-- The previous policies used `public.is_org_member()` which queried `organization_members`,
-- while `organization_members` policies also called `public.is_org_member()` => recursion/500s.

begin;

-- Make membership helpers SECURITY DEFINER so they can safely query membership
-- without being subject to the caller's RLS evaluation recursion.
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_operator(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.role in ('admin','operator')
  );
$$;

-- organization_members: avoid calling is_org_member() inside org_members policies (recursion source)
drop policy if exists org_members_select_member on public.organization_members;
create policy org_members_select_member on public.organization_members
  for select
  using (user_id = auth.uid());

drop policy if exists org_members_update_operator on public.organization_members;
create policy org_members_update_operator on public.organization_members
  for update
  using (public.is_org_operator(organization_id));

drop policy if exists org_members_delete_operator on public.organization_members;
create policy org_members_delete_operator on public.organization_members
  for delete
  using (public.is_org_operator(organization_id));

-- Keep operator insert policy (bootstrap policy added separately) but ensure it uses the definer helper.
drop policy if exists org_members_mutate_operator on public.organization_members;
create policy org_members_mutate_operator on public.organization_members
  for insert
  with check (public.is_org_operator(organization_id));

commit;

