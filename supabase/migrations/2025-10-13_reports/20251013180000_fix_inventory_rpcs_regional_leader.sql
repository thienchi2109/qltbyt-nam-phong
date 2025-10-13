-- Fix Inventory Report RPC Functions - Regional Leader Support
-- Issue: equipment_list_for_reports, equipment_count_enhanced, transfer_request_list_enhanced ignore p_don_vi for regional_leader
-- Root Cause: Lines 40-44 in each function only check global vs non-global, missing regional_leader logic
-- Impact: Inventory tab KPIs and transaction table show wrong data when regional_leader selects facility
-- Migration Date: 2025-10-13 18:00 UTC

BEGIN;

-- ============================================================================
-- FIX 1: equipment_list_for_reports - Add Regional Leader Support
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_list_for_reports(
  p_q TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'id.asc',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 10000,
  p_don_vi BIGINT DEFAULT NULL,
  p_khoa_phong TEXT DEFAULT NULL
)
RETURNS SETOF public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed BIGINT[];
  v_effective_donvi BIGINT;
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_offset INT;
BEGIN
  -- 1. Get role and allowed facilities
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();
  
  -- 2. Determine effective facility based on role
  IF v_role = 'global' THEN
    -- Global users can query specific tenant or all tenants
    v_effective_donvi := p_don_vi;
    
  ELSIF v_role = 'regional_leader' THEN
    -- Regional leader: validate access to requested facility
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      -- No access - return no data
      RETURN;
    END IF;
    
    IF p_don_vi IS NOT NULL THEN
      -- Validate access to specific facility
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        -- Access denied
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi 
          USING ERRCODE = '42501';
      END IF;
    ELSE
      -- No facility specified - cannot list across multiple facilities safely
      -- Use primary facility as fallback
      v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
    END IF;
    
  ELSE
    -- Other roles: limited to their facility
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
    
    -- Validate if p_don_vi provided
    IF p_don_vi IS NOT NULL AND p_don_vi != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi 
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 3. Prepare pagination and sorting
  v_sort_col := split_part(p_sort, '.', 1);
  v_sort_dir := CASE LOWER(split_part(p_sort, '.', 2)) WHEN 'desc' THEN 'DESC' ELSE 'ASC' END;
  IF v_sort_col NOT IN ('id','ten_thiet_bi','ma_thiet_bi','khoa_phong_quan_ly','don_vi') THEN
    v_sort_col := 'id';
  END IF;
  v_offset := GREATEST((p_page - 1), 0) * GREATEST(p_page_size, 1);

  -- 4. Execute query
  RETURN QUERY EXECUTE format(
    'SELECT * FROM public.thiet_bi
     WHERE ( $1::bigint IS NULL OR don_vi = $1 )
       AND ( $2::text IS NULL OR khoa_phong_quan_ly = $2 )
       AND ( $3::text IS NULL OR ten_thiet_bi ILIKE $5 OR ma_thiet_bi ILIKE $5 )
     ORDER BY %I %s OFFSET $4 LIMIT $6',
     v_sort_col, v_sort_dir
  ) USING v_effective_donvi, p_khoa_phong, p_q, v_offset, ('%' || COALESCE(p_q, '') || '%'), p_page_size;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_list_for_reports(TEXT, TEXT, INT, INT, BIGINT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.equipment_list_for_reports(TEXT, TEXT, INT, INT, BIGINT, TEXT)
IS 'Returns equipment list for reports with tenant and department filtering.
FIXED: Added regional_leader support with allowed_don_vi_for_session_safe() validation.';

-- ============================================================================
-- FIX 2: equipment_count_enhanced - Add Regional Leader Support
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_count_enhanced(
  p_statuses TEXT[] DEFAULT NULL,
  p_q TEXT DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL,
  p_khoa_phong TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed BIGINT[];
  v_effective_donvi BIGINT;
  v_cnt BIGINT;
BEGIN
  -- 1. Get role and allowed facilities
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();
  
  -- 2. Determine effective facility based on role
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi;
    
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN 0;
    END IF;
    
    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi 
          USING ERRCODE = '42501';
      END IF;
    ELSE
      v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
    END IF;
    
  ELSE
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
    
    IF p_don_vi IS NOT NULL AND p_don_vi != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi 
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 3. Execute count query
  SELECT COUNT(*) INTO v_cnt
  FROM public.thiet_bi tb
  WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
    AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
    AND (p_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || p_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || p_q || '%'))
    AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));

  RETURN COALESCE(v_cnt, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_count_enhanced(TEXT[], TEXT, BIGINT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.equipment_count_enhanced(TEXT[], TEXT, BIGINT, TEXT)
IS 'Returns equipment count with filtering support.
FIXED: Added regional_leader support with allowed_don_vi_for_session_safe() validation.';

-- ============================================================================
-- FIX 3: transfer_request_list_enhanced - Add Regional Leader Support
-- ============================================================================

CREATE OR REPLACE FUNCTION public.transfer_request_list_enhanced(
  p_q TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 100,
  p_don_vi BIGINT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_khoa_phong TEXT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed BIGINT[];
  v_effective_donvi BIGINT;
  v_offset INT;
BEGIN
  -- 1. Get role and allowed facilities
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();
  
  -- 2. Determine effective facility based on role
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi;
    
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;
    
    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi 
          USING ERRCODE = '42501';
      END IF;
    ELSE
      v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
    END IF;
    
  ELSE
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
    
    IF p_don_vi IS NOT NULL AND p_don_vi != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi 
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 3. Prepare pagination
  v_offset := GREATEST((p_page - 1), 0) * GREATEST(p_page_size, 1);

  -- 4. Execute query
  RETURN QUERY
  SELECT to_jsonb(row) FROM (
    SELECT 
      yc.*,
      jsonb_build_object(
        'id', tb.id,
        'ma_thiet_bi', tb.ma_thiet_bi,
        'ten_thiet_bi', tb.ten_thiet_bi,
        'model', tb.model,
        'serial', tb.serial,
        'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
        'don_vi', tb.don_vi
      ) as thiet_bi
    FROM public.yeu_cau_luan_chuyen yc
    LEFT JOIN public.thiet_bi tb ON yc.thiet_bi_id = tb.id
    WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND (p_status IS NULL OR yc.trang_thai = p_status)
      AND (p_date_from IS NULL OR yc.created_at::date >= p_date_from)
      AND (p_date_to IS NULL OR yc.created_at::date <= p_date_to)
      AND (p_q IS NULL OR (
        tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR 
        tb.ma_thiet_bi ILIKE '%' || p_q || '%'
      ))
    ORDER BY yc.created_at DESC
    OFFSET v_offset LIMIT p_page_size
  ) row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_request_list_enhanced(TEXT, TEXT, INT, INT, BIGINT, DATE, DATE, TEXT) TO authenticated;

COMMENT ON FUNCTION public.transfer_request_list_enhanced(TEXT, TEXT, INT, INT, BIGINT, DATE, DATE, TEXT)
IS 'Returns transfer requests with equipment details and filtering support.
FIXED: Added regional_leader support with allowed_don_vi_for_session_safe() validation.';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run manually in Supabase SQL Editor)
-- ============================================================================
/*
-- Test equipment_list_for_reports as regional_leader
SELECT COUNT(*) FROM public.equipment_list_for_reports(NULL, 'id.asc', 1, 100, 1, NULL);

-- Test equipment_count_enhanced as regional_leader
SELECT public.equipment_count_enhanced(NULL, NULL, 1, NULL);

-- Test transfer_request_list_enhanced as regional_leader
SELECT COUNT(*) FROM public.transfer_request_list_enhanced(NULL, NULL, 1, 100, 1, NULL, NULL, NULL);

-- Verify all three return same facility data
SELECT 
  (SELECT COUNT(*) FROM equipment_list_for_reports(NULL, 'id.asc', 1, 10000, 1, NULL)) as list_count,
  equipment_count_enhanced(NULL, NULL, 1, NULL) as count_enhanced;
*/
