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

  RAISE NOTICE 'OK: equipment department workflow guard smoke setup completed';
END $$;

ROLLBACK;
