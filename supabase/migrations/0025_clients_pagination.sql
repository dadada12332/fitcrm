-- 0025_clients_pagination.sql
-- Серверная пагинация/поиск/фильтрация/сортировка раздела «Клиенты».
-- Статус клиента вычисляется из подписок (active > frozen > последняя по expires_at),
-- поэтому фильтрация/сортировка по нему делается SQL-функцией, а не в браузере.
-- Идемпотентно.

-- Индексы для быстрых лейтерал-джойнов и пагинации.
create index if not exists idx_subscriptions_client on public.subscriptions(client_id);
create index if not exists idx_visits_client        on public.visits(client_id);
create index if not exists idx_clients_club_created  on public.clients(club_id, created_at desc);

-- Ускоряем поиск по имени/телефону (ILIKE '%...%') на больших базах.
do $$ begin
  create extension if not exists pg_trgm;
  create index if not exists idx_clients_fullname_trgm on public.clients using gin (full_name gin_trgm_ops);
  create index if not exists idx_clients_phone_trgm    on public.clients using gin (phone gin_trgm_ops);
exception when others then
  -- если расширение недоступно — функция всё равно работает, просто поиск медленнее
  null;
end $$;

-- ── Страница клиентов: фильтр + сортировка + пагинация + total одним запросом ──
create or replace function public.clients_page(
  p_club_id     uuid,
  p_search      text   default null,
  p_statuses    text[] default null,  -- active | expiring | expired | frozen (мультивыбор, OR)
  p_memberships text[] default null,  -- имена абонементов (мультивыбор, OR)
  p_days        text[] default null,  -- 0-3 | 4-7 | 8-14 | 14+ (мультивыбор, OR)
  p_sort        text   default null,  -- name_asc|name_desc|expires_asc|expires_desc|debt_desc|created_asc|(default created_desc)
  p_limit       int    default 50,
  p_offset      int    default 0
)
returns table (
  id uuid, name text, phone text, birth_date date, gender text, source text,
  membership text, expires_at date, days_left int, visits_left int,
  last_visit timestamptz, debt numeric, status text, total_count bigint
)
language sql stable security definer set search_path = public as $$
  with base as (
    select
      c.id, c.full_name as name, c.phone, c.birth_date, c.gender, c.source, c.created_at,
      case when c.debt is not null then c.debt
           else greatest(-coalesce(c.balance, 0), 0) end as debt,
      s.status::text as sub_status, s.expires_at, s.visits_total, s.visits_used, s.mname as membership,
      lv.last_visit
    from public.clients c
    left join lateral (
      select sub.status, sub.expires_at, sub.visits_total, sub.visits_used, m.name as mname
      from public.subscriptions sub
      left join public.memberships m on m.id = sub.membership_id
      where sub.client_id = c.id
      order by (case sub.status when 'active' then 0 when 'frozen' then 1 else 2 end),
               sub.expires_at desc nulls last
      limit 1
    ) s on true
    left join lateral (
      select max(v.checked_in_at) as last_visit from public.visits v where v.client_id = c.id
    ) lv on true
    where c.club_id = p_club_id
  ),
  derived as (
    select
      id, name, phone, birth_date, gender, source, created_at, debt, membership,
      expires_at, visits_total, visits_used, last_visit,
      coalesce(sub_status, 'none') as status,
      case when sub_status in ('active','frozen') and expires_at is not null
           then (expires_at - current_date)::int end as days_left,
      case when visits_total is not null and visits_used is not null
           then greatest(0, visits_total - visits_used) end as visits_left
    from base
  ),
  filtered as (
    select * from derived
    where
      (p_search is null or p_search = ''
        or name ilike '%' || p_search || '%'
        or coalesce(phone, '') ilike '%' || p_search || '%')
      and (p_memberships is null or cardinality(p_memberships) = 0 or membership = any(p_memberships))
      and (p_statuses is null or cardinality(p_statuses) = 0
        or ('active'   = any(p_statuses) and status = 'active')
        or ('frozen'   = any(p_statuses) and status = 'frozen')
        or ('expired'  = any(p_statuses) and status = 'expired')
        or ('expiring' = any(p_statuses) and status = 'active' and days_left is not null and days_left <= 7))
      and (p_days is null or cardinality(p_days) = 0
        or ('0-3'  = any(p_days) and days_left between 0 and 3)
        or ('4-7'  = any(p_days) and days_left between 4 and 7)
        or ('8-14' = any(p_days) and days_left between 8 and 14)
        or ('14+'  = any(p_days) and days_left > 14))
  )
  select
    f.id, f.name, f.phone, f.birth_date, f.gender, f.source, f.membership,
    f.expires_at, f.days_left, f.visits_left, f.last_visit, f.debt, f.status,
    count(*) over () as total_count
  from filtered f
  order by
    case when p_sort = 'name_asc'     then f.name end asc,
    case when p_sort = 'name_desc'    then f.name end desc,
    case when p_sort = 'expires_asc'  then f.expires_at end asc  nulls last,
    case when p_sort = 'expires_desc' then f.expires_at end desc nulls last,
    case when p_sort = 'debt_desc'    then f.debt end desc,
    case when p_sort = 'debt_asc'     then f.debt end asc,
    case when p_sort = 'created_asc'  then f.created_at end asc,
    f.created_at desc
  limit greatest(p_limit, 0) offset greatest(p_offset, 0);
$$;

grant execute on function public.clients_page(uuid, text, text[], text[], text[], text, int, int) to authenticated, service_role;

-- ── KPI по клубу (не зависят от фильтра/страницы) ──
create or replace function public.clients_stats(p_club_id uuid)
returns table (total bigint, active bigint, expiring bigint, debt numeric)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.clients where club_id = p_club_id),
    (select count(distinct client_id) from public.subscriptions
       where club_id = p_club_id and status = 'active'),
    (select count(distinct client_id) from public.subscriptions
       where club_id = p_club_id and status = 'active'
         and expires_at is not null and expires_at <= current_date + 7),
    (select coalesce(sum(case when debt is not null then debt
                              else greatest(-coalesce(balance,0),0) end), 0)
       from public.clients where club_id = p_club_id);
$$;

grant execute on function public.clients_stats(uuid) to authenticated, service_role;
