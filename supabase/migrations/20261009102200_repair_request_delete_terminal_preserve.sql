-- Append-only catalog policy; original signature, authorization and ACL retained.
BEGIN;

CREATE OR REPLACE FUNCTION public.repair_request_delete(p_id integer)
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
  v_fallback_status text;
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

  -- Intentionally allow delete cleanup even after equipment soft-delete.
  -- Other repair RPCs block deleted equipment because they mutate active workflow state.
  -- Consistent lock order with create/update: equipment before repair request.
  SELECT thiet_bi_id INTO v_initial_equipment_id
  FROM public.yeu_cau_sua_chua WHERE id = p_id;
  SELECT tb.tinh_trang_hien_tai INTO v_equipment_status
  FROM public.thiet_bi tb WHERE tb.id = v_initial_equipment_id
  FOR UPDATE OF tb;

  SELECT ycss.*, tb.don_vi AS tb_don_vi, tb.tinh_trang_hien_tai AS tb_tinh_trang_hien_tai
  INTO v_locked
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.thiet_bi tb ON tb.id = ycss.thiet_bi_id
  WHERE ycss.id = p_id
  FOR UPDATE OF ycss;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_locked.thiet_bi_id IS DISTINCT FROM v_initial_equipment_id THEN
    RAISE EXCEPTION 'repair_request_equipment_changed' USING ERRCODE = '40001';
  END IF;

  IF NOT v_is_global AND v_locked.tb_don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING errcode = '42501';
  END IF;

  -- Never feed a repair-driven intermediate status back into the sync helper
  -- when the deleted row is the last surviving repair request.
  v_fallback_status := coalesce(
    nullif(v_locked.tinh_trang_thiet_bi_truoc_yeu_cau, 'Chờ sửa chữa'),
    nullif(v_locked.tb_tinh_trang_hien_tai, 'Chờ sửa chữa'),
    'Hoạt động'
  );

  IF NOT public.audit_log(
    'repair_request_delete',
    'repair_request',
    p_id,
    NULL,
    jsonb_build_object(
      'thiet_bi_id', v_locked.thiet_bi_id,
      'trang_thai', v_locked.trang_thai
    )
  ) THEN
    RAISE EXCEPTION 'audit_log failed for repair_request %', p_id;
  END IF;

  DELETE FROM public.yeu_cau_sua_chua
  WHERE id = p_id;

  PERFORM public.repair_request_sync_equipment_status(v_locked.thiet_bi_id, v_fallback_status);

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet)
  VALUES (
    v_locked.thiet_bi_id,
    'Sửa chữa',
    'Xóa yêu cầu sửa chữa',
    jsonb_build_object('yeu_cau_id', p_id)
  );
END;
$function$;

COMMIT;
