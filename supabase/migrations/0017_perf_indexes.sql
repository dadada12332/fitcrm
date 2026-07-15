-- Performance indexes for FitCRM
-- Addresses missing composite indexes on frequently-filtered columns

-- visits: most queries filter by club_id + checked_in_at range
CREATE INDEX IF NOT EXISTS idx_visits_club_date
  ON public.visits(club_id, checked_in_at DESC);

-- subscriptions: status filter is used on every page
CREATE INDEX IF NOT EXISTS idx_subscriptions_club_status
  ON public.subscriptions(club_id, status);

-- subscriptions: expiry range queries (expiring soon, churn)
CREATE INDEX IF NOT EXISTS idx_subscriptions_club_status_expires
  ON public.subscriptions(club_id, status, expires_at);

-- payments: date range queries with status filter
CREATE INDEX IF NOT EXISTS idx_payments_club_status_date
  ON public.payments(club_id, status, paid_at DESC);

-- clients: default sort is created_at DESC
CREATE INDEX IF NOT EXISTS idx_clients_club_created
  ON public.clients(club_id, created_at DESC);

-- clients: active filter used in sidebar count
CREATE INDEX IF NOT EXISTS idx_clients_club_active
  ON public.clients(club_id, is_active);

-- staff: composite lookup (user_id + club_id + is_active) — used every request
CREATE INDEX IF NOT EXISTS idx_staff_user_club_active
  ON public.staff(user_id, club_id, is_active);

-- club_roles: permission lookup per club+role
CREATE INDEX IF NOT EXISTS idx_club_roles_club_key
  ON public.club_roles(club_id, key);

-- inventory: low stock check
CREATE INDEX IF NOT EXISTS idx_inventory_club
  ON public.inventory(club_id);

-- memberships: active+archived filter
CREATE INDEX IF NOT EXISTS idx_memberships_club_active
  ON public.memberships(club_id, is_active, archived);
