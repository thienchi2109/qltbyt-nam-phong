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

-- Create throwaway draft decision (keeps test isolated)
WITH draft AS (
  SELECT public.dinh_muc_quyet_dinh_create(
    'TEST-DELETE-001',
    CURRENT_DATE,
    CURRENT_DATE,
    NULL,
    'Tester',
    'Truong phong',
    NULL,
    NULL
  ) AS payload
)
SELECT payload->>'id' AS created_id FROM draft;

-- Attempt to delete newly created draft (should fail pre-fix)
DO $$
DECLARE
  v_id BIGINT;
  v_result JSONB;
BEGIN
  SELECT (payload->>'id')::BIGINT INTO v_id FROM (
    SELECT public.dinh_muc_quyet_dinh_create(
      'TEST-DELETE-002',
      CURRENT_DATE,
      CURRENT_DATE,
      NULL,
      'Tester',
      'Truong phong',
      NULL,
      NULL
    ) AS payload
  ) s;

  v_result := public.dinh_muc_quyet_dinh_delete(v_id, NULL, 'regression-test');

  IF COALESCE(v_result->>'success', 'false') <> 'true' THEN
    RAISE EXCEPTION 'Delete RPC did not return success: %', v_result;
  END IF;
END $$;

ROLLBACK;
