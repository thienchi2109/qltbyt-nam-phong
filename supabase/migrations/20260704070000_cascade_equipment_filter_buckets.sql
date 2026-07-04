-- Cascade Equipment page filter buckets from active server-side filters.
--
-- The RPC keeps the bundled JSON response introduced in
-- 20260501090000_add_equipment_dashboard_perf_rpcs.sql, but mirrors the
-- current Equipment list/distribution filter contract so option buckets follow
-- the full server result set instead of remaining tenant-global.
--
-- Role user scope is enforced in the base relation before bucket-specific
-- filter exclusion, so excluding the department bucket's own filter can never
-- escape the JWT khoa_phong boundary.

BEGIN;

DROP FUNCTION IF EXISTS public.equipment_filter_buckets(bigint);

CREATE OR REPLACE FUNCTION public.equipment_filter_buckets(
  p_q text DEFAULT NULL::text,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_khoa_phong_array text[] DEFAULT NULL::text[],
  p_nguoi_su_dung_array text[] DEFAULT NULL::text[],
  p_vi_tri_lap_dat_array text[] DEFAULT NULL::text[],
  p_tinh_trang_array text[] DEFAULT NULL::text[],
  p_phan_loai_array text[] DEFAULT NULL::text[],
  p_nguon_kinh_phi_array text[] DEFAULT NULL::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_user_id text;
  v_allowed bigint[];
  v_effective bigint[];
  v_department_scope text;
  v_jwt_claims jsonb;
  v_sanitized_q text;
  v_result jsonb;
BEGIN
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;

  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  v_user_id := NULLIF(v_jwt_claims ->> 'user_id', '');

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  IF v_role = '' OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing required JWT claims' USING ERRCODE = '42501';
  END IF;

  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object(
        'department', '[]'::jsonb,
        'user', '[]'::jsonb,
        'location', '[]'::jsonb,
        'status', '[]'::jsonb,
        'classification', '[]'::jsonb,
        'fundingSource', '[]'::jsonb
      );
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
      RETURN jsonb_build_object(
        'department', '[]'::jsonb,
        'user', '[]'::jsonb,
        'location', '[]'::jsonb,
        'status', '[]'::jsonb,
        'classification', '[]'::jsonb,
        'fundingSource', '[]'::jsonb
      );
    END IF;
  END IF;

  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  WITH base_equipment AS MATERIALIZED (
    SELECT
      tb.khoa_phong_quan_ly AS department_raw,
      tb.nguoi_dang_truc_tiep_quan_ly AS user_raw,
      tb.vi_tri_lap_dat AS location_raw,
      tb.tinh_trang_hien_tai AS status_raw,
      tb.phan_loai_theo_nd98 AS classification_raw,
      COALESCE(NULLIF(TRIM(tb.khoa_phong_quan_ly), ''), 'Chưa phân loại') AS department_name,
      COALESCE(NULLIF(TRIM(tb.nguoi_dang_truc_tiep_quan_ly), ''), 'Chưa có người sử dụng') AS user_name,
      COALESCE(NULLIF(TRIM(tb.vi_tri_lap_dat), ''), 'Chưa có vị trí') AS location_name,
      COALESCE(NULLIF(TRIM(tb.tinh_trang_hien_tai), ''), 'Chưa phân loại') AS status_name,
      COALESCE(NULLIF(TRIM(tb.phan_loai_theo_nd98), ''), 'Chưa phân loại') AS classification_name,
      COALESCE(NULLIF(TRIM(tb.nguon_kinh_phi), ''), 'Chưa có') AS funding_source_name
    FROM public.thiet_bi tb
    WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
      AND tb.is_deleted = false
      AND (
        v_role <> 'user'
        OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope
      )
      AND (
        v_sanitized_q IS NULL
        OR tb.ten_thiet_bi ILIKE '%' || v_sanitized_q || '%'
        OR tb.ma_thiet_bi ILIKE '%' || v_sanitized_q || '%'
        OR tb.serial ILIKE '%' || v_sanitized_q || '%'
        OR tb.so_luu_hanh ILIKE '%' || v_sanitized_q || '%'
        OR tb.model ILIKE '%' || v_sanitized_q || '%'
      )
  )
  SELECT jsonb_build_object(
    'department', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', bucket.name, 'count', bucket.count) ORDER BY bucket.count DESC, bucket.name)
      FROM (
        SELECT department_name AS name, COUNT(*)::integer AS count
        FROM base_equipment
        WHERE (p_nguoi_su_dung_array IS NULL OR array_length(p_nguoi_su_dung_array, 1) IS NULL OR user_raw = ANY(p_nguoi_su_dung_array))
          AND (p_vi_tri_lap_dat_array IS NULL OR array_length(p_vi_tri_lap_dat_array, 1) IS NULL OR location_raw = ANY(p_vi_tri_lap_dat_array))
          AND (p_tinh_trang_array IS NULL OR array_length(p_tinh_trang_array, 1) IS NULL OR status_raw = ANY(p_tinh_trang_array))
          AND (p_phan_loai_array IS NULL OR array_length(p_phan_loai_array, 1) IS NULL OR classification_raw = ANY(p_phan_loai_array))
          AND (p_nguon_kinh_phi_array IS NULL OR array_length(p_nguon_kinh_phi_array, 1) IS NULL OR funding_source_name = ANY(p_nguon_kinh_phi_array))
        GROUP BY department_name
      ) bucket
    ), '[]'::jsonb),
    'user', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', bucket.name, 'count', bucket.count) ORDER BY bucket.count DESC, bucket.name)
      FROM (
        SELECT user_name AS name, COUNT(*)::integer AS count
        FROM base_equipment
        WHERE (p_khoa_phong_array IS NULL OR array_length(p_khoa_phong_array, 1) IS NULL OR department_raw = ANY(p_khoa_phong_array))
          AND (p_vi_tri_lap_dat_array IS NULL OR array_length(p_vi_tri_lap_dat_array, 1) IS NULL OR location_raw = ANY(p_vi_tri_lap_dat_array))
          AND (p_tinh_trang_array IS NULL OR array_length(p_tinh_trang_array, 1) IS NULL OR status_raw = ANY(p_tinh_trang_array))
          AND (p_phan_loai_array IS NULL OR array_length(p_phan_loai_array, 1) IS NULL OR classification_raw = ANY(p_phan_loai_array))
          AND (p_nguon_kinh_phi_array IS NULL OR array_length(p_nguon_kinh_phi_array, 1) IS NULL OR funding_source_name = ANY(p_nguon_kinh_phi_array))
        GROUP BY user_name
      ) bucket
    ), '[]'::jsonb),
    'location', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', bucket.name, 'count', bucket.count) ORDER BY bucket.count DESC, bucket.name)
      FROM (
        SELECT location_name AS name, COUNT(*)::integer AS count
        FROM base_equipment
        WHERE (p_khoa_phong_array IS NULL OR array_length(p_khoa_phong_array, 1) IS NULL OR department_raw = ANY(p_khoa_phong_array))
          AND (p_nguoi_su_dung_array IS NULL OR array_length(p_nguoi_su_dung_array, 1) IS NULL OR user_raw = ANY(p_nguoi_su_dung_array))
          AND (p_tinh_trang_array IS NULL OR array_length(p_tinh_trang_array, 1) IS NULL OR status_raw = ANY(p_tinh_trang_array))
          AND (p_phan_loai_array IS NULL OR array_length(p_phan_loai_array, 1) IS NULL OR classification_raw = ANY(p_phan_loai_array))
          AND (p_nguon_kinh_phi_array IS NULL OR array_length(p_nguon_kinh_phi_array, 1) IS NULL OR funding_source_name = ANY(p_nguon_kinh_phi_array))
        GROUP BY location_name
      ) bucket
    ), '[]'::jsonb),
    'status', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', bucket.name, 'count', bucket.count) ORDER BY bucket.count DESC, bucket.name)
      FROM (
        SELECT status_name AS name, COUNT(*)::integer AS count
        FROM base_equipment
        WHERE (p_khoa_phong_array IS NULL OR array_length(p_khoa_phong_array, 1) IS NULL OR department_raw = ANY(p_khoa_phong_array))
          AND (p_nguoi_su_dung_array IS NULL OR array_length(p_nguoi_su_dung_array, 1) IS NULL OR user_raw = ANY(p_nguoi_su_dung_array))
          AND (p_vi_tri_lap_dat_array IS NULL OR array_length(p_vi_tri_lap_dat_array, 1) IS NULL OR location_raw = ANY(p_vi_tri_lap_dat_array))
          AND (p_phan_loai_array IS NULL OR array_length(p_phan_loai_array, 1) IS NULL OR classification_raw = ANY(p_phan_loai_array))
          AND (p_nguon_kinh_phi_array IS NULL OR array_length(p_nguon_kinh_phi_array, 1) IS NULL OR funding_source_name = ANY(p_nguon_kinh_phi_array))
        GROUP BY status_name
      ) bucket
    ), '[]'::jsonb),
    'classification', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', bucket.name, 'count', bucket.count) ORDER BY bucket.count DESC, bucket.name)
      FROM (
        SELECT classification_name AS name, COUNT(*)::integer AS count
        FROM base_equipment
        WHERE (p_khoa_phong_array IS NULL OR array_length(p_khoa_phong_array, 1) IS NULL OR department_raw = ANY(p_khoa_phong_array))
          AND (p_nguoi_su_dung_array IS NULL OR array_length(p_nguoi_su_dung_array, 1) IS NULL OR user_raw = ANY(p_nguoi_su_dung_array))
          AND (p_vi_tri_lap_dat_array IS NULL OR array_length(p_vi_tri_lap_dat_array, 1) IS NULL OR location_raw = ANY(p_vi_tri_lap_dat_array))
          AND (p_tinh_trang_array IS NULL OR array_length(p_tinh_trang_array, 1) IS NULL OR status_raw = ANY(p_tinh_trang_array))
          AND (p_nguon_kinh_phi_array IS NULL OR array_length(p_nguon_kinh_phi_array, 1) IS NULL OR funding_source_name = ANY(p_nguon_kinh_phi_array))
        GROUP BY classification_name
      ) bucket
    ), '[]'::jsonb),
    'fundingSource', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', bucket.name, 'count', bucket.count) ORDER BY bucket.count DESC, bucket.name)
      FROM (
        SELECT funding_source_name AS name, COUNT(*)::integer AS count
        FROM base_equipment
        WHERE (p_khoa_phong_array IS NULL OR array_length(p_khoa_phong_array, 1) IS NULL OR department_raw = ANY(p_khoa_phong_array))
          AND (p_nguoi_su_dung_array IS NULL OR array_length(p_nguoi_su_dung_array, 1) IS NULL OR user_raw = ANY(p_nguoi_su_dung_array))
          AND (p_vi_tri_lap_dat_array IS NULL OR array_length(p_vi_tri_lap_dat_array, 1) IS NULL OR location_raw = ANY(p_vi_tri_lap_dat_array))
          AND (p_tinh_trang_array IS NULL OR array_length(p_tinh_trang_array, 1) IS NULL OR status_raw = ANY(p_tinh_trang_array))
          AND (p_phan_loai_array IS NULL OR array_length(p_phan_loai_array, 1) IS NULL OR classification_raw = ANY(p_phan_loai_array))
        GROUP BY funding_source_name
      ) bucket
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object(
    'department', '[]'::jsonb,
    'user', '[]'::jsonb,
    'location', '[]'::jsonb,
    'status', '[]'::jsonb,
    'classification', '[]'::jsonb,
    'fundingSource', '[]'::jsonb
  ));
END;
$function$;

REVOKE ALL ON FUNCTION public.equipment_filter_buckets(
  text,
  bigint,
  text[],
  text[],
  text[],
  text[],
  text[],
  text[]
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.equipment_filter_buckets(
  text,
  bigint,
  text[],
  text[],
  text[],
  text[],
  text[],
  text[]
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.equipment_filter_buckets(
  text,
  bigint,
  text[],
  text[],
  text[],
  text[],
  text[],
  text[]
) TO service_role;

COMMENT ON FUNCTION public.equipment_filter_buckets(
  text,
  bigint,
  text[],
  text[],
  text[],
  text[],
  text[],
  text[]
) IS 'Returns cascading equipment filter option buckets for the scoped Equipment result set.';

COMMIT;
