-- 0051: Security hardening
--   create_club — лимит числа клубов на пользователя + валидация имени
--   (защита от фарма бесплатных триалов и мусорных данных).
--
-- Примечание: эскалация привилегий в staff-экшенах закрыта на уровне
-- server actions (проверка club.permissions.staff.*). RLS staff_update
-- намеренно НЕ ужесточаем до owner/admin, чтобы не сломать кастомные роли
-- с правом управления персоналом.

create or replace function public.create_club(p_name text, p_city text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_club uuid;
  v_cnt  int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'club name required';
  end if;
  if length(p_name) > 120 then
    raise exception 'club name too long';
  end if;

  select count(*) into v_cnt from public.staff where user_id = v_uid and role = 'owner';
  if v_cnt >= 10 then
    raise exception 'club limit reached';
  end if;

  insert into public.users (id, email)
  values (v_uid, (select email from auth.users where id = v_uid))
  on conflict (id) do nothing;

  insert into public.clubs (name, city, owner_id, plan, trial_expires_at)
  values (p_name, p_city, v_uid, 'trial', now() + interval '14 days')
  returning id into v_club;

  insert into public.staff (user_id, club_id, role)
  values (v_uid, v_club, 'owner');

  return v_club;
end;
$$;

grant execute on function public.create_club(text, text) to authenticated;
