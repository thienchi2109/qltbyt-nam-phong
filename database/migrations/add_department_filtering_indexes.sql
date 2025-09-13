-- Phase 3: Database Indexes for Department Filtering Performance
-- This migration adds optimized indexes for department-based filtering queries

-- =====================================================
-- EQUIPMENT TABLE INDEXES
-- =====================================================

-- 1. Primary index for department filtering on equipment
-- This is the most critical index for equipment filtering by department
CREATE INDEX IF NOT EXISTS idx_thiet_bi_khoa_phong_quan_ly 
ON thiet_bi (khoa_phong_quan_ly) 
WHERE khoa_phong_quan_ly IS NOT NULL;

-- 2. Composite index for department + status filtering
-- Optimizes queries that filter by both department and equipment status
CREATE INDEX IF NOT EXISTS idx_thiet_bi_dept_status 
ON thiet_bi (khoa_phong_quan_ly, tinh_trang_hien_tai) 
WHERE khoa_phong_quan_ly IS NOT NULL;

-- 3. Composite index for department + creation date (for ordering)
-- Optimizes the common pattern of filtering by department and ordering by creation date
CREATE INDEX IF NOT EXISTS idx_thiet_bi_dept_created 
ON thiet_bi (khoa_phong_quan_ly, created_at DESC) 
WHERE khoa_phong_quan_ly IS NOT NULL;

-- 4. Text search index for equipment names and codes within departments
-- Enables fast text search within department-filtered results
-- Using 'simple' configuration for compatibility (works with all PostgreSQL installations)
CREATE INDEX IF NOT EXISTS idx_thiet_bi_dept_search
ON thiet_bi USING gin (
  to_tsvector('simple',
    COALESCE(ten_thiet_bi, '') || ' ' ||
    COALESCE(ma_thiet_bi, '') || ' ' ||
    COALESCE(model, '')
  )
)
WHERE khoa_phong_quan_ly IS NOT NULL;

-- Alternative: Simple trigram index for Vietnamese text (if pg_trgm extension is available)
-- This works better for Vietnamese text and partial matches
-- CREATE INDEX IF NOT EXISTS idx_thiet_bi_dept_trigram
-- ON thiet_bi USING gin (
--   (COALESCE(ten_thiet_bi, '') || ' ' || COALESCE(ma_thiet_bi, '') || ' ' || COALESCE(model, '')) gin_trgm_ops
-- )
-- WHERE khoa_phong_quan_ly IS NOT NULL;

-- =====================================================
-- REPAIR REQUESTS TABLE INDEXES
-- =====================================================

-- 5. Index for repair requests filtering by equipment department
-- Enables fast filtering of repair requests by equipment department
CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_thiet_bi_dept 
ON yeu_cau_sua_chua (thiet_bi_id)
INCLUDE (ngay_yeu_cau, trang_thai);

-- 6. Composite index for repair requests by status and date
-- Optimizes common filtering patterns in repair requests
CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_status_date 
ON yeu_cau_sua_chua (trang_thai, ngay_yeu_cau DESC);

-- =====================================================
-- EMPLOYEE TABLE INDEXES
-- =====================================================

-- 7. Index for user department lookups
-- Optimizes authentication queries that need to fetch user department
CREATE INDEX IF NOT EXISTS idx_nhan_vien_khoa_phong 
ON nhan_vien (khoa_phong) 
WHERE khoa_phong IS NOT NULL;

-- 8. Composite index for user authentication
-- Optimizes login queries
CREATE INDEX IF NOT EXISTS idx_nhan_vien_auth 
ON nhan_vien (username, role, khoa_phong);

-- =====================================================
-- MAINTENANCE & TRANSFER TABLE INDEXES (Future-proofing)
-- =====================================================

-- 9. Index for maintenance plans by department (if applicable)
-- CREATE INDEX IF NOT EXISTS idx_ke_hoach_bao_tri_dept 
-- ON ke_hoach_bao_tri (khoa_phong_quan_ly) 
-- WHERE khoa_phong_quan_ly IS NOT NULL;

-- 10. Index for transfer requests by department (if applicable)
-- CREATE INDEX IF NOT EXISTS idx_yeu_cau_luan_chuyen_dept 
-- ON yeu_cau_luan_chuyen (khoa_phong_hien_tai, khoa_phong_nhan);

-- =====================================================
-- PERFORMANCE MONITORING VIEWS
-- =====================================================

-- Create a view to monitor index usage and performance
CREATE OR REPLACE VIEW v_department_filter_performance AS
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  CASE 
    WHEN idx_scan = 0 THEN 'UNUSED'
    WHEN idx_scan < 100 THEN 'LOW_USAGE'
    WHEN idx_scan < 1000 THEN 'MEDIUM_USAGE'
    ELSE 'HIGH_USAGE'
  END as usage_level
FROM pg_stat_user_indexes 
WHERE indexname LIKE 'idx_%dept%' 
   OR indexname LIKE 'idx_%khoa_phong%'
   OR indexname LIKE 'idx_thiet_bi_%'
   OR indexname LIKE 'idx_yeu_cau_%'
ORDER BY idx_scan DESC;

-- =====================================================
-- QUERY PERFORMANCE ANALYSIS
-- =====================================================

-- Function to analyze department filtering query performance
CREATE OR REPLACE FUNCTION analyze_department_query_performance(
  p_department TEXT DEFAULT NULL
) RETURNS TABLE (
  query_type TEXT,
  execution_time_ms NUMERIC,
  rows_examined BIGINT,
  rows_returned BIGINT,
  index_used TEXT
) AS $$
BEGIN
  -- This function can be used to benchmark department filtering queries
  -- Implementation would depend on specific monitoring requirements
  
  RETURN QUERY
  SELECT 
    'equipment_by_department'::TEXT,
    0::NUMERIC,
    0::BIGINT,
    0::BIGINT,
    'idx_thiet_bi_khoa_phong_quan_ly'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MAINTENANCE COMMANDS
-- =====================================================

-- Commands to maintain index health (run periodically)
-- REINDEX INDEX CONCURRENTLY idx_thiet_bi_khoa_phong_quan_ly;
-- ANALYZE thiet_bi;
-- ANALYZE yeu_cau_sua_chua;
-- ANALYZE nhan_vien;

-- =====================================================
-- ROLLBACK SCRIPT (for emergency use)
-- =====================================================

/*
-- Uncomment to rollback all indexes created by this migration
DROP INDEX IF EXISTS idx_thiet_bi_khoa_phong_quan_ly;
DROP INDEX IF EXISTS idx_thiet_bi_dept_status;
DROP INDEX IF EXISTS idx_thiet_bi_dept_created;
DROP INDEX IF EXISTS idx_thiet_bi_dept_search;
DROP INDEX IF EXISTS idx_yeu_cau_sua_chua_thiet_bi_dept;
DROP INDEX IF EXISTS idx_yeu_cau_sua_chua_status_date;
DROP INDEX IF EXISTS idx_nhan_vien_khoa_phong;
DROP INDEX IF EXISTS idx_nhan_vien_auth;
DROP VIEW IF EXISTS v_department_filter_performance;
DROP FUNCTION IF EXISTS analyze_department_query_performance;
*/
