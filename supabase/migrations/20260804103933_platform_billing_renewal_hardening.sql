-- Expand phase for platform billing quote snapshots.
-- Request creation stays backward-compatible with the currently deployed
-- Server Action. Approval is deliberately frozen until contract follows so an
-- old approval path cannot consume a quote written by the new application.

alter table public.platform_billing_requests
  add column if not exists quoted_plan_id uuid references public.plans(id) on delete restrict,
  add column if not exists quoted_unit_price numeric(12,2),
  add column if not exists quoted_currency text,
  add column if not exists quoted_period text,
  add column if not exists quoted_at timestamptz,
  add column if not exists promo_free_days integer not null default 0,
  add column if not exists resolution_reason text;

-- Server Actions already use service_role. Keep authenticated users read-only
-- even during the expand window so quote and lifecycle fields cannot be forged
-- through the Data API before the contract migration is applied.
drop policy if exists billing_requests_insert on public.platform_billing_requests;
drop policy if exists billing_requests_cancel on public.platform_billing_requests;
drop policy if exists billing_requests_update on public.platform_billing_requests;

revoke insert, update, delete on table public.platform_billing_requests
  from public, anon, authenticated;
grant select, insert, update, delete on table public.platform_billing_requests
  to service_role;

-- Legacy grandfathering sometimes stored only one field. No history can prove
-- the missing tuple, so deterministically move every incomplete tuple to the
-- current catalog contract instead of mixing historical/current units.
lock table public.platform_billing_requests in share row exclusive mode;

update public.platform_billing_requests requests
   set status = 'cancelled', resolved_at = now(),
       resolution_reason = 'commercial_terms_repaired_resubmit'
 where requests.status = 'pending'
   and exists (
     select 1 from public.clubs clubs
      where clubs.id = requests.club_id
        and (
          clubs.plan_price_locked is not null
          or nullif(btrim(clubs.plan_currency_locked), '') is not null
          or nullif(btrim(clubs.plan_period_locked), '') is not null
        )
        and not (
          clubs.plan_price_locked is not null
          and nullif(btrim(clubs.plan_currency_locked), '') is not null
          and nullif(btrim(clubs.plan_period_locked), '') is not null
        )
   );

update public.clubs clubs
   set plan_price_locked = plans.price,
       plan_currency_locked = plans.currency,
       plan_period_locked = plans.period
  from public.plans plans
 where clubs.plan_id = plans.id
   and (
     clubs.plan_price_locked is not null
     or nullif(btrim(clubs.plan_currency_locked), '') is not null
     or nullif(btrim(clubs.plan_period_locked), '') is not null
   )
   and not (
     clubs.plan_price_locked is not null
     and nullif(btrim(clubs.plan_currency_locked), '') is not null
     and nullif(btrim(clubs.plan_period_locked), '') is not null
   );

-- Request replacement is explicit (cancel, then resubmit). Enforce one pending
-- request per club during expand so concurrent Server Actions cannot duplicate
-- it. Older code allowed a cancel→insert race, so repair duplicates before the
-- unique index is built or the expand migration could fail halfway through.
with ranked_pending as (
  select id, row_number() over (partition by club_id order by created_at desc, id desc) as row_number
  from public.platform_billing_requests
  where status = 'pending'
)
update public.platform_billing_requests requests
   set status = 'cancelled', resolved_at = now(), resolution_reason = 'superseded_pending_request'
  from ranked_pending
 where requests.id = ranked_pending.id
   and requests.status = 'pending'
   and ranked_pending.row_number > 1;

create unique index if not exists platform_billing_requests_one_pending_club_idx
  on public.platform_billing_requests (club_id) where status = 'pending';

-- The application and the contract migration are deployed separately. Freeze
-- the only irreversible transition during that window: old code may still
-- create/reject requests, but no request can be approved with legacy rules.
create schema if not exists private;
create or replace function private.block_platform_billing_approval_during_rollout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status = 'approved' then
    raise exception 'billing_approval_contract_pending';
  end if;
  return new;
end;
$$;

revoke all on function private.block_platform_billing_approval_during_rollout()
  from public, anon, authenticated;
drop trigger if exists platform_billing_approval_rollout_freeze
  on public.platform_billing_requests;
create trigger platform_billing_approval_rollout_freeze
before update on public.platform_billing_requests
for each row execute function private.block_platform_billing_approval_during_rollout();

-- Price, currency and period are one commercial contract. Apply a catalog
-- change and grandfather snapshots in the same database transaction so a
-- failed/racing plan edit cannot leave existing clubs on mixed quote terms.
create or replace function public.platform_apply_plan_commercial_terms(
  p_plan_id uuid,
  p_price numeric,
  p_currency text,
  p_period text,
  p_apply_mode text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
  v_attached_clubs bigint := 0;
  v_cancelled_requests bigint := 0;
  v_changed boolean := false;
begin
  if p_price is null or p_price < 0
     or nullif(btrim(p_currency), '') is null
     or nullif(btrim(p_period), '') is null
  then raise exception 'plan_commercial_terms_invalid'; end if;

  -- Serialize catalog edits with request inserts/approval. Contract phase also
  -- verifies each inserted quote against the current catalog/club lock.
  lock table public.platform_billing_requests in share row exclusive mode;
  select * into v_plan from public.plans where id = p_plan_id for update;
  if not found then raise exception 'plan_not_found'; end if;

  v_changed := v_plan.price is distinct from p_price
    or v_plan.currency is distinct from btrim(p_currency)
    or v_plan.period is distinct from btrim(p_period);
  if not v_changed then
    return jsonb_build_object('changed', false, 'attached_clubs', 0);
  end if;

  select count(*) into v_attached_clubs from public.clubs where plan_id = p_plan_id;
  if not v_plan.is_trial and v_attached_clubs > 0 then
    if p_apply_mode not in ('new_only', 'all') then
      raise exception 'plan_commercial_apply_mode_required';
    end if;

    if p_apply_mode = 'new_only' then
      update public.clubs
         set plan_price_locked = case
               when plan_price_locked is not null
                and nullif(btrim(plan_currency_locked), '') is not null
                and nullif(btrim(plan_period_locked), '') is not null
               then plan_price_locked else v_plan.price end,
             plan_currency_locked = case
               when plan_price_locked is not null
                and nullif(btrim(plan_currency_locked), '') is not null
                and nullif(btrim(plan_period_locked), '') is not null
               then plan_currency_locked else v_plan.currency end,
             plan_period_locked = case
               when plan_price_locked is not null
                and nullif(btrim(plan_currency_locked), '') is not null
                and nullif(btrim(plan_period_locked), '') is not null
               then plan_period_locked else v_plan.period end
       where plan_id = p_plan_id;
    else
      update public.clubs
         set plan_price_locked = null,
             plan_currency_locked = null,
             plan_period_locked = null
       where plan_id = p_plan_id;
    end if;
  end if;

  -- “Apply all” (and a plan with no attached clubs) invalidates every pending
  -- quote for that target plan, including Trial→paid upgrades. `new_only`
  -- intentionally grandfathers quotes that were already issued.
  if p_apply_mode is distinct from 'new_only' then
    update public.platform_billing_requests requests
       set status = 'cancelled',
           resolved_at = now(),
           resolution_reason = 'catalog_terms_changed_resubmit'
     where requests.status = 'pending'
       and requests.quoted_plan_id = p_plan_id;
    get diagnostics v_cancelled_requests = row_count;
  end if;

  update public.plans
     set price = p_price,
         currency = btrim(p_currency),
         period = btrim(p_period),
         updated_at = now()
   where id = p_plan_id;

  return jsonb_build_object(
    'changed', true,
    'attached_clubs', v_attached_clubs,
    'cancelled_requests', v_cancelled_requests
  );
end;
$$;

revoke all on function public.platform_apply_plan_commercial_terms(uuid, numeric, text, text, text)
  from public, anon, authenticated;
grant execute on function public.platform_apply_plan_commercial_terms(uuid, numeric, text, text, text)
  to service_role;

-- Full plan-editor save is one transaction. Definition, commercial terms,
-- entitlement matrices and audit logs can no longer commit partially.
create or replace function public.platform_save_plan_configuration(
  p_plan_id uuid,
  p_payload jsonb,
  p_features jsonb,
  p_limits jsonb,
  p_sections jsonb,
  p_logs jsonb,
  p_apply_mode text default null,
  p_admin_id uuid default null,
  p_admin_email text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan public.plans%rowtype;
  v_is_trial boolean;
  v_is_active boolean;
  v_price numeric;
  v_old_price numeric;
  v_discount integer;
  v_trial_days integer;
  v_sort_order integer;
  v_currency text;
  v_period text;
  v_commercial_result jsonb;
  v_club record;
  v_key text;
  v_limit bigint;
  v_count bigint;
begin
  if jsonb_typeof(p_payload) is distinct from 'object'
     or jsonb_typeof(p_features) is distinct from 'object'
     or jsonb_typeof(p_limits) is distinct from 'object'
     or jsonb_typeof(p_sections) is distinct from 'object'
     or jsonb_typeof(coalesce(p_logs, '[]'::jsonb)) is distinct from 'array'
  then raise exception 'plan_payload_invalid'; end if;

  lock table public.platform_billing_requests in share row exclusive mode;
  select * into v_plan from public.plans where id = p_plan_id for update;
  if not found then raise exception 'plan_not_found'; end if;

  v_is_trial := (p_payload->>'is_trial')::boolean;
  v_is_active := (p_payload->>'is_active')::boolean;
  v_price := (p_payload->>'price')::numeric;
  v_old_price := case when p_payload->>'old_price' is null then null else (p_payload->>'old_price')::numeric end;
  v_discount := case when p_payload->>'discount_percent' is null then null else (p_payload->>'discount_percent')::integer end;
  v_trial_days := (p_payload->>'trial_days')::integer;
  v_sort_order := (p_payload->>'sort_order')::integer;
  v_currency := btrim(p_payload->>'currency');
  v_period := btrim(p_payload->>'period');

  if coalesce(btrim(p_payload->>'name'), '') = ''
     or coalesce(btrim(p_payload->>'code'), '') !~ '^[a-z0-9][a-z0-9_-]{1,59}$'
     or coalesce(btrim(p_payload->>'slug'), '') !~ '^[a-z0-9][a-z0-9_-]{1,79}$'
     or length(coalesce(p_payload->>'name', '')) > 120
     or length(coalesce(p_payload->>'description', '')) > 5000
     or length(coalesce(p_payload->>'short_description', '')) > 500
     or length(coalesce(p_payload->>'landing_subtitle', '')) > 500
     or length(coalesce(p_payload->>'landing_cta', '')) > 120
     or v_price < 0
     or (v_old_price is not null and v_old_price < 0)
     or (v_discount is not null and (v_discount < 0 or v_discount > 100))
     or v_trial_days < 0 or v_trial_days > 3650
     or v_sort_order < -10000 or v_sort_order > 100000
     or v_currency !~ '^[A-Z]{3}$'
     or v_period not in ('monthly', 'quarterly', 'yearly')
     or jsonb_typeof(coalesce(p_payload->'landing_benefits', '[]'::jsonb)) is distinct from 'array'
  then raise exception 'plan_payload_invalid'; end if;
  if not v_is_trial and v_is_active and v_period <> 'monthly' then
    raise exception 'plan_paid_period_unsupported';
  end if;
  if v_is_trial is distinct from (btrim(p_payload->>'code') = 'trial') then
    raise exception 'plan_trial_identity_invalid';
  end if;
  if v_plan.code = 'trial' and (btrim(p_payload->>'code') <> v_plan.code or not v_is_trial) then
    raise exception 'plan_system_trial_immutable';
  end if;
  if v_plan.code <> 'trial' and (v_is_trial or btrim(p_payload->>'code') = 'trial') then
    raise exception 'plan_custom_trial_forbidden';
  end if;
  if exists (
    select 1 from jsonb_each(p_features) item
     where jsonb_typeof(item.value) <> 'boolean'
  ) or exists (
    select 1 from jsonb_each(p_sections) item
     where jsonb_typeof(item.value) <> 'boolean'
  ) or exists (
    select 1 from jsonb_each(p_limits) item
     where jsonb_typeof(item.value) not in ('number', 'null')
        or (jsonb_typeof(item.value) = 'number'
            and ((item.value #>> '{}')::numeric < 0
                 or trunc((item.value #>> '{}')::numeric) <> (item.value #>> '{}')::numeric))
  ) then raise exception 'plan_entitlements_invalid'; end if;

  select public.platform_apply_plan_commercial_terms(
    p_plan_id, v_price, v_currency, v_period, p_apply_mode
  ) into v_commercial_result;

  update public.plans
     set code = btrim(p_payload->>'code'),
         name = btrim(p_payload->>'name'),
         slug = btrim(p_payload->>'slug'),
         description = coalesce(p_payload->>'description', ''),
         short_description = coalesce(p_payload->>'short_description', ''),
         color = coalesce(p_payload->>'color', ''),
         icon = coalesce(p_payload->>'icon', ''),
         sort_order = v_sort_order,
         is_popular = (p_payload->>'is_popular')::boolean,
         is_recommended = (p_payload->>'is_recommended')::boolean,
         is_active = v_is_active,
         is_trial = v_is_trial,
         trial_days = v_trial_days,
         old_price = v_old_price,
         discount_percent = v_discount,
         landing_subtitle = coalesce(p_payload->>'landing_subtitle', ''),
         landing_benefits = coalesce(p_payload->'landing_benefits', '[]'::jsonb),
         landing_cta = coalesce(p_payload->>'landing_cta', ''),
         updated_at = now()
   where id = p_plan_id;

  insert into public.plan_features (plan_id, feature_key, enabled)
  select p_plan_id, item.key, (item.value #>> '{}')::boolean from jsonb_each(p_features) item
  on conflict (plan_id, feature_key) do update set enabled = excluded.enabled;
  insert into public.plan_limits (plan_id, limit_key, limit_value)
  select p_plan_id, item.key,
         case when jsonb_typeof(item.value) = 'null' then null else (item.value #>> '{}')::bigint end
    from jsonb_each(p_limits) item
  on conflict (plan_id, limit_key) do update set limit_value = excluded.limit_value;
  insert into public.plan_sections (plan_id, section_key, enabled)
  select p_plan_id, item.key, (item.value #>> '{}')::boolean from jsonb_each(p_sections) item
  on conflict (plan_id, section_key) do update set enabled = excluded.enabled;

  -- A catalog edit cannot make already-attached clubs invalid. Lock the same
  -- scopes as record creation, then validate the just-written limits; any
  -- failure rolls back the complete plan save and commercial changes.
  foreach v_key in array array['clients', 'staff', 'branches', 'products', 'roles', 'integrations'] loop
    if not (p_limits ? v_key) then raise exception 'plan_limit_unconfigured:%', v_key; end if;
  end loop;
  for v_club in
    select id, owner_id from public.clubs where plan_id = p_plan_id and status <> 'deleted' order by id
  loop
    foreach v_key in array array['clients', 'staff', 'branches', 'products', 'roles', 'integrations'] loop
      if jsonb_typeof(p_limits->v_key) = 'null' then continue; end if;
      v_limit := (p_limits->>v_key)::bigint;
      if v_key = 'branches' then
        if v_club.owner_id is null then raise exception 'plan_limit_owner_not_found'; end if;
        perform pg_advisory_xact_lock(hashtextextended('plan-limit-owner:' || v_club.owner_id::text || ':branches', 0));
      else
        perform pg_advisory_xact_lock(hashtextextended('plan-limit:' || v_club.id::text || ':' || v_key, 0));
      end if;
      case v_key
        when 'clients' then
          select count(*) into v_count from public.clients where club_id = v_club.id;
        when 'staff' then
          select count(*) into v_count from public.staff where club_id = v_club.id and is_active;
          v_count := v_count + (
            select count(*) from public.staff_invitations
             where club_id = v_club.id and accepted_at is null and expires_at > now()
          );
        when 'branches' then
          select count(*) into v_count from public.clubs
           where owner_id = v_club.owner_id and status <> 'deleted';
        when 'products' then
          select count(*) into v_count from public.products where club_id = v_club.id and is_active;
        when 'roles' then
          select count(*) into v_count from public.club_roles where club_id = v_club.id and not is_system;
        when 'integrations' then
          select (select count(*) from public.telegram_integrations where club_id = v_club.id)
            + (select count(*) from public.integration_connections where club_id = v_club.id)
            + (select count(*) from public.access_control_integrations where club_id = v_club.id)
            + (select count(*) from public.payment_connection_requests
                where club_id = v_club.id and status in ('new', 'active'))
            into v_count;
      end case;
      if v_count > v_limit then
        raise exception 'plan_limit_below_usage:%:%', v_key, v_club.id;
      end if;
    end loop;
  end loop;

  insert into public.plan_change_logs (
    plan_id, admin_id, admin_email, action, field, old_value, new_value
  )
  select p_plan_id, p_admin_id, p_admin_email,
         coalesce(item->>'action', 'update'), item->>'field', item->>'old_value', item->>'new_value'
    from jsonb_array_elements(coalesce(p_logs, '[]'::jsonb)) item;

  return jsonb_build_object('ok', true, 'commercial', v_commercial_result);
end;
$$;

revoke all on function public.platform_save_plan_configuration(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.platform_save_plan_configuration(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text, uuid, text)
  to service_role;

-- Bridge RPCs are part of expand because the new application calls them before
-- contract revokes the legacy authenticated create_club entrypoint.
create or replace function public.create_club_for_user(
  p_user_id uuid,
  p_user_email text,
  p_name text,
  p_city text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_club uuid;
  v_count integer;
begin
  if p_user_id is null then raise exception 'user_required'; end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'club_name_required'; end if;
  if length(p_name) > 120 then raise exception 'club_name_too_long'; end if;

  -- Plan saves take this lock before reading attached-club usage. Serializing
  -- initial club creation prevents a new Trial owner row from appearing outside
  -- the save transaction's capacity snapshot.
  lock table public.platform_billing_requests in share row exclusive mode;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select count(*) into v_count
    from public.clubs
   where owner_id = p_user_id and status <> 'deleted';
  if v_count <> 0 then raise exception 'initial_club_already_exists'; end if;

  insert into public.users (id, email)
  values (p_user_id, p_user_email)
  on conflict (id) do nothing;

  insert into public.clubs (name, city, owner_id, plan, trial_expires_at)
  values (btrim(p_name), nullif(btrim(p_city), ''), p_user_id, 'trial', now() + interval '14 days')
  returning id into v_club;

  insert into public.staff (user_id, club_id, role)
  values (p_user_id, v_club, 'owner');
  return v_club;
end;
$$;

revoke all on function public.create_club_for_user(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_club_for_user(uuid, text, text, text)
  to service_role;

create or replace function public.create_branch_for_user(
  p_user_id uuid,
  p_source_club_id uuid,
  p_name text,
  p_city text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source public.clubs%rowtype;
  v_plan public.plans%rowtype;
  v_club uuid;
  v_count bigint;
  v_limit bigint;
  v_feature_enabled boolean := false;
begin
  if p_user_id is null or p_source_club_id is null then raise exception 'branch_context_required'; end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'club_name_required'; end if;
  if length(p_name) > 120 then raise exception 'club_name_too_long'; end if;

  -- Match plan-save's first lock so a concurrent limit reduction either sees
  -- this complete branch or finishes before we read the authoritative limits.
  lock table public.platform_billing_requests in share row exclusive mode;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select clubs.* into v_source
    from public.clubs clubs
    join public.staff staff
      on staff.club_id = clubs.id
     and staff.user_id = p_user_id
     and staff.role = 'owner'
     and staff.is_active
   where clubs.id = p_source_club_id
   for update of clubs;
  if not found then raise exception 'branch_source_forbidden'; end if;
  if v_source.owner_id is null then raise exception 'branch_owner_not_found'; end if;
  -- Co-owners share one canonical branch quota anchored to the subscription
  -- owner's identity; they cannot each multiply the same entitlement.
  perform pg_advisory_xact_lock(hashtextextended('plan-limit-owner:' || v_source.owner_id::text || ':branches', 0));
  if v_source.status <> 'active' then raise exception 'platform_subscription_locked'; end if;

  select * into v_plan
    from public.plans
   where id = v_source.plan_id;
  if not found then
    select * into v_plan from public.plans where code = v_source.plan::text;
  end if;
  if not found then raise exception 'branch_plan_not_found'; end if;

  if v_plan.is_trial then
    if v_source.trial_expires_at is null or v_source.trial_expires_at <= now() then
      raise exception 'platform_subscription_locked';
    end if;
  elsif v_source.plan_expires_at is not null and v_source.plan_expires_at <= now() then
    raise exception 'platform_subscription_locked';
  end if;

  select enabled into v_feature_enabled
    from public.plan_features
   where plan_id = v_plan.id and feature_key = 'multi_branch';
  if coalesce(v_feature_enabled, false) is not true then raise exception 'branch_feature_unavailable'; end if;

  select limit_value into v_limit
    from public.plan_limits
   where plan_id = v_plan.id and limit_key = 'branches';
  if not found then raise exception 'branch_limit_unconfigured'; end if;
  select count(*) into v_count
    from public.clubs
   where owner_id = v_source.owner_id and status <> 'deleted';
  if v_limit is not null and v_count >= v_limit then raise exception 'branch_limit_reached'; end if;

  insert into public.clubs (
    name, city, owner_id, plan, trial_expires_at, plan_expires_at,
    plan_price_locked, plan_currency_locked, plan_period_locked, plan_assigned_at
  ) values (
    btrim(p_name), nullif(btrim(p_city), ''), v_source.owner_id, v_source.plan,
    v_source.trial_expires_at, v_source.plan_expires_at,
    v_source.plan_price_locked, v_source.plan_currency_locked,
    v_source.plan_period_locked, v_source.plan_assigned_at
  ) returning id into v_club;

  -- The legacy plan enum trigger resolves built-ins. Re-apply the authoritative
  -- UUID separately so a custom source plan is not overwritten on INSERT.
  update public.clubs set plan_id = v_plan.id where id = v_club;
  insert into public.staff (user_id, club_id, role)
  values (v_source.owner_id, v_club, 'owner');
  if p_user_id <> v_source.owner_id then
    insert into public.staff (user_id, club_id, role)
    values (p_user_id, v_club, 'owner');
  end if;
  return v_club;
end;
$$;

revoke all on function public.create_branch_for_user(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.create_branch_for_user(uuid, uuid, text, text)
  to service_role;

-- Manual Platform Admin reassignment is an explicit plan change, never a
-- renewal shortcut. It is atomic with capacity validation, expiry/commercial
-- snapshots, pending-request invalidation and the platform audit record.
create or replace function public.platform_change_club_plan(
  p_club_id uuid,
  p_plan_code text,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_club public.clubs%rowtype;
  v_plan public.plans%rowtype;
  v_key text;
  v_limit bigint;
  v_count bigint;
  v_now timestamptz := now();
  v_expires_at timestamptz;
  v_cancelled integer := 0;
begin
  if not exists (
    select 1 from public.users
     where id = p_admin_id
       and platform_role in ('platform_admin', 'super_admin')
  ) then raise exception 'platform_admin_required'; end if;
  if nullif(btrim(p_plan_code), '') is null then raise exception 'platform_plan_required'; end if;

  lock table public.platform_billing_requests in share row exclusive mode;
  perform 1 from public.platform_billing_requests
   where club_id = p_club_id and status = 'pending'
   order by id for update;

  select * into v_plan from public.plans
   where code = btrim(p_plan_code) and is_active and not is_archived
   for update;
  if not found then raise exception 'platform_plan_not_found'; end if;
  if v_plan.is_trial and v_plan.code <> 'trial' then raise exception 'platform_trial_identity_invalid'; end if;
  if not v_plan.is_trial and v_plan.period <> 'monthly' then
    raise exception 'platform_plan_period_unsupported';
  end if;

  select * into v_club from public.clubs where id = p_club_id for update;
  if not found or v_club.status = 'deleted' then raise exception 'platform_club_not_found'; end if;
  if coalesce(v_club.plan_id = v_plan.id, false)
     or (v_club.plan_id is null and v_club.plan::text = v_plan.code)
  then raise exception 'platform_plan_already_assigned'; end if;
  if v_club.owner_id is null then raise exception 'platform_club_owner_not_found'; end if;

  foreach v_key in array array['clients', 'staff', 'branches', 'products', 'roles', 'integrations'] loop
    if v_key = 'branches' then
      perform pg_advisory_xact_lock(hashtextextended('plan-limit-owner:' || v_club.owner_id::text || ':branches', 0));
    else
      perform pg_advisory_xact_lock(hashtextextended('plan-limit:' || p_club_id::text || ':' || v_key, 0));
    end if;
    select limit_value into v_limit from public.plan_limits
     where plan_id = v_plan.id and limit_key = v_key;
    if not found then raise exception 'platform_plan_capacity_unconfigured:%', v_key; end if;
    if v_limit is null then continue; end if;

    case v_key
      when 'clients' then
        select count(*) into v_count from public.clients where club_id = p_club_id;
      when 'staff' then
        select count(*) into v_count from public.staff where club_id = p_club_id and is_active;
        v_count := v_count + (
          select count(*) from public.staff_invitations
           where club_id = p_club_id and accepted_at is null and expires_at > v_now
        );
      when 'branches' then
        select count(*) into v_count from public.clubs
         where owner_id = v_club.owner_id and status <> 'deleted';
      when 'products' then
        select count(*) into v_count from public.products where club_id = p_club_id and is_active;
      when 'roles' then
        select count(*) into v_count from public.club_roles where club_id = p_club_id and not is_system;
      when 'integrations' then
        select (select count(*) from public.telegram_integrations where club_id = p_club_id)
          + (select count(*) from public.integration_connections where club_id = p_club_id)
          + (select count(*) from public.access_control_integrations where club_id = p_club_id)
          + (select count(*) from public.payment_connection_requests
              where club_id = p_club_id and status in ('new', 'active'))
          into v_count;
    end case;
    if v_count > v_limit then raise exception 'platform_plan_capacity_exceeded:%', v_key; end if;
  end loop;

  update public.platform_billing_requests
     set status = 'cancelled', resolved_at = v_now,
         resolution_reason = 'plan_changed_by_admin'
   where club_id = p_club_id and status = 'pending';
  get diagnostics v_cancelled = row_count;

  if v_plan.is_trial then
    v_expires_at := v_now + greatest(1, v_plan.trial_days) * interval '1 day';
    update public.clubs
       set plan_id = v_plan.id,
           plan = 'trial',
           trial_expires_at = v_expires_at,
           plan_expires_at = null,
           plan_price_locked = null,
           plan_currency_locked = null,
           plan_period_locked = null,
           plan_assigned_at = v_now
     where id = p_club_id;
  elsif v_plan.code in ('starter', 'standard', 'business') then
    v_expires_at := v_now + interval '1 month';
    update public.clubs
       set plan_id = v_plan.id,
           plan = v_plan.code::public.club_plan,
           trial_expires_at = null,
           plan_expires_at = v_expires_at,
           plan_price_locked = v_plan.price,
           plan_currency_locked = v_plan.currency,
           plan_period_locked = v_plan.period,
           plan_assigned_at = v_now
     where id = p_club_id;
  else
    v_expires_at := v_now + interval '1 month';
    update public.clubs
       set plan_id = v_plan.id,
           trial_expires_at = null,
           plan_expires_at = v_expires_at,
           plan_price_locked = v_plan.price,
           plan_currency_locked = v_plan.currency,
           plan_period_locked = v_plan.period,
           plan_assigned_at = v_now
     where id = p_club_id;
  end if;

  insert into public.platform_admin_logs (
    admin_id, admin_email, action, club_id, meta
  )
  select p_admin_id, users.email, 'change_plan', p_club_id,
         jsonb_build_object(
           'previous_plan_id', v_club.plan_id,
           'previous_plan', v_club.plan,
           'plan_id', v_plan.id,
           'plan', v_plan.code,
           'price', v_plan.price,
           'currency', v_plan.currency,
           'pending_requests_cancelled', v_cancelled
         )
    from public.users users where users.id = p_admin_id;

  return jsonb_build_object(
    'plan_id', v_plan.id,
    'plan', v_plan.code,
    'expires_at', v_expires_at,
    'pending_requests_cancelled', v_cancelled
  );
end;
$$;

revoke all on function public.platform_change_club_plan(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.platform_change_club_plan(uuid, text, uuid)
  to service_role;

-- Extending Trial is not a hidden paid→Trial plan change. Only a club already
-- attached to the canonical Trial plan can be extended; the RPC also repairs
-- any stale paid commercial fields in the same transaction.
create or replace function public.platform_extend_club_trial(
  p_club_id uuid,
  p_days integer,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_club public.clubs%rowtype;
  v_plan public.plans%rowtype;
  v_plan_id uuid;
  v_now timestamptz := now();
  v_expires_at timestamptz;
begin
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'platform_trial_days_invalid';
  end if;
  if not exists (
    select 1 from public.users
     where id = p_admin_id
       and platform_role in ('platform_admin', 'super_admin')
  ) then raise exception 'platform_admin_required'; end if;

  -- Match the plan editor/change-plan lock order: billing table → plan → club.
  lock table public.platform_billing_requests in share row exclusive mode;
  select coalesce(clubs.plan_id, fallback.id) into v_plan_id
    from public.clubs clubs
    left join public.plans fallback on fallback.code = clubs.plan::text
   where clubs.id = p_club_id and clubs.status <> 'deleted';
  if v_plan_id is null then raise exception 'platform_club_not_found'; end if;

  select * into v_plan from public.plans where id = v_plan_id for update;
  if not found or not v_plan.is_trial or v_plan.code <> 'trial' then
    raise exception 'platform_trial_only';
  end if;
  select * into v_club from public.clubs where id = p_club_id for update;
  if not found or v_club.status = 'deleted' then raise exception 'platform_club_not_found'; end if;
  if coalesce(v_club.plan_id, v_plan_id) <> v_plan.id then raise exception 'platform_plan_changed_retry'; end if;

  v_expires_at := greatest(v_now, coalesce(v_club.trial_expires_at, v_now))
    + p_days * interval '1 day';
  update public.clubs
     set plan_id = v_plan.id,
         plan = 'trial',
         trial_expires_at = v_expires_at,
         plan_expires_at = null,
         plan_price_locked = null,
         plan_currency_locked = null,
         plan_period_locked = null,
         plan_assigned_at = coalesce(plan_assigned_at, v_now)
   where id = p_club_id;

  insert into public.platform_admin_logs (
    admin_id, admin_email, action, club_id, meta
  )
  select p_admin_id, users.email, 'extend_trial', p_club_id,
         jsonb_build_object('days', p_days, 'expires_at', v_expires_at)
    from public.users users where users.id = p_admin_id;

  return jsonb_build_object('club_id', p_club_id, 'expires_at', v_expires_at);
end;
$$;

revoke all on function public.platform_extend_club_trial(uuid, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.platform_extend_club_trial(uuid, integer, uuid)
  to service_role;

-- Replacing discounts for multiple clubs is one transaction: either every old
-- benefit/request is superseded and every replacement exists, or nothing moves.
create or replace function public.platform_replace_club_discount_compensations(
  p_club_ids uuid[],
  p_value integer,
  p_reason text,
  p_expires_at timestamptz,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_club_ids uuid[];
  v_expected integer;
  v_existing integer;
  v_cancelled_requests integer := 0;
  v_cancelled_compensations integer := 0;
  v_created integer := 0;
  v_now timestamptz := now();
begin
  select coalesce(array_agg(id order by id), array[]::uuid[])
    into v_club_ids
    from (select distinct unnest(coalesce(p_club_ids, array[]::uuid[])) as id) ids;
  v_expected := cardinality(v_club_ids);
  if v_expected < 1 or v_expected > 100 then raise exception 'compensation_invalid_clubs'; end if;
  if p_value < 1 or p_value > 100 then raise exception 'compensation_invalid_value'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 or length(btrim(p_reason)) > 500 then
    raise exception 'compensation_invalid_reason';
  end if;
  if p_expires_at is not null and p_expires_at <= v_now then raise exception 'compensation_invalid_expiry'; end if;

  -- Match approval/cancellation lock order: request → club → compensation.
  lock table public.platform_billing_requests in share row exclusive mode;
  perform 1 from public.platform_billing_requests
   where club_id = any(v_club_ids) and status = 'pending'
   order by id for update;
  perform 1 from public.clubs
   where id = any(v_club_ids) and status <> 'deleted'
   order by id for update;
  get diagnostics v_existing = row_count;
  if v_existing <> v_expected then raise exception 'compensation_club_not_found'; end if;
  perform 1 from public.platform_club_compensations
   where club_id = any(v_club_ids) and benefit_type = 'discount_pct' and status = 'active'
   order by id for update;

  update public.platform_billing_requests requests
     set status = 'cancelled', resolved_at = v_now,
         resolution_reason = 'compensation_replaced_resubmit'
   where requests.status = 'pending'
     and requests.compensation_id in (
       select id from public.platform_club_compensations
        where club_id = any(v_club_ids) and benefit_type = 'discount_pct' and status = 'active'
     );
  get diagnostics v_cancelled_requests = row_count;

  update public.platform_club_compensations
     set status = 'cancelled', cancelled_by = p_admin_id,
         cancelled_at = v_now, updated_at = v_now
   where club_id = any(v_club_ids) and benefit_type = 'discount_pct' and status = 'active';
  get diagnostics v_cancelled_compensations = row_count;

  insert into public.platform_club_compensations (
    club_id, benefit_type, value, reason, status, expires_at, created_by
  )
  select id, 'discount_pct', p_value, btrim(p_reason), 'active', p_expires_at, p_admin_id
    from unnest(v_club_ids) id;
  get diagnostics v_created = row_count;
  if v_created <> v_expected then raise exception 'compensation_create_race'; end if;

  return jsonb_build_object(
    'created', v_created,
    'cancelled_compensations', v_cancelled_compensations,
    'cancelled_requests', v_cancelled_requests
  );
end;
$$;

revoke all on function public.platform_replace_club_discount_compensations(uuid[], integer, text, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.platform_replace_club_discount_compensations(uuid[], integer, text, timestamptz, uuid)
  to service_role;
