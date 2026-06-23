-- ============================================================
-- FitCRM — флаг архива для тарифов (меню действий в таблице абонементов).
-- «Отключить» = is_active=false (временно), «Архивировать» = archived=true.
-- Применять в SQL Editor → Run. Идемпотентно.
-- ============================================================

alter table public.memberships
  add column if not exists archived boolean not null default false;
