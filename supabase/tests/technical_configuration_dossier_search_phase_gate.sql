-- supabase/tests/technical_configuration_dossier_search_phase_gate.sql
-- Purpose: prove the normalized dossier search signature, ACL, matching, ranking, and paging.
-- Non-destructive: all fixture writes are wrapped in a transaction, cleaned up, and rolled back.
BEGIN;

CREATE FUNCTION pg_temp.expect_error(
  p_label TEXT, p_statement TEXT, p_expected_state TEXT, p_expected_message TEXT
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
  v_signature CONSTANT TEXT :=
    'public.technical_configuration_dossiers_list(integer,integer,boolean,text)';
  v_helper_oid OID;
  v_signature_count INTEGER;
  v_helper_volatility "char";
  v_helper_security_definer BOOLEAN;
  v_helper_config TEXT[];
  v_actual TEXT;
BEGIN
  SELECT count(*) INTO v_signature_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'technical_configuration_dossiers_list';

  IF v_signature_count <> 1
     OR to_regprocedure(v_signature) IS NULL
     OR to_regprocedure(
       'public.technical_configuration_dossiers_list(integer,integer,boolean)'
     ) IS NOT NULL THEN
    RAISE EXCEPTION 'dossier list signature replacement failed';
  END IF;

  IF has_function_privilege('public', v_signature, 'EXECUTE')
     OR has_function_privilege('anon', v_signature, 'EXECUTE')
     OR has_function_privilege('service_role', v_signature, 'EXECUTE')
     OR NOT has_function_privilege('authenticated', v_signature, 'EXECUTE') THEN
    RAISE EXCEPTION 'dossier list ACL mismatch';
  END IF;

  v_helper_oid := to_regprocedure('public._normalize_search_text(text)');
  IF v_helper_oid IS NULL THEN
    RAISE EXCEPTION 'normalization helper is missing';
  END IF;

  SELECT p.provolatile, p.prosecdef, p.proconfig
  INTO v_helper_volatility, v_helper_security_definer, v_helper_config
  FROM pg_proc p
  WHERE p.oid = v_helper_oid;

  IF v_helper_volatility <> 'i'
     OR v_helper_security_definer
     OR NOT ('search_path=public, pg_temp' = ANY(v_helper_config)) THEN
    RAISE EXCEPTION 'normalization helper catalog contract mismatch';
  END IF;

  IF has_function_privilege('public', v_helper_oid, 'EXECUTE')
     OR has_function_privilege('anon', v_helper_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_helper_oid, 'EXECUTE')
     OR has_function_privilege('service_role', v_helper_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'normalization helper must remain internal';
  END IF;

  FOR v_actual IN
    SELECT format(
      '%s=%s',
      fixture.label,
      COALESCE(public._normalize_search_text(fixture.input), '<NULL>')
    )
    FROM (
      VALUES
        ('Vietnamese accents', 'Máy siêu âm', 'may sieu am'),
        ('decomposed Unicode', U&'Ma\0301y sie\0302u a\0302m', 'may sieu am'),
        ('hyphenated device type', 'X-quang', 'x quang'),
        ('Vietnamese d stroke', 'Đầu dò', 'dau do'),
        ('punctuation and separators', 'Máy/X_quang-CT.MRI', 'may x quang ct mri'),
        ('repeated whitespace', E'  Máy\t  siêu\n âm  ', 'may sieu am'),
        ('wildcard characters', E'100%_\\ X-quang', '100 x quang'),
        ('punctuation only', E'%_\\-/.,', ''),
        ('empty input', '', ''),
        ('null input', NULL, NULL)
    ) AS fixture(label, input, expected)
    WHERE public._normalize_search_text(fixture.input) IS DISTINCT FROM fixture.expected
  LOOP
    RAISE EXCEPTION 'normalization fixture failed: %', v_actual;
  END LOOP;
END;
$gate$;

DO $gate$
DECLARE
  v_user_id CONSTANT BIGINT := 900000026;
  v_exact UUID;
  v_prefix UUID;
  v_token UUID;
  v_description UUID;
  v_wildcard UUID;
  v_archived UUID;
  v_response JSONB;
  v_default_response JSONB;
  v_punctuation_response JSONB;
  v_ids UUID[];
  v_plan JSONB;
  v_count INTEGER;
BEGIN
  PERFORM pg_temp.set_claims('global', v_user_id);

  INSERT INTO public.technical_configuration_dossiers (
    device_type_name, name, description, updated_at, created_by, updated_by
  ) VALUES (
    'Thiết bị chẩn đoán',
    'P2DossierSearch26 Máy siêu âm',
    'Exact fixture',
    now() - interval '3 days',
    v_user_id,
    v_user_id
  ) RETURNING id INTO v_exact;

  INSERT INTO public.technical_configuration_dossiers (
    device_type_name, name, description, updated_at, created_by, updated_by
  ) VALUES (
    'Thiết bị chẩn đoán',
    'P2DossierSearch26 Máy siêu âm tim',
    'Prefix fixture',
    now() - interval '2 days',
    v_user_id,
    v_user_id
  ) RETURNING id INTO v_prefix;

  INSERT INTO public.technical_configuration_dossiers (
    device_type_name, name, description, updated_at, created_by, updated_by
  ) VALUES (
    'Siêu âm',
    'P2DossierSearch26 Máy chẩn đoán',
    'Cross-field token fixture',
    now(),
    v_user_id,
    v_user_id
  ) RETURNING id INTO v_token;

  INSERT INTO public.technical_configuration_baseline_versions (
    dossier_id, version_number, status, next_criterion_number, created_by, updated_by
  ) VALUES (
    v_token, 1, 'locked', 1, v_user_id, v_user_id
  );

  INSERT INTO public.technical_configuration_dossiers (
    device_type_name, name, description, updated_at, created_by, updated_by
  ) VALUES (
    'Thiết bị khác',
    'P2DossierSearch26 Khác',
    'Máy siêu âm bí mật',
    now() + interval '1 day',
    v_user_id,
    v_user_id
  ) RETURNING id INTO v_description;

  INSERT INTO public.technical_configuration_dossiers (
    device_type_name, name, description, updated_at, created_by, updated_by
  ) VALUES (
    'Thiết bị khác',
    'P2DossierSearch26 100 percent',
    'Literal wildcard fixture',
    now() + interval '2 days',
    v_user_id,
    v_user_id
  ) RETURNING id INTO v_wildcard;

  INSERT INTO public.technical_configuration_dossiers (
    device_type_name, name, description, archived_at, updated_at, created_by, updated_by
  ) VALUES (
    'Thiết bị chẩn đoán',
    'P2DossierSearch26 Máy siêu âm archived',
    'Archived fixture',
    now(),
    now() + interval '3 days',
    v_user_id,
    v_user_id
  ) RETURNING id INTO v_archived;

  -- A three-argument call must remain valid through p_search DEFAULT NULL.
  v_default_response :=
    public.technical_configuration_dossiers_list(1, 100, false);
  v_punctuation_response :=
    public.technical_configuration_dossiers_list(1, 100, false, E'%_\\-/.,');

  IF v_default_response->>'total' IS DISTINCT FROM v_punctuation_response->>'total'
     OR v_default_response->'data' IS DISTINCT FROM v_punctuation_response->'data' THEN
    RAISE EXCEPTION 'punctuation-only search must preserve the default list';
  END IF;

  -- accent/case/Unicode/punctuation equivalence
  v_response := public.technical_configuration_dossiers_list(
    1, 10, false, 'P2DossierSearch26 MÁY/siêu_âm'
  );
  IF (v_response->>'total')::INTEGER <> 3 THEN
    RAISE EXCEPTION 'normalized search total failed: %', v_response;
  END IF;

  SELECT array_agg((item->>'id')::UUID ORDER BY ordinal)
  INTO v_ids
  FROM jsonb_array_elements(v_response->'data') WITH ORDINALITY AS rows(item, ordinal);
  IF v_ids IS DISTINCT FROM ARRAY[v_exact, v_prefix, v_token] THEN
    RAISE EXCEPTION 'exact/prefix/token ranking failed: %', v_ids;
  END IF;

  IF (
    SELECT (item->>'can_delete')::BOOLEAN
    FROM jsonb_array_elements(v_response->'data') item
    WHERE item->>'id' = v_token::TEXT
  ) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'page-scoped can_delete failed for locked search result';
  END IF;

  v_response := public.technical_configuration_dossiers_list(
    1, 10, false, U&'P2DossierSearch26 Ma\0301y sie\0302u a\0302m'
  );
  IF (v_response->>'total')::INTEGER <> 3 THEN
    RAISE EXCEPTION 'decomposed Unicode search failed';
  END IF;

  v_response := public.technical_configuration_dossiers_list(
    1, 10, false, 'P2DossierSearch26 siêu máy'
  );
  IF (v_response->>'total')::INTEGER <> 3 THEN
    RAISE EXCEPTION 'cross-field all-token search failed';
  END IF;

  v_response := public.technical_configuration_dossiers_list(
    1, 10, false, 'P2DossierSearch26 máy siêu âm xquang'
  );
  IF (v_response->>'total')::INTEGER <> 0 THEN
    RAISE EXCEPTION 'all-token rejection failed';
  END IF;

  v_response := public.technical_configuration_dossiers_list(
    1, 10, false, 'P2DossierSearch26 bí mật'
  );
  IF (v_response->>'total')::INTEGER <> 0 THEN
    RAISE EXCEPTION 'description exclusion failed';
  END IF;

  v_response := public.technical_configuration_dossiers_list(
    1, 10, false, v_exact::TEXT
  );
  IF (v_response->>'total')::INTEGER <> 0 THEN
    RAISE EXCEPTION 'UUID exclusion failed';
  END IF;

  -- literal wildcard search
  v_response := public.technical_configuration_dossiers_list(
    1, 10, false, E'P2DossierSearch26 100%_\\'
  );
  IF (v_response->>'total')::INTEGER <> 1
     OR v_response->'data'->0->>'id' IS DISTINCT FROM v_wildcard::TEXT THEN
    RAISE EXCEPTION 'literal wildcard search failed: %', v_response;
  END IF;

  v_response := public.technical_configuration_dossiers_list(
    1, 10, true, 'P2DossierSearch26 Máy siêu âm'
  );
  IF (v_response->>'total')::INTEGER <> 4
     OR NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements(v_response->'data') item
       WHERE item->>'id' = v_archived::TEXT
     ) THEN
    RAISE EXCEPTION 'archive search behavior failed';
  END IF;

  -- filtered pagination
  v_response := public.technical_configuration_dossiers_list(
    1, 2, false, 'P2DossierSearch26 Máy siêu âm'
  );
  IF (v_response->>'total')::INTEGER <> 3
     OR jsonb_array_length(v_response->'data') <> 2
     OR (v_response->>'page')::INTEGER <> 1
     OR (v_response->>'page_size')::INTEGER <> 2 THEN
    RAISE EXCEPTION 'filtered pagination page 1 failed: %', v_response;
  END IF;

  v_response := public.technical_configuration_dossiers_list(
    2, 2, false, 'P2DossierSearch26 Máy siêu âm'
  );
  IF (v_response->>'total')::INTEGER <> 3
     OR jsonb_array_length(v_response->'data') <> 1
     OR v_response->'data'->0->>'id' IS DISTINCT FROM v_token::TEXT THEN
    RAISE EXCEPTION 'filtered pagination page 2 failed: %', v_response;
  END IF;

  PERFORM public.technical_configuration_dossiers_list(
    1, 10, false, repeat('a', 200)
  );
  PERFORM pg_temp.expect_error(
    '201-character search',
    format(
      'SELECT public.technical_configuration_dossiers_list(1, 10, false, %L)',
      repeat('a', 201)
    ),
    'PT422',
    'validation_error'
  );

  PERFORM set_config('enable_seqscan', 'off', true);
  EXPLAIN (FORMAT JSON)
  SELECT d.id
  FROM public.technical_configuration_dossiers d
  WHERE public._normalize_search_text(d.name)
    LIKE '%' || public._sanitize_ilike_pattern('p2dossiersearch26') || '%' ESCAPE E'\\'
  INTO v_plan;
  IF NOT jsonb_path_exists(
    v_plan,
    '$.**."Index Name" ? (@ == "technical_configuration_dossiers_name_search_trgm_idx")'
  ) THEN
    RAISE EXCEPTION 'name trigram index plan failed: %', v_plan;
  END IF;

  EXPLAIN (FORMAT JSON)
  SELECT d.id
  FROM public.technical_configuration_dossiers d
  WHERE public._normalize_search_text(d.device_type_name)
    LIKE '%' || public._sanitize_ilike_pattern('sieu am') || '%' ESCAPE E'\\'
  INTO v_plan;
  IF NOT jsonb_path_exists(
    v_plan,
    '$.**."Index Name" ? (@ == "technical_configuration_dossiers_device_type_search_trgm_idx")'
  ) THEN
    RAISE EXCEPTION 'device-type trigram index plan failed: %', v_plan;
  END IF;

  DELETE FROM public.technical_configuration_baseline_versions
  WHERE dossier_id = ANY(
    ARRAY[v_exact, v_prefix, v_token, v_description, v_wildcard, v_archived]
  );
  DELETE FROM public.technical_configuration_dossiers
  WHERE id = ANY(
    ARRAY[v_exact, v_prefix, v_token, v_description, v_wildcard, v_archived]
  );

  SELECT count(*) INTO v_count
  FROM public.technical_configuration_dossiers
  WHERE id = ANY(
    ARRAY[v_exact, v_prefix, v_token, v_description, v_wildcard, v_archived]
  );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'fixture cleanup failed';
  END IF;
END;
$gate$;

ROLLBACK;
