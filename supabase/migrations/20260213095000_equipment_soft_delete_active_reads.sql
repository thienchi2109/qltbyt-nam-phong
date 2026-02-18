-- Migration: Exclude soft-deleted equipment from core and dashboard reads
-- Date: 2026-02-13
-- Scope: Task 3 active-only read surfaces

BEGIN;

-- ============================================================================
-- Core equipment reads
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_get(p_id bigint)
RETURNS thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  rec public.thiet_bi;
BEGIN
  IF v_role = 'global' THEN
    SELECT * INTO rec
    FROM public.thiet_bi
    WHERE id = p_id
      AND is_deleted = false;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO rec
    FROM public.thiet_bi
    WHERE id = p_id
      AND don_vi = ANY(v_allowed)
      AND is_deleted = false;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '42501';
  END IF;

  RETURN rec;
END;
$function$;

CREATE OR REPLACE FUNCTION public.equipment_get_by_code(p_ma_thiet_bi text)
RETURNS thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role TEXT := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  rec public.thiet_bi;
BEGIN
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF p_ma_thiet_bi IS NULL OR trim(p_ma_thiet_bi) = '' THEN
    RAISE EXCEPTION 'ma_thiet_bi_required' USING ERRCODE = '22023';
  END IF;

  IF v_role = 'global' THEN
    SELECT *
      INTO rec
    FROM public.thiet_bi
    WHERE lower(ma_thiet_bi) = lower(p_ma_thiet_bi)
      AND is_deleted = false
    LIMIT 1;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '42501';
    END IF;

    SELECT *
      INTO rec
    FROM public.thiet_bi
    WHERE lower(ma_thiet_bi) = lower(p_ma_thiet_bi)
      AND don_vi = ANY(v_allowed)
      AND is_deleted = false
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '42501';
  END IF;

  RETURN rec;
END;
$function$;

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
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_offset INT := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1);
  v_sql TEXT;
BEGIN
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

  v_sql := 'SELECT * FROM public.thiet_bi WHERE is_deleted = false';
  IF v_effective IS NOT NULL THEN
    v_sql := v_sql || format(' AND don_vi = ANY(%L::BIGINT[])', v_effective);
  END IF;

  IF p_q IS NOT NULL AND trim(p_q) <> '' THEN
    v_sql := v_sql || format(' AND (ten_thiet_bi ILIKE %L OR ma_thiet_bi ILIKE %L)',
      '%' || p_q || '%', '%' || p_q || '%');
  END IF;

  v_sql := v_sql || format(' ORDER BY %I %s OFFSET %s LIMIT %s', v_sort_col, v_sort_dir, v_offset, GREATEST(p_page_size, 1));

  RETURN QUERY EXECUTE v_sql;
END;
$function$;

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
  p_nguon_kinh_phi_array text[] DEFAULT NULL::text[],
  -- p_fields removed: parameter was accepted but never used (query always returns to_jsonb(tb.*))
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
  -- v_fields removed: was never referenced in the dynamic query
  v_jwt_claims JSONB;
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

  IF lower(v_role) = 'global' THEN
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

  IF v_effective_donvi IS NULL AND lower(v_role) <> 'global' AND v_allowed_don_vi IS NOT NULL THEN
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

  IF p_q IS NOT NULL AND trim(p_q) != '' THEN
    v_where := v_where || ' AND (ten_thiet_bi ILIKE ' || quote_literal('%' || p_q || '%') ||
              ' OR ma_thiet_bi ILIKE ' || quote_literal('%' || p_q || '%') ||
              ' OR serial ILIKE ' || quote_literal('%' || p_q || '%') ||
              ' OR so_luu_hanh ILIKE ' || quote_literal('%' || p_q || '%') || ')';
  END IF;

  EXECUTE format('SELECT count(*) FROM public.thiet_bi WHERE %s', v_where) INTO v_total;

  -- p_fields/v_fields assignment removed: query always uses to_jsonb(tb.*)

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

CREATE OR REPLACE FUNCTION public.equipment_count(
  p_statuses text[] DEFAULT NULL::text[],
  p_q text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_cnt BIGINT;
BEGIN
  IF v_role = 'global' THEN
    SELECT COUNT(*) INTO v_cnt
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false
      AND (p_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || p_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || p_q || '%'))
      AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));
  ELSE
    SELECT COUNT(*) INTO v_cnt
    FROM public.thiet_bi tb
    WHERE tb.don_vi = v_donvi
      AND tb.is_deleted = false
      AND (p_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || p_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || p_q || '%'))
      AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));
  END IF;
  RETURN COALESCE(v_cnt, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.departments_list()
RETURNS TABLE(name text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role TEXT := '';
  v_claim_donvi BIGINT := NULL;
  v_effective_donvi BIGINT := NULL;
BEGIN
  v_role := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;

  IF lower(v_role) = 'global' THEN
    v_effective_donvi := NULL;
  ELSE
    v_effective_donvi := v_claim_donvi;
  END IF;

  RETURN QUERY
  SELECT DISTINCT coalesce(tb.khoa_phong_quan_ly, '') as name
  FROM public.thiet_bi tb
  WHERE coalesce(tb.khoa_phong_quan_ly, '') <> ''
    AND tb.is_deleted = false
    AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
  ORDER BY 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.departments_list_for_tenant(p_don_vi bigint DEFAULT NULL::bigint)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
    IF p_don_vi IS NOT NULL THEN
      IF v_allowed IS NULL OR NOT (p_don_vi = ANY(v_allowed)) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'name', COALESCE(NULLIF(TRIM(khoa_phong_quan_ly), ''), 'Chưa phân loại'),
    'count', COUNT(*)::INTEGER
  )
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    AND tb.is_deleted = false
  GROUP BY COALESCE(NULLIF(TRIM(khoa_phong_quan_ly), ''), 'Chưa phân loại')
  ORDER BY COUNT(*) DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.equipment_users_list_for_tenant(p_don_vi bigint DEFAULT NULL::bigint)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
    IF p_don_vi IS NOT NULL THEN
      IF v_allowed IS NULL OR NOT (p_don_vi = ANY(v_allowed)) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'name', COALESCE(NULLIF(TRIM(nguoi_dang_truc_tiep_quan_ly), ''), 'Chưa có người sử dụng'),
    'count', COUNT(*)::INTEGER
  )
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    AND tb.is_deleted = false
  GROUP BY COALESCE(NULLIF(TRIM(nguoi_dang_truc_tiep_quan_ly), ''), 'Chưa có người sử dụng')
  ORDER BY COUNT(*) DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.equipment_locations_list_for_tenant(p_don_vi bigint DEFAULT NULL::bigint)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
    IF p_don_vi IS NOT NULL THEN
      IF v_allowed IS NULL OR NOT (p_don_vi = ANY(v_allowed)) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'name', COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''), 'Chưa có vị trí'),
    'count', COUNT(*)::INTEGER
  )
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    AND tb.is_deleted = false
  GROUP BY COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''), 'Chưa có vị trí')
  ORDER BY COUNT(*) DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.equipment_classifications_list_for_tenant(p_don_vi bigint DEFAULT NULL::bigint)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
    IF p_don_vi IS NOT NULL THEN
      IF v_allowed IS NULL OR NOT (p_don_vi = ANY(v_allowed)) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'name', COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''), 'Chưa phân loại'),
    'count', COUNT(*)::INTEGER
  )
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    AND tb.is_deleted = false
  GROUP BY COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''), 'Chưa phân loại')
  ORDER BY COUNT(*) DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.equipment_statuses_list_for_tenant(p_don_vi bigint DEFAULT NULL::bigint)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
    IF p_don_vi IS NOT NULL THEN
      IF v_allowed IS NULL OR NOT (p_don_vi = ANY(v_allowed)) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'name', COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''), 'Chưa phân loại'),
    'count', COUNT(*)::INTEGER
  )
  FROM public.thiet_bi tb
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    AND tb.is_deleted = false
  GROUP BY COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''), 'Chưa phân loại')
  ORDER BY COUNT(*) DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.equipment_funding_sources_list_for_tenant(p_don_vi bigint DEFAULT NULL::bigint)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
    IF v_allowed IS NULL OR array_length(v_allowed, 1) = 0 THEN
      RETURN;
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
    AND tb.is_deleted = false
  GROUP BY COALESCE(NULLIF(TRIM(nguon_kinh_phi), ''), 'Chưa có')
  ORDER BY COUNT(*) DESC;
END;
$function$;

-- ============================================================================
-- Dashboard/KPI reads
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_attention_list(p_limit integer DEFAULT 5)
RETURNS SETOF thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := '';
  v_allowed_don_vi BIGINT[];
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

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF v_role = '' OR v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL THEN
    RETURN;
  END IF;

  IF v_role = 'global' THEN
    RETURN QUERY
    SELECT *
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false
      AND tb.tinh_trang_hien_tai IN ('Chờ sửa chữa', 'Chờ bảo trì', 'Chờ hiệu chuẩn/kiểm định')
    ORDER BY tb.ngay_bt_tiep_theo ASC NULLS LAST
    LIMIT GREATEST(p_limit, 1);

    RETURN;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.thiet_bi tb
  WHERE tb.don_vi = ANY(v_allowed_don_vi)
    AND tb.is_deleted = false
    AND tb.tinh_trang_hien_tai IN ('Chờ sửa chữa', 'Chờ bảo trì', 'Chờ hiệu chuẩn/kiểm định')
  ORDER BY tb.ngay_bt_tiep_theo ASC NULLS LAST
  LIMIT GREATEST(p_limit, 1);
END;
$function$;

CREATE OR REPLACE FUNCTION public.equipment_attention_list_paginated(p_page integer DEFAULT 1, p_page_size integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := '';
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_page INT := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size INT := LEAST(GREATEST(COALESCE(p_page_size, 10), 1), 50);
  v_offset INT := 0;
  v_result JSONB;
BEGIN
  v_offset := (v_page - 1) * v_page_size;

  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'data', '[]'::jsonb,
      'total', 0,
      'page', v_page,
      'pageSize', v_page_size,
      'hasMore', false
    );
  END;

  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF v_role = '' OR v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'data', '[]'::jsonb,
      'total', 0,
      'page', v_page,
      'pageSize', v_page_size,
      'hasMore', false
    );
  END IF;

  WITH filtered AS (
    SELECT
      tb.id,
      tb.ten_thiet_bi,
      tb.ma_thiet_bi,
      tb.model,
      tb.tinh_trang_hien_tai,
      tb.vi_tri_lap_dat,
      tb.ngay_bt_tiep_theo
    FROM public.thiet_bi tb
    WHERE (
      v_role = 'global'
      OR tb.don_vi = ANY(v_allowed_don_vi)
    )
    AND tb.is_deleted = false
    AND tb.tinh_trang_hien_tai IN ('Chờ sửa chữa', 'Chờ bảo trì', 'Chờ hiệu chuẩn/kiểm định')
  ),
  totals AS (
    SELECT COUNT(*)::BIGINT AS total FROM filtered
  ),
  paged AS (
    SELECT * FROM filtered
    ORDER BY ngay_bt_tiep_theo ASC NULLS LAST, id ASC
    LIMIT v_page_size OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'data', COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'id', p.id,
          'ten_thiet_bi', p.ten_thiet_bi,
          'ma_thiet_bi', p.ma_thiet_bi,
          'model', p.model,
          'tinh_trang_hien_tai', p.tinh_trang_hien_tai,
          'vi_tri_lap_dat', p.vi_tri_lap_dat,
          'ngay_bt_tiep_theo', p.ngay_bt_tiep_theo
        )) FROM paged p
      ),
      '[]'::jsonb
    ),
    'total', COALESCE((SELECT total FROM totals), 0),
    'page', v_page,
    'pageSize', v_page_size,
    'hasMore', COALESCE((SELECT total FROM totals), 0) > (v_offset + v_page_size)
  ) INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object(
    'data', '[]'::jsonb,
    'total', 0,
    'page', v_page,
    'pageSize', v_page_size,
    'hasMore', false
  ));
END;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_equipment_total()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_allowed_don_vi BIGINT[];
  result INTEGER;
BEGIN
  v_allowed_don_vi := public.allowed_don_vi_for_session();

  SELECT COUNT(*)::INTEGER INTO result
  FROM public.thiet_bi tb
  WHERE tb.is_deleted = false
    AND (
      v_role = 'global'
      OR
      (v_allowed_don_vi IS NOT NULL AND array_length(v_allowed_don_vi, 1) > 0 AND tb.don_vi = ANY(v_allowed_don_vi))
    );

  RETURN COALESCE(result, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_facilities_with_equipment_count()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := '';
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_result JSONB;
BEGIN
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;

  v_role := COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  );

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF lower(v_role) = 'global' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', dv.id,
        'name', dv.name,
        'code', dv.code,
        'equipment_count', COALESCE(tb_count.cnt, 0)
      )
      ORDER BY dv.name
    )
    INTO v_result
    FROM public.don_vi dv
    LEFT JOIN (
      SELECT don_vi, COUNT(*) as cnt
      FROM public.thiet_bi
      WHERE is_deleted = false
      GROUP BY don_vi
    ) tb_count ON tb_count.don_vi = dv.id;

    RETURN COALESCE(v_result, '[]'::jsonb);
  END IF;

  IF v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', dv.id,
      'name', dv.name,
      'code', dv.code,
      'equipment_count', COALESCE(tb_count.cnt, 0)
    )
    ORDER BY dv.name
  )
  INTO v_result
  FROM public.don_vi dv
  LEFT JOIN (
    SELECT don_vi, COUNT(*) as cnt
    FROM public.thiet_bi
    WHERE don_vi = ANY(v_allowed_don_vi)
      AND is_deleted = false
    GROUP BY don_vi
  ) tb_count ON tb_count.don_vi = dv.id
  WHERE dv.id = ANY(v_allowed_don_vi);

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;

-- ============================================================================
-- Explicit grants
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.equipment_get(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_get_by_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_list(TEXT, TEXT, INT, INT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_list_enhanced(
  TEXT, TEXT, INT, INT, BIGINT, TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[]
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_count(TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.departments_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.departments_list_for_tenant(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_users_list_for_tenant(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_locations_list_for_tenant(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_classifications_list_for_tenant(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_statuses_list_for_tenant(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_funding_sources_list_for_tenant(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_attention_list(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_attention_list_paginated(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_equipment_total() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_facilities_with_equipment_count() TO authenticated;

COMMIT;
