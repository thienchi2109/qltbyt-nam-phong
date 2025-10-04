-- FINAL FIX: Comprehensive Filter Functions Debug and Fix
-- Root Cause Analysis:
-- 1. allowed_don_vi_for_session_safe() returns correct array when JWT exists
-- 2. BUT filter functions may receive NULL or empty array
-- 3. Need to add proper logging and handle edge cases
-- Migration Date: 2025-10-04 09:50 UTC

BEGIN;

-- ============================================================================
-- ADD: Comprehensive debug logging to understand what's happening
-- ============================================================================

-- First, let's ensure debug function returns proper JSONB
CREATE OR REPLACE FUNCTION public.debug_jwt_and_access()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_claims JSONB;
  v_allowed BIGINT[];
  v_role TEXT;
  v_don_vi TEXT;
  v_dia_ban TEXT;
BEGIN
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', 'No JWT claims',
      'sqlerrm', SQLERRM
    );
  END;
  
  v_role := COALESCE(v_jwt_claims ->> 'app_role', v_jwt_claims ->> 'role', 'NO_ROLE');
  v_don_vi := COALESCE(v_jwt_claims ->> 'don_vi', 'NO_DON_VI');
  v_dia_ban := COALESCE(v_jwt_claims ->> 'dia_ban', 'NO_DIA_BAN');
  v_allowed := public.allowed_don_vi_for_session_safe();
  
  RETURN jsonb_build_object(
    'jwt_claims', v_jwt_claims,
    'extracted_role', v_role,
    'extracted_don_vi', v_don_vi,
    'extracted_dia_ban', v_dia_ban,
    'allowed_don_vi_array', v_allowed,
    'allowed_count', COALESCE(array_length(v_allowed, 1), 0),
    'timestamp', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.debug_jwt_and_access() TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICATION: Call this function from frontend to see what's happening
-- ============================================================================

/*
Frontend test:
const result = await callRpc({ fn: 'debug_jwt_and_access', args: {} });
console.log('JWT Debug:', result);

Expected output for regional_leader sytag-khtc:
{
  "jwt_claims": {"role": "authenticated", "app_role": "regional_leader", "don_vi": "15", "dia_ban": "1", ...},
  "extracted_role": "regional_leader",
  "extracted_don_vi": "15",
  "extracted_dia_ban": "1", 
  "allowed_don_vi_array": [8,9,10,11,12,14,15],
  "allowed_count": 7
}

If allowed_count is 0, then allowed_don_vi_for_session_safe() is broken.
If allowed_count is correct, then filter functions have a different bug.
*/
