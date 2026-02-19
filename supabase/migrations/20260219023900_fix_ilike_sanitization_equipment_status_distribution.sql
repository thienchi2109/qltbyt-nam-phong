-- Migration: Apply _sanitize_ilike_pattern to equipment_status_distribution (4-param text overload)
-- Date: 2026-02-19
--
-- Background: The 4-parameter overload of equipment_status_distribution
-- (p_q text, p_don_vi bigint, p_khoa_phong text, p_vi_tri text), defined in
-- 20260213100000, builds the search pattern as:
--
--   v_search := '%' || trim(p_q) || '%';
--
-- A search for literal '%' matches every row; '_' matches any single character.
-- This is the same unsanitized-ILIKE class of bug fixed for equipment_list,
-- equipment_count, equipment_count_enhanced, and equipment_list_for_reports.
--
-- Fix: call _sanitize_ilike_pattern(p_q) and build v_search from the result.
-- _sanitize_ilike_pattern returns NULL for NULL/empty input, so the existing
-- v_search IS NULL guard in the WHERE clause continues to handle the no-search
-- case correctly without any other changes.
--
-- The 3-parameter overload (BIGINT, TEXT, TEXT) has no search parameter and
-- is unaffected.

BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_status_distribution(
  p_q text DEFAULT NULL::text,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_khoa_phong text DEFAULT NULL::text,
  p_vi_tri text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_allowed bigint[];
  v_effective_donvi bigint;
  v_search text := NULL;
  result jsonb;
BEGIN
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
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
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
    ELSE
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
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
    IF v_effective_donvi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for role %', v_role USING ERRCODE = '42501';
    END IF;

    IF p_don_vi IS NOT NULL AND p_don_vi != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Sanitize ILIKE metacharacters (%, _, \) before building the search pattern.
  -- _sanitize_ilike_pattern returns NULL for NULL/empty input, so the existing
  -- v_search IS NULL guard in the WHERE clause correctly skips the clause when absent.
  IF p_q IS NOT NULL AND length(trim(p_q)) > 0 THEN
    v_search := '%' || public._sanitize_ilike_pattern(p_q) || '%';
  END IF;

  WITH filtered AS (
    SELECT
      tb.*,
      COALESCE(NULLIF(trim(tb.khoa_phong_quan_ly), ''), U&'Ch\01B0a ph\00E2n lo\1EA1i') AS department_name,
      COALESCE(NULLIF(trim(tb.vi_tri_lap_dat), ''), U&'Ch\01B0a x\00E1c \0111\1ECBnh') AS location_name,
      NULLIF(trim(COALESCE(tb.tinh_trang_hien_tai, '')), '') AS raw_status
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false
      AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
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
        WHEN raw_status ILIKE '%Hoạt động%' OR raw_status ILIKE '%Hoat dong%' OR raw_status ILIKE '%đang sử%' OR raw_status ILIKE '%dang su%' THEN 'hoat_dong'
        WHEN raw_status ILIKE '%sửa chữa%' OR raw_status ILIKE '%sua chua%' OR raw_status ILIKE '%sửa%' OR raw_status ILIKE '%sua%' THEN 'cho_sua_chua'
        WHEN raw_status ILIKE '%bảo trì%' OR raw_status ILIKE '%bao tri%' THEN 'cho_bao_tri'
        WHEN raw_status ILIKE '%hiệu chuẩn%' OR raw_status ILIKE '%hieu chuan%' OR raw_status ILIKE '%kiểm định%' OR raw_status ILIKE '%kiem dinh%' OR raw_status ILIKE '%HC/KD%' THEN 'cho_hieu_chuan'
        WHEN raw_status ILIKE '%ngưng%' OR raw_status ILIKE '%ngung%' OR raw_status ILIKE '%stop%' THEN 'ngung_su_dung'
        WHEN raw_status ILIKE '%chưa có nhu cầu%' OR raw_status ILIKE '%chua co nhu cau%' THEN 'chua_co_nhu_cau'
        ELSE 'hoat_dong'
      END AS status_key
    FROM filtered f
  ), totals AS (
    SELECT
      COUNT(*)::int AS total_equipment,
      COUNT(*) FILTER (WHERE status_key = 'hoat_dong')::int AS hoat_dong,
      COUNT(*) FILTER (WHERE status_key = 'cho_sua_chua')::int AS cho_sua_chua,
      COUNT(*) FILTER (WHERE status_key = 'cho_bao_tri')::int AS cho_bao_tri,
      COUNT(*) FILTER (WHERE status_key = 'cho_hieu_chuan')::int AS cho_hieu_chuan,
      COUNT(*) FILTER (WHERE status_key = 'ngung_su_dung')::int AS ngung_su_dung,
      COUNT(*) FILTER (WHERE status_key = 'chua_co_nhu_cau')::int AS chua_co_nhu_cau
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
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status_key = 'hoat_dong')::int AS hoat_dong,
          COUNT(*) FILTER (WHERE status_key = 'cho_sua_chua')::int AS cho_sua_chua,
          COUNT(*) FILTER (WHERE status_key = 'cho_bao_tri')::int AS cho_bao_tri,
          COUNT(*) FILTER (WHERE status_key = 'cho_hieu_chuan')::int AS cho_hieu_chuan,
          COUNT(*) FILTER (WHERE status_key = 'ngung_su_dung')::int AS ngung_su_dung,
          COUNT(*) FILTER (WHERE status_key = 'chua_co_nhu_cau')::int AS chua_co_nhu_cau
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
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status_key = 'hoat_dong')::int AS hoat_dong,
          COUNT(*) FILTER (WHERE status_key = 'cho_sua_chua')::int AS cho_sua_chua,
          COUNT(*) FILTER (WHERE status_key = 'cho_bao_tri')::int AS cho_bao_tri,
          COUNT(*) FILTER (WHERE status_key = 'cho_hieu_chuan')::int AS cho_hieu_chuan,
          COUNT(*) FILTER (WHERE status_key = 'ngung_su_dung')::int AS ngung_su_dung,
          COUNT(*) FILTER (WHERE status_key = 'chua_co_nhu_cau')::int AS chua_co_nhu_cau
        FROM mapped
        GROUP BY location_name
        ORDER BY total DESC
      ) l
    ), '[]'::jsonb),
    'departments', COALESCE((
      SELECT jsonb_agg(name ORDER BY name)
      FROM (SELECT DISTINCT department_name AS name FROM mapped) AS dept_lookup
    ), '[]'::jsonb),
    'locations', COALESCE((
      SELECT jsonb_agg(name ORDER BY name)
      FROM (SELECT DISTINCT location_name AS name FROM mapped) AS loc_lookup
    ), '[]'::jsonb)
  )
  INTO result
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
$function$;

GRANT EXECUTE ON FUNCTION public.equipment_status_distribution(TEXT, BIGINT, TEXT, TEXT) TO authenticated;

COMMIT;
