-- 0031_reports_clients.sql
-- Серверная агрегация вкладки «Клиенты» отчётов (Stage 4).
-- Повторяет ровно то, что раньше считалось в браузере:
--   newInPeriod / prevNew  = новые клиенты (created_at в периоде / пред. периоде)
--   total / active / expired = все клиенты и по эффективному статусу подписки
--   gender                 = м/ж по всем клиентам
--   bySource               = источники среди новых за период (source, null → 'other')
--   byDayNew               = новые клиенты по дням (UTC-дата, как старый aggregateByDay)
-- Эффективный статус клиента = логика pickSub:
--   active, если есть active-подписка; иначе frozen, если есть frozen; иначе статус подписки с макс. expires_at.
-- Идемпотентно.

create or replace function public.reports_clients(
  p_club_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_prev_from timestamptz,
  p_prev_to timestamptz
)
returns jsonb
language sql stable security definer set search_path = public as $$
  with sub_agg as (
    select client_id,
      bool_or(status = 'active') as has_active,
      bool_or(status = 'frozen') as has_frozen,
      (array_agg(status::text order by expires_at desc nulls last))[1] as latest_status
    from public.subscriptions
    where club_id = p_club_id
    group by client_id
  ),
  cli as (
    select c.id, c.created_at, c.source, c.gender,
      case
        when sa.client_id is null then null
        when sa.has_active then 'active'
        when sa.has_frozen then 'frozen'
        else sa.latest_status
      end as status
    from public.clients c
    left join sub_agg sa on sa.client_id = c.id
    where c.club_id = p_club_id
  )
  select jsonb_build_object(
    'total', (select count(*) from cli),
    'active', (select count(*) from cli where status = 'active'),
    'expired', (select count(*) from cli where status = 'expired'),
    'newInPeriod', (select count(*) from cli where created_at >= p_from and created_at <= p_to),
    'prevNew', (select count(*) from cli where created_at >= p_prev_from and created_at < p_prev_to),
    'gender', jsonb_build_object(
      'total', (select count(*) from cli),
      'male', (select count(*) from cli where gender = 'male'),
      'female', (select count(*) from cli where gender = 'female')
    ),
    'bySource', coalesce((
      select jsonb_agg(jsonb_build_object('key', src, 'count', cnt) order by cnt desc, src)
      from (
        select coalesce(source, 'other') as src, count(*) as cnt
        from cli where created_at >= p_from and created_at <= p_to
        group by coalesce(source, 'other')
      ) g), '[]'::jsonb),
    'byDayNew', coalesce((
      select jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'count', cnt) order by d)
      from (
        select gs::date as d, count(x.id) as cnt
        from generate_series((p_from at time zone 'UTC')::date, (p_to at time zone 'UTC')::date, interval '1 day') gs
        left join cli x on (x.created_at at time zone 'UTC')::date = gs::date
          and x.created_at >= p_from and x.created_at <= p_to
        group by gs::date
      ) y), '[]'::jsonb)
  );
$$;

grant execute on function public.reports_clients(uuid, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated, service_role;
