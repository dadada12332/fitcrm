-- Telegram bot: linking table
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

-- RLS: only service role can access (bot backend)
alter table public.telegram_users enable row level security;
