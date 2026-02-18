-- Migration: Apply _sanitize_ilike_pattern to equipment_list, equipment_count,
--            and equipment_list_enhanced for consistent ILIKE metacharacter handling.
-- Date: 2026-02-18
--
-- Background: _sanitize_ilike_pattern() was introduced in 20260112 and correctly
-- applied to transfer_request_list, repair_request_list, transfer_request_list_enhanced,
-- and usage_log_list. The three core equipment RPCs were missed:
--
--   equipment_list (20260214140500):
--     Uses format('%L', '%' || p_q || '%') in a dynamic SQL string. format(%L)
--     prevents SQL injection but does NOT escape ILIKE metacharacters (%, _, \).
--     A search for literal "%" matches every row; "_" matches any single character.
--     Additionally, the admin → global mapping from 20260214140500 was never
--     applied to the live DB function, so admin users still fall into the
--     tenant-scoped branch. Both issues are fixed here.
--
--   equipment_count (20260218131002 / 20260218202900):
--     Uses raw p_q directly in static ILIKE expressions:
--       tb.ten_thiet_bi ILIKE ('%' || p_q || '%')
--     Same metacharacter problem as equipment_list.
--
--   equipment_list_enhanced (20260218202900):
--     Uses quote_literal('%' || p_q || '%') in dynamic SQL. quote_literal also
--     does not escape ILIKE metacharacters. Replaced with _sanitize_ilike_pattern
--     and the pattern is built outside the dynamic SQL string.

BEGIN;

-- ============================================================================
-- Fix equipment_list: add _sanitize_ilike_pattern + admin → global mapping
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_list(
  p_q text DEFAULT NULL::text,
  p_sort text DEFAULT 'id.asc'::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_don_vi bigint DEFAULT NULL::bigint
)
RETURNS SETOF thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_offset INT := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1);
  v_sql TEXT;
  v_sanitized_q TEXT;
BEGIN
  -- Map admin → global for consistency with equipment_get / equipment_count
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  IF v_effective IS NOT NULL AND array_length(v_effective, 1) IS NULL THEN
    RETURN;
  END IF;

  v_sort_col := split_part(p_sort, '.', 1);
  v_sort_dir := CASE LOWER(split_part(p_sort, '.', 2)) WHEN 'desc' THEN 'DESC' ELSE 'ASC' END;
  IF v_sort_col NOT IN (
    'id','ten_thiet_bi','ma_thiet_bi','khoa_phong_quan_ly','don_vi','tinh_trang_hien_tai','phan_loai_theo_nd98','model','serial'
  ) THEN
    v_sort_col := 'id';
  END IF;

  -- Sanitize ILIKE metacharacters (%, _, \) before embedding in pattern
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  v_sql := 'SELECT * FROM public.thiet_bi WHERE is_deleted = false';
  IF v_effective IS NOT NULL THEN
    v_sql := v_sql || format(' AND don_vi = ANY(%L::BIGINT[])', v_effective);
  END IF;

  IF v_sanitized_q IS NOT NULL THEN
    v_sql := v_sql || format(' AND (ten_thiet_bi ILIKE %L OR ma_thiet_bi ILIKE %L)',
      '%' || v_sanitized_q || '%', '%' || v_sanitized_q || '%');
  END IF;

  v_sql := v_sql || format(' ORDER BY %I %s OFFSET %s LIMIT %s', v_sort_col, v_sort_dir, v_offset, GREATEST(p_page_size, 1));

  RETURN QUERY EXECUTE v_sql;
END;
$function$;

-- ============================================================================
-- Fix equipment_count: add _sanitize_ilike_pattern
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_count(
  p_statuses text[] DEFAULT NULL::text[],
  p_q text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role    TEXT     := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_cnt     BIGINT;
  v_sanitized_q TEXT;
BEGIN
  -- Map admin → global for consistency with equipment_get / equipment_list
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  -- Sanitize ILIKE metacharacters (%, _, \) before embedding in pattern
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  IF v_role = 'global' THEN
    SELECT COUNT(*) INTO v_cnt
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false
      AND (v_sanitized_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || v_sanitized_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || v_sanitized_q || '%'))
      AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN 0;
    END IF;

    SELECT COUNT(*) INTO v_cnt
    FROM public.thiet_bi tb
    WHERE tb.don_vi = ANY(v_allowed)
      AND tb.is_deleted = false
      AND (v_sanitized_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || v_sanitized_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || v_sanitized_q || '%'))
      AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));
  END IF;

  RETURN COALESCE(v_cnt, 0);
END;
$function$;

-- ============================================================================
-- Fix equipment_list_enhanced: replace quote_literal with _sanitize_ilike_pattern
-- ============================================================================

DROP FUNCTION IF EXISTS public.equipment_list_enhanced(
  TEXT, TEXT, INT, INT, BIGINT,
  TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[],
  TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[],
  TEXT  -- p_fields (old overload)
);

CREATE OR REPLACE FUNCTION public.equipment_list_enhanced(
  p_q text DEFAULT NULL::text,
  p_sort text DEFAULT 'id.asc'::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_khoa_phong text DEFAULT NULL::text,
  p_khoa_phong_array text[] DEFAULT NULL::text[],
  p_nguoi_su_dung text DEFAULT NULL::text,
  p_nguoi_su_dung_array text[] DEFAULT NULL::text[],
  p_vi_tri_lap_dat text DEFAULT NULL::text,
  p_vi_tri_lap_dat_array text[] DEFAULT NULL::text[],
  p_tinh_trang text DEFAULT NULL::text,
  p_tinh_trang_array text[] DEFAULT NULL::text[],
  p_phan_loai text DEFAULT NULL::text,
  p_phan_loai_array text[] DEFAULT NULL::text[],
  p_nguon_kinh_phi text DEFAULT NULL::text,
  p_nguon_kinh_phi_array text[] DEFAULT NULL::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := '';
  v_claim_donvi BIGINT := NULL;
  v_allowed_don_vi BIGINT[];
  v_effective_donvi BIGINT := NULL;
  v_sort_col TEXT := 'id';
  v_sort_dir TEXT := 'ASC';
  v_limit INT := GREATEST(p_page_size, 1);
  v_offset INT := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1);
  v_where TEXT := '1=1 AND is_deleted = false';
  v_total BIGINT := 0;
  v_data JSONB := '[]'::jsonb;
  v_jwt_claims JSONB;
  v_sanitized_q TEXT;
BEGIN
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;

  v_role := COALESCE(
    v_jwt_claims ->>'app_role',
    v_jwt_claims ->>'role',
    ''
  );
  v_claim_donvi := NULLIF(v_jwt_claims ->>'don_vi', '')::BIGINT;

  IF p_sort IS NOT NULL AND p_sort != '' THEN
    v_sort_col := split_part(p_sort, '.', 1);
    v_sort_dir := UPPER(COALESCE(NULLIF(split_part(p_sort, '.', 2), ''), 'ASC'));
    IF v_sort_dir NOT IN ('ASC', 'DESC') THEN
      v_sort_dir := 'ASC';
    END IF;
    IF v_sort_col NOT IN (
      'id', 'ma_thiet_bi', 'ten_thiet_bi', 'model', 'serial',
      'khoa_phong_quan_ly', 'tinh_trang_hien_tai', 'vi_tri_lap_dat',
      'nguoi_dang_truc_tiep_quan_ly', 'phan_loai_theo_nd98', 'nguon_kinh_phi', 'don_vi',
      'gia_goc', 'ngay_nhap', 'ngay_dua_vao_su_dung', 'ngay_bt_tiep_theo',
      'so_luu_hanh'
    ) THEN
      v_sort_col := 'id';
    END IF;
  END IF;

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF lower(v_role) IN ('global', 'admin') THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective_donvi := p_don_vi;
    ELSE
      v_effective_donvi := NULL;
    END IF;
  ELSE
    IF v_allowed_don_vi IS NOT NULL AND array_length(v_allowed_don_vi, 1) > 0 THEN
      IF p_don_vi IS NOT NULL THEN
        IF p_don_vi = ANY(v_allowed_don_vi) THEN
          v_effective_donvi := p_don_vi;
        ELSE
          RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'pageSize', p_page_size, 'error', 'Access denied for tenant');
        END IF;
      ELSE
        v_effective_donvi := NULL;
      END IF;
    ELSE
      RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'pageSize', p_page_size, 'error', 'No tenant access');
    END IF;
  END IF;

  IF v_effective_donvi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ' || v_effective_donvi;
  END IF;

  IF v_effective_donvi IS NULL AND lower(v_role) NOT IN ('global', 'admin') AND v_allowed_don_vi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ANY(ARRAY[' || array_to_string(v_allowed_don_vi, ',') || '])';
  END IF;

  IF p_khoa_phong_array IS NOT NULL AND array_length(p_khoa_phong_array, 1) > 0 THEN
    v_where := v_where || ' AND khoa_phong_quan_ly = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_khoa_phong_array) AS x), ',') || '])';
  ELSIF p_khoa_phong IS NOT NULL AND trim(p_khoa_phong) != '' THEN
    v_where := v_where || ' AND khoa_phong_quan_ly = ' || quote_literal(p_khoa_phong);
  END IF;

  IF p_nguoi_su_dung_array IS NOT NULL AND array_length(p_nguoi_su_dung_array, 1) > 0 THEN
    v_where := v_where || ' AND nguoi_dang_truc_tiep_quan_ly = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_nguoi_su_dung_array) AS x), ',') || '])';
  ELSIF p_nguoi_su_dung IS NOT NULL AND trim(p_nguoi_su_dung) != '' THEN
    v_where := v_where || ' AND nguoi_dang_truc_tiep_quan_ly = ' || quote_literal(p_nguoi_su_dung);
  END IF;

  IF p_vi_tri_lap_dat_array IS NOT NULL AND array_length(p_vi_tri_lap_dat_array, 1) > 0 THEN
    v_where := v_where || ' AND vi_tri_lap_dat = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_vi_tri_lap_dat_array) AS x), ',') || '])';
  ELSIF p_vi_tri_lap_dat IS NOT NULL AND trim(p_vi_tri_lap_dat) != '' THEN
    v_where := v_where || ' AND vi_tri_lap_dat = ' || quote_literal(p_vi_tri_lap_dat);
  END IF;

  IF p_tinh_trang_array IS NOT NULL AND array_length(p_tinh_trang_array, 1) > 0 THEN
    v_where := v_where || ' AND tinh_trang_hien_tai = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_tinh_trang_array) AS x), ',') || '])';
  ELSIF p_tinh_trang IS NOT NULL AND trim(p_tinh_trang) != '' THEN
    v_where := v_where || ' AND tinh_trang_hien_tai = ' || quote_literal(p_tinh_trang);
  END IF;

  IF p_phan_loai_array IS NOT NULL AND array_length(p_phan_loai_array, 1) > 0 THEN
    v_where := v_where || ' AND phan_loai_theo_nd98 = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_phan_loai_array) AS x), ',') || '])';
  ELSIF p_phan_loai IS NOT NULL AND trim(p_phan_loai) != '' THEN
    v_where := v_where || ' AND phan_loai_theo_nd98 = ' || quote_literal(p_phan_loai);
  END IF;

  IF p_nguon_kinh_phi_array IS NOT NULL AND array_length(p_nguon_kinh_phi_array, 1) > 0 THEN
    IF 'Chưa có' = ANY(p_nguon_kinh_phi_array) THEN
      DECLARE v_non_empty_sources TEXT[];
      BEGIN
        SELECT ARRAY(SELECT x FROM unnest(p_nguon_kinh_phi_array) AS x WHERE x != 'Chưa có') INTO v_non_empty_sources;
        IF v_non_empty_sources IS NOT NULL AND array_length(v_non_empty_sources, 1) > 0 THEN
          v_where := v_where || ' AND (nguon_kinh_phi IS NULL OR TRIM(nguon_kinh_phi) = '''' OR TRIM(nguon_kinh_phi) = ANY(ARRAY[' ||
            array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(v_non_empty_sources) AS x), ',') || ']))';
        ELSE
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

  -- Sanitize ILIKE metacharacters (%, _, \) before embedding in pattern.
  -- _sanitize_ilike_pattern returns NULL for NULL/empty input, so the IS NOT NULL
  -- guard below correctly skips the search clause when p_q is absent.
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  IF v_sanitized_q IS NOT NULL THEN
    v_where := v_where || ' AND (ten_thiet_bi ILIKE ' || quote_literal('%' || v_sanitized_q || '%') ||
              ' OR ma_thiet_bi ILIKE ' || quote_literal('%' || v_sanitized_q || '%') ||
              ' OR serial ILIKE ' || quote_literal('%' || v_sanitized_q || '%') ||
              ' OR so_luu_hanh ILIKE ' || quote_literal('%' || v_sanitized_q || '%') || ')';
  END IF;

  EXECUTE format('SELECT count(*) FROM public.thiet_bi WHERE %s', v_where) INTO v_total;

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
$function$;

GRANT EXECUTE ON FUNCTION public.equipment_list(TEXT, TEXT, INT, INT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_count(TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_list_enhanced(
  TEXT, TEXT, INT, INT, BIGINT, TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[]
) TO authenticated;

COMMIT;
