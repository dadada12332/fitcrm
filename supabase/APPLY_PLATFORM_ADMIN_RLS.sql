-- ============================================================
-- Запустить в Supabase → SQL Editor → Run (проект bqnhslauxvukejtquavp)
-- Platform-админ видит данные любого клуба (режим «Войти как владелец»).
-- Идемпотентно.
-- ============================================================

create or replace function public.user_club_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.clubs
    where exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.platform_role is not null
    )
  union
  select club_id from public.staff where user_id = auth.uid();
$$;

grant execute on function public.user_club_ids() to authenticated;
