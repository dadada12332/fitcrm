-- 0055: Prevent public and cross-tenant execution of privileged RPCs.
-- Reader and inventory functions can rely on existing table RLS, so run them
-- as the caller. Bootstrap/trigger/platform functions keep definer privileges
-- but are exposed only to the role that actually invokes them.

alter function public.clients_page(uuid, text, text[], text[], text[], text, integer, integer) security invoker;
alter function public.clients_stats(uuid) security invoker;
alter function public.get_payments_kpi(uuid) security invoker;
alter function public.get_visits_kpi(uuid) security invoker;
alter function public.payments_page(uuid, text, timestamptz, text, text, text, integer, integer) security invoker;
alter function public.visits_page(uuid, text, timestamptz, timestamptz, text, text, integer, integer) security invoker;
alter function public.product_sales_counts(uuid, timestamptz) security invoker;
alter function public.reports_alerts(uuid, timestamptz) security invoker;
alter function public.reports_clients(uuid, timestamptz, timestamptz, timestamptz, timestamptz) security invoker;
alter function public.reports_debts(uuid) security invoker;
alter function public.reports_finance(uuid, timestamptz, timestamptz, timestamptz, timestamptz) security invoker;
alter function public.reports_renewals(uuid, timestamptz) security invoker;
alter function public.reports_sales(uuid, timestamptz, timestamptz) security invoker;
alter function public.reports_staff(uuid) security invoker;
alter function public.reports_visits(uuid, timestamptz, timestamptz, timestamptz, timestamptz, text) security invoker;
alter function public.increment_inventory(uuid, numeric, uuid) security invoker;
alter function public.decrement_inventory(uuid, numeric, uuid) security invoker;

revoke all on function public.clients_page(uuid, text, text[], text[], text[], text, integer, integer) from public, anon;
revoke all on function public.clients_stats(uuid) from public, anon;
revoke all on function public.get_payments_kpi(uuid) from public, anon;
revoke all on function public.get_visits_kpi(uuid) from public, anon;
revoke all on function public.payments_page(uuid, text, timestamptz, text, text, text, integer, integer) from public, anon;
revoke all on function public.visits_page(uuid, text, timestamptz, timestamptz, text, text, integer, integer) from public, anon;
revoke all on function public.product_sales_counts(uuid, timestamptz) from public, anon;
revoke all on function public.reports_alerts(uuid, timestamptz) from public, anon;
revoke all on function public.reports_clients(uuid, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;
revoke all on function public.reports_debts(uuid) from public, anon;
revoke all on function public.reports_finance(uuid, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon;
revoke all on function public.reports_renewals(uuid, timestamptz) from public, anon;
revoke all on function public.reports_sales(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.reports_staff(uuid) from public, anon;
revoke all on function public.reports_visits(uuid, timestamptz, timestamptz, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.increment_inventory(uuid, numeric, uuid) from public, anon;
revoke all on function public.decrement_inventory(uuid, numeric, uuid) from public, anon;

grant execute on function public.clients_page(uuid, text, text[], text[], text[], text, integer, integer) to authenticated;
grant execute on function public.clients_stats(uuid) to authenticated;
grant execute on function public.get_payments_kpi(uuid) to authenticated;
grant execute on function public.get_visits_kpi(uuid) to authenticated;
grant execute on function public.payments_page(uuid, text, timestamptz, text, text, text, integer, integer) to authenticated;
grant execute on function public.visits_page(uuid, text, timestamptz, timestamptz, text, text, integer, integer) to authenticated;
grant execute on function public.product_sales_counts(uuid, timestamptz) to authenticated;
grant execute on function public.reports_alerts(uuid, timestamptz) to authenticated;
grant execute on function public.reports_clients(uuid, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;
grant execute on function public.reports_debts(uuid) to authenticated;
grant execute on function public.reports_finance(uuid, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated;
grant execute on function public.reports_renewals(uuid, timestamptz) to authenticated;
grant execute on function public.reports_sales(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.reports_staff(uuid) to authenticated;
grant execute on function public.reports_visits(uuid, timestamptz, timestamptz, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.increment_inventory(uuid, numeric, uuid) to authenticated;
grant execute on function public.decrement_inventory(uuid, numeric, uuid) to authenticated;

-- Authenticated bootstrap functions retain definer privileges, but anonymous
-- callers and PUBLIC must never invoke them directly.
revoke all on function public.create_club(text, text) from public, anon;
grant execute on function public.create_club(text, text) to authenticated;
revoke all on function public.create_default_club_roles(uuid) from public, anon;
grant execute on function public.create_default_club_roles(uuid) to authenticated;
revoke all on function public.user_club_ids() from public, anon;
grant execute on function public.user_club_ids() to authenticated;

-- Platform aggregation is called only through the service client.
revoke all on function public.platform_clubs_metrics(uuid[]) from public, anon, authenticated;
grant execute on function public.platform_clubs_metrics(uuid[]) to service_role;

-- Trigger functions are invoked by Postgres, never through the Data API.
revoke all on function public.enforce_staff_no_escalation() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.support_touch_ticket() from public, anon, authenticated;
revoke all on function public.trigger_create_default_club_roles() from public, anon, authenticated;
