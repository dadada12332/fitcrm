-- 0052: DB-триггер против эскалации привилегий на staff.
--
-- Проблема: RLS staff_update/insert скоупят только по club_id (без роли).
-- Анон-ключ публичен, JWT в куках → сотрудник мог в обход server actions
-- сделать прямой PATCH /rest/v1/staff {role:'owner'} и захватить клуб.
--
-- Решение: BEFORE INSERT/UPDATE триггер, который блокирует именно ЭСКАЛАЦИЮ,
-- не ломая: сервисные операции (service_role → auth.uid() = null), bootstrap
-- владельца в create_club, и легитимное управление персоналом owner/admin.

create or replace function public.enforce_staff_no_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_role text;
  v_is_admin boolean;
  v_is_owner boolean;
begin
  -- Сервисные операции без JWT (service_role, cron, триггеры, RPC-definer из create_club
  -- вызывают insert от имени пользователя — этот случай ловим ниже через owner_id).
  if v_uid is null then
    return NEW;
  end if;

  -- Роль текущего пользователя в этом клубе
  select role into v_role
  from public.staff
  where user_id = v_uid and club_id = NEW.club_id and is_active
  order by (role = 'owner') desc, (role = 'admin') desc
  limit 1;

  v_is_owner := coalesce(v_role, '') = 'owner';
  v_is_admin := coalesce(v_role, '') in ('owner', 'admin');

  -- Bootstrap: создатель клуба ещё не имеет staff-строки, но уже owner_id клуба.
  if not v_is_owner and exists (
    select 1 from public.clubs c where c.id = NEW.club_id and c.owner_id = v_uid
  ) then
    v_is_owner := true;
    v_is_admin := true;
  end if;

  -- Назначить роль owner может только владелец
  if NEW.role = 'owner' and not v_is_owner
     and (TG_OP = 'INSERT' or OLD.role is distinct from 'owner') then
    raise exception 'only owner can assign owner role';
  end if;

  -- Назначить роль admin может только owner/admin
  if NEW.role = 'admin' and not v_is_admin
     and (TG_OP = 'INSERT' or OLD.role is distinct from 'admin') then
    raise exception 'insufficient privileges to assign admin role';
  end if;

  if TG_OP = 'UPDATE' then
    -- Строку владельца может менять только владелец
    if OLD.role = 'owner' and not v_is_owner
       and (NEW.role is distinct from OLD.role
            or NEW.settings is distinct from OLD.settings
            or NEW.is_active is distinct from OLD.is_active) then
      raise exception 'only owner can modify owner';
    end if;

    -- Самоэскалация: нельзя менять СВОЮ роль или СВОИ права, если ты не owner/admin
    if NEW.user_id = v_uid and not v_is_admin then
      if NEW.role is distinct from OLD.role then
        raise exception 'cannot change own role';
      end if;
      if (NEW.settings -> 'permissions') is distinct from (OLD.settings -> 'permissions') then
        raise exception 'cannot change own permissions';
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists staff_no_escalation on public.staff;
create trigger staff_no_escalation
  before insert or update on public.staff
  for each row execute function public.enforce_staff_no_escalation();
