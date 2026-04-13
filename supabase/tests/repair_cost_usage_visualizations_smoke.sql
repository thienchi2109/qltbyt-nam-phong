-- supabase/tests/repair_cost_usage_visualizations_smoke.sql
-- Purpose: smoke-test repair cost + usage visualization payload contract after the migration is applied.
-- How to run (local): docker exec -i supabase_db_qltbyt-nam-phong psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/repair_cost_usage_visualizations_smoke.sql
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp._rcuv_set_claims(
  p_role text,
  p_user_id bigint,
  p_don_vi bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', p_role,
      'role', 'authenticated',
      'user_id', p_user_id::text,
      'sub', p_user_id::text,
      'don_vi', p_don_vi::text
    )::text,
    true
  );
END;
$$;

DO $$
DECLARE
  v_cost_type text;
  v_cost_precision integer;
  v_cost_scale integer;
  v_cost_nullable text;
  v_cost_default text;
  v_cost_constraint_count integer;
  v_usage_equipment_type text;
  v_equipment_id_type text;
BEGIN
  SELECT c.data_type, c.numeric_precision, c.numeric_scale, c.is_nullable, c.column_default
  INTO v_cost_type, v_cost_precision, v_cost_scale, v_cost_nullable, v_cost_default
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'yeu_cau_sua_chua'
    AND c.column_name = 'chi_phi_sua_chua';

  IF v_cost_type IS NULL THEN
    RAISE EXCEPTION 'Expected public.yeu_cau_sua_chua.chi_phi_sua_chua to exist';
  END IF;

  IF v_cost_type <> 'numeric' OR v_cost_precision <> 14 OR v_cost_scale <> 2 THEN
    RAISE EXCEPTION 'Expected chi_phi_sua_chua numeric(14,2), got %(%,%)', v_cost_type, v_cost_precision, v_cost_scale;
  END IF;

  IF v_cost_nullable <> 'YES' THEN
    RAISE EXCEPTION 'Expected chi_phi_sua_chua to stay nullable';
  END IF;

  IF v_cost_default IS NOT NULL THEN
    RAISE EXCEPTION 'Expected chi_phi_sua_chua to have no default, got %', v_cost_default;
  END IF;

  SELECT count(*)
  INTO v_cost_constraint_count
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'yeu_cau_sua_chua'
    AND con.conname = 'yeu_cau_sua_chua_chi_phi_sua_chua_non_negative';

  IF v_cost_constraint_count <> 1 THEN
    RAISE EXCEPTION 'Expected chi_phi_sua_chua non-negative constraint to exist';
  END IF;

  SELECT data_type
  INTO v_usage_equipment_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'nhat_ky_su_dung'
    AND column_name = 'thiet_bi_id';

  IF v_usage_equipment_type <> 'integer' THEN
    RAISE EXCEPTION 'Expected nhat_ky_su_dung.thiet_bi_id integer, got %', v_usage_equipment_type;
  END IF;

  SELECT data_type
  INTO v_equipment_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'thiet_bi'
    AND column_name = 'id';

  IF v_equipment_id_type <> 'bigint' THEN
    RAISE EXCEPTION 'Expected thiet_bi.id bigint, got %', v_equipment_id_type;
  END IF;

  RAISE NOTICE 'OK: live schema expectations for repair cost usage visualizations passed';
END $$;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_date_from date := current_date - 30;
  v_date_to date := current_date;
  v_tenant bigint;
  v_other_tenant bigint;
  v_user_id bigint;
  v_equipment_a bigint;
  v_equipment_b bigint;
  v_equipment_c bigint;
  v_equipment_other bigint;
  v_report jsonb;
  v_admin_scoped_report jsonb;
  v_period_points jsonb;
  v_cumulative_points jsonb;
  v_period_quality jsonb;
  v_cumulative_quality jsonb;
  v_a_period_hours numeric;
  v_a_cumulative_hours numeric;
  v_b_cumulative_hours numeric;
  v_both_count integer;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair usage visual smoke tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair usage visual smoke other tenant ' || v_suffix, true)
  RETURNING id INTO v_other_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_usage_visual_smoke_' || v_suffix,
    'smoke-password',
    'Repair Usage Visualization Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, tinh_trang_hien_tai, is_deleted)
  VALUES
    ('RCUV-A-' || v_suffix, 'Thiết bị A ' || v_suffix, v_tenant, 'Hoạt động', false),
    ('RCUV-B-' || v_suffix, 'Thiết bị B ' || v_suffix, v_tenant, 'Hoạt động', false),
    ('RCUV-C-' || v_suffix, 'Thiết bị C ' || v_suffix, v_tenant, 'Hoạt động', false),
    ('RCUV-X-' || v_suffix, 'Thiết bị khác tenant ' || v_suffix, v_other_tenant, 'Hoạt động', false);

  SELECT id INTO v_equipment_a
  FROM public.thiet_bi
  WHERE ma_thiet_bi = 'RCUV-A-' || v_suffix;

  SELECT id INTO v_equipment_b
  FROM public.thiet_bi
  WHERE ma_thiet_bi = 'RCUV-B-' || v_suffix;

  SELECT id INTO v_equipment_c
  FROM public.thiet_bi
  WHERE ma_thiet_bi = 'RCUV-C-' || v_suffix;

  SELECT id INTO v_equipment_other
  FROM public.thiet_bi
  WHERE ma_thiet_bi = 'RCUV-X-' || v_suffix;

  IF greatest(v_equipment_a, v_equipment_b, v_equipment_c, v_equipment_other) > 2147483647 THEN
    RAISE EXCEPTION 'Seeded equipment ids must stay within signed integer range for usage logs';
  END IF;

  INSERT INTO public.yeu_cau_sua_chua(
    thiet_bi_id,
    mo_ta_su_co,
    hang_muc_sua_chua,
    trang_thai,
    ngay_yeu_cau,
    ngay_duyet,
    ngay_hoan_thanh,
    nguoi_yeu_cau,
    don_vi_thuc_hien,
    chi_phi_sua_chua
  )
  VALUES
    (
      v_equipment_a,
      'Smoke repair A cost',
      'Repair item A',
      'Hoàn thành',
      (v_date_from + 1)::timestamp + interval '10 hours',
      (v_date_from + 2)::timestamp + interval '10 hours',
      (v_date_from + 3)::timestamp + interval '10 hours',
      'Smoke requester A',
      'noi_bo',
      1000000
    ),
    (
      v_equipment_a,
      'Smoke repair A null cost',
      'Repair item A2',
      'Hoàn thành',
      (v_date_from + 4)::timestamp + interval '10 hours',
      (v_date_from + 5)::timestamp + interval '10 hours',
      (v_date_from + 6)::timestamp + interval '10 hours',
      'Smoke requester A2',
      'noi_bo',
      NULL
    ),
    (
      v_equipment_b,
      'Smoke repair B cost',
      'Repair item B',
      'Hoàn thành',
      (v_date_from + 7)::timestamp + interval '10 hours',
      (v_date_from + 8)::timestamp + interval '10 hours',
      (v_date_from + 9)::timestamp + interval '10 hours',
      'Smoke requester B',
      'noi_bo',
      600000
    ),
    (
      v_equipment_b,
      'Smoke repair B cumulative cost',
      'Repair item B2',
      'Hoàn thành',
      (v_date_from - 7)::timestamp + interval '10 hours',
      (v_date_from - 6)::timestamp + interval '10 hours',
      (v_date_from - 5)::timestamp + interval '10 hours',
      'Smoke requester B2',
      'noi_bo',
      300000
    ),
    (
      v_equipment_c,
      'Smoke repair C cost',
      'Repair item C',
      'Hoàn thành',
      (v_date_from + 10)::timestamp + interval '10 hours',
      (v_date_from + 11)::timestamp + interval '10 hours',
      (v_date_from + 12)::timestamp + interval '10 hours',
      'Smoke requester C',
      'noi_bo',
      200000
    ),
    (
      v_equipment_other,
      'Smoke repair other tenant cost',
      'Repair item X',
      'Hoàn thành',
      (v_date_from + 1)::timestamp + interval '10 hours',
      (v_date_from + 2)::timestamp + interval '10 hours',
      (v_date_from + 3)::timestamp + interval '10 hours',
      'Smoke requester X',
      'noi_bo',
      9999999
    );

  INSERT INTO public.nhat_ky_su_dung(
    thiet_bi_id,
    thoi_gian_bat_dau,
    thoi_gian_ket_thuc,
    trang_thai,
    ghi_chu
  )
  VALUES
    (
      v_equipment_a,
      (v_date_from + 2)::timestamp + interval '10 hours',
      (v_date_from + 2)::timestamp + interval '12 hours',
      'hoan_thanh',
      'Valid period usage A'
    ),
    (
      v_equipment_a,
      (v_date_from - 2)::timestamp + interval '10 hours',
      (v_date_from - 1)::timestamp + interval '13 hours',
      'hoan_thanh',
      'Valid cumulative-only usage A'
    ),
    (
      v_equipment_a,
      (v_date_from + 3)::timestamp + interval '10 hours',
      NULL,
      'dang_su_dung',
      'Open usage A'
    ),
    (
      v_equipment_a,
      (v_date_from + 3)::timestamp + interval '15 hours',
      (v_date_from + 3)::timestamp + interval '13 hours',
      'hoan_thanh',
      'Invalid usage A'
    ),
    (
      v_equipment_b,
      (v_date_from + 8)::timestamp + interval '8 hours',
      (v_date_from + 8)::timestamp + interval '13 hours',
      'hoan_thanh',
      'Valid period usage B'
    ),
    (
      v_equipment_b,
      v_date_to::timestamp + interval '10 hours',
      (v_date_to + 1)::timestamp + interval '2 hours',
      'hoan_thanh',
      'Crossing end-date usage B'
    ),
    (
      v_equipment_c,
      (v_date_from + 11)::timestamp + interval '9 hours',
      (v_date_from + 11)::timestamp + interval '10 hours 30 minutes',
      'hoan_thanh',
      'Valid period usage C'
    ),
    (
      v_equipment_other,
      (v_date_from + 2)::timestamp + interval '10 hours',
      (v_date_from + 2)::timestamp + interval '12 hours',
      'hoan_thanh',
      'Other tenant usage'
    );

  PERFORM pg_temp._rcuv_set_claims('to_qltb', v_user_id, v_tenant);

  v_report := public.get_maintenance_report_data(v_date_from, v_date_to, v_tenant);

  IF NOT (v_report ? 'topEquipmentRepairCosts') THEN
    RAISE EXCEPTION 'Expected topEquipmentRepairCosts payload key, got %', v_report;
  END IF;

  IF jsonb_array_length(v_report->'topEquipmentRepairCosts') <> 3 THEN
    RAISE EXCEPTION 'Expected 3 top repair cost rows, got %', v_report->'topEquipmentRepairCosts';
  END IF;

  IF (v_report->'topEquipmentRepairCosts'->0->>'equipmentCode') IS NULL THEN
    RAISE EXCEPTION 'Expected equipmentCode on topEquipmentRepairCosts rows, got %', v_report->'topEquipmentRepairCosts';
  END IF;

  IF (v_report->'topEquipmentRepairCosts'->0->>'totalRepairCost')::numeric
     < (v_report->'topEquipmentRepairCosts'->1->>'totalRepairCost')::numeric THEN
    RAISE EXCEPTION 'Expected topEquipmentRepairCosts sorted descending, got %', v_report->'topEquipmentRepairCosts';
  END IF;

  v_period_points := v_report #> '{charts,repairUsageCostCorrelation,period,points}';
  v_cumulative_points := v_report #> '{charts,repairUsageCostCorrelation,cumulative,points}';
  v_period_quality := v_report #> '{charts,repairUsageCostCorrelation,period,dataQuality}';
  v_cumulative_quality := v_report #> '{charts,repairUsageCostCorrelation,cumulative,dataQuality}';

  IF v_period_points IS NULL OR v_cumulative_points IS NULL THEN
    RAISE EXCEPTION 'Expected repairUsageCostCorrelation period/cumulative points, got %', v_report;
  END IF;

  IF jsonb_array_length(v_period_points) <> 3 OR jsonb_array_length(v_cumulative_points) <> 3 THEN
    RAISE EXCEPTION 'Expected 3 period and 3 cumulative points, got period=% cumulative=%', v_period_points, v_cumulative_points;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_period_points) AS point(row_data)
    WHERE row_data ? 'equipment_name'
       OR row_data ? 'total_usage_hours'
       OR row_data ? 'total_repair_cost'
  ) THEN
    RAISE EXCEPTION 'Expected camelCase correlation point keys, got %', v_period_points;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each(v_period_quality) AS pair(key_name, value_data)
    WHERE key_name ~ '_'
  ) THEN
    RAISE EXCEPTION 'Expected camelCase dataQuality keys, got %', v_period_quality;
  END IF;

  SELECT (row_data->>'totalUsageHours')::numeric
  INTO v_a_period_hours
  FROM jsonb_array_elements(v_period_points) AS point(row_data)
  WHERE row_data->>'equipmentCode' = 'RCUV-A-' || v_suffix;

  IF v_a_period_hours IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Expected equipment A period usage 2 hours, got % in %', v_a_period_hours, v_period_points;
  END IF;

  SELECT (row_data->>'totalUsageHours')::numeric
  INTO v_a_cumulative_hours
  FROM jsonb_array_elements(v_cumulative_points) AS point(row_data)
  WHERE row_data->>'equipmentCode' = 'RCUV-A-' || v_suffix;

  IF v_a_cumulative_hours IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'Expected equipment A cumulative usage 5 hours, got % in %', v_a_cumulative_hours, v_cumulative_points;
  END IF;

  SELECT (row_data->>'totalUsageHours')::numeric
  INTO v_b_cumulative_hours
  FROM jsonb_array_elements(v_cumulative_points) AS point(row_data)
  WHERE row_data->>'equipmentCode' = 'RCUV-B-' || v_suffix;

  IF v_b_cumulative_hours IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'Expected equipment B cumulative usage to exclude crossing interval and stay 5 hours, got % in %', v_b_cumulative_hours, v_cumulative_points;
  END IF;

  IF (v_report->'topEquipmentRepairCosts'->0->>'completedRepairRequests')::integer IS DISTINCT FROM 2
     OR (v_report->'topEquipmentRepairCosts'->0->>'costRecordedCount')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Expected equipment A completedRepairRequests=2 and costRecordedCount=1, got %', v_report->'topEquipmentRepairCosts';
  END IF;

  IF (v_period_quality->>'equipmentWithUsage')::integer IS DISTINCT FROM 3
     OR (v_period_quality->>'equipmentWithRepairCost')::integer IS DISTINCT FROM 3
     OR (v_period_quality->>'equipmentWithBoth')::integer IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'Expected period dataQuality usage=3 repairCost=3 both=3, got %', v_period_quality;
  END IF;

  IF (v_cumulative_quality->>'equipmentWithUsage')::integer IS DISTINCT FROM 3
     OR (v_cumulative_quality->>'equipmentWithRepairCost')::integer IS DISTINCT FROM 3
     OR (v_cumulative_quality->>'equipmentWithBoth')::integer IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'Expected cumulative dataQuality usage=3 repairCost=3 both=3, got %', v_cumulative_quality;
  END IF;

  IF NOT (
    v_report ? 'summary'
    AND v_report #> '{charts,repairStatusDistribution}' IS NOT NULL
    AND v_report #> '{charts,maintenancePlanVsActual}' IS NOT NULL
    AND v_report #> '{charts,repairFrequencyByMonth}' IS NOT NULL
    AND v_report #> '{charts,repairCostByMonth}' IS NOT NULL
    AND v_report #> '{charts,repairCostByFacility}' IS NOT NULL
    AND v_report ? 'topEquipmentRepairs'
    AND v_report ? 'recentRepairHistory'
  ) THEN
    RAISE EXCEPTION 'Expected existing maintenance report payload keys to remain present, got %', v_report;
  END IF;

  SELECT count(*)
  INTO v_both_count
  FROM jsonb_array_elements(v_period_points) AS point(row_data)
  WHERE row_data->>'equipmentCode' = 'RCUV-X-' || v_suffix;

  IF v_both_count <> 0 THEN
    RAISE EXCEPTION 'Expected other-tenant equipment to be excluded from non-global scoped payload, got %', v_period_points;
  END IF;

  PERFORM pg_temp._rcuv_set_claims('admin', v_user_id, NULL);

  v_admin_scoped_report := public.get_maintenance_report_data(v_date_from, v_date_to, v_tenant);

  SELECT count(*)
  INTO v_both_count
  FROM jsonb_array_elements(v_admin_scoped_report #> '{charts,repairUsageCostCorrelation,period,points}') AS point(row_data)
  WHERE row_data->>'equipmentCode' = 'RCUV-X-' || v_suffix;

  IF v_both_count <> 0 THEN
    RAISE EXCEPTION 'Expected admin/global payload with p_don_vi to stay facility-scoped, got %', v_admin_scoped_report;
  END IF;

  RAISE NOTICE 'OK: repair cost usage visualization payload contract passed';
END $$;

ROLLBACK;
