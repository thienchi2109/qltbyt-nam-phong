-- supabase/tests/technical_configuration_reference_products_phase_gate.sql
-- Purpose: prove P7A1 authorization, ownership, revision, lock, and copy invariants.
-- Non-destructive: all fixture writes are wrapped in a transaction and rolled back.
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
        p_label, p_expected_state, p_expected_message, v_state, v_message;
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
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID;
  v_other_dossier_id UUID;
  v_version_id UUID;
  v_other_version_id UUID;
  v_copy_version_id UUID;
  v_group_id UUID;
  v_other_group_id UUID;
  v_criterion_id UUID;
  v_other_criterion_id UUID;
  v_product_id UUID;
  v_second_product_id UUID;
  v_second_response_id UUID;
  v_revision BIGINT := 1;
  v_response JSONB;
  v_list JSONB;
  v_count BIGINT;
  v_definition TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_reference_products_phase_gate')
  );
  SELECT nv.id INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active = true
  ORDER BY nv.id
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Setup failed: no active nhan_vien row found';
  END IF;

  INSERT INTO public.technical_configuration_dossiers (
    device_type_name, name, description, created_by, updated_by
  )
  VALUES (
    'P7A1 device ' || v_suffix,
    'P7A1 dossier ' || v_suffix,
    'Rolled back after verification',
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_dossier_id;
  INSERT INTO public.technical_configuration_dossiers (
    device_type_name, name, description, created_by, updated_by
  )
  VALUES (
    'P7A1 other device ' || v_suffix,
    'P7A1 other dossier ' || v_suffix,
    'Cross-version fixture',
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_other_dossier_id;

  INSERT INTO public.technical_configuration_baseline_versions (
    dossier_id, version_number, status, next_criterion_number,
    revision, created_by, updated_by
  )
  VALUES (v_dossier_id, 1, 'draft', 2, 1, v_user_id, v_user_id)
  RETURNING id INTO v_version_id;
  INSERT INTO public.technical_configuration_baseline_versions (
    dossier_id, version_number, status, next_criterion_number,
    revision, created_by, updated_by
  )
  VALUES (v_other_dossier_id, 1, 'draft', 2, 1, v_user_id, v_user_id)
  RETURNING id INTO v_other_version_id;

  INSERT INTO public.technical_configuration_baseline_groups (
    baseline_version_id, name, sort_order, created_by, updated_by
  )
  VALUES (v_version_id, 'Nhóm P7A1', 1, v_user_id, v_user_id)
  RETURNING id INTO v_group_id;
  INSERT INTO public.technical_configuration_baseline_groups (
    baseline_version_id, name, sort_order, created_by, updated_by
  )
  VALUES (v_other_version_id, 'Nhóm khác', 1, v_user_id, v_user_id)
  RETURNING id INTO v_other_group_id;
  INSERT INTO public.technical_configuration_baseline_criteria (
    baseline_version_id, group_id, criterion_code, title,
    requirement_text, sort_order, created_by, updated_by
  )
  VALUES (
    v_version_id, v_group_id, 'TC-0001', 'Nguồn điện',
    '220V - 50Hz', 1, v_user_id, v_user_id
  )
  RETURNING id INTO v_criterion_id;
  INSERT INTO public.technical_configuration_baseline_criteria (
    baseline_version_id, group_id, criterion_code, title,
    requirement_text, sort_order, created_by, updated_by
  )
  VALUES (
    v_other_version_id, v_other_group_id, 'TC-0001', 'Khác',
    'Khác phiên bản', 1, v_user_id, v_user_id
  )
  RETURNING id INTO v_other_criterion_id;

  -- missing role claim
  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error(
    'missing role claim',
    format(
      'SELECT public.technical_configuration_reference_products_list(%L::UUID, 1, 50)',
      v_version_id
    ),
    '42501',
    'permission_denied'
  );

  -- missing user claim
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('app_role', 'global', 'role', 'authenticated')::TEXT,
    true
  );
  PERFORM pg_temp.expect_error(
    'missing user claim',
    format(
      'SELECT public.technical_configuration_reference_products_list(%L::UUID, 1, 50)',
      v_version_id
    ),
    '42501',
    'permission_denied'
  );

  -- denied role
  PERFORM pg_temp.set_claims('to_qltb', v_user_id);
  PERFORM pg_temp.expect_error(
    'denied role',
    format(
      'SELECT public.technical_configuration_reference_products_list(%L::UUID, 1, 50)',
      v_version_id
    ),
    '42501',
    'permission_denied'
  );

  -- raw admin role
  PERFORM pg_temp.set_claims('admin', v_user_id);
  SELECT public.technical_configuration_reference_product_create(
    v_version_id,
    'Model A',
    'Hãng A',
    'Mô tả tham chiếu',
    'Ghi chú',
    v_revision
  )
  INTO v_response;
  v_product_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  IF v_product_id IS NULL OR v_revision <> 2 THEN
    RAISE EXCEPTION 'Raw admin role did not create the first reference product';
  END IF;

  -- stale revision: create and response upsert leave no partial write
  PERFORM pg_temp.expect_error(
    'stale revision create',
    format(
      'SELECT public.technical_configuration_reference_product_create(%L::UUID, %L, NULL, NULL, NULL, 1)',
      v_version_id,
      'Stale model'
    ),
    'PT409',
    'stale_revision'
  );
  PERFORM pg_temp.expect_error(
    'stale revision response upsert',
    format(
      'SELECT public.technical_configuration_reference_response_upsert(%L::UUID, %L::UUID, %L, 1)',
      v_product_id,
      v_criterion_id,
      'Stale response'
    ),
    'PT409',
    'stale_revision'
  );
  SELECT count(*) INTO v_count
  FROM public.technical_configuration_reference_products
  WHERE baseline_version_id = v_version_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Stale create produced a partial write';
  END IF;

  PERFORM pg_temp.set_claims('global', v_user_id);
  SELECT public.technical_configuration_reference_products_list(v_version_id, 1, 50)
  INTO v_list;
  IF (v_list->>'total')::BIGINT <> 1
     OR v_list->'data'->0->>'model' <> 'Model A'
     OR v_list->'data'->0->'responses' <> '[]'::JSONB THEN
    RAISE EXCEPTION 'Reference-product list returned an invalid aggregate';
  END IF;

  SELECT public.technical_configuration_reference_response_upsert(
    v_product_id,
    v_criterion_id,
    E'Dòng 1\nDòng 2',
    v_revision
  )
  INTO v_response;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  IF v_response->'data'->>'response_text' <> E'Dòng 1\nDòng 2'
     OR v_revision <> 3 THEN
    RAISE EXCEPTION 'Reference response upsert did not preserve multiline content';
  END IF;

  -- cross-version criterion
  PERFORM pg_temp.expect_error(
    'cross-version criterion',
    format(
      'SELECT public.technical_configuration_reference_response_upsert(%L::UUID, %L::UUID, %L, %s)',
      v_product_id,
      v_other_criterion_id,
      'Sai phiên bản',
      v_revision
    ),
    'PT422',
    'validation_error'
  );

  PERFORM pg_temp.expect_error(
    'stale revision update',
    format(
      'SELECT public.technical_configuration_reference_product_update(%L::UUID, %L, %L, %L, NULL, %s)',
      v_product_id,
      'Model A',
      'Hãng A',
      'Mô tả mới',
      v_revision - 1
    ),
    'PT409',
    'stale_revision'
  );
  SELECT public.technical_configuration_reference_product_update(
    v_product_id,
    'Model A2',
    'Hãng A',
    'Mô tả mới',
    NULL,
    v_revision
  )
  INTO v_response;
  v_revision := (v_response->'data'->>'revision')::BIGINT;

  SELECT public.technical_configuration_reference_product_create(
    v_version_id,
    'Model B',
    NULL,
    NULL,
    NULL,
    v_revision
  )
  INTO v_response;
  v_second_product_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  SELECT public.technical_configuration_reference_response_upsert(
    v_second_product_id,
    v_criterion_id,
    'Sẽ cascade',
    v_revision
  )
  INTO v_response;
  v_second_response_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  PERFORM pg_temp.expect_error(
    'stale revision delete',
    format(
      'SELECT public.technical_configuration_reference_product_delete(%L::UUID, %s)',
      v_second_product_id,
      v_revision - 1
    ),
    'PT409',
    'stale_revision'
  );
  SELECT public.technical_configuration_reference_product_delete(
    v_second_product_id,
    v_revision
  )
  INTO v_response;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  IF EXISTS (
    SELECT 1
    FROM public.technical_configuration_reference_responses
    WHERE id = v_second_response_id
  ) THEN
    RAISE EXCEPTION 'Reference-product delete did not cascade responses';
  END IF;

  -- archived dossier
  UPDATE public.technical_configuration_dossiers
  SET archived_at = now(), archived_by = v_user_id
  WHERE id = v_dossier_id;
  PERFORM pg_temp.expect_error(
    'archived dossier',
    format(
      'SELECT public.technical_configuration_reference_product_update(%L::UUID, %L, NULL, NULL, NULL, %s)',
      v_product_id,
      'Archived',
      v_revision
    ),
    'PT409',
    'archived_dossier'
  );
  UPDATE public.technical_configuration_dossiers
  SET archived_at = NULL, archived_by = NULL
  WHERE id = v_dossier_id;

  -- locked version
  UPDATE public.technical_configuration_baseline_versions
  SET status = 'locked', locked_at = now(), locked_by = v_user_id
  WHERE id = v_version_id;
  PERFORM pg_temp.expect_error(
    'locked version',
    format(
      'SELECT public.technical_configuration_reference_response_upsert(%L::UUID, %L::UUID, %L, %s)',
      v_product_id,
      v_criterion_id,
      'Không được sửa',
      v_revision
    ),
    'PT409',
    'locked_version'
  );

  -- copy remapping
  SELECT public.technical_configuration_baseline_copy(v_version_id, v_revision)
  INTO v_response;
  v_copy_version_id := (v_response->'data'->>'id')::UUID;
  IF v_copy_version_id IS NULL THEN
    RAISE EXCEPTION 'Baseline copy did not return a new version';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.technical_configuration_reference_products
  WHERE baseline_version_id = v_copy_version_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Copy remapping did not clone reference products';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.technical_configuration_reference_responses copied_response
  JOIN public.technical_configuration_reference_products copied_product
    ON copied_product.id = copied_response.reference_product_id
  JOIN public.technical_configuration_baseline_criteria copied_criterion
    ON copied_criterion.id = copied_response.criterion_id
  WHERE copied_response.baseline_version_id = v_copy_version_id
    AND copied_product.id <> v_product_id
    AND copied_criterion.source_criterion_id = v_criterion_id
    AND copied_response.response_text = E'Dòng 1\nDòng 2';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Copy remapping did not remap product and criterion links';
  END IF;

  SELECT pg_get_functiondef(
    'public.technical_configuration_baseline_copy(UUID, BIGINT)'::regprocedure
  )
  INTO v_definition;
  -- supplier exclusion
  IF v_definition LIKE '%technical_configuration_suppliers%' THEN
    RAISE EXCEPTION 'Supplier exclusion failed';
  END IF;
  -- assessment exclusion
  IF v_definition LIKE '%technical_configuration_assessments%' THEN
    RAISE EXCEPTION 'Assessment exclusion failed';
  END IF;
  -- ranking exclusion
  IF v_definition LIKE '%technical_configuration_comparison_sets%' THEN
    RAISE EXCEPTION 'Ranking exclusion failed';
  END IF;
END;
$gate$;

ROLLBACK;
