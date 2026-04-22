-- supabase/tests/equipment_department_scope_workflow_guards_smoke.sql
-- Purpose: lock role=user department-scoped workflow guard behavior for Issue #302
-- Non-destructive: wrapped in transaction and rolled back

BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_plan_id bigint;
  v_user_id bigint;
  v_allowed_equipment bigint;
  v_blocked_equipment bigint;
  v_nonuser_equipment bigint;
  v_request_id bigint;
  v_transfer_id bigint;
  v_failed boolean;
  v_sqlstate text;
  v_sqlerrm text;
  v_count bigint;
  v_status text;
BEGIN
  SELECT kh.id
  INTO v_plan_id
  FROM public.ke_hoach_bao_tri kh
  ORDER BY kh.id
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Setup failed: no ke_hoach_bao_tri row found for maintenance workflow smoke test';
  END IF;

  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Workflow Department Tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'workflow_department_smoke_' || v_suffix,
    'smoke-password',
    'Workflow Department Smoke',
    'user',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    is_deleted
  )
  VALUES (
    'SMK-WF-ALLOW-' || v_suffix,
    'Workflow Department Allowed ' || v_suffix,
    v_tenant,
    '  Nội thận - Tiết niệu  ',
    'Hoat dong',
    false
  )
  RETURNING id INTO v_allowed_equipment;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    is_deleted
  )
  VALUES (
    'SMK-WF-BLOCK-' || v_suffix,
    'Workflow Department Blocked ' || v_suffix,
    v_tenant,
    'Khoa Ngoai ' || v_suffix,
    'Hoat dong',
    false
  )
  RETURNING id INTO v_blocked_equipment;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    is_deleted
  )
  VALUES (
    'SMK-WF-NONUSER-' || v_suffix,
    'Workflow Department Non-user ' || v_suffix,
    v_tenant,
    'Khoa Khac ' || v_suffix,
    'Hoat dong',
    false
  )
  RETURNING id INTO v_nonuser_equipment;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'user',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant::text,
      'khoa_phong', ' ' || chr(160) || E'NỘI\nTHẬN\t - TIẾT   NIỆU '
    )::text,
    true
  );

  v_request_id := public.repair_request_create(
    v_allowed_equipment::integer,
    'Smoke allowed repair ' || v_suffix,
    'Allowed repair scope',
    current_date + 1,
    'Smoke user',
    'noi_bo',
    NULL
  );

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'Expected same-department role user repair_request_create to succeed';
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.yeu_cau_sua_chua
  WHERE id = v_request_id
    AND thiet_bi_id = v_allowed_equipment;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'repair_request_create should persist exactly 1 allowed request row, got %', v_count;
  END IF;

  v_transfer_id := public.transfer_request_create(
    jsonb_build_object(
      'thiet_bi_id', v_allowed_equipment,
      'loai_hinh', 'noi_bo',
      'ly_do_luan_chuyen', 'Smoke allowed transfer ' || v_suffix,
      'khoa_phong_hien_tai', 'Nội thận - Tiết niệu',
      'khoa_phong_nhan', 'Khoa Hoi suc ' || v_suffix
    )
  );

  IF v_transfer_id IS NULL THEN
    RAISE EXCEPTION 'Expected same-department role user transfer_request_create to succeed';
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.yeu_cau_luan_chuyen
  WHERE id = v_transfer_id
    AND thiet_bi_id = v_allowed_equipment;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'transfer_request_create should persist exactly 1 allowed row, got %', v_count;
  END IF;

  PERFORM public.maintenance_tasks_bulk_insert(
    jsonb_build_array(
      jsonb_build_object(
        'ke_hoach_id', v_plan_id,
        'thiet_bi_id', v_allowed_equipment,
        'loai_cong_viec', 'kiem_tra',
        'diem_hieu_chuan', 'Smoke allowed maintenance ' || v_suffix,
        'don_vi_thuc_hien', 'noi_bo',
        'thang_1', true,
        'ghi_chu', 'Smoke allowed maintenance ' || v_suffix
      )
    )
  );

  SELECT COUNT(*)
  INTO v_count
  FROM public.cong_viec_bao_tri
  WHERE thiet_bi_id = v_allowed_equipment
    AND ghi_chu = 'Smoke allowed maintenance ' || v_suffix;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'maintenance_tasks_bulk_insert should persist exactly 1 allowed row, got %', v_count;
  END IF;

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
    v_nonuser_equipment::integer,
    'Smoke non-user repair ' || v_suffix,
    'Non-user cross department',
    current_date + 2,
    'Smoke operator',
    'noi_bo',
    NULL
  );

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'Expected non-user repair_request_create to preserve current same-tenant behavior';
  END IF;

  v_transfer_id := public.transfer_request_create(
    jsonb_build_object(
      'thiet_bi_id', v_nonuser_equipment,
      'loai_hinh', 'noi_bo',
      'ly_do_luan_chuyen', 'Smoke non-user transfer ' || v_suffix,
      'khoa_phong_hien_tai', 'Khoa Khac ' || v_suffix,
      'khoa_phong_nhan', 'Khoa Nhan non-user ' || v_suffix
    )
  );

  IF v_transfer_id IS NULL THEN
    RAISE EXCEPTION 'Expected non-user transfer_request_create to preserve current same-tenant behavior';
  END IF;

  PERFORM public.maintenance_tasks_bulk_insert(
    jsonb_build_array(
      jsonb_build_object(
        'ke_hoach_id', v_plan_id,
        'thiet_bi_id', v_nonuser_equipment,
        'loai_cong_viec', 'kiem_tra',
        'diem_hieu_chuan', 'Smoke non-user maintenance ' || v_suffix,
        'don_vi_thuc_hien', 'noi_bo',
        'thang_2', true,
        'ghi_chu', 'Smoke non-user maintenance ' || v_suffix
      )
    )
  );

  SELECT COUNT(*)
  INTO v_count
  FROM public.cong_viec_bao_tri
  WHERE thiet_bi_id = v_nonuser_equipment
    AND ghi_chu = 'Smoke non-user maintenance ' || v_suffix;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected non-user maintenance_tasks_bulk_insert to preserve current same-tenant behavior';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'user',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant::text,
      'khoa_phong', 'NỘI THẬN TIẾT NIỆU'
    )::text,
    true
  );

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.repair_request_create(
      v_blocked_equipment::integer,
      'Smoke blocked repair ' || v_suffix,
      'Blocked repair scope',
      current_date + 3,
      'Smoke blocked user',
      'noi_bo',
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected repair_request_create to deny same-tenant cross-department role user access';
  END IF;

  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected repair_request_create cross-department deny with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.yeu_cau_sua_chua
  WHERE thiet_bi_id = v_blocked_equipment
    AND mo_ta_su_co = 'Smoke blocked repair ' || v_suffix;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Cross-department repair deny should not persist request rows';
  END IF;

  SELECT tb.tinh_trang_hien_tai
  INTO v_status
  FROM public.thiet_bi tb
  WHERE tb.id = v_blocked_equipment;

  IF v_status IS DISTINCT FROM 'Hoat dong' THEN
    RAISE EXCEPTION 'Cross-department repair deny should not change equipment status, found %', v_status;
  END IF;

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.transfer_request_create(
      jsonb_build_object(
        'thiet_bi_id', v_blocked_equipment,
        'loai_hinh', 'noi_bo',
        'ly_do_luan_chuyen', 'Smoke blocked transfer ' || v_suffix,
        'khoa_phong_hien_tai', 'Khoa Ngoai ' || v_suffix,
        'khoa_phong_nhan', 'Khoa Nhan blocked ' || v_suffix
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected transfer_request_create to deny same-tenant cross-department role user access';
  END IF;

  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected transfer_request_create cross-department deny with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.yeu_cau_luan_chuyen
  WHERE thiet_bi_id = v_blocked_equipment
    AND ly_do_luan_chuyen = 'Smoke blocked transfer ' || v_suffix;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Cross-department transfer deny should not persist request rows';
  END IF;

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.maintenance_tasks_bulk_insert(
      jsonb_build_array(
        jsonb_build_object(
          'ke_hoach_id', v_plan_id,
          'thiet_bi_id', v_blocked_equipment,
          'loai_cong_viec', 'kiem_tra',
          'diem_hieu_chuan', 'Smoke blocked maintenance ' || v_suffix,
          'don_vi_thuc_hien', 'noi_bo',
          'thang_3', true,
          'ghi_chu', 'Smoke blocked maintenance ' || v_suffix
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected maintenance_tasks_bulk_insert to deny same-tenant cross-department role user access';
  END IF;

  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected maintenance_tasks_bulk_insert cross-department deny with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.cong_viec_bao_tri
  WHERE thiet_bi_id = v_blocked_equipment
    AND ghi_chu = 'Smoke blocked maintenance ' || v_suffix;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Cross-department maintenance deny should not persist task rows';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'user',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant::text,
      'khoa_phong', '   '
    )::text,
    true
  );

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.repair_request_create(
      v_allowed_equipment::integer,
      'Smoke blank-claim repair ' || v_suffix,
      'Blank claim repair scope',
      current_date + 4,
      'Smoke blank user',
      'noi_bo',
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected repair_request_create to fail closed for blank khoa_phong claim';
  END IF;

  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected blank-claim repair_request_create to deny with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.yeu_cau_sua_chua
  WHERE thiet_bi_id = v_allowed_equipment
    AND mo_ta_su_co = 'Smoke blank-claim repair ' || v_suffix;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Blank-claim repair deny should not persist request rows';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'user',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant::text
    )::text,
    true
  );

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.transfer_request_create(
      jsonb_build_object(
        'thiet_bi_id', v_allowed_equipment,
        'loai_hinh', 'noi_bo',
        'ly_do_luan_chuyen', 'Smoke missing-claim transfer ' || v_suffix,
        'khoa_phong_hien_tai', 'Nội thận - Tiết niệu',
        'khoa_phong_nhan', 'Khoa Missing Claim ' || v_suffix
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected transfer_request_create to fail closed for missing khoa_phong claim';
  END IF;

  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected missing-claim transfer_request_create to deny with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.yeu_cau_luan_chuyen
  WHERE thiet_bi_id = v_allowed_equipment
    AND ly_do_luan_chuyen = 'Smoke missing-claim transfer ' || v_suffix;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Missing-claim transfer deny should not persist request rows';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'user',
      'role', 'authenticated',
      'don_vi', v_tenant::text,
      'khoa_phong', 'nội thận - tiết niệu'
    )::text,
    true
  );

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.transfer_request_create(
      jsonb_build_object(
        'thiet_bi_id', v_allowed_equipment,
        'loai_hinh', 'noi_bo',
        'ly_do_luan_chuyen', 'Smoke missing-user-id transfer ' || v_suffix,
        'khoa_phong_hien_tai', 'Nội thận - Tiết niệu',
        'khoa_phong_nhan', 'Khoa Missing User ' || v_suffix
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected transfer_request_create to fail closed for missing user_id claim';
  END IF;

  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected missing-user transfer_request_create to deny with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.yeu_cau_luan_chuyen
  WHERE thiet_bi_id = v_allowed_equipment
    AND ly_do_luan_chuyen = 'Smoke missing-user-id transfer ' || v_suffix;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Missing-user transfer deny should not persist request rows';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'user',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'khoa_phong', 'nội thận - tiết niệu'
    )::text,
    true
  );

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.transfer_request_create(
      jsonb_build_object(
        'thiet_bi_id', v_allowed_equipment,
        'loai_hinh', 'noi_bo',
        'ly_do_luan_chuyen', 'Smoke missing-don-vi transfer ' || v_suffix,
        'khoa_phong_hien_tai', 'Nội thận - Tiết niệu',
        'khoa_phong_nhan', 'Khoa Missing Tenant ' || v_suffix
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected transfer_request_create to fail closed for missing don_vi claim';
  END IF;

  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected missing-don-vi transfer_request_create to deny with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.yeu_cau_luan_chuyen
  WHERE thiet_bi_id = v_allowed_equipment
    AND ly_do_luan_chuyen = 'Smoke missing-don-vi transfer ' || v_suffix;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Missing-don-vi transfer deny should not persist request rows';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'user',
      'role', 'authenticated',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_tenant::text,
      'khoa_phong', ''
    )::text,
    true
  );

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.maintenance_tasks_bulk_insert(
      jsonb_build_array(
        jsonb_build_object(
          'ke_hoach_id', v_plan_id,
          'thiet_bi_id', v_allowed_equipment,
          'loai_cong_viec', 'kiem_tra',
          'diem_hieu_chuan', 'Smoke blank-claim maintenance ' || v_suffix,
          'don_vi_thuc_hien', 'noi_bo',
          'thang_4', true,
          'ghi_chu', 'Smoke blank-claim maintenance ' || v_suffix
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected maintenance_tasks_bulk_insert to fail closed for blank khoa_phong claim';
  END IF;

  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected blank-claim maintenance_tasks_bulk_insert to deny with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.cong_viec_bao_tri
  WHERE thiet_bi_id = v_allowed_equipment
    AND ghi_chu = 'Smoke blank-claim maintenance ' || v_suffix;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Blank-claim maintenance deny should not persist task rows';
  END IF;

  IF position('missing role claim in jwt' in lower(pg_get_functiondef('public.maintenance_tasks_bulk_insert(jsonb)'::regprocedure))) = 0 THEN
    RAISE EXCEPTION 'Expected maintenance_tasks_bulk_insert to guard missing role claim';
  END IF;

  IF position('v_user_id is null' in lower(pg_get_functiondef('public.maintenance_tasks_bulk_insert(jsonb)'::regprocedure))) = 0 THEN
    RAISE EXCEPTION 'Expected maintenance_tasks_bulk_insert to guard missing user_id claim';
  END IF;

  RAISE NOTICE 'OK: equipment department workflow guard smoke setup completed';
END $$;

ROLLBACK;
