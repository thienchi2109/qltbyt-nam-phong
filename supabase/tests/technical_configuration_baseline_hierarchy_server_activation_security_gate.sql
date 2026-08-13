-- P6A hierarchy server activation security gate. All work rolls back.
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
        p_label,
        p_expected_state,
        p_expected_message,
        v_state,
        v_message;
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

DO $gate$
DECLARE
  v_internal REGPROCEDURE := to_regprocedure(
    'public._technical_configuration_baseline_import_apply_v2(uuid,jsonb,jsonb,bigint)'
  );
  v_public REGPROCEDURE := to_regprocedure(
    'public.technical_configuration_baseline_import_apply_v2(uuid,jsonb,jsonb,bigint)'
  );
  v_definition TEXT;
  v_authoring_signature TEXT;
  v_authoring_statement TEXT;
  v_authoring_statements TEXT[];
  v_authoring REGPROCEDURE;
  v_user_id BIGINT;
BEGIN
  IF v_internal IS NULL OR v_public IS NULL THEN
    RAISE EXCEPTION 'P6A apply function contract is incomplete';
  END IF;

  SELECT pg_get_functiondef(v_public)
  INTO v_definition;
  IF v_definition NOT LIKE '%_technical_configuration_baseline_import_apply_v2(%'
     OR v_definition LIKE '%hierarchical_import_apply_not_activated%' THEN
    RAISE EXCEPTION 'public v2 apply delegation contract mismatch';
  END IF;

  IF has_function_privilege('public', v_internal, 'EXECUTE')
     OR has_function_privilege('anon', v_internal, 'EXECUTE')
     OR has_function_privilege('authenticated', v_internal, 'EXECUTE')
     OR has_function_privilege('service_role', v_internal, 'EXECUTE') THEN
    RAISE EXCEPTION 'internal v2 apply privilege contract mismatch';
  END IF;

  IF has_function_privilege('public', v_public, 'EXECUTE')
     OR has_function_privilege('anon', v_public, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_public, 'EXECUTE')
     OR has_function_privilege('service_role', v_public, 'EXECUTE') THEN
    RAISE EXCEPTION 'public v2 apply privilege contract mismatch';
  END IF;

  FOREACH v_authoring_signature IN ARRAY ARRAY[
    'public.technical_configuration_baseline_subgroup_create(uuid,text,bigint)',
    'public.technical_configuration_baseline_subgroup_update(uuid,text,bigint)',
    'public.technical_configuration_baseline_subgroup_delete(uuid,bigint)',
    'public.technical_configuration_baseline_subgroups_reorder(uuid,uuid[],bigint)',
    'public.technical_configuration_baseline_hierarchy_criterion_create(uuid,uuid,text,text,bigint)',
    'public.technical_configuration_baseline_hierarchy_criterion_move(uuid,uuid,uuid,bigint)',
    'public.technical_configuration_baseline_hierarchy_criteria_reorder(uuid,uuid,uuid[],bigint)'
  ]
  LOOP
    v_authoring := to_regprocedure(v_authoring_signature);
    IF v_authoring IS NULL
       OR has_function_privilege('public', v_authoring, 'EXECUTE')
       OR has_function_privilege('anon', v_authoring, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_authoring, 'EXECUTE')
       OR has_function_privilege('service_role', v_authoring, 'EXECUTE') THEN
      RAISE EXCEPTION 'hierarchy authoring privilege contract mismatch: %',
        v_authoring_signature;
    END IF;
  END LOOP;

  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P6A activation gate requires one active public.nhan_vien row';
  END IF;

  SET LOCAL ROLE authenticated;
  IF current_user <> 'authenticated' THEN
    RAISE EXCEPTION 'P6A activation gate failed to assume authenticated role';
  END IF;

  v_authoring_statements := ARRAY[
    format(
      'SELECT public.technical_configuration_baseline_subgroup_create(%L::UUID, %L, 1)',
      gen_random_uuid(),
      'P6A subgroup'
    ),
    format(
      'SELECT public.technical_configuration_baseline_subgroup_update(%L::UUID, %L, 1)',
      gen_random_uuid(),
      'P6A subgroup'
    ),
    format(
      'SELECT public.technical_configuration_baseline_subgroup_delete(%L::UUID, 1)',
      gen_random_uuid()
    ),
    format(
      'SELECT public.technical_configuration_baseline_subgroups_reorder(%L::UUID, %L::UUID[], 1)',
      gen_random_uuid(),
      '{}'
    ),
    format(
      'SELECT public.technical_configuration_baseline_hierarchy_criterion_create(%L::UUID, NULL::UUID, %L, %L, 1)',
      gen_random_uuid(),
      'P6A criterion',
      'P6A requirement'
    ),
    format(
      'SELECT public.technical_configuration_baseline_hierarchy_criterion_move(%L::UUID, %L::UUID, NULL::UUID, 1)',
      gen_random_uuid(),
      gen_random_uuid()
    ),
    format(
      'SELECT public.technical_configuration_baseline_hierarchy_criteria_reorder(%L::UUID, NULL::UUID, %L::UUID[], 1)',
      gen_random_uuid(),
      '{}'
    )
  ];

  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error(
    'public v2 apply missing claims rejected',
    format(
      'SELECT public.technical_configuration_baseline_import_apply_v2(%L::UUID, %L::JSONB, %L::JSONB, 1)',
      gen_random_uuid(),
      '{}'::JSONB::TEXT,
      '[]'::JSONB::TEXT
    ),
    '42501',
    'permission_denied'
  );

  FOREACH v_authoring_statement IN ARRAY v_authoring_statements
  LOOP
    PERFORM pg_temp.expect_error(
      'hierarchy authoring missing claims rejected',
      v_authoring_statement,
      '42501',
      'permission_denied'
    );
  END LOOP;

  PERFORM pg_temp.set_claims('to_qltb', v_user_id);
  FOREACH v_authoring_statement IN ARRAY v_authoring_statements
  LOOP
    PERFORM pg_temp.expect_error(
      'hierarchy authoring non-global role rejected',
      v_authoring_statement,
      '42501',
      'permission_denied'
    );
  END LOOP;

  PERFORM pg_temp.set_claims('admin', v_user_id);
  PERFORM pg_temp.expect_error(
    'public v2 apply delegates to editable version guard',
    format(
      'SELECT public.technical_configuration_baseline_import_apply_v2(%L::UUID, %L::JSONB, %L::JSONB, 1)',
      gen_random_uuid(),
      '{}'::JSONB::TEXT,
      '[]'::JSONB::TEXT
    ),
    'PT404',
    'not_found'
  );

  FOREACH v_authoring_statement IN ARRAY v_authoring_statements
  LOOP
    PERFORM pg_temp.expect_error(
      'hierarchy authoring admin reaches target guard',
      v_authoring_statement,
      'PT404',
      'not_found'
    );
  END LOOP;
END;
$gate$;

ROLLBACK;
