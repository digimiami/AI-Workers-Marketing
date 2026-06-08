-- Allow authenticated clients to call membership helpers from API routes.
begin;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_operator(uuid) to authenticated;

commit;
