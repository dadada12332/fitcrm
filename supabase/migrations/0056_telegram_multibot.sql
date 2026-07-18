-- Club-scoped Telegram bots, delivery history and the broadcasts table that
-- was missing in production. Safe to run after the legacy 0010/0012 files.

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  message text,
  image_url text,
  audience text not null default 'all',
  audience_label text,
  recipient_ids bigint[],
  status text not null default 'sent'
    check (status in ('scheduled', 'processing', 'sent', 'failed')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  total integer not null default 0 check (total >= 0),
  delivered integer not null default 0 check (delivered >= 0),
  failed integer not null default 0 check (failed >= 0),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_broadcasts_club_created
  on public.broadcasts (club_id, created_at desc);
create index if not exists idx_broadcasts_due
  on public.broadcasts (scheduled_at)
  where status = 'scheduled';

alter table public.broadcasts enable row level security;
drop policy if exists broadcasts_club_all on public.broadcasts;
create policy broadcasts_club_all on public.broadcasts
  for all to authenticated
  using (club_id in (select public.user_club_ids()))
  with check (club_id in (select public.user_club_ids()));

grant select, insert, update, delete on public.broadcasts to authenticated;
grant all on public.broadcasts to service_role;
revoke all on public.broadcasts from anon;

-- A Telegram account can be a customer of several clubs and therefore can be
-- linked to several club-owned bots. The legacy primary key prevented this.
alter table public.telegram_users
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists club_id uuid references public.clubs(id) on delete cascade,
  add column if not exists preferences jsonb not null default '{"expiry_reminders":true,"schedule_reminders":true}'::jsonb,
  add column if not exists last_seen_at timestamptz;

update public.telegram_users tu
set club_id = coalesce(c.club_id, s.club_id)
from public.telegram_users source
left join public.clients c on c.id = source.client_id
left join public.staff s on s.id = source.staff_id
where tu.telegram_id = source.telegram_id
  and tu.club_id is null;

delete from public.telegram_users where club_id is null;

alter table public.telegram_users alter column id set not null;
alter table public.telegram_users alter column club_id set not null;
alter table public.telegram_users drop constraint if exists telegram_users_pkey;
alter table public.telegram_users add constraint telegram_users_pkey primary key (id);
alter table public.telegram_users drop constraint if exists telegram_users_club_telegram_key;
alter table public.telegram_users
  add constraint telegram_users_club_telegram_key unique (club_id, telegram_id);
alter table public.telegram_users drop constraint if exists telegram_users_single_identity;
alter table public.telegram_users
  add constraint telegram_users_single_identity
  check ((client_id is not null)::integer + (staff_id is not null)::integer = 1);

create index if not exists idx_telegram_users_club_client
  on public.telegram_users (club_id, client_id) where client_id is not null;
create index if not exists idx_telegram_users_club_staff
  on public.telegram_users (club_id, staff_id) where staff_id is not null;

revoke all on public.telegram_users from anon, authenticated;
grant all on public.telegram_users to service_role;

create table if not exists public.telegram_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  telegram_id bigint,
  client_id uuid references public.clients(id) on delete set null,
  event_type text not null,
  status text not null default 'sent'
    check (status in ('processing', 'sent', 'failed', 'received')),
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_telegram_events_idempotency
  on public.telegram_events (club_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists idx_telegram_events_club_created
  on public.telegram_events (club_id, created_at desc);
create index if not exists idx_telegram_events_club_type_created
  on public.telegram_events (club_id, event_type, created_at desc);

alter table public.telegram_events enable row level security;
drop policy if exists telegram_events_club_read on public.telegram_events;
create policy telegram_events_club_read on public.telegram_events
  for select to authenticated
  using (club_id in (select public.user_club_ids()));

grant select on public.telegram_events to authenticated;
grant all on public.telegram_events to service_role;
revoke all on public.telegram_events from anon;

insert into storage.buckets (id, name, public)
values ('broadcasts', 'broadcasts', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists broadcasts_read on storage.objects;
create policy broadcasts_read on storage.objects
  for select using (bucket_id = 'broadcasts');

drop policy if exists broadcasts_write on storage.objects;
create policy broadcasts_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'broadcasts'
    and (storage.foldername(name))[1]::uuid in (select public.user_club_ids())
  );

drop policy if exists broadcasts_delete on storage.objects;
create policy broadcasts_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'broadcasts'
    and (storage.foldername(name))[1]::uuid in (select public.user_club_ids())
  );
