-- Simple Database Readiness Check for Department Filtering
-- This version avoids complex syntax that might cause issues

-- =====================================================
-- CHECK 1: VERIFY REQUIRED TABLES EXIST
-- =====================================================

-- Check thiet_bi table
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'thiet_bi') 
    THEN 'SUCCESS: thiet_bi table exists'
    ELSE 'ERROR: thiet_bi table missing'
  END as table_check;

-- Check yeu_cau_sua_chua table  
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'yeu_cau_sua_chua') 
    THEN 'SUCCESS: yeu_cau_sua_chua table exists'
    ELSE 'ERROR: yeu_cau_sua_chua table missing'
  END as table_check;

-- Check nhan_vien table
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nhan_vien') 
    THEN 'SUCCESS: nhan_vien table exists'
    ELSE 'ERROR: nhan_vien table missing'
  END as table_check;

-- =====================================================
-- CHECK 2: VERIFY REQUIRED COLUMNS EXIST
-- =====================================================

-- Check thiet_bi columns
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thiet_bi' AND column_name = 'khoa_phong_quan_ly') 
    THEN 'SUCCESS: thiet_bi.khoa_phong_quan_ly exists'
    ELSE 'ERROR: thiet_bi.khoa_phong_quan_ly missing'
  END as column_check;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thiet_bi' AND column_name = 'created_at') 
    THEN 'SUCCESS: thiet_bi.created_at exists'
    ELSE 'ERROR: thiet_bi.created_at missing'
  END as column_check;

-- Check yeu_cau_sua_chua columns
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'yeu_cau_sua_chua' AND column_name = 'thiet_bi_id') 
    THEN 'SUCCESS: yeu_cau_sua_chua.thiet_bi_id exists'
    ELSE 'ERROR: yeu_cau_sua_chua.thiet_bi_id missing'
  END as column_check;

-- Check nhan_vien columns
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'nhan_vien' AND column_name = 'khoa_phong') 
    THEN 'SUCCESS: nhan_vien.khoa_phong exists'
    ELSE 'ERROR: nhan_vien.khoa_phong missing'
  END as column_check;

-- =====================================================
-- CHECK 3: DATA COUNTS
-- =====================================================

-- Count total equipment
SELECT 
  'Equipment total count' as metric,
  COUNT(*) as value
FROM thiet_bi;

-- Count equipment with department
SELECT 
  'Equipment with department' as metric,
  COUNT(*) as value
FROM thiet_bi 
WHERE khoa_phong_quan_ly IS NOT NULL;

-- Count total users
SELECT 
  'Users total count' as metric,
  COUNT(*) as value
FROM nhan_vien;

-- Count users with department
SELECT 
  'Users with department' as metric,
  COUNT(*) as value
FROM nhan_vien 
WHERE khoa_phong IS NOT NULL;

-- Count repair requests
SELECT 
  'Repair requests total' as metric,
  COUNT(*) as value
FROM yeu_cau_sua_chua;

-- =====================================================
-- CHECK 4: SAMPLE DEPARTMENT VALUES
-- =====================================================

-- Top equipment departments
SELECT 
  'Equipment Department' as type,
  khoa_phong_quan_ly as department,
  COUNT(*) as equipment_count
FROM thiet_bi 
WHERE khoa_phong_quan_ly IS NOT NULL
GROUP BY khoa_phong_quan_ly
ORDER BY COUNT(*) DESC
LIMIT 5;

-- Top user departments
SELECT 
  'User Department' as type,
  khoa_phong as department,
  COUNT(*) as user_count
FROM nhan_vien 
WHERE khoa_phong IS NOT NULL
GROUP BY khoa_phong
ORDER BY COUNT(*) DESC
LIMIT 5;

-- =====================================================
-- CHECK 5: EXISTING INDEXES
-- =====================================================

-- Check for existing relevant indexes
SELECT 
  'Existing Index' as type,
  indexname as name,
  tablename as table_name
FROM pg_indexes 
WHERE tablename IN ('thiet_bi', 'yeu_cau_sua_chua', 'nhan_vien')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- =====================================================
-- CHECK 6: PERMISSIONS TEST
-- =====================================================

-- Test if we can create/drop indexes (this is safe)
CREATE INDEX IF NOT EXISTS test_permission_check ON thiet_bi (id);
DROP INDEX IF EXISTS test_permission_check;

SELECT 'SUCCESS: User has permission to create/drop indexes' as permission_check;

-- =====================================================
-- SUMMARY MESSAGE
-- =====================================================

SELECT 
  '=== DATABASE READINESS CHECK COMPLETE ===' as summary,
  'Review the results above. If you see SUCCESS messages, you can proceed with index creation.' as next_step;
