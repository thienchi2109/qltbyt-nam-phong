-- Smoke test for Issue #393 password-change hardening.
-- Expected to pass only after applying 20260505144500_harden_change_password_rpc.sql.

DO $$
DECLARE
  v_can_anon BOOLEAN;
  v_can_authenticated BOOLEAN;
  v_function_def TEXT;
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

  SELECT pg_get_functiondef('public.change_password(integer, text, text)'::regprocedure)
  INTO v_function_def;

  IF v_function_def NOT LIKE '%user_id claim mismatch%' THEN
    RAISE EXCEPTION 'change_password must reject p_user_id values that do not match JWT user_id';
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
