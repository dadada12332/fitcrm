-- Count one user-level operation once even when it is split into several Server Action batches.
create table if not exists public.plan_usage_reservations (
  club_id uuid not null references public.clubs(id) on delete cascade,
  usage_key text not null,
  period_start date not null,
  reservation_key uuid not null,
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now(),
  primary key (club_id, usage_key, period_start, reservation_key)
);

alter table public.plan_usage_reservations enable row level security;

create or replace function public.consume_plan_usage_once(
  p_club_id uuid,
  p_usage_key text,
  p_amount bigint,
  p_limit bigint,
  p_reservation_key uuid
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_period date := date_trunc('month', now())::date;
  v_inserted uuid;
  v_consumed boolean;
begin
  if p_amount <= 0 or p_limit is null then return true; end if;

  insert into public.plan_usage_reservations(
    club_id, usage_key, period_start, reservation_key, amount
  ) values (
    p_club_id, p_usage_key, v_period, p_reservation_key, p_amount
  )
  on conflict (club_id, usage_key, period_start, reservation_key) do nothing
  returning reservation_key into v_inserted;

  if v_inserted is null then return true; end if;

  v_consumed := public.consume_plan_usage(p_club_id, p_usage_key, p_amount, p_limit);
  if v_consumed then return true; end if;

  delete from public.plan_usage_reservations
  where club_id = p_club_id
    and usage_key = p_usage_key
    and period_start = v_period
    and reservation_key = p_reservation_key;
  return false;
end;
$$;

revoke all on table public.plan_usage_reservations from public, anon, authenticated;
revoke all on function public.consume_plan_usage_once(uuid,text,bigint,bigint,uuid) from public, anon, authenticated;
grant execute on function public.consume_plan_usage_once(uuid,text,bigint,bigint,uuid) to service_role;

-- These settings were visible in Platform Admin but had no complete product-level enforcement.
-- Keep the pricing editor honest: only real limits remain configurable.
delete from public.plan_limits
where limit_key in ('users', 'sms', 'files', 'storage_mb', 'checkins');
