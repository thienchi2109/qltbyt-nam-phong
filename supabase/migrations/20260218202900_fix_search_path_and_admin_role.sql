-- Migration: Fix search_path on equipment_count, admin role in equipment_list_enhanced,
--            and collapse duplicated queries in equipment_aggregates_for_reports.
-- Date: 2026-02-18
--
-- Fix 1 (20260218131002): equipment_count was declared SECURITY DEFINER without
--   SET search_path, leaving it vulnerable to search_path hijacking. Add the
--   standard SET search_path TO 'public', 'pg_temp' clause.
--
-- Fix 2 (20260218131336): equipment_list_enhanced checked `lower(v_role) = 'global'`
--   but not 'admin', unlike every other RPC in the codebase. Admin users were
--   incorrectly routed to the non-global branch, which calls
--   allowed_don_vi_for_session_safe() and may return empty for admin sessions,
--   causing a spurious "No tenant access" error. Fix: use `lower(v_role) IN
--   ('global', 'admin')` consistently, and also fix the two secondary checks on
--   lines that use `lower(v_role) <> 'global'`.
--
-- Fix 3 (20260218130744): equipment_aggregates_for_reports had each metric
--   (totalImported, totalExported, currentStock) split into two near-identical
--   queries branched on `v_facilities_to_query IS NULL`. Collapsed into a single
--   query per metric using the standard pattern:
--     (v_facilities_to_query IS NULL OR tb.don_vi = ANY(v_facilities_to_query))
--   This is safe in PostgreSQL: TRUE OR <anything> = TRUE, so when
--   v_facilities_to_query IS NULL the condition is always true (no tenant filter).

BEGIN;

-- ============================================================================
-- Fix 1: equipment_count — add SET search_path
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
BEGIN
  -- Map admin → global for consistency with equipment_get / equipment_list
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = 'global' THEN
    -- Global/admin: count across all tenants (no tenant filter)
    SELECT COUNT(*) INTO v_cnt
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false
      AND (p_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || p_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || p_q || '%'))
      AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));
  ELSE
    -- All other roles (regional_leader, to_qltb, technician, user, etc.):
    -- use allowed_don_vi_for_session() so the count covers exactly the same
    -- set of tenants that equipment_list returns rows for.
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN 0;
    END IF;

    SELECT COUNT(*) INTO v_cnt
    FROM public.thiet_bi tb
    WHERE tb.don_vi = ANY(v_allowed)
      AND tb.is_deleted = false
      AND (p_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || p_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || p_q || '%'))
      AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));
  END IF;

  RETURN COALESCE(v_cnt, 0);
END;
$function$;

-- ============================================================================
-- Fix 2: equipment_list_enhanced — treat 'admin' same as 'global'
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

  -- Fix: treat 'admin' identically to 'global' (was previously only checking = 'global')
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

  -- Fix: also check for 'admin' here so admin users with no p_don_vi see all tenants
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

  IF p_q IS NOT NULL AND trim(p_q) != '' THEN
    v_where := v_where || ' AND (ten_thiet_bi ILIKE ' || quote_literal('%' || p_q || '%') ||
              ' OR ma_thiet_bi ILIKE ' || quote_literal('%' || p_q || '%') ||
              ' OR serial ILIKE ' || quote_literal('%' || p_q || '%') ||
              ' OR so_luu_hanh ILIKE ' || quote_literal('%' || p_q || '%') || ')';
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

GRANT EXECUTE ON FUNCTION public.equipment_count(TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_list_enhanced(
  TEXT, TEXT, INT, INT, BIGINT, TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[], TEXT, TEXT[]
) TO authenticated;

-- ============================================================================
-- Fix 3: equipment_aggregates_for_reports — collapse duplicated queries
-- ============================================================================

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

  -- totalImported: historical count of equipment registered in the date range.
  -- Intentionally excludes is_deleted filter — soft-deleted equipment was still
  -- physically imported and must be reflected in the historical record.
  -- Single query: when v_facilities_to_query IS NULL the tenant condition is
  -- always TRUE (no filter), matching the previous global-user branch exactly.
  SELECT COUNT(*)
  INTO v_total_imported
  FROM public.thiet_bi tb
  WHERE (v_facilities_to_query IS NULL OR tb.don_vi = ANY(v_facilities_to_query))
    AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
    AND (v_from_ts IS NULL OR tb.created_at >= v_from_ts)
    AND (v_to_ts_excl IS NULL OR tb.created_at < v_to_ts_excl);

  -- totalExported: historical count of equipment transferred/disposed in the date range.
  -- Intentionally excludes is_deleted filter — the transfer/disposal event occurred
  -- regardless of the equipment's current soft-delete status.
  SELECT COUNT(DISTINCT ylc.thiet_bi_id)
  INTO v_total_exported
  FROM public.yeu_cau_luan_chuyen ylc
  INNER JOIN public.thiet_bi tb ON ylc.thiet_bi_id = tb.id
  WHERE (v_facilities_to_query IS NULL OR tb.don_vi = ANY(v_facilities_to_query))
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

  -- currentStock: current active inventory count.
  -- Correctly keeps is_deleted = false — only non-deleted equipment is in stock.
  SELECT COUNT(*)
  INTO v_current_stock
  FROM public.thiet_bi tb
  WHERE tb.is_deleted = false
    AND (v_facilities_to_query IS NULL OR tb.don_vi = ANY(v_facilities_to_query))
    AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong);

  v_result := jsonb_build_object(
    'totalImported', COALESCE(v_total_imported, 0),
    'totalExported', COALESCE(v_total_exported, 0),
    'currentStock', COALESCE(v_current_stock, 0),
    'netChange', COALESCE(v_total_imported, 0) - COALESCE(v_total_exported, 0)
  );

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.equipment_aggregates_for_reports(BIGINT[], TEXT, DATE, DATE) TO authenticated;

COMMIT;
