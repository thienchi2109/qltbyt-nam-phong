-- DEVICE QUOTA DECISION DELETE REGRESSION TEST
\echo 'DEVICE QUOTA DECISION DELETE REGRESSION TEST'

BEGIN;

-- Snapshot baseline count for visibility
SELECT count(*) AS before_count FROM public.quyet_dinh_dinh_muc;

-- Use equipment-manager claims (to_qltb) scoped to don_vi 17
SELECT set_config(
  'request.jwt.claims',
  '{"app_role":"to_qltb","don_vi":"17","user_id":"24"}',
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

-- Insert temporary category for don_vi 17
CREATE TEMP TABLE tmp_category(category_id BIGINT);
WITH inserted AS (
  INSERT INTO public.nhom_thiet_bi (don_vi_id, ma_nhom, ten_nhom)
  VALUES (17, 'TEST-CAT-' || floor(random() * 100000)::TEXT, 'Danh muc thu nghiem')
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
