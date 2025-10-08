-- 20250925_audit_logs_v2_instrument_rpcs.sql
-- Purpose: Instrument core RPCs to log via unified audit_log()
-- Notes:
-- - Idempotent redefinitions (CREATE OR REPLACE)
-- - Hardened with SET search_path = public, pg_temp
-- - No destructive changes to data

BEGIN;

-- Instrument equipment_create(jsonb) to log via unified helper
CREATE OR REPLACE FUNCTION public.equipment_create(p_payload jsonb)
RETURNS thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

  -- Unified audit log
  PERFORM public.audit_log(
    'equipment_create',
    'device',
    rec.id,
    COALESCE(rec.ma_thiet_bi, rec.ten_thiet_bi),
    jsonb_build_object('equipment_id', rec.id, 'equipment_name', rec.ten_thiet_bi, 'ma_thiet_bi', rec.ma_thiet_bi)
  );

  RETURN rec;
END;
$$;

-- Instrument equipment_update(bigint, jsonb) to log via unified helper
CREATE OR REPLACE FUNCTION public.equipment_update(p_id bigint, p_patch jsonb)
RETURNS thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

  -- Unified audit log
  PERFORM public.audit_log(
    'equipment_update',
    'device',
    p_id,
    COALESCE(rec.ma_thiet_bi, rec.ten_thiet_bi),
    p_patch
  );

  RETURN rec;
END;
$$;

-- Replace legacy _audit_log_insert usage in equipment_create(text,...) with unified helper
CREATE OR REPLACE FUNCTION public.equipment_create(p_ten_thiet_bi text, p_so_serial text DEFAULT NULL::text, p_mo_ta text DEFAULT NULL::text, p_khoa_phong text DEFAULT NULL::text, p_vi_tri text DEFAULT NULL::text, p_trang_thai text DEFAULT 'hoat_dong'::text, p_ngay_mua date DEFAULT CURRENT_DATE, p_gia_mua numeric DEFAULT NULL::numeric, p_han_bao_hanh date DEFAULT NULL::date, p_don_vi text DEFAULT NULL::text)
RETURNS TABLE(id bigint, ten_thiet_bi text, so_serial text, mo_ta text, khoa_phong text, vi_tri text, trang_thai text, ngay_mua date, gia_mua numeric, han_bao_hanh date, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_id BIGINT;
  current_user_ctx RECORD;
BEGIN
  SELECT * INTO current_user_ctx FROM _get_current_user_context();
  IF current_user_ctx.role NOT IN ('global', 'to_qltb', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to create equipment' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.thiet_bi (
    ten_thiet_bi, so_serial, mo_ta, khoa_phong, vi_tri,
    trang_thai, ngay_mua, gia_mua, han_bao_hanh, don_vi
  ) VALUES (
    p_ten_thiet_bi, p_so_serial, p_mo_ta, p_khoa_phong, p_vi_tri,
    p_trang_thai, p_ngay_mua, p_gia_mua, p_han_bao_hanh, 
    COALESCE(p_don_vi, current_user_ctx.don_vi)
  ) RETURNING thiet_bi.id INTO new_id;

  -- Unified audit log
  PERFORM public.audit_log(
    'equipment_create',
    'device',
    new_id,
    p_ten_thiet_bi,
    jsonb_build_object('equipment_id', new_id, 'equipment_name', p_ten_thiet_bi, 'serial_number', p_so_serial, 'department', p_khoa_phong, 'status', p_trang_thai)
  );

  RETURN QUERY
  SELECT 
    tb.id, tb.ten_thiet_bi, tb.so_serial, tb.mo_ta, tb.khoa_phong, tb.vi_tri,
    tb.trang_thai, tb.ngay_mua, tb.gia_mua, tb.han_bao_hanh, tb.created_at
  FROM thiet_bi tb
  WHERE tb.id = new_id;
END;
$$;

-- Replace legacy _audit_log_insert usage in equipment_update(text,...) with unified helper
CREATE OR REPLACE FUNCTION public.equipment_update(p_id bigint, p_ten_thiet_bi text DEFAULT NULL::text, p_so_serial text DEFAULT NULL::text, p_mo_ta text DEFAULT NULL::text, p_khoa_phong text DEFAULT NULL::text, p_vi_tri text DEFAULT NULL::text, p_trang_thai text DEFAULT NULL::text, p_ngay_mua date DEFAULT NULL::date, p_gia_mua numeric DEFAULT NULL::numeric, p_han_bao_hanh date DEFAULT NULL::date)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_ctx RECORD;
  old_record thiet_bi%ROWTYPE;
  changes_made JSONB := '{}'::JSONB;
BEGIN
  SELECT * INTO current_user_ctx FROM _get_current_user_context();
  IF current_user_ctx.role NOT IN ('global', 'to_qltb', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to update equipment' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO old_record FROM thiet_bi WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Equipment not found with ID: %', p_id; END IF;

  IF p_ten_thiet_bi IS NOT NULL AND p_ten_thiet_bi != old_record.ten_thiet_bi THEN
    changes_made := changes_made || jsonb_build_object('ten_thiet_bi', jsonb_build_object('old', old_record.ten_thiet_bi, 'new', p_ten_thiet_bi));
  END IF;
  IF p_trang_thai IS NOT NULL AND p_trang_thai != old_record.trang_thai THEN
    changes_made := changes_made || jsonb_build_object('trang_thai', jsonb_build_object('old', old_record.trang_thai, 'new', p_trang_thai));
  END IF;

  UPDATE thiet_bi SET
    ten_thiet_bi = COALESCE(p_ten_thiet_bi, ten_thiet_bi),
    so_serial = COALESCE(p_so_serial, so_serial),
    mo_ta = COALESCE(p_mo_ta, mo_ta),
    khoa_phong = COALESCE(p_khoa_phong, khoa_phong),
    vi_tri = COALESCE(p_vi_tri, vi_tri),
    trang_thai = COALESCE(p_trang_thai, trang_thai),
    ngay_mua = COALESCE(p_ngay_mua, ngay_mua),
    gia_mua = COALESCE(p_gia_mua, gia_mua),
    han_bao_hanh = COALESCE(p_han_bao_hanh, han_bao_hanh),
    updated_at = NOW()
  WHERE id = p_id;

  IF jsonb_object_keys(changes_made) IS NOT NULL THEN
    PERFORM public.audit_log(
      'equipment_update',
      'device',
      p_id,
      COALESCE(p_ten_thiet_bi, old_record.ten_thiet_bi),
      jsonb_build_object('equipment_id', p_id, 'equipment_name', COALESCE(p_ten_thiet_bi, old_record.ten_thiet_bi), 'changes', changes_made)
    );
  END IF;

  RETURN TRUE;
END;
$$;

-- Instrument repair_request_create to log via unified helper
CREATE OR REPLACE FUNCTION public.repair_request_create(p_thiet_bi_id integer, p_mo_ta_su_co text, p_hang_muc_sua_chua text, p_ngay_mong_muon_hoan_thanh date, p_nguoi_yeu_cau text, p_don_vi_thuc_hien text, p_ten_don_vi_thue text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE 
  v_id int; 
  v_claims jsonb;
  v_role text;
  v_don_vi bigint;
  v_tb record;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  v_don_vi := nullif(v_claims->>'don_vi','')::bigint;

  select id, don_vi, tinh_trang_hien_tai into v_tb from thiet_bi where id = p_thiet_bi_id;
  if not found then
    raise exception 'Thiết bị không tồn tại';
  end if;
  if v_role is distinct from 'global' and v_don_vi is not null and v_tb.don_vi is distinct from v_don_vi then
    raise exception 'Không có quyền trên thiết bị thuộc đơn vị khác';
  end if;

  insert into yeu_cau_sua_chua(thiet_bi_id, mo_ta_su_co, hang_muc_sua_chua, ngay_mong_muon_hoan_thanh, nguoi_yeu_cau, trang_thai, don_vi_thuc_hien, ten_don_vi_thue)
  values (p_thiet_bi_id, p_mo_ta_su_co, p_hang_muc_sua_chua, p_ngay_mong_muon_hoan_thanh, p_nguoi_yeu_cau, 'Chờ xử lý', p_don_vi_thuc_hien, p_ten_don_vi_thue)
  returning id into v_id;

  update thiet_bi set tinh_trang_hien_tai = 'Chờ sửa chữa'
  where id = p_thiet_bi_id and coalesce(tinh_trang_hien_tai, '') <> 'Chờ sửa chữa';

  insert into lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  values (
    p_thiet_bi_id,
    'Sửa chữa',
    'Tạo yêu cầu sửa chữa',
    jsonb_build_object(
      'mo_ta_su_co', p_mo_ta_su_co,
      'hang_muc', p_hang_muc_sua_chua,
      'ngay_mong_muon_hoan_thanh', p_ngay_mong_muon_hoan_thanh,
      'don_vi_thuc_hien', p_don_vi_thuc_hien,
      'ten_don_vi_thue', p_ten_don_vi_thue
    ),
    v_id
  );

  -- Unified audit log
  PERFORM public.audit_log(
    'repair_request_create',
    'repair_request',
    v_id,
    NULL,
    jsonb_build_object('thiet_bi_id', p_thiet_bi_id, 'mo_ta_su_co', p_mo_ta_su_co)
  );

  return v_id;
end; $$;

-- Instrument transfer_request_create(jsonb) to log via unified helper
CREATE OR REPLACE FUNCTION public.transfer_request_create(p_data jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id int;
  v_claims jsonb; v_role text; v_don_vi text; v_user_id int;
  v_tb record;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := coalesce(nullif(v_claims->>'app_role',''), nullif(v_claims->>'role',''));
  v_don_vi := nullif(v_claims->>'don_vi','');
  v_user_id := nullif(v_claims->>'user_id','')::int;

  select id, don_vi, khoa_phong_quan_ly into v_tb from thiet_bi where id = (p_data->>'thiet_bi_id')::int;
  if not found then raise exception 'Thiết bị không tồn tại'; end if;
  if v_role is distinct from 'global' and v_don_vi is not null and v_tb.don_vi::text is distinct from v_don_vi then
    raise exception 'Không có quyền trên thiết bị thuộc đơn vị khác';
  end if;

  insert into yeu_cau_luan_chuyen(
    thiet_bi_id, loai_hinh, ly_do_luan_chuyen,
    khoa_phong_hien_tai, khoa_phong_nhan,
    muc_dich, don_vi_nhan, dia_chi_don_vi, nguoi_lien_he, so_dien_thoai, ngay_du_kien_tra,
    nguoi_yeu_cau_id, trang_thai, created_by, updated_by
  ) values (
    (p_data->>'thiet_bi_id')::int,
    p_data->>'loai_hinh',
    nullif(p_data->>'ly_do_luan_chuyen',''),
    nullif(p_data->>'khoa_phong_hien_tai',''),
    nullif(p_data->>'khoa_phong_nhan',''),
    nullif(p_data->>'muc_dich',''),
    nullif(p_data->>'don_vi_nhan',''),
    nullif(p_data->>'dia_chi_don_vi',''),
    nullif(p_data->>'nguoi_lien_he',''),
    nullif(p_data->>'so_dien_thoai',''),
    (case when coalesce(p_data->>'ngay_du_kien_tra','') <> '' then (p_data->>'ngay_du_kien_tra')::date else null end),
    coalesce(nullif(p_data->>'nguoi_yeu_cau_id','')::int, v_user_id),
    'cho_duyet',
    coalesce(nullif(p_data->>'created_by','')::int, v_user_id),
    coalesce(nullif(p_data->>'updated_by','')::int, v_user_id)
  ) returning id into v_id;

  -- Unified audit log
  PERFORM public.audit_log(
    'transfer_request_create',
    'transfer_request',
    v_id,
    NULL,
    p_data
  );

  return v_id;
end; $$;

-- Convert maintenance_plan_create to plpgsql to add audit log
CREATE OR REPLACE FUNCTION public.maintenance_plan_create(p_ten_ke_hoach text, p_nam integer, p_loai_cong_viec text, p_khoa_phong text, p_nguoi_lap_ke_hoach text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id int;
BEGIN
  insert into ke_hoach_bao_tri(ten_ke_hoach, nam, loai_cong_viec, khoa_phong, nguoi_lap_ke_hoach, trang_thai)
  values (p_ten_ke_hoach, p_nam, p_loai_cong_viec, nullif(p_khoa_phong,''), p_nguoi_lap_ke_hoach, 'Bản nháp')
  returning id into v_id;

  -- Unified audit log
  PERFORM public.audit_log(
    'maintenance_plan_create',
    'maintenance_plan',
    v_id,
    p_ten_ke_hoach,
    jsonb_build_object('nam', p_nam, 'loai_cong_viec', p_loai_cong_viec, 'khoa_phong', nullif(p_khoa_phong,''))
  );

  RETURN v_id;
END;$$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
