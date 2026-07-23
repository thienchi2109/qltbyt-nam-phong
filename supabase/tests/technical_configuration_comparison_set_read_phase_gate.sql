-- P8A4 rollback-only nullable comparison-set read, audit, and privilege gate.
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
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
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

CREATE FUNCTION pg_temp.assert_true(p_label TEXT, p_condition BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', p_label;
  END IF;
END;
$gate$;

DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID := gen_random_uuid();
  v_other_dossier_id UUID := gen_random_uuid();
  v_archived_dossier_id UUID := gen_random_uuid();
  v_supplier_id UUID := gen_random_uuid();
  v_other_supplier_id UUID := gen_random_uuid();
  v_archived_supplier_id UUID := gen_random_uuid();
  v_existing_option_id UUID := gen_random_uuid();
  v_missing_option_id UUID := gen_random_uuid();
  v_other_option_id UUID := gen_random_uuid();
  v_archived_option_id UUID := gen_random_uuid();
  v_version_id UUID := gen_random_uuid();
  v_other_version_id UUID := gen_random_uuid();
  v_archived_version_id UUID := gen_random_uuid();
  v_first_group_id UUID := gen_random_uuid();
  v_second_group_id UUID := gen_random_uuid();
  v_other_group_id UUID := gen_random_uuid();
  v_archived_group_id UUID := gen_random_uuid();
  v_first_criterion_id UUID := gen_random_uuid();
  v_second_criterion_id UUID := gen_random_uuid();
  v_other_criterion_id UUID := gen_random_uuid();
  v_archived_criterion_id UUID := gen_random_uuid();
  v_set_id UUID := gen_random_uuid();
  v_archived_set_id UUID := gen_random_uuid();
  v_first_response_id UUID := gen_random_uuid();
  v_second_response_id UUID := gen_random_uuid();
  v_response JSONB;
  v_expected_data JSONB;
  v_before_revision BIGINT;
  v_before_updated_at TIMESTAMPTZ;
  v_before_updated_by BIGINT;
  v_set_updated_at TIMESTAMPTZ;
  v_set_updated_by BIGINT;
  v_comparison_count BIGINT;
  v_response_count BIGINT;
  v_function_config TEXT[];
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_comparison_set_read_phase_gate')
  );

  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P8A4 phase gate requires one active public.nhan_vien row';
  END IF;

  INSERT INTO public.technical_configuration_dossiers (
    id,
    device_type_name,
    name,
    archived_at,
    archived_by,
    created_by,
    updated_by
  )
  VALUES
    (
      v_dossier_id,
      'P8A4 device ' || v_suffix,
      'P8A4 dossier ' || v_suffix,
      NULL,
      NULL,
      v_user_id,
      v_user_id
    ),
    (
      v_other_dossier_id,
      'P8A4 other device ' || v_suffix,
      'P8A4 other dossier ' || v_suffix,
      NULL,
      NULL,
      v_user_id,
      v_user_id
    ),
    (
      v_archived_dossier_id,
      'P8A4 archived device ' || v_suffix,
      'P8A4 archived dossier ' || v_suffix,
      now(),
      v_user_id,
      v_user_id,
      v_user_id
    );

  INSERT INTO public.technical_configuration_suppliers (
    id,
    dossier_id,
    name,
    created_by,
    updated_by
  )
  VALUES
    (v_supplier_id, v_dossier_id, 'P8A4 Supplier', v_user_id, v_user_id),
    (
      v_other_supplier_id,
      v_other_dossier_id,
      'P8A4 Other Supplier',
      v_user_id,
      v_user_id
    ),
    (
      v_archived_supplier_id,
      v_archived_dossier_id,
      'P8A4 Archived Supplier',
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
  )
  VALUES
    (
      v_existing_option_id,
      v_dossier_id,
      v_supplier_id,
      'Existing Option',
      v_user_id,
      v_user_id
    ),
    (
      v_missing_option_id,
      v_dossier_id,
      v_supplier_id,
      'Missing Option',
      v_user_id,
      v_user_id
    ),
    (
      v_other_option_id,
      v_other_dossier_id,
      v_other_supplier_id,
      'Other Option',
      v_user_id,
      v_user_id
    ),
    (
      v_archived_option_id,
      v_archived_dossier_id,
      v_archived_supplier_id,
      'Archived Option',
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
  )
  VALUES
    (
      v_version_id,
      v_dossier_id,
      1,
      'locked',
      3,
      1,
      now(),
      v_user_id,
      v_user_id,
      v_user_id
    ),
    (
      v_other_version_id,
      v_other_dossier_id,
      1,
      'locked',
      2,
      1,
      now(),
      v_user_id,
      v_user_id,
      v_user_id
    ),
    (
      v_archived_version_id,
      v_archived_dossier_id,
      1,
      'locked',
      2,
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
  )
  VALUES
    (v_first_group_id, v_version_id, 'First Group', 1, v_user_id, v_user_id),
    (v_second_group_id, v_version_id, 'Second Group', 2, v_user_id, v_user_id),
    (
      v_other_group_id,
      v_other_version_id,
      'Other Group',
      1,
      v_user_id,
      v_user_id
    ),
    (
      v_archived_group_id,
      v_archived_version_id,
      'Archived Group',
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
  VALUES
    (
      v_first_criterion_id,
      v_version_id,
      v_first_group_id,
      'TC-0001',
      'First criterion',
      1,
      v_user_id,
      v_user_id
    ),
    (
      v_second_criterion_id,
      v_version_id,
      v_second_group_id,
      'TC-0002',
      'Second criterion',
      1,
      v_user_id,
      v_user_id
    ),
    (
      v_other_criterion_id,
      v_other_version_id,
      v_other_group_id,
      'TC-0001',
      'Other criterion',
      1,
      v_user_id,
      v_user_id
    ),
    (
      v_archived_criterion_id,
      v_archived_version_id,
      v_archived_group_id,
      'TC-0001',
      'Archived criterion',
      1,
      v_user_id,
      v_user_id
    );

  INSERT INTO public.technical_configuration_comparison_sets (
    id,
    dossier_id,
    option_id,
    baseline_version_id,
    created_by,
    updated_by
  )
  VALUES
    (
      v_set_id,
      v_dossier_id,
      v_existing_option_id,
      v_version_id,
      v_user_id,
      v_user_id
    ),
    (
      v_archived_set_id,
      v_archived_dossier_id,
      v_archived_option_id,
      v_archived_version_id,
      v_user_id,
      v_user_id
    );

  INSERT INTO public.technical_configuration_option_responses (
    id,
    comparison_set_id,
    baseline_version_id,
    criterion_id,
    response_text,
    supplementary_information,
    created_by,
    updated_by
  )
  VALUES
    (
      v_second_response_id,
      v_set_id,
      v_version_id,
      v_second_criterion_id,
      E'Second line 1\nSecond line 2',
      E'Second doc 1\nSecond doc 2',
      v_user_id,
      v_user_id
    ),
    (
      v_first_response_id,
      v_set_id,
      v_version_id,
      v_first_criterion_id,
      E'First line 1\nFirst line 2',
      E'First doc 1\nFirst doc 2',
      v_user_id,
      v_user_id
    );

  SELECT revision, updated_at, updated_by
  INTO v_before_revision, v_before_updated_at, v_before_updated_by
  FROM public.technical_configuration_dossiers
  WHERE id = v_dossier_id;
  SELECT updated_at, updated_by
  INTO v_set_updated_at, v_set_updated_by
  FROM public.technical_configuration_comparison_sets
  WHERE id = v_set_id;
  SELECT count(*)
  INTO v_comparison_count
  FROM public.technical_configuration_comparison_sets;
  SELECT count(*)
  INTO v_response_count
  FROM public.technical_configuration_option_responses;
  SELECT jsonb_build_object(
    'id', cs.id,
    'dossier_id', cs.dossier_id,
    'option_id', cs.option_id,
    'baseline_version_id', cs.baseline_version_id,
    'created_at', cs.created_at,
    'created_by', cs.created_by,
    'updated_at', cs.updated_at,
    'updated_by', cs.updated_by,
    'revision', d.revision,
    'responses', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'comparison_set_id', r.comparison_set_id,
          'baseline_version_id', r.baseline_version_id,
          'criterion_id', r.criterion_id,
          'response_text', r.response_text,
          'supplementary_information', r.supplementary_information,
          'created_at', r.created_at,
          'created_by', r.created_by,
          'updated_at', r.updated_at,
          'updated_by', r.updated_by,
          'revision', d.revision
        )
        ORDER BY bg.sort_order, bc.sort_order, bc.id
      )
      FROM public.technical_configuration_option_responses r
      JOIN public.technical_configuration_baseline_criteria bc
        ON bc.id = r.criterion_id
       AND bc.baseline_version_id = r.baseline_version_id
      JOIN public.technical_configuration_baseline_groups bg
        ON bg.id = bc.group_id
       AND bg.baseline_version_id = bc.baseline_version_id
      WHERE r.comparison_set_id = cs.id
    )
  )
  INTO v_expected_data
  FROM public.technical_configuration_comparison_sets cs
  JOIN public.technical_configuration_dossiers d
    ON d.id = cs.dossier_id
  WHERE cs.id = v_set_id;

  -- missing claims rejected
  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error(
    'missing claims rejected',
    format(
      'SELECT public.technical_configuration_comparison_set_get(%L::UUID, %L::UUID)',
      v_missing_option_id,
      v_version_id
    ),
    '42501',
    'permission_denied'
  );

  -- malformed claims rejected
  PERFORM set_config('request.jwt.claims', '{', true);
  PERFORM pg_temp.expect_error(
    'malformed claims rejected',
    format(
      'SELECT public.technical_configuration_comparison_set_get(%L::UUID, %L::UUID)',
      v_missing_option_id,
      v_version_id
    ),
    '42501',
    'permission_denied'
  );

  -- nonnumeric user id rejected
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', 'not-a-number'
    )::TEXT,
    true
  );
  PERFORM pg_temp.expect_error(
    'nonnumeric user id rejected',
    format(
      'SELECT public.technical_configuration_comparison_set_get(%L::UUID, %L::UUID)',
      v_missing_option_id,
      v_version_id
    ),
    '42501',
    'permission_denied'
  );

  -- non-global role rejected
  PERFORM pg_temp.set_claims('to_qltb', v_user_id);
  PERFORM pg_temp.expect_error(
    'non-global role rejected',
    format(
      'SELECT public.technical_configuration_comparison_set_get(%L::UUID, %L::UUID)',
      v_missing_option_id,
      v_version_id
    ),
    '42501',
    'permission_denied'
  );

  -- cross-dossier option baseline rejected
  PERFORM pg_temp.set_claims('global', v_user_id);
  PERFORM pg_temp.expect_error(
    'cross-dossier option baseline rejected',
    format(
      'SELECT public.technical_configuration_comparison_set_get(%L::UUID, %L::UUID)',
      v_existing_option_id,
      v_other_version_id
    ),
    'PT422',
    'validation_error'
  );

  -- missing pair returns data null
  SELECT public.technical_configuration_comparison_set_get(
    v_missing_option_id,
    v_version_id
  )
  INTO v_response;
  PERFORM pg_temp.assert_true(
    'missing pair returns data null',
    v_response = '{"data": null}'::JSONB
  );
  PERFORM pg_temp.assert_true(
    'missing pair creates no comparison data',
    (SELECT count(*) FROM public.technical_configuration_comparison_sets)
      = v_comparison_count
      AND (SELECT count(*) FROM public.technical_configuration_option_responses)
        = v_response_count
  );
  PERFORM pg_temp.assert_true(
    'missing pair preserves dossier revision and audit metadata',
    (SELECT revision FROM public.technical_configuration_dossiers
     WHERE id = v_dossier_id) = v_before_revision
      AND (SELECT updated_at FROM public.technical_configuration_dossiers
           WHERE id = v_dossier_id) = v_before_updated_at
      AND (SELECT updated_by FROM public.technical_configuration_dossiers
           WHERE id = v_dossier_id) = v_before_updated_by
  );

  -- raw admin accepted
  PERFORM pg_temp.set_claims('admin', v_user_id);
  SELECT public.technical_configuration_comparison_set_get(
    v_existing_option_id,
    v_version_id
  )
  INTO v_response;
  PERFORM pg_temp.assert_true(
    'existing pair returns ordered exact multiline responses',
    (v_response->'data'->>'id')::UUID = v_set_id
      AND (v_response->'data'->'responses'->0->>'id')::UUID = v_first_response_id
      AND (v_response->'data'->'responses'->1->>'id')::UUID = v_second_response_id
      AND v_response->'data'->'responses'->0->>'response_text'
        = E'First line 1\nFirst line 2'
      AND v_response->'data'->'responses'->0->>'supplementary_information'
        = E'First doc 1\nFirst doc 2'
  );
  PERFORM pg_temp.assert_true(
    'complete existing payload matches stored snapshot',
    v_response->'data' = v_expected_data
  );
  PERFORM pg_temp.assert_true(
    'existing pair preserves dossier revision and audit metadata',
    (v_response->'data'->>'revision')::BIGINT = v_before_revision
      AND (SELECT revision FROM public.technical_configuration_dossiers
           WHERE id = v_dossier_id) = v_before_revision
      AND (SELECT updated_at FROM public.technical_configuration_dossiers
           WHERE id = v_dossier_id) = v_before_updated_at
      AND (SELECT updated_by FROM public.technical_configuration_dossiers
           WHERE id = v_dossier_id) = v_before_updated_by
      AND (SELECT updated_at FROM public.technical_configuration_comparison_sets
           WHERE id = v_set_id) = v_set_updated_at
      AND (SELECT updated_by FROM public.technical_configuration_comparison_sets
           WHERE id = v_set_id) = v_set_updated_by
  );

  -- archived existing data remains readable
  SELECT public.technical_configuration_comparison_set_get(
    v_archived_option_id,
    v_archived_version_id
  )
  INTO v_response;
  PERFORM pg_temp.assert_true(
    'archived existing data remains readable',
    (v_response->'data'->>'id')::UUID = v_archived_set_id
  );

  PERFORM pg_temp.assert_true(
    'authenticated executes read RPC',
    has_function_privilege(
      'authenticated',
      'public.technical_configuration_comparison_set_get(uuid,uuid)',
      'EXECUTE'
    )
  );
  PERFORM pg_temp.assert_true(
    'service role executes read RPC',
    has_function_privilege(
      'service_role',
      'public.technical_configuration_comparison_set_get(uuid,uuid)',
      'EXECUTE'
    )
  );
  PERFORM pg_temp.assert_true(
    'anon cannot execute read RPC',
    NOT has_function_privilege(
      'anon',
      'public.technical_configuration_comparison_set_get(uuid,uuid)',
      'EXECUTE'
    )
  );

  SELECT p.proconfig
  INTO v_function_config
  FROM pg_proc p
  WHERE p.oid =
    'public.technical_configuration_comparison_set_get(uuid,uuid)'::regprocedure;
  PERFORM pg_temp.assert_true(
    'fixed search_path',
    v_function_config = ARRAY['search_path=public, pg_temp']
  );
END;
$gate$;

-- rollback leaves zero fixture rows
ROLLBACK;
