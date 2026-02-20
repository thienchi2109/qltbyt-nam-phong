-- Migration: Exclude soft-deleted equipment from report inventory RPCs
-- Date: 2026-02-13
-- Scope: Task 4 report reads

BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_list_for_reports(
  p_q text DEFAULT NULL::text,
  p_sort text DEFAULT 'id.asc'::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 10000,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_khoa_phong text DEFAULT NULL::text
)
RETURNS SETOF public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_allowed bigint[];
  v_effective_donvi bigint;
  v_sort_col text;
  v_sort_dir text;
  v_offset int;
BEGIN
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
    ELSE
      v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
      IF v_effective_donvi IS NULL THEN
        RETURN;
      END IF;
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

  v_sort_col := split_part(p_sort, '.', 1);
  v_sort_dir := CASE lower(split_part(p_sort, '.', 2)) WHEN 'desc' THEN 'DESC' ELSE 'ASC' END;
  IF v_sort_col NOT IN ('id', 'ten_thiet_bi', 'ma_thiet_bi', 'khoa_phong_quan_ly', 'don_vi') THEN
    v_sort_col := 'id';
  END IF;
  v_offset := GREATEST((p_page - 1), 0) * GREATEST(p_page_size, 1);

  RETURN QUERY EXECUTE format(
    'SELECT * FROM public.thiet_bi
     WHERE is_deleted = false
       AND ($1::bigint IS NULL OR don_vi = $1)
       AND ($2::text IS NULL OR khoa_phong_quan_ly = $2)
       AND ($3::text IS NULL OR ten_thiet_bi ILIKE $5 OR ma_thiet_bi ILIKE $5)
     ORDER BY %I %s
     OFFSET $4 LIMIT $6',
    v_sort_col,
    v_sort_dir
  ) USING v_effective_donvi, p_khoa_phong, p_q, v_offset, ('%' || COALESCE(p_q, '') || '%'), p_page_size;
END;
$function$;

CREATE OR REPLACE FUNCTION public.equipment_count_enhanced(
  p_statuses text[] DEFAULT NULL::text[],
  p_q text DEFAULT NULL::text,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_khoa_phong text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_allowed bigint[];
  v_effective_donvi bigint;
  v_cnt bigint;
BEGIN
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN 0;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
    ELSE
      v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
      IF v_effective_donvi IS NULL THEN
        RETURN 0;
      END IF;
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

  SELECT COUNT(*)
  INTO v_cnt
  FROM public.thiet_bi tb
  WHERE tb.is_deleted = false
    AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
    AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
    AND (p_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || p_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || p_q || '%'))
    AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));

  RETURN COALESCE(v_cnt, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.departments_list_for_facilities(p_don_vi_array bigint[] DEFAULT NULL::bigint[])
RETURNS TABLE(name text, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_allowed bigint[];
  v_facilities_to_query bigint[];
  v_single_don_vi bigint;
BEGIN
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role IN ('global', 'admin') THEN
    IF p_don_vi_array IS NULL OR array_length(p_don_vi_array, 1) IS NULL THEN
      v_facilities_to_query := NULL;
    ELSE
      v_facilities_to_query := p_don_vi_array;
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi_array IS NULL OR array_length(p_don_vi_array, 1) IS NULL THEN
      v_facilities_to_query := v_allowed;
    ELSE
      SELECT ARRAY_AGG(fid)
      INTO v_facilities_to_query
      FROM UNNEST(p_don_vi_array) AS fid
      WHERE fid = ANY(v_allowed);

      IF v_facilities_to_query IS NULL OR array_length(v_facilities_to_query, 1) IS NULL THEN
        RAISE EXCEPTION 'Access denied to requested facilities' USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSE
    v_single_don_vi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
    IF v_single_don_vi IS NULL THEN
      RETURN;
    END IF;
    v_facilities_to_query := ARRAY[v_single_don_vi];
  END IF;

  RETURN QUERY
  SELECT
    tb.khoa_phong_quan_ly AS name,
    COUNT(*) AS count
  FROM public.thiet_bi tb
  WHERE tb.is_deleted = false
    AND (v_facilities_to_query IS NULL OR tb.don_vi = ANY(v_facilities_to_query))
    AND tb.khoa_phong_quan_ly IS NOT NULL
    AND tb.khoa_phong_quan_ly != ''
  GROUP BY tb.khoa_phong_quan_ly
  ORDER BY tb.khoa_phong_quan_ly;
END;
$function$;

CREATE OR REPLACE FUNCTION public.equipment_aggregates_for_reports(
  p_don_vi_array bigint[] DEFAULT NULL::bigint[],
  p_khoa_phong text DEFAULT NULL::text,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_allowed bigint[];
  v_facilities_to_query bigint[];
  v_total_imported bigint := 0;
  v_total_exported bigint := 0;
  v_current_stock bigint := 0;
  v_result jsonb;
  v_from_ts timestamptz;
  v_to_ts_excl timestamptz;
  v_single_don_vi bigint;
BEGIN
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();

  IF p_khoa_phong IS NOT NULL AND btrim(p_khoa_phong) = '' THEN
    p_khoa_phong := NULL;
  END IF;

  IF p_date_from IS NOT NULL THEN
    v_from_ts := (p_date_from)::timestamptz;
  END IF;
  IF p_date_to IS NOT NULL THEN
    v_to_ts_excl := ((p_date_to + 1))::timestamptz;
  END IF;

  IF v_role IN ('global', 'admin') THEN
    IF p_don_vi_array IS NULL OR array_length(p_don_vi_array, 1) IS NULL THEN
      v_facilities_to_query := NULL;
    ELSE
      v_facilities_to_query := p_don_vi_array;
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object('totalImported', 0, 'totalExported', 0, 'currentStock', 0, 'netChange', 0);
    END IF;

    IF p_don_vi_array IS NULL OR array_length(p_don_vi_array, 1) IS NULL THEN
      v_facilities_to_query := v_allowed;
    ELSE
      SELECT ARRAY_AGG(fid)
      INTO v_facilities_to_query
      FROM UNNEST(p_don_vi_array) AS fid
      WHERE fid = ANY(v_allowed);

      IF v_facilities_to_query IS NULL OR array_length(v_facilities_to_query, 1) IS NULL THEN
        RAISE EXCEPTION 'Access denied to requested facilities' USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSE
    v_single_don_vi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
    IF v_single_don_vi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for role %', v_role USING ERRCODE = '42501';
    END IF;
    v_facilities_to_query := ARRAY[v_single_don_vi];
  END IF;

  IF v_facilities_to_query IS NULL THEN
    SELECT COUNT(*)
    INTO v_total_imported
    FROM public.thiet_bi tb
    WHERE (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND (v_from_ts IS NULL OR tb.created_at >= v_from_ts)
      AND (v_to_ts_excl IS NULL OR tb.created_at < v_to_ts_excl);
  ELSE
    SELECT COUNT(*)
    INTO v_total_imported
    FROM public.thiet_bi tb
    WHERE tb.don_vi = ANY(v_facilities_to_query)
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND (v_from_ts IS NULL OR tb.created_at >= v_from_ts)
      AND (v_to_ts_excl IS NULL OR tb.created_at < v_to_ts_excl);
  END IF;

  IF v_facilities_to_query IS NULL THEN
    SELECT COUNT(DISTINCT ylc.thiet_bi_id)
    INTO v_total_exported
    FROM public.yeu_cau_luan_chuyen ylc
    INNER JOIN public.thiet_bi tb ON ylc.thiet_bi_id = tb.id
    WHERE (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND ylc.trang_thai IN ('da_ban_giao', 'hoan_thanh')
      AND (
        (
          ylc.loai_hinh IN ('noi_bo', 'ben_ngoai')
          AND ylc.ngay_ban_giao IS NOT NULL
          AND (v_from_ts IS NULL OR ylc.ngay_ban_giao >= v_from_ts)
          AND (v_to_ts_excl IS NULL OR ylc.ngay_ban_giao < v_to_ts_excl)
        ) OR (
          ylc.muc_dich = 'thanh_ly'
          AND ylc.ngay_hoan_thanh IS NOT NULL
          AND (v_from_ts IS NULL OR ylc.ngay_hoan_thanh >= v_from_ts)
          AND (v_to_ts_excl IS NULL OR ylc.ngay_hoan_thanh < v_to_ts_excl)
        )
      );
  ELSE
    SELECT COUNT(DISTINCT ylc.thiet_bi_id)
    INTO v_total_exported
    FROM public.yeu_cau_luan_chuyen ylc
    INNER JOIN public.thiet_bi tb ON ylc.thiet_bi_id = tb.id
    WHERE tb.don_vi = ANY(v_facilities_to_query)
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND ylc.trang_thai IN ('da_ban_giao', 'hoan_thanh')
      AND (
        (
          ylc.loai_hinh IN ('noi_bo', 'ben_ngoai')
          AND ylc.ngay_ban_giao IS NOT NULL
          AND (v_from_ts IS NULL OR ylc.ngay_ban_giao >= v_from_ts)
          AND (v_to_ts_excl IS NULL OR ylc.ngay_ban_giao < v_to_ts_excl)
        ) OR (
          ylc.muc_dich = 'thanh_ly'
          AND ylc.ngay_hoan_thanh IS NOT NULL
          AND (v_from_ts IS NULL OR ylc.ngay_hoan_thanh >= v_from_ts)
          AND (v_to_ts_excl IS NULL OR ylc.ngay_hoan_thanh < v_to_ts_excl)
        )
      );
  END IF;

  IF v_facilities_to_query IS NULL THEN
    SELECT COUNT(*)
    INTO v_current_stock
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong);
  ELSE
    SELECT COUNT(*)
    INTO v_current_stock
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false
      AND tb.don_vi = ANY(v_facilities_to_query)
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong);
  END IF;

  v_result := jsonb_build_object(
    'totalImported', COALESCE(v_total_imported, 0),
    'totalExported', COALESCE(v_total_exported, 0),
    'currentStock', COALESCE(v_current_stock, 0),
    'netChange', COALESCE(v_total_imported, 0) - COALESCE(v_total_exported, 0)
  );

  RETURN v_result;
END;
$function$;

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

  IF p_q IS NOT NULL AND length(trim(p_q)) > 0 THEN
    v_search := '%' || trim(p_q) || '%';
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

CREATE OR REPLACE FUNCTION public.equipment_status_distribution(
  p_don_vi bigint DEFAULT NULL::bigint,
  p_khoa_phong text DEFAULT NULL::text,
  p_vi_tri text DEFAULT NULL::text
)
RETURNS TABLE(tinh_trang text, so_luong bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_allowed bigint[];
  v_effective_donvi bigint;
BEGIN
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
    ELSE
      RETURN;
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

  RETURN QUERY
  SELECT
    COALESCE(NULLIF(TRIM(tb.tinh_trang_hien_tai), ''), U&'Kh\00F4ng x\00E1c \0111\1ECBnh') AS tinh_trang,
    COUNT(tb.id)::bigint AS so_luong
  FROM public.thiet_bi tb
  WHERE tb.is_deleted = false
    AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
    AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
    AND (p_vi_tri IS NULL OR tb.vi_tri_lap_dat = p_vi_tri)
  GROUP BY COALESCE(NULLIF(TRIM(tb.tinh_trang_hien_tai), ''), U&'Kh\00F4ng x\00E1c \0111\1ECBnh')
  ORDER BY so_luong DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.equipment_list_for_reports(TEXT, TEXT, INT, INT, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_count_enhanced(TEXT[], TEXT, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.departments_list_for_facilities(BIGINT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_aggregates_for_reports(BIGINT[], TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_status_distribution(TEXT, BIGINT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_status_distribution(BIGINT, TEXT, TEXT) TO authenticated;

COMMIT;
