-- Fix JWT Claim Reading with Fallback Mechanism
-- Issue: _get_jwt_claim helper function may be returning NULL even when claims exist
-- Solution: Create robust fallback mechanism with direct claim reading
-- Migration Date: 2025-10-04 07:10 UTC

BEGIN;

-- ============================================================================
-- ENSURE: Create robust _get_jwt_claim helper function with fallback
-- ============================================================================

CREATE OR REPLACE FUNCTION public._get_jwt_claim(claim TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb ->> claim,
    current_setting('request.jwt.claims', true)::json ->> claim,
    NULL
  );
$$;

-- ============================================================================
-- CREATE: Enhanced JWT claim reading function with multiple fallbacks
-- ============================================================================

CREATE OR REPLACE FUNCTION public._get_jwt_claim_safe(claim TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_claim_value TEXT;
    v_jwt_claims JSONB;
BEGIN
    -- Method 1: Try the helper function first
    v_claim_value := public._get_jwt_claim(claim);
    
    IF v_claim_value IS NOT NULL THEN
        RETURN v_claim_value;
    END IF;
    
    -- Method 2: Try direct JSONB extraction
    BEGIN
        v_claim_value := current_setting('request.jwt.claims', true)::jsonb ->> claim;
        IF v_claim_value IS NOT NULL THEN
            RETURN v_claim_value;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to next method
    END;
    
    -- Method 3: Try direct JSON extraction (fallback)
    BEGIN
        v_claim_value := current_setting('request.jwt.claims', true)::json ->> claim;
        IF v_claim_value IS NOT NULL THEN
            RETURN v_claim_value;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Continue to next method
    END;
    
    -- Method 4: Parse and extract manually
    BEGIN
        v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
        v_claim_value := v_jwt_claims ->> claim;
        IF v_claim_value IS NOT NULL THEN
            RETURN v_claim_value;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Return NULL if all methods fail
    END;
    
    RETURN NULL;
END;
$$;

-- ============================================================================
-- FIX: Update allowed_don_vi_for_session with robust claim reading
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
    v_jwt_claims JSONB;
BEGIN
    -- Get user context from JWT claims with multiple fallbacks
    -- Method 1: Try safe helper function
    v_user_role := COALESCE(
        public._get_jwt_claim_safe('app_role'),
        public._get_jwt_claim_safe('role')
    );
    
    -- If still NULL, try direct extraction
    IF v_user_role IS NULL THEN
        BEGIN
            v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
            v_user_role := COALESCE(
                v_jwt_claims ->> 'app_role',
                v_jwt_claims ->> 'role'
            );
        EXCEPTION WHEN OTHERS THEN
            v_user_role := NULL;
        END;
    END IF;
    
    -- Get other claims with safe extraction
    v_user_don_vi := NULLIF(public._get_jwt_claim_safe('don_vi'), '')::BIGINT;
    IF v_user_don_vi IS NULL THEN
        BEGIN
            v_jwt_claims := COALESCE(v_jwt_claims, current_setting('request.jwt.claims', true)::jsonb);
            v_user_don_vi := NULLIF(v_jwt_claims ->> 'don_vi', '')::BIGINT;
        EXCEPTION WHEN OTHERS THEN
            v_user_don_vi := NULL;
        END;
    END IF;
    
    v_user_region_id := NULLIF(public._get_jwt_claim_safe('dia_ban'), '')::BIGINT;
    IF v_user_region_id IS NULL THEN
        BEGIN
            v_jwt_claims := COALESCE(v_jwt_claims, current_setting('request.jwt.claims', true)::jsonb);
            v_user_region_id := NULLIF(v_jwt_claims ->> 'dia_ban', '')::BIGINT;
        EXCEPTION WHEN OTHERS THEN
            v_user_region_id := NULL;
        END;
    END IF;
    
    -- Debug logging (can be removed in production)
    RAISE LOG 'JWT Claims - Role: %, DonVi: %, DiaBan: %', v_user_role, v_user_don_vi, v_user_region_id;
    
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
            -- Unknown role - provide more helpful error
            IF v_user_role IS NULL THEN
                RAISE EXCEPTION 'JWT role claim is NULL or missing. Check JWT configuration.';
            ELSE
                RAISE EXCEPTION 'Unknown role: %', v_user_role;
            END IF;
    END CASE;
    
    -- Return empty array if no access (safety fallback)
    RETURN COALESCE(v_allowed_don_vi, ARRAY[]::BIGINT[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.allowed_don_vi_for_session() TO authenticated;

COMMENT ON FUNCTION public.allowed_don_vi_for_session() IS 
'Returns array of don_vi IDs that current session user can access based on role and dia_ban. FIXED: Now uses robust JWT claim reading with multiple fallbacks.';

-- ============================================================================
-- FIX: Update equipment_classifications_list_for_tenant with robust claim reading
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_classifications_list_for_tenant(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(
    public._get_jwt_claim_safe('app_role'),
    public._get_jwt_claim_safe('role'),
    ''
  ));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
BEGIN
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  IF v_effective IS NOT NULL AND array_length(v_effective, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object('classification', COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''), 'Chưa phân loại'), 'count', COUNT(*))
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  GROUP BY COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''), 'Chưa phân loại')
  ORDER BY count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_classifications_list_for_tenant(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.equipment_classifications_list_for_tenant(BIGINT)
IS 'Returns classification list for tenant equipment. FIXED: Now uses robust JWT claim reading with fallbacks.';

-- ============================================================================
-- CREATE: Debug function to inspect JWT claims
-- ============================================================================

CREATE OR REPLACE FUNCTION public.debug_jwt_claims_detailed()
RETURNS TABLE(
  claim_name TEXT,
  claim_value TEXT,
  extraction_method TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_jwt_claims JSONB;
    v_claim_value TEXT;
BEGIN
    -- Try to get JWT claims
    BEGIN
        v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'ERROR'::TEXT, SQLERRM::TEXT, 'EXCEPTION'::TEXT;
        RETURN;
    END IF;
    
    -- Return all claims with their values
    RETURN QUERY
    SELECT 
        key::TEXT as claim_name,
        value::TEXT as claim_value,
        'DIRECT_EXTRACTION'::TEXT as extraction_method
    FROM jsonb_each_text(v_jwt_claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.debug_jwt_claims_detailed() TO authenticated;

COMMENT ON FUNCTION public.debug_jwt_claims_detailed() IS 
'Debug function to inspect JWT claims with detailed extraction information.';

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
-- Test 1: Check detailed JWT claims
SELECT * FROM public.debug_jwt_claims_detailed();

-- Test 2: Check basic JWT claims
SELECT * FROM public.debug_jwt_claims();

-- Test 3: Test safe claim reading
SELECT public._get_jwt_claim_safe('app_role');
SELECT public._get_jwt_claim_safe('role');
SELECT public._get_jwt_claim_safe('don_vi');
SELECT public._get_jwt_claim_safe('dia_ban');

-- Test 4: Test allowed_don_vi_for_session
SELECT public.allowed_don_vi_for_session();

-- Test 5: Test equipment_classifications_list_for_tenant
SELECT * FROM public.equipment_classifications_list_for_tenant(NULL);
*/