-- Append-only catalog policy; original signature, authorization and ACL retained.
BEGIN;

CREATE OR REPLACE FUNCTION public.maintenance_task_complete(p_task_id bigint, p_month integer)
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

  -- Discover association, lock equipment, then lock/recheck the task.
  SELECT thiet_bi_id INTO v_initial_equipment_id
  FROM public.cong_viec_bao_tri WHERE id = p_task_id;
  PERFORM tb.id FROM public.thiet_bi tb
  WHERE tb.id = v_initial_equipment_id
  ORDER BY tb.id FOR UPDATE OF tb;

  SELECT *
  INTO v_task
  FROM public.cong_viec_bao_tri
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_task.thiet_bi_id IS DISTINCT FROM v_initial_equipment_id THEN
    RAISE EXCEPTION 'maintenance_task_equipment_changed' USING ERRCODE = '40001';
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
    SELECT don_vi, tinh_trang_hien_tai
    INTO v_equipment_don_vi, v_equipment_status
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

    IF EXISTS (SELECT 1 FROM public.equipment_status_catalog sc
      WHERE sc.status_value = v_equipment_status AND sc.blocks_operational_actions) THEN
      RAISE EXCEPTION 'equipment_status_blocks_operational_actions' USING ERRCODE = '55000';
    END IF;

  END IF;

  v_month_col := format('thang_%s_hoan_thanh', p_month);
  v_month_date_col := format('ngay_hoan_thanh_%s', p_month);

  EXECUTE format('UPDATE public.cong_viec_bao_tri SET %I = true, %I = $1, updated_at = $1 WHERE id = $2', v_month_col, v_month_date_col)
    USING v_date, p_task_id;

  IF v_task.thiet_bi_id IS NOT NULL THEN
    INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, ngay_thuc_hien)
    VALUES (
      v_task.thiet_bi_id,
      v_task.loai_cong_viec,
      format('Hoàn thành %s tháng %s/%s theo kế hoạch "%s"', v_task.loai_cong_viec, p_month, v_plan.nam, v_plan.ten_ke_hoach),
      jsonb_build_object('cong_viec_id', p_task_id, 'thang', p_month, 'ten_ke_hoach', v_plan.ten_ke_hoach, 'khoa_phong', v_plan.khoa_phong, 'nam', v_plan.nam),
      v_date
    );
  END IF;
END;
$function$;

COMMIT;
