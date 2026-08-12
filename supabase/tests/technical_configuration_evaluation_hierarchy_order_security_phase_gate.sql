-- P5C0 rollback-only evaluation hierarchy authorization and privilege gate.
BEGIN;

CREATE FUNCTION pg_temp.assert_true(p_label TEXT, p_condition BOOLEAN)
RETURNS VOID LANGUAGE plpgsql AS $gate$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', p_label;
  END IF;
END;
$gate$;

CREATE FUNCTION pg_temp.expect_error(
  p_label TEXT,
  p_statement TEXT,
  p_expected_state TEXT,
  p_expected_message TEXT
) RETURNS VOID LANGUAGE plpgsql AS $gate$
DECLARE
  v_state TEXT;
  v_message TEXT;
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_state = RETURNED_SQLSTATE,
      v_message = MESSAGE_TEXT;
    IF v_state IS DISTINCT FROM p_expected_state
       OR v_message IS DISTINCT FROM p_expected_message THEN
      RAISE EXCEPTION '%: expected [%] %, got [%] %',
        p_label, p_expected_state, p_expected_message, v_state, v_message;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION '%: expected statement to fail', p_label;
END;
$gate$;

CREATE FUNCTION pg_temp.set_claims(p_app_role TEXT, p_user_id BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $gate$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', p_app_role,
      'role', 'authenticated',
      'user_id', p_user_id::TEXT,
      'sub', p_user_id::TEXT
    )::TEXT,
    true
  );
END;
$gate$;

DO $gate$
DECLARE
  v_user_id BIGINT;
  v_option_id UUID := gen_random_uuid();
  v_version_id UUID := gen_random_uuid();
  v_function_signature TEXT :=
    'public.technical_configuration_evaluation_criteria_list(uuid,uuid,text,integer,integer)';
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('technical_configuration_evaluation_hierarchy_order_security_phase_gate')
  );

  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active IS TRUE
  ORDER BY nv.id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'P5C0 security phase gate requires one active public.nhan_vien row';
  END IF;

  PERFORM set_config('request.jwt.claims', '{}'::JSONB::TEXT, true);
  PERFORM pg_temp.expect_error(
    'missing claims rejected',
    format(
      'SELECT public.technical_configuration_evaluation_criteria_list(%L::UUID, %L::UUID, %L, 1, 100)',
      v_option_id,
      v_version_id,
      'all'
    ),
    '42501',
    'permission_denied'
  );

  PERFORM pg_temp.set_claims('to_qltb', v_user_id);
  PERFORM pg_temp.expect_error(
    'non-global role rejected',
    format(
      'SELECT public.technical_configuration_evaluation_criteria_list(%L::UUID, %L::UUID, %L, 1, 100)',
      v_option_id,
      v_version_id,
      'all'
    ),
    '42501',
    'permission_denied'
  );

  PERFORM pg_temp.set_claims('global', v_user_id);
  PERFORM pg_temp.expect_error(
    'invalid filter rejected before lookup',
    format(
      'SELECT public.technical_configuration_evaluation_criteria_list(%L::UUID, %L::UUID, %L, 1, 100)',
      v_option_id,
      v_version_id,
      'meets'
    ),
    'PT422',
    'validation_error'
  );
  PERFORM pg_temp.expect_error(
    'oversized page rejected before lookup',
    format(
      'SELECT public.technical_configuration_evaluation_criteria_list(%L::UUID, %L::UUID, %L, 1, 101)',
      v_option_id,
      v_version_id,
      'all'
    ),
    'PT422',
    'validation_error'
  );

  PERFORM pg_temp.assert_true(
    'function remains security definer with hardened search path',
    (
      SELECT procedure.prosecdef
        AND procedure.proconfig @> ARRAY['search_path=public, pg_temp']
      FROM pg_proc procedure
      WHERE procedure.oid = v_function_signature::regprocedure
    )
  );
  PERFORM pg_temp.assert_true(
    'authenticated executes hierarchy-aware criteria rpc',
    has_function_privilege('authenticated', v_function_signature, 'EXECUTE')
  );
  PERFORM pg_temp.assert_true(
    'service role executes hierarchy-aware criteria rpc',
    has_function_privilege('service_role', v_function_signature, 'EXECUTE')
  );
  PERFORM pg_temp.assert_true(
    'anon cannot execute hierarchy-aware criteria rpc',
    NOT has_function_privilege('anon', v_function_signature, 'EXECUTE')
  );
END;
$gate$;

ROLLBACK;
