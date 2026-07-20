-- Reuse the existing sidebar round-trip for the notification badge instead of
-- running a separate three-query Server Action after every full app load.
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
      select count(*) from public.support_tickets
      where club_id = p_club_id
        and agent_last_read_at is not null
        and agent_last_read_at > coalesce(user_last_read_at, '-infinity'::timestamptz)
    ),
    'notificationCount',
      least((select count(*) from public.subscriptions where club_id = p_club_id and status = 'active' and expires_at between current_date and current_date + 7), 10)
      + least((select count(*) from public.subscriptions where club_id = p_club_id and status = 'expired' and expires_at between current_date - 7 and current_date), 10)
      + least((select count(*) from public.payments where club_id = p_club_id and status = 'pending'), 10)
  );
$$;

revoke all on function public.get_sidebar_stats(uuid) from public, anon;
grant execute on function public.get_sidebar_stats(uuid) to authenticated;
