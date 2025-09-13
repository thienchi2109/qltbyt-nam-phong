-- Minimal Database Indexes for Department Filtering
-- This script creates only the essential indexes with simple syntax

-- =====================================================
-- STEP 1: CREATE PRIMARY DEPARTMENT INDEX
-- =====================================================

-- Most important index for department filtering
CREATE INDEX IF NOT EXISTS idx_thiet_bi_khoa_phong_quan_ly 
ON thiet_bi (khoa_phong_quan_ly);

SELECT 'Created: idx_thiet_bi_khoa_phong_quan_ly' as status;

-- =====================================================
-- STEP 2: CREATE COMPOSITE INDEXES
-- =====================================================

-- Department + status for filtered views
CREATE INDEX IF NOT EXISTS idx_thiet_bi_dept_status 
ON thiet_bi (khoa_phong_quan_ly, tinh_trang_hien_tai);

SELECT 'Created: idx_thiet_bi_dept_status' as status;

-- Department + creation date for ordering
CREATE INDEX IF NOT EXISTS idx_thiet_bi_dept_created 
ON thiet_bi (khoa_phong_quan_ly, created_at);

SELECT 'Created: idx_thiet_bi_dept_created' as status;

-- =====================================================
-- STEP 3: CREATE REPAIR REQUEST INDEXES
-- =====================================================

-- Equipment ID for joining repair requests
CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_thiet_bi_id 
ON yeu_cau_sua_chua (thiet_bi_id);

SELECT 'Created: idx_yeu_cau_sua_chua_thiet_bi_id' as status;

-- Status and date for repair request filtering
CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_status_date 
ON yeu_cau_sua_chua (trang_thai, ngay_yeu_cau);

SELECT 'Created: idx_yeu_cau_sua_chua_status_date' as status;

-- =====================================================
-- STEP 4: CREATE USER/EMPLOYEE INDEXES
-- =====================================================

-- User department for authentication filtering
CREATE INDEX IF NOT EXISTS idx_nhan_vien_khoa_phong 
ON nhan_vien (khoa_phong);

SELECT 'Created: idx_nhan_vien_khoa_phong' as status;

-- Username and role for authentication
CREATE INDEX IF NOT EXISTS idx_nhan_vien_username_role 
ON nhan_vien (username, role);

SELECT 'Created: idx_nhan_vien_username_role' as status;

-- =====================================================
-- STEP 5: CREATE SEARCH INDEXES (SIMPLE)
-- =====================================================

-- Equipment name search (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_thiet_bi_ten_lower 
ON thiet_bi (LOWER(ten_thiet_bi));

SELECT 'Created: idx_thiet_bi_ten_lower' as status;

-- Equipment code search (case-insensitive)  
CREATE INDEX IF NOT EXISTS idx_thiet_bi_ma_lower 
ON thiet_bi (LOWER(ma_thiet_bi));

SELECT 'Created: idx_thiet_bi_ma_lower' as status;

-- =====================================================
-- STEP 6: VERIFY INDEX CREATION
-- =====================================================

-- List all indexes we just created
SELECT 
  'Index Verification' as check_type,
  indexname as index_name,
  tablename as table_name
FROM pg_indexes 
WHERE indexname IN (
  'idx_thiet_bi_khoa_phong_quan_ly',
  'idx_thiet_bi_dept_status', 
  'idx_thiet_bi_dept_created',
  'idx_yeu_cau_sua_chua_thiet_bi_id',
  'idx_yeu_cau_sua_chua_status_date',
  'idx_nhan_vien_khoa_phong',
  'idx_nhan_vien_username_role',
  'idx_thiet_bi_ten_lower',
  'idx_thiet_bi_ma_lower'
)
ORDER BY tablename, indexname;

-- =====================================================
-- STEP 7: SUCCESS MESSAGE
-- =====================================================

SELECT 
  '=== INDEX CREATION COMPLETE ===' as summary,
  'Run ANALYZE on tables to update statistics' as next_step_1,
  'Test department filtering queries' as next_step_2;

-- =====================================================
-- RECOMMENDED NEXT STEPS
-- =====================================================

/*
-- Run these commands after index creation:

-- Update table statistics
ANALYZE thiet_bi;
ANALYZE yeu_cau_sua_chua;
ANALYZE nhan_vien;

-- Test department filtering performance
-- Replace 'Your_Department_Name' with actual department
EXPLAIN ANALYZE 
SELECT * FROM thiet_bi 
WHERE khoa_phong_quan_ly = 'Your_Department_Name' 
ORDER BY created_at DESC 
LIMIT 100;

-- Test repair request filtering
EXPLAIN ANALYZE 
SELECT yc.*, tb.ten_thiet_bi 
FROM yeu_cau_sua_chua yc
JOIN thiet_bi tb ON yc.thiet_bi_id = tb.id
WHERE tb.khoa_phong_quan_ly = 'Your_Department_Name'
ORDER BY yc.ngay_yeu_cau DESC 
LIMIT 100;
*/
