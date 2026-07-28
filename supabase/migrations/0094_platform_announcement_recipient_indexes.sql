-- Cover recipient foreign keys used by cascades and account cleanup.
create index if not exists platform_broadcast_deliveries_staff_idx
  on public.platform_broadcast_deliveries (staff_id)
  where staff_id is not null;

create index if not exists platform_broadcast_deliveries_user_idx
  on public.platform_broadcast_deliveries (user_id)
  where user_id is not null;
