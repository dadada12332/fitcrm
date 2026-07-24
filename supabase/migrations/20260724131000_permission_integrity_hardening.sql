-- Close the remaining privilege and integrity gaps after granular RLS rollout.

-- Permissions in Postgres must be the intersection of the employee role and
-- the active plan, just like getCurrentClub() in the application.
create or replace function private.has_club_permission(
  p_club_id uuid,
  p_module text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_plan_id uuid;
  v_role_allowed boolean := false;
  v_plan_allowed boolean := true;
  v_section text;
  v_feature text;
begin
  select s.role, c.plan_id
    into v_role, v_plan_id
  from public.staff s
  join public.clubs c on c.id = s.club_id
  where s.club_id = p_club_id
    and s.user_id = (select auth.uid())
    and s.is_active = true
  order by (s.role = 'owner') desc
  limit 1;

  if v_role is null then
    return false;
  end if;

  if v_role = 'owner' then
    v_role_allowed := true;
  else
    select coalesce((cr.permissions #>> array[p_module, p_action])::boolean, false)
      into v_role_allowed
    from public.club_roles cr
    where cr.club_id = p_club_id and cr.key = v_role
    limit 1;
  end if;

  if not coalesce(v_role_allowed, false) then
    return false;
  end if;

  if v_plan_id is null then
    return true;
  end if;

  v_section := case
    when p_module in ('dashboard', 'clients', 'memberships', 'payments', 'visits',
                      'schedule', 'warehouse', 'reports', 'staff', 'inbox', 'ai')
      then p_module
    when p_module = 'settings' and p_action = 'integrations' then 'integrations'
    when p_module = 'settings' and p_action = 'roles' then 'staff'
    else null
  end;

  if v_section is not null then
    select coalesce(ps.enabled, false)
      into v_plan_allowed
    from public.plan_sections ps
    where ps.plan_id = v_plan_id and ps.section_key = v_section
    limit 1;
    if not coalesce(v_plan_allowed, false) then
      return false;
    end if;
  end if;

  v_feature := case
    when p_module in ('clients', 'memberships', 'payments', 'visits', 'schedule') then 'crm'
    when p_module = 'reports' then 'reports'
    when p_module = 'warehouse' then 'warehouse'
    when p_module = 'inbox' then 'inbox'
    when p_module = 'ai' then 'ai'
    when p_module = 'telegram' then 'telegram'
    when p_action = 'export' then 'export'
    when (p_module = 'dashboard' and p_action = 'view_finance')
      or (p_module = 'payments' and p_action = 'view_revenue')
      or (p_module = 'reports' and p_action = 'finance') then 'finance'
    else null
  end;

  if v_feature is not null then
    select coalesce(pf.enabled, false)
      into v_plan_allowed
    from public.plan_features pf
    where pf.plan_id = v_plan_id and pf.feature_key = v_feature
    limit 1;
    if not coalesce(v_plan_allowed, false) then
      return false;
    end if;
  end if;

  return true;
end;
$$;

-- Inbox read access is permission-aware for every related table.
drop policy if exists client_messages_staff_read on public.client_conversation_messages;
create policy client_messages_select on public.client_conversation_messages
  for select to authenticated
  using (private.has_club_permission(club_id, 'inbox', 'view'));

drop policy if exists client_reads_staff_read on public.client_conversation_reads;
create policy client_reads_select on public.client_conversation_reads
  for select to authenticated
  using (private.has_club_permission(club_id, 'inbox', 'view'));

drop policy if exists client_templates_staff_read on public.client_reply_templates;
create policy client_templates_select on public.client_reply_templates
  for select to authenticated
  using (private.has_club_permission(club_id, 'inbox', 'view'));

-- Invalid new financial rows are rejected even if a client bypasses the UI.
alter table public.payments
  drop constraint if exists payments_amount_positive;
alter table public.payments
  add constraint payments_amount_positive check (amount > 0) not valid;

-- Every business foreign key must point to a row in the same club.
create or replace function private.reference_in_club(
  p_table text,
  p_id uuid,
  p_club_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_found boolean;
begin
  if p_id is null then
    return true;
  end if;
  if p_table not in ('clients', 'memberships', 'subscriptions', 'staff', 'rooms',
                     'schedules', 'classes', 'products', 'payments') then
    raise exception 'unsupported tenant reference table';
  end if;
  execute format(
    'select exists (select 1 from public.%I where id = $1 and club_id = $2)',
    p_table
  ) into v_found using p_id, p_club_id;
  return coalesce(v_found, false);
end;
$$;

create or replace function public.enforce_business_row_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb := to_jsonb(new);
  v_id uuid;
begin
  if v ? 'client_id' and nullif(v ->> 'client_id', '') is not null then
    v_id := (v ->> 'client_id')::uuid;
    if not private.reference_in_club('clients', v_id, new.club_id) then
      raise exception 'client belongs to another club';
    end if;
  end if;
  if v ? 'membership_id' and nullif(v ->> 'membership_id', '') is not null then
    v_id := (v ->> 'membership_id')::uuid;
    if not private.reference_in_club('memberships', v_id, new.club_id) then
      raise exception 'membership belongs to another club';
    end if;
  end if;
  if v ? 'pending_membership_id' and nullif(v ->> 'pending_membership_id', '') is not null then
    v_id := (v ->> 'pending_membership_id')::uuid;
    if not private.reference_in_club('memberships', v_id, new.club_id) then
      raise exception 'pending membership belongs to another club';
    end if;
  end if;
  if v ? 'subscription_id' and nullif(v ->> 'subscription_id', '') is not null then
    v_id := (v ->> 'subscription_id')::uuid;
    if not private.reference_in_club('subscriptions', v_id, new.club_id) then
      raise exception 'subscription belongs to another club';
    end if;
  end if;
  if v ? 'staff_id' and nullif(v ->> 'staff_id', '') is not null then
    v_id := (v ->> 'staff_id')::uuid;
    if not private.reference_in_club('staff', v_id, new.club_id) then
      raise exception 'staff belongs to another club';
    end if;
  end if;
  if v ? 'trainer_id' and nullif(v ->> 'trainer_id', '') is not null then
    v_id := (v ->> 'trainer_id')::uuid;
    if not private.reference_in_club('staff', v_id, new.club_id) then
      raise exception 'trainer belongs to another club';
    end if;
  end if;
  if v ? 'room_id' and nullif(v ->> 'room_id', '') is not null then
    v_id := (v ->> 'room_id')::uuid;
    if not private.reference_in_club('rooms', v_id, new.club_id) then
      raise exception 'room belongs to another club';
    end if;
  end if;
  if v ? 'schedule_id' and nullif(v ->> 'schedule_id', '') is not null then
    v_id := (v ->> 'schedule_id')::uuid;
    if not private.reference_in_club('schedules', v_id, new.club_id) then
      raise exception 'schedule belongs to another club';
    end if;
  end if;
  if v ? 'class_id' and nullif(v ->> 'class_id', '') is not null then
    v_id := (v ->> 'class_id')::uuid;
    if not private.reference_in_club('classes', v_id, new.club_id) then
      raise exception 'class belongs to another club';
    end if;
  end if;
  if v ? 'product_id' and nullif(v ->> 'product_id', '') is not null then
    v_id := (v ->> 'product_id')::uuid;
    if not private.reference_in_club('products', v_id, new.club_id) then
      raise exception 'product belongs to another club';
    end if;
  end if;
  if v ? 'payment_id' and nullif(v ->> 'payment_id', '') is not null then
    v_id := (v ->> 'payment_id')::uuid;
    if not private.reference_in_club('payments', v_id, new.club_id) then
      raise exception 'payment belongs to another club';
    end if;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'subscriptions', 'payments', 'visits', 'schedules', 'classes',
    'class_bookings', 'inventory', 'stock_movements'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_tenant_refs', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.enforce_business_row_tenant()',
      t || '_tenant_refs', t
    );
  end loop;
end $$;

-- Narrow field-level mutation guards for permissions that represent one action,
-- not arbitrary UPDATE access to the whole row.
create or replace function public.enforce_clients_financial_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return new; end if;
  if tg_op = 'INSERT'
     and not (
       private.has_club_permission(new.club_id, 'dashboard', 'view_finance')
       or private.has_club_permission(new.club_id, 'payments', 'create')
     ) then
    new.balance := 0;
    new.debt := 0;
  elsif tg_op = 'UPDATE'
     and (new.balance is distinct from old.balance or new.debt is distinct from old.debt)
     and not (
       private.has_club_permission(new.club_id, 'dashboard', 'view_finance')
       or private.has_club_permission(new.club_id, 'payments', 'create')
     ) then
    raise exception 'financial client fields require finance permission';
  end if;
  return new;
end;
$$;

drop trigger if exists clients_financial_fields on public.clients;
create trigger clients_financial_fields
  before insert or update on public.clients
  for each row execute function public.enforce_clients_financial_fields();

create or replace function public.enforce_subscription_update_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_core_changed boolean;
  v_visits_changed boolean;
  v_allowed_keys text[] := array[
    'id', 'club_id', 'client_id', 'membership_id', 'starts_at', 'created_at',
    'status', 'expires_at', 'visits_total', 'visits_used', 'frozen_at',
    'freeze_days_limit', 'freeze_days_used', 'freeze_started_at'
  ];
begin
  if v_uid is null then return new; end if;
  if new.club_id is distinct from old.club_id
     or new.client_id is distinct from old.client_id
     or new.membership_id is distinct from old.membership_id
     or new.starts_at is distinct from old.starts_at
     or new.created_at is distinct from old.created_at then
    raise exception 'subscription identity fields are immutable';
  end if;

  if (to_jsonb(new) - v_allowed_keys) is distinct from (to_jsonb(old) - v_allowed_keys) then
    raise exception 'unsupported direct subscription update';
  end if;

  v_core_changed :=
    new.status is distinct from old.status
    or new.expires_at is distinct from old.expires_at
    or new.visits_total is distinct from old.visits_total
    or new.frozen_at is distinct from old.frozen_at
    or new.freeze_days_limit is distinct from old.freeze_days_limit
    or new.freeze_days_used is distinct from old.freeze_days_used
    or new.freeze_started_at is distinct from old.freeze_started_at;
  v_visits_changed := new.visits_used is distinct from old.visits_used;

  if v_core_changed and not (
    private.has_club_permission(new.club_id, 'clients', 'freeze')
    or private.has_club_permission(new.club_id, 'clients', 'extend')
    or private.has_club_permission(new.club_id, 'memberships', 'sell')
    or private.has_club_permission(new.club_id, 'payments', 'create')
  ) then
    raise exception 'subscription lifecycle permission required';
  end if;
  if v_visits_changed and not (
    private.has_club_permission(new.club_id, 'visits', 'checkin')
    or private.has_club_permission(new.club_id, 'visits', 'manual')
    or private.has_club_permission(new.club_id, 'visits', 'checkout')
  ) then
    raise exception 'visit permission required';
  end if;
  return new;
end;
$$;

drop trigger if exists subscription_update_fields on public.subscriptions;
create trigger subscription_update_fields
  before update on public.subscriptions
  for each row execute function public.enforce_subscription_update_fields();

create or replace function public.enforce_payment_update_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return new; end if;
  if new.club_id is distinct from old.club_id
     or new.client_id is distinct from old.client_id
     or new.subscription_id is distinct from old.subscription_id
     or new.amount is distinct from old.amount
     or new.currency is distinct from old.currency
     or new.provider is distinct from old.provider
     or new.tx_id is distinct from old.tx_id
     or new.idempotency_key is distinct from old.idempotency_key
     or new.created_at is distinct from old.created_at then
    raise exception 'payment financial fields are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists payment_update_fields on public.payments;
create trigger payment_update_fields
  before update on public.payments
  for each row execute function public.enforce_payment_update_fields();

-- change_price is not a standalone arbitrary row editor. The existing editor
-- uses memberships.edit, so direct UPDATE is limited to that permission.
drop policy if exists memberships_update on public.memberships;
create policy memberships_update on public.memberships for update to authenticated
  using (private.has_club_permission(club_id, 'memberships', 'edit'))
  with check (private.has_club_permission(club_id, 'memberships', 'edit'));

-- Visit checkout currently has no mutable visit fields in the product; direct
-- UPDATE would only expose arbitrary row editing.
drop policy if exists visits_update on public.visits;

-- Refund changes status; it must never delete the financial record.
drop policy if exists payments_delete on public.payments;

-- Warehouse quantities are changed through checked RPCs. Direct inventory and
-- movement UPDATE/DELETE access is unnecessary.
drop policy if exists inventory_update on public.inventory;
drop policy if exists inventory_delete on public.inventory;
drop policy if exists stock_movements_update on public.stock_movements;
drop policy if exists stock_movements_delete on public.stock_movements;
drop policy if exists products_insert on public.products;
drop policy if exists products_update on public.products;
drop policy if exists products_delete on public.products;
create policy products_insert on public.products for insert to authenticated
  with check (private.has_club_permission(club_id, 'warehouse', 'supply'));
create policy products_update on public.products for update to authenticated
  using (private.has_club_permission(club_id, 'warehouse', 'supply'))
  with check (private.has_club_permission(club_id, 'warehouse', 'supply'));
create policy products_delete on public.products for delete to authenticated
  using (private.has_club_permission(club_id, 'warehouse', 'supply'));

-- Staff identity is immutable, owner rows cannot be deleted through a user JWT,
-- and assigning a role may never grant more permissions than the actor has.
create or replace function public.enforce_staff_no_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_actor_role text;
  v_actor_permissions jsonb;
  v_target_permissions jsonb;
  v_is_owner boolean := false;
begin
  if v_uid is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select s.role, cr.permissions
    into v_actor_role, v_actor_permissions
  from public.staff s
  left join public.club_roles cr on cr.club_id = s.club_id and cr.key = s.role
  where s.user_id = v_uid
    and s.club_id = coalesce(new.club_id, old.club_id)
    and s.is_active = true
  order by (s.role = 'owner') desc
  limit 1;
  v_is_owner := coalesce(v_actor_role, '') = 'owner';

  if tg_op = 'DELETE' then
    if old.role = 'owner' then
      raise exception 'owner staff row cannot be deleted';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
     and (new.user_id is distinct from old.user_id or new.club_id is distinct from old.club_id) then
    raise exception 'staff identity fields are immutable';
  end if;

  if new.role = 'owner' and not v_is_owner then
    raise exception 'only owner can assign owner role';
  end if;

  if not v_is_owner and (tg_op = 'INSERT' or new.role is distinct from old.role) then
    select cr.permissions into v_target_permissions
    from public.club_roles cr
    where cr.club_id = new.club_id and cr.key = new.role
    limit 1;
    if v_target_permissions is null
       or v_actor_permissions is null
       or not (v_actor_permissions @> v_target_permissions) then
      raise exception 'cannot assign a role with broader permissions';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.role = 'owner' and not v_is_owner then
    raise exception 'only owner can modify owner';
  end if;
  if tg_op = 'UPDATE' and new.user_id = v_uid and not v_is_owner
     and (new.role is distinct from old.role
          or (new.settings -> 'permissions') is distinct from (old.settings -> 'permissions')) then
    raise exception 'cannot escalate own permissions';
  end if;
  return new;
end;
$$;

drop trigger if exists staff_no_escalation on public.staff;
create trigger staff_no_escalation
  before insert or update or delete on public.staff
  for each row execute function public.enforce_staff_no_escalation();

drop policy if exists staff_delete on public.staff;
create policy staff_delete on public.staff for delete to authenticated
  using (
    role <> 'owner'
    and private.has_club_permission(club_id, 'staff', 'delete')
  );

-- Manual payment + optional membership sale + debt adjustment is one atomic,
-- permission-checked transaction.
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
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
begin
  if not private.has_club_permission(p_club_id, 'payments', 'create') then
    raise exception 'insufficient payment permissions';
  end if;
  if p_amount is null or p_amount <= 0 or p_provider not in ('cash', 'click', 'payme', 'uzum') then
    raise exception 'invalid payment data';
  end if;
  perform 1 from public.clients
    where id = p_client_id and club_id = p_club_id
    for update;
  if not found then raise exception 'client not found'; end if;

  if p_membership_id is not null then
    select duration_days, visits_limit
      into v_duration, v_visits
    from public.memberships
    where id = p_membership_id and club_id = p_club_id and is_active = true;
    if not found then raise exception 'membership not found'; end if;

    update public.subscriptions
      set status = 'expired'
    where club_id = p_club_id
      and client_id = p_client_id
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

revoke all on function public.create_manual_payment(uuid, uuid, uuid, numeric, text, text)
  from public, anon;
grant execute on function public.create_manual_payment(uuid, uuid, uuid, numeric, text, text)
  to authenticated;

-- Freeze/unfreeze uses a row lock, so repeated concurrent requests cannot
-- consume or extend the allowance twice.
create or replace function public.toggle_subscription_freeze(
  p_club_id uuid,
  p_client_id uuid,
  p_expected_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_allowed int := 0;
  v_remaining int;
  v_elapsed int;
  v_applied int;
begin
  if not private.has_club_permission(p_club_id, 'clients', 'freeze') then
    raise exception 'insufficient freeze permissions';
  end if;

  select s.* into v_sub
  from public.subscriptions s
  where s.club_id = p_club_id
    and s.client_id = p_client_id
    and s.status in ('active', 'frozen')
  order by s.created_at desc
  limit 1
  for update;
  if not found then raise exception 'active subscription not found'; end if;
  if v_sub.status::text <> p_expected_status then
    raise exception 'subscription status changed';
  end if;

  select greatest(0, coalesce(m.freeze_days_allowed, 0))
    into v_allowed
  from public.memberships m
  where m.id = v_sub.membership_id and m.club_id = p_club_id;
  v_remaining := greatest(0, v_allowed - greatest(0, coalesce(v_sub.freeze_days_used, 0)));

  if v_sub.status = 'active' then
    if v_remaining <= 0 then raise exception 'freeze allowance exhausted'; end if;
    update public.subscriptions
      set status = 'frozen', freeze_started_at = now()
    where id = v_sub.id;
    return jsonb_build_object('status', 'frozen');
  end if;

  v_elapsed := greatest(
    1,
    ceil(extract(epoch from (now() - coalesce(v_sub.freeze_started_at, now()))) / 86400.0)::int
  );
  v_applied := least(v_remaining, v_elapsed);
  update public.subscriptions
    set status = 'active',
        freeze_started_at = null,
        freeze_days_used = greatest(0, coalesce(freeze_days_used, 0)) + v_applied,
        expires_at = case when expires_at is null then null else expires_at + v_applied end
  where id = v_sub.id;
  return jsonb_build_object('status', 'active', 'days_applied', v_applied);
end;
$$;

revoke all on function public.toggle_subscription_freeze(uuid, uuid, text)
  from public, anon;
grant execute on function public.toggle_subscription_freeze(uuid, uuid, text)
  to authenticated;

-- Online payment activation is atomic and idempotent. Only service-role
-- callbacks may execute it.
create or replace function private.confirm_paid_membership(
  p_club_id uuid,
  p_payment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_membership public.memberships%rowtype;
  v_subscription_id uuid;
  v_expires date;
  v_name text;
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
begin
  select * into v_payment
  from public.payments
  where id = p_payment_id and club_id = p_club_id
  for update;
  if not found or v_payment.status <> 'paid' then return null; end if;

  if v_payment.subscription_id is not null then
    select s.expires_at, m.name
      into v_expires, v_name
    from public.subscriptions s
    left join public.memberships m on m.id = s.membership_id and m.club_id = s.club_id
    where s.id = v_payment.subscription_id and s.club_id = p_club_id;
  elsif v_payment.pending_membership_id is not null and v_payment.client_id is not null then
    select * into v_membership
    from public.memberships
    where id = v_payment.pending_membership_id and club_id = p_club_id;
    if not found then raise exception 'membership not found'; end if;

    update public.subscriptions
      set status = 'expired'
    where club_id = p_club_id
      and client_id = v_payment.client_id
      and status in ('active', 'frozen');

    v_expires := v_today + v_membership.duration_days;
    v_name := v_membership.name;
    insert into public.subscriptions (
      club_id, client_id, membership_id, starts_at, expires_at,
      visits_total, visits_used, status
    ) values (
      p_club_id, v_payment.client_id, v_payment.pending_membership_id,
      v_today, v_expires, v_membership.visits_limit, 0, 'active'
    ) returning id into v_subscription_id;

    update public.payments
      set subscription_id = v_subscription_id
    where id = p_payment_id and club_id = p_club_id;
  end if;

  return jsonb_build_object(
    'client_id', v_payment.client_id,
    'amount', v_payment.amount,
    'membership_name', v_name,
    'expires_at', v_expires
  );
end;
$$;

revoke all on function private.confirm_paid_membership(uuid, uuid)
  from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.confirm_paid_membership(uuid, uuid) to service_role;
