-- Database Readiness Check for Department Filtering
-- Run this script first to verify your database is ready for the indexes

-- =====================================================
-- CHECK REQUIRED TABLES EXIST
-- =====================================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  -- Check if required tables exist
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name IN ('thiet_bi', 'yeu_cau_sua_chua', 'nhan_vien');
  
  IF table_count = 3 THEN
    RAISE NOTICE 'SUCCESS: All required tables exist (thiet_bi, yeu_cau_sua_chua, nhan_vien)';
  ELSE
    RAISE WARNING 'WARNING: Missing required tables. Found % out of 3 tables.', table_count;
  END IF;
END $$;

-- =====================================================
-- CHECK REQUIRED COLUMNS EXIST
-- =====================================================

DO $$
DECLARE
  column_count INTEGER;
BEGIN
  -- Check thiet_bi table columns
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = 'thiet_bi'
    AND column_name IN ('khoa_phong_quan_ly', 'tinh_trang_hien_tai', 'created_at', 'ten_thiet_bi', 'ma_thiet_bi');
  
  IF column_count = 5 THEN
    RAISE NOTICE 'SUCCESS: All required columns exist in thiet_bi table';
  ELSE
    RAISE WARNING 'WARNING: Missing columns in thiet_bi table. Found % out of 5 columns.', column_count;
  END IF;
  
  -- Check yeu_cau_sua_chua table columns
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = 'yeu_cau_sua_chua'
    AND column_name IN ('thiet_bi_id', 'trang_thai', 'ngay_yeu_cau');
  
  IF column_count = 3 THEN
    RAISE NOTICE 'SUCCESS: All required columns exist in yeu_cau_sua_chua table';
  ELSE
    RAISE WARNING 'WARNING: Missing columns in yeu_cau_sua_chua table. Found % out of 3 columns.', column_count;
  END IF;
  
  -- Check nhan_vien table columns
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = 'nhan_vien'
    AND column_name IN ('khoa_phong', 'username', 'role');
  
  IF column_count = 3 THEN
    RAISE NOTICE 'SUCCESS: All required columns exist in nhan_vien table';
  ELSE
    RAISE WARNING 'WARNING: Missing columns in nhan_vien table. Found % out of 3 columns.', column_count;
  END IF;
END $$;

-- =====================================================
-- CHECK DATA DISTRIBUTION
-- =====================================================

DO $$
DECLARE
  total_equipment INTEGER;
  equipment_with_dept INTEGER;
  total_users INTEGER;
  users_with_dept INTEGER;
  total_repairs INTEGER;
BEGIN
  -- Check equipment data
  SELECT COUNT(*) INTO total_equipment FROM thiet_bi;
  SELECT COUNT(*) INTO equipment_with_dept FROM thiet_bi WHERE khoa_phong_quan_ly IS NOT NULL;
  
  RAISE NOTICE 'Equipment data: % total, % with department (%.1f%%)', 
    total_equipment, 
    equipment_with_dept, 
    CASE WHEN total_equipment > 0 THEN (equipment_with_dept::FLOAT / total_equipment * 100) ELSE 0 END;
  
  -- Check user data
  SELECT COUNT(*) INTO total_users FROM nhan_vien;
  SELECT COUNT(*) INTO users_with_dept FROM nhan_vien WHERE khoa_phong IS NOT NULL;
  
  RAISE NOTICE 'User data: % total, % with department (%.1f%%)', 
    total_users, 
    users_with_dept, 
    CASE WHEN total_users > 0 THEN (users_with_dept::FLOAT / total_users * 100) ELSE 0 END;
  
  -- Check repair requests
  SELECT COUNT(*) INTO total_repairs FROM yeu_cau_sua_chua;
  
  RAISE NOTICE 'Repair requests: % total', total_repairs;
  
  -- Recommendations
  IF equipment_with_dept < total_equipment * 0.5 THEN
    RAISE WARNING 'WARNING: Less than 50%% of equipment has department assigned. Department filtering may not be very effective.';
  END IF;
  
  IF users_with_dept < total_users * 0.5 THEN
    RAISE WARNING 'WARNING: Less than 50%% of users have department assigned. Consider updating user data.';
  END IF;
END $$;

-- =====================================================
-- CHECK EXISTING INDEXES
-- =====================================================

DO $$
DECLARE
  existing_indexes TEXT[];
  index_name TEXT;
BEGIN
  -- Get list of existing relevant indexes
  SELECT ARRAY_AGG(indexname) INTO existing_indexes
  FROM pg_indexes 
  WHERE tablename IN ('thiet_bi', 'yeu_cau_sua_chua', 'nhan_vien')
    AND (indexname LIKE 'idx_%' OR indexname LIKE '%_pkey');
  
  RAISE NOTICE 'Existing indexes found: %', COALESCE(array_length(existing_indexes, 1), 0);
  
  -- Check for specific indexes we plan to create
  FOREACH index_name IN ARRAY ARRAY[
    'idx_thiet_bi_khoa_phong_quan_ly',
    'idx_thiet_bi_dept_status', 
    'idx_yeu_cau_sua_chua_thiet_bi_id',
    'idx_nhan_vien_khoa_phong'
  ] LOOP
    IF index_name = ANY(existing_indexes) THEN
      RAISE NOTICE 'Index % already exists', index_name;
    ELSE
      RAISE NOTICE 'Index % will be created', index_name;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- CHECK PERMISSIONS
-- =====================================================

DO $$
BEGIN
  -- Try to create a test index to check permissions
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS test_permissions_idx ON thiet_bi (id)';
    EXECUTE 'DROP INDEX IF EXISTS test_permissions_idx';
    RAISE NOTICE 'SUCCESS: User has permission to create/drop indexes';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'WARNING: User may not have permission to create indexes. Error: %', SQLERRM;
  END;
END $$;

-- =====================================================
-- SAMPLE DEPARTMENT VALUES
-- =====================================================

-- Show sample department values to help with testing
DO $$
BEGIN
  RAISE NOTICE '=== SAMPLE DEPARTMENT VALUES ===';
END $$;

-- Equipment departments
SELECT
  'Equipment Departments' as category,
  khoa_phong_quan_ly as department_name,
  COUNT(*) as count
FROM thiet_bi
WHERE khoa_phong_quan_ly IS NOT NULL
GROUP BY khoa_phong_quan_ly
ORDER BY count DESC
LIMIT 10;

-- User departments
SELECT
  'User Departments' as category,
  khoa_phong as department_name,
  COUNT(*) as count
FROM nhan_vien
WHERE khoa_phong IS NOT NULL
GROUP BY khoa_phong
ORDER BY count DESC
LIMIT 10;

-- =====================================================
-- FINAL READINESS SUMMARY
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=== DATABASE READINESS SUMMARY ===';
  RAISE NOTICE 'If you see SUCCESS messages above, your database is ready for department filtering indexes.';
  RAISE NOTICE 'Next step: Run add_department_filtering_indexes_simple.sql';
  RAISE NOTICE 'After creating indexes, run ANALYZE on all tables to update statistics.';
END $$;
