-- Fix 1: telegram_users — add role column if missing, or create fresh
alter table if exists public.telegram_users
  add column if not exists role text not null default 'client';

create table if not exists public.telegram_users (
  telegram_id    bigint primary key,
  client_id      uuid references public.clients(id) on delete set null,
  staff_id       uuid references public.staff(id)   on delete set null,
  role           text not null default 'client',
  pending_action text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_telegram_users_client on public.telegram_users(client_id);
create index if not exists idx_telegram_users_staff  on public.telegram_users(staff_id);
create index if not exists idx_clients_telegram      on public.clients(telegram_id);

alter table public.telegram_users enable row level security;

-- Fix 2: staff table — add UPDATE + INSERT policies (only SELECT existed before)
drop policy if exists staff_update on public.staff;
create policy staff_update on public.staff
  for update
  using (club_id in (select public.user_club_ids()))
  with check (club_id in (select public.user_club_ids()));

drop policy if exists staff_insert on public.staff;
create policy staff_insert on public.staff
  for insert
  with check (club_id in (select public.user_club_ids()));
