-- 0032_reports_renewals.sql
-- Серверная агрегация вкладки «Продления» отчётов (Stage 5).
-- Повторяет ровно то, что раньше считалось в браузере из массива клиентов:
--   active/expired          = по эффективному статусу подписки (pickSub)
--   expiring30 / expiring7  = активные с daysLeft в [0,30] / [0,7]
--   top                     = ближайшие истечения (expiring30, сортировка по daysLeft asc, топ-10)
-- daysLeft = ceil((expires_at - now)/сутки), как daysUntil в браузере.
-- p_now — момент отсчёта (по умолчанию now()); в проде не передаётся, для сверки можно зафиксировать.
-- Идемпотентно.

create or replace function public.reports_renewals(
  p_club_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language sql stable security definer set search_path = public as $$
  with picked as (
    select c.id, c.full_name as name, sa.st as status, sa.exp as expires_at, sa.mem as membership_name
    from public.clients c
    left join lateral (
      select s.status::text as st, s.expires_at as exp, m.name as mem
      from public.subscriptions s
      left join public.memberships m on m.id = s.membership_id
      where s.client_id = c.id
      order by (case s.status when 'active' then 0 when 'frozen' then 1 else 2 end),
               s.expires_at desc nulls last
      limit 1
    ) sa on true
    where c.club_id = p_club_id
  ),
  d as (
    select id, name, status, membership_name,
      case when status in ('active', 'frozen') and expires_at is not null
           then ceil(extract(epoch from (expires_at - p_now)) / 86400.0)::int
           else null end as days_left
    from picked
  )
  select jsonb_build_object(
    'active', (select count(*) from d where status = 'active'),
    'expired', (select count(*) from d where status = 'expired'),
    'expiring30', (select count(*) from d where status = 'active' and days_left is not null and days_left >= 0 and days_left <= 30),
    'expiring7', (select count(*) from d where status = 'active' and days_left is not null and days_left >= 0 and days_left <= 7),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'membershipName', membership_name, 'daysLeft', days_left)
                       order by days_left asc, name)
      from (
        select id, name, membership_name, days_left
        from d
        where status = 'active' and days_left is not null and days_left >= 0 and days_left <= 30
        order by days_left asc, name
        limit 10
      ) t), '[]'::jsonb)
  );
$$;

grant execute on function public.reports_renewals(uuid, timestamptz) to authenticated, service_role;
