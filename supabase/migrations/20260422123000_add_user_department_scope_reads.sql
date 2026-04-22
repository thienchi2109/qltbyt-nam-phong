-- Migration: add role=user department scope to equipment read RPCs
-- Date: 2026-04-22
-- Scope: Issue #301 read-family only
--
-- Notes:
-- - Patch against the deployed RPC shapes verified via Supabase MCP.
-- - Preserve existing tenant guards and non-user return/error contracts.
-- - Do not change equipment_count_enhanced in this batch.

BEGIN;

CREATE OR REPLACE FUNCTION public._normalize_department_scope(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_normalized text;
BEGIN
  IF p_value IS NULL THEN
    RETURN NULL;
  END IF;

  v_normalized := replace(p_value, chr(160), ' ');
  v_normalized := replace(v_normalized, E'\r', ' ');
  v_normalized := replace(v_normalized, E'\n', ' ');
  v_normalized := replace(v_normalized, E'\t', ' ');
  v_normalized := regexp_replace(v_normalized, '\s+', ' ', 'g');
  v_normalized := lower(trim(v_normalized));

  IF v_normalized = '' THEN
    RETURN NULL;
  END IF;

  RETURN v_normalized;
END;
$function$;

CREATE OR REPLACE FUNCTION public.equipment_get(p_id bigint)
RETURNS thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_department_scope TEXT;
  rec public.thiet_bi;
BEGIN
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(public._get_jwt_claim('khoa_phong'));
  END IF;

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

  IF v_role = 'user' THEN
    IF v_department_scope IS NULL
       OR public._normalize_department_scope(rec.khoa_phong_quan_ly) IS DISTINCT FROM v_department_scope THEN
      RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN rec;
END;
$function$;

CREATE OR REPLACE FUNCTION public.equipment_get_by_code(p_ma_thiet_bi text)
RETURNS thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(coalesce(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_department_scope TEXT;
  rec public.thiet_bi;
BEGIN
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(public._get_jwt_claim('khoa_phong'));
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

  IF v_role = 'user' THEN
    IF v_department_scope IS NULL
       OR public._normalize_department_scope(rec.khoa_phong_quan_ly) IS DISTINCT FROM v_department_scope THEN
      RAISE EXCEPTION 'Equipment not found or access denied' USING ERRCODE = '42501';
    END IF;
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
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  v_department_scope TEXT;
  v_sort_col TEXT;
  v_sort_dir TEXT;
  v_offset INT := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1);
  v_sql TEXT;
  v_sanitized_q TEXT;
BEGIN
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(public._get_jwt_claim('khoa_phong'));
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

  IF v_role = 'user' AND v_department_scope IS NULL THEN
    RETURN;
  END IF;

  v_sort_col := split_part(p_sort, '.', 1);
  v_sort_dir := CASE LOWER(split_part(p_sort, '.', 2)) WHEN 'desc' THEN 'DESC' ELSE 'ASC' END;
  IF v_sort_col NOT IN (
    'id','ten_thiet_bi','ma_thiet_bi','khoa_phong_quan_ly','don_vi','tinh_trang_hien_tai','phan_loai_theo_nd98','model','serial'
  ) THEN
    v_sort_col := 'id';
  END IF;

  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  v_sql := 'SELECT * FROM public.thiet_bi WHERE is_deleted = false';
  IF v_effective IS NOT NULL THEN
    v_sql := v_sql || format(' AND don_vi = ANY(%L::BIGINT[])', v_effective);
  END IF;

  IF v_role = 'user' THEN
    v_sql := v_sql || format(
      ' AND public._normalize_department_scope(khoa_phong_quan_ly) = %L',
      v_department_scope
    );
  END IF;

  IF v_sanitized_q IS NOT NULL THEN
    v_sql := v_sql || format(' AND (ten_thiet_bi ILIKE %L OR ma_thiet_bi ILIKE %L)',
      '%' || v_sanitized_q || '%', '%' || v_sanitized_q || '%');
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
  v_department_scope TEXT;
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

  IF lower(v_role) = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims ->>'khoa_phong');
  END IF;

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

  IF lower(v_role) = 'user' AND v_department_scope IS NULL THEN
    RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'pageSize', p_page_size);
  END IF;

  IF v_effective_donvi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ' || v_effective_donvi;
  END IF;

  IF v_effective_donvi IS NULL AND lower(v_role) NOT IN ('global', 'admin') AND v_allowed_don_vi IS NOT NULL THEN
    v_where := v_where || ' AND don_vi = ANY(ARRAY[' || array_to_string(v_allowed_don_vi, ',') || '])';
  END IF;

  IF lower(v_role) = 'user' THEN
    v_where := v_where || ' AND public._normalize_department_scope(khoa_phong_quan_ly) = '
      || quote_literal(v_department_scope);
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
  v_department_scope TEXT;
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

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims ->> 'khoa_phong');
    IF v_department_scope IS NULL THEN
      RETURN;
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
    AND (v_role <> 'user' OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope)
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
  v_department_scope TEXT;
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

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims ->> 'khoa_phong');
    IF v_department_scope IS NULL THEN
      RETURN;
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
    AND (v_role <> 'user' OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope)
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
  v_department_scope TEXT;
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

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims ->> 'khoa_phong');
    IF v_department_scope IS NULL THEN
      RETURN;
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
    AND (v_role <> 'user' OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope)
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
  v_department_scope TEXT;
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

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims ->> 'khoa_phong');
    IF v_department_scope IS NULL THEN
      RETURN;
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
    AND (v_role <> 'user' OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope)
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
  v_department_scope TEXT;
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

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims ->> 'khoa_phong');
    IF v_department_scope IS NULL THEN
      RETURN;
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
    AND (v_role <> 'user' OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope)
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
  v_department_scope TEXT;
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

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims ->> 'khoa_phong');
    IF v_department_scope IS NULL THEN
      RETURN;
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
    AND (v_role <> 'user' OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope)
  GROUP BY COALESCE(NULLIF(TRIM(nguon_kinh_phi), ''), 'Chưa có')
  ORDER BY COUNT(*) DESC;
END;
$function$;

COMMIT;
