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
  v_list_count bigint;
  v_count_enhanced bigint;
  v_dept_count bigint;
  v_agg jsonb;
  v_status jsonb;
  v_legacy_total bigint;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Report Main ' || v_suffix, true)
  RETURNING id INTO v_tenant_main;

  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Report Other ' || v_suffix, true)
  RETURNING id INTO v_tenant_other;

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

  RAISE NOTICE 'OK: equipment report soft-delete smoke checks passed';
END $$;

ROLLBACK;
