-- Smoke test for Issue #544 login-attempt throttling.
-- Expected to pass only after applying the auth login throttle migration.

DO $$
DECLARE
  v_ip inet := '203.0.113.44'::inet;
  v_other_ip inet := '203.0.113.45'::inet;
  v_check record;
  v_can_service_role boolean;
  v_can_anon boolean;
  v_can_authenticated boolean;
  v_has_search_path boolean;
  v_is_security_definer boolean;
  v_attempt integer;
BEGIN
  SELECT p.prosecdef
  INTO v_is_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'auth_login_throttle_check'
    AND pg_get_function_identity_arguments(p.oid) = 'p_username text, p_ip_address inet';

  IF v_is_security_definer IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'auth_login_throttle_check must be SECURITY DEFINER';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL unnest(p.proconfig) AS config(value)
    WHERE n.nspname = 'public'
      AND p.proname = 'auth_login_throttle_check'
      AND pg_get_function_identity_arguments(p.oid) = 'p_username text, p_ip_address inet'
      AND config.value = 'search_path=public, pg_temp'
  )
  INTO v_has_search_path;

  IF v_has_search_path IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'auth_login_throttle_check must use search_path=public, pg_temp';
  END IF;

  SELECT has_function_privilege('service_role', 'public.auth_login_throttle_check(text, inet)', 'EXECUTE')
  INTO v_can_service_role;
  SELECT has_function_privilege('anon', 'public.auth_login_throttle_check(text, inet)', 'EXECUTE')
  INTO v_can_anon;
  SELECT has_function_privilege('authenticated', 'public.auth_login_throttle_check(text, inet)', 'EXECUTE')
  INTO v_can_authenticated;

  IF v_can_service_role IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'service_role must execute auth_login_throttle_check';
  END IF;

  IF v_can_anon OR v_can_authenticated THEN
    RAISE EXCEPTION 'anon/authenticated must not execute auth_login_throttle_check directly';
  END IF;

  DELETE FROM public.auth_login_attempt_throttle
  WHERE ip_address IN (v_ip, v_other_ip);

  FOR v_attempt IN 1..4 LOOP
    PERFORM public.auth_login_throttle_record_failure('Throttle.User', v_ip);
    SELECT *
    INTO v_check
    FROM public.auth_login_throttle_check('Throttle.User', v_ip);

    IF v_check.allowed IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'username+ip bucket must allow attempt %', v_attempt;
    END IF;
  END LOOP;

  PERFORM public.auth_login_throttle_record_failure('Throttle.User', v_ip);
  SELECT *
  INTO v_check
  FROM public.auth_login_throttle_check('Throttle.User', v_ip);

  IF v_check.allowed IS DISTINCT FROM false
     OR v_check.blocked_scope <> 'username_ip'
     OR v_check.retry_after_seconds <= 0 THEN
    RAISE EXCEPTION '5th username+ip failure must block for about 30 minutes';
  END IF;

  PERFORM public.auth_login_throttle_record_success('Throttle.User', v_ip);
  SELECT *
  INTO v_check
  FROM public.auth_login_throttle_check('Throttle.User', v_ip);

  IF v_check.allowed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'successful credentials must reset username+ip throttle bucket';
  END IF;

  FOR v_attempt IN 1..20 LOOP
    PERFORM public.auth_login_throttle_record_failure('spray-' || v_attempt::text, v_other_ip);
  END LOOP;

  SELECT *
  INTO v_check
  FROM public.auth_login_throttle_check('new-target', v_other_ip);

  IF v_check.allowed IS DISTINCT FROM false
     OR v_check.blocked_scope <> 'ip'
     OR v_check.retry_after_seconds <= 0 THEN
    RAISE EXCEPTION '20 failures from one IP must block the ip bucket';
  END IF;

  DELETE FROM public.auth_login_attempt_throttle
  WHERE ip_address IN (v_ip, v_other_ip);
END;
$$;
