-- supabase/tests/repair_completion_time_smoke.sql
-- Purpose: smoke-test repair completion-time visualization payload contract after the migration is applied.
-- How to run (MCP): execute this whole file through Supabase MCP execute_sql.
-- Non-destructive: wrapped in transaction and rolled back.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp._rct_set_claims(
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
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_date_from date := (date_trunc('month', current_date)::date - interval '2 months')::date;
  v_date_to date := (date_trunc('month', current_date)::date + interval '1 month' - interval '1 day')::date;
  v_base timestamp := (date_trunc('month', current_date)::date - interval '2 months')::timestamp + interval '9 hours';
  v_tenant bigint;
  v_other_tenant bigint;
  v_user_id bigint;
  v_equipment_a bigint;
  v_equipment_b bigint;
  v_equipment_other bigint;
  v_report jsonb;
  v_admin_scoped_report jsonb;
  v_completion jsonb;
  v_distribution jsonb;
  v_by_month jsonb;
  v_bucket_count integer;
  v_other_count integer;
  v_month_total integer;
BEGIN
  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair completion smoke tenant ' || v_suffix, true)
  RETURNING id INTO v_tenant;

  INSERT INTO public.don_vi(name, active)
  VALUES ('Repair completion smoke other tenant ' || v_suffix, true)
  RETURNING id INTO v_other_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi)
  VALUES (
    'repair_completion_smoke_' || v_suffix,
    'smoke-password',
    'Repair Completion Smoke',
    'to_qltb',
    v_tenant,
    v_tenant
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, tinh_trang_hien_tai, is_deleted)
  VALUES
    ('RCT-A-' || v_suffix, 'Thiết bị completion A ' || v_suffix, v_tenant, 'Hoạt động', false),
    ('RCT-B-' || v_suffix, 'Thiết bị completion B ' || v_suffix, v_tenant, 'Hoạt động', false),
    ('RCT-X-' || v_suffix, 'Thiết bị completion other ' || v_suffix, v_other_tenant, 'Hoạt động', false);

  SELECT id INTO v_equipment_a
  FROM public.thiet_bi
  WHERE ma_thiet_bi = 'RCT-A-' || v_suffix;

  SELECT id INTO v_equipment_b
  FROM public.thiet_bi
  WHERE ma_thiet_bi = 'RCT-B-' || v_suffix;

  SELECT id INTO v_equipment_other
  FROM public.thiet_bi
  WHERE ma_thiet_bi = 'RCT-X-' || v_suffix;

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
      'Completion smoke 0-1d',
      'Completion item 0-1d',
      'Hoàn thành',
      v_base,
      v_base + interval '8 hours',
      v_base + interval '12 hours',
      'Smoke requester',
      'noi_bo',
      100000
    ),
    (
      v_equipment_a,
      'Completion smoke 1-3d approved late',
      'Completion item 1-3d',
      'Hoàn thành',
      v_base + interval '3 days',
      v_base + interval '11 days',
      v_base + interval '5 days',
      'Smoke requester',
      'noi_bo',
      200000
    ),
    (
      v_equipment_a,
      'Completion smoke 3-7d',
      'Completion item 3-7d',
      'Hoàn thành',
      v_base + interval '8 days',
      v_base + interval '9 days',
      v_base + interval '13 days',
      'Smoke requester',
      'noi_bo',
      300000
    ),
    (
      v_equipment_b,
      'Completion smoke 7-14d',
      'Completion item 7-14d',
      'Hoàn thành',
      v_base + interval '15 days',
      v_base + interval '16 days',
      v_base + interval '25 days',
      'Smoke requester',
      'noi_bo',
      400000
    ),
    (
      v_equipment_b,
      'Completion smoke 14-30d',
      'Completion item 14-30d',
      'Hoàn thành',
      v_base + interval '35 days',
      v_base + interval '36 days',
      v_base + interval '55 days',
      'Smoke requester',
      'noi_bo',
      500000
    ),
    (
      v_equipment_b,
      'Completion smoke 30d+',
      'Completion item 30d+',
      'Hoàn thành',
      v_base + interval '38 days',
      v_base + interval '39 days',
      v_base + interval '78 days',
      'Smoke requester',
      'noi_bo',
      600000
    ),
    (
      v_equipment_b,
      'Completion smoke exact 14d boundary',
      'Completion item exact 14d',
      'Hoàn thành',
      v_base + interval '22 days',
      v_base + interval '23 days',
      v_base + interval '36 days',
      'Smoke requester',
      'noi_bo',
      650000
    ),
    (
      v_equipment_a,
      'Completion smoke opened before range included by completion date',
      'Completion item completion-date included',
      'Hoàn thành',
      v_date_from::timestamp - interval '1 day' + interval '9 hours',
      v_date_from::timestamp + interval '10 hours',
      v_date_from::timestamp + interval '1 day' + interval '9 hours',
      'Smoke requester',
      'noi_bo',
      660000
    ),
    (
      v_equipment_a,
      'Completion smoke completed after range ignored',
      'Completion item completion-date excluded',
      'Hoàn thành',
      v_date_to::timestamp - interval '1 day' + interval '9 hours',
      v_date_to::timestamp,
      v_date_to::timestamp + interval '3 days' + interval '9 hours',
      'Smoke requester',
      'noi_bo',
      670000
    ),
    (
      v_equipment_a,
      'Completion smoke unfinished ignored',
      'Completion item unfinished',
      'Đã duyệt',
      v_base + interval '40 days',
      v_base + interval '41 days',
      NULL,
      'Smoke requester',
      'noi_bo',
      NULL
    ),
    (
      v_equipment_other,
      'Completion smoke other tenant ignored',
      'Completion item other tenant',
      'Hoàn thành',
      v_base + interval '1 day',
      v_base + interval '2 days',
      v_base + interval '41 days',
      'Smoke requester',
      'noi_bo',
      700000
    );

  PERFORM pg_temp._rct_set_claims('to_qltb', v_user_id, v_tenant);

  v_report := public.get_maintenance_report_data(v_date_from, v_date_to, v_tenant);
  v_completion := v_report #> '{charts,repairCompletionTime}';
  v_distribution := v_completion->'distribution';
  v_by_month := v_report #> '{charts,repairCompletionTimeByMonth}';

  IF v_completion IS NULL THEN
    RAISE EXCEPTION 'Expected charts.repairCompletionTime payload key, got %', v_report;
  END IF;

  IF v_by_month IS NULL THEN
    RAISE EXCEPTION 'Expected charts.repairCompletionTimeByMonth payload key, got %', v_report;
  END IF;

  IF v_report ? 'recentRepairHistory' THEN
    RAISE EXCEPTION 'Expected recentRepairHistory to be removed from payload, got %', v_report;
  END IF;

  IF (v_completion #>> '{stats,totalCompleted}')::integer IS DISTINCT FROM 8 THEN
    RAISE EXCEPTION 'Expected totalCompleted=8, got %', v_completion #> '{stats,totalCompleted}';
  END IF;

  IF (v_completion #>> '{stats,medianMinutes}')::numeric IS DISTINCT FROM 10800 THEN
    RAISE EXCEPTION 'Expected medianMinutes=10800 from ngay_yeu_cau durations, got %', v_completion #> '{stats,medianMinutes}';
  END IF;

  IF (v_completion #>> '{stats,p90Minutes}')::numeric IS DISTINCT FROM 37440 THEN
    RAISE EXCEPTION 'Expected p90Minutes=37440 from ngay_yeu_cau durations, got %', v_completion #> '{stats,p90Minutes}';
  END IF;

  IF (v_completion #>> '{stats,averageMinutes}')::numeric IS DISTINCT FROM 16830 THEN
    RAISE EXCEPTION 'Expected averageMinutes=16830 from ngay_yeu_cau durations, got %', v_completion #> '{stats,averageMinutes}';
  END IF;

  IF (v_completion #>> '{stats,onTimeCount}')::integer IS DISTINCT FROM 6 THEN
    RAISE EXCEPTION 'Expected onTimeCount=6, got %', v_completion #> '{stats,onTimeCount}';
  END IF;

  IF abs((v_completion #>> '{stats,onTimePercent}')::numeric - 75.0) > 0.1 THEN
    RAISE EXCEPTION 'Expected onTimePercent about 75.0, got %', v_completion #> '{stats,onTimePercent}';
  END IF;

  IF (v_completion #>> '{stats,thresholdDays}')::integer IS DISTINCT FROM 14 THEN
    RAISE EXCEPTION 'Expected thresholdDays=14, got %', v_completion #> '{stats,thresholdDays}';
  END IF;

  IF jsonb_array_length(v_distribution) <> 6 THEN
    RAISE EXCEPTION 'Expected 6 completion buckets, got %', v_distribution;
  END IF;

  SELECT count(*)
  INTO v_bucket_count
  FROM jsonb_array_elements(v_distribution) AS bucket(row_data)
  WHERE (row_data->>'bucketKey', (row_data->>'count')::integer, (row_data->>'isOverThreshold')::boolean)
    IN (
      ('0-1d', 1, false),
      ('1-3d', 2, false),
      ('3-7d', 1, false),
      ('7-14d', 2, false),
      ('14-30d', 1, true),
      ('30d+', 1, true)
    );

  IF v_bucket_count <> 6 THEN
    RAISE EXCEPTION 'Expected exact completion bucket counts and threshold flags, got %', v_distribution;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_each(v_completion->'stats') AS pair(key_name, value_data)
    WHERE key_name ~ '_'
  )
  OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_distribution) AS bucket(row_data)
    JOIN LATERAL jsonb_each(bucket.row_data) AS pair(key_name, value_data) ON true
    WHERE key_name ~ '_'
  ) THEN
    RAISE EXCEPTION 'Expected camelCase completion payload keys, got %', v_completion;
  END IF;

  SELECT coalesce(sum((row_data->>'completedCount')::integer), 0)
  INTO v_month_total
  FROM jsonb_array_elements(v_by_month) AS month_point(row_data);

  IF v_month_total <> 8 THEN
    RAISE EXCEPTION 'Expected monthly completion total=8, got % from %', v_month_total, v_by_month;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_by_month) AS month_point(row_data)
    WHERE to_date(row_data->>'period', 'YYYY-MM') < date_trunc('month', v_date_from)::date
       OR to_date(row_data->>'period', 'YYYY-MM') > date_trunc('month', v_date_to)::date
  ) THEN
    RAISE EXCEPTION 'Expected monthly completion periods to stay within completion-date range %, got %', v_date_from, v_by_month;
  END IF;

  IF NOT (
    v_report ? 'summary'
    AND v_report #> '{charts,repairStatusDistribution}' IS NOT NULL
    AND v_report #> '{charts,maintenancePlanVsActual}' IS NOT NULL
    AND v_report #> '{charts,repairFrequencyByMonth}' IS NOT NULL
    AND v_report #> '{charts,repairCostByMonth}' IS NOT NULL
    AND v_report #> '{charts,repairCostByFacility}' IS NOT NULL
    AND v_report #> '{charts,repairUsageCostCorrelation}' IS NOT NULL
    AND v_report ? 'topEquipmentRepairs'
    AND v_report ? 'topEquipmentRepairCosts'
  ) THEN
    RAISE EXCEPTION 'Expected existing maintenance report payload keys to remain present, got %', v_report;
  END IF;

  PERFORM pg_temp._rct_set_claims('admin', v_user_id, NULL);

  v_admin_scoped_report := public.get_maintenance_report_data(v_date_from, v_date_to, v_tenant);

  SELECT (v_admin_scoped_report #>> '{charts,repairCompletionTime,stats,totalCompleted}')::integer
  INTO v_other_count;

  IF v_other_count IS DISTINCT FROM 8 THEN
    RAISE EXCEPTION 'Expected admin/global payload with p_don_vi to stay facility-scoped totalCompleted=8, got %', v_admin_scoped_report;
  END IF;

  RAISE NOTICE 'OK: repair completion time visualization payload contract passed';
END $$;

ROLLBACK;
