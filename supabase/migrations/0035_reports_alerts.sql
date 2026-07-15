-- 0035_reports_alerts.sql
-- Серверная агрегация вкладки «Внимание» отчётов (Stage 8) — период-независимое ядро.
-- Повторяет то, что раньше считалось в браузере из data.clients / data.visits / data.payments:
--   expiringSoon = активные с daysLeft в [0,3] (count + первые 3 имени)
--   expiring7    = активные с daysLeft в [0,7] (count)
--   atRisk       = активные, чей последний визит > 14 дней назад или которых не было вовсе
--   debts        = pending-платежи (count + сумма)
-- visitsDelta для вкладки берётся отдельно из reports_visits (зависит от периода).
-- daysLeft/cutoff считаются от p_now (по умолчанию now()).
-- Идемпотентно.

create or replace function public.reports_alerts(p_club_id uuid, p_now timestamptz default now())
returns jsonb
language sql stable security definer set search_path = public as $$
  with picked as (
    select c.id, c.full_name as name, sa.st as status,
      case when sa.st in ('active', 'frozen') and sa.exp is not null
           then ceil(extract(epoch from (sa.exp - p_now)) / 86400.0)::int else null end as days_left
    from public.clients c
    left join lateral (
      select s.status::text as st, s.expires_at as exp
      from public.subscriptions s
      where s.client_id = c.id
      order by (case s.status when 'active' then 0 when 'frozen' then 1 else 2 end),
               s.expires_at desc nulls last
      limit 1
    ) sa on true
    where c.club_id = p_club_id
  ),
  last_visit as (
    select client_id, max(checked_in_at) as lv
    from public.visits where club_id = p_club_id group by client_id
  ),
  exp3 as (
    select id, name from picked
    where status = 'active' and days_left is not null and days_left >= 0 and days_left <= 3
  ),
  pend as (
    select amount from public.payments where club_id = p_club_id and status = 'pending'
  )
  select jsonb_build_object(
    'expiringSoonCount', (select count(*) from exp3),
    'expiringSoonNames', coalesce((select jsonb_agg(name) from (select name from exp3 order by name limit 3) t), '[]'::jsonb),
    'expiring7Count', (select count(*) from picked
      where status = 'active' and days_left is not null and days_left >= 0 and days_left <= 7),
    'atRiskCount', (
      select count(*) from picked p
      left join last_visit lv on lv.client_id = p.id
      where p.status = 'active' and (lv.lv is null or lv.lv < (p_now - interval '14 days'))
    ),
    'debtsCount', (select count(*) from pend),
    'debtTotal', coalesce((select sum(amount) from pend), 0)
  );
$$;

grant execute on function public.reports_alerts(uuid, timestamptz) to authenticated, service_role;
