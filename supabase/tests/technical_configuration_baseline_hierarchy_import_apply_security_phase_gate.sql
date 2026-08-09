-- P2B hierarchy import apply activation, privilege, and legacy hash phase gate.
-- The P2B migration must be applied before execution. Temporary DDL rolls back.
BEGIN;

CREATE FUNCTION pg_temp.expect_error(
  p_label TEXT,
  p_statement TEXT,
  p_expected_state TEXT,
  p_expected_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $gate$
DECLARE
  v_state TEXT;
  v_message TEXT;
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_state = RETURNED_SQLSTATE,
        v_message = MESSAGE_TEXT;
      IF v_state = p_expected_state AND v_message = p_expected_message THEN
        RETURN;
      END IF;
      RAISE EXCEPTION '%: expected %/%, got %/%',
        p_label, p_expected_state, p_expected_message, v_state, v_message;
  END;
  RAISE EXCEPTION '%: expected statement to fail', p_label;
END;
$gate$;

DO $gate$
DECLARE
  v_internal REGPROCEDURE := to_regprocedure(
    'public._technical_configuration_baseline_import_apply_v2(uuid,jsonb,jsonb,bigint)'
  );
  v_public REGPROCEDURE := to_regprocedure(
    'public.technical_configuration_baseline_import_apply_v2(uuid,jsonb,jsonb,bigint)'
  );
  v_legacy_apply REGPROCEDURE := to_regprocedure(
    'public.technical_configuration_baseline_import_apply(uuid,jsonb,jsonb,bigint)'
  );
  v_legacy_preview REGPROCEDURE := to_regprocedure(
    'public.technical_configuration_baseline_import_preview(uuid,jsonb,jsonb,bigint)'
  );
  v_hash TEXT;
BEGIN
  IF v_internal IS NULL OR v_public IS NULL
     OR v_legacy_apply IS NULL OR v_legacy_preview IS NULL THEN
    RAISE EXCEPTION 'P2B apply function contract is incomplete';
  END IF;

  -- public v2 apply not activated
  PERFORM pg_temp.expect_error(
    'public v2 apply not activated',
    $$SELECT public.technical_configuration_baseline_import_apply_v2(
      gen_random_uuid(), '{}'::JSONB, '[]'::JSONB, 0
    )$$,
    'PT409',
    'hierarchical_import_apply_not_activated'
  );

  -- legacy apply privilege contract
  IF NOT has_function_privilege('authenticated', v_legacy_apply, 'EXECUTE')
     OR has_function_privilege('anon', v_legacy_apply, 'EXECUTE')
     OR has_function_privilege('service_role', v_legacy_apply, 'EXECUTE') THEN
    RAISE EXCEPTION 'legacy apply privilege contract mismatch';
  END IF;

  -- public v2 apply privilege contract
  IF NOT has_function_privilege('authenticated', v_public, 'EXECUTE')
     OR has_function_privilege('anon', v_public, 'EXECUTE')
     OR has_function_privilege('service_role', v_public, 'EXECUTE') THEN
    RAISE EXCEPTION 'public v2 apply privilege contract mismatch';
  END IF;

  -- internal apply privilege contract
  IF has_function_privilege('authenticated', v_internal, 'EXECUTE')
     OR has_function_privilege('anon', v_internal, 'EXECUTE')
     OR has_function_privilege('service_role', v_internal, 'EXECUTE') THEN
    RAISE EXCEPTION 'internal apply privilege contract mismatch';
  END IF;

  -- legacy function hash contract
  SELECT md5(p.prosrc)
  INTO v_hash
  FROM pg_proc p
  WHERE p.oid = v_legacy_preview;
  IF v_hash <> '936ffdff03e507329bc4360e7a70ddec' THEN
    RAISE EXCEPTION 'legacy preview function hash contract mismatch: %', v_hash;
  END IF;

  SELECT md5(p.prosrc)
  INTO v_hash
  FROM pg_proc p
  WHERE p.oid = v_legacy_apply;
  IF v_hash <> 'd6f450804e30c25ce7ae00b85008edef' THEN
    RAISE EXCEPTION 'legacy apply function hash contract mismatch: %', v_hash;
  END IF;

  IF has_function_privilege('public', v_internal, 'EXECUTE')
     OR has_function_privilege('public', v_public, 'EXECUTE') THEN
    RAISE EXCEPTION 'PUBLIC execute privilege leaked';
  END IF;
END;
$gate$;

ROLLBACK;
