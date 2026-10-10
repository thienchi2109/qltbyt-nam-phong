-- Preserve deletion authorization; align equipment/task lock order.
BEGIN;

CREATE OR REPLACE FUNCTION public.maintenance_tasks_delete(p_ids bigint[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_guard record;
  v_denied_count bigint;
  v_associations jsonb;
BEGIN
  SELECT * INTO v_guard FROM public._assert_maintenance_write_allowed();

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(jsonb_object_agg(cv.id::text, cv.thiet_bi_id), '{}'::jsonb)
  INTO v_associations FROM public.cong_viec_bao_tri cv WHERE cv.id = ANY(p_ids);
  PERFORM tb.id FROM public.thiet_bi tb
  WHERE tb.id IN (SELECT NULLIF(value, 'null')::bigint FROM jsonb_each_text(v_associations))
  ORDER BY tb.id FOR UPDATE OF tb;
  PERFORM cv.id FROM public.cong_viec_bao_tri cv WHERE cv.id = ANY(p_ids)
  ORDER BY cv.id FOR UPDATE OF cv;
  IF EXISTS (SELECT 1 FROM public.cong_viec_bao_tri cv WHERE cv.id = ANY(p_ids)
    AND COALESCE(to_jsonb(cv.thiet_bi_id), 'null'::jsonb) IS DISTINCT FROM v_associations->cv.id::text) THEN
    RAISE EXCEPTION 'maintenance_task_equipment_changed' USING ERRCODE = '40001';
  END IF;

  IF NOT v_guard.is_global THEN
    PERFORM 1
    FROM public.cong_viec_bao_tri cv
    JOIN public.ke_hoach_bao_tri kh ON kh.id = cv.ke_hoach_id
    WHERE cv.id = ANY(p_ids)
    FOR UPDATE OF cv, kh;

    SELECT count(*)
    INTO v_denied_count
    FROM public.cong_viec_bao_tri cv
    JOIN public.ke_hoach_bao_tri kh ON kh.id = cv.ke_hoach_id
    LEFT JOIN public.thiet_bi tb ON tb.id = cv.thiet_bi_id
    WHERE cv.id = ANY(p_ids)
      AND (
        kh.don_vi IS NULL
        OR NOT kh.don_vi = ANY(v_guard.allowed_don_vi)
        OR (
          cv.thiet_bi_id IS NOT NULL
          AND (tb.id IS NULL OR tb.don_vi IS NULL OR NOT tb.don_vi = ANY(v_guard.allowed_don_vi))
        )
      );

    IF v_denied_count > 0 THEN
      RAISE EXCEPTION 'Không có quyền xóa công việc bảo trì thuộc đơn vị khác' USING ERRCODE = '42501';
    END IF;
  END IF;

  DELETE FROM public.cong_viec_bao_tri WHERE id = ANY(p_ids);
END;
$function$;
COMMIT;
