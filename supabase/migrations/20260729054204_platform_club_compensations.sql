-- Targeted club compensations managed alongside public promo codes.
-- Free days are applied immediately. Percentage discounts are consumed
-- atomically when the next platform billing request is approved.

create table if not exists public.platform_club_compensations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  benefit_type text not null check (benefit_type in ('free_days', 'discount_pct')),
  value integer not null,
  reason text not null,
  status text not null default 'active'
    check (status in ('active', 'applied', 'cancelled', 'expired')),
  expires_at timestamptz,
  applied_at timestamptz,
  billing_request_id uuid references public.platform_billing_requests(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  cancelled_by uuid references public.users(id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_club_compensations_value_check check (
    (benefit_type = 'free_days' and value between 1 and 365)
    or (benefit_type = 'discount_pct' and value between 1 and 100)
  )
);

create index if not exists platform_club_compensations_club_idx
  on public.platform_club_compensations (club_id, created_at desc);
create index if not exists platform_club_compensations_active_idx
  on public.platform_club_compensations (club_id, benefit_type, expires_at)
  where status = 'active';

alter table public.platform_club_compensations enable row level security;
revoke all on table public.platform_club_compensations from public, anon, authenticated;
grant all on table public.platform_club_compensations to service_role;

alter table public.platform_billing_requests
  add column if not exists compensation_id uuid references public.platform_club_compensations(id) on delete set null,
  add column if not exists compensation_discount_amount numeric(12,2) not null default 0;

create index if not exists platform_billing_requests_compensation_idx
  on public.platform_billing_requests (compensation_id)
  where compensation_id is not null;

create or replace function public.platform_apply_free_days_compensation(
  p_club_id uuid,
  p_days integer,
  p_reason text,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_club public.clubs%rowtype;
  v_compensation public.platform_club_compensations%rowtype;
  v_new_expiry timestamptz;
begin
  if p_days < 1 or p_days > 365 then raise exception 'compensation_invalid_value'; end if;
  if length(trim(p_reason)) < 3 then raise exception 'compensation_invalid_reason'; end if;

  select * into v_club from public.clubs where id = p_club_id for update;
  if not found then raise exception 'compensation_club_not_found'; end if;

  if v_club.plan = 'trial' then
    v_new_expiry := greatest(coalesce(v_club.trial_expires_at, now()), now()) + make_interval(days => p_days);
    update public.clubs set trial_expires_at = v_new_expiry where id = p_club_id;
  else
    v_new_expiry := greatest(coalesce(v_club.plan_expires_at, now()), now()) + make_interval(days => p_days);
    update public.clubs set plan_expires_at = v_new_expiry where id = p_club_id;
  end if;

  insert into public.platform_club_compensations (
    club_id, benefit_type, value, reason, status, applied_at, created_by
  ) values (
    p_club_id, 'free_days', p_days, trim(p_reason), 'applied', now(), p_admin_id
  ) returning * into v_compensation;

  return jsonb_build_object(
    'id', v_compensation.id,
    'club_id', p_club_id,
    'new_expiry', v_new_expiry
  );
end;
$$;

revoke all on function public.platform_apply_free_days_compensation(uuid, integer, text, uuid)
  from public, anon, authenticated;
grant execute on function public.platform_apply_free_days_compensation(uuid, integer, text, uuid)
  to service_role;

create or replace function public.platform_cancel_club_compensation(
  p_compensation_id uuid,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_compensation public.platform_club_compensations%rowtype;
  v_now timestamptz := now();
  v_detached integer := 0;
begin
  select * into v_compensation
    from public.platform_club_compensations
   where id = p_compensation_id
   for update;
  if not found or v_compensation.status <> 'active' then
    raise exception 'compensation_unavailable';
  end if;

  update public.platform_billing_requests
     set amount = coalesce(amount, 0) + compensation_discount_amount,
         compensation_id = null,
         compensation_discount_amount = 0
   where compensation_id = p_compensation_id
     and status = 'pending';
  get diagnostics v_detached = row_count;

  update public.platform_club_compensations
     set status = 'cancelled',
         cancelled_by = p_admin_id,
         cancelled_at = v_now,
         updated_at = v_now
   where id = p_compensation_id
     and status = 'active';
  if not found then raise exception 'compensation_race'; end if;

  return jsonb_build_object(
    'club_id', v_compensation.club_id,
    'detached_requests', v_detached
  );
end;
$$;

revoke all on function public.platform_cancel_club_compensation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.platform_cancel_club_compensation(uuid, uuid)
  to service_role;

create or replace function public.platform_approve_billing_request(
  p_request_id uuid,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.platform_billing_requests%rowtype;
  v_plan public.plans%rowtype;
  v_promo public.platform_promo_codes%rowtype;
  v_compensation public.platform_club_compensations%rowtype;
  v_now timestamptz := now();
  v_expires_at timestamptz;
  v_free_days integer := 0;
begin
  select * into v_request
    from public.platform_billing_requests
   where id = p_request_id
   for update;
  if not found then raise exception 'billing_request_not_found'; end if;
  if v_request.status <> 'pending' then raise exception 'billing_request_already_processed'; end if;

  select * into v_plan from public.plans
   where code = v_request.plan and is_archived = false;
  if not found then raise exception 'billing_plan_not_found'; end if;

  if v_request.promo_code_id is not null then
    select * into v_promo from public.platform_promo_codes
     where id = v_request.promo_code_id for update;
    if not found or not v_promo.is_active then raise exception 'promo_inactive'; end if;
    if v_promo.starts_at is not null and v_promo.starts_at > v_now then raise exception 'promo_not_started'; end if;
    if v_promo.expires_at is not null and v_promo.expires_at <= v_now then raise exception 'promo_expired'; end if;
    if v_promo.max_uses is not null and v_promo.used_count >= v_promo.max_uses then raise exception 'promo_exhausted'; end if;
    if cardinality(v_promo.plan_codes) > 0 and not (v_request.plan = any(v_promo.plan_codes)) then raise exception 'promo_plan_mismatch'; end if;
    v_free_days := coalesce(v_promo.free_days, 0);
  end if;

  if v_request.compensation_id is not null then
    select * into v_compensation from public.platform_club_compensations
     where id = v_request.compensation_id for update;
    if not found
      or v_compensation.club_id <> v_request.club_id
      or v_compensation.benefit_type <> 'discount_pct'
      or v_compensation.status <> 'active'
      or (v_compensation.expires_at is not null and v_compensation.expires_at <= v_now)
    then
      raise exception 'compensation_unavailable';
    end if;
  end if;

  v_expires_at := v_now
    + make_interval(months => greatest(1, v_request.months))
    + make_interval(days => v_free_days);

  update public.clubs
     set plan_id = v_plan.id,
         plan = case when v_plan.code in ('trial','starter','standard','business') then v_plan.code::public.club_plan else plan end,
         plan_price_locked = case when v_plan.is_trial then null else v_plan.price end,
         plan_currency_locked = v_plan.currency,
         plan_period_locked = v_plan.period,
         plan_assigned_at = v_now,
         plan_expires_at = case when v_plan.is_trial then null else v_expires_at end,
         trial_expires_at = case when v_plan.is_trial then v_now + make_interval(days => greatest(1, v_plan.trial_days)) else trial_expires_at end,
         status = 'active',
         suspended_at = null
   where id = v_request.club_id;
  if not found then raise exception 'billing_club_not_found'; end if;

  update public.platform_billing_requests
     set status = 'approved', resolved_at = v_now, resolved_by = p_admin_id
   where id = p_request_id and status = 'pending';
  if not found then raise exception 'billing_request_race'; end if;

  if v_request.promo_code_id is not null then
    update public.platform_promo_codes
       set used_count = used_count + 1, updated_at = v_now
     where id = v_request.promo_code_id;
    insert into public.platform_promo_redemptions (
      promo_code_id, billing_request_id, club_id, discount_amount, free_days
    ) values (
      v_request.promo_code_id, v_request.id, v_request.club_id,
      v_request.discount_amount, v_free_days
    );
  end if;

  if v_request.compensation_id is not null then
    update public.platform_club_compensations
       set status = 'applied',
           applied_at = v_now,
           billing_request_id = v_request.id,
           updated_at = v_now
     where id = v_request.compensation_id and status = 'active';
    if not found then raise exception 'compensation_race'; end if;
  end if;

  return jsonb_build_object(
    'club_id', v_request.club_id,
    'plan', v_plan.code,
    'months', v_request.months,
    'expires_at', case when v_plan.is_trial then null else v_expires_at end,
    'promo_code', v_request.promo_code,
    'discount_amount', v_request.discount_amount,
    'compensation_discount_amount', v_request.compensation_discount_amount,
    'free_days', v_free_days
  );
end;
$$;

revoke all on function public.platform_approve_billing_request(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.platform_approve_billing_request(uuid, uuid)
  to service_role;
