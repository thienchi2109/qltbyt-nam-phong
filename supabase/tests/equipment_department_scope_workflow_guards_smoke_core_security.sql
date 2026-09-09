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
          'diem_hieu_chuan', 'Smoke same-department user maintenance ' || v_suffix,
          'don_vi_thuc_hien', 'noi_bo',
          'thang_1', true,
          'ghi_chu', 'Smoke same-department user maintenance ' || v_suffix
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected maintenance_tasks_bulk_insert to deny role user maintenance writes';
  END IF;

  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected role user maintenance_tasks_bulk_insert deny with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.cong_viec_bao_tri
  WHERE thiet_bi_id = v_allowed_equipment
    AND ghi_chu = 'Smoke same-department user maintenance ' || v_suffix;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Role user maintenance deny should not persist task rows';
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

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.maintenance_tasks_bulk_insert(
      jsonb_build_array(
        jsonb_build_object(
          'ke_hoach_id', v_blocked_plan_id,
          'loai_cong_viec', 'kiem_tra',
          'diem_hieu_chuan', 'Smoke null-equipment maintenance ' || v_suffix,
          'don_vi_thuc_hien', 'noi_bo',
          'thang_5', true,
          'ghi_chu', 'Smoke null-equipment maintenance ' || v_suffix
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected maintenance_tasks_bulk_insert to deny out-of-department NULL-equipment role user tasks';
  END IF;

  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Expected NULL-equipment maintenance task to deny with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  SELECT COUNT(*)
  INTO v_count
  FROM public.cong_viec_bao_tri
  WHERE thiet_bi_id IS NULL
    AND ghi_chu = 'Smoke null-equipment maintenance ' || v_suffix;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'NULL-equipment maintenance deny should not persist task rows';
  END IF;
  RAISE NOTICE 'OK: equipment department workflow guard smoke setup completed';
END $$;

ROLLBACK;
