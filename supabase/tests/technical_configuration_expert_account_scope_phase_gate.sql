-- OpenSpec add-technical-configuration-expert-role, Phase 12:
-- prove expert scope is immutable through generic RPCs and replaceable only
-- through the dedicated global/admin transaction.
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
CREATE FUNCTION pg_temp.expect_scope_call_sqlstate(
  p_label TEXT,
  p_function_name TEXT,
  p_user_id BIGINT,
  p_don_vi BIGINT,
  p_expected_sqlstate TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
DECLARE
  v_sqlstate TEXT;
BEGIN
  BEGIN
    CASE p_function_name
      WHEN 'user_membership_add' THEN
        PERFORM public.user_membership_add(p_user_id::INTEGER, p_don_vi);
      WHEN 'user_membership_remove' THEN
        PERFORM public.user_membership_remove(p_user_id::INTEGER, p_don_vi);
      WHEN 'user_set_current_don_vi' THEN
        PERFORM public.user_set_current_don_vi(p_user_id::INTEGER, p_don_vi);
      WHEN 'user_reassign_expert_scope' THEN
        PERFORM public.user_reassign_expert_scope(p_user_id, p_don_vi);
      ELSE
        RAISE EXCEPTION 'unknown test function: %', p_function_name;
    END CASE;
    RAISE EXCEPTION 'expected_sqlstate_not_raised: %', p_label;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
      IF v_sqlstate IS DISTINCT FROM p_expected_sqlstate THEN
        RAISE EXCEPTION '% expected SQLSTATE %, got %', p_label, p_expected_sqlstate, v_sqlstate;
      END IF;
  END;
END;
$gate$;
CREATE FUNCTION pg_temp.reject_phase12_assignment_retirement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $gate$
BEGIN
  IF OLD.user_id = NULLIF(current_setting('phase12.rollback_user_id', true), '')::BIGINT
    AND OLD.don_vi = NULLIF(current_setting('phase12.rollback_home_id', true), '')::BIGINT
  THEN
    RAISE EXCEPTION 'phase12_forced_assignment_retirement_failure';
  END IF;
  RETURN OLD;
END;
$gate$;
CREATE TRIGGER phase12_reject_assignment_retirement
BEFORE DELETE ON public.user_don_vi_memberships
FOR EACH ROW
EXECUTE FUNCTION pg_temp.reject_phase12_assignment_retirement();

DO $gate$
DECLARE
  v_region_a BIGINT;
  v_region_b BIGINT;
  v_unit_a BIGINT;
  v_unit_b BIGINT;
  v_unit_without_region BIGINT;
  v_inactive_unit BIGINT;
  v_global_id BIGINT;
  v_admin_id BIGINT;
  v_technician_id BIGINT;
  v_expert_id BIGINT;
  v_rollback_expert_id BIGINT;
  v_non_expert_id BIGINT;
  v_password_hash TEXT;
  v_reassign_oid OID;
  v_signature TEXT;
  v_function_oid OID;
  v_function_config TEXT[];
BEGIN
  v_password_hash := extensions.crypt(
    'phase12-password',
    extensions.gen_salt('bf', 4)
  );
  INSERT INTO public.dia_ban(ma_dia_ban, ten_dia_ban, active)
  VALUES (format('P12A%s', txid_current()), 'Phase 12 Region A', true)
  RETURNING id INTO v_region_a;
  INSERT INTO public.dia_ban(ma_dia_ban, ten_dia_ban, active)
  VALUES (format('P12B%s', txid_current()), 'Phase 12 Region B', true)
  RETURNING id INTO v_region_b;
  INSERT INTO public.don_vi(name, active, dia_ban_id)
  VALUES ('Phase 12 Unit A', true, v_region_a)
  RETURNING id INTO v_unit_a;
  INSERT INTO public.don_vi(name, active, dia_ban_id)
  VALUES ('Phase 12 Unit B', true, v_region_b)
  RETURNING id INTO v_unit_b;
  INSERT INTO public.don_vi(name, active, dia_ban_id)
  VALUES ('Phase 12 Unit Missing Region', true, NULL)
  RETURNING id INTO v_unit_without_region;
  INSERT INTO public.don_vi(name, active, dia_ban_id)
  VALUES ('Phase 12 Inactive Unit', false, v_region_b)
  RETURNING id INTO v_inactive_unit;

  INSERT INTO public.nhan_vien(
    username, password, hashed_password, full_name, role, don_vi, current_don_vi, dia_ban_id
  )
  VALUES (
    format('phase12_global_%s', txid_current()),
    'hashed password',
    v_password_hash,
    'Phase 12 Global',
    'global',
    v_unit_a,
    v_unit_a,
    v_region_a
  )
  RETURNING id INTO v_global_id;
  INSERT INTO public.nhan_vien(
    username, password, hashed_password, full_name, role, don_vi, current_don_vi, dia_ban_id
  )
  VALUES (
    format('phase12_admin_%s', txid_current()),
    'hashed password',
    v_password_hash,
    'Phase 12 Admin',
    'admin',
    v_unit_a,
    v_unit_a,
    v_region_a
  )
  RETURNING id INTO v_admin_id;
  INSERT INTO public.nhan_vien(
    username, password, hashed_password, full_name, role, don_vi, current_don_vi, dia_ban_id
  )
  VALUES (
    format('phase12_technician_%s', txid_current()),
    'hashed password',
    v_password_hash,
    'Phase 12 Technician',
    'technician',
    v_unit_a,
    v_unit_a,
    v_region_a
  )
  RETURNING id INTO v_technician_id;
  INSERT INTO public.nhan_vien(
    username, password, hashed_password, full_name, role, don_vi, current_don_vi, dia_ban_id
  )
  VALUES (
    format('phase12_expert_%s', txid_current()),
    'hashed password',
    v_password_hash,
    'Phase 12 Expert',
    'chuyen_gia',
    v_unit_a,
    v_unit_a,
    v_region_a
  )
  RETURNING id INTO v_expert_id;
  INSERT INTO public.nhan_vien(
    username, password, hashed_password, full_name, role, don_vi, current_don_vi, dia_ban_id
  )
  VALUES (
    format('phase12_rollback_expert_%s', txid_current()),
    'hashed password',
    v_password_hash,
    'Phase 12 Rollback Expert',
    'chuyen_gia',
    v_unit_a,
    v_unit_a,
    v_region_a
  )
  RETURNING id INTO v_rollback_expert_id;
  INSERT INTO public.nhan_vien(
    username, password, hashed_password, full_name, role, don_vi, current_don_vi, dia_ban_id
  )
  VALUES (
    format('phase12_user_%s', txid_current()),
    'hashed password',
    v_password_hash,
    'Phase 12 User',
    'user',
    v_unit_a,
    v_unit_a,
    v_region_a
  )
  RETURNING id INTO v_non_expert_id;

  INSERT INTO public.user_don_vi_memberships(user_id, don_vi, role_override)
  VALUES
    (v_global_id, v_unit_a, NULL),
    (v_admin_id, v_unit_a, NULL),
    (v_technician_id, v_unit_a, NULL),
    (v_expert_id, v_unit_a, NULL),
    (v_expert_id, v_unit_b, 'user'),
    (v_rollback_expert_id, v_unit_a, NULL),
    (v_non_expert_id, v_unit_a, NULL);
  v_reassign_oid := to_regprocedure(
    'public.user_reassign_expert_scope(bigint,bigint)'
  );
  PERFORM pg_temp.assert_true(
    'dedicated expert reassignment RPC exists',
    v_reassign_oid IS NOT NULL
  );
  PERFORM pg_temp.assert_true(
    'dedicated expert reassignment RPC is security definer',
    (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_reassign_oid)
  );
  SELECT p.proconfig
  INTO v_function_config
  FROM pg_proc p
  WHERE p.oid = v_reassign_oid;
  PERFORM pg_temp.assert_true(
    'dedicated expert reassignment RPC fixes search_path',
    v_function_config @> ARRAY['search_path=public, pg_temp']
  );
  PERFORM pg_temp.assert_true(
    'authenticated can execute dedicated expert reassignment RPC',
    has_function_privilege('authenticated', v_reassign_oid, 'EXECUTE')
  );
  PERFORM pg_temp.assert_true(
    'anon cannot execute dedicated expert reassignment RPC',
    NOT has_function_privilege('anon', v_reassign_oid, 'EXECUTE')
  );

  FOREACH v_signature IN ARRAY ARRAY[
    'public.user_membership_add(integer,bigint)',
    'public.user_membership_remove(integer,bigint)',
    'public.user_set_current_don_vi(integer,bigint)'
  ]
  LOOP
    v_function_oid := to_regprocedure(v_signature);
    SELECT p.proconfig
    INTO v_function_config
    FROM pg_proc p
    WHERE p.oid = v_function_oid;
    PERFORM pg_temp.assert_true(
      v_signature || ' remains security definer',
      (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_function_oid)
    );
    PERFORM pg_temp.assert_true(
      v_signature || ' fixes search_path',
      v_function_config @> ARRAY['search_path=public, pg_temp']
    );
  END LOOP;

  PERFORM pg_temp.set_claims('global', v_global_id, v_unit_a);
  PERFORM public.user_reassign_expert_scope(v_expert_id, v_unit_b);
  PERFORM pg_temp.assert_true(
    'global reassignment updates complete expert scope',
    EXISTS (
      SELECT 1
      FROM public.nhan_vien nv
      WHERE nv.id = v_expert_id
        AND nv.role = 'chuyen_gia'
        AND nv.don_vi = v_unit_b
        AND nv.current_don_vi = v_unit_b
        AND nv.dia_ban_id = v_region_b
    )
  );
  PERFORM pg_temp.assert_true(
    'global reassignment retires obsolete memberships and overrides',
    (SELECT count(*) = 1 AND bool_and(don_vi = v_unit_b AND role_override IS NULL)
     FROM public.user_don_vi_memberships
     WHERE user_id = v_expert_id)
  );

  PERFORM pg_temp.set_claims('admin', v_admin_id, v_unit_a);
  PERFORM public.user_reassign_expert_scope(v_expert_id, v_unit_a);
  PERFORM pg_temp.assert_true(
    'raw admin reassignment is accepted without changing stored role',
    EXISTS (
      SELECT 1
      FROM public.nhan_vien nv
      WHERE nv.id = v_expert_id
        AND nv.role = 'chuyen_gia'
        AND nv.don_vi = v_unit_a
        AND nv.current_don_vi = v_unit_a
        AND nv.dia_ban_id = v_region_a
    )
  );

  PERFORM set_config('phase12.rollback_user_id', v_rollback_expert_id::TEXT, true);
  PERFORM set_config('phase12.rollback_home_id', v_unit_a::TEXT, true);
  PERFORM pg_temp.set_claims('global', v_global_id, v_unit_a);
  PERFORM pg_temp.expect_scope_call_sqlstate(
    'cleanup failure rolls back the complete reassignment',
    'user_reassign_expert_scope',
    v_rollback_expert_id,
    v_unit_b,
    'P0001'
  );
  PERFORM pg_temp.assert_true(
    'rollback restores account fields',
    EXISTS (
      SELECT 1
      FROM public.nhan_vien nv
      WHERE nv.id = v_rollback_expert_id
        AND nv.don_vi = v_unit_a
        AND nv.current_don_vi = v_unit_a
        AND nv.dia_ban_id = v_region_a
    )
  );
  PERFORM pg_temp.assert_true(
    'rollback restores membership state',
    EXISTS (
      SELECT 1 FROM public.user_don_vi_memberships
      WHERE user_id = v_rollback_expert_id AND don_vi = v_unit_a
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_don_vi_memberships
      WHERE user_id = v_rollback_expert_id AND don_vi = v_unit_b
    )
  );

  PERFORM pg_temp.set_claims('global', v_global_id, v_unit_a);
  PERFORM pg_temp.expect_scope_call_sqlstate(
    'destination without region is rejected',
    'user_reassign_expert_scope',
    v_expert_id,
    v_unit_without_region,
    '22023'
  );
  PERFORM pg_temp.expect_scope_call_sqlstate(
    'inactive destination is rejected',
    'user_reassign_expert_scope',
    v_expert_id,
    v_inactive_unit,
    '22023'
  );

  PERFORM pg_temp.expect_scope_call_sqlstate(
    'generic membership add rejects an expert even when membership already exists',
    'user_membership_add',
    v_expert_id,
    v_unit_a,
    '42501'
  );
  PERFORM pg_temp.expect_scope_call_sqlstate(
    'generic membership remove rejects an expert',
    'user_membership_remove',
    v_expert_id,
    v_unit_a,
    '42501'
  );
  PERFORM pg_temp.set_claims('chuyen_gia', v_expert_id, v_unit_a);
  PERFORM pg_temp.expect_scope_call_sqlstate(
    'generic current-unit switch rejects the expert',
    'user_set_current_don_vi',
    v_expert_id,
    v_unit_b,
    '42501'
  );
  PERFORM pg_temp.assert_true(
    'generic mutation failures preserve expert state',
    EXISTS (
      SELECT 1
      FROM public.nhan_vien nv
      WHERE nv.id = v_expert_id
        AND nv.don_vi = v_unit_a
        AND nv.current_don_vi = v_unit_a
        AND nv.dia_ban_id = v_region_a
    )
    AND (SELECT count(*) = 1 FROM public.user_don_vi_memberships WHERE user_id = v_expert_id)
  );

  PERFORM pg_temp.set_claims('technician', v_technician_id, v_unit_a);
  PERFORM pg_temp.expect_scope_call_sqlstate(
    'non-global caller cannot use dedicated expert reassignment',
    'user_reassign_expert_scope',
    v_expert_id,
    v_unit_b,
    '42501'
  );

  PERFORM pg_temp.set_claims('global', v_global_id, v_unit_a);
  PERFORM public.user_membership_add(v_non_expert_id::INTEGER, v_unit_b);
  PERFORM pg_temp.assert_true(
    'non-expert membership add behavior remains unchanged',
    EXISTS (
      SELECT 1 FROM public.user_don_vi_memberships
      WHERE user_id = v_non_expert_id AND don_vi = v_unit_b
    )
  );
  PERFORM public.user_membership_remove(v_non_expert_id::INTEGER, v_unit_b);
  PERFORM pg_temp.assert_true(
    'non-expert membership remove behavior remains unchanged',
    NOT EXISTS (
      SELECT 1 FROM public.user_don_vi_memberships
      WHERE user_id = v_non_expert_id AND don_vi = v_unit_b
    )
  );
  PERFORM public.user_membership_add(v_non_expert_id::INTEGER, v_unit_b);
  PERFORM pg_temp.set_claims('user', v_non_expert_id, v_unit_a);
  PERFORM public.user_set_current_don_vi(v_non_expert_id::INTEGER, v_unit_b);
  PERFORM pg_temp.assert_true(
    'non-expert current-unit behavior remains unchanged',
    EXISTS (
      SELECT 1
      FROM public.nhan_vien nv
      WHERE nv.id = v_non_expert_id
        AND nv.role = 'user'
        AND nv.don_vi = v_unit_a
        AND nv.current_don_vi = v_unit_b
        AND nv.dia_ban_id = v_region_a
    )
  );

  PERFORM pg_temp.set_claims('global', v_global_id, v_unit_a);
  PERFORM pg_temp.expect_scope_call_sqlstate(
    'dedicated expert reassignment rejects non-expert targets',
    'user_reassign_expert_scope',
    v_non_expert_id,
    v_unit_a,
    '22023'
  );
END;
$gate$;

ROLLBACK;
