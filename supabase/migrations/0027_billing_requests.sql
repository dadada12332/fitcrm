-- 0027_billing_requests.sql
-- Заявки клубов на оформление/продление подписки. Клуб создаёт заявку,
-- админ платформы подтверждает → активируется тариф. Идемпотентно.

create table if not exists public.platform_billing_requests (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  plan           text not null,                 -- starter | standard | business
  months         int  not null default 1,
  amount         numeric(12,2),                 -- сумма к оплате (для истории)
  status         text not null default 'pending'
                   check (status in ('pending','approved','rejected','cancelled')),
  requested_by   uuid references public.users(id) on delete set null,
  requested_email text,
  note           text,
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_by    uuid references public.users(id) on delete set null
);

create index if not exists idx_billing_requests_club   on public.platform_billing_requests(club_id);
create index if not exists idx_billing_requests_status on public.platform_billing_requests(status, created_at desc);

alter table public.platform_billing_requests enable row level security;

-- Клуб видит и создаёт заявки своего клуба; platform-админ (user_club_ids god-mode) видит все.
drop policy if exists billing_requests_select on public.platform_billing_requests;
create policy billing_requests_select on public.platform_billing_requests
  for select using (club_id in (select public.user_club_ids()));

drop policy if exists billing_requests_insert on public.platform_billing_requests;
create policy billing_requests_insert on public.platform_billing_requests
  for insert with check (club_id in (select public.user_club_ids()));

-- Отмена своей заявки (pending) клубом.
drop policy if exists billing_requests_cancel on public.platform_billing_requests;
create policy billing_requests_cancel on public.platform_billing_requests
  for update using (club_id in (select public.user_club_ids()))
  with check (club_id in (select public.user_club_ids()));
