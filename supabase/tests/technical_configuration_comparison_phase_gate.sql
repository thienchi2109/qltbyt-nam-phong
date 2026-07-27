-- Rollback-only P10A1 comparison read behavior, privilege, and performance gate.
BEGIN;
SET LOCAL request.jwt.claims = '{}';

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_label TEXT, p_condition BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
BEGIN
  IF NOT COALESCE(p_condition, false) THEN
    RAISE EXCEPTION 'assertion_failed: %', p_label;
  END IF;
END;
$gate$;

CREATE OR REPLACE FUNCTION pg_temp.assert_keys(
  p_label TEXT,
  p_value JSONB,
  p_expected TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
DECLARE
  v_actual TEXT[];
  v_expected TEXT[];
BEGIN
  SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::TEXT[])
  INTO v_actual
  FROM jsonb_object_keys(p_value) AS keys(key);

  SELECT COALESCE(array_agg(key ORDER BY key), ARRAY[]::TEXT[])
  INTO v_expected
  FROM unnest(p_expected) AS keys(key);

  IF v_actual IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION '%: expected keys %, got %', p_label, v_expected, v_actual;
  END IF;
END;
$gate$;

CREATE OR REPLACE FUNCTION pg_temp.set_claims(p_role TEXT, p_user_id BIGINT)
RETURNS VOID
LANGUAGE sql
AS $gate$
  SELECT set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', p_role,
      'role', 'authenticated',
      'user_id', p_user_id::TEXT,
      'sub', p_user_id::TEXT
    )::TEXT,
    true
  );
$gate$;

CREATE OR REPLACE FUNCTION pg_temp.expect_error(
  p_label TEXT,
  p_sql TEXT,
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
    EXECUTE p_sql;
    RAISE EXCEPTION 'expected_error_not_raised: %', p_label;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_state = RETURNED_SQLSTATE,
      v_message = MESSAGE_TEXT;
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
$gate$;

DO $gate$
DECLARE
  v_suffix TEXT := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
  v_user_id BIGINT;
  v_dossier_id UUID := gen_random_uuid();
  v_other_dossier_id UUID := gen_random_uuid();
  v_baseline_version_id UUID := gen_random_uuid();
  v_other_baseline_version_id UUID := gen_random_uuid();
  v_supplier_id UUID := gen_random_uuid();
  v_other_supplier_id UUID := gen_random_uuid();
  v_other_option_id UUID := gen_random_uuid();
  v_other_group_id UUID := gen_random_uuid();
  v_other_criterion_id UUID := gen_random_uuid();
  v_group_ids UUID[];
  v_option_ids UUID[];
  v_first_criterion_id UUID;
  v_second_criterion_id UUID;
  v_first_set_id UUID;
  v_second_set_id UUID;
  v_baseline_document_id UUID := gen_random_uuid();
  v_unused_baseline_document_id UUID := gen_random_uuid();
  v_first_option_document_id UUID := gen_random_uuid();
  v_unused_option_document_id UUID := gen_random_uuid();
  v_second_option_document_id UUID := gen_random_uuid();
  v_response JSONB;
  v_first_criterion JSONB;
  v_first_option_value JSONB;
  v_second_option_value JSONB;
  v_before_revision BIGINT;
  v_before_updated_at TIMESTAMPTZ;
  v_before_updated_by BIGINT;
  v_before_set_updated_at TIMESTAMPTZ;
  v_before_set_updated_by BIGINT;
  v_before_set_count BIGINT;
  v_before_response_count BIGINT;
  v_plan JSONB;
  v_max_actual_rows NUMERIC;
  v_function_oid OID;
  v_function_config TEXT[];
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_comparison_phase_gate')
  );

  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P10A1 phase gate requires one active public.nhan_vien row';
  END IF;

  v_function_oid := to_regprocedure(
    'public.technical_configuration_comparison_get(uuid,uuid[],integer,integer)'
  );
  PERFORM pg_temp.assert_true('comparison RPC exists', v_function_oid IS NOT NULL);
  PERFORM pg_temp.assert_true(
    'comparison RPC is security definer',
    (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_function_oid)
  );
  SELECT p.proconfig
  INTO v_function_config
  FROM pg_proc p
  WHERE p.oid = v_function_oid;
  PERFORM pg_temp.assert_true(
    'fixed search_path',
    'search_path=public, pg_temp' = ANY (v_function_config)
  );
  PERFORM pg_temp.assert_true(
    'anon cannot execute comparison RPC',
    NOT has_function_privilege('anon', v_function_oid, 'EXECUTE')
  );
  PERFORM pg_temp.assert_true(
    'authenticated executes comparison RPC',
    has_function_privilege('authenticated', v_function_oid, 'EXECUTE')
  );
  PERFORM pg_temp.assert_true(
    'service role cannot execute comparison RPC',
    NOT has_function_privilege('service_role', v_function_oid, 'EXECUTE')
  );
  PERFORM pg_temp.assert_true(
    'PUBLIC cannot execute comparison RPC',
    NOT has_function_privilege(0::OID, v_function_oid, 'EXECUTE')
  );

  INSERT INTO public.technical_configuration_dossiers (
    id,
    device_type_name,
    name,
    revision,
    archived_at,
    archived_by,
    created_by,
    updated_by
  )
  VALUES
    (
      v_dossier_id,
      'P10A1 device ' || v_suffix,
      'P10A1 dossier ' || v_suffix,
      7,
      now(),
      v_user_id,
      v_user_id,
      v_user_id
    ),
    (
      v_other_dossier_id,
      'P10A1 other device ' || v_suffix,
      'P10A1 other dossier ' || v_suffix,
      1,
      NULL,
      NULL,
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
  )
  VALUES
    (
      v_baseline_version_id,
      v_dossier_id,
      1,
      'locked',
      501,
      3,
      now(),
      v_user_id,
      v_user_id,
      v_user_id
    ),
    (
      v_other_baseline_version_id,
      v_other_dossier_id,
      1,
      'locked',
      2,
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
  )
  SELECT
    gen_random_uuid(),
    v_baseline_version_id,
    'Group ' || lpad(series.group_number::TEXT, 2, '0'),
    series.group_number,
    v_user_id,
    v_user_id
  FROM generate_series(1, 5) AS series(group_number);

  SELECT array_agg(g.id ORDER BY g.sort_order)
  INTO v_group_ids
  FROM public.technical_configuration_baseline_groups g
  WHERE g.baseline_version_id = v_baseline_version_id;

  INSERT INTO public.technical_configuration_baseline_groups (
    id,
    baseline_version_id,
    name,
    sort_order,
    created_by,
    updated_by
  )
  VALUES (
    v_other_group_id,
    v_other_baseline_version_id,
    'Other Group',
    1,
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_baseline_criteria (
    id,
    baseline_version_id,
    group_id,
    criterion_code,
    title,
    requirement_text,
    sort_order,
    created_by,
    updated_by
  )
  SELECT
    gen_random_uuid(),
    v_baseline_version_id,
    v_group_ids[((series.criterion_number - 1) / 100) + 1],
    'TC-' || lpad(series.criterion_number::TEXT, 4, '0'),
    CASE
      WHEN series.criterion_number = 1 THEN 'First title'
      ELSE NULL
    END,
    'Requirement ' || series.criterion_number,
    ((series.criterion_number - 1) % 100) + 1,
    v_user_id,
    v_user_id
  FROM generate_series(1, 500) AS series(criterion_number);

  SELECT c.id
  INTO v_first_criterion_id
  FROM public.technical_configuration_baseline_criteria c
  WHERE c.baseline_version_id = v_baseline_version_id
    AND c.criterion_code = 'TC-0001';

  SELECT c.id
  INTO v_second_criterion_id
  FROM public.technical_configuration_baseline_criteria c
  WHERE c.baseline_version_id = v_baseline_version_id
    AND c.criterion_code = 'TC-0002';

  INSERT INTO public.technical_configuration_baseline_criteria (
    id,
    baseline_version_id,
    group_id,
    criterion_code,
    requirement_text,
    sort_order,
    created_by,
    updated_by
  )
  VALUES (
    v_other_criterion_id,
    v_other_baseline_version_id,
    v_other_group_id,
    'TC-0001',
    'Other requirement',
    1,
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_suppliers (
    id,
    dossier_id,
    name,
    created_by,
    updated_by
  )
  VALUES
    (
      v_supplier_id,
      v_dossier_id,
      'P10A1 Supplier',
      v_user_id,
      v_user_id
    ),
    (
      v_other_supplier_id,
      v_other_dossier_id,
      'P10A1 Other Supplier',
      v_user_id,
      v_user_id
    );

  INSERT INTO public.technical_configuration_options (
    id,
    dossier_id,
    supplier_id,
    model,
    manufacturer,
    option_name,
    created_by,
    updated_by
  )
  SELECT
    gen_random_uuid(),
    v_dossier_id,
    v_supplier_id,
    CASE WHEN series.option_number % 2 = 0
      THEN 'Model ' || lpad(series.option_number::TEXT, 2, '0')
      ELSE NULL
    END,
    CASE WHEN series.option_number = 1 THEN 'Maker 01' ELSE NULL END,
    CASE WHEN series.option_number % 2 = 1
      THEN 'Option ' || lpad(series.option_number::TEXT, 2, '0')
      ELSE NULL
    END,
    v_user_id,
    v_user_id
  FROM generate_series(1, 50) AS series(option_number);

  SELECT array_agg(
    o.id
    ORDER BY COALESCE(o.model, o.option_name), o.id
  )
  INTO v_option_ids
  FROM public.technical_configuration_options o
  WHERE o.dossier_id = v_dossier_id;

  INSERT INTO public.technical_configuration_options (
    id,
    dossier_id,
    supplier_id,
    option_name,
    created_by,
    updated_by
  )
  VALUES (
    v_other_option_id,
    v_other_dossier_id,
    v_other_supplier_id,
    'Other Option',
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_comparison_sets (
    id,
    dossier_id,
    option_id,
    baseline_version_id,
    created_by,
    updated_by
  )
  SELECT
    gen_random_uuid(),
    v_dossier_id,
    requested.option_id,
    v_baseline_version_id,
    v_user_id,
    v_user_id
  FROM unnest(v_option_ids[1:8]) AS requested(option_id);

  SELECT cs.id
  INTO v_first_set_id
  FROM public.technical_configuration_comparison_sets cs
  WHERE cs.option_id = v_option_ids[1]
    AND cs.baseline_version_id = v_baseline_version_id;

  SELECT cs.id
  INTO v_second_set_id
  FROM public.technical_configuration_comparison_sets cs
  WHERE cs.option_id = v_option_ids[2]
    AND cs.baseline_version_id = v_baseline_version_id;

  INSERT INTO public.technical_configuration_option_responses (
    comparison_set_id,
    baseline_version_id,
    criterion_id,
    response_text,
    supplementary_information,
    created_by,
    updated_by
  )
  VALUES
    (
      v_first_set_id,
      v_baseline_version_id,
      v_first_criterion_id,
      E'Response line 1\nResponse line 2',
      E'Supplement line 1\nSupplement line 2',
      v_user_id,
      v_user_id
    ),
    (
      v_second_set_id,
      v_baseline_version_id,
      v_first_criterion_id,
      'Second response',
      '',
      v_user_id,
      v_user_id
    );

  INSERT INTO public.technical_configuration_baseline_documents (
    id,
    baseline_version_id,
    name,
    url,
    created_by,
    updated_by
  )
  VALUES
    (
      v_baseline_document_id,
      v_baseline_version_id,
      'Baseline cited document',
      'https://example.com/baseline-cited.pdf',
      v_user_id,
      v_user_id
    ),
    (
      v_unused_baseline_document_id,
      v_baseline_version_id,
      'Baseline uncited document',
      'https://example.com/baseline-uncited.pdf',
      v_user_id,
      v_user_id
    );

  INSERT INTO public.technical_configuration_baseline_citations (
    baseline_version_id,
    baseline_document_id,
    criterion_id,
    page_section,
    excerpt,
    created_by,
    updated_by
  )
  VALUES (
    v_baseline_version_id,
    v_baseline_document_id,
    v_first_criterion_id,
    'p. 1',
    'Baseline excerpt',
    v_user_id,
    v_user_id
  );

  INSERT INTO public.technical_configuration_option_documents (
    id,
    option_id,
    name,
    url,
    created_by,
    updated_by
  )
  VALUES
    (
      v_first_option_document_id,
      v_option_ids[1],
      'First option cited document',
      'https://example.com/option-one-cited.pdf',
      v_user_id,
      v_user_id
    ),
    (
      v_unused_option_document_id,
      v_option_ids[1],
      'First option uncited document',
      'https://example.com/option-one-uncited.pdf',
      v_user_id,
      v_user_id
    ),
    (
      v_second_option_document_id,
      v_option_ids[2],
      'Second option cited document',
      'https://example.com/option-two-cited.pdf',
      v_user_id,
      v_user_id
    );

  INSERT INTO public.technical_configuration_option_citations (
    option_id,
    baseline_version_id,
    comparison_set_id,
    option_document_id,
    criterion_id,
    page_section,
    excerpt,
    created_by,
    updated_by
  )
  VALUES
    (
      v_option_ids[1],
      v_baseline_version_id,
      v_first_set_id,
      v_first_option_document_id,
      v_first_criterion_id,
      'section 1',
      'First option excerpt',
      v_user_id,
      v_user_id
    ),
    (
      v_option_ids[2],
      v_baseline_version_id,
      v_second_set_id,
      v_second_option_document_id,
      v_first_criterion_id,
      'section 2',
      'Second option excerpt',
      v_user_id,
      v_user_id
    );

  SELECT d.revision, d.updated_at, d.updated_by
  INTO v_before_revision, v_before_updated_at, v_before_updated_by
  FROM public.technical_configuration_dossiers d
  WHERE d.id = v_dossier_id;

  SELECT cs.updated_at, cs.updated_by
  INTO v_before_set_updated_at, v_before_set_updated_by
  FROM public.technical_configuration_comparison_sets cs
  WHERE cs.id = v_first_set_id;

  SELECT count(*)
  INTO v_before_set_count
  FROM public.technical_configuration_comparison_sets cs
  WHERE cs.dossier_id = v_dossier_id;

  SELECT count(*)
  INTO v_before_response_count
  FROM public.technical_configuration_option_responses r
  WHERE r.baseline_version_id = v_baseline_version_id;

  -- missing role rejected
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('user_id', v_user_id::TEXT)::TEXT,
    true
  );
  PERFORM pg_temp.expect_error(
    'missing role rejected',
    format(
      'SELECT public.technical_configuration_comparison_get(%L::UUID,%L::UUID[],1,100)',
      v_baseline_version_id,
      v_option_ids[1:1]
    ),
    '42501',
    'permission_denied'
  );

  -- empty user id rejected
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('app_role', 'global', 'user_id', '')::TEXT,
    true
  );
  PERFORM pg_temp.expect_error(
    'empty user id rejected',
    format(
      'SELECT public.technical_configuration_comparison_get(%L::UUID,%L::UUID[],1,100)',
      v_baseline_version_id,
      v_option_ids[1:1]
    ),
    '42501',
    'permission_denied'
  );

  -- disallowed role rejected
  PERFORM pg_temp.set_claims('to_qltb', v_user_id);
  PERFORM pg_temp.expect_error(
    'disallowed role rejected',
    format(
      'SELECT public.technical_configuration_comparison_get(%L::UUID,%L::UUID[],1,100)',
      v_baseline_version_id,
      v_option_ids[1:1]
    ),
    '42501',
    'permission_denied'
  );

  -- raw admin accepted
  PERFORM pg_temp.set_claims('admin', v_user_id);
  v_response := public.technical_configuration_comparison_get(
    v_baseline_version_id,
    v_option_ids[1:1],
    1,
    1
  );
  PERFORM pg_temp.assert_true(
    'raw admin accepted',
    jsonb_array_length(v_response->'data'->'criteria') = 1
  );

  -- raw global accepted
  PERFORM pg_temp.set_claims('global', v_user_id);
  v_response := public.technical_configuration_comparison_get(
    v_baseline_version_id,
    v_option_ids[1:1],
    1,
    1
  );
  PERFORM pg_temp.assert_true(
    'raw global accepted',
    jsonb_array_length(v_response->'data'->'criteria') = 1
  );

  -- null baseline rejected
  PERFORM pg_temp.expect_error(
    'null baseline rejected',
    format(
      'SELECT public.technical_configuration_comparison_get(NULL,%L::UUID[],1,100)',
      v_option_ids[1:1]
    ),
    'PT422',
    'validation_error'
  );

  -- null options rejected
  PERFORM pg_temp.expect_error(
    'null options rejected',
    format(
      'SELECT public.technical_configuration_comparison_get(%L::UUID,NULL,1,100)',
      v_baseline_version_id
    ),
    'PT422',
    'validation_error'
  );

  -- empty options rejected
  PERFORM pg_temp.expect_error(
    'empty options rejected',
    format(
      'SELECT public.technical_configuration_comparison_get(%L::UUID,ARRAY[]::UUID[],1,100)',
      v_baseline_version_id
    ),
    'PT422',
    'validation_error'
  );

  -- null option element rejected
  PERFORM pg_temp.expect_error(
    'null option element rejected',
    format(
      'SELECT public.technical_configuration_comparison_get(%L::UUID,ARRAY[%L::UUID,NULL]::UUID[],1,100)',
      v_baseline_version_id,
      v_option_ids[1]
    ),
    'PT422',
    'validation_error'
  );

  -- duplicate options rejected
  PERFORM pg_temp.expect_error(
    'duplicate options rejected',
    format(
      'SELECT public.technical_configuration_comparison_get(%L::UUID,ARRAY[%L::UUID,%L::UUID],1,100)',
      v_baseline_version_id,
      v_option_ids[1],
      v_option_ids[1]
    ),
    'PT422',
    'validation_error'
  );

  -- nine options rejected
  PERFORM pg_temp.expect_error(
    'nine options rejected',
    format(
      'SELECT public.technical_configuration_comparison_get(%L::UUID,%L::UUID[],1,100)',
      v_baseline_version_id,
      v_option_ids[1:9]
    ),
    'PT422',
    'validation_error'
  );

  -- null page rejected
  PERFORM pg_temp.expect_error(
    'null page rejected',
    format(
      'SELECT public.technical_configuration_comparison_get(%L::UUID,%L::UUID[],NULL,100)',
      v_baseline_version_id,
      v_option_ids[1:1]
    ),
    'PT422',
    'validation_error'
  );

  -- null page size rejected
  PERFORM pg_temp.expect_error(
    'null page size rejected',
    format(
      'SELECT public.technical_configuration_comparison_get(%L::UUID,%L::UUID[],1,NULL)',
      v_baseline_version_id,
      v_option_ids[1:1]
    ),
    'PT422',
    'validation_error'
  );

  PERFORM pg_temp.expect_error(
    'page zero rejected',
    format(
      'SELECT public.technical_configuration_comparison_get(%L::UUID,%L::UUID[],0,100)',
      v_baseline_version_id,
      v_option_ids[1:1]
    ),
    'PT422',
    'validation_error'
  );
  PERFORM pg_temp.expect_error(
    'page size over 100 rejected',
    format(
      'SELECT public.technical_configuration_comparison_get(%L::UUID,%L::UUID[],1,101)',
      v_baseline_version_id,
      v_option_ids[1:1]
    ),
    'PT422',
    'validation_error'
  );

  -- missing baseline rejected
  PERFORM pg_temp.expect_error(
    'missing baseline rejected',
    format(
      'SELECT public.technical_configuration_comparison_get(%L::UUID,%L::UUID[],1,100)',
      gen_random_uuid(),
      v_option_ids[1:1]
    ),
    'PT404',
    'not_found'
  );

  -- missing option rejected
  PERFORM pg_temp.expect_error(
    'missing option rejected',
    format(
      'SELECT public.technical_configuration_comparison_get(%L::UUID,ARRAY[%L::UUID],1,100)',
      v_baseline_version_id,
      gen_random_uuid()
    ),
    'PT404',
    'not_found'
  );

  -- mixed dossier rejected
  PERFORM pg_temp.expect_error(
    'mixed dossier rejected',
    format(
      'SELECT public.technical_configuration_comparison_get(%L::UUID,ARRAY[%L::UUID,%L::UUID],1,100)',
      v_baseline_version_id,
      v_option_ids[1],
      v_other_option_id
    ),
    'PT404',
    'not_found'
  );

  v_response := public.technical_configuration_comparison_get(
    v_baseline_version_id,
    ARRAY[v_option_ids[8], v_option_ids[2], v_option_ids[5]],
    1,
    2
  );
  PERFORM pg_temp.assert_keys(
    'exact top-level keys',
    v_response,
    ARRAY['data', 'page', 'page_size', 'total']
  );
  PERFORM pg_temp.assert_keys(
    'exact data keys',
    v_response->'data',
    ARRAY['baseline_version', 'criteria', 'dossier', 'options']
  );
  PERFORM pg_temp.assert_keys(
    'exact dossier keys',
    v_response->'data'->'dossier',
    ARRAY['archived_at', 'device_type_name', 'id', 'name', 'revision']
  );
  PERFORM pg_temp.assert_keys(
    'exact baseline version keys',
    v_response->'data'->'baseline_version',
    ARRAY['dossier_id', 'id', 'revision', 'status', 'version_number']
  );
  PERFORM pg_temp.assert_keys(
    'exact option keys',
    v_response->'data'->'options'->0,
    ARRAY[
      'display_label',
      'id',
      'manufacturer',
      'model',
      'option_name',
      'supplier_id',
      'supplier_name'
    ]
  );
  v_first_criterion := v_response->'data'->'criteria'->0;
  PERFORM pg_temp.assert_keys(
    'exact criterion row keys',
    v_first_criterion,
    ARRAY['baseline_evidence', 'criterion', 'group', 'option_values']
  );
  PERFORM pg_temp.assert_keys(
    'exact group keys',
    v_first_criterion->'group',
    ARRAY['id', 'name', 'sort_order']
  );
  PERFORM pg_temp.assert_keys(
    'exact criterion keys',
    v_first_criterion->'criterion',
    ARRAY['criterion_code', 'id', 'requirement_text', 'sort_order', 'title']
  );
  PERFORM pg_temp.assert_keys(
    'exact baseline evidence keys',
    v_first_criterion->'baseline_evidence',
    ARRAY['citation_count', 'document_count', 'has_evidence']
  );
  PERFORM pg_temp.assert_keys(
    'exact option value keys',
    v_first_criterion->'option_values'->0,
    ARRAY['comparison_set_id', 'evidence', 'option_id', 'response']
  );
  PERFORM pg_temp.assert_keys(
    'exact option evidence keys',
    v_first_criterion->'option_values'->0->'evidence',
    ARRAY['citation_count', 'document_count', 'has_evidence']
  );

  -- options preserve request order
  PERFORM pg_temp.assert_true(
    'options preserve request order',
    v_response->'data'->'options'->0->>'id' = v_option_ids[8]::TEXT
    AND v_response->'data'->'options'->1->>'id' = v_option_ids[2]::TEXT
    AND v_response->'data'->'options'->2->>'id' = v_option_ids[5]::TEXT
    AND v_first_criterion->'option_values'->0->>'option_id' = v_option_ids[8]::TEXT
    AND v_first_criterion->'option_values'->1->>'option_id' = v_option_ids[2]::TEXT
    AND v_first_criterion->'option_values'->2->>'option_id' = v_option_ids[5]::TEXT
  );

  -- criteria pagination returns exact total
  v_response := public.technical_configuration_comparison_get(
    v_baseline_version_id,
    v_option_ids[1:8],
    2,
    100
  );
  PERFORM pg_temp.assert_true(
    'criteria pagination returns exact total',
    (v_response->>'total')::BIGINT = 500
    AND (v_response->>'page')::INTEGER = 2
    AND (v_response->>'page_size')::INTEGER = 100
    AND jsonb_array_length(v_response->'data'->'criteria') = 100
    AND v_response->'data'->'criteria'->0->'criterion'->>'criterion_code' = 'TC-0101'
    AND v_response->'data'->'criteria'->99->'criterion'->>'criterion_code' = 'TC-0200'
  );

  -- ninth option succeeds separately
  v_response := public.technical_configuration_comparison_get(
    v_baseline_version_id,
    v_option_ids[9:9],
    1,
    1
  );
  PERFORM pg_temp.assert_true(
    'ninth option succeeds separately',
    jsonb_array_length(v_response->'data'->'options') = 1
    AND v_response->'data'->'options'->0->>'id' = v_option_ids[9]::TEXT
  );

  -- missing comparison set returns null response
  v_first_option_value := v_response->'data'->'criteria'->0->'option_values'->0;
  PERFORM pg_temp.assert_true(
    'missing comparison set returns null response',
    v_first_option_value->'comparison_set_id' = 'null'::JSONB
    AND v_first_option_value->'response' = 'null'::JSONB
    AND v_first_option_value->'evidence' = jsonb_build_object(
      'document_count', 0,
      'citation_count', 0,
      'has_evidence', false
    )
  );

  v_response := public.technical_configuration_comparison_get(
    v_baseline_version_id,
    v_option_ids[1:2],
    1,
    2
  );
  v_first_criterion := v_response->'data'->'criteria'->0;
  v_first_option_value := v_first_criterion->'option_values'->0;
  v_second_option_value := v_first_criterion->'option_values'->1;

  -- baseline evidence isolated
  PERFORM pg_temp.assert_true(
    'baseline evidence isolated',
    v_first_criterion->'baseline_evidence' = jsonb_build_object(
      'document_count', 1,
      'citation_count', 1,
      'has_evidence', true
    )
    AND v_response->'data'->'criteria'->1->'baseline_evidence' = jsonb_build_object(
      'document_count', 0,
      'citation_count', 0,
      'has_evidence', false
    )
  );

  -- option evidence isolated
  PERFORM pg_temp.assert_true(
    'option evidence isolated',
    v_first_option_value->'evidence' = jsonb_build_object(
      'document_count', 1,
      'citation_count', 1,
      'has_evidence', true
    )
    AND v_second_option_value->'evidence' = jsonb_build_object(
      'document_count', 1,
      'citation_count', 1,
      'has_evidence', true
    )
    AND v_response->'data'->'criteria'->1->'option_values'->0->'evidence'
      = jsonb_build_object(
        'document_count', 0,
        'citation_count', 0,
        'has_evidence', false
      )
  );

  PERFORM pg_temp.assert_keys(
    'exact response keys',
    v_first_option_value->'response',
    ARRAY['id', 'response_text', 'supplementary_information']
  );

  -- supplementary information remains separate
  PERFORM pg_temp.assert_true(
    'supplementary information remains separate',
    v_first_option_value->'response'->>'response_text'
      = E'Response line 1\nResponse line 2'
    AND v_first_option_value->'response'->>'supplementary_information'
      = E'Supplement line 1\nSupplement line 2'
  );

  -- archived dossier readable
  PERFORM pg_temp.assert_true(
    'archived dossier readable',
    v_response->'data'->'dossier'->'archived_at' <> 'null'::JSONB
  );

  -- locked baseline readable
  PERFORM pg_temp.assert_true(
    'locked baseline readable',
    v_response->'data'->'baseline_version'->>'status' = 'locked'
  );

  -- read preserves comparison set count
  PERFORM pg_temp.assert_true(
    'read preserves comparison set count',
    (SELECT count(*) FROM public.technical_configuration_comparison_sets cs
      WHERE cs.dossier_id = v_dossier_id)
      = v_before_set_count
    AND (SELECT count(*) FROM public.technical_configuration_option_responses r
      WHERE r.baseline_version_id = v_baseline_version_id)
      = v_before_response_count
  );

  -- read preserves dossier revision
  PERFORM pg_temp.assert_true(
    'read preserves dossier revision',
    (SELECT d.revision FROM public.technical_configuration_dossiers d
      WHERE d.id = v_dossier_id) = v_before_revision
  );

  -- read preserves audit metadata
  PERFORM pg_temp.assert_true(
    'read preserves audit metadata',
    (SELECT d.updated_at FROM public.technical_configuration_dossiers d
      WHERE d.id = v_dossier_id) = v_before_updated_at
    AND (SELECT d.updated_by FROM public.technical_configuration_dossiers d
      WHERE d.id = v_dossier_id) = v_before_updated_by
    AND (SELECT cs.updated_at FROM public.technical_configuration_comparison_sets cs
      WHERE cs.id = v_first_set_id) = v_before_set_updated_at
    AND (SELECT cs.updated_by FROM public.technical_configuration_comparison_sets cs
      WHERE cs.id = v_first_set_id) = v_before_set_updated_by
  );

  -- 500 criteria 50 options 8 selected
  PERFORM pg_temp.assert_true(
    '500 criteria 50 options 8 selected',
    (SELECT count(*) FROM public.technical_configuration_baseline_criteria c
      WHERE c.baseline_version_id = v_baseline_version_id) = 500
    AND (SELECT count(*) FROM public.technical_configuration_options o
      WHERE o.dossier_id = v_dossier_id) = 50
    AND cardinality(v_option_ids[1:8]) = 8
  );

  -- EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) of the inner set-based query.
  EXECUTE format(
    $plan$
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      WITH selected_options AS (
        SELECT
          requested.ordinal,
          o.id AS option_id,
          o.supplier_id,
          s.name AS supplier_name,
          o.model,
          o.manufacturer,
          o.option_name,
          s.name || ' · ' || COALESCE(o.model, o.option_name) AS display_label
        FROM unnest(%L::UUID[]) WITH ORDINALITY
          AS requested(option_id, ordinal)
        JOIN public.technical_configuration_options o
          ON o.id = requested.option_id
         AND o.dossier_id = %L::UUID
        JOIN public.technical_configuration_suppliers s
          ON s.id = o.supplier_id
         AND s.dossier_id = o.dossier_id
      ),
      paged_criteria AS (
        SELECT
          g.id AS group_id,
          g.name AS group_name,
          g.sort_order AS group_sort_order,
          c.id AS criterion_id,
          c.criterion_code,
          c.title,
          c.requirement_text,
          c.sort_order AS criterion_sort_order,
          c.baseline_version_id
        FROM public.technical_configuration_baseline_criteria c
        JOIN public.technical_configuration_baseline_groups g
          ON g.id = c.group_id
         AND g.baseline_version_id = c.baseline_version_id
        WHERE c.baseline_version_id = %L::UUID
        ORDER BY g.sort_order, c.sort_order, c.id
        LIMIT 100
        OFFSET 100
      ),
      baseline_evidence AS (
        SELECT
          paged.criterion_id,
          count(DISTINCT citation.baseline_document_id) AS document_total,
          count(citation.id) AS citation_total
        FROM paged_criteria paged
        LEFT JOIN public.technical_configuration_baseline_citations citation
          ON citation.criterion_id = paged.criterion_id
         AND citation.baseline_version_id = paged.baseline_version_id
        GROUP BY paged.criterion_id
      ),
      option_evidence AS (
        SELECT
          selected.option_id,
          paged.criterion_id,
          count(DISTINCT citation.option_document_id) AS document_total,
          count(citation.id) AS citation_total
        FROM selected_options selected
        CROSS JOIN paged_criteria paged
        LEFT JOIN public.technical_configuration_comparison_sets comparison_set
          ON comparison_set.option_id = selected.option_id
         AND comparison_set.baseline_version_id = paged.baseline_version_id
        LEFT JOIN public.technical_configuration_option_citations citation
          ON citation.comparison_set_id = comparison_set.id
         AND citation.option_id = selected.option_id
         AND citation.baseline_version_id = paged.baseline_version_id
         AND citation.criterion_id = paged.criterion_id
        GROUP BY selected.option_id, paged.criterion_id
      ),
      option_values AS (
        SELECT
          paged.criterion_id,
          selected.ordinal,
          selected.option_id,
          comparison_set.id AS comparison_set_id,
          CASE
            WHEN response.id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', response.id,
              'response_text', response.response_text,
              'supplementary_information', response.supplementary_information
            )
          END AS response,
          jsonb_build_object(
            'document_count', evidence.document_total,
            'citation_count', evidence.citation_total,
            'has_evidence', evidence.citation_total > 0
          ) AS evidence
        FROM paged_criteria paged
        CROSS JOIN selected_options selected
        LEFT JOIN public.technical_configuration_comparison_sets comparison_set
          ON comparison_set.option_id = selected.option_id
         AND comparison_set.baseline_version_id = paged.baseline_version_id
        LEFT JOIN public.technical_configuration_option_responses response
          ON response.comparison_set_id = comparison_set.id
         AND response.baseline_version_id = paged.baseline_version_id
         AND response.criterion_id = paged.criterion_id
        JOIN option_evidence evidence
          ON evidence.option_id = selected.option_id
         AND evidence.criterion_id = paged.criterion_id
      ),
      option_value_arrays AS (
        SELECT
          values.criterion_id,
          jsonb_agg(
            jsonb_build_object(
              'option_id', values.option_id,
              'comparison_set_id', values.comparison_set_id,
              'response', values.response,
              'evidence', values.evidence
            )
            ORDER BY values.ordinal
          ) AS option_values
        FROM option_values values
        GROUP BY values.criterion_id
      ),
      option_array AS (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', selected.option_id,
            'supplier_id', selected.supplier_id,
            'supplier_name', selected.supplier_name,
            'model', selected.model,
            'manufacturer', selected.manufacturer,
            'option_name', selected.option_name,
            'display_label', selected.display_label
          )
          ORDER BY selected.ordinal
        ) AS options
        FROM selected_options selected
      ),
      criteria_array AS (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'group', jsonb_build_object(
                'id', paged.group_id,
                'name', paged.group_name,
                'sort_order', paged.group_sort_order
              ),
              'criterion', jsonb_build_object(
                'id', paged.criterion_id,
                'criterion_code', paged.criterion_code,
                'title', paged.title,
                'requirement_text', paged.requirement_text,
                'sort_order', paged.criterion_sort_order
              ),
              'baseline_evidence', jsonb_build_object(
                'document_count', baseline.document_total,
                'citation_count', baseline.citation_total,
                'has_evidence', baseline.citation_total > 0
              ),
              'option_values', values.option_values
            )
            ORDER BY
              paged.group_sort_order,
              paged.criterion_sort_order,
              paged.criterion_id
          ),
          '[]'::JSONB
        ) AS criteria
        FROM paged_criteria paged
        JOIN baseline_evidence baseline
          ON baseline.criterion_id = paged.criterion_id
        JOIN option_value_arrays values
          ON values.criterion_id = paged.criterion_id
      )
      SELECT jsonb_build_object(
        'options', option_array.options,
        'criteria', criteria_array.criteria
      )
      FROM option_array
      CROSS JOIN criteria_array
    $plan$,
    v_option_ids[1:8],
    v_dossier_id,
    v_baseline_version_id
  )
  INTO v_plan;

  RAISE NOTICE 'P10A1 inner query plan: %', v_plan;

  SELECT max((plan_rows.actual_rows::TEXT)::NUMERIC)
  INTO v_max_actual_rows
  FROM jsonb_path_query(
    v_plan,
    '$.**."Actual Rows"'
  ) AS plan_rows(actual_rows);

  PERFORM pg_temp.assert_true(
    'inner set-based plan has no repeated subplan',
    NOT jsonb_path_exists(
      v_plan,
      '$.**."Parent Relationship" ? (@ == "SubPlan")'
    )
  );
  PERFORM pg_temp.assert_true(
    'inner plan remains page and selection bounded',
    v_max_actual_rows <= 1000
  );
END;
$gate$;

ROLLBACK;
