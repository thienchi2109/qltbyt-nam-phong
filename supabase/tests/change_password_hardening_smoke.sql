-- Smoke test for Issue #393 password-change hardening.
-- Expected to pass only after applying 20260505144500_harden_change_password_rpc.sql.

DO $$
DECLARE
  v_can_anon BOOLEAN;
  v_can_authenticated BOOLEAN;
  v_is_security_definer BOOLEAN;
  v_has_narrow_search_path BOOLEAN;
BEGIN
  SELECT has_function_privilege('anon', 'public.change_password(integer, text, text)', 'EXECUTE')
  INTO v_can_anon;

  IF v_can_anon THEN
    RAISE EXCEPTION 'anon must not execute public.change_password';
  END IF;

  SELECT has_function_privilege('authenticated', 'public.change_password(integer, text, text)', 'EXECUTE')
  INTO v_can_authenticated;

  IF NOT v_can_authenticated THEN
    RAISE EXCEPTION 'authenticated must execute public.change_password';
  END IF;

  SELECT p.prosecdef
  INTO v_is_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'change_password'
    AND pg_get_function_identity_arguments(p.oid) = 'p_user_id integer, p_old_password text, p_new_password text';

  IF v_is_security_definer IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'change_password must be SECURITY DEFINER';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL unnest(p.proconfig) AS config(value)
    WHERE n.nspname = 'public'
      AND p.proname = 'change_password'
      AND pg_get_function_identity_arguments(p.oid) = 'p_user_id integer, p_old_password text, p_new_password text'
      AND config.value = 'search_path=public, pg_temp'
  )
  INTO v_has_narrow_search_path;

  IF NOT v_has_narrow_search_path THEN
    RAISE EXCEPTION 'change_password must use search_path=public, pg_temp';
  END IF;

  PERFORM set_config('request.jwt.claims', '{}', true);
  BEGIN
    PERFORM public.change_password(1, 'old-password', 'new-password');
    RAISE EXCEPTION 'change_password must fail closed without user_id claim';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;

  PERFORM set_config('request.jwt.claims', '{"app_role":"to_qltb","user_id":"1"}', true);
  BEGIN
    PERFORM public.change_password(2, 'old-password', 'new-password');
    RAISE EXCEPTION 'change_password must fail closed when p_user_id mismatches JWT user_id';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    NULL;
  END;
END;
$$;
