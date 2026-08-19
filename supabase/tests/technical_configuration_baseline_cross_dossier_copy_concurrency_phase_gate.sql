-- supabase/tests/technical_configuration_baseline_cross_dossier_copy_concurrency_phase_gate.sql
-- Purpose: execute the Phase 1 writer-first and apply-first two-session lock contract.
-- Run only against a disposable gate database. Replace <RUN_TOKEN> globally first.
-- Execute SETUP once, then each labeled Session A/Session B pair concurrently.
-- Run ASSERT after each pair and CLEANUP last. Never run this file sequentially.

-- SETUP: run once and wait for completion.
CREATE FUNCTION pg_temp.seed_cross_copy_concurrency(
  p_scenario TEXT, p_run_token TEXT, p_user_id BIGINT
)
RETURNS VOID LANGUAGE plpgsql AS $gate$
DECLARE
  v_source_dossier UUID := md5(p_scenario || ':source-dossier:' || p_run_token)::UUID;
  v_source_version UUID := md5(p_scenario || ':source-version:' || p_run_token)::UUID;
  v_source_group UUID := md5(p_scenario || ':source-group:' || p_run_token)::UUID;
  v_source_criterion UUID := md5(p_scenario || ':source-criterion:' || p_run_token)::UUID;
  v_target_dossier UUID := md5(p_scenario || ':target-dossier:' || p_run_token)::UUID;
  v_target_version UUID := md5(p_scenario || ':target-version:' || p_run_token)::UUID;
  v_target_group UUID := md5(p_scenario || ':target-group:' || p_run_token)::UUID;
  v_target_criterion UUID := md5(p_scenario || ':target-criterion:' || p_run_token)::UUID;
  v_supplier UUID := md5(p_scenario || ':supplier:' || p_run_token)::UUID;
  v_option UUID := md5(p_scenario || ':option:' || p_run_token)::UUID;
  v_comparison_set UUID := md5(p_scenario || ':comparison:' || p_run_token)::UUID;
BEGIN
  INSERT INTO public.technical_configuration_dossiers (
    id, device_type_name, name, description, created_by, updated_by
  ) VALUES
    (
      v_source_dossier, 'Concurrency source ' || p_scenario,
      'Concurrency source ' || p_scenario || ' ' || p_run_token,
      'Locked source for ' || p_scenario, p_user_id, p_user_id
    ),
    (
      v_target_dossier, 'Concurrency target ' || p_scenario,
      'Concurrency target ' || p_scenario || ' ' || p_run_token,
      'Draft target for ' || p_scenario, p_user_id, p_user_id
    );
  INSERT INTO public.technical_configuration_baseline_versions (
    id, dossier_id, version_number, status, next_criterion_number, revision,
    locked_at, locked_by, created_by, updated_by
  ) VALUES
    (
      v_source_version, v_source_dossier, 1, 'locked', 2, 1,
      now(), p_user_id, p_user_id, p_user_id
    ),
    (
      v_target_version, v_target_dossier, 1, 'draft', 2, 1,
      NULL, NULL, p_user_id, p_user_id
    );
  INSERT INTO public.technical_configuration_baseline_groups (
    id, baseline_version_id, name, sort_order, created_by, updated_by
  ) VALUES
    (
      v_source_group, v_source_version, 'Source group ' || p_scenario,
      1, p_user_id, p_user_id
    ),
    (
      v_target_group, v_target_version, 'Target group ' || p_scenario,
      1, p_user_id, p_user_id
    );
  INSERT INTO public.technical_configuration_baseline_criteria (
    id, baseline_version_id, group_id, criterion_code, title,
    requirement_text, sort_order, created_by, updated_by
  ) VALUES
    (
      v_source_criterion, v_source_version, v_source_group, 'TC-0001',
      'Source criterion', 'Source requirement ' || p_scenario, 1, p_user_id, p_user_id
    ),
    (
      v_target_criterion, v_target_version, v_target_group, 'TC-0001',
      'Target criterion', 'Target requirement ' || p_scenario, 1, p_user_id, p_user_id
    );
  INSERT INTO public.technical_configuration_suppliers (
    id, dossier_id, name, created_by, updated_by
  ) VALUES (v_supplier, v_target_dossier, 'Supplier ' || p_scenario, p_user_id, p_user_id);
  INSERT INTO public.technical_configuration_options (
    id, dossier_id, supplier_id, model, option_name, created_by, updated_by
  ) VALUES (
    v_option, v_target_dossier, v_supplier, 'Model ' || p_scenario,
    'Option ' || p_scenario, p_user_id, p_user_id
  );
  INSERT INTO public.technical_configuration_comparison_sets (
    id, dossier_id, option_id, baseline_version_id, created_by, updated_by
  ) VALUES (
    v_comparison_set, v_target_dossier, v_option, v_target_version, p_user_id, p_user_id
  );
  INSERT INTO public.technical_configuration_option_responses (
    comparison_set_id, baseline_version_id, criterion_id, response_text,
    created_by, updated_by
  ) VALUES (
    v_comparison_set, v_target_version, v_target_criterion,
    'Original response ' || p_scenario, p_user_id, p_user_id
  );
END;
$gate$;

DO $gate$
DECLARE
  v_user_id BIGINT;
BEGIN
  SELECT id INTO v_user_id
  FROM public.nhan_vien
  WHERE is_active = true
  ORDER BY id
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Setup failed: no active nhan_vien row found';
  END IF;
  PERFORM pg_temp.seed_cross_copy_concurrency('writer-first', '<RUN_TOKEN>', v_user_id);
  PERFORM pg_temp.seed_cross_copy_concurrency('apply-first', '<RUN_TOKEN>', v_user_id);
END;
$gate$;

-- WRITER-FIRST / SESSION A: start first. The child writer holds ROW EXCLUSIVE.
BEGIN;
DO $gate$
DECLARE
  v_user_id BIGINT;
  v_comparison_set UUID := md5('writer-first:comparison:<RUN_TOKEN>')::UUID;
  v_target_version UUID := md5('writer-first:target-version:<RUN_TOKEN>')::UUID;
  v_target_criterion UUID := md5('writer-first:target-criterion:<RUN_TOKEN>')::UUID;
  v_rendezvous BIGINT := hashtextextended('cross-copy-writer-first:<RUN_TOKEN>', 0);
BEGIN
  SELECT id INTO v_user_id FROM public.nhan_vien
  WHERE is_active = true ORDER BY id LIMIT 1;
  UPDATE public.technical_configuration_option_responses
  SET response_text = 'Uncommitted writer-first response',
      updated_at = now(),
      updated_by = v_user_id
  WHERE comparison_set_id = v_comparison_set
    AND baseline_version_id = v_target_version
    AND criterion_id = v_target_criterion;
  PERFORM pg_advisory_xact_lock(v_rendezvous);
  PERFORM pg_sleep(20);
END;
$gate$;
ROLLBACK;

-- WRITER-FIRST / SESSION B: start while Session A sleeps.
-- Apply must fail fast with concurrent_write_retry before any target mutation.
DO $gate$
DECLARE
  v_attempt INTEGER;
  v_user_id BIGINT;
  v_source UUID := md5('writer-first:source-version:<RUN_TOKEN>')::UUID;
  v_target UUID := md5('writer-first:target-dossier:<RUN_TOKEN>')::UUID;
  v_target_version UUID := md5('writer-first:target-version:<RUN_TOKEN>')::UUID;
  v_rendezvous BIGINT := hashtextextended('cross-copy-writer-first:<RUN_TOKEN>', 0);
  v_dossier_revision BIGINT;
  v_baseline_revision BIGINT;
  v_preview JSONB;
  v_state TEXT;
  v_message TEXT;
  v_started TIMESTAMPTZ;
BEGIN
  SELECT id INTO v_user_id FROM public.nhan_vien
  WHERE is_active = true ORDER BY id LIMIT 1;
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'global', 'role', 'authenticated',
      'user_id', v_user_id::TEXT, 'sub', v_user_id::TEXT
    )::TEXT,
    true
  );
  FOR v_attempt IN 1..600 LOOP
    IF pg_try_advisory_lock(v_rendezvous) THEN
      PERFORM pg_advisory_unlock(v_rendezvous);
      PERFORM pg_sleep(0.1);
    ELSE
      EXIT;
    END IF;
  END LOOP;
  IF v_attempt = 600 THEN
    RAISE EXCEPTION 'writer-first Session B did not observe Session A';
  END IF;
  SELECT d.revision, v.revision
  INTO v_dossier_revision, v_baseline_revision
  FROM public.technical_configuration_dossiers d
  JOIN public.technical_configuration_baseline_versions v
    ON v.dossier_id = d.id AND v.status = 'draft'
  WHERE d.id = v_target;
  v_preview := public.technical_configuration_baseline_cross_dossier_copy_preview(
    v_source, v_target, v_dossier_revision, v_target_version, v_baseline_revision
  );
  v_started := clock_timestamp();
  BEGIN
    PERFORM public.technical_configuration_baseline_cross_dossier_copy_apply(
      v_source, v_target, v_dossier_revision, v_target_version, v_baseline_revision,
      v_preview#>>'{data,preview_fingerprint}', true
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_state = RETURNED_SQLSTATE,
      v_message = MESSAGE_TEXT;
    IF v_state = 'PT409' AND v_message = 'concurrent_write_retry'
       AND clock_timestamp() - v_started < interval '3 seconds' THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'writer-first expected fail-fast PT409/concurrent_write_retry, got %/%',
      v_state, v_message;
  END;
  RAISE EXCEPTION 'writer-first apply unexpectedly succeeded';
END;
$gate$;

-- WRITER-FIRST ASSERT: run after both sessions finish.
-- This proves no partial mutation and no deadlock wait-cycle.
DO $gate$
DECLARE
  v_target UUID := md5('writer-first:target-dossier:<RUN_TOKEN>')::UUID;
  v_target_version UUID := md5('writer-first:target-version:<RUN_TOKEN>')::UUID;
  v_comparison_set UUID := md5('writer-first:comparison:<RUN_TOKEN>')::UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.technical_configuration_baseline_versions
    WHERE id = v_target_version AND dossier_id = v_target
      AND status = 'draft' AND source_baseline_version_id IS NULL
  ) OR (SELECT count(*) FROM public.technical_configuration_baseline_criteria
        WHERE baseline_version_id = v_target_version) <> 1
     OR (SELECT count(*) FROM public.technical_configuration_option_responses
         WHERE comparison_set_id = v_comparison_set) <> 1 THEN
    RAISE EXCEPTION 'writer-first no partial mutation assertion failed';
  END IF;
END;
$gate$;

-- APPLY-FIRST / SESSION A: start first. Apply holds canonical table locks to commit.
BEGIN;
DO $gate$
DECLARE
  v_user_id BIGINT;
  v_source UUID := md5('apply-first:source-version:<RUN_TOKEN>')::UUID;
  v_target UUID := md5('apply-first:target-dossier:<RUN_TOKEN>')::UUID;
  v_target_version UUID := md5('apply-first:target-version:<RUN_TOKEN>')::UUID;
  v_rendezvous BIGINT := hashtextextended('cross-copy-apply-first:<RUN_TOKEN>', 0);
  v_dossier_revision BIGINT;
  v_baseline_revision BIGINT;
  v_preview JSONB;
BEGIN
  SELECT id INTO v_user_id FROM public.nhan_vien
  WHERE is_active = true ORDER BY id LIMIT 1;
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'global', 'role', 'authenticated',
      'user_id', v_user_id::TEXT, 'sub', v_user_id::TEXT
    )::TEXT,
    true
  );
  SELECT d.revision, v.revision
  INTO v_dossier_revision, v_baseline_revision
  FROM public.technical_configuration_dossiers d
  JOIN public.technical_configuration_baseline_versions v
    ON v.dossier_id = d.id AND v.status = 'draft'
  WHERE d.id = v_target;
  v_preview := public.technical_configuration_baseline_cross_dossier_copy_preview(
    v_source, v_target, v_dossier_revision, v_target_version, v_baseline_revision
  );
  PERFORM public.technical_configuration_baseline_cross_dossier_copy_apply(
    v_source, v_target, v_dossier_revision, v_target_version, v_baseline_revision,
    v_preview#>>'{data,preview_fingerprint}', true
  );
  PERFORM pg_advisory_xact_lock(v_rendezvous);
  PERFORM pg_sleep(20);
END;
$gate$;
COMMIT;

-- APPLY-FIRST / SESSION B: start while Session A sleeps.
-- The later writer waits on the table lock, then succeeds after Session A commits.
DO $gate$
DECLARE
  v_attempt INTEGER;
  v_user_id BIGINT;
  v_target_version UUID := md5('apply-first:target-version:<RUN_TOKEN>')::UUID;
  v_comparison_set UUID := md5('apply-first:comparison:<RUN_TOKEN>')::UUID;
  v_rendezvous BIGINT := hashtextextended('cross-copy-apply-first:<RUN_TOKEN>', 0);
  v_new_criterion UUID;
BEGIN
  SELECT id INTO v_user_id FROM public.nhan_vien
  WHERE is_active = true ORDER BY id LIMIT 1;
  FOR v_attempt IN 1..600 LOOP
    IF pg_try_advisory_lock(v_rendezvous) THEN
      PERFORM pg_advisory_unlock(v_rendezvous);
      PERFORM pg_sleep(0.1);
    ELSE
      EXIT;
    END IF;
  END LOOP;
  IF v_attempt = 600 THEN
    RAISE EXCEPTION 'apply-first Session B did not observe Session A';
  END IF;
  PERFORM set_config('lock_timeout', '2s', true);
  BEGIN
    INSERT INTO public.technical_configuration_option_responses (
      comparison_set_id, baseline_version_id, criterion_id, response_text,
      created_by, updated_by
    ) VALUES (
      v_comparison_set, v_target_version,
      md5('apply-first:target-criterion:<RUN_TOKEN>')::UUID,
      'Must wait behind apply', v_user_id, v_user_id
    );
    RAISE EXCEPTION 'apply-first writer did not wait';
  EXCEPTION WHEN SQLSTATE '55P03' THEN NULL;
  END;
  PERFORM set_config('lock_timeout', '0', true);
  LOCK TABLE public.technical_configuration_option_responses IN ROW EXCLUSIVE MODE;
  SELECT id INTO v_new_criterion
  FROM public.technical_configuration_baseline_criteria
  WHERE baseline_version_id = v_target_version
  ORDER BY sort_order, id
  LIMIT 1;
  INSERT INTO public.technical_configuration_option_responses (
    comparison_set_id, baseline_version_id, criterion_id, response_text,
    created_by, updated_by
  ) VALUES (
    v_comparison_set, v_target_version, v_new_criterion,
    'Writer completed after apply commit', v_user_id, v_user_id
  );
END;
$gate$;

-- APPLY-FIRST ASSERT: the later writer progressed after commit without a deadlock.
DO $gate$
DECLARE
  v_target_version UUID := md5('apply-first:target-version:<RUN_TOKEN>')::UUID;
  v_comparison_set UUID := md5('apply-first:comparison:<RUN_TOKEN>')::UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.technical_configuration_baseline_versions
    WHERE id = v_target_version
      AND source_baseline_version_id =
        md5('apply-first:source-version:<RUN_TOKEN>')::UUID
  ) OR (SELECT count(*) FROM public.technical_configuration_option_responses
        WHERE comparison_set_id = v_comparison_set
          AND response_text = 'Writer completed after apply commit') <> 1 THEN
    RAISE EXCEPTION 'apply-first no deadlock wait-cycle assertion failed';
  END IF;
END;
$gate$;

-- CLEANUP: run after both scenarios and assertions.
DELETE FROM public.technical_configuration_dossiers
WHERE id IN (
  md5('writer-first:source-dossier:<RUN_TOKEN>')::UUID,
  md5('writer-first:target-dossier:<RUN_TOKEN>')::UUID,
  md5('apply-first:source-dossier:<RUN_TOKEN>')::UUID,
  md5('apply-first:target-dossier:<RUN_TOKEN>')::UUID
);
