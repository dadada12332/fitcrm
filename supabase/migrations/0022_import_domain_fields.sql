-- ============================================================
-- 0022 — Import domain fields
-- Financial + trainer fields on clients so that Excel import is
-- fully "сквозным": каждая колонка из файла попадает в реальное поле.
-- Includes balance (was 0019, may not have been applied on prod).
-- ============================================================

alter table public.clients
  add column if not exists balance      numeric(12,2) not null default 0,
  add column if not exists debt         numeric(12,2) not null default 0,
  add column if not exists trainer_name text,
  add column if not exists trainer_id   uuid references public.staff(id) on delete set null;

comment on column public.clients.balance      is 'Предоплаченный баланс клиента (положительный)';
comment on column public.clients.debt         is 'Задолженность клиента (положительная = должен клубу)';
comment on column public.clients.trainer_name is 'Имя тренера как в источнике импорта (fallback если нет связи со staff)';
comment on column public.clients.trainer_id   is 'Связь с сотрудником-тренером, если удалось сопоставить по имени';

create index if not exists idx_clients_trainer on public.clients(trainer_id);
