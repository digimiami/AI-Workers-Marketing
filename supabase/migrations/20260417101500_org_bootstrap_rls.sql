-- Allow authenticated users to create an organization and bootstrap themselves as its first admin.
-- This is required for /admin/onboarding create workspace flow.

begin;

-- Organizations: allow authenticated inserts
drop policy if exists org_insert_authenticated on public.organizations;
create policy org_insert_authenticated on public.organizations
  for insert
  to authenticated
  with check (true);

-- Organization members: allow a user to insert themselves as admin for a new org
drop policy if exists org_members_insert_self_admin on public.organization_members;
create policy org_members_insert_self_admin on public.organization_members
  for insert
  to authenticated
  with check (user_id = auth.uid() and role = 'admin');

commit;

