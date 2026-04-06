-- supabase/tests/transfer_request_lifecycle_audit_smoke.sql
-- Purpose: prove transfer lifecycle RPCs write request-level audit_logs rows.
-- How to run (psql): \i supabase/tests/transfer_request_lifecycle_audit_smoke.sql
-- Non-destructive: wrapped in a transaction and rolled back.

BEGIN;

CREATE TEMP TABLE _transfer_lifecycle_ctx (
  suffix text NOT NULL,
  tenant_id bigint NOT NULL,
  user_id bigint NOT NULL,
  equipment_id bigint NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant_id bigint;
  v_user_id bigint;
  v_equipment_id bigint;
BEGIN
  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active = true
  ORDER BY nv.id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Setup failed: no active nhan_vien row found for transfer lifecycle smoke test';
  END IF;

  INSERT INTO public.don_vi(name, active)
  VALUES ('Transfer Lifecycle Smoke ' || v_suffix, true)
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    is_deleted
  )
  VALUES (
    'SMK-TRF-' || v_suffix,
    'Transfer Lifecycle Smoke Equipment ' || v_suffix,
    v_tenant_id,
    'Khoa Hien Tai ' || v_suffix,
    'Hoat dong',
    false
  )
  RETURNING id INTO v_equipment_id;

  INSERT INTO _transfer_lifecycle_ctx(suffix, tenant_id, user_id, equipment_id)
  VALUES (v_suffix, v_tenant_id, v_user_id, v_equipment_id);
END $$;

-- 1) RED/GREEN target: transfer_request_update_status should log da_duyet
DO $$
DECLARE
  v_ctx _transfer_lifecycle_ctx%ROWTYPE;
  v_request_id bigint;
  v_req public.yeu_cau_luan_chuyen%ROWTYPE;
  v_log record;
  v_approved_at timestamptz := clock_timestamp();
BEGIN
  SELECT *
  INTO v_ctx
  FROM _transfer_lifecycle_ctx
  LIMIT 1;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_ctx.user_id::text,
      'sub', v_ctx.user_id::text,
      'don_vi', v_ctx.tenant_id::text
    )::text,
    true
  );

  v_request_id := public.transfer_request_create(
    jsonb_build_object(
      'thiet_bi_id', v_ctx.equipment_id,
      'loai_hinh', 'noi_bo',
      'ly_do_luan_chuyen', 'Smoke approve ' || v_ctx.suffix,
      'khoa_phong_hien_tai', 'Khoa Hien Tai ' || v_ctx.suffix,
      'khoa_phong_nhan', 'Khoa Nhan ' || v_ctx.suffix
    )
  );

  PERFORM public.transfer_request_update_status(
    v_request_id::int,
    'da_duyet',
    jsonb_build_object(
      'nguoi_duyet_id', v_ctx.user_id::text,
      'ngay_duyet', v_approved_at
    )
  );

  SELECT *
  INTO v_req
  FROM public.yeu_cau_luan_chuyen
  WHERE id = v_request_id;

  SELECT
    al.id,
    al.entity_label,
    al.action_details
  INTO v_log
  FROM public.audit_logs al
  WHERE al.entity_type = 'transfer_request'
    AND al.entity_id = v_request_id
    AND al.action_type = 'transfer_request_update_status'
  ORDER BY al.id DESC
  LIMIT 1;

  IF v_log.id IS NULL THEN
    RAISE EXCEPTION 'Expected transfer_request_update_status audit row for da_duyet transition';
  END IF;

  IF v_req.trang_thai IS DISTINCT FROM 'da_duyet' THEN
    RAISE EXCEPTION 'Setup failed: expected persisted status da_duyet, got %', v_req.trang_thai;
  END IF;

  IF v_log.entity_label IS DISTINCT FROM v_req.ma_yeu_cau THEN
    RAISE EXCEPTION
      'Expected da_duyet audit entity_label % but found %',
      v_req.ma_yeu_cau,
      v_log.entity_label;
  END IF;

  IF v_log.action_details->>'trang_thai' IS DISTINCT FROM v_req.trang_thai THEN
    RAISE EXCEPTION
      'Expected da_duyet audit status %, found %',
      v_req.trang_thai,
      v_log.action_details->>'trang_thai';
  END IF;

  IF v_log.action_details->>'loai_hinh' IS DISTINCT FROM v_req.loai_hinh THEN
    RAISE EXCEPTION
      'Expected da_duyet audit loai_hinh %, found %',
      v_req.loai_hinh,
      v_log.action_details->>'loai_hinh';
  END IF;

  IF v_log.action_details->>'khoa_phong_hien_tai' IS DISTINCT FROM v_req.khoa_phong_hien_tai THEN
    RAISE EXCEPTION
      'Expected da_duyet audit khoa_phong_hien_tai %, found %',
      v_req.khoa_phong_hien_tai,
      v_log.action_details->>'khoa_phong_hien_tai';
  END IF;

  IF v_log.action_details->>'khoa_phong_nhan' IS DISTINCT FROM v_req.khoa_phong_nhan THEN
    RAISE EXCEPTION
      'Expected da_duyet audit khoa_phong_nhan %, found %',
      v_req.khoa_phong_nhan,
      v_log.action_details->>'khoa_phong_nhan';
  END IF;

  IF COALESCE(v_log.action_details->>'ngay_duyet', '') = '' THEN
    RAISE EXCEPTION 'Expected da_duyet audit row to include persisted approval timestamp';
  END IF;

  IF (v_log.action_details->>'ngay_duyet')::timestamptz IS DISTINCT FROM v_req.ngay_duyet THEN
    RAISE EXCEPTION
      'Expected da_duyet audit ngay_duyet %, found %',
      v_req.ngay_duyet::text,
      v_log.action_details->>'ngay_duyet';
  END IF;

  RAISE NOTICE 'OK: da_duyet audit row recorded';
END $$;

-- 2) RED/GREEN target: transfer_request_update_status should log in-progress status changes
DO $$
DECLARE
  v_ctx _transfer_lifecycle_ctx%ROWTYPE;
  v_request_id bigint;
  v_req public.yeu_cau_luan_chuyen%ROWTYPE;
  v_log record;
  v_handover_at timestamptz := clock_timestamp();
BEGIN
  SELECT *
  INTO v_ctx
  FROM _transfer_lifecycle_ctx
  LIMIT 1;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_ctx.user_id::text,
      'sub', v_ctx.user_id::text,
      'don_vi', v_ctx.tenant_id::text
    )::text,
    true
  );

  v_request_id := public.transfer_request_create(
    jsonb_build_object(
      'thiet_bi_id', v_ctx.equipment_id,
      'loai_hinh', 'noi_bo',
      'ly_do_luan_chuyen', 'Smoke in progress ' || v_ctx.suffix,
      'khoa_phong_hien_tai', 'Khoa Hien Tai ' || v_ctx.suffix,
      'khoa_phong_nhan', 'Khoa Ban Giao ' || v_ctx.suffix
    )
  );

  PERFORM public.transfer_request_update_status(
    v_request_id::int,
    'da_ban_giao',
    jsonb_build_object(
      'ngay_ban_giao', v_handover_at
    )
  );

  SELECT *
  INTO v_req
  FROM public.yeu_cau_luan_chuyen
  WHERE id = v_request_id;

  SELECT
    al.id,
    al.entity_label,
    al.action_details
  INTO v_log
  FROM public.audit_logs al
  WHERE al.entity_type = 'transfer_request'
    AND al.entity_id = v_request_id
    AND al.action_type = 'transfer_request_update_status'
  ORDER BY al.id DESC
  LIMIT 1;

  IF v_log.id IS NULL THEN
    RAISE EXCEPTION 'Expected transfer_request_update_status audit row for in-progress transition';
  END IF;

  IF v_req.trang_thai IS DISTINCT FROM 'da_ban_giao' THEN
    RAISE EXCEPTION 'Setup failed: expected persisted status da_ban_giao, got %', v_req.trang_thai;
  END IF;

  IF v_log.entity_label IS DISTINCT FROM v_req.ma_yeu_cau THEN
    RAISE EXCEPTION
      'Expected in-progress audit entity_label % but found %',
      v_req.ma_yeu_cau,
      v_log.entity_label;
  END IF;

  IF v_log.action_details->>'trang_thai' IS DISTINCT FROM v_req.trang_thai THEN
    RAISE EXCEPTION
      'Expected in-progress audit status %, found %',
      v_req.trang_thai,
      v_log.action_details->>'trang_thai';
  END IF;

  IF v_log.action_details->>'khoa_phong_nhan' IS DISTINCT FROM v_req.khoa_phong_nhan THEN
    RAISE EXCEPTION
      'Expected in-progress audit khoa_phong_nhan %, found %',
      v_req.khoa_phong_nhan,
      v_log.action_details->>'khoa_phong_nhan';
  END IF;

  IF COALESCE(v_log.action_details->>'ngay_ban_giao', '') = '' THEN
    RAISE EXCEPTION 'Expected in-progress audit row to include persisted handover timestamp';
  END IF;

  IF (v_log.action_details->>'ngay_ban_giao')::timestamptz IS DISTINCT FROM v_req.ngay_ban_giao THEN
    RAISE EXCEPTION
      'Expected in-progress audit ngay_ban_giao %, found %',
      v_req.ngay_ban_giao::text,
      v_log.action_details->>'ngay_ban_giao';
  END IF;

  RAISE NOTICE 'OK: in-progress audit row recorded';
END $$;

-- 3) RED/GREEN target: transfer_request_update_status should reject hoan_thanh
DO $$
DECLARE
  v_ctx _transfer_lifecycle_ctx%ROWTYPE;
  v_request_id bigint;
  v_req public.yeu_cau_luan_chuyen%ROWTYPE;
  v_error_raised boolean := false;
  v_completion_logs bigint;
BEGIN
  SELECT *
  INTO v_ctx
  FROM _transfer_lifecycle_ctx
  LIMIT 1;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_ctx.user_id::text,
      'sub', v_ctx.user_id::text,
      'don_vi', v_ctx.tenant_id::text
    )::text,
    true
  );

  v_request_id := public.transfer_request_create(
    jsonb_build_object(
      'thiet_bi_id', v_ctx.equipment_id,
      'loai_hinh', 'noi_bo',
      'ly_do_luan_chuyen', 'Smoke reject complete ' || v_ctx.suffix,
      'khoa_phong_hien_tai', 'Khoa Hien Tai ' || v_ctx.suffix,
      'khoa_phong_nhan', 'Khoa Khong Duoc Hoan Thanh ' || v_ctx.suffix
    )
  );

  BEGIN
    PERFORM public.transfer_request_update_status(
      v_request_id::int,
      'hoan_thanh',
      '{}'::jsonb
    );
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      v_error_raised := true;
  END;

  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'Expected transfer_request_update_status to reject hoan_thanh';
  END IF;

  SELECT *
  INTO v_req
  FROM public.yeu_cau_luan_chuyen
  WHERE id = v_request_id;

  IF v_req.trang_thai IS DISTINCT FROM 'cho_duyet' THEN
    RAISE EXCEPTION 'Expected rejected completion path to preserve original status, found %', v_req.trang_thai;
  END IF;

  SELECT COUNT(*)
  INTO v_completion_logs
  FROM public.audit_logs al
  WHERE al.entity_type = 'transfer_request'
    AND al.entity_id = v_request_id
    AND al.action_type = 'transfer_request_complete';

  IF v_completion_logs <> 0 THEN
    RAISE EXCEPTION 'Expected no transfer_request_complete audit row when update_status rejects hoan_thanh';
  END IF;

  RAISE NOTICE 'OK: update_status rejects hoan_thanh';
END $$;

-- 4) RED/GREEN target: transfer_request_update_status should reject unsupported statuses explicitly
DO $$
DECLARE
  v_ctx _transfer_lifecycle_ctx%ROWTYPE;
  v_request_id bigint;
  v_req public.yeu_cau_luan_chuyen%ROWTYPE;
  v_error_raised boolean := false;
  v_status_logs bigint;
BEGIN
  SELECT *
  INTO v_ctx
  FROM _transfer_lifecycle_ctx
  LIMIT 1;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_ctx.user_id::text,
      'sub', v_ctx.user_id::text,
      'don_vi', v_ctx.tenant_id::text
    )::text,
    true
  );

  v_request_id := public.transfer_request_create(
    jsonb_build_object(
      'thiet_bi_id', v_ctx.equipment_id,
      'loai_hinh', 'noi_bo',
      'ly_do_luan_chuyen', 'Smoke invalid status ' || v_ctx.suffix,
      'khoa_phong_hien_tai', 'Khoa Invalid Tu ' || v_ctx.suffix,
      'khoa_phong_nhan', 'Khoa Invalid Den ' || v_ctx.suffix
    )
  );

  BEGIN
    PERFORM public.transfer_request_update_status(
      v_request_id::int,
      'khong_hop_le',
      '{}'::jsonb
    );
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      v_error_raised := true;
  END;

  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'Expected transfer_request_update_status to reject unsupported status with SQLSTATE 22023';
  END IF;

  SELECT *
  INTO v_req
  FROM public.yeu_cau_luan_chuyen
  WHERE id = v_request_id;

  IF v_req.trang_thai IS DISTINCT FROM 'cho_duyet' THEN
    RAISE EXCEPTION 'Expected unsupported status path to preserve cho_duyet, found %', v_req.trang_thai;
  END IF;

  SELECT COUNT(*)
  INTO v_status_logs
  FROM public.audit_logs al
  WHERE al.entity_type = 'transfer_request'
    AND al.entity_id = v_request_id
    AND al.action_type = 'transfer_request_update_status';

  IF v_status_logs <> 0 THEN
    RAISE EXCEPTION 'Expected no transfer_request_update_status audit row for unsupported status';
  END IF;

  RAISE NOTICE 'OK: update_status rejects unsupported status explicitly';
END $$;

-- 5) RED/GREEN target: transfer_request_complete should log completion and preserve side effects
DO $$
DECLARE
  v_ctx _transfer_lifecycle_ctx%ROWTYPE;
  v_request_id bigint;
  v_req public.yeu_cau_luan_chuyen%ROWTYPE;
  v_tb record;
  v_log record;
  v_history record;
BEGIN
  SELECT *
  INTO v_ctx
  FROM _transfer_lifecycle_ctx
  LIMIT 1;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_ctx.user_id::text,
      'sub', v_ctx.user_id::text,
      'don_vi', v_ctx.tenant_id::text
    )::text,
    true
  );

  v_request_id := public.transfer_request_create(
    jsonb_build_object(
      'thiet_bi_id', v_ctx.equipment_id,
      'loai_hinh', 'noi_bo',
      'ly_do_luan_chuyen', 'Smoke complete ' || v_ctx.suffix,
      'khoa_phong_hien_tai', 'Khoa Hoan Tra ' || v_ctx.suffix,
      'khoa_phong_nhan', 'Khoa Hoan Thanh ' || v_ctx.suffix
    )
  );

  UPDATE public.yeu_cau_luan_chuyen
  SET trang_thai = 'da_ban_giao',
      ngay_duyet = clock_timestamp(),
      ngay_ban_giao = clock_timestamp(),
      nguoi_duyet_id = v_ctx.user_id
  WHERE id = v_request_id;

  PERFORM public.transfer_request_complete(
    v_request_id::int,
    '{}'::jsonb
  );

  SELECT *
  INTO v_req
  FROM public.yeu_cau_luan_chuyen
  WHERE id = v_request_id;

  SELECT
    tb.id,
    tb.khoa_phong_quan_ly
  INTO v_tb
  FROM public.thiet_bi tb
  WHERE tb.id = v_ctx.equipment_id;

  SELECT
    al.id,
    al.entity_label,
    al.action_details
  INTO v_log
  FROM public.audit_logs al
  WHERE al.entity_type = 'transfer_request'
    AND al.entity_id = v_request_id
    AND al.action_type = 'transfer_request_complete'
  ORDER BY al.id DESC
  LIMIT 1;

  IF v_log.id IS NULL THEN
    RAISE EXCEPTION 'Expected transfer_request_complete audit row for completion path';
  END IF;

  IF v_req.trang_thai IS DISTINCT FROM 'hoan_thanh' THEN
    RAISE EXCEPTION 'Setup failed: expected persisted status hoan_thanh, got %', v_req.trang_thai;
  END IF;

  IF v_log.entity_label IS DISTINCT FROM v_req.ma_yeu_cau THEN
    RAISE EXCEPTION
      'Expected completion audit entity_label % but found %',
      v_req.ma_yeu_cau,
      v_log.entity_label;
  END IF;

  IF v_log.action_details->>'trang_thai' IS DISTINCT FROM v_req.trang_thai THEN
    RAISE EXCEPTION
      'Expected completion audit status %, found %',
      v_req.trang_thai,
      v_log.action_details->>'trang_thai';
  END IF;

  IF v_log.action_details->>'loai_hinh' IS DISTINCT FROM v_req.loai_hinh THEN
    RAISE EXCEPTION
      'Expected completion audit loai_hinh %, found %',
      v_req.loai_hinh,
      v_log.action_details->>'loai_hinh';
  END IF;

  IF v_log.action_details->>'khoa_phong_hien_tai' IS DISTINCT FROM v_req.khoa_phong_hien_tai THEN
    RAISE EXCEPTION
      'Expected completion audit khoa_phong_hien_tai %, found %',
      v_req.khoa_phong_hien_tai,
      v_log.action_details->>'khoa_phong_hien_tai';
  END IF;

  IF v_log.action_details->>'khoa_phong_nhan' IS DISTINCT FROM v_req.khoa_phong_nhan THEN
    RAISE EXCEPTION
      'Expected completion audit khoa_phong_nhan %, found %',
      v_req.khoa_phong_nhan,
      v_log.action_details->>'khoa_phong_nhan';
  END IF;

  IF COALESCE(v_log.action_details->>'ngay_hoan_thanh', '') = '' THEN
    RAISE EXCEPTION 'Expected completion audit row to include completion timestamp';
  END IF;

  IF (v_log.action_details->>'ngay_hoan_thanh')::timestamptz IS DISTINCT FROM v_req.ngay_hoan_thanh THEN
    RAISE EXCEPTION
      'Expected completion audit ngay_hoan_thanh %, found %',
      v_req.ngay_hoan_thanh::text,
      v_log.action_details->>'ngay_hoan_thanh';
  END IF;

  IF v_tb.khoa_phong_quan_ly IS DISTINCT FROM v_req.khoa_phong_nhan THEN
    RAISE EXCEPTION
      'Expected completion side effect to move equipment to %, found %',
      v_req.khoa_phong_nhan,
      v_tb.khoa_phong_quan_ly;
  END IF;

  SELECT
    ls.id,
    ls.chi_tiet
  INTO v_history
  FROM public.lich_su_thiet_bi ls
  WHERE ls.thiet_bi_id = v_ctx.equipment_id
    AND ls.chi_tiet->>'yeu_cau_id' = v_request_id::text
  ORDER BY ls.id DESC
  LIMIT 1;

  IF v_history.id IS NULL THEN
    RAISE EXCEPTION 'Expected completion path to append lich_su_thiet_bi row';
  END IF;

  IF v_history.chi_tiet->>'ma_yeu_cau' IS DISTINCT FROM v_req.ma_yeu_cau THEN
    RAISE EXCEPTION
      'Expected completion lich_su_thiet_bi ma_yeu_cau %, found %',
      v_req.ma_yeu_cau,
      v_history.chi_tiet->>'ma_yeu_cau';
  END IF;

  RAISE NOTICE 'OK: completion audit row recorded';
END $$;

-- 6) RED/GREEN target: transfer_request_complete should reject a second completion
DO $$
DECLARE
  v_ctx _transfer_lifecycle_ctx%ROWTYPE;
  v_request_id bigint;
  v_req public.yeu_cau_luan_chuyen%ROWTYPE;
  v_first_completed_at timestamptz;
  v_second_completed_at timestamptz;
  v_completion_logs_before bigint;
  v_completion_logs_after bigint;
  v_history_rows_before bigint;
  v_history_rows_after bigint;
  v_error_raised boolean := false;
BEGIN
  SELECT *
  INTO v_ctx
  FROM _transfer_lifecycle_ctx
  LIMIT 1;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_ctx.user_id::text,
      'sub', v_ctx.user_id::text,
      'don_vi', v_ctx.tenant_id::text
    )::text,
    true
  );

  v_request_id := public.transfer_request_create(
    jsonb_build_object(
      'thiet_bi_id', v_ctx.equipment_id,
      'loai_hinh', 'noi_bo',
      'ly_do_luan_chuyen', 'Smoke double complete ' || v_ctx.suffix,
      'khoa_phong_hien_tai', 'Khoa Double Complete Tu ' || v_ctx.suffix,
      'khoa_phong_nhan', 'Khoa Double Complete Den ' || v_ctx.suffix
    )
  );

  UPDATE public.yeu_cau_luan_chuyen
  SET trang_thai = 'da_ban_giao',
      ngay_duyet = clock_timestamp(),
      ngay_ban_giao = clock_timestamp(),
      nguoi_duyet_id = v_ctx.user_id
  WHERE id = v_request_id;

  PERFORM public.transfer_request_complete(
    v_request_id::int,
    '{}'::jsonb
  );

  SELECT ngay_hoan_thanh
  INTO v_first_completed_at
  FROM public.yeu_cau_luan_chuyen
  WHERE id = v_request_id;

  SELECT COUNT(*)
  INTO v_completion_logs_before
  FROM public.audit_logs al
  WHERE al.entity_type = 'transfer_request'
    AND al.entity_id = v_request_id
    AND al.action_type = 'transfer_request_complete';

  SELECT COUNT(*)
  INTO v_history_rows_before
  FROM public.lich_su_thiet_bi ls
  WHERE ls.thiet_bi_id = v_ctx.equipment_id
    AND ls.chi_tiet->>'yeu_cau_id' = v_request_id::text;

  IF v_completion_logs_before < 1 THEN
    RAISE EXCEPTION 'Setup failed: first transfer_request_complete should create at least one audit row';
  END IF;

  IF v_history_rows_before < 1 THEN
    RAISE EXCEPTION 'Setup failed: first transfer_request_complete should create at least one equipment history row';
  END IF;

  BEGIN
    PERFORM public.transfer_request_complete(
      v_request_id::int,
      '{}'::jsonb
    );
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      v_error_raised := true;
  END;

  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'Expected transfer_request_complete to reject a second completion';
  END IF;

  SELECT *
  INTO v_req
  FROM public.yeu_cau_luan_chuyen
  WHERE id = v_request_id;

  v_second_completed_at := v_req.ngay_hoan_thanh;

  SELECT COUNT(*)
  INTO v_completion_logs_after
  FROM public.audit_logs al
  WHERE al.entity_type = 'transfer_request'
    AND al.entity_id = v_request_id
    AND al.action_type = 'transfer_request_complete';

  SELECT COUNT(*)
  INTO v_history_rows_after
  FROM public.lich_su_thiet_bi ls
  WHERE ls.thiet_bi_id = v_ctx.equipment_id
    AND ls.chi_tiet->>'yeu_cau_id' = v_request_id::text;

  IF v_req.trang_thai IS DISTINCT FROM 'hoan_thanh' THEN
    RAISE EXCEPTION 'Expected second completion attempt to preserve hoan_thanh status, found %', v_req.trang_thai;
  END IF;

  IF v_second_completed_at IS DISTINCT FROM v_first_completed_at THEN
    RAISE EXCEPTION
      'Expected second completion attempt to preserve ngay_hoan_thanh %, found %',
      v_first_completed_at::text,
      v_second_completed_at::text;
  END IF;

  IF v_completion_logs_after IS DISTINCT FROM v_completion_logs_before THEN
    RAISE EXCEPTION
      'Expected second completion attempt to preserve completion audit count %, found %',
      v_completion_logs_before,
      v_completion_logs_after;
  END IF;

  IF v_history_rows_after IS DISTINCT FROM v_history_rows_before THEN
    RAISE EXCEPTION
      'Expected second completion attempt to preserve equipment history row count %, found %',
      v_history_rows_before,
      v_history_rows_after;
  END IF;

  RAISE NOTICE 'OK: second completion rejected without duplicate side effects';
END $$;

-- 7) transfer_request_complete should fail closed when audit_log returns FALSE
CREATE OR REPLACE FUNCTION public.audit_log(
  p_action_type text,
  p_entity_type text DEFAULT NULL::text,
  p_entity_id bigint DEFAULT NULL::bigint,
  p_entity_label text DEFAULT NULL::text,
  p_action_details jsonb DEFAULT NULL::jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN FALSE;
END;
$function$;

DO $$
DECLARE
  v_ctx _transfer_lifecycle_ctx%ROWTYPE;
  v_request_id bigint;
  v_req public.yeu_cau_luan_chuyen%ROWTYPE;
  v_history_rows bigint;
  v_audit_count bigint;
  v_equipment_room text;
  v_error_raised boolean := false;
BEGIN
  SELECT *
  INTO v_ctx
  FROM _transfer_lifecycle_ctx
  LIMIT 1;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_ctx.user_id::text,
      'sub', v_ctx.user_id::text,
      'don_vi', v_ctx.tenant_id::text
    )::text,
    true
  );

  UPDATE public.thiet_bi
  SET khoa_phong_quan_ly = 'Khoa Cu Fail Closed ' || v_ctx.suffix
  WHERE id = v_ctx.equipment_id;

  v_request_id := public.transfer_request_create(
    jsonb_build_object(
      'thiet_bi_id', v_ctx.equipment_id,
      'loai_hinh', 'noi_bo',
      'ly_do_luan_chuyen', 'Smoke fail closed ' || v_ctx.suffix,
      'khoa_phong_hien_tai', 'Khoa Cu Fail Closed ' || v_ctx.suffix,
      'khoa_phong_nhan', 'Khoa Moi Fail Closed ' || v_ctx.suffix
    )
  );

  UPDATE public.yeu_cau_luan_chuyen
  SET trang_thai = 'da_ban_giao',
      ngay_duyet = clock_timestamp(),
      ngay_ban_giao = clock_timestamp(),
      nguoi_duyet_id = v_ctx.user_id
  WHERE id = v_request_id;

  BEGIN
    PERFORM public.transfer_request_complete(
      v_request_id::int,
      '{}'::jsonb
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_error_raised := true;
  END;

  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'Expected transfer_request_complete to fail closed when audit_log returns FALSE';
  END IF;

  SELECT *
  INTO v_req
  FROM public.yeu_cau_luan_chuyen
  WHERE id = v_request_id;

  SELECT khoa_phong_quan_ly
  INTO v_equipment_room
  FROM public.thiet_bi
  WHERE id = v_ctx.equipment_id;

  SELECT COUNT(*)
  INTO v_history_rows
  FROM public.lich_su_thiet_bi ls
  WHERE ls.thiet_bi_id = v_ctx.equipment_id
    AND ls.chi_tiet->>'yeu_cau_id' = v_request_id::text;

  SELECT COUNT(*)
  INTO v_audit_count
  FROM public.audit_logs al
  WHERE al.entity_type = 'transfer_request'
    AND al.entity_id = v_request_id
    AND al.action_type = 'transfer_request_complete';

  IF v_req.trang_thai IS DISTINCT FROM 'da_ban_giao' THEN
    RAISE EXCEPTION 'Expected fail-closed path to preserve da_ban_giao status, found %', v_req.trang_thai;
  END IF;

  IF v_req.ngay_hoan_thanh IS NOT NULL THEN
    RAISE EXCEPTION 'Expected fail-closed path to preserve NULL ngay_hoan_thanh';
  END IF;

  IF v_equipment_room IS DISTINCT FROM 'Khoa Cu Fail Closed ' || v_ctx.suffix THEN
    RAISE EXCEPTION 'Expected fail-closed path to preserve equipment room, found %', v_equipment_room;
  END IF;

  IF v_history_rows <> 0 THEN
    RAISE EXCEPTION 'Expected fail-closed path to avoid lich_su_thiet_bi rows, found %', v_history_rows;
  END IF;

  IF v_audit_count <> 0 THEN
    RAISE EXCEPTION 'Expected fail-closed path to avoid transfer_request_complete audit rows, found %', v_audit_count;
  END IF;

  RAISE NOTICE 'OK: transfer_request_complete fails closed when audit_log returns FALSE';
END $$;

ROLLBACK;
