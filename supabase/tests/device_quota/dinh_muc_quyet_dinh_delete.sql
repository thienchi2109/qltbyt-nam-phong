-- DEVICE QUOTA DECISION DELETE REGRESSION TEST
\echo 'DEVICE QUOTA DECISION DELETE REGRESSION TEST'

BEGIN;

-- Guard against TOCTOU: validation SELECT must lock the decision row.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.dinh_muc_quyet_dinh_delete(bigint,bigint,text)'::regprocedure)
  INTO v_def;

  IF position('for update' in lower(v_def)) = 0 THEN
    RAISE EXCEPTION 'Expected dinh_muc_quyet_dinh_delete() to lock row with FOR UPDATE';
  END IF;

END $$;

-- Guard activation race hardening: activate RPC should lock target decision row.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.dinh_muc_quyet_dinh_activate(bigint,bigint)'::regprocedure)
  INTO v_def;

  IF position('for update' in lower(v_def)) = 0 THEN
    RAISE EXCEPTION 'Expected dinh_muc_quyet_dinh_activate() to lock row with FOR UPDATE';
  END IF;
END $$;

-- Guard against silent NOT NULL/FK failures: all decision write RPCs must validate user context.
DO $$
DECLARE
  v_def text;
  v_fn regprocedure;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.dinh_muc_quyet_dinh_create(text,date,date,text,text,bigint,date,text,bigint)'::regprocedure,
    'public.dinh_muc_quyet_dinh_update(bigint,text,date,date,date,text,text,text,bigint,bigint)'::regprocedure,
    'public.dinh_muc_quyet_dinh_activate(bigint,bigint)'::regprocedure,
    'public.dinh_muc_quyet_dinh_delete(bigint,bigint,text)'::regprocedure
  ]
  LOOP
    SELECT pg_get_functiondef(v_fn) INTO v_def;
    IF position('v_user_id is null' in lower(v_def)) = 0 THEN
      RAISE EXCEPTION 'Expected % to guard v_user_id IS NULL', v_fn::text;
    END IF;
  END LOOP;
END $$;

-- Snapshot baseline count for visibility
SELECT count(*) AS before_count FROM public.quyet_dinh_dinh_muc;

-- Resolve fixture-independent tenant/user context for JWT claims.
CREATE TEMP TABLE tmp_fixture(don_vi_id BIGINT, user_id BIGINT);
INSERT INTO tmp_fixture(don_vi_id, user_id)
SELECT
  dv.id,
  nv.id
FROM public.don_vi dv
JOIN public.nhan_vien nv
  ON COALESCE(nv.current_don_vi, nv.don_vi) = dv.id
ORDER BY dv.id, nv.id
LIMIT 1;

DO $$
DECLARE
  v_don_vi_id BIGINT;
  v_user_id BIGINT;
BEGIN
  SELECT don_vi_id, user_id
  INTO v_don_vi_id, v_user_id
  FROM tmp_fixture;

  IF v_don_vi_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing fixture rows in don_vi or nhan_vien';
  END IF;
END $$;

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'app_role', 'to_qltb',
    'don_vi', (SELECT don_vi_id::text FROM tmp_fixture),
    'user_id', (SELECT user_id::text FROM tmp_fixture)
  )::text,
  true
);

-- Create throwaway draft decision
CREATE TEMP TABLE tmp_decision(decision_id BIGINT);
INSERT INTO tmp_decision(decision_id)
SELECT (payload->>'id')::BIGINT
FROM (
  SELECT public.dinh_muc_quyet_dinh_create(
    'TEST-DELETE-001',
    CURRENT_DATE,
    CURRENT_DATE,
    'Tester',
    'Truong phong',
    NULL,
    NULL,
    NULL,
    NULL
  ) AS payload
) s;

-- Insert temporary category for selected tenant
CREATE TEMP TABLE tmp_category(category_id BIGINT);
WITH inserted AS (
  INSERT INTO public.nhom_thiet_bi (don_vi_id, ma_nhom, ten_nhom)
  VALUES ((SELECT don_vi_id FROM tmp_fixture), 'TEST-CAT-' || floor(random() * 100000)::TEXT, 'Danh muc thu nghiem')
  RETURNING id
)
INSERT INTO tmp_category(category_id)
SELECT id FROM inserted;

-- Insert line item via RPC to ensure chi_tiet audit rows exist
SELECT public.dinh_muc_chi_tiet_upsert(
  NULL,
  (SELECT decision_id FROM tmp_decision),
  (SELECT category_id FROM tmp_category),
  5,
  1,
  'regression test item',
  NULL
);

-- Attempt to delete the draft decision
DO $$
DECLARE
  v_id BIGINT := (SELECT decision_id FROM tmp_decision);
  v_result JSONB;
BEGIN
  v_result := public.dinh_muc_quyet_dinh_delete(v_id, NULL, 'regression-test');
  IF COALESCE(v_result->>'success', 'false') <> 'true' THEN
    RAISE EXCEPTION 'Delete RPC did not return success: %', v_result;
  END IF;
END $$;

ROLLBACK;
