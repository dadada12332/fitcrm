-- clients.extend is only a renewal permission for the same membership already
-- owned by the client; a new/different membership requires memberships.sell.
create or replace function public.create_manual_payment(
  p_club_id uuid,
  p_client_id uuid,
  p_membership_id uuid,
  p_amount numeric,
  p_provider text,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_subscription_id uuid;
  v_duration int;
  v_visits int;
  v_price numeric;
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
begin
  if not private.has_club_permission(p_club_id, 'payments', 'create') then
    raise exception 'insufficient payment permissions';
  end if;
  if p_membership_id is not null
     and not private.has_club_permission(p_club_id, 'memberships', 'sell') then
    if not private.has_club_permission(p_club_id, 'clients', 'extend')
       or not exists (
         select 1 from public.subscriptions
         where club_id = p_club_id
           and client_id = p_client_id
           and membership_id = p_membership_id
       ) then
      raise exception 'insufficient membership permissions';
    end if;
  end if;
  if p_amount is null or p_amount <= 0 or p_provider not in ('cash', 'click', 'payme', 'uzum') then
    raise exception 'invalid payment data';
  end if;

  perform 1 from public.clients
  where id = p_client_id and club_id = p_club_id for update;
  if not found then raise exception 'client not found'; end if;

  if p_membership_id is not null then
    select duration_days, visits_limit, price
      into v_duration, v_visits, v_price
    from public.memberships
    where id = p_membership_id and club_id = p_club_id and is_active = true;
    if not found then raise exception 'membership not found'; end if;
    if p_amount is distinct from v_price then raise exception 'membership price mismatch'; end if;

    update public.subscriptions set status = 'expired'
    where club_id = p_club_id and client_id = p_client_id
      and status in ('active', 'frozen');
    insert into public.subscriptions (
      club_id, client_id, membership_id, starts_at, expires_at,
      visits_total, visits_used, status
    ) values (
      p_club_id, p_client_id, p_membership_id, v_today, v_today + v_duration,
      v_visits, 0, 'active'
    ) returning id into v_subscription_id;
  end if;

  insert into public.payments (
    club_id, client_id, subscription_id, amount, provider, status, paid_at, comment
  ) values (
    p_club_id, p_client_id, v_subscription_id, p_amount,
    p_provider::public.payment_provider, 'paid', now(), nullif(btrim(p_comment), '')
  ) returning id into v_payment_id;
  if p_membership_id is null then
    update public.clients
      set debt = greatest(0, coalesce(debt, 0) - p_amount)
    where id = p_client_id and club_id = p_club_id;
  end if;
  return v_payment_id;
end;
$$;

-- Booking status and its CRM visit are committed together.
create or replace function public.mark_class_attendance(
  p_club_id uuid,
  p_booking_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.class_bookings%rowtype;
  v_subscription_id uuid;
  v_result jsonb;
begin
  if not private.has_club_permission(p_club_id, 'schedule', 'edit')
     or not private.has_club_permission(p_club_id, 'visits', 'manual') then
    raise exception 'insufficient attendance permissions';
  end if;

  select * into v_booking from public.class_bookings
  where id = p_booking_id and club_id = p_club_id
  for update;
  if not found then raise exception 'booking not found'; end if;
  if v_booking.status::text = 'attended' then return 'already_attended'; end if;

  select id into v_subscription_id from public.subscriptions
  where club_id = p_club_id
    and client_id = v_booking.client_id
    and status = 'active'
    and (expires_at is null or expires_at >= (now() at time zone 'Asia/Tashkent')::date)
    and (visits_total is null or visits_used < visits_total)
  order by expires_at desc nulls last, created_at desc
  limit 1;

  v_result := public.record_visit(
    p_club_id,
    v_booking.client_id,
    v_subscription_id,
    'manual',
    now(),
    'Посещение группового занятия',
    false
  );

  update public.class_bookings set status = 'attended'
  where id = p_booking_id;
  return case when coalesce((v_result ->> 'duplicate')::boolean, false)
    then 'attended_existing_visit' else 'attended' end;
end;
$$;

revoke all on function public.mark_class_attendance(uuid, uuid) from public, anon;
grant execute on function public.mark_class_attendance(uuid, uuid) to authenticated;
