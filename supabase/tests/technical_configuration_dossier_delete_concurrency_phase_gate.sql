-- supabase/tests/technical_configuration_dossier_delete_concurrency_phase_gate.sql
-- Purpose: prove dossier-row-first serialization between P15A delete and P4 baseline lock.
-- Run the labeled blocks through two concurrent Supabase MCP sessions after live apply approval.
-- Do not run this file as one sequential script.
-- Replace <RUN_TOKEN> globally with one unique token before running any block.

-- SETUP: run this whole block once and wait for completion.
CREATE FUNCTION pg_temp.seed_concurrency_aggregate(
  p_scenario TEXT,
  p_run_token TEXT,
  p_user_id BIGINT,
  p_description TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
DECLARE
  v_dossier_id UUID := md5('p15a-' || p_scenario || '-dossier:' || p_run_token)::UUID;
  v_version_id UUID := md5('p15a-' || p_scenario || '-version:' || p_run_token)::UUID;
  v_group_id UUID := md5('p15a-' || p_scenario || '-group:' || p_run_token)::UUID;
  v_criterion_id UUID := md5('p15a-' || p_scenario || '-criterion:' || p_run_token)::UUID;
BEGIN
  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, description, created_by, updated_by
  )
  VALUES (
    v_dossier_id,
    'P15A concurrency ' || p_scenario || ' ' || p_run_token,
    'P15A concurrency ' || p_scenario || ' ' || p_run_token,
    p_description,
    p_user_id,
    p_user_id
  );

  INSERT INTO public.technical_configuration_baseline_versions (
    id, dossier_id, version_number, status, next_criterion_number, created_by, updated_by
  )
  VALUES (v_version_id, v_dossier_id, 1, 'draft', 2, p_user_id, p_user_id);

  INSERT INTO public.technical_configuration_baseline_groups (
    id, baseline_version_id, name, sort_order, created_by, updated_by
  )
  VALUES (v_group_id, v_version_id, initcap(p_scenario) || ' group', 1, p_user_id, p_user_id);

  INSERT INTO public.technical_configuration_baseline_criteria (
    id,
    baseline_version_id,
    group_id,
    criterion_code,
    requirement_text,
    sort_order,
    created_by,
    updated_by
  )
  VALUES (
    v_criterion_id,
    v_version_id,
    v_group_id,
    'TC-0001',
    initcap(p_scenario) || ' requirement',
    1,
    p_user_id,
    p_user_id
  );
END;
$gate$;

DO $gate$
DECLARE
  v_user_id BIGINT;
BEGIN
  SELECT nv.id INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active = true
  ORDER BY nv.id
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Setup failed: no active nhan_vien row found';
  END IF;

  PERFORM pg_temp.seed_concurrency_aggregate(
    'delete-first',
    '<RUN_TOKEN>',
    v_user_id,
    'Delete holds the dossier row lock before baseline lock'
  );
  PERFORM pg_temp.seed_concurrency_aggregate(
    'lock-first',
    '<RUN_TOKEN>',
    v_user_id,
    'Baseline lock holds the dossier row lock before delete'
  );
END;
$gate$;

-- DELETE-FIRST / SESSION A: start this block first.
-- While this block is sleeping, immediately start DELETE-FIRST / SESSION B.
DO $gate$
DECLARE
  v_user_id BIGINT;
  v_dossier_id UUID;
  v_rendezvous_key BIGINT :=
    hashtextextended('p15a-delete-first-rendezvous:<RUN_TOKEN>', 0);
  v_response JSONB;
BEGIN
  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active = true
  ORDER BY nv.id
  LIMIT 1;
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', v_user_id::TEXT,
      'sub', v_user_id::TEXT
    )::TEXT,
    true
  );

  v_dossier_id := md5('p15a-delete-first-dossier:<RUN_TOKEN>')::UUID;

  v_response := public.technical_configuration_dossiers_delete(v_dossier_id, 1);
  IF v_response <> jsonb_build_object(
    'data',
    jsonb_build_object('id', v_dossier_id)
  ) THEN
    RAISE EXCEPTION 'delete-first session A returned %', v_response;
  END IF;

  PERFORM pg_advisory_xact_lock(v_rendezvous_key);
  PERFORM pg_sleep(20);
END;
$gate$;

-- DELETE-FIRST / SESSION B: start while SESSION A is sleeping.
-- The first call must time out on SESSION A's dossier-row lock; the retry must return PT404.
DO $gate$
DECLARE
  v_attempt INTEGER;
  v_observed_session_a BOOLEAN := false;
  v_rendezvous_key BIGINT :=
    hashtextextended('p15a-delete-first-rendezvous:<RUN_TOKEN>', 0);
  v_user_id BIGINT;
  v_version_id UUID;
  v_state TEXT;
  v_message TEXT;
BEGIN
  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active = true
  ORDER BY nv.id
  LIMIT 1;
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', v_user_id::TEXT,
      'sub', v_user_id::TEXT
    )::TEXT,
    true
  );

  v_version_id := md5('p15a-delete-first-version:<RUN_TOKEN>')::UUID;

  FOR v_attempt IN 1..600 LOOP
    IF pg_try_advisory_lock(v_rendezvous_key) THEN
      PERFORM pg_advisory_unlock(v_rendezvous_key);
      PERFORM pg_sleep(0.1);
    ELSE
      v_observed_session_a := true;
      EXIT;
    END IF;
  END LOOP;
  IF NOT v_observed_session_a THEN
    RAISE EXCEPTION 'delete-first session B did not observe session A';
  END IF;

  PERFORM set_config('lock_timeout', '2s', true);
  BEGIN
    PERFORM public.technical_configuration_baseline_lock(v_version_id, 1);
    RAISE EXCEPTION 'delete-first session B did not block; session A precondition may have expired';
  EXCEPTION
    WHEN SQLSTATE '55P03' THEN NULL;
  END;
  PERFORM set_config('lock_timeout', '0', true);

  BEGIN
    PERFORM public.technical_configuration_baseline_lock(v_version_id, 1);
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_state = RETURNED_SQLSTATE,
        v_message = MESSAGE_TEXT;
      IF v_state = 'PT404' AND v_message = 'not_found' THEN
        RETURN;
      END IF;
      RAISE EXCEPTION 'delete-first session B expected PT404/not_found, got %/%',
        v_state, v_message;
  END;
  RAISE EXCEPTION 'delete-first session B unexpectedly succeeded';
END;
$gate$;

-- DELETE-FIRST ASSERT: run after both delete-first sessions finish.
DO $gate$
DECLARE
  v_dossier_id UUID := md5('p15a-delete-first-dossier:<RUN_TOKEN>')::UUID;
  v_version_id UUID := md5('p15a-delete-first-version:<RUN_TOKEN>')::UUID;
  v_group_id UUID := md5('p15a-delete-first-group:<RUN_TOKEN>')::UUID;
  v_criterion_id UUID := md5('p15a-delete-first-criterion:<RUN_TOKEN>')::UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.technical_configuration_dossiers WHERE id = v_dossier_id
  ) OR EXISTS (
    SELECT 1 FROM public.technical_configuration_baseline_versions WHERE id = v_version_id
  ) OR EXISTS (
    SELECT 1 FROM public.technical_configuration_baseline_groups WHERE id = v_group_id
  ) OR EXISTS (
    SELECT 1 FROM public.technical_configuration_baseline_criteria WHERE id = v_criterion_id
  ) THEN
    RAISE EXCEPTION 'delete-first assertion failed: aggregate survived';
  END IF;
END;
$gate$;

-- LOCK-FIRST / SESSION A: start this block first.
-- While this block is sleeping, immediately start LOCK-FIRST / SESSION B.
DO $gate$
DECLARE
  v_user_id BIGINT;
  v_version_id UUID;
  v_rendezvous_key BIGINT :=
    hashtextextended('p15a-lock-first-rendezvous:<RUN_TOKEN>', 0);
  v_response JSONB;
BEGIN
  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active = true
  ORDER BY nv.id
  LIMIT 1;
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', v_user_id::TEXT,
      'sub', v_user_id::TEXT
    )::TEXT,
    true
  );

  v_version_id := md5('p15a-lock-first-version:<RUN_TOKEN>')::UUID;

  v_response := public.technical_configuration_baseline_lock(v_version_id, 1);
  IF v_response#>>'{data,status}' <> 'locked' THEN
    RAISE EXCEPTION 'lock-first session A returned %', v_response;
  END IF;

  PERFORM pg_advisory_xact_lock(v_rendezvous_key);
  PERFORM pg_sleep(20);
END;
$gate$;

-- LOCK-FIRST / SESSION B: start while SESSION A is sleeping.
-- The first call must time out on SESSION A's dossier-row lock; the retry must return PT409.
DO $gate$
DECLARE
  v_attempt INTEGER;
  v_observed_session_a BOOLEAN := false;
  v_rendezvous_key BIGINT :=
    hashtextextended('p15a-lock-first-rendezvous:<RUN_TOKEN>', 0);
  v_user_id BIGINT;
  v_dossier_id UUID;
  v_state TEXT;
  v_message TEXT;
BEGIN
  SELECT nv.id
  INTO v_user_id
  FROM public.nhan_vien nv
  WHERE nv.is_active = true
  ORDER BY nv.id
  LIMIT 1;
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'global',
      'role', 'authenticated',
      'user_id', v_user_id::TEXT,
      'sub', v_user_id::TEXT
    )::TEXT,
    true
  );

  v_dossier_id := md5('p15a-lock-first-dossier:<RUN_TOKEN>')::UUID;

  FOR v_attempt IN 1..600 LOOP
    IF pg_try_advisory_lock(v_rendezvous_key) THEN
      PERFORM pg_advisory_unlock(v_rendezvous_key);
      PERFORM pg_sleep(0.1);
    ELSE
      v_observed_session_a := true;
      EXIT;
    END IF;
  END LOOP;
  IF NOT v_observed_session_a THEN
    RAISE EXCEPTION 'lock-first session B did not observe session A';
  END IF;

  PERFORM set_config('lock_timeout', '2s', true);
  BEGIN
    PERFORM public.technical_configuration_dossiers_delete(v_dossier_id, 1);
    RAISE EXCEPTION 'lock-first session B did not block; session A precondition may have expired';
  EXCEPTION
    WHEN SQLSTATE '55P03' THEN NULL;
  END;
  PERFORM set_config('lock_timeout', '0', true);

  BEGIN
    PERFORM public.technical_configuration_dossiers_delete(v_dossier_id, 1);
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_state = RETURNED_SQLSTATE,
        v_message = MESSAGE_TEXT;
      IF v_state = 'PT409' AND v_message = 'locked_dossier' THEN
        RETURN;
      END IF;
      RAISE EXCEPTION 'lock-first session B expected PT409/locked_dossier, got %/%',
        v_state, v_message;
  END;
  RAISE EXCEPTION 'lock-first session B unexpectedly succeeded';
END;
$gate$;

-- LOCK-FIRST ASSERT: run after both lock-first sessions finish.
DO $gate$
DECLARE
  v_dossier_id UUID := md5('p15a-lock-first-dossier:<RUN_TOKEN>')::UUID;
  v_version_id UUID := md5('p15a-lock-first-version:<RUN_TOKEN>')::UUID;
  v_group_id UUID := md5('p15a-lock-first-group:<RUN_TOKEN>')::UUID;
  v_criterion_id UUID := md5('p15a-lock-first-criterion:<RUN_TOKEN>')::UUID;
  v_count BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_dossiers d
    WHERE d.id = v_dossier_id
  ) THEN
    RAISE EXCEPTION 'lock-first assertion failed: dossier was deleted';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.technical_configuration_baseline_versions v
  WHERE v.id = v_version_id
    AND v.dossier_id = v_dossier_id
    AND v.status = 'locked';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'lock-first assertion failed: locked aggregate changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_groups g
    WHERE g.id = v_group_id AND g.baseline_version_id = v_version_id
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_criteria c
    WHERE c.id = v_criterion_id
      AND c.baseline_version_id = v_version_id
      AND c.group_id = v_group_id
  ) THEN
    RAISE EXCEPTION 'lock-first assertion failed: descendants changed';
  END IF;
END;
$gate$;

-- CLEANUP: run once after both scenarios and assertions finish.
DO $gate$
DECLARE
  v_delete_first_dossier UUID := md5('p15a-delete-first-dossier:<RUN_TOKEN>')::UUID;
  v_delete_first_version UUID := md5('p15a-delete-first-version:<RUN_TOKEN>')::UUID;
  v_delete_first_group UUID := md5('p15a-delete-first-group:<RUN_TOKEN>')::UUID;
  v_delete_first_criterion UUID := md5('p15a-delete-first-criterion:<RUN_TOKEN>')::UUID;
  v_lock_first_dossier UUID := md5('p15a-lock-first-dossier:<RUN_TOKEN>')::UUID;
  v_lock_first_version UUID := md5('p15a-lock-first-version:<RUN_TOKEN>')::UUID;
  v_lock_first_group UUID := md5('p15a-lock-first-group:<RUN_TOKEN>')::UUID;
  v_lock_first_criterion UUID := md5('p15a-lock-first-criterion:<RUN_TOKEN>')::UUID;
BEGIN
  DELETE FROM public.technical_configuration_dossiers d
  WHERE d.id IN (v_delete_first_dossier, v_lock_first_dossier);

  IF EXISTS (
    SELECT 1
    FROM public.technical_configuration_dossiers d
    WHERE d.id IN (v_delete_first_dossier, v_lock_first_dossier)
  ) OR EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_versions v
    WHERE v.id IN (v_delete_first_version, v_lock_first_version)
  ) OR EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_groups g
    WHERE g.id IN (v_delete_first_group, v_lock_first_group)
  ) OR EXISTS (
    SELECT 1
    FROM public.technical_configuration_baseline_criteria c
    WHERE c.id IN (v_delete_first_criterion, v_lock_first_criterion)
  ) THEN
    RAISE EXCEPTION 'cleanup failed: fixture residue remains';
  END IF;
END;
$gate$;
