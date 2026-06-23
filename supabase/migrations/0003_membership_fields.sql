-- ============================================================
-- FitCRM — расширение memberships полями из формы «Добавление абонемента»
-- (Figma 158-4568). Применять в Supabase SQL Editor → Run.
-- Идемпотентно (add column if not exists).
-- ============================================================

alter table public.memberships
  add column if not exists description    text,
  add column if not exists valid_until    date,
  add column if not exists price_per_day  numeric(12,2),
  add column if not exists available_days text[] not null default '{}',
  add column if not exists available_time text[] not null default '{}';
