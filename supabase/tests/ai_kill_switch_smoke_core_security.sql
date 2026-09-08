BEGIN;

DELETE FROM public.internal_settings
WHERE key IN ('ai_kill_switch.enabled', 'ai_kill_switch.reason');

DO $$
DECLARE
  v_status RECORD;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'app_role', 'global', 'user_id', 'issue538-global')::TEXT,
    TRUE
  );

  SELECT *
  INTO v_status
  FROM public.ai_kill_switch_set(TRUE, 'maintenance window')
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected authorized role to receive a kill switch row';
  END IF;

  SELECT *
  INTO v_status
  FROM public.ai_kill_switch_status()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected authorized role to receive a kill switch row';
  END IF;

END $$;

DO $$
DECLARE
  v_status RECORD;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'app_role', 'admin', 'user_id', 'issue538-admin')::TEXT,
    TRUE
  );

  SELECT *
  INTO v_status
  FROM public.ai_kill_switch_set(TRUE, 'admin normalized')
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected authorized role to receive a kill switch row';
  END IF;

END $$;

DO $$
DECLARE
  v_status RECORD;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role')::TEXT,
    TRUE
  );

  SELECT *
  INTO v_status
  FROM public.ai_kill_switch_set(TRUE, 'service role automation')
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected authorized role to receive a kill switch row';
  END IF;

  SELECT *
  INTO v_status
  FROM public.ai_kill_switch_status()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected authorized role to receive a kill switch row';
  END IF;

END $$;

DO $$
DECLARE
  v_sqlstate TEXT;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'user_id', 'issue538-no-app-role')::TEXT,
    TRUE
  );

  BEGIN
    PERFORM * FROM public.ai_kill_switch_status();
    RAISE EXCEPTION 'Expected authenticated token without app_role to be denied status access';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected missing app_role denial SQLSTATE 42501, got %', v_sqlstate;
    END IF;
  END;
END $$;

DO $$
DECLARE
  v_status RECORD;
  v_sqlstate TEXT;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'app_role', 'to_qltb', 'user_id', 'issue538-reader')::TEXT,
    TRUE
  );

  SELECT *
  INTO v_status
  FROM public.ai_kill_switch_status()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected non-global authenticated role to read kill switch status';
  END IF;

  BEGIN
    PERFORM * FROM public.ai_kill_switch_set(FALSE, NULL);
    RAISE EXCEPTION 'Expected non-global role to be denied write access';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected non-global write denial SQLSTATE 42501, got %', v_sqlstate;
    END IF;
  END;
END $$;

DO $$
DECLARE
  v_sqlstate TEXT;
BEGIN
  PERFORM set_config('request.jwt.claims', NULL, TRUE);
  BEGIN
    PERFORM * FROM public.ai_kill_switch_status();
    RAISE EXCEPTION 'Expected missing JWT claims to be denied';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected missing claims SQLSTATE 42501, got %', v_sqlstate;
    END IF;
  END;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('user_id', 'issue538-missing-role')::TEXT,
    TRUE
  );
  BEGIN
    PERFORM * FROM public.ai_kill_switch_status();
    RAISE EXCEPTION 'Expected missing role claim to be denied';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected missing role SQLSTATE 42501, got %', v_sqlstate;
    END IF;
  END;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated')::TEXT,
    TRUE
  );
  BEGIN
    PERFORM * FROM public.ai_kill_switch_status();
    RAISE EXCEPTION 'Expected non-service role missing user_id claim to be denied';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected missing user_id SQLSTATE 42501, got %', v_sqlstate;
    END IF;
  END;
END $$;

ROLLBACK;
