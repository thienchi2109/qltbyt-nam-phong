-- Fix Regional Leader Data Access and Filter Functions - SETOF Version
-- Issue 1: Regional leaders get "No tenant access" error
-- Issue 2: SQL syntax errors in equipment_filter_options function
-- Issue 3: Cannot use RETURN QUERY in a non-SETOF function
-- Solution: Fix SQL syntax and regional leader access logic, use SETOF for filter options
-- Migration Date: 2025-10-04 08:40 UTC

BEGIN;

-- ============================================================================
-- UPDATE: equipment_list_enhanced to support regional leaders
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_list_enhanced(
  p_q TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'id.asc',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50,
  p_don_vi BIGINT DEFAULT NULL,
  p_khoa_phong TEXT DEFAULT NULL,
  p_khoa_phong_array TEXT[] DEFAULT NULL,
  p_nguoi_su_dung TEXT DEFAULT NULL,
  p_nguoi_su_dung_array TEXT[] DEFAULT NULL,
  p_vi_tri_lap_dat TEXT DEFAULT NULL,
  p_vi_tri_lap_dat_array TEXT[] DEFAULT NULL,
  p_tinh_trang TEXT DEFAULT NULL,
  p_tinh_trang_array TEXT[] DEFAULT NULL,
  p_phan_loai TEXT DEFAULT NULL,
  p_phan_loai_array TEXT[] DEFAULT NULL,
  p_fields TEXT DEFAULT 'id,ma_thiet_bi,ten_thiet_bi,model,serial,khoa_phong_quan_ly,tinh_trang_hien_tai,vi_tri_lap_dat,nguoi_dang_truc_tiep_quan_ly,phan_loai_theo_nd98'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := '';
  v_claim_donvi BIGINT := NULL;
  v_allowed_don_vi BIGINT[];
  v_effective_donvi BIGINT[];
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_limit INT := GREATEST(p_page_size, 1);
  v_offset INT := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1);
  v_where TEXT := '1=1';
  v_total BIGINT := 0;
  v_data JSONB := '[]'::jsonb;
  v_fields TEXT := 'id,ma_thiet_bi,ten_thiet_bi,model,serial,khoa_phong_quan_ly,tinh_trang_hien_tai,vi_tri_lap_dat,nguoi_dang_truc_tiep_quan_ly,phan_loai_theo_nd98';
  v_jwt_claims JSONB;
BEGIN
  -- Get JWT claims with fallback
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;
  
  -- Get role and claims
  v_role := COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  );
  v_claim_donvi := NULLIF(v_jwt_claims ->> 'don_vi', '')::BIGINT;
  
  -- Get allowed don_vi based on role
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();
  
  -- Debug logging
  RAISE LOG 'Equipment List Enhanced - Role: %, Allowed DonVi: %, Claim DonVi: %', v_role, v_allowed_don_vi, v_claim_donvi;
  
  -- Tenant isolation logic
  IF lower(v_role) = 'global' THEN
    -- Global users can see all don_vi or filter by specific don_vi
    IF p_don_vi IS NOT NULL THEN
      v_effective_donvi := p_don_vi;
    ELSE
      v_effective_donvi := NULL; -- All tenants
    END IF;
  ELSE
    -- Non-global users: use allowed_don_vi_for_session
    IF v_allowed_don_vi IS NOT NULL AND array_length(v_allowed_don_vi, 1) > 0 THEN
      IF p_don_vi IS NOT NULL THEN
        -- Check if requested don_vi is in allowed list
        IF p_don_vi = ANY(v_allowed_don_vi) THEN
          v_effective_donvi := p_don_vi;
        ELSE
          -- Access denied
          RETURN jsonb_build_object(
            'data', '[]'::jsonb,
            'total', 0,
            'page', p_page,
            'pageSize', p_page_size,
            'error', 'Access denied for tenant'
          );
        END IF;
      ELSE
        -- For regional leaders and other non-global users, use all allowed don_vi
        v_effective_donvi := NULL;
      END IF;
    ELSE
      -- No access
      RETURN jsonb_build_object(
        'data', '[]'::jsonb,
        'total', 0,
        'page', p_page,
        'pageSize', p_page_size,
        'error', 'No tenant access'
      );
    END IF;
  END IF;

  -- Build WHERE clause with proper conditions
  IF v_effective_donvi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ' || v_effective_donvi;
  END IF;

  -- For non-global users with no specific don_vi filter, add additional WHERE clause
  IF v_effective_donvi IS NULL AND lower(v_role) <> 'global' AND v_allowed_don_vi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ANY(' || quote_literal(v_allowed_don_vi) || ')';
  END IF;

  -- Handle department filtering: prioritize array over single value
  IF p_khoa_phong_array IS NOT NULL AND array_length(p_khoa_phong_array, 1) > 0 THEN
    -- Multiple departments: use ANY for efficient IN clause
    v_where := v_where || ' AND khoa_phong_quan_ly = ANY(' || quote_literal(p_khoa_phong_array) || '::text[])';
  ELSIF p_khoa_phong IS NOT NULL AND trim(p_khoa_phong) != '' THEN
    -- Single department: backward compatibility
    v_where := v_where || ' AND khoa_phong_quan_ly = ' || quote_literal(p_khoa_phong);
  END IF;

  -- Handle user filtering
  IF p_nguoi_su_dung_array IS NOT NULL AND array_length(p_nguoi_su_dung_array, 1) > 0 THEN
    v_where := v_where || ' AND nguoi_dang_truc_tiep_quan_ly = ANY(' || quote_literal(p_nguoi_su_dung_array) || '::text[])';
  ELSIF p_nguoi_su_dung IS NOT NULL AND trim(p_nguoi_su_dung) != '' THEN
    v_where := v_where || ' AND nguoi_dang_truc_tiep_quan_ly = ' || quote_literal(p_nguoi_su_dung);
  END IF;

  -- Handle location filtering  
  IF p_vi_tri_lap_dat_array IS NOT NULL AND array_length(p_vi_tri_lap_dat_array, 1) > 0 THEN
    v_where := v_where || ' AND vi_tri_lap_dat = ANY(' || quote_literal(p_vi_tri_lap_dat_array) || '::text[])';
  ELSIF p_vi_tri_lap_dat IS NOT NULL AND trim(p_vi_tri_lap_dat) != '' THEN
    v_where := v_where || ' AND vi_tri_lap_dat = ' || quote_literal(p_vi_tri_lap_dat);
  END IF;

  -- Handle status filtering
  IF p_tinh_trang_array IS NOT NULL AND array_length(p_tinh_trang_array, 1) > 0 THEN
    v_where := v_where || ' AND tinh_trang_hien_tai = ANY(' || quote_literal(p_tinh_trang_array) || '::text[])';
  ELSIF p_tinh_trang IS NOT NULL AND trim(p_tinh_trang) != '' THEN
    v_where := v_where || ' AND tinh_trang_hien_tai = ' || quote_literal(p_tinh_trang);
  END IF;

  -- Handle classification filtering
  IF p_phan_loai_array IS NOT NULL AND array_length(p_phan_loai_array, 1) > 0 THEN
    v_where := v_where || ' AND phan_loai_theo_nd98 = ANY(' || quote_literal(p_phan_loai_array) || '::text[])';
  ELSIF p_phan_loai IS NOT NULL AND trim(p_phan_loai) != '' THEN
    v_where := v_where || ' AND phan_loai_theo_nd98 = ' || quote_literal(p_phan_loai);
  END IF;

  IF p_q IS NOT NULL AND trim(p_q) != '' THEN
    v_where := v_where || ' AND (ten_thiet_bi ILIKE ' || quote_literal('%' || p_q || '%') ||
              ' OR ma_thiet_bi ILIKE ' || quote_literal('%' || p_q || '%') || ')';
  END IF;

  -- Get total count
  EXECUTE format('SELECT count(*) FROM public.thiet_bi WHERE %s', v_where) INTO v_total;

  -- Validate fields parameter
  IF p_fields IS NOT NULL AND trim(p_fields) != '' THEN
    v_fields := p_fields;
  END IF;

  -- Get data page
  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (
       SELECT (to_jsonb(tb.*) || jsonb_build_object(''google_drive_folder_url'', dv.google_drive_folder_url)) AS t
       FROM public.thiet_bi tb
       LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
       WHERE %s
       ORDER BY %I %s
       OFFSET %s LIMIT %s
     ) sub',
    v_where, v_sort_col, v_sort_dir, v_offset, v_limit
  ) INTO v_data;

  RETURN jsonb_build_object(
    'data', v_data,
    'total', v_total,
    'page', p_page,
    'pageSize', p_page_size
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_list_enhanced(
  TEXT, TEXT, INT, INT, BIGINT, TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[], TEXT
) TO authenticated;

-- ============================================================================
-- UPDATE: equipment_filter_options to return unique values for all filters
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_filter_options_khoa_phong()
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed_don_vi BIGINT[];
  v_effective_donvi BIGINT;
  v_jwt_claims JSONB;
  v_where TEXT := '1=1';
BEGIN
  -- Get JWT claims with fallback
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;
  
  -- Get role and claims
  v_role := COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  );
  
  -- Get allowed don_vi based on role
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();
  
  -- Tenant isolation
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := NULL; -- All tenants
  ELSE
    IF v_allowed_don_vi IS NOT NULL AND array_length(v_allowed_don_vi, 1) > 0 THEN
      v_effective_donvi := v_allowed_don_vi[1]; -- Use first allowed don_vi
    ELSE
      v_effective_donvi := NULL;
    END IF;
  END IF;

  -- Build WHERE clause for tenant filtering
  IF lower(v_role) = 'regional_leader' AND v_effective_donvi IS NULL THEN
    v_where := v_where || ' AND don_vi = ANY(' || quote_literal(v_allowed_don_vi) || ')';
  ELSIF v_effective_donvi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ' || v_effective_donvi;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object('value', dept.khoa_phong_quan_ly, 'label', dept.khoa_phong_quan_ly)
  FROM (
    SELECT DISTINCT COALESCE(NULLIF(TRIM(khoa_phong_quan_ly), ''), 'Chưa phân loại') as khoa_phong_quan_ly
    FROM public.thiet_bi
    WHERE v_where
    ORDER BY khoa_phong_quan_ly
  ) dept;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_filter_options_khoa_phong() TO authenticated;

CREATE OR REPLACE FUNCTION public.equipment_filter_options_nguoi_su_dung()
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed_don_vi BIGINT[];
  v_effective_donvi BIGINT;
  v_jwt_claims JSONB;
  v_where TEXT := '1=1';
BEGIN
  -- Get JWT claims with fallback
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;
  
  -- Get role and claims
  v_role := COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  );
  
  -- Get allowed don_vi based on role
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();
  
  -- Tenant isolation
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := NULL; -- All tenants
  ELSE
    IF v_allowed_don_vi IS NOT NULL AND array_length(v_allowed_don_vi, 1) > 0 THEN
      v_effective_donvi := v_allowed_don_vi[1]; -- Use first allowed don_vi
    ELSE
      v_effective_donvi := NULL;
    END IF;
  END IF;

  -- Build WHERE clause for tenant filtering
  IF lower(v_role) = 'regional_leader' AND v_effective_donvi IS NULL THEN
    v_where := v_where || ' AND don_vi = ANY(' || quote_literal(v_allowed_don_vi) || ')';
  ELSIF v_effective_donvi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ' || v_effective_donvi;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object('value', usr.nguoi_dang_truc_tiep_quan_ly, 'label', usr.nguoi_dang_truc_tiep_quan_ly)
  FROM (
    SELECT DISTINCT COALESCE(NULLIF(TRIM(nguoi_dang_truc_tiep_quan_ly), ''), 'Chưa phân loại') as nguoi_dang_truc_tiep_quan_ly
    FROM public.thiet_bi
    WHERE v_where
    ORDER BY nguoi_dang_truc_tiep_quan_ly
  ) usr;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_filter_options_nguoi_su_dung() TO authenticated;

CREATE OR REPLACE FUNCTION public.equipment_filter_options_vi_tri_lap_dat()
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed_don_vi BIGINT[];
  v_effective_donvi BIGINT;
  v_jwt_claims JSONB;
  v_where TEXT := '1=1';
BEGIN
  -- Get JWT claims with fallback
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;
  
  -- Get role and claims
  v_role := COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  );
  
  -- Get allowed don_vi based on role
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();
  
  -- Tenant isolation
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := NULL; -- All tenants
  ELSE
    IF v_allowed_don_vi IS NOT NULL AND array_length(v_allowed_don_vi, 1) > 0 THEN
      v_effective_donvi := v_allowed_don_vi[1]; -- Use first allowed don_vi
    ELSE
      v_effective_donvi := NULL;
    END IF;
  END IF;

  -- Build WHERE clause for tenant filtering
  IF lower(v_role) = 'regional_leader' AND v_effective_donvi IS NULL THEN
    v_where := v_where || ' AND don_vi = ANY(' || quote_literal(v_allowed_don_vi) || ')';
  ELSIF v_effective_donvi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ' || v_effective_donvi;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object('value', loc.vi_tri_lap_dat, 'label', loc.vi_tri_lap_dat)
  FROM (
    SELECT DISTINCT COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''), 'Chưa phân loại') as vi_tri_lap_dat
    FROM public.thiet_bi
    WHERE v_where
    ORDER BY vi_tri_lap_dat
  ) loc;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_filter_options_vi_tri_lap_dat() TO authenticated;

CREATE OR REPLACE FUNCTION public.equipment_filter_options_tinh_trang()
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed_don_vi BIGINT[];
  v_effective_donvi BIGINT;
  v_jwt_claims JSONB;
  v_where TEXT := '1=1';
BEGIN
  -- Get JWT claims with fallback
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;
  
  -- Get role and claims
  v_role := COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  );
  
  -- Get allowed don_vi based on role
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();
  
  -- Tenant isolation
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := NULL; -- All tenants
  ELSE
    IF v_allowed_don_vi IS NOT NULL AND array_length(v_allowed_don_vi, 1) > 0 THEN
      v_effective_donvi := v_allowed_don_vi[1]; -- Use first allowed don_vi
    ELSE
      v_effective_donvi := NULL;
    END IF;
  END IF;

  -- Build WHERE clause for tenant filtering
  IF lower(v_role) = 'regional_leader' AND v_effective_donvi IS NULL THEN
    v_where := v_where || ' AND don_vi = ANY(' || quote_literal(v_allowed_don_vi) || ')';
  ELSIF v_effective_donvi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ' || v_effective_donvi;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object('value', st.tinh_trang_hien_tai, 'label', st.tinh_trang_hien_tai)
  FROM (
    SELECT DISTINCT COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''), 'Chưa phân loại') as tinh_trang_hien_tai
    FROM public.thiet_bi
    WHERE v_where
    ORDER BY tinh_trang_hien_tai
  ) st;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_filter_options_tinh_trang() TO authenticated;

CREATE OR REPLACE FUNCTION public.equipment_filter_options_phan_loai()
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed_don_vi BIGINT[];
  v_effective_donvi BIGINT;
  v_jwt_claims JSONB;
  v_where TEXT := '1=1';
BEGIN
  -- Get JWT claims with fallback
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;
  
  -- Get role and claims
  v_role := COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  );
  
  -- Get allowed don_vi based on role
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();
  
  -- Tenant isolation
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := NULL; -- All tenants
  ELSE
    IF v_allowed_don_vi IS NOT NULL AND array_length(v_allowed_don_vi, 1) > 0 THEN
      v_effective_donvi := v_allowed_don_vi[1]; -- Use first allowed don_vi
    ELSE
      v_effective_donvi := NULL;
    END IF;
  END IF;

  -- Build WHERE clause for tenant filtering
  IF lower(v_role) = 'regional_leader' AND v_effective_donvi IS NULL THEN
    v_where := v_where || ' AND don_vi = ANY(' || quote_literal(v_allowed_don_vi) || ')';
  ELSIF v_effective_donvi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ' || v_effective_donvi;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object('value', cls.phan_loai_theo_nd98, 'label', cls.phan_loai_theo_nd98)
  FROM (
    SELECT DISTINCT COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''), 'Chưa phân loại') as phan_loai_theo_nd98
    FROM public.thiet_bi
    WHERE v_where
    ORDER BY phan_loai_theo_nd98
  ) cls;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_filter_options_phan_loai() TO authenticated;

-- ============================================================================
-- UPDATE: equipment_filter_options wrapper function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_filter_options(
  p_filter_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
BEGIN
  CASE lower(p_filter_type)
    WHEN 'khoa_phong' THEN
      SELECT jsonb_agg(opt) INTO v_result FROM public.equipment_filter_options_khoa_phong() opt;
      
    WHEN 'nguoi_su_dung' THEN
      SELECT jsonb_agg(opt) INTO v_result FROM public.equipment_filter_options_nguoi_su_dung() opt;
      
    WHEN 'vi_tri_lap_dat' THEN
      SELECT jsonb_agg(opt) INTO v_result FROM public.equipment_filter_options_vi_tri_lap_dat() opt;
      
    WHEN 'tinh_trang' THEN
      SELECT jsonb_agg(opt) INTO v_result FROM public.equipment_filter_options_tinh_trang() opt;
      
    WHEN 'phan_loai' THEN
      SELECT jsonb_agg(opt) INTO v_result FROM public.equipment_filter_options_phan_loai() opt;
      
    ELSE
      -- Return all filter options if no specific type requested
      SELECT jsonb_build_object(
        'khoa_phong', (SELECT jsonb_agg(opt) FROM public.equipment_filter_options_khoa_phong() opt),
        'nguoi_su_dung', (SELECT jsonb_agg(opt) FROM public.equipment_filter_options_nguoi_su_dung() opt),
        'vi_tri_lap_dat', (SELECT jsonb_agg(opt) FROM public.equipment_filter_options_vi_tri_lap_dat() opt),
        'tinh_trang', (SELECT jsonb_agg(opt) FROM public.equipment_filter_options_tinh_trang() opt),
        'phan_loai', (SELECT jsonb_agg(opt) FROM public.equipment_filter_options_phan_loai() opt)
      ) INTO v_result;
  END CASE;
  
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_filter_options(TEXT) TO authenticated;

-- ============================================================================
-- COMMIT AND ANALYZE
-- ============================================================================

COMMIT;

-- Update statistics
ANALYZE public.thiet_bi;
ANALYZE public.don_vi;

-- ============================================================================
-- VERIFICATION QUERIES (execute manually after migration)
-- ============================================================================

/*
-- Test 1: Check regional leader access to equipment_list_enhanced
SELECT * FROM public.equipment_list_enhanced(NULL, 'id.asc', 1, 10, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- Test 2: Test filter options for regional leader
SELECT * FROM public.equipment_filter_options('khoa_phong');
SELECT * FROM public.equipment_filter_options('nguoi_su_dung');
SELECT * FROM public.equipment_filter_options('vi_tri_lap_dat');
SELECT * FROM public.equipment_filter_options('tinh_trang');
SELECT * FROM public.equipment_filter_options('phan_loai');

-- Test 3: Test all filter options
SELECT * FROM public.equipment_filter_options(NULL);
*/