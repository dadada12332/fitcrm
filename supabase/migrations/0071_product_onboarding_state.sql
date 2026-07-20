-- Persist first-run education and trial offer frequency per employee and club.
-- Keeping this server-side makes the experience consistent across devices.
alter table public.staff
  add column if not exists product_tour_completed_at timestamptz,
  add column if not exists trial_offer_last_seen_at timestamptz;

comment on column public.staff.product_tour_completed_at is
  'When this employee completed or skipped the first-run CRM product tour.';

comment on column public.staff.trial_offer_last_seen_at is
  'Last time the trial subscription offer was shown to this employee.';
