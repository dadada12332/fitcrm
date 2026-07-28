-- Platform-to-club-owner broadcasts. Recipients are materialized at creation
-- so delivery counts are stable and retries stay idempotent.

create table if not exists public.platform_broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 120),
  body text not null check (char_length(trim(body)) between 3 and 4000),
  audience jsonb not null default '{"kind":"all"}',
  status text not null default 'draft'
    check (status in ('draft','scheduled','processing','sent','partial','failed','cancelled')),
  scheduled_at timestamptz,
  recipient_count integer not null default 0,
  delivered_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text
);

create table if not exists public.platform_broadcast_deliveries (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.platform_broadcasts(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  telegram_id bigint not null,
  status text not null default 'queued'
    check (status in ('queued','processing','delivered','failed','skipped')),
  attempts integer not null default 0,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (broadcast_id, club_id, telegram_id)
);

create index if not exists platform_broadcasts_due_idx
  on public.platform_broadcasts (scheduled_at)
  where status = 'scheduled';
create index if not exists platform_broadcast_deliveries_queue_idx
  on public.platform_broadcast_deliveries (broadcast_id, status);

alter table public.platform_broadcasts enable row level security;
alter table public.platform_broadcast_deliveries enable row level security;
revoke all on table public.platform_broadcasts from public, anon, authenticated;
revoke all on table public.platform_broadcast_deliveries from public, anon, authenticated;
grant all on table public.platform_broadcasts to service_role;
grant all on table public.platform_broadcast_deliveries to service_role;
