-- Chunk 4f staged companion; original mixed test remains active.
BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_plan_id bigint;
  v_blocked_plan_id bigint;
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
  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Workflow Department Tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.ke_hoach_bao_tri(
    ten_ke_hoach,
    nam,
    loai_cong_viec,
    khoa_phong,
    nguoi_lap_ke_hoach,
    trang_thai,
    don_vi
  )
  VALUES (
    'Smoke Workflow Allowed Plan ' || v_suffix,
    EXTRACT(YEAR FROM current_date)::integer,
    'kiem_tra',
    'Nội thận - Tiết niệu',
    'Workflow Department Smoke',
    'Bản nháp',
    v_tenant
  )
  RETURNING id INTO v_plan_id;

  INSERT INTO public.ke_hoach_bao_tri(
    ten_ke_hoach,
    nam,
    loai_cong_viec,
    khoa_phong,
    nguoi_lap_ke_hoach,
    trang_thai,
    don_vi
  )
  VALUES (
    'Smoke Workflow Blocked Plan ' || v_suffix,
    EXTRACT(YEAR FROM current_date)::integer,
    'kiem_tra',
    'Khoa Ngoai ' || v_suffix,
    'Workflow Department Smoke',
    'Bản nháp',
    v_tenant
  )
  RETURNING id INTO v_blocked_plan_id;

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

  IF position('missing role claim in jwt' in lower(pg_get_functiondef('public._assert_maintenance_write_allowed()'::regprocedure))) = 0 THEN
    RAISE EXCEPTION 'Expected maintenance write helper to guard missing role claim';
  END IF;

  IF position('missing user_id claim in jwt' in lower(pg_get_functiondef('public._assert_maintenance_write_allowed()'::regprocedure))) = 0 THEN
    RAISE EXCEPTION 'Expected maintenance write helper to guard missing user_id claim';
  END IF;

  RAISE NOTICE 'OK: equipment department workflow guard smoke setup completed';
END $$;

ROLLBACK;
