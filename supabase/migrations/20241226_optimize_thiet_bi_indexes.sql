-- =====================================================
-- OPTIMIZE THIET_BI TABLE INDEXES FOR SEARCH PERFORMANCE
-- =====================================================
-- Comprehensive indexing strategy for equipment search workflows:
-- 1. Repair requests equipment search
-- 2. Maintenance planning equipment search
-- 3. Equipment catalog filtering and search
-- 4. QR scanner equipment lookup
-- 5. Dashboard equipment status queries
-- 6. Reports and analytics queries

-- =====================================================
-- 0. ENABLE REQUIRED EXTENSIONS FIRST
-- =====================================================

-- Enable pg_trgm extension for fuzzy text search (MUST BE FIRST)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- 1. PRIMARY SEARCH INDEXES
-- =====================================================

-- Composite index for text search (ten_thiet_bi + ma_thiet_bi)
-- Supports ILIKE queries with % wildcards
CREATE INDEX IF NOT EXISTS idx_thiet_bi_search_text
ON thiet_bi USING gin (
  (ten_thiet_bi || ' ' || ma_thiet_bi) gin_trgm_ops
);

-- Individual text search indexes for specific field searches
CREATE INDEX IF NOT EXISTS idx_thiet_bi_ten_thiet_bi_trgm
ON thiet_bi USING gin (ten_thiet_bi gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_thiet_bi_ma_thiet_bi_trgm
ON thiet_bi USING gin (ma_thiet_bi gin_trgm_ops);

-- Exact match index for QR scanner (ma_thiet_bi exact lookup)
-- NOTE: SKIPPED - thiet_bi_ma_thiet_bi_key already exists as UNIQUE constraint
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_thiet_bi_ma_thiet_bi_exact
-- ON thiet_bi (ma_thiet_bi);

-- =====================================================
-- 2. FILTERING AND GROUPING INDEXES
-- =====================================================

-- Department/location filtering (most common filters)
CREATE INDEX IF NOT EXISTS idx_thiet_bi_khoa_phong_quan_ly
ON thiet_bi (khoa_phong_quan_ly);

CREATE INDEX IF NOT EXISTS idx_thiet_bi_vi_tri_lap_dat
ON thiet_bi (vi_tri_lap_dat);

-- Equipment status filtering (dashboard and reports)
CREATE INDEX IF NOT EXISTS idx_thiet_bi_tinh_trang_hien_tai
ON thiet_bi (tinh_trang_hien_tai);

-- =====================================================
-- 3. COMPOSITE INDEXES FOR COMPLEX QUERIES
-- =====================================================

-- Department + Status filtering (common in reports)
CREATE INDEX IF NOT EXISTS idx_thiet_bi_dept_status
ON thiet_bi (khoa_phong_quan_ly, tinh_trang_hien_tai);

-- Location + Status filtering
CREATE INDEX IF NOT EXISTS idx_thiet_bi_location_status
ON thiet_bi (vi_tri_lap_dat, tinh_trang_hien_tai);

-- Equipment type + department filtering
-- NOTE: SKIPPED - loai_thiet_bi_id column does not exist in current schema
-- CREATE INDEX IF NOT EXISTS idx_thiet_bi_type_dept
-- ON thiet_bi (loai_thiet_bi_id, khoa_phong_quan_ly)
-- WHERE loai_thiet_bi_id IS NOT NULL;

-- =====================================================
-- 4. MAINTENANCE WORKFLOW INDEXES
-- =====================================================

-- Maintenance date filtering and sorting (including NULL for complete coverage)
CREATE INDEX IF NOT EXISTS idx_thiet_bi_ngay_bt_tiep_theo
ON thiet_bi (ngay_bt_tiep_theo);

-- Equipment status and maintenance date composite (supports all status filtering)
CREATE INDEX IF NOT EXISTS idx_thiet_bi_status_maintenance
ON thiet_bi (tinh_trang_hien_tai, ngay_bt_tiep_theo);

-- =====================================================
-- 5. TEMPORAL AND AUDIT INDEXES
-- =====================================================

-- Date-based filtering for reports
CREATE INDEX IF NOT EXISTS idx_thiet_bi_ngay_nhap
ON thiet_bi (ngay_nhap);

CREATE INDEX IF NOT EXISTS idx_thiet_bi_ngay_dua_vao_su_dung
ON thiet_bi (ngay_dua_vao_su_dung);

-- =====================================================
-- 6. EQUIPMENT HISTORY INDEXES
-- =====================================================

-- Equipment history filtering and sorting
CREATE INDEX IF NOT EXISTS idx_lich_su_thiet_bi_thiet_bi_id
ON lich_su_thiet_bi (thiet_bi_id);

CREATE INDEX IF NOT EXISTS idx_lich_su_thiet_bi_ngay_thuc_hien
ON lich_su_thiet_bi (ngay_thuc_hien);

-- Composite index for equipment history queries (most common pattern)
CREATE INDEX IF NOT EXISTS idx_lich_su_thiet_bi_equipment_date
ON lich_su_thiet_bi (thiet_bi_id, ngay_thuc_hien DESC);

-- Event type filtering for history
CREATE INDEX IF NOT EXISTS idx_lich_su_thiet_bi_loai_su_kien
ON lich_su_thiet_bi (loai_su_kien);

-- Audit trail indexes
-- NOTE: SKIPPED - created_at/updated_at columns may not exist in current schema
-- CREATE INDEX IF NOT EXISTS idx_thiet_bi_created_at
-- ON thiet_bi (created_at);
-- CREATE INDEX IF NOT EXISTS idx_thiet_bi_updated_at
-- ON thiet_bi (updated_at);

-- =====================================================
-- 6. FOREIGN KEY RELATIONSHIP INDEXES
-- =====================================================

-- Foreign key indexes for JOINs
-- NOTE: SKIPPED - phong_ban_id and loai_thiet_bi_id columns do not exist in current schema
-- CREATE INDEX IF NOT EXISTS idx_thiet_bi_phong_ban_id
-- ON thiet_bi (phong_ban_id)
-- WHERE phong_ban_id IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_thiet_bi_loai_thiet_bi_id
-- ON thiet_bi (loai_thiet_bi_id)
-- WHERE loai_thiet_bi_id IS NOT NULL;

-- =====================================================
-- 7. SPECIALIZED WORKFLOW INDEXES
-- =====================================================

-- Equipment value/cost analysis (including NULL and 0 values for complete coverage)
CREATE INDEX IF NOT EXISTS idx_thiet_bi_gia_goc
ON thiet_bi (gia_goc);

-- Warranty tracking (including NULL for equipment without warranty info)
CREATE INDEX IF NOT EXISTS idx_thiet_bi_han_bao_hanh
ON thiet_bi (han_bao_hanh);

-- Manufacturing year analysis (including NULL for unknown manufacturing year)
CREATE INDEX IF NOT EXISTS idx_thiet_bi_nam_san_xuat
ON thiet_bi (nam_san_xuat);

-- =====================================================
-- 8. EXTENSION ALREADY ENABLED ABOVE
-- =====================================================

-- pg_trgm extension already enabled at the beginning of this script

-- =====================================================
-- 9. PERFORMANCE MONITORING VIEWS
-- =====================================================

-- Create view to monitor index usage
CREATE OR REPLACE VIEW thiet_bi_index_usage AS
SELECT
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW_USAGE'
        WHEN idx_scan < 1000 THEN 'MEDIUM_USAGE'
        ELSE 'HIGH_USAGE'
    END as usage_level
FROM pg_stat_user_indexes
WHERE relname = 'thiet_bi'
ORDER BY idx_scan DESC;

-- =====================================================
-- 10. COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON INDEX idx_thiet_bi_search_text IS 'Composite GIN index for full-text search on equipment name and code';
-- COMMENT ON INDEX idx_thiet_bi_ma_thiet_bi_exact IS 'B-tree index for exact QR code lookups'; -- SKIPPED - using existing unique constraint
COMMENT ON INDEX idx_thiet_bi_dept_status IS 'Composite index for department and status filtering';
COMMENT ON INDEX idx_thiet_bi_status_maintenance IS 'Composite index for status and maintenance date filtering';
COMMENT ON INDEX idx_lich_su_thiet_bi_equipment_date IS 'Composite index for equipment history queries with date sorting';
COMMENT ON VIEW thiet_bi_index_usage IS 'Monitor index usage statistics for thiet_bi table';

-- =====================================================
-- 11. QUERY OPTIMIZATION HINTS
-- =====================================================

/*
USAGE EXAMPLES:

1. Equipment Search (Repair Requests, Maintenance):
   SELECT * FROM thiet_bi
   WHERE ten_thiet_bi ILIKE '%keyword%' OR ma_thiet_bi ILIKE '%keyword%'
   -- Uses: idx_thiet_bi_search_text

2. QR Scanner Lookup:
   SELECT * FROM thiet_bi WHERE ma_thiet_bi = 'TB001'
   -- Uses: idx_thiet_bi_ma_thiet_bi_exact

3. Department Filtering:
   SELECT * FROM thiet_bi WHERE khoa_phong_quan_ly = 'Khoa Nội'
   -- Uses: idx_thiet_bi_khoa_phong_quan_ly

4. Dashboard Attention Query:
   SELECT * FROM thiet_bi
   WHERE tinh_trang_hien_tai IN ('Chờ sửa chữa', 'Chờ bảo trì')
   ORDER BY ngay_bt_tiep_theo
   -- Uses: idx_thiet_bi_status_maintenance

5. All Equipment Status Analysis:
   SELECT tinh_trang_hien_tai, COUNT(*) FROM thiet_bi
   GROUP BY tinh_trang_hien_tai
   -- Uses: idx_thiet_bi_tinh_trang_hien_tai

5. Complex Filtering:
   SELECT * FROM thiet_bi
   WHERE khoa_phong_quan_ly = 'Khoa Ngoại'
   AND tinh_trang_hien_tai = 'Hoạt động bình thường'
   -- Uses: idx_thiet_bi_dept_status

6. Real-time Search (as-you-type):
   SELECT id, ma_thiet_bi, ten_thiet_bi
   FROM thiet_bi
   WHERE ten_thiet_bi ILIKE '%search_term%'
   LIMIT 10
   -- Uses: idx_thiet_bi_ten_thiet_bi_trgm

7. Maintenance Planning:
   SELECT * FROM thiet_bi
   WHERE tinh_trang_hien_tai = 'Hoạt động bình thường'
   AND ngay_bt_tiep_theo <= CURRENT_DATE + INTERVAL '30 days'
   ORDER BY ngay_bt_tiep_theo
   -- Uses: idx_thiet_bi_status_maintenance

8. Equipment Reports by Value:
   SELECT * FROM thiet_bi
   WHERE gia_goc > 100000000
   ORDER BY gia_goc DESC NULLS LAST
   -- Uses: idx_thiet_bi_gia_goc

9. Equipment with No Value (NULL or 0):
   SELECT * FROM thiet_bi
   WHERE gia_goc IS NULL OR gia_goc = 0
   -- Uses: idx_thiet_bi_gia_goc

10. Equipment History Query (Equipment Detail Dialog):
    SELECT * FROM lich_su_thiet_bi
    WHERE thiet_bi_id = 123
    ORDER BY ngay_thuc_hien DESC
    -- Uses: idx_lich_su_thiet_bi_equipment_date

11. History by Event Type:
    SELECT * FROM lich_su_thiet_bi
    WHERE loai_su_kien = 'Luân chuyển'
    ORDER BY ngay_thuc_hien DESC
    -- Uses: idx_lich_su_thiet_bi_loai_su_kien
*/

-- =====================================================
-- 12. PERFORMANCE RECOMMENDATIONS
-- =====================================================

/*
PERFORMANCE TIPS:

1. Use LIMIT for search results to prevent large result sets
2. Consider using OFFSET with caution - use cursor-based pagination instead
3. Use specific field searches when possible (ma_thiet_bi vs full-text)
4. Monitor index usage with thiet_bi_index_usage view
5. Consider partial indexes for frequently filtered subsets
6. Use EXPLAIN ANALYZE to verify index usage in queries

MAINTENANCE:

1. Run ANALYZE thiet_bi; after bulk data changes
2. Monitor index bloat and rebuild if necessary
3. Review unused indexes periodically
4. Update statistics regularly for optimal query planning
*/
