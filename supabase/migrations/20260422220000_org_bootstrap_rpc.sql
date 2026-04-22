-- Allow safe organization creation under RLS via RPC
begin;

create or replace function public.create_organization_with_owner(
  org_name text,
  org_slug text
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  insert into public.organizations(name, slug)
  values (org_name, org_slug)
  returning * into new_org;

  insert into public.organization_members(organization_id, user_id, role)
  values (new_org.id, auth.uid(), 'admin');

  return new_org;
end;
$$;

revoke all on function public.create_organization_with_owner(text, text) from public;
grant execute on function public.create_organization_with_owner(text, text) to authenticated;

commit;

