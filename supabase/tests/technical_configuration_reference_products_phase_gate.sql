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
  v_table_name TEXT;
  v_policy_name TEXT;
  v_role_name TEXT;
  v_privilege_name TEXT;
  v_function_signature TEXT;
  v_function_oid OID;
  v_security_definer BOOLEAN;
  v_function_config TEXT[];
  v_rls_enabled BOOLEAN;
  v_forbidden_identifier TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_reference_products_phase_gate')
  );

  -- live catalog posture
  FOREACH v_table_name IN ARRAY ARRAY[
    'technical_configuration_reference_products',
    'technical_configuration_reference_responses'
  ]
  LOOP
    SELECT c.relrowsecurity INTO v_rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = v_table_name;
    IF NOT COALESCE(v_rls_enabled, false) THEN
      RAISE EXCEPTION 'Catalog check failed: RLS disabled for %', v_table_name;
    END IF;

    v_policy_name := v_table_name || '_no_client_access';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = v_table_name
        AND p.policyname = v_policy_name
        AND p.cmd = 'ALL'
        AND p.roles @> ARRAY['anon', 'authenticated']::NAME[]
        AND p.qual = 'false'
        AND p.with_check = 'false'
    ) THEN
      RAISE EXCEPTION 'Catalog check failed: deny policy missing for %', v_table_name;
    END IF;

    FOREACH v_privilege_name IN ARRAY ARRAY[
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER'
    ]
    LOOP
      FOREACH v_role_name IN ARRAY ARRAY['anon', 'authenticated']
      LOOP
        IF has_table_privilege(
          v_role_name,
          format('public.%I', v_table_name),
          v_privilege_name
        ) THEN
          RAISE EXCEPTION 'Catalog check failed: % has % on %',
            v_role_name, v_privilege_name, v_table_name;
        END IF;
      END LOOP;

      IF NOT has_table_privilege(
        'service_role',
        format('public.%I', v_table_name),
        v_privilege_name
      ) THEN
        RAISE EXCEPTION 'Catalog check failed: service_role lacks % on %',
          v_privilege_name, v_table_name;
      END IF;
    END LOOP;
  END LOOP;

  FOREACH v_function_signature IN ARRAY ARRAY[
    'technical_configuration_reference_products_list(uuid,integer,integer)',
    'technical_configuration_reference_product_create(uuid,text,text,text,text,bigint)',
    'technical_configuration_reference_product_update(uuid,text,text,text,text,bigint)',
    'technical_configuration_reference_product_delete(uuid,bigint)',
    'technical_configuration_reference_response_upsert(uuid,uuid,text,bigint)',
    'technical_configuration_baseline_copy(uuid,bigint)'
  ]
  LOOP
    v_function_oid := to_regprocedure('public.' || v_function_signature);
    IF v_function_oid IS NULL THEN
      RAISE EXCEPTION 'Catalog check failed: function missing %', v_function_signature;
    END IF;

    SELECT p.prosecdef, p.proconfig
    INTO v_security_definer, v_function_config
    FROM pg_proc p
    WHERE p.oid = v_function_oid;
    IF NOT v_security_definer
       OR NOT ('search_path=public, pg_temp' = ANY(COALESCE(v_function_config, ARRAY[]::TEXT[]))) THEN
      RAISE EXCEPTION 'Catalog check failed: security posture invalid for %',
        v_function_signature;
    END IF;

    IF NOT has_function_privilege('authenticated', v_function_oid, 'EXECUTE')
       OR has_function_privilege('anon', v_function_oid, 'EXECUTE')
       OR has_function_privilege('service_role', v_function_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Catalog check failed: function ACL invalid for %',
        v_function_signature;
    END IF;
  END LOOP;

  FOREACH v_function_signature IN ARRAY ARRAY[
    '_technical_configuration_reference_response_payload(uuid,bigint)',
    '_technical_configuration_reference_product_payload(uuid,bigint)',
    '_technical_configuration_baseline_copy_p4(uuid,bigint)'
  ]
  LOOP
    v_function_oid := to_regprocedure('public.' || v_function_signature);
    IF v_function_oid IS NULL THEN
      RAISE EXCEPTION 'Catalog check failed: internal function missing %',
        v_function_signature;
    END IF;

    SELECT p.prosecdef, p.proconfig
    INTO v_security_definer, v_function_config
    FROM pg_proc p
    WHERE p.oid = v_function_oid;
    IF NOT v_security_definer
       OR NOT ('search_path=public, pg_temp' = ANY(COALESCE(v_function_config, ARRAY[]::TEXT[])))
       OR has_function_privilege('anon', v_function_oid, 'EXECUTE')
       OR has_function_privilege('authenticated', v_function_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Catalog check failed: internal function posture invalid for %',
        v_function_signature;
    END IF;

    IF v_function_signature = '_technical_configuration_baseline_copy_p4(uuid,bigint)'
       AND has_function_privilege('service_role', v_function_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Catalog check failed: internal copy exposed to service_role';
    END IF;
  END LOOP;

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
    'archived create',
    format(
      'SELECT public.technical_configuration_reference_product_create(%L::UUID, %L, NULL, NULL, NULL, %s)',
      v_version_id,
      'Archived create',
      v_revision
    ),
    'PT409',
    'archived_dossier'
  );
  PERFORM pg_temp.expect_error(
    'archived update',
    format(
      'SELECT public.technical_configuration_reference_product_update(%L::UUID, %L, NULL, NULL, NULL, %s)',
      v_product_id,
      'Archived update',
      v_revision
    ),
    'PT409',
    'archived_dossier'
  );
  PERFORM pg_temp.expect_error(
    'archived delete',
    format(
      'SELECT public.technical_configuration_reference_product_delete(%L::UUID, %s)',
      v_product_id,
      v_revision
    ),
    'PT409',
    'archived_dossier'
  );
  PERFORM pg_temp.expect_error(
    'archived response upsert',
    format(
      'SELECT public.technical_configuration_reference_response_upsert(%L::UUID, %L::UUID, %L, %s)',
      v_product_id,
      v_criterion_id,
      'Archived response',
      v_revision
    ),
    'PT409',
    'archived_dossier'
  );
  SELECT v.revision INTO v_count
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = v_version_id;
  IF v_count <> v_revision THEN
    RAISE EXCEPTION 'Archived mutations changed the baseline revision';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.technical_configuration_reference_products p
  WHERE p.baseline_version_id = v_version_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Archived mutations changed reference products';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.technical_configuration_reference_responses r
  WHERE r.baseline_version_id = v_version_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Archived mutations changed reference responses';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_reference_products p
    WHERE p.id = v_product_id
      AND p.model = 'Model A2'
      AND p.description = 'Mô tả mới'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_reference_responses r
    WHERE r.reference_product_id = v_product_id
      AND r.criterion_id = v_criterion_id
      AND r.response_text = E'Dòng 1\nDòng 2'
  ) THEN
    RAISE EXCEPTION 'Archived mutations changed persisted values';
  END IF;
  UPDATE public.technical_configuration_dossiers
  SET archived_at = NULL, archived_by = NULL
  WHERE id = v_dossier_id;

  -- locked version
  UPDATE public.technical_configuration_baseline_versions
  SET status = 'locked', locked_at = now(), locked_by = v_user_id
  WHERE id = v_version_id;
  PERFORM pg_temp.expect_error(
    'locked create',
    format(
      'SELECT public.technical_configuration_reference_product_create(%L::UUID, %L, NULL, NULL, NULL, %s)',
      v_version_id,
      'Locked create',
      v_revision
    ),
    'PT409',
    'locked_version'
  );
  PERFORM pg_temp.expect_error(
    'locked update',
    format(
      'SELECT public.technical_configuration_reference_product_update(%L::UUID, %L, NULL, NULL, NULL, %s)',
      v_product_id,
      'Locked update',
      v_revision
    ),
    'PT409',
    'locked_version'
  );
  PERFORM pg_temp.expect_error(
    'locked delete',
    format(
      'SELECT public.technical_configuration_reference_product_delete(%L::UUID, %s)',
      v_product_id,
      v_revision
    ),
    'PT409',
    'locked_version'
  );
  PERFORM pg_temp.expect_error(
    'locked response upsert',
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
  SELECT v.revision INTO v_count
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = v_version_id;
  IF v_count <> v_revision THEN
    RAISE EXCEPTION 'Locked mutations changed the baseline revision';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.technical_configuration_reference_products p
  WHERE p.baseline_version_id = v_version_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Locked mutations changed reference products';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.technical_configuration_reference_responses r
  WHERE r.baseline_version_id = v_version_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Locked mutations changed reference responses';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_reference_products p
    WHERE p.id = v_product_id
      AND p.model = 'Model A2'
      AND p.description = 'Mô tả mới'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_reference_responses r
    WHERE r.reference_product_id = v_product_id
      AND r.criterion_id = v_criterion_id
      AND r.response_text = E'Dòng 1\nDòng 2'
  ) THEN
    RAISE EXCEPTION 'Locked mutations changed persisted values';
  END IF;

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
  -- option exclusion
  -- assessment exclusion
  -- ranking exclusion
  FOREACH v_forbidden_identifier IN ARRAY ARRAY[
    'technical_configuration_suppliers',
    'technical_configuration_options',
    'technical_configuration_comparison_sets',
    'technical_configuration_option_responses',
    'technical_configuration_option_documents',
    'technical_configuration_option_citations',
    'technical_configuration_manual_assessments'
  ]
  LOOP
    IF position(v_forbidden_identifier IN v_definition) > 0 THEN
      RAISE EXCEPTION 'Copy exclusion failed: %', v_forbidden_identifier;
    END IF;
  END LOOP;
END;
$gate$;

ROLLBACK;
