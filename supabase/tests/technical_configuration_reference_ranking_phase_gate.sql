-- P12C1 rollback-only complete reference-ranking auth, paging, and behavior gate.
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
    true);
END;
$gate$;
DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID := gen_random_uuid(); v_other_dossier_id UUID := gen_random_uuid();
  v_version_id UUID := gen_random_uuid(); v_other_version_id UUID := gen_random_uuid();
  v_empty_version_id UUID := gen_random_uuid();
  v_group_id UUID := gen_random_uuid(); v_other_group_id UUID := gen_random_uuid();
  v_supplier_a_id UUID := gen_random_uuid(); v_supplier_b_id UUID := gen_random_uuid();
  v_supplier_c_id UUID := gen_random_uuid(); v_bulk_supplier_id UUID := gen_random_uuid();
  v_option_a_id UUID := gen_random_uuid(); v_option_b_id UUID := gen_random_uuid();
  v_option_c_id UUID := gen_random_uuid();
  v_set_a_id UUID := gen_random_uuid(); v_set_b_id UUID := gen_random_uuid();
  v_set_c_id UUID := gen_random_uuid(); v_response_id UUID := gen_random_uuid();
  v_first_criterion_id UUID;
  v_result JSONB; v_page_two JSONB; v_page_three JSONB;
  v_option_a JSONB; v_option_b JSONB; v_option_c JSONB; v_bulk_option JSONB;
  v_before_source_change JSONB; v_after_source_change JSONB;
  v_before_assessment_token TEXT; v_after_assessment_token TEXT;
  v_comparison_set_count BIGINT;
  v_function_signature TEXT :=
    'public.technical_configuration_reference_ranking_list(uuid,uuid,integer,integer)';
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_reference_ranking_phase_gate'));
  SELECT nv.id INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P12C1 phase gate requires one active public.nhan_vien row';
  END IF;
  PERFORM pg_temp.assert_true(
    'PUBLIC execute revoked',
    NOT has_function_privilege('public', v_function_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true(
    'anon execute revoked',
    NOT has_function_privilege('anon', v_function_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true(
    'authenticated execute granted',
    has_function_privilege('authenticated', v_function_signature, 'EXECUTE'));
  PERFORM pg_temp.assert_true(
    'service role execute granted',
    has_function_privilege('service_role', v_function_signature, 'EXECUTE'));
  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, created_by, updated_by
  ) VALUES
    (
      v_dossier_id,
      'P12C1 device ' || v_suffix,
      'P12C1 dossier ' || v_suffix,
      v_user_id,
      v_user_id
    ),
    (
      v_other_dossier_id,
      'P12C1 other device ' || v_suffix,
      'P12C1 other dossier ' || v_suffix,
      v_user_id,
      v_user_id
    );
  INSERT INTO public.technical_configuration_baseline_versions (
    id, dossier_id, version_number, status, next_criterion_number, revision,
    locked_at, locked_by, created_by, updated_by
  ) VALUES
    (
      v_version_id, v_dossier_id, 1, 'locked', 103, 1,
      now(), v_user_id, v_user_id, v_user_id
    ),
    (
      v_other_version_id, v_other_dossier_id, 1, 'locked', 2, 1,
      now(), v_user_id, v_user_id, v_user_id
    ),
    (
      v_empty_version_id, v_dossier_id, 2, 'draft', 1, 1,
      NULL, NULL, v_user_id, v_user_id
    );
  INSERT INTO public.technical_configuration_baseline_groups (
    id, baseline_version_id, name, sort_order, created_by, updated_by
  ) VALUES
    (v_group_id, v_version_id, 'P12C1 Group', 1, v_user_id, v_user_id),
    (
      v_other_group_id,
      v_other_version_id,
      'P12C1 Other Group',
      1,
      v_user_id,
      v_user_id
    );
  INSERT INTO public.technical_configuration_baseline_criteria (
    id, baseline_version_id, group_id, criterion_code, requirement_text,
    sort_order, created_by, updated_by
  )
  SELECT
    gen_random_uuid(),
    v_version_id,
    v_group_id,
    'TC-' || lpad(series::TEXT, 4, '0'),
    'P12C1 criterion ' || series,
    series,
    v_user_id,
    v_user_id
  FROM generate_series(1, 102) AS series;
  INSERT INTO public.technical_configuration_baseline_criteria (
    id, baseline_version_id, group_id, criterion_code, requirement_text,
    sort_order, created_by, updated_by
  ) VALUES (
    gen_random_uuid(),
    v_other_version_id,
    v_other_group_id,
    'TC-0001',
    'P12C1 other criterion',
    1,
    v_user_id,
    v_user_id);
  SELECT criterion.id INTO v_first_criterion_id
  FROM public.technical_configuration_baseline_criteria criterion
  WHERE criterion.baseline_version_id = v_version_id
    AND criterion.sort_order = 1;
  INSERT INTO public.technical_configuration_suppliers (
    id, dossier_id, name, created_by, updated_by
  ) VALUES
    (v_supplier_a_id, v_dossier_id, 'A Supplier', v_user_id, v_user_id),
    (v_supplier_b_id, v_dossier_id, 'B Supplier', v_user_id, v_user_id),
    (v_supplier_c_id, v_dossier_id, 'C Supplier', v_user_id, v_user_id),
    (v_bulk_supplier_id, v_dossier_id, 'Z Bulk Supplier', v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_options (
    id, dossier_id, supplier_id, option_name, created_by, updated_by
  ) VALUES
    (v_option_a_id, v_dossier_id, v_supplier_a_id, 'Option A', v_user_id, v_user_id),
    (v_option_b_id, v_dossier_id, v_supplier_b_id, 'Option B', v_user_id, v_user_id),
    (v_option_c_id, v_dossier_id, v_supplier_c_id, 'Option C', v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_options (
    id, dossier_id, supplier_id, option_name, created_by, updated_by
  )
  SELECT
    gen_random_uuid(),
    v_dossier_id,
    v_bulk_supplier_id,
    'Bulk Option ' || lpad(series::TEXT, 3, '0'),
    v_user_id,
    v_user_id
  FROM generate_series(1, 100) AS series;
  INSERT INTO public.technical_configuration_comparison_sets (
    id, dossier_id, option_id, baseline_version_id, created_by, updated_by
  ) VALUES
    (v_set_a_id, v_dossier_id, v_option_a_id, v_version_id, v_user_id, v_user_id),
    (v_set_b_id, v_dossier_id, v_option_b_id, v_version_id, v_user_id, v_user_id),
    (v_set_c_id, v_dossier_id, v_option_c_id, v_version_id, v_user_id, v_user_id);
  INSERT INTO public.technical_configuration_manual_assessments (
    comparison_set_id, baseline_version_id, criterion_id,
    technical_axis, evidence_axis, notes, created_by, updated_by
  )
  SELECT
    comparison_set.id,
    v_version_id,
    criterion.id,
    CASE
      WHEN comparison_set.id IN (v_set_a_id, v_set_b_id)
        AND criterion.sort_order BETWEEN 2 AND 6 THEN 'exceeds'
      WHEN comparison_set.id = v_set_c_id AND criterion.sort_order = 1 THEN 'fails'
      WHEN comparison_set.id = v_set_c_id
        AND criterion.sort_order BETWEEN 2 AND 11 THEN 'exceeds'
      WHEN comparison_set.id = v_set_b_id AND criterion.sort_order = 102
        THEN 'not_applicable'
      ELSE 'meets'
    END,
    CASE
      WHEN comparison_set.id IN (v_set_a_id, v_set_b_id)
        AND criterion.sort_order = 1 THEN 'partial'
      WHEN comparison_set.id = v_set_b_id AND criterion.sort_order = 102 THEN NULL
      ELSE 'complete'
    END,
    '',
    v_user_id,
    v_user_id
  FROM (
    VALUES (v_set_a_id), (v_set_b_id), (v_set_c_id)
  ) AS comparison_set(id)
  CROSS JOIN public.technical_configuration_baseline_criteria criterion
  WHERE criterion.baseline_version_id = v_version_id;
  INSERT INTO public.technical_configuration_option_responses (
    id, comparison_set_id, baseline_version_id, criterion_id,
    response_text, supplementary_information, created_by, updated_by
  ) VALUES (
    v_response_id,
    v_set_a_id,
    v_version_id,
    v_first_criterion_id,
    'Original response',
    'Original supplementary information',
    v_user_id,
    v_user_id);
  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error(
    'missing claims rejected',
    format(
      'SELECT public.technical_configuration_reference_ranking_list(%L::UUID, %L::UUID, 1, 100)',
      v_dossier_id,
      v_version_id
    ),
    '42501',
    'permission_denied');
  PERFORM pg_temp.set_claims('qltb_khoa', v_user_id);
  PERFORM pg_temp.expect_error(
    'denied role cannot read ranking',
    format(
      'SELECT public.technical_configuration_reference_ranking_list(%L::UUID, %L::UUID, 1, 100)',
      v_dossier_id,
      v_version_id
    ),
    '42501',
    'permission_denied');
  PERFORM pg_temp.set_claims('admin', v_user_id);
  SELECT public.technical_configuration_reference_ranking_list(
    v_dossier_id, v_version_id, 1, 100
  ) INTO v_result;
  PERFORM pg_temp.assert_true(
    'raw admin can read ranking',
    (v_result->>'total')::BIGINT = 103);
  PERFORM pg_temp.set_claims('global', v_user_id);
  SELECT count(*) INTO v_comparison_set_count
  FROM public.technical_configuration_comparison_sets comparison_set
  WHERE comparison_set.dossier_id = v_dossier_id
    AND comparison_set.baseline_version_id = v_version_id;
  PERFORM set_config('TimeZone', 'UTC', true), set_config('DateStyle', 'ISO, MDY', true);
  SELECT public.technical_configuration_reference_ranking_list(
    v_dossier_id, v_version_id, 1, 100
  ) INTO v_result;
  SELECT public.technical_configuration_reference_ranking_list(
    v_dossier_id, v_version_id, 2, 100
  ) INTO v_page_two;
  SELECT public.technical_configuration_reference_ranking_list(
    v_dossier_id, v_version_id, 3, 100
  ) INTO v_page_three;
  SELECT item INTO v_option_a
  FROM jsonb_array_elements(v_result->'data') item
  WHERE item->>'option_id' = v_option_a_id::TEXT;
  SELECT item INTO v_option_b
  FROM jsonb_array_elements(v_result->'data') item
  WHERE item->>'option_id' = v_option_b_id::TEXT;
  SELECT item INTO v_option_c
  FROM jsonb_array_elements(v_result->'data') item
  WHERE item->>'option_id' = v_option_c_id::TEXT;
  SELECT item INTO v_bulk_option
  FROM jsonb_array_elements(v_result->'data') item
  WHERE item->>'eligibility' = 'incomplete'
  LIMIT 1;
  PERFORM pg_temp.assert_true(
    'dense rank returns 1, 1, 2',
    (v_option_a->>'rank')::BIGINT = 1
      AND (v_option_b->>'rank')::BIGINT = 1
      AND (v_option_c->>'rank')::BIGINT = 2);
  PERFORM pg_temp.assert_true(
    'three transparent ranking counters use precedence',
    (v_option_a->>'failed_count')::BIGINT = 0
      AND (v_option_a->>'insufficient_evidence_count')::BIGINT = 1
      AND (v_option_a->>'exceeds_count')::BIGINT = 5
      AND (v_option_c->>'failed_count')::BIGINT = 1
      AND (v_option_c->>'insufficient_evidence_count')::BIGINT = 0
      AND (v_option_c->>'exceeds_count')::BIGINT = 10);
  PERFORM pg_temp.assert_true(
    'more than 100 criteria remains complete',
    v_option_b->>'eligibility' = 'eligible'
      AND (v_option_b->>'incomplete_criterion_count')::BIGINT = 0);
  PERFORM pg_temp.assert_true(
    'missing comparison sets stay incomplete',
    v_bulk_option->>'eligibility' = 'incomplete'
      AND (v_bulk_option->>'incomplete_criterion_count')::BIGINT = 102
      AND v_bulk_option->'rank' = 'null'::JSONB);
  PERFORM pg_temp.assert_true(
    'more than 100 options exhausts across pages',
    jsonb_array_length(v_result->'data') = 100
      AND jsonb_array_length(v_page_two->'data') = 3
      AND (v_result->>'total')::BIGINT = 103
      AND v_result->>'snapshot_token' = v_page_two->>'snapshot_token');
  PERFORM pg_temp.assert_true(
    'page beyond exhaustion is empty',
    jsonb_array_length(v_page_three->'data') = 0
      AND (v_page_three->>'total')::BIGINT = 103
      AND v_page_three->>'snapshot_token' = v_result->>'snapshot_token');
  v_before_assessment_token := v_result->>'snapshot_token';
  PERFORM set_config('TimeZone', 'America/Los_Angeles', true), set_config('DateStyle', 'SQL, DMY', true);
  SELECT public.technical_configuration_reference_ranking_list(v_dossier_id, v_version_id, 1, 100)->>'snapshot_token' INTO v_after_assessment_token;
  PERFORM pg_temp.assert_true('snapshot token ignores session timestamp formatting', v_before_assessment_token = v_after_assessment_token);
  PERFORM set_config('TimeZone', 'UTC', true), set_config('DateStyle', 'ISO, MDY', true);
  PERFORM pg_temp.assert_true(
    'read path does not create comparison sets',
    (
      SELECT count(*)
      FROM public.technical_configuration_comparison_sets comparison_set
      WHERE comparison_set.dossier_id = v_dossier_id
        AND comparison_set.baseline_version_id = v_version_id
    ) = v_comparison_set_count);
  SELECT public.technical_configuration_reference_ranking_list(
    v_dossier_id, v_version_id, 1, 2
  ) INTO v_result;
  SELECT public.technical_configuration_reference_ranking_list(
    v_dossier_id, v_version_id, 2, 2
  ) INTO v_page_two;
  PERFORM pg_temp.assert_true(
    'page invariant dense ranks',
    (v_result->'data'->0->>'rank')::BIGINT = 1
      AND (v_result->'data'->1->>'rank')::BIGINT = 1
      AND (v_page_two->'data'->0->>'rank')::BIGINT = 2);
  SELECT public.technical_configuration_reference_ranking_list(
    v_dossier_id, v_empty_version_id, 1, 100
  ) INTO v_result;
  PERFORM pg_temp.assert_true(
    'zero-criterion baseline preserves option universe',
    (v_result->>'total')::BIGINT = 103
      AND jsonb_array_length(v_result->'data') = 100
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_result->'data') item
        WHERE item->>'eligibility' <> 'eligible'
           OR (item->>'incomplete_criterion_count')::BIGINT <> 0
           OR (item->>'rank')::BIGINT <> 1
      ));
  UPDATE public.technical_configuration_manual_assessments assessment
  SET evidence_axis = NULL
  WHERE assessment.comparison_set_id = v_set_c_id
    AND assessment.criterion_id = v_first_criterion_id;
  SELECT item INTO v_option_c
  FROM jsonb_array_elements(
    public.technical_configuration_reference_ranking_list(
      v_dossier_id, v_version_id, 1, 100
    )->'data'
  ) item
  WHERE item->>'option_id' = v_option_c_id::TEXT;
  PERFORM pg_temp.assert_true(
    'fails with null evidence stays incomplete',
    v_option_c->>'eligibility' = 'incomplete'
      AND (v_option_c->>'incomplete_criterion_count')::BIGINT = 1
      AND v_option_c->'rank' = 'null'::JSONB);
  UPDATE public.technical_configuration_manual_assessments assessment
  SET technical_axis = 'unclear'
  WHERE assessment.comparison_set_id = v_set_c_id
    AND assessment.criterion_id = v_first_criterion_id;
  SELECT item INTO v_option_c
  FROM jsonb_array_elements(
    public.technical_configuration_reference_ranking_list(
      v_dossier_id, v_version_id, 1, 100
    )->'data'
  ) item
  WHERE item->>'option_id' = v_option_c_id::TEXT;
  PERFORM pg_temp.assert_true(
    'unclear with null evidence stays incomplete',
    v_option_c->>'eligibility' = 'incomplete'
      AND (v_option_c->>'incomplete_criterion_count')::BIGINT = 1
      AND v_option_c->'rank' = 'null'::JSONB);
  PERFORM pg_temp.expect_error(
    'cross dossier baseline rejected',
    format(
      'SELECT public.technical_configuration_reference_ranking_list(%L::UUID, %L::UUID, 1, 100)',
      v_other_dossier_id,
      v_version_id
    ),
    'PT404',
    'not_found');
  PERFORM pg_temp.expect_error(
    'page size zero rejected',
    format(
      'SELECT public.technical_configuration_reference_ranking_list(%L::UUID, %L::UUID, 1, 0)',
      v_dossier_id,
      v_version_id
    ),
    'PT422',
    'validation_error');
  PERFORM pg_temp.expect_error(
    'page size 101 rejected',
    format(
      'SELECT public.technical_configuration_reference_ranking_list(%L::UUID, %L::UUID, 1, 101)',
      v_dossier_id,
      v_version_id
    ),
    'PT422',
    'validation_error');
  SELECT public.technical_configuration_reference_ranking_list(
    v_dossier_id, v_version_id, 1, 100
  ) INTO v_before_source_change;
  UPDATE public.technical_configuration_option_responses
  SET response_text = 'Changed response',
      supplementary_information = 'Changed supplementary information',
      updated_at = clock_timestamp(),
      updated_by = v_user_id
  WHERE id = v_response_id;
  SELECT public.technical_configuration_reference_ranking_list(
    v_dossier_id, v_version_id, 1, 100
  ) INTO v_after_source_change;
  PERFORM pg_temp.assert_true(
    'source changes after manual evaluation do not affect ranking',
    v_before_source_change = v_after_source_change);
  v_before_assessment_token := v_after_source_change->>'snapshot_token';
  UPDATE public.technical_configuration_manual_assessments assessment
  SET notes = 'Revision-only snapshot change',
      revision = assessment.revision + 1,
      updated_at = clock_timestamp(),
      updated_by = v_user_id
  WHERE assessment.comparison_set_id = v_set_a_id
    AND assessment.criterion_id = v_first_criterion_id;
  SELECT public.technical_configuration_reference_ranking_list(
    v_dossier_id, v_version_id, 2, 100
  )->>'snapshot_token' INTO v_after_assessment_token;
  PERFORM pg_temp.assert_true(
    'assessment mutation changes snapshot between pages',
    v_before_assessment_token IS DISTINCT FROM v_after_assessment_token);
END;
$gate$;
ROLLBACK;
