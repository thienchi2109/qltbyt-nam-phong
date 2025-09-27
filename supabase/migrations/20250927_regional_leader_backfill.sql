-- Regional Leader Role Backfill & Performance (DM-2)
-- Populates dia_ban data, assigns existing don_vi/nhan_vien, refreshes stats, and reinforces performance indexes
-- Migration Date: 2025-09-27
-- YYYYMMDDHHMMSS: 20250927121500

BEGIN;

-- =============================================================================
-- 1. UPSERT CORE DIA_BAN DATASET
-- =============================================================================

-- Root region (national)
WITH root AS (
    INSERT INTO public.dia_ban (
        ma_dia_ban,
        ten_dia_ban,
        cap_do,
        ten_lanh_dao,
        sort_order,
        active
    ) VALUES (
        'BYT',
        'Bộ Y tế',
        'quoc_gia',
        'Cục Hạ tầng và TBYT',
        0,
        TRUE
    )
    ON CONFLICT (ma_dia_ban) DO UPDATE
        SET ten_dia_ban = EXCLUDED.ten_dia_ban,
            cap_do = EXCLUDED.cap_do,
            ten_lanh_dao = EXCLUDED.ten_lanh_dao,
            sort_order = EXCLUDED.sort_order,
            active = TRUE
    RETURNING id
)
INSERT INTO public.dia_ban (
    ma_dia_ban,
    ten_dia_ban,
    cap_do,
    parent_id,
    ten_lanh_dao,
    dia_chi,
    sort_order,
    active
)
SELECT
    data.ma_dia_ban,
    data.ten_dia_ban,
    data.cap_do,
    data.parent_id,
    data.ten_lanh_dao,
    data.dia_chi,
    data.sort_order,
    TRUE
FROM (
    SELECT
        'VN_TP_HCM'::TEXT AS ma_dia_ban,
        'Thành phố Hồ Chí Minh'::TEXT AS ten_dia_ban,
        'thanh_pho'::TEXT AS cap_do,
        (SELECT id FROM root) AS parent_id,
        'Sở Y tế TP.HCM'::TEXT AS ten_lanh_dao,
        'Số 59 Nguyễn Thị Minh Khai, Quận 1'::TEXT AS dia_chi,
        10 AS sort_order
    UNION ALL
    SELECT
        'VN_CAN_THO',
        'Thành phố Cần Thơ',
        'thanh_pho',
        (SELECT id FROM root),
        'Sở Y tế TP. Cần Thơ',
        'Số 71 Lý Tự Trọng, Ninh Kiều, Cần Thơ',
        20
    UNION ALL
    SELECT
        'VN_DOANH_NGHIEP',
        'Cụm doanh nghiệp trang thiết bị y tế',
        'to_chuc',
        (SELECT id FROM root),
        'Hiệp hội thiết bị y tế',
        NULL,
        30
) AS data
ON CONFLICT (ma_dia_ban) DO UPDATE
    SET ten_dia_ban = EXCLUDED.ten_dia_ban,
        cap_do = EXCLUDED.cap_do,
        parent_id = EXCLUDED.parent_id,
        ten_lanh_dao = EXCLUDED.ten_lanh_dao,
        dia_chi = COALESCE(EXCLUDED.dia_chi, public.dia_ban.dia_chi),
        sort_order = EXCLUDED.sort_order,
        active = TRUE;

-- =============================================================================
-- 2. BACKFILL DON_VI WITH DIA_BAN ASSIGNMENTS
-- =============================================================================

-- Mapping of existing organizational units to regions
WITH mapping AS (
    SELECT * FROM (VALUES
        ('YKPNT', 'VN_TP_HCM'), -- Trường Đại học Y khoa Phạm Ngọc Thạch
        ('CVMEMS', 'VN_DOANH_NGHIEP'), -- Doanh nghiệp CVMEMS
        ('CDC', 'VN_CAN_THO') -- Trung tâm kiểm soát bệnh tật TP. Cần Thơ
    ) AS m(code, ma_dia_ban)
)
UPDATE public.don_vi dv
SET dia_ban_id = db.id
FROM mapping m
JOIN public.dia_ban db ON db.ma_dia_ban = m.ma_dia_ban
WHERE dv.code = m.code
  AND (dv.dia_ban_id IS DISTINCT FROM db.id);

-- Default catch-all for any remaining units (assign to national root)
UPDATE public.don_vi dv
SET dia_ban_id = root_db.id
FROM public.dia_ban root_db
WHERE root_db.ma_dia_ban = 'VN_QUOC_GIA'
  AND dv.dia_ban_id IS NULL;

-- =============================================================================
-- 3. BACKFILL NHAN_VIEN WITH DIA_BAN ASSIGNMENTS
-- =============================================================================

-- Assign staff dia_ban based on current_don_vi or don_vi
WITH staff_src AS (
    SELECT
        nv.id AS nhan_vien_id,
        COALESCE(nv.current_don_vi, nv.don_vi) AS source_don_vi
    FROM public.nhan_vien nv
)
UPDATE public.nhan_vien nv
SET dia_ban_id = dv.dia_ban_id
FROM staff_src src
JOIN public.don_vi dv ON dv.id = src.source_don_vi
WHERE nv.id = src.nhan_vien_id
  AND dv.dia_ban_id IS NOT NULL
  AND (nv.dia_ban_id IS DISTINCT FROM dv.dia_ban_id OR nv.dia_ban_id IS NULL);

-- Leave dia_ban_id NULL for global staff without a home unit for now (handled in later phases)

-- =============================================================================
-- 4. REFRESH DIA_BAN STATISTICS
-- =============================================================================

-- Helper function to refresh so_luong_don_vi_truc_thuoc
CREATE OR REPLACE FUNCTION public.refresh_dia_ban_unit_counts()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.dia_ban db
    SET so_luong_don_vi_truc_thuoc = sub.count_don_vi
    FROM (
        SELECT dia_ban_id, COUNT(*) AS count_don_vi
        FROM public.don_vi
        WHERE dia_ban_id IS NOT NULL
        GROUP BY dia_ban_id
    ) sub
    WHERE db.id = sub.dia_ban_id;
END;
$$;

-- Recalculate counts immediately
SELECT public.refresh_dia_ban_unit_counts();

-- =============================================================================
-- 5. PERFORMANCE INDEXES FOR CROSS-TENANT QUERIES
-- =============================================================================

-- Covering index for joining don_vi by dia_ban and status
CREATE INDEX IF NOT EXISTS idx_don_vi_dia_ban_active
ON public.don_vi (dia_ban_id, active, id);

-- Support region-aware lookups for staff administration
CREATE INDEX IF NOT EXISTS idx_nhan_vien_dia_ban_role
ON public.nhan_vien (dia_ban_id, role)
WHERE dia_ban_id IS NOT NULL;

-- =============================================================================
-- 6. ANALYZE AFFECTED TABLES
-- =============================================================================

ANALYZE public.dia_ban;
ANALYZE public.don_vi;
ANALYZE public.nhan_vien;

-- =============================================================================
-- 7. VERIFICATION HELPERS
-- =============================================================================

-- View to simplify verification of assignments
CREATE OR REPLACE VIEW public.v_don_vi_dia_ban_check AS
SELECT
    dv.id AS don_vi_id,
    dv.code AS don_vi_code,
    dv.name AS don_vi_name,
    dv.dia_ban_id,
    db.ma_dia_ban,
    db.ten_dia_ban
FROM public.don_vi dv
LEFT JOIN public.dia_ban db ON db.id = dv.dia_ban_id;

COMMENT ON VIEW public.v_don_vi_dia_ban_check IS 'Diagnostic view for verifying don_vi to dia_ban assignments';

-- =============================================================================
-- 8. COMMIT
-- =============================================================================

COMMIT;

-- =============================================================================
-- 9. POST-MIGRATION VALIDATION QUERIES (execute manually)
-- =============================================================================
/*
SELECT * FROM public.verify_regional_leader_schema();
SELECT * FROM public.v_don_vi_dia_ban_check ORDER BY don_vi_id;
SELECT id, username, role, dia_ban_id FROM public.nhan_vien ORDER BY id;
SELECT ma_dia_ban, so_luong_don_vi_truc_thuoc FROM public.dia_ban ORDER BY sort_order;
*/

-- =============================================================================
-- 10. ROLLBACK PLAN (manual execution if needed)
-- =============================================================================
/*
BEGIN;

-- Reset assignments
UPDATE public.nhan_vien SET dia_ban_id = NULL;
UPDATE public.don_vi SET dia_ban_id = NULL;

-- Drop helper artifacts
DROP VIEW IF EXISTS public.v_don_vi_dia_ban_check;
DROP FUNCTION IF EXISTS public.refresh_dia_ban_unit_counts();

-- (Optional) Remove inserted dia_ban rows if reverting to pre-DM-2 state
DELETE FROM public.dia_ban WHERE ma_dia_ban IN ('VN_TP_HCM', 'VN_CAN_THO', 'VN_DOANH_NGHIEP');
-- Root region removal only if reverting DM-1 as well
-- DELETE FROM public.dia_ban WHERE ma_dia_ban = 'VN_QUOC_GIA';

COMMIT;
*/