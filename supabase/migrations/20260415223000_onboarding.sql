-- AiWorkers.vip — onboarding helpers (profile trigger + org create policies)

begin;

-- Create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', null), coalesce(new.raw_user_meta_data->>'avatar_url', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Allow authenticated user to create an organization (initial onboarding only).
drop policy if exists org_insert_authenticated on public.organizations;
create policy org_insert_authenticated on public.organizations
  for insert to authenticated
  with check (true);

-- Allow authenticated user to create their own membership row for an org they just created.
-- We keep it narrow: user_id must equal auth.uid().
drop policy if exists org_members_insert_self on public.organization_members;
create policy org_members_insert_self on public.organization_members
  for insert to authenticated
  with check (user_id = auth.uid());

commit;

