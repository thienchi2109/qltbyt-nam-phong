-- =====================================================
-- PRE-MIGRATION CHECK: TRANSFER HISTORY ANALYSIS
-- =====================================================
-- Run this script BEFORE the migration to understand current state
-- This helps you verify what will be migrated
--
-- Table structures:
-- yeu_cau_luan_chuyen: id, ma_yeu_cau, thiet_bi_id, loai_hinh (noi_bo/ben_ngoai/thanh_ly), trang_thai, nguoi_yeu_cau_id, ly_do_luan_chuyen, khoa_phong_hien_tai, khoa_phong_nhan, muc_dich, don_vi_nhan, dia_chi_don_vi, nguoi_lien_he, so_dien_thoai, ngay_du_kien_tra, ngay_ban_giao, ngay_hoan_tra, ngay_hoan_thanh, nguoi_duyet_id, ngay_duyet, ghi_chu_duyet, created_at, updated_at, created_by, updated_by
-- lich_su_thiet_bi: id, thiet_bi_id, ngay_thuc_hien, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id
-- lich_su_luan_chuyen: id, yeu_cau_id, trang_thai_cu, trang_thai_moi, hanh_dong, mo_ta, nguoi_thuc_hien_id, thoi_gian

-- =====================================================
-- 1. CURRENT STATE ANALYSIS
-- =====================================================

-- Check completed transfer requests
SELECT
    'Completed Transfer Requests' as check_type,
    COUNT(*) as count,
    'Total transfer requests with status hoan_thanh' as description
FROM yeu_cau_luan_chuyen
WHERE trang_thai = 'hoan_thanh';

-- Check existing transfer history in lich_su_thiet_bi
SELECT
    'Existing Transfer History' as check_type,
    COUNT(*) as count,
    'Transfer history already in lich_su_thiet_bi' as description
FROM lich_su_thiet_bi
WHERE loai_su_kien IN ('Luân chuyển nội bộ', 'Luân chuyển bên ngoài', 'Thanh lý');

-- Check transfer requests WITHOUT history in lich_su_thiet_bi
SELECT
    'Missing Transfer History' as check_type,
    COUNT(*) as count,
    'Completed transfers missing from lich_su_thiet_bi (will be migrated)' as description
FROM yeu_cau_luan_chuyen ylc
WHERE ylc.trang_thai = 'hoan_thanh'
  AND NOT EXISTS (
      SELECT 1
      FROM lich_su_thiet_bi lstb
      WHERE lstb.yeu_cau_id = ylc.id
        AND lstb.loai_su_kien IN ('Luân chuyển nội bộ', 'Luân chuyển bên ngoài', 'Thanh lý')
  );

-- =====================================================
-- 2. DETAILED BREAKDOWN BY TRANSFER TYPE
-- =====================================================

SELECT
    ylc.loai_hinh,
    CASE
        WHEN ylc.loai_hinh = 'noi_bo' THEN 'Nội bộ'
        WHEN ylc.loai_hinh = 'ben_ngoai' THEN 'Bên ngoài'
        WHEN ylc.loai_hinh = 'thanh_ly' THEN 'Thanh lý'
        ELSE ylc.loai_hinh
    END as loai_hinh_display,
    COUNT(*) as total_completed,
    COUNT(lstb.id) as has_history,
    COUNT(*) - COUNT(lstb.id) as missing_history
FROM yeu_cau_luan_chuyen ylc
LEFT JOIN lich_su_thiet_bi lstb ON (
    lstb.yeu_cau_id = ylc.id
    AND lstb.loai_su_kien IN ('Luân chuyển nội bộ', 'Luân chuyển bên ngoài', 'Thanh lý')
)
WHERE ylc.trang_thai = 'hoan_thanh'
GROUP BY ylc.loai_hinh
ORDER BY ylc.loai_hinh;

-- =====================================================
-- 3. SAMPLE RECORDS TO BE MIGRATED
-- =====================================================

-- Show sample of transfers that will be migrated
SELECT
    ylc.ma_yeu_cau,
    ylc.loai_hinh,
    ylc.khoa_phong_hien_tai,
    ylc.khoa_phong_nhan,
    ylc.don_vi_nhan,
    ylc.created_at,
    ylc.updated_at,
    ylc.ngay_ban_giao,
    -- Show completion date from history (using thoi_gian column)
    (SELECT lslc.thoi_gian
     FROM lich_su_luan_chuyen lslc
     WHERE lslc.yeu_cau_id = ylc.id
       AND lslc.trang_thai_moi = 'hoan_thanh'
     ORDER BY lslc.thoi_gian DESC
     LIMIT 1) as completion_date_from_history
FROM yeu_cau_luan_chuyen ylc
WHERE ylc.trang_thai = 'hoan_thanh'
  AND NOT EXISTS (
      SELECT 1
      FROM lich_su_thiet_bi lstb
      WHERE lstb.yeu_cau_id = ylc.id
        AND lstb.loai_su_kien IN ('Luân chuyển nội bộ', 'Luân chuyển bên ngoài', 'Thanh lý')
  )
ORDER BY ylc.created_at DESC
LIMIT 5;

-- =====================================================
-- 4. EQUIPMENT WITH MISSING TRANSFER HISTORY
-- =====================================================

-- Show equipment that have completed transfers but missing history
SELECT 
    tb.ma_thiet_bi,
    tb.ten_thiet_bi,
    tb.khoa_phong_quan_ly,
    COUNT(ylc.id) as completed_transfers_without_history
FROM thiet_bi tb
INNER JOIN yeu_cau_luan_chuyen ylc ON tb.id = ylc.thiet_bi_id
WHERE ylc.trang_thai = 'hoan_thanh'
  AND NOT EXISTS (
      SELECT 1 
      FROM lich_su_thiet_bi lstb 
      WHERE lstb.yeu_cau_id = ylc.id 
        AND lstb.loai_su_kien IN ('Luân chuyển nội bộ', 'Luân chuyển bên ngoài', 'Thanh lý')
  )
GROUP BY tb.id, tb.ma_thiet_bi, tb.ten_thiet_bi, tb.khoa_phong_quan_ly
ORDER BY completed_transfers_without_history DESC
LIMIT 10;

-- =====================================================
-- 5. DATE RANGE ANALYSIS
-- =====================================================

-- Show date range of transfers to be migrated
SELECT
    'Date Range Analysis' as analysis_type,
    MIN(ylc.created_at) as earliest_transfer,
    MAX(ylc.created_at) as latest_transfer,
    MIN(COALESCE(
        (SELECT lslc.thoi_gian
         FROM lich_su_luan_chuyen lslc
         WHERE lslc.yeu_cau_id = ylc.id
           AND lslc.trang_thai_moi = 'hoan_thanh'
         ORDER BY lslc.thoi_gian DESC
         LIMIT 1),
        ylc.ngay_ban_giao,
        ylc.updated_at
    )) as earliest_completion,
    MAX(COALESCE(
        (SELECT lslc.thoi_gian
         FROM lich_su_luan_chuyen lslc
         WHERE lslc.yeu_cau_id = ylc.id
           AND lslc.trang_thai_moi = 'hoan_thanh'
         ORDER BY lslc.thoi_gian DESC
         LIMIT 1),
        ylc.ngay_ban_giao,
        ylc.updated_at
    )) as latest_completion
FROM yeu_cau_luan_chuyen ylc
WHERE ylc.trang_thai = 'hoan_thanh'
  AND NOT EXISTS (
      SELECT 1
      FROM lich_su_thiet_bi lstb
      WHERE lstb.yeu_cau_id = ylc.id
        AND lstb.loai_su_kien IN ('Luân chuyển nội bộ', 'Luân chuyển bên ngoài', 'Thanh lý')
  );

-- =====================================================
-- 6. SAFETY CHECKS
-- =====================================================

-- Check for any data quality issues
SELECT 
    'Data Quality Check' as check_type,
    COUNT(*) as count,
    'Transfers with missing thiet_bi_id (potential issues)' as description
FROM yeu_cau_luan_chuyen 
WHERE trang_thai = 'hoan_thanh' 
  AND thiet_bi_id IS NULL;

-- Check for orphaned transfers (equipment doesn't exist)
SELECT 
    'Orphaned Transfers' as check_type,
    COUNT(*) as count,
    'Transfers referencing non-existent equipment' as description
FROM yeu_cau_luan_chuyen ylc
WHERE ylc.trang_thai = 'hoan_thanh'
  AND NOT EXISTS (SELECT 1 FROM thiet_bi tb WHERE tb.id = ylc.thiet_bi_id);

-- =====================================================
-- SUMMARY
-- =====================================================

-- Final summary
DO $$
DECLARE
    total_completed INTEGER;
    has_history INTEGER;
    will_migrate INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_completed
    FROM yeu_cau_luan_chuyen 
    WHERE trang_thai = 'hoan_thanh';
    
    SELECT COUNT(*) INTO has_history
    FROM yeu_cau_luan_chuyen ylc
    WHERE ylc.trang_thai = 'hoan_thanh'
      AND EXISTS (
          SELECT 1 
          FROM lich_su_thiet_bi lstb 
          WHERE lstb.yeu_cau_id = ylc.id 
            AND lstb.loai_su_kien IN ('Luân chuyển nội bộ', 'Luân chuyển bên ngoài', 'Thanh lý')
      );
    
    will_migrate := total_completed - has_history;
    
    RAISE NOTICE '=== MIGRATION SUMMARY ===';
    RAISE NOTICE 'Total completed transfers: %', total_completed;
    RAISE NOTICE 'Already have history: %', has_history;
    RAISE NOTICE 'Will be migrated: %', will_migrate;
    RAISE NOTICE '========================';
    
    IF will_migrate > 0 THEN
        RAISE NOTICE 'READY: % transfer history records will be created', will_migrate;
    ELSE
        RAISE NOTICE 'INFO: No migration needed - all transfers already have history';
    END IF;
END $$;
