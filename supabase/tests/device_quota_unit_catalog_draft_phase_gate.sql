\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  v_table TEXT;
  v_function TEXT;
  v_prosecdef BOOLEAN;
  v_proconfig TEXT[];
  v_claims JSONB;
  v_user_id BIGINT;
  v_don_vi BIGINT;
  v_role TEXT;
  v_draft_id UUID;
  v_item_id UUID;
  v_response JSONB;
  v_payload JSONB;
  v_audit_count INTEGER;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'device_quota_unit_catalog_draft',
    'device_quota_unit_catalog_draft_item',
    'device_quota_unit_catalog_audit_logs'
  ] LOOP
    ASSERT to_regclass('public.' || v_table) IS NOT NULL,
      'Phase 2 table is missing: ' || v_table;
    ASSERT EXISTS (
      SELECT 1
      FROM pg_class
      WHERE oid = to_regclass('public.' || v_table)
        AND relrowsecurity
    ), 'Phase 2 table must have RLS enabled: ' || v_table;
    ASSERT NOT has_table_privilege('authenticated', 'public.' || v_table, 'SELECT'),
      'authenticated must not select Phase 2 tables directly: ' || v_table;
    ASSERT NOT has_table_privilege('anon', 'public.' || v_table, 'SELECT'),
      'anon must not select Phase 2 tables directly: ' || v_table;
  END LOOP;

  FOREACH v_function IN ARRAY ARRAY[
    'device_quota_unit_catalog_draft_create_or_open()',
    'device_quota_unit_catalog_draft_get(uuid)',
    'device_quota_unit_catalog_draft_save(uuid,bigint,jsonb)',
    'device_quota_unit_catalog_draft_exclude(uuid,uuid,bigint)',
    'device_quota_unit_catalog_draft_restore(uuid,uuid,bigint)'
  ] LOOP
    SELECT p.prosecdef, p.proconfig
    INTO v_prosecdef, v_proconfig
    FROM pg_proc AS p
    WHERE p.oid = to_regprocedure('public.' || v_function);

    ASSERT v_prosecdef, 'Phase 2 RPC must be SECURITY DEFINER: ' || v_function;
    ASSERT 'search_path=public, pg_temp' = ANY(v_proconfig),
      'Phase 2 RPC must pin search_path: ' || v_function;
    ASSERT has_function_privilege('authenticated', 'public.' || v_function, 'EXECUTE'),
      'authenticated must execute Phase 2 RPC: ' || v_function;
    ASSERT NOT has_function_privilege('anon', 'public.' || v_function, 'EXECUTE'),
      'anon must not execute Phase 2 RPC: ' || v_function;
  END LOOP;

  PERFORM set_config('request.jwt.claims', '{}', true);
  BEGIN
    PERFORM public.device_quota_unit_catalog_draft_create_or_open();
    RAISE EXCEPTION 'missing claims unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;

  v_claims := jsonb_build_object(
    'app_role', 'regional_leader',
    'user_id', '1',
    'don_vi', '1'
  );
  PERFORM set_config('request.jwt.claims', v_claims::TEXT, true);
  BEGIN
    PERFORM public.device_quota_unit_catalog_draft_create_or_open();
    RAISE EXCEPTION 'mapping-only role unexpectedly mutated a draft';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;

  SELECT
    nv.id,
    COALESCE(nv.current_don_vi, nv.don_vi),
    CASE WHEN nv.role = 'admin' THEN 'admin' ELSE nv.role END
  INTO v_user_id, v_don_vi, v_role
  FROM public.nhan_vien AS nv
  WHERE COALESCE(nv.is_active, true)
    AND nv.role IN ('admin', 'global', 'to_qltb')
    AND COALESCE(nv.current_don_vi, nv.don_vi) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.device_quota_unit_catalog_draft AS existing_draft
      WHERE existing_draft.don_vi = COALESCE(nv.current_don_vi, nv.don_vi)
        AND existing_draft.status = 'draft'
    )
  ORDER BY nv.id
  LIMIT 1;

  ASSERT v_user_id IS NOT NULL,
    'isolated Phase 2 gate fixture needs an authorized user without a draft';
  ASSERT v_don_vi IS NOT NULL,
    'isolated Phase 2 gate fixture needs a session unit';

  v_claims := jsonb_build_object(
    'app_role', v_role,
    'user_id', v_user_id::TEXT,
    'don_vi', v_don_vi::TEXT
  );
  PERFORM set_config('request.jwt.claims', v_claims::TEXT, true);

  v_response := public.device_quota_unit_catalog_draft_create_or_open();
  v_draft_id := (v_response->'data'->'draft'->>'id')::UUID;
  ASSERT (v_response->'data'->'draft'->>'revision')::BIGINT = 1,
    'new draft must start at revision 1';
  ASSERT jsonb_array_length(v_response->'data'->'items') = 37,
    'new draft must initialize all regulatory items';

  SELECT count(*)::INTEGER
  INTO v_audit_count
  FROM public.device_quota_unit_catalog_audit_logs
  WHERE draft_id = v_draft_id AND event_type = 'create';
  ASSERT v_audit_count = 1, 'create must write one audit event atomically';

  SELECT jsonb_agg(
    jsonb_build_object(
      'regulatory_item_id', regulatory_item_id,
      'display_name_override', display_name_override,
      'applied_unit', applied_unit,
      'applied_quantity', applied_quantity,
      'notes', notes,
      'is_excluded', is_excluded,
      'display_order', display_order
    )
    ORDER BY display_order
  )
  INTO v_payload
  FROM public.device_quota_unit_catalog_draft_item
  WHERE draft_id = v_draft_id;

  v_response := public.device_quota_unit_catalog_draft_save(
    v_draft_id,
    1,
    v_payload
  );
  ASSERT (v_response->'data'->'draft'->>'revision')::BIGINT = 2,
    'save must increment revision';

  SELECT count(*)::INTEGER
  INTO v_audit_count
  FROM public.device_quota_unit_catalog_audit_logs
  WHERE draft_id = v_draft_id;
  ASSERT v_audit_count = 2, 'save must write one audit event atomically';

  BEGIN
    PERFORM public.device_quota_unit_catalog_draft_save(
      v_draft_id,
      1,
      v_payload
    );
    RAISE EXCEPTION 'stale save unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN
    NULL;
  END;

  SELECT count(*)::INTEGER
  INTO v_audit_count
  FROM public.device_quota_unit_catalog_audit_logs
  WHERE draft_id = v_draft_id;
  ASSERT v_audit_count = 2, 'stale save must not write an audit event';

  SELECT regulatory_item_id
  INTO v_item_id
  FROM public.device_quota_unit_catalog_draft_item
  WHERE draft_id = v_draft_id
  ORDER BY display_order
  LIMIT 1;

  v_response := public.device_quota_unit_catalog_draft_exclude(
    v_draft_id,
    v_item_id,
    2
  );
  ASSERT (v_response->'data'->'draft'->>'revision')::BIGINT = 3,
    'exclude must increment revision';

  v_response := public.device_quota_unit_catalog_draft_restore(
    v_draft_id,
    v_item_id,
    3
  );
  ASSERT (v_response->'data'->'draft'->>'revision')::BIGINT = 4,
    'restore must increment revision';

  SELECT count(*)::INTEGER
  INTO v_audit_count
  FROM public.device_quota_unit_catalog_audit_logs
  WHERE draft_id = v_draft_id;
  ASSERT v_audit_count = 4,
    'create, save, exclude, and restore must each write one audit event';
END;
$$;

ROLLBACK;
