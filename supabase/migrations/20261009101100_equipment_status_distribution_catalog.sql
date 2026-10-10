-- Catalog-aware JSON distribution overload.
BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_status_distribution(p_q text DEFAULT NULL::text, p_don_vi bigint DEFAULT NULL::bigint, p_khoa_phong text DEFAULT NULL::text, p_vi_tri text DEFAULT NULL::text)
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
  v_catalog jsonb;
  v_status_keys jsonb;
  v_empty_counts jsonb;
BEGIN
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();
  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.display_order), '[]'::jsonb),
    COALESCE(jsonb_object_agg(c.status_value, CASE c.status_value
      WHEN 'Hoạt động' THEN 'hoat_dong'
      WHEN 'Chờ sửa chữa' THEN 'cho_sua_chua'
      WHEN 'Chờ bảo trì' THEN 'cho_bao_tri'
      WHEN 'Chờ hiệu chuẩn/kiểm định' THEN 'cho_hieu_chuan'
      WHEN 'Ngưng sử dụng' THEN 'ngung_su_dung'
      WHEN 'Chưa có nhu cầu sử dụng' THEN 'chua_co_nhu_cau'
      ELSE c.status_value END), '{}'::jsonb)
  INTO v_catalog, v_status_keys FROM public.equipment_status_catalog c;
  SELECT COALESCE(jsonb_object_agg(k.value, 0), '{}'::jsonb) || '{"khac":0}'::jsonb
  INTO v_empty_counts
  FROM jsonb_each_text(v_status_keys) k
  JOIN public.equipment_status_catalog c ON c.status_value = k.key
  WHERE c.is_active OR k.value IN ('hoat_dong', 'cho_sua_chua', 'cho_bao_tri', 'cho_hieu_chuan', 'ngung_su_dung', 'chua_co_nhu_cau');

  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object(
        'total_equipment', 0,
        'status_counts', v_empty_counts,
        'by_department', '[]'::jsonb,
        'by_location', '[]'::jsonb,
        'departments', '[]'::jsonb,
        'locations', '[]'::jsonb
      ) || jsonb_build_object('status_catalog', v_catalog);
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
        'status_counts', v_empty_counts,
        'by_department', '[]'::jsonb,
        'by_location', '[]'::jsonb,
        'departments', '[]'::jsonb,
        'locations', '[]'::jsonb
      ) || jsonb_build_object('status_catalog', v_catalog);
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
  ), catalog_keys AS (
    SELECT c.status_value, c.is_active, v_status_keys->>c.status_value AS status_key
    FROM public.equipment_status_catalog c
  ), mapped AS (
    SELECT f.*, COALESCE(c.status_key, 'khac') AS status_key
    FROM filtered f LEFT JOIN catalog_keys c ON c.status_value = f.raw_status
  ), totals AS (
    SELECT
      COUNT(*)::int AS total_equipment,
      COUNT(*) FILTER (WHERE status_key = 'hoat_dong')::int AS hoat_dong,
      COUNT(*) FILTER (WHERE status_key = 'cho_sua_chua')::int AS cho_sua_chua,
      COUNT(*) FILTER (WHERE status_key = 'cho_bao_tri')::int AS cho_bao_tri,
      COUNT(*) FILTER (WHERE status_key = 'cho_hieu_chuan')::int AS cho_hieu_chuan,
      COUNT(*) FILTER (WHERE status_key = 'ngung_su_dung')::int AS ngung_su_dung,
      COUNT(*) FILTER (WHERE status_key = 'chua_co_nhu_cau')::int AS chua_co_nhu_cau,
      COUNT(*) FILTER (WHERE status_key = 'Thanh lý nội bộ')::int AS thanh_ly_noi_bo,
      COUNT(*) FILTER (WHERE status_key = 'khac')::int AS khac
    FROM mapped
  )
  SELECT jsonb_build_object(
    'total_equipment', totals.total_equipment,
    'status_counts', COALESCE((
      SELECT jsonb_object_agg(k.status_key, COALESCE(counts.total, 0))
      FROM (SELECT status_key, is_active FROM catalog_keys
        UNION ALL SELECT 'khac', true) k
      LEFT JOIN (SELECT status_key, COUNT(*)::int AS total FROM mapped GROUP BY status_key) counts
        ON counts.status_key = k.status_key
      WHERE k.is_active OR COALESCE(counts.total, 0) > 0 OR k.status_key IN ('hoat_dong', 'cho_sua_chua', 'cho_bao_tri', 'cho_hieu_chuan', 'ngung_su_dung', 'chua_co_nhu_cau')
    ), '{}'::jsonb),
    'by_department', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', d.department_name, 'total', d.total)
        || COALESCE((
          SELECT jsonb_object_agg(k.status_key, COALESCE(counts.total, 0))
          FROM (SELECT status_key, is_active FROM catalog_keys UNION ALL SELECT 'khac', true) k
          LEFT JOIN (SELECT status_key, COUNT(*)::int AS total FROM mapped
            WHERE department_name = d.department_name GROUP BY status_key) counts ON counts.status_key = k.status_key
          WHERE k.is_active OR COALESCE(counts.total, 0) > 0 OR k.status_key IN ('hoat_dong', 'cho_sua_chua', 'cho_bao_tri', 'cho_hieu_chuan', 'ngung_su_dung', 'chua_co_nhu_cau')
        ), '{}'::jsonb) ORDER BY d.total DESC)
      FROM (SELECT department_name, COUNT(*)::int AS total FROM mapped GROUP BY department_name) d
    ), '[]'::jsonb),
    'by_location', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', l.location_name, 'total', l.total)
        || COALESCE((
          SELECT jsonb_object_agg(k.status_key, COALESCE(counts.total, 0))
          FROM (SELECT status_key, is_active FROM catalog_keys UNION ALL SELECT 'khac', true) k
          LEFT JOIN (SELECT status_key, COUNT(*)::int AS total FROM mapped
            WHERE location_name = l.location_name GROUP BY status_key) counts ON counts.status_key = k.status_key
          WHERE k.is_active OR COALESCE(counts.total, 0) > 0 OR k.status_key IN ('hoat_dong', 'cho_sua_chua', 'cho_bao_tri', 'cho_hieu_chuan', 'ngung_su_dung', 'chua_co_nhu_cau')
        ), '{}'::jsonb) ORDER BY l.total DESC)
      FROM (SELECT location_name, COUNT(*)::int AS total FROM mapped GROUP BY location_name) l
    ), '[]'::jsonb),
    'departments', COALESCE((
      SELECT jsonb_agg(name ORDER BY name)
      FROM (SELECT DISTINCT department_name AS name FROM mapped) AS dept_lookup
    ), '[]'::jsonb),
    'status_catalog', v_catalog,
    'locations', COALESCE((
      SELECT jsonb_agg(name ORDER BY name)
      FROM (SELECT DISTINCT location_name AS name FROM mapped) AS loc_lookup
    ), '[]'::jsonb)
  )
  INTO result
  FROM totals;

  RETURN COALESCE(result, jsonb_build_object(
    'total_equipment', 0,
    'status_counts', v_empty_counts,
    'by_department', '[]'::jsonb,
    'by_location', '[]'::jsonb,
    'departments', '[]'::jsonb,
    'locations', '[]'::jsonb
  )) || jsonb_build_object('status_catalog', v_catalog);
END;
$function$;
COMMIT;
