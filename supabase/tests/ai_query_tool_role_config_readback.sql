-- Disposable read-back for the existing ai_query_tool role settings.
-- Run only after 20260928120000_set_ai_query_tool_read_only_role_settings.sql
-- on a disposable database where that login role already exists.
-- Do not run this script against live.

DO $$
DECLARE
  v_config text[];
  v_expected text[] := ARRAY[
    'default_transaction_read_only=on',
    'idle_in_transaction_session_timeout=5s',
    'search_path=ai_readonly, pg_catalog',
    'statement_timeout=5s'
  ];
BEGIN
  SELECT rolconfig
  INTO v_config
  FROM pg_roles
  WHERE rolname = 'ai_query_tool';

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'ai_query_tool rolconfig is missing';
  END IF;

  IF (
    SELECT array_agg(item ORDER BY item)
    FROM unnest(v_config) AS item
  ) IS DISTINCT FROM (
    SELECT array_agg(item ORDER BY item)
    FROM unnest(v_expected) AS item
  ) THEN
    RAISE EXCEPTION 'ai_query_tool rolconfig mismatch: %', v_config;
  END IF;
END $$;
