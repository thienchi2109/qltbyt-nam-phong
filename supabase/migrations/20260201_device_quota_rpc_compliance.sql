-- Migration: Device Quota RPC Functions - Compliance Reporting
-- Date: 2026-02-01
-- Purpose:
--   Compliance reporting functions for device quota management.
--   Provides dashboard-level summaries and per-category compliance details.
--   Compares current equipment counts against quota limits.
--
-- Functions:
--   - dinh_muc_compliance_summary: Dashboard-level compliance statistics
--   - dinh_muc_compliance_detail: Per-category compliance status
--
-- Security: All functions use JWT claims for tenant isolation per CLAUDE.md
-- Note: These are READ-ONLY functions - all authenticated users can read (tenant isolation only)

BEGIN;

-- ============================================================================
-- FUNCTION: dinh_muc_compliance_summary
-- ============================================================================
-- Get dashboard-level compliance statistics for a quota decision.
-- If p_quyet_dinh_id is NULL, finds the active decision for the tenant.
--
-- Returns:
--   - total_categories: Count of categories in the decision
--   - dat_count: Categories meeting quota (min <= current <= max)
--   - thieu_count: Categories under minimum quota
--   - vuot_count: Categories exceeding maximum quota
--   - unassigned_equipment: Equipment with no category assigned
--
-- All authenticated users can read (tenant isolation only)

CREATE OR REPLACE FUNCTION public.dinh_muc_compliance_summary(
  p_quyet_dinh_id BIGINT DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS TABLE (
  quyet_dinh_id BIGINT,
  so_quyet_dinh TEXT,
  total_categories BIGINT,
  dat_count BIGINT,
  thieu_count BIGINT,
  vuot_count BIGINT,
  unassigned_equipment BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_decision_id BIGINT;
  v_decision_don_vi BIGINT;
BEGIN
  -- Fallback for older tokens using 'role' instead of 'app_role'
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;

  -- Tenant isolation: non-global/admin users can only see their own tenant
  IF v_role NOT IN ('global', 'admin', 'regional_leader') THEN
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  -- If still no tenant specified, return empty
  IF p_don_vi IS NULL THEN
    RETURN;
  END IF;

  -- Determine which decision to use
  IF p_quyet_dinh_id IS NOT NULL THEN
    -- Verify decision belongs to this tenant
    SELECT qd.id, qd.don_vi_id INTO v_decision_id, v_decision_don_vi
    FROM public.quyet_dinh_dinh_muc qd
    WHERE qd.id = p_quyet_dinh_id;

    IF v_decision_don_vi IS NULL OR v_decision_don_vi != p_don_vi THEN
      -- Decision not found or belongs to different tenant
      RETURN;
    END IF;
  ELSE
    -- Find active decision for this tenant
    SELECT qd.id INTO v_decision_id
    FROM public.quyet_dinh_dinh_muc qd
    WHERE qd.don_vi_id = p_don_vi
      AND qd.trang_thai = 'active'
    ORDER BY qd.ngay_hieu_luc DESC
    LIMIT 1;

    -- No active decision found
    IF v_decision_id IS NULL THEN
      RETURN QUERY
      SELECT
        NULL::BIGINT AS quyet_dinh_id,
        NULL::TEXT AS so_quyet_dinh,
        0::BIGINT AS total_categories,
        0::BIGINT AS dat_count,
        0::BIGINT AS thieu_count,
        0::BIGINT AS vuot_count,
        (
          SELECT COUNT(*)::BIGINT
          FROM public.thiet_bi tb
          WHERE tb.don_vi = p_don_vi
            AND tb.nhom_thiet_bi_id IS NULL
        ) AS unassigned_equipment;
      RETURN;
    END IF;
  END IF;

  -- Calculate compliance statistics
  RETURN QUERY
  WITH equipment_counts AS (
    -- Count equipment per category for this tenant
    SELECT
      tb.nhom_thiet_bi_id,
      COUNT(*)::BIGINT AS so_luong_hien_co
    FROM public.thiet_bi tb
    WHERE tb.don_vi = p_don_vi
      AND tb.nhom_thiet_bi_id IS NOT NULL
    GROUP BY tb.nhom_thiet_bi_id
  ),
  compliance_status AS (
    -- Calculate compliance for each line item in the decision
    SELECT
      cd.nhom_thiet_bi_id,
      cd.so_luong_toi_thieu,
      cd.so_luong_toi_da,
      COALESCE(ec.so_luong_hien_co, 0) AS so_luong_hien_co,
      CASE
        WHEN COALESCE(ec.so_luong_hien_co, 0) < cd.so_luong_toi_thieu THEN 'thieu'
        WHEN COALESCE(ec.so_luong_hien_co, 0) > cd.so_luong_toi_da THEN 'vuot'
        ELSE 'dat'
      END AS trang_thai_tuan_thu
    FROM public.chi_tiet_dinh_muc cd
    LEFT JOIN equipment_counts ec ON ec.nhom_thiet_bi_id = cd.nhom_thiet_bi_id
    WHERE cd.quyet_dinh_id = v_decision_id
  )
  SELECT
    v_decision_id AS quyet_dinh_id,
    qd.so_quyet_dinh,
    COUNT(*)::BIGINT AS total_categories,
    COUNT(*) FILTER (WHERE cs.trang_thai_tuan_thu = 'dat')::BIGINT AS dat_count,
    COUNT(*) FILTER (WHERE cs.trang_thai_tuan_thu = 'thieu')::BIGINT AS thieu_count,
    COUNT(*) FILTER (WHERE cs.trang_thai_tuan_thu = 'vuot')::BIGINT AS vuot_count,
    (
      SELECT COUNT(*)::BIGINT
      FROM public.thiet_bi tb
      WHERE tb.don_vi = p_don_vi
        AND tb.nhom_thiet_bi_id IS NULL
    ) AS unassigned_equipment
  FROM compliance_status cs
  CROSS JOIN public.quyet_dinh_dinh_muc qd
  WHERE qd.id = v_decision_id
  GROUP BY qd.so_quyet_dinh;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_compliance_summary(BIGINT, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_compliance_summary IS
  'Get dashboard-level compliance statistics for a quota decision.
   If p_quyet_dinh_id is NULL, uses active decision for tenant.
   Returns counts for compliant (dat), under quota (thieu), and over quota (vuot) categories.';


-- ============================================================================
-- FUNCTION: dinh_muc_compliance_detail
-- ============================================================================
-- Get per-category compliance status for a quota decision.
-- If p_quyet_dinh_id is NULL, finds the active decision for the tenant.
--
-- Returns per category:
--   - nhom_thiet_bi_id, ma_nhom, ten_nhom, phan_loai
--   - so_luong_toi_thieu, so_luong_toi_da (from quota)
--   - so_luong_hien_co (current equipment count)
--   - trang_thai_tuan_thu: 'dat' | 'thieu' | 'vuot'
--   - chenh_lech: Difference from acceptable range
--
-- Ordered by: trang_thai_tuan_thu (thieu first, then vuot, then dat), then by ma_nhom
--
-- All authenticated users can read (tenant isolation only)

CREATE OR REPLACE FUNCTION public.dinh_muc_compliance_detail(
  p_quyet_dinh_id BIGINT DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS TABLE (
  quyet_dinh_id BIGINT,
  nhom_thiet_bi_id BIGINT,
  ma_nhom TEXT,
  ten_nhom TEXT,
  phan_loai TEXT,
  so_luong_toi_thieu INT,
  so_luong_toi_da INT,
  so_luong_hien_co BIGINT,
  trang_thai_tuan_thu TEXT,
  chenh_lech INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_don_vi TEXT := current_setting('request.jwt.claims', true)::json->>'don_vi';
  v_decision_id BIGINT;
  v_decision_don_vi BIGINT;
BEGIN
  -- Fallback for older tokens using 'role' instead of 'app_role'
  IF v_role IS NULL OR v_role = '' THEN
    v_role := current_setting('request.jwt.claims', true)::json->>'role';
  END IF;

  -- Tenant isolation: non-global/admin users can only see their own tenant
  IF v_role NOT IN ('global', 'admin', 'regional_leader') THEN
    p_don_vi := NULLIF(v_don_vi, '')::BIGINT;
  END IF;

  -- If still no tenant specified, return empty
  IF p_don_vi IS NULL THEN
    RETURN;
  END IF;

  -- Determine which decision to use
  IF p_quyet_dinh_id IS NOT NULL THEN
    -- Verify decision belongs to this tenant
    SELECT qd.id, qd.don_vi_id INTO v_decision_id, v_decision_don_vi
    FROM public.quyet_dinh_dinh_muc qd
    WHERE qd.id = p_quyet_dinh_id;

    IF v_decision_don_vi IS NULL OR v_decision_don_vi != p_don_vi THEN
      -- Decision not found or belongs to different tenant
      RETURN;
    END IF;
  ELSE
    -- Find active decision for this tenant
    SELECT qd.id INTO v_decision_id
    FROM public.quyet_dinh_dinh_muc qd
    WHERE qd.don_vi_id = p_don_vi
      AND qd.trang_thai = 'active'
    ORDER BY qd.ngay_hieu_luc DESC
    LIMIT 1;

    -- No active decision found
    IF v_decision_id IS NULL THEN
      RETURN;
    END IF;
  END IF;

  -- Return compliance details for each category in the decision
  RETURN QUERY
  WITH equipment_counts AS (
    -- Count equipment per category for this tenant
    SELECT
      tb.nhom_thiet_bi_id,
      COUNT(*)::BIGINT AS cnt
    FROM public.thiet_bi tb
    WHERE tb.don_vi = p_don_vi
      AND tb.nhom_thiet_bi_id IS NOT NULL
    GROUP BY tb.nhom_thiet_bi_id
  ),
  compliance_data AS (
    SELECT
      v_decision_id AS quyet_dinh_id,
      ntb.id AS nhom_thiet_bi_id,
      ntb.ma_nhom,
      ntb.ten_nhom,
      ntb.phan_loai,
      cd.so_luong_toi_thieu,
      cd.so_luong_toi_da,
      COALESCE(ec.cnt, 0)::BIGINT AS so_luong_hien_co,
      CASE
        WHEN COALESCE(ec.cnt, 0) < cd.so_luong_toi_thieu THEN 'thieu'
        WHEN COALESCE(ec.cnt, 0) > cd.so_luong_toi_da THEN 'vuot'
        ELSE 'dat'
      END AS trang_thai_tuan_thu,
      -- Calculate difference from acceptable range
      -- Negative if under minimum, positive if over maximum, 0 if in range
      CASE
        WHEN COALESCE(ec.cnt, 0) < cd.so_luong_toi_thieu THEN
          (COALESCE(ec.cnt, 0) - cd.so_luong_toi_thieu)::INT
        WHEN COALESCE(ec.cnt, 0) > cd.so_luong_toi_da THEN
          (COALESCE(ec.cnt, 0) - cd.so_luong_toi_da)::INT
        ELSE 0
      END AS chenh_lech
    FROM public.chi_tiet_dinh_muc cd
    INNER JOIN public.nhom_thiet_bi ntb ON ntb.id = cd.nhom_thiet_bi_id
    LEFT JOIN equipment_counts ec ON ec.nhom_thiet_bi_id = cd.nhom_thiet_bi_id
    WHERE cd.quyet_dinh_id = v_decision_id
  )
  SELECT
    cdata.quyet_dinh_id,
    cdata.nhom_thiet_bi_id,
    cdata.ma_nhom,
    cdata.ten_nhom,
    cdata.phan_loai,
    cdata.so_luong_toi_thieu,
    cdata.so_luong_toi_da,
    cdata.so_luong_hien_co,
    cdata.trang_thai_tuan_thu,
    cdata.chenh_lech
  FROM compliance_data cdata
  ORDER BY
    -- Order by compliance status: thieu (under) first, then vuot (over), then dat (compliant)
    CASE cdata.trang_thai_tuan_thu
      WHEN 'thieu' THEN 1
      WHEN 'vuot' THEN 2
      WHEN 'dat' THEN 3
    END,
    cdata.ma_nhom;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dinh_muc_compliance_detail(BIGINT, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.dinh_muc_compliance_detail IS
  'Get per-category compliance status for a quota decision.
   If p_quyet_dinh_id is NULL, uses active decision for tenant.
   Returns category details with quota limits, current counts, and compliance status.
   Ordered by compliance priority: thieu (under quota), vuot (over quota), dat (compliant).';

COMMIT;
