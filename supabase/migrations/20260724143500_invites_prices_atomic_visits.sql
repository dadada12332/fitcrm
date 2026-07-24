-- Remove secret invitation tokens and privilege-changing writes from the Data API.
revoke all on public.staff_invitations from anon, authenticated;
grant all on public.staff_invitations to service_role;

-- Manual payment with a membership must use the current tariff price.
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
  if p_membership_id is not null and not (
    private.has_club_permission(p_club_id, 'memberships', 'sell')
    or private.has_club_permission(p_club_id, 'clients', 'extend')
  ) then
    raise exception 'insufficient membership permissions';
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

-- Check-in is one transaction: validate tenant/client/subscription, lock rows,
-- detect duplicates, create the visit, then consume a visit allowance.
create or replace function public.record_visit(
  p_club_id uuid,
  p_client_id uuid,
  p_subscription_id uuid default null,
  p_method text default 'manual',
  p_checked_in_at timestamptz default null,
  p_comment text default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz := coalesce(p_checked_in_at, now());
  v_sub public.subscriptions%rowtype;
  v_existing_at timestamptz;
  v_visits_left int;
  v_staff_id uuid;
begin
  if p_checked_in_at is null then
    if not private.has_club_permission(p_club_id, 'visits', 'checkin') then
      raise exception 'insufficient checkin permissions';
    end if;
  elsif not private.has_club_permission(p_club_id, 'visits', 'manual') then
    raise exception 'insufficient manual visit permissions';
  end if;
  if p_method not in ('manual', 'qr', 'telegram', 'turnstile') then
    raise exception 'invalid visit method';
  end if;

  perform 1 from public.clients
  where id = p_client_id and club_id = p_club_id for update;
  if not found then raise exception 'client not found'; end if;

  if not p_force then
    select checked_in_at into v_existing_at
    from public.visits
    where club_id = p_club_id
      and client_id = p_client_id
      and (checked_in_at at time zone 'Asia/Tashkent')::date
          = (v_at at time zone 'Asia/Tashkent')::date
    order by checked_in_at desc
    limit 1;
    if found then
      return jsonb_build_object('duplicate', true, 'duplicate_at', v_existing_at);
    end if;
  end if;

  if p_subscription_id is not null then
    select * into v_sub from public.subscriptions
    where id = p_subscription_id
      and club_id = p_club_id
      and client_id = p_client_id
    for update;
    if not found then raise exception 'subscription does not belong to client'; end if;
    if v_sub.status::text <> 'active' then raise exception 'subscription is not active'; end if;
    if v_sub.expires_at is not null
       and v_sub.expires_at < (v_at at time zone 'Asia/Tashkent')::date then
      raise exception 'subscription expired';
    end if;
    if v_sub.visits_total is not null and v_sub.visits_used >= v_sub.visits_total then
      raise exception 'visit limit exhausted';
    end if;
  end if;

  select id into v_staff_id from public.staff
  where club_id = p_club_id and user_id = (select auth.uid()) and is_active = true
  limit 1;

  insert into public.visits (
    club_id, client_id, subscription_id, checked_in_at,
    checked_in_by, method, staff_id, comment
  ) values (
    p_club_id, p_client_id, p_subscription_id, v_at,
    (select auth.uid()), p_method::public.visit_method, v_staff_id, nullif(btrim(p_comment), '')
  );

  if p_subscription_id is not null and v_sub.visits_total is not null then
    update public.subscriptions
      set visits_used = visits_used + 1
    where id = p_subscription_id;
    v_visits_left := v_sub.visits_total - v_sub.visits_used - 1;
  end if;

  return jsonb_build_object(
    'ok', true,
    'visits_left', v_visits_left
  );
end;
$$;

revoke all on function public.record_visit(uuid, uuid, uuid, text, timestamptz, text, boolean)
  from public, anon;
grant execute on function public.record_visit(uuid, uuid, uuid, text, timestamptz, text, boolean)
  to authenticated;
