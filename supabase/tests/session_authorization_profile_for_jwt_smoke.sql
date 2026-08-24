BEGIN;

DO $$
DECLARE
  v_user_id bigint;
  v_missing_user_id bigint;
  v_row record;
  v_expected record;
  v_sqlstate text;
  v_is_security_definer boolean;
  v_has_search_path boolean;
BEGIN
  SELECT id::bigint
  INTO v_user_id
  FROM public.nhan_vien
  ORDER BY id
  LIMIT 1
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'session_authorization_profile_for_jwt_smoke requires at least one nhan_vien row';
  END IF;

  SELECT COALESCE(MAX(id), 0) + 1000000
  INTO v_missing_user_id
  FROM public.nhan_vien;

  UPDATE public.nhan_vien
  SET role = 'chuyen_gia'
  WHERE id = v_user_id;

  SELECT
    nv.password_changed_at::timestamptz AS password_changed_at,
    nv.current_don_vi::bigint AS current_don_vi,
    nv.don_vi::bigint AS don_vi,
    nv.khoa_phong::text AS khoa_phong,
    nv.full_name::text AS full_name,
    COALESCE(nv.dia_ban_id, dv.dia_ban_id)::bigint AS dia_ban_id,
    db.ma_dia_ban::text AS ma_dia_ban,
    nv.role::text AS role
  INTO v_expected
  FROM public.nhan_vien nv
  LEFT JOIN public.don_vi dv
    ON dv.id = COALESCE(nv.current_don_vi, nv.don_vi)
  LEFT JOIN public.dia_ban db
    ON db.id = COALESCE(nv.dia_ban_id, dv.dia_ban_id)
  WHERE nv.id = v_user_id;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
      'authenticated',
      'app_role',
      'global',
      'user_id',
      v_user_id::text
    )::text,
    true
  );

  SELECT *
  INTO v_row
  FROM public.get_session_authorization_profile_for_jwt(v_user_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected authorization profile RPC to return a row for matching user_id claim';
  END IF;

  IF v_row.password_changed_at IS DISTINCT FROM v_expected.password_changed_at
    OR v_row.current_don_vi IS DISTINCT FROM v_expected.current_don_vi
    OR v_row.don_vi IS DISTINCT FROM v_expected.don_vi
    OR v_row.khoa_phong IS DISTINCT FROM v_expected.khoa_phong
    OR v_row.full_name IS DISTINCT FROM v_expected.full_name
    OR v_row.dia_ban_id IS DISTINCT FROM v_expected.dia_ban_id
    OR v_row.ma_dia_ban IS DISTINCT FROM v_expected.ma_dia_ban
    OR v_row.role IS DISTINCT FROM 'chuyen_gia'
  THEN
    RAISE EXCEPTION 'Expected authorization profile RPC to return authoritative database profile fields';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
      'authenticated',
      'app_role',
      'global',
      'user_id',
      v_missing_user_id::text
    )::text,
    true
  );

  PERFORM *
  FROM public.get_session_authorization_profile_for_jwt(v_missing_user_id);

  IF FOUND THEN
    RAISE EXCEPTION 'Expected authorization profile RPC to return no row for a missing user';
  END IF;

  PERFORM set_config('request.jwt.claims', '{}'::text, true);
  BEGIN
    PERFORM * FROM public.get_session_authorization_profile_for_jwt(v_user_id);
    RAISE EXCEPTION 'Expected missing JWT claims to be denied with 42501';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected missing JWT claims to deny with 42501, got %', v_sqlstate;
    END IF;
  END;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'user_id', v_user_id::text)::text,
    true
  );
  BEGIN
    PERFORM * FROM public.get_session_authorization_profile_for_jwt(v_user_id);
    RAISE EXCEPTION 'Expected missing app_role claim to be denied with 42501';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected missing app_role claim to deny with 42501, got %', v_sqlstate;
    END IF;
  END;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
      'authenticated',
      'app_role',
      'global',
      'user_id',
      (v_user_id + 1)::text
    )::text,
    true
  );
  BEGIN
    PERFORM * FROM public.get_session_authorization_profile_for_jwt(v_user_id);
    RAISE EXCEPTION 'Expected mismatched user_id claim to be denied with 42501';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected mismatched user_id claim to deny with 42501, got %', v_sqlstate;
    END IF;
  END;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
      'authenticated',
      'app_role',
      'global',
      'user_id',
      'not-a-number'
    )::text,
    true
  );
  BEGIN
    PERFORM * FROM public.get_session_authorization_profile_for_jwt(v_user_id);
    RAISE EXCEPTION 'Expected malformed user_id claim to be denied with 42501';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected malformed user_id claim to deny with 42501, got %', v_sqlstate;
    END IF;
  END;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
      'authenticated',
      'app_role',
      'global',
      'user_id',
      '9223372036854775808'
    )::text,
    true
  );
  BEGIN
    PERFORM * FROM public.get_session_authorization_profile_for_jwt(v_user_id);
    RAISE EXCEPTION 'Expected overflowing user_id claim to be denied with 42501';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected overflowing user_id claim to deny with 42501, got %', v_sqlstate;
    END IF;
  END;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
      'authenticated',
      'app_role',
      'unsupported_role',
      'user_id',
      v_user_id::text
    )::text,
    true
  );
  BEGIN
    PERFORM * FROM public.get_session_authorization_profile_for_jwt(v_user_id);
    RAISE EXCEPTION 'Expected unsupported app_role claim to be denied with 42501';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected unsupported app_role claim to deny with 42501, got %', v_sqlstate;
    END IF;
  END;

  PERFORM set_config('request.jwt.claims', '{malformed-json', true);
  BEGIN
    PERFORM * FROM public.get_session_authorization_profile_for_jwt(v_user_id);
    RAISE EXCEPTION 'Expected malformed JWT claims to be denied with 42501';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected malformed JWT claims to deny with 42501, got %', v_sqlstate;
    END IF;
  END;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
      'authenticated',
      'app_role',
      'global',
      'user_id',
      v_user_id::text
    )::text,
    true
  );

  UPDATE public.nhan_vien
  SET role = 'unsupported_role'
  WHERE id = v_user_id;

  BEGIN
    PERFORM * FROM public.get_session_authorization_profile_for_jwt(v_user_id);
    RAISE EXCEPTION 'Expected unsupported database role to be denied with 42501';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected unsupported database role to deny with 42501, got %', v_sqlstate;
    END IF;
  END;

  UPDATE public.nhan_vien
  SET role = ''
  WHERE id = v_user_id;

  BEGIN
    PERFORM * FROM public.get_session_authorization_profile_for_jwt(v_user_id);
    RAISE EXCEPTION 'Expected empty database role to be denied with 42501';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected empty database role to deny with 42501, got %', v_sqlstate;
    END IF;
  END;

  SELECT p.prosecdef
  INTO v_is_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_session_authorization_profile_for_jwt'
    AND pg_get_function_identity_arguments(p.oid) = 'p_user_id bigint';

  IF v_is_security_definer IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected authorization profile RPC to be SECURITY DEFINER';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL unnest(p.proconfig) AS config(value)
    WHERE n.nspname = 'public'
      AND p.proname = 'get_session_authorization_profile_for_jwt'
      AND pg_get_function_identity_arguments(p.oid) = 'p_user_id bigint'
      AND config.value = 'search_path=public, pg_temp'
  )
  INTO v_has_search_path;

  IF v_has_search_path IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected authorization profile RPC search_path to be public, pg_temp';
  END IF;

  IF has_function_privilege(
    'public',
    'public.get_session_authorization_profile_for_jwt(bigint)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Expected PUBLIC execute privilege to be revoked';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.get_session_authorization_profile_for_jwt(bigint)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Expected anon execute privilege to be revoked';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.get_session_authorization_profile_for_jwt(bigint)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Expected authenticated execute privilege';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.get_session_authorization_profile_for_jwt(bigint)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Expected service_role execute privilege';
  END IF;
END;
$$;

ROLLBACK;
