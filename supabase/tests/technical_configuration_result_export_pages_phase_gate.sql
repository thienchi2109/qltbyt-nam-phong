-- P14A2 rollback-only ranking/matrix authorization, bounds, plan and read-only gate.
BEGIN;

CREATE FUNCTION pg_temp.assert_true(p_label TEXT, p_condition BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $gate$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN RAISE EXCEPTION '%', p_label; END IF;
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
    jsonb_build_object(
      'app_role', p_app_role, 'role', 'authenticated',
      'user_id', p_user_id::TEXT, 'sub', p_user_id::TEXT
    )::TEXT,
    true
  );
END;
$gate$;

CREATE FUNCTION pg_temp.snapshot_counts(p_dossier_id UUID, p_version_id UUID)
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
      WHERE baseline_version_id = p_version_id),
    'dossier_revision', (SELECT revision FROM public.technical_configuration_dossiers
      WHERE id = p_dossier_id),
    'baseline_revision', (SELECT revision FROM public.technical_configuration_baseline_versions
      WHERE id = p_version_id)
  );
$gate$;

DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID := gen_random_uuid();
  v_version_id UUID := gen_random_uuid();
  v_group_id UUID := gen_random_uuid();
  v_criterion_a_id UUID := gen_random_uuid();
  v_criterion_b_id UUID := gen_random_uuid();
  v_supplier_a_id UUID := gen_random_uuid();
  v_supplier_b_id UUID := gen_random_uuid();
  v_supplier_c_id UUID := gen_random_uuid();
  v_option_a_id UUID := gen_random_uuid();
  v_option_b_id UUID := gen_random_uuid();
  v_option_c_id UUID := gen_random_uuid();
  v_set_a_id UUID := gen_random_uuid();
  v_set_b_id UUID := gen_random_uuid();
  v_document_id UUID := gen_random_uuid();
  v_reference_product_id UUID := gen_random_uuid();
  v_full_ranking JSONB;
  v_selected_ranking JSONB;
  v_reference_ranking JSONB;
  v_matrix JSONB;
  v_page_one JSONB;
  v_page_two JSONB;
  v_beyond JSONB;
  v_sparse_cell JSONB;
  v_before JSONB;
  v_after JSONB;
  v_ranking_definition TEXT;
  v_matrix_definition TEXT;
  v_snapshot_definition TEXT;
  v_plan JSON;
  v_ranking_signature TEXT :=
    'public.technical_configuration_result_export_ranking_list(uuid,uuid,uuid[],uuid[],integer,integer)';
  v_matrix_signature TEXT :=
    'public.technical_configuration_result_export_matrix_list(uuid,uuid,uuid[],uuid[],integer,integer)';
  v_helper_signature TEXT :=
    'public._technical_configuration_reference_ranking_snapshot(uuid,uuid)';
  v_token_helper_signature TEXT :=
    'public._technical_configuration_reference_ranking_token(uuid,uuid)';
  v_snapshot_helper_signature TEXT :=
    'public._technical_configuration_result_export_snapshot(uuid,uuid,uuid[],uuid[])';
  v_label_helper_signature TEXT := 'public._technical_configuration_option_display_label(text,text,text)';
  v_status_helper_signature TEXT := 'public._technical_configuration_derived_status(text,text)';
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_result_export_pages_phase_gate'));

  SELECT nv.id INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P14A2 phase gate requires one active public.nhan_vien row';
  END IF;

  PERFORM pg_temp.assert_true('ranking PUBLIC execute revoked',
    NOT has_function_privilege('public', v_ranking_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('ranking anon execute revoked',
    NOT has_function_privilege('anon', v_ranking_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('ranking authenticated execute granted',
    has_function_privilege('authenticated', v_ranking_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('matrix PUBLIC execute revoked',
    NOT has_function_privilege('public', v_matrix_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('matrix anon execute revoked',
    NOT has_function_privilege('anon', v_matrix_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('matrix authenticated execute granted',
    has_function_privilege('authenticated', v_matrix_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('matrix service role execute granted',
    has_function_privilege('service_role', v_matrix_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('private ranking helper stays service-only',
    NOT has_function_privilege('authenticated', v_helper_signature, 'EXECUTE')
    AND has_function_privilege('service_role', v_helper_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('shared expression helpers are immutable and service-only',
    (SELECT bool_and(proc.provolatile = 'i' AND proc.proconfig = ARRAY['search_path=pg_catalog'])
     FROM pg_proc proc
     WHERE proc.oid IN (v_label_helper_signature::regprocedure, v_status_helper_signature::regprocedure))
    AND NOT has_function_privilege('authenticated', v_label_helper_signature, 'EXECUTE')
    AND has_function_privilege('service_role', v_label_helper_signature, 'EXECUTE')
    AND NOT has_function_privilege('authenticated', v_status_helper_signature, 'EXECUTE')
    AND has_function_privilege('service_role', v_status_helper_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('ranking token helper PUBLIC execute revoked',
    NOT has_function_privilege('public', v_token_helper_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('ranking token helper anon execute revoked',
    NOT has_function_privilege('anon', v_token_helper_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('ranking token helper authenticated execute revoked',
    NOT has_function_privilege('authenticated', v_token_helper_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('ranking token helper service role execute granted',
    has_function_privilege('service_role', v_token_helper_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true('all page functions are stable',
    (SELECT bool_and(proc.provolatile = 's')
     FROM pg_proc proc
     WHERE proc.oid IN (
       v_ranking_signature::regprocedure,
       v_matrix_signature::regprocedure,
       v_helper_signature::regprocedure,
       v_token_helper_signature::regprocedure,
       v_snapshot_helper_signature::regprocedure,
       'public.technical_configuration_reference_ranking_list(uuid,uuid,integer,integer)'::regprocedure
     )));

  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, created_by, updated_by
  ) VALUES (
    v_dossier_id, 'P14A2 device ' || v_suffix, 'P14A2 dossier ' || v_suffix,
    v_user_id, v_user_id
  );
  INSERT INTO public.technical_configuration_baseline_versions (
    id, dossier_id, version_number, status, next_criterion_number, revision,
    created_by, updated_by
  ) VALUES (
    v_version_id, v_dossier_id, 1, 'draft', 3, 1, v_user_id, v_user_id
  );
  INSERT INTO public.technical_configuration_baseline_groups (
    id, baseline_version_id, name, sort_order, created_by, updated_by
  ) VALUES (
    v_group_id, v_version_id, 'P14A2 Group', 1, v_user_id, v_user_id
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
    );
  INSERT INTO public.technical_configuration_suppliers (
    id, dossier_id, name, created_by, updated_by
  ) VALUES
    (v_supplier_a_id, v_dossier_id, 'A Supplier', v_user_id, v_user_id),
    (v_supplier_b_id, v_dossier_id, 'B Supplier', v_user_id, v_user_id),
    (v_supplier_c_id, v_dossier_id, 'C Supplier', v_user_id, v_user_id);
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
      v_option_c_id, v_dossier_id, v_supplier_c_id, 'Model C', 'Maker C',
      'Option C', v_user_id, v_user_id
    );
  INSERT INTO public.technical_configuration_comparison_sets (
    id, dossier_id, option_id, baseline_version_id, created_by, updated_by
  ) VALUES
    (v_set_a_id, v_dossier_id, v_option_a_id, v_version_id, v_user_id, v_user_id),
    (v_set_b_id, v_dossier_id, v_option_b_id, v_version_id, v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_option_responses (
    comparison_set_id, baseline_version_id, criterion_id, response_text,
    supplementary_information, created_by, updated_by
  ) VALUES
    (
      v_set_a_id, v_version_id, v_criterion_a_id, 'Option A response',
      'Option A supplementary', v_user_id, v_user_id
    ),
    (
      v_set_b_id, v_version_id, v_criterion_a_id, 'Option B response',
      '', v_user_id, v_user_id
    );
  INSERT INTO public.technical_configuration_manual_assessments (
    comparison_set_id, baseline_version_id, criterion_id, technical_axis,
    evidence_axis, notes, created_by, updated_by
  ) VALUES
    (v_set_a_id, v_version_id, v_criterion_a_id, 'meets', 'complete', '', v_user_id, v_user_id),
    (v_set_a_id, v_version_id, v_criterion_b_id, 'exceeds', 'complete', '', v_user_id, v_user_id),
    (v_set_b_id, v_version_id, v_criterion_a_id, 'meets', 'complete', '', v_user_id, v_user_id),
    (v_set_b_id, v_version_id, v_criterion_b_id, 'exceeds', 'complete', '', v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_option_documents (
    id, option_id, name, url, created_by, updated_by
  ) VALUES (
    v_document_id, v_option_a_id, 'P14A2 document',
    'https://example.com/p14a2.pdf', v_user_id, v_user_id
  );
  INSERT INTO public.technical_configuration_option_citations (
    option_id, baseline_version_id, comparison_set_id, option_document_id,
    criterion_id, page_section, excerpt, created_by, updated_by
  ) VALUES (
    v_option_a_id, v_version_id, v_set_a_id, v_document_id,
    v_criterion_a_id, 'Section A', 'Citation A', v_user_id, v_user_id
  );
  INSERT INTO public.technical_configuration_reference_products (
    id, baseline_version_id, model, description, created_by, updated_by
  ) VALUES (
    v_reference_product_id, v_version_id, 'REFERENCE-LEAK-MARKER',
    'REFERENCE-LEAK-MARKER', v_user_id, v_user_id
  );
  INSERT INTO public.technical_configuration_reference_responses (
    baseline_version_id, reference_product_id, criterion_id, response_text,
    created_by, updated_by
  ) VALUES (
    v_version_id, v_reference_product_id, v_criterion_a_id,
    'REFERENCE-LEAK-MARKER', v_user_id, v_user_id
  );

  v_before := pg_temp.snapshot_counts(v_dossier_id, v_version_id);
  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error(
    'missing claims rejected',
    format(
      'SELECT public.technical_configuration_result_export_ranking_list(%L,%L,NULL,NULL,1,100)',
      v_dossier_id, v_version_id
    ),
    '42501', 'permission_denied'
  );
  PERFORM pg_temp.set_claims('user', v_user_id);
  PERFORM pg_temp.expect_error(
    'denied role rejected',
    format(
      'SELECT public.technical_configuration_result_export_matrix_list(%L,%L,NULL,NULL,1,1000)',
      v_dossier_id, v_version_id
    ),
    '42501', 'permission_denied'
  );
  PERFORM pg_temp.set_claims('admin', v_user_id);
  SELECT public.technical_configuration_result_export_ranking_list(
    v_dossier_id, v_version_id, NULL, NULL, 1, 1
  ) INTO v_page_one;
  PERFORM pg_temp.assert_true('raw admin role remains authorized',
    v_page_one->>'total' = '3');
  PERFORM pg_temp.set_claims('global', v_user_id);
  PERFORM pg_temp.expect_error(
    'ranking page bounds rejected',
    format(
      'SELECT public.technical_configuration_result_export_ranking_list(%L,%L,NULL,NULL,0,101)',
      v_dossier_id, v_version_id
    ),
    'PT422', 'validation_error'
  );
  PERFORM pg_temp.expect_error(
    'matrix page bounds rejected',
    format(
      'SELECT public.technical_configuration_result_export_matrix_list(%L,%L,NULL,NULL,1,1001)',
      v_dossier_id, v_version_id
    ),
    'PT422', 'validation_error'
  );

  SELECT public.technical_configuration_result_export_ranking_list(
    v_dossier_id, v_version_id, NULL, NULL, 1, 100
  ) INTO v_full_ranking;
  PERFORM pg_temp.assert_true('ranking preserves P12C1 ties and counters',
    v_full_ranking->>'total' = '3'
    AND v_full_ranking->'data'->0->>'rank' = '1'
    AND v_full_ranking->'data'->1->>'rank' = '1'
    AND v_full_ranking->'data'->2->>'eligibility' = 'incomplete'
    AND v_full_ranking->'data'->2->>'incomplete_criterion_count' = '2');
  SELECT public.technical_configuration_result_export_ranking_list(
    v_dossier_id, v_version_id,
    ARRAY[v_option_c_id, v_option_a_id], NULL, 1, 100
  ) INTO v_selected_ranking;
  PERFORM pg_temp.assert_true('ranking scope filters after complete-universe rank',
    v_selected_ranking->>'total' = '2'
    AND v_selected_ranking->'data'->0->>'option_id' = v_option_a_id::TEXT
    AND v_selected_ranking->'data'->0->>'rank' = '1'
    AND v_selected_ranking->'data'->1->>'option_id' = v_option_c_id::TEXT);
  SELECT public.technical_configuration_reference_ranking_list(
    v_dossier_id, v_version_id, 1, 100
  ) INTO v_reference_ranking;
  PERFORM pg_temp.assert_true('P12C1 response remains backward compatible',
    v_reference_ranking->'data' = v_full_ranking->'data'
    AND v_reference_ranking->'total' = v_full_ranking->'total'
    AND v_reference_ranking->>'snapshot_token'
      = v_full_ranking->>'ranking_snapshot_token');
  SELECT public.technical_configuration_result_export_ranking_list(
    v_dossier_id, v_version_id, NULL, NULL, 1, 2
  ) INTO v_page_one;
  SELECT public.technical_configuration_result_export_ranking_list(
    v_dossier_id, v_version_id, NULL, NULL, 2, 2
  ) INTO v_page_two;
  PERFORM pg_temp.assert_true('ranking non-empty second page stays stable',
    jsonb_array_length(v_page_one->'data') = 2
    AND jsonb_array_length(v_page_two->'data') = 1
    AND v_page_two->'data'->0->>'option_id' = v_option_c_id::TEXT
    AND v_page_two->>'total' = v_page_one->>'total'
    AND v_page_two->>'snapshot_token' = v_page_one->>'snapshot_token'
    AND v_page_two->>'ranking_snapshot_token'
      = v_page_one->>'ranking_snapshot_token'
    AND v_page_one->>'page' = '1'
    AND v_page_two->>'page' = '2'
    AND v_page_two->>'page_size' = '2');
  SELECT public.technical_configuration_result_export_ranking_list(
    v_dossier_id, v_version_id, NULL, NULL, 2, 100
  ) INTO v_beyond;
  PERFORM pg_temp.assert_true('ranking page beyond end stays stable',
    v_beyond->'data' = '[]'::JSONB
    AND v_beyond->'total' = v_full_ranking->'total'
    AND v_beyond->>'snapshot_token' = v_full_ranking->>'snapshot_token');

  SELECT public.technical_configuration_result_export_matrix_list(
    v_dossier_id, v_version_id,
    ARRAY[v_option_b_id, v_option_a_id, v_option_c_id],
    ARRAY[v_criterion_b_id, v_criterion_a_id],
    1, 1000
  ) INTO v_matrix;
  PERFORM pg_temp.assert_true('matrix preserves requested criterion-option order',
    v_matrix->>'total' = '6'
    AND v_matrix->'data'->0->>'criterion_id' = v_criterion_b_id::TEXT
    AND v_matrix->'data'->0->>'option_id' = v_option_b_id::TEXT
    AND v_matrix->'data'->3->>'criterion_id' = v_criterion_a_id::TEXT
    AND v_matrix->'data'->3->>'option_id' = v_option_b_id::TEXT);
  SELECT cell INTO v_sparse_cell
  FROM jsonb_array_elements(v_matrix->'data') cell
  WHERE cell->>'option_id' = v_option_c_id::TEXT
    AND cell->>'criterion_id' = v_criterion_a_id::TEXT;
  PERFORM pg_temp.assert_true('sparse matrix returns null and empty links',
    v_sparse_cell->'response_text' = 'null'::JSONB
    AND v_sparse_cell->'technical_axis' = 'null'::JSONB
    AND v_sparse_cell->'document_links' = '[]'::JSONB
    AND v_sparse_cell->>'conclusion' = 'not_evaluated');
  PERFORM pg_temp.assert_true('reference products never enter matrix cells',
    position('REFERENCE-LEAK-MARKER' IN v_matrix::TEXT) = 0);
  SELECT public.technical_configuration_result_export_matrix_list(
    v_dossier_id, v_version_id,
    ARRAY[v_option_b_id, v_option_a_id, v_option_c_id],
    ARRAY[v_criterion_b_id, v_criterion_a_id],
    1, 4
  ) INTO v_page_one;
  SELECT public.technical_configuration_result_export_matrix_list(
    v_dossier_id, v_version_id,
    ARRAY[v_option_b_id, v_option_a_id, v_option_c_id],
    ARRAY[v_criterion_b_id, v_criterion_a_id],
    2, 4
  ) INTO v_page_two;
  PERFORM pg_temp.assert_true('matrix non-empty second page stays stable',
    jsonb_array_length(v_page_one->'data') = 4
    AND jsonb_array_length(v_page_two->'data') = 2
    AND v_page_two->'data'->0->>'criterion_id' = v_criterion_a_id::TEXT
    AND v_page_two->'data'->0->>'option_id' = v_option_a_id::TEXT
    AND v_page_two->'data'->1->>'option_id' = v_option_c_id::TEXT
    AND v_page_two->>'total' = v_page_one->>'total'
    AND v_page_two->>'snapshot_token' = v_page_one->>'snapshot_token'
    AND v_page_two->>'ranking_snapshot_token'
      = v_page_one->>'ranking_snapshot_token'
    AND v_page_one->>'page' = '1'
    AND v_page_two->>'page' = '2'
    AND v_page_two->>'page_size' = '4');
  SELECT public.technical_configuration_result_export_matrix_list(
    v_dossier_id, v_version_id, NULL, NULL, 2, 1000
  ) INTO v_beyond;
  PERFORM pg_temp.assert_true('matrix page beyond end stays stable',
    v_beyond->'data' = '[]'::JSONB
    AND v_beyond->>'snapshot_token' = v_full_ranking->>'snapshot_token');

  SELECT pg_get_functiondef(v_ranking_signature::regprocedure),
         pg_get_functiondef(v_matrix_signature::regprocedure),
         pg_get_functiondef(v_snapshot_helper_signature::regprocedure)
  INTO v_ranking_definition, v_matrix_definition, v_snapshot_definition;
  PERFORM pg_temp.assert_true('snapshot token avoids repeated ranking page scan',
    position(
      'TECHNICAL_CONFIGURATION_REFERENCE_RANKING_LIST'
      IN upper(v_snapshot_definition)
    ) = 0
    AND position(
      '_TECHNICAL_CONFIGURATION_REFERENCE_RANKING_TOKEN'
      IN upper(v_snapshot_definition)
    ) > 0);
  EXECUTE format(
    'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT public.technical_configuration_result_export_matrix_list(%L,%L,NULL,NULL,1,1000)',
    v_dossier_id, v_version_id
  ) INTO v_plan;
  PERFORM pg_temp.assert_true('matrix bounded wrapper executes and source stays set-based',
    v_plan IS NOT NULL
    AND position(' LOOP' IN upper(v_ranking_definition || v_matrix_definition)) = 0
    AND position('GET_OR_CREATE' IN upper(v_ranking_definition || v_matrix_definition)) = 0
    AND position('LIMIT P_PAGE_SIZE' IN upper(v_ranking_definition || v_matrix_definition)) > 0);

  v_after := pg_temp.snapshot_counts(v_dossier_id, v_version_id);
  PERFORM pg_temp.assert_true('result export pages remain read-only', v_before = v_after);
END;
$gate$;

ROLLBACK;
