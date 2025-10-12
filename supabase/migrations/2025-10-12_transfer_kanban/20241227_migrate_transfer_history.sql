-- =====================================================
-- MIGRATE TRANSFER HISTORY FOR COMPLETED REQUESTS
-- =====================================================
-- This migration adds missing transfer history records to lich_su_thiet_bi
-- for all completed transfer requests that were processed before the fix.
--
-- Background: Transfer completion was logging to lich_su_luan_chuyen (automatic trigger)
-- but missing from lich_su_thiet_bi (manual insert) due to missing ngay_thuc_hien field.
--
-- Table structures:
-- yeu_cau_luan_chuyen: id, ma_yeu_cau, thiet_bi_id, loai_hinh, trang_thai, nguoi_yeu_cau_id, ly_do_luan_chuyen, khoa_phong_hien_tai, khoa_phong_nhan, muc_dich, don_vi_nhan, dia_chi_don_vi, nguoi_lien_he, so_dien_thoai, ngay_du_kien_tra, ngay_ban_giao, ngay_hoan_tra, ngay_hoan_thanh, nguoi_duyet_id, ngay_duyet, ghi_chu_duyet, created_at, updated_at, created_by, updated_by
-- lich_su_thiet_bi: id, thiet_bi_id, ngay_thuc_hien, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id

-- =====================================================
-- 1. BACKUP AND VERIFICATION
-- =====================================================

-- Create backup table for safety
CREATE TABLE IF NOT EXISTS lich_su_thiet_bi_backup_20241227 AS 
SELECT * FROM lich_su_thiet_bi WHERE 1=0; -- Empty structure

-- Insert current data as backup
INSERT INTO lich_su_thiet_bi_backup_20241227 
SELECT * FROM lich_su_thiet_bi;

-- Log migration start
DO $$
BEGIN
    RAISE NOTICE 'Starting transfer history migration at %', NOW();
    RAISE NOTICE 'Backup created: lich_su_thiet_bi_backup_20241227';
END $$;

-- =====================================================
-- 2. ANALYSIS QUERIES (FOR VERIFICATION)
-- =====================================================

-- Count completed transfers without history in lich_su_thiet_bi
DO $$
DECLARE
    completed_transfers_count INTEGER;
    existing_history_count INTEGER;
    missing_history_count INTEGER;
BEGIN
    -- Count completed transfers
    SELECT COUNT(*) INTO completed_transfers_count
    FROM yeu_cau_luan_chuyen 
    WHERE trang_thai = 'hoan_thanh';
    
    -- Count existing transfer history in lich_su_thiet_bi
    SELECT COUNT(*) INTO existing_history_count
    FROM lich_su_thiet_bi 
    WHERE loai_su_kien IN ('Luân chuyển nội bộ', 'Luân chuyển bên ngoài', 'Thanh lý');
    
    missing_history_count := completed_transfers_count - existing_history_count;
    
    RAISE NOTICE 'Completed transfers: %', completed_transfers_count;
    RAISE NOTICE 'Existing transfer history: %', existing_history_count;
    RAISE NOTICE 'Missing transfer history: %', missing_history_count;
END $$;

-- =====================================================
-- 3. MIGRATION LOGIC
-- =====================================================

-- Insert missing transfer history records
-- Table structure: id, thiet_bi_id, ngay_thuc_hien, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id
INSERT INTO lich_su_thiet_bi (
    thiet_bi_id,
    ngay_thuc_hien,
    loai_su_kien,
    mo_ta,
    chi_tiet,
    yeu_cau_id
)
SELECT
    ylc.thiet_bi_id,
    -- Get completion date from history or fallback to other dates
    COALESCE(
        (SELECT lslc.thoi_gian
         FROM lich_su_luan_chuyen lslc
         WHERE lslc.yeu_cau_id = ylc.id
           AND lslc.trang_thai_moi = 'hoan_thanh'
         ORDER BY lslc.thoi_gian DESC
         LIMIT 1),
        ylc.ngay_hoan_thanh,
        ylc.ngay_ban_giao,
        ylc.ngay_hoan_tra,
        ylc.updated_at,
        ylc.created_at
    ) as ngay_thuc_hien,
    -- Determine event type based on transfer type
    CASE
        WHEN ylc.loai_hinh = 'noi_bo' THEN 'Luân chuyển nội bộ'
        WHEN ylc.loai_hinh = 'ben_ngoai' THEN 'Luân chuyển bên ngoài'
        WHEN ylc.loai_hinh = 'thanh_ly' THEN 'Thanh lý'
        ELSE 'Luân chuyển'
    END as loai_su_kien,
    -- Generate description based on transfer type
    CASE
        WHEN ylc.loai_hinh = 'noi_bo' THEN
            'Thiết bị được luân chuyển từ "' || COALESCE(ylc.khoa_phong_hien_tai, 'N/A') || '" đến "' || COALESCE(ylc.khoa_phong_nhan, 'N/A') || '".'
        WHEN ylc.loai_hinh = 'ben_ngoai' THEN
            'Thiết bị được hoàn trả từ đơn vị bên ngoài "' || COALESCE(ylc.don_vi_nhan, 'N/A') || '".'
        WHEN ylc.loai_hinh = 'thanh_ly' THEN
            'Thiết bị được thanh lý theo yêu cầu "' || ylc.ma_yeu_cau || '".'
        ELSE
            'Hoàn thành luân chuyển thiết bị theo yêu cầu "' || ylc.ma_yeu_cau || '".'
    END as mo_ta,
    -- Build chi_tiet JSON object
    jsonb_build_object(
        'ma_yeu_cau', ylc.ma_yeu_cau,
        'loai_hinh', ylc.loai_hinh,
        'khoa_phong_hien_tai', ylc.khoa_phong_hien_tai,
        'khoa_phong_nhan', ylc.khoa_phong_nhan,
        'don_vi_nhan', ylc.don_vi_nhan,
        'ly_do_luan_chuyen', ylc.ly_do_luan_chuyen,
        'migrated_from_old_request', true,
        'migration_date', NOW()
    ) as chi_tiet,
    ylc.id as yeu_cau_id
FROM yeu_cau_luan_chuyen ylc
WHERE ylc.trang_thai = 'hoan_thanh'
  -- Only insert if not already exists in lich_su_thiet_bi
  AND NOT EXISTS (
      SELECT 1 
      FROM lich_su_thiet_bi lstb 
      WHERE lstb.yeu_cau_id = ylc.id 
        AND lstb.loai_su_kien IN ('Luân chuyển nội bộ', 'Luân chuyển bên ngoài', 'Thanh lý')
  );

-- =====================================================
-- 4. VERIFICATION AND LOGGING
-- =====================================================

-- Log migration results
DO $$
DECLARE
    migrated_count INTEGER;
    total_history_count INTEGER;
BEGIN
    -- Count newly migrated records
    SELECT COUNT(*) INTO migrated_count
    FROM lich_su_thiet_bi 
    WHERE chi_tiet->>'migrated_from_old_request' = 'true';
    
    -- Count total transfer history
    SELECT COUNT(*) INTO total_history_count
    FROM lich_su_thiet_bi 
    WHERE loai_su_kien IN ('Luân chuyển nội bộ', 'Luân chuyển bên ngoài', 'Thanh lý');
    
    RAISE NOTICE 'Migration completed at %', NOW();
    RAISE NOTICE 'Records migrated: %', migrated_count;
    RAISE NOTICE 'Total transfer history records: %', total_history_count;
    
    IF migrated_count > 0 THEN
        RAISE NOTICE 'SUCCESS: Transfer history migration completed successfully';
    ELSE
        RAISE NOTICE 'INFO: No records needed migration (all transfers already have history)';
    END IF;
END $$;

-- =====================================================
-- 5. VERIFICATION QUERIES
-- =====================================================

-- Show sample of migrated records
DO $$
DECLARE
    sample_record RECORD;
BEGIN
    RAISE NOTICE 'Sample migrated records:';
    FOR sample_record IN 
        SELECT 
            lstb.id,
            lstb.loai_su_kien,
            lstb.mo_ta,
            lstb.ngay_thuc_hien,
            lstb.chi_tiet->>'ma_yeu_cau' as ma_yeu_cau
        FROM lich_su_thiet_bi lstb
        WHERE lstb.chi_tiet->>'migrated_from_old_request' = 'true'
        ORDER BY lstb.ngay_thuc_hien DESC
        LIMIT 3
    LOOP
        RAISE NOTICE 'ID: %, Event: %, Request: %, Date: %', 
            sample_record.id, 
            sample_record.loai_su_kien, 
            sample_record.ma_yeu_cau, 
            sample_record.ngay_thuc_hien;
    END LOOP;
END $$;

-- =====================================================
-- 6. CLEANUP INSTRUCTIONS
-- =====================================================

/*
CLEANUP INSTRUCTIONS (run after verification):

-- If migration is successful and verified, you can drop the backup table:
-- DROP TABLE lich_su_thiet_bi_backup_20241227;

-- If you need to rollback the migration:
-- DELETE FROM lich_su_thiet_bi WHERE chi_tiet->>'migrated_from_old_request' = 'true';

VERIFICATION QUERIES:

-- Check migrated records:
SELECT COUNT(*) as migrated_records 
FROM lich_su_thiet_bi 
WHERE chi_tiet->>'migrated_from_old_request' = 'true';

-- Check transfer history by equipment:
SELECT 
    tb.ma_thiet_bi,
    tb.ten_thiet_bi,
    COUNT(lstb.id) as history_count
FROM thiet_bi tb
LEFT JOIN lich_su_thiet_bi lstb ON tb.id = lstb.thiet_bi_id
WHERE lstb.loai_su_kien IN ('Luân chuyển nội bộ', 'Luân chuyển bên ngoài', 'Thanh lý')
GROUP BY tb.id, tb.ma_thiet_bi, tb.ten_thiet_bi
ORDER BY history_count DESC;

-- Check for any missing history:
SELECT ylc.ma_yeu_cau, ylc.trang_thai, ylc.loai_hinh
FROM yeu_cau_luan_chuyen ylc
WHERE ylc.trang_thai = 'hoan_thanh'
  AND NOT EXISTS (
      SELECT 1 FROM lich_su_thiet_bi lstb 
      WHERE lstb.yeu_cau_id = ylc.id
  );
*/
