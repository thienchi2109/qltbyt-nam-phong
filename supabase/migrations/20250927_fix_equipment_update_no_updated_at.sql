-- Fix equipment_update function with correct column data types
-- Based on actual schema: some date fields are TEXT, others are DATE
-- TEXT fields: han_bao_hanh, ngay_dua_vao_su_dung, ngay_nhap 
-- DATE fields: ngay_bt_tiep_theo, ngay_hc_tiep_theo, ngay_kd_tiep_theo
-- NOTE: No updated_at column exists in thiet_bi table

-- Drop the problematic function and recreate it with proper type handling
DROP FUNCTION IF EXISTS public.equipment_update(p_id BIGINT, p_patch JSONB);

CREATE FUNCTION public.equipment_update(p_id BIGINT, p_patch JSONB)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_khoa_phong_new TEXT := COALESCE(p_patch->>'khoa_phong_quan_ly', NULL);
BEGIN
  -- Permission checks
  IF v_role IN ('regional_leader','user') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- Tenant isolation for non-global users
  IF v_role <> 'global' THEN
    PERFORM 1 FROM public.thiet_bi WHERE id = p_id AND don_vi = v_donvi;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Access denied for update' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Additional technician department check
  IF v_role = 'technician' AND v_khoa_phong_new IS NOT NULL THEN
    PERFORM 1 FROM public.nhan_vien nv WHERE nv.id = (public._get_jwt_claim('user_id'))::BIGINT AND nv.khoa_phong = v_khoa_phong_new;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Technician department mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Update all fields from patch with correct data types
  UPDATE public.thiet_bi SET
    -- Basic info (all TEXT)
    ten_thiet_bi = COALESCE(p_patch->>'ten_thiet_bi', ten_thiet_bi),
    ma_thiet_bi = COALESCE(p_patch->>'ma_thiet_bi', ma_thiet_bi),
    model = COALESCE(p_patch->>'model', model),
    serial = COALESCE(p_patch->>'serial', serial),
    
    -- Manufacturing info
    hang_san_xuat = COALESCE(p_patch->>'hang_san_xuat', hang_san_xuat),
    noi_san_xuat = COALESCE(p_patch->>'noi_san_xuat', noi_san_xuat),
    nam_san_xuat = COALESCE(
      CASE WHEN p_patch ? 'nam_san_xuat' AND p_patch->>'nam_san_xuat' <> '' 
           THEN (p_patch->>'nam_san_xuat')::INTEGER 
           ELSE NULL END,
      nam_san_xuat
    ),
    
    -- Date fields stored as TEXT in database (do NOT cast to DATE)
    ngay_nhap = COALESCE(p_patch->>'ngay_nhap', ngay_nhap),
    ngay_dua_vao_su_dung = COALESCE(p_patch->>'ngay_dua_vao_su_dung', ngay_dua_vao_su_dung),
    han_bao_hanh = COALESCE(p_patch->>'han_bao_hanh', han_bao_hanh),
    
    -- Financial
    nguon_kinh_phi = COALESCE(p_patch->>'nguon_kinh_phi', nguon_kinh_phi),
    gia_goc = COALESCE(
      CASE WHEN p_patch ? 'gia_goc' AND p_patch->>'gia_goc' <> '' 
           THEN (p_patch->>'gia_goc')::DECIMAL 
           ELSE NULL END,
      gia_goc
    ),
    
    -- Location and management (all TEXT)
    khoa_phong_quan_ly = COALESCE(p_patch->>'khoa_phong_quan_ly', khoa_phong_quan_ly),
    vi_tri_lap_dat = COALESCE(p_patch->>'vi_tri_lap_dat', vi_tri_lap_dat),
    nguoi_dang_truc_tiep_quan_ly = COALESCE(p_patch->>'nguoi_dang_truc_tiep_quan_ly', nguoi_dang_truc_tiep_quan_ly),
    
    -- Status (TEXT)
    tinh_trang_hien_tai = COALESCE(p_patch->>'tinh_trang_hien_tai', tinh_trang_hien_tai),
    
    -- Technical details (all TEXT)
    cau_hinh_thiet_bi = COALESCE(p_patch->>'cau_hinh_thiet_bi', cau_hinh_thiet_bi),
    phu_kien_kem_theo = COALESCE(p_patch->>'phu_kien_kem_theo', phu_kien_kem_theo),
    ghi_chu = COALESCE(p_patch->>'ghi_chu', ghi_chu),
    
    -- Maintenance cycles with proper type casting
    -- INTEGER fields
    chu_ky_bt_dinh_ky = COALESCE(
      CASE WHEN p_patch ? 'chu_ky_bt_dinh_ky' AND p_patch->>'chu_ky_bt_dinh_ky' <> '' 
           THEN (p_patch->>'chu_ky_bt_dinh_ky')::INTEGER 
           ELSE NULL END,
      chu_ky_bt_dinh_ky
    ),
    chu_ky_hc_dinh_ky = COALESCE(
      CASE WHEN p_patch ? 'chu_ky_hc_dinh_ky' AND p_patch->>'chu_ky_hc_dinh_ky' <> '' 
           THEN (p_patch->>'chu_ky_hc_dinh_ky')::INTEGER 
           ELSE NULL END,
      chu_ky_hc_dinh_ky
    ),
    chu_ky_kd_dinh_ky = COALESCE(
      CASE WHEN p_patch ? 'chu_ky_kd_dinh_ky' AND p_patch->>'chu_ky_kd_dinh_ky' <> '' 
           THEN (p_patch->>'chu_ky_kd_dinh_ky')::INTEGER 
           ELSE NULL END,
      chu_ky_kd_dinh_ky
    ),
    
    -- DATE fields (can cast to DATE)
    ngay_bt_tiep_theo = COALESCE(
      CASE WHEN p_patch ? 'ngay_bt_tiep_theo' AND p_patch->>'ngay_bt_tiep_theo' <> '' 
           THEN (p_patch->>'ngay_bt_tiep_theo')::DATE 
           ELSE NULL END,
      ngay_bt_tiep_theo
    ),
    ngay_hc_tiep_theo = COALESCE(
      CASE WHEN p_patch ? 'ngay_hc_tiep_theo' AND p_patch->>'ngay_hc_tiep_theo' <> '' 
           THEN (p_patch->>'ngay_hc_tiep_theo')::DATE 
           ELSE NULL END,
      ngay_hc_tiep_theo
    ),
    ngay_kd_tiep_theo = COALESCE(
      CASE WHEN p_patch ? 'ngay_kd_tiep_theo' AND p_patch->>'ngay_kd_tiep_theo' <> '' 
           THEN (p_patch->>'ngay_kd_tiep_theo')::DATE 
           ELSE NULL END,
      ngay_kd_tiep_theo
    ),
    
    -- Classification (TEXT)
    phan_loai_theo_nd98 = COALESCE(p_patch->>'phan_loai_theo_nd98', phan_loai_theo_nd98)
    
    -- Note: No updated_at column to update as it doesn't exist in thiet_bi table
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found with ID: %', p_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.equipment_update(p_id BIGINT, p_patch JSONB) TO authenticated;