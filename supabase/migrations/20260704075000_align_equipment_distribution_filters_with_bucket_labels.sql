-- Align Equipment department distribution filters with normalized bucket labels.
--
-- The distribution RPC receives the same active filters as the Equipment list
-- and filter bucket RPCs. Keep its selected-filter semantics aligned with the
-- normalized labels emitted by equipment_filter_buckets.
--
-- Forward-only rollback: add a later migration that restores the
-- equipment_department_distribution body from
-- 20260624131500_add_equipment_department_distribution.sql.

BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_department_distribution(
  p_q text DEFAULT NULL::text,
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
RETURNS TABLE(department text, label text, "count" integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := '';
  v_user_id TEXT := NULL;
  v_claim_donvi BIGINT := NULL;
  v_allowed_don_vi BIGINT[];
  v_effective_donvi BIGINT := NULL;
  v_department_scope TEXT;
  v_where TEXT := '1=1 AND is_deleted = false';
  v_jwt_claims JSONB;
  v_sanitized_q TEXT;
  v_unclassified_label CONSTANT TEXT := 'Chưa phân loại';
  v_empty_user_label CONSTANT TEXT := 'Chưa có người sử dụng';
  v_empty_location_label CONSTANT TEXT := 'Chưa có vị trí';
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
  v_user_id := NULLIF(v_jwt_claims ->>'user_id', '');
  v_claim_donvi := NULLIF(v_jwt_claims ->>'don_vi', '')::BIGINT;

  IF lower(v_role) = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = '' OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing required JWT claims' USING ERRCODE = '42501';
  END IF;

  IF lower(v_role) = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims ->>'khoa_phong');
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
          RETURN;
        END IF;
      ELSE
        v_effective_donvi := NULL;
      END IF;
    ELSE
      RETURN;
    END IF;
  END IF;

  IF lower(v_role) = 'user' AND v_department_scope IS NULL THEN
    RETURN;
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
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(khoa_phong_quan_ly), ''''), ' || quote_literal(v_unclassified_label) || ') = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_khoa_phong_array) AS x), ',') || '])';
  ELSIF p_khoa_phong IS NOT NULL AND trim(p_khoa_phong) != '' THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(khoa_phong_quan_ly), ''''), ' || quote_literal(v_unclassified_label) || ') = ' || quote_literal(p_khoa_phong);
  END IF;

  IF p_nguoi_su_dung_array IS NOT NULL AND array_length(p_nguoi_su_dung_array, 1) > 0 THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(nguoi_dang_truc_tiep_quan_ly), ''''), ' || quote_literal(v_empty_user_label) || ') = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_nguoi_su_dung_array) AS x), ',') || '])';
  ELSIF p_nguoi_su_dung IS NOT NULL AND trim(p_nguoi_su_dung) != '' THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(nguoi_dang_truc_tiep_quan_ly), ''''), ' || quote_literal(v_empty_user_label) || ') = ' || quote_literal(p_nguoi_su_dung);
  END IF;

  IF p_vi_tri_lap_dat_array IS NOT NULL AND array_length(p_vi_tri_lap_dat_array, 1) > 0 THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''''), ' || quote_literal(v_empty_location_label) || ') = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_vi_tri_lap_dat_array) AS x), ',') || '])';
  ELSIF p_vi_tri_lap_dat IS NOT NULL AND trim(p_vi_tri_lap_dat) != '' THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(vi_tri_lap_dat), ''''), ' || quote_literal(v_empty_location_label) || ') = ' || quote_literal(p_vi_tri_lap_dat);
  END IF;

  IF p_tinh_trang_array IS NOT NULL AND array_length(p_tinh_trang_array, 1) > 0 THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''''), ' || quote_literal(v_unclassified_label) || ') = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_tinh_trang_array) AS x), ',') || '])';
  ELSIF p_tinh_trang IS NOT NULL AND trim(p_tinh_trang) != '' THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(tinh_trang_hien_tai), ''''), ' || quote_literal(v_unclassified_label) || ') = ' || quote_literal(p_tinh_trang);
  END IF;

  IF p_phan_loai_array IS NOT NULL AND array_length(p_phan_loai_array, 1) > 0 THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''''), ' || quote_literal(v_unclassified_label) || ') = ANY(ARRAY[' ||
               array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(p_phan_loai_array) AS x), ',') || '])';
  ELSIF p_phan_loai IS NOT NULL AND trim(p_phan_loai) != '' THEN
    v_where := v_where || ' AND COALESCE(NULLIF(TRIM(phan_loai_theo_nd98), ''''), ' || quote_literal(v_unclassified_label) || ') = ' || quote_literal(p_phan_loai);
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
              ' OR so_luu_hanh ILIKE ' || quote_literal('%' || v_sanitized_q || '%') ||
              ' OR model ILIKE ' || quote_literal('%' || v_sanitized_q || '%') || ')';
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT department,
            COALESCE(department, ''Chưa cập nhật'') AS label,
            COUNT(*)::integer AS "count"
       FROM (
         SELECT NULLIF(BTRIM(khoa_phong_quan_ly), '''') AS department
         FROM public.thiet_bi
         WHERE %s
       ) scoped
       GROUP BY department
       ORDER BY COUNT(*) DESC, label ASC',
    v_where
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.equipment_department_distribution(
  text,
  bigint,
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[]
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.equipment_department_distribution(
  text,
  bigint,
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[]
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.equipment_department_distribution(
  text,
  bigint,
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[]
) TO service_role;

COMMENT ON FUNCTION public.equipment_department_distribution(
  text,
  bigint,
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[],
  text,
  text[]
) IS 'Returns department distribution counts for the filtered Equipment result set.';

COMMIT;
