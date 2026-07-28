-- Platform Admin reliability primitives.
-- Keeps cross-tenant financial aggregates exact beyond PostgREST row limits and
-- makes billing approval atomic while synchronising the normalized plan fields.

create or replace function public.platform_payment_totals(p_since timestamptz)
returns table (
  paid_count bigint,
  paid_sum numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*)::bigint as paid_count,
    coalesce(sum(p.amount), 0)::numeric as paid_sum
  from public.payments p
  where p.status = 'paid'
    and p.created_at >= p_since;
$$;

revoke all on function public.platform_payment_totals(timestamptz) from public, anon, authenticated;
grant execute on function public.platform_payment_totals(timestamptz) to service_role;

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
  v_now timestamptz := now();
  v_expires_at timestamptz;
begin
  select *
    into v_request
    from public.platform_billing_requests
   where id = p_request_id
   for update;

  if not found then
    raise exception 'billing_request_not_found';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'billing_request_already_processed';
  end if;

  select *
    into v_plan
    from public.plans
   where code = v_request.plan
     and is_archived = false;

  if not found then
    raise exception 'billing_plan_not_found';
  end if;

  v_expires_at := v_now + make_interval(months => greatest(1, v_request.months));

  update public.clubs
     set plan_id = v_plan.id,
         plan = case
           when v_plan.code in ('trial', 'starter', 'standard', 'business')
             then v_plan.code::public.club_plan
           else plan
         end,
         plan_price_locked = case when v_plan.is_trial then null else v_plan.price end,
         plan_currency_locked = v_plan.currency,
         plan_period_locked = v_plan.period,
         plan_assigned_at = v_now,
         plan_expires_at = case when v_plan.is_trial then null else v_expires_at end,
         trial_expires_at = case
           when v_plan.is_trial then v_now + make_interval(days => greatest(1, v_plan.trial_days))
           else trial_expires_at
         end,
         status = 'active',
         suspended_at = null
   where id = v_request.club_id;

  if not found then
    raise exception 'billing_club_not_found';
  end if;

  update public.platform_billing_requests
     set status = 'approved',
         resolved_at = v_now,
         resolved_by = p_admin_id
   where id = p_request_id
     and status = 'pending';

  if not found then
    raise exception 'billing_request_race';
  end if;

  return jsonb_build_object(
    'club_id', v_request.club_id,
    'plan', v_plan.code,
    'months', v_request.months,
    'expires_at', case when v_plan.is_trial then null else v_expires_at end
  );
end;
$$;

revoke all on function public.platform_approve_billing_request(uuid, uuid) from public, anon, authenticated;
grant execute on function public.platform_approve_billing_request(uuid, uuid) to service_role;

-- Trigger helpers are invoked by PostgreSQL, never through PostgREST RPC.
-- Explicitly remove inherited function execution from API roles.
revoke execute on function public.enforce_business_row_tenant() from public, anon, authenticated;
revoke execute on function public.enforce_clients_financial_fields() from public, anon, authenticated;
revoke execute on function public.enforce_payment_update_fields() from public, anon, authenticated;
revoke execute on function public.enforce_subscription_update_fields() from public, anon, authenticated;
