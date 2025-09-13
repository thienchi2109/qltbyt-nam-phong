-- =====================================================
-- OPTIMIZE ROLE-BASED EQUIPMENT FILTERING PERFORMANCE
-- =====================================================
-- This migration adds indexes specifically for role-based access control
-- filtering on the thiet_bi table, focusing on department-based filtering
-- with fuzzy matching support.

-- =====================================================
-- 1. FUZZY DEPARTMENT MATCHING INDEX
-- =====================================================

-- GIN index for fuzzy department matching using ILIKE queries
-- This supports the role-based filtering where users see equipment
-- from their department using partial/fuzzy matching
CREATE INDEX IF NOT EXISTS idx_thiet_bi_khoa_phong_quan_ly_fuzzy
ON thiet_bi USING gin (khoa_phong_quan_ly gin_trgm_ops);

-- =====================================================
-- 2. ROLE-BASED COMPOSITE INDEXES
-- =====================================================

-- Composite index for department + search queries
-- This optimizes queries that filter by department AND search text
-- Common in role-based equipment browsing with search
CREATE INDEX IF NOT EXISTS idx_thiet_bi_dept_search
ON thiet_bi USING gin (
  (khoa_phong_quan_ly || ' ' || ten_thiet_bi || ' ' || ma_thiet_bi) gin_trgm_ops
);

-- =====================================================
-- 3. PERFORMANCE MONITORING
-- =====================================================

-- Add comments for documentation
COMMENT ON INDEX idx_thiet_bi_khoa_phong_quan_ly_fuzzy IS 'GIN index for fuzzy department matching in role-based access control';
COMMENT ON INDEX idx_thiet_bi_dept_search IS 'Composite GIN index for department-filtered equipment search';

-- =====================================================
-- 4. QUERY OPTIMIZATION EXAMPLES
-- =====================================================

/*
OPTIMIZED QUERIES WITH NEW INDEXES:

1. Role-based department filtering (fuzzy match):
   SELECT * FROM thiet_bi 
   WHERE khoa_phong_quan_ly ILIKE '%Khoa Nội%'
   -- Uses: idx_thiet_bi_khoa_phong_quan_ly_fuzzy

2. Role-based department filtering with search:
   SELECT * FROM thiet_bi 
   WHERE khoa_phong_quan_ly ILIKE '%Khoa Nội%'
   AND (ten_thiet_bi ILIKE '%máy%' OR ma_thiet_bi ILIKE '%TB001%')
   -- Uses: idx_thiet_bi_dept_search

3. Admin/manager queries (no department filter):
   SELECT * FROM thiet_bi 
   WHERE ten_thiet_bi ILIKE '%máy%' OR ma_thiet_bi ILIKE '%TB001%'
   -- Uses: existing idx_thiet_bi_search_text

4. Department + status filtering:
   SELECT * FROM thiet_bi 
   WHERE khoa_phong_quan_ly ILIKE '%Khoa Nội%'
   AND tinh_trang_hien_tai = 'Hoạt động bình thường'
   -- Uses: existing idx_thiet_bi_dept_status (for exact matches)
   -- Uses: idx_thiet_bi_khoa_phong_quan_ly_fuzzy (for fuzzy matches)
*/

-- =====================================================
-- 5. INDEX USAGE MONITORING
-- =====================================================

-- Create view to monitor role-based filtering performance
CREATE OR REPLACE VIEW role_based_filtering_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes 
WHERE tablename = 'thiet_bi' 
AND indexname IN (
    'idx_thiet_bi_khoa_phong_quan_ly',
    'idx_thiet_bi_khoa_phong_quan_ly_fuzzy',
    'idx_thiet_bi_dept_search',
    'idx_thiet_bi_search_text'
)
ORDER BY idx_scan DESC;

COMMENT ON VIEW role_based_filtering_stats IS 'Monitor index usage for role-based equipment filtering queries';
