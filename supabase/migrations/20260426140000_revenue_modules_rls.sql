-- Optional repair: applies RLS only when revenue-module tables already exist.
-- Primary definition lives in 20260426130000_revenue_modules_chat_appointments_ads_reports.sql
-- (policies must not run before CREATE TABLE — running only this file caused 42P01).

do $body$
begin
  if to_regclass('public.chat_conversations') is not null then
    execute 'alter table public.chat_conversations enable row level security';
    execute 'drop policy if exists chat_conversations_select_member on public.chat_conversations';
    execute $p$create policy chat_conversations_select_member on public.chat_conversations
      for select using (public.is_org_member(organization_id))$p$;
    execute 'drop policy if exists chat_conversations_mutate_operator on public.chat_conversations';
    execute $p$create policy chat_conversations_mutate_operator on public.chat_conversations
      for all using (public.is_org_operator(organization_id))
      with check (public.is_org_operator(organization_id))$p$;
  end if;

  if to_regclass('public.chat_messages') is not null then
    execute 'alter table public.chat_messages enable row level security';
    execute 'drop policy if exists chat_messages_select_member on public.chat_messages';
    execute $p$create policy chat_messages_select_member on public.chat_messages
      for select using (public.is_org_member(organization_id))$p$;
    execute 'drop policy if exists chat_messages_mutate_operator on public.chat_messages';
    execute $p$create policy chat_messages_mutate_operator on public.chat_messages
      for all using (public.is_org_operator(organization_id))
      with check (public.is_org_operator(organization_id))$p$;
  end if;

  if to_regclass('public.appointments') is not null then
    execute 'alter table public.appointments enable row level security';
    execute 'drop policy if exists appointments_select_member on public.appointments';
    execute $p$create policy appointments_select_member on public.appointments
      for select using (public.is_org_member(organization_id))$p$;
    execute 'drop policy if exists appointments_mutate_operator on public.appointments';
    execute $p$create policy appointments_mutate_operator on public.appointments
      for all using (public.is_org_operator(organization_id))
      with check (public.is_org_operator(organization_id))$p$;
  end if;

  if to_regclass('public.booking_logs') is not null then
    execute 'alter table public.booking_logs enable row level security';
    execute 'drop policy if exists booking_logs_select_member on public.booking_logs';
    execute $p$create policy booking_logs_select_member on public.booking_logs
      for select using (public.is_org_member(organization_id))$p$;
    execute 'drop policy if exists booking_logs_mutate_operator on public.booking_logs';
    execute $p$create policy booking_logs_mutate_operator on public.booking_logs
      for all using (public.is_org_operator(organization_id))
      with check (public.is_org_operator(organization_id))$p$;
  end if;

  if to_regclass('public.ad_creative_generations') is not null then
    execute 'alter table public.ad_creative_generations enable row level security';
    execute 'drop policy if exists ad_creative_generations_select_member on public.ad_creative_generations';
    execute $p$create policy ad_creative_generations_select_member on public.ad_creative_generations
      for select using (public.is_org_member(organization_id))$p$;
    execute 'drop policy if exists ad_creative_generations_mutate_operator on public.ad_creative_generations';
    execute $p$create policy ad_creative_generations_mutate_operator on public.ad_creative_generations
      for all using (public.is_org_operator(organization_id))
      with check (public.is_org_operator(organization_id))$p$;
  end if;

  if to_regclass('public.weekly_reports') is not null then
    execute 'alter table public.weekly_reports enable row level security';
    execute 'drop policy if exists weekly_reports_select_member on public.weekly_reports';
    execute $p$create policy weekly_reports_select_member on public.weekly_reports
      for select using (public.is_org_member(organization_id))$p$;
    execute 'drop policy if exists weekly_reports_mutate_operator on public.weekly_reports';
    execute $p$create policy weekly_reports_mutate_operator on public.weekly_reports
      for all using (public.is_org_operator(organization_id))
      with check (public.is_org_operator(organization_id))$p$;
  end if;

  if to_regclass('public.report_deliveries') is not null then
    execute 'alter table public.report_deliveries enable row level security';
    execute 'drop policy if exists report_deliveries_select_member on public.report_deliveries';
    execute $p$create policy report_deliveries_select_member on public.report_deliveries
      for select using (public.is_org_member(organization_id))$p$;
    execute 'drop policy if exists report_deliveries_mutate_operator on public.report_deliveries';
    execute $p$create policy report_deliveries_mutate_operator on public.report_deliveries
      for all using (public.is_org_operator(organization_id))
      with check (public.is_org_operator(organization_id))$p$;
  end if;

  if to_regclass('public.worker_metrics') is not null then
    execute 'alter table public.worker_metrics enable row level security';
    execute 'drop policy if exists worker_metrics_select_member on public.worker_metrics';
    execute $p$create policy worker_metrics_select_member on public.worker_metrics
      for select using (public.is_org_member(organization_id))$p$;
    execute 'drop policy if exists worker_metrics_mutate_operator on public.worker_metrics';
    execute $p$create policy worker_metrics_mutate_operator on public.worker_metrics
      for all using (public.is_org_operator(organization_id))
      with check (public.is_org_operator(organization_id))$p$;
  end if;
end
$body$;
