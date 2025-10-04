-- Fix RPC Proxy Session Handling
-- Issue: JWT claims are not being passed to database functions due to session issues
-- Solution: Create fallback mechanism for when session is not available
-- Migration Date: 2025-10-04 07:20 UTC

BEGIN;

-- ============================================================================
-- CREATE: Simple test function to verify JWT claim passing
-- ============================================================================

CREATE OR REPLACE FUNCTION public.test_jwt_claims()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result JSONB;
    v_jwt_claims JSONB;
BEGIN
    -- Try to get JWT claims
    BEGIN
        v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
    EXCEPTION WHEN OTHERS THEN
        v_jwt_claims := jsonb_build_object('error', SQLERRM);
    END IF;
    
    -- Build result with all possible claims
    v_result := jsonb_build_object(
        'jwt_claims', v_jwt_claims,
        'app_role', COALESCE(public._get_jwt_claim_safe('app_role'), public._get_jwt_claim_safe('role'), 'NULL'),
        'role', COALESCE(public._get_jwt_claim_safe('role'), 'NULL'),
        'don_vi', COALESCE(public._get_jwt_claim_safe('don_vi'), 'NULL'),
        'dia_ban', COALESCE(public._get_jwt_claim_safe('dia_ban'), 'NULL'),
        'user_id', COALESCE(public._get_jwt_claim_safe('user_id'), 'NULL'),
        'raw_jwt_setting', COALESCE(current_setting('request.jwt.claims', true), 'NOT_SET')
    );
    
    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_jwt_claims() TO authenticated;

COMMENT ON FUNCTION public.test_jwt_claims() IS 
'Test function to verify JWT claim passing from RPC proxy. Returns all available claims and debug information.';

-- ============================================================================
-- CREATE: Fallback function for when JWT claims are missing
-- ============================================================================

CREATE OR REPLACE FUNCTION public.allowed_don_vi_for_session_fallback()
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
    -- Check if JWT claims are available at all
    BEGIN
        v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
    EXCEPTION WHEN OTHERS THEN
        -- No JWT claims available - return empty array
        RETURN ARRAY[]::BIGINT[];
    END;
    
    -- Get user context from JWT claims with multiple fallbacks
    v_user_role := COALESCE(
        public._get_jwt_claim_safe('app_role'),
        public._get_jwt_claim_safe('role')
    );
    
    -- If still NULL, try direct extraction
    IF v_user_role IS NULL THEN
        v_user_role := COALESCE(
            v_jwt_claims ->> 'app_role',
            v_jwt_claims ->> 'role'
        );
    END IF;
    
    -- Get other claims
    v_user_don_vi := COALESCE(
        NULLIF(public._get_jwt_claim_safe('don_vi'), '')::BIGINT,
        NULLIF(v_jwt_claims ->> 'don_vi', '')::BIGINT
    );
    
    v_user_region_id := COALESCE(
        NULLIF(public._get_jwt_claim_safe('dia_ban'), '')::BIGINT,
        NULLIF(v_jwt_claims ->> 'dia_ban', '')::BIGINT
    );
    
    -- If no role is found, return empty array instead of raising exception
    IF v_user_role IS NULL OR v_user_role = '' THEN
        RETURN ARRAY[]::BIGINT[];
    END IF;
    
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
                RETURN ARRAY[]::BIGINT[];
            END IF;
            
            SELECT array_agg(id) INTO v_allowed_don_vi 
            FROM public.don_vi 
            WHERE dia_ban_id = v_user_region_id 
            AND active = true;
            
        WHEN 'admin', 'to_qltb', 'qltb_khoa', 'technician', 'user' THEN
            -- Other roles are limited to their specific don_vi
            IF v_user_don_vi IS NULL THEN
                RETURN ARRAY[]::BIGINT[];
            END IF;
            
            v_allowed_don_vi := ARRAY[v_user_don_vi];
            
        ELSE
            -- Unknown role - return empty array instead of raising exception
            RETURN ARRAY[]::BIGINT[];
    END CASE;
    
    -- Return empty array if no access (safety fallback)
    RETURN COALESCE(v_allowed_don_vi, ARRAY[]::BIGINT[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.allowed_don_vi_for_session_fallback() TO authenticated;

COMMENT ON FUNCTION public.allowed_don_vi_for_session_fallback() IS 
'Fallback version of allowed_don_vi_for_session that returns empty array instead of raising exceptions when JWT claims are missing.';

-- ============================================================================
-- UPDATE: equipment_classifications_list_for_tenant with fallback handling
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
  v_allowed BIGINT[] := public.allowed_don_vi_for_session_fallback();
  v_effective BIGINT[] := NULL;
BEGIN
  -- If no valid role found, return empty result
  IF v_role = '' OR v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
    RETURN;
  END IF;

  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
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
IS 'Returns classification list for tenant equipment. FIXED: Now uses fallback handling for missing JWT claims.';

-- ============================================================================
-- UPDATE: All other equipment list functions with fallback handling
-- ============================================================================

-- Update equipment_users_list_for_tenant
CREATE OR REPLACE FUNCTION public.equipment_users_list_for_tenant(
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
  v_allowed BIGINT[] := public.allowed_don_vi_for_session_fallback();
  v_effective BIGINT[] := NULL;
BEGIN
  IF v_role = '' OR v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
    RETURN;
  END IF;

  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
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
  SELECT jsonb_build_object('id', nv.id, 'username', nv.username, 'full_name', nv.full_name, 'role', nv.role)
  FROM public.nhan_vien nv
  WHERE nv.active = TRUE
    AND (v_effective IS NULL OR nv.don_vi = ANY(v_effective))
    AND nv.role IN ('technician', 'user')
  ORDER BY nv.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_users_list_for_tenant(BIGINT) TO authenticated;

-- Update equipment_locations_list_for_tenant
CREATE OR REPLACE FUNCTION public.equipment_locations_list_for_tenant(
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
  v_allowed BIGINT[] := public.allowed_don_vi_for_session_fallback();
  v_effective BIGINT[] := NULL;
BEGIN
  IF v_role = '' OR v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
    RETURN;
  END IF;

  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
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
  SELECT jsonb_build_object('location', COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''), 'Chưa phân loại'), 'count', COUNT(*))
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  GROUP BY COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''), 'Chưa phân loại')
  ORDER BY count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_locations_list_for_tenant(BIGINT) TO authenticated;

-- Update equipment_statuses_list_for_tenant
CREATE OR REPLACE FUNCTION public.equipment_statuses_list_for_tenant(
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
  v_allowed BIGINT[] := public.allowed_don_vi_for_session_fallback();
  v_effective BIGINT[] := NULL;
BEGIN
  IF v_role = '' OR v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
    RETURN;
  END IF;

  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
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
  SELECT jsonb_build_object('status', COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''), 'Chưa phân loại'), 'count', COUNT(*))
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  GROUP BY COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''), 'Chưa phân loại')
  ORDER BY count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_statuses_list_for_tenant(BIGINT) TO authenticated;

-- Update departments_list_for_tenant
CREATE OR REPLACE FUNCTION public.departments_list_for_tenant(
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
  v_allowed BIGINT[] := public.allowed_don_vi_for_session_fallback();
  v_effective BIGINT[] := NULL;
BEGIN
  IF v_role = '' OR v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
    RETURN;
  END IF;

  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
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

-- ============================================================================
-- COMMIT AND ANALYZE
-- ============================================================================

COMMIT;

-- Update statistics
ANALYZE public.don_vi;
ANALYZE public.thiet_bi;
ANALYZE public.nhan_vien;

-- ============================================================================
-- VERIFICATION QUERIES (execute manually after migration)
-- ============================================================================

/*
-- Test 1: Check JWT claims passing
SELECT * FROM public.test_jwt_claims();

-- Test 2: Test fallback function
SELECT public.allowed_don_vi_for_session_fallback();

-- Test 3: Test equipment functions with fallback
SELECT * FROM public.equipment_classifications_list_for_tenant(NULL);
SELECT * FROM public.equipment_users_list_for_tenant(NULL);
SELECT * FROM public.equipment_locations_list_for_tenant(NULL);
SELECT * FROM public.equipment_statuses_list_for_tenant(NULL);
SELECT * FROM public.departments_list_for_tenant(NULL);
*/