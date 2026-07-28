create table if not exists public.platform_service_checks (
  id bigint generated always as identity primary key,
  service_key text not null,
  status text not null check (status in ('ok','degraded','down')),
  latency_ms integer,
  details jsonb not null default '{}',
  checked_at timestamptz not null default now()
);

create table if not exists public.platform_cron_runs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null,
  status text not null default 'running'
    check (status in ('running','success','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  result jsonb not null default '{}',
  error_message text
);

create index if not exists platform_service_checks_recent_idx
  on public.platform_service_checks (service_key, checked_at desc);
create index if not exists platform_cron_runs_recent_idx
  on public.platform_cron_runs (job_key, started_at desc);

alter table public.platform_service_checks enable row level security;
alter table public.platform_cron_runs enable row level security;
revoke all on table public.platform_service_checks from public, anon, authenticated;
revoke all on table public.platform_cron_runs from public, anon, authenticated;
grant all on table public.platform_service_checks to service_role;
grant all on table public.platform_cron_runs to service_role;

create table if not exists public.platform_operational_settings (
  id smallint primary key default 1 check (id = 1),
  registration_enabled boolean not null default true,
  maintenance_message text,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_operational_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.platform_operational_settings enable row level security;
revoke all on table public.platform_operational_settings from public, anon, authenticated;
grant all on table public.platform_operational_settings to service_role;
