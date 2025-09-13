-- Phase 3: Simplified Database Indexes for Department Filtering
-- Compatible with all PostgreSQL versions and Supabase

-- =====================================================
-- CORE INDEXES FOR DEPARTMENT FILTERING
-- =====================================================

-- 1. Primary index for equipment department filtering (MOST IMPORTANT)
CREATE INDEX IF NOT EXISTS idx_thiet_bi_khoa_phong_quan_ly 
ON thiet_bi (khoa_phong_quan_ly) 
WHERE khoa_phong_quan_ly IS NOT NULL;

-- 2. Composite index for equipment department + status
CREATE INDEX IF NOT EXISTS idx_thiet_bi_dept_status 
ON thiet_bi (khoa_phong_quan_ly, tinh_trang_hien_tai) 
WHERE khoa_phong_quan_ly IS NOT NULL;

-- 3. Composite index for equipment department + creation date (for ordering)
CREATE INDEX IF NOT EXISTS idx_thiet_bi_dept_created 
ON thiet_bi (khoa_phong_quan_ly, created_at DESC) 
WHERE khoa_phong_quan_ly IS NOT NULL;

-- =====================================================
-- REPAIR REQUESTS INDEXES
-- =====================================================

-- 4. Index for repair requests by equipment (enables department filtering via JOIN)
CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_thiet_bi_id 
ON yeu_cau_sua_chua (thiet_bi_id);

-- 5. Composite index for repair requests by status and date
CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_status_date 
ON yeu_cau_sua_chua (trang_thai, ngay_yeu_cau DESC);

-- =====================================================
-- USER/EMPLOYEE INDEXES
-- =====================================================

-- 6. Index for user department lookups (for authentication)
CREATE INDEX IF NOT EXISTS idx_nhan_vien_khoa_phong 
ON nhan_vien (khoa_phong) 
WHERE khoa_phong IS NOT NULL;

-- 7. Composite index for user authentication
CREATE INDEX IF NOT EXISTS idx_nhan_vien_username_role 
ON nhan_vien (username, role);

-- =====================================================
-- SEARCH OPTIMIZATION (Simple approach)
-- =====================================================

-- 8. Simple indexes for text search (works with ILIKE queries)
CREATE INDEX IF NOT EXISTS idx_thiet_bi_ten_thiet_bi_lower 
ON thiet_bi (LOWER(ten_thiet_bi)) 
WHERE ten_thiet_bi IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_thiet_bi_ma_thiet_bi_lower 
ON thiet_bi (LOWER(ma_thiet_bi)) 
WHERE ma_thiet_bi IS NOT NULL;

-- =====================================================
-- PERFORMANCE MONITORING
-- =====================================================

-- Create a simple view to monitor index usage
CREATE OR REPLACE VIEW v_department_index_usage AS
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  CASE 
    WHEN idx_scan = 0 THEN 'UNUSED'
    WHEN idx_scan < 100 THEN 'LOW'
    WHEN idx_scan < 1000 THEN 'MEDIUM'
    ELSE 'HIGH'
  END as usage_level
FROM pg_stat_user_indexes 
WHERE indexname LIKE 'idx_thiet_bi_%' 
   OR indexname LIKE 'idx_yeu_cau_%'
   OR indexname LIKE 'idx_nhan_vien_%'
ORDER BY idx_scan DESC;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Query to verify indexes were created successfully
-- Run this after executing the migration
/*
SELECT 
  indexname,
  tablename,
  indexdef
FROM pg_indexes 
WHERE indexname LIKE 'idx_thiet_bi_%' 
   OR indexname LIKE 'idx_yeu_cau_%'
   OR indexname LIKE 'idx_nhan_vien_%'
ORDER BY tablename, indexname;
*/

-- =====================================================
-- PERFORMANCE TEST QUERIES
-- =====================================================

-- Test department filtering performance
-- Replace 'Khoa Nội' with actual department name
/*
EXPLAIN ANALYZE 
SELECT * FROM thiet_bi 
WHERE khoa_phong_quan_ly = 'Khoa Nội' 
ORDER BY created_at DESC;

EXPLAIN ANALYZE 
SELECT yc.*, tb.ten_thiet_bi, tb.ma_thiet_bi 
FROM yeu_cau_sua_chua yc
JOIN thiet_bi tb ON yc.thiet_bi_id = tb.id
WHERE tb.khoa_phong_quan_ly = 'Khoa Nội'
ORDER BY yc.ngay_yeu_cau DESC;
*/

-- =====================================================
-- MAINTENANCE COMMANDS
-- =====================================================

-- Run these periodically to maintain index health
/*
-- Update table statistics (important for query planning)
ANALYZE thiet_bi;
ANALYZE yeu_cau_sua_chua;
ANALYZE nhan_vien;

-- Check for unused indexes (run after system has been in use)
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes 
WHERE idx_scan = 0 
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
*/

-- =====================================================
-- ROLLBACK SCRIPT
-- =====================================================

/*
-- Uncomment and run to remove all indexes created by this migration
DROP INDEX IF EXISTS idx_thiet_bi_khoa_phong_quan_ly;
DROP INDEX IF EXISTS idx_thiet_bi_dept_status;
DROP INDEX IF EXISTS idx_thiet_bi_dept_created;
DROP INDEX IF EXISTS idx_yeu_cau_sua_chua_thiet_bi_id;
DROP INDEX IF EXISTS idx_yeu_cau_sua_chua_status_date;
DROP INDEX IF EXISTS idx_nhan_vien_khoa_phong;
DROP INDEX IF EXISTS idx_nhan_vien_username_role;
DROP INDEX IF EXISTS idx_thiet_bi_ten_thiet_bi_lower;
DROP INDEX IF EXISTS idx_thiet_bi_ma_thiet_bi_lower;
DROP VIEW IF EXISTS v_department_index_usage;
*/

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Department filtering indexes created successfully!';
  RAISE NOTICE 'Run ANALYZE on tables to update statistics.';
  RAISE NOTICE 'Check v_department_index_usage view to monitor performance.';
END $$;
