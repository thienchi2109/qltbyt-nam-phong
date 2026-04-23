-- supabase/tests/equipment_soft_delete_reports_smoke.sql
-- Purpose: validate report RPCs exclude soft-deleted equipment and preserve admin/global scope behavior
-- Non-destructive: wrapped in transaction and rolled back

BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_prefix text := 'SMK-RPT-' || v_suffix;
  v_dept text := 'SMK-RPT-DEPT-' || v_suffix;
  v_loc text := 'SMK-RPT-LOC-' || v_suffix;
  v_tenant_main bigint;
  v_tenant_other bigint;
  v_tenant_user bigint;
  v_list_count bigint;
  v_count_enhanced bigint;
  v_dept_count bigint;
  v_agg jsonb;
  v_status jsonb;
  v_legacy_total bigint;
  v_user_prefix text := 'SMK-RPT-USER-' || v_suffix;
  v_user_allowed_display text := 'Nội thận - Tiết niệu ' || v_suffix;
  v_user_allowed_claim text := 'nội thận tiết niệu ' || v_suffix;
  v_user_blocked_display text := 'ICU Blocked ' || v_suffix;
  v_user_allowed_id bigint;
  v_user_blocked_id bigint;
  v_user_department_options bigint;
  v_user_department_count bigint;
  v_user_blocked_rows bigint;
  v_transfer_count bigint;
  v_transfer_blocked_rows bigint;
  v_failed boolean;
  v_sqlstate text;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Report Main ' || v_suffix, true)
  RETURNING id INTO v_tenant_main;

  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Report Other ' || v_suffix, true)
  RETURNING id INTO v_tenant_other;

  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Report User Scope ' || v_suffix, true)
  RETURNING id INTO v_tenant_user;

  INSERT INTO public.thiet_bi (
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    vi_tri_lap_dat,
    tinh_trang_hien_tai,
    is_deleted
  ) VALUES (
    v_prefix || '-MAIN-ACTIVE',
    'Smoke report active equipment',
    v_tenant_main,
    v_dept,
    v_loc,
    'Hoạt động',
    false
  );

  INSERT INTO public.thiet_bi (
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    vi_tri_lap_dat,
    tinh_trang_hien_tai,
    is_deleted
  ) VALUES (
    v_user_prefix || '-ALLOWED',
    'Smoke report scoped allowed equipment',
    v_tenant_user,
    v_user_allowed_display,
    v_loc,
    'Hoạt động',
    false
  )
  RETURNING id INTO v_user_allowed_id;

  INSERT INTO public.thiet_bi (
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    vi_tri_lap_dat,
    tinh_trang_hien_tai,
    is_deleted
  ) VALUES (
    v_user_prefix || '-BLOCKED',
    'Smoke report scoped blocked equipment',
    v_tenant_user,
    v_user_blocked_display,
    v_loc,
    'Hoạt động',
    false
  )
  RETURNING id INTO v_user_blocked_id;

  INSERT INTO public.yeu_cau_luan_chuyen(
    ma_yeu_cau,
    thiet_bi_id,
    loai_hinh,
    trang_thai,
    ly_do_luan_chuyen,
    khoa_phong_hien_tai,
    khoa_phong_nhan,
    created_at
  )
  VALUES (
    'YCLC-' || v_user_prefix || '-ALLOWED',
    v_user_allowed_id,
    'noi_bo',
    'cho_duyet',
    v_user_prefix || '-allowed-transfer',
    v_user_allowed_display,
    'Khoa Nhan ' || v_suffix,
    now()
  );

  INSERT INTO public.yeu_cau_luan_chuyen(
    ma_yeu_cau,
    thiet_bi_id,
    loai_hinh,
    trang_thai,
    ly_do_luan_chuyen,
    khoa_phong_hien_tai,
    khoa_phong_nhan,
    created_at
  )
  VALUES (
    'YCLC-' || v_user_prefix || '-BLOCKED',
    v_user_blocked_id,
    'noi_bo',
    'cho_duyet',
    v_user_prefix || '-blocked-transfer',
    v_user_blocked_display,
    'Khoa Nhan ' || v_suffix,
    now()
  );

  INSERT INTO public.thiet_bi (
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    vi_tri_lap_dat,
    tinh_trang_hien_tai,
    is_deleted
  ) VALUES (
    v_prefix || '-MAIN-DELETED',
    'Smoke report deleted equipment',
    v_tenant_main,
    v_dept,
    v_loc,
    'Chờ sửa chữa',
    true
  );

  -- Same department/location in another tenant to catch admin/global scope regressions.
  INSERT INTO public.thiet_bi (
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    vi_tri_lap_dat,
    tinh_trang_hien_tai,
    is_deleted
  ) VALUES (
    v_prefix || '-OTHER-ACTIVE',
    'Smoke report other tenant equipment',
    v_tenant_other,
    v_dept,
    v_loc,
    'Hoạt động',
    false
  );

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', '1',
      'sub', '1',
      'don_vi', null
    )::text,
    true
  );

  SELECT COUNT(*)
  INTO v_list_count
  FROM public.equipment_list_for_reports(
    p_q => v_prefix,
    p_sort => 'id.asc',
    p_page => 1,
    p_page_size => 200,
    p_don_vi => v_tenant_main,
    p_khoa_phong => v_dept
  );

  IF v_list_count <> 1 THEN
    RAISE EXCEPTION
      'equipment_list_for_reports expected 1 active row, got %',
      v_list_count;
  END IF;

  SELECT public.equipment_count_enhanced(
    p_statuses => NULL,
    p_q => v_prefix,
    p_don_vi => v_tenant_main,
    p_khoa_phong => v_dept
  )
  INTO v_count_enhanced;

  IF v_count_enhanced <> 1 THEN
    RAISE EXCEPTION
      'equipment_count_enhanced expected 1 active row, got %',
      v_count_enhanced;
  END IF;

  SELECT d.count
  INTO v_dept_count
  FROM public.departments_list_for_facilities(ARRAY[v_tenant_main]) AS d
  WHERE d.name = v_dept;

  IF COALESCE(v_dept_count, 0) <> 1 THEN
    RAISE EXCEPTION
      'departments_list_for_facilities expected department count 1, got %',
      COALESCE(v_dept_count, 0);
  END IF;

  SELECT public.equipment_aggregates_for_reports(
    p_don_vi_array => ARRAY[v_tenant_main],
    p_khoa_phong => v_dept,
    p_date_from => CURRENT_DATE - 1,
    p_date_to => CURRENT_DATE + 1
  )
  INTO v_agg;

  IF COALESCE((v_agg->>'currentStock')::bigint, 0) <> 1 THEN
    RAISE EXCEPTION
      'equipment_aggregates_for_reports currentStock expected 1, got %',
      COALESCE((v_agg->>'currentStock')::bigint, 0);
  END IF;

  -- totalImported intentionally counts both active + soft-deleted registrations:
  -- historically, both rows were physically imported within the date range.
  -- MAIN-ACTIVE (is_deleted=false) + MAIN-DELETED (is_deleted=true) = 2.
  IF COALESCE((v_agg->>'totalImported')::bigint, 0) <> 2 THEN
    RAISE EXCEPTION
      'equipment_aggregates_for_reports totalImported expected 2 (active+deleted), got %',
      COALESCE((v_agg->>'totalImported')::bigint, 0);
  END IF;

  SELECT public.equipment_status_distribution(
    p_q => v_prefix,
    p_don_vi => v_tenant_main,
    p_khoa_phong => v_dept,
    p_vi_tri => v_loc
  )
  INTO v_status;

  IF COALESCE((v_status->>'total_equipment')::bigint, 0) <> 1 THEN
    RAISE EXCEPTION
      'equipment_status_distribution(TEXT,...) total_equipment expected 1, got %',
      COALESCE((v_status->>'total_equipment')::bigint, 0);
  END IF;

  IF COALESCE((v_status->'status_counts'->>'cho_sua_chua')::bigint, 0) <> 0 THEN
    RAISE EXCEPTION
      'equipment_status_distribution(TEXT,...) expected deleted status count 0, got %',
      COALESCE((v_status->'status_counts'->>'cho_sua_chua')::bigint, 0);
  END IF;

  SELECT COALESCE(SUM(so_luong), 0)
  INTO v_legacy_total
  FROM public.equipment_status_distribution(v_tenant_main, v_dept, v_loc);

  IF v_legacy_total <> 1 THEN
    RAISE EXCEPTION
      'equipment_status_distribution(BIGINT,TEXT,TEXT) expected total 1, got %',
      v_legacy_total;
  END IF;

  -- Admin should behave like global for cross-facility report RPCs when p_don_vi is provided.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'admin',
      'role', 'authenticated',
      'user_id', '1',
      'sub', '1',
      'don_vi', null
    )::text,
    true
  );

  SELECT COUNT(*)
  INTO v_list_count
  FROM public.equipment_list_for_reports(
    p_q => v_prefix,
    p_sort => 'id.asc',
    p_page => 1,
    p_page_size => 200,
    p_don_vi => v_tenant_main,
    p_khoa_phong => v_dept
  );

  IF v_list_count <> 1 THEN
    RAISE EXCEPTION
      'admin scope check for equipment_list_for_reports expected 1, got %',
      v_list_count;
  END IF;

  SELECT public.equipment_count_enhanced(
    p_statuses => NULL,
    p_q => v_prefix,
    p_don_vi => v_tenant_main,
    p_khoa_phong => v_dept
  )
  INTO v_count_enhanced;

  IF v_count_enhanced <> 1 THEN
    RAISE EXCEPTION
      'admin scope check for equipment_count_enhanced expected 1, got %',
      v_count_enhanced;
  END IF;

  -- role=user should inherit the same normalized khoa/phong scope contract as
  -- departments_list_for_tenant, including fail-closed behavior for blank scope.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'user',
      'role', 'authenticated',
      'user_id', '2',
      'sub', '2',
      'don_vi', v_tenant_user,
      'khoa_phong', v_user_allowed_claim
    )::text,
    true
  );

  SELECT COUNT(*)
  INTO v_user_department_options
  FROM public.departments_list_for_tenant(p_don_vi => v_tenant_user);

  IF v_user_department_options <> 1 THEN
    RAISE EXCEPTION
      'user scope departments_list_for_tenant expected 1 visible department, got %',
      v_user_department_options;
  END IF;

  SELECT (d->>'count')::bigint
  INTO v_user_department_count
  FROM public.departments_list_for_tenant(p_don_vi => v_tenant_user) AS d
  WHERE d->>'name' = v_user_allowed_display;

  IF COALESCE(v_user_department_count, 0) <> 1 THEN
    RAISE EXCEPTION
      'user scope departments_list_for_tenant expected allowed department count 1, got %',
      COALESCE(v_user_department_count, 0);
  END IF;

  SELECT COUNT(*)
  INTO v_list_count
  FROM public.equipment_list_for_reports(
    p_q => v_user_prefix,
    p_sort => 'id.asc',
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant_user,
    p_khoa_phong => NULL
  );

  IF v_list_count <> 1 THEN
    RAISE EXCEPTION
      'user scope equipment_list_for_reports with NULL department expected 1 row, got %',
      v_list_count;
  END IF;

  SELECT COUNT(*)
  INTO v_user_blocked_rows
  FROM public.equipment_list_for_reports(
    p_q => v_user_prefix,
    p_sort => 'id.asc',
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant_user,
    p_khoa_phong => NULL
  ) tb
  WHERE tb.id = v_user_blocked_id;

  IF v_user_blocked_rows <> 0 THEN
    RAISE EXCEPTION
      'user scope equipment_list_for_reports leaked blocked department row when p_khoa_phong is NULL';
  END IF;

  SELECT COUNT(*)
  INTO v_list_count
  FROM public.equipment_list_for_reports(
    p_q => v_user_prefix,
    p_sort => 'id.asc',
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant_user,
    p_khoa_phong => v_user_allowed_claim
  );

  IF v_list_count <> 1 THEN
    RAISE EXCEPTION
      'user scope equipment_list_for_reports with normalized matching department expected 1 row, got %',
      v_list_count;
  END IF;

  SELECT COUNT(*)
  INTO v_list_count
  FROM public.equipment_list_for_reports(
    p_q => v_user_prefix,
    p_sort => 'id.asc',
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant_user,
    p_khoa_phong => v_user_blocked_display
  );

  IF v_list_count <> 0 THEN
    RAISE EXCEPTION
      'user scope equipment_list_for_reports with blocked department expected 0 rows, got %',
      v_list_count;
  END IF;

  SELECT COUNT(*)
  INTO v_transfer_count
  FROM public.transfer_request_list_enhanced(
    p_q => v_user_prefix,
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant_user,
    p_khoa_phong => NULL
  ) AS t;

  IF v_transfer_count <> 1 THEN
    RAISE EXCEPTION
      'user scope transfer_request_list_enhanced with NULL department expected 1 row, got %',
      v_transfer_count;
  END IF;

  SELECT COUNT(*)
  INTO v_transfer_blocked_rows
  FROM public.transfer_request_list_enhanced(
    p_q => v_user_prefix,
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant_user,
    p_khoa_phong => NULL
  ) AS t
  WHERE COALESCE((t->'thiet_bi'->>'id')::bigint, -1) = v_user_blocked_id;

  IF v_transfer_blocked_rows <> 0 THEN
    RAISE EXCEPTION
      'user scope transfer_request_list_enhanced leaked blocked department row when p_khoa_phong is NULL';
  END IF;

  SELECT COUNT(*)
  INTO v_transfer_count
  FROM public.transfer_request_list_enhanced(
    p_q => v_user_prefix,
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant_user,
    p_khoa_phong => v_user_allowed_claim
  ) AS t;

  IF v_transfer_count <> 1 THEN
    RAISE EXCEPTION
      'user scope transfer_request_list_enhanced with normalized matching department expected 1 row, got %',
      v_transfer_count;
  END IF;

  SELECT COUNT(*)
  INTO v_transfer_count
  FROM public.transfer_request_list_enhanced(
    p_q => v_user_prefix,
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant_user,
    p_khoa_phong => v_user_blocked_display
  ) AS t;

  IF v_transfer_count <> 0 THEN
    RAISE EXCEPTION
      'user scope transfer_request_list_enhanced with blocked department expected 0 rows, got %',
      v_transfer_count;
  END IF;

  SELECT public.equipment_count_enhanced(
    p_statuses => NULL,
    p_q => v_user_prefix,
    p_don_vi => v_tenant_user,
    p_khoa_phong => NULL
  )
  INTO v_count_enhanced;

  IF v_count_enhanced <> 1 THEN
    RAISE EXCEPTION
      'user scope equipment_count_enhanced with NULL department expected 1, got %',
      v_count_enhanced;
  END IF;

  SELECT public.equipment_count_enhanced(
    p_statuses => NULL,
    p_q => v_user_prefix,
    p_don_vi => v_tenant_user,
    p_khoa_phong => v_user_allowed_display
  )
  INTO v_count_enhanced;

  IF v_count_enhanced <> 1 THEN
    RAISE EXCEPTION
      'user scope equipment_count_enhanced with matching department expected 1, got %',
      v_count_enhanced;
  END IF;

  SELECT public.equipment_count_enhanced(
    p_statuses => NULL,
    p_q => v_user_prefix,
    p_don_vi => v_tenant_user,
    p_khoa_phong => v_user_blocked_display
  )
  INTO v_count_enhanced;

  IF v_count_enhanced <> 0 THEN
    RAISE EXCEPTION
      'user scope equipment_count_enhanced with blocked department expected 0, got %',
      v_count_enhanced;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'user',
      'role', 'authenticated',
      'user_id', '2',
      'sub', '2',
      'don_vi', v_tenant_user,
      'khoa_phong', ''
    )::text,
    true
  );

  SELECT public.equipment_count_enhanced(
    p_statuses => NULL,
    p_q => v_user_prefix,
    p_don_vi => v_tenant_user,
    p_khoa_phong => NULL
  )
  INTO v_count_enhanced;

  IF v_count_enhanced <> 0 THEN
    RAISE EXCEPTION
      'user scope equipment_count_enhanced with blank claim expected 0, got %',
      v_count_enhanced;
  END IF;

  SELECT COUNT(*)
  INTO v_list_count
  FROM public.equipment_list_for_reports(
    p_q => v_user_prefix,
    p_sort => 'id.asc',
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant_user,
    p_khoa_phong => NULL
  );

  IF v_list_count <> 0 THEN
    RAISE EXCEPTION
      'user scope equipment_list_for_reports with blank claim expected 0 rows, got %',
      v_list_count;
  END IF;

  SELECT COUNT(*)
  INTO v_transfer_count
  FROM public.transfer_request_list_enhanced(
    p_q => v_user_prefix,
    p_page => 1,
    p_page_size => 50,
    p_don_vi => v_tenant_user,
    p_khoa_phong => NULL
  ) AS t;

  IF v_transfer_count <> 0 THEN
    RAISE EXCEPTION
      'user scope transfer_request_list_enhanced with blank claim expected 0 rows, got %',
      v_transfer_count;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'user_id', '2',
      'sub', '2',
      'don_vi', v_tenant_user
    )::text,
    true
  );

  v_failed := false;
  v_sqlstate := NULL;
  BEGIN
    PERFORM public.equipment_list_for_reports(
      p_q => v_user_prefix,
      p_sort => 'id.asc',
      p_page => 1,
      p_page_size => 50,
      p_don_vi => v_tenant_user,
      p_khoa_phong => NULL
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
  END;

  IF NOT v_failed OR v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION
      'missing role claims should deny equipment_list_for_reports with 42501, got failed=% sqlstate=%',
      v_failed,
      v_sqlstate;
  END IF;

  v_failed := false;
  v_sqlstate := NULL;
  BEGIN
    PERFORM public.transfer_request_list_enhanced(
      p_q => v_user_prefix,
      p_page => 1,
      p_page_size => 50,
      p_don_vi => v_tenant_user,
      p_khoa_phong => NULL
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
  END;

  IF NOT v_failed OR v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION
      'missing role claims should deny transfer_request_list_enhanced with 42501, got failed=% sqlstate=%',
      v_failed,
      v_sqlstate;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'auditor',
      'role', 'authenticated',
      'user_id', '3',
      'sub', '3',
      'don_vi', v_tenant_user
    )::text,
    true
  );

  BEGIN
    PERFORM public.equipment_count_enhanced(
      p_statuses => NULL,
      p_q => v_user_prefix,
      p_don_vi => v_tenant_user,
      p_khoa_phong => NULL
    );

    RAISE EXCEPTION
      'unsupported role should have raised 42501 for equipment_count_enhanced';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      NULL;
  END;

  RAISE NOTICE 'OK: equipment report soft-delete smoke checks passed';
END $$;

ROLLBACK;
