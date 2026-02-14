-- Migration: Fix TOCTOU race condition in equipment_delete
-- Date: 2026-02-14
-- Issue: The UPDATE in equipment_delete lacks tenant isolation in WHERE clause
-- Root Cause: PERFORM check at line 28-35 and UPDATE at line 38-43 are not atomic
-- Attack Scenario:
--   1. User A (facility 1) calls equipment_delete(123) - equipment belongs to facility 1
--   2. PERFORM check passes (line 28-35)
--   3. Global admin changes equipment 123 from facility 1 -> facility 2
--   4. UPDATE executes (line 38-43) - NO tenant check, soft-deletes equipment now in facility 2
--   5. User A just deleted equipment they no longer have access to
--
-- Fix: Apply SELECT...FOR UPDATE pattern from equipment_restore (line 87-99)

BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_delete(p_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_code TEXT;
  v_name TEXT;
  v_row_don_vi BIGINT;
  v_is_deleted BOOLEAN;
BEGIN
  -- Permission check: only global/to_qltb can delete
  IF v_role IN ('regional_leader', 'technician', 'user') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- Atomic read with row lock (prevents race condition)
  -- This locks the row until transaction completes, ensuring no concurrent modifications
  SELECT tb.ma_thiet_bi, tb.ten_thiet_bi, tb.don_vi, tb.is_deleted
  INTO v_code, v_name, v_row_don_vi, v_is_deleted
  FROM public.thiet_bi tb
  WHERE tb.id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found' USING ERRCODE = 'P0002';
  END IF;

  -- Tenant isolation check AFTER locking row (ensures don_vi hasn't changed)
  IF v_role <> 'global' AND v_row_don_vi IS DISTINCT FROM v_donvi THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  -- Check not already deleted
  IF v_is_deleted IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Equipment not found or already deleted' USING ERRCODE = 'P0002';
  END IF;

  -- Soft delete with tenant filter (defense-in-depth)
  -- Even though we locked the row, adding don_vi filter prevents any edge cases
  UPDATE public.thiet_bi
  SET is_deleted = true
  WHERE id = p_id
    AND is_deleted = false
    AND (v_role = 'global' OR don_vi = v_donvi);  -- FIXED: Add tenant filter

  IF NOT FOUND THEN
    -- Should never happen due to FOR UPDATE lock, but defensive
    RAISE EXCEPTION 'Equipment not found or already deleted'
      USING ERRCODE = 'P0002';
  END IF;

  -- Audit log
  PERFORM public.audit_log(
    p_action_type := 'equipment_delete',
    p_entity_type := 'equipment',
    p_entity_id := p_id,
    p_entity_label := COALESCE(v_code, v_name, 'equipment-' || p_id::text),
    p_action_details := jsonb_build_object(
      'soft_deleted', true,
      'id', p_id,
      'ma_thiet_bi', v_code,
      'ten_thiet_bi', v_name,
      'don_vi', v_row_don_vi
    )
  );

  RETURN jsonb_build_object('success', true, 'id', p_id, 'soft_deleted', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.equipment_delete(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_delete(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.equipment_delete(BIGINT) IS 
  'Soft-delete equipment. Uses SELECT FOR UPDATE to prevent TOCTOU race conditions. '
  'Tenant isolation enforced atomically with row lock.';

COMMIT;

-- Verification query (run manually to test):
-- BEGIN;
--   SELECT * FROM public.thiet_bi WHERE id = 1 FOR UPDATE;
--   -- Simulate concurrent update attempt (will block until transaction commits)
--   UPDATE public.thiet_bi SET don_vi = 999 WHERE id = 1;
--   -- equipment_delete(1) should still respect original tenant
-- ROLLBACK;
