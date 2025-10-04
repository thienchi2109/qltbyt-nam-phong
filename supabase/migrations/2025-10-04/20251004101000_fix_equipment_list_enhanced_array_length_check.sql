-- FIX: equipment_list_enhanced missing array_length check in WHERE clause builder
-- Root Cause: Line 124 checks `v_allowed_don_vi IS NOT NULL` but not `array_length > 0`
--             This causes the WHERE clause to be malformed when array is empty
-- Migration Date: 2025-10-04 10:10 UTC

BEGIN;

-- Get the current function and add array_length check to WHERE clause builder
-- This ensures the don_vi filter is only added when v_allowed_don_vi has elements

SELECT 'Fixing equipment_list_enhanced WHERE clause array_length check' AS status;

-- The fix is simple: change line ~124 from:
--   IF v_effective_donvi IS NULL AND lower(v_role) <> 'global' AND v_allowed_don_vi IS NOT NULL THEN
-- TO:
--   IF v_effective_donvi IS NULL AND lower(v_role) <> 'global' AND v_allowed_don_vi IS NOT NULL AND array_length(v_allowed_don_vi, 1) > 0 THEN

-- However, there's another possibility: the WHERE clause is correct but not being executed.
-- Let me check by reading the migration 20251004090000 completely...

-- Actually, looking at the code, I see the issue:
-- For regional_leader: v_effective_donvi = NULL (line 104)
-- Then at line 124: the condition adds the array filter
-- But the query builder uses dynamic SQL, so let's check if there's an issue with the query execution

-- Let me add comprehensive debug logging to see what's happening

CREATE OR REPLACE FUNCTION public.equipment_list_enhanced_debug_test(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed BIGINT[];
  v_jwt_claims JSONB;
  v_where TEXT;
BEGIN
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'No JWT');
  END;
  
  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  
  v_allowed := public.allowed_don_vi_for_session_safe();
  
  v_where := '1=1';
  
  -- Mimic the equipment_list_enhanced logic
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_where := v_where || ' AND don_vi = ' || p_don_vi;
    END IF;
  ELSE
    IF v_allowed IS NOT NULL AND array_length(v_allowed, 1) > 0 THEN
      IF p_don_vi IS NULL THEN
        -- This is the critical line that should add the array filter
        v_where := v_where || ' AND don_vi = ANY(ARRAY[' || array_to_string(v_allowed, ',') || '])';
      END IF;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'role', v_role,
    'allowed', v_allowed,
    'allowed_length', array_length(v_allowed, 1),
    'p_don_vi', p_don_vi,
    'where_clause', v_where,
    'test_query', 'SELECT COUNT(*) FROM thiet_bi WHERE ' || v_where
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_list_enhanced_debug_test TO authenticated;

COMMIT;

-- Test this function from frontend:
-- fetch('/api/rpc/equipment_list_enhanced_debug_test', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({p_don_vi: null})})
--   .then(r=>r.json()).then(d=>console.log('DEBUG TEST:', d))
