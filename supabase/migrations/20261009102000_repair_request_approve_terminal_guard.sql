-- Append-only catalog policy; original signature, authorization and ACL retained.
BEGIN;

CREATE OR REPLACE FUNCTION public.repair_request_approve(p_id integer, p_nguoi_duyet text, p_don_vi_thuc_hien text, p_ten_don_vi_thue text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_claims jsonb;
  v_initial_equipment_id bigint;
  v_equipment_status text;
  v_role text;
  v_is_global boolean := false;
  v_user_id bigint;
  v_don_vi bigint;
  v_locked record;
  v_req public.yeu_cau_sua_chua%ROWTYPE;
  v_tb_don_vi bigint;
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

  -- Consistent lock order with create/update: equipment before repair request.
  SELECT thiet_bi_id INTO v_initial_equipment_id
  FROM public.yeu_cau_sua_chua WHERE id = p_id;
  SELECT tb.tinh_trang_hien_tai INTO v_equipment_status
  FROM public.thiet_bi tb WHERE tb.id = v_initial_equipment_id
  FOR UPDATE OF tb;

  SELECT ycss.*, tb.don_vi AS tb_don_vi
  INTO v_locked
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.thiet_bi tb ON tb.id = ycss.thiet_bi_id
  WHERE ycss.id = p_id
    AND tb.is_deleted = false
  FOR UPDATE OF ycss;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại';
  END IF;

  v_tb_don_vi := v_locked.tb_don_vi;

  IF v_locked.thiet_bi_id IS DISTINCT FROM v_initial_equipment_id THEN
    RAISE EXCEPTION 'repair_request_equipment_changed' USING ERRCODE = '40001';
  END IF;

  IF NOT v_is_global AND v_tb_don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING errcode = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.equipment_status_catalog sc
    WHERE sc.status_value = v_equipment_status AND sc.blocks_operational_actions) THEN
    RAISE EXCEPTION 'equipment_status_blocks_operational_actions' USING ERRCODE = '55000';
  END IF;

  IF v_locked.trang_thai IS DISTINCT FROM 'Chờ xử lý' THEN
    RAISE EXCEPTION 'Chỉ có thể duyệt yêu cầu ở trạng thái Chờ xử lý' USING errcode = '22023';
  END IF;

  UPDATE public.yeu_cau_sua_chua
  SET trang_thai = 'Đã duyệt',
      ngay_duyet = now(),
      nguoi_duyet = p_nguoi_duyet,
      don_vi_thuc_hien = p_don_vi_thuc_hien,
      ten_don_vi_thue = CASE
        WHEN p_don_vi_thuc_hien = 'thue_ngoai' THEN p_ten_don_vi_thue
        ELSE NULL
      END
  WHERE id = p_id
  RETURNING * INTO v_req;

  PERFORM public.repair_request_sync_equipment_status(v_req.thiet_bi_id);

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  VALUES (
    v_req.thiet_bi_id,
    'Sửa chữa',
    'Duyệt yêu cầu sửa chữa',
    jsonb_build_object(
      'nguoi_duyet', v_req.nguoi_duyet,
      'ngay_duyet', v_req.ngay_duyet,
      'don_vi_thuc_hien', v_req.don_vi_thuc_hien,
      'ten_don_vi_thue', v_req.ten_don_vi_thue
    ),
    p_id
  );

  IF NOT public.audit_log(
    'repair_request_approve',
    'repair_request',
    p_id,
    NULL,
    jsonb_build_object(
      'trang_thai', v_req.trang_thai,
      'nguoi_duyet', v_req.nguoi_duyet,
      'ngay_duyet', v_req.ngay_duyet,
      'don_vi_thuc_hien', v_req.don_vi_thuc_hien,
      'ten_don_vi_thue', v_req.ten_don_vi_thue
    )
  ) THEN
    RAISE EXCEPTION 'audit_log failed for repair_request %', p_id;
  END IF;
END;
$function$;

COMMIT;
