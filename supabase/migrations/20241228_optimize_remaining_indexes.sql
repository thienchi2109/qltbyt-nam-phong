-- =====================================================
-- COMPREHENSIVE INDEX OPTIMIZATION - REMAINING TABLES
-- =====================================================

-- Focus on tables mentioned in code but missing comprehensive indexes:
-- 1. thiet_bi (Equipment) 
-- 2. yeu_cau_sua_chua (Repair Requests)
-- 3. cong_viec_bao_tri (Maintenance Work) - Updated from lich_bao_tri
-- 4. ke_hoach_bao_tri (Maintenance Plans)
-- 5. yeu_cau_luan_chuyen (Transfer Requests)
-- 6. lich_su_thiet_bi (Equipment History)
-- 7. nhan_vien (Staff)

-- This migration creates production-ready indexes with careful consideration for:
-- - Query patterns observed in the codebase
-- - Composite indexes for complex filtering
-- - Text search capabilities
-- - Performance monitoring

-- =====================================================
-- 1. EQUIPMENT INDEXES (thiet_bi)
-- =====================================================

-- Basic single-column indexes for filtering
CREATE INDEX IF NOT EXISTS idx_thiet_bi_ma_thiet_bi
ON thiet_bi (ma_thiet_bi);

CREATE INDEX IF NOT EXISTS idx_thiet_bi_trang_thai
ON thiet_bi (trang_thai);

CREATE INDEX IF NOT EXISTS idx_thiet_bi_phong_ban_id
ON thiet_bi (phong_ban_id);

CREATE INDEX IF NOT EXISTS idx_thiet_bi_loai_thiet_bi
ON thiet_bi (loai_thiet_bi);

CREATE INDEX IF NOT EXISTS idx_thiet_bi_ngay_cap_nhat
ON thiet_bi (ngay_cap_nhat);

CREATE INDEX IF NOT EXISTS idx_thiet_bi_khoa_phong_quan_ly
ON thiet_bi (khoa_phong_quan_ly);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_thiet_bi_status_department
ON thiet_bi (trang_thai, phong_ban_id);

CREATE INDEX IF NOT EXISTS idx_thiet_bi_department_type
ON thiet_bi (phong_ban_id, loai_thiet_bi);

CREATE INDEX IF NOT EXISTS idx_thiet_bi_status_update_date
ON thiet_bi (trang_thai, ngay_cap_nhat DESC);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_thiet_bi_search_text
ON thiet_bi USING gin (
    (setweight(to_tsvector('vietnamese', COALESCE(ma_thiet_bi, '')), 'A') ||
     setweight(to_tsvector('vietnamese', COALESCE(ten_thiet_bi, '')), 'B') ||
     setweight(to_tsvector('vietnamese', COALESCE(mo_ta, '')), 'C'))
);

-- =====================================================
-- 2. REPAIR REQUESTS INDEXES (yeu_cau_sua_chua)
-- =====================================================

-- Core business logic indexes
CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_thiet_bi_id
ON yeu_cau_sua_chua (thiet_bi_id);

CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_trang_thai
ON yeu_cau_sua_chua (trang_thai);

CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_muc_do_uu_tien
ON yeu_cau_sua_chua (muc_do_uu_tien);

CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_ngay_yeu_cau
ON yeu_cau_sua_chua (ngay_yeu_cau);

CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_nguoi_yeu_cau
ON yeu_cau_sua_chua (nguoi_yeu_cau);

-- High-performance composite indexes
CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_equipment_status
ON yeu_cau_sua_chua (thiet_bi_id, trang_thai, ngay_yeu_cau DESC);

CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_status_priority_date
ON yeu_cau_sua_chua (trang_thai, muc_do_uu_tien, ngay_yeu_cau DESC);

-- Text search for problem descriptions
CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_search_text
ON yeu_cau_sua_chua USING gin (
    (setweight(to_tsvector('vietnamese', COALESCE(mo_ta_su_co, '')), 'A') ||
     setweight(to_tsvector('vietnamese', COALESCE(ghi_chu, '')), 'B'))
);

-- =====================================================
-- 3. MAINTENANCE WORK INDEXES (cong_viec_bao_tri)
-- =====================================================

-- Basic indexes for maintenance work
CREATE INDEX IF NOT EXISTS idx_cong_viec_bao_tri_thiet_bi_id
ON cong_viec_bao_tri (thiet_bi_id);

CREATE INDEX IF NOT EXISTS idx_cong_viec_bao_tri_ke_hoach_id
ON cong_viec_bao_tri (ke_hoach_id);

CREATE INDEX IF NOT EXISTS idx_cong_viec_bao_tri_loai_cong_viec
ON cong_viec_bao_tri (loai_cong_viec);

-- Composite indexes for maintenance work queries
CREATE INDEX IF NOT EXISTS idx_cong_viec_bao_tri_equipment_plan
ON cong_viec_bao_tri (thiet_bi_id, ke_hoach_id);

CREATE INDEX IF NOT EXISTS idx_cong_viec_bao_tri_plan_type
ON cong_viec_bao_tri (ke_hoach_id, loai_cong_viec);

-- Text search index for maintenance work
CREATE INDEX IF NOT EXISTS idx_cong_viec_bao_tri_search_text
ON cong_viec_bao_tri USING gin (
    (setweight(to_tsvector('vietnamese', COALESCE(ten_cong_viec, '')), 'A') ||
     setweight(to_tsvector('vietnamese', COALESCE(mo_ta, '')), 'B'))
);

-- =====================================================
-- 4. MAINTENANCE PLANS INDEXES (ke_hoach_bao_tri)
-- =====================================================

-- Essential plan management indexes
CREATE INDEX IF NOT EXISTS idx_ke_hoach_bao_tri_nam
ON ke_hoach_bao_tri (nam);

CREATE INDEX IF NOT EXISTS idx_ke_hoach_bao_tri_trang_thai
ON ke_hoach_bao_tri (trang_thai);

CREATE INDEX IF NOT EXISTS idx_ke_hoach_bao_tri_loai_cong_viec
ON ke_hoach_bao_tri (loai_cong_viec);

CREATE INDEX IF NOT EXISTS idx_ke_hoach_bao_tri_khoa_phong
ON ke_hoach_bao_tri (khoa_phong);

-- Composite indexes for plan filtering
CREATE INDEX IF NOT EXISTS idx_ke_hoach_bao_tri_year_status
ON ke_hoach_bao_tri (nam DESC, trang_thai);

CREATE INDEX IF NOT EXISTS idx_ke_hoach_bao_tri_status_type
ON ke_hoach_bao_tri (trang_thai, loai_cong_viec);

-- =====================================================
-- 5. TRANSFER REQUESTS INDEXES (yeu_cau_luan_chuyen)
-- =====================================================

-- Core transfer request indexes
CREATE INDEX IF NOT EXISTS idx_yeu_cau_luan_chuyen_thiet_bi_id
ON yeu_cau_luan_chuyen (thiet_bi_id);

CREATE INDEX IF NOT EXISTS idx_yeu_cau_luan_chuyen_phong_ban_hien_tai
ON yeu_cau_luan_chuyen (phong_ban_hien_tai);

CREATE INDEX IF NOT EXISTS idx_yeu_cau_luan_chuyen_phong_ban_moi
ON yeu_cau_luan_chuyen (phong_ban_moi);

CREATE INDEX IF NOT EXISTS idx_yeu_cau_luan_chuyen_trang_thai
ON yeu_cau_luan_chuyen (trang_thai);

CREATE INDEX IF NOT EXISTS idx_yeu_cau_luan_chuyen_ngay_yeu_cau
ON yeu_cau_luan_chuyen (ngay_yeu_cau);

-- Composite indexes for transfer workflows
CREATE INDEX IF NOT EXISTS idx_yeu_cau_luan_chuyen_equipment_status
ON yeu_cau_luan_chuyen (thiet_bi_id, trang_thai);

CREATE INDEX IF NOT EXISTS idx_yeu_cau_luan_chuyen_department_transfer
ON yeu_cau_luan_chuyen (phong_ban_hien_tai, phong_ban_moi, trang_thai);

-- =====================================================
-- 6. EQUIPMENT HISTORY INDEXES (lich_su_thiet_bi)
-- =====================================================

-- Equipment history tracking
CREATE INDEX IF NOT EXISTS idx_lich_su_thiet_bi_thiet_bi_id
ON lich_su_thiet_bi (thiet_bi_id);

CREATE INDEX IF NOT EXISTS idx_lich_su_thiet_bi_loai_su_kien
ON lich_su_thiet_bi (loai_su_kien);

CREATE INDEX IF NOT EXISTS idx_lich_su_thiet_bi_ngay_su_kien
ON lich_su_thiet_bi (ngay_su_kien);

-- Composite for equipment timeline queries
CREATE INDEX IF NOT EXISTS idx_lich_su_thiet_bi_equipment_timeline
ON lich_su_thiet_bi (thiet_bi_id, ngay_su_kien DESC);

-- =====================================================
-- 7. STAFF INDEXES (nhan_vien)
-- =====================================================

-- Note: Only using columns that are confirmed to exist in nhan_vien table
-- Department filtering (for role-based access)
CREATE INDEX IF NOT EXISTS idx_nhan_vien_khoa_phong
ON nhan_vien (khoa_phong);

-- Role/position filtering (if chuc_vu column exists)
CREATE INDEX IF NOT EXISTS idx_nhan_vien_chuc_vu
ON nhan_vien (chuc_vu);

-- Text search for staff names
CREATE INDEX IF NOT EXISTS idx_nhan_vien_search_text
ON nhan_vien USING gin (
    (setweight(to_tsvector('vietnamese', COALESCE(ho_ten, '')), 'A') ||
     setweight(to_tsvector('vietnamese', COALESCE(email, '')), 'B'))
);

-- =====================================================
-- 8. PERFORMANCE MONITORING AND ANALYSIS
-- =====================================================

-- Analyze tables to update statistics after index creation
ANALYZE thiet_bi, yeu_cau_sua_chua, ke_hoach_bao_tri, cong_viec_bao_tri, yeu_cau_luan_chuyen, lich_su_thiet_bi, nhan_vien;

-- Create comprehensive monitoring view
CREATE OR REPLACE VIEW index_performance_summary AS
SELECT 
    schemaname,
    tablename,
    indexrelname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelname::regclass)) as index_size,
    CASE
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW'
        WHEN idx_scan < 1000 THEN 'MEDIUM'
        ELSE 'HIGH'
    END as usage_level
FROM pg_stat_user_indexes
WHERE tablename IN ('thiet_bi', 'yeu_cau_sua_chua', 'ke_hoach_bao_tri', 'cong_viec_bao_tri', 'yeu_cau_luan_chuyen', 'lich_su_thiet_bi', 'nhan_vien')
ORDER BY tablename, idx_scan DESC;

-- Index size summary
CREATE OR REPLACE VIEW index_size_summary AS
SELECT 
    tablename,
    COUNT(*) as index_count,
    pg_size_pretty(SUM(pg_relation_size(indexrelname::regclass))) as total_index_size
FROM pg_stat_user_indexes
WHERE tablename IN ('thiet_bi', 'yeu_cau_sua_chua', 'ke_hoach_bao_tri', 'cong_viec_bao_tri', 'yeu_cau_luan_chuyen', 'lich_su_thiet_bi', 'nhan_vien')
GROUP BY tablename
ORDER BY SUM(pg_relation_size(indexrelname::regclass)) DESC;

-- =====================================================
-- 9. INDEX COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON INDEX idx_thiet_bi_search_text IS 'Full-text search index for equipment names and descriptions';
COMMENT ON INDEX idx_yeu_cau_sua_chua_equipment_status IS 'High-performance composite index for repair request queries';
COMMENT ON INDEX idx_cong_viec_bao_tri_equipment_plan IS 'Composite index for maintenance work equipment and plan queries';
COMMENT ON INDEX idx_ke_hoach_bao_tri_year_status IS 'Optimized index for maintenance plan filtering by year and status';
COMMENT ON INDEX idx_yeu_cau_luan_chuyen_department_transfer IS 'Complex composite for transfer request workflow queries';

-- =====================================================
-- 10. PERFORMANCE TEST QUERIES
-- =====================================================

/*
Test these key queries after migration:

-- Equipment searches
SELECT * FROM thiet_bi 
WHERE trang_thai = 'Hoạt động' AND phong_ban_id = 1 
ORDER BY ngay_cap_nhat DESC;

-- Repair request queries
SELECT * FROM yeu_cau_sua_chua 
WHERE thiet_bi_id = 1 AND trang_thai = 'Chờ xử lý' 
ORDER BY ngay_yeu_cau DESC;

-- Maintenance work queries
SELECT * FROM cong_viec_bao_tri
WHERE thiet_bi_id = 1 AND ke_hoach_id = 1;
-- Uses: idx_cong_viec_bao_tri_equipment_plan

-- Maintenance plan filtering
SELECT * FROM ke_hoach_bao_tri 
WHERE nam = 2024 AND trang_thai = 'Đã duyệt'
ORDER BY created_at DESC;

-- Transfer request workflow
SELECT * FROM yeu_cau_luan_chuyen 
WHERE phong_ban_hien_tai = 1 AND phong_ban_moi = 2 AND trang_thai = 'Chờ duyệt';

-- Text search examples
SELECT * FROM thiet_bi 
WHERE to_tsvector('vietnamese', ten_thiet_bi || ' ' || COALESCE(mo_ta, '')) 
@@ plainto_tsquery('vietnamese', 'máy đo huyết áp');

SELECT * FROM yeu_cau_sua_chua 
WHERE to_tsvector('vietnamese', mo_ta_su_co) @@ plainto_tsquery('vietnamese', 'hỏng điện');

-- Staff queries (only using confirmed columns)
SELECT * FROM nhan_vien WHERE khoa_phong = 'Khoa Nội';
SELECT * FROM nhan_vien WHERE ho_ten ILIKE '%Nguyễn%';
*/
