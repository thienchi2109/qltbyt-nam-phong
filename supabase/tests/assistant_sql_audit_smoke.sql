-- Local/DB-admin verification artifact for Issue #271 Batch 4.
-- How to run after applying 20260419023000_add_assistant_sql_audit_rpc.sql:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/assistant_sql_audit_smoke.sql
--
-- This script is intentionally local-only and should not be wired into CI.

-- 1) Missing JWT claims must fail closed.
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{}', true);

  BEGIN
    PERFORM public.assistant_query_database_audit_log(
      p_status := 'success',
      p_tool_path := 'query_database',
      p_sql_shape := 'select 1',
      p_latency_ms := 1,
      p_row_count := 1,
      p_payload_bytes := 12,
      p_effective_facility_id := 1,
      p_facility_source := 'session'
    );
    RAISE EXCEPTION 'Expected assistant_query_database_audit_log to reject missing JWT claims';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      RAISE NOTICE 'OK: missing JWT claims fail closed';
    ELSE
      RAISE;
    END IF;
  END;
END $$;

-- 2) Success and failure audit rows are written with structured details.
DO $$
DECLARE
  v_facility_id bigint;
  v_user_id bigint;
  v_started_at timestamptz := now();
  v_success_details jsonb;
  v_failure_details jsonb;
BEGIN
  SELECT id INTO v_facility_id
  FROM public.don_vi
  WHERE active = true
  ORDER BY id
  LIMIT 1;

  SELECT id INTO v_user_id
  FROM public.nhan_vien
  ORDER BY id
  LIMIT 1;

  IF v_facility_id IS NULL THEN
    RAISE EXCEPTION 'Cannot run smoke: no active don_vi rows found';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Cannot run smoke: no nhan_vien rows found';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'to_qltb',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_facility_id::text
    )::text,
    true
  );

  IF NOT public.assistant_query_database_audit_log(
    p_status := 'success',
    p_tool_path := 'query_database',
    p_sql_shape := 'select equipment_id from ai_readonly.equipment_search',
    p_latency_ms := 37,
    p_row_count := 2,
    p_payload_bytes := 128,
    p_effective_facility_id := v_facility_id,
    p_facility_source := 'session',
    p_requested_facility_id := NULL,
    p_session_facility_id := v_facility_id,
    p_raw_role := 'to_qltb'
  ) THEN
    RAISE EXCEPTION 'Expected success audit RPC to return TRUE';
  END IF;

  IF NOT public.assistant_query_database_audit_log(
    p_status := 'failure',
    p_tool_path := 'query_database',
    p_sql_shape := 'select pg_sleep(10)',
    p_latency_ms := 5000,
    p_row_count := NULL,
    p_payload_bytes := NULL,
    p_effective_facility_id := v_facility_id,
    p_facility_source := 'session',
    p_error_class := 'timeout',
    p_requested_facility_id := NULL,
    p_session_facility_id := v_facility_id,
    p_raw_role := 'to_qltb'
  ) THEN
    RAISE EXCEPTION 'Expected failure audit RPC to return TRUE';
  END IF;

  SELECT al.action_details
  INTO v_success_details
  FROM public.audit_logs al
  WHERE al.action_type = 'assistant_query_database'
    AND al.entity_type = 'assistant_sql'
    AND al.entity_id = v_facility_id
    AND al.created_at >= v_started_at
    AND al.action_details->>'status' = 'success'
  ORDER BY al.id DESC
  LIMIT 1;

  SELECT al.action_details
  INTO v_failure_details
  FROM public.audit_logs al
  WHERE al.action_type = 'assistant_query_database'
    AND al.entity_type = 'assistant_sql'
    AND al.entity_id = v_facility_id
    AND al.created_at >= v_started_at
    AND al.action_details->>'status' = 'failure'
  ORDER BY al.id DESC
  LIMIT 1;

  IF v_success_details IS NULL THEN
    RAISE EXCEPTION 'Expected assistant_query_database success audit row';
  END IF;

  IF (v_success_details->>'effective_facility_id')::bigint IS DISTINCT FROM v_facility_id THEN
    RAISE EXCEPTION 'Success audit effective_facility_id mismatch';
  END IF;

  IF (v_success_details->>'latency_ms')::integer IS DISTINCT FROM 37 THEN
    RAISE EXCEPTION 'Success audit latency_ms mismatch';
  END IF;

  IF (v_success_details->>'row_count')::integer IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Success audit row_count mismatch';
  END IF;

  IF v_failure_details IS NULL THEN
    RAISE EXCEPTION 'Expected assistant_query_database failure audit row';
  END IF;

  IF v_failure_details->>'error_class' IS DISTINCT FROM 'timeout' THEN
    RAISE EXCEPTION 'Failure audit error_class mismatch';
  END IF;

  IF v_failure_details->>'row_count' IS NOT NULL THEN
    RAISE EXCEPTION 'Failure audit row_count should stay null';
  END IF;

  DELETE FROM public.audit_logs al
  WHERE al.action_type = 'assistant_query_database'
    AND al.entity_type = 'assistant_sql'
    AND al.entity_id = v_facility_id
    AND al.created_at >= v_started_at;

  RAISE NOTICE 'OK: assistant SQL success/failure audit details are persisted and cleaned up';
END $$;

-- 3) Local roles cannot audit a different effective facility.
DO $$
DECLARE
  v_facility_id bigint;
  v_other_facility_id bigint;
  v_user_id bigint;
BEGIN
  SELECT id INTO v_facility_id
  FROM public.don_vi
  WHERE active = true
  ORDER BY id
  LIMIT 1;

  SELECT id INTO v_other_facility_id
  FROM public.don_vi
  WHERE active = true
    AND id IS DISTINCT FROM v_facility_id
  ORDER BY id
  LIMIT 1;

  SELECT id INTO v_user_id
  FROM public.nhan_vien
  ORDER BY id
  LIMIT 1;

  IF v_facility_id IS NULL THEN
    RAISE NOTICE 'SKIP: no active facilities exist, so mismatch check cannot run';
    RETURN;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'SKIP: no nhan_vien rows exist, so mismatch check cannot run';
    RETURN;
  END IF;

  IF v_other_facility_id IS NULL THEN
    RAISE NOTICE 'SKIP: only one active facility exists, so mismatch check cannot run';
    RETURN;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'app_role', 'to_qltb',
      'user_id', v_user_id::text,
      'sub', v_user_id::text,
      'don_vi', v_facility_id::text
    )::text,
    true
  );

  BEGIN
    PERFORM public.assistant_query_database_audit_log(
      p_status := 'success',
      p_tool_path := 'query_database',
      p_sql_shape := 'select equipment_id from ai_readonly.equipment_search',
      p_latency_ms := 1,
      p_row_count := 1,
      p_payload_bytes := 12,
      p_effective_facility_id := v_other_facility_id,
      p_facility_source := 'session',
      p_session_facility_id := v_facility_id,
      p_raw_role := 'to_qltb'
    );
    RAISE EXCEPTION 'Expected local role facility mismatch to fail closed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      RAISE NOTICE 'OK: local role facility mismatch fails closed';
    ELSE
      RAISE;
    END IF;
  END;
END $$;
