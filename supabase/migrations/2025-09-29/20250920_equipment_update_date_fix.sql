-- 2025-09-20: Harden equipment_update for mixed column types on date fields
-- Issue: COALESCE types date and text cannot be matched when columns may be TEXT in some envs
-- Approach: Coalesce on TEXT then cast once to DATE to ensure argument homogeneity

BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_update(p_id BIGINT, p_patch JSONB)
RETURNS public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_khoa_phong_new TEXT := COALESCE(p_patch->>'khoa_phong_quan_ly', NULL);
  rec public.thiet_bi;
BEGIN
  IF v_role <> 'global' THEN
    PERFORM 1 FROM public.thiet_bi WHERE id = p_id AND don_vi = v_donvi;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Access denied for update' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_role = 'technician' AND v_khoa_phong_new IS NOT NULL THEN
    PERFORM 1 FROM public.nhan_vien nv WHERE nv.id = (public._get_jwt_claim('user_id'))::BIGINT AND nv.khoa_phong = v_khoa_phong_new;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Technician department mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.thiet_bi tb SET
    ten_thiet_bi = COALESCE(NULLIF(p_patch->>'ten_thiet_bi',''), tb.ten_thiet_bi),
    ma_thiet_bi = COALESCE(NULLIF(p_patch->>'ma_thiet_bi',''), tb.ma_thiet_bi),
    khoa_phong_quan_ly = COALESCE(NULLIF(p_patch->>'khoa_phong_quan_ly',''), tb.khoa_phong_quan_ly),
    model = COALESCE(NULLIF(p_patch->>'model',''), tb.model),
    serial = COALESCE(NULLIF(p_patch->>'serial',''), tb.serial),
    hang_san_xuat = COALESCE(NULLIF(p_patch->>'hang_san_xuat',''), tb.hang_san_xuat),
    noi_san_xuat = COALESCE(NULLIF(p_patch->>'noi_san_xuat',''), tb.noi_san_xuat),
    nam_san_xuat = COALESCE(NULLIF(p_patch->>'nam_san_xuat','')::INT, tb.nam_san_xuat),
    -- Date fields: coalesce text then cast to DATE to avoid date/text mismatch
    ngay_nhap = COALESCE(NULLIF(p_patch->>'ngay_nhap',''), NULLIF(tb.ngay_nhap::TEXT,''))::DATE,
    ngay_dua_vao_su_dung = COALESCE(NULLIF(p_patch->>'ngay_dua_vao_su_dung',''), NULLIF(tb.ngay_dua_vao_su_dung::TEXT,''))::DATE,
    nguon_kinh_phi = COALESCE(NULLIF(p_patch->>'nguon_kinh_phi',''), tb.nguon_kinh_phi),
    gia_goc = COALESCE(NULLIF(p_patch->>'gia_goc','')::NUMERIC, tb.gia_goc),
    nam_tinh_hao_mon = COALESCE(NULLIF(p_patch->>'nam_tinh_hao_mon','')::INT, tb.nam_tinh_hao_mon),
    ty_le_hao_mon = COALESCE(NULLIF(p_patch->>'ty_le_hao_mon',''), tb.ty_le_hao_mon),
    han_bao_hanh = COALESCE(NULLIF(p_patch->>'han_bao_hanh',''), NULLIF(tb.han_bao_hanh::TEXT,''))::DATE,
    vi_tri_lap_dat = COALESCE(NULLIF(p_patch->>'vi_tri_lap_dat',''), tb.vi_tri_lap_dat),
    nguoi_dang_truc_tiep_quan_ly = COALESCE(NULLIF(p_patch->>'nguoi_dang_truc_tiep_quan_ly',''), tb.nguoi_dang_truc_tiep_quan_ly),
    tinh_trang_hien_tai = COALESCE(NULLIF(p_patch->>'tinh_trang_hien_tai',''), tb.tinh_trang_hien_tai),
    ghi_chu = COALESCE(NULLIF(p_patch->>'ghi_chu',''), tb.ghi_chu),
    chu_ky_bt_dinh_ky = COALESCE(NULLIF(p_patch->>'chu_ky_bt_dinh_ky','')::INT, tb.chu_ky_bt_dinh_ky),
    ngay_bt_tiep_theo = COALESCE(NULLIF(p_patch->>'ngay_bt_tiep_theo',''), NULLIF(tb.ngay_bt_tiep_theo::TEXT,''))::DATE,
    chu_ky_hc_dinh_ky = COALESCE(NULLIF(p_patch->>'chu_ky_hc_dinh_ky','')::INT, tb.chu_ky_hc_dinh_ky),
    ngay_hc_tiep_theo = COALESCE(NULLIF(p_patch->>'ngay_hc_tiep_theo',''), NULLIF(tb.ngay_hc_tiep_theo::TEXT,''))::DATE,
    chu_ky_kd_dinh_ky = COALESCE(NULLIF(p_patch->>'chu_ky_kd_dinh_ky','')::INT, tb.chu_ky_kd_dinh_ky),
    ngay_kd_tiep_theo = COALESCE(NULLIF(p_patch->>'ngay_kd_tiep_theo',''), NULLIF(tb.ngay_kd_tiep_theo::TEXT,''))::DATE,
    phan_loai_theo_nd98 = COALESCE(NULLIF(p_patch->>'phan_loai_theo_nd98',''), tb.phan_loai_theo_nd98)
  WHERE tb.id = p_id
  RETURNING * INTO rec;

  RETURN rec;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_update(BIGINT, JSONB) TO authenticated;

COMMIT;

-- Keep equipment_create consistent: text->DATE normalization on insert as well
CREATE OR REPLACE FUNCTION public.equipment_create(p_payload JSONB)
RETURNS public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_khoa_phong TEXT := COALESCE(p_payload->>'khoa_phong_quan_ly', NULL);
  rec public.thiet_bi;
BEGIN
  IF v_role NOT IN ('global','to_qltb','technician') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'technician' THEN
    PERFORM 1
    FROM public.nhan_vien nv
    WHERE nv.id = (public._get_jwt_claim('user_id'))::BIGINT
      AND nv.khoa_phong = v_khoa_phong;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Technician department mismatch' USING ERRCODE = '42501';
    END IF;
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
    don_vi
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
    NULLIF(p_payload->>'ngay_nhap','')::DATE,
    NULLIF(p_payload->>'ngay_dua_vao_su_dung','')::DATE,
    NULLIF(p_payload->>'nguon_kinh_phi',''),
    NULLIF(p_payload->>'gia_goc','')::NUMERIC,
    NULLIF(p_payload->>'nam_tinh_hao_mon','')::INT,
    NULLIF(p_payload->>'ty_le_hao_mon',''),
    NULLIF(p_payload->>'han_bao_hanh','')::DATE,
    NULLIF(p_payload->>'vi_tri_lap_dat',''),
    NULLIF(p_payload->>'nguoi_dang_truc_tiep_quan_ly',''),
    NULLIF(p_payload->>'tinh_trang_hien_tai',''),
    NULLIF(p_payload->>'ghi_chu',''),
    NULLIF(p_payload->>'chu_ky_bt_dinh_ky','')::INT,
    NULLIF(p_payload->>'ngay_bt_tiep_theo','')::DATE,
    NULLIF(p_payload->>'chu_ky_hc_dinh_ky','')::INT,
    NULLIF(p_payload->>'ngay_hc_tiep_theo','')::DATE,
    NULLIF(p_payload->>'chu_ky_kd_dinh_ky','')::INT,
    NULLIF(p_payload->>'ngay_kd_tiep_theo','')::DATE,
    NULLIF(p_payload->>'phan_loai_theo_nd98',''),
    v_donvi
  )
  RETURNING * INTO rec;

  RETURN rec;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_create(JSONB) TO authenticated;
