-- Promo lifecycle: targeting, quoting and atomic redemption during billing approval.

alter table public.platform_promo_codes
  add column if not exists starts_at timestamptz,
  add column if not exists plan_codes text[] not null default '{}',
  add column if not exists created_by uuid references public.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.platform_promo_codes
  drop constraint if exists platform_promo_codes_discount_pct_check,
  add constraint platform_promo_codes_discount_pct_check
    check (discount_pct is null or discount_pct between 1 and 100),
  drop constraint if exists platform_promo_codes_free_days_check,
  add constraint platform_promo_codes_free_days_check
    check (free_days is null or free_days between 1 and 365),
  drop constraint if exists platform_promo_codes_max_uses_check,
  add constraint platform_promo_codes_max_uses_check
    check (max_uses is null or max_uses > 0),
  drop constraint if exists platform_promo_codes_benefit_check,
  add constraint platform_promo_codes_benefit_check
    check (discount_pct is not null or free_days is not null);

create index if not exists platform_promo_codes_active_idx
  on public.platform_promo_codes (is_active, expires_at);

alter table public.platform_billing_requests
  add column if not exists promo_code_id uuid references public.platform_promo_codes(id) on delete set null,
  add column if not exists promo_code text,
  add column if not exists discount_amount numeric(12,2) not null default 0;

create table if not exists public.platform_promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.platform_promo_codes(id) on delete restrict,
  billing_request_id uuid not null unique references public.platform_billing_requests(id) on delete restrict,
  club_id uuid not null references public.clubs(id) on delete restrict,
  discount_amount numeric(12,2) not null default 0,
  free_days integer not null default 0,
  redeemed_at timestamptz not null default now()
);

create index if not exists platform_promo_redemptions_promo_idx
  on public.platform_promo_redemptions (promo_code_id, redeemed_at desc);

alter table public.platform_promo_redemptions enable row level security;
revoke all on table public.platform_promo_redemptions from public, anon, authenticated;
grant all on table public.platform_promo_redemptions to service_role;

create or replace function public.platform_quote_promo(
  p_code text,
  p_plan text,
  p_months integer,
  p_base_amount numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_promo public.platform_promo_codes%rowtype;
  v_discount numeric := 0;
begin
  select *
    into v_promo
    from public.platform_promo_codes
   where upper(code) = upper(trim(p_code));

  if not found then raise exception 'promo_not_found'; end if;
  if not v_promo.is_active then raise exception 'promo_inactive'; end if;
  if v_promo.starts_at is not null and v_promo.starts_at > now() then raise exception 'promo_not_started'; end if;
  if v_promo.expires_at is not null and v_promo.expires_at <= now() then raise exception 'promo_expired'; end if;
  if v_promo.max_uses is not null and v_promo.used_count >= v_promo.max_uses then raise exception 'promo_exhausted'; end if;
  if cardinality(v_promo.plan_codes) > 0 and not (p_plan = any(v_promo.plan_codes)) then raise exception 'promo_plan_mismatch'; end if;
  if p_months < 1 then raise exception 'promo_invalid_months'; end if;

  v_discount := case
    when v_promo.discount_pct is null then 0
    else round(greatest(0, p_base_amount) * v_promo.discount_pct / 100, 2)
  end;

  return jsonb_build_object(
    'id', v_promo.id,
    'code', upper(v_promo.code),
    'discount_pct', v_promo.discount_pct,
    'discount_amount', v_discount,
    'free_days', coalesce(v_promo.free_days, 0),
    'final_amount', greatest(0, p_base_amount - v_discount)
  );
end;
$$;

revoke all on function public.platform_quote_promo(text, text, integer, numeric) from public, anon, authenticated;
grant execute on function public.platform_quote_promo(text, text, integer, numeric) to service_role;

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

  select * into v_plan
    from public.plans
   where code = v_request.plan and is_archived = false;
  if not found then raise exception 'billing_plan_not_found'; end if;

  if v_request.promo_code_id is not null then
    select * into v_promo
      from public.platform_promo_codes
     where id = v_request.promo_code_id
     for update;
    if not found or not v_promo.is_active then raise exception 'promo_inactive'; end if;
    if v_promo.starts_at is not null and v_promo.starts_at > v_now then raise exception 'promo_not_started'; end if;
    if v_promo.expires_at is not null and v_promo.expires_at <= v_now then raise exception 'promo_expired'; end if;
    if v_promo.max_uses is not null and v_promo.used_count >= v_promo.max_uses then raise exception 'promo_exhausted'; end if;
    if cardinality(v_promo.plan_codes) > 0 and not (v_request.plan = any(v_promo.plan_codes)) then raise exception 'promo_plan_mismatch'; end if;
    v_free_days := coalesce(v_promo.free_days, 0);
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

  return jsonb_build_object(
    'club_id', v_request.club_id,
    'plan', v_plan.code,
    'months', v_request.months,
    'expires_at', case when v_plan.is_trial then null else v_expires_at end,
    'promo_code', v_request.promo_code,
    'discount_amount', v_request.discount_amount,
    'free_days', v_free_days
  );
end;
$$;

revoke all on function public.platform_approve_billing_request(uuid, uuid) from public, anon, authenticated;
grant execute on function public.platform_approve_billing_request(uuid, uuid) to service_role;
