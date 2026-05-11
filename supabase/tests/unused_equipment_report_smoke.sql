-- supabase/tests/unused_equipment_report_smoke.sql
-- Purpose: validate the server-side report for equipment with no current usage demand.
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

DO $$
DECLARE
  v_suffix text := replace(gen_random_uuid()::text, '-', '');
  v_region_allowed bigint;
  v_region_blocked bigint;
  v_tenant_allowed bigint;
  v_tenant_blocked bigint;
  v_allowed_device_id bigint;
  v_other_status_id bigint;
  v_deleted_device_id bigint;
  v_report jsonb;
  v_items jsonb;
  v_total_count int;
  v_forbidden_ok boolean := false;
BEGIN
  INSERT INTO public.dia_ban(ma_dia_ban, ten_dia_ban, active)
  VALUES ('SMOKE-IDLE-A-' || v_suffix, 'Smoke Idle Region A ' || v_suffix, true)
  RETURNING id INTO v_region_allowed;

  INSERT INTO public.dia_ban(ma_dia_ban, ten_dia_ban, active)
  VALUES ('SMOKE-IDLE-B-' || v_suffix, 'Smoke Idle Region B ' || v_suffix, true)
  RETURNING id INTO v_region_blocked;

  INSERT INTO public.don_vi(name, active, dia_ban_id)
  VALUES ('Smoke Idle Facility A ' || v_suffix, true, v_region_allowed)
  RETURNING id INTO v_tenant_allowed;

  INSERT INTO public.don_vi(name, active, dia_ban_id)
  VALUES ('Smoke Idle Facility B ' || v_suffix, true, v_region_blocked)
  RETURNING id INTO v_tenant_blocked;

  INSERT INTO public.thiet_bi (
    ma_thiet_bi,
    ten_thiet_bi,
    model,
    serial,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    ngay_nhap,
    gia_goc,
    is_deleted
  )
  VALUES (
    'SMOKE-IDLE-A-1-' || v_suffix,
    'Smoke Idle Ventilator',
    'HFNC',
    'SER-A-1-' || v_suffix,
    v_tenant_allowed,
    'ICU',
    'Chưa có nhu cầu sử dụng',
    '2026-01-10',
    1000000,
    false
  )
  RETURNING id INTO v_allowed_device_id;

  INSERT INTO public.thiet_bi (
    ma_thiet_bi,
    ten_thiet_bi,
    model,
    serial,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    ngay_nhap,
    gia_goc,
    is_deleted
  )
  VALUES (
    'SMOKE-IDLE-A-2-' || v_suffix,
    'Smoke Idle Ventilator',
    'HFNC',
    'SER-A-2-' || v_suffix,
    v_tenant_allowed,
    'ICU',
    'Chưa có nhu cầu sử dụng',
    '2026-01-11',
    2000000,
    false
  );

  INSERT INTO public.thiet_bi (
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    gia_goc,
    is_deleted
  )
  VALUES (
    'SMOKE-IDLE-A-OTHER-' || v_suffix,
    'Smoke Active Equipment',
    v_tenant_allowed,
    'ICU',
    'Hoạt động',
    3000000,
    false
  )
  RETURNING id INTO v_other_status_id;

  INSERT INTO public.thiet_bi (
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    gia_goc,
    is_deleted
  )
  VALUES (
    'SMOKE-IDLE-A-DELETED-' || v_suffix,
    'Smoke Deleted Idle Equipment',
    v_tenant_allowed,
    'ICU',
    'Chưa có nhu cầu sử dụng',
    4000000,
    true
  )
  RETURNING id INTO v_deleted_device_id;

  INSERT INTO public.thiet_bi (
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    gia_goc,
    is_deleted
  )
  VALUES (
    'SMOKE-IDLE-B-1-' || v_suffix,
    'Smoke Blocked Idle Equipment',
    v_tenant_blocked,
    'ER',
    'Chưa có nhu cầu sử dụng',
    5000000,
    false
  );

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', 'smoke-global-' || v_suffix
    )::text,
    true
  );

  BEGIN
    PERFORM public.unused_equipment_report_for_reports(
      p_don_vi => NULL,
      p_q => NULL,
      p_khoa_phong => NULL,
      p_page => 1,
      p_page_size => 10,
      p_sort => 'id.asc'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_forbidden_ok := true;
  END;

  IF NOT v_forbidden_ok THEN
    RAISE EXCEPTION 'global scope without p_don_vi must fail closed';
  END IF;

  v_report := public.unused_equipment_report_for_reports(
    p_don_vi => v_tenant_allowed,
    p_q => 'Smoke Idle',
    p_khoa_phong => 'ICU',
    p_page => 1,
    p_page_size => 10,
    p_sort => 'id.asc'
  );

  v_total_count := (v_report -> 'summary' ->> 'totalCount')::int;
  IF v_total_count <> 2 THEN
    RAISE EXCEPTION 'unused equipment summary expected 2 active rows, got %', v_total_count;
  END IF;

  v_items := v_report -> 'items';
  IF jsonb_array_length(v_items) <> 2 THEN
    RAISE EXCEPTION 'unused equipment items expected 2 active rows, got %', jsonb_array_length(v_items);
  END IF;

  IF v_items @> jsonb_build_array(jsonb_build_object('id', v_other_status_id)) THEN
    RAISE EXCEPTION 'unused equipment report included non-target status row';
  END IF;

  IF v_items @> jsonb_build_array(jsonb_build_object('id', v_deleted_device_id)) THEN
    RAISE EXCEPTION 'unused equipment report included deleted row';
  END IF;

  IF NOT (v_items @> jsonb_build_array(jsonb_build_object('id', v_allowed_device_id))) THEN
    RAISE EXCEPTION 'unused equipment report missed expected allowed row';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'role', 'authenticated',
      'user_id', 'smoke-toqltb-' || v_suffix,
      'don_vi', v_tenant_allowed
    )::text,
    true
  );

  v_report := public.unused_equipment_report_for_reports(
    p_don_vi => NULL,
    p_q => 'Smoke Idle',
    p_khoa_phong => NULL,
    p_page => 1,
    p_page_size => 10,
    p_sort => 'id.asc'
  );

  IF (v_report -> 'summary' ->> 'totalCount')::int <> 2 THEN
    RAISE EXCEPTION 'to_qltb session scope expected 2 rows, got %', v_report -> 'summary' ->> 'totalCount';
  END IF;

  v_forbidden_ok := false;
  BEGIN
    PERFORM public.unused_equipment_report_for_reports(
      p_don_vi => v_tenant_blocked,
      p_q => NULL,
      p_khoa_phong => NULL,
      p_page => 1,
      p_page_size => 10,
      p_sort => 'id.asc'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_forbidden_ok := true;
  END;

  IF NOT v_forbidden_ok THEN
    RAISE EXCEPTION 'to_qltb must not read another facility';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'regional_leader',
      'role', 'authenticated',
      'user_id', 'smoke-rl-' || v_suffix,
      'dia_ban', v_region_allowed
    )::text,
    true
  );

  v_report := public.unused_equipment_report_for_reports(
    p_don_vi => v_tenant_allowed,
    p_q => 'Smoke Idle',
    p_khoa_phong => NULL,
    p_page => 1,
    p_page_size => 10,
    p_sort => 'id.asc'
  );

  IF (v_report -> 'summary' ->> 'totalCount')::int <> 2 THEN
    RAISE EXCEPTION 'regional_leader allowed scope expected 2 rows, got %', v_report -> 'summary' ->> 'totalCount';
  END IF;

  IF jsonb_array_length(v_report -> 'topDeviceGroups') <> 1 THEN
    RAISE EXCEPTION 'regional_leader topDeviceGroups expected 1 group, got %', jsonb_array_length(v_report -> 'topDeviceGroups');
  END IF;

  IF jsonb_array_length(v_report -> 'departments') <> 1 THEN
    RAISE EXCEPTION 'regional_leader departments expected 1 group, got %', jsonb_array_length(v_report -> 'departments');
  END IF;

  v_forbidden_ok := false;
  BEGIN
    PERFORM public.unused_equipment_report_for_reports(
      p_don_vi => v_tenant_blocked,
      p_q => NULL,
      p_khoa_phong => NULL,
      p_page => 1,
      p_page_size => 10,
      p_sort => 'id.asc'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_forbidden_ok := true;
  END;

  IF NOT v_forbidden_ok THEN
    RAISE EXCEPTION 'regional_leader must not read a facility outside dia_ban';
  END IF;
END $$;

ROLLBACK;
