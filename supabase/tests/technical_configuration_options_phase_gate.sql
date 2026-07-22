-- P8A2 rollback-only authorization, identity, revision, cascade, and grant gate.
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

CREATE FUNCTION pg_temp.assert_true(p_label TEXT, p_condition BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
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
  v_dossier_id UUID := gen_random_uuid();
  v_archived_dossier_id UUID := gen_random_uuid();
  v_cascade_dossier_id UUID := gen_random_uuid();
  v_supplier_a_id UUID := gen_random_uuid();
  v_supplier_b_id UUID := gen_random_uuid();
  v_supplier_cascade_id UUID := gen_random_uuid();
  v_archived_supplier_id UUID := gen_random_uuid();
  v_cascade_supplier_id UUID := gen_random_uuid();
  v_option_id UUID;
  v_duplicate_option_id UUID;
  v_other_option_id UUID;
  v_archived_option_id UUID := gen_random_uuid();
  v_supplier_cascade_option_id UUID := gen_random_uuid();
  v_dossier_cascade_option_id UUID := gen_random_uuid();
  v_revision BIGINT := 1;
  v_before_revision BIGINT;
  v_created_at TIMESTAMPTZ;
  v_created_by BIGINT;
  v_response JSONB;
  v_count BIGINT;
  v_rls_enabled BOOLEAN;
  v_function_signature TEXT;
  v_table_privilege TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('technical_configuration_options_phase_gate'));

  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P8A2 phase gate requires one active public.nhan_vien row';
  END IF;

  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, archived_at, archived_by, created_by, updated_by
  )
  VALUES
    (v_dossier_id, 'P8A2 device ' || v_suffix, 'P8A2 dossier ' || v_suffix,
      NULL, NULL, v_user_id, v_user_id),
    (v_archived_dossier_id, 'P8A2 archived device ' || v_suffix,
      'P8A2 archived dossier ' || v_suffix, now(), v_user_id, v_user_id, v_user_id),
    (v_cascade_dossier_id, 'P8A2 cascade device ' || v_suffix,
      'P8A2 cascade dossier ' || v_suffix, NULL, NULL, v_user_id, v_user_id);

  INSERT INTO public.technical_configuration_suppliers (
    id, dossier_id, name, created_by, updated_by
  )
  VALUES
    (v_supplier_a_id, v_dossier_id, 'Alpha Medical', v_user_id, v_user_id),
    (v_supplier_b_id, v_dossier_id, 'Beta Medical', v_user_id, v_user_id),
    (v_supplier_cascade_id, v_dossier_id, 'Cascade Medical', v_user_id, v_user_id),
    (v_archived_supplier_id, v_archived_dossier_id, 'Archived Medical',
      v_user_id, v_user_id),
    (v_cascade_supplier_id, v_cascade_dossier_id, 'Dossier Cascade Medical',
      v_user_id, v_user_id);

  INSERT INTO public.technical_configuration_baseline_versions (
    dossier_id, version_number, status, revision, locked_at, locked_by,
    created_by, updated_by
  )
  VALUES (v_dossier_id, 1, 'locked', 1, now(), v_user_id, v_user_id, v_user_id);

  INSERT INTO public.technical_configuration_options (
    id, dossier_id, supplier_id, option_name, created_by, updated_by
  )
  VALUES
    (v_archived_option_id, v_archived_dossier_id, v_archived_supplier_id,
      'Archived Option', v_user_id, v_user_id),
    (v_dossier_cascade_option_id, v_cascade_dossier_id, v_cascade_supplier_id,
      'Dossier Cascade Option', v_user_id, v_user_id);

  PERFORM pg_temp.expect_error(
    'cross-dossier supplier ownership rejected',
    format(
      'INSERT INTO public.technical_configuration_options (dossier_id, supplier_id, option_name, created_by, updated_by) VALUES (%L::UUID, %L::UUID, %L, %s, %s)',
      v_dossier_id, v_archived_supplier_id, 'Cross-dossier Option', v_user_id, v_user_id
    ),
    '23503',
    'insert or update on table "technical_configuration_options" violates foreign key constraint "technical_configuration_options_supplier_id_dossier_id_fkey"'
  );

  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error(
    'missing claims fail closed',
    format('SELECT public.technical_configuration_options_list(%L::UUID)', v_dossier_id),
    '42501', 'permission_denied'
  );

  PERFORM pg_temp.set_claims('to_qltb', v_user_id);
  PERFORM pg_temp.expect_error(
    'non-global role denied',
    format('SELECT public.technical_configuration_options_list(%L::UUID)', v_dossier_id),
    '42501', 'permission_denied'
  );

  PERFORM pg_temp.set_claims('admin', v_user_id);
  v_response := public.technical_configuration_options_list(v_dossier_id);
  PERFORM pg_temp.assert_true(
    'raw admin must read option collections',
    v_response->>'total' = '0' AND v_response->>'revision' = '1'
  );

  PERFORM pg_temp.set_claims('global', v_user_id);
  PERFORM pg_temp.expect_error(
    'bounded pagination validation',
    format(
      'SELECT public.technical_configuration_options_list(%L::UUID, NULL, 0, 50)',
      v_dossier_id
    ),
    'PT422', 'validation_error'
  );
  PERFORM pg_temp.expect_error(
    'missing supplier rejected',
    format(
      'SELECT public.technical_configuration_option_create(%L::UUID, %L, NULL, NULL, NULL, 1)',
      gen_random_uuid(), 'Model'
    ),
    'PT404', 'not_found'
  );
  PERFORM pg_temp.expect_error(
    'invalid option identity rejected',
    format(
      'SELECT public.technical_configuration_option_create(%L::UUID, %L, NULL, %L, NULL, 1)',
      v_supplier_a_id, E' \t ', E'\n'
    ),
    'PT422', 'validation_error'
  );

  v_before_revision := v_revision;
  v_response := public.technical_configuration_option_create(
    v_supplier_a_id, E' Model   X ', E' Maker   A ', 'Choice A',
    E'\t\n  line one\n  line two \n\t', v_revision
  );
  v_option_id := (v_response #>> '{data,id}')::UUID;
  v_revision := (v_response #>> '{data,revision}')::BIGINT;
  v_created_at := (v_response #>> '{data,created_at}')::TIMESTAMPTZ;
  v_created_by := (v_response #>> '{data,created_by}')::BIGINT;
  PERFORM pg_temp.assert_true(
    'current revision increments exactly once',
    v_revision = v_before_revision + 1
      AND (SELECT d.revision FROM public.technical_configuration_dossiers d
           WHERE d.id = v_dossier_id) = v_revision
  );
  PERFORM pg_temp.assert_true(
    'option create audit metadata',
    v_response #>> '{data,model}' = 'Model X'
      AND v_response #>> '{data,manufacturer}' = 'Maker A'
      AND v_response #>> '{data,notes}' = E'line one\n  line two'
      AND v_created_by = v_user_id
      AND v_response #>> '{data,updated_by}' = v_user_id::TEXT
  );

  v_response := public.technical_configuration_option_create(
    v_supplier_a_id, 'Model X', 'Maker A', 'Choice A',
    E'line one\n  line two', v_revision
  );
  v_duplicate_option_id := (v_response #>> '{data,id}')::UUID;
  v_revision := (v_response #>> '{data,revision}')::BIGINT;
  PERFORM pg_temp.assert_true(
    'multiple options under one supplier',
    v_duplicate_option_id <> v_option_id
  );
  SELECT count(*) INTO v_count
  FROM public.technical_configuration_options o
  WHERE o.supplier_id = v_supplier_a_id
    AND o.model = 'Model X'
    AND o.option_name = 'Choice A';
  PERFORM pg_temp.assert_true('duplicate option identity remains allowed', v_count = 2);

  v_response := public.technical_configuration_options_list(
    v_dossier_id, v_supplier_a_id, 2, 1
  );
  PERFORM pg_temp.assert_true(
    'option list pagination',
    v_response->>'total' = '2'
      AND v_response->>'page' = '2'
      AND v_response->>'page_size' = '1'
      AND jsonb_array_length(v_response->'data') = 1
  );

  v_response := public.technical_configuration_option_create(
    v_supplier_b_id, NULL, NULL, E' Series   B ', NULL, v_revision
  );
  v_other_option_id := (v_response #>> '{data,id}')::UUID;
  v_revision := (v_response #>> '{data,revision}')::BIGINT;

  v_response := public.technical_configuration_options_list(
    v_dossier_id, v_supplier_a_id, 1, 50
  );
  PERFORM pg_temp.assert_true(
    'supplier filtering and display labels',
    v_response->>'total' = '2'
      AND v_response #>> '{data,0,display_label}' = 'Alpha Medical · Model X'
      AND v_response #>> '{data,1,display_label}' = 'Alpha Medical · Model X'
  );
  PERFORM pg_temp.expect_error(
    'supplier filter stays dossier scoped',
    format(
      'SELECT public.technical_configuration_options_list(%L::UUID, %L::UUID, 1, 50)',
      v_dossier_id, v_archived_supplier_id
    ),
    'PT404', 'not_found'
  );

  v_response := public.technical_configuration_options_list(
    v_archived_dossier_id, v_archived_supplier_id, 1, 50
  );
  PERFORM pg_temp.assert_true(
    'archived dossier remains readable',
    v_response->>'total' = '1'
      AND v_response #>> '{data,0,display_label}'
        = 'Archived Medical · Archived Option'
  );
  PERFORM pg_temp.expect_error(
    'archived dossier rejects option mutation',
    format(
      'SELECT public.technical_configuration_option_create(%L::UUID, NULL, NULL, %L, NULL, 1)',
      v_archived_supplier_id, 'Blocked Option'
    ),
    'PT409', 'archived_dossier'
  );

  v_before_revision := v_revision;
  PERFORM pg_temp.expect_error(
    'stale option update rejected',
    format(
      'SELECT public.technical_configuration_option_update(%L::UUID, %L, NULL, NULL, NULL, %s)',
      v_option_id, 'Stale Model', v_revision - 1
    ),
    'PT409', 'stale_revision'
  );
  PERFORM pg_temp.assert_true(
    'stale revision leaves option and dossier unchanged',
    (SELECT o.model FROM public.technical_configuration_options o
     WHERE o.id = v_option_id) = 'Model X'
      AND (SELECT d.revision FROM public.technical_configuration_dossiers d
           WHERE d.id = v_dossier_id) = v_before_revision
  );

  v_response := public.technical_configuration_option_update(
    v_option_id, E' Model   Y ', E' Maker   B ', E' Choice   B ',
    E'\n\t row one\n    row two \t\n', v_revision
  );
  v_revision := (v_response #>> '{data,revision}')::BIGINT;
  PERFORM pg_temp.assert_true(
    'locked baseline does not block option mutation',
    EXISTS (
      SELECT 1 FROM public.technical_configuration_baseline_versions b
      WHERE b.dossier_id = v_dossier_id AND b.status = 'locked'
    )
      AND v_revision = v_before_revision + 1
      AND v_response #>> '{data,model}' = 'Model Y'
  );
  PERFORM pg_temp.assert_true(
    'option update preserves creation audit',
    (v_response #>> '{data,created_at}')::TIMESTAMPTZ = v_created_at
      AND (v_response #>> '{data,created_by}')::BIGINT = v_created_by
      AND v_response #>> '{data,updated_by}' = v_user_id::TEXT
      AND v_response #>> '{data,notes}' = E'row one\n    row two'
  );

  v_before_revision := v_revision;
  v_response := public.technical_configuration_option_delete(
    v_duplicate_option_id, v_revision
  );
  v_revision := (v_response #>> '{data,revision}')::BIGINT;
  PERFORM pg_temp.assert_true(
    'option delete returns id and revision',
    v_response #>> '{data,id}' = v_duplicate_option_id::TEXT
      AND v_revision = v_before_revision + 1
      AND NOT EXISTS (
        SELECT 1 FROM public.technical_configuration_options o
        WHERE o.id = v_duplicate_option_id
      )
  );

  INSERT INTO public.technical_configuration_options (
    id, dossier_id, supplier_id, option_name, created_by, updated_by
  )
  VALUES (
    v_supplier_cascade_option_id, v_dossier_id, v_supplier_cascade_id,
    'Supplier Cascade Option', v_user_id, v_user_id
  );
  DELETE FROM public.technical_configuration_suppliers
  WHERE id = v_supplier_cascade_id;
  PERFORM pg_temp.assert_true(
    'supplier delete cascades options',
    NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_options o
      WHERE o.id = v_supplier_cascade_option_id
    )
  );

  DELETE FROM public.technical_configuration_dossiers
  WHERE id = v_cascade_dossier_id;
  PERFORM pg_temp.assert_true(
    'dossier delete cascades options',
    NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_options o
      WHERE o.id = v_dossier_cascade_option_id
    )
  );

  SELECT c.relrowsecurity
  INTO v_rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'technical_configuration_options';
  PERFORM pg_temp.assert_true(
    'option RLS and deny policy enabled',
    v_rls_enabled
      AND EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename = 'technical_configuration_options'
          AND p.policyname = 'technical_configuration_options_no_client_access'
      )
  );

  FOREACH v_function_signature IN ARRAY ARRAY[
    'public.technical_configuration_options_list(UUID, UUID, INTEGER, INTEGER)',
    'public.technical_configuration_option_create(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT)',
    'public.technical_configuration_option_update(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT)',
    'public.technical_configuration_option_delete(UUID, BIGINT)'
  ]
  LOOP
    IF NOT has_function_privilege(
      'authenticated', v_function_signature, 'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'authenticated must execute %', v_function_signature;
    END IF;
    IF NOT has_function_privilege(
      'service_role', v_function_signature, 'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'service_role must execute %', v_function_signature;
    END IF;
    IF has_function_privilege(
      'anon', v_function_signature, 'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'anon/PUBLIC must not execute %', v_function_signature;
    END IF;
  END LOOP;

  FOREACH v_table_privilege IN ARRAY ARRAY[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ]
  LOOP
    IF has_table_privilege(
      'authenticated', 'public.technical_configuration_options', v_table_privilege
    ) THEN
      RAISE EXCEPTION 'authenticated must not have table privilege %', v_table_privilege;
    END IF;
    IF has_table_privilege(
      'anon', 'public.technical_configuration_options', v_table_privilege
    ) THEN
      RAISE EXCEPTION 'anon/PUBLIC must not have table privilege %', v_table_privilege;
    END IF;
    IF NOT has_table_privilege(
      'service_role', 'public.technical_configuration_options', v_table_privilege
    ) THEN
      RAISE EXCEPTION 'service_role must have table privilege %', v_table_privilege;
    END IF;
  END LOOP;
END;
$gate$;

ROLLBACK;
