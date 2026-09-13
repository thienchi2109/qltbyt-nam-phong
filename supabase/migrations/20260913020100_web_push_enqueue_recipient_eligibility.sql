-- Enforce recipient membership without changing request-read or ZBS behavior.
BEGIN;

CREATE OR REPLACE FUNCTION public.repair_request_create(
  p_thiet_bi_id integer,
  p_mo_ta_su_co text,
  p_hang_muc_sua_chua text,
  p_ngay_mong_muon_hoan_thanh date,
  p_nguoi_yeu_cau text,
  p_don_vi_thuc_hien text,
  p_ten_don_vi_thue text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_id integer;
  v_claims jsonb;
  v_role text;
  v_is_global boolean := false;
  v_user_id bigint;
  v_don_vi bigint;
  v_department_scope text;
  v_tb record;
  v_snapshot_status text;
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

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_claims->>'khoa_phong');
  END IF;

  SELECT
    tb.id,
    tb.don_vi,
    tb.khoa_phong_quan_ly,
    tb.tinh_trang_hien_tai,
    tb.ma_thiet_bi,
    tb.ten_thiet_bi
  INTO v_tb
  FROM public.thiet_bi tb
  WHERE tb.id = p_thiet_bi_id
    AND tb.is_deleted = false
  FOR UPDATE OF tb;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thiết bị không tồn tại' USING errcode = 'P0002';
  END IF;

  IF NOT v_is_global AND v_tb.don_vi IS DISTINCT FROM v_don_vi THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc đơn vị khác' USING errcode = '42501';
  END IF;

  IF v_role = 'user'
     AND (
       v_department_scope IS NULL
       OR public._normalize_department_scope(v_tb.khoa_phong_quan_ly) IS DISTINCT FROM v_department_scope
     ) THEN
    RAISE EXCEPTION 'Không có quyền trên thiết bị thuộc khoa/phòng khác' USING errcode = '42501';
  END IF;

  v_snapshot_status := v_tb.tinh_trang_hien_tai;

  IF v_tb.tinh_trang_hien_tai = 'Chờ sửa chữa' THEN
    SELECT ycss.tinh_trang_thiet_bi_truoc_yeu_cau
    INTO v_snapshot_status
    FROM public.yeu_cau_sua_chua ycss
    WHERE ycss.thiet_bi_id = p_thiet_bi_id
      AND ycss.trang_thai IN ('Chờ xử lý', 'Đã duyệt', 'Không HT')
      AND ycss.tinh_trang_thiet_bi_truoc_yeu_cau IS NOT NULL
      AND ycss.tinh_trang_thiet_bi_truoc_yeu_cau <> 'Chờ sửa chữa'
    ORDER BY ycss.id DESC
    LIMIT 1;

    v_snapshot_status := coalesce(
      v_snapshot_status,
      nullif(v_tb.tinh_trang_hien_tai, 'Chờ sửa chữa'),
      'Hoạt động'
    );
  END IF;

  INSERT INTO public.yeu_cau_sua_chua(
    thiet_bi_id,
    mo_ta_su_co,
    hang_muc_sua_chua,
    ngay_mong_muon_hoan_thanh,
    nguoi_yeu_cau,
    trang_thai,
    don_vi_thuc_hien,
    ten_don_vi_thue,
    tinh_trang_thiet_bi_truoc_yeu_cau
  )
  VALUES (
    p_thiet_bi_id,
    p_mo_ta_su_co,
    p_hang_muc_sua_chua,
    p_ngay_mong_muon_hoan_thanh,
    p_nguoi_yeu_cau,
    'Chờ xử lý',
    p_don_vi_thuc_hien,
    p_ten_don_vi_thue,
    v_snapshot_status
  )
  RETURNING id INTO v_id;

  PERFORM public.repair_request_sync_equipment_status(p_thiet_bi_id::bigint);

  INSERT INTO public.lich_su_thiet_bi(thiet_bi_id, loai_su_kien, mo_ta, chi_tiet, yeu_cau_id)
  VALUES (
    p_thiet_bi_id,
    'Sửa chữa',
    'Tạo yêu cầu sửa chữa',
    jsonb_build_object(
      'mo_ta_su_co', p_mo_ta_su_co,
      'hang_muc', p_hang_muc_sua_chua,
      'ngay_mong_muon_hoan_thanh', p_ngay_mong_muon_hoan_thanh,
      'don_vi_thuc_hien', p_don_vi_thuc_hien,
      'ten_don_vi_thue', p_ten_don_vi_thue
    ),
    v_id
  );

  IF NOT public.audit_log(
    'repair_request_create',
    'repair_request',
    v_id,
    NULL,
    jsonb_build_object(
      'thiet_bi_id', p_thiet_bi_id,
      'mo_ta_su_co', p_mo_ta_su_co
    )
  ) THEN
    RAISE EXCEPTION 'audit_log failed for repair_request %', v_id;
  END IF;

  INSERT INTO public.zbs_notification_outbox (
    event_type,
    source_type,
    source_id,
    don_vi_id,
    recipient_config_id,
    recipient_phone,
    template_data,
    tracking_id
  )
  SELECT
    'repair_request_created',
    'repair_request',
    v_id,
    v_tb.don_vi,
    cfg.id,
    cfg.recipient_phone,
    jsonb_build_object(
      'repair_request_id', v_id,
      'equipment_id', v_tb.id,
      'equipment_code', v_tb.ma_thiet_bi,
      'equipment_name', v_tb.ten_thiet_bi,
      'department', v_tb.khoa_phong_quan_ly,
      'issue_description', p_mo_ta_su_co,
      'repair_scope', p_hang_muc_sua_chua,
      'requested_completion_date', p_ngay_mong_muon_hoan_thanh,
      'requester', p_nguoi_yeu_cau,
      'don_vi_id', v_tb.don_vi,
      'don_vi_thuc_hien', p_don_vi_thuc_hien,
      'ten_don_vi_thue', p_ten_don_vi_thue
    ),
    format('repair_request:%s:%s', v_id, cfg.id)
  FROM public.zbs_recipient_configs cfg
  WHERE cfg.don_vi_id = v_tb.don_vi
    AND cfg.event_type = 'repair_request_created'
    AND cfg.active = true
  ON CONFLICT (event_type, source_type, source_id, recipient_config_id) DO NOTHING;

  IF (SELECT controls.enqueue_enabled FROM public.web_push_runtime_controls controls WHERE controls.singleton) THEN
    WITH recipients AS MATERIALIZED (
      SELECT gen_random_uuid() AS intent_id, cfg.user_id
      FROM public.web_push_recipient_configs cfg
      WHERE cfg.don_vi_id = v_tb.don_vi
        AND public.web_push_recipient_is_eligible(cfg.user_id, v_tb.don_vi, cfg.protected_by_user_id)
        AND public.web_push_subject_can_receive(cfg.user_id, v_tb.don_vi, v_id)
    )
    INSERT INTO public.web_push_notification_intents(
      id,
      event_type,
      request_id,
      recipient_user_id,
      don_vi_id,
      payload
    )
    SELECT
      recipients.intent_id,
      'repair_request_created',
      v_id,
      recipients.user_id,
      v_tb.don_vi,
      public.web_push_payload_v1(
        recipients.intent_id,
        v_id,
        v_tb.ten_thiet_bi,
        v_tb.khoa_phong_quan_ly,
        p_mo_ta_su_co
      )
    FROM recipients
    ON CONFLICT (event_type, request_id, recipient_user_id) DO NOTHING;
  END IF;

  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.repair_request_create(integer, text, text, date, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_request_create(integer, text, text, date, text, text, text) FROM PUBLIC;

COMMIT;
