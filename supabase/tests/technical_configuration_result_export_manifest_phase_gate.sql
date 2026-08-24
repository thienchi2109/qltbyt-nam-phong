-- P14A1 rollback-only export-manifest authorization, scope and snapshot gate.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(p_label TEXT, p_condition BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $gate$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN RAISE EXCEPTION '%', p_label; END IF;
END;
$gate$;
CREATE FUNCTION pg_temp.assert_changed(p_label TEXT, p_before TEXT, p_after TEXT)
RETURNS VOID LANGUAGE plpgsql AS $gate$
BEGIN
  PERFORM pg_temp.assert_true(p_label, p_before IS NOT NULL
    AND p_after IS NOT NULL AND p_before IS DISTINCT FROM p_after);
END;
$gate$;
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
CREATE FUNCTION pg_temp.set_claims(p_app_role TEXT, p_user_id BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $gate$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('app_role', p_app_role, 'role', 'authenticated',
      'user_id', p_user_id::TEXT, 'sub', p_user_id::TEXT)::TEXT, true
  );
END;
$gate$;
CREATE FUNCTION pg_temp.read_manifest(p_dossier_id UUID, p_version_id UUID)
RETURNS JSONB LANGUAGE sql AS $gate$
  SELECT public.technical_configuration_result_export_manifest_get(
    p_dossier_id, p_version_id, NULL::UUID[], NULL::UUID[]);
$gate$;
CREATE FUNCTION pg_temp.snapshot_row_counts(p_dossier_id UUID, p_version_id UUID)
RETURNS JSONB LANGUAGE sql AS $gate$
  SELECT jsonb_build_object(
    'sets', (SELECT count(*) FROM public.technical_configuration_comparison_sets
      WHERE dossier_id = p_dossier_id AND baseline_version_id = p_version_id),
    'responses', (SELECT count(*) FROM public.technical_configuration_option_responses
      WHERE baseline_version_id = p_version_id),
    'documents', (SELECT count(*) FROM public.technical_configuration_option_documents d
      JOIN public.technical_configuration_options o ON o.id = d.option_id
      WHERE o.dossier_id = p_dossier_id),
    'citations', (SELECT count(*) FROM public.technical_configuration_option_citations
      WHERE baseline_version_id = p_version_id),
    'assessments', (SELECT count(*) FROM public.technical_configuration_manual_assessments
      WHERE baseline_version_id = p_version_id));
$gate$;
DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID := gen_random_uuid(); v_other_dossier_id UUID := gen_random_uuid();
  v_version_id UUID := gen_random_uuid(); v_other_version_id UUID := gen_random_uuid();
  v_group_id UUID := gen_random_uuid(); v_other_group_id UUID := gen_random_uuid();
  v_criterion_a_id UUID := gen_random_uuid(); v_criterion_b_id UUID := gen_random_uuid();
  v_other_criterion_id UUID := gen_random_uuid();
  v_supplier_a_id UUID := gen_random_uuid(); v_supplier_b_id UUID := gen_random_uuid();
  v_other_supplier_id UUID := gen_random_uuid();
  v_option_a_id UUID := gen_random_uuid(); v_option_b_id UUID := gen_random_uuid();
  v_other_option_id UUID := gen_random_uuid();
  v_set_id UUID := gen_random_uuid(); v_response_id UUID := gen_random_uuid();
  v_document_id UUID := gen_random_uuid(); v_citation_id UUID := gen_random_uuid();
  v_assessment_id UUID := gen_random_uuid();
  v_manifest JSONB; v_snapshot JSONB; v_ranking JSONB; v_utc_manifest JSONB; v_local_manifest JSONB;
  v_token TEXT; v_next_token TEXT; v_utc_token TEXT; v_local_token TEXT;
  v_before_counts JSONB; v_after_counts JSONB;
  v_before_metadata JSONB; v_after_metadata JSONB;
  v_case RECORD;
  v_manifest_signature TEXT := 'public.technical_configuration_result_export_manifest_get(uuid,uuid,uuid[],uuid[])';
  v_helper_signature TEXT := 'public._technical_configuration_result_export_snapshot(uuid,uuid,uuid[],uuid[])';
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_result_export_manifest_phase_gate'));
  SELECT nv.id INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P14A1 phase gate requires one active public.nhan_vien row';
  END IF;
  PERFORM pg_temp.assert_true('manifest PUBLIC execute revoked',
    NOT has_function_privilege('public', v_manifest_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('manifest anon execute revoked',
    NOT has_function_privilege('anon', v_manifest_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('manifest authenticated execute granted',
    has_function_privilege('authenticated', v_manifest_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('manifest service role execute granted',
    has_function_privilege('service_role', v_manifest_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('helper authenticated execute revoked',
    NOT has_function_privilege('authenticated', v_helper_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('helper service role execute granted',
    has_function_privilege('service_role', v_helper_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('helper is stable', (SELECT proc.provolatile = 's' FROM pg_proc proc WHERE proc.oid = v_helper_signature::regprocedure));
  PERFORM pg_temp.assert_true('manifest is stable', (SELECT proc.provolatile = 's' FROM pg_proc proc WHERE proc.oid = v_manifest_signature::regprocedure));
  PERFORM pg_temp.assert_true('P12C1 ranking is stable', (SELECT proc.provolatile = 's'
    FROM pg_proc proc WHERE proc.oid = 'public.technical_configuration_reference_ranking_list(uuid,uuid,integer,integer)'::regprocedure));
  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, created_by, updated_by
  ) VALUES
    (
      v_dossier_id, 'P14A1 device ' || v_suffix, 'P14A1 dossier ' || v_suffix,
      v_user_id, v_user_id
    ),
    (
      v_other_dossier_id, 'P14A1 other device ' || v_suffix,
      'P14A1 other dossier ' || v_suffix, v_user_id, v_user_id
    );
  INSERT INTO public.technical_configuration_baseline_versions (
    id, dossier_id, version_number, status, next_criterion_number, revision,
    created_by, updated_by
  ) VALUES
    (v_version_id, v_dossier_id, 1, 'draft', 3, 1, v_user_id, v_user_id),
    (v_other_version_id, v_other_dossier_id, 1, 'draft', 2, 1, v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_baseline_groups (
    id, baseline_version_id, name, sort_order, created_by, updated_by
  ) VALUES
    (v_group_id, v_version_id, 'P14A1 Group', 1, v_user_id, v_user_id),
    (
      v_other_group_id, v_other_version_id, 'P14A1 Other Group', 1,
      v_user_id, v_user_id
    );
  INSERT INTO public.technical_configuration_baseline_criteria (
    id, baseline_version_id, group_id, criterion_code, title, requirement_text,
    sort_order, created_by, updated_by
  ) VALUES
    (
      v_criterion_a_id, v_version_id, v_group_id, 'TC-0001', 'Criterion A',
      'Requirement A', 1, v_user_id, v_user_id
    ),
    (
      v_criterion_b_id, v_version_id, v_group_id, 'TC-0002', 'Criterion B',
      'Requirement B', 2, v_user_id, v_user_id
    ),
    (
      v_other_criterion_id, v_other_version_id, v_other_group_id, 'TC-0001',
      'Other criterion', 'Other requirement', 1, v_user_id, v_user_id
    );
  INSERT INTO public.technical_configuration_suppliers (
    id, dossier_id, name, created_by, updated_by
  ) VALUES
    (v_supplier_a_id, v_dossier_id, 'A Supplier', v_user_id, v_user_id),
    (v_supplier_b_id, v_dossier_id, 'B Supplier', v_user_id, v_user_id),
    (
      v_other_supplier_id, v_other_dossier_id, 'Other Supplier',
      v_user_id, v_user_id
    );
  INSERT INTO public.technical_configuration_options (
    id, dossier_id, supplier_id, model, manufacturer, option_name,
    created_by, updated_by
  ) VALUES
    (
      v_option_a_id, v_dossier_id, v_supplier_a_id, 'Model A', 'Maker A',
      'Option A', v_user_id, v_user_id
    ),
    (
      v_option_b_id, v_dossier_id, v_supplier_b_id, 'Model B', 'Maker B',
      'Option B', v_user_id, v_user_id
    ),
    (
      v_other_option_id, v_other_dossier_id, v_other_supplier_id, 'Other Model',
      'Other Maker', 'Other Option', v_user_id, v_user_id
    );
  INSERT INTO public.technical_configuration_comparison_sets (
    id, dossier_id, option_id, baseline_version_id, created_by, updated_by
  ) VALUES (
    v_set_id, v_dossier_id, v_option_a_id, v_version_id, v_user_id, v_user_id
  );
  INSERT INTO public.technical_configuration_option_responses (
    id, comparison_set_id, baseline_version_id, criterion_id,
    response_text, supplementary_information, created_by, updated_by
  ) VALUES (
    v_response_id, v_set_id, v_version_id, v_criterion_a_id,
    'Original response', 'Original supplementary', v_user_id, v_user_id
  );
  INSERT INTO public.technical_configuration_option_documents (
    id, option_id, name, url, created_by, updated_by
  ) VALUES (
    v_document_id, v_option_a_id, 'Original document',
    'https://example.com/original.pdf', v_user_id, v_user_id
  );
  INSERT INTO public.technical_configuration_option_citations (
    id, option_id, baseline_version_id, comparison_set_id, option_document_id,
    criterion_id, page_section, excerpt, created_by, updated_by
  ) VALUES (
    v_citation_id, v_option_a_id, v_version_id, v_set_id, v_document_id,
    v_criterion_a_id, 'Section 1', 'Original excerpt', v_user_id, v_user_id
  );
  INSERT INTO public.technical_configuration_manual_assessments (
    id, comparison_set_id, baseline_version_id, criterion_id,
    technical_axis, evidence_axis, notes, created_by, updated_by
  ) VALUES (
    v_assessment_id, v_set_id, v_version_id, v_criterion_a_id,
    'meets', 'complete', 'Original assessment', v_user_id, v_user_id
  );
  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error(
    'missing claims rejected',
    format(
      'SELECT public.technical_configuration_result_export_manifest_get(%L::UUID, %L::UUID, NULL::UUID[], NULL::UUID[])',
      v_dossier_id, v_version_id
    ),
    '42501', 'permission_denied'
  );
  PERFORM pg_temp.set_claims('qltb_khoa', v_user_id);
  PERFORM pg_temp.expect_error(
    'denied role cannot read export manifest',
    format(
      'SELECT public.technical_configuration_result_export_manifest_get(%L::UUID, %L::UUID, NULL::UUID[], NULL::UUID[])',
      v_dossier_id, v_version_id
    ),
    '42501', 'permission_denied'
  );
  PERFORM pg_temp.set_claims('admin', v_user_id);
  v_manifest := pg_temp.read_manifest(v_dossier_id, v_version_id);
  PERFORM pg_temp.assert_true(
    'raw admin can read export manifest',
    (v_manifest->'data'->>'option_total')::BIGINT = 2
  );
  PERFORM pg_temp.set_claims('global', v_user_id);
  v_manifest := pg_temp.read_manifest(v_dossier_id, v_version_id);
  PERFORM pg_temp.assert_true(
    'global can read export manifest',
    (v_manifest->'data'->>'criterion_total')::BIGINT = 2
  );
  PERFORM pg_temp.set_claims('chuyen_gia', v_user_id);
  v_manifest := pg_temp.read_manifest(v_dossier_id, v_version_id);
  PERFORM pg_temp.assert_true(
    'expert can read export manifest',
    (v_manifest->'data'->>'option_total')::BIGINT = 2
      AND (v_manifest->'data'->>'criterion_total')::BIGINT = 2
  );
  PERFORM pg_temp.set_claims('global', v_user_id);
  PERFORM pg_temp.assert_true(
    'public manifest root is exact',
    (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(v_manifest) key)
      = ARRAY['data']
  );
  PERFORM pg_temp.assert_true(
    'public manifest data fields are exact',
    (
      SELECT array_agg(key ORDER BY key)
      FROM jsonb_object_keys(v_manifest->'data') key
    ) = ARRAY[
      'baseline_version', 'criterion_total', 'dossier', 'option_total',
      'ranking_snapshot_token', 'snapshot_token'
    ]
  );
  SELECT public._technical_configuration_result_export_snapshot(
    v_dossier_id,
    v_version_id,
    ARRAY[v_option_b_id, v_option_a_id],
    ARRAY[v_criterion_b_id, v_criterion_a_id]
  ) INTO v_snapshot;
  PERFORM pg_temp.assert_true(
    'ordered scopes preserve request order',
    v_snapshot->'option_ids' = to_jsonb(ARRAY[v_option_b_id, v_option_a_id])
      AND v_snapshot->'criterion_ids'
        = to_jsonb(ARRAY[v_criterion_b_id, v_criterion_a_id])
  );
  FOR v_case IN
    SELECT cases.label, cases.statement, cases.expected_state, cases.expected_message
    FROM (VALUES
      ('null dossier rejected', format('SELECT public.technical_configuration_result_export_manifest_get(NULL::UUID, %L::UUID, NULL::UUID[], NULL::UUID[])', v_version_id), 'PT422', 'validation_error'),
      ('null baseline rejected', format('SELECT public.technical_configuration_result_export_manifest_get(%L::UUID, NULL::UUID, NULL::UUID[], NULL::UUID[])', v_dossier_id), 'PT422', 'validation_error'),
      ('dossier baseline mismatch rejected', format('SELECT public.technical_configuration_result_export_manifest_get(%L::UUID, %L::UUID, NULL::UUID[], NULL::UUID[])', v_dossier_id, v_other_version_id), 'PT404', 'not_found'),
      ('empty option scope rejected', format('SELECT public.technical_configuration_result_export_manifest_get(%L::UUID, %L::UUID, ARRAY[]::UUID[], NULL::UUID[])', v_dossier_id, v_version_id), 'PT422', 'validation_error'),
      ('null option element rejected', format('SELECT public.technical_configuration_result_export_manifest_get(%L::UUID, %L::UUID, ARRAY[%L::UUID, NULL::UUID], NULL::UUID[])', v_dossier_id, v_version_id, v_option_a_id), 'PT422', 'validation_error'),
      ('duplicate option scope rejected', format('SELECT public.technical_configuration_result_export_manifest_get(%L::UUID, %L::UUID, ARRAY[%L::UUID, %L::UUID], NULL::UUID[])', v_dossier_id, v_version_id, v_option_a_id, v_option_a_id), 'PT422', 'validation_error'),
      ('foreign option scope rejected', format('SELECT public.technical_configuration_result_export_manifest_get(%L::UUID, %L::UUID, ARRAY[%L::UUID], NULL::UUID[])', v_dossier_id, v_version_id, v_other_option_id), 'PT404', 'not_found'),
      ('empty criterion scope rejected', format('SELECT public.technical_configuration_result_export_manifest_get(%L::UUID, %L::UUID, NULL::UUID[], ARRAY[]::UUID[])', v_dossier_id, v_version_id), 'PT422', 'validation_error'),
      ('null criterion element rejected', format('SELECT public.technical_configuration_result_export_manifest_get(%L::UUID, %L::UUID, NULL::UUID[], ARRAY[%L::UUID, NULL::UUID])', v_dossier_id, v_version_id, v_criterion_a_id), 'PT422', 'validation_error'),
      ('duplicate criterion scope rejected', format('SELECT public.technical_configuration_result_export_manifest_get(%L::UUID, %L::UUID, NULL::UUID[], ARRAY[%L::UUID, %L::UUID])', v_dossier_id, v_version_id, v_criterion_a_id, v_criterion_a_id), 'PT422', 'validation_error'),
      ('foreign criterion scope rejected', format('SELECT public.technical_configuration_result_export_manifest_get(%L::UUID, %L::UUID, NULL::UUID[], ARRAY[%L::UUID])', v_dossier_id, v_version_id, v_other_criterion_id), 'PT404', 'not_found')
    ) AS cases(label, statement, expected_state, expected_message)
  LOOP
    PERFORM pg_temp.expect_error(
      v_case.label, v_case.statement, v_case.expected_state, v_case.expected_message);
  END LOOP;
  SELECT public.technical_configuration_reference_ranking_list(
    v_dossier_id, v_version_id, 1, 1
  ) INTO v_ranking;
  PERFORM pg_temp.assert_true(
    'ranking token matches P12C1',
    v_manifest->'data'->>'ranking_snapshot_token' = v_ranking->>'snapshot_token'
  );
  v_before_counts := pg_temp.snapshot_row_counts(v_dossier_id, v_version_id);
  PERFORM pg_temp.read_manifest(v_dossier_id, v_version_id);
  v_after_counts := pg_temp.snapshot_row_counts(v_dossier_id, v_version_id);
  PERFORM pg_temp.assert_true(
    'missing rows remain absent',
    v_before_counts = v_after_counts
      AND (v_after_counts->>'sets')::BIGINT = 1
      AND (v_after_counts->>'responses')::BIGINT = 1
      AND (v_after_counts->>'documents')::BIGINT = 1
      AND (v_after_counts->>'citations')::BIGINT = 1
      AND (v_after_counts->>'assessments')::BIGINT = 1
  );
  SELECT jsonb_build_object(
    'dossier_revision', dossier.revision,
    'dossier_updated_at', dossier.updated_at,
    'baseline_revision', version.revision,
    'baseline_updated_at', version.updated_at,
    'set_updated_at', comparison_set.updated_at,
    'assessment_revision', assessment.revision,
    'assessment_updated_at', assessment.updated_at
  ) INTO v_before_metadata
  FROM public.technical_configuration_dossiers dossier
  JOIN public.technical_configuration_baseline_versions version
    ON version.id = v_version_id AND version.dossier_id = dossier.id
  JOIN public.technical_configuration_comparison_sets comparison_set
    ON comparison_set.id = v_set_id
  JOIN public.technical_configuration_manual_assessments assessment
    ON assessment.id = v_assessment_id
  WHERE dossier.id = v_dossier_id;
  PERFORM pg_temp.read_manifest(v_dossier_id, v_version_id);
  SELECT jsonb_build_object(
    'dossier_revision', dossier.revision,
    'dossier_updated_at', dossier.updated_at,
    'baseline_revision', version.revision,
    'baseline_updated_at', version.updated_at,
    'set_updated_at', comparison_set.updated_at,
    'assessment_revision', assessment.revision,
    'assessment_updated_at', assessment.updated_at
  ) INTO v_after_metadata
  FROM public.technical_configuration_dossiers dossier
  JOIN public.technical_configuration_baseline_versions version
    ON version.id = v_version_id AND version.dossier_id = dossier.id
  JOIN public.technical_configuration_comparison_sets comparison_set
    ON comparison_set.id = v_set_id
  JOIN public.technical_configuration_manual_assessments assessment
    ON assessment.id = v_assessment_id
  WHERE dossier.id = v_dossier_id;
  PERFORM pg_temp.assert_true(
    'manifest read preserves revisions and audit metadata',
    v_before_metadata = v_after_metadata
  );
  UPDATE public.technical_configuration_dossiers SET
    archived_at = TIMESTAMPTZ '2026-08-02 01:02:03.456789+00', archived_by = v_user_id
  WHERE id = v_dossier_id;
  UPDATE public.technical_configuration_baseline_versions SET status = 'locked',
    locked_at = TIMESTAMPTZ '2026-08-02 04:05:06.123456+00', locked_by = v_user_id
  WHERE id = v_version_id;
  PERFORM set_config('TimeZone', 'UTC', true);
  v_utc_manifest := pg_temp.read_manifest(v_dossier_id, v_version_id);
  PERFORM set_config('TimeZone', 'Asia/Ho_Chi_Minh', true);
  v_local_manifest := pg_temp.read_manifest(v_dossier_id, v_version_id);
  PERFORM pg_temp.assert_true('manifest timestamps are UTC canonical',
    v_local_manifest->'data'->'dossier'->>'archived_at' = '2026-08-02T01:02:03.456789Z'
      AND v_local_manifest->'data'->'baseline_version'->>'locked_at' = '2026-08-02T04:05:06.123456Z');
  PERFORM pg_temp.assert_true('manifest timestamp representation ignores session timezone',
    v_utc_manifest->'data'->'dossier' = v_local_manifest->'data'->'dossier'
      AND v_utc_manifest->'data'->'baseline_version' = v_local_manifest->'data'->'baseline_version');
  v_utc_token := v_utc_manifest->'data'->>'snapshot_token';
  v_local_token := v_local_manifest->'data'->>'snapshot_token';
  PERFORM pg_temp.assert_true(
    'full token ignores session timestamp formatting',
    v_utc_token = v_local_token
  );
  v_token := v_local_token;
  UPDATE public.technical_configuration_dossiers
  SET name = 'Changed dossier ' || v_suffix
  WHERE id = v_dossier_id;
  v_next_token := pg_temp.read_manifest(v_dossier_id, v_version_id)->'data'->>'snapshot_token';
  PERFORM pg_temp.assert_changed('full token changes with dossier name', v_token, v_next_token);
  v_token := v_next_token;
  UPDATE public.technical_configuration_baseline_criteria
  SET requirement_text = 'Changed requirement'
  WHERE id = v_criterion_a_id;
  v_next_token := pg_temp.read_manifest(v_dossier_id, v_version_id)->'data'->>'snapshot_token';
  PERFORM pg_temp.assert_changed(
    'full token changes with criterion requirement', v_token, v_next_token
  );
  v_token := v_next_token;
  UPDATE public.technical_configuration_baseline_versions
  SET locked_at = TIMESTAMPTZ '2026-08-02 05:06:07.654321+00'
  WHERE id = v_version_id;
  v_next_token := pg_temp.read_manifest(v_dossier_id, v_version_id)->'data'->>'snapshot_token';
  PERFORM pg_temp.assert_changed(
    'full token changes with baseline lock date', v_token, v_next_token
  );
  v_token := v_next_token;
  UPDATE public.technical_configuration_options
  SET model = 'Changed model'
  WHERE id = v_option_a_id;
  v_next_token := pg_temp.read_manifest(v_dossier_id, v_version_id)->'data'->>'snapshot_token';
  PERFORM pg_temp.assert_changed(
    'full token changes with option identity', v_token, v_next_token
  );
  v_token := v_next_token;
  UPDATE public.technical_configuration_suppliers
  SET name = 'Changed Supplier'
  WHERE id = v_supplier_a_id;
  v_next_token := pg_temp.read_manifest(v_dossier_id, v_version_id)->'data'->>'snapshot_token';
  PERFORM pg_temp.assert_changed(
    'full token changes with supplier identity', v_token, v_next_token
  );
  v_token := v_next_token;
  UPDATE public.technical_configuration_option_responses
  SET response_text = 'Changed response'
  WHERE id = v_response_id;
  v_next_token := pg_temp.read_manifest(v_dossier_id, v_version_id)->'data'->>'snapshot_token';
  PERFORM pg_temp.assert_changed('full token changes with response text', v_token, v_next_token);
  v_token := v_next_token;
  UPDATE public.technical_configuration_option_responses
  SET supplementary_information = 'Changed supplementary'
  WHERE id = v_response_id;
  v_next_token := pg_temp.read_manifest(v_dossier_id, v_version_id)->'data'->>'snapshot_token';
  PERFORM pg_temp.assert_changed(
    'full token changes with supplementary information', v_token, v_next_token
  );
  v_token := v_next_token;
  UPDATE public.technical_configuration_option_documents
  SET name = 'Changed document', url = 'https://example.com/changed.pdf'
  WHERE id = v_document_id;
  v_next_token := pg_temp.read_manifest(v_dossier_id, v_version_id)->'data'->>'snapshot_token';
  PERFORM pg_temp.assert_changed(
    'full token changes with document metadata', v_token, v_next_token
  );
  v_token := v_next_token;
  UPDATE public.technical_configuration_option_citations
  SET excerpt = 'Changed excerpt'
  WHERE id = v_citation_id;
  v_next_token := pg_temp.read_manifest(v_dossier_id, v_version_id)->'data'->>'snapshot_token';
  PERFORM pg_temp.assert_changed(
    'full token changes with citation excerpt', v_token, v_next_token
  );
  v_token := v_next_token;
  UPDATE public.technical_configuration_manual_assessments
  SET notes = 'Changed assessment'
  WHERE id = v_assessment_id;
  v_next_token := pg_temp.read_manifest(v_dossier_id, v_version_id)->'data'->>'snapshot_token';
  PERFORM pg_temp.assert_changed('full token changes with manual assessment notes', v_token, v_next_token);
  v_token := v_next_token;
  UPDATE public.technical_configuration_manual_assessments SET technical_axis = 'exceeds' WHERE id = v_assessment_id;
  v_next_token := pg_temp.read_manifest(v_dossier_id, v_version_id)->'data'->>'snapshot_token';
  PERFORM pg_temp.assert_changed('full token changes with manual assessment technical axis', v_token, v_next_token);
END;
$gate$;
ROLLBACK;
