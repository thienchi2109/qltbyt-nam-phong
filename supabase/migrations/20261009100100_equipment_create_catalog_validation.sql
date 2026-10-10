-- What: replace the equipment create status literal list with active catalog admission.
-- Why: make new status values metadata-driven while preserving existing field, tenant,
-- and role contracts. No historical backfill or RBAC change is performed here.
BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_create(p_payload jsonb)
RETURNS thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_user_id BIGINT := NULLIF(public._get_jwt_claim('user_id'), '')::BIGINT;
  v_khoa_phong TEXT := COALESCE(p_payload->>'khoa_phong_quan_ly', NULL);
  v_status TEXT := NULLIF(TRIM(p_payload->>'tinh_trang_hien_tai'), '');
  v_ngay_dua_vao_su_dung TEXT := NULLIF(TRIM(p_payload->>'ngay_dua_vao_su_dung'), '');
  v_ngay_ngung_su_dung TEXT := NULLIF(TRIM(p_payload->>'ngay_ngung_su_dung'), '');
  v_catalog_is_terminal BOOLEAN := false;
  v_catalog_requires_end_date BOOLEAN := false;
  rec public.thiet_bi;
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN ('global','to_qltb','technician') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' AND v_donvi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'technician' THEN
    PERFORM 1
    FROM public.nhan_vien nv
    WHERE nv.id = v_user_id
      AND nv.khoa_phong = v_khoa_phong;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Technician department mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_status IS NOT NULL THEN
    SELECT is_terminal, requires_end_date
      INTO v_catalog_is_terminal, v_catalog_requires_end_date
    FROM public.equipment_status_catalog
    WHERE status_value = v_status AND is_active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid status: %. Must be one of: %', v_status,
        (SELECT string_agg(status_value, ', ' ORDER BY display_order)
         FROM public.equipment_status_catalog WHERE is_active)
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_catalog_requires_end_date AND v_ngay_ngung_su_dung IS NULL THEN
    v_ngay_ngung_su_dung := to_char(transaction_timestamp()
      AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');
  END IF;

  IF v_ngay_ngung_su_dung IS NOT NULL
    AND (NOT v_catalog_is_terminal OR v_status IS NULL) THEN
    RAISE EXCEPTION 'Ngày ngừng sử dụng chỉ được phép khi tình trạng là "Ngưng sử dụng"'
      USING ERRCODE = '22023';
  END IF;

  BEGIN
    IF v_ngay_ngung_su_dung IS NOT NULL AND (
      v_ngay_ngung_su_dung !~ '^\d{4}-\d{2}-\d{2}$'
      OR to_char(to_date(v_ngay_ngung_su_dung, 'YYYY-MM-DD'), 'YYYY-MM-DD') <> v_ngay_ngung_su_dung
    ) THEN
      RAISE EXCEPTION 'Định dạng ngày không hợp lệ. Sử dụng: YYYY-MM-DD'
        USING ERRCODE = '22023';
    END IF;

    IF
      v_ngay_ngung_su_dung IS NOT NULL
      AND v_ngay_dua_vao_su_dung IS NOT NULL
      AND v_ngay_dua_vao_su_dung ~ '^\d{4}-\d{2}-\d{2}$'
      AND to_char(to_date(v_ngay_dua_vao_su_dung, 'YYYY-MM-DD'), 'YYYY-MM-DD') = v_ngay_dua_vao_su_dung
      AND v_ngay_ngung_su_dung < v_ngay_dua_vao_su_dung
    THEN
      RAISE EXCEPTION 'Ngày ngừng sử dụng phải sau hoặc bằng ngày đưa vào sử dụng'
        USING ERRCODE = '22023';
    END IF;
  EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
    RAISE EXCEPTION 'Định dạng ngày không hợp lệ. Sử dụng: YYYY-MM-DD'
      USING ERRCODE = '22023';
  END;

  INSERT INTO public.thiet_bi (
    ten_thiet_bi,
    ma_thiet_bi,
    khoa_phong_quan_ly,
    model,
    serial,
    cau_hinh_thiet_bi,
    phu_kien_kem_theo,
    hang_san_xuat,
    noi_san_xuat,
    nam_san_xuat,
    ngay_nhap,
    ngay_dua_vao_su_dung,
    ngay_ngung_su_dung,
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
    nguon_nhap,
    so_luu_hanh
  )
  VALUES (
    p_payload->>'ten_thiet_bi',
    p_payload->>'ma_thiet_bi',
    v_khoa_phong,
    NULLIF(p_payload->>'model',''),
    NULLIF(p_payload->>'serial',''),
    NULLIF(p_payload->>'cau_hinh_thiet_bi',''),
    NULLIF(p_payload->>'phu_kien_kem_theo',''),
    NULLIF(p_payload->>'hang_san_xuat',''),
    NULLIF(p_payload->>'noi_san_xuat',''),
    NULLIF(p_payload->>'nam_san_xuat','')::INT,
    NULLIF(p_payload->>'ngay_nhap',''),
    v_ngay_dua_vao_su_dung,
    v_ngay_ngung_su_dung,
    NULLIF(p_payload->>'nguon_kinh_phi',''),
    NULLIF(p_payload->>'gia_goc','')::NUMERIC,
    NULLIF(p_payload->>'nam_tinh_hao_mon','')::INT,
    NULLIF(p_payload->>'ty_le_hao_mon',''),
    NULLIF(p_payload->>'han_bao_hanh',''),
    NULLIF(p_payload->>'vi_tri_lap_dat',''),
    NULLIF(p_payload->>'nguoi_dang_truc_tiep_quan_ly',''),
    v_status,
    NULLIF(p_payload->>'ghi_chu',''),
    NULLIF(p_payload->>'chu_ky_bt_dinh_ky','')::INT,
    CASE WHEN COALESCE(p_payload->>'ngay_bt_tiep_theo','') = '' THEN NULL ELSE (p_payload->>'ngay_bt_tiep_theo')::DATE END,
    NULLIF(p_payload->>'chu_ky_hc_dinh_ky','')::INT,
    CASE WHEN COALESCE(p_payload->>'ngay_hc_tiep_theo','') = '' THEN NULL ELSE (p_payload->>'ngay_hc_tiep_theo')::DATE END,
    NULLIF(p_payload->>'chu_ky_kd_dinh_ky','')::INT,
    CASE WHEN COALESCE(p_payload->>'ngay_kd_tiep_theo','') = '' THEN NULL ELSE (p_payload->>'ngay_kd_tiep_theo')::DATE END,
    NULLIF(p_payload->>'phan_loai_theo_nd98',''),
    v_donvi,
    COALESCE(NULLIF(p_payload->>'nguon_nhap',''), 'manual'),
    NULLIF(p_payload->>'so_luu_hanh','')
  )
  RETURNING * INTO rec;

  RETURN rec;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.equipment_create(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.equipment_create(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.equipment_create(jsonb) FROM anon;

COMMIT;
