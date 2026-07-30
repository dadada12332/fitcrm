-- Close the two direct Data API privilege escalations found by the 2026-07-30
-- audit and make provider payment confirmation atomic/idempotent.

create schema if not exists private;

-- Platform scope must require an exact platform role. A corrupted arbitrary
-- non-null value must never become an all-club wildcard.
create or replace function public.user_club_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
    from public.clubs c
   where exists (
     select 1
       from public.users u
      where u.id = (select auth.uid())
        and u.platform_role in ('platform_admin', 'super_admin')
   )
  union
  select s.club_id
    from public.staff s
   where s.user_id = (select auth.uid())
     and s.is_active;
$$;

revoke all on function public.user_club_ids() from public, anon;
grant execute on function public.user_club_ids() to authenticated;

-- A self-profile UPDATE may change ordinary profile fields but never the
-- platform authorization field. Platform role management is already exposed
-- only through platform_set_admin_role() to service_role.
create or replace function private.protect_platform_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' and new.platform_role is not null then
      raise exception 'platform_role_service_only' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE'
       and new.platform_role is distinct from old.platform_role then
      raise exception 'platform_role_service_only' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists users_protect_platform_role on public.users;
create trigger users_protect_platform_role
before insert or update on public.users
for each row execute function private.protect_platform_role();

revoke all on function private.protect_platform_role() from public, anon, authenticated;

-- A user profile is part of the authorization graph. It may be updated, but
-- deleting and recreating it is not a supported self-service operation.
drop policy if exists users_self_delete on public.users;

-- Club members may edit the club's business profile, but plan, lifecycle and
-- platform operations are service-only. Keeping this in a trigger protects
-- direct PostgREST calls as well as future Server Actions.
create or replace function private.protect_club_platform_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and (
       new.owner_id is distinct from old.owner_id
    or new.plan is distinct from old.plan
    or new.trial_expires_at is distinct from old.trial_expires_at
    or new.plan_expires_at is distinct from old.plan_expires_at
    or new.status is distinct from old.status
    or new.health_score is distinct from old.health_score
    or new.admin_notes is distinct from old.admin_notes
    or new.suspended_at is distinct from old.suspended_at
    or new.plan_id is distinct from old.plan_id
    or new.plan_price_locked is distinct from old.plan_price_locked
    or new.plan_currency_locked is distinct from old.plan_currency_locked
    or new.plan_period_locked is distinct from old.plan_period_locked
    or new.plan_assigned_at is distinct from old.plan_assigned_at
  ) then
    raise exception 'club_platform_fields_service_only' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists clubs_protect_platform_fields on public.clubs;
create trigger clubs_protect_platform_fields
before update on public.clubs
for each row execute function private.protect_club_platform_fields();

revoke all on function private.protect_club_platform_fields() from public, anon, authenticated;

-- Internal implementation. The payment row is the serialization point. All
-- inventory, stock movements, membership activation and payment status
-- changes either commit together or roll back together.
create or replace function private.confirm_provider_payment(
  p_club_id uuid,
  p_payment_id uuid,
  p_provider text,
  p_tx_id text,
  p_paid_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_item record;
  v_updated integer;
  v_confirmation jsonb;
  v_newly_confirmed boolean := false;
begin
  if p_provider not in ('click', 'payme') then
    raise exception 'unsupported payment provider';
  end if;
  if nullif(trim(coalesce(p_tx_id, '')), '') is null then
    raise exception 'provider transaction id is required';
  end if;

  select *
    into v_payment
    from public.payments
   where id = p_payment_id
     and club_id = p_club_id
   for update;
  if not found then
    raise exception 'payment not found';
  end if;

  if v_payment.status = 'paid' then
    if v_payment.provider::text is distinct from p_provider
       or v_payment.tx_id is distinct from p_tx_id then
      raise exception 'payment already confirmed by another transaction';
    end if;
  elsif v_payment.status = 'pending' then
    update public.payments
       set status = 'paid',
           paid_at = coalesce(p_paid_at, now()),
           provider = p_provider::public.payment_provider,
           tx_id = p_tx_id
     where id = p_payment_id
       and club_id = p_club_id;
    v_newly_confirmed := true;

    if jsonb_typeof(v_payment.pending_items) = 'array'
       and jsonb_array_length(v_payment.pending_items) > 0 then
      for v_item in
        select
          item.product_id,
          sum(item.qty)::numeric as qty,
          max(item.unit_price)::numeric as unit_price
        from jsonb_to_recordset(v_payment.pending_items)
          as item(product_id uuid, qty numeric, unit_price numeric)
        group by item.product_id
      loop
        if v_item.product_id is null or v_item.qty is null or v_item.qty <= 0 then
          raise exception 'invalid pending inventory item';
        end if;

        update public.inventory
           set quantity = quantity - v_item.qty,
               updated_at = now()
         where club_id = p_club_id
           and product_id = v_item.product_id
           and quantity >= v_item.qty;
        get diagnostics v_updated = row_count;
        if v_updated <> 1 then
          raise exception 'insufficient inventory for product %', v_item.product_id;
        end if;

        insert into public.stock_movements (
          club_id, product_id, type, qty, unit_price, client_id, payment_id
        ) values (
          p_club_id, v_item.product_id, 'sale', v_item.qty,
          coalesce(v_item.unit_price, 0), v_payment.client_id, p_payment_id
        );
      end loop;

      update public.payments
         set pending_items = null
       where id = p_payment_id
         and club_id = p_club_id;
    end if;
  else
    raise exception 'payment cannot be confirmed from status %', v_payment.status;
  end if;

  select private.confirm_paid_membership(p_club_id, p_payment_id)
    into v_confirmation;

  return coalesce(v_confirmation, '{}'::jsonb)
    || jsonb_build_object(
      'payment_id', p_payment_id,
      'newly_confirmed', v_newly_confirmed
    );
end;
$$;

revoke all on function private.confirm_provider_payment(uuid, uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function private.confirm_provider_payment(uuid, uuid, text, text, timestamptz)
  to service_role;

create or replace function public.confirm_provider_payment(
  p_club_id uuid,
  p_payment_id uuid,
  p_provider text,
  p_tx_id text,
  p_paid_at timestamptz default now()
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.confirm_provider_payment(
    p_club_id, p_payment_id, p_provider, p_tx_id, p_paid_at
  );
$$;

revoke all on function public.confirm_provider_payment(uuid, uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.confirm_provider_payment(uuid, uuid, text, text, timestamptz)
  to service_role;

-- Payme transaction state and CRM fulfillment share the same DB transaction.
create or replace function public.perform_payme_transaction(
  p_club_id uuid,
  p_tx_id text,
  p_perform_time bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.payme_transactions%rowtype;
  v_confirmation jsonb;
begin
  select *
    into v_tx
    from public.payme_transactions
   where id = p_tx_id
     and club_id = p_club_id
   for update;
  if not found then
    raise exception 'payme transaction not found';
  end if;

  if v_tx.state = 2 then
    return jsonb_build_object(
      'transaction', v_tx.id,
      'perform_time', v_tx.perform_time,
      'state', 2,
      'newly_confirmed', false
    );
  end if;
  if v_tx.state <> 1 or v_tx.payment_id is null then
    raise exception 'payme transaction cannot be performed';
  end if;

  select private.confirm_provider_payment(
    p_club_id,
    v_tx.payment_id,
    'payme',
    v_tx.id,
    to_timestamp(p_perform_time / 1000.0)
  ) into v_confirmation;

  update public.payme_transactions
     set state = 2,
         perform_time = p_perform_time
   where id = p_tx_id
     and club_id = p_club_id;

  return coalesce(v_confirmation, '{}'::jsonb)
    || jsonb_build_object(
      'transaction', p_tx_id,
      'perform_time', p_perform_time,
      'state', 2
    );
end;
$$;

revoke all on function public.perform_payme_transaction(uuid, text, bigint)
  from public, anon, authenticated;
grant execute on function public.perform_payme_transaction(uuid, text, bigint)
  to service_role;

-- Creation updates the Payme ledger and the payment provider in one commit.
create or replace function public.create_payme_transaction(
  p_club_id uuid,
  p_payment_id uuid,
  p_tx_id text,
  p_amount bigint,
  p_create_time bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_tx public.payme_transactions%rowtype;
begin
  select *
    into v_tx
    from public.payme_transactions
   where id = p_tx_id;
  if found then
    if v_tx.club_id <> p_club_id or v_tx.payment_id <> p_payment_id then
      raise exception 'payme transaction belongs to another order';
    end if;
    return jsonb_build_object(
      'transaction', v_tx.id,
      'create_time', v_tx.create_time,
      'state', v_tx.state,
      'created', false
    );
  end if;

  select *
    into v_payment
    from public.payments
   where id = p_payment_id
     and club_id = p_club_id
   for update;
  if not found then raise exception 'payment not found'; end if;
  if v_payment.status <> 'pending' then
    raise exception 'payment is not pending';
  end if;
  if round(v_payment.amount * 100)::bigint <> p_amount then
    raise exception 'payment amount mismatch';
  end if;
  if exists (
    select 1
      from public.payme_transactions
     where club_id = p_club_id
       and payment_id = p_payment_id
       and state in (1, 2)
  ) then
    raise exception 'payment already has an active transaction';
  end if;

  insert into public.payme_transactions (
    id, club_id, payment_id, amount, state, create_time
  ) values (
    p_tx_id, p_club_id, p_payment_id, p_amount, 1, p_create_time
  );

  update public.payments
     set provider = 'payme'
   where id = p_payment_id
     and club_id = p_club_id;

  return jsonb_build_object(
    'transaction', p_tx_id,
    'create_time', p_create_time,
    'state', 1,
    'created', true
  );
end;
$$;

revoke all on function public.create_payme_transaction(uuid, uuid, text, bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.create_payme_transaction(uuid, uuid, text, bigint, bigint)
  to service_role;

-- Cancellation keeps the provider ledger and CRM payment state atomic.
create or replace function public.cancel_payme_transaction(
  p_club_id uuid,
  p_tx_id text,
  p_cancel_time bigint,
  p_reason integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.payme_transactions%rowtype;
  v_payment public.payments%rowtype;
  v_state integer;
begin
  select *
    into v_tx
    from public.payme_transactions
   where id = p_tx_id
     and club_id = p_club_id
   for update;
  if not found then raise exception 'payme transaction not found'; end if;

  if v_tx.state < 0 then
    return jsonb_build_object(
      'transaction', v_tx.id,
      'cancel_time', v_tx.cancel_time,
      'state', v_tx.state,
      'newly_cancelled', false
    );
  end if;

  v_state := case when v_tx.state = 2 then -2 else -1 end;
  if v_tx.state = 2 and v_tx.payment_id is not null then
    select *
      into v_payment
      from public.payments
     where id = v_tx.payment_id
       and club_id = p_club_id
     for update;
    if not found
       or v_payment.status <> 'paid'
       or v_payment.provider::text <> 'payme'
       or v_payment.tx_id <> p_tx_id then
      raise exception 'confirmed payment state mismatch';
    end if;

    update public.payments
       set status = 'refunded'
     where id = v_tx.payment_id
       and club_id = p_club_id;
  end if;

  update public.payme_transactions
     set state = v_state,
         cancel_time = p_cancel_time,
         reason = p_reason
   where id = p_tx_id
     and club_id = p_club_id;

  return jsonb_build_object(
    'transaction', p_tx_id,
    'cancel_time', p_cancel_time,
    'state', v_state,
    'newly_cancelled', true
  );
end;
$$;

revoke all on function public.cancel_payme_transaction(uuid, text, bigint, integer)
  from public, anon, authenticated;
grant execute on function public.cancel_payme_transaction(uuid, text, bigint, integer)
  to service_role;
