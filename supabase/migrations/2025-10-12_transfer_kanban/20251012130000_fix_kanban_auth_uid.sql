-- Hotfix: Remove auth.uid() check from Kanban RPC functions
-- Date: 2025-10-12 13:00
-- Issue: auth.uid() expects UUID but our system uses integer user IDs
-- Solution: Use JWT claims directly like existing RPC functions

-- ============================================================================
-- Drop existing functions first (return type changed)
-- ============================================================================

DROP FUNCTION IF EXISTS get_transfers_kanban(BIGINT[], BIGINT[], TEXT[], TEXT[], TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INT, BIGINT);
DROP FUNCTION IF EXISTS get_transfer_counts(BIGINT[]);

-- ============================================================================
-- Fix get_transfers_kanban: Use JWT claims instead of auth.uid()
-- ============================================================================

CREATE OR REPLACE FUNCTION get_transfers_kanban(
  p_facility_ids BIGINT[] DEFAULT NULL,
  p_assignee_ids BIGINT[] DEFAULT NULL,
  p_types TEXT[] DEFAULT NULL,
  p_statuses TEXT[] DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_search_text TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_cursor BIGINT DEFAULT NULL
) 
RETURNS TABLE (
  id BIGINT,
  ma_yeu_cau TEXT,
  thiet_bi_id BIGINT,
  loai_hinh TEXT,
  trang_thai TEXT,
  nguoi_yeu_cau_id BIGINT,
  ly_do_luan_chuyen TEXT,
  khoa_phong_hien_tai TEXT,
  khoa_phong_nhan TEXT,
  muc_dich TEXT,
  don_vi_nhan TEXT,
  dia_chi_don_vi TEXT,
  nguoi_lien_he TEXT,
  so_dien_thoai TEXT,
  ngay_du_kien_tra TIMESTAMPTZ,
  ngay_ban_giao TIMESTAMPTZ,
  ngay_hoan_tra TIMESTAMPTZ,
  ngay_hoan_thanh TIMESTAMPTZ,
  nguoi_duyet_id BIGINT,
  ngay_duyet TIMESTAMPTZ,
  ghi_chu_duyet TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by BIGINT,
  updated_by BIGINT,
  -- Joined equipment data
  thiet_bi_ma TEXT,
  thiet_bi_ten TEXT,
  thiet_bi_model TEXT,
  thiet_bi_don_vi BIGINT,
  -- Metadata
  total_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role TEXT;
  v_user_don_vi BIGINT;
BEGIN
  -- Get user context from JWT claims (no auth.uid() check)
  v_user_role := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_user_don_vi := (current_setting('request.jwt.claims', true)::json->>'don_vi')::BIGINT;
  
  -- Validate role exists and is allowed
  IF v_user_role IS NULL OR v_user_role NOT IN ('user', 'technician', 'to_qltb', 'regional_leader', 'global') THEN
    RAISE EXCEPTION 'Unauthorized: Invalid or missing role';
  END IF;
  
  -- Tenant isolation robustness for non-global users
  IF v_user_role != 'global' AND v_user_role != 'regional_leader' THEN
    -- Require tenant context for non-global users
    IF v_user_don_vi IS NULL THEN
      RAISE EXCEPTION 'Forbidden: Tenant context required for non-global users';
    END IF;
    -- Force facility filter to user's don_vi (strict isolation)
    p_facility_ids := ARRAY[v_user_don_vi];
  END IF;
  
  -- Return filtered, paginated results with equipment data
  -- Use INNER JOIN for strict tenant isolation (require equipment exists)
  RETURN QUERY
  SELECT 
    yclc.id,
    yclc.ma_yeu_cau,
    yclc.thiet_bi_id,
    yclc.loai_hinh,
    yclc.trang_thai,
    yclc.nguoi_yeu_cau_id,
    yclc.ly_do_luan_chuyen,
    yclc.khoa_phong_hien_tai,
    yclc.khoa_phong_nhan,
    yclc.muc_dich,
    yclc.don_vi_nhan,
    yclc.dia_chi_don_vi,
    yclc.nguoi_lien_he,
    yclc.so_dien_thoai,
    yclc.ngay_du_kien_tra,
    yclc.ngay_ban_giao,
    yclc.ngay_hoan_tra,
    yclc.ngay_hoan_thanh,
    yclc.nguoi_duyet_id,
    yclc.ngay_duyet,
    yclc.ghi_chu_duyet,
    yclc.created_at,
    yclc.updated_at,
    yclc.created_by,
    yclc.updated_by,
    -- Equipment fields
    tb.ma_thiet_bi,
    tb.ten_thiet_bi,
    tb.model,
    tb.don_vi,
    -- Total count for pagination
    (SELECT COUNT(*) 
     FROM yeu_cau_luan_chuyen yclc2
     INNER JOIN thiet_bi tb2 ON yclc2.thiet_bi_id = tb2.id
     WHERE 1=1
       AND (p_facility_ids IS NULL OR tb2.don_vi = ANY(p_facility_ids))
       AND (p_assignee_ids IS NULL OR yclc2.nguoi_yeu_cau_id = ANY(p_assignee_ids))
       AND (p_types IS NULL OR yclc2.loai_hinh = ANY(p_types))
       AND (p_statuses IS NULL OR yclc2.trang_thai = ANY(p_statuses))
       AND (p_date_from IS NULL OR yclc2.created_at >= p_date_from)
       AND (p_date_to IS NULL OR yclc2.created_at <= p_date_to)
       AND (p_search_text IS NULL 
            OR yclc2.ma_yeu_cau ILIKE '%' || p_search_text || '%'
            OR tb2.ma_thiet_bi ILIKE '%' || p_search_text || '%'
            OR tb2.ten_thiet_bi ILIKE '%' || p_search_text || '%'
       )
    ) AS total_count
  FROM yeu_cau_luan_chuyen yclc
  INNER JOIN thiet_bi tb ON yclc.thiet_bi_id = tb.id
  WHERE 1=1
    AND (p_facility_ids IS NULL OR tb.don_vi = ANY(p_facility_ids))
    AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
    AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
    AND (p_statuses IS NULL OR yclc.trang_thai = ANY(p_statuses))
    AND (p_date_from IS NULL OR yclc.created_at >= p_date_from)
    AND (p_date_to IS NULL OR yclc.created_at <= p_date_to)
    AND (p_search_text IS NULL 
         OR yclc.ma_yeu_cau ILIKE '%' || p_search_text || '%'
         OR tb.ma_thiet_bi ILIKE '%' || p_search_text || '%'
         OR tb.ten_thiet_bi ILIKE '%' || p_search_text || '%'
    )
    AND (p_cursor IS NULL OR yclc.id > p_cursor)
  ORDER BY yclc.id ASC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- Fix get_transfer_counts: Use JWT claims instead of auth.uid()
-- ============================================================================

CREATE OR REPLACE FUNCTION get_transfer_counts(
  p_facility_ids BIGINT[] DEFAULT NULL
)
RETURNS TABLE (
  total_count BIGINT,
  cho_duyet_count BIGINT,
  da_duyet_count BIGINT,
  dang_luan_chuyen_count BIGINT,
  da_ban_giao_count BIGINT,
  hoan_thanh_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role TEXT;
  v_user_don_vi BIGINT;
BEGIN
  -- Get user context from JWT claims (no auth.uid() check)
  v_user_role := current_setting('request.jwt.claims', true)::json->>'app_role';
  v_user_don_vi := (current_setting('request.jwt.claims', true)::json->>'don_vi')::BIGINT;
  
  -- Validate role
  IF v_user_role IS NULL OR v_user_role NOT IN ('user', 'technician', 'to_qltb', 'regional_leader', 'global') THEN
    RAISE EXCEPTION 'Unauthorized: Invalid or missing role';
  END IF;
  
  -- Tenant isolation for non-global users
  IF v_user_role != 'global' AND v_user_role != 'regional_leader' THEN
    IF v_user_don_vi IS NULL THEN
      RAISE EXCEPTION 'Forbidden: Tenant context required';
    END IF;
    p_facility_ids := ARRAY[v_user_don_vi];
  END IF;
  
  -- Return counts with INNER JOIN for tenant isolation
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_count,
    COUNT(*) FILTER (WHERE yclc.trang_thai = 'cho_duyet')::BIGINT AS cho_duyet_count,
    COUNT(*) FILTER (WHERE yclc.trang_thai = 'da_duyet')::BIGINT AS da_duyet_count,
    COUNT(*) FILTER (WHERE yclc.trang_thai = 'dang_luan_chuyen')::BIGINT AS dang_luan_chuyen_count,
    COUNT(*) FILTER (WHERE yclc.trang_thai = 'da_ban_giao')::BIGINT AS da_ban_giao_count,
    COUNT(*) FILTER (WHERE yclc.trang_thai = 'hoan_thanh')::BIGINT AS hoan_thanh_count
  FROM yeu_cau_luan_chuyen yclc
  INNER JOIN thiet_bi tb ON yclc.thiet_bi_id = tb.id
  WHERE (p_facility_ids IS NULL OR tb.don_vi = ANY(p_facility_ids));
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_transfers_kanban TO authenticated;
GRANT EXECUTE ON FUNCTION get_transfer_counts TO authenticated;

COMMENT ON FUNCTION get_transfers_kanban IS 'Server-side Kanban data with JWT-based auth (no auth.uid() dependency)';
COMMENT ON FUNCTION get_transfer_counts IS 'Transfer counts by status with JWT-based auth (no auth.uid() dependency)';
