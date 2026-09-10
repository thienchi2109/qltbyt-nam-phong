-- Entry 35 core-security companion; fixture-only until Chunk 6 cutover.
-- ponytail: only authorization/catalog coverage; workflow remains in the migration companion.
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
  v_dossier_id UUID;
  v_version_id UUID;
  v_baseline_document_id UUID;
  v_revision BIGINT := 1;
  v_response JSONB;
  v_table_name TEXT;
  v_function_signature TEXT;
  v_function_oid OID;
  v_security_definer BOOLEAN;
  v_function_config TEXT[];
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
    IF has_table_privilege(0::OID, format('public.%I', v_table_name), 'SELECT') OR has_table_privilege(0::OID, format('public.%I', v_table_name), 'INSERT') OR has_table_privilege(0::OID, format('public.%I', v_table_name), 'UPDATE') OR has_table_privilege(0::OID, format('public.%I', v_table_name), 'DELETE')
       OR has_table_privilege('anon', format('public.%I', v_table_name), 'SELECT') OR has_table_privilege('anon', format('public.%I', v_table_name), 'INSERT') OR has_table_privilege('anon', format('public.%I', v_table_name), 'UPDATE') OR has_table_privilege('anon', format('public.%I', v_table_name), 'DELETE')
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
    'technical_configuration_reference_citation_upsert(uuid,uuid,text,text,bigint)', 'technical_configuration_reference_citation_delete(uuid,bigint)', 'technical_configuration_baseline_copy(uuid,bigint)'
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
  INSERT INTO public.technical_configuration_baseline_versions
    (dossier_id, version_number, status, next_criterion_number, revision, created_by, updated_by)
  VALUES (v_dossier_id, 1, 'draft', 2, 1, v_user_id, v_user_id)
  RETURNING id INTO v_version_id;
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
  IF v_baseline_document_id IS NULL THEN
    RAISE EXCEPTION 'Raw admin document create authorization witness missing';
  END IF;
END;
$gate$;
ROLLBACK;
