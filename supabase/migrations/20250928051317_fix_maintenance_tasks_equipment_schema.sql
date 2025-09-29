-- Fix maintenance_tasks_list_with_equipment RPC with correct column names
-- This resolves the issue where equipment code/name appear blank after saving and reloading
-- while maintaining full backward compatibility

CREATE OR REPLACE FUNCTION public.maintenance_tasks_list_with_equipment(
  p_ke_hoach_id bigint default null,
  p_thiet_bi_id bigint default null,
  p_loai_cong_viec text default null,
  p_don_vi_thuc_hien text default null
)
RETURNS TABLE(
  id bigint,
  ke_hoach_id bigint,
  thiet_bi_id bigint,
  loai_cong_viec text,
  diem_hieu_chuan text,
  don_vi_thuc_hien text,
  thang_1 boolean,
  thang_2 boolean,
  thang_3 boolean,
  thang_4 boolean,
  thang_5 boolean,
  thang_6 boolean,
  thang_7 boolean,
  thang_8 boolean,
  thang_9 boolean,
  thang_10 boolean,
  thang_11 boolean,
  thang_12 boolean,
  ghi_chu text,
  created_at timestamptz,
  updated_at timestamptz,
  -- Equipment fields (EXISTING - maintained for backward compatibility)
  ma_thiet_bi text,
  ten_thiet_bi text,
  model text,
  khoa_phong_quan_ly text,
  vi_tri_lap_dat text,
  -- Completion status fields (EXISTING)
  thang_1_hoan_thanh boolean,
  thang_2_hoan_thanh boolean,
  thang_3_hoan_thanh boolean,
  thang_4_hoan_thanh boolean,
  thang_5_hoan_thanh boolean,
  thang_6_hoan_thanh boolean,
  thang_7_hoan_thanh boolean,
  thang_8_hoan_thanh boolean,
  thang_9_hoan_thanh boolean,
  thang_10_hoan_thanh boolean,
  thang_11_hoan_thanh boolean,
  thang_12_hoan_thanh boolean,
  -- NEW: Nested equipment object for frontend compatibility
  thiet_bi jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
BEGIN
  -- Determine tenant scope
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := NULL; -- Global users see all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- Non-global users see only their tenant
  END IF;

  -- Return maintenance tasks with equipment info and proper tenant filtering
  RETURN QUERY
  SELECT 
    cv.id,
    cv.ke_hoach_id,
    cv.thiet_bi_id,
    cv.loai_cong_viec,
    cv.diem_hieu_chuan,
    cv.don_vi_thuc_hien,
    cv.thang_1,
    cv.thang_2,
    cv.thang_3,
    cv.thang_4,
    cv.thang_5,
    cv.thang_6,
    cv.thang_7,
    cv.thang_8,
    cv.thang_9,
    cv.thang_10,
    cv.thang_11,
    cv.thang_12,
    cv.ghi_chu,
    cv.created_at,
    cv.updated_at,
    -- Equipment fields (EXISTING - maintained for backward compatibility)
    tb.ma_thiet_bi,
    tb.ten_thiet_bi,
    tb.model,
    tb.khoa_phong_quan_ly,
    tb.vi_tri_lap_dat,
    -- Completion status (EXISTING)
    cv.thang_1_hoan_thanh,
    cv.thang_2_hoan_thanh,
    cv.thang_3_hoan_thanh,
    cv.thang_4_hoan_thanh,
    cv.thang_5_hoan_thanh,
    cv.thang_6_hoan_thanh,
    cv.thang_7_hoan_thanh,
    cv.thang_8_hoan_thanh,
    cv.thang_9_hoan_thanh,
    cv.thang_10_hoan_thanh,
    cv.thang_11_hoan_thanh,
    cv.thang_12_hoan_thanh,
    -- NEW: Nested equipment object (provides thiet_bi.ma_thiet_bi, thiet_bi.ten_thiet_bi access)
    CASE 
      WHEN tb.id IS NOT NULL THEN
        jsonb_build_object(
          'id', tb.id,
          'ma_thiet_bi', tb.ma_thiet_bi,
          'ten_thiet_bi', tb.ten_thiet_bi,
          'model', COALESCE(tb.model, ''),
          'khoa_phong_quan_ly', COALESCE(tb.khoa_phong_quan_ly, ''),
          'vi_tri_lap_dat', COALESCE(tb.vi_tri_lap_dat, ''),
          'hang_san_xuat', COALESCE(tb.hang_san_xuat, ''),
          'noi_san_xuat', COALESCE(tb.noi_san_xuat, ''),
          'nam_san_xuat', tb.nam_san_xuat,
          'serial', COALESCE(tb.serial, '')
        )
      ELSE NULL
    END as thiet_bi
  FROM cong_viec_bao_tri cv
  LEFT JOIN thiet_bi tb ON cv.thiet_bi_id = tb.id
  WHERE (p_ke_hoach_id IS NULL OR cv.ke_hoach_id = p_ke_hoach_id)
    AND (p_thiet_bi_id IS NULL OR cv.thiet_bi_id = p_thiet_bi_id)
    AND (p_loai_cong_viec IS NULL OR cv.loai_cong_viec = p_loai_cong_viec)
    AND (p_don_vi_thuc_hien IS NULL OR cv.don_vi_thuc_hien = p_don_vi_thuc_hien)
    AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi) -- TENANT FILTERING
  ORDER BY cv.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_tasks_list_with_equipment(bigint, bigint, text, text) TO authenticated;