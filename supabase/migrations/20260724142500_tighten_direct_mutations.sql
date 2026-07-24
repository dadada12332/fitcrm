-- Final field-level tightening for direct Data API mutations.

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
     or new.pending_membership_id is distinct from old.pending_membership_id
     or new.pending_items is distinct from old.pending_items
     or new.amount is distinct from old.amount
     or new.currency is distinct from old.currency
     or new.provider is distinct from old.provider
     or new.tx_id is distinct from old.tx_id
     or new.idempotency_key is distinct from old.idempotency_key
     or new.comment is distinct from old.comment
     or new.created_at is distinct from old.created_at then
    raise exception 'payment financial fields are immutable';
  end if;
  return new;
end;
$$;

-- Freeze is performed only by the locked RPC. Visit counters have their own
-- permission path; lifecycle updates require extend/sell.
drop policy if exists subscriptions_update on public.subscriptions;
create policy subscriptions_update on public.subscriptions for update to authenticated
  using (
    private.has_club_permission(club_id, 'clients', 'extend')
    or private.has_club_permission(club_id, 'memberships', 'sell')
    or private.has_club_permission(club_id, 'visits', 'checkin')
    or private.has_club_permission(club_id, 'visits', 'manual')
    or private.has_club_permission(club_id, 'visits', 'checkout')
  )
  with check (
    private.has_club_permission(club_id, 'clients', 'extend')
    or private.has_club_permission(club_id, 'memberships', 'sell')
    or private.has_club_permission(club_id, 'visits', 'checkin')
    or private.has_club_permission(club_id, 'visits', 'manual')
    or private.has_club_permission(club_id, 'visits', 'checkout')
  );

create or replace function public.enforce_subscription_update_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_lifecycle_changed boolean;
  v_total_changed boolean;
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

  v_lifecycle_changed :=
    new.status is distinct from old.status
    or new.expires_at is distinct from old.expires_at
    or new.frozen_at is distinct from old.frozen_at
    or new.freeze_days_limit is distinct from old.freeze_days_limit
    or new.freeze_days_used is distinct from old.freeze_days_used
    or new.freeze_started_at is distinct from old.freeze_started_at;
  v_total_changed := new.visits_total is distinct from old.visits_total;
  v_visits_changed := new.visits_used is distinct from old.visits_used;

  if (v_lifecycle_changed or v_total_changed) and not (
    private.has_club_permission(new.club_id, 'clients', 'extend')
    or private.has_club_permission(new.club_id, 'memberships', 'sell')
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

-- Inventory creation is a supply operation. Movement type must match the
-- specific warehouse permission instead of any warehouse write permission.
drop policy if exists inventory_insert on public.inventory;
create policy inventory_insert on public.inventory for insert to authenticated
  with check (private.has_club_permission(club_id, 'warehouse', 'supply'));

drop policy if exists stock_movements_insert on public.stock_movements;
create policy stock_movements_insert on public.stock_movements for insert to authenticated
  with check (
    (type::text in ('in', 'return') and private.has_club_permission(club_id, 'warehouse', 'supply'))
    or (type::text = 'sale' and private.has_club_permission(club_id, 'warehouse', 'sell'))
    or (type::text = 'writeoff' and private.has_club_permission(club_id, 'warehouse', 'writeoff'))
  );

-- The visit method determines which permission is required.
drop policy if exists visits_insert on public.visits;
create policy visits_insert on public.visits for insert to authenticated
  with check (
    (method::text = 'manual' and private.has_club_permission(club_id, 'visits', 'manual'))
    or (method::text <> 'manual' and private.has_club_permission(club_id, 'visits', 'checkin'))
  );

-- Subscription and payment lifecycle mutations only happen in checked Server
-- Actions/RPCs. The browser/Data API remains read-only for these ledgers.
revoke insert, update, delete on public.subscriptions from authenticated;
revoke insert, update, delete on public.payments from authenticated;

-- Staff mutations are service-side after a granular permission check. A staff
-- member may only persist their own harmless product-onboarding timestamps.
revoke insert, update, delete on public.staff from authenticated;
grant update (product_tour_completed_at, trial_offer_last_seen_at)
  on public.staff to authenticated;
drop policy if exists staff_self_onboarding_update on public.staff;
create policy staff_self_onboarding_update on public.staff
  for update to authenticated
  using (user_id = (select auth.uid()) and is_active = true)
  with check (user_id = (select auth.uid()) and is_active = true);

-- Finance is cumulative with the module feature. Export/finance cannot be
-- skipped merely because a module already selected its primary feature.
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

  if v_role is null then return false; end if;
  if v_role = 'owner' then
    v_role_allowed := true;
  else
    select coalesce((cr.permissions #>> array[p_module, p_action])::boolean, false)
      into v_role_allowed
    from public.club_roles cr
    where cr.club_id = p_club_id and cr.key = v_role
    limit 1;
  end if;
  if not coalesce(v_role_allowed, false) then return false; end if;
  if v_plan_id is null then return true; end if;

  v_section := case
    when p_module in ('dashboard', 'clients', 'memberships', 'payments', 'visits',
                      'schedule', 'warehouse', 'reports', 'staff', 'inbox', 'ai')
      then p_module
    when p_module = 'settings' and p_action = 'integrations' then 'integrations'
    when p_module = 'settings' and p_action = 'roles' then 'staff'
    else null
  end;
  if v_section is not null then
    select coalesce(ps.enabled, false) into v_plan_allowed
    from public.plan_sections ps
    where ps.plan_id = v_plan_id and ps.section_key = v_section limit 1;
    if not coalesce(v_plan_allowed, false) then return false; end if;
  end if;

  v_feature := case
    when p_module in ('clients', 'memberships', 'payments', 'visits', 'schedule') then 'crm'
    when p_module = 'reports' then 'reports'
    when p_module = 'warehouse' then 'warehouse'
    when p_module = 'inbox' then 'inbox'
    when p_module = 'ai' then 'ai'
    when p_module = 'telegram' then 'telegram'
    else null
  end;
  if v_feature is not null then
    select coalesce(pf.enabled, false) into v_plan_allowed
    from public.plan_features pf
    where pf.plan_id = v_plan_id and pf.feature_key = v_feature limit 1;
    if not coalesce(v_plan_allowed, false) then return false; end if;
  end if;

  if p_action = 'export' then
    select coalesce(pf.enabled, false) into v_plan_allowed
    from public.plan_features pf
    where pf.plan_id = v_plan_id and pf.feature_key = 'export' limit 1;
    if not coalesce(v_plan_allowed, false) then return false; end if;
  end if;

  if (p_module = 'dashboard' and p_action = 'view_finance')
     or (p_module = 'payments' and p_action = 'view_revenue')
     or (p_module = 'reports' and p_action = 'finance') then
    select coalesce(pf.enabled, false) into v_plan_allowed
    from public.plan_features pf
    where pf.plan_id = v_plan_id and pf.feature_key = 'finance' limit 1;
    if not coalesce(v_plan_allowed, false) then return false; end if;
  end if;
  return true;
end;
$$;

-- Generic client editing never grants arbitrary balance/debt writes.
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
      or private.has_club_permission(new.club_id, 'reports', 'finance')
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
         or private.has_club_permission(new.club_id, 'reports', 'finance')
       ) then
      raise exception 'financial client fields require finance permission';
    end if;
  end if;
  return new;
end;
$$;

-- Selling a membership is an additional capability, not an implicit side
-- effect of permission to record an unrelated payment.
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
    select duration_days, visits_limit into v_duration, v_visits
    from public.memberships
    where id = p_membership_id and club_id = p_club_id and is_active = true;
    if not found then raise exception 'membership not found'; end if;
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
