-- 0024_platform_admin_rls.sql
-- Platform-админы должны видеть/править данные любого клуба (для режима
-- «Войти как владелец»). Все tenant-таблицы используют user_club_ids() в RLS,
-- поэтому достаточно расширить эту функцию: для platform_admin/super_admin она
-- возвращает ВСЕ club_id, для обычных пользователей — только их клубы.
-- Идемпотентно (create or replace).

create or replace function public.user_club_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  -- Platform-админ: все клубы
  select id from public.clubs
    where exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.platform_role is not null
    )
  union
  -- Обычный пользователь: клубы, где он сотрудник
  select club_id from public.staff where user_id = auth.uid();
$$;

grant execute on function public.user_club_ids() to authenticated;
