-- P14A4 rollback-only cross-page ordering and repeated-token runtime gate.
BEGIN;

CREATE FUNCTION pg_temp.assert_true(p_label TEXT, p_condition BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $gate$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN RAISE EXCEPTION '%', p_label; END IF;
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
  v_version_id UUID := gen_random_uuid();
  v_group_id UUID := gen_random_uuid();
  v_criterion_a_id UUID := gen_random_uuid();
  v_criterion_b_id UUID := gen_random_uuid();
  v_supplier_a_id UUID := gen_random_uuid();
  v_supplier_b_id UUID := gen_random_uuid();
  v_option_a_id UUID := gen_random_uuid();
  v_option_b_id UUID := gen_random_uuid();
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_result_export_axes_pagination_phase_gate')
  );

  SELECT nv.id INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P14A4 pagination phase gate requires one active public.nhan_vien row';
  END IF;

  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, created_by, updated_by
  ) VALUES (
    v_dossier_id,
    'P14A4 pagination device ' || v_suffix,
    'P14A4 pagination dossier ' || v_suffix,
    v_user_id,
    v_user_id
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
    v_group_id, v_version_id, 'P14A4 Pagination Group', 1, v_user_id, v_user_id
  );
  INSERT INTO public.technical_configuration_baseline_criteria (
    id, baseline_version_id, group_id, criterion_code, title, requirement_text,
    sort_order, created_by, updated_by
  ) VALUES
    (
      v_criterion_a_id, v_version_id, v_group_id, 'TC-0001',
      'Criterion A', 'Requirement A', 1, v_user_id, v_user_id
    ),
    (
      v_criterion_b_id, v_version_id, v_group_id, 'TC-0002',
      'Criterion B', 'Requirement B', 2, v_user_id, v_user_id
    );
  INSERT INTO public.technical_configuration_suppliers (
    id, dossier_id, name, created_by, updated_by
  ) VALUES
    (
      v_supplier_a_id, v_dossier_id, 'A Supplier', v_user_id, v_user_id
    ),
    (
      v_supplier_b_id, v_dossier_id, 'B Supplier', v_user_id, v_user_id
    );
  INSERT INTO public.technical_configuration_options (
    id, dossier_id, supplier_id, model, manufacturer, option_name,
    created_by, updated_by
  ) VALUES
    (
      v_option_a_id, v_dossier_id, v_supplier_a_id,
      'Model A', 'Maker A', 'Option A', v_user_id, v_user_id
    ),
    (
      v_option_b_id, v_dossier_id, v_supplier_b_id,
      'Model B', 'Maker B', 'Option B', v_user_id, v_user_id
    );

  PERFORM set_config('p14a4_pagination.user_id', v_user_id::TEXT, true);
  PERFORM set_config('p14a4_pagination.dossier_id', v_dossier_id::TEXT, true);
  PERFORM set_config('p14a4_pagination.version_id', v_version_id::TEXT, true);
  PERFORM set_config('p14a4_pagination.criterion_a_id', v_criterion_a_id::TEXT, true);
  PERFORM set_config('p14a4_pagination.criterion_b_id', v_criterion_b_id::TEXT, true);
  PERFORM set_config('p14a4_pagination.option_a_id', v_option_a_id::TEXT, true);
  PERFORM set_config('p14a4_pagination.option_b_id', v_option_b_id::TEXT, true);
END;
$gate$;

SET LOCAL ROLE authenticated;

DO $gate$
DECLARE
  v_user_id BIGINT := current_setting('p14a4_pagination.user_id')::BIGINT;
  v_dossier_id UUID := current_setting('p14a4_pagination.dossier_id')::UUID;
  v_version_id UUID := current_setting('p14a4_pagination.version_id')::UUID;
  v_criterion_a_id UUID := current_setting('p14a4_pagination.criterion_a_id')::UUID;
  v_criterion_b_id UUID := current_setting('p14a4_pagination.criterion_b_id')::UUID;
  v_option_a_id UUID := current_setting('p14a4_pagination.option_a_id')::UUID;
  v_option_b_id UUID := current_setting('p14a4_pagination.option_b_id')::UUID;
  v_option_page_1 JSONB;
  v_option_page_2 JSONB;
  v_criterion_page_1 JSONB;
  v_criterion_page_2 JSONB;
BEGIN
  PERFORM pg_temp.set_claims('global', v_user_id);

  SELECT public.technical_configuration_result_export_option_axis_list(
    v_dossier_id,
    v_version_id,
    ARRAY[v_option_b_id, v_option_a_id],
    ARRAY[v_criterion_b_id, v_criterion_a_id],
    1,
    1
  ) INTO v_option_page_1;
  SELECT public.technical_configuration_result_export_option_axis_list(
    v_dossier_id,
    v_version_id,
    ARRAY[v_option_b_id, v_option_a_id],
    ARRAY[v_criterion_b_id, v_criterion_a_id],
    2,
    1
  ) INTO v_option_page_2;
  SELECT public.technical_configuration_result_export_criterion_axis_list(
    v_dossier_id,
    v_version_id,
    ARRAY[v_option_b_id, v_option_a_id],
    ARRAY[v_criterion_b_id, v_criterion_a_id],
    1,
    1
  ) INTO v_criterion_page_1;
  SELECT public.technical_configuration_result_export_criterion_axis_list(
    v_dossier_id,
    v_version_id,
    ARRAY[v_option_b_id, v_option_a_id],
    ARRAY[v_criterion_b_id, v_criterion_a_id],
    2,
    1
  ) INTO v_criterion_page_2;

  PERFORM pg_temp.assert_true(
    'option page 1 keeps the first requested descriptor',
    v_option_page_1->>'page' = '1'
    AND v_option_page_1->>'page_size' = '1'
    AND jsonb_array_length(v_option_page_1->'data') = 1
    AND v_option_page_1->'data'->0->>'option_id' = v_option_b_id::TEXT
  );
  PERFORM pg_temp.assert_true(
    'option page 2 keeps the second requested descriptor',
    v_option_page_2->>'page' = '2'
    AND v_option_page_2->>'page_size' = '1'
    AND jsonb_array_length(v_option_page_2->'data') = 1
    AND v_option_page_2->'data'->0->>'option_id' = v_option_a_id::TEXT
  );
  PERFORM pg_temp.assert_true(
    'criterion page 1 keeps the first requested descriptor',
    v_criterion_page_1->>'page' = '1'
    AND v_criterion_page_1->>'page_size' = '1'
    AND jsonb_array_length(v_criterion_page_1->'data') = 1
    AND v_criterion_page_1->'data'->0->>'criterion_id' = v_criterion_b_id::TEXT
  );
  PERFORM pg_temp.assert_true(
    'criterion page 2 keeps the second requested descriptor',
    v_criterion_page_2->>'page' = '2'
    AND v_criterion_page_2->>'page_size' = '1'
    AND jsonb_array_length(v_criterion_page_2->'data') = 1
    AND v_criterion_page_2->'data'->0->>'criterion_id' = v_criterion_a_id::TEXT
  );
  PERFORM pg_temp.assert_true(
    'pagination repeats exact totals and tokens',
    v_option_page_1->>'total' = '2'
    AND v_option_page_2->>'total' = '2'
    AND v_criterion_page_1->>'total' = '2'
    AND v_criterion_page_2->>'total' = '2'
    AND v_option_page_1->>'snapshot_token' = v_option_page_2->>'snapshot_token'
    AND v_option_page_1->>'snapshot_token' = v_criterion_page_1->>'snapshot_token'
    AND v_option_page_1->>'snapshot_token' = v_criterion_page_2->>'snapshot_token'
    AND v_option_page_1->>'ranking_snapshot_token' =
      v_option_page_2->>'ranking_snapshot_token'
    AND v_option_page_1->>'ranking_snapshot_token' =
      v_criterion_page_1->>'ranking_snapshot_token'
    AND v_option_page_1->>'ranking_snapshot_token' =
      v_criterion_page_2->>'ranking_snapshot_token'
  );
END;
$gate$;

ROLLBACK;
