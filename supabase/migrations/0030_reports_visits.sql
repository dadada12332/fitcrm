-- 0030_reports_visits.sql
-- Серверная агрегация вкладки «Посещения» отчётов (Stage 3).
-- Повторяет ровно то, что раньше считалось в браузере из массива посещений:
--   total     = число посещений за период
--   prevTotal = число посещений за предыдущий период
--   byDay     = посещения по дням (UTC-дата, как старый aggregateByDay: slice(0,10) ISO)
--   heatmap   = ячейки [dow(Пн=0) × hour] в таймзоне клуба (Asia/Tashkent — как локальное время браузера у узбекских пользователей)
-- peakHour / quietDow / avgPerDay выводятся на клиенте из heatmap+total (как раньше).
-- Идемпотентно.

create or replace function public.reports_visits(
  p_club_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_prev_from timestamptz,
  p_prev_to timestamptz,
  p_tz text default 'Asia/Tashkent'
)
returns jsonb
language sql stable security definer set search_path = public as $$
  with per as (
    select checked_in_at
    from public.visits
    where club_id = p_club_id and checked_in_at >= p_from and checked_in_at <= p_to
  )
  select jsonb_build_object(
    'total', (select count(*) from per),
    'prevTotal', (
      select count(*) from public.visits
      where club_id = p_club_id and checked_in_at >= p_prev_from and checked_in_at < p_prev_to),
    'byDay', coalesce((
      select jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'count', cnt) order by d)
      from (
        select gs::date as d, count(v.checked_in_at) as cnt
        from generate_series((p_from at time zone 'UTC')::date, (p_to at time zone 'UTC')::date, interval '1 day') gs
        left join per v on (v.checked_in_at at time zone 'UTC')::date = gs::date
        group by gs::date
      ) x), '[]'::jsonb),
    'heatmap', coalesce((
      select jsonb_agg(jsonb_build_object('d', dow_mon, 'h', hr, 'c', cnt))
      from (
        select ((extract(dow from checked_in_at at time zone p_tz)::int + 6) % 7) as dow_mon,
               extract(hour from checked_in_at at time zone p_tz)::int as hr,
               count(*) as cnt
        from per
        group by 1, 2
      ) h), '[]'::jsonb)
  );
$$;

grant execute on function public.reports_visits(uuid, timestamptz, timestamptz, timestamptz, timestamptz, text) to authenticated, service_role;
