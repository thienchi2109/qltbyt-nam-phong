-- What: validate equipment status transitions and effective end dates from the catalog.
-- Why: keep historical values editable as metadata while requiring active values for
-- transitions. No historical backfill or RBAC change is performed here.
BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_update(p_id bigint, p_patch jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_user_id BIGINT := NULLIF(public._get_jwt_claim('user_id'), '')::BIGINT;
  v_khoa_phong_new TEXT := COALESCE(p_patch->>'khoa_phong_quan_ly', NULL);
  v_patch_status TEXT := NULLIF(TRIM(p_patch->>'tinh_trang_hien_tai'), '');
  v_existing public.thiet_bi%ROWTYPE;
  v_effective_status TEXT;
  v_effective_ngay_dua_vao_su_dung TEXT;
  v_effective_ngay_ngung_su_dung TEXT;
  v_validation_ngay_ngung_su_dung TEXT;
  v_catalog_is_terminal BOOLEAN := false;
  v_catalog_requires_end_date BOOLEAN := false;
  v_status_changed BOOLEAN := false;
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role IN ('regional_leader','user') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' AND v_donvi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    SELECT *
    INTO v_existing
    FROM public.thiet_bi
    WHERE id = p_id AND don_vi = v_donvi
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Access denied for update' USING ERRCODE = '42501';
    END IF;
  ELSE
    SELECT *
    INTO v_existing
    FROM public.thiet_bi
    WHERE id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Equipment not found with ID: %', p_id;
    END IF;
  END IF;

  IF v_role = 'technician' AND v_khoa_phong_new IS NOT NULL THEN
    PERFORM 1
    FROM public.nhan_vien nv
    WHERE nv.id = v_user_id
      AND nv.khoa_phong = v_khoa_phong_new;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Technician department mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_effective_status := CASE
    WHEN p_patch ? 'tinh_trang_hien_tai' THEN v_patch_status
    ELSE v_existing.tinh_trang_hien_tai
  END;

  v_effective_ngay_dua_vao_su_dung := CASE
    WHEN p_patch ? 'ngay_dua_vao_su_dung' THEN NULLIF(TRIM(p_patch->>'ngay_dua_vao_su_dung'), '')
    ELSE v_existing.ngay_dua_vao_su_dung
  END;

  v_effective_ngay_ngung_su_dung := CASE
    WHEN p_patch ? 'ngay_ngung_su_dung' THEN NULLIF(TRIM(p_patch->>'ngay_ngung_su_dung'), '')
    ELSE v_existing.ngay_ngung_su_dung
  END;

  v_validation_ngay_ngung_su_dung := NULLIF(TRIM(v_effective_ngay_ngung_su_dung), '');

  v_status_changed := p_patch ? 'tinh_trang_hien_tai'
    AND v_patch_status IS DISTINCT FROM v_existing.tinh_trang_hien_tai;

  IF p_patch ? 'tinh_trang_hien_tai' AND v_patch_status IS NOT NULL THEN
    SELECT is_terminal, requires_end_date
      INTO v_catalog_is_terminal, v_catalog_requires_end_date
    FROM public.equipment_status_catalog
    WHERE status_value = v_patch_status AND (NOT v_status_changed OR is_active);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid status: %. Must be one of: %', v_patch_status,
        (SELECT string_agg(status_value, ', ' ORDER BY display_order)
         FROM public.equipment_status_catalog WHERE is_active)
        USING ERRCODE = '22023';
    END IF;
  ELSIF v_effective_status IS NOT NULL THEN
    SELECT is_terminal, requires_end_date
      INTO v_catalog_is_terminal, v_catalog_requires_end_date
    FROM public.equipment_status_catalog
    WHERE status_value = v_effective_status;
  END IF;

  IF v_status_changed AND v_catalog_requires_end_date
    AND v_validation_ngay_ngung_su_dung IS NULL THEN
    v_effective_ngay_ngung_su_dung := to_char(transaction_timestamp()
      AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');
    v_validation_ngay_ngung_su_dung := v_effective_ngay_ngung_su_dung;
  ELSIF NOT v_status_changed
    AND v_catalog_requires_end_date
    AND p_patch ? 'ngay_ngung_su_dung'
    AND v_validation_ngay_ngung_su_dung IS NULL THEN
    RAISE EXCEPTION 'Thanh lý nội bộ requires ngày ngừng sử dụng'
      USING ERRCODE = '22023';
  END IF;

  IF v_validation_ngay_ngung_su_dung IS NOT NULL
    AND (NOT COALESCE(v_catalog_is_terminal, false) OR v_effective_status IS NULL) THEN
    RAISE EXCEPTION 'Ngày ngừng sử dụng chỉ được phép khi tình trạng là "Ngưng sử dụng"'
      USING ERRCODE = '22023';
  END IF;

  BEGIN
    IF v_validation_ngay_ngung_su_dung IS NOT NULL AND (
      v_validation_ngay_ngung_su_dung !~ '^\d{4}-\d{2}-\d{2}$'
      OR to_char(to_date(v_validation_ngay_ngung_su_dung, 'YYYY-MM-DD'), 'YYYY-MM-DD') <> v_validation_ngay_ngung_su_dung
    ) THEN
      RAISE EXCEPTION 'Định dạng ngày không hợp lệ. Sử dụng: YYYY-MM-DD'
        USING ERRCODE = '22023';
    END IF;

    IF
      v_validation_ngay_ngung_su_dung IS NOT NULL
      AND v_effective_ngay_dua_vao_su_dung IS NOT NULL
      AND v_effective_ngay_dua_vao_su_dung ~ '^\d{4}-\d{2}-\d{2}$'
      AND to_char(to_date(v_effective_ngay_dua_vao_su_dung, 'YYYY-MM-DD'), 'YYYY-MM-DD') = v_effective_ngay_dua_vao_su_dung
      AND v_validation_ngay_ngung_su_dung < v_effective_ngay_dua_vao_su_dung
    THEN
      RAISE EXCEPTION 'Ngày ngừng sử dụng phải sau hoặc bằng ngày đưa vào sử dụng'
        USING ERRCODE = '22023';
    END IF;
  EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
    RAISE EXCEPTION 'Định dạng ngày không hợp lệ. Sử dụng: YYYY-MM-DD'
      USING ERRCODE = '22023';
  END;

  UPDATE public.thiet_bi SET
    ten_thiet_bi = CASE WHEN p_patch ? 'ten_thiet_bi' THEN NULLIF(p_patch->>'ten_thiet_bi', '') ELSE ten_thiet_bi END,
    ma_thiet_bi = CASE WHEN p_patch ? 'ma_thiet_bi' THEN NULLIF(p_patch->>'ma_thiet_bi', '') ELSE ma_thiet_bi END,
    model = CASE WHEN p_patch ? 'model' THEN NULLIF(p_patch->>'model', '') ELSE model END,
    serial = CASE WHEN p_patch ? 'serial' THEN NULLIF(p_patch->>'serial', '') ELSE serial END,
    cau_hinh_thiet_bi = CASE WHEN p_patch ? 'cau_hinh_thiet_bi' THEN NULLIF(p_patch->>'cau_hinh_thiet_bi', '') ELSE cau_hinh_thiet_bi END,
    phu_kien_kem_theo = CASE WHEN p_patch ? 'phu_kien_kem_theo' THEN NULLIF(p_patch->>'phu_kien_kem_theo', '') ELSE phu_kien_kem_theo END,
    hang_san_xuat = CASE WHEN p_patch ? 'hang_san_xuat' THEN NULLIF(p_patch->>'hang_san_xuat', '') ELSE hang_san_xuat END,
    noi_san_xuat = CASE WHEN p_patch ? 'noi_san_xuat' THEN NULLIF(p_patch->>'noi_san_xuat', '') ELSE noi_san_xuat END,
    nam_san_xuat = CASE
      WHEN p_patch ? 'nam_san_xuat' AND p_patch->>'nam_san_xuat' <> '' THEN (p_patch->>'nam_san_xuat')::INTEGER
      WHEN p_patch ? 'nam_san_xuat' THEN NULL
      ELSE nam_san_xuat
    END,
    ngay_nhap = CASE WHEN p_patch ? 'ngay_nhap' THEN NULLIF(p_patch->>'ngay_nhap', '') ELSE ngay_nhap END,
    ngay_dua_vao_su_dung = CASE WHEN p_patch ? 'ngay_dua_vao_su_dung' THEN NULLIF(p_patch->>'ngay_dua_vao_su_dung', '') ELSE ngay_dua_vao_su_dung END,
    ngay_ngung_su_dung = v_effective_ngay_ngung_su_dung,
    han_bao_hanh = CASE WHEN p_patch ? 'han_bao_hanh' THEN NULLIF(p_patch->>'han_bao_hanh', '') ELSE han_bao_hanh END,
    nguon_kinh_phi = CASE WHEN p_patch ? 'nguon_kinh_phi' THEN NULLIF(p_patch->>'nguon_kinh_phi', '') ELSE nguon_kinh_phi END,
    gia_goc = CASE
      WHEN p_patch ? 'gia_goc' AND p_patch->>'gia_goc' <> '' THEN (p_patch->>'gia_goc')::DECIMAL
      WHEN p_patch ? 'gia_goc' THEN NULL
      ELSE gia_goc
    END,
    nam_tinh_hao_mon = CASE
      WHEN p_patch ? 'nam_tinh_hao_mon' AND p_patch->>'nam_tinh_hao_mon' <> '' THEN (p_patch->>'nam_tinh_hao_mon')::INTEGER
      WHEN p_patch ? 'nam_tinh_hao_mon' THEN NULL
      ELSE nam_tinh_hao_mon
    END,
    ty_le_hao_mon = CASE WHEN p_patch ? 'ty_le_hao_mon' THEN NULLIF(p_patch->>'ty_le_hao_mon', '') ELSE ty_le_hao_mon END,
    khoa_phong_quan_ly = CASE WHEN p_patch ? 'khoa_phong_quan_ly' THEN NULLIF(p_patch->>'khoa_phong_quan_ly', '') ELSE khoa_phong_quan_ly END,
    vi_tri_lap_dat = CASE WHEN p_patch ? 'vi_tri_lap_dat' THEN NULLIF(p_patch->>'vi_tri_lap_dat', '') ELSE vi_tri_lap_dat END,
    nguoi_dang_truc_tiep_quan_ly = CASE WHEN p_patch ? 'nguoi_dang_truc_tiep_quan_ly' THEN NULLIF(p_patch->>'nguoi_dang_truc_tiep_quan_ly', '') ELSE nguoi_dang_truc_tiep_quan_ly END,
    tinh_trang_hien_tai = CASE WHEN p_patch ? 'tinh_trang_hien_tai' THEN v_patch_status ELSE tinh_trang_hien_tai END,
    ghi_chu = CASE WHEN p_patch ? 'ghi_chu' THEN NULLIF(p_patch->>'ghi_chu', '') ELSE ghi_chu END,
    chu_ky_bt_dinh_ky = CASE
      WHEN p_patch ? 'chu_ky_bt_dinh_ky' AND p_patch->>'chu_ky_bt_dinh_ky' <> '' THEN (p_patch->>'chu_ky_bt_dinh_ky')::INTEGER
      WHEN p_patch ? 'chu_ky_bt_dinh_ky' THEN NULL
      ELSE chu_ky_bt_dinh_ky
    END,
    chu_ky_hc_dinh_ky = CASE
      WHEN p_patch ? 'chu_ky_hc_dinh_ky' AND p_patch->>'chu_ky_hc_dinh_ky' <> '' THEN (p_patch->>'chu_ky_hc_dinh_ky')::INTEGER
      WHEN p_patch ? 'chu_ky_hc_dinh_ky' THEN NULL
      ELSE chu_ky_hc_dinh_ky
    END,
    chu_ky_kd_dinh_ky = CASE
      WHEN p_patch ? 'chu_ky_kd_dinh_ky' AND p_patch->>'chu_ky_kd_dinh_ky' <> '' THEN (p_patch->>'chu_ky_kd_dinh_ky')::INTEGER
      WHEN p_patch ? 'chu_ky_kd_dinh_ky' THEN NULL
      ELSE chu_ky_kd_dinh_ky
    END,
    ngay_bt_tiep_theo = CASE
      WHEN p_patch ? 'ngay_bt_tiep_theo' AND p_patch->>'ngay_bt_tiep_theo' <> '' THEN (p_patch->>'ngay_bt_tiep_theo')::DATE
      WHEN p_patch ? 'ngay_bt_tiep_theo' THEN NULL
      ELSE ngay_bt_tiep_theo
    END,
    ngay_hc_tiep_theo = CASE
      WHEN p_patch ? 'ngay_hc_tiep_theo' AND p_patch->>'ngay_hc_tiep_theo' <> '' THEN (p_patch->>'ngay_hc_tiep_theo')::DATE
      WHEN p_patch ? 'ngay_hc_tiep_theo' THEN NULL
      ELSE ngay_hc_tiep_theo
    END,
    ngay_kd_tiep_theo = CASE
      WHEN p_patch ? 'ngay_kd_tiep_theo' AND p_patch->>'ngay_kd_tiep_theo' <> '' THEN (p_patch->>'ngay_kd_tiep_theo')::DATE
      WHEN p_patch ? 'ngay_kd_tiep_theo' THEN NULL
      ELSE ngay_kd_tiep_theo
    END,
    phan_loai_theo_nd98 = CASE WHEN p_patch ? 'phan_loai_theo_nd98' THEN NULLIF(p_patch->>'phan_loai_theo_nd98', '') ELSE phan_loai_theo_nd98 END,
    so_luu_hanh = CASE WHEN p_patch ? 'so_luu_hanh' THEN NULLIF(p_patch->>'so_luu_hanh', '') ELSE so_luu_hanh END
  WHERE id = p_id;

  RETURN TRUE;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.equipment_update(bigint, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.equipment_update(bigint, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.equipment_update(bigint, jsonb) FROM anon;

COMMIT;
