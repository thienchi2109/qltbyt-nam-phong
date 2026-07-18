-- supabase/tests/technical_configuration_baseline_documents_phase_gate.sql
-- Purpose: prove P7B1 catalog, authorization, ownership, revision, copy, and delete contracts.
-- Non-destructive: all fixture writes are wrapped in a transaction and rolled back.
BEGIN;
CREATE FUNCTION pg_temp.expect_error(
  p_label TEXT, p_statement TEXT, p_expected_state TEXT, p_expected_message TEXT
)
RETURNS VOID LANGUAGE plpgsql AS $gate$
DECLARE
  v_state TEXT;
  v_message TEXT;
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
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
DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID; v_other_dossier_id UUID;
  v_version_id UUID; v_other_version_id UUID; v_copy_version_id UUID;
  v_group_id UUID;
  v_other_group_id UUID;
  v_criterion_id UUID;
  v_other_criterion_id UUID;
  v_reference_product_id UUID;
  v_baseline_document_id UUID; v_other_document_id UUID;
  v_reference_document_id UUID; v_disposable_document_id UUID;
  v_disposable_reference_document_id UUID;
  v_baseline_citation_id UUID; v_reference_citation_id UUID;
  v_disposable_citation_id UUID;
  v_revision BIGINT := 1;
  v_revision_before BIGINT;
  v_count BIGINT;
  v_response JSONB;
  v_list JSONB;
  v_definition TEXT;
  v_table_name TEXT;
  v_function_signature TEXT;
  v_function_oid OID;
  v_security_definer BOOLEAN;
  v_function_config TEXT[];
  v_statement TEXT;
  v_statements TEXT[];
  v_forbidden_identifier TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('technical_configuration_baseline_documents_phase_gate'));
  FOREACH v_table_name IN ARRAY ARRAY[
    'technical_configuration_baseline_documents', 'technical_configuration_baseline_citations',
    'technical_configuration_reference_documents', 'technical_configuration_reference_citations'
  ] LOOP
    IF (SELECT c.relrowsecurity
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = v_table_name) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'RLS is not enabled for %', v_table_name;
    END IF;
    IF (SELECT count(*) FROM pg_policies
        WHERE schemaname = 'public' AND tablename = v_table_name) <> 0 THEN
      RAISE EXCEPTION 'Expected deny-all RLS without client policies for %', v_table_name;
    END IF;
    IF has_table_privilege(0::OID, format('public.%I', v_table_name), 'SELECT')
       OR has_table_privilege('anon', format('public.%I', v_table_name), 'SELECT')
       OR has_table_privilege('authenticated', format('public.%I', v_table_name), 'SELECT')
       OR has_table_privilege('authenticated', format('public.%I', v_table_name), 'INSERT')
       OR has_table_privilege('authenticated', format('public.%I', v_table_name), 'UPDATE')
       OR has_table_privilege('authenticated', format('public.%I', v_table_name), 'DELETE') THEN
      RAISE EXCEPTION 'Client table privilege leaked for %', v_table_name;
    END IF;
    IF NOT has_table_privilege('service_role', format('public.%I', v_table_name), 'SELECT')
       OR NOT has_table_privilege('service_role', format('public.%I', v_table_name), 'INSERT')
       OR NOT has_table_privilege('service_role', format('public.%I', v_table_name), 'UPDATE')
       OR NOT has_table_privilege('service_role', format('public.%I', v_table_name), 'DELETE') THEN
      RAISE EXCEPTION 'service_role table grant missing for %', v_table_name;
    END IF;
  END LOOP;
  FOREACH v_function_signature IN ARRAY ARRAY[
    'technical_configuration_baseline_documents_list(uuid,integer,integer)',
    'technical_configuration_baseline_document_create(uuid,text,text,bigint)',
    'technical_configuration_baseline_document_update(uuid,text,text,bigint)',
    'technical_configuration_baseline_document_delete(uuid,bigint)',
    'technical_configuration_baseline_citation_upsert(uuid,uuid,text,text,bigint)', 'technical_configuration_baseline_citation_delete(uuid,bigint)',
    'technical_configuration_reference_document_create(uuid,text,text,bigint)',
    'technical_configuration_reference_document_update(uuid,text,text,bigint)',
    'technical_configuration_reference_document_delete(uuid,bigint)',
    'technical_configuration_reference_citation_upsert(uuid,uuid,text,text,bigint)', 'technical_configuration_reference_citation_delete(uuid,bigint)'
  ] LOOP
    v_function_oid := to_regprocedure('public.' || v_function_signature);
    IF v_function_oid IS NULL THEN
      RAISE EXCEPTION 'Catalog check failed: function missing %', v_function_signature;
    END IF;
    SELECT p.prosecdef, p.proconfig
    INTO v_security_definer, v_function_config
    FROM pg_proc p
    WHERE p.oid = v_function_oid;
    IF v_security_definer IS DISTINCT FROM true
       OR NOT COALESCE('search_path=public, pg_temp' = ANY(v_function_config), false) THEN
      RAISE EXCEPTION 'Function security posture invalid for %', v_function_signature;
    END IF;
    IF NOT has_function_privilege('authenticated', v_function_oid, 'EXECUTE')
       OR has_function_privilege(0::OID, v_function_oid, 'EXECUTE')
       OR has_function_privilege('anon', v_function_oid, 'EXECUTE')
       OR has_function_privilege('service_role', v_function_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Function execute grants invalid for %', v_function_signature;
    END IF;
  END LOOP;
  SELECT nv.id INTO v_user_id FROM public.nhan_vien nv
  WHERE nv.is_active = true ORDER BY nv.id LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Setup failed: no active nhan_vien row found';
  END IF;
  INSERT INTO public.technical_configuration_dossiers
    (device_type_name, name, description, created_by, updated_by)
  VALUES ('P7B1 core device ' || v_suffix, 'P7B1 core dossier ' || v_suffix,
          'Rolled back after verification', v_user_id, v_user_id)
  RETURNING id INTO v_dossier_id;
  INSERT INTO public.technical_configuration_dossiers
    (device_type_name, name, description, created_by, updated_by)
  VALUES ('P7B1 other device ' || v_suffix, 'P7B1 other dossier ' || v_suffix,
          'Ownership and version isolation fixture', v_user_id, v_user_id)
  RETURNING id INTO v_other_dossier_id;
  INSERT INTO public.technical_configuration_baseline_versions
    (dossier_id, version_number, status, next_criterion_number, revision, created_by, updated_by)
  VALUES (v_dossier_id, 1, 'draft', 2, 1, v_user_id, v_user_id)
  RETURNING id INTO v_version_id;
  INSERT INTO public.technical_configuration_baseline_versions
    (dossier_id, version_number, status, next_criterion_number, revision, created_by, updated_by)
  VALUES (v_other_dossier_id, 1, 'draft', 2, 1, v_user_id, v_user_id)
  RETURNING id INTO v_other_version_id;
  INSERT INTO public.technical_configuration_baseline_groups
    (baseline_version_id, name, sort_order, created_by, updated_by)
  VALUES (v_version_id, 'Nhom P7B1', 1, v_user_id, v_user_id)
  RETURNING id INTO v_group_id;
  INSERT INTO public.technical_configuration_baseline_groups
    (baseline_version_id, name, sort_order, created_by, updated_by)
  VALUES (v_other_version_id, 'Nhom khac', 1, v_user_id, v_user_id)
  RETURNING id INTO v_other_group_id;
  INSERT INTO public.technical_configuration_baseline_criteria
    (baseline_version_id, group_id, criterion_code, title, requirement_text,
     sort_order, created_by, updated_by)
  VALUES (v_version_id, v_group_id, 'TC-0001', 'Nguon dien', '220V - 50Hz',
          1, v_user_id, v_user_id)
  RETURNING id INTO v_criterion_id;
  INSERT INTO public.technical_configuration_baseline_criteria
    (baseline_version_id, group_id, criterion_code, title, requirement_text,
     sort_order, created_by, updated_by)
  VALUES (v_other_version_id, v_other_group_id, 'TC-0001', 'Khac', 'Khac phien ban',
          1, v_user_id, v_user_id)
  RETURNING id INTO v_other_criterion_id;
  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error(
    'missing role claim',
    format('SELECT public.technical_configuration_baseline_documents_list(%L::UUID, 1, 50)',
           v_version_id),
    '42501', 'permission_denied'
  );
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('app_role', 'global', 'role', 'authenticated')::TEXT, true
  );
  PERFORM pg_temp.expect_error(
    'missing user claim',
    format('SELECT public.technical_configuration_baseline_documents_list(%L::UUID, 1, 50)',
           v_version_id),
    '42501', 'permission_denied'
  );
  PERFORM pg_temp.set_claims('to_qltb', v_user_id);
  PERFORM pg_temp.expect_error(
    'denied role',
    format('SELECT public.technical_configuration_baseline_documents_list(%L::UUID, 1, 50)',
           v_version_id),
    '42501', 'permission_denied'
  );
  PERFORM pg_temp.set_claims('admin', v_user_id); -- raw admin role
  SELECT public.technical_configuration_baseline_document_create(
    v_version_id, 'Baseline guide', 'https://example.com/baseline.pdf', v_revision
  ) INTO v_response;
  v_baseline_document_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  PERFORM pg_temp.set_claims('global', v_user_id); -- raw global role
  SELECT public.technical_configuration_reference_product_create(
    v_version_id, 'Model P7B1', 'Hang P7B1', NULL, NULL, v_revision
  ) INTO v_response;
  v_reference_product_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  SELECT public.technical_configuration_reference_document_create(
    v_reference_product_id, 'Reference guide', 'https://example.com/reference.pdf', v_revision
  ) INTO v_response;
  v_reference_document_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  SELECT public.technical_configuration_baseline_citation_upsert(
    v_baseline_document_id, v_criterion_id, 'p. 2', 'Nguon dien 220V', v_revision
  ) INTO v_response;
  v_baseline_citation_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  SELECT public.technical_configuration_baseline_citation_upsert(
    v_baseline_document_id, v_criterion_id, 'p. 3', 'Noi dung cap nhat', v_revision
  ) INTO v_response;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  IF (v_response->'data'->>'id')::UUID IS DISTINCT FROM v_baseline_citation_id
     OR (SELECT count(*) FROM public.technical_configuration_baseline_citations
         WHERE baseline_document_id = v_baseline_document_id
           AND criterion_id = v_criterion_id) <> 1 THEN
    RAISE EXCEPTION 'citation reuse failed';
  END IF;
  PERFORM pg_temp.expect_error(
    'ownership isolation and version isolation',
    format(
      'SELECT public.technical_configuration_baseline_citation_upsert(%L::UUID, %L::UUID, NULL, NULL, %s)',
      v_baseline_document_id, v_other_criterion_id, v_revision
    ),
    'PT422', 'validation_error'
  );
  SELECT public.technical_configuration_reference_citation_upsert(
    v_reference_document_id, v_criterion_id, 'section 4', 'Compatible', v_revision
  ) INTO v_response;
  v_reference_citation_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  SELECT public.technical_configuration_baseline_document_create(
    v_version_id, 'Second baseline guide', 'https://example.com/second.pdf', v_revision
  ) INTO v_response;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  SELECT public.technical_configuration_baseline_document_create(
    v_other_version_id, 'Other version guide', 'https://example.com/other.pdf', 1
  ) INTO v_response;
  v_other_document_id := (v_response->'data'->>'id')::UUID;
  SELECT public.technical_configuration_baseline_documents_list(v_version_id, 1, 1)
  INTO v_list;
  IF (v_list->>'page')::INTEGER <> 1
     OR (v_list->>'page_size')::INTEGER <> 1
     OR jsonb_array_length(v_list->'data') <> 1
     OR (v_list->>'total')::INTEGER <> 3 THEN
    RAISE EXCEPTION 'pagination contract failed';
  END IF;
  SELECT public.technical_configuration_baseline_documents_list(v_version_id, 1, 50)
  INTO v_list;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_list->'data') item
    WHERE item->>'id' = v_other_document_id::TEXT
  ) OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_list->'data') item
    WHERE item->>'id' = v_baseline_document_id::TEXT
      AND item->>'owner_type' = 'baseline'
      AND item->>'owner_id' = v_version_id::TEXT
      AND jsonb_array_length(item->'citations') = 1
  ) OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_list->'data') item
    WHERE item->>'id' = v_reference_document_id::TEXT
      AND item->>'owner_type' = 'reference_product'
      AND item->>'owner_id' = v_reference_product_id::TEXT
      AND jsonb_array_length(item->'citations') = 1
  ) THEN
    RAISE EXCEPTION 'version isolation failed in aggregate list';
  END IF;
  SELECT public.technical_configuration_baseline_document_create(
    v_version_id, 'Disposable baseline', 'https://example.com/disposable.pdf', v_revision
  ) INTO v_response;
  v_disposable_document_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  SELECT public.technical_configuration_baseline_citation_upsert(
    v_disposable_document_id, v_criterion_id, NULL, 'Disposable link', v_revision
  ) INTO v_response;
  v_disposable_citation_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  SELECT public.technical_configuration_baseline_citation_delete(
    v_disposable_citation_id, v_revision
  ) INTO v_response;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  SELECT public.technical_configuration_baseline_citation_upsert(
    v_disposable_document_id, v_criterion_id, NULL, 'Cascade link', v_revision
  ) INTO v_response;
  v_disposable_citation_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  SELECT public.technical_configuration_baseline_document_delete(
    v_disposable_document_id, v_revision
  ) INTO v_response;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  IF (v_response->'data'->>'affected_link_count')::INTEGER <> 1 THEN
    RAISE EXCEPTION 'affected link count failed for baseline document delete';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.technical_configuration_baseline_citations
    WHERE id = v_disposable_citation_id
  ) THEN
    RAISE EXCEPTION 'citation cascade failed for baseline document delete';
  END IF;
  SELECT public.technical_configuration_reference_document_create(
    v_reference_product_id, 'Disposable reference',
    'https://example.com/ref-disposable.pdf', v_revision
  ) INTO v_response;
  v_disposable_reference_document_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  SELECT public.technical_configuration_reference_citation_upsert(
    v_disposable_reference_document_id, v_criterion_id, NULL, 'Reference link', v_revision
  ) INTO v_response;
  v_disposable_citation_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  SELECT public.technical_configuration_reference_citation_delete(
    v_disposable_citation_id, v_revision
  ) INTO v_response;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  SELECT public.technical_configuration_reference_citation_upsert(
    v_disposable_reference_document_id, v_criterion_id, NULL, 'Reference cascade', v_revision
  ) INTO v_response;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  SELECT public.technical_configuration_reference_document_delete(
    v_disposable_reference_document_id, v_revision
  ) INTO v_response;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  IF (v_response->'data'->>'affected_link_count')::INTEGER <> 1 THEN
    RAISE EXCEPTION 'affected link count failed for reference document delete';
  END IF;
  PERFORM pg_temp.expect_error(
    'stale revision baseline update',
    format(
      'SELECT public.technical_configuration_baseline_document_update(%L::UUID, %L, %L, %s)',
      v_baseline_document_id, 'Stale', 'https://example.com/stale.pdf', v_revision - 1
    ),
    'PT409', 'stale_revision'
  );
  PERFORM pg_temp.expect_error(
    'stale revision reference citation delete',
    format(
      'SELECT public.technical_configuration_reference_citation_delete(%L::UUID, %s)',
      v_reference_citation_id, v_revision - 1
    ),
    'PT409', 'stale_revision'
  );
  v_statements := ARRAY[
    format('SELECT public.technical_configuration_baseline_document_create(%L::UUID, %L, %L, %s)', v_version_id, 'Immutable create', 'https://example.com/a.pdf', v_revision),
    format('SELECT public.technical_configuration_baseline_document_update(%L::UUID, %L, %L, %s)', v_baseline_document_id, 'Immutable update', 'https://example.com/u.pdf', v_revision),
    format('SELECT public.technical_configuration_baseline_document_delete(%L::UUID, %s)', v_baseline_document_id, v_revision),
    format('SELECT public.technical_configuration_baseline_citation_upsert(%L::UUID, %L::UUID, NULL, NULL, %s)', v_baseline_document_id, v_criterion_id, v_revision),
    format('SELECT public.technical_configuration_baseline_citation_delete(%L::UUID, %s)', v_baseline_citation_id, v_revision),
    format('SELECT public.technical_configuration_reference_document_create(%L::UUID, %L, %L, %s)', v_reference_product_id, 'Immutable create', 'https://example.com/a.pdf', v_revision),
    format('SELECT public.technical_configuration_reference_document_update(%L::UUID, %L, %L, %s)', v_reference_document_id, 'Immutable update', 'https://example.com/u.pdf', v_revision),
    format('SELECT public.technical_configuration_reference_document_delete(%L::UUID, %s)', v_reference_document_id, v_revision),
    format('SELECT public.technical_configuration_reference_citation_upsert(%L::UUID, %L::UUID, NULL, NULL, %s)', v_reference_document_id, v_criterion_id, v_revision),
    format('SELECT public.technical_configuration_reference_citation_delete(%L::UUID, %s)', v_reference_citation_id, v_revision)
  ];
  UPDATE public.technical_configuration_dossiers
  SET archived_at = now(), archived_by = v_user_id
  WHERE id = v_dossier_id;
  SELECT revision INTO v_revision_before
  FROM public.technical_configuration_baseline_versions
  WHERE id = v_version_id;
  FOREACH v_statement IN ARRAY v_statements LOOP
    PERFORM pg_temp.expect_error(
      'archived dossier mutation', v_statement, 'PT409', 'archived_dossier'
    );
  END LOOP;
  IF (SELECT revision FROM public.technical_configuration_baseline_versions
      WHERE id = v_version_id) <> v_revision_before THEN
    RAISE EXCEPTION 'archived dossier immutability failed';
  END IF;
  UPDATE public.technical_configuration_dossiers
  SET archived_at = NULL, archived_by = NULL
  WHERE id = v_dossier_id;
  UPDATE public.technical_configuration_baseline_versions
  SET status = 'locked', locked_at = now(), locked_by = v_user_id
  WHERE id = v_version_id;
  SELECT revision INTO v_revision_before
  FROM public.technical_configuration_baseline_versions
  WHERE id = v_version_id;
  FOREACH v_statement IN ARRAY v_statements LOOP
    PERFORM pg_temp.expect_error(
      'locked version mutation', v_statement, 'PT409', 'locked_version'
    );
  END LOOP;
  IF (SELECT revision FROM public.technical_configuration_baseline_versions
      WHERE id = v_version_id) <> v_revision_before THEN
    RAISE EXCEPTION 'locked version immutability failed';
  END IF;
  SELECT public.technical_configuration_baseline_copy(v_version_id, v_revision)
  INTO v_response;
  v_copy_version_id := (v_response->'data'->>'id')::UUID;
  IF v_copy_version_id IS NULL
     OR (SELECT count(*) FROM public.technical_configuration_baseline_documents
         WHERE baseline_version_id = v_copy_version_id) <> 2
     OR (SELECT count(*) FROM public.technical_configuration_reference_documents
         WHERE baseline_version_id = v_copy_version_id) <> 1 THEN
    RAISE EXCEPTION 'copy remap did not copy baseline/reference documents';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_citations citation
    JOIN public.technical_configuration_baseline_criteria criterion
      ON criterion.id = citation.criterion_id
     AND criterion.baseline_version_id = v_copy_version_id
    WHERE citation.baseline_version_id = v_copy_version_id
      AND criterion.source_criterion_id = v_criterion_id
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_reference_documents document
    JOIN public.technical_configuration_reference_products product
      ON product.id = document.reference_product_id
     AND product.baseline_version_id = v_copy_version_id
    JOIN public.technical_configuration_reference_citations citation
      ON citation.reference_document_id = document.id
     AND citation.baseline_version_id = v_copy_version_id
    JOIN public.technical_configuration_baseline_criteria criterion
      ON criterion.id = citation.criterion_id
     AND criterion.baseline_version_id = v_copy_version_id
    WHERE product.model = 'Model P7B1'
      AND document.name = 'Reference guide'
      AND criterion.source_criterion_id = v_criterion_id
  ) THEN
    RAISE EXCEPTION 'copy remap did not remap owner or criterion IDs';
  END IF;
  SELECT pg_get_functiondef(
    'public.technical_configuration_baseline_copy(uuid,bigint)'::regprocedure
  ) INTO v_definition;
  FOREACH v_forbidden_identifier IN ARRAY ARRAY[
    'technical_configuration_suppliers', 'technical_configuration_options', -- supplier exclusion; option exclusion
    'technical_configuration_comparison_sets', 'technical_configuration_option_responses', -- comparison exclusion
    'technical_configuration_option_documents', 'technical_configuration_option_citations',
    'technical_configuration_manual_assessments' -- assessment exclusion
  ] LOOP
    IF position(v_forbidden_identifier IN v_definition) > 0 THEN
      RAISE EXCEPTION 'Copy wrapper includes excluded future domain %',
        v_forbidden_identifier;
    END IF;
  END LOOP;
END;
$gate$;
ROLLBACK;
