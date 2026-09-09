-- supabase/tests/repair_request_lifecycle_audit_smoke.sql
-- Purpose: validate repair request lifecycle audit coverage for update/approve/complete/delete
-- How to run (local): docker exec -i supabase_db_qltbyt-nam-phong psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/repair_request_lifecycle_audit_smoke.sql
-- Non-destructive: wrapped in transaction and rolled back

BEGIN;

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

-- 7) update path should fail closed when audit_log returns FALSE
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
