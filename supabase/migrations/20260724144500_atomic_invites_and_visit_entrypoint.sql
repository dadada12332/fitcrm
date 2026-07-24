-- Visit rows must only be created by the locked record_visit RPC (or a trusted
-- service import after its Server Action permission preflight).
revoke insert on public.visits from authenticated;

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
  v_manual_allowed boolean;
begin
  v_manual_allowed := private.has_club_permission(p_club_id, 'visits', 'manual');
  if p_checked_in_at is not null then
    if not v_manual_allowed then raise exception 'insufficient manual visit permissions'; end if;
  elsif not private.has_club_permission(p_club_id, 'visits', 'checkin') then
    raise exception 'insufficient checkin permissions';
  end if;
  if p_force and not v_manual_allowed then
    raise exception 'manual visit permission required to override duplicate';
  end if;
  if p_subscription_id is null and not v_manual_allowed then
    raise exception 'active subscription required';
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
    update public.subscriptions set visits_used = visits_used + 1
    where id = p_subscription_id;
    v_visits_left := v_sub.visits_total - v_sub.visits_used - 1;
  end if;

  return jsonb_build_object('ok', true, 'visits_left', v_visits_left);
end;
$$;

-- Claiming an email-less invitation is one-use even under concurrent requests.
-- The same transaction locks the token, validates the recipient and creates
-- the staff membership before marking the invitation accepted.
create or replace function public.accept_staff_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.staff_invitations%rowtype;
  v_uid uuid := (select auth.uid());
  v_email text;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  select lower(email) into v_email from auth.users where id = v_uid;

  select * into v_invite
  from public.staff_invitations
  where token = p_token
  for update;
  if not found then raise exception 'invitation not found'; end if;
  if v_invite.accepted_at is not null then raise exception 'invitation already accepted'; end if;
  if v_invite.expires_at < now() then raise exception 'invitation expired'; end if;
  if v_invite.email is not null and lower(v_invite.email) is distinct from v_email then
    raise exception 'invitation belongs to another user';
  end if;
  if v_invite.role = 'owner' and not exists (
    select 1 from public.staff
    where club_id = v_invite.club_id
      and user_id = v_invite.invited_by
      and role = 'owner'
      and is_active = true
  ) then
    raise exception 'invalid owner invitation';
  end if;

  update public.staff
    set role = v_invite.role, is_active = true
  where club_id = v_invite.club_id and user_id = v_uid;
  if not found then
    insert into public.staff (club_id, user_id, role, is_active)
    values (v_invite.club_id, v_uid, v_invite.role, true);
  end if;

  update public.staff_invitations
    set accepted_at = now()
  where id = v_invite.id;
  return v_invite.club_id;
end;
$$;

revoke all on function public.accept_staff_invitation(text) from public, anon;
grant execute on function public.accept_staff_invitation(text) to authenticated;
