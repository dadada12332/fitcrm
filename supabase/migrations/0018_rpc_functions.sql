-- ============================================================
-- RPC functions for performance optimization
-- Replaces multiple round-trips with single DB calls
-- ============================================================

-- ── get_layout_context ────────────────────────────────────────────
-- Replaces: staff+clubs JOIN, club_roles, trial_expires_at,
--           users.full_name, clients COUNT, subscriptions COUNT,
--           visits COUNT, inventory scan = 8 queries → 1 RPC
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_layout_context(
  p_user_id         uuid,
  p_selected_club   uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_staff_id        uuid;
  v_club_id         uuid;
  v_role            text;
  v_club_name       text;
  v_plan            text;
  v_trial           timestamptz;
  v_permissions     jsonb;
  v_full_name       text;
  v_result          json;
BEGIN
  -- 1. staff + clubs in one hit
  SELECT s.id, s.club_id, s.role::text, c.name, c.plan::text, c.trial_expires_at
  INTO   v_staff_id, v_club_id, v_role, v_club_name, v_plan, v_trial
  FROM   staff s
  JOIN   clubs c ON c.id = s.club_id
  WHERE  s.user_id  = p_user_id
    AND  s.is_active = true
    AND  (p_selected_club IS NULL OR s.club_id = p_selected_club)
  ORDER  BY s.created_at DESC
  LIMIT  1;

  IF v_club_id IS NULL THEN RETURN NULL; END IF;

  -- 2. custom permissions (owners get NULL — TypeScript side fills in ALL_TRUE)
  IF v_role <> 'owner' THEN
    SELECT cr.permissions INTO v_permissions
    FROM   club_roles cr
    WHERE  cr.club_id = v_club_id AND cr.key = v_role
    LIMIT  1;
  END IF;

  -- 3. user display name
  SELECT u.full_name INTO v_full_name FROM users u WHERE u.id = p_user_id;

  -- 4. all sidebar counts in a single SELECT (uses composite indexes from 0017)
  SELECT json_build_object(
    'staffId',              v_staff_id,
    'clubId',               v_club_id,
    'role',                 v_role,
    'clubName',             v_club_name,
    'plan',                 v_plan,
    'trialExpiresAt',       v_trial,
    'permissions',          v_permissions,
    'userName',             v_full_name,
    'clientCount',          (SELECT COUNT(*) FROM clients     WHERE club_id = v_club_id AND is_active = true),
    'activeMembershipCount',(SELECT COUNT(*) FROM subscriptions WHERE club_id = v_club_id AND status = 'active'),
    'todayVisits',          (SELECT COUNT(*) FROM visits      WHERE club_id = v_club_id AND checked_in_at >= CURRENT_DATE),
    'lowStockCount',        (SELECT COUNT(*) FROM inventory   WHERE club_id = v_club_id AND min_quantity > 0 AND quantity <= min_quantity)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_layout_context(uuid, uuid) TO authenticated;


-- ── get_dashboard_stats ───────────────────────────────────────────
-- Replaces 11 parallel dashboard queries → 1 RPC call
-- Returns raw payments for JS-side chart computation
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_club_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
WITH
  now_ts    AS (SELECT NOW() AS v),
  today     AS (SELECT DATE_TRUNC('day', NOW()) AS v),
  yesterday AS (SELECT DATE_TRUNC('day', NOW()) - INTERVAL '1 day' AS v),
  month_s   AS (SELECT DATE_TRUNC('month', NOW()) AS v),
  prev7     AS (SELECT NOW() - INTERVAL '7 days'  AS v),
  prev14    AS (SELECT NOW() - INTERVAL '14 days' AS v),
  next7     AS (SELECT NOW() + INTERVAL '7 days'  AS v),
  prev60    AS (SELECT NOW() - INTERVAL '60 days' AS v)
SELECT json_build_object(
  'activeClients',   (SELECT COUNT(*) FROM clients WHERE club_id = p_club_id AND is_active = true),
  'prevClients',     (SELECT COUNT(*) FROM clients WHERE club_id = p_club_id AND is_active = true AND created_at < (SELECT v FROM month_s)),
  'todayVisits',     (SELECT COUNT(*) FROM visits  WHERE club_id = p_club_id AND checked_in_at >= (SELECT v FROM today)),
  'yesterdayVisits', (SELECT COUNT(*) FROM visits  WHERE club_id = p_club_id AND checked_in_at >= (SELECT v FROM yesterday) AND checked_in_at < (SELECT v FROM today)),
  'expiringCount',   (SELECT COUNT(*) FROM subscriptions WHERE club_id = p_club_id AND status = 'active' AND expires_at BETWEEN NOW() AND (SELECT v FROM next7)),
  'churnCount',      (SELECT COUNT(*) FROM subscriptions WHERE club_id = p_club_id AND status = 'expired' AND expires_at BETWEEN (SELECT v FROM prev7) AND NOW()),
  'visits7',         (SELECT COUNT(*) FROM visits WHERE club_id = p_club_id AND checked_in_at >= (SELECT v FROM prev7)),
  'visitsPrev7',     (SELECT COUNT(*) FROM visits WHERE club_id = p_club_id AND checked_in_at >= (SELECT v FROM prev14) AND checked_in_at < (SELECT v FROM prev7)),
  'payments60',      (
    SELECT COALESCE(
      json_agg(json_build_object('t', EXTRACT(EPOCH FROM paid_at)::bigint * 1000, 'a', amount::numeric)),
      '[]'::json
    )
    FROM payments
    WHERE club_id = p_club_id AND status = 'paid' AND paid_at >= (SELECT v FROM prev60)
  ),
  'newClients', (
    SELECT COALESCE(json_agg(nc ORDER BY nc.created_at DESC), '[]'::json)
    FROM (
      SELECT
        c.id, c.full_name, c.tags, c.created_at,
        (
          SELECT m.name
          FROM   subscriptions s
          JOIN   memberships m ON m.id = s.membership_id
          WHERE  s.client_id = c.id AND s.club_id = p_club_id
          ORDER  BY (CASE WHEN s.status = 'active' THEN 0 ELSE 1 END), s.created_at DESC
          LIMIT  1
        ) AS membership
      FROM clients c
      WHERE c.club_id = p_club_id
      ORDER BY c.created_at DESC
      LIMIT 6
    ) nc
  )
)
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated;
