-- Migration: Add status validation to equipment_create
-- Date: 2026-01-13
-- Purpose: Defense-in-depth validation for tinh_trang_hien_tai (equipment status)
--
-- Valid statuses:
--   - Hoạt động
--   - Chờ sửa chữa
--   - Chờ bảo trì
--   - Chờ hiệu chuẩn/kiểm định
--   - Ngưng sử dụng
--   - Chưa có nhu cầu sử dụng
--
-- Security: Maintains existing tenant isolation via JWT claims

BEGIN;

-- ============================================================================
-- Update equipment_create to validate tinh_trang_hien_tai before insert
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_create(p_payload JSONB)
RETURNS public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_khoa_phong TEXT := COALESCE(p_payload->>'khoa_phong_quan_ly', NULL);
  v_status TEXT := NULLIF(TRIM(p_payload->>'tinh_trang_hien_tai'), '');
  v_valid_statuses TEXT[] := ARRAY[
    'Hoạt động', 'Chờ sửa chữa', 'Chờ bảo trì',
    'Chờ hiệu chuẩn/kiểm định', 'Ngưng sử dụng', 'Chưa có nhu cầu sử dụng'
  ];
  rec public.thiet_bi;
BEGIN
  -- Permission check
  IF v_role NOT IN ('global','to_qltb','technician') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- Technician department check
  IF v_role = 'technician' THEN
    PERFORM 1
    FROM public.nhan_vien nv
    WHERE nv.id = (public._get_jwt_claim('user_id'))::BIGINT
      AND nv.khoa_phong = v_khoa_phong;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Technician department mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Validate status value (defense-in-depth)
  IF v_status IS NOT NULL AND NOT (v_status = ANY(v_valid_statuses)) THEN
    RAISE EXCEPTION 'Invalid status: %. Must be one of: %', v_status, array_to_string(v_valid_statuses, ', ')
      USING ERRCODE = '22023'; -- invalid_parameter_value
  END IF;

  INSERT INTO public.thiet_bi (
    ten_thiet_bi,
    ma_thiet_bi,
    khoa_phong_quan_ly,
    model,
    serial,
    hang_san_xuat,
    noi_san_xuat,
    nam_san_xuat,
    ngay_nhap,
    ngay_dua_vao_su_dung,
    nguon_kinh_phi,
    gia_goc,
    nam_tinh_hao_mon,
    ty_le_hao_mon,
    han_bao_hanh,
    vi_tri_lap_dat,
    nguoi_dang_truc_tiep_quan_ly,
    tinh_trang_hien_tai,
    ghi_chu,
    chu_ky_bt_dinh_ky,
    ngay_bt_tiep_theo,
    chu_ky_hc_dinh_ky,
    ngay_hc_tiep_theo,
    chu_ky_kd_dinh_ky,
    ngay_kd_tiep_theo,
    phan_loai_theo_nd98,
    don_vi,
    nguon_nhap
  )
  VALUES (
    p_payload->>'ten_thiet_bi',
    p_payload->>'ma_thiet_bi',
    v_khoa_phong,
    NULLIF(p_payload->>'model',''),
    NULLIF(p_payload->>'serial',''),
    NULLIF(p_payload->>'hang_san_xuat',''),
    NULLIF(p_payload->>'noi_san_xuat',''),
    NULLIF(p_payload->>'nam_san_xuat','')::INT,
    CASE WHEN COALESCE(p_payload->>'ngay_nhap','') = '' THEN NULL ELSE (p_payload->>'ngay_nhap')::DATE END,
    CASE WHEN COALESCE(p_payload->>'ngay_dua_vao_su_dung','') = '' THEN NULL ELSE (p_payload->>'ngay_dua_vao_su_dung')::DATE END,
    NULLIF(p_payload->>'nguon_kinh_phi',''),
    NULLIF(p_payload->>'gia_goc','')::NUMERIC,
    NULLIF(p_payload->>'nam_tinh_hao_mon','')::INT,
    NULLIF(p_payload->>'ty_le_hao_mon',''),
    CASE WHEN COALESCE(p_payload->>'han_bao_hanh','') = '' THEN NULL ELSE (p_payload->>'han_bao_hanh')::DATE END,
    NULLIF(p_payload->>'vi_tri_lap_dat',''),
    NULLIF(p_payload->>'nguoi_dang_truc_tiep_quan_ly',''),
    v_status, -- Use validated status variable
    NULLIF(p_payload->>'ghi_chu',''),
    NULLIF(p_payload->>'chu_ky_bt_dinh_ky','')::INT,
    CASE WHEN COALESCE(p_payload->>'ngay_bt_tiep_theo','') = '' THEN NULL ELSE (p_payload->>'ngay_bt_tiep_theo')::DATE END,
    NULLIF(p_payload->>'chu_ky_hc_dinh_ky','')::INT,
    CASE WHEN COALESCE(p_payload->>'ngay_hc_tiep_theo','') = '' THEN NULL ELSE (p_payload->>'ngay_hc_tiep_theo')::DATE END,
    NULLIF(p_payload->>'chu_ky_kd_dinh_ky','')::INT,
    CASE WHEN COALESCE(p_payload->>'ngay_kd_tiep_theo','') = '' THEN NULL ELSE (p_payload->>'ngay_kd_tiep_theo')::DATE END,
    NULLIF(p_payload->>'phan_loai_theo_nd98',''),
    v_donvi,
    COALESCE(NULLIF(p_payload->>'nguon_nhap',''), 'manual')
  )
  RETURNING * INTO rec;

  RETURN rec;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_create(JSONB) TO authenticated;

COMMIT;
