-- Repurpose Platform broadcasts as in-CRM announcements for club owners.
-- The tables remain service-role only. CRM reads are manually scoped by
-- club_id + user_id after getCurrentClub() resolves the tenant.

alter table public.platform_broadcasts
  add column if not exists category text not null default 'news';

alter table public.platform_broadcasts
  drop constraint if exists platform_broadcasts_category_check;
alter table public.platform_broadcasts
  add constraint platform_broadcasts_category_check
  check (category in ('news', 'maintenance', 'update', 'important'));

alter table public.platform_broadcast_deliveries
  alter column telegram_id drop not null,
  add column if not exists staff_id uuid references public.staff(id) on delete cascade,
  add column if not exists user_id uuid references public.users(id) on delete cascade,
  add column if not exists read_at timestamptz;

create unique index if not exists platform_broadcast_deliveries_staff_unique
  on public.platform_broadcast_deliveries (broadcast_id, staff_id)
  where staff_id is not null;

create index if not exists platform_broadcast_deliveries_user_unread_idx
  on public.platform_broadcast_deliveries (club_id, user_id, read_at)
  where user_id is not null and status <> 'skipped';

create index if not exists platform_broadcasts_visible_idx
  on public.platform_broadcasts (scheduled_at desc)
  where status in ('scheduled', 'sent');

-- Campaigns created by the previous Telegram implementation must never be sent
-- after this migration. Preserve them in history with an explicit reason.
update public.platform_broadcasts
   set status = 'cancelled',
       last_error = coalesce(last_error, 'Отменено при переходе на уведомления внутри CRM')
 where status in ('draft', 'scheduled', 'processing')
   and exists (
     select 1
       from public.platform_broadcast_deliveries d
      where d.broadcast_id = platform_broadcasts.id
        and d.staff_id is null
   );

update public.platform_broadcast_deliveries
   set status = 'skipped',
       last_error = coalesce(last_error, 'Legacy Telegram delivery')
 where staff_id is null
   and status in ('queued', 'processing');

alter table public.platform_broadcasts enable row level security;
alter table public.platform_broadcast_deliveries enable row level security;
revoke all on table public.platform_broadcasts from public, anon, authenticated;
revoke all on table public.platform_broadcast_deliveries from public, anon, authenticated;
grant all on table public.platform_broadcasts to service_role;
grant all on table public.platform_broadcast_deliveries to service_role;
