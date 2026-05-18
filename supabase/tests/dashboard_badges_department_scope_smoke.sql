-- supabase/tests/dashboard_badges_department_scope_smoke.sql
-- Purpose: lock Dashboard KPI and notification badge counts to role=user department scope.
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_other_tenant bigint;
  v_allowed_equipment bigint;
  v_blocked_equipment bigint;
  v_other_equipment bigint;
  v_dashboard jsonb;
  v_header jsonb;
  v_plan_counts jsonb;
  v_failed boolean;
  v_sqlstate text;
  v_sqlerrm text;
  v_proconfig text[];
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Issue 512 Tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Issue 512 Other Tenant ' || v_suffix, true)
  RETURNING id INTO v_other_tenant;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    is_deleted
  )
  VALUES (
    'SMK-512-ALLOW-' || v_suffix,
    'Smoke Issue 512 Allowed ' || v_suffix,
    v_tenant,
    '  Nội thận - Tiết niệu  ',
    'Chờ bảo trì',
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
    'SMK-512-BLOCK-' || v_suffix,
    'Smoke Issue 512 Blocked ' || v_suffix,
    v_tenant,
    'Khoa Ngoại ' || v_suffix,
    'Chờ bảo trì',
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
    'SMK-512-OTHER-' || v_suffix,
    'Smoke Issue 512 Other Tenant ' || v_suffix,
    v_other_tenant,
    'Nội thận - Tiết niệu',
    'Chờ bảo trì',
    false
  )
  RETURNING id INTO v_other_equipment;

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
    (v_allowed_equipment, 'Smoke Issue 512 repair allowed', 'Smoke repair', CURRENT_DATE + 1, 'Smoke User', 'Chờ xử lý', 'noi_bo'),
    (v_blocked_equipment, 'Smoke Issue 512 repair blocked', 'Smoke repair', CURRENT_DATE + 1, 'Smoke User', 'Chờ xử lý', 'noi_bo'),
    (v_other_equipment, 'Smoke Issue 512 repair other tenant', 'Smoke repair', CURRENT_DATE + 1, 'Smoke User', 'Chờ xử lý', 'noi_bo');

  INSERT INTO public.yeu_cau_luan_chuyen(
    ma_yeu_cau,
    thiet_bi_id,
    loai_hinh,
    trang_thai,
    ly_do_luan_chuyen,
    created_at
  )
  VALUES
    ('YCLC-512-ALLOW-' || v_suffix, v_allowed_equipment, 'noi_bo', 'cho_duyet', 'Smoke transfer allowed ' || v_suffix, now()),
    ('YCLC-512-BLOCK-' || v_suffix, v_blocked_equipment, 'noi_bo', 'cho_duyet', 'Smoke transfer blocked ' || v_suffix, now()),
    ('YCLC-512-OTHER-' || v_suffix, v_other_equipment, 'noi_bo', 'cho_duyet', 'Smoke transfer other tenant ' || v_suffix, now());

  INSERT INTO public.ke_hoach_bao_tri(
    ten_ke_hoach,
    nam,
    don_vi,
    khoa_phong,
    loai_cong_viec,
    trang_thai
  )
  VALUES
    ('Smoke Issue 512 Plan Draft Allowed ' || v_suffix, EXTRACT(YEAR FROM current_date)::integer, v_tenant, 'Nội thận - Tiết niệu', 'Bảo trì', 'Bản nháp'),
    ('Smoke Issue 512 Plan Approved Allowed ' || v_suffix, EXTRACT(YEAR FROM current_date)::integer, v_tenant, 'Nội thận - Tiết niệu', 'Bảo trì', 'Đã duyệt'),
    ('Smoke Issue 512 Plan Draft Blocked ' || v_suffix, EXTRACT(YEAR FROM current_date)::integer, v_tenant, 'Khoa Ngoại ' || v_suffix, 'Bảo trì', 'Bản nháp'),
    ('Smoke Issue 512 Plan Approved Blocked ' || v_suffix, EXTRACT(YEAR FROM current_date)::integer, v_tenant, 'Khoa Ngoại ' || v_suffix, 'Bảo trì', 'Đã duyệt'),
    ('Smoke Issue 512 Plan Other Tenant ' || v_suffix, EXTRACT(YEAR FROM current_date)::integer, v_other_tenant, 'Nội thận - Tiết niệu', 'Bảo trì', 'Bản nháp');

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'user',
      'role', 'authenticated',
      'user_id', 'smoke-512-user-' || v_suffix,
      'sub', 'smoke-512-user-' || v_suffix,
      'don_vi', v_tenant::text,
      'khoa_phong', ' ' || chr(160) || E'NỘI\nTHẬN\t  - TIẾT   NIỆU '
    )::text,
    true
  );

  v_dashboard := public.dashboard_kpi_summary();
  v_header := public.header_notifications_summary(NULL::bigint);
  v_plan_counts := public.maintenance_plan_status_counts(NULL::bigint, NULL::text);

  IF COALESCE((v_dashboard->>'totalEquipment')::integer, 0) <> 1 THEN
    RAISE EXCEPTION 'dashboard totalEquipment should count only role=user department rows, got %', v_dashboard;
  END IF;

  IF COALESCE((v_dashboard->>'maintenanceCount')::integer, 0) <> 1 THEN
    RAISE EXCEPTION 'dashboard maintenanceCount should count only role=user department rows, got %', v_dashboard;
  END IF;

  IF COALESCE((v_dashboard->'repairRequests'->>'pending')::integer, 0) <> 1
     OR COALESCE((v_dashboard->'repairRequests'->>'total')::integer, 0) <> 1 THEN
    RAISE EXCEPTION 'dashboard repairRequests should count only role=user department rows, got %', v_dashboard;
  END IF;

  IF COALESCE((v_dashboard->'maintenancePlans'->>'total')::integer, 0) <> 2
     OR COALESCE((v_dashboard->'maintenancePlans'->>'draft')::integer, 0) <> 1
     OR COALESCE((v_dashboard->'maintenancePlans'->>'approved')::integer, 0) <> 1 THEN
    RAISE EXCEPTION 'dashboard maintenancePlans should count only role=user department rows, got %', v_dashboard;
  END IF;

  IF COALESCE((v_header->>'pending_repairs')::integer, 0) <> 1
     OR COALESCE((v_header->>'pending_transfers')::integer, 0) <> 1 THEN
    RAISE EXCEPTION 'header notification counts should count only role=user department rows, got %', v_header;
  END IF;

  IF COALESCE((v_plan_counts->>'Bản nháp')::integer, 0) <> 1
     OR COALESCE((v_plan_counts->>'Đã duyệt')::integer, 0) <> 1
     OR COALESCE((v_plan_counts->>'Không duyệt')::integer, 0) <> 0 THEN
    RAISE EXCEPTION 'maintenance badge counts should count only role=user department rows, got %', v_plan_counts;
  END IF;

  v_header := public.header_notifications_summary(v_other_tenant);
  v_plan_counts := public.maintenance_plan_status_counts(v_other_tenant, NULL::text);

  IF COALESCE((v_header->>'pending_repairs')::integer, 0) <> 0
     OR COALESCE((v_header->>'pending_transfers')::integer, 0) <> 0 THEN
    RAISE EXCEPTION 'role=user must not widen notification badges to another tenant, got %', v_header;
  END IF;

  v_failed := false;
  v_sqlstate := NULL;
  v_sqlerrm := NULL;
  BEGIN
    PERFORM public.maintenance_plan_status_counts(v_other_tenant, NULL::text);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
    v_sqlerrm := SQLERRM;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'role=user must not widen maintenance badges to another tenant';
  END IF;

  IF v_sqlstate IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'role=user cross-tenant maintenance badge should deny with 42501, got % (%)', v_sqlstate, v_sqlerrm;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'user',
      'role', 'authenticated',
      'user_id', 'smoke-512-blank-user-' || v_suffix,
      'sub', 'smoke-512-blank-user-' || v_suffix,
      'don_vi', v_tenant::text,
      'khoa_phong', ''
    )::text,
    true
  );

  v_dashboard := public.dashboard_kpi_summary();
  v_header := public.header_notifications_summary(NULL::bigint);
  v_plan_counts := public.maintenance_plan_status_counts(NULL::bigint, NULL::text);

  IF COALESCE((v_dashboard->>'totalEquipment')::integer, 0) <> 0
     OR COALESCE((v_dashboard->>'maintenanceCount')::integer, 0) <> 0
     OR COALESCE((v_dashboard->'repairRequests'->>'total')::integer, 0) <> 0
     OR COALESCE((v_dashboard->'maintenancePlans'->>'total')::integer, 0) <> 0 THEN
    RAISE EXCEPTION 'dashboard KPI summary should fail closed for blank role=user department scope, got %', v_dashboard;
  END IF;

  IF COALESCE((v_header->>'pending_repairs')::integer, 0) <> 0
     OR COALESCE((v_header->>'pending_transfers')::integer, 0) <> 0 THEN
    RAISE EXCEPTION 'header notification counts should fail closed for blank role=user department scope, got %', v_header;
  END IF;

  IF COALESCE((v_plan_counts->>'Bản nháp')::integer, 0) <> 0
     OR COALESCE((v_plan_counts->>'Đã duyệt')::integer, 0) <> 0
     OR COALESCE((v_plan_counts->>'Không duyệt')::integer, 0) <> 0 THEN
    RAISE EXCEPTION 'maintenance badge counts should fail closed for blank role=user department scope, got %', v_plan_counts;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', 'smoke-512-global-' || v_suffix,
      'sub', 'smoke-512-global-' || v_suffix,
      'don_vi', NULL
    )::text,
    true
  );

  v_header := public.header_notifications_summary(v_tenant);
  v_plan_counts := public.maintenance_plan_status_counts(v_tenant, NULL::text);

  IF COALESCE((v_header->>'pending_repairs')::integer, 0) <> 2
     OR COALESCE((v_header->>'pending_transfers')::integer, 0) <> 2 THEN
    RAISE EXCEPTION 'global selected-facility badges should keep tenant-wide behavior, got %', v_header;
  END IF;

  IF COALESCE((v_plan_counts->>'Bản nháp')::integer, 0) <> 2
     OR COALESCE((v_plan_counts->>'Đã duyệt')::integer, 0) <> 2 THEN
    RAISE EXCEPTION 'global selected-facility maintenance badges should keep tenant-wide behavior, got %', v_plan_counts;
  END IF;

  v_header := public.header_notifications_summary(v_other_tenant);
  v_plan_counts := public.maintenance_plan_status_counts(v_other_tenant, NULL::text);

  IF COALESCE((v_header->>'pending_repairs')::integer, 0) <> 1
     OR COALESCE((v_header->>'pending_transfers')::integer, 0) <> 1 THEN
    RAISE EXCEPTION 'global selected other-facility badges should not leak tenant A, got %', v_header;
  END IF;

  IF COALESCE((v_plan_counts->>'Bản nháp')::integer, 0) <> 1
     OR COALESCE((v_plan_counts->>'Đã duyệt')::integer, 0) <> 0 THEN
    RAISE EXCEPTION 'global selected other-facility maintenance badges should not leak tenant A, got %', v_plan_counts;
  END IF;

  FOR v_proconfig IN
    SELECT p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'dashboard_equipment_total',
        'dashboard_maintenance_count',
        'dashboard_repair_request_stats',
        'dashboard_maintenance_plan_stats',
        'header_notifications_summary',
        'maintenance_plan_status_counts'
      )
  LOOP
    IF v_proconfig IS NULL
       OR array_position(v_proconfig, 'search_path=public, pg_temp') IS NULL THEN
      RAISE EXCEPTION 'Issue #512 scoped RPCs must pin search_path to public, pg_temp';
    END IF;
  END LOOP;

  RAISE NOTICE 'OK: dashboard and badge department scope smoke passed';
END $$;

ROLLBACK;
