-- Keep application compute close to Postgres and reduce every authenticated
-- page to one sidebar RPC plus its page-specific query set.

create or replace function public.get_sidebar_stats(p_club_id uuid)
returns json
language sql
security invoker
set search_path = ''
stable
as $$
  select json_build_object(
    'clientCount', (select count(*) from public.clients where club_id = p_club_id),
    'activeMembershipCount', (select count(*) from public.subscriptions where club_id = p_club_id and status = 'active'),
    'todayVisits', (select count(*) from public.visits where club_id = p_club_id and checked_in_at >= current_date),
    'lowStockCount', (select count(*) from public.inventory where club_id = p_club_id and min_quantity > 0 and quantity <= min_quantity),
    'userName', coalesce((select full_name from public.users where id = (select auth.uid())), 'Пользователь'),
    'userRole', coalesce((
      select case role::text
        when 'owner' then 'Владелец'
        when 'manager' then 'Менеджер'
        when 'admin' then 'Администратор'
        when 'trainer' then 'Тренер'
        else 'Сотрудник'
      end
      from public.staff
      where club_id = p_club_id and user_id = (select auth.uid()) and is_active
      limit 1
    ), 'Сотрудник'),
    'staffId', (select id from public.staff where club_id = p_club_id and user_id = (select auth.uid()) and is_active limit 1),
    'supportUnread', (
      select count(*)
      from public.support_tickets
      where club_id = p_club_id
        and agent_last_read_at is not null
        and agent_last_read_at > coalesce(user_last_read_at, '-infinity'::timestamptz)
    )
  );
$$;

revoke all on function public.get_sidebar_stats(uuid) from public, anon;
grant execute on function public.get_sidebar_stats(uuid) to authenticated;

create or replace function public.get_dashboard_stats(p_club_id uuid)
returns json
language sql
security invoker
set search_path = ''
stable
as $$
with
  today as (select date_trunc('day', now()) as v),
  yesterday as (select date_trunc('day', now()) - interval '1 day' as v),
  month_s as (select date_trunc('month', now()) as v),
  prev7 as (select now() - interval '7 days' as v),
  prev14 as (select now() - interval '14 days' as v),
  next7 as (select now() + interval '7 days' as v),
  prev366 as (select now() - interval '366 days' as v)
select json_build_object(
  'activeClients', (select count(distinct client_id) from public.subscriptions where club_id = p_club_id and status = 'active'),
  'prevClients', (select count(*) from public.clients where club_id = p_club_id and created_at < (select v from month_s)),
  'todayVisits', (select count(*) from public.visits where club_id = p_club_id and checked_in_at >= (select v from today)),
  'yesterdayVisits', (select count(*) from public.visits where club_id = p_club_id and checked_in_at >= (select v from yesterday) and checked_in_at < (select v from today)),
  'expiringCount', (select count(*) from public.subscriptions where club_id = p_club_id and status = 'active' and expires_at between current_date and current_date + 7),
  'churnCount', (select count(*) from public.subscriptions where club_id = p_club_id and status = 'expired' and expires_at between current_date - 7 and current_date),
  'visits7', (select count(*) from public.visits where club_id = p_club_id and checked_in_at >= (select v from prev7)),
  'visitsPrev7', (select count(*) from public.visits where club_id = p_club_id and checked_in_at >= (select v from prev14) and checked_in_at < (select v from prev7)),
  'debtCount', (select count(*) from public.clients where club_id = p_club_id and debt > 0),
  'debtTotal', (select coalesce(sum(debt), 0) from public.clients where club_id = p_club_id and debt > 0),
  'todayNewClients', (select count(*) from public.clients where club_id = p_club_id and created_at >= (select v from today)),
  'todayPaymentsCount', (select count(*) from public.payments where club_id = p_club_id and status = 'paid' and paid_at >= (select v from today)),
  'birthdaysToday', (
    select count(*) from public.clients
    where club_id = p_club_id
      and extract(month from birth_date) = extract(month from current_date)
      and extract(day from birth_date) = extract(day from current_date)
  ),
  'payments366', (
    select coalesce(
      json_agg(json_build_object('t', extract(epoch from paid_at)::bigint * 1000, 'a', amount::numeric) order by paid_at),
      '[]'::json
    )
    from public.payments
    where club_id = p_club_id and status = 'paid' and paid_at >= (select v from prev366)
  ),
  'newClients', (
    select coalesce(json_agg(nc order by nc.created_at desc), '[]'::json)
    from (
      select c.id, c.full_name, c.tags, c.created_at, c.source,
        (
          select m.name
          from public.subscriptions s
          join public.memberships m on m.id = s.membership_id
          where s.client_id = c.id and s.club_id = p_club_id
          order by (case when s.status = 'active' then 0 else 1 end), s.created_at desc
          limit 1
        ) as membership
      from public.clients c
      where c.club_id = p_club_id
      order by c.created_at desc
      limit 6
    ) nc
  )
);
$$;

revoke all on function public.get_dashboard_stats(uuid) from public, anon;
grant execute on function public.get_dashboard_stats(uuid) to authenticated;

-- Cache auth.uid() once per statement in the policies flagged by the advisor.
alter policy "View clubmates" on public.users using (
  id in (
    select s.user_id
    from public.staff s
    where s.club_id in (
      select own.club_id from public.staff own
      where own.user_id = (select auth.uid()) and own.is_active
    )
  )
);

alter policy club_roles_select on public.club_roles using (exists (
  select 1 from public.staff
  where staff.club_id = club_roles.club_id
    and staff.user_id = (select auth.uid())
    and staff.is_active
));

alter policy "Owner or admin can invite" on public.staff_invitations with check (exists (
  select 1 from public.staff
  where staff.user_id = (select auth.uid())
    and staff.club_id = staff_invitations.club_id
    and staff.role = any (array['owner'::text, 'admin'::text])
    and staff.is_active
));

alter policy clubs_update on public.clubs
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Add a covering btree index for every public foreign key that does not yet
-- have one. The production database is small enough for non-concurrent DDL.
do $$
declare
  fk record;
  index_name text;
begin
  for fk in
    select
      ns.nspname as schema_name,
      rel.relname as table_name,
      con.conname as constraint_name,
      string_agg(quote_ident(att.attname), ', ' order by key_col.ordinality) as columns
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    cross join lateral unnest(con.conkey) with ordinality as key_col(attnum, ordinality)
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = key_col.attnum
    where con.contype = 'f'
      and ns.nspname = 'public'
      and not exists (
        select 1
        from pg_index idx
        where idx.indrelid = con.conrelid
          and idx.indisvalid
          and idx.indisready
          and idx.indkey::smallint[] @> con.conkey
      )
    group by ns.nspname, rel.relname, con.conname
  loop
    index_name := left('idx_perf_' || fk.constraint_name, 54) || '_' || substr(md5(fk.constraint_name), 1, 8);
    execute format('create index if not exists %I on %I.%I (%s)', index_name, fk.schema_name, fk.table_name, fk.columns);
  end loop;
end;
$$;

create index if not exists idx_clients_birth_mmdd
  on public.clients ((extract(month from birth_date)), (extract(day from birth_date)))
  where birth_date is not null;

create index if not exists idx_client_card_fingerprints_client_id
  on public.client_card_fingerprints(client_id);
create index if not exists idx_visits_staff_id
  on public.visits(staff_id);

-- Split ALL policies into operation-specific policies. This preserves the
-- existing write permissions while avoiding two permissive SELECT policies.
alter policy "View clubmates" on public.users to authenticated using (
  id = (select auth.uid())
  or id in (
    select s.user_id
    from public.staff s
    where s.club_id in (
      select own.club_id from public.staff own
      where own.user_id = (select auth.uid()) and own.is_active
    )
  )
);
drop policy if exists users_self on public.users;
drop policy if exists users_self_insert on public.users;
drop policy if exists users_self_update on public.users;
drop policy if exists users_self_delete on public.users;
create policy users_self_insert on public.users for insert to authenticated
  with check (id = (select auth.uid()));
create policy users_self_update on public.users for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy users_self_delete on public.users for delete to authenticated
  using (id = (select auth.uid()));

alter policy club_roles_select on public.club_roles to authenticated using (exists (
  select 1 from public.staff
  where staff.club_id = club_roles.club_id
    and staff.user_id = (select auth.uid())
    and staff.is_active
));
drop policy if exists club_roles_manage on public.club_roles;
drop policy if exists club_roles_insert on public.club_roles;
drop policy if exists club_roles_update on public.club_roles;
drop policy if exists club_roles_delete on public.club_roles;
create policy club_roles_insert on public.club_roles for insert to authenticated
  with check (exists (
    select 1 from public.staff
    where staff.club_id = club_roles.club_id
      and staff.user_id = (select auth.uid())
      and staff.role = 'owner'
      and staff.is_active
  ));
create policy club_roles_update on public.club_roles for update to authenticated
  using (exists (
    select 1 from public.staff
    where staff.club_id = club_roles.club_id
      and staff.user_id = (select auth.uid())
      and staff.role = 'owner'
      and staff.is_active
  ))
  with check (exists (
    select 1 from public.staff
    where staff.club_id = club_roles.club_id
      and staff.user_id = (select auth.uid())
      and staff.role = 'owner'
      and staff.is_active
  ));
create policy club_roles_delete on public.club_roles for delete to authenticated
  using (exists (
    select 1 from public.staff
    where staff.club_id = club_roles.club_id
      and staff.user_id = (select auth.uid())
      and staff.role = 'owner'
      and staff.is_active
  ));
