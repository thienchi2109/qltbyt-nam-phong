DO $$
DECLARE
  v_user_id bigint;
  v_row record;
  v_sqlstate text;
  v_is_security_definer boolean;
  v_has_search_path boolean;
BEGIN
  SELECT id::bigint
  INTO v_user_id
  FROM public.nhan_vien
  ORDER BY id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'session_profile_for_jwt_smoke requires at least one nhan_vien row';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'user_id', v_user_id::text)::text,
    true
  );

  SELECT *
  INTO v_row
  FROM public.get_session_profile_for_jwt(v_user_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected get_session_profile_for_jwt to return a row for matching user_id claim';
  END IF;

  PERFORM set_config('request.jwt.claims', '{}'::text, true);
  BEGIN
    PERFORM * FROM public.get_session_profile_for_jwt(v_user_id);
    RAISE EXCEPTION 'Expected missing user_id claim to be denied with 42501';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected missing user_id claim to deny with 42501, got %', v_sqlstate;
    END IF;
  END;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'user_id', (v_user_id + 1)::text)::text,
    true
  );
  BEGIN
    PERFORM * FROM public.get_session_profile_for_jwt(v_user_id);
    RAISE EXCEPTION 'Expected mismatched user_id claim to be denied with 42501';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected mismatched user_id claim to deny with 42501, got %', v_sqlstate;
    END IF;
  END;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'user_id', 'not-a-number')::text,
    true
  );
  BEGIN
    PERFORM * FROM public.get_session_profile_for_jwt(v_user_id);
    RAISE EXCEPTION 'Expected non-numeric user_id claim to be denied with 42501';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected non-numeric user_id claim to deny with 42501, got %', v_sqlstate;
    END IF;
  END;

  SELECT p.prosecdef
  INTO v_is_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_session_profile_for_jwt'
    AND pg_get_function_identity_arguments(p.oid) = 'p_user_id bigint';

  IF v_is_security_definer IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected get_session_profile_for_jwt to be SECURITY DEFINER';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL unnest(p.proconfig) AS config(value)
    WHERE n.nspname = 'public'
      AND p.proname = 'get_session_profile_for_jwt'
      AND pg_get_function_identity_arguments(p.oid) = 'p_user_id bigint'
      AND config.value = 'search_path=public, pg_temp'
  )
  INTO v_has_search_path;

  IF v_has_search_path IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected get_session_profile_for_jwt search_path to be public, pg_temp';
  END IF;
END;
$$;
