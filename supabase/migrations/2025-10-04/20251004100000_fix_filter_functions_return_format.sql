-- FIX: All filter functions must return {name: TEXT, count: INTEGER} format
-- Root Cause: Functions return wrong field names (status/id/username instead of name)
--             Frontend expects { name: string; count: number }[]
-- Migration Date: 2025-10-04 10:00 UTC

BEGIN;

-- ============================================================================
-- FIX: equipment_statuses_list_for_tenant
-- Change 'status' field to 'name' field
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
  SELECT jsonb_build_object(
    'name', COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''), 'Chưa phân loại'),
    'count', COUNT(*)::INTEGER
  )
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  GROUP BY COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''), 'Chưa phân loại')
  ORDER BY COUNT(*) DESC;
END;
$$;

-- ============================================================================
-- FIX: equipment_locations_list_for_tenant
-- Change 'location' field to 'name' field
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
  SELECT jsonb_build_object(
    'name', COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''), 'Chưa có vị trí'),
    'count', COUNT(*)::INTEGER
  )
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  GROUP BY COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''), 'Chưa có vị trí')
  ORDER BY COUNT(*) DESC;
END;
$$;

-- ============================================================================
-- FIX: equipment_classifications_list_for_tenant
-- Change 'classification' field to 'name' field
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
  SELECT jsonb_build_object(
    'name', COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''), 'Chưa phân loại'),
    'count', COUNT(*)::INTEGER
  )
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  GROUP BY COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''), 'Chưa phân loại')
  ORDER BY COUNT(*) DESC;
END;
$$;

-- ============================================================================
-- FIX: equipment_users_list_for_tenant
-- Return aggregated user full_name with count instead of individual users
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
  SELECT jsonb_build_object(
    'name', COALESCE(NULLIF(TRIM(nguoi_dang_truc_tiep_quan_ly), ''), 'Chưa có người sử dụng'),
    'count', COUNT(*)::INTEGER
  )
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  GROUP BY COALESCE(NULLIF(TRIM(nguoi_dang_truc_tiep_quan_ly), ''), 'Chưa có người sử dụng')
  ORDER BY COUNT(*) DESC;
END;
$$;

-- ============================================================================
-- FIX: departments_list_for_tenant
-- Change 'department' field to 'name' field
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
  SELECT jsonb_build_object(
    'name', COALESCE(NULLIF(TRIM(khoa_phong_quan_ly), ''), 'Chưa phân loại'),
    'count', COUNT(*)::INTEGER
  )
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  GROUP BY COALESCE(NULLIF(TRIM(khoa_phong_quan_ly), ''), 'Chưa phân loại')
  ORDER BY COUNT(*) DESC;
END;
$$;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

/*
Test with regional_leader JWT:
SET request.jwt.claims = '{"app_role": "regional_leader", "don_vi": "15", "dia_ban": "1", "role": "authenticated"}';

SELECT * FROM equipment_statuses_list_for_tenant(NULL) LIMIT 3;
-- Expected: [{"name": "Hoạt động", "count": 146}]

SELECT * FROM equipment_locations_list_for_tenant(NULL) LIMIT 3;
-- Expected: [{"name": "...", "count": ...}, ...]

SELECT * FROM equipment_classifications_list_for_tenant(NULL) LIMIT 3;
-- Expected: [{"name": "...", "count": ...}, ...]

SELECT * FROM equipment_users_list_for_tenant(NULL) LIMIT 3;
-- Expected: [{"name": "...", "count": ...}, ...]
*/
