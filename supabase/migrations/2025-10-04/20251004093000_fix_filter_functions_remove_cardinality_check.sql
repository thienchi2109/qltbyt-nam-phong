-- ROLLBACK PREVIOUS FIX: Fix Regional Leader and Filter Functions (Proper Fix)
-- Issue: cardinality() = 0 check prevents ALL users from seeing data
-- Root Cause: Filter functions exit early when v_allowed array is checked with cardinality
-- Proper Fix: Remove cardinality check, let query handle empty arrays naturally
-- Migration Date: 2025-10-04 09:30 UTC

BEGIN;

-- ============================================================================
-- FIX: equipment_users_list_for_tenant - Remove ALL array checks
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
  
  -- Exit if no role
  IF v_role = '' THEN
    RETURN;
  END IF;

  v_allowed := public.allowed_don_vi_for_session_safe();
  
  -- FIX: Do NOT check array length - let it be NULL or empty, query will handle it

  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL; -- NULL means all tenants for global
    END IF;
  ELSE
    -- Non-global users: check access
    IF p_don_vi IS NOT NULL THEN
      -- Verify access to specific don_vi
      IF v_allowed IS NULL OR NOT (p_don_vi = ANY(v_allowed)) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      -- Use all allowed don_vi
      v_effective := v_allowed;
    END IF;
  END IF;

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
-- FIX: equipment_locations_list_for_tenant
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
  
  IF v_role = '' THEN
    RETURN;
  END IF;

  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF p_don_vi IS NOT NULL THEN
      IF v_allowed IS NULL OR NOT (p_don_vi = ANY(v_allowed)) THEN
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
-- FIX: equipment_classifications_list_for_tenant
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
  
  IF v_role = '' THEN
    RETURN;
  END IF;

  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF p_don_vi IS NOT NULL THEN
      IF v_allowed IS NULL OR NOT (p_don_vi = ANY(v_allowed)) THEN
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
-- FIX: equipment_statuses_list_for_tenant
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
  
  IF v_role = '' THEN
    RETURN;
  END IF;

  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF p_don_vi IS NOT NULL THEN
      IF v_allowed IS NULL OR NOT (p_don_vi = ANY(v_allowed)) THEN
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
-- FIX: departments_list_for_tenant
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
  
  IF v_role = '' THEN
    RETURN;
  END IF;

  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF p_don_vi IS NOT NULL THEN
      IF v_allowed IS NULL OR NOT (p_don_vi = ANY(v_allowed)) THEN
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

ANALYZE public.thiet_bi;
ANALYZE public.nhan_vien;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

/*
-- Test 1: Login as regular user and test departments filter
SELECT * FROM public.departments_list_for_tenant(NULL);

-- Test 2: Test other filters
SELECT * FROM public.equipment_statuses_list_for_tenant(NULL);
SELECT * FROM public.equipment_classifications_list_for_tenant(NULL);
SELECT * FROM public.equipment_users_list_for_tenant(NULL);

-- Test 3: Login as regional_leader and verify access to all region facilities
SELECT public.allowed_don_vi_for_session_safe();
-- Expected for sytag-khtc: {8,9,10,11,12,14,15}

-- Test 4: Verify equipment list works for regional_leader
SELECT * FROM public.equipment_list_enhanced(NULL, 'id.asc', 1, 10, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
*/
