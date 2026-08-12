-- P5C0 rollback-only hierarchy-aware evaluation ordering and behavior gate.
BEGIN;

CREATE FUNCTION pg_temp.assert_true(p_label TEXT, p_condition BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $gate$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', p_label;
  END IF;
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
  v_subgroup_1_id UUID := gen_random_uuid();
  v_subgroup_2_id UUID := gen_random_uuid();
  v_set_id UUID := gen_random_uuid();
  v_direct_101 UUID;
  v_subgroup_1_1 UUID;
  v_subgroup_1_97 UUID;
  v_subgroup_1_99 UUID;
  v_subgroup_2_2 UUID;
  v_subgroup_2_98 UUID;
  v_subgroup_2_100 UUID;
  v_assessment_count BIGINT;
  v_criterion_count BIGINT;
  v_subgroup_count BIGINT;
  v_assessment_snapshot JSONB;
  v_criterion_snapshot JSONB;
  v_subgroup_snapshot JSONB;
  v_result JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_evaluation_hierarchy_order_phase_gate')
  );

  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P5C0 phase gate requires one active public.nhan_vien row';
  END IF;

  INSERT INTO public.technical_configuration_dossiers (
    id,
    device_type_name,
    name,
    created_by,
    updated_by
  ) VALUES (
    v_dossier_id,
    'P5C0 device ' || v_suffix,
    'P5C0 dossier ' || v_suffix,
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
    'P5C0 Supplier',
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
    'P5C0 Option',
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
    'P5C0 Group',
    1,
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_baseline_subgroups (
    id,
    baseline_version_id,
    group_id,
    name,
    sort_order,
    created_by,
    updated_by
  ) VALUES
    (
      v_subgroup_1_id,
      v_version_id,
      v_group_id,
      'P5C0 Subgroup 1',
      1,
      v_user_id,
      v_user_id
    ),
    (
      v_subgroup_2_id,
      v_version_id,
      v_group_id,
      'P5C0 Subgroup 2',
      2,
      v_user_id,
      v_user_id
    );

  INSERT INTO public.technical_configuration_baseline_criteria (
    id,
    baseline_version_id,
    group_id,
    subgroup_id,
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
    CASE
      WHEN series = 101 THEN NULL
      WHEN series % 2 = 1 THEN v_subgroup_1_id
      ELSE v_subgroup_2_id
    END,
    'TC-' || lpad(series::TEXT, 4, '0'),
    'P5C0 criterion ' || series,
    series,
    v_user_id,
    v_user_id
  FROM generate_series(1, 101) AS series;

  SELECT id INTO v_direct_101
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_version_id
    AND subgroup_id IS NULL
    AND sort_order = 101;
  SELECT id INTO v_subgroup_1_1
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_version_id
    AND subgroup_id = v_subgroup_1_id
    AND sort_order = 1;
  SELECT id INTO v_subgroup_1_97
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_version_id
    AND subgroup_id = v_subgroup_1_id
    AND sort_order = 97;
  SELECT id INTO v_subgroup_1_99
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_version_id
    AND subgroup_id = v_subgroup_1_id
    AND sort_order = 99;
  SELECT id INTO v_subgroup_2_2
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_version_id
    AND subgroup_id = v_subgroup_2_id
    AND sort_order = 2;
  SELECT id INTO v_subgroup_2_98
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_version_id
    AND subgroup_id = v_subgroup_2_id
    AND sort_order = 98;
  SELECT id INTO v_subgroup_2_100
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_version_id
    AND subgroup_id = v_subgroup_2_id
    AND sort_order = 100;

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
    (v_set_id, v_version_id, v_direct_101, 'fails', 'complete', v_user_id, v_user_id),
    (v_set_id, v_version_id, v_subgroup_1_97, 'meets', 'partial', v_user_id, v_user_id),
    (v_set_id, v_version_id, v_subgroup_1_99, 'fails', 'complete', v_user_id, v_user_id),
    (v_set_id, v_version_id, v_subgroup_2_98, 'meets', 'missing', v_user_id, v_user_id),
    (v_set_id, v_version_id, v_subgroup_2_100, 'fails', 'missing', v_user_id, v_user_id);

  SELECT count(*) INTO v_assessment_count
  FROM public.technical_configuration_manual_assessments
  WHERE comparison_set_id = v_set_id;
  SELECT count(*) INTO v_criterion_count
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_version_id;
  SELECT count(*) INTO v_subgroup_count
  FROM public.technical_configuration_baseline_subgroups
  WHERE baseline_version_id = v_version_id;
  SELECT COALESCE(
    jsonb_agg(to_jsonb(assessment_row) ORDER BY assessment_row.criterion_id),
    '[]'::JSONB
  ) INTO v_assessment_snapshot
  FROM public.technical_configuration_manual_assessments assessment_row
  WHERE assessment_row.comparison_set_id = v_set_id;
  SELECT COALESCE(
    jsonb_agg(to_jsonb(criterion_row) ORDER BY criterion_row.id),
    '[]'::JSONB
  ) INTO v_criterion_snapshot
  FROM public.technical_configuration_baseline_criteria criterion_row
  WHERE criterion_row.baseline_version_id = v_version_id;
  SELECT COALESCE(
    jsonb_agg(to_jsonb(subgroup_row) ORDER BY subgroup_row.id),
    '[]'::JSONB
  ) INTO v_subgroup_snapshot
  FROM public.technical_configuration_baseline_subgroups subgroup_row
  WHERE subgroup_row.baseline_version_id = v_version_id;

  PERFORM pg_temp.set_claims('admin', v_user_id);
  SELECT public.technical_configuration_evaluation_criteria_list(
    v_option_id,
    v_version_id,
    'all',
    1,
    100
  ) INTO v_result;
  PERFORM pg_temp.assert_true(
    'hierarchy overrides interleaved flat order at boundaries 50/51 and 100/101',
    (v_result->>'total')::BIGINT = 101
    AND jsonb_array_length(v_result->'data') = 100
    AND (v_result->'data'->0->>'criterion_id')::UUID = v_direct_101
    AND (v_result->'data'->0->>'canonical_index')::BIGINT = 1
    AND (v_result->'data'->0->>'canonical_page')::BIGINT = 1
    AND (v_result->'data'->1->>'criterion_id')::UUID = v_subgroup_1_1
    AND (v_result->'data'->49->>'criterion_id')::UUID = v_subgroup_1_97
    AND (v_result->'data'->49->>'canonical_index')::BIGINT = 50
    AND (v_result->'data'->49->>'canonical_page')::BIGINT = 1
    AND (v_result->'data'->50->>'criterion_id')::UUID = v_subgroup_1_99
    AND (v_result->'data'->50->>'canonical_index')::BIGINT = 51
    AND (v_result->'data'->50->>'canonical_page')::BIGINT = 2
    AND (v_result->'data'->51->>'criterion_id')::UUID = v_subgroup_2_2
    AND (v_result->'data'->99->>'criterion_id')::UUID = v_subgroup_2_98
    AND (v_result->'data'->99->>'canonical_index')::BIGINT = 100
    AND (v_result->'data'->99->>'canonical_page')::BIGINT = 2
  );

  SELECT public.technical_configuration_evaluation_criteria_list(
    v_option_id,
    v_version_id,
    'all',
    2,
    100
  ) INTO v_result;
  PERFORM pg_temp.assert_true(
    'transport page two retains canonical boundary 100/101 without wrapping',
    (v_result->>'total')::BIGINT = 101
    AND jsonb_array_length(v_result->'data') = 1
    AND (v_result->'data'->0->>'criterion_id')::UUID = v_subgroup_2_100
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
    'filter keeps sparse canonical indexes and pages from the full hierarchy',
    (v_result->>'total')::BIGINT = 3
    AND jsonb_array_length(v_result->'data') = 3
    AND (v_result->'data'->0->>'criterion_id')::UUID = v_direct_101
    AND (v_result->'data'->0->>'canonical_index')::BIGINT = 1
    AND (v_result->'data'->0->>'canonical_page')::BIGINT = 1
    AND (v_result->'data'->1->>'criterion_id')::UUID = v_subgroup_1_99
    AND (v_result->'data'->1->>'canonical_index')::BIGINT = 51
    AND (v_result->'data'->1->>'canonical_page')::BIGINT = 2
    AND (v_result->'data'->2->>'criterion_id')::UUID = v_subgroup_2_100
    AND (v_result->'data'->2->>'canonical_index')::BIGINT = 101
    AND (v_result->'data'->2->>'canonical_page')::BIGINT = 3
  );

  SELECT public.technical_configuration_evaluation_criteria_list(
    v_option_id,
    v_version_id,
    'insufficient_evidence',
    1,
    100
  ) INTO v_result;
  PERFORM pg_temp.assert_true(
    'evidence filter preserves hierarchy order across comparison pages',
    (v_result->>'total')::BIGINT = 2
    AND (v_result->'data'->0->>'criterion_id')::UUID = v_subgroup_1_97
    AND (v_result->'data'->0->>'canonical_index')::BIGINT = 50
    AND (v_result->'data'->1->>'criterion_id')::UUID = v_subgroup_2_98
    AND (v_result->'data'->1->>'canonical_index')::BIGINT = 100
  );

  PERFORM pg_temp.assert_true(
    'evaluation hierarchy reads do not mutate phase-gate data',
    (
      SELECT count(*) = v_assessment_count
      FROM public.technical_configuration_manual_assessments
      WHERE comparison_set_id = v_set_id
    )
    AND (
      SELECT count(*) = v_criterion_count
      FROM public.technical_configuration_baseline_criteria
      WHERE baseline_version_id = v_version_id
    )
    AND (
      SELECT count(*) = v_subgroup_count
      FROM public.technical_configuration_baseline_subgroups
      WHERE baseline_version_id = v_version_id
    )
    AND (
      SELECT COALESCE(
        jsonb_agg(to_jsonb(assessment_row) ORDER BY assessment_row.criterion_id),
        '[]'::JSONB
      ) = v_assessment_snapshot
      FROM public.technical_configuration_manual_assessments assessment_row
      WHERE assessment_row.comparison_set_id = v_set_id
    )
    AND (
      SELECT COALESCE(
        jsonb_agg(to_jsonb(criterion_row) ORDER BY criterion_row.id),
        '[]'::JSONB
      ) = v_criterion_snapshot
      FROM public.technical_configuration_baseline_criteria criterion_row
      WHERE criterion_row.baseline_version_id = v_version_id
    )
    AND (
      SELECT COALESCE(
        jsonb_agg(to_jsonb(subgroup_row) ORDER BY subgroup_row.id),
        '[]'::JSONB
      ) = v_subgroup_snapshot
      FROM public.technical_configuration_baseline_subgroups subgroup_row
      WHERE subgroup_row.baseline_version_id = v_version_id
    )
  );

END;
$gate$;

ROLLBACK;
