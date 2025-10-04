-- Fix JWT Claim Reading in allowed_don_vi_for_session Function
-- Issue: Function reads 'role' claim instead of 'app_role' claim from JWT
-- Solution: Update function to read 'app_role' claim first, then fallback to 'role'
-- Migration Date: 2025-10-04 06:50 UTC

BEGIN;

-- ============================================================================
-- FIX: Update allowed_don_vi_for_session to read app_role claim from JWT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.allowed_don_vi_for_session()
RETURNS BIGINT[] 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_role TEXT;
    v_user_don_vi BIGINT;
    v_user_region_id BIGINT;
    v_allowed_don_vi BIGINT[];
BEGIN
    -- Get user context from JWT claims
    -- IMPORTANT: Read 'app_role' claim first, then fallback to 'role' claim
    -- RPC proxy sends 'app_role' claim with actual user role (regional_leader, to_qltb, etc.)
    v_user_role := COALESCE(
        current_setting('request.jwt.claims', true)::json->>'app_role',
        current_setting('request.jwt.claims', true)::json->>'role'
    );
    
    v_user_don_vi := (current_setting('request.jwt.claims', true)::json->>'don_vi')::BIGINT;
    v_user_region_id := (current_setting('request.jwt.claims', true)::json->>'dia_ban')::BIGINT;
    
    -- Handle different role access patterns
    CASE v_user_role
        WHEN 'global' THEN
            -- Global users can access all don_vi
            SELECT array_agg(id) INTO v_allowed_don_vi 
            FROM public.don_vi 
            WHERE active = true;
             
        WHEN 'regional_leader' THEN
            -- Regional leaders can access all don_vi in their region
            IF v_user_region_id IS NULL THEN
                RAISE EXCEPTION 'Regional leader must have dia_ban assigned';
            END IF;
            
            SELECT array_agg(id) INTO v_allowed_don_vi 
            FROM public.don_vi 
            WHERE dia_ban_id = v_user_region_id 
            AND active = true;
            
        WHEN 'admin', 'to_qltb', 'qltb_khoa', 'technician', 'user' THEN
            -- Other roles are limited to their specific don_vi
            IF v_user_don_vi IS NULL THEN
                RAISE EXCEPTION 'User must have don_vi assigned for role %', v_user_role;
            END IF;
            
            v_allowed_don_vi := ARRAY[v_user_don_vi];
            
        ELSE
            -- Unknown role - no access
            RAISE EXCEPTION 'Unknown role: %', v_user_role;
    END CASE;
    
    -- Return empty array if no access (safety fallback)
    RETURN COALESCE(v_allowed_don_vi, ARRAY[]::BIGINT[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.allowed_don_vi_for_session() TO authenticated;

COMMENT ON FUNCTION public.allowed_don_vi_for_session() IS 
'Returns array of don_vi IDs that current session user can access based on role and dia_ban. FIXED: Now reads "app_role" claim from JWT to match RPC proxy.';

-- ============================================================================
-- FIX: Update other functions that read JWT claims incorrectly
-- ============================================================================

-- Add debug helper function to check JWT claims
CREATE OR REPLACE FUNCTION public.debug_jwt_claims()
RETURNS TABLE(
  claim_name TEXT,
  claim_value TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_jwt_claims JSONB;
BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
    
    -- Return all claims as key-value pairs
    RETURN QUERY
    SELECT 
        key::TEXT as claim_name,
        value::TEXT as claim_value
    FROM jsonb_each_text(v_jwt_claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.debug_jwt_claims() TO authenticated;

COMMENT ON FUNCTION public.debug_jwt_claims() IS 
'Debug function to inspect JWT claims. Returns all claims as key-value pairs.';

-- ============================================================================
-- COMMIT AND ANALYZE
-- ============================================================================

COMMIT;

-- Update statistics
ANALYZE public.don_vi;

-- ============================================================================
-- VERIFICATION QUERIES (execute manually after migration)
-- ============================================================================

/*
-- Test 1: Check JWT claims for regional leader (execute after login)
SELECT * FROM public.debug_jwt_claims();

-- Test 2: Test allowed_don_vi_for_session with regional leader context
-- Note: This requires proper JWT context, so test through application
SELECT public.allowed_don_vi_for_session();

-- Test 3: Verify regional leader authentication
SELECT * FROM public.authenticate_user_dual_mode('sytag-khtc', '1234');

-- Test 4: Test departments_list_for_tenant for regional leader
SELECT * FROM public.departments_list_for_tenant(NULL);

-- Test 5: Test usage_log_list for regional leader
SELECT * FROM public.usage_log_list(NULL, NULL, 1, 10, NULL, NULL, NULL);
*/