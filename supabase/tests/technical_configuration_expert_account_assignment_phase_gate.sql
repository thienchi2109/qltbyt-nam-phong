-- OpenSpec Phase 13: expert assignment is global/admin-owned, canonical, atomic, and dormant elsewhere.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(p_label TEXT, p_condition BOOLEAN)
RETURNS VOID LANGUAGE plpgsql
AS $gate$
BEGIN
  IF NOT COALESCE(p_condition, false) THEN
    RAISE EXCEPTION 'assertion_failed: %', p_label;
  END IF;
END;
$gate$;
CREATE FUNCTION pg_temp.set_claims(p_app_role TEXT, p_user_id BIGINT, p_don_vi BIGINT)
RETURNS VOID LANGUAGE plpgsql
AS $gate$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', p_app_role, 'role', 'authenticated',
      'user_id', p_user_id::TEXT, 'sub', p_user_id::TEXT, 'don_vi', p_don_vi::TEXT
    )::TEXT,
    true
  );
END;
$gate$;
CREATE FUNCTION pg_temp.expect_create_error(
  p_case TEXT, p_role TEXT, p_don_vi BIGINT, p_memberships BIGINT[],
  p_expected_state TEXT,
  p_expected_message TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql
AS $gate$
DECLARE
  v_username TEXT := format('phase13_rejected_%s_%s', p_case, txid_current());
  v_error_state TEXT; v_error_message TEXT;
BEGIN
  BEGIN
    PERFORM public.user_create(
      v_username, 'phase13-password', 'Phase 13 Rejected Expert',
      p_role, p_don_vi, p_memberships
    );
    RAISE EXCEPTION 'expected user_create rejection' USING ERRCODE = 'PT001';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_error_state = RETURNED_SQLSTATE,
        v_error_message = MESSAGE_TEXT;
  END;
  PERFORM pg_temp.assert_true(
    p_case || ' returns expected error',
    v_error_state = p_expected_state
    AND (p_expected_message IS NULL OR v_error_message = p_expected_message)
  );
  PERFORM pg_temp.assert_true(
    p_case || ' leaves no account or audit state',
    NOT EXISTS (SELECT 1 FROM public.nhan_vien WHERE username = v_username)
    AND NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE target_username = v_username)
  );
END;
$gate$;
CREATE FUNCTION pg_temp.expect_update_error(
  p_case TEXT, p_target_user_id BIGINT, p_role TEXT, p_expected_state TEXT
)
RETURNS VOID LANGUAGE plpgsql
AS $gate$
DECLARE
  v_error_state TEXT;
BEGIN
  BEGIN
    PERFORM public.user_update_profile(
      p_target_user_id::INTEGER,
      format('phase13_rejected_update_%s', p_target_user_id),
      'Phase 13 Rejected Update', p_role, 'Rejected Department'
    );
    RAISE EXCEPTION 'expected user_update_profile rejection' USING ERRCODE = 'PT001';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
  END;
  PERFORM pg_temp.assert_true(
    p_case || ' returns expected error',
    v_error_state = p_expected_state
  );
END;
$gate$;
CREATE FUNCTION pg_temp.assert_expert_scope(
  p_label TEXT, p_user_id BIGINT, p_don_vi BIGINT, p_dia_ban_id BIGINT
)
RETURNS VOID LANGUAGE plpgsql
AS $gate$
BEGIN
  PERFORM pg_temp.assert_true(
    p_label,
    EXISTS (
      SELECT 1 FROM public.nhan_vien
      WHERE id = p_user_id
        AND role = 'chuyen_gia'
        AND don_vi = p_don_vi
        AND current_don_vi = p_don_vi
        AND dia_ban_id = p_dia_ban_id
    )
    AND (
      SELECT count(*) = 1 AND bool_and(don_vi = p_don_vi AND role_override IS NULL)
      FROM public.user_don_vi_memberships
      WHERE user_id = p_user_id
    )
  );
END;
$gate$;
CREATE FUNCTION pg_temp.reject_phase13_membership_retirement()
RETURNS TRIGGER LANGUAGE plpgsql
AS $gate$
BEGIN
  IF OLD.user_id = NULLIF(current_setting('phase13.rollback_user_id', true), '')::BIGINT
    AND OLD.don_vi = NULLIF(current_setting('phase13.rollback_home_id', true), '')::BIGINT THEN
    RAISE EXCEPTION 'phase13_forced_membership_retirement_failure';
  END IF;
  RETURN OLD;
END;
$gate$;
CREATE TRIGGER phase13_reject_membership_retirement BEFORE DELETE ON public.user_don_vi_memberships
FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_phase13_membership_retirement();
DO $gate$
DECLARE
  v_region_a BIGINT; v_region_b BIGINT; v_inactive_region BIGINT;
  v_unit_a BIGINT; v_unit_b BIGINT; v_inactive_unit BIGINT; v_inactive_region_unit BIGINT;
  v_global_id BIGINT; v_admin_id BIGINT; v_technician_id BIGINT;
  v_expert_caller_id BIGINT; v_global_target_id BIGINT; v_admin_target_id BIGINT;
  v_unauthorized_target_id BIGINT; v_existing_expert_id BIGINT; v_expert_to_user_id BIGINT;
  v_incomplete_target_id BIGINT; v_rollback_target_id BIGINT;
  v_created_global_id BIGINT; v_created_admin_id BIGINT;
  v_password_hash TEXT; v_error_state TEXT; v_signature TEXT;
  v_function_oid OID; v_function_definition TEXT;
BEGIN
  v_password_hash := extensions.crypt('phase13-password', extensions.gen_salt('bf', 4));
  INSERT INTO public.dia_ban(ma_dia_ban, ten_dia_ban, active) VALUES
    (format('P13A%s', txid_current()), 'Phase 13 Region A', true) RETURNING id INTO v_region_a;
  INSERT INTO public.dia_ban(ma_dia_ban, ten_dia_ban, active) VALUES
    (format('P13B%s', txid_current()), 'Phase 13 Region B', true) RETURNING id INTO v_region_b;
  INSERT INTO public.dia_ban(ma_dia_ban, ten_dia_ban, active) VALUES
    (format('P13I%s', txid_current()), 'Phase 13 Inactive Region', false)
    RETURNING id INTO v_inactive_region;
  INSERT INTO public.don_vi(name, active, dia_ban_id) VALUES
    ('Phase 13 Unit A', true, v_region_a) RETURNING id INTO v_unit_a;
  INSERT INTO public.don_vi(name, active, dia_ban_id) VALUES
    ('Phase 13 Unit B', true, v_region_b) RETURNING id INTO v_unit_b;
  INSERT INTO public.don_vi(name, active, dia_ban_id) VALUES
    ('Phase 13 Inactive Unit', false, v_region_a) RETURNING id INTO v_inactive_unit;
  INSERT INTO public.don_vi(name, active, dia_ban_id) VALUES
    ('Phase 13 Inactive Region Unit', true, v_inactive_region)
    RETURNING id INTO v_inactive_region_unit;
  INSERT INTO public.nhan_vien(
    username, password, hashed_password, full_name, role, don_vi, current_don_vi, dia_ban_id
  )
  VALUES
    (format('phase13_global_%s', txid_current()), 'hashed password', v_password_hash,
      'Phase 13 Global', 'global', v_unit_a, v_unit_a, v_region_a),
    (format('phase13_admin_%s', txid_current()), 'hashed password', v_password_hash,
      'Phase 13 Admin', 'admin', v_unit_a, v_unit_a, v_region_a),
    (format('phase13_technician_%s', txid_current()), 'hashed password', v_password_hash,
      'Phase 13 Technician', 'technician', v_unit_a, v_unit_a, v_region_a),
    (format('phase13_expert_caller_%s', txid_current()), 'hashed password', v_password_hash,
      'Phase 13 Expert Caller', 'chuyen_gia', v_unit_a, v_unit_a, v_region_a);
  SELECT id INTO v_global_id FROM public.nhan_vien WHERE username = format('phase13_global_%s', txid_current());
  SELECT id INTO v_admin_id FROM public.nhan_vien WHERE username = format('phase13_admin_%s', txid_current());
  SELECT id INTO v_technician_id FROM public.nhan_vien WHERE username = format('phase13_technician_%s', txid_current());
  SELECT id INTO v_expert_caller_id FROM public.nhan_vien WHERE username = format('phase13_expert_caller_%s', txid_current());
  INSERT INTO public.nhan_vien(
    username, password, hashed_password, full_name, role, don_vi, current_don_vi,
    dia_ban_id, khoa_phong
  )
  VALUES
    (format('phase13_target_global_%s', txid_current()), 'hashed password', v_password_hash,
      'Global Target Before', 'user', v_unit_a, v_unit_b, v_region_a, 'Old Global'),
    (format('phase13_target_admin_%s', txid_current()), 'hashed password', v_password_hash,
      'Admin Target Before', 'user', v_unit_b, v_unit_a, v_region_b, 'Old Admin'),
    (format('phase13_target_unauthorized_%s', txid_current()), 'hashed password', v_password_hash,
      'Unauthorized Target Before', 'user', v_unit_a, v_unit_a, v_region_a, 'Old Unauthorized'),
    (format('phase13_existing_expert_%s', txid_current()), 'hashed password', v_password_hash,
      'Existing Expert Before', 'chuyen_gia', v_unit_a, v_unit_a, v_region_a, NULL),
    (format('phase13_expert_to_user_%s', txid_current()), 'hashed password', v_password_hash,
      'Expert To User Before', 'chuyen_gia', v_unit_a, v_unit_a, v_region_a, NULL),
    (format('phase13_incomplete_%s', txid_current()), 'hashed password', v_password_hash,
      'Incomplete Target Before', 'user', v_unit_a, NULL, v_region_a, NULL),
    (format('phase13_rollback_%s', txid_current()), 'hashed password', v_password_hash,
      'Rollback Target Before', 'user', v_unit_a, v_unit_b, v_region_a, 'Rollback Department');
  SELECT id INTO v_global_target_id FROM public.nhan_vien WHERE username = format('phase13_target_global_%s', txid_current());
  SELECT id INTO v_admin_target_id FROM public.nhan_vien WHERE username = format('phase13_target_admin_%s', txid_current());
  SELECT id INTO v_unauthorized_target_id FROM public.nhan_vien WHERE username = format('phase13_target_unauthorized_%s', txid_current());
  SELECT id INTO v_existing_expert_id FROM public.nhan_vien WHERE username = format('phase13_existing_expert_%s', txid_current());
  SELECT id INTO v_expert_to_user_id FROM public.nhan_vien WHERE username = format('phase13_expert_to_user_%s', txid_current());
  SELECT id INTO v_incomplete_target_id FROM public.nhan_vien WHERE username = format('phase13_incomplete_%s', txid_current());
  SELECT id INTO v_rollback_target_id FROM public.nhan_vien WHERE username = format('phase13_rollback_%s', txid_current());
  INSERT INTO public.user_don_vi_memberships(user_id, don_vi, role_override)
  VALUES
    (v_global_id, v_unit_a, NULL),
    (v_admin_id, v_unit_a, NULL),
    (v_technician_id, v_unit_a, NULL),
    (v_expert_caller_id, v_unit_a, NULL),
    (v_global_target_id, v_unit_a, 'user'),
    (v_global_target_id, v_unit_b, 'technician'),
    (v_admin_target_id, v_unit_a, 'user'),
    (v_admin_target_id, v_unit_b, 'technician'),
    (v_unauthorized_target_id, v_unit_a, NULL),
    (v_existing_expert_id, v_unit_a, NULL),
    (v_expert_to_user_id, v_unit_a, NULL),
    (v_incomplete_target_id, v_unit_a, NULL),
    (v_rollback_target_id, v_unit_a, 'user'),
    (v_rollback_target_id, v_unit_b, 'technician');
  PERFORM pg_temp.set_claims('global', v_global_id, v_unit_a);
  v_created_global_id := public.user_create(
    format('phase13_created_global_%s', txid_current()),
    'phase13-password',
    'Phase 13 Global Expert',
    'chuyen_gia',
    v_unit_a,
    ARRAY[v_unit_a, v_unit_a]
  );
  PERFORM pg_temp.assert_expert_scope(
    'global creates one canonical expert assignment',
    v_created_global_id,
    v_unit_a,
    v_region_a
  );
  PERFORM pg_temp.assert_true(
    'global create keeps optional department null and writes one audit row',
    (SELECT khoa_phong IS NULL FROM public.nhan_vien WHERE id = v_created_global_id)
    AND (SELECT count(*) = 1 FROM public.audit_logs
         WHERE target_user_id = v_created_global_id AND action_type = 'USER_CREATE')
  );
  PERFORM pg_temp.set_claims('admin', v_admin_id, v_unit_a);
  v_created_admin_id := public.user_create(
    format('phase13_created_admin_%s', txid_current()),
    'phase13-password',
    'Phase 13 Admin Expert',
    '  CHUYEN_GIA  ',
    v_unit_b,
    NULL
  );
  PERFORM pg_temp.assert_expert_scope(
    'raw admin creates canonical expert assignment',
    v_created_admin_id,
    v_unit_b,
    v_region_b
  );
  PERFORM pg_temp.set_claims('global', v_global_id, v_unit_a);
  PERFORM pg_temp.expect_create_error(
    'missing_unit', 'chuyen_gia', NULL, NULL, '22023', 'Missing required fields'
  );
  PERFORM pg_temp.expect_create_error(
    'inactive_unit', 'chuyen_gia', v_inactive_unit, NULL, '22023',
    'Invalid expert destination'
  );
  PERFORM pg_temp.expect_create_error(
    'inactive_region', 'chuyen_gia', v_inactive_region_unit, NULL, '22023',
    'Invalid expert destination'
  );
  PERFORM pg_temp.expect_create_error(
    'additional_membership', 'chuyen_gia', v_unit_a, ARRAY[v_unit_a, v_unit_b],
    '22023', 'Invalid expert memberships'
  );
  PERFORM pg_temp.expect_create_error(
    'unknown_role', 'auditor', v_unit_a, ARRAY[v_unit_a], '22023', 'Invalid role'
  );
  PERFORM pg_temp.set_claims('technician', v_technician_id, v_unit_a);
  PERFORM pg_temp.expect_create_error(
    'unauthorized_caller', 'chuyen_gia', v_unit_a, ARRAY[v_unit_a], '42501'
  );
  PERFORM pg_temp.set_claims('global', v_global_id, v_unit_a);
  PERFORM public.user_update_profile(
    v_global_target_id::INTEGER, format('phase13_target_global_updated_%s', txid_current()),
    'Global Target After', 'chuyen_gia', 'Global Expert Department'
  );
  PERFORM pg_temp.assert_expert_scope(
    'global transition canonicalizes current scope and retires obsolete state',
    v_global_target_id,
    v_unit_b,
    v_region_b
  );
  PERFORM pg_temp.assert_true(
    'global transition updates profile and writes one audit row',
    (SELECT ROW(full_name, khoa_phong) = ROW('Global Target After', 'Global Expert Department')
     FROM public.nhan_vien WHERE id = v_global_target_id)
    AND (SELECT count(*) = 1 FROM public.audit_logs
         WHERE target_user_id = v_global_target_id AND action_type = 'USER_UPDATE')
  );
  PERFORM pg_temp.set_claims('admin', v_admin_id, v_unit_a);
  PERFORM public.user_update_profile(
    v_admin_target_id::INTEGER, format('phase13_target_admin_updated_%s', txid_current()),
    'Admin Target After', 'chuyen_gia', NULL
  );
  PERFORM pg_temp.assert_expert_scope(
    'raw admin transition uses existing current unit as canonical',
    v_admin_target_id,
    v_unit_a,
    v_region_a
  );
  PERFORM pg_temp.assert_true(
    'raw admin transition keeps optional department null',
    (SELECT khoa_phong IS NULL FROM public.nhan_vien WHERE id = v_admin_target_id)
  );
  PERFORM pg_temp.set_claims('global', v_global_id, v_unit_a);
  PERFORM public.user_update_profile(
    v_existing_expert_id::INTEGER, format('phase13_existing_expert_updated_%s', txid_current()),
    'Existing Expert After', 'chuyen_gia', 'Updated Department'
  );
  PERFORM public.user_update_profile(
    v_expert_to_user_id::INTEGER, format('phase13_expert_to_user_updated_%s', txid_current()),
    'Expert To User After', 'user', 'User Department'
  );
  PERFORM pg_temp.assert_expert_scope(
    'existing expert update keeps canonical scope',
    v_existing_expert_id,
    v_unit_a,
    v_region_a
  );
  PERFORM pg_temp.assert_true(
    'expert profile update and expert-to-user transition remain compatible',
    (SELECT full_name = 'Existing Expert After' FROM public.nhan_vien
     WHERE id = v_existing_expert_id)
    AND (SELECT ROW(full_name, role, don_vi, current_don_vi, dia_ban_id)
         = ROW('Expert To User After', 'user', v_unit_a, v_unit_a, v_region_a)
         FROM public.nhan_vien WHERE id = v_expert_to_user_id)
  );
  PERFORM pg_temp.set_claims('global', v_global_id, v_unit_a);
  PERFORM pg_temp.expect_update_error(
    'incomplete expert scope', v_incomplete_target_id, 'chuyen_gia', '22023'
  );
  PERFORM pg_temp.assert_true(
    'incomplete expert transition leaves account and memberships unchanged',
    (SELECT ROW(username, full_name, role, don_vi, current_don_vi, dia_ban_id)
       IS NOT DISTINCT FROM ROW(
         format('phase13_incomplete_%s', txid_current()),
         'Incomplete Target Before', 'user', v_unit_a, NULL, v_region_a
       )
     FROM public.nhan_vien WHERE id = v_incomplete_target_id)
    AND (
      SELECT count(*) = 1 AND bool_and(don_vi = v_unit_a AND role_override IS NULL)
      FROM public.user_don_vi_memberships
      WHERE user_id = v_incomplete_target_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.audit_logs
      WHERE target_user_id = v_incomplete_target_id AND action_type = 'USER_UPDATE'
    )
  );
  PERFORM set_config('phase13.rollback_user_id', v_rollback_target_id::TEXT, true);
  PERFORM set_config('phase13.rollback_home_id', v_unit_a::TEXT, true);
  BEGIN
    PERFORM public.user_update_profile(
      v_rollback_target_id::INTEGER, format('phase13_rollback_updated_%s', txid_current()),
      'Rollback Target After', 'chuyen_gia', 'Changed Department'
    );
    RAISE EXCEPTION 'expected forced rollback' USING ERRCODE = 'PT001';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
  END;
  PERFORM pg_temp.assert_true(
    'forced retirement failure rolls back profile scope memberships and audit',
    v_error_state = 'P0001'
    AND (SELECT ROW(username, full_name, role, khoa_phong, don_vi, current_don_vi, dia_ban_id)
           = ROW(format('phase13_rollback_%s', txid_current()), 'Rollback Target Before',
                 'user', 'Rollback Department', v_unit_a, v_unit_b, v_region_a)
         FROM public.nhan_vien WHERE id = v_rollback_target_id)
    AND (
      SELECT count(*) = 2
        AND bool_and(
          (don_vi = v_unit_a AND role_override = 'user')
          OR (don_vi = v_unit_b AND role_override = 'technician')
        )
      FROM public.user_don_vi_memberships
      WHERE user_id = v_rollback_target_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.audit_logs
      WHERE target_user_id = v_rollback_target_id AND action_type = 'USER_UPDATE'
    )
  );
  PERFORM pg_temp.set_claims('technician', v_technician_id, v_unit_a);
  PERFORM pg_temp.expect_update_error(
    'stored and JWT technician caller', v_unauthorized_target_id, 'chuyen_gia', '42501'
  );
  PERFORM pg_temp.set_claims('global', v_technician_id, v_unit_a);
  PERFORM pg_temp.expect_update_error(
    'JWT and stored role mismatch', v_unauthorized_target_id, 'chuyen_gia', '42501'
  );
  PERFORM pg_temp.set_claims('chuyen_gia', v_expert_caller_id, v_unit_a);
  PERFORM pg_temp.expect_update_error(
    'expert caller', v_unauthorized_target_id, 'chuyen_gia', '42501'
  );
  PERFORM pg_temp.assert_true(
    'unauthorized updates leave profile scope memberships and audit unchanged',
    (SELECT ROW(username, full_name, role, khoa_phong, don_vi, current_don_vi, dia_ban_id)
       = ROW(format('phase13_target_unauthorized_%s', txid_current()),
             'Unauthorized Target Before', 'user', 'Old Unauthorized',
             v_unit_a, v_unit_a, v_region_a)
     FROM public.nhan_vien WHERE id = v_unauthorized_target_id)
    AND (
      SELECT count(*) = 1 AND bool_and(don_vi = v_unit_a AND role_override IS NULL)
      FROM public.user_don_vi_memberships
      WHERE user_id = v_unauthorized_target_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.audit_logs
      WHERE target_user_id = v_unauthorized_target_id AND action_type = 'USER_UPDATE'
    )
  );
  FOREACH v_signature IN ARRAY ARRAY[
    'public.user_create(text,text,text,text,bigint,bigint[])',
    'public.user_update_profile(integer,text,text,text,text)'
  ]
  LOOP
    v_function_oid := to_regprocedure(v_signature);
    v_function_definition := LOWER(pg_get_functiondef(v_function_oid));
    PERFORM pg_temp.assert_true(v_signature || ' exists', v_function_oid IS NOT NULL);
    PERFORM pg_temp.assert_true(
      v_signature || ' keeps SECURITY DEFINER and fixed search_path',
      (
        SELECT p.prosecdef
          AND p.proconfig = ARRAY['search_path=public, pg_temp']::TEXT[]
        FROM pg_proc p
        WHERE p.oid = v_function_oid
      )
    );
    PERFORM pg_temp.assert_true(
      v_signature || ' denies PUBLIC and anon',
      NOT has_function_privilege('public', v_function_oid, 'EXECUTE')
      AND NOT has_function_privilege('anon', v_function_oid, 'EXECUTE')
    );
    PERFORM pg_temp.assert_true(
      v_signature || ' grants authenticated and service_role',
      has_function_privilege('authenticated', v_function_oid, 'EXECUTE')
      AND has_function_privilege('service_role', v_function_oid, 'EXECUTE')
    );
    PERFORM pg_temp.assert_true(
      v_signature || ' accepts the canonical expert role',
      POSITION('''chuyen_gia''' IN v_function_definition) > 0
    );
  END LOOP;
  v_function_definition := LOWER(pg_get_functiondef(
    'public.user_update_profile(integer,text,text,text,text)'::REGPROCEDURE
  ));
  PERFORM pg_temp.assert_true(
    'user_update_profile locks the target account before canonicalization',
    POSITION('for update' IN v_function_definition) > 0
  );
END;
$gate$;
ROLLBACK;
