-- Append-only catalog policy; original signature, authorization and ACL retained.
BEGIN;

CREATE OR REPLACE FUNCTION public.repair_request_complete(p_id integer, p_completion text DEFAULT NULL::text, p_reason text DEFAULT NULL::text, p_chi_phi_sua_chua numeric DEFAULT NULL::numeric)
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
  v_thiet_bi_id bigint;
  v_tb_don_vi bigint;
  v_locked_status text;
  v_locked_completed_at timestamptz;
  v_status text;
  v_result text;
  v_reason text;
  v_cost numeric(14,2);
  v_normalized_completion text;
  v_normalized_reason text;
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

  SELECT ycss.thiet_bi_id, ycss.trang_thai, ycss.ngay_hoan_thanh, tb.don_vi
  INTO v_thiet_bi_id, v_locked_status, v_locked_completed_at, v_tb_don_vi
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.thiet_bi tb ON tb.id = ycss.thiet_bi_id
  WHERE ycss.id = p_id
    AND tb.is_deleted = false
  FOR UPDATE OF ycss;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại';
  END IF;

  IF v_thiet_bi_id IS DISTINCT FROM v_initial_equipment_id THEN
    RAISE EXCEPTION 'repair_request_equipment_changed' USING ERRCODE = '40001';
  END IF;

  IF NOT v_is_global AND v_tb_don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING errcode = '42501';
  END IF;

  IF v_locked_completed_at IS NOT NULL OR v_locked_status IN ('Hoàn thành', 'Không HT') THEN
    RAISE EXCEPTION 'Không thể hoàn thành lại yêu cầu đã hoàn thành' USING errcode = '22023';
  END IF;

  IF p_chi_phi_sua_chua IS NOT NULL AND p_chi_phi_sua_chua < 0 THEN
    RAISE EXCEPTION 'Chi phí sửa chữa không được âm' USING errcode = '22023';
  END IF;

  v_normalized_completion := nullif(
    regexp_replace(coalesce(p_completion, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    ''
  );
  v_normalized_reason := nullif(
    regexp_replace(coalesce(p_reason, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    ''
  );

  IF v_normalized_completion IS NULL
     AND v_normalized_reason IS NULL THEN
    RAISE EXCEPTION 'Phải nhập kết quả sửa chữa hoặc lý do không hoàn thành'
      USING errcode = '22023';
  END IF;

  IF v_normalized_completion IS NOT NULL THEN
    v_status := 'Hoàn thành';
    v_result := v_normalized_completion;
    v_reason := NULL;
    v_cost := p_chi_phi_sua_chua;
  ELSE
    v_status := 'Không HT';
    v_result := NULL;
    v_reason := v_normalized_reason;
    v_cost := NULL;
  END IF;

  UPDATE public.yeu_cau_sua_chua
  SET trang_thai = v_status,
      ngay_hoan_thanh = now(),
      ket_qua_sua_chua = v_result,
      ly_do_khong_hoan_thanh = v_reason,
      chi_phi_sua_chua = v_cost
  WHERE id = p_id;

  PERFORM public.repair_request_sync_equipment_status(v_thiet_bi_id);

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  VALUES (
    v_thiet_bi_id,
    'Sửa chữa',
    'Yêu cầu sửa chữa cập nhật trạng thái',
    jsonb_build_object(
      'ket_qua', coalesce(v_result, v_reason),
      'trang_thai', v_status,
      'chi_phi_sua_chua', v_cost
    ),
    p_id
  );

  IF NOT public.audit_log(
    'repair_request_complete',
    'repair_request',
    p_id,
    NULL,
    jsonb_build_object(
      'trang_thai', v_status,
      'ket_qua_sua_chua', v_result,
      'ly_do_khong_hoan_thanh', v_reason,
      'chi_phi_sua_chua', v_cost
    )
  ) THEN
    RAISE EXCEPTION 'audit_log failed for repair_request %', p_id;
  END IF;
END;
$function$;

COMMIT;
