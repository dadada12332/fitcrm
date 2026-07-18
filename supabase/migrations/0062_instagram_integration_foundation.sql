-- Instagram Graph API foundation. Credentials and raw webhook payloads are
-- service-only; staff can read derived data for clubs they belong to.

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  provider text not null check (provider in ('instagram')),
  external_account_id text not null,
  username text,
  display_name text,
  account_type text,
  secret_enc text not null,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected','error','expired','revoked')),
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  connected_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, provider),
  unique (provider, external_account_id)
);

create table if not exists public.integration_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  club_id uuid not null references public.clubs(id) on delete cascade,
  provider text not null check (provider in ('instagram')),
  created_by uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  provider text not null check (provider in ('instagram')),
  status text not null default 'running' check (status in ('running','completed','partial','failed','rate_limited')),
  items_synced integer not null default 0,
  rate_limit jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.instagram_media (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  media_id text not null,
  media_type text not null,
  caption text,
  media_url text,
  thumbnail_url text,
  permalink text,
  published_at timestamptz,
  like_count integer not null default 0,
  comments_count integer not null default 0,
  insights jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (club_id, media_id)
);

create table if not exists public.instagram_daily_insights (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  insight_date date not null,
  metrics jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (club_id, insight_date)
);

create table if not exists public.marketing_touchpoints (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  source text not null,
  medium text,
  campaign text,
  content text,
  promo_code text,
  external_ref text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.clubs(id) on delete cascade,
  provider text not null check (provider in ('instagram')),
  external_event_id text,
  event_type text not null,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_integration_events_external
  on public.integration_events (provider, external_event_id)
  where external_event_id is not null;
create index if not exists idx_integration_sync_runs_club on public.integration_sync_runs (club_id, started_at desc);
create index if not exists idx_instagram_media_club on public.instagram_media (club_id, published_at desc);
create index if not exists idx_instagram_insights_club on public.instagram_daily_insights (club_id, insight_date desc);
create index if not exists idx_marketing_touchpoints_club on public.marketing_touchpoints (club_id, occurred_at desc);
create index if not exists idx_oauth_states_expiry on public.integration_oauth_states (expires_at) where used_at is null;

alter table public.integration_connections enable row level security;
alter table public.integration_oauth_states enable row level security;
alter table public.integration_sync_runs enable row level security;
alter table public.instagram_media enable row level security;
alter table public.instagram_daily_insights enable row level security;
alter table public.marketing_touchpoints enable row level security;
alter table public.integration_events enable row level security;

create policy integration_sync_runs_club_read on public.integration_sync_runs
  for select to authenticated using (club_id in (select public.user_club_ids()));
create policy instagram_media_club_read on public.instagram_media
  for select to authenticated using (club_id in (select public.user_club_ids()));
create policy instagram_insights_club_read on public.instagram_daily_insights
  for select to authenticated using (club_id in (select public.user_club_ids()));
create policy marketing_touchpoints_club_read on public.marketing_touchpoints
  for select to authenticated using (club_id in (select public.user_club_ids()));

revoke all on public.integration_connections, public.integration_oauth_states,
  public.integration_sync_runs, public.instagram_media, public.instagram_daily_insights,
  public.marketing_touchpoints, public.integration_events from anon, authenticated;
grant select on public.integration_sync_runs, public.instagram_media,
  public.instagram_daily_insights, public.marketing_touchpoints to authenticated;
grant all on public.integration_connections, public.integration_oauth_states,
  public.integration_sync_runs, public.instagram_media, public.instagram_daily_insights,
  public.marketing_touchpoints, public.integration_events to service_role;
