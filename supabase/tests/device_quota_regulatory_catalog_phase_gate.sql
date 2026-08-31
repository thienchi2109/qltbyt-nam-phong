-- Phase 1 regulatory catalog foundation contract.
-- The gate is read-only apart from rolled-back immutability probes.

BEGIN;

DO $$
DECLARE
  v_table_name TEXT;
  v_catalog_version_id UUID;
  v_document_id UUID;
  v_user_id BIGINT;
  v_don_vi BIGINT;
  v_role TEXT;
  v_payload JSONB;
  v_sqlstate TEXT;
  v_prosecdef BOOLEAN;
  v_proconfig TEXT[];
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY[
    'device_quota_regulatory_documents',
    'device_quota_regulatory_catalog_versions',
    'device_quota_regulatory_sections',
    'device_quota_regulatory_items',
    'device_quota_regulatory_rules',
    'device_quota_regulatory_source_positions',
    'device_quota_regulatory_source_pages',
    'device_quota_regulatory_references'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_table_name)) IS NULL THEN
      RAISE EXCEPTION 'Missing regulatory catalog table: %', v_table_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_class AS c
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = v_table_name
        AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS is not enabled for %', v_table_name;
    END IF;

    IF has_table_privilege('anon', format('public.%I', v_table_name), 'SELECT')
       OR has_table_privilege('authenticated', format('public.%I', v_table_name), 'SELECT')
    THEN
      RAISE EXCEPTION 'Direct client SELECT is granted for %', v_table_name;
    END IF;
  END LOOP;

  IF (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE 'device_quota_regulatory_%_no_client_access'
  ) <> 8 THEN
    RAISE EXCEPTION 'All eight regulatory deny policies are required';
  END IF;

  SELECT d.id, v.id
  INTO v_document_id, v_catalog_version_id
  FROM public.device_quota_regulatory_documents AS d
  JOIN public.device_quota_regulatory_catalog_versions AS v ON v.document_id = d.id
  WHERE d.document_number = '10/2026/TT-BYT'
    AND v.artifact_id = 'thong-tu-10-2026-appendix-freeze'
    AND v.import_status = 'ready'
    AND v.is_canonical;

  IF v_catalog_version_id IS NULL OR v_document_id IS NULL THEN
    RAISE EXCEPTION 'Canonical ready Thong tu 10/2026 snapshot is missing';
  END IF;

  IF (
    SELECT count(*)
    FROM public.device_quota_regulatory_catalog_versions AS v
    WHERE v.document_id = v_document_id
      AND v.import_status = 'ready'
      AND v.is_canonical
  ) <> 1 THEN
    RAISE EXCEPTION 'There must be exactly one canonical ready snapshot';
  END IF;

  IF NOT device_quota_internal.catalog_is_complete(v_catalog_version_id) THEN
    RAISE EXCEPTION 'Canonical regulatory snapshot is incomplete';
  END IF;

  IF (SELECT count(*) FROM public.device_quota_regulatory_source_positions
      WHERE catalog_version_id = v_catalog_version_id) <> 42
     OR (SELECT count(*) FROM public.device_quota_regulatory_sections
         WHERE catalog_version_id = v_catalog_version_id) <> 5
     OR (SELECT count(*) FROM public.device_quota_regulatory_items
         WHERE catalog_version_id = v_catalog_version_id) <> 37
     OR (SELECT count(*) FROM public.device_quota_regulatory_items
         WHERE catalog_version_id = v_catalog_version_id AND section_id IS NOT NULL) <> 16
     OR (SELECT count(*) FROM public.device_quota_regulatory_items
         WHERE catalog_version_id = v_catalog_version_id AND section_id IS NULL) <> 21
     OR (SELECT count(*) FROM public.device_quota_regulatory_rules r
         JOIN public.device_quota_regulatory_items i ON i.id = r.item_id
         WHERE i.catalog_version_id = v_catalog_version_id) <> 113
     OR (SELECT count(DISTINCT p.item_id) FROM public.device_quota_regulatory_source_pages sp
         JOIN public.device_quota_regulatory_source_positions p ON p.id = sp.source_position_id
         WHERE p.catalog_version_id = v_catalog_version_id AND p.item_id IS NOT NULL) <> 37
     OR (SELECT count(*) FROM public.device_quota_regulatory_references r
         WHERE r.catalog_version_id = v_catalog_version_id AND r.reference_type = 'source') <> 42
     OR (SELECT count(*) FROM public.device_quota_regulatory_references r
         WHERE r.catalog_version_id = v_catalog_version_id AND r.reference_type = 'footnote') <> 3
  THEN
    RAISE EXCEPTION 'Regulatory catalog row counts do not match the frozen source';
  END IF;

  IF (
    SELECT array_agg(p.source_identifier ORDER BY p.source_order)
    FROM public.device_quota_regulatory_source_positions AS p
    WHERE p.catalog_version_id = v_catalog_version_id
  ) <> ARRAY[
    '1', '1a', '1b', '1c', '1d', '1dd', '2', '2a', '2b', '2c', '3', '4',
    '5', '5a', '5b', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15',
    '16', '16a', '16b', '17', '18', '19', '20', '21', '22', '23', '23a', '23b',
    '23c', '23d', '24', '25', '26'
  ]::TEXT[] THEN
    RAISE EXCEPTION 'Source order or source identifiers changed';
  END IF;

  SELECT p.prosecdef, p.proconfig
  INTO v_prosecdef, v_proconfig
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'device_quota_regulatory_catalog_get'
    AND pg_get_function_identity_arguments(p.oid) = '';

  IF NOT v_prosecdef OR NOT ('search_path=public, pg_temp' = ANY(v_proconfig)) THEN
    RAISE EXCEPTION 'Snapshot RPC must be SECURITY DEFINER with a pinned search_path';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.device_quota_regulatory_catalog_get()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.device_quota_regulatory_catalog_get()', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'Snapshot RPC execute grants are not fail-closed';
  END IF;

  BEGIN
    UPDATE public.device_quota_regulatory_items
    SET name = name
    WHERE id = (
      SELECT id
      FROM public.device_quota_regulatory_items
      WHERE catalog_version_id = v_catalog_version_id
      ORDER BY source_order
      LIMIT 1
    );
    RAISE EXCEPTION 'Regulatory item update unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    NULL;
  END;

  SELECT nv.id, COALESCE(nv.current_don_vi, nv.don_vi), CASE
    WHEN nv.role = 'admin' THEN 'global'
    ELSE nv.role
  END
  INTO v_user_id, v_don_vi, v_role
  FROM public.nhan_vien AS nv
  WHERE COALESCE(nv.is_active, true)
    AND nv.role IN ('global', 'admin', 'to_qltb')
    AND COALESCE(nv.current_don_vi, nv.don_vi) IS NOT NULL
  ORDER BY nv.id
  LIMIT 1;

  IF v_user_id IS NULL OR v_don_vi IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'No eligible baseline user is available for the read contract test';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', v_role,
      'user_id', v_user_id::TEXT,
      'don_vi', v_don_vi::TEXT
    )::TEXT,
    true
  );
  SELECT public.device_quota_regulatory_catalog_get() INTO v_payload;

  IF v_payload->'document'->>'document_number' <> '10/2026/TT-BYT'
     OR jsonb_array_length(v_payload->'rows') <> 42
     OR jsonb_array_length(v_payload->'footnotes') <> 3
     OR v_payload->'catalog_version'->>'import_status' <> 'ready'
  THEN
    RAISE EXCEPTION 'Snapshot RPC returned an invalid source-order contract';
  END IF;

  PERFORM set_config('request.jwt.claims', '{}'::TEXT, true);
  BEGIN
    PERFORM public.device_quota_regulatory_catalog_get();
    RAISE EXCEPTION 'Missing claims unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  PERFORM set_config('request.jwt.claims', '{malformed-json', true);
  BEGIN
    PERFORM public.device_quota_regulatory_catalog_get();
    RAISE EXCEPTION 'Malformed claims unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'regional_leader',
      'user_id', v_user_id::TEXT,
      'don_vi', v_don_vi::TEXT
    )::TEXT,
    true
  );
  BEGIN
    PERFORM public.device_quota_regulatory_catalog_get();
    RAISE EXCEPTION 'Unsupported role unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', v_role,
      'user_id', v_user_id::TEXT,
      'don_vi', (v_don_vi + 1)::TEXT
    )::TEXT,
    true
  );
  BEGIN
    PERFORM public.device_quota_regulatory_catalog_get();
    RAISE EXCEPTION 'Cross-tenant claims unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
  RAISE EXCEPTION 'Phase 1 regulatory catalog gate failed (%): %', v_sqlstate, SQLERRM;
END;
$$;

ROLLBACK;
