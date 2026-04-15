-- supabase/tests/repair_request_lifecycle_audit_smoke.sql
-- Purpose: validate repair request lifecycle audit coverage for update/approve/complete/delete
-- How to run (local): docker exec -i supabase_db_qltbyt-nam-phong psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/repair_request_lifecycle_audit_smoke.sql
-- Non-destructive: wrapped in transaction and rolled back

BEGIN;

-- 1) update path expects repair_request_update audit row
DO $$
DECLARE
  v_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_request_id bigint;
  v_code text := 'RR-LIFECYCLE-UPD-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_request public.yeu_cau_sua_chua%ROWTYPE;
  v_audit_count bigint;
  v_audit_details jsonb;
  v_history_id bigint;
  v_history_details jsonb;
BEGIN
  SELECT id
  INTO v_tenant
  FROM public.don_vi
  WHERE active = true
  ORDER BY id
  LIMIT 1;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No active tenant found for update smoke fixture';
  END IF;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_update_smoke_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    'smoke-password',
    'Repair Update Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code, 'Repair lifecycle update smoke', v_tenant)
  RETURNING id INTO v_thiet_bi_id;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant::text
    )::text,
    true
  );

  v_request_id := public.repair_request_create(
    v_thiet_bi_id::integer,
    'Mô tả ban đầu',
    'Hạng mục ban đầu',
    DATE '2026-04-20',
    'Người yêu cầu smoke',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_update(
    v_request_id::integer,
    'Mô tả đã cập nhật',
    'Hạng mục đã cập nhật',
    DATE '2026-04-21',
    'thue_ngoai',
    'Đơn vị sửa chữa ABC'
  );

  SELECT *
  INTO v_request
  FROM public.yeu_cau_sua_chua
  WHERE id = v_request_id;

  SELECT COUNT(*)
  INTO v_audit_count
  FROM public.audit_logs
  WHERE entity_type = 'repair_request'
    AND entity_id = v_request_id
    AND action_type = 'repair_request_update';

  SELECT COALESCE(al.action_details, '{}'::jsonb)
  INTO v_audit_details
  FROM public.audit_logs al
  WHERE al.entity_type = 'repair_request'
    AND al.entity_id = v_request_id
    AND al.action_type = 'repair_request_update'
  ORDER BY al.id DESC
  LIMIT 1;

  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'Expected 1 repair_request_update audit row, got %', v_audit_count;
  END IF;

  IF v_audit_details->>'mo_ta_su_co' IS DISTINCT FROM v_request.mo_ta_su_co THEN
    RAISE EXCEPTION 'repair_request_update audit mo_ta_su_co mismatch';
  END IF;

  IF v_audit_details->>'hang_muc_sua_chua' IS DISTINCT FROM v_request.hang_muc_sua_chua THEN
    RAISE EXCEPTION 'repair_request_update audit hang_muc_sua_chua mismatch';
  END IF;

  IF v_audit_details->>'ngay_mong_muon_hoan_thanh' IS DISTINCT FROM v_request.ngay_mong_muon_hoan_thanh::text THEN
    RAISE EXCEPTION 'repair_request_update audit ngay_mong_muon_hoan_thanh mismatch';
  END IF;

  IF v_audit_details->>'don_vi_thuc_hien' IS DISTINCT FROM v_request.don_vi_thuc_hien THEN
    RAISE EXCEPTION 'repair_request_update audit don_vi_thuc_hien mismatch';
  END IF;

  IF v_audit_details->>'ten_don_vi_thue' IS DISTINCT FROM v_request.ten_don_vi_thue THEN
    RAISE EXCEPTION 'repair_request_update audit ten_don_vi_thue mismatch';
  END IF;

  SELECT ls.id, COALESCE(ls.chi_tiet, '{}'::jsonb)
  INTO v_history_id, v_history_details
  FROM public.lich_su_thiet_bi ls
  WHERE ls.yeu_cau_id = v_request_id
    AND ls.mo_ta = 'Cập nhật nội dung yêu cầu sửa chữa'
  ORDER BY ls.id DESC
  LIMIT 1;

  IF v_history_id IS NULL THEN
    RAISE EXCEPTION 'repair_request_update should append equipment history row';
  END IF;

  IF v_history_details->>'ten_don_vi_thue' IS DISTINCT FROM v_request.ten_don_vi_thue THEN
    RAISE EXCEPTION 'repair_request_update equipment history ten_don_vi_thue mismatch';
  END IF;

  RAISE NOTICE 'OK: repair_request_update audit smoke passed';
END $$;

-- 2) approve path expects repair_request_approve audit row with persisted values
DO $$
DECLARE
  v_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_request_id bigint;
  v_code text := 'RR-LIFECYCLE-APP-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_request public.yeu_cau_sua_chua%ROWTYPE;
  v_audit_count bigint;
  v_audit_details jsonb;
  v_equipment_status text;
  v_history_id bigint;
  v_history_details jsonb;
BEGIN
  SELECT id
  INTO v_tenant
  FROM public.don_vi
  WHERE active = true
  ORDER BY id
  LIMIT 1;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No active tenant found for approve smoke fixture';
  END IF;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_approve_smoke_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    'smoke-password',
    'Repair Approve Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code, 'Repair lifecycle approve smoke', v_tenant)
  RETURNING id INTO v_thiet_bi_id;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant::text
    )::text,
    true
  );

  v_request_id := public.repair_request_create(
    v_thiet_bi_id::integer,
    'Mô tả để duyệt',
    'Hạng mục để duyệt',
    DATE '2026-04-22',
    'Người yêu cầu smoke',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_approve(
    v_request_id::integer,
    'Người duyệt smoke',
    'noi_bo',
    'GIÁ TRỊ KHÔNG ĐƯỢC LOG'
  );

  SELECT *
  INTO v_request
  FROM public.yeu_cau_sua_chua
  WHERE id = v_request_id;

  SELECT COUNT(*)
  INTO v_audit_count
  FROM public.audit_logs
  WHERE entity_type = 'repair_request'
    AND entity_id = v_request_id
    AND action_type = 'repair_request_approve';

  SELECT COALESCE(al.action_details, '{}'::jsonb)
  INTO v_audit_details
  FROM public.audit_logs al
  WHERE al.entity_type = 'repair_request'
    AND al.entity_id = v_request_id
    AND al.action_type = 'repair_request_approve'
  ORDER BY al.id DESC
  LIMIT 1;

  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'Expected 1 repair_request_approve audit row, got %', v_audit_count;
  END IF;

  IF v_audit_details->>'trang_thai' IS DISTINCT FROM v_request.trang_thai THEN
    RAISE EXCEPTION 'repair_request_approve audit trang_thai mismatch';
  END IF;

  IF v_audit_details->>'nguoi_duyet' IS DISTINCT FROM v_request.nguoi_duyet THEN
    RAISE EXCEPTION 'repair_request_approve audit nguoi_duyet mismatch';
  END IF;

  IF COALESCE(v_audit_details->>'ngay_duyet', '') = '' THEN
    RAISE EXCEPTION 'repair_request_approve audit ngay_duyet missing';
  END IF;

  IF (v_audit_details->>'ngay_duyet')::timestamptz IS DISTINCT FROM v_request.ngay_duyet THEN
    RAISE EXCEPTION 'repair_request_approve audit ngay_duyet mismatch';
  END IF;

  IF v_audit_details->>'don_vi_thuc_hien' IS DISTINCT FROM v_request.don_vi_thuc_hien THEN
    RAISE EXCEPTION 'repair_request_approve audit don_vi_thuc_hien mismatch';
  END IF;

  IF v_request.ten_don_vi_thue IS NOT NULL THEN
    RAISE EXCEPTION 'Expected persisted ten_don_vi_thue to be NULL for noi_bo approval';
  END IF;

  IF v_audit_details->>'ten_don_vi_thue' IS DISTINCT FROM v_request.ten_don_vi_thue THEN
    RAISE EXCEPTION 'repair_request_approve audit ten_don_vi_thue mismatch';
  END IF;

  SELECT tb.tinh_trang_hien_tai
  INTO v_equipment_status
  FROM public.thiet_bi tb
  WHERE tb.id = v_thiet_bi_id;

  IF v_equipment_status IS DISTINCT FROM 'Chờ sửa chữa' THEN
    RAISE EXCEPTION 'repair_request_approve should set equipment status to Chờ sửa chữa';
  END IF;

  SELECT ls.id, COALESCE(ls.chi_tiet, '{}'::jsonb)
  INTO v_history_id, v_history_details
  FROM public.lich_su_thiet_bi ls
  WHERE ls.yeu_cau_id = v_request_id
    AND ls.mo_ta = 'Duyệt yêu cầu sửa chữa'
  ORDER BY ls.id DESC
  LIMIT 1;

  IF v_history_id IS NULL THEN
    RAISE EXCEPTION 'repair_request_approve should append equipment history row';
  END IF;

  IF v_history_details->>'ten_don_vi_thue' IS DISTINCT FROM v_request.ten_don_vi_thue THEN
    RAISE EXCEPTION 'repair_request_approve equipment history ten_don_vi_thue mismatch';
  END IF;

  RAISE NOTICE 'OK: repair_request_approve audit smoke passed';
END $$;

-- 3) complete path expects repair_request_complete audit row with persisted terminal state
DO $$
DECLARE
  v_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_request_id bigint;
  v_code text := 'RR-LIFECYCLE-CMP-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_request public.yeu_cau_sua_chua%ROWTYPE;
  v_audit_count bigint;
  v_audit_details jsonb;
  v_equipment_status text;
  v_history_id bigint;
  v_history_details jsonb;
BEGIN
  SELECT id
  INTO v_tenant
  FROM public.don_vi
  WHERE active = true
  ORDER BY id
  LIMIT 1;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No active tenant found for complete smoke fixture';
  END IF;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_complete_smoke_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    'smoke-password',
    'Repair Complete Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code, 'Repair lifecycle complete smoke', v_tenant)
  RETURNING id INTO v_thiet_bi_id;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant::text
    )::text,
    true
  );

  v_request_id := public.repair_request_create(
    v_thiet_bi_id::integer,
    'Mô tả để hoàn tất',
    'Hạng mục để hoàn tất',
    DATE '2026-04-23',
    'Người yêu cầu smoke',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_approve(
    v_request_id::integer,
    'Người duyệt smoke',
    'thue_ngoai',
    'Đơn vị thuê hoàn tất'
  );

  PERFORM public.repair_request_complete(
    v_request_id::integer,
    'Đã thay cụm nguồn',
    NULL
  );

  SELECT *
  INTO v_request
  FROM public.yeu_cau_sua_chua
  WHERE id = v_request_id;

  SELECT COUNT(*)
  INTO v_audit_count
  FROM public.audit_logs
  WHERE entity_type = 'repair_request'
    AND entity_id = v_request_id
    AND action_type = 'repair_request_complete';

  SELECT COALESCE(al.action_details, '{}'::jsonb)
  INTO v_audit_details
  FROM public.audit_logs al
  WHERE al.entity_type = 'repair_request'
    AND al.entity_id = v_request_id
    AND al.action_type = 'repair_request_complete'
  ORDER BY al.id DESC
  LIMIT 1;

  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'Expected 1 repair_request_complete audit row, got %', v_audit_count;
  END IF;

  IF v_audit_details->>'trang_thai' IS DISTINCT FROM v_request.trang_thai THEN
    RAISE EXCEPTION 'repair_request_complete audit trang_thai mismatch';
  END IF;

  IF v_audit_details->>'ket_qua_sua_chua' IS DISTINCT FROM v_request.ket_qua_sua_chua THEN
    RAISE EXCEPTION 'repair_request_complete audit ket_qua_sua_chua mismatch';
  END IF;

  IF v_audit_details->>'ly_do_khong_hoan_thanh' IS DISTINCT FROM v_request.ly_do_khong_hoan_thanh THEN
    RAISE EXCEPTION 'repair_request_complete audit ly_do_khong_hoan_thanh mismatch';
  END IF;

  SELECT tb.tinh_trang_hien_tai
  INTO v_equipment_status
  FROM public.thiet_bi tb
  WHERE tb.id = v_thiet_bi_id;

  IF v_equipment_status IS DISTINCT FROM 'Hoạt động' THEN
    RAISE EXCEPTION 'repair_request_complete should restore equipment status to Hoạt động';
  END IF;

  SELECT ls.id, COALESCE(ls.chi_tiet, '{}'::jsonb)
  INTO v_history_id, v_history_details
  FROM public.lich_su_thiet_bi ls
  WHERE ls.yeu_cau_id = v_request_id
    AND ls.mo_ta = 'Yêu cầu sửa chữa cập nhật trạng thái'
  ORDER BY ls.id DESC
  LIMIT 1;

  IF v_history_id IS NULL THEN
    RAISE EXCEPTION 'repair_request_complete should append equipment history row';
  END IF;

  IF v_history_details->>'ket_qua' IS DISTINCT FROM v_request.ket_qua_sua_chua THEN
    RAISE EXCEPTION 'repair_request_complete equipment history ket_qua mismatch';
  END IF;

  IF v_history_details->>'trang_thai' IS DISTINCT FROM v_request.trang_thai THEN
    RAISE EXCEPTION 'repair_request_complete equipment history trang_thai mismatch';
  END IF;

  RAISE NOTICE 'OK: repair_request_complete audit smoke passed';
END $$;

-- 4) complete path should reject a second completion without duplicate side effects
DO $$
DECLARE
  v_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_request_id bigint;
  v_code text := 'RR-LIFECYCLE-RECOMP-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_request public.yeu_cau_sua_chua%ROWTYPE;
  v_first_completed_at timestamptz;
  v_second_completed_at timestamptz;
  v_completion_logs_before bigint;
  v_completion_logs_after bigint;
  v_history_rows_before bigint;
  v_history_rows_after bigint;
  v_error_raised boolean := false;
BEGIN
  SELECT id
  INTO v_tenant
  FROM public.don_vi
  WHERE active = true
  ORDER BY id
  LIMIT 1;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No active tenant found for double-complete smoke fixture';
  END IF;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_recomplete_smoke_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    'smoke-password',
    'Repair Recomplete Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code, 'Repair lifecycle double-complete smoke', v_tenant)
  RETURNING id INTO v_thiet_bi_id;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant::text
    )::text,
    true
  );

  v_request_id := public.repair_request_create(
    v_thiet_bi_id::integer,
    'Mô tả double complete',
    'Hạng mục double complete',
    DATE '2026-04-25',
    'Người yêu cầu smoke',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_approve(
    v_request_id::integer,
    'Người duyệt smoke',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_complete(
    v_request_id::integer,
    'Đã sửa lần một',
    NULL
  );

  SELECT *
  INTO v_request
  FROM public.yeu_cau_sua_chua
  WHERE id = v_request_id;

  v_first_completed_at := v_request.ngay_hoan_thanh;

  SELECT COUNT(*)
  INTO v_completion_logs_before
  FROM public.audit_logs al
  WHERE al.entity_type = 'repair_request'
    AND al.entity_id = v_request_id
    AND al.action_type = 'repair_request_complete';

  SELECT COUNT(*)
  INTO v_history_rows_before
  FROM public.lich_su_thiet_bi ls
  WHERE ls.yeu_cau_id = v_request_id
    AND ls.mo_ta = 'Yêu cầu sửa chữa cập nhật trạng thái';

  IF v_completion_logs_before < 1 THEN
    RAISE EXCEPTION 'Setup failed: first repair_request_complete should create at least one audit row';
  END IF;

  IF v_history_rows_before < 1 THEN
    RAISE EXCEPTION 'Setup failed: first repair_request_complete should create at least one equipment history row';
  END IF;

  BEGIN
    PERFORM public.repair_request_complete(
      v_request_id::integer,
      'Không được ghi đè',
      NULL
    );
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      v_error_raised := true;
  END;

  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'Expected repair_request_complete to reject a second completion';
  END IF;

  SELECT *
  INTO v_request
  FROM public.yeu_cau_sua_chua
  WHERE id = v_request_id;

  v_second_completed_at := v_request.ngay_hoan_thanh;

  SELECT COUNT(*)
  INTO v_completion_logs_after
  FROM public.audit_logs al
  WHERE al.entity_type = 'repair_request'
    AND al.entity_id = v_request_id
    AND al.action_type = 'repair_request_complete';

  SELECT COUNT(*)
  INTO v_history_rows_after
  FROM public.lich_su_thiet_bi ls
  WHERE ls.yeu_cau_id = v_request_id
    AND ls.mo_ta = 'Yêu cầu sửa chữa cập nhật trạng thái';

  IF v_request.trang_thai IS DISTINCT FROM 'Hoàn thành' THEN
    RAISE EXCEPTION 'Expected second repair completion attempt to preserve Hoàn thành status, found %', v_request.trang_thai;
  END IF;

  IF v_second_completed_at IS DISTINCT FROM v_first_completed_at THEN
    RAISE EXCEPTION
      'Expected second repair completion attempt to preserve ngay_hoan_thanh %, found %',
      v_first_completed_at::text,
      v_second_completed_at::text;
  END IF;

  IF v_completion_logs_after IS DISTINCT FROM v_completion_logs_before THEN
    RAISE EXCEPTION
      'Expected second repair completion attempt to preserve completion audit count %, found %',
      v_completion_logs_before,
      v_completion_logs_after;
  END IF;

  IF v_history_rows_after IS DISTINCT FROM v_history_rows_before THEN
    RAISE EXCEPTION
      'Expected second repair completion attempt to preserve equipment history row count %, found %',
      v_history_rows_before,
      v_history_rows_after;
  END IF;

  RAISE NOTICE 'OK: repair_request_complete rejects second completion';
END $$;

-- 5) approve path should reject requests that already reached a terminal state
DO $$
DECLARE
  v_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_request_id bigint;
  v_code text := 'RR-LIFECYCLE-REAPP-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_request public.yeu_cau_sua_chua%ROWTYPE;
  v_first_approved_at timestamptz;
  v_second_approved_at timestamptz;
  v_equipment_status_before text;
  v_equipment_status_after text;
  v_approve_logs_before bigint;
  v_approve_logs_after bigint;
  v_history_rows_before bigint;
  v_history_rows_after bigint;
  v_error_raised boolean := false;
BEGIN
  SELECT id
  INTO v_tenant
  FROM public.don_vi
  WHERE active = true
  ORDER BY id
  LIMIT 1;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No active tenant found for approve-after-complete smoke fixture';
  END IF;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_reapprove_smoke_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    'smoke-password',
    'Repair Reapprove Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code, 'Repair lifecycle approve-after-complete smoke', v_tenant)
  RETURNING id INTO v_thiet_bi_id;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant::text
    )::text,
    true
  );

  v_request_id := public.repair_request_create(
    v_thiet_bi_id::integer,
    'Mô tả để duyệt lại',
    'Hạng mục để duyệt lại',
    DATE '2026-04-25',
    'Người yêu cầu smoke',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_approve(
    v_request_id::integer,
    'Người duyệt smoke',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_complete(
    v_request_id::integer,
    'Hoàn thành smoke',
    NULL
  );

  SELECT *
  INTO v_request
  FROM public.yeu_cau_sua_chua
  WHERE id = v_request_id;

  v_first_approved_at := v_request.ngay_duyet;

  SELECT tb.tinh_trang_hien_tai
  INTO v_equipment_status_before
  FROM public.thiet_bi tb
  WHERE tb.id = v_thiet_bi_id;

  SELECT COUNT(*)
  INTO v_approve_logs_before
  FROM public.audit_logs al
  WHERE al.entity_type = 'repair_request'
    AND al.entity_id = v_request_id
    AND al.action_type = 'repair_request_approve';

  SELECT COUNT(*)
  INTO v_history_rows_before
  FROM public.lich_su_thiet_bi ls
  WHERE ls.yeu_cau_id = v_request_id
    AND ls.mo_ta = 'Duyệt yêu cầu sửa chữa';

  BEGIN
    PERFORM public.repair_request_approve(
      v_request_id::integer,
      'Người duyệt lại smoke',
      'noi_bo',
      NULL
    );
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      v_error_raised := true;
  END;

  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'Expected repair_request_approve to reject requests already in a terminal state';
  END IF;

  SELECT *
  INTO v_request
  FROM public.yeu_cau_sua_chua
  WHERE id = v_request_id;

  v_second_approved_at := v_request.ngay_duyet;

  SELECT tb.tinh_trang_hien_tai
  INTO v_equipment_status_after
  FROM public.thiet_bi tb
  WHERE tb.id = v_thiet_bi_id;

  SELECT COUNT(*)
  INTO v_approve_logs_after
  FROM public.audit_logs al
  WHERE al.entity_type = 'repair_request'
    AND al.entity_id = v_request_id
    AND al.action_type = 'repair_request_approve';

  SELECT COUNT(*)
  INTO v_history_rows_after
  FROM public.lich_su_thiet_bi ls
  WHERE ls.yeu_cau_id = v_request_id
    AND ls.mo_ta = 'Duyệt yêu cầu sửa chữa';

  IF v_request.trang_thai IS DISTINCT FROM 'Hoàn thành' THEN
    RAISE EXCEPTION 'Expected approve-after-complete path to preserve Hoàn thành status, found %', v_request.trang_thai;
  END IF;

  IF v_second_approved_at IS DISTINCT FROM v_first_approved_at THEN
    RAISE EXCEPTION 'Expected approve-after-complete path to preserve ngay_duyet %, found %', v_first_approved_at::text, v_second_approved_at::text;
  END IF;

  IF v_equipment_status_before IS DISTINCT FROM 'Hoạt động' THEN
    RAISE EXCEPTION 'Setup failed: completed repair should leave equipment in Hoạt động, found %', v_equipment_status_before;
  END IF;

  IF v_equipment_status_after IS DISTINCT FROM v_equipment_status_before THEN
    RAISE EXCEPTION 'Expected approve-after-complete path to preserve equipment status %, found %', v_equipment_status_before, v_equipment_status_after;
  END IF;

  IF v_approve_logs_after IS DISTINCT FROM v_approve_logs_before THEN
    RAISE EXCEPTION 'Expected approve-after-complete path to preserve approve audit count %, found %', v_approve_logs_before, v_approve_logs_after;
  END IF;

  IF v_history_rows_after IS DISTINCT FROM v_history_rows_before THEN
    RAISE EXCEPTION 'Expected approve-after-complete path to preserve approve history row count %, found %', v_history_rows_before, v_history_rows_after;
  END IF;

  RAISE NOTICE 'OK: repair_request_approve rejects terminal-state requests';
END $$;

-- 6) delete path expects repair_request_delete audit row with persisted pre-delete state
DO $$
DECLARE
  v_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_request_id bigint;
  v_code text := 'RR-LIFECYCLE-DEL-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_expected_status text;
  v_expected_equipment_status text := 'Ngưng sử dụng';
  v_remaining bigint;
  v_audit_count bigint;
  v_audit_details jsonb;
  v_history_id bigint;
  v_history_details jsonb;
  v_equipment_status_after_delete text;
BEGIN
  SELECT id
  INTO v_tenant
  FROM public.don_vi
  WHERE active = true
  ORDER BY id
  LIMIT 1;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No active tenant found for delete smoke fixture';
  END IF;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_delete_smoke_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    'smoke-password',
    'Repair Delete Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, tinh_trang_hien_tai)
  VALUES (v_code, 'Repair lifecycle delete smoke', v_tenant, v_expected_equipment_status)
  RETURNING id INTO v_thiet_bi_id;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant::text
    )::text,
    true
  );

  v_request_id := public.repair_request_create(
    v_thiet_bi_id::integer,
    'Mô tả để xóa',
    'Hạng mục để xóa',
    DATE '2026-04-24',
    'Người yêu cầu smoke',
    'noi_bo',
    NULL
  );

  PERFORM public.repair_request_approve(
    v_request_id::integer,
    'Người duyệt smoke',
    'noi_bo',
    'KHÔNG ĐƯỢC GIỮ'
  );

  SELECT trang_thai
  INTO v_expected_status
  FROM public.yeu_cau_sua_chua
  WHERE id = v_request_id;

  PERFORM public.repair_request_delete(v_request_id::integer);

  SELECT COUNT(*)
  INTO v_remaining
  FROM public.yeu_cau_sua_chua
  WHERE id = v_request_id;

  IF v_remaining <> 0 THEN
    RAISE EXCEPTION 'Expected repair_request_delete to remove the request row';
  END IF;

  SELECT COUNT(*)
  INTO v_audit_count
  FROM public.audit_logs
  WHERE entity_type = 'repair_request'
    AND entity_id = v_request_id
    AND action_type = 'repair_request_delete';

  SELECT COALESCE(al.action_details, '{}'::jsonb)
  INTO v_audit_details
  FROM public.audit_logs al
  WHERE al.entity_type = 'repair_request'
    AND al.entity_id = v_request_id
    AND al.action_type = 'repair_request_delete'
  ORDER BY al.id DESC
  LIMIT 1;

  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'Expected 1 repair_request_delete audit row, got %', v_audit_count;
  END IF;

  IF (v_audit_details->>'thiet_bi_id')::bigint IS DISTINCT FROM v_thiet_bi_id THEN
    RAISE EXCEPTION 'repair_request_delete audit thiet_bi_id mismatch';
  END IF;

  IF v_audit_details->>'trang_thai' IS DISTINCT FROM v_expected_status THEN
    RAISE EXCEPTION 'repair_request_delete audit trang_thai mismatch';
  END IF;

  SELECT ls.id, COALESCE(ls.chi_tiet, '{}'::jsonb)
  INTO v_history_id, v_history_details
  FROM public.lich_su_thiet_bi ls
  WHERE ls.thiet_bi_id = v_thiet_bi_id
    AND ls.mo_ta = 'Xóa yêu cầu sửa chữa'
  ORDER BY ls.id DESC
  LIMIT 1;

  IF v_history_id IS NULL THEN
    RAISE EXCEPTION 'repair_request_delete should append equipment history row';
  END IF;

  IF (v_history_details->>'yeu_cau_id')::bigint IS DISTINCT FROM v_request_id THEN
    RAISE EXCEPTION 'repair_request_delete equipment history yeu_cau_id mismatch';
  END IF;

  SELECT tb.tinh_trang_hien_tai
  INTO v_equipment_status_after_delete
  FROM public.thiet_bi tb
  WHERE tb.id = v_thiet_bi_id;

  IF v_equipment_status_after_delete IS DISTINCT FROM v_expected_equipment_status THEN
    RAISE EXCEPTION
      'repair_request_delete should restore equipment status %, found %',
      v_expected_equipment_status,
      v_equipment_status_after_delete;
  END IF;

  RAISE NOTICE 'OK: repair_request_delete audit smoke passed';
END $$;

-- 7) update path should fail closed when audit_log returns FALSE
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
  v_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_request_id bigint;
  v_code text := 'RR-LIFECYCLE-UPD-FAIL-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_request public.yeu_cau_sua_chua%ROWTYPE;
  v_error_raised boolean := false;
  v_audit_count bigint;
BEGIN
  SELECT id
  INTO v_tenant
  FROM public.don_vi
  WHERE active = true
  ORDER BY id
  LIMIT 1;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No active tenant found for update fail-closed smoke fixture';
  END IF;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_update_fail_smoke_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    'smoke-password',
    'Repair Update Fail-Closed Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, tinh_trang_hien_tai)
  VALUES (v_code, 'Repair lifecycle update fail-closed smoke', v_tenant, 'Hoạt động')
  RETURNING id INTO v_thiet_bi_id;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant::text
    )::text,
    true
  );

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
    v_thiet_bi_id,
    'Mô tả fail-closed',
    'Hạng mục fail-closed',
    current_date + 1,
    'Người yêu cầu smoke',
    'Chờ xử lý',
    'noi_bo',
    NULL,
    'Hoạt động'
  )
  RETURNING id INTO v_request_id;

  BEGIN
    PERFORM public.repair_request_update(
      v_request_id::integer,
      'Mô tả không được persist',
      'Hạng mục không được persist',
      current_date + 2,
      'thue_ngoai',
      'Đơn vị sửa chữa không được persist'
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_error_raised := true;
  END;

  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'Expected repair_request_update to fail closed when audit_log returns FALSE';
  END IF;

  SELECT *
  INTO v_request
  FROM public.yeu_cau_sua_chua
  WHERE id = v_request_id;

  IF v_request.mo_ta_su_co IS DISTINCT FROM 'Mô tả fail-closed' THEN
    RAISE EXCEPTION 'repair_request_update fail-closed path should preserve original mo_ta_su_co';
  END IF;

  SELECT COUNT(*)
  INTO v_audit_count
  FROM public.audit_logs
  WHERE entity_type = 'repair_request'
    AND entity_id = v_request_id
    AND action_type = 'repair_request_update';

  IF v_audit_count <> 0 THEN
    RAISE EXCEPTION 'repair_request_update fail-closed path should not persist audit rows';
  END IF;

  RAISE NOTICE 'OK: repair_request_update fails closed when audit_log returns FALSE';
END $$;

-- 8) approve path should fail closed when audit_log returns FALSE
DO $$
DECLARE
  v_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_request_id bigint;
  v_code text := 'RR-LIFECYCLE-APP-FAIL-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_request public.yeu_cau_sua_chua%ROWTYPE;
  v_audit_count bigint;
  v_error_raised boolean := false;
BEGIN
  SELECT id
  INTO v_tenant
  FROM public.don_vi
  WHERE active = true
  ORDER BY id
  LIMIT 1;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No active tenant found for approve fail-closed smoke fixture';
  END IF;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_approve_fail_smoke_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    'smoke-password',
    'Repair Approve Fail-Closed Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, tinh_trang_hien_tai)
  VALUES (v_code, 'Repair lifecycle approve fail-closed smoke', v_tenant, 'Hoạt động')
  RETURNING id INTO v_thiet_bi_id;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant::text
    )::text,
    true
  );

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
    v_thiet_bi_id,
    'Mô tả approve fail-closed',
    'Hạng mục approve fail-closed',
    current_date + 1,
    'Người yêu cầu smoke',
    'Chờ xử lý',
    'noi_bo',
    NULL,
    'Hoạt động'
  )
  RETURNING id INTO v_request_id;

  BEGIN
    PERFORM public.repair_request_approve(
      v_request_id::integer,
      'Người duyệt không được persist',
      'noi_bo',
      NULL
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_error_raised := true;
  END;

  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'Expected repair_request_approve to fail closed when audit_log returns FALSE';
  END IF;

  SELECT *
  INTO v_request
  FROM public.yeu_cau_sua_chua
  WHERE id = v_request_id;

  IF v_request.trang_thai IS DISTINCT FROM 'Chờ xử lý' THEN
    RAISE EXCEPTION 'repair_request_approve fail-closed path should preserve original trạng thái';
  END IF;

  SELECT COUNT(*)
  INTO v_audit_count
  FROM public.audit_logs
  WHERE entity_type = 'repair_request'
    AND entity_id = v_request_id
    AND action_type = 'repair_request_approve';

  IF v_audit_count <> 0 THEN
    RAISE EXCEPTION 'repair_request_approve fail-closed path should not persist audit rows';
  END IF;

  RAISE NOTICE 'OK: repair_request_approve fails closed when audit_log returns FALSE';
END $$;

-- 9) create path should fail closed when audit_log returns FALSE
DO $$
DECLARE
  v_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_code text := 'RR-LIFECYCLE-CREATE-FAIL-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_error_raised boolean := false;
  v_request_count bigint;
  v_history_count bigint;
  v_equipment_status text;
BEGIN
  SELECT id
  INTO v_tenant
  FROM public.don_vi
  WHERE active = true
  ORDER BY id
  LIMIT 1;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'No active tenant found for create fail-closed smoke fixture';
  END IF;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_create_fail_smoke_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    'smoke-password',
    'Repair Create Fail-Closed Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, tinh_trang_hien_tai)
  VALUES (v_code, 'Repair lifecycle create fail-closed smoke', v_tenant, 'Ngưng sử dụng')
  RETURNING id INTO v_thiet_bi_id;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant::text
    )::text,
    true
  );

  BEGIN
    PERFORM public.repair_request_create(
      v_thiet_bi_id::integer,
      'Mô tả create fail-closed',
      'Hạng mục create fail-closed',
      current_date + 1,
      'Người yêu cầu smoke',
      'noi_bo',
      NULL
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_error_raised := true;
  END;

  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'Expected repair_request_create to fail closed when audit_log returns FALSE';
  END IF;

  SELECT COUNT(*)
  INTO v_request_count
  FROM public.yeu_cau_sua_chua
  WHERE thiet_bi_id = v_thiet_bi_id
    AND mo_ta_su_co = 'Mô tả create fail-closed';

  IF v_request_count <> 0 THEN
    RAISE EXCEPTION 'repair_request_create fail-closed path should not persist request rows';
  END IF;

  SELECT COUNT(*)
  INTO v_history_count
  FROM public.lich_su_thiet_bi
  WHERE thiet_bi_id = v_thiet_bi_id
    AND mo_ta = 'Tạo yêu cầu sửa chữa';

  IF v_history_count <> 0 THEN
    RAISE EXCEPTION 'repair_request_create fail-closed path should not persist equipment history rows';
  END IF;

  SELECT tb.tinh_trang_hien_tai
  INTO v_equipment_status
  FROM public.thiet_bi tb
  WHERE tb.id = v_thiet_bi_id;

  IF v_equipment_status IS DISTINCT FROM 'Ngưng sử dụng' THEN
    RAISE EXCEPTION 'repair_request_create fail-closed path should preserve original equipment status, found %', v_equipment_status;
  END IF;

  RAISE NOTICE 'OK: repair_request_create fails closed when audit_log returns FALSE';
END $$;

ROLLBACK;
