-- Cover foreign keys introduced by the Platform Admin operational modules.

create index if not exists platform_billing_requests_promo_code_idx
  on public.platform_billing_requests (promo_code_id)
  where promo_code_id is not null;

create index if not exists platform_broadcast_deliveries_club_idx
  on public.platform_broadcast_deliveries (club_id);

create index if not exists platform_broadcasts_created_by_idx
  on public.platform_broadcasts (created_by)
  where created_by is not null;

create index if not exists platform_operational_settings_updated_by_idx
  on public.platform_operational_settings (updated_by)
  where updated_by is not null;

create index if not exists platform_promo_codes_created_by_idx
  on public.platform_promo_codes (created_by)
  where created_by is not null;

create index if not exists platform_promo_redemptions_club_idx
  on public.platform_promo_redemptions (club_id);
