-- 20260424143000_maintenance_audit_notfound.sql
-- Purpose:
-- - Restore audit logging for maintenance_plan_create.
-- - Make maintenance_task_update fail with P0002 when the target task is missing.
-- Rollback: restore function bodies from
-- supabase/migrations/20260424132000_block_global_maintenance_plan_create.sql and
-- supabase/migrations/20260424120000_enforce_maintenance_write_role_guards.sql.

BEGIN;

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

  IF v_guard.is_global THEN
    RAISE EXCEPTION 'global/admin cannot create tenant maintenance plans' USING ERRCODE = '42501';
  END IF;

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

  IF NOT public.audit_log(
    'maintenance_plan_create',
    'maintenance_plan',
    v_new_id,
    p_ten_ke_hoach,
    jsonb_build_object(
      'nam', p_nam,
      'loai_cong_viec', p_loai_cong_viec,
      'khoa_phong', NULLIF(p_khoa_phong, '')
    )
  ) THEN
    RAISE EXCEPTION 'audit_log failed for maintenance_plan %', v_new_id;
  END IF;

  RETURN v_new_id;
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
    RAISE EXCEPTION 'Công việc bảo trì không tồn tại' USING ERRCODE = 'P0002';
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

REVOKE EXECUTE ON FUNCTION public.maintenance_plan_create(text, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maintenance_plan_create(text, integer, text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.maintenance_task_update(bigint, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maintenance_task_update(bigint, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
