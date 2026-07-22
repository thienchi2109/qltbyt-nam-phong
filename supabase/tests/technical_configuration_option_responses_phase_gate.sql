-- P8A3 rollback-only exact-baseline response, revision, cascade, and grant gate.
BEGIN;
CREATE FUNCTION pg_temp.expect_error(
  p_label TEXT, p_statement TEXT, p_expected_state TEXT, p_expected_message TEXT
)
RETURNS VOID LANGUAGE plpgsql
AS $gate$
DECLARE
  v_state TEXT; v_message TEXT;
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION
    WHEN OTHERS THEN
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
RETURNS VOID LANGUAGE plpgsql
AS $gate$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', p_app_role, 'role', 'authenticated',
      'user_id', p_user_id::TEXT, 'sub', p_user_id::TEXT
    )::TEXT,
    true
  );
END;
$gate$;
CREATE FUNCTION pg_temp.assert_true(p_label TEXT, p_condition BOOLEAN)
RETURNS VOID LANGUAGE plpgsql
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
  v_dossier_id UUID := gen_random_uuid(); v_other_dossier_id UUID := gen_random_uuid();
  v_archived_dossier_id UUID := gen_random_uuid();
  v_supplier_id UUID := gen_random_uuid(); v_other_supplier_id UUID := gen_random_uuid();
  v_archived_supplier_id UUID := gen_random_uuid();
  v_option_id UUID := gen_random_uuid(); v_stale_option_id UUID := gen_random_uuid();
  v_other_option_id UUID := gen_random_uuid();
  v_archived_option_id UUID := gen_random_uuid();
  v_archived_missing_option_id UUID := gen_random_uuid();
  v_version_id UUID := gen_random_uuid(); v_other_version_id UUID := gen_random_uuid();
  v_archived_version_id UUID := gen_random_uuid();
  v_group_id UUID := gen_random_uuid(); v_other_group_id UUID := gen_random_uuid();
  v_archived_group_id UUID := gen_random_uuid();
  v_criterion_id UUID := gen_random_uuid();
  v_second_criterion_id UUID := gen_random_uuid();
  v_other_criterion_id UUID := gen_random_uuid();
  v_archived_criterion_id UUID := gen_random_uuid();
  v_set_id UUID; v_archived_set_id UUID := gen_random_uuid(); v_response_id UUID;
  v_copy_version_id UUID; v_copy_criterion_id UUID; v_copy_set_id UUID;
  v_revision BIGINT; v_before_revision BIGINT; v_count BIGINT;
  v_created_at TIMESTAMPTZ; v_created_by BIGINT; v_updated_at TIMESTAMPTZ;
  v_response JSONB; v_second_response JSONB; v_definition TEXT;
  v_function_signature TEXT; v_table_name TEXT; v_table_privilege TEXT;
  v_rls_enabled BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_option_responses_phase_gate')
  );
  SELECT nv.id INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P8A3 phase gate requires one active public.nhan_vien row';
  END IF;
  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, archived_at, archived_by, created_by, updated_by
  ) VALUES
    (v_dossier_id, 'P8A3 device ' || v_suffix, 'P8A3 dossier ' || v_suffix,
      NULL, NULL, v_user_id, v_user_id),
    (v_other_dossier_id, 'P8A3 other device ' || v_suffix,
      'P8A3 other dossier ' || v_suffix, NULL, NULL, v_user_id, v_user_id),
    (v_archived_dossier_id, 'P8A3 archived device ' || v_suffix,
      'P8A3 archived dossier ' || v_suffix, now(), v_user_id, v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_suppliers (
    id, dossier_id, name, created_by, updated_by
  ) VALUES
    (v_supplier_id, v_dossier_id, 'P8A3 Supplier', v_user_id, v_user_id),
    (v_other_supplier_id, v_other_dossier_id, 'P8A3 Other Supplier',
      v_user_id, v_user_id),
    (v_archived_supplier_id, v_archived_dossier_id, 'P8A3 Archived Supplier',
      v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_options (
    id, dossier_id, supplier_id, option_name, created_by, updated_by
  ) VALUES
    (v_option_id, v_dossier_id, v_supplier_id, 'Main Option', v_user_id, v_user_id),
    (v_stale_option_id, v_dossier_id, v_supplier_id, 'Stale Option',
      v_user_id, v_user_id),
    (v_other_option_id, v_other_dossier_id, v_other_supplier_id, 'Other Option',
      v_user_id, v_user_id),
    (v_archived_option_id, v_archived_dossier_id, v_archived_supplier_id,
      'Archived Option', v_user_id, v_user_id),
    (v_archived_missing_option_id, v_archived_dossier_id, v_archived_supplier_id,
      'Archived Missing Option', v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_baseline_versions (
    id, dossier_id, version_number, status, next_criterion_number, revision,
    locked_at, locked_by, created_by, updated_by
  ) VALUES
    (v_version_id, v_dossier_id, 1, 'locked', 3, 1, now(), v_user_id,
      v_user_id, v_user_id),
    (v_other_version_id, v_other_dossier_id, 1, 'locked', 2, 1, now(), v_user_id,
      v_user_id, v_user_id),
    (v_archived_version_id, v_archived_dossier_id, 1, 'locked', 2, 1, now(),
      v_user_id, v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_baseline_groups (
    id, baseline_version_id, name, sort_order, created_by, updated_by
  ) VALUES
    (v_group_id, v_version_id, 'Main Group', 1, v_user_id, v_user_id),
    (v_other_group_id, v_other_version_id, 'Other Group', 1, v_user_id, v_user_id),
    (v_archived_group_id, v_archived_version_id, 'Archived Group', 1,
      v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_baseline_criteria (
    id, baseline_version_id, group_id, criterion_code, requirement_text,
    sort_order, created_by, updated_by
  ) VALUES
    (v_criterion_id, v_version_id, v_group_id, 'TC-0001', 'Main criterion',
      1, v_user_id, v_user_id),
    (v_second_criterion_id, v_version_id, v_group_id, 'TC-0002',
      'Second criterion', 2, v_user_id, v_user_id),
    (v_other_criterion_id, v_other_version_id, v_other_group_id, 'TC-0001',
      'Other criterion', 1, v_user_id, v_user_id),
    (v_archived_criterion_id, v_archived_version_id, v_archived_group_id,
      'TC-0001', 'Archived criterion', 1, v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_comparison_sets (
    id, dossier_id, option_id, baseline_version_id, created_by, updated_by
  ) VALUES (
    v_archived_set_id, v_archived_dossier_id, v_archived_option_id,
    v_archived_version_id, v_user_id, v_user_id
  );
  -- missing claims rejected
  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error('missing claims rejected', format(
    'SELECT public.technical_configuration_comparison_set_get_or_create(%L::UUID, %L::UUID, 1)',
    v_option_id, v_version_id), '42501', 'permission_denied');
  -- non-global role rejected
  PERFORM pg_temp.set_claims('to_qltb', v_user_id);
  PERFORM pg_temp.expect_error('non-global role rejected', format(
    'SELECT public.technical_configuration_comparison_set_get_or_create(%L::UUID, %L::UUID, 1)',
    v_option_id, v_version_id), '42501', 'permission_denied');
  -- cross-dossier option baseline rejected
  PERFORM pg_temp.set_claims('global', v_user_id);
  PERFORM pg_temp.expect_error('cross-dossier option baseline rejected', format(
    'SELECT public.technical_configuration_comparison_set_get_or_create(%L::UUID, %L::UUID, 1)',
    v_option_id, v_other_version_id), 'PT422', 'validation_error');
  -- raw admin accepted
  -- locked baseline accepts comparison responses
  PERFORM pg_temp.set_claims('admin', v_user_id);
  SELECT public.technical_configuration_comparison_set_get_or_create(
    v_option_id, v_version_id, 1
  )
  INTO v_response;
  v_set_id := (v_response->'data'->>'id')::UUID;
  SELECT revision INTO v_revision
  FROM public.technical_configuration_dossiers
  WHERE id = v_dossier_id;
  PERFORM pg_temp.assert_true(
    'missing set increments dossier revision exactly once',
    v_revision = 2 AND (v_response->'data'->>'revision')::BIGINT = 2
  );
  SELECT created_at, created_by, updated_at
  INTO v_created_at, v_created_by, v_updated_at
  FROM public.technical_configuration_comparison_sets
  WHERE id = v_set_id;
  PERFORM pg_temp.assert_true(
    'comparison set create audit metadata',
    v_created_by = v_user_id AND v_created_at = v_updated_at
  );
  -- existing set ignores stale revision
  SELECT public.technical_configuration_comparison_set_get_or_create(
    v_option_id, v_version_id, -1
  )
  INTO v_second_response;
  PERFORM pg_temp.assert_true(
    'existing set ignores stale revision',
    (v_second_response->'data'->>'id')::UUID = v_set_id
      AND (v_second_response->'data'->>'revision')::BIGINT = 2
      AND (SELECT revision FROM public.technical_configuration_dossiers
           WHERE id = v_dossier_id) = 2
      AND (SELECT created_at FROM public.technical_configuration_comparison_sets
           WHERE id = v_set_id) = v_created_at
      AND (SELECT updated_at FROM public.technical_configuration_comparison_sets
           WHERE id = v_set_id) = v_updated_at
  );
  -- exact baseline criterion enforced
  PERFORM pg_temp.set_claims('global', v_user_id);
  PERFORM pg_temp.expect_error('exact baseline criterion enforced', format(
    'SELECT public.technical_configuration_option_response_upsert(%L::UUID, %L::UUID, %L, %L, 2)',
    v_set_id, v_other_criterion_id, 'bad', 'bad'), 'PT422', 'validation_error');
  -- multiline response and supplementary information preserved
  SELECT public.technical_configuration_option_response_upsert(
    v_set_id, v_criterion_id, E'Line 1\nLine 2', E'Doc A\nDoc B', 2
  )
  INTO v_response;
  v_response_id := (v_response->'data'->>'id')::UUID;
  PERFORM pg_temp.assert_true(
    'response upsert increments dossier revision exactly once',
    (v_response->'data'->>'revision')::BIGINT = 3
      AND (SELECT revision FROM public.technical_configuration_dossiers
           WHERE id = v_dossier_id) = 3
  );
  PERFORM pg_temp.assert_true(
    'multiline response and supplementary information preserved',
    v_response->'data'->>'response_text' = E'Line 1\nLine 2'
      AND v_response->'data'->>'supplementary_information' = E'Doc A\nDoc B'
  );
  SELECT created_at, created_by INTO v_created_at, v_created_by
  FROM public.technical_configuration_option_responses
  WHERE id = v_response_id;
  UPDATE public.technical_configuration_option_responses
  SET updated_at = now() - interval '1 minute'
  WHERE id = v_response_id;
  -- full replacement preserves resent field
  -- response update preserves creation audit
  SELECT public.technical_configuration_option_response_upsert(
    v_set_id, v_criterion_id, E'Line 1\nLine 2', 'Doc C', 3
  )
  INTO v_response;
  PERFORM pg_temp.assert_true(
    'full replacement preserves resent field',
    v_response->'data'->>'response_text' = E'Line 1\nLine 2'
      AND v_response->'data'->>'supplementary_information' = 'Doc C'
      AND (SELECT revision FROM public.technical_configuration_dossiers
           WHERE id = v_dossier_id) = 4
  );
  PERFORM pg_temp.assert_true(
    'response update preserves creation audit',
    (SELECT created_at FROM public.technical_configuration_option_responses
     WHERE id = v_response_id) = v_created_at
      AND (SELECT created_by FROM public.technical_configuration_option_responses
           WHERE id = v_response_id) = v_created_by
      AND (SELECT updated_by FROM public.technical_configuration_option_responses
           WHERE id = v_response_id) = v_user_id
      AND (SELECT updated_at FROM public.technical_configuration_option_responses
           WHERE id = v_response_id) > now() - interval '1 minute'
  );
  SELECT public.technical_configuration_option_response_upsert(
    v_set_id, v_second_criterion_id, NULL, NULL, 4
  )
  INTO v_second_response;
  PERFORM pg_temp.assert_true(
    'SQL null response values become empty strings',
    v_second_response->'data'->>'response_text' = ''
      AND v_second_response->'data'->>'supplementary_information' = ''
  );
  -- stale create leaves no partial row
  SELECT revision INTO v_before_revision
  FROM public.technical_configuration_dossiers
  WHERE id = v_dossier_id;
  PERFORM pg_temp.expect_error('stale create leaves no partial row', format(
    'SELECT public.technical_configuration_comparison_set_get_or_create(%L::UUID, %L::UUID, %s)',
    v_stale_option_id, v_version_id, v_before_revision - 1),
    'PT409', 'stale_revision');
  PERFORM pg_temp.assert_true(
    'stale create leaves no partial row',
    NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_comparison_sets
      WHERE option_id = v_stale_option_id AND baseline_version_id = v_version_id
    ) AND (SELECT revision FROM public.technical_configuration_dossiers
           WHERE id = v_dossier_id) = v_before_revision
  );
  -- stale upsert leaves response unchanged
  PERFORM pg_temp.expect_error('stale upsert leaves response unchanged', format(
    'SELECT public.technical_configuration_option_response_upsert(%L::UUID, %L::UUID, %L, %L, %s)',
    v_set_id, v_criterion_id, 'changed', 'changed', v_before_revision - 1),
    'PT409', 'stale_revision');
  PERFORM pg_temp.assert_true(
    'stale upsert leaves response and dossier revision unchanged',
    (SELECT response_text FROM public.technical_configuration_option_responses
     WHERE id = v_response_id) = E'Line 1\nLine 2'
      AND (SELECT supplementary_information
           FROM public.technical_configuration_option_responses
           WHERE id = v_response_id) = 'Doc C'
      AND (SELECT revision FROM public.technical_configuration_dossiers
           WHERE id = v_dossier_id) = v_before_revision
  );
  -- archived existing set remains readable
  SELECT public.technical_configuration_comparison_set_get_or_create(
    v_archived_option_id, v_archived_version_id, -1
  )
  INTO v_response;
  PERFORM pg_temp.assert_true(
    'archived existing set remains readable',
    (v_response->'data'->>'id')::UUID = v_archived_set_id
  );
  PERFORM pg_temp.expect_error('archived missing set rejected', format(
    'SELECT public.technical_configuration_comparison_set_get_or_create(%L::UUID, %L::UUID, 1)',
    v_archived_missing_option_id, v_archived_version_id),
    'PT409', 'archived_dossier');
  PERFORM pg_temp.expect_error('archived response upsert rejected', format(
    'SELECT public.technical_configuration_option_response_upsert(%L::UUID, %L::UUID, %L, %L, 1)',
    v_archived_set_id, v_archived_criterion_id, 'blocked', 'blocked'),
    'PT409', 'archived_dossier');
  -- baseline copy excludes comparison data
  SELECT public.technical_configuration_baseline_copy(v_version_id, 1)
  INTO v_response;
  v_copy_version_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'dossier_revision')::BIGINT;
  SELECT id INTO v_copy_criterion_id
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_copy_version_id
    AND source_criterion_id = v_criterion_id;
  PERFORM pg_temp.assert_true(
    'baseline copy excludes comparison data',
    NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_comparison_sets
      WHERE baseline_version_id = v_copy_version_id
    ) AND NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_option_responses
      WHERE baseline_version_id = v_copy_version_id
    )
  );
  SELECT public.technical_configuration_comparison_set_get_or_create(
    v_option_id, v_copy_version_id, v_revision
  )
  INTO v_response;
  v_copy_set_id := (v_response->'data'->>'id')::UUID;
  SELECT public.technical_configuration_option_response_upsert(
    v_copy_set_id, v_copy_criterion_id, 'Copied version', 'Separate dataset',
    (v_response->'data'->>'revision')::BIGINT
  )
  INTO v_response;
  PERFORM pg_temp.assert_true(
    'draft baseline accepts responses linked only to copied criteria',
    (v_response->'data'->>'criterion_id')::UUID = v_copy_criterion_id
      AND (SELECT count(*) FROM public.technical_configuration_option_responses
           WHERE comparison_set_id = v_set_id) = 2
      AND (v_response->'data'->>'baseline_version_id')::UUID = v_copy_version_id
      AND (SELECT status FROM public.technical_configuration_baseline_versions WHERE id = v_copy_version_id) = 'draft'
  );
  -- baseline delete cascades comparison data
  DELETE FROM public.technical_configuration_baseline_versions
  WHERE id = v_copy_version_id;
  PERFORM pg_temp.assert_true(
    'baseline delete cascades comparison data',
    NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_comparison_sets
      WHERE id = v_copy_set_id
    ) AND EXISTS (
      SELECT 1 FROM public.technical_configuration_comparison_sets
      WHERE id = v_set_id
    )
  );
  INSERT INTO public.technical_configuration_comparison_sets (
    dossier_id, option_id, baseline_version_id, created_by, updated_by
  )
  VALUES (
    v_dossier_id, v_stale_option_id, v_version_id, v_user_id, v_user_id
  )
  RETURNING id INTO v_copy_set_id;
  INSERT INTO public.technical_configuration_option_responses (
    comparison_set_id, baseline_version_id, criterion_id, created_by, updated_by
  )
  VALUES (
    v_copy_set_id, v_version_id, v_second_criterion_id, v_user_id, v_user_id
  );
  -- option delete cascades comparison data
  DELETE FROM public.technical_configuration_options
  WHERE id = v_stale_option_id;
  PERFORM pg_temp.assert_true(
    'option delete cascades comparison data',
    NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_comparison_sets
      WHERE id = v_copy_set_id
    )
  );
  -- dossier delete cascades comparison data
  DELETE FROM public.technical_configuration_dossiers
  WHERE id = v_archived_dossier_id;
  PERFORM pg_temp.assert_true(
    'dossier delete cascades comparison data',
    NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_comparison_sets
      WHERE id = v_archived_set_id
    )
  );
  SELECT count(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN (
      'technical_configuration_comparison_sets',
      'technical_configuration_option_responses'
    )
    AND column_name ~ '(compliance|evaluation|assessment|ranking|overall_status)';
  PERFORM pg_temp.assert_true('P8A3 exposes no assessment fields', v_count = 0);
  SELECT pg_get_functiondef(
    'public.technical_configuration_baseline_copy(UUID, BIGINT)'::regprocedure
  ) INTO v_definition;
  PERFORM pg_temp.assert_true(
    'baseline copy definition excludes comparison tables',
    position('technical_configuration_comparison_sets' IN v_definition) = 0
      AND position('technical_configuration_option_responses' IN v_definition) = 0
  );
  FOREACH v_function_signature IN ARRAY ARRAY[
    'public.technical_configuration_comparison_set_get_or_create(uuid,uuid,bigint)',
    'public.technical_configuration_option_response_upsert(uuid,uuid,text,text,bigint)'
  ]
  LOOP
    PERFORM pg_temp.assert_true('authenticated executes ' || v_function_signature,
      has_function_privilege('authenticated', v_function_signature, 'EXECUTE'));
    PERFORM pg_temp.assert_true('service role executes ' || v_function_signature,
      has_function_privilege('service_role', v_function_signature, 'EXECUTE'));
    PERFORM pg_temp.assert_true('anon cannot execute ' || v_function_signature,
      NOT has_function_privilege('anon', v_function_signature, 'EXECUTE'));
  END LOOP;
  FOREACH v_table_name IN ARRAY ARRAY[
    'technical_configuration_comparison_sets',
    'technical_configuration_option_responses'
  ]
  LOOP
    SELECT c.relrowsecurity INTO v_rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = v_table_name;
    PERFORM pg_temp.assert_true(v_table_name || ' RLS enabled', v_rls_enabled);
    FOREACH v_table_privilege IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    LOOP
      PERFORM pg_temp.assert_true('authenticated table privilege denied',
        NOT has_table_privilege(
          'authenticated', 'public.' || v_table_name, v_table_privilege));
      PERFORM pg_temp.assert_true('anon table privilege denied',
        NOT has_table_privilege('anon', 'public.' || v_table_name, v_table_privilege));
      PERFORM pg_temp.assert_true('service role table privilege granted',
        has_table_privilege('service_role', 'public.' || v_table_name, v_table_privilege));
    END LOOP;
  END LOOP;
END;
$gate$;
ROLLBACK;
