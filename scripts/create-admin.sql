-- Create (or fetch) an organization and grant an existing Supabase Auth user admin role.
--
-- IMPORTANT:
-- - Supabase Auth users (email/password) cannot be created via plain SQL in hosted Supabase.
--   Create the user first via Supabase Auth UI or Admin API, then paste their auth.users.id below.
--
-- Usage:
-- 1) In Supabase Dashboard → Authentication → Users → copy the user UID (auth.users.id)
-- 2) Replace the placeholders below
-- 3) Run in Supabase SQL editor

do $$
declare
  v_email text := 'digimiami@gmail.com';
  v_user_id uuid := '58475e33-50e4-440a-a874-107d34b01795'; -- TODO: paste auth.users.id
  v_org_name text := 'AiWorkers.vip';
  v_org_id uuid;
begin
  if v_user_id = '58475e33-50e4-440a-a874-107d34b01795'::uuid then
    raise exception 'Set v_user_id to the auth.users.id for %', v_email;
  end if;

  -- Create org if missing (or fetch existing)
  insert into public.organizations (name)
  values (v_org_name)
  on conflict (name) do update set name = excluded.name
  returning id into v_org_id;

  if v_org_id is null then
    select id into v_org_id
    from public.organizations
    where name = v_org_name
    limit 1;
  end if;

  -- Upsert membership as admin
  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, v_user_id, 'admin')
  on conflict (organization_id, user_id)
  do update set role = 'admin';

  raise notice 'OK: granted admin. org_id=%, user_id=%', v_org_id, v_user_id;
end $$;

