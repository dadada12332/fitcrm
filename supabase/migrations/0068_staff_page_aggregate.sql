-- One tenant-scoped aggregate replaces duplicate staff reads and transferring
-- every historical visit to the Next.js runtime for a distinct client count.
create or replace function public.get_staff_page_data(p_club_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with visit_counts as (
    select staff_id, count(distinct client_id) as client_count
    from public.visits
    where club_id = p_club_id and staff_id is not null
    group by staff_id
  ), staff_rows as (
    select
      st.id,
      st.user_id,
      st.role,
      st.salary,
      st.is_active,
      coalesce(st.settings, '{}'::jsonb) as settings,
      coalesce(u.full_name, split_part(u.email, '@', 1), '—') as name,
      coalesce(u.email, '') as email,
      coalesce(vc.client_count, 0) as client_count
    from public.staff st
    left join public.users u on u.id = st.user_id
    left join visit_counts vc on vc.staff_id = st.id
    where st.club_id = p_club_id
  )
  select jsonb_build_object(
    'kpi', jsonb_build_object(
      'total', count(*) filter (where is_active),
      'trainers', count(*) filter (where is_active and role = 'trainer'),
      'admins', count(*) filter (where is_active and role in ('admin', 'manager')),
      'monthlySalary', coalesce(sum(coalesce(salary, 0)) filter (where is_active), 0)
    ),
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'userId', user_id,
      'role', role,
      'name', name,
      'email', email,
      'isActive', is_active,
      'salary', coalesce(salary, 0),
      'clientCount', client_count,
      'status', coalesce(settings->>'status', case when is_active then 'active' else 'fired' end),
      'settings', settings
    ) order by name), '[]'::jsonb)
  )
  from staff_rows;
$$;

revoke all on function public.get_staff_page_data(uuid) from public, anon;
grant execute on function public.get_staff_page_data(uuid) to authenticated, service_role;
