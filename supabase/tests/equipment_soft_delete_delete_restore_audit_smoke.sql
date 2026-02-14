-- supabase/tests/equipment_soft_delete_delete_restore_audit_smoke.sql
-- Purpose: validate equipment soft-delete delete/restore contract, audit trail, and restore safety
-- Non-destructive: wrapped in transaction and rolled back

BEGIN;

DO $$
DECLARE
  v_active_tenant bigint;
  v_inactive_tenant bigint;
  v_id bigint;
  v_inactive_id bigint;
  v_code text := 'SMK-SD-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_code_inactive text := 'SMK-SD-I-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_delete_audit_count bigint;
  v_restore_audit_count bigint;
  v_is_deleted boolean;
  v_err_text text;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('app_role', 'global', 'role', 'authenticated', 'user_id', '1', 'sub', '1', 'don_vi', null)::text,
    true
  );

  SELECT id
  INTO v_active_tenant
  FROM public.don_vi
  WHERE active = true
  ORDER BY id
  LIMIT 1;

  IF v_active_tenant IS NULL THEN
    RAISE EXCEPTION 'No active tenant found for smoke fixture';
  END IF;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi)
  VALUES (v_code, 'Soft delete smoke active', v_active_tenant)
  RETURNING id INTO v_id;

  PERFORM public.equipment_delete(v_id);

  SELECT is_deleted
  INTO v_is_deleted
  FROM public.thiet_bi
  WHERE id = v_id;

  IF v_is_deleted IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected equipment_delete to mark row as is_deleted=true';
  END IF;

  SELECT COUNT(*)
  INTO v_delete_audit_count
  FROM public.audit_logs
  WHERE action_type = 'equipment_delete'
    AND entity_type = 'equipment'
    AND entity_id = v_id;

  IF v_delete_audit_count <> 1 THEN
    RAISE EXCEPTION 'Expected 1 equipment_delete audit row, got: %', v_delete_audit_count;
  END IF;

  PERFORM public.equipment_restore(v_id);

  SELECT is_deleted
  INTO v_is_deleted
  FROM public.thiet_bi
  WHERE id = v_id;

  IF v_is_deleted IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Expected equipment_restore to mark row as is_deleted=false';
  END IF;

  SELECT COUNT(*)
  INTO v_restore_audit_count
  FROM public.audit_logs
  WHERE action_type = 'equipment_restore'
    AND entity_type = 'equipment'
    AND entity_id = v_id;

  IF v_restore_audit_count <> 1 THEN
    RAISE EXCEPTION 'Expected 1 equipment_restore audit row, got: %', v_restore_audit_count;
  END IF;

  INSERT INTO public.don_vi(name, active)
  VALUES ('Soft-delete smoke inactive ' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'), false)
  RETURNING id INTO v_inactive_tenant;

  INSERT INTO public.thiet_bi(ma_thiet_bi, ten_thiet_bi, don_vi, is_deleted)
  VALUES (v_code_inactive, 'Soft delete smoke inactive', v_inactive_tenant, true)
  RETURNING id INTO v_inactive_id;

  BEGIN
    PERFORM public.equipment_restore(v_inactive_id);
    RAISE EXCEPTION 'Expected equipment_restore to fail for inactive tenant';
  EXCEPTION WHEN OTHERS THEN
    v_err_text := lower(SQLERRM);
    IF position('inactive' in v_err_text) = 0 AND position('missing' in v_err_text) = 0 THEN
      RAISE EXCEPTION 'Expected inactive/missing tenant error, got: %', SQLERRM;
    END IF;
  END;

  RAISE NOTICE 'OK: soft-delete delete/restore smoke checks passed';
END $$;

ROLLBACK;
