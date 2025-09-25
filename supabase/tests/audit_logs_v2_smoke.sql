-- supabase/tests/audit_logs_v2_smoke.sql
-- Purpose: Non-destructive smoke tests for audit logs v2
-- How to run (psql): \i supabase/tests/audit_logs_v2_smoke.sql
-- These tests set simulated JWT claims via request.jwt.claims and clean up test rows.

-- 1) Security: non-global users must be denied
DO $$
DECLARE
  _ok boolean := false;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('app_role','to_qltb','user_id','9999','don_vi','1')::text,
    true
  );
  BEGIN
    PERFORM public.audit_logs_list_v2(10,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
    RAISE EXCEPTION 'Expected 42501 for non-global but call succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      RAISE NOTICE 'OK: non-global access denied as expected';
      _ok := true;
    ELSE
      RAISE; -- unexpected
    END IF;
  END;
END $$;

-- 2) Insert: global user can write via unified helper and read via v2 list
DO $$
DECLARE
  v_id bigint;
  v_now timestamptz := now();
  v_rows json;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('app_role','global','user_id','1','don_vi','1')::text,
    true
  );

  -- log a synthetic event
  PERFORM public.audit_log(
    p_action_type := 'maintenance_plan_create',
    p_entity_type := 'maintenance_plan',
    p_entity_id   := 987654321,
    p_entity_label:= 'TEST_SQL_EVENT',
    p_action_details := jsonb_build_object('k','v')
  );

  -- verify it can be read via v2 with entity filter and text search
  SELECT public.audit_logs_list_v2(
    10,0,NULL,'maintenance_plan',987654321,NULL,'TEST_SQL_EVENT', v_now - interval '5 minutes', now()
  ) INTO v_rows;

  IF coalesce(json_array_length(v_rows),0) = 0 THEN
    RAISE EXCEPTION 'Expected to find at least 1 test row but found 0';
  END IF;

  -- cleanup
  DELETE FROM public.audit_logs
  WHERE entity_type='maintenance_plan' AND entity_id=987654321 AND entity_label='TEST_SQL_EVENT';
  RAISE NOTICE 'OK: insert/read/cleanup passed';
END $$;
