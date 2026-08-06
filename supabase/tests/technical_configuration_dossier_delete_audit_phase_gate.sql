-- supabase/tests/technical_configuration_dossier_delete_audit_phase_gate.sql
-- EXPLICIT LIVE DB WRITE APPROVAL REQUIRED.
-- Success-only rollback proof. This gate does not replace shared functions.
BEGIN;

DO $gate$
DECLARE
  v_run_token TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID;
  v_version_id UUID;
  v_group_id UUID;
  v_criterion_id UUID;
  v_response JSONB;
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

  v_dossier_id := md5('p15a2-success-dossier:' || v_run_token)::UUID;
  v_version_id := md5('p15a2-success-version:' || v_run_token)::UUID;
  v_group_id := md5('p15a2-success-group:' || v_run_token)::UUID;
  v_criterion_id := md5('p15a2-success-criterion:' || v_run_token)::UUID;

  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, description, created_by, updated_by
  )
  VALUES (
    v_dossier_id,
    'P15A2 audit device success ' || v_run_token,
    'P15A2 audit dossier success ' || v_run_token,
    'P15A2 audit description success ' || v_run_token,
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
    'P15A2 audit group success',
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
    'P15A2 audit requirement success',
    1,
    v_user_id,
    v_user_id
  );

  v_response := public.technical_configuration_dossiers_delete(v_dossier_id, 1);
  IF v_response <> jsonb_build_object('data', jsonb_build_object('id', v_dossier_id)) THEN
    RAISE EXCEPTION 'audited delete returned unexpected response: %', v_response;
  END IF;

  SELECT count(*)
  INTO v_audit_count
  FROM public.audit_logs al
  WHERE al.action_type = 'technical_configuration_dossier_delete'
    AND al.entity_type = 'technical_configuration_dossier'
    AND al.entity_id IS NULL
    AND al.entity_label = 'P15A2 audit dossier success ' || v_run_token
    AND al.action_details = jsonb_build_object(
      'dossier_id', v_dossier_id,
      'device_type_name', 'P15A2 audit device success ' || v_run_token,
      'name', 'P15A2 audit dossier success ' || v_run_token,
      'description', 'P15A2 audit description success ' || v_run_token,
      'revision', 1,
      'delete_kind', 'hard'
    );
  IF v_audit_count <> 1 THEN
    RAISE EXCEPTION 'audited delete expected exactly one audit row, got %', v_audit_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.technical_configuration_dossiers d
    WHERE d.id = v_dossier_id
  ) OR EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_versions v
    WHERE v.id = v_version_id
  ) OR EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_groups g
    WHERE g.id = v_group_id
  ) OR EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_criteria c
    WHERE c.id = v_criterion_id
  ) THEN
    RAISE EXCEPTION 'audited delete left aggregate residue';
  END IF;
END;
$gate$;

ROLLBACK;
