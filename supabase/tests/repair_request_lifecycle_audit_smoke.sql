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

-- 4) delete path expects repair_request_delete audit row with persisted pre-delete state
DO $$
DECLARE
  v_tenant bigint;
  v_user_id bigint;
  v_thiet_bi_id bigint;
  v_request_id bigint;
  v_code text := 'RR-LIFECYCLE-DEL-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_expected_status text;
  v_remaining bigint;
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

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code, 'Repair lifecycle delete smoke', v_tenant)
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

  RAISE NOTICE 'OK: repair_request_delete audit smoke passed';
END $$;

ROLLBACK;
