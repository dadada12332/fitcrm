-- Short-lived, single-use deep links let the currently authenticated CRM
-- employee bind their Telegram account without relying on a phone stored in
-- staff.settings. Raw tokens never reach the database.

create table if not exists public.telegram_staff_pairings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_telegram_staff_pairings_staff_active
  on public.telegram_staff_pairings (club_id, staff_id, expires_at desc)
  where used_at is null;

alter table public.telegram_staff_pairings enable row level security;

-- Pairing secrets are only created and consumed by permission-checked server
-- code using the service role. They must never be listed through the Data API.
revoke all on table public.telegram_staff_pairings from public, anon, authenticated;
grant all on table public.telegram_staff_pairings to service_role;
