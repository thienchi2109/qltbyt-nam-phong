-- =====================================================
-- ADD REPAIR UNIT FIELDS TO YEU_CAU_SUA_CHUA TABLE
-- =====================================================
-- This migration adds fields to track repair execution unit:
-- - don_vi_thuc_hien: Internal or external repair
-- - ten_don_vi_thue: Name of external repair company (when applicable)

-- =====================================================
-- 1. BACKUP AND VERIFICATION
-- =====================================================

-- Create backup table for safety
CREATE TABLE IF NOT EXISTS yeu_cau_sua_chua_backup_20241228 AS 
SELECT * FROM yeu_cau_sua_chua WHERE 1=0; -- Empty structure

-- Insert current data as backup
INSERT INTO yeu_cau_sua_chua_backup_20241228 
SELECT * FROM yeu_cau_sua_chua;

-- Log migration start
DO $$
BEGIN
    RAISE NOTICE 'Starting repair unit fields migration at %', NOW();
    RAISE NOTICE 'Backup created: yeu_cau_sua_chua_backup_20241228';
END $$;

-- =====================================================
-- 2. ADD NEW COLUMNS
-- =====================================================

-- Add repair execution unit field
ALTER TABLE yeu_cau_sua_chua 
ADD COLUMN IF NOT EXISTS don_vi_thuc_hien VARCHAR(20) 
CHECK (don_vi_thuc_hien IN ('noi_bo', 'thue_ngoai')) 
DEFAULT 'noi_bo';

-- Add external repair company name field
ALTER TABLE yeu_cau_sua_chua 
ADD COLUMN IF NOT EXISTS ten_don_vi_thue TEXT;

-- =====================================================
-- 3. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN yeu_cau_sua_chua.don_vi_thuc_hien IS 'Đơn vị thực hiện sửa chữa: noi_bo (nội bộ), thue_ngoai (thuê ngoài)';
COMMENT ON COLUMN yeu_cau_sua_chua.ten_don_vi_thue IS 'Tên đơn vị được thuê sửa chữa (chỉ khi don_vi_thuc_hien = thue_ngoai)';

-- =====================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for filtering by repair unit type
CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_don_vi_thuc_hien 
ON yeu_cau_sua_chua(don_vi_thuc_hien);

-- Composite index for external repair queries
CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_external_repair 
ON yeu_cau_sua_chua(don_vi_thuc_hien, ten_don_vi_thue) 
WHERE don_vi_thuc_hien = 'thue_ngoai';

-- =====================================================
-- 5. UPDATE EXISTING RECORDS
-- =====================================================

-- Set all existing records to 'noi_bo' (internal repair) as default
UPDATE yeu_cau_sua_chua 
SET don_vi_thuc_hien = 'noi_bo' 
WHERE don_vi_thuc_hien IS NULL;

-- =====================================================
-- 6. VERIFICATION AND LOGGING
-- =====================================================

-- Log migration results
DO $$
DECLARE
    total_records INTEGER;
    internal_records INTEGER;
    external_records INTEGER;
BEGIN
    -- Count total records
    SELECT COUNT(*) INTO total_records FROM yeu_cau_sua_chua;
    
    -- Count by repair unit type
    SELECT COUNT(*) INTO internal_records 
    FROM yeu_cau_sua_chua WHERE don_vi_thuc_hien = 'noi_bo';
    
    SELECT COUNT(*) INTO external_records 
    FROM yeu_cau_sua_chua WHERE don_vi_thuc_hien = 'thue_ngoai';
    
    RAISE NOTICE 'Migration completed at %', NOW();
    RAISE NOTICE 'Total repair requests: %', total_records;
    RAISE NOTICE 'Internal repair requests: %', internal_records;
    RAISE NOTICE 'External repair requests: %', external_records;
    RAISE NOTICE 'SUCCESS: Repair unit fields added successfully';
END $$;

-- =====================================================
-- 7. CLEANUP INSTRUCTIONS
-- =====================================================

/*
CLEANUP INSTRUCTIONS (run after verification):

-- If migration is successful and verified, you can drop the backup table:
-- DROP TABLE yeu_cau_sua_chua_backup_20241228;

-- If you need to rollback the migration:
-- ALTER TABLE yeu_cau_sua_chua DROP COLUMN IF EXISTS don_vi_thuc_hien;
-- ALTER TABLE yeu_cau_sua_chua DROP COLUMN IF EXISTS ten_don_vi_thue;
-- DROP INDEX IF EXISTS idx_yeu_cau_sua_chua_don_vi_thuc_hien;
-- DROP INDEX IF EXISTS idx_yeu_cau_sua_chua_external_repair;

VERIFICATION QUERIES:

-- Check column structure:
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'yeu_cau_sua_chua' 
  AND column_name IN ('don_vi_thuc_hien', 'ten_don_vi_thue');

-- Check data distribution:
SELECT 
    don_vi_thuc_hien,
    COUNT(*) as count,
    COUNT(ten_don_vi_thue) as with_company_name
FROM yeu_cau_sua_chua 
GROUP BY don_vi_thuc_hien;

-- Check indexes:
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'yeu_cau_sua_chua' 
  AND indexname LIKE '%don_vi%';
*/
