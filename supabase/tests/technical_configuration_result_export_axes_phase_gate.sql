-- P14A4 rollback-only ACL, authorization and ordered-axis runtime gate.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(p_label TEXT, p_condition BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $gate$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN RAISE EXCEPTION '%', p_label; END IF;
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
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
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

CREATE FUNCTION pg_temp.has_exact_keys(p_value JSONB, p_keys TEXT[])
RETURNS BOOLEAN LANGUAGE sql AS $gate$
  SELECT COALESCE((
    SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(p_value) AS key
  ), ARRAY[]::TEXT[]) = (
    SELECT array_agg(expected_key ORDER BY expected_key) FROM unnest(p_keys) AS expected_key
  );
$gate$;

CREATE FUNCTION pg_temp.fixture_counts(p_dossier_ids UUID[], p_version_ids UUID[])
RETURNS JSONB LANGUAGE sql AS $gate$
  SELECT jsonb_build_object(
    'dossiers', (
      SELECT count(*) FROM public.technical_configuration_dossiers WHERE id = ANY(p_dossier_ids)
    ),
    'versions', (
      SELECT count(*) FROM public.technical_configuration_baseline_versions WHERE id = ANY(p_version_ids)
    ),
    'groups', (
      SELECT count(*) FROM public.technical_configuration_baseline_groups WHERE baseline_version_id = ANY(p_version_ids)
    ),
    'criteria', (
      SELECT count(*) FROM public.technical_configuration_baseline_criteria WHERE baseline_version_id = ANY(p_version_ids)
    ),
    'suppliers', (
      SELECT count(*) FROM public.technical_configuration_suppliers WHERE dossier_id = ANY(p_dossier_ids)
    ),
    'options', (
      SELECT count(*) FROM public.technical_configuration_options WHERE dossier_id = ANY(p_dossier_ids)
    )
  );
$gate$;

DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_locked_at TIMESTAMPTZ := clock_timestamp();
  v_user_id BIGINT;
  v_dossier_with_options_id UUID := gen_random_uuid();
  v_dossier_without_options_id UUID := gen_random_uuid();
  v_normal_version_id UUID := gen_random_uuid();
  v_no_criteria_version_id UUID := gen_random_uuid();
  v_one_criterion_version_id UUID := gen_random_uuid();
  v_empty_version_id UUID := gen_random_uuid();
  v_normal_group_id UUID := gen_random_uuid();
  v_single_group_id UUID := gen_random_uuid();
  v_criterion_a_id UUID := gen_random_uuid();
  v_criterion_b_id UUID := gen_random_uuid();
  v_criterion_only_id UUID := gen_random_uuid();
  v_supplier_a_id UUID := gen_random_uuid();
  v_supplier_b_id UUID := gen_random_uuid();
  v_option_a_id UUID := gen_random_uuid();
  v_option_b_id UUID := gen_random_uuid();
  v_option_signature TEXT := 'public.technical_configuration_result_export_option_axis_list(uuid,uuid,uuid[],uuid[],integer,integer)';
  v_criterion_signature TEXT := 'public.technical_configuration_result_export_criterion_axis_list(uuid,uuid,uuid[],uuid[],integer,integer)';
  v_dossier_ids UUID[];
  v_version_ids UUID[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('technical_configuration_result_export_axes_phase_gate'));

  SELECT nv.id INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P14A4 phase gate requires one active public.nhan_vien row';
  END IF;

  PERFORM pg_temp.assert_true(
    'axis function metadata',
    (
      SELECT count(*) = 2
        AND bool_and(proc.provolatile = 's')
        AND bool_and(proc.prosecdef)
        AND bool_and(proc.proconfig @> ARRAY['search_path=public, pg_temp'])
      FROM pg_proc proc
      WHERE proc.oid IN (
        v_option_signature::regprocedure,
        v_criterion_signature::regprocedure
      )
    )
  );
  PERFORM pg_temp.assert_true(
    'axis ACLs are least privilege',
    NOT has_function_privilege('public', v_option_signature, 'EXECUTE')
    AND NOT has_function_privilege('anon', v_option_signature, 'EXECUTE')
    AND has_function_privilege('authenticated', v_option_signature, 'EXECUTE')
    AND has_function_privilege('service_role', v_option_signature, 'EXECUTE')
    AND NOT has_function_privilege('public', v_criterion_signature, 'EXECUTE')
    AND NOT has_function_privilege('anon', v_criterion_signature, 'EXECUTE')
    AND has_function_privilege('authenticated', v_criterion_signature, 'EXECUTE')
    AND has_function_privilege('service_role', v_criterion_signature, 'EXECUTE')
  );

  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, created_by, updated_by
  ) VALUES
    (
      v_dossier_with_options_id,
      'P14A4 options device ' || v_suffix,
      'P14A4 options dossier ' || v_suffix,
      v_user_id,
      v_user_id
    ),
    (
      v_dossier_without_options_id,
      'P14A4 empty device ' || v_suffix,
      'P14A4 empty dossier ' || v_suffix,
      v_user_id,
      v_user_id
    );
  INSERT INTO public.technical_configuration_baseline_versions (
    id, dossier_id, version_number, status, locked_at, locked_by,
    next_criterion_number, revision, created_by, updated_by
  ) VALUES
    (
      v_normal_version_id, v_dossier_with_options_id, 1, 'draft', NULL, NULL,
      3, 1, v_user_id, v_user_id
    ),
    (
      v_no_criteria_version_id, v_dossier_with_options_id, 2, 'locked',
      v_locked_at, v_user_id, 1, 1, v_user_id, v_user_id
    ),
    (
      v_one_criterion_version_id, v_dossier_without_options_id, 1, 'draft',
      NULL, NULL, 2, 1, v_user_id, v_user_id
    ),
    (
      v_empty_version_id, v_dossier_without_options_id, 2, 'locked',
      v_locked_at, v_user_id, 1, 1, v_user_id, v_user_id
    );
  INSERT INTO public.technical_configuration_baseline_groups (
    id, baseline_version_id, name, sort_order, created_by, updated_by
  ) VALUES
    (
      v_normal_group_id, v_normal_version_id, 'P14A4 Normal Group', 1,
      v_user_id, v_user_id
    ),
    (
      v_single_group_id, v_one_criterion_version_id, 'P14A4 Single Group', 1,
      v_user_id, v_user_id
    );
  INSERT INTO public.technical_configuration_baseline_criteria (
    id, baseline_version_id, group_id, criterion_code, title, requirement_text,
    sort_order, created_by, updated_by
  ) VALUES
    (
      v_criterion_a_id, v_normal_version_id, v_normal_group_id, 'TC-0001',
      'Criterion A', 'Requirement A', 1, v_user_id, v_user_id
    ),
    (
      v_criterion_b_id, v_normal_version_id, v_normal_group_id, 'TC-0002',
      'Criterion B', 'Requirement B', 2, v_user_id, v_user_id
    ),
    (
      v_criterion_only_id, v_one_criterion_version_id, v_single_group_id, 'TC-0001',
      'Criterion Only', 'Requirement Only', 1, v_user_id, v_user_id
    );
  INSERT INTO public.technical_configuration_suppliers (
    id, dossier_id, name, created_by, updated_by
  ) VALUES
    (
      v_supplier_a_id, v_dossier_with_options_id, 'A Supplier',
      v_user_id, v_user_id
    ),
    (
      v_supplier_b_id, v_dossier_with_options_id, 'B Supplier',
      v_user_id, v_user_id
    );
  INSERT INTO public.technical_configuration_options (
    id, dossier_id, supplier_id, model, manufacturer, option_name,
    created_by, updated_by
  ) VALUES
    (
      v_option_a_id, v_dossier_with_options_id, v_supplier_a_id,
      'Model A', 'Maker A', 'Option A', v_user_id, v_user_id
    ),
    (
      v_option_b_id, v_dossier_with_options_id, v_supplier_b_id,
      'Model B', 'Maker B', 'Option B', v_user_id, v_user_id
    );

  v_dossier_ids := ARRAY[v_dossier_with_options_id, v_dossier_without_options_id];
  v_version_ids := ARRAY[v_normal_version_id, v_no_criteria_version_id,
    v_one_criterion_version_id, v_empty_version_id];
  PERFORM set_config('p14a4.user_id', v_user_id::TEXT, true);
  PERFORM set_config('p14a4.dossier_with_options_id', v_dossier_with_options_id::TEXT, true);
  PERFORM set_config('p14a4.dossier_without_options_id', v_dossier_without_options_id::TEXT, true);
  PERFORM set_config('p14a4.normal_version_id', v_normal_version_id::TEXT, true);
  PERFORM set_config('p14a4.no_criteria_version_id', v_no_criteria_version_id::TEXT, true);
  PERFORM set_config('p14a4.one_criterion_version_id', v_one_criterion_version_id::TEXT, true);
  PERFORM set_config('p14a4.empty_version_id', v_empty_version_id::TEXT, true);
  PERFORM set_config('p14a4.criterion_a_id', v_criterion_a_id::TEXT, true);
  PERFORM set_config('p14a4.criterion_b_id', v_criterion_b_id::TEXT, true);
  PERFORM set_config('p14a4.criterion_only_id', v_criterion_only_id::TEXT, true);
  PERFORM set_config('p14a4.option_a_id', v_option_a_id::TEXT, true);
  PERFORM set_config('p14a4.option_b_id', v_option_b_id::TEXT, true);
  PERFORM set_config('p14a4.before',
    pg_temp.fixture_counts(v_dossier_ids, v_version_ids)::TEXT, true);
END;
$gate$;

SET LOCAL ROLE authenticated;

DO $gate$
DECLARE
  v_user_id BIGINT := current_setting('p14a4.user_id')::BIGINT;
  v_dossier_with_options_id UUID := current_setting('p14a4.dossier_with_options_id')::UUID;
  v_dossier_without_options_id UUID := current_setting('p14a4.dossier_without_options_id')::UUID;
  v_normal_version_id UUID := current_setting('p14a4.normal_version_id')::UUID;
  v_no_criteria_version_id UUID := current_setting('p14a4.no_criteria_version_id')::UUID;
  v_one_criterion_version_id UUID := current_setting('p14a4.one_criterion_version_id')::UUID;
  v_empty_version_id UUID := current_setting('p14a4.empty_version_id')::UUID;
  v_criterion_a_id UUID := current_setting('p14a4.criterion_a_id')::UUID;
  v_criterion_b_id UUID := current_setting('p14a4.criterion_b_id')::UUID;
  v_criterion_only_id UUID := current_setting('p14a4.criterion_only_id')::UUID;
  v_option_a_id UUID := current_setting('p14a4.option_a_id')::UUID;
  v_option_b_id UUID := current_setting('p14a4.option_b_id')::UUID;
  v_option_axis JSONB;
  v_criterion_axis JSONB;
  v_option_empty JSONB;
  v_criterion_empty JSONB;
  v_response_keys TEXT[] := ARRAY[
    'baseline_version_id', 'data', 'dossier_id', 'page', 'page_size',
    'ranking_snapshot_token', 'snapshot_token', 'total'
  ];
BEGIN
  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error(
    'missing claims rejected',
    format(
      'SELECT public.technical_configuration_result_export_option_axis_list(%L,%L,NULL,NULL,1,100)',
      v_dossier_with_options_id, v_normal_version_id
    ),
    '42501', 'permission_denied'
  );
  PERFORM pg_temp.set_claims('user', v_user_id);
  PERFORM pg_temp.expect_error(
    'denied role rejected',
    format(
      'SELECT public.technical_configuration_result_export_criterion_axis_list(%L,%L,NULL,NULL,1,100)',
      v_dossier_with_options_id, v_normal_version_id
    ),
    '42501', 'permission_denied'
  );
  PERFORM pg_temp.set_claims('global', v_user_id);
  PERFORM pg_temp.expect_error(
    'option page bounds rejected',
    format(
      'SELECT public.technical_configuration_result_export_option_axis_list(%L,%L,NULL,NULL,1,101)',
      v_dossier_with_options_id, v_normal_version_id
    ),
    'PT422', 'validation_error'
  );
  PERFORM pg_temp.expect_error(
    'criterion page bounds rejected',
    format(
      'SELECT public.technical_configuration_result_export_criterion_axis_list(%L,%L,NULL,NULL,0,100)',
      v_dossier_with_options_id, v_normal_version_id
    ),
    'PT422', 'validation_error'
  );

  PERFORM pg_temp.set_claims('admin', v_user_id);
  SELECT public.technical_configuration_result_export_option_axis_list(
    v_dossier_with_options_id,
    v_normal_version_id,
    ARRAY[v_option_b_id, v_option_a_id],
    ARRAY[v_criterion_b_id, v_criterion_a_id],
    1,
    100
  ) INTO v_option_axis;
  PERFORM pg_temp.assert_true(
    'raw admin preserves requested option order',
    v_option_axis->>'total' = '2'
    AND v_option_axis->'data'->0->>'option_id' = v_option_b_id::TEXT
    AND v_option_axis->'data'->1->>'option_id' = v_option_a_id::TEXT
  );

  PERFORM pg_temp.set_claims('global', v_user_id);
  SELECT public.technical_configuration_result_export_criterion_axis_list(
    v_dossier_with_options_id,
    v_normal_version_id,
    ARRAY[v_option_b_id, v_option_a_id],
    ARRAY[v_criterion_b_id, v_criterion_a_id],
    1,
    100
  ) INTO v_criterion_axis;
  PERFORM pg_temp.assert_true(
    'normal 2 x 2 axes keep exact envelopes descriptors and tokens',
    pg_temp.has_exact_keys(v_option_axis, v_response_keys)
    AND pg_temp.has_exact_keys(v_criterion_axis, v_response_keys)
    AND pg_temp.has_exact_keys(
      v_option_axis->'data'->0,
      ARRAY[
        'display_label', 'manufacturer', 'model', 'option_id', 'option_name',
        'supplier_id', 'supplier_name'
      ]
    )
    AND pg_temp.has_exact_keys(
      v_criterion_axis->'data'->0,
      ARRAY[
        'criterion_code', 'criterion_id', 'criterion_order', 'criterion_title',
        'group_id', 'group_name', 'group_order', 'requirement_text'
      ]
    )
    AND v_option_axis->>'dossier_id' = v_dossier_with_options_id::TEXT
    AND v_option_axis->>'baseline_version_id' = v_normal_version_id::TEXT
    AND v_option_axis->>'page' = '1'
    AND v_option_axis->>'page_size' = '100'
    AND v_criterion_axis->>'total' = '2'
    AND v_criterion_axis->'data'->0->>'criterion_id' = v_criterion_b_id::TEXT
    AND v_criterion_axis->'data'->1->>'criterion_id' = v_criterion_a_id::TEXT
    AND v_option_axis->>'snapshot_token' = v_criterion_axis->>'snapshot_token'
    AND v_option_axis->>'ranking_snapshot_token' =
      v_criterion_axis->>'ranking_snapshot_token'
  );

  SELECT public.technical_configuration_result_export_option_axis_list(
    v_dossier_with_options_id,
    v_no_criteria_version_id,
    ARRAY[v_option_a_id],
    NULL,
    1,
    100
  ) INTO v_option_axis;
  SELECT public.technical_configuration_result_export_criterion_axis_list(
    v_dossier_with_options_id,
    v_no_criteria_version_id,
    ARRAY[v_option_a_id],
    NULL,
    1,
    100
  ) INTO v_criterion_empty;
  PERFORM pg_temp.assert_true(
    '1 x 0 preserves the option axis',
    v_option_axis->>'total' = '1'
    AND jsonb_array_length(v_option_axis->'data') = 1
    AND v_criterion_empty->>'total' = '0'
    AND v_criterion_empty->'data' = '[]'::JSONB
    AND v_option_axis->>'snapshot_token' = v_criterion_empty->>'snapshot_token'
  );

  SELECT public.technical_configuration_result_export_option_axis_list(
    v_dossier_without_options_id, v_one_criterion_version_id,
    NULL, ARRAY[v_criterion_only_id], 1, 100
  ) INTO v_option_empty;
  SELECT public.technical_configuration_result_export_criterion_axis_list(
    v_dossier_without_options_id, v_one_criterion_version_id,
    NULL, ARRAY[v_criterion_only_id], 1, 100
  ) INTO v_criterion_axis;
  PERFORM pg_temp.assert_true(
    '0 x 1 preserves the criterion axis',
    v_option_empty->>'total' = '0'
    AND v_option_empty->'data' = '[]'::JSONB
    AND v_criterion_axis->>'total' = '1'
    AND jsonb_array_length(v_criterion_axis->'data') = 1
    AND v_option_empty->>'snapshot_token' = v_criterion_axis->>'snapshot_token'
  );

  SELECT public.technical_configuration_result_export_option_axis_list(
    v_dossier_without_options_id, v_empty_version_id, NULL, NULL, 1, 100
  ) INTO v_option_empty;
  SELECT public.technical_configuration_result_export_criterion_axis_list(
    v_dossier_without_options_id, v_empty_version_id, NULL, NULL, 1, 100
  ) INTO v_criterion_empty;
  PERFORM pg_temp.assert_true(
    '0 x 0 preserves two empty independent axes',
    v_option_empty->>'total' = '0'
    AND v_option_empty->'data' = '[]'::JSONB
    AND v_criterion_empty->>'total' = '0'
    AND v_criterion_empty->'data' = '[]'::JSONB
    AND v_option_empty->>'snapshot_token' = v_criterion_empty->>'snapshot_token'
  );
END;
$gate$;

RESET ROLE;

DO $gate$
DECLARE
  v_dossier_ids UUID[] := ARRAY[
    current_setting('p14a4.dossier_with_options_id')::UUID, current_setting('p14a4.dossier_without_options_id')::UUID
  ];
  v_version_ids UUID[] := ARRAY[
    current_setting('p14a4.normal_version_id')::UUID, current_setting('p14a4.no_criteria_version_id')::UUID,
    current_setting('p14a4.one_criterion_version_id')::UUID,
    current_setting('p14a4.empty_version_id')::UUID
  ];
BEGIN
  PERFORM pg_temp.assert_true(
    'ordered axis RPCs remain read-only',
    current_setting('p14a4.before')::JSONB =
      pg_temp.fixture_counts(v_dossier_ids, v_version_ids)
  );
END;
$gate$;

ROLLBACK;
