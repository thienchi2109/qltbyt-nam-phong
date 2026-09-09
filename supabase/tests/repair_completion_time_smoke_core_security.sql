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

  PERFORM pg_temp._rct_set_claims('admin', v_user_id, NULL);

  v_admin_scoped_report := public.get_maintenance_report_data(v_date_from, v_date_to, v_tenant);

  SELECT (v_admin_scoped_report #>> '{charts,repairCompletionTime,stats,totalCompleted}')::integer
  INTO v_other_count;

  IF v_other_count IS DISTINCT FROM 8 THEN
    RAISE EXCEPTION 'Expected admin/global payload with p_don_vi to stay facility-scoped totalCompleted=8, got %', v_admin_scoped_report;
  END IF;

END $$;

ROLLBACK;
