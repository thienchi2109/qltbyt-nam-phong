-- supabase/tests/maintenance_audit_notfound_smoke.sql
-- Purpose: lock maintenance plan-create audit logging and missing-task update errors.
-- Non-destructive: wrapped in a transaction and rolled back.

BEGIN;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_region_id bigint;
  v_tenant bigint;
  v_user_id bigint;
  v_missing_task_id bigint := -987654321;
  v_failed boolean := false;
  v_sqlstate text;
BEGIN
  INSERT INTO public.dia_ban(ma_dia_ban, ten_dia_ban, active)
  VALUES ('SMK-MANF-' || v_suffix, 'Smoke Maintenance Audit NotFound Region ' || v_suffix, true)
  RETURNING id INTO v_region_id;

  INSERT INTO public.don_vi(code, name, active, dia_ban_id)
  VALUES ('SMK-MANF-' || v_suffix, 'Smoke Maintenance Audit NotFound Tenant ' || v_suffix, true, v_region_id)
  RETURNING id INTO v_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi, dia_ban_id)
  VALUES (
    'maintenance_audit_notfound_smoke_' || v_suffix,
    'smoke-password',
    'Maintenance Audit NotFound Smoke',
    'to_qltb',
    v_tenant,
    v_tenant,
    v_region_id
  )
  RETURNING id INTO v_user_id;

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

  BEGIN
    PERFORM public.maintenance_task_update(
      v_missing_task_id,
      jsonb_build_object('ghi_chu', 'Smoke missing task update ' || v_suffix)
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    v_sqlstate := SQLSTATE;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'Expected maintenance_task_update missing task to raise P0002';
  END IF;

  IF v_sqlstate IS DISTINCT FROM 'P0002' THEN
    RAISE EXCEPTION 'Expected maintenance_task_update missing task to raise P0002, got %', v_sqlstate;
  END IF;

  RAISE NOTICE 'OK: maintenance_task_update missing task raises P0002';
END $$;

DO $$
DECLARE
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_region_id bigint;
  v_tenant bigint;
  v_user_id bigint;
  v_plan_id bigint;
  v_log public.audit_logs%ROWTYPE;
BEGIN
  INSERT INTO public.dia_ban(ma_dia_ban, ten_dia_ban, active)
  VALUES ('SMK-MAA-' || v_suffix, 'Smoke Maintenance Audit Region ' || v_suffix, true)
  RETURNING id INTO v_region_id;

  INSERT INTO public.don_vi(code, name, active, dia_ban_id)
  VALUES ('SMK-MAA-' || v_suffix, 'Smoke Maintenance Audit Tenant ' || v_suffix, true, v_region_id)
  RETURNING id INTO v_tenant;

  INSERT INTO public.nhan_vien(username, password, full_name, role, don_vi, current_don_vi, dia_ban_id)
  VALUES (
    'maintenance_audit_smoke_' || v_suffix,
    'smoke-password',
    'Maintenance Audit Smoke',
    'to_qltb',
    v_tenant,
    v_tenant,
    v_region_id
  )
  RETURNING id INTO v_user_id;

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

  v_plan_id := public.maintenance_plan_create(
    'Smoke Maintenance Audit Plan ' || v_suffix,
    EXTRACT(YEAR FROM current_date)::integer,
    'kiem_tra',
    'Smoke Audit Department',
    'Maintenance Audit Smoke'
  );

  SELECT al.*
  INTO v_log
  FROM public.audit_logs al
  WHERE al.action_type = 'maintenance_plan_create'
    AND al.entity_type = 'maintenance_plan'
    AND al.entity_id = v_plan_id
  ORDER BY al.id DESC
  LIMIT 1;

  IF v_log.id IS NULL THEN
    RAISE EXCEPTION 'Expected maintenance_plan_create to write an audit_logs row';
  END IF;

  IF v_log.entity_label IS DISTINCT FROM 'Smoke Maintenance Audit Plan ' || v_suffix THEN
    RAISE EXCEPTION 'Expected audit entity_label to match plan name, got %', v_log.entity_label;
  END IF;

  IF v_log.action_details->>'loai_cong_viec' IS DISTINCT FROM 'kiem_tra' THEN
    RAISE EXCEPTION 'Expected audit action_details.loai_cong_viec to be kiem_tra, got %', v_log.action_details->>'loai_cong_viec';
  END IF;

  IF v_log.action_details->>'khoa_phong' IS DISTINCT FROM 'Smoke Audit Department' THEN
    RAISE EXCEPTION 'Expected audit action_details.khoa_phong to match input, got %', v_log.action_details->>'khoa_phong';
  END IF;

  RAISE NOTICE 'OK: maintenance_plan_create writes audit_logs row';
END $$;

ROLLBACK;
