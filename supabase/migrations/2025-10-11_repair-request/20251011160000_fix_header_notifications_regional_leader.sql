--- Fix Header Notifications for Regional Leaders
--- Issue: Regional leaders don't see notifications for repair/maintenance/transfer requests in their region
--- Root Cause: header_notifications_summary only checks single don_vi claim, not regional filtering
--- Solution: Use allowed_don_vi_for_session_safe() helper for proper role-based access
--- Migration Date: 2025-10-11 16:00 UTC

BEGIN;

-- ============================================================================
-- Fix header_notifications_summary with regional leader support
-- ============================================================================
-- This function returns notification counts for pending repair requests and
-- transfer requests in the bell icon on the header.
--
-- Previous behavior:
-- - Global users: See all notifications across all facilities
-- - Non-global users: See only notifications from their single facility
--
-- New behavior:
-- - Global users: See all notifications across all facilities
-- - Regional leaders: See notifications from all facilities in their region
-- - Regular users: See only notifications from their single facility
--
-- Security: Uses allowed_don_vi_for_session_safe() which respects:
-- - JWT-signed role claims (cannot be manipulated by client)
-- - dia_ban claim for regional leaders
-- - Proper tenant isolation at all levels
-- ============================================================================

CREATE OR REPLACE FUNCTION public.header_notifications_summary(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_role TEXT := '';
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_repairs BIGINT := 0;
  v_transfers BIGINT := 0;
BEGIN
  -- Get JWT claims
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    -- No JWT claims - return zero counts
    RETURN jsonb_build_object(
      'pending_repairs', 0,
      'pending_transfers', 0
    );
  END;
  
  -- Get role from claims (prefer app_role, fallback to role)
  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  
  -- Get allowed facilities based on role and region (handles global, regional_leader, regular users)
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();
  
  -- If no role or no allowed facilities, return zero counts
  IF v_role = '' OR v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'pending_repairs', 0,
      'pending_transfers', 0
    );
  END IF;
  
  -- CASE 1: Global users - can optionally filter by facility or see all
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      -- Global user filtering by specific facility
      SELECT COUNT(*) INTO v_repairs
      FROM public.yeu_cau_sua_chua r
      INNER JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
      WHERE tb.don_vi = p_don_vi
        AND r.trang_thai IN ('Chờ xử lý', 'Đã duyệt');
      
      SELECT COUNT(*) INTO v_transfers
      FROM public.yeu_cau_luan_chuyen t
      INNER JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
      WHERE tb.don_vi = p_don_vi
        AND t.trang_thai IN ('cho_duyet', 'da_duyet');
    ELSE
      -- Global user seeing all facilities
      SELECT COUNT(*) INTO v_repairs
      FROM public.yeu_cau_sua_chua r
      WHERE r.trang_thai IN ('Chờ xử lý', 'Đã duyệt');
      
      SELECT COUNT(*) INTO v_transfers
      FROM public.yeu_cau_luan_chuyen t
      WHERE t.trang_thai IN ('cho_duyet', 'da_duyet');
    END IF;
    
    RETURN jsonb_build_object(
      'pending_repairs', COALESCE(v_repairs, 0),
      'pending_transfers', COALESCE(v_transfers, 0)
    );
  END IF;
  
  -- CASE 2: Non-global users (regional leaders, regular users)
  -- Use allowed_don_vi array to filter notifications
  
  -- Count pending repairs in allowed facilities
  SELECT COUNT(*) INTO v_repairs
  FROM public.yeu_cau_sua_chua r
  INNER JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
  WHERE tb.don_vi = ANY(v_allowed_don_vi)
    AND r.trang_thai IN ('Chờ xử lý', 'Đã duyệt');
  
  -- Count pending transfers in allowed facilities
  SELECT COUNT(*) INTO v_transfers
  FROM public.yeu_cau_luan_chuyen t
  INNER JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE tb.don_vi = ANY(v_allowed_don_vi)
    AND t.trang_thai IN ('cho_duyet', 'da_duyet');
  
  RETURN jsonb_build_object(
    'pending_repairs', COALESCE(v_repairs, 0),
    'pending_transfers', COALESCE(v_transfers, 0)
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.header_notifications_summary(BIGINT) TO authenticated;

COMMIT;

-- ============================================================================
-- Migration Notes
-- ============================================================================
-- 1. This migration is idempotent (uses CREATE OR REPLACE)
-- 2. Adds SET search_path for additional security
-- 3. Changes from single BIGINT to BIGINT[] for multi-facility support
-- 4. Uses INNER JOIN instead of LEFT JOIN (notifications always have equipment)
-- 5. Preserves backward compatibility with global users
-- 6. No data changes required
-- 7. Security verified: uses allowed_don_vi_for_session_safe() which is SECURITY DEFINER
-- ============================================================================
