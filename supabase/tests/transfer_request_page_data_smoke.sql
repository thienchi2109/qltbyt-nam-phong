-- Smoke tests for transfer_request_page_data.
-- Run only after applying 20260502040000_add_transfer_request_page_data_rpc.sql.

DO $$
DECLARE
  v_page jsonb;
  v_old_list jsonb;
  v_old_counts jsonb;
  v_total_count integer;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'global',
      'role', 'global',
      'user_id', 'transfer-page-data-smoke',
      'sub', 'transfer-page-data-smoke'
    )::text,
    true
  );

  v_page := public.transfer_request_page_data(
    NULL,
    ARRAY['cho_duyet', 'da_duyet'],
    ARRAY['noi_bo'],
    1,
    10,
    NULL,
    NULL,
    NULL,
    NULL,
    'table',
    30,
    false
  );

  v_old_list := public.transfer_request_list(
    NULL,
    ARRAY['cho_duyet', 'da_duyet'],
    ARRAY['noi_bo'],
    1,
    10,
    NULL,
    NULL,
    NULL,
    NULL,
    'table',
    30,
    false
  );

  v_old_counts := public.transfer_request_counts(
    NULL,
    NULL,
    NULL,
    NULL,
    ARRAY['noi_bo'],
    NULL
  );

  IF v_page->>'viewMode' IS DISTINCT FROM 'table' THEN
    RAISE EXCEPTION 'Expected table viewMode, got %', v_page->>'viewMode';
  END IF;

  IF NOT (v_page ? 'list') OR v_page->'list' IS DISTINCT FROM v_old_list THEN
    RAISE EXCEPTION 'Combined page list does not match transfer_request_list';
  END IF;

  IF NOT (v_page ? 'counts') OR NOT (v_page->'counts' ? 'columnCounts') THEN
    RAISE EXCEPTION 'Combined page counts payload is missing columnCounts';
  END IF;

  IF v_page->'counts'->'columnCounts' IS DISTINCT FROM v_old_counts THEN
    RAISE EXCEPTION 'Combined page counts do not match transfer_request_counts';
  END IF;

  v_total_count :=
    COALESCE((v_old_counts->>'cho_duyet')::integer, 0) +
    COALESCE((v_old_counts->>'da_duyet')::integer, 0) +
    COALESCE((v_old_counts->>'dang_luan_chuyen')::integer, 0) +
    COALESCE((v_old_counts->>'da_ban_giao')::integer, 0) +
    COALESCE((v_old_counts->>'hoan_thanh')::integer, 0);

  IF COALESCE((v_page->'counts'->>'totalCount')::integer, -1) IS DISTINCT FROM v_total_count THEN
    RAISE EXCEPTION 'Combined page totalCount mismatch';
  END IF;
END $$;

DO $$
DECLARE
  v_page jsonb;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'global',
      'role', 'global',
      'user_id', 'transfer-page-data-smoke',
      'sub', 'transfer-page-data-smoke'
    )::text,
    true
  );

  v_page := public.transfer_request_page_data(
    NULL,
    NULL,
    ARRAY['noi_bo'],
    1,
    10,
    NULL,
    NULL,
    NULL,
    NULL,
    'kanban',
    5,
    true
  );

  IF v_page->>'viewMode' IS DISTINCT FROM 'kanban' THEN
    RAISE EXCEPTION 'Expected kanban viewMode, got %', v_page->>'viewMode';
  END IF;

  IF NOT (v_page ? 'list') OR v_page->'list' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'Kanban page data should not include table list payload';
  END IF;

  IF NOT (v_page ? 'kanban') OR NOT (v_page->'kanban' ? 'columns') THEN
    RAISE EXCEPTION 'Kanban page data should include kanban.columns';
  END IF;

  IF jsonb_typeof(v_page->'kanban'->'columns') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Kanban page data should include columns object';
  END IF;
END $$;

DO $$
DECLARE
  v_page jsonb;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'global',
      'role', 'global',
      'user_id', 'transfer-page-data-smoke',
      'sub', 'transfer-page-data-smoke'
    )::text,
    true
  );

  v_page := public.transfer_request_page_data(
    NULL,
    ARRAY['cho_duyet'],
    ARRAY['noi_bo'],
    2,
    10,
    NULL,
    NULL,
    NULL,
    NULL,
    'table',
    30,
    false,
    false
  );

  IF NOT (v_page ? 'counts') OR v_page->'counts' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'Counts should be null when p_include_counts is false';
  END IF;

  IF NOT (v_page ? 'list') OR jsonb_typeof(v_page->'list') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Table page data should still include list when counts are skipped';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{}'::text, true);

  BEGIN
    PERFORM public.transfer_request_page_data();
    RAISE EXCEPTION 'Expected transfer_request_page_data to fail without JWT claims';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END $$;
