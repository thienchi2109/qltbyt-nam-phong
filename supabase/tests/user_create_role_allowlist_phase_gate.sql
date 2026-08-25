-- GitHub Issue #953: fail-closed user_create role validation before Phase 13.
BEGIN;

CREATE FUNCTION pg_temp.assert_true(p_label TEXT, p_condition BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
BEGIN
  IF NOT COALESCE(p_condition, false) THEN
    RAISE EXCEPTION 'assertion_failed: %', p_label;
  END IF;
END;
$gate$;

CREATE FUNCTION pg_temp.set_claims(p_app_role TEXT, p_user_id BIGINT, p_don_vi BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', p_app_role,
      'role', 'authenticated',
      'user_id', p_user_id::TEXT,
      'sub', p_user_id::TEXT,
      'don_vi', p_don_vi::TEXT
    )::TEXT,
    true
  );
END;
$gate$;

CREATE FUNCTION pg_temp.assert_create_error(
  p_label TEXT,
  p_username TEXT,
  p_role TEXT,
  p_don_vi BIGINT,
  p_expected_state TEXT,
  p_expected_message TEXT DEFAULT NULL,
  p_memberships BIGINT[] DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
DECLARE
  v_error_state TEXT;
  v_error_message TEXT;
BEGIN
  BEGIN
    PERFORM public.user_create(
      p_username,
      'issue953-password',
      'Issue 953 Rejected User',
      p_role,
      p_don_vi,
      COALESCE(p_memberships, ARRAY[p_don_vi])
    );
    RAISE EXCEPTION 'expected user_create rejection' USING ERRCODE = 'PT001';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_error_state = RETURNED_SQLSTATE,
        v_error_message = MESSAGE_TEXT;
  END;

  PERFORM pg_temp.assert_true(
    p_label,
    v_error_state = p_expected_state
    AND (p_expected_message IS NULL OR v_error_message = p_expected_message)
  );
  PERFORM pg_temp.assert_true(
    p_label || ' leaves no account, membership, or audit state',
    NOT EXISTS (
      SELECT 1
      FROM public.nhan_vien nv
      WHERE nv.username = p_username
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.audit_logs al
      WHERE al.target_username = p_username
    )
  );
END;
$gate$;

DO $gate$
DECLARE
  v_region_id BIGINT;
  v_unit_a BIGINT;
  v_unit_b BIGINT;
  v_global_id BIGINT;
  v_admin_id BIGINT;
  v_user_id BIGINT;
  v_created_user_id BIGINT;
  v_password_hash TEXT;
  v_role TEXT;
  v_role_input TEXT;
  v_username TEXT;
  v_function_oid OID;
  v_function_definition TEXT;
  v_guard_position INTEGER;
  v_hash_position INTEGER;
  v_insert_position INTEGER;
  v_allowed_roles CONSTANT TEXT[] := ARRAY[
    'global',
    'admin',
    'regional_leader',
    'to_qltb',
    'technician',
    'qltb_khoa',
    'user'
  ];
BEGIN
  v_password_hash := extensions.crypt(
    'issue953-password',
    extensions.gen_salt('bf', 4)
  );

  INSERT INTO public.dia_ban(ma_dia_ban, ten_dia_ban, active)
  VALUES (format('I953R%s', txid_current()), 'Issue 953 Region', true)
  RETURNING id INTO v_region_id;

  INSERT INTO public.don_vi(name, active, dia_ban_id)
  VALUES ('Issue 953 Unit A', true, v_region_id)
  RETURNING id INTO v_unit_a;

  INSERT INTO public.don_vi(name, active, dia_ban_id)
  VALUES ('Issue 953 Unit B', true, v_region_id)
  RETURNING id INTO v_unit_b;

  INSERT INTO public.nhan_vien(
    username, password, hashed_password, full_name, role, don_vi, current_don_vi, dia_ban_id
  )
  VALUES (
    format('issue953_global_%s', txid_current()),
    'hashed password',
    v_password_hash,
    'Issue 953 Global',
    'global',
    v_unit_a,
    v_unit_a,
    v_region_id
  )
  RETURNING id INTO v_global_id;

  INSERT INTO public.nhan_vien(
    username, password, hashed_password, full_name, role, don_vi, current_don_vi, dia_ban_id
  )
  VALUES (
    format('issue953_admin_%s', txid_current()),
    'hashed password',
    v_password_hash,
    'Issue 953 Admin',
    'admin',
    v_unit_a,
    v_unit_a,
    v_region_id
  )
  RETURNING id INTO v_admin_id;

  INSERT INTO public.nhan_vien(
    username, password, hashed_password, full_name, role, don_vi, current_don_vi, dia_ban_id
  )
  VALUES (
    format('issue953_user_%s', txid_current()),
    'hashed password',
    v_password_hash,
    'Issue 953 User',
    'user',
    v_unit_a,
    v_unit_a,
    v_region_id
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.user_don_vi_memberships(user_id, don_vi)
  VALUES
    (v_global_id, v_unit_a),
    (v_admin_id, v_unit_a),
    (v_user_id, v_unit_a);

  PERFORM pg_temp.set_claims('global', v_global_id, v_unit_a);
  FOREACH v_role IN ARRAY v_allowed_roles
  LOOP
    v_username := format('issue953_allowed_%s_%s', v_role, txid_current());
    v_role_input := CASE
      WHEN v_role = 'regional_leader' THEN '  REGIONAL_LEADER  '
      ELSE v_role
    END;
    v_created_user_id := public.user_create(
      v_username,
      'issue953-password',
      format('Issue 953 Allowed %s', v_role),
      v_role_input,
      v_unit_a,
      ARRAY[v_unit_a, v_unit_b]
    );

    PERFORM pg_temp.assert_true(
      format('user_create preserves supported role %s', v_role),
      EXISTS (
        SELECT 1
        FROM public.nhan_vien nv
        WHERE nv.id = v_created_user_id
          AND nv.role = v_role
          AND nv.don_vi = v_unit_a
          AND nv.current_don_vi = v_unit_a
          AND nv.hashed_password = extensions.crypt(
            'issue953-password',
            nv.hashed_password
          )
      )
      AND (
        SELECT count(*) = 2
        FROM public.user_don_vi_memberships udvm
        WHERE udvm.user_id = v_created_user_id
          AND udvm.don_vi IN (v_unit_a, v_unit_b)
      )
      AND (
        SELECT count(*) = 1
        FROM public.audit_logs al
        WHERE al.admin_user_id = v_global_id
          AND al.action_type = 'USER_CREATE'
          AND al.target_user_id = v_created_user_id
          AND al.action_details->>'role' = v_role
      )
    );
  END LOOP;

  PERFORM pg_temp.set_claims('admin', v_admin_id, v_unit_a);
  v_username := format('issue953_raw_admin_%s', txid_current());
  v_created_user_id := public.user_create(
    v_username,
    'issue953-password',
    'Issue 953 Raw Admin',
    'user',
    v_unit_a,
    ARRAY[v_unit_a]
  );
  PERFORM pg_temp.assert_true(
    'raw admin caller remains authorized',
    EXISTS (
      SELECT 1
      FROM public.audit_logs al
      WHERE al.admin_user_id = v_admin_id
        AND al.target_user_id = v_created_user_id
        AND al.action_type = 'USER_CREATE'
    )
  );

  PERFORM pg_temp.set_claims('global', v_global_id, v_unit_a);
  PERFORM pg_temp.assert_create_error(
    'unknown role fails closed',
    format('issue953_unknown_%s', txid_current()),
    'auditor',
    v_unit_a,
    '22023',
    'Invalid role'
  );
  PERFORM pg_temp.assert_create_error(
    'expert creation rejects non-canonical memberships',
    format('issue953_expert_%s', txid_current()),
    'chuyen_gia',
    v_unit_a,
    '22023',
    'Invalid expert memberships',
    ARRAY[v_unit_a, v_unit_b]
  );
  PERFORM pg_temp.assert_create_error(
    'empty role keeps required-field validation',
    format('issue953_empty_%s', txid_current()),
    '  ',
    v_unit_a,
    '22023',
    'Missing required fields'
  );

  PERFORM pg_temp.set_claims('user', v_user_id, v_unit_a);
  PERFORM pg_temp.assert_create_error(
    'non-global caller remains unauthorized',
    format('issue953_unauthorized_%s', txid_current()),
    'user',
    v_unit_a,
    '42501'
  );

  v_function_oid := to_regprocedure(
    'public.user_create(text,text,text,text,bigint,bigint[])'
  );
  SELECT LOWER(pg_get_functiondef(p.oid))
  INTO v_function_definition
  FROM pg_proc p
  WHERE p.oid = v_function_oid;

  v_guard_position := POSITION('if v_role not in (' IN v_function_definition);
  v_hash_position := POSITION('v_hashed_password :=' IN v_function_definition);
  v_insert_position := POSITION(
    'insert into public.nhan_vien' IN v_function_definition
  );
  PERFORM pg_temp.assert_true(
    'role allowlist guard runs before password hashing and writes',
    v_guard_position > 0
    AND v_guard_position < v_hash_position
    AND v_guard_position < v_insert_position
  );
  PERFORM pg_temp.assert_true(
    'user_create keeps owner and SECURITY DEFINER search_path contract',
    (
      SELECT pg_get_userbyid(p.proowner) = 'postgres'
        AND p.prosecdef
        AND p.proconfig = ARRAY['search_path=public, pg_temp']::TEXT[]
      FROM pg_proc p
      WHERE p.oid = v_function_oid
    )
  );
  PERFORM pg_temp.assert_true(
    'user_create is not PUBLIC executable',
    NOT EXISTS (
      SELECT 1
      FROM pg_proc p,
           LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
      WHERE p.oid = v_function_oid
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    )
  );
  PERFORM pg_temp.assert_true(
    'user_create keeps explicit execute ACLs',
    NOT has_function_privilege('anon', v_function_oid, 'EXECUTE')
    AND has_function_privilege('authenticated', v_function_oid, 'EXECUTE')
    AND has_function_privilege('service_role', v_function_oid, 'EXECUTE')
  );
END;
$gate$;

ROLLBACK;
