-- supabase/tests/technical_configuration_dossier_delete_audit_failure_phase_gate.sql
-- ISOLATED DATABASE ONLY.
-- DO NOT RUN ON LIVE DB: this rollback-only proof transactionally replaces the
-- shared public.audit_log(TEXT, TEXT, BIGINT, TEXT, JSONB) helper.
BEGIN;

CREATE OR REPLACE FUNCTION public.audit_log(
  p_action_type TEXT,
  p_entity_type TEXT DEFAULT NULL::TEXT,
  p_entity_id BIGINT DEFAULT NULL::BIGINT,
  p_entity_label TEXT DEFAULT NULL::TEXT,
  p_action_details JSONB DEFAULT NULL::JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN FALSE;
END;
$function$;

DO $gate$
DECLARE
  v_run_token TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID;
  v_version_id UUID;
  v_group_id UUID;
  v_criterion_id UUID;
  v_state TEXT;
  v_message TEXT;
  v_audit_count BIGINT;
BEGIN
  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active = true
  ORDER BY nv.id
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Setup failed: no active nhan_vien row found';
  END IF;
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', v_user_id::TEXT,
      'sub', v_user_id::TEXT
    )::TEXT,
    true
  );

  v_dossier_id := md5('p15a2-failure-dossier:' || v_run_token)::UUID;
  v_version_id := md5('p15a2-failure-version:' || v_run_token)::UUID;
  v_group_id := md5('p15a2-failure-group:' || v_run_token)::UUID;
  v_criterion_id := md5('p15a2-failure-criterion:' || v_run_token)::UUID;

  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, description, created_by, updated_by
  )
  VALUES (
    v_dossier_id,
    'P15A2 audit device failure ' || v_run_token,
    'P15A2 audit dossier failure ' || v_run_token,
    'P15A2 audit description failure ' || v_run_token,
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_baseline_versions (
    id, dossier_id, version_number, status, next_criterion_number, created_by, updated_by
  )
  VALUES (v_version_id, v_dossier_id, 1, 'draft', 2, v_user_id, v_user_id);

  INSERT INTO public.technical_configuration_baseline_groups (
    id, baseline_version_id, name, sort_order, created_by, updated_by
  )
  VALUES (
    v_group_id,
    v_version_id,
    'P15A2 audit group failure',
    1,
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_baseline_criteria (
    id,
    baseline_version_id,
    group_id,
    criterion_code,
    requirement_text,
    sort_order,
    created_by,
    updated_by
  )
  VALUES (
    v_criterion_id,
    v_version_id,
    v_group_id,
    'TC-0001',
    'P15A2 audit requirement failure',
    1,
    v_user_id,
    v_user_id
  );

  BEGIN
    PERFORM public.technical_configuration_dossiers_delete(v_dossier_id, 1);
    RAISE EXCEPTION 'forced audit failure unexpectedly deleted dossier';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_state = RETURNED_SQLSTATE,
        v_message = MESSAGE_TEXT;
      IF v_state <> 'PT500' OR v_message <> 'audit_log_failed' THEN
        RAISE EXCEPTION 'forced audit failure expected PT500/audit_log_failed, got %/%',
          v_state, v_message;
      END IF;
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_dossiers d
    WHERE d.id = v_dossier_id
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_versions v
    WHERE v.id = v_version_id
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_groups g
    WHERE g.id = v_group_id
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_criteria c
    WHERE c.id = v_criterion_id
  ) THEN
    RAISE EXCEPTION 'forced audit failure changed dossier aggregate';
  END IF;
  RAISE NOTICE 'forced audit failure preserved dossier aggregate';

  SELECT count(*)
  INTO v_audit_count
  FROM public.audit_logs al
  WHERE al.action_type = 'technical_configuration_dossier_delete'
    AND al.entity_type = 'technical_configuration_dossier'
    AND al.action_details->>'dossier_id' = v_dossier_id::TEXT;
  IF v_audit_count <> 0 THEN
    RAISE EXCEPTION 'forced audit failure created % audit rows', v_audit_count;
  END IF;
  RAISE NOTICE 'forced audit failure created no audit row';
END;
$gate$;

ROLLBACK;
