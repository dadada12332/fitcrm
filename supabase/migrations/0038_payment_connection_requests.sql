-- 0038_payment_connection_requests.sql
-- Заявки клубов на подключение приёма онлайн-оплат (Payme / Click).
-- Клуб оставляет заявку (без секретов) → админ платформы получает данные и подключает.
-- Секреты (ключи мерчанта) будут храниться отдельно и шифрованно (следующий этап).
-- Идемпотентно.

create table if not exists public.payment_connection_requests (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs(id) on delete cascade,
  provider        text not null check (provider in ('click', 'payme')),
  status          text not null default 'new' check (status in ('new', 'active', 'rejected', 'cancelled')),
  note            text,
  requested_by    uuid references public.users(id),
  requested_email text,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references public.users(id)
);

create index if not exists idx_pcr_club on public.payment_connection_requests(club_id, created_at desc);
create index if not exists idx_pcr_status on public.payment_connection_requests(status);

alter table public.payment_connection_requests enable row level security;

-- Клуб видит свои заявки. Запись — через service-role в серверных экшенах (после проверки прав).
drop policy if exists pcr_club_select on public.payment_connection_requests;
create policy pcr_club_select on public.payment_connection_requests
  for select using (club_id in (select public.user_club_ids()));
