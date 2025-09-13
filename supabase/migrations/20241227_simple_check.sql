-- =====================================================
-- SIMPLE TRANSFER HISTORY CHECK
-- =====================================================
-- Quick check to verify migration readiness

-- 1. Count completed transfers
SELECT 
    'Total completed transfers' as description,
    COUNT(*) as count
FROM yeu_cau_luan_chuyen 
WHERE trang_thai = 'hoan_thanh';

-- 2. Count existing transfer history
SELECT 
    'Existing transfer history in lich_su_thiet_bi' as description,
    COUNT(*) as count
FROM lich_su_thiet_bi 
WHERE loai_su_kien IN ('Luân chuyển nội bộ', 'Luân chuyển bên ngoài', 'Thanh lý');

-- 3. Count missing transfer history
SELECT 
    'Missing transfer history (will be migrated)' as description,
    COUNT(*) as count
FROM yeu_cau_luan_chuyen ylc
WHERE ylc.trang_thai = 'hoan_thanh'
  AND NOT EXISTS (
      SELECT 1 
      FROM lich_su_thiet_bi lstb 
      WHERE lstb.yeu_cau_id = ylc.id 
        AND lstb.loai_su_kien IN ('Luân chuyển nội bộ', 'Luân chuyển bên ngoài', 'Thanh lý')
  );

-- 4. Show sample transfers to be migrated
SELECT 
    ylc.id,
    ylc.ma_yeu_cau,
    ylc.loai_hinh,
    ylc.trang_thai,
    ylc.created_at,
    ylc.ngay_hoan_thanh,
    -- Check if history exists
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM lich_su_thiet_bi lstb 
            WHERE lstb.yeu_cau_id = ylc.id 
              AND lstb.loai_su_kien IN ('Luân chuyển nội bộ', 'Luân chuyển bên ngoài', 'Thanh lý')
        ) THEN 'HAS_HISTORY'
        ELSE 'MISSING_HISTORY'
    END as history_status
FROM yeu_cau_luan_chuyen ylc
WHERE ylc.trang_thai = 'hoan_thanh'
ORDER BY ylc.created_at DESC;

-- 5. Breakdown by transfer type
SELECT 
    ylc.loai_hinh,
    COUNT(*) as total_completed,
    SUM(CASE 
        WHEN EXISTS (
            SELECT 1 FROM lich_su_thiet_bi lstb 
            WHERE lstb.yeu_cau_id = ylc.id 
              AND lstb.loai_su_kien IN ('Luân chuyển nội bộ', 'Luân chuyển bên ngoài', 'Thanh lý')
        ) THEN 1 ELSE 0 
    END) as has_history,
    SUM(CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM lich_su_thiet_bi lstb 
            WHERE lstb.yeu_cau_id = ylc.id 
              AND lstb.loai_su_kien IN ('Luân chuyển nội bộ', 'Luân chuyển bên ngoài', 'Thanh lý')
        ) THEN 1 ELSE 0 
    END) as missing_history
FROM yeu_cau_luan_chuyen ylc
WHERE ylc.trang_thai = 'hoan_thanh'
GROUP BY ylc.loai_hinh
ORDER BY ylc.loai_hinh;

-- 6. Check equipment references
SELECT 
    'Equipment reference check' as description,
    COUNT(*) as count
FROM yeu_cau_luan_chuyen ylc
LEFT JOIN thiet_bi tb ON tb.id = ylc.thiet_bi_id
WHERE ylc.trang_thai = 'hoan_thanh'
  AND tb.id IS NULL;
