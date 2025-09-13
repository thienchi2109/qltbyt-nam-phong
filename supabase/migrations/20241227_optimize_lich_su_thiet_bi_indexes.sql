-- =====================================================
-- OPTIMIZE LICH_SU_THIET_BI TABLE INDEXES FOR HISTORY QUERIES
-- =====================================================
-- Comprehensive indexing strategy for equipment history workflows:
-- 1. Equipment detail dialog history display
-- 2. History filtering by event type
-- 3. Date-based history queries
-- 4. Performance optimization for history timeline

-- =====================================================
-- 1. PRIMARY HISTORY INDEXES
-- =====================================================

-- Equipment history filtering and sorting (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_lich_su_thiet_bi_thiet_bi_id
ON lich_su_thiet_bi (thiet_bi_id);

-- Date-based sorting for history timeline
CREATE INDEX IF NOT EXISTS idx_lich_su_thiet_bi_ngay_thuc_hien
ON lich_su_thiet_bi (ngay_thuc_hien);

-- Composite index for equipment history queries with date sorting
-- This is the most important index for equipment detail dialog
CREATE INDEX IF NOT EXISTS idx_lich_su_thiet_bi_equipment_date
ON lich_su_thiet_bi (thiet_bi_id, ngay_thuc_hien DESC);

-- =====================================================
-- 2. EVENT TYPE FILTERING INDEXES
-- =====================================================

-- Event type filtering for history analysis
CREATE INDEX IF NOT EXISTS idx_lich_su_thiet_bi_loai_su_kien
ON lich_su_thiet_bi (loai_su_kien);

-- Composite index for event type and date filtering
CREATE INDEX IF NOT EXISTS idx_lich_su_thiet_bi_event_date
ON lich_su_thiet_bi (loai_su_kien, ngay_thuc_hien DESC);

-- =====================================================
-- 3. REQUEST TRACKING INDEXES
-- =====================================================

-- Request ID tracking for linking history to specific requests
CREATE INDEX IF NOT EXISTS idx_lich_su_thiet_bi_yeu_cau_id
ON lich_su_thiet_bi (yeu_cau_id)
WHERE yeu_cau_id IS NOT NULL;

-- Note: nguoi_thuc_hien_id column does not exist in lich_su_thiet_bi table
-- Table structure: id, thiet_bi_id, ngay_thuc_hien, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id

-- =====================================================
-- 4. PERFORMANCE MONITORING
-- =====================================================

-- Create view to monitor index usage
CREATE OR REPLACE VIEW lich_su_thiet_bi_index_usage AS
SELECT
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes
WHERE relname = 'lich_su_thiet_bi'
ORDER BY idx_scan DESC;

-- =====================================================
-- 5. INDEX COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON INDEX idx_lich_su_thiet_bi_equipment_date IS 'Primary composite index for equipment history queries with date sorting';
COMMENT ON INDEX idx_lich_su_thiet_bi_event_date IS 'Composite index for event type and date filtering';
COMMENT ON INDEX idx_lich_su_thiet_bi_yeu_cau_id IS 'Partial index for request tracking (excludes NULL values)';
COMMENT ON VIEW lich_su_thiet_bi_index_usage IS 'Monitor index usage statistics for lich_su_thiet_bi table';

-- =====================================================
-- 6. USAGE EXAMPLES
-- =====================================================

/*
Common query patterns that will benefit from these indexes:

1. Equipment History Display (Equipment Detail Dialog):
   SELECT * FROM lich_su_thiet_bi
   WHERE thiet_bi_id = 123
   ORDER BY ngay_thuc_hien DESC
   -- Uses: idx_lich_su_thiet_bi_equipment_date

2. History by Event Type:
   SELECT * FROM lich_su_thiet_bi
   WHERE loai_su_kien = 'Luân chuyển'
   ORDER BY ngay_thuc_hien DESC
   -- Uses: idx_lich_su_thiet_bi_event_date

3. Equipment Transfer History:
   SELECT * FROM lich_su_thiet_bi
   WHERE thiet_bi_id = 123 AND loai_su_kien = 'Luân chuyển'
   ORDER BY ngay_thuc_hien DESC
   -- Uses: idx_lich_su_thiet_bi_equipment_date

4. Recent History Across All Equipment:
   SELECT * FROM lich_su_thiet_bi
   WHERE ngay_thuc_hien >= CURRENT_DATE - INTERVAL '30 days'
   ORDER BY ngay_thuc_hien DESC
   -- Uses: idx_lich_su_thiet_bi_ngay_thuc_hien

5. Request History Tracking:
   SELECT * FROM lich_su_thiet_bi
   WHERE yeu_cau_id = 456
   -- Uses: idx_lich_su_thiet_bi_yeu_cau_id

6. Event Type Analysis:
   SELECT loai_su_kien, COUNT(*)
   FROM lich_su_thiet_bi
   GROUP BY loai_su_kien
   -- Uses: idx_lich_su_thiet_bi_loai_su_kien

*/

-- =====================================================
-- 7. PERFORMANCE RECOMMENDATIONS
-- =====================================================

/*
Performance recommendations for lich_su_thiet_bi queries:

1. Always include thiet_bi_id in WHERE clause when querying specific equipment history
2. Use ORDER BY ngay_thuc_hien DESC for chronological sorting (matches index order)
3. Consider LIMIT clauses for large history datasets
4. Use partial indexes for optional fields (yeu_cau_id)
5. Monitor index usage with lich_su_thiet_bi_index_usage view
6. Consider archiving old history records if table grows too large

Index maintenance:
- VACUUM ANALYZE lich_su_thiet_bi regularly
- Monitor index bloat and rebuild if necessary
- Review query plans periodically with EXPLAIN ANALYZE

*/
