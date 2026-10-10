-- Append-only catalog policy; original signature, authorization and ACL retained.
BEGIN;

CREATE OR REPLACE FUNCTION public.maintenance_task_update(p_id bigint, p_task jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_guard record;
  v_initial_equipment_id bigint;
  v_equipment_status text;
  v_task public.cong_viec_bao_tri;
  v_plan_don_vi bigint;
  v_new_plan_don_vi bigint;
  v_new_equipment_don_vi bigint;
BEGIN
  SELECT * INTO v_guard FROM public._assert_maintenance_write_allowed();

  -- Discover association, lock equipment, then lock/recheck the task.
  SELECT thiet_bi_id INTO v_initial_equipment_id
  FROM public.cong_viec_bao_tri WHERE id = p_id;
  PERFORM tb.id FROM public.thiet_bi tb
  WHERE tb.id = v_initial_equipment_id OR tb.id = NULLIF(p_task->>'thiet_bi_id', '')::bigint
  ORDER BY tb.id FOR UPDATE OF tb;

  SELECT *
  INTO v_task
  FROM public.cong_viec_bao_tri
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Công việc bảo trì không tồn tại' USING ERRCODE = 'P0002';
  END IF;

  IF v_task.thiet_bi_id IS DISTINCT FROM v_initial_equipment_id THEN
    RAISE EXCEPTION 'maintenance_task_equipment_changed' USING ERRCODE = '40001';
  END IF;

  SELECT don_vi
  INTO v_plan_don_vi
  FROM public.ke_hoach_bao_tri
  WHERE id = v_task.ke_hoach_id
  FOR UPDATE;

  IF NOT v_guard.is_global AND (v_plan_don_vi IS NULL OR NOT v_plan_don_vi = ANY(v_guard.allowed_don_vi)) THEN
    RAISE EXCEPTION 'Không có quyền cập nhật công việc bảo trì thuộc đơn vị khác' USING ERRCODE = '42501';
  END IF;

  IF v_task.thiet_bi_id IS NOT NULL THEN
    SELECT tb.tinh_trang_hien_tai INTO v_equipment_status
    FROM public.thiet_bi tb WHERE tb.id = v_task.thiet_bi_id;
    IF EXISTS (SELECT 1 FROM public.equipment_status_catalog sc
      WHERE sc.status_value = v_equipment_status AND sc.blocks_operational_actions) THEN
      RAISE EXCEPTION 'equipment_status_blocks_operational_actions' USING ERRCODE = '55000';
    END IF;

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
    SELECT don_vi, tinh_trang_hien_tai
    INTO v_new_equipment_don_vi, v_equipment_status
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

    IF EXISTS (SELECT 1 FROM public.equipment_status_catalog sc
      WHERE sc.status_value = v_equipment_status AND sc.blocks_operational_actions) THEN
      RAISE EXCEPTION 'equipment_status_blocks_operational_actions' USING ERRCODE = '55000';
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
$function$;

COMMIT;
