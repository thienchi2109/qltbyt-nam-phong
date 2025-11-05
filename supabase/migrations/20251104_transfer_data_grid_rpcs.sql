-- Migration: Transfer Request Data Grid RPCs
-- Date: 2025-11-04
-- Purpose: Replace Kanban RPCs with data grid-optimized functions
-- Pattern: Follows repair_request_list conventions (JSONB return, offset pagination)
-- Related: openspec/changes/refactor-transfer-board-data-grid/

-- ============================================================================
-- SECTION 1: Drop Old Kanban Functions
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_transfers_kanban(BIGINT[], BIGINT[], TEXT[], TEXT[], TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INT, BIGINT);
DROP FUNCTION IF EXISTS public.get_transfer_counts(BIGINT[]);
DROP FUNCTION IF EXISTS public.transfer_request_list(TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS public.transfer_request_list(TEXT, TEXT[], INT, INT, BIGINT);
DROP FUNCTION IF EXISTS public.transfer_request_list(TEXT, TEXT[], TEXT[], INT, INT, BIGINT);

COMMENT ON SCHEMA public IS 'Dropped get_transfers_kanban and get_transfer_counts - replaced with transfer_request_list and transfer_request_counts';

-- ============================================================================
-- SECTION 2: Transfer Request List (Data Grid)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.transfer_request_list(
  p_q TEXT DEFAULT NULL,                    -- Search text (equipment, transfer code, reason)
  p_statuses TEXT[] DEFAULT NULL,           -- Multi-status filter (cho_duyet, da_duyet, etc.)
  p_types TEXT[] DEFAULT NULL,              -- Transfer types (noi_bo, ben_ngoai)
  p_page INT DEFAULT 1,                     -- Page number (1-indexed)
  p_page_size INT DEFAULT 50,               -- Items per page
  p_don_vi BIGINT DEFAULT NULL,             -- Facility filter (global users only)
  p_date_from DATE DEFAULT NULL,            -- Date range start (VN timezone)
  p_date_to DATE DEFAULT NULL,              -- Date range end (VN timezone)
  p_assignee_ids BIGINT[] DEFAULT NULL      -- Assignee filter (optional)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_effective_donvi BIGINT := NULL;
  v_allowed BIGINT[] := NULL;
  v_limit INT := GREATEST(COALESCE(p_page_size, 50), 1);
  v_offset INT := GREATEST((COALESCE(p_page, 1) - 1) * v_limit, 0);
  v_total BIGINT := 0;
  v_data JSONB := '[]'::jsonb;
BEGIN
  -- Tenant isolation using allowed_don_vi_for_session helper
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      -- No access - return empty result
      RETURN jsonb_build_object('data','[]'::jsonb,'total',0,'page',p_page,'pageSize',p_page_size);
    END IF;
    
    IF p_don_vi IS NOT NULL THEN
      -- Check if requested facility is in allowed list
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        -- Requested facility not allowed - return empty
        RETURN jsonb_build_object('data','[]'::jsonb,'total',0,'page',p_page,'pageSize',p_page_size);
      END IF;
    END IF;
  END IF;

  -- Total count for pagination
  SELECT count(*) INTO v_total
  FROM public.yeu_cau_luan_chuyen yclc
  JOIN public.thiet_bi tb ON tb.id = yclc.thiet_bi_id
  LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
  WHERE (
    (v_role = 'global' AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
    (v_role <> 'global' AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
  )
  AND (p_statuses IS NULL OR yclc.trang_thai = ANY(p_statuses))
  AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
  AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
  AND (
    p_q IS NULL OR p_q = '' OR
    yclc.ma_yeu_cau ILIKE '%' || p_q || '%' OR
    yclc.ly_do_luan_chuyen ILIKE '%' || p_q || '%' OR
    tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
    tb.ma_thiet_bi ILIKE '%' || p_q || '%'
  )
  AND (p_date_from IS NULL OR yclc.created_at >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
  AND (p_date_to IS NULL OR yclc.created_at < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'));

  -- Data page (JSONB format for consistent API response)
  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb) INTO v_data
  FROM (
    SELECT 
      jsonb_build_object(
        'id', yclc.id,
        'ma_yeu_cau', yclc.ma_yeu_cau,
        'thiet_bi_id', yclc.thiet_bi_id,
        'loai_hinh', yclc.loai_hinh,
        'trang_thai', yclc.trang_thai,
        'nguoi_yeu_cau_id', yclc.nguoi_yeu_cau_id,
        'ly_do_luan_chuyen', yclc.ly_do_luan_chuyen,
        'khoa_phong_hien_tai', yclc.khoa_phong_hien_tai,
        'khoa_phong_nhan', yclc.khoa_phong_nhan,
        'muc_dich', yclc.muc_dich,
        'don_vi_nhan', yclc.don_vi_nhan,
        'dia_chi_don_vi', yclc.dia_chi_don_vi,
        'nguoi_lien_he', yclc.nguoi_lien_he,
        'so_dien_thoai', yclc.so_dien_thoai,
        'ngay_du_kien_tra', yclc.ngay_du_kien_tra,
        'ngay_ban_giao', yclc.ngay_ban_giao,
        'ngay_hoan_tra', yclc.ngay_hoan_tra,
        'ngay_hoan_thanh', yclc.ngay_hoan_thanh,
        'nguoi_duyet_id', yclc.nguoi_duyet_id,
        'ngay_duyet', yclc.ngay_duyet,
        'ghi_chu_duyet', yclc.ghi_chu_duyet,
        'created_at', yclc.created_at,
        'updated_at', yclc.updated_at,
        'created_by', yclc.created_by,
        'updated_by', yclc.updated_by,
        'thiet_bi', jsonb_build_object(
          'ten_thiet_bi', tb.ten_thiet_bi,
          'ma_thiet_bi', tb.ma_thiet_bi,
          'model', tb.model,
          'serial', tb.serial,
          'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
          'facility_name', dv.name,
          'facility_id', tb.don_vi
        )
      ) as row_data,
      yclc.created_at
    FROM public.yeu_cau_luan_chuyen yclc
    JOIN public.thiet_bi tb ON tb.id = yclc.thiet_bi_id
    LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
    WHERE (
      (v_role = 'global' AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
      (v_role <> 'global' AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
    )
    AND (p_statuses IS NULL OR yclc.trang_thai = ANY(p_statuses))
    AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
    AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
    AND (
      p_q IS NULL OR p_q = '' OR
      yclc.ma_yeu_cau ILIKE '%' || p_q || '%' OR
      yclc.ly_do_luan_chuyen ILIKE '%' || p_q || '%' OR
      tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
      tb.ma_thiet_bi ILIKE '%' || p_q || '%'
    )
    AND (p_date_from IS NULL OR yclc.created_at >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
    AND (p_date_to IS NULL OR yclc.created_at < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
    ORDER BY yclc.created_at DESC, yclc.id DESC
    OFFSET v_offset
    LIMIT v_limit
  ) subq;

  RETURN jsonb_build_object('data', v_data, 'total', v_total, 'page', p_page, 'pageSize', p_page_size);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_list(TEXT, TEXT[], TEXT[], INT, INT, BIGINT, DATE, DATE, BIGINT[]) TO authenticated;

COMMENT ON FUNCTION public.transfer_request_list(TEXT, TEXT[], TEXT[], INT, INT, BIGINT, DATE, DATE, BIGINT[]) IS 
'Lists transfer requests with server-side filtering, pagination, and tenant isolation. 
Returns JSONB with {data, total, page, pageSize} structure matching repair_request_list pattern.';

-- ============================================================================
-- SECTION 3: Transfer Request Counts (Status Badges)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.transfer_request_counts(
  p_q TEXT DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_types TEXT[] DEFAULT NULL,
  p_assignee_ids BIGINT[] DEFAULT NULL
) 
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_effective_donvi BIGINT := NULL;
  v_allowed BIGINT[] := NULL;
BEGIN
  -- Tenant isolation (same logic as list function)
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      -- No access - return zero counts
      RETURN jsonb_build_object(
        'cho_duyet', 0,
        'da_duyet', 0,
        'dang_luan_chuyen', 0,
        'da_ban_giao', 0,
        'hoan_thanh', 0
      );
    END IF;
    
    IF p_don_vi IS NOT NULL AND NOT (p_don_vi = ANY(v_allowed)) THEN
      -- Requested facility not allowed - return zero counts
      RETURN jsonb_build_object(
        'cho_duyet', 0,
        'da_duyet', 0,
        'dang_luan_chuyen', 0,
        'da_ban_giao', 0,
        'hoan_thanh', 0
      );
    END IF;
    v_effective_donvi := p_don_vi;
  END IF;

  -- Return counts by status (excludes p_statuses filter)
  RETURN (
    WITH base AS (
      SELECT yclc.trang_thai
      FROM public.yeu_cau_luan_chuyen yclc
      JOIN public.thiet_bi tb ON tb.id = yclc.thiet_bi_id
      WHERE (
        (v_role = 'global' AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
        (v_role <> 'global' AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
      )
      AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
      AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
      AND (
        p_q IS NULL OR p_q = '' OR
        yclc.ma_yeu_cau ILIKE '%' || p_q || '%' OR
        yclc.ly_do_luan_chuyen ILIKE '%' || p_q || '%' OR
        tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR
        tb.ma_thiet_bi ILIKE '%' || p_q || '%'
      )
      AND (p_date_from IS NULL OR yclc.created_at >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
      AND (p_date_to IS NULL OR yclc.created_at < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
    )
    SELECT jsonb_build_object(
      'cho_duyet', COALESCE((SELECT count(*) FROM base WHERE trang_thai = 'cho_duyet'), 0),
      'da_duyet', COALESCE((SELECT count(*) FROM base WHERE trang_thai = 'da_duyet'), 0),
      'dang_luan_chuyen', COALESCE((SELECT count(*) FROM base WHERE trang_thai = 'dang_luan_chuyen'), 0),
      'da_ban_giao', COALESCE((SELECT count(*) FROM base WHERE trang_thai = 'da_ban_giao'), 0),
      'hoan_thanh', COALESCE((SELECT count(*) FROM base WHERE trang_thai = 'hoan_thanh'), 0)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_counts(TEXT, BIGINT, DATE, DATE, TEXT[], BIGINT[]) TO authenticated;

COMMENT ON FUNCTION public.transfer_request_counts(TEXT, BIGINT, DATE, DATE, TEXT[], BIGINT[]) IS 
'Returns counts per status for current filters (excludes status filter itself). 
Respects tenant isolation and matches transfer_request_list filter logic.';

-- ============================================================================
-- SECTION 4: Performance Testing Queries
-- ============================================================================

-- Test 1: Basic list query (first page)
-- EXPLAIN (ANALYZE, BUFFERS) 
-- SELECT transfer_request_list(p_page := 1, p_page_size := 50);

-- Test 2: Filtered by status (common use case)
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT transfer_request_list(
--   p_statuses := ARRAY['cho_duyet', 'da_duyet']::TEXT[],
--   p_page := 1,
--   p_page_size := 50
-- );

-- Test 3: Full-text search
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT transfer_request_list(
--   p_q := 'máy xét nghiệm',
--   p_page := 1,
--   p_page_size := 50
-- );

-- Test 4: Counts query
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT transfer_request_counts();

-- Test 5: Complex filter combination
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT transfer_request_list(
--   p_q := 'thiết bị',
--   p_statuses := ARRAY['cho_duyet']::TEXT[],
--   p_types := ARRAY['noi_bo']::TEXT[],
--   p_date_from := '2025-01-01'::DATE,
--   p_page := 1,
--   p_page_size := 50
-- );

-- ============================================================================
-- SECTION 5: Tenant Isolation Tests
-- ============================================================================

-- Test 1: Global user can see all facilities
-- SET request.jwt.claims = '{"app_role":"global"}';
-- SELECT jsonb_array_length((transfer_request_list(p_page_size := 10))->>'data');

-- Test 2: Global user can filter by specific facility
-- SET request.jwt.claims = '{"app_role":"global"}';
-- SELECT transfer_request_list(p_don_vi := 5, p_page_size := 10);

-- Test 3: Non-global user sees only their facility
-- SET request.jwt.claims = '{"app_role":"to_qltb","don_vi":"5"}';
-- SELECT jsonb_array_length((transfer_request_list(p_page_size := 10))->>'data');

-- Test 4: Non-global user cannot access other facilities
-- SET request.jwt.claims = '{"app_role":"to_qltb","don_vi":"5"}';
-- SELECT transfer_request_list(p_don_vi := 10); -- Should return empty {"data":[],"total":0}

-- Test 5: Regional leader can see multiple facilities (via allowed_don_vi_for_session)
-- SET request.jwt.claims = '{"app_role":"regional_leader","don_vi":"5","dia_ban":1}';
-- SELECT transfer_request_list(p_page_size := 50);

-- Test 6: Counts respect same isolation rules
-- SET request.jwt.claims = '{"app_role":"to_qltb","don_vi":"5"}';
-- SELECT transfer_request_counts();

-- ============================================================================
-- SECTION 6: Index Verification
-- ============================================================================

-- Verify existing indexes are being used
-- (Indexes created in 20251012120000_kanban_server_side_filtering.sql)

-- Expected indexes:
-- 1. idx_transfers_kanban_facility_status_date (status, created_at DESC, id DESC)
-- 2. idx_transfers_kanban_assignee_date (nguoi_yeu_cau_id, created_at DESC, id DESC)
-- 3. idx_transfers_kanban_search (GIN index for full-text search)
-- 4. idx_thiet_bi_don_vi_join (id, don_vi, ma_thiet_bi, ten_thiet_bi)

-- Check index usage:
-- SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public' AND indexrelname LIKE 'idx_transfers%';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Rollback procedure:
/*
DROP FUNCTION IF EXISTS public.transfer_request_list(TEXT, TEXT[], TEXT[], INT, INT, BIGINT, DATE, DATE, BIGINT[]);
DROP FUNCTION IF EXISTS public.transfer_request_counts(TEXT, BIGINT, DATE, DATE, TEXT[], BIGINT[]);
-- Restore old functions from 20251012120000_kanban_server_side_filtering.sql if needed
*/
