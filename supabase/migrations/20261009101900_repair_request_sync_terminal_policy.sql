-- Append-only catalog policy; original signature, authorization and ACL retained.
BEGIN;

CREATE OR REPLACE FUNCTION public.repair_request_sync_equipment_status(p_thiet_bi_id bigint, p_fallback_status text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_current_status text;
  v_is_deleted boolean := false;
  v_has_open_request boolean := false;
  v_latest_status text;
  v_next_status text;
BEGIN
  SELECT tb.tinh_trang_hien_tai, tb.is_deleted
  INTO v_current_status, v_is_deleted
  FROM public.thiet_bi tb
  WHERE tb.id = p_thiet_bi_id
  FOR UPDATE OF tb;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_is_deleted THEN
    RETURN;
  END IF;

  -- Terminal policy is inspected only after acquiring the equipment lock.
  IF EXISTS (SELECT 1 FROM public.equipment_status_catalog sc
    WHERE sc.status_value = v_current_status AND sc.blocks_operational_actions) THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.yeu_cau_sua_chua ycss
    WHERE ycss.thiet_bi_id = p_thiet_bi_id
      AND ycss.trang_thai IN ('Chờ xử lý', 'Đã duyệt')
  )
  INTO v_has_open_request;

  IF v_has_open_request THEN
    v_next_status := 'Chờ sửa chữa';
  ELSE
    SELECT ycss.trang_thai
    INTO v_latest_status
    FROM public.yeu_cau_sua_chua ycss
    WHERE ycss.thiet_bi_id = p_thiet_bi_id
    ORDER BY ycss.id DESC
    LIMIT 1;

    IF FOUND THEN
      IF v_latest_status = 'Hoàn thành' THEN
        v_next_status := 'Hoạt động';
      ELSE
        v_next_status := 'Chờ sửa chữa';
      END IF;
    ELSE
      v_next_status := coalesce(p_fallback_status, v_current_status);
    END IF;
  END IF;

  IF v_next_status IS DISTINCT FROM v_current_status THEN
    UPDATE public.thiet_bi
    SET tinh_trang_hien_tai = v_next_status
    WHERE id = p_thiet_bi_id;
  END IF;
END;
$function$;

COMMIT;
