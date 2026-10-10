-- Append-only catalog policy; original signature, authorization and ACL retained.
BEGIN;

CREATE OR REPLACE FUNCTION public.maintenance_tasks_bulk_insert(p_tasks jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_guard record;
  v_item jsonb;
  v_ke_hoach_id bigint;
  v_thiet_bi_id bigint;
  v_plan public.ke_hoach_bao_tri;
  v_equipment_don_vi bigint;
  v_equipment_status text;
BEGIN
  SELECT * INTO v_guard FROM public._assert_maintenance_write_allowed();

  IF p_tasks IS NULL OR jsonb_array_length(p_tasks) = 0 THEN
    RETURN;
  END IF;

  -- Equipment locks precede plan locks, with a deterministic bulk order.
  PERFORM tb.id FROM public.thiet_bi tb
  WHERE tb.id IN (SELECT NULLIF(item->>'thiet_bi_id', '')::bigint
    FROM jsonb_array_elements(p_tasks) item)
  ORDER BY tb.id FOR UPDATE OF tb;

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
      SELECT don_vi, tinh_trang_hien_tai
      INTO v_equipment_don_vi, v_equipment_status
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

      IF EXISTS (SELECT 1 FROM public.equipment_status_catalog sc
        WHERE sc.status_value = v_equipment_status AND sc.blocks_operational_actions) THEN
        RAISE EXCEPTION 'equipment_status_blocks_operational_actions' USING ERRCODE = '55000';
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
$function$;

COMMIT;
