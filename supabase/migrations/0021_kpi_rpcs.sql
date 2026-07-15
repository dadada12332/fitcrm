-- ============================================================
-- KPI RPCs — consolidate N parallel queries into single round-trips
-- Apply in: Supabase SQL Editor → Run
-- ============================================================

-- Payments KPI: 5 separate queries → 1 RPC call
-- Returns today/yesterday/month/prevMonth revenue + unpaid count
CREATE OR REPLACE FUNCTION get_payments_kpi(p_club_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT json_build_object(
    'today_revenue', COALESCE((
      SELECT SUM(amount) FROM payments
      WHERE club_id = p_club_id AND status = 'paid'
        AND paid_at >= DATE_TRUNC('day', NOW())
    ), 0),
    'yesterday_revenue', COALESCE((
      SELECT SUM(amount) FROM payments
      WHERE club_id = p_club_id AND status = 'paid'
        AND paid_at >= DATE_TRUNC('day', NOW()) - INTERVAL '1 day'
        AND paid_at <  DATE_TRUNC('day', NOW())
    ), 0),
    'month_revenue', COALESCE((
      SELECT SUM(amount) FROM payments
      WHERE club_id = p_club_id AND status = 'paid'
        AND paid_at >= DATE_TRUNC('month', NOW())
    ), 0),
    'month_count', (
      SELECT COUNT(*) FROM payments
      WHERE club_id = p_club_id AND status = 'paid'
        AND paid_at >= DATE_TRUNC('month', NOW())
    ),
    'prev_month_revenue', COALESCE((
      SELECT SUM(amount) FROM payments
      WHERE club_id = p_club_id AND status = 'paid'
        AND paid_at >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
        AND paid_at <  DATE_TRUNC('month', NOW())
    ), 0),
    'unpaid_count', (
      SELECT COUNT(*) FROM payments
      WHERE club_id = p_club_id AND status = 'pending'
    )
  )
$$;

-- Visits KPI: 4 queries → 1 RPC call (uses COUNT DISTINCT for unique clients)
CREATE OR REPLACE FUNCTION get_visits_kpi(p_club_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT json_build_object(
    'today_count', (
      SELECT COUNT(*) FROM visits
      WHERE club_id = p_club_id
        AND checked_in_at >= DATE_TRUNC('day', NOW())
    ),
    'in_gym_count', (
      SELECT COUNT(*) FROM visits
      WHERE club_id = p_club_id
        AND checked_in_at >= NOW() - INTERVAL '2 hours'
    ),
    'unique_today', (
      SELECT COUNT(DISTINCT client_id) FROM visits
      WHERE club_id = p_club_id
        AND checked_in_at >= DATE_TRUNC('day', NOW())
    ),
    'active_subs', (
      SELECT COUNT(*) FROM subscriptions
      WHERE club_id = p_club_id AND status = 'active'
    )
  )
$$;
