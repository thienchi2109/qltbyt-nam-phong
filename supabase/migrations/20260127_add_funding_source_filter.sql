-- Add funding source filter to equipment list
-- Migration Date: 2026-01-27
-- Description: Adds RPC function for funding source aggregation and extends equipment_list_enhanced with funding source filters
-- Review: Follows pattern from equipment_statuses_list_for_tenant with proper tenant isolation

BEGIN;

-- ============================================================================
-- RPC Function: equipment_funding_sources_list_for_tenant
-- Returns aggregated funding sources with counts for a given tenant
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_funding_sources_list_for_tenant(
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
    -- SECURITY: Guard against empty/NULL allowed list for non-global users
    -- Without this check, v_effective = NULL would return ALL tenants
    IF v_allowed IS NULL OR array_length(v_allowed, 1) = 0 THEN
      RETURN;  -- Return empty set, no cross-tenant leak
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT (p_don_vi = ANY(v_allowed)) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'name', COALESCE(NULLIF(TRIM(nguon_kinh_phi), ''), 'Chưa có'),
    'count', COUNT(*)::INTEGER
  )
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
  GROUP BY COALESCE(NULLIF(TRIM(nguon_kinh_phi), ''), 'Chưa có')
  ORDER BY COUNT(*) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_funding_sources_list_for_tenant TO authenticated;

-- ============================================================================
-- Extend equipment_list_enhanced with funding source filters
-- Adds support for both single value and array-based filtering
-- ============================================================================

-- Drop previous signature to avoid PostgREST overload ambiguity
-- Previous signature from 20260121150000_add_serial_to_equipment_search.sql
-- Signature: (p_q, p_sort, p_page, p_page_size, p_don_vi, p_khoa_phong, p_khoa_phong_array,
--             p_nguoi_su_dung, p_nguoi_su_dung_array, p_vi_tri_lap_dat, p_vi_tri_lap_dat_array,
--             p_tinh_trang, p_tinh_trang_array, p_phan_loai, p_phan_loai_array, p_fields)
DROP FUNCTION IF EXISTS public.equipment_list_enhanced(
  TEXT, TEXT, INT, INT, BIGINT,
  TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[],
  TEXT, TEXT[], TEXT, TEXT[], TEXT
);

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
  p_nguon_kinh_phi TEXT DEFAULT NULL,
  p_nguon_kinh_phi_array TEXT[] DEFAULT NULL,
  p_fields TEXT DEFAULT 'id,ma_thiet_bi,ten_thiet_bi,model,serial,khoa_phong_quan_ly,tinh_trang_hien_tai,vi_tri_lap_dat,nguoi_dang_truc_tiep_quan_ly,phan_loai_theo_nd98'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_role TEXT := '';
  v_claim_donvi BIGINT := NULL;
  v_allowed_don_vi BIGINT[];
  v_effective_donvi BIGINT := NULL;
  v_sort_col TEXT := 'id';
  v_sort_dir TEXT := 'ASC';
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

  -- Parse sort parameter
  IF p_sort IS NOT NULL AND p_sort != '' THEN
    v_sort_col := split_part(p_sort, '.', 1);
    v_sort_dir := UPPER(COALESCE(NULLIF(split_part(p_sort, '.', 2), ''), 'ASC'));
    -- FIX: Validate sort direction to prevent SQL injection
    IF v_sort_dir NOT IN ('ASC', 'DESC') THEN
      v_sort_dir := 'ASC';
    END IF;
    -- FIX: Validate sort column whitelist for defense in depth
    IF v_sort_col NOT IN (
      'id', 'ma_thiet_bi', 'ten_thiet_bi', 'model', 'serial',
      'khoa_phong_quan_ly', 'tinh_trang_hien_tai', 'vi_tri_lap_dat',
      'nguoi_dang_truc_tiep_quan_ly', 'phan_loai_theo_nd98', 'nguon_kinh_phi', 'don_vi',
      'gia_goc', 'ngay_nhap', 'ngay_dua_vao_su_dung', 'ngay_bt_tiep_theo'
    ) THEN
      v_sort_col := 'id';
    END IF;
  END IF;

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

  -- For non-global users with no specific don_vi filter, use proper array syntax
  -- FIX: Use array_to_string with ARRAY[] constructor instead of quote_literal
  IF v_effective_donvi IS NULL AND lower(v_role) <> 'global' AND v_allowed_don_vi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ANY(ARRAY[' || array_to_string(v_allowed_don_vi, ',') || '])';
  END IF;

  -- Handle department filtering: prioritize array over single value
  IF p_khoa_phong_array IS NOT NULL AND array_length(p_khoa_phong_array, 1) > 0 THEN
    -- Multiple departments: use ANY for efficient IN clause
    v_where := v_where || ' AND khoa_phong_quan_ly = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_khoa_phong_array) AS x), ',') || '])';
  ELSIF p_khoa_phong IS NOT NULL AND trim(p_khoa_phong) != '' THEN
    -- Single department: backward compatibility
    v_where := v_where || ' AND khoa_phong_quan_ly = ' || quote_literal(p_khoa_phong);
  END IF;

  -- Handle user filtering
  IF p_nguoi_su_dung_array IS NOT NULL AND array_length(p_nguoi_su_dung_array, 1) > 0 THEN
    v_where := v_where || ' AND nguoi_dang_truc_tiep_quan_ly = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_nguoi_su_dung_array) AS x), ',') || '])';
  ELSIF p_nguoi_su_dung IS NOT NULL AND trim(p_nguoi_su_dung) != '' THEN
    v_where := v_where || ' AND nguoi_dang_truc_tiep_quan_ly = ' || quote_literal(p_nguoi_su_dung);
  END IF;

  -- Handle location filtering
  IF p_vi_tri_lap_dat_array IS NOT NULL AND array_length(p_vi_tri_lap_dat_array, 1) > 0 THEN
    v_where := v_where || ' AND vi_tri_lap_dat = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_vi_tri_lap_dat_array) AS x), ',') || '])';
  ELSIF p_vi_tri_lap_dat IS NOT NULL AND trim(p_vi_tri_lap_dat) != '' THEN
    v_where := v_where || ' AND vi_tri_lap_dat = ' || quote_literal(p_vi_tri_lap_dat);
  END IF;

  -- Handle status filtering
  IF p_tinh_trang_array IS NOT NULL AND array_length(p_tinh_trang_array, 1) > 0 THEN
    v_where := v_where || ' AND tinh_trang_hien_tai = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_tinh_trang_array) AS x), ',') || '])';
  ELSIF p_tinh_trang IS NOT NULL AND trim(p_tinh_trang) != '' THEN
    v_where := v_where || ' AND tinh_trang_hien_tai = ' || quote_literal(p_tinh_trang);
  END IF;

  -- Handle classification filtering
  IF p_phan_loai_array IS NOT NULL AND array_length(p_phan_loai_array, 1) > 0 THEN
    v_where := v_where || ' AND phan_loai_theo_nd98 = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_phan_loai_array) AS x), ',') || '])';
  ELSIF p_phan_loai IS NOT NULL AND trim(p_phan_loai) != '' THEN
    v_where := v_where || ' AND phan_loai_theo_nd98 = ' || quote_literal(p_phan_loai);
  END IF;

  -- Funding source filter (array has priority over single value)
  IF p_nguon_kinh_phi_array IS NOT NULL AND array_length(p_nguon_kinh_phi_array, 1) > 0 THEN
    IF 'Chưa có' = ANY(p_nguon_kinh_phi_array) THEN
      -- Include NULL/empty AND specified values
      DECLARE
        v_non_empty_sources TEXT[];
      BEGIN
        -- Extract non-empty values from array
        SELECT ARRAY(SELECT x FROM unnest(p_nguon_kinh_phi_array) AS x WHERE x != 'Chưa có') INTO v_non_empty_sources;

        IF v_non_empty_sources IS NOT NULL AND array_length(v_non_empty_sources, 1) > 0 THEN
          v_where := v_where || ' AND (nguon_kinh_phi IS NULL OR TRIM(nguon_kinh_phi) = '''' OR TRIM(nguon_kinh_phi) = ANY(ARRAY[' ||
            array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(v_non_empty_sources) AS x), ',') || ']))';
        ELSE
          -- Only 'Chưa có' in array
          v_where := v_where || ' AND (nguon_kinh_phi IS NULL OR TRIM(nguon_kinh_phi) = '''')';
        END IF;
      END;
    ELSE
      v_where := v_where || ' AND TRIM(nguon_kinh_phi) = ANY(ARRAY[' ||
        array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_nguon_kinh_phi_array) AS x), ',') || '])';
    END IF;
  ELSIF p_nguon_kinh_phi IS NOT NULL AND trim(p_nguon_kinh_phi) != '' THEN
    IF p_nguon_kinh_phi = 'Chưa có' THEN
      v_where := v_where || ' AND (nguon_kinh_phi IS NULL OR TRIM(nguon_kinh_phi) = '''')';
    ELSE
      v_where := v_where || ' AND TRIM(nguon_kinh_phi) = ' || quote_literal(p_nguon_kinh_phi);
    END IF;
  END IF;

  -- Handle search query (includes serial number)
  IF p_q IS NOT NULL AND trim(p_q) != '' THEN
    v_where := v_where || ' AND (ten_thiet_bi ILIKE ' || quote_literal('%' || p_q || '%') ||
              ' OR ma_thiet_bi ILIKE ' || quote_literal('%' || p_q || '%') ||
              ' OR serial ILIKE ' || quote_literal('%' || p_q || '%') || ')';
  END IF;

  -- Get total count
  EXECUTE format('SELECT count(*) FROM public.thiet_bi WHERE %s', v_where) INTO v_total;

  -- Validate fields parameter
  IF p_fields IS NOT NULL AND trim(p_fields) != '' THEN
    v_fields := p_fields;
  END IF;

  -- Get data page with proper sort
  -- FIX: Now includes don_vi_name in the returned JSON object
  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (
       SELECT (to_jsonb(tb.*) || jsonb_build_object(''google_drive_folder_url'', dv.google_drive_folder_url, ''don_vi_name'', dv.name)) AS t
       FROM public.thiet_bi tb
       LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
       WHERE %s
       ORDER BY tb.%I %s
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

GRANT EXECUTE ON FUNCTION public.equipment_list_enhanced TO authenticated;

-- ============================================================================
-- Create index for funding source filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_thiet_bi_don_vi_nguon_kinh_phi
  ON public.thiet_bi (don_vi, nguon_kinh_phi)
  WHERE don_vi IS NOT NULL;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

/*
Test funding source filter list:
SET request.jwt.claims = '{"app_role": "global", "don_vi": "15"}';

SELECT * FROM equipment_funding_sources_list_for_tenant(15) LIMIT 5;
-- Expected: [{"name": "Ngân sách nhà nước", "count": 42}, {"name": "Chưa có", "count": 15}, ...]

Test equipment list with single funding source:
SELECT jsonb_pretty(equipment_list_enhanced(
  p_nguon_kinh_phi => 'Ngân sách nhà nước',
  p_page => 1,
  p_page_size => 10,
  p_don_vi => 15
));

Test equipment list with multiple funding sources:
SELECT jsonb_pretty(equipment_list_enhanced(
  p_nguon_kinh_phi_array => ARRAY['Ngân sách nhà nước', 'Chưa có'],
  p_page => 1,
  p_page_size => 10,
  p_don_vi => 15
));
*/

COMMENT ON FUNCTION public.equipment_funding_sources_list_for_tenant IS 'Returns aggregated funding sources with counts for tenant equipment. Returns {"name": string, "count": number}[] format.';
COMMENT ON FUNCTION public.equipment_list_enhanced IS 'Returns equipment list with pagination and filters. Search includes: ten_thiet_bi, ma_thiet_bi, serial. Filters: departments, users, locations, status, classification, funding source (single or array).';
