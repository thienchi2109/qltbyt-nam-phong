-- Rollback-only P9B1 option evidence contract and behavior gate.
-- CREATE TRIGGER holds a SHARE ROW EXCLUSIVE lock on the citation table until
-- ROLLBACK, so run this gate only during a quiesced maintenance window.
BEGIN;
SET LOCAL request.jwt.claims = '{}';

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_label TEXT, p_condition BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT COALESCE(p_condition, false) THEN
    RAISE EXCEPTION 'assertion_failed: %', p_label;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.set_claims(p_role TEXT, p_user_id BIGINT)
RETURNS VOID
LANGUAGE sql
AS $$
  SELECT set_config(
    'request.jwt.claims',
    jsonb_build_object('app_role', p_role, 'user_id', p_user_id::TEXT)::TEXT,
    true
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_error(
  p_label TEXT,
  p_sql TEXT,
  p_expected_state TEXT,
  p_expected_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_state TEXT;
  v_message TEXT;
BEGIN
  BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION 'expected_error_not_raised: %', p_label;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
    IF v_state = 'P0001' AND v_message LIKE 'expected_error_not_raised:%' THEN
      RAISE;
    END IF;
    IF v_state IS DISTINCT FROM p_expected_state
       OR v_message IS DISTINCT FROM p_expected_message THEN
      RAISE EXCEPTION '% expected [%] %, got [%] %',
        p_label, p_expected_state, p_expected_message, v_state, v_message;
    END IF;
  END;
END;
$$;

DO $$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID := gen_random_uuid();
  v_archived_dossier_id UUID := gen_random_uuid();
  v_other_dossier_id UUID := gen_random_uuid();
  v_supplier_id UUID := gen_random_uuid();
  v_archived_supplier_id UUID := gen_random_uuid();
  v_other_supplier_id UUID := gen_random_uuid();
  v_option_id UUID := gen_random_uuid();
  v_archived_option_id UUID := gen_random_uuid();
  v_other_option_id UUID := gen_random_uuid();
  v_version_id UUID := gen_random_uuid();
  v_second_version_id UUID := gen_random_uuid();
  v_empty_version_id UUID := gen_random_uuid();
  v_archived_version_id UUID := gen_random_uuid();
  v_other_version_id UUID := gen_random_uuid();
  v_group_id UUID := gen_random_uuid();
  v_second_group_id UUID := gen_random_uuid();
  v_empty_group_id UUID := gen_random_uuid();
  v_archived_group_id UUID := gen_random_uuid();
  v_other_group_id UUID := gen_random_uuid();
  v_criterion_id UUID := gen_random_uuid();
  v_second_criterion_id UUID := gen_random_uuid();
  v_empty_criterion_id UUID := gen_random_uuid();
  v_archived_criterion_id UUID := gen_random_uuid();
  v_other_criterion_id UUID := gen_random_uuid();
  v_set_id UUID := gen_random_uuid();
  v_second_set_id UUID := gen_random_uuid();
  v_other_set_id UUID := gen_random_uuid();
  v_document_id UUID;
  v_citation_id UUID;
  v_response JSONB;
  v_revision BIGINT;
  v_before_count BIGINT;
  v_function_oid OID;
  v_function_signature TEXT;
  v_table_name TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_option_documents_phase_gate')
  );

  SELECT nv.id INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P9B1 phase gate requires one active public.nhan_vien row';
  END IF;

  FOREACH v_table_name IN ARRAY ARRAY[
    'technical_configuration_option_documents',
    'technical_configuration_option_citations'
  ] LOOP
    PERFORM pg_temp.assert_true(
      v_table_name || ' has RLS',
      (SELECT c.relrowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = v_table_name)
    );
    PERFORM pg_temp.assert_true(
      v_table_name || ' has zero policies',
      (SELECT count(*) = 0
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = v_table_name)
    );
    PERFORM pg_temp.assert_true(
      v_table_name || ' denies PUBLIC table access',
      NOT has_table_privilege(0::OID, format('public.%I', v_table_name), 'SELECT')
      AND NOT has_table_privilege(0::OID, format('public.%I', v_table_name), 'INSERT')
      AND NOT has_table_privilege(0::OID, format('public.%I', v_table_name), 'UPDATE')
      AND NOT has_table_privilege(0::OID, format('public.%I', v_table_name), 'DELETE')
    );
    PERFORM pg_temp.assert_true(
      v_table_name || ' denies anon table access',
      NOT has_table_privilege('anon', format('public.%I', v_table_name), 'SELECT')
      AND NOT has_table_privilege('anon', format('public.%I', v_table_name), 'INSERT')
      AND NOT has_table_privilege('anon', format('public.%I', v_table_name), 'UPDATE')
      AND NOT has_table_privilege('anon', format('public.%I', v_table_name), 'DELETE')
    );
    PERFORM pg_temp.assert_true(
      v_table_name || ' denies authenticated table access',
      NOT has_table_privilege(
        'authenticated', format('public.%I', v_table_name), 'SELECT'
      )
      AND NOT has_table_privilege(
        'authenticated', format('public.%I', v_table_name), 'INSERT'
      )
      AND NOT has_table_privilege(
        'authenticated', format('public.%I', v_table_name), 'UPDATE'
      )
      AND NOT has_table_privilege(
        'authenticated', format('public.%I', v_table_name), 'DELETE'
      )
    );
    PERFORM pg_temp.assert_true(
      v_table_name || ' allows service_role table CRUD',
      has_table_privilege('service_role', format('public.%I', v_table_name), 'SELECT')
      AND has_table_privilege(
        'service_role', format('public.%I', v_table_name), 'INSERT'
      )
      AND has_table_privilege(
        'service_role', format('public.%I', v_table_name), 'UPDATE'
      )
      AND has_table_privilege(
        'service_role', format('public.%I', v_table_name), 'DELETE'
      )
    );
  END LOOP;

  FOREACH v_function_signature IN ARRAY ARRAY[
    'technical_configuration_option_documents_list(uuid,uuid,integer,integer)',
    'technical_configuration_option_document_create(uuid,text,text,bigint)',
    'technical_configuration_option_document_update(uuid,text,text,bigint)',
    'technical_configuration_option_document_delete(uuid,bigint)',
    'technical_configuration_option_citation_upsert(uuid,uuid,uuid,text,text,bigint)',
    'technical_configuration_option_citation_delete(uuid,bigint)'
  ] LOOP
    v_function_oid := to_regprocedure('public.' || v_function_signature);
    PERFORM pg_temp.assert_true(v_function_signature || ' exists', v_function_oid IS NOT NULL);
    PERFORM pg_temp.assert_true(
      v_function_signature || ' is security definer',
      (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_function_oid)
    );
    PERFORM pg_temp.assert_true(
      v_function_signature || ' fixes search_path',
      (SELECT 'search_path=public, pg_temp' = ANY (p.proconfig)
       FROM pg_proc p WHERE p.oid = v_function_oid)
    );
    PERFORM pg_temp.assert_true(
      v_function_signature || ' denies PUBLIC function execute',
      NOT has_function_privilege(0::OID, v_function_oid, 'EXECUTE')
    );
    PERFORM pg_temp.assert_true(
      v_function_signature || ' denies anon function execute',
      NOT has_function_privilege('anon', v_function_oid, 'EXECUTE')
    );
    PERFORM pg_temp.assert_true(
      v_function_signature || ' allows authenticated function execute',
      has_function_privilege('authenticated', v_function_oid, 'EXECUTE')
    );
    PERFORM pg_temp.assert_true(
      v_function_signature || ' denies service_role function execute',
      NOT has_function_privilege('service_role', v_function_oid, 'EXECUTE')
    );
  END LOOP;

  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, archived_at, archived_by, created_by, updated_by
  ) VALUES
    (v_dossier_id, 'P9B1 device ' || v_suffix, 'P9B1 dossier ' || v_suffix,
      NULL, NULL, v_user_id, v_user_id),
    (v_archived_dossier_id, 'P9B1 archived device ' || v_suffix,
      'P9B1 archived dossier ' || v_suffix, now(), v_user_id, v_user_id, v_user_id),
    (v_other_dossier_id, 'P9B1 other device ' || v_suffix,
      'P9B1 other dossier ' || v_suffix, NULL, NULL, v_user_id, v_user_id);

  INSERT INTO public.technical_configuration_suppliers (
    id, dossier_id, name, created_by, updated_by
  ) VALUES
    (v_supplier_id, v_dossier_id, 'P9B1 Supplier', v_user_id, v_user_id),
    (v_archived_supplier_id, v_archived_dossier_id, 'P9B1 Archived Supplier',
      v_user_id, v_user_id),
    (v_other_supplier_id, v_other_dossier_id, 'P9B1 Other Supplier',
      v_user_id, v_user_id);

  INSERT INTO public.technical_configuration_options (
    id, dossier_id, supplier_id, option_name, created_by, updated_by
  ) VALUES
    (v_option_id, v_dossier_id, v_supplier_id, 'Main Option', v_user_id, v_user_id),
    (v_archived_option_id, v_archived_dossier_id, v_archived_supplier_id,
      'Archived Option', v_user_id, v_user_id),
    (v_other_option_id, v_other_dossier_id, v_other_supplier_id,
      'Other Option', v_user_id, v_user_id);

  INSERT INTO public.technical_configuration_baseline_versions (
    id, dossier_id, version_number, status, next_criterion_number, revision,
    locked_at, locked_by, created_by, updated_by
  ) VALUES
    (v_version_id, v_dossier_id, 1, 'locked', 2, 1, now(), v_user_id,
      v_user_id, v_user_id),
    (v_second_version_id, v_dossier_id, 2, 'locked', 2, 1, now(), v_user_id,
      v_user_id, v_user_id),
    (v_empty_version_id, v_dossier_id, 3, 'locked', 2, 1, now(), v_user_id,
      v_user_id, v_user_id),
    (v_archived_version_id, v_archived_dossier_id, 1, 'locked', 2, 1, now(),
      v_user_id, v_user_id, v_user_id),
    (v_other_version_id, v_other_dossier_id, 1, 'locked', 2, 1, now(), v_user_id,
      v_user_id, v_user_id);

  INSERT INTO public.technical_configuration_baseline_groups (
    id, baseline_version_id, name, sort_order, created_by, updated_by
  ) VALUES
    (v_group_id, v_version_id, 'Main Group', 1, v_user_id, v_user_id),
    (v_second_group_id, v_second_version_id, 'Second Group', 1, v_user_id, v_user_id),
    (v_empty_group_id, v_empty_version_id, 'Empty Group', 1, v_user_id, v_user_id),
    (v_archived_group_id, v_archived_version_id, 'Archived Group', 1,
      v_user_id, v_user_id),
    (v_other_group_id, v_other_version_id, 'Other Group', 1, v_user_id, v_user_id);

  INSERT INTO public.technical_configuration_baseline_criteria (
    id, baseline_version_id, group_id, criterion_code, requirement_text,
    sort_order, created_by, updated_by
  ) VALUES
    (v_criterion_id, v_version_id, v_group_id, 'TC-0001', 'Main criterion',
      1, v_user_id, v_user_id),
    (v_second_criterion_id, v_second_version_id, v_second_group_id,
      'TC-0001', 'Second criterion', 1, v_user_id, v_user_id),
    (v_empty_criterion_id, v_empty_version_id, v_empty_group_id,
      'TC-0001', 'Empty criterion', 1, v_user_id, v_user_id),
    (v_archived_criterion_id, v_archived_version_id, v_archived_group_id,
      'TC-0001', 'Archived criterion', 1, v_user_id, v_user_id),
    (v_other_criterion_id, v_other_version_id, v_other_group_id,
      'TC-0001', 'Other criterion', 1, v_user_id, v_user_id);

  INSERT INTO public.technical_configuration_comparison_sets (
    id, dossier_id, option_id, baseline_version_id, created_by, updated_by
  ) VALUES
    (v_set_id, v_dossier_id, v_option_id, v_version_id, v_user_id, v_user_id),
    (v_second_set_id, v_dossier_id, v_option_id, v_second_version_id,
      v_user_id, v_user_id),
    (v_other_set_id, v_other_dossier_id, v_other_option_id, v_other_version_id,
      v_user_id, v_user_id);

  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error(
    'missing claims rejected',
    format(
      'SELECT public.technical_configuration_option_documents_list(%L,%L,1,50)',
      v_option_id, v_version_id
    ),
    '42501', 'permission_denied'
  );
  PERFORM pg_temp.set_claims('user', v_user_id);
  PERFORM pg_temp.expect_error(
    'non-global role rejected',
    format(
      'SELECT public.technical_configuration_option_documents_list(%L,%L,1,50)',
      v_option_id, v_version_id
    ),
    '42501', 'permission_denied'
  );
  PERFORM pg_temp.expect_error(
    'unauthorized create hides missing option',
    format(
      'SELECT public.technical_configuration_option_document_create(%L,%L,%L,1)',
      gen_random_uuid(), 'Hidden guide', 'https://example.com/hidden.pdf'
    ),
    '42501', 'permission_denied'
  );
  PERFORM pg_temp.expect_error(
    'unauthorized update hides missing document',
    format(
      'SELECT public.technical_configuration_option_document_update(%L,%L,%L,1)',
      gen_random_uuid(), 'Hidden guide', 'https://example.com/hidden.pdf'
    ),
    '42501', 'permission_denied'
  );
  PERFORM pg_temp.expect_error(
    'unauthorized document delete hides missing document',
    format(
      'SELECT public.technical_configuration_option_document_delete(%L,1)',
      gen_random_uuid()
    ),
    '42501', 'permission_denied'
  );
  PERFORM pg_temp.expect_error(
    'unauthorized citation upsert hides missing document',
    format(
      'SELECT public.technical_configuration_option_citation_upsert(%L,%L,%L,NULL,NULL,1)',
      gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
    ),
    '42501', 'permission_denied'
  );
  PERFORM pg_temp.expect_error(
    'unauthorized citation delete hides missing citation',
    format(
      'SELECT public.technical_configuration_option_citation_delete(%L,1)',
      gen_random_uuid()
    ),
    '42501', 'permission_denied'
  );

  PERFORM pg_temp.set_claims('admin', v_user_id);
  v_response := public.technical_configuration_option_documents_list(
    v_option_id, v_version_id, 1, 50
  );
  PERFORM pg_temp.assert_true(
    'raw admin role accepted',
    jsonb_array_length(v_response->'data') = 0
  );

  PERFORM pg_temp.set_claims('global', v_user_id);
  v_response := public.technical_configuration_option_documents_list(
    v_archived_option_id, v_archived_version_id, 1, 50
  );
  PERFORM pg_temp.assert_true(
    'archived dossier list remains readable',
    jsonb_array_length(v_response->'data') = 0
  );

  v_response := public.technical_configuration_option_document_create(
    v_option_id, 'Shared guide', 'HtTpS://EXAMPLE.com/a/../guide.pdf', 1
  );
  v_document_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  PERFORM pg_temp.assert_true('document create bumps dossier revision', v_revision = 2);
  PERFORM pg_temp.assert_true(
    'raw accepted URL is preserved',
    v_response->'data'->>'url' = 'HtTpS://EXAMPLE.com/a/../guide.pdf'
  );

  v_response := public.technical_configuration_option_document_update(
    v_document_id, 'Shared guide updated', 'https://example.com/updated.pdf', 2
  );
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  PERFORM pg_temp.assert_true(
    'document update succeeds',
    v_revision = 3
    AND v_response->'data'->>'name' = 'Shared guide updated'
    AND v_response->'data'->>'url' = 'https://example.com/updated.pdf'
  );

  v_response := public.technical_configuration_option_citation_upsert(
    v_document_id, v_set_id, v_criterion_id, 'p. 2', 'Main excerpt', 3
  );
  v_citation_id := (v_response->'data'->>'id')::UUID;
  PERFORM pg_temp.assert_true(
    'locked baseline first citation succeeds',
    (v_response->'data'->>'revision')::BIGINT = 4
  );
  v_response := public.technical_configuration_option_citation_delete(
    v_citation_id, 4
  );
  PERFORM pg_temp.assert_true(
    'citation delete succeeds',
    (v_response->'data'->>'revision')::BIGINT = 5
    AND NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_option_citations
      WHERE id = v_citation_id
    )
  );
  v_response := public.technical_configuration_option_citation_upsert(
    v_document_id, v_set_id, v_criterion_id, 'p. 2', 'Main excerpt', 5
  );
  PERFORM pg_temp.assert_true(
    'deleted citation can be restored',
    (v_response->'data'->>'revision')::BIGINT = 6
  );
  v_response := public.technical_configuration_option_citation_upsert(
    v_document_id, v_second_set_id, v_second_criterion_id,
    'section B', 'Second excerpt', 6
  );
  PERFORM pg_temp.assert_true(
    'one document supports another locked baseline',
    (v_response->'data'->>'revision')::BIGINT = 7
  );

  v_response := public.technical_configuration_option_documents_list(
    v_option_id, v_version_id, 1, 50
  );
  PERFORM pg_temp.assert_true(
    'first baseline returns one exact citation',
    jsonb_array_length(v_response->'data'->0->'citations') = 1
    AND v_response->'data'->0->'citations'->0->>'criterion_id' = v_criterion_id::TEXT
    AND (v_response->'data'->0->>'affected_citation_count')::BIGINT = 2
  );
  v_response := public.technical_configuration_option_documents_list(
    v_option_id, v_second_version_id, 1, 50
  );
  PERFORM pg_temp.assert_true(
    'second baseline returns only its exact citation',
    jsonb_array_length(v_response->'data'->0->'citations') = 1
    AND v_response->'data'->0->'citations'->0->>'criterion_id'
      = v_second_criterion_id::TEXT
  );
  v_response := public.technical_configuration_option_documents_list(
    v_option_id, v_empty_version_id, 1, 50
  );
  PERFORM pg_temp.assert_true(
    'missing comparison set returns shared document with empty citations',
    jsonb_array_length(v_response->'data') = 1
    AND jsonb_array_length(v_response->'data'->0->'citations') = 0
  );
  v_response := public.technical_configuration_option_documents_list(
    v_option_id, v_version_id, 2147483647, 50
  );
  PERFORM pg_temp.assert_true(
    'large page remains valid',
    jsonb_array_length(v_response->'data') = 0
    AND (v_response->>'total')::BIGINT = 1
  );

  PERFORM pg_temp.expect_error(
    'cross-option comparison set rejected',
    format(
      'SELECT public.technical_configuration_option_citation_upsert(%L,%L,%L,NULL,NULL,7)',
      v_document_id, v_other_set_id, v_other_criterion_id
    ),
    'PT422', 'validation_error'
  );
  PERFORM pg_temp.expect_error(
    'cross-baseline criterion rejected',
    format(
      'SELECT public.technical_configuration_option_citation_upsert(%L,%L,%L,NULL,NULL,7)',
      v_document_id, v_set_id, v_second_criterion_id
    ),
    'PT422', 'validation_error'
  );

  SELECT count(*) INTO v_before_count
  FROM public.technical_configuration_option_documents
  WHERE option_id = v_option_id;
  PERFORM pg_temp.expect_error(
    'invalid URL performs zero writes',
    format(
      'SELECT public.technical_configuration_option_document_create(%L,%L,%L,7)',
      v_option_id, 'Invalid guide', 'ftp://example.com/invalid.pdf'
    ),
    'PT422', 'validation_error'
  );
  PERFORM pg_temp.assert_true(
    'invalid URL preserves document count and revision',
    v_before_count = (
      SELECT count(*) FROM public.technical_configuration_option_documents
      WHERE option_id = v_option_id
    )
    AND 7 = (
      SELECT revision FROM public.technical_configuration_dossiers
      WHERE id = v_dossier_id
    )
  );
  PERFORM pg_temp.expect_error(
    'stale document create performs zero writes',
    format(
      'SELECT public.technical_configuration_option_document_create(%L,%L,%L,1)',
      v_option_id, 'Stale guide', 'https://example.com/stale.pdf'
    ),
    'PT409', 'stale_revision'
  );
  PERFORM pg_temp.assert_true(
    'stale create leaves document count unchanged',
    v_before_count = (
      SELECT count(*) FROM public.technical_configuration_option_documents
      WHERE option_id = v_option_id
    )
  );
  PERFORM pg_temp.expect_error(
    'archived dossier mutation rejected',
    format(
      'SELECT public.technical_configuration_option_document_create(%L,%L,%L,1)',
      v_archived_option_id, 'Archived guide', 'https://example.com/archived.pdf'
    ),
    'PT409', 'archived_dossier'
  );

  PERFORM set_config('p9b1.failure_document', v_document_id::TEXT, true);
  PERFORM set_config('p9b1.dossier', v_dossier_id::TEXT, true);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.p9b1_fail_citation_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.option_document_id::TEXT
     = current_setting('p9b1.failure_document', true) THEN
    RAISE EXCEPTION 'injected_delete_failure';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER p9b1_fail_citation_delete
BEFORE DELETE ON public.technical_configuration_option_citations
FOR EACH ROW EXECUTE FUNCTION pg_temp.p9b1_fail_citation_delete();

-- failure injection must keep the document, citations, and revision unchanged.
SAVEPOINT option_document_delete_failure;
DO $$
DECLARE
  v_document_id UUID := current_setting('p9b1.failure_document')::UUID;
  v_dossier_id UUID := current_setting('p9b1.dossier')::UUID;
BEGIN
  PERFORM pg_temp.expect_error(
    'confirmed delete rolls back on cascade failure',
    format(
      'SELECT public.technical_configuration_option_document_delete(%L,7)',
      v_document_id
    ),
    'P0001', 'injected_delete_failure'
  );
  PERFORM pg_temp.assert_true(
    'failed delete preserves document and citations',
    EXISTS (
      SELECT 1 FROM public.technical_configuration_option_documents
      WHERE id = v_document_id
    )
    AND 2 = (
      SELECT count(*) FROM public.technical_configuration_option_citations
      WHERE option_document_id = v_document_id
    )
    AND 7 = (
      SELECT revision FROM public.technical_configuration_dossiers
      WHERE id = v_dossier_id
    )
  );
END;
$$;
ROLLBACK TO SAVEPOINT option_document_delete_failure;

DROP TRIGGER p9b1_fail_citation_delete
  ON public.technical_configuration_option_citations;
DROP FUNCTION pg_temp.p9b1_fail_citation_delete();

DO $$
DECLARE
  v_document_id UUID := current_setting('p9b1.failure_document')::UUID;
  v_response JSONB;
BEGIN
  v_response := public.technical_configuration_option_document_delete(
    v_document_id, 7
  );
  PERFORM pg_temp.assert_true(
    'confirmed delete removes document and every citation transactionally',
    (v_response->'data'->>'affected_citation_count')::BIGINT = 2
    AND (v_response->'data'->>'revision')::BIGINT = 8
    AND NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_option_documents
      WHERE id = v_document_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.technical_configuration_option_citations
      WHERE option_document_id = v_document_id
    )
  );
END;
$$;

ROLLBACK;
