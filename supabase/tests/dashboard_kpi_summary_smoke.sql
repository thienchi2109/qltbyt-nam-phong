-- supabase/tests/dashboard_kpi_summary_smoke.sql
-- Purpose: smoke-test dashboard_kpi_summary after the migration is applied.
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_tenant bigint;
  v_equipment_id bigint;
  v_payload jsonb;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Smoke Dashboard KPI Tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.thiet_bi(
    ma_thiet_bi,
    ten_thiet_bi,
    don_vi,
    khoa_phong_quan_ly,
    tinh_trang_hien_tai,
    is_deleted
  )
  VALUES (
    'SMK-KPI-EQ-' || v_suffix,
    'Smoke Dashboard KPI Equipment ' || v_suffix,
    v_tenant,
    'Khoa KPI ' || v_suffix,
    'Chờ bảo trì',
    false
  )
  RETURNING id INTO v_equipment_id;

  INSERT INTO public.yeu_cau_sua_chua(
    thiet_bi_id,
    ngay_yeu_cau,
    trang_thai,
    mo_ta_su_co
  )
  VALUES (
    v_equipment_id,
    now(),
    'Chờ xử lý',
    'Smoke KPI repair request ' || v_suffix
  );

  INSERT INTO public.ke_hoach_bao_tri(
    ten_ke_hoach,
    nam,
    don_vi,
    khoa_phong,
    loai_cong_viec,
    trang_thai
  )
  VALUES (
    'Smoke KPI Plan ' || v_suffix,
    EXTRACT(YEAR FROM current_date)::integer,
    v_tenant,
    'Khoa KPI ' || v_suffix,
    'Bảo trì',
    'Bản nháp'
  );

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'to_qltb',
      'user_id', '900002',
      'don_vi', v_tenant
    )::text,
    true
  );

  v_payload := public.dashboard_kpi_summary();

  IF jsonb_typeof(v_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'dashboard_kpi_summary must return an object: %', v_payload;
  END IF;

  IF NOT (v_payload ? 'totalEquipment')
     OR NOT (v_payload ? 'maintenanceCount')
     OR NOT (v_payload ? 'repairRequests')
     OR NOT (v_payload ? 'maintenancePlans') THEN
    RAISE EXCEPTION 'dashboard_kpi_summary missing expected keys: %', v_payload;
  END IF;

  IF COALESCE((v_payload->>'totalEquipment')::integer, 0) < 1 THEN
    RAISE EXCEPTION 'dashboard_kpi_summary totalEquipment should include smoke equipment: %', v_payload;
  END IF;

  IF COALESCE((v_payload->>'maintenanceCount')::integer, 0) < 1 THEN
    RAISE EXCEPTION 'dashboard_kpi_summary maintenanceCount should include smoke equipment: %', v_payload;
  END IF;

  IF COALESCE((v_payload->'repairRequests'->>'pending')::integer, 0) < 1 THEN
    RAISE EXCEPTION 'dashboard_kpi_summary repairRequests.pending should include smoke request: %', v_payload;
  END IF;

  IF COALESCE((v_payload->'maintenancePlans'->>'draft')::integer, 0) < 1 THEN
    RAISE EXCEPTION 'dashboard_kpi_summary maintenancePlans.draft should include smoke plan: %', v_payload;
  END IF;

  RAISE NOTICE 'dashboard_kpi_summary smoke: PASSED';
END;
$$;

ROLLBACK;
