-- Migration: add role=user department scope to workflow guard RPCs
-- Date: 2026-04-22
-- Scope: Issue #302 workflow-family only
--
-- Notes:
-- - Reuse public._normalize_department_scope(text) introduced by Issue #301.
-- - Preserve current tenant guards and non-user behavior.
-- - Keep existing row-lock, audit, and P0002 behavior unchanged where already established.
-- Rollback:
-- - Forward-only. Restore the prior RPC bodies in a new timestamped migration
--   if this batch must be reverted.

BEGIN;

CREATE OR REPLACE FUNCTION public.repair_request_create(
  p_thiet_bi_id integer,
  p_mo_ta_su_co text,
  p_hang_muc_sua_chua text,
  p_ngay_mong_muon_hoan_thanh date,
  p_nguoi_yeu_cau text,
  p_don_vi_thuc_hien text,
  p_ten_don_vi_thue text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_id integer;
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_user_id bigint;
  v_don_vi bigint;
  v_department_scope text;
  v_tb record;
  v_snapshot_status text;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}'::text)::jsonb;
  v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')));
  v_is_global := v_role in ('global', 'admin');
  v_user_id := nullif(v_claims->>'user_id', '')::bigint;
  v_don_vi := nullif(v_claims->>'don_vi', '')::bigint;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING errcode = '42501';
  END IF;

  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING errcode = '42501';
  END IF;

  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim for non-global role %', v_role USING errcode = '42501';
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_claims->>'khoa_phong');
  END IF;

  SELECT tb.id, tb.don_vi, tb.khoa_phong_quan_ly, tb.tinh_trang_hien_tai
  INTO v_tb
  FROM public.thiet_bi tb
  WHERE tb.id = p_thiet_bi_id
    AND tb.is_deleted = false
  FOR UPDATE OF tb;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thiết bị không tồn tại' USING errcode = 'P0002';
  END IF;

  IF NOT v_is_global AND v_tb.don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING errcode = '42501';
  END IF;

  IF v_role = 'user'
     AND (
       v_department_scope IS NULL
       OR public._normalize_department_scope(v_tb.khoa_phong_quan_ly) IS DISTINCT FROM v_department_scope
     ) THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc khoa/phòng khác' USING errcode = '42501';
  END IF;

  v_snapshot_status := v_tb.tinh_trang_hien_tai;

  IF v_tb.tinh_trang_hien_tai = 'Chờ sửa chữa' THEN
    SELECT ycss.tinh_trang_thiet_bi_truoc_yeu_cau
    INTO v_snapshot_status
    FROM public.yeu_cau_sua_chua ycss
    WHERE ycss.thiet_bi_id = p_thiet_bi_id
      AND ycss.trang_thai IN ('Chờ xử lý', 'Đã duyệt', 'Không HT')
      AND ycss.tinh_trang_thiet_bi_truoc_yeu_cau IS NOT NULL
      AND ycss.tinh_trang_thiet_bi_truoc_yeu_cau <> 'Chờ sửa chữa'
    ORDER BY ycss.id DESC
    LIMIT 1;

    v_snapshot_status := coalesce(
      v_snapshot_status,
      nullif(v_tb.tinh_trang_hien_tai, 'Chờ sửa chữa'),
      'Hoạt động'
    );
  END IF;

  INSERT INTO public.yeu_cau_sua_chua(
    thiet_bi_id,
    mo_ta_su_co,
    hang_muc_sua_chua,
    ngay_mong_muon_hoan_thanh,
    nguoi_yeu_cau,
    trang_thai,
    don_vi_thuc_hien,
    ten_don_vi_thue,
    tinh_trang_thiet_bi_truoc_yeu_cau
  )
  VALUES (
    p_thiet_bi_id,
    p_mo_ta_su_co,
    p_hang_muc_sua_chua,
    p_ngay_mong_muon_hoan_thanh,
    p_nguoi_yeu_cau,
    'Chờ xử lý',
    p_don_vi_thuc_hien,
    p_ten_don_vi_thue,
    v_snapshot_status
  )
  RETURNING id INTO v_id;

  PERFORM public.repair_request_sync_equipment_status(p_thiet_bi_id::bigint);

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  VALUES (
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

  IF NOT public.audit_log(
    'repair_request_create',
    'repair_request',
    v_id,
    NULL,
    jsonb_build_object(
      'thiet_bi_id', p_thiet_bi_id,
      'mo_ta_su_co', p_mo_ta_su_co
    )
  ) THEN
    RAISE EXCEPTION 'audit_log failed for repair_request %', v_id;
  END IF;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_request_create(integer, text, text, date, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_create(integer, text, text, date, text, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.transfer_request_create(
  p_data jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id int;
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_don_vi text;
  v_user_id int;
  v_department_scope text;
  v_tb record;
BEGIN
  v_claims := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role := lower(coalesce(nullif(v_claims->>'app_role', ''), nullif(v_claims->>'role', '')));
  v_is_global := v_role in ('global', 'admin');
  v_don_vi := nullif(v_claims->>'don_vi', '');
  v_user_id := nullif(v_claims->>'user_id', '')::int;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING errcode = '42501';
  END IF;

  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Regional leaders have read-only access to transfers' USING errcode = '42501';
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_claims->>'khoa_phong');
  END IF;

  SELECT id, don_vi, khoa_phong_quan_ly
  INTO v_tb
  FROM public.thiet_bi
  WHERE id = (p_data->>'thiet_bi_id')::int
    AND is_deleted = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thiết bị không tồn tại' USING errcode = 'P0002';
  END IF;

  IF NOT v_is_global AND v_don_vi IS NOT NULL AND v_tb.don_vi::text IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING errcode = '42501';
  END IF;

  IF v_role = 'user'
     AND (
       v_department_scope IS NULL
       OR public._normalize_department_scope(v_tb.khoa_phong_quan_ly) IS DISTINCT FROM v_department_scope
     ) THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc khoa/phòng khác' USING errcode = '42501';
  END IF;

  INSERT INTO public.yeu_cau_luan_chuyen(
    thiet_bi_id,
    loai_hinh,
    ly_do_luan_chuyen,
    khoa_phong_hien_tai,
    khoa_phong_nhan,
    muc_dich,
    don_vi_nhan,
    dia_chi_don_vi,
    nguoi_lien_he,
    so_dien_thoai,
    ngay_du_kien_tra,
    nguoi_yeu_cau_id,
    trang_thai,
    created_by,
    updated_by
  )
  VALUES (
    (p_data->>'thiet_bi_id')::int,
    p_data->>'loai_hinh',
    nullif(p_data->>'ly_do_luan_chuyen', ''),
    nullif(p_data->>'khoa_phong_hien_tai', ''),
    nullif(p_data->>'khoa_phong_nhan', ''),
    nullif(p_data->>'muc_dich', ''),
    nullif(p_data->>'don_vi_nhan', ''),
    nullif(p_data->>'dia_chi_don_vi', ''),
    nullif(p_data->>'nguoi_lien_he', ''),
    nullif(p_data->>'so_dien_thoai', ''),
    CASE
      WHEN coalesce(p_data->>'ngay_du_kien_tra', '') <> '' THEN (p_data->>'ngay_du_kien_tra')::date
      ELSE NULL
    END,
    v_user_id,
    'cho_duyet',
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_id;

  PERFORM public.audit_log(
    'transfer_request_create',
    'transfer_request',
    v_id,
    NULL,
    p_data - 'created_by' - 'updated_by' - 'nguoi_yeu_cau_id'
  );

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.transfer_request_create(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_create(jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.maintenance_tasks_bulk_insert(p_tasks JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
  v_department_scope TEXT := NULL;
  v_item JSONB;
  v_thiet_bi_id BIGINT;
  v_equipment_scope TEXT;
BEGIN
  IF v_role = 'regional_leader' THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Không có quyền thêm công việc bảo trì' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(public._get_jwt_claim('khoa_phong'));
    IF v_department_scope IS NULL THEN
      RAISE EXCEPTION 'Không có quyền thêm công việc bảo trì' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_tasks IS NULL OR jsonb_array_length(p_tasks) = 0 THEN
    RETURN;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_tasks) AS value LOOP
    v_thiet_bi_id := NULLIF(v_item->>'thiet_bi_id', '')::BIGINT;

    IF v_role <> 'global' AND v_thiet_bi_id IS NOT NULL THEN
      SELECT public._normalize_department_scope(tb.khoa_phong_quan_ly)
      INTO v_equipment_scope
      FROM public.thiet_bi tb
      WHERE tb.id = v_thiet_bi_id
        AND tb.don_vi = ANY(v_allowed);

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
      END IF;

      IF v_role = 'user' AND v_equipment_scope IS DISTINCT FROM v_department_scope THEN
        RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc khoa/phòng khác' USING ERRCODE = '42501';
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.cong_viec_bao_tri (
    ke_hoach_id,
    thiet_bi_id,
    loai_cong_viec,
    diem_hieu_chuan,
    don_vi_thuc_hien,
    thang_1, thang_2, thang_3, thang_4, thang_5, thang_6, thang_7, thang_8, thang_9, thang_10, thang_11, thang_12,
    ghi_chu
  )
  SELECT
    (t->>'ke_hoach_id')::BIGINT,
    NULLIF(t->>'thiet_bi_id', '')::BIGINT,
    t->>'loai_cong_viec',
    t->>'diem_hieu_chuan',
    t->>'don_vi_thuc_hien',
    COALESCE((t->>'thang_1')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_2')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_3')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_4')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_5')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_6')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_7')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_8')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_9')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_10')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_11')::BOOLEAN, FALSE),
    COALESCE((t->>'thang_12')::BOOLEAN, FALSE),
    t->>'ghi_chu'
  FROM jsonb_array_elements(p_tasks) AS t;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_tasks_bulk_insert(JSONB) TO authenticated;

COMMIT;
