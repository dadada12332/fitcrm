-- Enforce the same granular permissions in Postgres that the application uses.
-- This prevents authenticated users from bypassing Server Actions through the
-- Supabase Data API.

create schema if not exists private;

create or replace function private.has_club_permission(
  p_club_id uuid,
  p_module text,
  p_action text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff s
    left join public.club_roles cr
      on cr.club_id = s.club_id
     and cr.key = s.role
    where s.club_id = p_club_id
      and s.user_id = (select auth.uid())
      and s.is_active = true
      and (
        s.role = 'owner'
        or coalesce(
          (cr.permissions #>> array[p_module, p_action])::boolean,
          false
        )
      )
  );
$$;

revoke all on function private.has_club_permission(uuid, text, text) from public;
revoke all on function private.has_club_permission(uuid, text, text) from anon;
grant usage on schema private to authenticated;
grant execute on function private.has_club_permission(uuid, text, text) to authenticated;

-- Clients
drop policy if exists clients_club_all on public.clients;
create policy clients_select on public.clients for select to authenticated
  using (private.has_club_permission(club_id, 'clients', 'view'));
create policy clients_insert on public.clients for insert to authenticated
  with check (private.has_club_permission(club_id, 'clients', 'create'));
create policy clients_update on public.clients for update to authenticated
  using (private.has_club_permission(club_id, 'clients', 'edit'))
  with check (private.has_club_permission(club_id, 'clients', 'edit'));
create policy clients_delete on public.clients for delete to authenticated
  using (private.has_club_permission(club_id, 'clients', 'delete'));

-- Membership catalogue
drop policy if exists memberships_club_all on public.memberships;
create policy memberships_select on public.memberships for select to authenticated
  using (private.has_club_permission(club_id, 'memberships', 'view'));
create policy memberships_insert on public.memberships for insert to authenticated
  with check (private.has_club_permission(club_id, 'memberships', 'create'));
create policy memberships_update on public.memberships for update to authenticated
  using (
    private.has_club_permission(club_id, 'memberships', 'edit')
    or private.has_club_permission(club_id, 'memberships', 'change_price')
  )
  with check (
    private.has_club_permission(club_id, 'memberships', 'edit')
    or private.has_club_permission(club_id, 'memberships', 'change_price')
  );
create policy memberships_delete on public.memberships for delete to authenticated
  using (private.has_club_permission(club_id, 'memberships', 'delete'));

-- Client subscriptions
drop policy if exists subscriptions_club_all on public.subscriptions;
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (
    private.has_club_permission(club_id, 'clients', 'view')
    or private.has_club_permission(club_id, 'memberships', 'view')
  );
create policy subscriptions_insert on public.subscriptions for insert to authenticated
  with check (
    private.has_club_permission(club_id, 'memberships', 'sell')
    or private.has_club_permission(club_id, 'clients', 'extend')
    or private.has_club_permission(club_id, 'clients', 'create')
    or private.has_club_permission(club_id, 'payments', 'create')
  );
create policy subscriptions_update on public.subscriptions for update to authenticated
  using (
    private.has_club_permission(club_id, 'clients', 'freeze')
    or private.has_club_permission(club_id, 'clients', 'extend')
    or private.has_club_permission(club_id, 'memberships', 'sell')
    or private.has_club_permission(club_id, 'payments', 'create')
  )
  with check (
    private.has_club_permission(club_id, 'clients', 'freeze')
    or private.has_club_permission(club_id, 'clients', 'extend')
    or private.has_club_permission(club_id, 'memberships', 'sell')
    or private.has_club_permission(club_id, 'payments', 'create')
  );
create policy subscriptions_delete on public.subscriptions for delete to authenticated
  using (private.has_club_permission(club_id, 'clients', 'delete'));

-- Payments
drop policy if exists payments_club_all on public.payments;
create policy payments_select on public.payments for select to authenticated
  using (private.has_club_permission(club_id, 'payments', 'view'));
create policy payments_insert on public.payments for insert to authenticated
  with check (private.has_club_permission(club_id, 'payments', 'create'));
create policy payments_update on public.payments for update to authenticated
  using (private.has_club_permission(club_id, 'payments', 'refund'))
  with check (private.has_club_permission(club_id, 'payments', 'refund'));
create policy payments_delete on public.payments for delete to authenticated
  using (private.has_club_permission(club_id, 'payments', 'refund'));

-- Visits
drop policy if exists visits_club_all on public.visits;
create policy visits_select on public.visits for select to authenticated
  using (private.has_club_permission(club_id, 'visits', 'view'));
create policy visits_insert on public.visits for insert to authenticated
  with check (
    private.has_club_permission(club_id, 'visits', 'checkin')
    or private.has_club_permission(club_id, 'visits', 'manual')
  );
create policy visits_update on public.visits for update to authenticated
  using (private.has_club_permission(club_id, 'visits', 'checkout'))
  with check (private.has_club_permission(club_id, 'visits', 'checkout'));
create policy visits_delete on public.visits for delete to authenticated
  using (private.has_club_permission(club_id, 'visits', 'delete_history'));

-- Schedule
do $$
declare
  table_name text;
begin
  foreach table_name in array array['rooms', 'schedules', 'classes', 'class_bookings']
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_club_all', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.has_club_permission(club_id, ''schedule'', ''view''))',
      table_name || '_select', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.has_club_permission(club_id, ''schedule'', ''create''))',
      table_name || '_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.has_club_permission(club_id, ''schedule'', ''edit'')) with check (private.has_club_permission(club_id, ''schedule'', ''edit''))',
      table_name || '_update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.has_club_permission(club_id, ''schedule'', ''delete''))',
      table_name || '_delete', table_name
    );
  end loop;
end $$;

-- Warehouse
do $$
declare
  table_name text;
begin
  foreach table_name in array array['products', 'inventory', 'stock_movements']
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_club_all', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.has_club_permission(club_id, ''warehouse'', ''view''))',
      table_name || '_select', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.has_club_permission(club_id, ''warehouse'', ''sell'') or private.has_club_permission(club_id, ''warehouse'', ''supply'') or private.has_club_permission(club_id, ''warehouse'', ''writeoff''))',
      table_name || '_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.has_club_permission(club_id, ''warehouse'', ''sell'') or private.has_club_permission(club_id, ''warehouse'', ''supply'') or private.has_club_permission(club_id, ''warehouse'', ''writeoff'')) with check (private.has_club_permission(club_id, ''warehouse'', ''sell'') or private.has_club_permission(club_id, ''warehouse'', ''supply'') or private.has_club_permission(club_id, ''warehouse'', ''writeoff''))',
      table_name || '_update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.has_club_permission(club_id, ''warehouse'', ''supply''))',
      table_name || '_delete', table_name
    );
  end loop;
end $$;

-- Staff records. Every user may read their own row so role resolution keeps
-- working; viewing colleagues requires staff.view.
drop policy if exists staff_select on public.staff;
drop policy if exists staff_insert on public.staff;
drop policy if exists staff_update on public.staff;
drop policy if exists staff_delete on public.staff;
create policy staff_select on public.staff for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_club_permission(club_id, 'staff', 'view')
  );
create policy staff_insert on public.staff for insert to authenticated
  with check (private.has_club_permission(club_id, 'staff', 'create'));
create policy staff_update on public.staff for update to authenticated
  using (private.has_club_permission(club_id, 'staff', 'edit'))
  with check (private.has_club_permission(club_id, 'staff', 'edit'));
create policy staff_delete on public.staff for delete to authenticated
  using (private.has_club_permission(club_id, 'staff', 'delete'));

-- A user needs only the permission document for their own role. Full role
-- management remains restricted to settings.roles.
drop policy if exists club_roles_select on public.club_roles;
create policy club_roles_select on public.club_roles for select to authenticated
  using (
    private.has_club_permission(club_id, 'settings', 'roles')
    or exists (
      select 1
      from public.staff own
      where own.club_id = club_roles.club_id
        and own.user_id = (select auth.uid())
        and own.role = club_roles.key
        and own.is_active = true
    )
  );

-- Personal user data of colleagues follows staff.view.
drop policy if exists "View clubmates" on public.users;
create policy users_select on public.users for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.staff target
      where target.user_id = users.id
        and private.has_club_permission(target.club_id, 'staff', 'view')
    )
  );

-- Settings-related requests must not be readable or mutable by every club
-- member through the Data API.
drop policy if exists pcr_club_select on public.payment_connection_requests;
create policy pcr_select on public.payment_connection_requests for select to authenticated
  using (private.has_club_permission(club_id, 'settings', 'integrations'));

drop policy if exists billing_requests_select on public.platform_billing_requests;
drop policy if exists billing_requests_insert on public.platform_billing_requests;
drop policy if exists billing_requests_cancel on public.platform_billing_requests;
create policy billing_requests_select on public.platform_billing_requests for select to authenticated
  using (private.has_club_permission(club_id, 'settings', 'subscription'));
create policy billing_requests_insert on public.platform_billing_requests for insert to authenticated
  with check (private.has_club_permission(club_id, 'settings', 'subscription'));
create policy billing_requests_update on public.platform_billing_requests for update to authenticated
  using (private.has_club_permission(club_id, 'settings', 'subscription'))
  with check (private.has_club_permission(club_id, 'settings', 'subscription'));

drop policy if exists client_conversations_staff_read on public.client_conversations;
create policy client_conversations_select on public.client_conversations for select to authenticated
  using (private.has_club_permission(club_id, 'inbox', 'view'));

drop policy if exists audit_logs_club_all on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (
    private.has_club_permission(club_id, 'reports', 'view')
    or private.has_club_permission(club_id, 'settings', 'security')
  );
create policy audit_logs_insert on public.audit_logs for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and club_id in (select public.user_club_ids())
  );

-- Repair legacy duplicate "current" subscriptions, then make the invariant
-- impossible to violate again. The newest current row wins.
with ranked as (
  select
    id,
    row_number() over (
      partition by club_id, client_id
      order by created_at desc, id desc
    ) as position
  from public.subscriptions
  where status in ('active', 'frozen')
)
update public.subscriptions s
set status = 'expired'
from ranked r
where s.id = r.id
  and r.position > 1;

create unique index if not exists subscriptions_one_current_per_client
  on public.subscriptions (club_id, client_id)
  where status in ('active', 'frozen');

alter table public.subscriptions
  drop constraint if exists subscriptions_freeze_days_used_nonnegative;
alter table public.subscriptions
  add constraint subscriptions_freeze_days_used_nonnegative
  check (freeze_days_used >= 0);
alter table public.subscriptions
  add column if not exists freeze_started_at timestamptz;

alter table public.payments
  add column if not exists comment text;
