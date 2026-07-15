-- ============================================================
-- Запустить ОДИН РАЗ в Supabase → SQL Editor → Run
-- Проект: bqnhslauxvukejtquavp
-- Добавляет финансовые поля и связь с тренером на clients.
-- Идемпотентно (add column if not exists) — безопасно запускать повторно.
-- ============================================================

alter table public.clients
  add column if not exists balance      numeric(12,2) not null default 0,
  add column if not exists debt         numeric(12,2) not null default 0,
  add column if not exists trainer_name text,
  add column if not exists trainer_id   uuid references public.staff(id) on delete set null;

create index if not exists idx_clients_trainer on public.clients(trainer_id);

-- Проверка:
-- select column_name from information_schema.columns
--   where table_name = 'clients' and column_name in ('balance','debt','trainer_name','trainer_id');
