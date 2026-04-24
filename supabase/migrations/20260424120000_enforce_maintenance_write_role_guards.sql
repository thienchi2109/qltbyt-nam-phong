-- 20260424120000_enforce_maintenance_write_role_guards.sql
-- Purpose: Enforce Issue #309 server-side role guards for maintenance plan/task write RPCs.
-- Policy: role=user and regional_leader are read-only for maintenance writes; existing allowed
-- roles keep same-tenant write behavior.

BEGIN;

CREATE OR REPLACE FUNCTION public._assert_maintenance_write_allowed()
RETURNS TABLE (
  role_name text,
  is_global boolean,
  allowed_don_vi bigint[],
  default_don_vi bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_user_id text;
  v_allowed bigint[] := ARRAY[]::bigint[];
BEGIN
  v_role := lower(COALESCE(NULLIF(public._get_jwt_claim('app_role'), ''), NULLIF(public._get_jwt_claim('role'), '')));
  v_user_id := NULLIF(COALESCE(public._get_jwt_claim('user_id'), public._get_jwt_claim('sub')), '');

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim in JWT' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim in JWT' USING ERRCODE = '42501';
  END IF;

  IF v_role IN ('user', 'regional_leader') THEN
    RAISE EXCEPTION 'Không có quyền ghi dữ liệu bảo trì' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'global' THEN
    role_name := v_role;
    is_global := true;
    allowed_don_vi := NULL;
    default_don_vi := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  v_allowed := public.allowed_don_vi_for_session_safe();
  IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
    RAISE EXCEPTION 'Không có quyền ghi dữ liệu bảo trì' USING ERRCODE = '42501';
  END IF;

  role_name := v_role;
  is_global := false;
  allowed_don_vi := v_allowed;
  default_don_vi := v_allowed[1];
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._assert_maintenance_write_allowed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._assert_maintenance_write_allowed() TO authenticated;

CREATE OR REPLACE FUNCTION public.maintenance_plan_create(
  p_ten_ke_hoach text,
  p_nam integer,
  p_loai_cong_viec text,
  p_khoa_phong text,
  p_nguoi_lap_ke_hoach text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard record;
  v_new_id integer;
BEGIN
  SELECT * INTO v_guard FROM public._assert_maintenance_write_allowed();

  INSERT INTO public.ke_hoach_bao_tri(
    ten_ke_hoach,
    nam,
    loai_cong_viec,
    khoa_phong,
    nguoi_lap_ke_hoach,
    trang_thai,
    don_vi
  )
  VALUES (
    p_ten_ke_hoach,
    p_nam,
    p_loai_cong_viec,
    NULLIF(p_khoa_phong, ''),
    p_nguoi_lap_ke_hoach,
    'Bản nháp',
    v_guard.default_don_vi
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintenance_plan_update(
  p_id bigint,
  p_ten_ke_hoach text,
  p_nam integer,
  p_loai_cong_viec text,
  p_khoa_phong text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard record;
  v_plan public.ke_hoach_bao_tri;
BEGIN
  SELECT * INTO v_guard FROM public._assert_maintenance_write_allowed();

  SELECT *
  INTO v_plan
  FROM public.ke_hoach_bao_tri
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kế hoạch không tồn tại' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_guard.is_global AND (v_plan.don_vi IS NULL OR NOT v_plan.don_vi = ANY(v_guard.allowed_don_vi)) THEN
    RAISE EXCEPTION 'Không có quyền trên kế hoạch bảo trì thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  UPDATE public.ke_hoach_bao_tri
  SET ten_ke_hoach = COALESCE(p_ten_ke_hoach, ten_ke_hoach),
      nam = COALESCE(p_nam, nam),
      loai_cong_viec = COALESCE(p_loai_cong_viec, loai_cong_viec),
      khoa_phong = NULLIF(p_khoa_phong, '')
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintenance_plan_delete(p_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard record;
  v_plan public.ke_hoach_bao_tri;
BEGIN
  SELECT * INTO v_guard FROM public._assert_maintenance_write_allowed();

  SELECT *
  INTO v_plan
  FROM public.ke_hoach_bao_tri
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT v_guard.is_global AND (v_plan.don_vi IS NULL OR NOT v_plan.don_vi = ANY(v_guard.allowed_don_vi)) THEN
    RAISE EXCEPTION 'Không có quyền trên kế hoạch bảo trì thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.ke_hoach_bao_tri WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintenance_plan_approve(p_id bigint, p_nguoi_duyet text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard record;
  v_plan public.ke_hoach_bao_tri;
BEGIN
  SELECT * INTO v_guard FROM public._assert_maintenance_write_allowed();

  SELECT *
  INTO v_plan
  FROM public.ke_hoach_bao_tri
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT v_guard.is_global AND (v_plan.don_vi IS NULL OR NOT v_plan.don_vi = ANY(v_guard.allowed_don_vi)) THEN
    RAISE EXCEPTION 'Không có quyền trên kế hoạch bảo trì thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  UPDATE public.ke_hoach_bao_tri
  SET trang_thai = 'Đã duyệt',
      ngay_phe_duyet = now(),
      nguoi_duyet = p_nguoi_duyet
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintenance_plan_reject(p_id bigint, p_nguoi_duyet text, p_ly_do text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard record;
  v_plan public.ke_hoach_bao_tri;
BEGIN
  SELECT * INTO v_guard FROM public._assert_maintenance_write_allowed();

  SELECT *
  INTO v_plan
  FROM public.ke_hoach_bao_tri
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT v_guard.is_global AND (v_plan.don_vi IS NULL OR NOT v_plan.don_vi = ANY(v_guard.allowed_don_vi)) THEN
    RAISE EXCEPTION 'Không có quyền trên kế hoạch bảo trì thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  UPDATE public.ke_hoach_bao_tri
  SET trang_thai = 'Không duyệt',
      ngay_phe_duyet = now(),
      nguoi_duyet = p_nguoi_duyet,
      ly_do_khong_duyet = p_ly_do
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintenance_tasks_bulk_insert(p_tasks jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard record;
  v_item jsonb;
  v_ke_hoach_id bigint;
  v_thiet_bi_id bigint;
  v_plan public.ke_hoach_bao_tri;
  v_equipment_don_vi bigint;
BEGIN
  SELECT * INTO v_guard FROM public._assert_maintenance_write_allowed();

  IF p_tasks IS NULL OR jsonb_array_length(p_tasks) = 0 THEN
    RETURN;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_tasks) AS value LOOP
    v_ke_hoach_id := NULLIF(v_item->>'ke_hoach_id', '')::bigint;
    v_thiet_bi_id := NULLIF(v_item->>'thiet_bi_id', '')::bigint;

    SELECT *
    INTO v_plan
    FROM public.ke_hoach_bao_tri
    WHERE id = v_ke_hoach_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Kế hoạch bảo trì không tồn tại' USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_guard.is_global AND (v_plan.don_vi IS NULL OR NOT v_plan.don_vi = ANY(v_guard.allowed_don_vi)) THEN
      RAISE EXCEPTION 'Không có quyền thêm công việc bảo trì cho kế hoạch thuộc đơn vị khác' USING ERRCODE = '42501';
    END IF;

    IF v_thiet_bi_id IS NOT NULL THEN
      SELECT don_vi
      INTO v_equipment_don_vi
      FROM public.thiet_bi
      WHERE id = v_thiet_bi_id
        AND is_deleted = false
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Thiết bị không tồn tại' USING ERRCODE = 'P0002';
      END IF;

      IF NOT v_guard.is_global AND (v_equipment_don_vi IS NULL OR NOT v_equipment_don_vi = ANY(v_guard.allowed_don_vi)) THEN
        RAISE EXCEPTION 'Không có quyền thêm công việc bảo trì cho thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.cong_viec_bao_tri (
    ke_hoach_id, thiet_bi_id, loai_cong_viec, diem_hieu_chuan, don_vi_thuc_hien,
    thang_1, thang_2, thang_3, thang_4, thang_5, thang_6,
    thang_7, thang_8, thang_9, thang_10, thang_11, thang_12, ghi_chu
  )
  SELECT
    (t->>'ke_hoach_id')::bigint, NULLIF(t->>'thiet_bi_id', '')::bigint,
    t->>'loai_cong_viec', t->>'diem_hieu_chuan', t->>'don_vi_thuc_hien',
    COALESCE((t->>'thang_1')::boolean, false), COALESCE((t->>'thang_2')::boolean, false),
    COALESCE((t->>'thang_3')::boolean, false), COALESCE((t->>'thang_4')::boolean, false),
    COALESCE((t->>'thang_5')::boolean, false), COALESCE((t->>'thang_6')::boolean, false),
    COALESCE((t->>'thang_7')::boolean, false), COALESCE((t->>'thang_8')::boolean, false),
    COALESCE((t->>'thang_9')::boolean, false), COALESCE((t->>'thang_10')::boolean, false),
    COALESCE((t->>'thang_11')::boolean, false), COALESCE((t->>'thang_12')::boolean, false),
    t->>'ghi_chu'
  FROM jsonb_array_elements(p_tasks) AS t;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintenance_task_update(p_id bigint, p_task jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard record;
  v_task public.cong_viec_bao_tri;
  v_plan_don_vi bigint;
  v_new_plan_don_vi bigint;
  v_new_equipment_don_vi bigint;
BEGIN
  SELECT * INTO v_guard FROM public._assert_maintenance_write_allowed();

  SELECT *
  INTO v_task
  FROM public.cong_viec_bao_tri
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT don_vi
  INTO v_plan_don_vi
  FROM public.ke_hoach_bao_tri
  WHERE id = v_task.ke_hoach_id
  FOR UPDATE;

  IF NOT v_guard.is_global AND (v_plan_don_vi IS NULL OR NOT v_plan_don_vi = ANY(v_guard.allowed_don_vi)) THEN
    RAISE EXCEPTION 'Không có quyền cập nhật công việc bảo trì thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(p_task->>'ke_hoach_id', '') IS NOT NULL THEN
    SELECT don_vi
    INTO v_new_plan_don_vi
    FROM public.ke_hoach_bao_tri
    WHERE id = NULLIF(p_task->>'ke_hoach_id', '')::bigint
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Kế hoạch bảo trì không tồn tại' USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_guard.is_global AND (v_new_plan_don_vi IS NULL OR NOT v_new_plan_don_vi = ANY(v_guard.allowed_don_vi)) THEN
      RAISE EXCEPTION 'Không có quyền chuyển công việc bảo trì sang kế hoạch thuộc đơn vị khác' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NULLIF(p_task->>'thiet_bi_id', '') IS NOT NULL THEN
    SELECT don_vi
    INTO v_new_equipment_don_vi
    FROM public.thiet_bi
    WHERE id = NULLIF(p_task->>'thiet_bi_id', '')::bigint
      AND is_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Thiết bị không tồn tại' USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_guard.is_global AND (v_new_equipment_don_vi IS NULL OR NOT v_new_equipment_don_vi = ANY(v_guard.allowed_don_vi)) THEN
      RAISE EXCEPTION 'Không có quyền gán công việc bảo trì cho thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.cong_viec_bao_tri
  SET ke_hoach_id = COALESCE(NULLIF(p_task->>'ke_hoach_id', '')::bigint, ke_hoach_id),
      thiet_bi_id = COALESCE(NULLIF(p_task->>'thiet_bi_id', '')::bigint, thiet_bi_id),
      loai_cong_viec = COALESCE(p_task->>'loai_cong_viec', loai_cong_viec),
      diem_hieu_chuan = COALESCE(p_task->>'diem_hieu_chuan', diem_hieu_chuan),
      don_vi_thuc_hien = COALESCE(p_task->>'don_vi_thuc_hien', don_vi_thuc_hien),
      thang_1 = COALESCE((p_task->>'thang_1')::boolean, thang_1), thang_2 = COALESCE((p_task->>'thang_2')::boolean, thang_2),
      thang_3 = COALESCE((p_task->>'thang_3')::boolean, thang_3), thang_4 = COALESCE((p_task->>'thang_4')::boolean, thang_4),
      thang_5 = COALESCE((p_task->>'thang_5')::boolean, thang_5), thang_6 = COALESCE((p_task->>'thang_6')::boolean, thang_6),
      thang_7 = COALESCE((p_task->>'thang_7')::boolean, thang_7), thang_8 = COALESCE((p_task->>'thang_8')::boolean, thang_8),
      thang_9 = COALESCE((p_task->>'thang_9')::boolean, thang_9), thang_10 = COALESCE((p_task->>'thang_10')::boolean, thang_10),
      thang_11 = COALESCE((p_task->>'thang_11')::boolean, thang_11), thang_12 = COALESCE((p_task->>'thang_12')::boolean, thang_12),
      thang_1_hoan_thanh = COALESCE((p_task->>'thang_1_hoan_thanh')::boolean, thang_1_hoan_thanh), thang_2_hoan_thanh = COALESCE((p_task->>'thang_2_hoan_thanh')::boolean, thang_2_hoan_thanh),
      thang_3_hoan_thanh = COALESCE((p_task->>'thang_3_hoan_thanh')::boolean, thang_3_hoan_thanh), thang_4_hoan_thanh = COALESCE((p_task->>'thang_4_hoan_thanh')::boolean, thang_4_hoan_thanh),
      thang_5_hoan_thanh = COALESCE((p_task->>'thang_5_hoan_thanh')::boolean, thang_5_hoan_thanh), thang_6_hoan_thanh = COALESCE((p_task->>'thang_6_hoan_thanh')::boolean, thang_6_hoan_thanh),
      thang_7_hoan_thanh = COALESCE((p_task->>'thang_7_hoan_thanh')::boolean, thang_7_hoan_thanh), thang_8_hoan_thanh = COALESCE((p_task->>'thang_8_hoan_thanh')::boolean, thang_8_hoan_thanh),
      thang_9_hoan_thanh = COALESCE((p_task->>'thang_9_hoan_thanh')::boolean, thang_9_hoan_thanh), thang_10_hoan_thanh = COALESCE((p_task->>'thang_10_hoan_thanh')::boolean, thang_10_hoan_thanh),
      thang_11_hoan_thanh = COALESCE((p_task->>'thang_11_hoan_thanh')::boolean, thang_11_hoan_thanh), thang_12_hoan_thanh = COALESCE((p_task->>'thang_12_hoan_thanh')::boolean, thang_12_hoan_thanh),
      ngay_hoan_thanh_1 = COALESCE((p_task->>'ngay_hoan_thanh_1')::timestamptz, ngay_hoan_thanh_1), ngay_hoan_thanh_2 = COALESCE((p_task->>'ngay_hoan_thanh_2')::timestamptz, ngay_hoan_thanh_2),
      ngay_hoan_thanh_3 = COALESCE((p_task->>'ngay_hoan_thanh_3')::timestamptz, ngay_hoan_thanh_3), ngay_hoan_thanh_4 = COALESCE((p_task->>'ngay_hoan_thanh_4')::timestamptz, ngay_hoan_thanh_4),
      ngay_hoan_thanh_5 = COALESCE((p_task->>'ngay_hoan_thanh_5')::timestamptz, ngay_hoan_thanh_5), ngay_hoan_thanh_6 = COALESCE((p_task->>'ngay_hoan_thanh_6')::timestamptz, ngay_hoan_thanh_6),
      ngay_hoan_thanh_7 = COALESCE((p_task->>'ngay_hoan_thanh_7')::timestamptz, ngay_hoan_thanh_7), ngay_hoan_thanh_8 = COALESCE((p_task->>'ngay_hoan_thanh_8')::timestamptz, ngay_hoan_thanh_8),
      ngay_hoan_thanh_9 = COALESCE((p_task->>'ngay_hoan_thanh_9')::timestamptz, ngay_hoan_thanh_9), ngay_hoan_thanh_10 = COALESCE((p_task->>'ngay_hoan_thanh_10')::timestamptz, ngay_hoan_thanh_10),
      ngay_hoan_thanh_11 = COALESCE((p_task->>'ngay_hoan_thanh_11')::timestamptz, ngay_hoan_thanh_11), ngay_hoan_thanh_12 = COALESCE((p_task->>'ngay_hoan_thanh_12')::timestamptz, ngay_hoan_thanh_12),
      ghi_chu = COALESCE(p_task->>'ghi_chu', ghi_chu),
      updated_at = now()
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintenance_task_complete(p_task_id bigint, p_month integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard record;
  v_task public.cong_viec_bao_tri;
  v_plan public.ke_hoach_bao_tri;
  v_equipment_don_vi bigint;
  v_date timestamptz := now();
  v_month_col text;
  v_month_date_col text;
BEGIN
  SELECT * INTO v_guard FROM public._assert_maintenance_write_allowed();

  IF p_month IS NULL OR p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'Tháng hoàn thành không hợp lệ' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_task
  FROM public.cong_viec_bao_tri
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_plan
  FROM public.ke_hoach_bao_tri
  WHERE id = v_task.ke_hoach_id
  FOR UPDATE;

  IF NOT v_guard.is_global AND (v_plan.don_vi IS NULL OR NOT v_plan.don_vi = ANY(v_guard.allowed_don_vi)) THEN
    RAISE EXCEPTION 'Không có quyền hoàn thành công việc bảo trì thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  IF v_task.thiet_bi_id IS NOT NULL THEN
    SELECT don_vi
    INTO v_equipment_don_vi
    FROM public.thiet_bi
    WHERE id = v_task.thiet_bi_id
      AND is_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Thiết bị không tồn tại' USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_guard.is_global AND (v_equipment_don_vi IS NULL OR NOT v_equipment_don_vi = ANY(v_guard.allowed_don_vi)) THEN
      RAISE EXCEPTION 'Không có quyền hoàn thành công việc bảo trì cho thiết bị thuộc đơn vị khác' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_month_col := format('thang_%s_hoan_thanh', p_month);
  v_month_date_col := format('ngay_hoan_thanh_%s', p_month);

  EXECUTE format('UPDATE public.cong_viec_bao_tri SET %I = true, %I = $1, updated_at = $1 WHERE id = $2', v_month_col, v_month_date_col)
    USING v_date, p_task_id;

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, ngay_thuc_hien)
  VALUES (
    v_task.thiet_bi_id,
    v_task.loai_cong_viec,
    format('Hoàn thành %s tháng %s/%s theo kế hoạch "%s"', v_task.loai_cong_viec, p_month, v_plan.nam, v_plan.ten_ke_hoach),
    jsonb_build_object('cong_viec_id', p_task_id, 'thang', p_month, 'ten_ke_hoach', v_plan.ten_ke_hoach, 'khoa_phong', v_plan.khoa_phong, 'nam', v_plan.nam),
    v_date
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.maintenance_tasks_delete(p_ids bigint[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_guard record;
  v_denied_count bigint;
BEGIN
  SELECT * INTO v_guard FROM public._assert_maintenance_write_allowed();

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF NOT v_guard.is_global THEN
    SELECT count(*)
    INTO v_denied_count
    FROM public.cong_viec_bao_tri cv
    JOIN public.ke_hoach_bao_tri kh ON kh.id = cv.ke_hoach_id
    WHERE cv.id = ANY(p_ids)
      AND (kh.don_vi IS NULL OR NOT kh.don_vi = ANY(v_guard.allowed_don_vi));

    IF v_denied_count > 0 THEN
      RAISE EXCEPTION 'Không có quyền xóa công việc bảo trì thuộc đơn vị khác' USING ERRCODE = '42501';
    END IF;
  END IF;

  DELETE FROM public.cong_viec_bao_tri WHERE id = ANY(p_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION
  public.maintenance_plan_create(text, integer, text, text, text),
  public.maintenance_plan_update(bigint, text, integer, text, text),
  public.maintenance_plan_delete(bigint),
  public.maintenance_plan_approve(bigint, text),
  public.maintenance_plan_reject(bigint, text, text),
  public.maintenance_tasks_bulk_insert(jsonb),
  public.maintenance_task_update(bigint, jsonb),
  public.maintenance_task_complete(bigint, integer),
  public.maintenance_tasks_delete(bigint[])
TO authenticated;

REVOKE EXECUTE ON FUNCTION
  public.maintenance_plan_create(text, integer, text, text, text),
  public.maintenance_plan_update(bigint, text, integer, text, text),
  public.maintenance_plan_delete(bigint),
  public.maintenance_plan_approve(bigint, text),
  public.maintenance_plan_reject(bigint, text, text),
  public.maintenance_tasks_bulk_insert(jsonb),
  public.maintenance_task_update(bigint, jsonb),
  public.maintenance_task_complete(bigint, integer),
  public.maintenance_tasks_delete(bigint[])
FROM PUBLIC;

COMMIT;
