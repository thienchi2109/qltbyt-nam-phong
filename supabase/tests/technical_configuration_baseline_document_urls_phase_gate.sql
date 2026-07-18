-- supabase/tests/technical_configuration_baseline_document_urls_phase_gate.sql
-- Purpose: prove P7B1 URL validation, raw persistence, and validator caller contracts.
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
  v_dossier_id UUID;
  v_version_id UUID;
  v_reference_product_id UUID;
  v_baseline_document_id UUID;
  v_reference_document_id UUID;
  v_revision BIGINT := 1;
  v_revision_before BIGINT;
  v_baseline_count BIGINT;
  v_reference_count BIGINT;
  v_count BIGINT;
  v_response JSONB;
  v_list JSONB;
  v_definition TEXT;
  v_invalid_url TEXT;
  v_function_signature TEXT;
  v_function_oid OID;
  v_validator_oid OID;
  v_security_definer BOOLEAN;
  v_function_config TEXT[];
  v_callers TEXT[];
  v_expected_callers TEXT[];
  v_forbidden_identifier TEXT;
  v_raw_create_url TEXT := 'HtTpS://EXAMPLE.com/a/../spec.pdf';
  v_raw_update_url TEXT := 'hTtP://Example.COM/raw/../updated.pdf';
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_baseline_document_urls_phase_gate')
  );

  -- pg_get_functiondef proves one validator with fail-closed ACL and search_path.
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = '_technical_configuration_validate_document_url'
    AND pg_get_function_identity_arguments(p.oid) = 'p_url text'
    AND pg_get_function_result(p.oid) = 'void';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one document URL validator';
  END IF;
  v_validator_oid :=
    'public._technical_configuration_validate_document_url(text)'::regprocedure;
  SELECT p.prosecdef, p.proconfig
  INTO v_security_definer, v_function_config
  FROM pg_proc p
  WHERE p.oid = v_validator_oid;
  IF v_security_definer IS DISTINCT FROM true
     OR NOT COALESCE('search_path=public, pg_temp' = ANY(v_function_config), false) THEN
    RAISE EXCEPTION 'Validator security posture invalid';
  END IF;
  IF NOT has_function_privilege('service_role', v_validator_oid, 'EXECUTE')
     OR has_function_privilege(0::OID, v_validator_oid, 'EXECUTE')
     OR has_function_privilege('anon', v_validator_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_validator_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Validator function ACL invalid';
  END IF;
  SELECT pg_get_functiondef(v_validator_oid) INTO v_definition;
  FOREACH v_forbidden_identifier IN ARRAY ARRAY[
    'net.http', 'http_get', 'http_post', 'dblink',
    'curl', 'wget', 'create extension'
  ] LOOP
    IF position(v_forbidden_identifier IN lower(v_definition)) > 0 THEN
      RAISE EXCEPTION 'Validator uses forbidden extension/network primitive %',
        v_forbidden_identifier;
    END IF;
  END LOOP;

  -- P7B1 has four callers; P9B atomically extends the same exact set to six.
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'technical_configuration_option_document_create',
      'technical_configuration_option_document_update'
    );
  IF v_count NOT IN (0, 2) THEN
    RAISE EXCEPTION 'partial P9B validator caller deployment';
  END IF;
  IF v_count = 2 THEN
    v_expected_callers := ARRAY[
      'technical_configuration_baseline_document_create',
      'technical_configuration_baseline_document_update',
      'technical_configuration_option_document_create',
      'technical_configuration_option_document_update',
      'technical_configuration_reference_document_create',
      'technical_configuration_reference_document_update'
    ]::TEXT[];
  ELSE
    v_expected_callers := ARRAY[
      'technical_configuration_baseline_document_create',
      'technical_configuration_baseline_document_update',
      'technical_configuration_reference_document_create',
      'technical_configuration_reference_document_update'
    ]::TEXT[];
  END IF;

  SELECT array_agg(p.proname ORDER BY p.proname) INTO v_callers
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND p.oid <> v_validator_oid
    AND position(
      'public._technical_configuration_validate_document_url'
      IN pg_get_functiondef(p.oid)
    ) > 0;
  IF v_callers IS DISTINCT FROM v_expected_callers THEN
    RAISE EXCEPTION 'four-or-six validator callers mismatch: expected %, got %',
      v_expected_callers, v_callers;
  END IF;

  -- validator non-callers: list, delete, and citation RPCs.
  FOREACH v_function_signature IN ARRAY ARRAY[
    'technical_configuration_baseline_documents_list(uuid,integer,integer)',
    'technical_configuration_baseline_document_delete(uuid,bigint)',
    'technical_configuration_baseline_citation_upsert(uuid,uuid,text,text,bigint)',
    'technical_configuration_baseline_citation_delete(uuid,bigint)',
    'technical_configuration_reference_document_delete(uuid,bigint)',
    'technical_configuration_reference_citation_upsert(uuid,uuid,text,text,bigint)',
    'technical_configuration_reference_citation_delete(uuid,bigint)'
  ] LOOP
    v_function_oid := to_regprocedure('public.' || v_function_signature);
    IF v_function_oid IS NULL THEN
      RAISE EXCEPTION 'Catalog check failed: function missing %', v_function_signature;
    END IF;
    SELECT pg_get_functiondef(v_function_oid) INTO v_definition;
    IF position(
      'public._technical_configuration_validate_document_url' IN v_definition
    ) > 0 THEN
      RAISE EXCEPTION 'validator non-callers: unexpected call in %',
        v_function_signature;
    END IF;
  END LOOP;

  -- P9B non-callers are checked when present without making this gate depend on P9B.
  FOR v_function_oid IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'technical_configuration_option_documents_list',
        'technical_configuration_option_document_delete',
        'technical_configuration_option_citation_upsert',
        'technical_configuration_option_citation_delete'
      )
  LOOP
    SELECT pg_get_functiondef(v_function_oid) INTO v_definition;
    IF position(
      'public._technical_configuration_validate_document_url' IN v_definition
    ) > 0 THEN
      RAISE EXCEPTION 'validator non-callers: unexpected P9B caller %',
        v_function_oid::regprocedure;
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
  INSERT INTO public.technical_configuration_dossiers
    (device_type_name, name, description, created_by, updated_by)
  VALUES
    ('P7B1 URL device ' || v_suffix, 'P7B1 URL dossier ' || v_suffix,
     'Rolled back after URL verification', v_user_id, v_user_id)
  RETURNING id INTO v_dossier_id;
  INSERT INTO public.technical_configuration_baseline_versions
    (dossier_id, version_number, status, next_criterion_number, revision, created_by, updated_by)
  VALUES (v_dossier_id, 1, 'draft', 1, 1, v_user_id, v_user_id)
  RETURNING id INTO v_version_id;

  -- mixed-case raw equality on create
  PERFORM pg_temp.set_claims('admin', v_user_id);
  SELECT public.technical_configuration_baseline_document_create(
    v_version_id, 'Baseline raw URL', v_raw_create_url, v_revision
  ) INTO v_response;
  v_baseline_document_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  IF v_response->'data'->>'url' IS DISTINCT FROM v_raw_create_url THEN
    RAISE EXCEPTION 'mixed-case raw equality failed on baseline create';
  END IF;
  PERFORM pg_temp.set_claims('global', v_user_id);
  SELECT public.technical_configuration_reference_product_create(
    v_version_id, 'URL model', 'URL manufacturer', NULL, NULL, v_revision
  ) INTO v_response;
  v_reference_product_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  SELECT public.technical_configuration_reference_document_create(
    v_reference_product_id, 'Reference raw URL', v_raw_create_url, v_revision
  ) INTO v_response;
  v_reference_document_id := (v_response->'data'->>'id')::UUID;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  IF v_response->'data'->>'url' IS DISTINCT FROM v_raw_create_url THEN
    RAISE EXCEPTION 'mixed-case raw equality failed on reference create';
  END IF;

  -- mixed-case raw equality on update
  SELECT public.technical_configuration_baseline_document_update(
    v_baseline_document_id, 'Baseline raw URL updated', v_raw_update_url, v_revision
  ) INTO v_response;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  IF v_response->'data'->>'url' IS DISTINCT FROM v_raw_update_url THEN
    RAISE EXCEPTION 'mixed-case raw equality failed on baseline update';
  END IF;
  SELECT public.technical_configuration_reference_document_update(
    v_reference_document_id, 'Reference raw URL updated', v_raw_update_url, v_revision
  ) INTO v_response;
  v_revision := (v_response->'data'->>'revision')::BIGINT;
  IF v_response->'data'->>'url' IS DISTINCT FROM v_raw_update_url THEN
    RAISE EXCEPTION 'mixed-case raw equality failed on reference update';
  END IF;

  -- raw list equality
  SELECT public.technical_configuration_baseline_documents_list(v_version_id, 1, 50)
  INTO v_list;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_list->'data') item
    WHERE item->>'id' = v_baseline_document_id::TEXT
      AND item->>'url' = v_raw_update_url
  ) OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_list->'data') item
    WHERE item->>'id' = v_reference_document_id::TEXT
      AND item->>'url' = v_raw_update_url
  ) THEN
    RAISE EXCEPTION 'raw list equality failed';
  END IF;

  -- URL rejection matrix: relative, scheme-relative, protocol-only, single-slash,
  -- non-http, malformed, backslash, and ASCII-control values.
  FOREACH v_invalid_url IN ARRAY ARRAY[
    'relative/spec.pdf',
    '//example.com/spec.pdf',
    'https:example.com/spec.pdf',
    'https:/example.com/spec.pdf',
    'ftp://example.com/spec.pdf',
    'https://',
    'https://?q=1',
    'https://[::1',
    'https://example.com:bad',
    E'https://example.com\\spec.pdf',
    'https://exa mple.com/spec.pdf',
    'https://example.com/' || chr(10) || 'spec.pdf',
    'https://example.com/' || chr(9) || 'spec.pdf'
  ] LOOP
    SELECT revision INTO v_revision_before
    FROM public.technical_configuration_baseline_versions
    WHERE id = v_version_id;
    SELECT count(*) INTO v_baseline_count
    FROM public.technical_configuration_baseline_documents
    WHERE baseline_version_id = v_version_id;
    SELECT count(*) INTO v_reference_count
    FROM public.technical_configuration_reference_documents
    WHERE baseline_version_id = v_version_id;

    PERFORM pg_temp.expect_error(
      format('URL rejection matrix baseline create [%s]', v_invalid_url),
      format(
        'SELECT public.technical_configuration_baseline_document_create(%L::UUID, %L, %L, %s)',
        v_version_id, 'Rejected URL', v_invalid_url, v_revision_before
      ),
      'PT422', 'validation_error'
    );
    PERFORM pg_temp.expect_error(
      format('URL rejection matrix baseline update [%s]', v_invalid_url),
      format(
        'SELECT public.technical_configuration_baseline_document_update(%L::UUID, %L, %L, %s)',
        v_baseline_document_id, 'Rejected URL', v_invalid_url, v_revision_before
      ),
      'PT422', 'validation_error'
    );
    PERFORM pg_temp.expect_error(
      format('URL rejection matrix reference create [%s]', v_invalid_url),
      format(
        'SELECT public.technical_configuration_reference_document_create(%L::UUID, %L, %L, %s)',
        v_reference_product_id, 'Rejected URL', v_invalid_url, v_revision_before
      ),
      'PT422', 'validation_error'
    );
    PERFORM pg_temp.expect_error(
      format('URL rejection matrix reference update [%s]', v_invalid_url),
      format(
        'SELECT public.technical_configuration_reference_document_update(%L::UUID, %L, %L, %s)',
        v_reference_document_id, 'Rejected URL', v_invalid_url, v_revision_before
      ),
      'PT422', 'validation_error'
    );

    IF (SELECT revision FROM public.technical_configuration_baseline_versions
        WHERE id = v_version_id) <> v_revision_before THEN
      RAISE EXCEPTION 'no revision change on URL rejection';
    END IF;
    IF (SELECT count(*) FROM public.technical_configuration_baseline_documents
        WHERE baseline_version_id = v_version_id) <> v_baseline_count
       OR (SELECT count(*) FROM public.technical_configuration_reference_documents
           WHERE baseline_version_id = v_version_id) <> v_reference_count
       OR (SELECT url FROM public.technical_configuration_baseline_documents
           WHERE id = v_baseline_document_id) IS DISTINCT FROM v_raw_update_url
       OR (SELECT url FROM public.technical_configuration_reference_documents
           WHERE id = v_reference_document_id) IS DISTINCT FROM v_raw_update_url THEN
      RAISE EXCEPTION 'no data change on URL rejection';
    END IF;
  END LOOP;
END;
$gate$;

ROLLBACK;
