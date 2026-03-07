-- Migration: add read-path helper RPCs for suggested mapping preview
-- Purpose: partial index for unassigned-name aggregation + dinh_muc_thiet_bi_unassigned_names RPC
-- Note: dinh_muc_thiet_bi_link_batch is NOT created here — it belongs in Phase 4

BEGIN;

-- ============================================================
-- 1. Partial composite index for unassigned-name aggregation
--    Optimizes: WHERE don_vi = ? AND nhom_thiet_bi_id IS NULL
--               GROUP BY ten_thiet_bi
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_thiet_bi_unassigned_name_by_unit
ON public.thiet_bi (don_vi, ten_thiet_bi)
WHERE nhom_thiet_bi_id IS NULL;

-- ============================================================
-- 2. dinh_muc_thiet_bi_unassigned_names RPC
--    Returns distinct device names with counts and device_id arrays
--    for all unassigned equipment in the selected facility.
--
--    Security:
--      - SECURITY DEFINER + tight search_path
--      - Standalone JWT guards for v_role, v_user_id, v_don_vi
--      - Tenant isolation per role
--      - GRANT authenticated / REVOKE PUBLIC
-- ============================================================
CREATE OR REPLACE FUNCTION public.dinh_muc_thiet_bi_unassigned_names(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS TABLE (
  ten_thiet_bi TEXT,
  device_count BIGINT,
  device_ids BIGINT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- Standalone JWT claim extraction (mandatory guards per RPC Security Standards)
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_user_id TEXT := current_setting('request.jwt.claims', true)::json->>'user_id';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_allowed_facilities BIGINT[];
BEGIN
  -- ── Role guard ──────────────────────────────────────────────
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING errcode = '42501';
  END IF;

  -- ── User ID guard ──────────────────────────────────────────
  IF v_user_id IS NULL OR v_user_id = '' THEN
    RAISE EXCEPTION 'Missing user_id claim' USING errcode = '42501';
  END IF;

  -- ── Tenant guard (non-global must have don_vi) ─────────────
  IF v_role NOT IN ('global', 'admin') AND (v_don_vi IS NULL OR v_don_vi = '') THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING errcode = '42501';
  END IF;

  -- ── Tenant isolation per role ──────────────────────────────
  IF v_role IN ('global', 'admin') THEN
    -- global/admin: honour the caller-supplied p_don_vi
    NULL;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed_facilities := public.allowed_don_vi_for_session();
    IF p_don_vi IS NULL OR NOT (p_don_vi = ANY(v_allowed_facilities)) THEN
      RAISE EXCEPTION 'Access denied: facility % is not in your region', p_don_vi;
    END IF;
  ELSE
    -- to_qltb and other roles: force p_don_vi from JWT claim
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  -- ── Null don_vi guard (prevent cross-tenant exposure) ──────
  IF p_don_vi IS NULL THEN
    RETURN;
  END IF;

  -- ── Query: grouped unassigned device names ─────────────────
  -- BTRIM normalizes whitespace to reduce duplicate groups
  -- Filters out blank/null names to avoid noise in suggestions
  RETURN QUERY
  SELECT
    BTRIM(tb.ten_thiet_bi) AS ten_thiet_bi,
    COUNT(*)::BIGINT AS device_count,
    ARRAY_AGG(tb.id ORDER BY tb.id) AS device_ids
  FROM public.thiet_bi tb
  WHERE tb.don_vi = p_don_vi
    AND tb.nhom_thiet_bi_id IS NULL
    AND NULLIF(BTRIM(tb.ten_thiet_bi), '') IS NOT NULL
  GROUP BY BTRIM(tb.ten_thiet_bi)
  ORDER BY COUNT(*) DESC, BTRIM(tb.ten_thiet_bi);
END;
$$;

-- ── Permission grants ────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_unassigned_names(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_unassigned_names(BIGINT) FROM PUBLIC;

COMMIT;
