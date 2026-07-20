create table if not exists public.growth_experiment_runs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  experiment_key text not null,
  title text not null,
  hypothesis text not null,
  primary_metric text not null,
  expected_impact text not null,
  duration_days integer not null check (duration_days between 1 and 90),
  playbook_id text not null,
  message text not null check (char_length(message) between 1 and 2000),
  audience_size integer not null default 0 check (audience_size >= 0),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  completed_at timestamptz,
  result text check (result in ('won', 'inconclusive', 'lost')),
  result_value text,
  result_note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists growth_experiment_runs_one_active_idx
  on public.growth_experiment_runs (club_id, experiment_key)
  where status = 'active';

create index if not exists growth_experiment_runs_club_started_idx
  on public.growth_experiment_runs (club_id, started_at desc);

alter table public.growth_experiment_runs enable row level security;

drop policy if exists growth_experiment_runs_club_read on public.growth_experiment_runs;
create policy growth_experiment_runs_club_read
  on public.growth_experiment_runs for select to authenticated
  using (club_id in (select public.user_club_ids()));

grant select on public.growth_experiment_runs to authenticated;
revoke insert, update, delete on public.growth_experiment_runs from public, anon, authenticated;

comment on table public.growth_experiment_runs is
  'Club-scoped lifecycle and recorded outcomes for Growth OS experiments. Writes are service-only through authorized Server Actions.';
