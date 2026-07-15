-- 0040_payme_transactions.sql
-- Состояния транзакций Payme (Merchant API требует их отслеживать).
-- state: 1=создана, 2=проведена, -1=отменена(была создана), -2=отменена(была проведена).
-- Доступ только у service-role (эндпоинт приёма). Идемпотентно.

create table if not exists public.payme_transactions (
  id            text primary key,                       -- transaction id из Payme (params.id)
  club_id       uuid not null references public.clubs(id) on delete cascade,
  payment_id    uuid references public.payments(id) on delete set null,
  amount        bigint not null,                        -- тийины
  state         int not null default 1,
  reason        int,
  create_time   bigint not null default 0,              -- мс
  perform_time  bigint not null default 0,
  cancel_time   bigint not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_payme_tx_payment on public.payme_transactions(payment_id);
create index if not exists idx_payme_tx_club on public.payme_transactions(club_id);

alter table public.payme_transactions enable row level security;
