-- Local/DB-admin verification artifact for Issue #378 Batch 3.
-- Run only after applying 20260505011500_add_auth_audit_log_sink.sql.
-- Example:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/auth_audit_log_smoke.sql
--
-- This script is intentionally local-only and should not be wired into CI.

DO $$
DECLARE
  v_has_search_path boolean;
  v_is_security_definer boolean;
  v_service_role_can_execute boolean;
  v_public_can_execute boolean;
  v_authenticated_can_execute boolean;
  v_anon_can_execute boolean;
BEGIN
  SELECT p.prosecdef
  INTO v_is_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'auth_audit_log_insert'
    AND pg_get_function_identity_arguments(p.oid) = 'p_created_at timestamp with time zone, p_event text, p_source text, p_reason_code text, p_signout_reason text, p_user_id text, p_username text, p_tenant_id text, p_request_id text, p_trace_id text, p_ip_address inet, p_user_agent text, p_metadata jsonb';

  IF v_is_security_definer IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected auth_audit_log_insert to be SECURITY DEFINER';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL unnest(p.proconfig) AS config(value)
    WHERE n.nspname = 'public'
      AND p.proname = 'auth_audit_log_insert'
      AND pg_get_function_identity_arguments(p.oid) = 'p_created_at timestamp with time zone, p_event text, p_source text, p_reason_code text, p_signout_reason text, p_user_id text, p_username text, p_tenant_id text, p_request_id text, p_trace_id text, p_ip_address inet, p_user_agent text, p_metadata jsonb'
      AND config.value = 'search_path=public, pg_temp'
  )
  INTO v_has_search_path;

  IF v_has_search_path IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected auth_audit_log_insert search_path to be public, pg_temp';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.role_routine_grants
    WHERE specific_schema = 'public'
      AND routine_name = 'auth_audit_log_insert'
      AND grantee = 'service_role'
      AND privilege_type = 'EXECUTE'
  )
  INTO v_service_role_can_execute;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.role_routine_grants
    WHERE specific_schema = 'public'
      AND routine_name = 'auth_audit_log_insert'
      AND grantee = 'PUBLIC'
      AND privilege_type = 'EXECUTE'
  )
  INTO v_public_can_execute;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.role_routine_grants
    WHERE specific_schema = 'public'
      AND routine_name = 'auth_audit_log_insert'
      AND grantee = 'authenticated'
      AND privilege_type = 'EXECUTE'
  )
  INTO v_authenticated_can_execute;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.role_routine_grants
    WHERE specific_schema = 'public'
      AND routine_name = 'auth_audit_log_insert'
      AND grantee = 'anon'
      AND privilege_type = 'EXECUTE'
  )
  INTO v_anon_can_execute;

  IF v_service_role_can_execute IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected service_role EXECUTE grant on auth_audit_log_insert';
  END IF;

  IF v_public_can_execute OR v_authenticated_can_execute OR v_anon_can_execute THEN
    RAISE EXCEPTION 'Expected auth_audit_log_insert execute grants to exclude PUBLIC/anon/authenticated';
  END IF;
END;
$$;

DO $$
DECLARE
  v_started_at timestamptz := now();
  v_insert_ok boolean;
  v_row record;
BEGIN
  SELECT public.auth_audit_log_insert(
    p_created_at := v_started_at,
    p_event := 'forced_signout',
    p_source := 'events_signout',
    p_signout_reason := 'session_expired',
    p_user_id := '42',
    p_username := 'nqminh',
    p_tenant_id := '17',
    p_request_id := 'smoke-auth-audit-log',
    p_trace_id := 'trace-auth-audit-log',
    p_ip_address := '203.0.113.9'::inet,
    p_user_agent := 'SmokeAuthAudit/1.0',
    p_metadata := jsonb_build_object('session_duration_ms', 120000)
  )
  INTO v_insert_ok;

  IF v_insert_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected auth_audit_log_insert to return TRUE';
  END IF;

  SELECT *
  INTO v_row
  FROM public.auth_audit_log
  WHERE request_id = 'smoke-auth-audit-log'
    AND created_at = v_started_at
  ORDER BY id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected inserted auth audit row to exist';
  END IF;

  IF v_row.event IS DISTINCT FROM 'forced_signout' THEN
    RAISE EXCEPTION 'Inserted auth audit event mismatch';
  END IF;

  IF v_row.source IS DISTINCT FROM 'events_signout' THEN
    RAISE EXCEPTION 'Inserted auth audit source mismatch';
  END IF;

  IF v_row.metadata->>'session_duration_ms' IS DISTINCT FROM '120000' THEN
    RAISE EXCEPTION 'Inserted auth audit metadata mismatch';
  END IF;

  DELETE FROM public.auth_audit_log
  WHERE request_id = 'smoke-auth-audit-log'
    AND created_at = v_started_at;
END;
$$;

DO $$
DECLARE
  v_index_names text[];
BEGIN
  SELECT array_agg(indexname ORDER BY indexname)
  INTO v_index_names
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'auth_audit_log'
    AND indexname IN (
      'idx_auth_audit_log_created_at_brin',
      'idx_auth_audit_log_event_created_at',
      'idx_auth_audit_log_user_created_at'
    );

  IF v_index_names IS NULL OR array_length(v_index_names, 1) <> 3 THEN
    RAISE EXCEPTION 'Expected all auth audit forensic indexes to exist';
  END IF;
END;
$$;
