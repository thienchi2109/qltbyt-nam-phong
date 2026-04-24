-- supabase/tests/header_notifications_facility_scope_smoke.sql
-- Purpose: lock header notification counts to selected facility scope.
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_region bigint;
  v_facility_a bigint;
  v_facility_b bigint;
  v_equipment_a1 bigint;
  v_equipment_a2 bigint;
  v_equipment_b1 bigint;
  v_global_baseline_repairs integer;
  v_global_all jsonb;
  v_global_scoped jsonb;
  v_regional_all jsonb;
  v_regional_scoped jsonb;
  v_function_def text;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', 'smoke-global-baseline-' || v_suffix,
      'sub', 'smoke-global-baseline-' || v_suffix,
      'don_vi', NULL
    )::text,
    true
  );

  v_global_baseline_repairs := (public.header_notifications_summary(NULL::bigint)->>'pending_repairs')::integer;

  INSERT INTO public.dia_ban(ma_dia_ban, ten_dia_ban, so_luong_don_vi_truc_thuoc, active)
  VALUES (
    'SMK-HN-' || v_suffix,
    'Smoke Header Notifications ' || v_suffix,
    2,
    true
  )
  RETURNING id INTO v_region;

  INSERT INTO public.don_vi(code, name, active, dia_ban_id)
  VALUES ('SMK-HN-A-' || v_suffix, 'Smoke Header Notifications A ' || v_suffix, true, v_region)
  RETURNING id INTO v_facility_a;

  INSERT INTO public.don_vi(code, name, active, dia_ban_id)
  VALUES ('SMK-HN-B-' || v_suffix, 'Smoke Header Notifications B ' || v_suffix, true, v_region)
  RETURNING id INTO v_facility_b;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES ('SMK-HN-A1-' || v_suffix, 'Smoke Header A1 ' || v_suffix, v_facility_a)
  RETURNING id INTO v_equipment_a1;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES ('SMK-HN-A2-' || v_suffix, 'Smoke Header A2 ' || v_suffix, v_facility_a)
  RETURNING id INTO v_equipment_a2;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES ('SMK-HN-B1-' || v_suffix, 'Smoke Header B1 ' || v_suffix, v_facility_b)
  RETURNING id INTO v_equipment_b1;

  INSERT INTO public.yeu_cau_sua_chua(
    thiet_bi_id,
    mo_ta_su_co,
    hang_muc_sua_chua,
    ngay_mong_muon_hoan_thanh,
    nguoi_yeu_cau,
    trang_thai,
    don_vi_thuc_hien
  )
  VALUES
    (v_equipment_a1, 'Smoke pending A', 'Smoke repair', CURRENT_DATE + 1, 'Smoke User', 'Chờ xử lý', 'noi_bo'),
    (v_equipment_a2, 'Smoke approved A', 'Smoke repair', CURRENT_DATE + 1, 'Smoke User', 'Đã duyệt', 'noi_bo'),
    (v_equipment_b1, 'Smoke pending B', 'Smoke repair', CURRENT_DATE + 1, 'Smoke User', 'Chờ xử lý', 'noi_bo');

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', 'smoke-global-' || v_suffix,
      'sub', 'smoke-global-' || v_suffix,
      'don_vi', NULL
    )::text,
    true
  );

  v_global_all := public.header_notifications_summary(NULL::bigint);
  v_global_scoped := public.header_notifications_summary(v_facility_a);

  IF (v_global_all->>'pending_repairs')::integer <> v_global_baseline_repairs + 3 THEN
    RAISE EXCEPTION 'global all-facility repair badge should count baseline + 3, got % with baseline %',
      v_global_all,
      v_global_baseline_repairs;
  END IF;

  IF (v_global_scoped->>'pending_repairs')::integer <> 2 THEN
    RAISE EXCEPTION 'global scoped repair badge should count facility A only, got %', v_global_scoped;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'regional_leader',
      'role', 'authenticated',
      'user_id', 'smoke-regional-' || v_suffix,
      'sub', 'smoke-regional-' || v_suffix,
      'dia_ban', v_region::text
    )::text,
    true
  );

  v_regional_all := public.header_notifications_summary(NULL::bigint);
  v_regional_scoped := public.header_notifications_summary(v_facility_a);

  IF (v_regional_all->>'pending_repairs')::integer <> 3 THEN
    RAISE EXCEPTION 'regional all-facility repair badge should count 3, got %', v_regional_all;
  END IF;

  IF (v_regional_scoped->>'pending_repairs')::integer <> 2 THEN
    RAISE EXCEPTION 'regional scoped repair badge should count facility A only, got %', v_regional_scoped;
  END IF;

  v_function_def := pg_get_functiondef('public.header_notifications_summary(bigint)'::regprocedure);

  IF v_function_def LIKE '%LEFT JOIN public.thiet_bi%' THEN
    RAISE EXCEPTION 'header_notifications_summary should not use LEFT JOIN for equipment-scoped badge counts';
  END IF;

  IF v_function_def NOT LIKE '%INNER JOIN public.thiet_bi%' THEN
    RAISE EXCEPTION 'header_notifications_summary should require matching equipment rows';
  END IF;

  RAISE NOTICE 'OK: header notification facility scope smoke passed';
END $$;

ROLLBACK;
