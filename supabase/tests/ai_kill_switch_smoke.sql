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
  FROM public.ai_kill_switch_status()
  LIMIT 1;

  IF v_status.enabled IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'Expected default AI kill switch status to be disabled';
  END IF;

  IF v_status.reason IS NOT NULL THEN
    RAISE EXCEPTION 'Expected default AI kill switch reason to be NULL, got %', v_status.reason;
  END IF;

  IF v_status.updated_at IS NOT NULL THEN
    RAISE EXCEPTION 'Expected default AI kill switch updated_at to be NULL before first write';
  END IF;
END $$;

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

  IF v_status.enabled IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Expected global role to enable AI kill switch';
  END IF;

  IF v_status.reason IS DISTINCT FROM 'maintenance window' THEN
    RAISE EXCEPTION 'Expected global role to set reason, got %', v_status.reason;
  END IF;

  SELECT *
  INTO v_status
  FROM public.ai_kill_switch_status()
  LIMIT 1;

  IF v_status.enabled IS DISTINCT FROM TRUE OR v_status.reason IS DISTINCT FROM 'maintenance window' THEN
    RAISE EXCEPTION 'Expected status to reflect enabled state and reason after write';
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

  IF v_status.enabled IS DISTINCT FROM TRUE OR v_status.reason IS DISTINCT FROM 'admin normalized' THEN
    RAISE EXCEPTION 'Expected admin role to normalize to global and write kill switch';
  END IF;
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

  IF v_status.enabled IS DISTINCT FROM TRUE THEN
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
    jsonb_build_object('role', 'authenticated', 'user_id', 'issue538-missing-role')::TEXT,
    TRUE
  );
  BEGIN
    PERFORM * FROM public.ai_kill_switch_status();
    RAISE EXCEPTION 'Expected missing app_role claim to be denied';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '42501' THEN
      RAISE EXCEPTION 'Expected missing app_role SQLSTATE 42501, got %', v_sqlstate;
    END IF;
  END;
END $$;

DO $$
DECLARE
  v_sqlstate TEXT;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'app_role', 'global', 'user_id', 'issue538-global')::TEXT,
    TRUE
  );

  BEGIN
    PERFORM * FROM public.ai_kill_switch_set(NULL, 'invalid');
    RAISE EXCEPTION 'Expected NULL p_enabled to be rejected';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    IF v_sqlstate <> '22023' THEN
      RAISE EXCEPTION 'Expected NULL p_enabled SQLSTATE 22023, got %', v_sqlstate;
    END IF;
  END;
END $$;

DO $$
DECLARE
  v_status RECORD;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'app_role', 'global', 'user_id', 'issue538-global')::TEXT,
    TRUE
  );

  PERFORM * FROM public.ai_kill_switch_set(TRUE, 'clear me');
  SELECT * INTO v_status FROM public.ai_kill_switch_set(TRUE, '   ') LIMIT 1;

  IF v_status.enabled IS DISTINCT FROM TRUE OR v_status.reason IS NOT NULL THEN
    RAISE EXCEPTION 'Expected blank reason to clear reason while preserving enabled state';
  END IF;

  PERFORM * FROM public.ai_kill_switch_set(TRUE, 'clear me again');
  SELECT * INTO v_status FROM public.ai_kill_switch_set(TRUE, NULL) LIMIT 1;

  IF v_status.enabled IS DISTINCT FROM TRUE OR v_status.reason IS NOT NULL THEN
    RAISE EXCEPTION 'Expected NULL reason to clear reason while preserving enabled state';
  END IF;
END $$;

ROLLBACK;
