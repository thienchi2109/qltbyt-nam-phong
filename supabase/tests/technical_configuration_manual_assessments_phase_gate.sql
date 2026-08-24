-- P11B rollback-only manual-assessment auth, ownership, revision, and ACL gate.
BEGIN;
CREATE FUNCTION pg_temp.expect_error(
  p_label TEXT, p_statement TEXT, p_expected_state TEXT, p_expected_message TEXT
) RETURNS VOID LANGUAGE plpgsql AS $gate$
DECLARE v_state TEXT; v_message TEXT;
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
CREATE FUNCTION pg_temp.expect_state(
  p_label TEXT, p_statement TEXT, p_expected_state TEXT
) RETURNS VOID LANGUAGE plpgsql AS $gate$
DECLARE v_state TEXT;
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
    IF v_state IS DISTINCT FROM p_expected_state THEN
      RAISE EXCEPTION '%: expected [%], got [%]', p_label, p_expected_state, v_state;
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
      'app_role', p_app_role, 'role', 'authenticated',
      'user_id', p_user_id::TEXT, 'sub', p_user_id::TEXT
    )::TEXT,
    true
  );
END;
$gate$;
CREATE FUNCTION pg_temp.assert_true(p_label TEXT, p_condition BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $gate$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN RAISE EXCEPTION '%', p_label; END IF;
END;
$gate$;
DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT; v_created_by BIGINT; v_dossier_revision BIGINT; v_count BIGINT;
  v_created_at TIMESTAMPTZ; v_rls_enabled BOOLEAN;
  v_response JSONB; v_list JSONB; v_assessment_snapshot JSONB;
  v_column_names TEXT[];
  v_wire_fields CONSTANT TEXT[] := ARRAY['baseline_version_id', 'comparison_set_id', 'created_at', 'created_by', 'criterion_id', 'evidence_axis', 'id', 'notes', 'revision', 'technical_axis', 'updated_at', 'updated_by'];
  v_function_signature TEXT; v_table_privilege TEXT;
  v_dossier_id UUID := gen_random_uuid();
  v_archived_dossier_id UUID := gen_random_uuid();
  v_supplier_id UUID := gen_random_uuid();
  v_archived_supplier_id UUID := gen_random_uuid();
  v_option_id UUID := gen_random_uuid();
  v_archived_option_id UUID := gen_random_uuid();
  v_version_id UUID := gen_random_uuid();
  v_other_version_id UUID := gen_random_uuid();
  v_cascade_version_id UUID := gen_random_uuid();
  v_archived_version_id UUID := gen_random_uuid();
  v_first_group_id UUID := gen_random_uuid();
  v_second_group_id UUID := gen_random_uuid();
  v_other_group_id UUID := gen_random_uuid();
  v_cascade_group_id UUID := gen_random_uuid();
  v_archived_group_id UUID := gen_random_uuid();
  v_first_criterion_id UUID := gen_random_uuid();
  v_second_criterion_id UUID := gen_random_uuid();
  v_missing_criterion_id UUID := gen_random_uuid();
  v_other_criterion_id UUID := gen_random_uuid();
  v_cascade_criterion_id UUID := gen_random_uuid();
  v_archived_criterion_id UUID := gen_random_uuid();
  v_set_id UUID := gen_random_uuid();
  v_cascade_set_id UUID := gen_random_uuid();
  v_archived_set_id UUID := gen_random_uuid();
  v_response_id UUID := gen_random_uuid();
  v_document_id UUID := gen_random_uuid();
  v_archived_assessment_id UUID := gen_random_uuid();
  v_cascade_assessment_id UUID := gen_random_uuid();
  v_assessment_id UUID; v_second_assessment_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_manual_assessments_phase_gate')
  );
  SELECT nv.id INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P11B phase gate requires one active public.nhan_vien row';
  END IF;
  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, archived_at, archived_by, created_by, updated_by
  ) VALUES
    (v_dossier_id, 'P11B device ' || v_suffix, 'P11B dossier ' || v_suffix,
      NULL, NULL, v_user_id, v_user_id),
    (v_archived_dossier_id, 'P11B archived device ' || v_suffix,
      'P11B archived dossier ' || v_suffix, now(), v_user_id, v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_suppliers (
    id, dossier_id, name, created_by, updated_by
  ) VALUES
    (v_supplier_id, v_dossier_id, 'P11B Supplier', v_user_id, v_user_id),
    (v_archived_supplier_id, v_archived_dossier_id, 'P11B Archived Supplier',
      v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_options (
    id, dossier_id, supplier_id, option_name, created_by, updated_by
  ) VALUES
    (v_option_id, v_dossier_id, v_supplier_id, 'P11B Option', v_user_id, v_user_id),
    (v_archived_option_id, v_archived_dossier_id, v_archived_supplier_id,
      'P11B Archived Option', v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_baseline_versions (
    id, dossier_id, version_number, status, next_criterion_number, revision,
    locked_at, locked_by, created_by, updated_by
  ) VALUES
    (v_version_id, v_dossier_id, 1, 'locked', 4, 1,
      now(), v_user_id, v_user_id, v_user_id),
    (v_other_version_id, v_dossier_id, 2, 'locked', 2, 1,
      now(), v_user_id, v_user_id, v_user_id),
    (v_cascade_version_id, v_dossier_id, 3, 'locked', 2, 1,
      now(), v_user_id, v_user_id, v_user_id),
    (v_archived_version_id, v_archived_dossier_id, 1, 'locked', 2, 1,
      now(), v_user_id, v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_baseline_groups (
    id, baseline_version_id, name, sort_order, created_by, updated_by
  ) VALUES
    (v_first_group_id, v_version_id, 'First Group', 1, v_user_id, v_user_id),
    (v_second_group_id, v_version_id, 'Second Group', 2, v_user_id, v_user_id),
    (v_other_group_id, v_other_version_id, 'Other Group', 1, v_user_id, v_user_id),
    (v_cascade_group_id, v_cascade_version_id, 'Cascade Group', 1,
      v_user_id, v_user_id),
    (v_archived_group_id, v_archived_version_id, 'Archived Group', 1,
      v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_baseline_criteria (
    id, baseline_version_id, group_id, criterion_code, requirement_text,
    sort_order, created_by, updated_by
  ) VALUES
    (v_first_criterion_id, v_version_id, v_second_group_id,
      'TC-0001', 'First criterion', 1, v_user_id, v_user_id),
    (v_second_criterion_id, v_version_id, v_first_group_id,
      'TC-0002', 'Second criterion', 1, v_user_id, v_user_id),
    (v_missing_criterion_id, v_version_id, v_first_group_id,
      'TC-0003', 'Missing criterion', 2, v_user_id, v_user_id),
    (v_other_criterion_id, v_other_version_id, v_other_group_id,
      'TC-0001', 'Other criterion', 1, v_user_id, v_user_id),
    (v_cascade_criterion_id, v_cascade_version_id, v_cascade_group_id,
      'TC-0001', 'Cascade criterion', 1, v_user_id, v_user_id),
    (v_archived_criterion_id, v_archived_version_id, v_archived_group_id,
      'TC-0001', 'Archived criterion', 1, v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_comparison_sets (
    id, dossier_id, option_id, baseline_version_id, created_by, updated_by
  ) VALUES
    (v_set_id, v_dossier_id, v_option_id, v_version_id, v_user_id, v_user_id),
    (v_cascade_set_id, v_dossier_id, v_option_id, v_cascade_version_id,
      v_user_id, v_user_id),
    (v_archived_set_id, v_archived_dossier_id, v_archived_option_id,
      v_archived_version_id, v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_option_responses (
    id, comparison_set_id, baseline_version_id, criterion_id,
    response_text, supplementary_information, created_by, updated_by
  ) VALUES (
    v_response_id, v_set_id, v_version_id, v_first_criterion_id,
    'Original response', 'Original supplementary', v_user_id, v_user_id
  );
  INSERT INTO public.technical_configuration_option_documents (
    id, option_id, name, url, created_by, updated_by
  ) VALUES (
    v_document_id, v_option_id, 'Original document',
    'https://example.com/original.pdf', v_user_id, v_user_id
  );
  INSERT INTO public.technical_configuration_manual_assessments (
    id, comparison_set_id, baseline_version_id, criterion_id,
    technical_axis, evidence_axis, notes, created_by, updated_by
  ) VALUES (
    v_archived_assessment_id, v_archived_set_id, v_archived_version_id,
    v_archived_criterion_id, 'meets', 'complete', 'Archived note',
    v_user_id, v_user_id
  );
  -- missing claims rejected
  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error('missing claims rejected', format(
    'SELECT public.technical_configuration_assessments_list(%L::UUID, 1, 100)',
    v_set_id), '42501', 'permission_denied');
  -- non-global role rejected
  PERFORM pg_temp.set_claims('to_qltb', v_user_id);
  PERFORM pg_temp.expect_error('non-global role rejected', format(
    'SELECT public.technical_configuration_assessment_upsert(%L::UUID, %L::UUID, NULL, NULL, NULL, 0)',
    v_set_id, v_first_criterion_id), '42501', 'permission_denied');
  -- raw admin accepted
  PERFORM pg_temp.set_claims('admin', v_user_id);
  SELECT public.technical_configuration_assessments_list(v_set_id, 1, 100)
  INTO v_list;
  PERFORM pg_temp.assert_true('raw admin accepted', (v_list->>'total')::BIGINT = 0);
  PERFORM pg_temp.set_claims('chuyen_gia', v_user_id);
  SELECT public.technical_configuration_assessments_list(v_set_id, 1, 100)
  INTO v_list;
  PERFORM pg_temp.assert_true(
    'expert assessment read accepted',
    (v_list->>'total')::BIGINT = 0
  );
  BEGIN
    PERFORM public.technical_configuration_assessment_upsert(
      v_set_id,
      v_first_criterion_id,
      'meets',
      'complete',
      'Expert write probe',
      0
    );
    RAISE EXCEPTION 'expert_assessment_write_probe_rollback' USING ERRCODE = 'P0001';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'expert_assessment_write_probe_rollback' THEN
        RAISE;
      END IF;
  END;
  PERFORM pg_temp.set_claims('admin', v_user_id);
  -- assessment list bounds enforced
  PERFORM pg_temp.expect_error('null comparison set rejected',
    'SELECT public.technical_configuration_assessments_list(NULL, 1, 100)',
    'PT422', 'validation_error');
  PERFORM pg_temp.expect_error('null page rejected', format(
    'SELECT public.technical_configuration_assessments_list(%L::UUID, NULL, 100)',
    v_set_id), 'PT422', 'validation_error');
  PERFORM pg_temp.expect_error('null page size rejected', format(
    'SELECT public.technical_configuration_assessments_list(%L::UUID, 1, NULL)',
    v_set_id), 'PT422', 'validation_error');
  PERFORM pg_temp.expect_error('invalid page rejected', format(
    'SELECT public.technical_configuration_assessments_list(%L::UUID, 0, 100)',
    v_set_id), 'PT422', 'validation_error');
  PERFORM pg_temp.expect_error('zero page size rejected', format(
    'SELECT public.technical_configuration_assessments_list(%L::UUID, 1, 0)',
    v_set_id), 'PT422', 'validation_error');
  PERFORM pg_temp.expect_error('oversized page size rejected', format(
    'SELECT public.technical_configuration_assessments_list(%L::UUID, 1, 101)',
    v_set_id), 'PT422', 'validation_error');
  PERFORM pg_temp.set_claims('global', v_user_id);
  SELECT revision INTO v_dossier_revision
  FROM public.technical_configuration_dossiers WHERE id = v_dossier_id;
  -- cross-version criterion rejected
  PERFORM pg_temp.expect_error('cross-version criterion rejected', format(
    'SELECT public.technical_configuration_assessment_upsert(%L::UUID, %L::UUID, %L, %L, NULL, 0)',
    v_set_id, v_other_criterion_id, 'meets', 'complete'),
    'PT422', 'validation_error');
  -- assessment comparison set ownership FK enforced
  PERFORM pg_temp.expect_state('assessment comparison set ownership FK enforced', format(
    'INSERT INTO public.technical_configuration_manual_assessments (comparison_set_id, baseline_version_id, criterion_id, created_by, updated_by) VALUES (%L::UUID, %L::UUID, %L::UUID, %s, %s)',
    v_set_id, v_other_version_id, v_other_criterion_id, v_user_id, v_user_id),
    '23503');
  -- assessment criterion ownership FK enforced
  PERFORM pg_temp.expect_state('assessment criterion ownership FK enforced', format(
    'INSERT INTO public.technical_configuration_manual_assessments (comparison_set_id, baseline_version_id, criterion_id, created_by, updated_by) VALUES (%L::UUID, %L::UUID, %L::UUID, %s, %s)',
    v_set_id, v_version_id, v_other_criterion_id, v_user_id, v_user_id),
    '23503');
  -- invalid technical axis rejected
  PERFORM pg_temp.expect_error('invalid technical axis rejected', format(
    'SELECT public.technical_configuration_assessment_upsert(%L::UUID, %L::UUID, %L, NULL, NULL, 0)',
    v_set_id, v_first_criterion_id, 'invalid'), 'PT422', 'validation_error');
  -- invalid evidence axis rejected
  PERFORM pg_temp.expect_error('invalid evidence axis rejected', format(
    'SELECT public.technical_configuration_assessment_upsert(%L::UUID, %L::UUID, NULL, %L, NULL, 0)',
    v_set_id, v_first_criterion_id, 'invalid'), 'PT422', 'validation_error');
  -- first create revision is one
  SELECT public.technical_configuration_assessment_upsert(
    v_set_id, v_first_criterion_id, 'exceeds', 'complete', NULL, 0
  ) INTO v_response;
  SELECT array_agg(key ORDER BY key) INTO v_column_names FROM jsonb_object_keys(v_response->'data') AS key;
  PERFORM pg_temp.assert_true('create response exact wire fields', v_column_names = v_wire_fields);
  v_assessment_id := (v_response->'data'->>'id')::UUID;
  SELECT created_at, created_by INTO v_created_at, v_created_by
  FROM public.technical_configuration_manual_assessments WHERE id = v_assessment_id;
  PERFORM pg_temp.assert_true('first create revision is one',
    (v_response->'data'->>'revision')::BIGINT = 1
    AND v_response->'data'->>'notes' = ''
    AND (SELECT revision FROM public.technical_configuration_dossiers
         WHERE id = v_dossier_id) = v_dossier_revision);
  -- canonical nullable axes and notes preserved
  SELECT public.technical_configuration_assessment_upsert(
    v_set_id, v_second_criterion_id, NULL, NULL, NULL, 0
  ) INTO v_response;
  v_second_assessment_id := (v_response->'data'->>'id')::UUID;
  PERFORM pg_temp.assert_true('canonical nullable axes and notes preserved',
    v_response->'data'->'technical_axis' = 'null'::JSONB
    AND v_response->'data'->'evidence_axis' = 'null'::JSONB
    AND v_response->'data'->>'notes' = '');
  SELECT public.technical_configuration_assessments_list(v_set_id, 1, 100)
  INTO v_list;
  SELECT count(*) INTO v_count FROM jsonb_object_keys(v_list->'data'->0);
  PERFORM pg_temp.assert_true('assessment list ordering and wire fields',
    (v_list->>'total')::BIGINT = 2
    AND jsonb_array_length(v_list->'data') = 2
    AND (v_list->'data'->0->>'criterion_id')::UUID = v_second_criterion_id
    AND (v_list->'data'->1->>'criterion_id')::UUID = v_first_criterion_id
    AND v_count = 12);
  -- archived assessment reads remain available
  SELECT public.technical_configuration_assessments_list(v_archived_set_id, 1, 100)
  INTO v_list;
  PERFORM pg_temp.assert_true('archived assessment reads remain available',
    (v_list->>'total')::BIGINT = 1
    AND (v_list->'data'->0->>'id')::UUID = v_archived_assessment_id);
  -- archived assessment mutation rejected
  PERFORM pg_temp.expect_error('archived assessment mutation rejected', format(
    'SELECT public.technical_configuration_assessment_upsert(%L::UUID, %L::UUID, %L, %L, NULL, 1)',
    v_archived_set_id, v_archived_criterion_id, 'fails', 'missing'),
    'PT409', 'archived_dossier');
  -- existing row rejects expected revision zero
  PERFORM pg_temp.expect_error('existing row rejects expected revision zero', format(
    'SELECT public.technical_configuration_assessment_upsert(%L::UUID, %L::UUID, %L, %L, NULL, 0)',
    v_set_id, v_first_criterion_id, 'meets', 'complete'),
    'PT409', 'stale_revision');
  -- missing row rejects positive expected revision
  PERFORM pg_temp.expect_error('missing row rejects positive expected revision', format(
    'SELECT public.technical_configuration_assessment_upsert(%L::UUID, %L::UUID, %L, %L, NULL, 1)',
    v_set_id, v_missing_criterion_id, 'meets', 'complete'),
    'PT409', 'stale_revision');
  -- exact update increments only assessment revision
  SELECT public.technical_configuration_assessment_upsert(
    v_set_id, v_first_criterion_id, 'meets', 'partial', 'Reviewed', 1
  ) INTO v_response;
  SELECT array_agg(key ORDER BY key) INTO v_column_names FROM jsonb_object_keys(v_response->'data') AS key;
  PERFORM pg_temp.assert_true('update response exact wire fields', v_column_names = v_wire_fields);
  PERFORM pg_temp.assert_true('exact update increments only assessment revision',
    (v_response->'data'->>'revision')::BIGINT = 2
    AND (SELECT revision FROM public.technical_configuration_dossiers
         WHERE id = v_dossier_id) = v_dossier_revision);
  -- stale update leaves assessment unchanged
  PERFORM pg_temp.expect_error('stale update leaves assessment unchanged', format(
    'SELECT public.technical_configuration_assessment_upsert(%L::UUID, %L::UUID, %L, %L, %L, 1)',
    v_set_id, v_first_criterion_id, 'fails', 'missing', 'Stale'),
    'PT409', 'stale_revision');
  PERFORM pg_temp.assert_true('stale update leaves assessment unchanged',
    (SELECT revision = 2 AND notes = 'Reviewed'
     FROM public.technical_configuration_manual_assessments
     WHERE id = v_assessment_id));

  -- source response update preserves manual assessment
  SELECT to_jsonb(a) INTO v_assessment_snapshot
  FROM public.technical_configuration_manual_assessments a
  WHERE a.id = v_assessment_id;
  UPDATE public.technical_configuration_option_responses
  SET response_text = 'Changed response',
      supplementary_information = 'Changed supplementary',
      updated_at = now(), updated_by = v_user_id
  WHERE id = v_response_id;
  PERFORM pg_temp.assert_true('source response update preserves manual assessment',
    (SELECT to_jsonb(a) = v_assessment_snapshot
     FROM public.technical_configuration_manual_assessments a
     WHERE a.id = v_assessment_id));
  SELECT public.technical_configuration_assessment_upsert(
    v_set_id, v_first_criterion_id, 'meets', 'complete', 'After response', 2
  ) INTO v_response;
  PERFORM pg_temp.assert_true('post-response assessment update succeeds',
    (v_response->'data'->>'revision')::BIGINT = 3);
  -- option document update preserves manual assessment
  SELECT to_jsonb(a) INTO v_assessment_snapshot
  FROM public.technical_configuration_manual_assessments a
  WHERE a.id = v_assessment_id;
  UPDATE public.technical_configuration_option_documents
  SET name = 'Changed document', url = 'https://example.com/changed.pdf',
      updated_at = now(), updated_by = v_user_id
  WHERE id = v_document_id;
  PERFORM pg_temp.assert_true('option document update preserves manual assessment',
    (SELECT to_jsonb(a) = v_assessment_snapshot
     FROM public.technical_configuration_manual_assessments a
     WHERE a.id = v_assessment_id));
  SELECT public.technical_configuration_assessment_upsert(
    v_set_id, v_first_criterion_id, 'meets', 'complete', 'After document', 3
  ) INTO v_response;
  PERFORM pg_temp.assert_true('post-document assessment update succeeds',
    (v_response->'data'->>'revision')::BIGINT = 4);
  -- assessment update preserves creation audit
  PERFORM pg_temp.assert_true('assessment update preserves creation audit',
    (SELECT created_at = v_created_at AND created_by = v_created_by
     FROM public.technical_configuration_manual_assessments
     WHERE id = v_assessment_id));

  INSERT INTO public.technical_configuration_manual_assessments (
    id, comparison_set_id, baseline_version_id, criterion_id,
    technical_axis, evidence_axis, created_by, updated_by
  ) VALUES (
    v_cascade_assessment_id, v_cascade_set_id, v_cascade_version_id,
    v_cascade_criterion_id, 'meets', 'complete', v_user_id, v_user_id
  );
  -- baseline delete cascades assessments
  DELETE FROM public.technical_configuration_baseline_versions
  WHERE id = v_cascade_version_id;
  PERFORM pg_temp.assert_true('baseline delete cascades assessments',
    NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_manual_assessments
      WHERE id = v_cascade_assessment_id
    ));
  -- option delete cascades assessments
  DELETE FROM public.technical_configuration_options WHERE id = v_option_id;
  PERFORM pg_temp.assert_true('option delete cascades assessments',
    NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_manual_assessments
      WHERE id IN (v_assessment_id, v_second_assessment_id)
    ));
  -- dossier delete cascades assessments
  DELETE FROM public.technical_configuration_dossiers WHERE id = v_archived_dossier_id;
  PERFORM pg_temp.assert_true('dossier delete cascades assessments',
    NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_manual_assessments
      WHERE id = v_archived_assessment_id
    ));

  SELECT array_agg(column_name::TEXT ORDER BY ordinal_position)
  INTO v_column_names
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'technical_configuration_manual_assessments';
  PERFORM pg_temp.assert_true(
    'manual assessment table exposes no derived or machine fields',
    v_column_names = ARRAY[
      'id', 'comparison_set_id', 'baseline_version_id', 'criterion_id',
      'technical_axis', 'evidence_axis', 'notes', 'revision',
      'created_at', 'created_by', 'updated_at', 'updated_by'
    ]
  );
  FOREACH v_function_signature IN ARRAY ARRAY[
    'public.technical_configuration_assessments_list(uuid,integer,integer)',
    'public.technical_configuration_assessment_upsert(uuid,uuid,text,text,text,bigint)'
  ] LOOP
    PERFORM pg_temp.assert_true('authenticated executes ' || v_function_signature,
      has_function_privilege('authenticated', v_function_signature, 'EXECUTE'));
    PERFORM pg_temp.assert_true('service role executes ' || v_function_signature,
      has_function_privilege('service_role', v_function_signature, 'EXECUTE'));
    PERFORM pg_temp.assert_true('anon cannot execute ' || v_function_signature,
      NOT has_function_privilege('anon', v_function_signature, 'EXECUTE'));
  END LOOP;
  SELECT c.relrowsecurity INTO v_rls_enabled
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'technical_configuration_manual_assessments';
  PERFORM pg_temp.assert_true(
    'technical_configuration_manual_assessments RLS enabled',
    v_rls_enabled
  );
  FOREACH v_table_privilege IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
    PERFORM pg_temp.assert_true('authenticated table privilege denied',
      NOT has_table_privilege(
        'authenticated', 'public.technical_configuration_manual_assessments', v_table_privilege));
    PERFORM pg_temp.assert_true('anon table privilege denied',
      NOT has_table_privilege(
        'anon', 'public.technical_configuration_manual_assessments', v_table_privilege));
    PERFORM pg_temp.assert_true('service role table privilege granted',
      has_table_privilege(
        'service_role', 'public.technical_configuration_manual_assessments',
        v_table_privilege
      ));
  END LOOP;
  FOREACH v_table_privilege IN ARRAY ARRAY['TRUNCATE', 'REFERENCES', 'TRIGGER'] LOOP
    PERFORM pg_temp.assert_true('service role table privilege denied',
      NOT has_table_privilege(
        'service_role', 'public.technical_configuration_manual_assessments', v_table_privilege));
  END LOOP;
END;
$gate$;

ROLLBACK;
