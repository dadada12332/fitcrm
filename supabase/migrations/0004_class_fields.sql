-- ============================================================
-- FitCRM — поля для занятий (раздел «Расписание»).
-- Денормализуем название/конец/цену/тренера на класс, чтобы не
-- зависеть от schedules/staff(auth-users). Применять в SQL Editor → Run.
-- Идемпотентно.
-- ============================================================

alter table public.classes
  add column if not exists title        text,
  add column if not exists end_time     time,
  add column if not exists price        numeric(12,2) not null default 0,
  add column if not exists trainer_name text;
