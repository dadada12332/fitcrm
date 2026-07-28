create table if not exists public.platform_daily_metrics (
  metric_date date primary key,
  total_clubs integer not null default 0,
  paid_clubs integer not null default 0,
  trial_clubs integer not null default 0,
  new_clubs integer not null default 0,
  total_clients integer not null default 0,
  visits integer not null default 0,
  payments integer not null default 0,
  revenue numeric not null default 0,
  mrr numeric not null default 0,
  captured_at timestamptz not null default now()
);

alter table public.platform_daily_metrics enable row level security;
revoke all on table public.platform_daily_metrics from public, anon, authenticated;
grant all on table public.platform_daily_metrics to service_role;

create or replace function public.platform_capture_daily_metrics(p_date date default current_date)
returns public.platform_daily_metrics
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_start timestamptz := p_date::timestamptz;
  v_end timestamptz := (p_date + 1)::timestamptz;
  v_row public.platform_daily_metrics;
begin
  insert into public.platform_daily_metrics (
    metric_date,
    total_clubs,
    paid_clubs,
    trial_clubs,
    new_clubs,
    total_clients,
    visits,
    payments,
    revenue,
    mrr,
    captured_at
  )
  select
    p_date,
    (select count(*) from public.clubs c where c.created_at < v_end and c.status <> 'deleted')::integer,
    (select count(*) from public.clubs c where c.status = 'active' and c.plan <> 'trial'
      and (c.plan_expires_at is null or c.plan_expires_at >= v_end))::integer,
    (select count(*) from public.clubs c where c.status = 'active' and c.plan = 'trial'
      and (c.trial_expires_at is null or c.trial_expires_at >= v_end))::integer,
    (select count(*) from public.clubs c where c.created_at >= v_start and c.created_at < v_end)::integer,
    (select count(*) from public.clients c where c.created_at < v_end)::integer,
    (select count(*) from public.visits v where v.checked_in_at >= v_start and v.checked_in_at < v_end)::integer,
    (select count(*) from public.payments p where p.status = 'paid'
      and coalesce(p.paid_at, p.created_at) >= v_start and coalesce(p.paid_at, p.created_at) < v_end)::integer,
    (select coalesce(sum(p.amount), 0) from public.payments p where p.status = 'paid'
      and coalesce(p.paid_at, p.created_at) >= v_start and coalesce(p.paid_at, p.created_at) < v_end),
    (select coalesce(sum(coalesce(c.plan_price_locked, pl.price, 0)), 0)
      from public.clubs c left join public.plans pl on pl.id = c.plan_id
      where c.status = 'active' and c.plan <> 'trial'
        and (c.plan_expires_at is null or c.plan_expires_at >= v_end)),
    now()
  on conflict (metric_date) do update set
    total_clubs = excluded.total_clubs,
    paid_clubs = excluded.paid_clubs,
    trial_clubs = excluded.trial_clubs,
    new_clubs = excluded.new_clubs,
    total_clients = excluded.total_clients,
    visits = excluded.visits,
    payments = excluded.payments,
    revenue = excluded.revenue,
    mrr = excluded.mrr,
    captured_at = excluded.captured_at
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.platform_capture_daily_metrics(date) from public, anon, authenticated;
grant execute on function public.platform_capture_daily_metrics(date) to service_role;
