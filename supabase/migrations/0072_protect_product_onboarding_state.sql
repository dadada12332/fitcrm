-- Staff management RLS is club-scoped by design. These two preference fields,
-- however, belong to one authenticated employee and must not be writable by
-- another employee through the public Data API.
create or replace function public.enforce_staff_onboarding_self_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is not null
     and NEW.user_id is distinct from auth.uid()
     and (
       NEW.product_tour_completed_at is distinct from OLD.product_tour_completed_at
       or NEW.trial_offer_last_seen_at is distinct from OLD.trial_offer_last_seen_at
     ) then
    raise exception 'cannot change another employee onboarding state';
  end if;

  return NEW;
end;
$$;

drop trigger if exists staff_onboarding_self_update on public.staff;
create trigger staff_onboarding_self_update
  before update of product_tour_completed_at, trial_offer_last_seen_at on public.staff
  for each row execute function public.enforce_staff_onboarding_self_update();

revoke execute on function public.enforce_staff_onboarding_self_update() from public, anon, authenticated;
