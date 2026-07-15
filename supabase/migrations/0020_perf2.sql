-- ============================================================
-- Performance migration #2 — text search + missing indexes
-- Apply in: Supabase SQL Editor → Run
-- ============================================================

-- pg_trgm enables fast ILIKE / trigram searches on text columns
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on clients.full_name
-- Speeds up: .ilike('%query%') searches in searchClientsForCheckin()
-- and any client name filtering
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm
  ON public.clients USING gin (full_name gin_trgm_ops);

-- GIN trigram index on clients.phone
-- Speeds up: .or('full_name.ilike.%q%,phone.ilike.%q%') in check-in search
CREATE INDEX IF NOT EXISTS idx_clients_phone_trgm
  ON public.clients USING gin (phone gin_trgm_ops);

-- visits: staff_id filter (used in reports to count staff clients)
CREATE INDEX IF NOT EXISTS idx_visits_staff
  ON public.visits(club_id, staff_id)
  WHERE staff_id IS NOT NULL;

-- payments: faster today/month range without full status scan
-- Covers: getPaymentsKPI parallel queries
CREATE INDEX IF NOT EXISTS idx_payments_club_paid_at
  ON public.payments(club_id, paid_at DESC)
  WHERE status = 'paid';

-- subscriptions: client_id lookup (used in client profile + search)
CREATE INDEX IF NOT EXISTS idx_subscriptions_client
  ON public.subscriptions(client_id, club_id);

-- clients: index by club_id + created_at for sorted listing
CREATE INDEX IF NOT EXISTS idx_clients_club_created
  ON public.clients(club_id, created_at DESC);
