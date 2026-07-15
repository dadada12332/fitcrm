-- 0034_reports_staff.sql
-- Серверная агрегация вкладки «Персонал» отчётов (Stage 7).
-- Повторяет то, что раньше считалось в браузере (getReportsData → staff):
--   name        = users.full_name ?? users.email ?? '—'
--   salary      = staff.salary || settings.salary_fixed || 0  (первое «truthy», 0 считается пустым)
--   clientCount = число уникальных client_id среди визитов сотрудника (как new Set(...).size, null тоже уникален)
--   status      = settings.status ?? (is_active ? 'active' : 'fired')
-- Идемпотентно.

create or replace function public.reports_staff(p_club_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  with sv as (
    select staff_id,
      count(distinct client_id) + (case when bool_or(client_id is null) then 1 else 0 end) as client_count
    from public.visits
    where club_id = p_club_id and staff_id is not null
    group by staff_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', st.id,
    'name', coalesce(u.full_name, u.email, '—'),
    'role', st.role,
    'salary', coalesce(
      nullif(st.salary, 0),
      case when (st.settings->>'salary_fixed') ~ '^[0-9]+(\.[0-9]+)?$'
           then nullif((st.settings->>'salary_fixed')::numeric, 0) end,
      0),
    'clientCount', coalesce(sv.client_count, 0),
    'status', coalesce(st.settings->>'status', case when st.is_active then 'active' else 'fired' end)
  ) order by coalesce(u.full_name, u.email, '—')), '[]'::jsonb)
  from public.staff st
  left join public.users u on u.id = st.user_id
  left join sv on sv.staff_id = st.id
  where st.club_id = p_club_id;
$$;

grant execute on function public.reports_staff(uuid) to authenticated, service_role;
