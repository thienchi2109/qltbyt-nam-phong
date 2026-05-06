-- Local/DB-admin verification artifact for Issue #391.
-- Run only after applying the auth_audit_log retention migration.
-- Example:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/auth_audit_log_retention_smoke.sql
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
    AND p.proname = 'auth_audit_log_cleanup_scheduled'
    AND pg_get_function_identity_arguments(p.oid) = '';

  IF v_is_security_definer IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected auth_audit_log_cleanup_scheduled to be SECURITY DEFINER';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL unnest(p.proconfig) AS config(value)
    WHERE n.nspname = 'public'
      AND p.proname = 'auth_audit_log_cleanup_scheduled'
      AND pg_get_function_identity_arguments(p.oid) = ''
      AND config.value = 'search_path=public, pg_temp'
  )
  INTO v_has_search_path;

  IF v_has_search_path IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected auth_audit_log_cleanup_scheduled search_path to be public, pg_temp';
  END IF;

  SELECT has_function_privilege('service_role', 'public.auth_audit_log_cleanup_scheduled()', 'EXECUTE')
  INTO v_service_role_can_execute;
  SELECT has_function_privilege('public', 'public.auth_audit_log_cleanup_scheduled()', 'EXECUTE')
  INTO v_public_can_execute;
  SELECT has_function_privilege('authenticated', 'public.auth_audit_log_cleanup_scheduled()', 'EXECUTE')
  INTO v_authenticated_can_execute;
  SELECT has_function_privilege('anon', 'public.auth_audit_log_cleanup_scheduled()', 'EXECUTE')
  INTO v_anon_can_execute;

  IF v_service_role_can_execute IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected service_role EXECUTE grant on auth_audit_log_cleanup_scheduled';
  END IF;

  IF v_public_can_execute OR v_authenticated_can_execute OR v_anon_can_execute THEN
    RAISE EXCEPTION 'Expected auth_audit_log_cleanup_scheduled execute grants to exclude PUBLIC/anon/authenticated';
  END IF;
END;
$$;

DO $$
DECLARE
  v_old_request_id text := 'smoke-auth-audit-retention-old';
  v_new_request_id text := 'smoke-auth-audit-retention-new';
  v_old_created_at timestamptz := now() - interval '91 days';
  v_new_created_at timestamptz := now() - interval '89 days';
  v_result record;
  v_old_remaining integer;
  v_new_remaining integer;
BEGIN
  DELETE FROM public.auth_audit_log
  WHERE request_id IN (v_old_request_id, v_new_request_id);

  PERFORM public.auth_audit_log_insert(
    p_created_at := v_old_created_at,
    p_event := 'login_success',
    p_source := 'events_signin',
    p_user_id := '391',
    p_username := 'retention-old',
    p_request_id := v_old_request_id,
    p_user_agent := 'SmokeAuthAuditRetention/1.0'
  );

  PERFORM public.auth_audit_log_insert(
    p_created_at := v_new_created_at,
    p_event := 'login_success',
    p_source := 'events_signin',
    p_user_id := '391',
    p_username := 'retention-new',
    p_request_id := v_new_request_id,
    p_user_agent := 'SmokeAuthAuditRetention/1.0'
  );

  SELECT *
  INTO v_result
  FROM public.auth_audit_log_cleanup_scheduled();

  IF v_result.cutoff_date < now() - interval '91 days'
     OR v_result.cutoff_date > now() - interval '89 days' THEN
    RAISE EXCEPTION 'Expected auth audit cleanup cutoff to be about 90 days, got %', v_result.cutoff_date;
  END IF;

  IF v_result.deleted_count < 1 THEN
    RAISE EXCEPTION 'Expected auth audit cleanup to delete at least one old row';
  END IF;

  SELECT COUNT(*)
  INTO v_old_remaining
  FROM public.auth_audit_log
  WHERE request_id = v_old_request_id;

  SELECT COUNT(*)
  INTO v_new_remaining
  FROM public.auth_audit_log
  WHERE request_id = v_new_request_id;

  IF v_old_remaining <> 0 THEN
    RAISE EXCEPTION 'Expected 91-day auth audit row to be purged';
  END IF;

  IF v_new_remaining <> 1 THEN
    RAISE EXCEPTION 'Expected 89-day auth audit row to remain';
  END IF;

  DELETE FROM public.auth_audit_log
  WHERE request_id IN (v_old_request_id, v_new_request_id);
END;
$$;
