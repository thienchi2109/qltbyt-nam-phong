-- Migration: Kanban Server-Side Filtering and Pagination
-- Date: 2025-10-12
-- Purpose: Add RPC function for server-side Kanban data orchestration
-- Author: GitHub Copilot
-- Related: Option A (85% solution) - Day 1 Backend Implementation

-- ============================================================================
-- SECTION 1: RPC Function for Kanban Data Fetching
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
  v_user_role TEXT := '';
  v_user_don_vi BIGINT := NULL;
  v_jwt_claims JSONB;
BEGIN
  -- Get JWT claims safely with exception handling
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;
  
  -- Get user context from JWT claims (use app_role, not role)
  v_user_role := COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    'global'
  );
  v_user_don_vi := NULLIF(v_jwt_claims ->> 'don_vi', '')::BIGINT;
  
  -- Validate role is allowed
  IF v_user_role NOT IN ('user', 'technician', 'to_qltb', 'regional_leader', 'global') THEN
    RAISE EXCEPTION 'Unauthorized: Invalid role';
  END IF;
  
  -- Tenant isolation robustness for non-global, non-regional_leader users
  -- EXCEPTION: regional_leader can view multiple facilities (read-only multi-tenant)
  IF v_user_role NOT IN ('global', 'regional_leader') THEN
    -- Require tenant context for restricted users
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
    -- Equipment joined data
    tb.ma_thiet_bi AS thiet_bi_ma,
    tb.ten_thiet_bi AS thiet_bi_ten,
    tb.model AS thiet_bi_model,
    tb.don_vi AS thiet_bi_don_vi,
    -- Total count for pagination metadata
    COUNT(*) OVER() AS total_count
  FROM yeu_cau_luan_chuyen yclc
  INNER JOIN thiet_bi tb ON yclc.thiet_bi_id = tb.id
  WHERE 
    -- Facility filter (strict tenant isolation - always enforced for non-global)
    (p_facility_ids IS NULL OR tb.don_vi = ANY(p_facility_ids))
    -- Assignee filter
    AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
    -- Type filter (loai_hinh: noi_bo, ben_ngoai)
    AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
    -- Status filter (trang_thai: cho_duyet, da_duyet, etc.)
    AND (p_statuses IS NULL OR yclc.trang_thai = ANY(p_statuses))
    -- Date range filter
    AND (p_date_from IS NULL OR yclc.created_at >= p_date_from)
    AND (p_date_to IS NULL OR yclc.created_at <= p_date_to)
    -- Full-text search (ma_yeu_cau, equipment name, reason)
    AND (
      p_search_text IS NULL 
      OR to_tsvector('simple', 
          COALESCE(yclc.ma_yeu_cau, '') || ' ' || 
          COALESCE(tb.ten_thiet_bi, '') || ' ' || 
          COALESCE(tb.ma_thiet_bi, '') || ' ' ||
          COALESCE(yclc.ly_do_luan_chuyen, '')
        ) @@ plainto_tsquery('simple', p_search_text)
    )
    -- Cursor-based pagination (for infinite scroll)
    AND (p_cursor IS NULL OR yclc.id < p_cursor)
  ORDER BY yclc.created_at DESC, yclc.id DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_transfers_kanban IS 
'Server-side Kanban data fetching with filtering, pagination, and search. 
Enforces tenant isolation for non-global users. Returns joined equipment data.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_transfers_kanban TO authenticated;

-- ============================================================================
-- SECTION 2: RPC Function for Transfer Counts (Overview Header)
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
  v_user_role TEXT := '';
  v_user_don_vi BIGINT := NULL;
  v_jwt_claims JSONB;
BEGIN
  -- Get JWT claims safely with exception handling
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;
  
  -- Get user context from JWT claims (use app_role, not role)
  v_user_role := COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    'global'
  );
  v_user_don_vi := NULLIF(v_jwt_claims ->> 'don_vi', '')::BIGINT;
  
  -- Validate role is allowed
  IF v_user_role NOT IN ('user', 'technician', 'to_qltb', 'regional_leader', 'global') THEN
    RAISE EXCEPTION 'Unauthorized: Invalid role';
  END IF;
  
  -- Tenant isolation robustness for non-global, non-regional_leader users
  -- EXCEPTION: regional_leader can view multiple facilities (read-only multi-tenant)
  IF v_user_role NOT IN ('global', 'regional_leader') THEN
    -- Require tenant context for restricted users
    IF v_user_don_vi IS NULL THEN
      RAISE EXCEPTION 'Forbidden: Tenant context required for non-global users';
    END IF;
    -- Force facility filter to user's don_vi (strict isolation)
    p_facility_ids := ARRAY[v_user_don_vi];
  END IF;
  
  -- Return counts grouped by status
  -- Use INNER JOIN for strict tenant isolation
  RETURN QUERY
  SELECT 
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE yclc.trang_thai = 'cho_duyet') AS cho_duyet_count,
    COUNT(*) FILTER (WHERE yclc.trang_thai = 'da_duyet') AS da_duyet_count,
    COUNT(*) FILTER (WHERE yclc.trang_thai = 'dang_luan_chuyen') AS dang_luan_chuyen_count,
    COUNT(*) FILTER (WHERE yclc.trang_thai = 'da_ban_giao') AS da_ban_giao_count,
    COUNT(*) FILTER (WHERE yclc.trang_thai = 'hoan_thanh') AS hoan_thanh_count
  FROM yeu_cau_luan_chuyen yclc
  INNER JOIN thiet_bi tb ON yclc.thiet_bi_id = tb.id
  WHERE 
    -- Strict facility filtering (always enforced for non-global users)
    (p_facility_ids IS NULL OR tb.don_vi = ANY(p_facility_ids));
END;
$$;

COMMENT ON FUNCTION get_transfer_counts IS 
'Get transfer counts by status for Kanban column headers. Respects tenant isolation.';

GRANT EXECUTE ON FUNCTION get_transfer_counts TO authenticated;

-- ============================================================================
-- SECTION 3: Performance Indexes
-- ============================================================================

-- Index 1: Composite index for facility + status + date queries (most common)
CREATE INDEX IF NOT EXISTS idx_transfers_kanban_facility_status_date 
  ON yeu_cau_luan_chuyen(trang_thai, created_at DESC, id DESC);

COMMENT ON INDEX idx_transfers_kanban_facility_status_date IS 
'Optimizes queries filtering by status with date sorting and cursor pagination';

-- Index 2: Assignee filter with date sorting
CREATE INDEX IF NOT EXISTS idx_transfers_kanban_assignee_date 
  ON yeu_cau_luan_chuyen(nguoi_yeu_cau_id, created_at DESC, id DESC)
  WHERE nguoi_yeu_cau_id IS NOT NULL;

COMMENT ON INDEX idx_transfers_kanban_assignee_date IS 
'Optimizes queries filtering by assignee with date sorting';

-- Index 3: Full-text search index for text fields
CREATE INDEX IF NOT EXISTS idx_transfers_kanban_search 
  ON yeu_cau_luan_chuyen 
  USING gin(
    to_tsvector('simple', 
      COALESCE(ma_yeu_cau, '') || ' ' || 
      COALESCE(ly_do_luan_chuyen, '') || ' ' ||
      COALESCE(khoa_phong_hien_tai, '') || ' ' ||
      COALESCE(khoa_phong_nhan, '')
    )
  );

COMMENT ON INDEX idx_transfers_kanban_search IS 
'Full-text search index for transfer request codes, reasons, and departments';

-- Index 4: Equipment join optimization (if not already exists)
CREATE INDEX IF NOT EXISTS idx_thiet_bi_don_vi_join 
  ON thiet_bi(id, don_vi, ma_thiet_bi, ten_thiet_bi);

COMMENT ON INDEX idx_thiet_bi_don_vi_join IS 
'Optimizes JOIN with yeu_cau_luan_chuyen and tenant filtering';

-- ============================================================================
-- SECTION 4: Testing Queries (Comment out in production)
-- ============================================================================

-- Test 1: Fetch all transfers with default pagination
-- SELECT * FROM get_transfers_kanban(p_limit := 10);

-- Test 2: Filter by status
-- SELECT * FROM get_transfers_kanban(
--   p_statuses := ARRAY['cho_duyet', 'da_duyet']::TEXT[],
--   p_limit := 50
-- );

-- Test 3: Search by equipment name
-- SELECT * FROM get_transfers_kanban(
--   p_search_text := 'máy xét nghiệm',
--   p_limit := 20
-- );

-- Test 4: Get counts for overview
-- SELECT * FROM get_transfer_counts();

-- Test 5: Performance analysis
-- EXPLAIN (ANALYZE, BUFFERS) 
-- SELECT * FROM get_transfers_kanban(
--   p_statuses := ARRAY['cho_duyet']::TEXT[],
--   p_limit := 100
-- );

-- ============================================================================
-- ROLLBACK PROCEDURE
-- ============================================================================

-- To rollback this migration, run the following SQL:

/*
-- Drop indexes
DROP INDEX IF EXISTS idx_transfers_kanban_facility_status_date;
DROP INDEX IF EXISTS idx_transfers_kanban_assignee_date;
DROP INDEX IF EXISTS idx_transfers_kanban_search;
DROP INDEX IF EXISTS idx_thiet_bi_don_vi_join;

-- Drop functions
DROP FUNCTION IF EXISTS get_transfers_kanban(BIGINT[], BIGINT[], TEXT[], TEXT[], TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INT, BIGINT);
DROP FUNCTION IF EXISTS get_transfer_counts(BIGINT[]);
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Next Steps:
-- 1. Review this migration file
-- 2. Test queries in Supabase SQL Editor
-- 3. Run EXPLAIN ANALYZE to verify index usage
-- 4. Apply migration manually via Supabase Dashboard
-- 5. Update RPC proxy whitelist (src/app/api/rpc/[fn]/route.ts)
-- 6. Proceed to Day 2: API Routes implementation
