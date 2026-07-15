-- 0041_payment_pending_membership.sql
-- Онлайн-оплата: абонемент активируется ТОЛЬКО после подтверждения оплаты.
-- Платёж запоминает выбранный абонемент; подписка создаётся при статусе paid (в эндпоинте приёма).
-- Идемпотентно.

alter table public.payments
  add column if not exists pending_membership_id uuid references public.memberships(id);
