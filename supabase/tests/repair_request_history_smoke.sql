-- supabase/tests/repair_request_history_smoke.sql
-- Purpose: smoke-test repair_request_change_history_list after the migration is applied.
-- How to run (psql): \i supabase/tests/repair_request_history_smoke.sql
-- Note: this script intentionally relies on existing repair-request audit data.

-- 1) Authorized tenant should read at least one history row
DO $$
DECLARE
  v_request_id INT;
  v_owner_don_vi BIGINT;
  v_rows JSONB;
BEGIN
  SELECT ycss.id, tb.don_vi
  INTO v_request_id, v_owner_don_vi
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.thiet_bi tb ON tb.id = ycss.thiet_bi_id
  JOIN public.audit_logs al
    ON al.entity_type = 'repair_request'
   AND al.entity_id = ycss.id
  LIMIT 1;

  IF v_request_id IS NULL OR v_owner_don_vi IS NULL THEN
    RAISE NOTICE 'SKIP: no repair request with audit history found';
    RETURN;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'user_id', '42',
      'don_vi', v_owner_don_vi::text
    )::text,
    true
  );

  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb)
  INTO v_rows
  FROM public.repair_request_change_history_list(v_request_id) AS row_data;

  IF jsonb_array_length(v_rows) = 0 THEN
    RAISE EXCEPTION 'Expected at least one repair history row for authorized tenant';
  END IF;

  RAISE NOTICE 'OK: authorized tenant can read repair history';
END $$;

-- 2) Wrong tenant should raise 42501
DO $$
DECLARE
  v_request_id INT;
  v_owner_don_vi BIGINT;
  v_wrong_don_vi BIGINT;
  v_ok BOOLEAN := FALSE;
BEGIN
  SELECT ycss.id, tb.don_vi
  INTO v_request_id, v_owner_don_vi
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.thiet_bi tb ON tb.id = ycss.thiet_bi_id
  JOIN public.audit_logs al
    ON al.entity_type = 'repair_request'
   AND al.entity_id = ycss.id
  LIMIT 1;

  SELECT dv.id
  INTO v_wrong_don_vi
  FROM public.don_vi dv
  WHERE dv.active = true
    AND dv.id <> v_owner_don_vi
  ORDER BY dv.id
  LIMIT 1;

  IF v_request_id IS NULL OR v_wrong_don_vi IS NULL THEN
    RAISE NOTICE 'SKIP: insufficient data for wrong-tenant test';
    RETURN;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'to_qltb',
      'user_id', '42',
      'don_vi', v_wrong_don_vi::text
    )::text,
    true
  );

  BEGIN
    PERFORM public.repair_request_change_history_list(v_request_id);
    RAISE EXCEPTION 'Expected 42501 for wrong tenant but call succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      v_ok := TRUE;
      RAISE NOTICE 'OK: wrong tenant denied as expected';
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Wrong-tenant test did not complete as expected';
  END IF;
END $$;

-- 3) Global bypass should read history
DO $$
DECLARE
  v_request_id INT;
  v_rows JSONB;
BEGIN
  SELECT ycss.id
  INTO v_request_id
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.audit_logs al
    ON al.entity_type = 'repair_request'
   AND al.entity_id = ycss.id
  LIMIT 1;

  IF v_request_id IS NULL THEN
    RAISE NOTICE 'SKIP: no repair request with audit history found';
    RETURN;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'global',
      'user_id', '1'
    )::text,
    true
  );

  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb)
  INTO v_rows
  FROM public.repair_request_change_history_list(v_request_id) AS row_data;

  IF jsonb_array_length(v_rows) = 0 THEN
    RAISE EXCEPTION 'Expected at least one repair history row for global user';
  END IF;

  RAISE NOTICE 'OK: global user can read repair history';
END $$;

-- 4) Admin bypass should behave like global
DO $$
DECLARE
  v_request_id INT;
  v_rows JSONB;
BEGIN
  SELECT ycss.id
  INTO v_request_id
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.audit_logs al
    ON al.entity_type = 'repair_request'
   AND al.entity_id = ycss.id
  LIMIT 1;

  IF v_request_id IS NULL THEN
    RAISE NOTICE 'SKIP: no repair request with audit history found';
    RETURN;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_role', 'admin',
      'user_id', '1'
    )::text,
    true
  );

  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb)
  INTO v_rows
  FROM public.repair_request_change_history_list(v_request_id) AS row_data;

  IF jsonb_array_length(v_rows) = 0 THEN
    RAISE EXCEPTION 'Expected at least one repair history row for admin user';
  END IF;

  RAISE NOTICE 'OK: admin user can read repair history';
END $$;

-- 5) Missing JWT claims should raise 42501
DO $$
DECLARE
  v_request_id INT;
  v_ok BOOLEAN := FALSE;
BEGIN
  SELECT ycss.id
  INTO v_request_id
  FROM public.yeu_cau_sua_chua ycss
  JOIN public.audit_logs al
    ON al.entity_type = 'repair_request'
   AND al.entity_id = ycss.id
  LIMIT 1;

  IF v_request_id IS NULL THEN
    RAISE NOTICE 'SKIP: no repair request with audit history found';
    RETURN;
  END IF;

  PERFORM set_config('request.jwt.claims', '{}'::text, true);

  BEGIN
    PERFORM public.repair_request_change_history_list(v_request_id);
    RAISE EXCEPTION 'Expected 42501 for missing JWT claims but call succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      v_ok := TRUE;
      RAISE NOTICE 'OK: missing JWT claims denied as expected';
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Missing-claims test did not complete as expected';
  END IF;
END $$;
