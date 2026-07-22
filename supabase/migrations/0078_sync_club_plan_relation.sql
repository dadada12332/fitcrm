create or replace function public.sync_club_plan_id()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  select id into new.plan_id from public.plans where code = new.plan::text;
  return new;
end;
$$;

drop trigger if exists trg_sync_club_plan_id on public.clubs;
create trigger trg_sync_club_plan_id
before insert or update of plan on public.clubs
for each row execute function public.sync_club_plan_id();

update public.clubs c set plan_id = p.id
from public.plans p
where p.code = c.plan::text and c.plan_id is distinct from p.id;

revoke all on function public.sync_club_plan_id() from public, anon, authenticated;
