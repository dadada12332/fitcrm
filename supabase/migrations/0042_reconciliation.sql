-- Сверка эквайринга (reconciliation): транзакции из выписки провайдера + отпечатки карт клиентов.
-- Статичный QR не несёт наш order_id, поэтому сопоставляем оплату с продажей в СРМ
-- по сумме + времени + маске карты и подтверждаем в один клик.

create table if not exists public.acquiring_transactions (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.clubs(id) on delete cascade,
  provider           text not null,                    -- 'click' | 'payme'
  external_id        text not null,                    -- id транзакции у провайдера (идемпотентность)
  amount             numeric not null,
  paid_at            timestamptz not null,
  card_mask          text,                             -- маска карты, напр. '8600••1234'
  payer_name         text,
  raw                jsonb,                            -- полная строка выписки как есть
  -- сопоставление
  match_status       text not null default 'unmatched', -- 'unmatched' | 'suggested' | 'confirmed' | 'ignored'
  match_confidence   int,                              -- 0..100
  ambiguous          boolean not null default false,   -- несколько равных кандидатов
  suggested_payment_id uuid references public.payments(id) on delete set null,
  matched_payment_id   uuid references public.payments(id) on delete set null,
  matched_at         timestamptz,
  created_at         timestamptz not null default now(),
  unique (club_id, provider, external_id)
);

create index if not exists acquiring_tx_club_status_idx on public.acquiring_transactions (club_id, match_status);
create index if not exists acquiring_tx_paid_idx on public.acquiring_transactions (club_id, paid_at desc);

-- Отпечаток карты → клиент. После первого подтверждения повторные оплаты той же картой матчатся авто.
create table if not exists public.client_card_fingerprints (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  card_mask     text not null,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (club_id, card_mask)
);

create index if not exists card_fp_client_idx on public.client_card_fingerprints (club_id, client_id);

-- Доступ только через service-role (как и club_payment_credentials). RLS включён без политик.
alter table public.acquiring_transactions enable row level security;
alter table public.client_card_fingerprints enable row level security;
