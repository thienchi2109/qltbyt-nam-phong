-- Fix Regional Leader Data Access and Filter Functions
-- Issue 1: Regional leaders cannot see regional data because allowed_don_vi returns empty array
-- Issue 2: Filter functions return no data when v_effective has zero-length check bug
-- Root Cause 1: JWT claim is 'dia_ban' but helper reads from wrong source
-- Root Cause 2: array_length check logic prevents data retrieval for non-empty arrays
-- Migration Date: 2025-10-04 09:15 UTC

BEGIN;

-- ============================================================================
-- FIX 1: allowed_don_vi_for_session_safe - Use JWT 'dia_ban' claim directly
-- ============================================================================

CREATE OR REPLACE FUNCTION public.allowed_don_vi_for_session_safe()
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
    
    -- Get user context from JWT claims
    v_user_role := COALESCE(
        v_jwt_claims ->> 'app_role',
        v_jwt_claims ->> 'role'
    );
    
    -- Get other claims - FIX: Read dia_ban directly from JWT
    v_user_don_vi := NULLIF(v_jwt_claims ->> 'don_vi', '')::BIGINT;
    v_user_region_id := NULLIF(v_jwt_claims ->> 'dia_ban', '')::BIGINT;
    
    -- Debug log
    RAISE LOG 'allowed_don_vi_for_session_safe - Role: %, DonVi: %, RegionId: %', 
              v_user_role, v_user_don_vi, v_user_region_id;
    
    -- If no role is found, return empty array instead of raising exception
    IF v_user_role IS NULL OR v_user_role = '' THEN
        RETURN ARRAY[]::BIGINT[];
    END IF;
    
    -- Handle different role access patterns
    CASE lower(v_user_role)
        WHEN 'global' THEN
            -- Global users can access all don_vi
            SELECT array_agg(id) INTO v_allowed_don_vi 
            FROM public.don_vi 
            WHERE active = true;
             
        WHEN 'regional_leader' THEN
            -- Regional leaders can access all don_vi in their region
            -- FIX: v_user_region_id is now correctly read from JWT 'dia_ban' claim
            IF v_user_region_id IS NULL THEN
                RAISE LOG 'Regional leader has no dia_ban claim - returning empty array';
                RETURN ARRAY[]::BIGINT[];
            END IF;
            
            SELECT array_agg(id) INTO v_allowed_don_vi 
            FROM public.don_vi 
            WHERE dia_ban_id = v_user_region_id 
            AND active = true;
            
            RAISE LOG 'Regional leader region % has don_vi: %', v_user_region_id, v_allowed_don_vi;
            
        WHEN 'admin', 'to_qltb', 'qltb_khoa', 'technician', 'user' THEN
            -- Other roles are limited to their specific don_vi
            IF v_user_don_vi IS NULL THEN
                RETURN ARRAY[]::BIGINT[];
            END IF;
            
            v_allowed_don_vi := ARRAY[v_user_don_vi];
            
        ELSE
            -- Unknown role - return empty array instead of raising exception
            RAISE LOG 'Unknown role % - returning empty array', v_user_role;
            RETURN ARRAY[]::BIGINT[];
    END CASE;
    
    -- Return empty array if no access (safety fallback)
    RETURN COALESCE(v_allowed_don_vi, ARRAY[]::BIGINT[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.allowed_don_vi_for_session_safe() TO authenticated;

COMMENT ON FUNCTION public.allowed_don_vi_for_session_safe() IS 
'Returns array of don_vi IDs accessible by current session. 
FIXED: Regional leaders now correctly read dia_ban from JWT claims.';

-- ============================================================================
-- FIX 2: equipment_users_list_for_tenant - Remove buggy empty array check
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_users_list_for_tenant(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed BIGINT[];
  v_effective BIGINT[];
  v_jwt_claims JSONB;
BEGIN
  -- Get JWT claims
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  
  -- Get role from claims
  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  
  v_allowed := public.allowed_don_vi_for_session_safe();
  
  -- FIX: Check if array is NULL or has zero length properly
  IF v_role = '' OR v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
    RETURN;
  END IF;

  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL; -- NULL means all tenants for global
    END IF;
  ELSE
    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed; -- Use all allowed don_vi
    END IF;
  END IF;

  -- FIX: Removed buggy empty array check that prevented data retrieval

  RETURN QUERY
  SELECT jsonb_build_object('id', nv.id, 'username', nv.username, 'full_name', nv.full_name, 'role', nv.role)
  FROM public.nhan_vien nv
  WHERE nv.is_active = TRUE
    AND (v_effective IS NULL OR nv.don_vi = ANY(v_effective))
    AND nv.role IN ('technician', 'user')
  ORDER BY nv.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_users_list_for_tenant(BIGINT) TO authenticated;

-- ============================================================================
-- FIX 3: equipment_locations_list_for_tenant
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_locations_list_for_tenant(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed BIGINT[];
  v_effective BIGINT[];
  v_jwt_claims JSONB;
BEGIN
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  
  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  
  v_allowed := public.allowed_don_vi_for_session_safe();
  
  IF v_role = '' OR v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
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

  RETURN QUERY
  SELECT jsonb_build_object('location', COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''), 'Chưa phân loại'), 'count', COUNT(*)::INTEGER)
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  GROUP BY COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''), 'Chưa phân loại')
  ORDER BY COUNT(*) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_locations_list_for_tenant(BIGINT) TO authenticated;

-- ============================================================================
-- FIX 4: equipment_classifications_list_for_tenant
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
  v_role TEXT;
  v_allowed BIGINT[];
  v_effective BIGINT[];
  v_jwt_claims JSONB;
BEGIN
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  
  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  
  v_allowed := public.allowed_don_vi_for_session_safe();
  
  IF v_role = '' OR v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
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

  RETURN QUERY
  SELECT jsonb_build_object('classification', COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''), 'Chưa phân loại'), 'count', COUNT(*)::INTEGER)
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  GROUP BY COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''), 'Chưa phân loại')
  ORDER BY COUNT(*) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_classifications_list_for_tenant(BIGINT) TO authenticated;

-- ============================================================================
-- FIX 5: equipment_statuses_list_for_tenant
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_statuses_list_for_tenant(
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed BIGINT[];
  v_effective BIGINT[];
  v_jwt_claims JSONB;
BEGIN
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  
  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  
  v_allowed := public.allowed_don_vi_for_session_safe();
  
  IF v_role = '' OR v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
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

  RETURN QUERY
  SELECT jsonb_build_object('status', COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''), 'Chưa phân loại'), 'count', COUNT(*)::INTEGER)
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  GROUP BY COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''), 'Chưa phân loại')
  ORDER BY COUNT(*) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_statuses_list_for_tenant(BIGINT) TO authenticated;

-- ============================================================================
-- FIX 6: departments_list_for_tenant (Khoa/Phòng filter - already working)
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
  v_role TEXT;
  v_allowed BIGINT[];
  v_effective BIGINT[];
  v_jwt_claims JSONB;
BEGIN
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  
  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  
  v_allowed := public.allowed_don_vi_for_session_safe();
  
  IF v_role = '' OR v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
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

  RETURN QUERY
  SELECT jsonb_build_object('department', COALESCE(NULLIF(TRIM(khoa_phong_quan_ly), ''), 'Chưa phân loại'), 'count', COUNT(*)::INTEGER)
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  GROUP BY COALESCE(NULLIF(TRIM(khoa_phong_quan_ly), ''), 'Chưa phân loại')
  ORDER BY COUNT(*) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.departments_list_for_tenant(BIGINT) TO authenticated;

-- ============================================================================
-- COMMIT AND ANALYZE
-- ============================================================================

COMMIT;

-- Update statistics
ANALYZE public.thiet_bi;
ANALYZE public.nhan_vien;
ANALYZE public.don_vi;

-- ============================================================================
-- VERIFICATION QUERIES (execute manually after migration)
-- ============================================================================

/*
-- Test 1: Verify allowed_don_vi for regional_leader returns An Giang don_vi
-- Expected: [8, 9, 10, 11, 12, 14, 15] for dia_ban = 1
SELECT public.allowed_don_vi_for_session_safe();

-- Test 2: Test equipment_users_list with regional_leader
SELECT * FROM public.equipment_users_list_for_tenant(NULL);

-- Test 3: Test equipment_statuses_list with regional_leader
SELECT * FROM public.equipment_statuses_list_for_tenant(NULL);

-- Test 4: Test equipment_classifications_list with regional_leader
SELECT * FROM public.equipment_classifications_list_for_tenant(NULL);

-- Test 5: Test equipment_locations_list with regional_leader
SELECT * FROM public.equipment_locations_list_for_tenant(NULL);

-- Test 6: Verify regional data access in equipment_list_enhanced
SELECT * FROM public.equipment_list_enhanced(NULL, 'id.asc', 1, 10, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
*/
