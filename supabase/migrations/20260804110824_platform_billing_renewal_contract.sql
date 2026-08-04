-- Contract phase. Apply only after the Server Action writes the quote snapshot
-- added by 20260804103933_platform_billing_renewal_hardening.sql.

lock table public.platform_billing_requests in share row exclusive mode;

-- Expand freezes approval while application and database contracts differ.
-- Dropping it inside this transaction is safe: rollback restores the freeze;
-- commit exposes the authoritative approval RPC installed below.
drop trigger if exists platform_billing_approval_rollout_freeze
  on public.platform_billing_requests;
drop function if exists private.block_platform_billing_approval_during_rollout();

-- Repeat the deterministic expand repair at contract time. During the deploy
-- window old code could still create an incomplete grandfather tuple. Missing
-- units cannot be reconstructed, so use the complete current catalog tuple.
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

-- Keep resolved history intact. Only pending requests are repaired/cancelled.
update public.platform_billing_requests
   set status = 'cancelled', resolved_at = now(), resolution_reason = 'invalid_months_resubmit'
 where status = 'pending' and (months < 1 or months > 12);

update public.platform_billing_requests
   set status = 'cancelled', resolved_at = now(), resolution_reason = 'legacy_quote_missing_resubmit'
 where status = 'pending'
   and (
     quoted_plan_id is null
     or
     quoted_unit_price is null
     or nullif(btrim(quoted_currency), '') is null
     or nullif(btrim(quoted_period), '') is null
     or quoted_at is null
     or amount is null
   );

-- The current checkout contract prices and extends subscriptions in months.
-- Fail closed on quotes created during expand for a differently configured
-- billing period so they do not remain permanently pending after the trigger.
update public.platform_billing_requests
   set status = 'cancelled', resolved_at = now(), resolution_reason = 'unsupported_period_resubmit'
 where status = 'pending'
   and quoted_period <> 'monthly';

-- A paid plan without an expiry is intentionally modelled as lifetime access.
-- It must not be converted into a finite subscription by a same-plan request.
update public.platform_billing_requests requests
   set status = 'cancelled', resolved_at = now(), resolution_reason = 'unlimited_plan_no_renewal'
  from public.clubs clubs, public.plans plans
 where requests.status = 'pending'
   and requests.club_id = clubs.id
   and plans.id = requests.quoted_plan_id
   and plans.is_trial = false
   and clubs.plan_expires_at is null
   and (
     clubs.plan_id = plans.id
     or (clubs.plan_id is null and clubs.plan::text = plans.code)
   );

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

alter table public.platform_billing_requests
  drop constraint if exists platform_billing_requests_months_check,
  add constraint platform_billing_requests_months_check
    check (months between 1 and 12) not valid;

create unique index if not exists platform_billing_requests_one_pending_club_idx
  on public.platform_billing_requests (club_id) where status = 'pending';

drop policy if exists billing_requests_insert on public.platform_billing_requests;
drop policy if exists billing_requests_cancel on public.platform_billing_requests;
drop policy if exists billing_requests_update on public.platform_billing_requests;
revoke insert, update, delete on table public.platform_billing_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.platform_billing_requests to service_role;

create schema if not exists private;

-- Subscription lifecycle is a database boundary, not only a UI concern.
-- This helper is authoritative for custom plans through plans.is_trial and
-- fails closed for missing/deleted/suspended clubs and malformed trial data.
create or replace function private.club_has_platform_access(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
        from public.users users
       where users.id = auth.uid()
         and users.platform_role in ('platform_admin', 'super_admin')
    )
    or exists (
      select 1
        from public.clubs clubs
        left join public.plans plans on plans.id = clubs.plan_id
       where clubs.id = p_club_id
         and clubs.status = 'active'
         and case
           when coalesce(plans.is_trial, clubs.plan::text = 'trial')
             then clubs.trial_expires_at is not null and clubs.trial_expires_at > now()
           else clubs.plan_expires_at is null or clubs.plan_expires_at > now()
         end
    );
$$;

revoke all on function private.club_has_platform_access(uuid) from public, anon;
grant execute on function private.club_has_platform_access(uuid) to authenticated, service_role;

-- Triggers also cover SECURITY DEFINER operational RPCs, which can bypass RLS.
create or replace function private.enforce_club_platform_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_club_id uuid;
  v_new_club_id uuid;
begin
  -- Never turn a commercial lock into an egress hazard. Exit passages may be
  -- recorded for audit, but they never grant entry or create a CRM visit.
  if auth.role() = 'service_role' and tg_table_name = 'access_control_events' then
    if tg_op = 'DELETE' and old.direction = 'exit' then return old; end if;
    if tg_op <> 'DELETE' and new.direction = 'exit' then return new; end if;
  end if;

  if auth.role() is distinct from 'authenticated'
     and not (
       auth.role() = 'service_role'
       and tg_table_name in ('access_control_events', 'access_control_reservations', 'visits')
     )
  then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_table_name = 'clubs' then
    if tg_op <> 'INSERT' then v_old_club_id := old.id; end if;
    if tg_op <> 'DELETE' then v_new_club_id := new.id; end if;
  else
    if tg_op <> 'INSERT' then v_old_club_id := old.club_id; end if;
    if tg_op <> 'DELETE' then v_new_club_id := new.club_id; end if;
  end if;

  if (v_old_club_id is not null and not private.club_has_platform_access(v_old_club_id))
     or (v_new_club_id is not null and not private.club_has_platform_access(v_new_club_id))
  then raise exception 'platform_subscription_locked'; end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function private.enforce_club_platform_access() from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'access_control_credentials', 'access_control_events', 'access_control_integrations',
    'access_control_reservations', 'acquiring_transactions', 'audit_logs', 'broadcasts',
    'class_bookings', 'classes', 'client_card_fingerprints',
    'client_conversation_messages', 'client_conversation_reads', 'client_conversations',
    'client_interactions', 'client_reply_templates', 'clients', 'club_payment_credentials',
    'club_roles', 'clubs', 'growth_experiment_runs', 'instagram_daily_insights',
    'instagram_media', 'integration_connections', 'integration_events',
    'integration_oauth_states', 'integration_sync_runs', 'inventory',
    'marketing_touchpoints', 'memberships', 'notification_templates', 'notifications',
    'payme_transactions', 'payment_connection_requests', 'payments', 'plan_usage',
    'plan_usage_reservations', 'products', 'qr_pass_redemptions', 'retention_cases',
    'rooms', 'schedules', 'staff', 'staff_invitations', 'stock_movements',
    'subscriptions', 'telegram_events', 'telegram_integrations',
    'telegram_staff_pairings', 'telegram_users', 'visits'
  ] loop
    execute format('drop trigger if exists platform_subscription_write_gate on public.%I', v_table);
    execute format(
      'create trigger platform_subscription_write_gate before insert or update or delete on public.%I for each row execute function private.enforce_club_platform_access()',
      v_table
    );
  end loop;
end;
$$;

-- Numeric entitlements are database invariants, not UI hints. These guards use
-- the same advisory keys as downgrade approval so direct Data API writes,
-- Server Actions and concurrent requests cannot exceed the configured limit.
create or replace function private.enforce_plan_record_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club_id uuid;
  v_key text;
  v_increases boolean := false;
  v_plan_id uuid;
  v_limit bigint;
  v_count bigint := 0;
begin
  v_club_id := new.club_id;
  if tg_table_name = 'club_roles' and auth.role() = 'authenticated' then
    if (tg_op = 'INSERT' and new.is_system)
       or (tg_op = 'UPDATE' and new.is_system is distinct from old.is_system)
    then raise exception 'system_role_flag_service_only'; end if;
  end if;
  case tg_table_name
    when 'clients' then
      v_key := 'clients';
      v_increases := tg_op = 'INSERT' or new.club_id is distinct from old.club_id;
    when 'products' then
      v_key := 'products';
      v_increases := new.is_active and (
        tg_op = 'INSERT' or not old.is_active or new.club_id is distinct from old.club_id
      );
    when 'club_roles' then
      v_key := 'roles';
      v_increases := not new.is_system and (
        tg_op = 'INSERT' or old.is_system or new.club_id is distinct from old.club_id
      );
    when 'staff' then
      v_key := 'staff';
      v_increases := new.is_active and (
        tg_op = 'INSERT' or not old.is_active or new.club_id is distinct from old.club_id
      );
    when 'staff_invitations' then
      v_key := 'staff';
      v_increases := new.accepted_at is null and new.expires_at > now()
        and (tg_op = 'INSERT' or old.accepted_at is not null or old.expires_at <= now()
             or new.club_id is distinct from old.club_id);
    when 'telegram_integrations' then
      v_key := 'integrations';
      v_increases := tg_op = 'INSERT' or new.club_id is distinct from old.club_id;
    when 'integration_connections' then
      v_key := 'integrations';
      v_increases := tg_op = 'INSERT' or new.club_id is distinct from old.club_id;
    when 'access_control_integrations' then
      v_key := 'integrations';
      v_increases := tg_op = 'INSERT' or new.club_id is distinct from old.club_id;
    when 'payment_connection_requests' then
      v_key := 'integrations';
      v_increases := new.status in ('new', 'active')
        and (tg_op = 'INSERT' or old.status not in ('new', 'active')
             or new.club_id is distinct from old.club_id);
    else
      return new;
  end case;
  if not v_increases then return new; end if;
  if not private.club_has_platform_access(v_club_id) then
    raise exception 'platform_subscription_locked';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('plan-limit:' || v_club_id::text || ':' || v_key, 0));
  select coalesce(clubs.plan_id, fallback.id) into v_plan_id
    from public.clubs clubs
    left join public.plans fallback on fallback.code = clubs.plan::text
   where clubs.id = v_club_id;
  if v_plan_id is null then raise exception 'plan_limit_plan_not_found'; end if;
  select limit_value into v_limit from public.plan_limits
   where plan_id = v_plan_id and limit_key = v_key;
  if not found then raise exception 'plan_limit_unconfigured:%', v_key; end if;
  if v_limit is null then return new; end if;

  case v_key
    when 'clients' then
      select count(*) into v_count from public.clients where club_id = v_club_id;
    when 'products' then
      select count(*) into v_count from public.products where club_id = v_club_id and is_active;
    when 'roles' then
      select count(*) into v_count from public.club_roles where club_id = v_club_id and not is_system;
    when 'staff' then
      select count(*) into v_count from public.staff where club_id = v_club_id and is_active;
      v_count := v_count + (
        select count(*) from public.staff_invitations
         where club_id = v_club_id and accepted_at is null and expires_at > now()
      );
    when 'integrations' then
      select (select count(*) from public.telegram_integrations where club_id = v_club_id)
        + (select count(*) from public.integration_connections where club_id = v_club_id)
        + (select count(*) from public.access_control_integrations where club_id = v_club_id)
        + (select count(*) from public.payment_connection_requests
            where club_id = v_club_id and status in ('new', 'active'))
        into v_count;
  end case;
  if v_count >= v_limit then raise exception 'plan_limit_exceeded:%', v_key; end if;
  return new;
end;
$$;

revoke all on function private.enforce_plan_record_limit() from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'clients', 'products', 'club_roles', 'staff', 'staff_invitations',
    'telegram_integrations', 'integration_connections', 'access_control_integrations',
    'payment_connection_requests'
  ] loop
    execute format('drop trigger if exists plan_record_limit_gate on public.%I', v_table);
    execute format(
      'create trigger plan_record_limit_gate before insert or update on public.%I for each row execute function private.enforce_plan_record_limit()',
      v_table
    );
  end loop;
end;
$$;

-- The normal privilege guard must allow one narrowly authenticated transition:
-- consuming the exact locked invitation for the current user. The accept RPC
-- sets a transaction-local invitation id after marking that row accepted. This
-- exception cannot be reused by a later Data API request or for another role.
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
  v_accept_invite_id text := nullif(current_setting('app.accept_staff_invitation_id', true), '');
begin
  if v_uid is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op in ('INSERT', 'UPDATE')
     and new.user_id = v_uid
     and new.is_active
     and v_accept_invite_id is not null
     and (tg_op <> 'UPDATE'
          or (new.user_id is not distinct from old.user_id
              and new.club_id is not distinct from old.club_id))
     and exists (
       select 1
         from public.staff_invitations invitation
         join auth.users invited_user on invited_user.id = v_uid
        where invitation.id::text = v_accept_invite_id
          and invitation.club_id = new.club_id
          and invitation.role = new.role
          and invitation.accepted_at = transaction_timestamp()
          and (invitation.email is null or lower(invitation.email) = lower(invited_user.email))
     )
  then return new; end if;

  select staff.role, roles.permissions
    into v_actor_role, v_actor_permissions
    from public.staff staff
    left join public.club_roles roles
      on roles.club_id = staff.club_id and roles.key = staff.role
   where staff.user_id = v_uid
     and staff.club_id = coalesce(new.club_id, old.club_id)
     and staff.is_active = true
   order by (staff.role = 'owner') desc
   limit 1;
  v_is_owner := coalesce(v_actor_role, '') = 'owner';

  if tg_op = 'DELETE' then
    if old.role = 'owner' then raise exception 'owner staff row cannot be deleted'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE'
     and (new.user_id is distinct from old.user_id or new.club_id is distinct from old.club_id)
  then raise exception 'staff identity fields are immutable'; end if;
  if new.role = 'owner' and not v_is_owner then
    raise exception 'only owner can assign owner role';
  end if;
  if not v_is_owner and (tg_op = 'INSERT' or new.role is distinct from old.role) then
    select roles.permissions into v_target_permissions
      from public.club_roles roles
     where roles.club_id = new.club_id and roles.key = new.role
     limit 1;
    if v_target_permissions is null
       or v_actor_permissions is null
       or not (v_actor_permissions @> v_target_permissions)
    then raise exception 'cannot assign a role with broader permissions'; end if;
  end if;
  if tg_op = 'UPDATE' and old.role = 'owner' and not v_is_owner then
    raise exception 'only owner can modify owner';
  end if;
  if tg_op = 'UPDATE' and new.user_id = v_uid and not v_is_owner
     and (new.role is distinct from old.role
          or (new.settings -> 'permissions') is distinct from (old.settings -> 'permissions'))
  then raise exception 'cannot escalate own permissions'; end if;
  return new;
end;
$$;

revoke all on function public.enforce_staff_no_escalation()
  from public, anon, authenticated;

-- Accept exactly the locked invitation that reserved the staff slot. Marking
-- it accepted before the staff upsert means the generic limit trigger sees the
-- reservation replaced (not duplicated), while any later failure rolls the
-- whole transaction back and keeps the invite pending.
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
  ) then raise exception 'invalid owner invitation'; end if;

  update public.staff_invitations
     set accepted_at = now()
   where id = v_invite.id;

  perform set_config('app.accept_staff_invitation_id', v_invite.id::text, true);

  update public.staff
     set role = v_invite.role,
         is_active = true,
         -- A new invitation is a fresh authorization decision. Preserve
         -- profile/payroll metadata, but never resurrect old per-user
         -- permission overrides from a previously deactivated membership.
         settings = jsonb_set(
           coalesce(settings, '{}'::jsonb) - 'permissions',
           '{status}',
           '"active"'::jsonb,
           true
         )
   where club_id = v_invite.club_id and user_id = v_uid;
  if not found then
    insert into public.staff (club_id, user_id, role, is_active)
    values (v_invite.club_id, v_uid, v_invite.role, true);
  end if;
  perform set_config('app.accept_staff_invitation_id', '', true);

  return v_invite.club_id;
end;
$$;

revoke all on function public.accept_staff_invitation(text) from public, anon;
grant execute on function public.accept_staff_invitation(text) to authenticated;

create or replace function private.enforce_canonical_owner_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.clubs clubs
     where clubs.id = old.club_id
       and clubs.owner_id = old.user_id
       and clubs.status <> 'deleted'
  ) and not exists (
    select 1 from public.staff staff
     where staff.club_id = old.club_id
       and staff.user_id = old.user_id
       and staff.role = 'owner'
       and staff.is_active
  ) then
    raise exception 'canonical_owner_staff_required';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function private.enforce_canonical_owner_staff() from public, anon, authenticated;
drop trigger if exists canonical_owner_staff_guard on public.staff;
create constraint trigger canonical_owner_staff_guard
after update or delete on public.staff
deferrable initially immediate
for each row execute function private.enforce_canonical_owner_staff();

-- Direct Data API reads of operational records are also denied after lock.
-- Identity/billing recovery tables (clubs, staff, club_roles, plans, support,
-- billing requests) stay readable so the narrow recovery shell can resolve.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'access_control_credentials', 'access_control_events', 'access_control_integrations',
    'access_control_reservations', 'acquiring_transactions', 'audit_logs', 'broadcasts',
    'class_bookings', 'classes', 'client_card_fingerprints',
    'client_conversation_messages', 'client_conversation_reads', 'client_conversations',
    'client_interactions', 'client_reply_templates', 'clients', 'club_payment_credentials',
    'growth_experiment_runs', 'instagram_daily_insights', 'instagram_media',
    'integration_connections', 'integration_events', 'integration_oauth_states',
    'integration_sync_runs', 'inventory', 'marketing_touchpoints', 'memberships',
    'notification_templates', 'notifications', 'payme_transactions',
    'payment_connection_requests', 'payments', 'plan_usage', 'plan_usage_reservations',
    'products', 'qr_pass_redemptions', 'retention_cases', 'rooms', 'schedules',
    'stock_movements', 'subscriptions', 'telegram_events', 'telegram_integrations',
    'telegram_staff_pairings', 'telegram_users', 'visits'
  ] loop
    execute format('drop policy if exists platform_subscription_read_gate on public.%I', v_table);
    execute format(
      'create policy platform_subscription_read_gate on public.%I as restrictive for select to authenticated using (private.club_has_platform_access(club_id))',
      v_table
    );
  end loop;
end;
$$;

-- Recovery keeps only the caller's own identity/role row. Full club rosters,
-- teammate PII and unrelated role documents resume with operational access.
drop policy if exists platform_subscription_staff_read_gate on public.staff;
create policy platform_subscription_staff_read_gate
  on public.staff as restrictive for select to authenticated
  using (private.club_has_platform_access(club_id) or user_id = auth.uid());

drop policy if exists platform_subscription_clubs_read_gate on public.clubs;
create policy platform_subscription_clubs_read_gate
  on public.clubs as restrictive for select to authenticated
  using (private.club_has_platform_access(id));

drop policy if exists platform_subscription_club_roles_read_gate on public.club_roles;
create policy platform_subscription_club_roles_read_gate
  on public.club_roles as restrictive for select to authenticated
  using (
    private.club_has_platform_access(club_id)
    or exists (
      select 1 from public.staff own
       where own.club_id = club_roles.club_id
         and own.user_id = auth.uid()
         and own.is_active
         and own.role::text = club_roles.key
    )
  );

drop policy if exists platform_subscription_users_read_gate on public.users;
create policy platform_subscription_users_read_gate
  on public.users as restrictive for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
        from public.staff target
        join public.staff own on own.club_id = target.club_id
       where target.user_id = users.id
         and own.user_id = auth.uid()
         and own.is_active
         and private.club_has_platform_access(target.club_id)
    )
  );

-- Keep personal avatars available, but gate club-owned operational storage.
drop policy if exists platform_subscription_storage_insert_gate on storage.objects;
create policy platform_subscription_storage_insert_gate
  on storage.objects as restrictive for insert to authenticated
  with check (
    case when bucket_id in ('broadcasts', 'product-photos')
      then private.club_has_platform_access(((storage.foldername(name))[1])::uuid)
      else true
    end
  );
drop policy if exists platform_subscription_storage_update_gate on storage.objects;
create policy platform_subscription_storage_update_gate
  on storage.objects as restrictive for update to authenticated
  using (
    case when bucket_id in ('broadcasts', 'product-photos')
      then private.club_has_platform_access(((storage.foldername(name))[1])::uuid)
      else true
    end
  )
  with check (
    case when bucket_id in ('broadcasts', 'product-photos')
      then private.club_has_platform_access(((storage.foldername(name))[1])::uuid)
      else true
    end
  );
drop policy if exists platform_subscription_storage_delete_gate on storage.objects;
create policy platform_subscription_storage_delete_gate
  on storage.objects as restrictive for delete to authenticated
  using (
    case when bucket_id in ('broadcasts', 'product-photos')
      then private.club_has_platform_access(((storage.foldername(name))[1])::uuid)
      else true
    end
  );

-- The legacy auth-facing RPC bypasses plan limits and lifecycle. Expand already
-- installed separate service-only initial-club and branch entrypoints.
revoke all on function public.create_club(text, text) from public, anon, authenticated;

-- Fresh/staging migration chains must not retain the abandoned caller-supplied
-- user aggregate. It is absent in production but unsafe if an old DB has it.
drop function if exists public.get_layout_context(uuid, uuid);
revoke all on function private.reference_in_club(text, uuid, uuid) from public, anon, authenticated;

create or replace function private.enforce_platform_billing_request_quote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base_amount numeric(12,2);
  v_plan public.plans%rowtype;
  v_club public.clubs%rowtype;
  v_same_plan boolean := false;
  v_has_any_lock boolean := false;
  v_has_complete_lock boolean := false;
  v_expected_price numeric(12,2);
  v_expected_currency text;
  v_expected_period text;
begin
  if tg_op = 'INSERT' then
    if new.months < 1 or new.months > 12 then raise exception 'billing_request_invalid_months'; end if;
    if new.quoted_period <> 'monthly' then raise exception 'billing_request_unsupported_period'; end if;
    if new.quoted_plan_id is null
       or new.quoted_unit_price is null
       or new.quoted_unit_price < 0
       or nullif(btrim(new.quoted_currency), '') is null
       or nullif(btrim(new.quoted_period), '') is null
       or new.quoted_at is null
       or new.quoted_at > now() + interval '5 minutes'
       or new.amount is null
       or new.amount < 0
       or new.discount_amount < 0
       or new.compensation_discount_amount < 0
       or new.promo_free_days < 0
       or new.promo_free_days > 365
    then raise exception 'billing_request_quote_required'; end if;

    -- Lock/read the exact catalog + club contract used by the quote. Combined
    -- with the expand RPC's billing-table lock, a concurrent catalog edit can
    -- no longer leave a stale request behind after “apply to all”.
    select * into v_plan from public.plans
     where id = new.quoted_plan_id and is_active and not is_archived
     for key share;
    if not found or v_plan.is_trial then raise exception 'billing_plan_not_found'; end if;
    if new.plan is distinct from v_plan.code then raise exception 'billing_request_plan_identity_invalid'; end if;

    select * into v_club from public.clubs
     where id = new.club_id and status <> 'deleted'
     for key share;
    if not found then raise exception 'billing_club_not_found'; end if;

    v_same_plan := coalesce(v_club.plan_id = v_plan.id, false)
      or (v_club.plan_id is null and v_club.plan::text = v_plan.code);
    if v_same_plan and v_club.plan_expires_at is null then
      raise exception 'billing_unlimited_plan_no_renewal';
    end if;
    v_has_any_lock := v_club.plan_price_locked is not null
      or nullif(btrim(v_club.plan_currency_locked), '') is not null
      or nullif(btrim(v_club.plan_period_locked), '') is not null;
    v_has_complete_lock := v_club.plan_price_locked is not null
      and nullif(btrim(v_club.plan_currency_locked), '') is not null
      and nullif(btrim(v_club.plan_period_locked), '') is not null;
    if v_same_plan and v_has_any_lock and not v_has_complete_lock then
      raise exception 'billing_club_commercial_terms_incomplete';
    end if;

    v_expected_price := case when v_same_plan and v_has_complete_lock
      then v_club.plan_price_locked else v_plan.price end;
    v_expected_currency := case when v_same_plan and v_has_complete_lock
      then btrim(v_club.plan_currency_locked) else btrim(v_plan.currency) end;
    v_expected_period := case when v_same_plan and v_has_complete_lock
      then btrim(v_club.plan_period_locked) else btrim(v_plan.period) end;
    if new.quoted_unit_price is distinct from v_expected_price
       or btrim(new.quoted_currency) is distinct from v_expected_currency
       or btrim(new.quoted_period) is distinct from v_expected_period
    then raise exception 'billing_request_quote_stale'; end if;

    v_base_amount := round(new.quoted_unit_price * new.months, 2);
    if new.discount_amount > v_base_amount
       or new.compensation_discount_amount > v_base_amount - new.discount_amount
       or new.amount <> greatest(0::numeric, v_base_amount - new.discount_amount - new.compensation_discount_amount)
    then raise exception 'billing_request_quote_invalid'; end if;
    if new.promo_code_id is null
       and (new.promo_code is not null or new.discount_amount <> 0 or new.promo_free_days <> 0)
    then raise exception 'billing_request_promo_snapshot_invalid'; end if;
    if new.promo_code_id is not null and nullif(btrim(new.promo_code), '') is null then
      raise exception 'billing_request_promo_snapshot_invalid';
    end if;
    if new.compensation_id is null and new.compensation_discount_amount <> 0 then
      raise exception 'billing_request_compensation_snapshot_invalid';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.club_id is distinct from old.club_id
       or new.plan is distinct from old.plan
       or new.months is distinct from old.months
       or new.amount is distinct from old.amount
       or new.promo_code_id is distinct from old.promo_code_id
       or new.promo_code is distinct from old.promo_code
       or new.discount_amount is distinct from old.discount_amount
       or new.compensation_id is distinct from old.compensation_id
       or new.compensation_discount_amount is distinct from old.compensation_discount_amount
       or new.quoted_plan_id is distinct from old.quoted_plan_id
       or new.quoted_unit_price is distinct from old.quoted_unit_price
       or new.quoted_currency is distinct from old.quoted_currency
       or new.quoted_period is distinct from old.quoted_period
       or new.quoted_at is distinct from old.quoted_at
       or new.promo_free_days is distinct from old.promo_free_days
    then raise exception 'billing_request_quote_immutable'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists platform_billing_requests_quote_immutable on public.platform_billing_requests;
create trigger platform_billing_requests_quote_immutable
before insert or update on public.platform_billing_requests
for each row execute function private.enforce_platform_billing_request_quote();
revoke all on function private.enforce_platform_billing_request_quote() from public, anon, authenticated;

-- Lock billing requests before their compensation to match approval's lock
-- order and avoid request↔compensation deadlocks. Revoking a compensation
-- cancels affected pending requests; their immutable quote stays auditable.
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
  lock table public.platform_billing_requests in share row exclusive mode;
  perform 1
    from public.platform_billing_requests
   where compensation_id = p_compensation_id
     and status = 'pending'
   order by id
   for update;

  select * into v_compensation
    from public.platform_club_compensations
   where id = p_compensation_id
   for update;
  if not found or v_compensation.status <> 'active' then
    raise exception 'compensation_unavailable';
  end if;

  update public.platform_billing_requests
     set status = 'cancelled',
         resolved_at = v_now,
         resolution_reason = 'compensation_cancelled_resubmit'
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

create or replace function private.enforce_platform_plan_capacity(
  p_club_id uuid, p_owner_id uuid, p_plan_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_key text;
  v_limit bigint;
  v_count bigint;
begin
  -- Authoritative point-in-time recheck at approval. This deliberately avoids
  -- platform-wide table locks. It does not serialize a later capacity-creating
  -- write; full closure needs per-scope locks plus DB guards on every such path.

  foreach v_key in array array['clients', 'staff', 'branches', 'products', 'roles', 'integrations'] loop
    if v_key = 'branches' then
      if p_owner_id is null then raise exception 'billing_club_owner_not_found'; end if;
      perform pg_advisory_xact_lock(hashtextextended('plan-limit-owner:' || p_owner_id::text || ':branches', 0));
    else
      perform pg_advisory_xact_lock(hashtextextended('plan-limit:' || p_club_id::text || ':' || v_key, 0));
    end if;
    select limit_value into v_limit from public.plan_limits
     where plan_id = p_plan_id and limit_key = v_key;
    if not found then raise exception 'billing_plan_capacity_unconfigured:%', v_key; end if;
    if v_limit is null then continue; end if;

    case v_key
      when 'clients' then
        select count(*) into v_count from public.clients where club_id = p_club_id;
      when 'staff' then
        select count(*) into v_count from public.staff where club_id = p_club_id and is_active;
        v_count := v_count + (
          select count(*) from public.staff_invitations
           where club_id = p_club_id and accepted_at is null and expires_at > now()
        );
      when 'branches' then
        if p_owner_id is null then raise exception 'billing_club_owner_not_found'; end if;
        -- Existing product representation; this never propagates a plan.
        select count(*) into v_count from public.clubs where owner_id = p_owner_id and status <> 'deleted';
      when 'products' then
        select count(*) into v_count from public.products where club_id = p_club_id and is_active;
      when 'roles' then
        select count(*) into v_count from public.club_roles where club_id = p_club_id and is_system = false;
      when 'integrations' then
        select (select count(*) from public.telegram_integrations where club_id = p_club_id)
          + (select count(*) from public.integration_connections where club_id = p_club_id)
          + (select count(*) from public.access_control_integrations where club_id = p_club_id)
          + (select count(*) from public.payment_connection_requests where club_id = p_club_id and status in ('new', 'active'))
          into v_count;
    end case;
    if v_count > v_limit then raise exception 'billing_plan_capacity_exceeded:%', v_key; end if;
  end loop;
end;
$$;

revoke all on function private.enforce_platform_plan_capacity(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function private.enforce_platform_plan_capacity(uuid, uuid, uuid) to service_role;

create or replace function public.platform_approve_billing_request(
  p_request_id uuid, p_admin_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.platform_billing_requests%rowtype;
  v_club public.clubs%rowtype;
  v_plan public.plans%rowtype;
  v_promo public.platform_promo_codes%rowtype;
  v_compensation public.platform_club_compensations%rowtype;
  v_now timestamptz := now();
  v_expires_at timestamptz;
  v_same_plan boolean := false;
  v_quoted_base_amount numeric(12,2);
begin
  lock table public.platform_billing_requests in share row exclusive mode;
  select * into v_request from public.platform_billing_requests where id = p_request_id for update;
  if not found then raise exception 'billing_request_not_found'; end if;
  if v_request.status <> 'pending' then raise exception 'billing_request_already_processed'; end if;
  if v_request.months < 1 or v_request.months > 12 then raise exception 'billing_request_invalid_months'; end if;
  if v_request.quoted_period <> 'monthly' then raise exception 'billing_request_unsupported_period'; end if;

  -- Never reprice a legacy or untrusted request at today's plan price.
  if v_request.quoted_plan_id is null
     or v_request.quoted_unit_price is null
     or v_request.quoted_unit_price < 0
     or nullif(btrim(v_request.quoted_currency), '') is null
     or nullif(btrim(v_request.quoted_period), '') is null
     or v_request.quoted_at is null
     or v_request.amount is null
     or v_request.amount < 0
     or v_request.discount_amount < 0
     or v_request.compensation_discount_amount < 0
     or v_request.promo_free_days < 0
     or v_request.promo_free_days > 365
  then raise exception 'billing_request_quote_missing'; end if;
  v_quoted_base_amount := round(v_request.quoted_unit_price * v_request.months, 2);
  if v_request.discount_amount > v_quoted_base_amount
     or v_request.compensation_discount_amount > v_quoted_base_amount - v_request.discount_amount
     or v_request.amount <> greatest(0::numeric, v_quoted_base_amount - v_request.discount_amount - v_request.compensation_discount_amount)
  then raise exception 'billing_request_quote_invalid'; end if;

  select * into v_plan from public.plans
   where id = v_request.quoted_plan_id and is_archived = false and is_active = true;
  if not found then raise exception 'billing_plan_not_found'; end if;
  select * into v_club from public.clubs where id = v_request.club_id for update;
  if not found then raise exception 'billing_club_not_found'; end if;
  if v_club.status = 'deleted' then raise exception 'billing_club_deleted'; end if;

  v_same_plan := coalesce(v_club.plan_id = v_plan.id, false)
    or (v_club.plan_id is null and v_club.plan::text = v_plan.code);
  if v_same_plan and not v_plan.is_trial and v_club.plan_expires_at is null then
    raise exception 'billing_unlimited_plan_no_renewal';
  end if;
  if not v_same_plan then
    perform private.enforce_platform_plan_capacity(v_request.club_id, v_club.owner_id, v_plan.id);
  end if;

  if v_request.promo_code_id is null
     and (v_request.promo_code is not null or v_request.discount_amount <> 0 or v_request.promo_free_days <> 0)
  then raise exception 'billing_request_promo_snapshot_invalid'; end if;
  if v_request.compensation_id is null and v_request.compensation_discount_amount <> 0 then
    raise exception 'billing_request_compensation_snapshot_invalid';
  end if;

  if v_request.promo_code_id is not null then
    select * into v_promo from public.platform_promo_codes where id = v_request.promo_code_id for update;
    if not found or not v_promo.is_active then raise exception 'promo_inactive'; end if;
    if v_promo.starts_at is not null and v_promo.starts_at > v_now then raise exception 'promo_not_started'; end if;
    if v_promo.expires_at is not null and v_promo.expires_at <= v_now then raise exception 'promo_expired'; end if;
    if v_promo.max_uses is not null and v_promo.used_count >= v_promo.max_uses then raise exception 'promo_exhausted'; end if;
    if cardinality(v_promo.plan_codes) > 0 and not (v_request.plan = any(v_promo.plan_codes)) then raise exception 'promo_plan_mismatch'; end if;
  end if;
  if v_request.compensation_id is not null then
    select * into v_compensation from public.platform_club_compensations where id = v_request.compensation_id for update;
    if not found
       or v_compensation.club_id <> v_request.club_id
       or v_compensation.benefit_type <> 'discount_pct'
       or v_compensation.status <> 'active'
       or (v_compensation.expires_at is not null and v_compensation.expires_at <= v_now)
    then raise exception 'compensation_unavailable'; end if;
  end if;

  v_expires_at := (case when v_same_plan then greatest(v_now, v_club.plan_expires_at) else v_now end)
    + make_interval(months => v_request.months) + make_interval(days => v_request.promo_free_days);

  -- Keep manual suspension intact; status/suspended_at are intentionally absent.
  -- `plan_id` is authoritative for custom plans. Updating the legacy enum
  -- column for every plan would fire trg_sync_club_plan_id and overwrite a
  -- custom plan_id with the club's previous built-in plan.
  update public.clubs
     set plan_id = v_plan.id,
         plan_price_locked = case when v_plan.is_trial then null when v_same_plan then coalesce(v_club.plan_price_locked, v_request.quoted_unit_price) else v_request.quoted_unit_price end,
         plan_currency_locked = case when v_plan.is_trial then null when v_same_plan then coalesce(v_club.plan_currency_locked, v_request.quoted_currency) else v_request.quoted_currency end,
         plan_period_locked = case when v_plan.is_trial then null when v_same_plan then coalesce(v_club.plan_period_locked, v_request.quoted_period) else v_request.quoted_period end,
         plan_assigned_at = v_now,
         plan_expires_at = case when v_plan.is_trial then null else v_expires_at end,
         trial_expires_at = case when v_plan.is_trial then v_now + make_interval(days => greatest(1, v_plan.trial_days)) else trial_expires_at end
   where id = v_request.club_id;
  if not found then raise exception 'billing_club_race'; end if;

  if v_plan.code in ('trial', 'starter', 'standard', 'business') then
    update public.clubs
       set plan = v_plan.code::public.club_plan
     where id = v_request.club_id;
    if not found then raise exception 'billing_club_race'; end if;
  end if;

  update public.platform_billing_requests
     set status = 'approved', resolved_at = v_now, resolved_by = p_admin_id
   where id = p_request_id and status = 'pending';
  if not found then raise exception 'billing_request_race'; end if;

  if v_request.promo_code_id is not null then
    update public.platform_promo_codes set used_count = used_count + 1, updated_at = v_now
     where id = v_request.promo_code_id;
    insert into public.platform_promo_redemptions (promo_code_id, billing_request_id, club_id, discount_amount, free_days)
    values (v_request.promo_code_id, v_request.id, v_request.club_id, v_request.discount_amount, v_request.promo_free_days);
  end if;
  if v_request.compensation_id is not null then
    update public.platform_club_compensations
       set status = 'applied', applied_at = v_now, billing_request_id = v_request.id, updated_at = v_now
     where id = v_request.compensation_id and status = 'active';
    if not found then raise exception 'compensation_race'; end if;
  end if;

  return jsonb_build_object(
    'club_id', v_request.club_id, 'plan', v_plan.code, 'months', v_request.months,
    'expires_at', case when v_plan.is_trial then null else v_expires_at end,
    'promo_code', v_request.promo_code, 'amount', v_request.amount,
    'discount_amount', v_request.discount_amount,
    'compensation_discount_amount', v_request.compensation_discount_amount,
    'free_days', v_request.promo_free_days, 'club_status', v_club.status
  );
end;
$$;

revoke all on function public.platform_approve_billing_request(uuid, uuid) from public, anon, authenticated;
grant execute on function public.platform_approve_billing_request(uuid, uuid) to service_role;
