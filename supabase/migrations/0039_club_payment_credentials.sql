-- 0039_club_payment_credentials.sql
-- Секреты мерчанта (Payme/Click) по клубу. Секреты хранятся ШИФРОВАННО (AES-256-GCM в приложении).
-- Таблица доступна только service-role (Platform Admin). У клуба доступа НЕТ — RLS без политик.
-- Идемпотентно.

create table if not exists public.club_payment_credentials (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  provider    text not null check (provider in ('click', 'payme')),
  enabled     boolean not null default false,
  secret_enc  text,                                   -- AES-GCM blob полного JSON кредов
  meta        jsonb not null default '{}',            -- не-секретные идентификаторы + маска (last4)
  updated_by  uuid references public.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (club_id, provider)
);

create index if not exists idx_cpc_club on public.club_payment_credentials(club_id);

-- RLS включён, политик НЕТ → доступ только у service-role (Platform Admin). Клуб секреты не читает.
alter table public.club_payment_credentials enable row level security;
