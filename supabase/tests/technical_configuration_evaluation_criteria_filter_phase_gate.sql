-- P12B2 rollback-only server-filtered evaluation criteria auth and behavior gate.
BEGIN;

CREATE FUNCTION pg_temp.assert_true(p_label TEXT, p_condition BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $gate$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', p_label;
  END IF;
END;
$gate$;

CREATE FUNCTION pg_temp.expect_error(
  p_label TEXT,
  p_statement TEXT,
  p_expected_state TEXT,
  p_expected_message TEXT
) RETURNS VOID LANGUAGE plpgsql AS $gate$
DECLARE
  v_state TEXT;
  v_message TEXT;
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_state = RETURNED_SQLSTATE,
      v_message = MESSAGE_TEXT;
    IF v_state IS DISTINCT FROM p_expected_state
       OR v_message IS DISTINCT FROM p_expected_message THEN
      RAISE EXCEPTION '%: expected [%] %, got [%] %',
        p_label, p_expected_state, p_expected_message, v_state, v_message;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION '%: expected statement to fail', p_label;
END;
$gate$;

CREATE FUNCTION pg_temp.set_claims(p_app_role TEXT, p_user_id BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $gate$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', p_app_role,
      'role', 'authenticated',
      'user_id', p_user_id::TEXT,
      'sub', p_user_id::TEXT
    )::TEXT,
    true
  );
END;
$gate$;

DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID := gen_random_uuid();
  v_supplier_id UUID := gen_random_uuid();
  v_option_id UUID := gen_random_uuid();
  v_version_id UUID := gen_random_uuid();
  v_group_id UUID := gen_random_uuid();
  v_set_id UUID := gen_random_uuid();
  v_criterion_1 UUID;
  v_criterion_2 UUID;
  v_criterion_3 UUID;
  v_criterion_4 UUID;
  v_criterion_5 UUID;
  v_criterion_101 UUID;
  v_assessment_count BIGINT;
  v_result JSONB;
  v_function_signature TEXT :=
    'public.technical_configuration_evaluation_criteria_list(uuid,uuid,text,integer,integer)';
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_evaluation_criteria_filter_phase_gate')
  );

  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P12B2 phase gate requires one active public.nhan_vien row';
  END IF;

  INSERT INTO public.technical_configuration_dossiers (
    id,
    device_type_name,
    name,
    created_by,
    updated_by
  ) VALUES (
    v_dossier_id,
    'P12B2 device ' || v_suffix,
    'P12B2 dossier ' || v_suffix,
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_suppliers (
    id,
    dossier_id,
    name,
    created_by,
    updated_by
  ) VALUES (
    v_supplier_id,
    v_dossier_id,
    'P12B2 Supplier',
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_options (
    id,
    dossier_id,
    supplier_id,
    option_name,
    created_by,
    updated_by
  ) VALUES (
    v_option_id,
    v_dossier_id,
    v_supplier_id,
    'P12B2 Option',
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_baseline_versions (
    id,
    dossier_id,
    version_number,
    status,
    next_criterion_number,
    revision,
    locked_at,
    locked_by,
    created_by,
    updated_by
  ) VALUES (
    v_version_id,
    v_dossier_id,
    1,
    'locked',
    102,
    1,
    now(),
    v_user_id,
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_baseline_groups (
    id,
    baseline_version_id,
    name,
    sort_order,
    created_by,
    updated_by
  ) VALUES (
    v_group_id,
    v_version_id,
    'P12B2 Group',
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
  SELECT
    gen_random_uuid(),
    v_version_id,
    v_group_id,
    'TC-' || lpad(series::TEXT, 4, '0'),
    'P12B2 criterion ' || series,
    series,
    v_user_id,
    v_user_id
  FROM generate_series(1, 101) AS series;

  SELECT id INTO v_criterion_1
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_version_id AND sort_order = 1;
  SELECT id INTO v_criterion_2
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_version_id AND sort_order = 2;
  SELECT id INTO v_criterion_3
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_version_id AND sort_order = 3;
  SELECT id INTO v_criterion_4
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_version_id AND sort_order = 4;
  SELECT id INTO v_criterion_5
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_version_id AND sort_order = 5;
  SELECT id INTO v_criterion_101
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_version_id AND sort_order = 101;

  INSERT INTO public.technical_configuration_comparison_sets (
    id,
    dossier_id,
    option_id,
    baseline_version_id,
    created_by,
    updated_by
  ) VALUES (
    v_set_id,
    v_dossier_id,
    v_option_id,
    v_version_id,
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_manual_assessments (
    comparison_set_id,
    baseline_version_id,
    criterion_id,
    technical_axis,
    evidence_axis,
    created_by,
    updated_by
  ) VALUES
    (v_set_id, v_version_id, v_criterion_2, 'fails', 'complete', v_user_id, v_user_id),
    (v_set_id, v_version_id, v_criterion_3, 'meets', 'partial', v_user_id, v_user_id),
    (v_set_id, v_version_id, v_criterion_4, 'exceeds', 'complete', v_user_id, v_user_id),
    (v_set_id, v_version_id, v_criterion_5, 'meets', NULL, v_user_id, v_user_id),
    (v_set_id, v_version_id, v_criterion_101, 'fails', 'missing', v_user_id, v_user_id);

  SELECT count(*)
  INTO v_assessment_count
  FROM public.technical_configuration_manual_assessments
  WHERE comparison_set_id = v_set_id;

  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error(
    'missing claims rejected',
    format(
      'SELECT public.technical_configuration_evaluation_criteria_list(%L::UUID, %L::UUID, %L, 1, 100)',
      v_option_id,
      v_version_id,
      'all'
    ),
    '42501',
    'permission_denied'
  );

  PERFORM pg_temp.set_claims('to_qltb', v_user_id);
  PERFORM pg_temp.expect_error(
    'non-global role rejected',
    format(
      'SELECT public.technical_configuration_evaluation_criteria_list(%L::UUID, %L::UUID, %L, 1, 100)',
      v_option_id,
      v_version_id,
      'all'
    ),
    '42501',
    'permission_denied'
  );

  PERFORM pg_temp.set_claims('admin', v_user_id);
  SELECT public.technical_configuration_evaluation_criteria_list(
    v_option_id,
    v_version_id,
    'all',
    2,
    100
  ) INTO v_result;
  PERFORM pg_temp.assert_true(
    'raw admin receives canonical page independent from transport page size',
    (v_result->>'total')::BIGINT = 101
    AND jsonb_array_length(v_result->'data') = 1
    AND (v_result->'data'->0->>'criterion_id')::UUID = v_criterion_101
    AND (v_result->'data'->0->>'canonical_index')::BIGINT = 101
    AND (v_result->'data'->0->>'canonical_page')::BIGINT = 3
  );

  PERFORM pg_temp.set_claims('global', v_user_id);
  SELECT public.technical_configuration_evaluation_criteria_list(
    v_option_id,
    v_version_id,
    'fails',
    1,
    100
  ) INTO v_result;
  PERFORM pg_temp.assert_true(
    'fails filter returns exact canonical ids',
    (v_result->>'total')::BIGINT = 2
    AND jsonb_array_length(v_result->'data') = 2
    AND (v_result->'data'->0->>'criterion_id')::UUID = v_criterion_2
    AND (v_result->'data'->1->>'criterion_id')::UUID = v_criterion_101
    AND (v_result->'data'->1->>'canonical_page')::BIGINT = 3
  );

  SELECT public.technical_configuration_evaluation_criteria_list(
    v_option_id,
    v_version_id,
    'insufficient_evidence',
    1,
    100
  ) INTO v_result;
  PERFORM pg_temp.assert_true(
    'insufficient evidence filter returns exact canonical id',
    (v_result->>'total')::BIGINT = 1
    AND (v_result->'data'->0->>'criterion_id')::UUID = v_criterion_3
  );

  SELECT public.technical_configuration_evaluation_criteria_list(
    v_option_id,
    v_version_id,
    'not_evaluated',
    1,
    100
  ) INTO v_result;
  PERFORM pg_temp.assert_true(
    'not evaluated filter includes missing axes in canonical order',
    (v_result->>'total')::BIGINT = 97
    AND (v_result->'data'->0->>'criterion_id')::UUID = v_criterion_1
    AND (v_result->'data'->1->>'criterion_id')::UUID = v_criterion_5
  );

  PERFORM pg_temp.expect_error(
    'invalid filter rejected',
    format(
      'SELECT public.technical_configuration_evaluation_criteria_list(%L::UUID, %L::UUID, %L, 1, 100)',
      v_option_id,
      v_version_id,
      'meets'
    ),
    'PT422',
    'validation_error'
  );
  PERFORM pg_temp.expect_error(
    'invalid page rejected',
    format(
      'SELECT public.technical_configuration_evaluation_criteria_list(%L::UUID, %L::UUID, %L, 0, 100)',
      v_option_id,
      v_version_id,
      'all'
    ),
    'PT422',
    'validation_error'
  );
  PERFORM pg_temp.expect_error(
    'oversized page rejected',
    format(
      'SELECT public.technical_configuration_evaluation_criteria_list(%L::UUID, %L::UUID, %L, 1, 101)',
      v_option_id,
      v_version_id,
      'all'
    ),
    'PT422',
    'validation_error'
  );
  PERFORM pg_temp.expect_error(
    'missing option rejected',
    format(
      'SELECT public.technical_configuration_evaluation_criteria_list(%L::UUID, %L::UUID, %L, 1, 100)',
      gen_random_uuid(),
      v_version_id,
      'all'
    ),
    'PT404',
    'not_found'
  );

  PERFORM pg_temp.assert_true(
    'filtered reads do not mutate assessments',
    (
      SELECT count(*) = v_assessment_count
      FROM public.technical_configuration_manual_assessments
      WHERE comparison_set_id = v_set_id
    )
  );
  PERFORM pg_temp.assert_true(
    'authenticated executes filtered criteria rpc',
    has_function_privilege('authenticated', v_function_signature, 'EXECUTE')
  );
  PERFORM pg_temp.assert_true(
    'service role executes filtered criteria rpc',
    has_function_privilege('service_role', v_function_signature, 'EXECUTE')
  );
  PERFORM pg_temp.assert_true(
    'anon cannot execute filtered criteria rpc',
    NOT has_function_privilege('anon', v_function_signature, 'EXECUTE')
  );
END;
$gate$;

ROLLBACK;
