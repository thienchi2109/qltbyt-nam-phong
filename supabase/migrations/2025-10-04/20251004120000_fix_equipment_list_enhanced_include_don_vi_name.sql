-- Fix equipment_list_enhanced to include don_vi name for tenant filtering
-- This enables regional leader client-side facility filtering to show actual facility names
-- Migration Date: 2025-10-04 12:00 UTC

BEGIN;

-- ============================================================================
-- Update equipment_list_enhanced to include don_vi name in the returned data
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

  -- Handle search query
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

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test query to verify don_vi_name is included
-- Parameter order: p_q, p_sort, p_page, p_page_size, p_don_vi, p_khoa_phong, p_khoa_phong_array, ...
-- SET request.jwt.claims TO '{"app_role": "regional_leader", "don_vi": "15", "dia_ban": "1"}';
-- SELECT jsonb_pretty(equipment_list_enhanced(
--   NULL,          -- p_q (search query)
--   'id.asc',      -- p_sort
--   1,             -- p_page
--   5,             -- p_page_size
--   NULL,          -- p_don_vi (NULL = use allowed_don_vi from JWT)
--   NULL,          -- p_khoa_phong
--   NULL,          -- p_khoa_phong_array
--   NULL,          -- p_nguoi_su_dung
--   NULL,          -- p_nguoi_su_dung_array
--   NULL,          -- p_vi_tri_lap_dat
--   NULL,          -- p_vi_tri_lap_dat_array
--   NULL,          -- p_tinh_trang
--   NULL,          -- p_tinh_trang_array
--   NULL,          -- p_phan_loai
--   NULL,          -- p_phan_loai_array
--   NULL           -- p_fields (NULL = use default)
-- ));

-- Verify the response includes "don_vi_name" field in the data array
-- Expected: Each item should have "don_vi_name": "Bệnh viện Đa khoa An Giang", etc.

COMMENT ON FUNCTION public.equipment_list_enhanced IS 'Returns equipment list with pagination and filters. Now includes don_vi_name for client-side tenant filtering.';
