-- Fix equipment_status_distribution: Preserve JSONB Format with Regional Leader Support
-- Issue: Previous fix changed return type from JSONB to TABLE, breaking frontend expectations
-- Root Cause: Function signature was incorrectly modified, should maintain JSONB structure
-- Solution: Keep original JSONB format but add regional_leader RBAC validation
-- Migration Date: 2025-10-13 17:00 UTC

BEGIN;

-- ============================================================================
-- FIX: equipment_status_distribution - Preserve JSONB Format + Regional Leader
-- ============================================================================
-- Original return type: JSONB with {total_equipment, status_counts, by_department, by_location, departments, locations}
-- Must maintain this structure for frontend compatibility

CREATE OR REPLACE FUNCTION public.equipment_status_distribution(
  p_q TEXT DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL,
  p_khoa_phong TEXT DEFAULT NULL,
  p_vi_tri TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed BIGINT[];
  v_effective_donvi BIGINT;
  v_search TEXT := NULL;
  result JSONB;
BEGIN
  -- 1. Get role and allowed facilities
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();
  
  -- 2. Determine effective facility based on role
  IF v_role = 'global' THEN
    -- Global users can query specific tenant or need to specify one
    v_effective_donvi := p_don_vi;
    
  ELSIF v_role = 'regional_leader' THEN
    -- Regional leader: validate access to requested facility
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      -- No access - return empty result in expected format
      RETURN jsonb_build_object(
        'total_equipment', 0,
        'status_counts', jsonb_build_object(
          'hoat_dong', 0,
          'cho_sua_chua', 0,
          'cho_bao_tri', 0,
          'cho_hieu_chuan', 0,
          'ngung_su_dung', 0,
          'chua_co_nhu_cau', 0
        ),
        'by_department', '[]'::jsonb,
        'by_location', '[]'::jsonb,
        'departments', '[]'::jsonb,
        'locations', '[]'::jsonb
      );
    END IF;
    
    IF p_don_vi IS NOT NULL THEN
      -- Validate access to specific facility
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        -- Access denied - return empty result
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi 
          USING ERRCODE = '42501';
      END IF;
    ELSE
      -- No facility specified - return empty to force selection
      RETURN jsonb_build_object(
        'total_equipment', 0,
        'status_counts', jsonb_build_object(
          'hoat_dong', 0,
          'cho_sua_chua', 0,
          'cho_bao_tri', 0,
          'cho_hieu_chuan', 0,
          'ngung_su_dung', 0,
          'chua_co_nhu_cau', 0
        ),
        'by_department', '[]'::jsonb,
        'by_location', '[]'::jsonb,
        'departments', '[]'::jsonb,
        'locations', '[]'::jsonb
      );
    END IF;
    
  ELSE
    -- Other roles: limited to their facility
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
    
    -- If p_don_vi is provided and doesn't match user's facility, deny access
    IF p_don_vi IS NOT NULL AND p_don_vi != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi 
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 3. Process search query
  IF p_q IS NOT NULL AND length(trim(p_q)) > 0 THEN
    v_search := '%' || trim(p_q) || '%';
  END IF;

  -- 4. Build result with same structure as original function
  WITH filtered AS (
    SELECT
      tb.*,
      COALESCE(NULLIF(trim(tb.khoa_phong_quan_ly), ''), U&'Ch\01B0a ph\00E2n lo\1EA1i') AS department_name,
      COALESCE(NULLIF(trim(tb.vi_tri_lap_dat), ''),  U&'Ch\01B0a x\00E1c \0111\1ECBnh') AS location_name,
      NULLIF(trim(COALESCE(tb.tinh_trang_hien_tai, '')), '') AS raw_status
    FROM public.thiet_bi tb
    WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND (p_vi_tri IS NULL OR tb.vi_tri_lap_dat = p_vi_tri)
      AND (
        v_search IS NULL
        OR tb.ten_thiet_bi ILIKE v_search
        OR tb.ma_thiet_bi ILIKE v_search
      )
  ), mapped AS (
    SELECT
      f.*,
      CASE
        WHEN raw_status IS NULL THEN 'hoat_dong'
        WHEN raw_status ILIKE '%hoạt%' OR raw_status ILIKE '%hoat%'
          OR raw_status ILIKE '%đang sử%' OR raw_status ILIKE '%dang su%'
          THEN 'hoat_dong'
        WHEN raw_status ILIKE '%sửa chữa%' OR raw_status ILIKE '%sua chua%'
          OR raw_status ILIKE '%sửa%' OR raw_status ILIKE '%sua%'
          THEN 'cho_sua_chua'
        WHEN raw_status ILIKE '%bảo trì%' OR raw_status ILIKE '%bao tri%'
          THEN 'cho_bao_tri'
        WHEN raw_status ILIKE '%hiệu chuẩn%' OR raw_status ILIKE '%hieu chuan%'
          OR raw_status ILIKE '%kiểm định%' OR raw_status ILIKE '%kiem dinh%'
          OR raw_status ILIKE '%HC/KĐ%' OR raw_status ILIKE '%HC/KD%'
          THEN 'cho_hieu_chuan'
        WHEN raw_status ILIKE '%ngừng%' OR raw_status ILIKE '%ngung%'
          OR raw_status ILIKE '%stop%'
          THEN 'ngung_su_dung'
        WHEN raw_status ILIKE '%chưa có nhu cầu%' OR raw_status ILIKE '%chua co nhu cau%'
          THEN 'chua_co_nhu_cau'
        ELSE 'hoat_dong'
      END AS status_key
    FROM filtered f
  ), totals AS (
    SELECT
      COUNT(*)::INT AS total_equipment,
      COUNT(*) FILTER (WHERE status_key = 'hoat_dong')::INT AS hoat_dong,
      COUNT(*) FILTER (WHERE status_key = 'cho_sua_chua')::INT AS cho_sua_chua,
      COUNT(*) FILTER (WHERE status_key = 'cho_bao_tri')::INT AS cho_bao_tri,
      COUNT(*) FILTER (WHERE status_key = 'cho_hieu_chuan')::INT AS cho_hieu_chuan,
      COUNT(*) FILTER (WHERE status_key = 'ngung_su_dung')::INT AS ngung_su_dung,
      COUNT(*) FILTER (WHERE status_key = 'chua_co_nhu_cau')::INT AS chua_co_nhu_cau
    FROM mapped
  )
  SELECT jsonb_build_object(
    'total_equipment', totals.total_equipment,
    'status_counts', jsonb_build_object(
      'hoat_dong', totals.hoat_dong,
      'cho_sua_chua', totals.cho_sua_chua,
      'cho_bao_tri', totals.cho_bao_tri,
      'cho_hieu_chuan', totals.cho_hieu_chuan,
      'ngung_su_dung', totals.ngung_su_dung,
      'chua_co_nhu_cau', totals.chua_co_nhu_cau
    ),
    'by_department', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', d.department_name,
          'total', d.total,
          'hoat_dong', d.hoat_dong,
          'cho_sua_chua', d.cho_sua_chua,
          'cho_bao_tri', d.cho_bao_tri,
          'cho_hieu_chuan', d.cho_hieu_chuan,
          'ngung_su_dung', d.ngung_su_dung,
          'chua_co_nhu_cau', d.chua_co_nhu_cau
        )
      )
      FROM (
        SELECT
          department_name,
          COUNT(*)::INT AS total,
          COUNT(*) FILTER (WHERE status_key = 'hoat_dong')::INT AS hoat_dong,
          COUNT(*) FILTER (WHERE status_key = 'cho_sua_chua')::INT AS cho_sua_chua,
          COUNT(*) FILTER (WHERE status_key = 'cho_bao_tri')::INT AS cho_bao_tri,
          COUNT(*) FILTER (WHERE status_key = 'cho_hieu_chuan')::INT AS cho_hieu_chuan,
          COUNT(*) FILTER (WHERE status_key = 'ngung_su_dung')::INT AS ngung_su_dung,
          COUNT(*) FILTER (WHERE status_key = 'chua_co_nhu_cau')::INT AS chua_co_nhu_cau
        FROM mapped
        GROUP BY department_name
        ORDER BY total DESC
      ) d
    ), '[]'::jsonb),
    'by_location', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', l.location_name,
          'total', l.total,
          'hoat_dong', l.hoat_dong,
          'cho_sua_chua', l.cho_sua_chua,
          'cho_bao_tri', l.cho_bao_tri,
          'cho_hieu_chuan', l.cho_hieu_chuan,
          'ngung_su_dung', l.ngung_su_dung,
          'chua_co_nhu_cau', l.chua_co_nhu_cau
        )
      )
      FROM (
        SELECT
          location_name,
          COUNT(*)::INT AS total,
          COUNT(*) FILTER (WHERE status_key = 'hoat_dong')::INT AS hoat_dong,
          COUNT(*) FILTER (WHERE status_key = 'cho_sua_chua')::INT AS cho_sua_chua,
          COUNT(*) FILTER (WHERE status_key = 'cho_bao_tri')::INT AS cho_bao_tri,
          COUNT(*) FILTER (WHERE status_key = 'cho_hieu_chuan')::INT AS cho_hieu_chuan,
          COUNT(*) FILTER (WHERE status_key = 'ngung_su_dung')::INT AS ngung_su_dung,
          COUNT(*) FILTER (WHERE status_key = 'chua_co_nhu_cau')::INT AS chua_co_nhu_cau
        FROM mapped
        GROUP BY location_name
        ORDER BY total DESC
      ) l
    ), '[]'::jsonb),
    'departments', COALESCE((
      SELECT jsonb_agg(name ORDER BY name)
      FROM (
        SELECT DISTINCT department_name AS name FROM mapped
      ) dept_lookup
    ), '[]'::jsonb),
    'locations', COALESCE((
      SELECT jsonb_agg(name ORDER BY name)
      FROM (
        SELECT DISTINCT location_name AS name FROM mapped
      ) loc_lookup
    ), '[]'::jsonb)
  ) INTO result
  FROM totals;

  RETURN COALESCE(result, jsonb_build_object(
    'total_equipment', 0,
    'status_counts', jsonb_build_object(
      'hoat_dong', 0,
      'cho_sua_chua', 0,
      'cho_bao_tri', 0,
      'cho_hieu_chuan', 0,
      'ngung_su_dung', 0,
      'chua_co_nhu_cau', 0
    ),
    'by_department', '[]'::jsonb,
    'by_location', '[]'::jsonb,
    'departments', '[]'::jsonb,
    'locations', '[]'::jsonb
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_status_distribution(TEXT, BIGINT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.equipment_status_distribution(TEXT, BIGINT, TEXT, TEXT)
IS 'Returns equipment status distribution with department and location breakdowns in JSONB format.
FIXED: Added regional_leader support while preserving original JSONB structure for frontend compatibility.
Regional leaders must specify p_don_vi parameter to view facility-specific data.';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run manually in Supabase SQL Editor)
-- ============================================================================
/*
-- Test as regional_leader with specific facility
SELECT public.equipment_status_distribution(NULL, 1, NULL, NULL);

-- Test structure is correct
SELECT 
  (public.equipment_status_distribution(NULL, 1, NULL, NULL))->>'total_equipment' as total,
  (public.equipment_status_distribution(NULL, 1, NULL, NULL))->'status_counts'->>'hoat_dong' as hoat_dong,
  jsonb_array_length((public.equipment_status_distribution(NULL, 1, NULL, NULL))->'by_department') as dept_count,
  jsonb_array_length((public.equipment_status_distribution(NULL, 1, NULL, NULL))->'by_location') as loc_count;

-- Test access control (should fail for facility outside region)
SELECT public.equipment_status_distribution(NULL, 999, NULL, NULL);
*/
