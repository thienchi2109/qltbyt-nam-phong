-- Final consolidated migration for Reports export
-- - Equipment status distribution (tenant/department/location)
-- - Maintenance/Repairs stats for reports (tenant/department + date range)
-- - Cleans up old overloads

BEGIN;

-- Helper: get JWT claim
CREATE OR REPLACE FUNCTION public._get_jwt_claim(claim TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> claim, NULL);
$$;

-- Equipment status distribution (idempotent)
CREATE OR REPLACE FUNCTION public.equipment_status_distribution(
  p_q TEXT DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL,
  p_khoa_phong TEXT DEFAULT NULL,
  p_vi_tri TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
  v_search TEXT := NULL;
  result JSONB;
BEGIN
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_effective_donvi := v_claim_donvi;
  END IF;

  IF p_q IS NOT NULL AND length(trim(p_q)) > 0 THEN
    v_search := '%' || trim(p_q) || '%';
  END IF;

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

-- Maintenance & Repairs stats (idempotent)
CREATE OR REPLACE FUNCTION public.maintenance_stats_for_reports(
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL,
  p_khoa_phong TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
  result JSONB;
  v_from DATE := COALESCE(p_date_from, CURRENT_DATE - INTERVAL '1 year');
  v_to DATE := COALESCE(p_date_to, CURRENT_DATE);
  v_from_year INT := EXTRACT(YEAR FROM v_from)::INT;
  v_to_year INT := EXTRACT(YEAR FROM v_to)::INT;
BEGIN
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := p_don_vi; -- NULL => all
  ELSE
    v_effective_donvi := v_claim_donvi;
  END IF;

  SELECT jsonb_build_object(
    'repair_summary', (
      SELECT jsonb_build_object(
        'total_requests', COUNT(*),
        'completed', COUNT(*) FILTER (WHERE yc.trang_thai = 'hoan_thanh'),
        'pending', COUNT(*) FILTER (WHERE yc.trang_thai = 'cho_duyet'),
        'in_progress', COUNT(*) FILTER (WHERE yc.trang_thai = 'dang_xu_ly')
      )
      FROM public.yeu_cau_sua_chua yc
      LEFT JOIN public.thiet_bi tb ON yc.thiet_bi_id = tb.id
      WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
        AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
        AND COALESCE(yc.ngay_yeu_cau, yc.ngay_duyet, yc.ngay_hoan_thanh)::date BETWEEN v_from AND v_to
    ),
    'maintenance_summary', (
      SELECT jsonb_build_object(
        'total_plans', COUNT(DISTINCT kh.id),
        'total_tasks', COUNT(cv.id),
        'completed_tasks', COUNT(*) FILTER (
          WHERE
            COALESCE(cv.thang_1_hoan_thanh,false) OR COALESCE(cv.thang_2_hoan_thanh,false) OR
            COALESCE(cv.thang_3_hoan_thanh,false) OR COALESCE(cv.thang_4_hoan_thanh,false) OR
            COALESCE(cv.thang_5_hoan_thanh,false) OR COALESCE(cv.thang_6_hoan_thanh,false) OR
            COALESCE(cv.thang_7_hoan_thanh,false) OR COALESCE(cv.thang_8_hoan_thanh,false) OR
            COALESCE(cv.thang_9_hoan_thanh,false) OR COALESCE(cv.thang_10_hoan_thanh,false) OR
            COALESCE(cv.thang_11_hoan_thanh,false) OR COALESCE(cv.thang_12_hoan_thanh,false) OR
            cv.ngay_hoan_thanh_1 IS NOT NULL OR cv.ngay_hoan_thanh_2 IS NOT NULL OR
            cv.ngay_hoan_thanh_3 IS NOT NULL OR cv.ngay_hoan_thanh_4 IS NOT NULL OR
            cv.ngay_hoan_thanh_5 IS NOT NULL OR cv.ngay_hoan_thanh_6 IS NOT NULL OR
            cv.ngay_hoan_thanh_7 IS NOT NULL OR cv.ngay_hoan_thanh_8 IS NOT NULL OR
            cv.ngay_hoan_thanh_9 IS NOT NULL OR cv.ngay_hoan_thanh_10 IS NOT NULL OR
            cv.ngay_hoan_thanh_11 IS NOT NULL OR cv.ngay_hoan_thanh_12 IS NOT NULL
        )
      )
      FROM public.ke_hoach_bao_tri kh
      LEFT JOIN public.cong_viec_bao_tri cv ON kh.id = cv.ke_hoach_id
      LEFT JOIN public.thiet_bi tb ON cv.thiet_bi_id = tb.id
      WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
        AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
        AND (kh.nam BETWEEN v_from_year AND v_to_year)
    )
  ) INTO result;

  RETURN COALESCE(result, jsonb_build_object(
    'repair_summary', jsonb_build_object(
      'total_requests', 0,
      'completed', 0,
      'pending', 0,
      'in_progress', 0
    ),
    'maintenance_summary', jsonb_build_object(
      'total_plans', 0,
      'total_tasks', 0,
      'completed_tasks', 0
    )
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_stats_for_reports(DATE, DATE, BIGINT, TEXT) TO authenticated;

-- Clean up old overload if present
DROP FUNCTION IF EXISTS public.maintenance_stats_enhanced(DATE, DATE, BIGINT);

COMMIT;

