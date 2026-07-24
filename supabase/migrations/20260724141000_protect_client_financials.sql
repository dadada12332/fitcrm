-- Client balance/debt and QR identity are not part of generic clients.view.
-- Server components fetch finance through service-role only after permission
-- checks; list/dashboard RPCs are no longer callable from the Data API.
revoke select on public.clients from authenticated;
grant select (
  id,
  club_id,
  full_name,
  phone,
  telegram_id,
  photo_url,
  tags,
  notes,
  created_at,
  gender,
  birth_date,
  email,
  source,
  trainer_name,
  trainer_id,
  phone_normalized,
  import_data,
  email_normalized
) on public.clients to authenticated;

revoke execute on function public.clients_page(
  uuid, text, text[], text[], text[], text, integer, integer
) from authenticated;
revoke execute on function public.clients_stats(uuid) from authenticated;
grant execute on function public.clients_page(
  uuid, text, text[], text[], text[], text, integer, integer
) to service_role;
grant execute on function public.clients_stats(uuid) to service_role;

revoke execute on function public.get_dashboard_stats(uuid) from authenticated;
grant execute on function public.get_dashboard_stats(uuid) to service_role;

create or replace function public.enforce_clients_financial_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return new; end if;
  if tg_op = 'INSERT' then
    new.qr_token := null;
    new.telegram_id := null;
    if not (
      private.has_club_permission(new.club_id, 'dashboard', 'view_finance')
      or private.has_club_permission(new.club_id, 'payments', 'create')
    ) then
      new.balance := 0;
      new.debt := 0;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.qr_token is distinct from old.qr_token
       or new.telegram_id is distinct from old.telegram_id then
      raise exception 'client identity fields are managed by trusted services';
    end if;
    if (new.balance is distinct from old.balance or new.debt is distinct from old.debt)
       and not (
         private.has_club_permission(new.club_id, 'dashboard', 'view_finance')
         or private.has_club_permission(new.club_id, 'payments', 'create')
       ) then
      raise exception 'financial client fields require finance permission';
    end if;
  end if;
  return new;
end;
$$;
