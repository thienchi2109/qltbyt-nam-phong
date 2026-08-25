-- OpenSpec add-technical-configuration-expert-role, Phase 12 review regressions.
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

DO $gate$
DECLARE
  v_region_a BIGINT;
  v_region_b BIGINT;
  v_unit_a BIGINT;
  v_unit_b BIGINT;
  v_global_id BIGINT;
  v_user_id BIGINT;
  v_expert_id BIGINT;
  v_created_user_id BIGINT;
  v_password_hash TEXT;
  v_expert_username TEXT := format('phase12_review_expert_create_%s', txid_current());
  v_user_username TEXT := format('phase12_review_user_create_%s', txid_current());
  v_expert_error_state TEXT;
  v_expert_error_message TEXT;
  v_missing_error_state TEXT;
  v_missing_error_message TEXT;
  v_reassign_oid OID;
  v_reassign_definition TEXT;
  v_signature TEXT;
  v_function_oid OID;
BEGIN
  v_password_hash := extensions.crypt(
    'phase12-password',
    extensions.gen_salt('bf', 4)
  );

  INSERT INTO public.dia_ban(ma_dia_ban, ten_dia_ban, active)
  VALUES (format('P12RA%s', txid_current()), 'Phase 12 Review Region A', true)
  RETURNING id INTO v_region_a;

  INSERT INTO public.dia_ban(ma_dia_ban, ten_dia_ban, active)
  VALUES (format('P12RB%s', txid_current()), 'Phase 12 Review Region B', true)
  RETURNING id INTO v_region_b;

  INSERT INTO public.don_vi(name, active, dia_ban_id)
  VALUES ('Phase 12 Review Unit A', true, v_region_a)
  RETURNING id INTO v_unit_a;

  INSERT INTO public.don_vi(name, active, dia_ban_id)
  VALUES ('Phase 12 Review Unit B', true, v_region_b)
  RETURNING id INTO v_unit_b;

  INSERT INTO public.nhan_vien(
    username, password, hashed_password, full_name, role, don_vi, current_don_vi, dia_ban_id
  )
  VALUES (
    format('phase12_review_global_%s', txid_current()),
    'hashed password',
    v_password_hash,
    'Phase 12 Review Global',
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
    format('phase12_review_caller_%s', txid_current()),
    'hashed password',
    v_password_hash,
    'Phase 12 Review Caller',
    'user',
    v_unit_a,
    v_unit_a,
    v_region_a
  )
  RETURNING id INTO v_user_id;

  INSERT INTO public.nhan_vien(
    username, password, hashed_password, full_name, role, don_vi, current_don_vi, dia_ban_id
  )
  VALUES (
    format('phase12_review_expert_%s', txid_current()),
    'hashed password',
    v_password_hash,
    'Phase 12 Review Expert',
    'chuyen_gia',
    v_unit_a,
    v_unit_a,
    v_region_a
  )
  RETURNING id INTO v_expert_id;

  INSERT INTO public.user_don_vi_memberships(user_id, don_vi)
  VALUES
    (v_global_id, v_unit_a),
    (v_user_id, v_unit_a),
    (v_expert_id, v_unit_a);

  PERFORM pg_temp.set_claims('global', v_global_id, v_unit_a);
  BEGIN
    PERFORM public.user_create(
      v_expert_username,
      'phase12-password',
      'Phase 12 Rejected Expert',
      'chuyen_gia',
      v_unit_a,
      ARRAY[v_unit_a, v_unit_b]
    );
    RAISE EXCEPTION 'expected expert create rejection' USING ERRCODE = 'PT001';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_expert_error_state = RETURNED_SQLSTATE;
  END;

  PERFORM pg_temp.assert_true(
    'Phase 12 keeps expert assignment disabled in user_create',
    v_expert_error_state = '22023'
  );
  PERFORM pg_temp.assert_true(
    'rejected expert create leaves no account or membership state',
    NOT EXISTS (
      SELECT 1
      FROM public.nhan_vien nv
      LEFT JOIN public.user_don_vi_memberships udvm ON udvm.user_id = nv.id
      WHERE nv.username = v_expert_username
    )
  );

  v_created_user_id := public.user_create(
    v_user_username,
    'phase12-password',
    'Phase 12 Existing Role',
    'user',
    v_unit_a,
    ARRAY[v_unit_a, v_unit_b]
  );
  PERFORM pg_temp.assert_true(
    'user_create preserves existing-role behavior',
    EXISTS (
      SELECT 1
      FROM public.nhan_vien nv
      WHERE nv.id = v_created_user_id
        AND nv.username = v_user_username
        AND nv.role = 'user'
        AND nv.don_vi = v_unit_a
        AND nv.current_don_vi = v_unit_a
    )
    AND (
      SELECT count(*) = 2
      FROM public.user_don_vi_memberships udvm
      WHERE udvm.user_id = v_created_user_id
    )
  );

  PERFORM pg_temp.set_claims('user', v_user_id, v_unit_a);
  BEGIN
    PERFORM public.user_set_current_don_vi(v_expert_id::INTEGER, v_unit_b);
    RAISE EXCEPTION 'expected expert target rejection' USING ERRCODE = 'PT001';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_expert_error_state = RETURNED_SQLSTATE,
        v_expert_error_message = MESSAGE_TEXT;
  END;
  BEGIN
    PERFORM public.user_set_current_don_vi(2147483647, v_unit_b);
    RAISE EXCEPTION 'expected missing target rejection' USING ERRCODE = 'PT001';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_missing_error_state = RETURNED_SQLSTATE,
        v_missing_error_message = MESSAGE_TEXT;
  END;
  PERFORM pg_temp.assert_true(
    'current-unit mismatch does not reveal expert or target existence',
    v_expert_error_state = '42501'
    AND v_missing_error_state = '42501'
    AND v_expert_error_message = v_missing_error_message
  );

  v_reassign_oid := to_regprocedure(
    'public.user_reassign_expert_scope(bigint,bigint)'
  );
  v_reassign_definition := LOWER(pg_get_functiondef(v_reassign_oid));
  PERFORM pg_temp.assert_true(
    'expert reassignment locks destination scope rows through commit',
    POSITION('for share of dv, db' IN v_reassign_definition) > 0
  );
  PERFORM pg_temp.assert_true(
    'expert reassignment revalidates destination activity in its final invariant',
    regexp_count(
      v_reassign_definition,
      'coalesce[[:space:]]*\([[:space:]]*dv\.active[[:space:]]*,[[:space:]]*true[[:space:]]*\)'
    ) >= 2
  );

  FOREACH v_signature IN ARRAY ARRAY[
    'public.user_create(text,text,text,text,bigint,bigint[])',
    'public.user_membership_add(integer,bigint)',
    'public.user_membership_remove(integer,bigint)',
    'public.user_set_current_don_vi(integer,bigint)',
    'public.user_reassign_expert_scope(bigint,bigint)'
  ]
  LOOP
    v_function_oid := to_regprocedure(v_signature);
    PERFORM pg_temp.assert_true(v_signature || ' exists', v_function_oid IS NOT NULL);
    PERFORM pg_temp.assert_true(
      v_signature || ' is not PUBLIC executable',
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
      v_signature || ' denies anon execute',
      NOT has_function_privilege('anon', v_function_oid, 'EXECUTE')
    );
    PERFORM pg_temp.assert_true(
      v_signature || ' grants authenticated execute',
      has_function_privilege('authenticated', v_function_oid, 'EXECUTE')
    );
    PERFORM pg_temp.assert_true(
      v_signature || ' grants service-role execute',
      has_function_privilege('service_role', v_function_oid, 'EXECUTE')
    );
  END LOOP;
END;
$gate$;

ROLLBACK;
