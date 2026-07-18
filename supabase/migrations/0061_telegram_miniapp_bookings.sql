-- Atomic booking operations used by both CRM and Telegram Mini App. These
-- functions are service-only: permission checks remain in CRM Server Actions,
-- while Mini App identity is verified against Telegram initData server-side.

create or replace function public.telegram_book_class(
  p_club_id uuid,
  p_client_id uuid,
  p_class_id uuid
) returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_class public.classes%rowtype;
  v_subscription_id uuid;
  v_booked integer;
begin
  if not exists (
    select 1 from public.clients
    where id = p_client_id and club_id = p_club_id
  ) then
    return 'client_not_found';
  end if;

  select * into v_class
  from public.classes
  where id = p_class_id and club_id = p_club_id
  for update;

  if not found or v_class.status <> 'scheduled' then
    return 'class_not_found';
  end if;
  if (v_class.date + v_class.start_time) <= (now() at time zone 'Asia/Tashkent') then
    return 'class_started';
  end if;

  if exists (
    select 1 from public.class_bookings
    where club_id = p_club_id and class_id = p_class_id
      and client_id = p_client_id and status in ('booked', 'attended')
  ) then
    return 'already_booked';
  end if;

  select id into v_subscription_id
  from public.subscriptions
  where club_id = p_club_id and client_id = p_client_id
    and status = 'active'
    and starts_at <= current_date
    and (expires_at is null or expires_at >= current_date)
    and (visits_total is null or visits_used < visits_total)
  order by expires_at desc nulls first
  limit 1;

  if v_subscription_id is null then
    return 'no_active_subscription';
  end if;

  select count(*) into v_booked
  from public.class_bookings
  where club_id = p_club_id and class_id = p_class_id
    and status in ('booked', 'attended');

  if v_class.seats_total > 0 and v_booked >= v_class.seats_total then
    update public.classes set seats_booked = v_booked where id = p_class_id;
    return 'full';
  end if;

  insert into public.class_bookings (
    club_id, class_id, client_id, subscription_id, status
  ) values (
    p_club_id, p_class_id, p_client_id, v_subscription_id, 'booked'
  );

  update public.classes
  set seats_booked = v_booked + 1
  where id = p_class_id and club_id = p_club_id;

  return 'booked';
end;
$$;

create or replace function public.telegram_cancel_class_booking(
  p_club_id uuid,
  p_client_id uuid,
  p_booking_id uuid
) returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_booking public.class_bookings%rowtype;
  v_booked integer;
begin
  select * into v_booking
  from public.class_bookings
  where id = p_booking_id and club_id = p_club_id and client_id = p_client_id
  for update;

  if not found then
    return 'booking_not_found';
  end if;
  if v_booking.status = 'attended' then
    return 'already_attended';
  end if;
  if v_booking.status = 'cancelled' then
    return 'cancelled';
  end if;

  update public.class_bookings
  set status = 'cancelled'
  where id = p_booking_id;

  select count(*) into v_booked
  from public.class_bookings
  where club_id = p_club_id and class_id = v_booking.class_id
    and status in ('booked', 'attended');

  update public.classes
  set seats_booked = v_booked
  where id = v_booking.class_id and club_id = p_club_id;

  return 'cancelled';
end;
$$;

revoke all on function public.telegram_book_class(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.telegram_cancel_class_booking(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.telegram_book_class(uuid, uuid, uuid) to service_role;
grant execute on function public.telegram_cancel_class_booking(uuid, uuid, uuid) to service_role;
