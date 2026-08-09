-- P2A hierarchy import preview authorization and privilege phase gate.
-- The v2 functions must be applied before execution. All fixture writes roll back.
BEGIN;
CREATE FUNCTION pg_temp.expect_error(
  p_label TEXT,
  p_statement TEXT,
  p_expected_state TEXT,
  p_expected_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
DECLARE
  v_state TEXT;
  v_message TEXT;
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_state = RETURNED_SQLSTATE,
        v_message = MESSAGE_TEXT;
      IF v_state = p_expected_state AND v_message = p_expected_message THEN
        RETURN;
      END IF;
      RAISE EXCEPTION '%: expected %/%, got %/%',
        p_label, p_expected_state, p_expected_message, v_state, v_message;
  END;
  RAISE EXCEPTION '%: expected statement to fail', p_label;
END;
$gate$;
CREATE FUNCTION pg_temp.set_claims(p_app_role TEXT, p_user_id BIGINT)
RETURNS TEXT
LANGUAGE sql
AS $gate$
  SELECT set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', p_app_role,
      'role', 'authenticated',
      'user_id', p_user_id::TEXT,
      'sub', p_user_id::TEXT
    )::TEXT,
    true
  );
$gate$;
DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID := gen_random_uuid();
  v_version_id UUID := gen_random_uuid();
  v_revision BIGINT := 1;
  v_metadata JSONB;
  v_response JSONB;
  v_statement TEXT;
  v_preview_signature TEXT :=
    'public.technical_configuration_baseline_import_preview_v2(uuid,jsonb,jsonb,bigint)';
  v_metadata_signature TEXT :=
    'public._technical_configuration_baseline_import_validate_metadata_v2(uuid,jsonb,bigint)';
  v_validator_signature TEXT :=
    'public._technical_configuration_baseline_import_validate_v2(uuid,jsonb,jsonb,bigint)';
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_baseline_hierarchy_import_preview_security_phase_gate')
  );
  SELECT nv.id INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active = true
  ORDER BY nv.id
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Setup failed: no active nhan_vien row found';
  END IF;
  INSERT INTO public.technical_configuration_dossiers
    (id, device_type_name, name, description, created_by, updated_by)
  VALUES (
    v_dossier_id,
    'P2A security device ' || v_suffix,
    'P2A security dossier ' || v_suffix,
    'Rolled back after verification',
    v_user_id,
    v_user_id
  );
  INSERT INTO public.technical_configuration_baseline_versions
    (id, dossier_id, version_number, status, next_criterion_number, revision,
     created_by, updated_by)
  VALUES (
    v_version_id, v_dossier_id, 1, 'draft', 1, v_revision, v_user_id, v_user_id
  );
  v_metadata := jsonb_build_object(
    'template_kind', 'technical_configuration_baseline',
    'template_version', 2,
    'dossier_id', v_dossier_id,
    'baseline_version_id', v_version_id,
    'baseline_revision', v_revision,
    'generated_at', clock_timestamp()
  );
  v_statement := format(
    'SELECT public.technical_configuration_baseline_import_preview_v2(%L::UUID, %L::JSONB, %L::JSONB, %s)',
    v_version_id, v_metadata::TEXT, '[]'::JSONB::TEXT, v_revision
  );
  -- preview privilege contract
  IF NOT has_function_privilege('authenticated', v_preview_signature, 'EXECUTE')
     OR has_function_privilege('anon', v_preview_signature, 'EXECUTE')
     OR has_function_privilege('service_role', v_preview_signature, 'EXECUTE') THEN
    RAISE EXCEPTION 'preview privilege contract mismatch';
  END IF;
  -- internal helper privilege contract
  IF has_function_privilege('authenticated', v_metadata_signature, 'EXECUTE')
     OR has_function_privilege('anon', v_metadata_signature, 'EXECUTE')
     OR has_function_privilege('service_role', v_metadata_signature, 'EXECUTE')
     OR has_function_privilege('authenticated', v_validator_signature, 'EXECUTE')
     OR has_function_privilege('anon', v_validator_signature, 'EXECUTE')
     OR has_function_privilege('service_role', v_validator_signature, 'EXECUTE') THEN
    RAISE EXCEPTION 'internal helper privilege contract mismatch';
  END IF;
  -- missing claims fail closed
  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error(
    'missing claims fail closed',
    v_statement,
    '42501',
    'permission_denied'
  );
  -- non-global role denied
  PERFORM pg_temp.set_claims('to_qltb', v_user_id);
  PERFORM pg_temp.expect_error(
    'non-global role denied',
    v_statement,
    '42501',
    'permission_denied'
  );
  -- raw admin preview succeeds
  PERFORM pg_temp.set_claims('admin', v_user_id);
  EXECUTE v_statement INTO v_response;
  IF jsonb_array_length(v_response->'errors') <> 0
     OR (v_response#>>'{data,counts,groups}')::BIGINT <> 0
     OR (v_response#>>'{data,counts,subgroups}')::BIGINT <> 0
     OR (v_response#>>'{data,counts,criteria}')::BIGINT <> 0 THEN
    RAISE EXCEPTION 'raw admin preview succeeds: unexpected response %', v_response;
  END IF;
END;
$gate$;
ROLLBACK;
