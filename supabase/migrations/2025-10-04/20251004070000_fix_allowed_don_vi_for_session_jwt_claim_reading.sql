-- Fix allowed_don_vi_for_session JWT Claim Reading
-- Issue: Function still using direct JWT claim reading instead of _get_jwt_claim helper
-- Solution: Update function to use _get_jwt_claim helper for consistency
-- Migration Date: 2025-10-04 07:00 UTC

BEGIN;

-- ============================================================================
-- FIX: Update allowed_don_vi_for_session to use _get_jwt_claim helper
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
    -- Get user context from JWT claims using helper function
    -- IMPORTANT: Read 'app_role' claim first, then fallback to 'role' claim
    -- RPC proxy sends 'app_role' claim with actual user role (regional_leader, to_qltb, etc.)
    v_user_role := COALESCE(
        public._get_jwt_claim('app_role'),
        public._get_jwt_claim('role')
    );
    
    v_user_don_vi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
    v_user_region_id := NULLIF(public._get_jwt_claim('dia_ban'), '')::BIGINT;
    
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
'Returns array of don_vi IDs that current session user can access based on role and dia_ban. FIXED: Now uses _get_jwt_claim helper for consistent JWT claim reading.';

-- ============================================================================
-- UPDATE departments_list_for_tenant to use consistent JWT claim reading
-- ============================================================================

CREATE OR REPLACE FUNCTION public.departments_list_for_tenant(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
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
  SELECT jsonb_build_object('name', dept.name, 'count', dept.count)
  FROM (
    SELECT 
      COALESCE(NULLIF(TRIM(khoa_phong_quan_ly), ''), 'Chưa phân loại') as name,
      COUNT(*) as count
    FROM public.thiet_bi tb
    WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    GROUP BY khoa_phong_quan_ly
    ORDER BY count DESC
  ) dept;
END;
$$;

GRANT EXECUTE ON FUNCTION public.departments_list_for_tenant(BIGINT) TO authenticated;

COMMENT ON FUNCTION public.departments_list_for_tenant(BIGINT)
IS 'Returns department list for tenant with equipment counts. FIXED: Now uses consistent JWT claim reading.';

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

-- Test 3: Test departments_list_for_tenant for regional leader
SELECT * FROM public.departments_list_for_tenant(NULL);

-- Test 4: Test equipment_users_list_for_tenant for regional leader
SELECT * FROM public.equipment_users_list_for_tenant(NULL);

-- Test 5: Test equipment_locations_list_for_tenant for regional leader
SELECT * FROM public.equipment_locations_list_for_tenant(NULL);

-- Test 6: Test equipment_classifications_list_for_tenant for regional leader
SELECT * FROM public.equipment_classifications_list_for_tenant(NULL);

-- Test 7: Test equipment_statuses_list_for_tenant for regional leader
SELECT * FROM public.equipment_statuses_list_for_tenant(NULL);
*/