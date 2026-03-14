-- Extend ai_equipment_lookup with structured filters so assistant
-- questions can filter by status, department, location, classification,
-- model, and serial while still supporting free-text search.

BEGIN;

DROP FUNCTION IF EXISTS public.ai_equipment_lookup(TEXT, INTEGER, BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.ai_equipment_lookup(TEXT, INTEGER, BIGINT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.ai_equipment_lookup(TEXT, INTEGER, BIGINT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.ai_equipment_lookup(
  query TEXT DEFAULT NULL,
  "limit" INTEGER DEFAULT 10,
  p_don_vi BIGINT DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL,
  status TEXT DEFAULT NULL,
  filters JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_user_id TEXT := NULLIF(COALESCE(public._get_jwt_claim('user_id'), public._get_jwt_claim('sub')), '');
  v_don_vi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_allowed BIGINT[] := NULL;
  v_effective BIGINT[] := NULL;
  v_is_global BOOLEAN := FALSE;
  v_limit INT := GREATEST(LEAST(COALESCE("limit", 10), 50), 1);
  v_filters JSONB := COALESCE(filters, '{}'::JSONB);
  v_sanitized_q TEXT := public._sanitize_ilike_pattern(query);
  v_status_filter TEXT := NULLIF(BTRIM(COALESCE(v_filters->>'status', status)), '');
  v_department_filter_raw TEXT := NULLIF(BTRIM(COALESCE(v_filters->>'department', v_filters->>'khoa_phong', v_filters->>'khoa_phong_quan_ly')), '');
  v_department_filter TEXT := public._sanitize_ilike_pattern(v_department_filter_raw);
  v_location_filter_raw TEXT := NULLIF(BTRIM(COALESCE(v_filters->>'location', v_filters->>'vi_tri_lap_dat')), '');
  v_location_filter TEXT := public._sanitize_ilike_pattern(v_location_filter_raw);
  v_classification_filter TEXT := NULLIF(BTRIM(COALESCE(v_filters->>'classification', v_filters->>'phan_loai_theo_nd98')), '');
  v_model_filter_raw TEXT := NULLIF(BTRIM(COALESCE(v_filters->>'model')), '');
  v_model_filter TEXT := public._sanitize_ilike_pattern(v_model_filter_raw);
  v_serial_filter_raw TEXT := NULLIF(BTRIM(COALESCE(v_filters->>'serial')), '');
  v_serial_filter TEXT := public._sanitize_ilike_pattern(v_serial_filter_raw);
BEGIN
  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;
  v_is_global := (v_role = 'global');

  IF NOT v_is_global AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NOT NULL
     AND NULLIF(BTRIM(p_user_id), '') IS NOT NULL
     AND BTRIM(p_user_id) IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'user_id claim mismatch' USING ERRCODE = '42501';
  END IF;

  IF v_status_filter IS NOT NULL THEN
    IF v_status_filter ILIKE '%ngưng sử dụng%' OR v_status_filter ILIKE '%ngung su dung%' THEN
      v_status_filter := 'Ngưng sử dụng';
    ELSIF v_status_filter ILIKE '%chưa có nhu cầu sử dụng%' OR v_status_filter ILIKE '%chua co nhu cau su dung%' THEN
      v_status_filter := 'Chưa có nhu cầu sử dụng';
    ELSIF v_status_filter ILIKE '%chờ sửa chữa%' OR v_status_filter ILIKE '%cho sua chua%' THEN
      v_status_filter := 'Chờ sửa chữa';
    ELSIF v_status_filter ILIKE '%chờ bảo trì%' OR v_status_filter ILIKE '%cho bao tri%' THEN
      v_status_filter := 'Chờ bảo trì';
    ELSIF v_status_filter ILIKE '%kiểm định%' OR v_status_filter ILIKE '%kiem dinh%' OR v_status_filter ILIKE '%hiệu chuẩn%' OR v_status_filter ILIKE '%hieu chuan%' THEN
      v_status_filter := 'Chờ hiệu chuẩn/kiểm định';
    ELSIF v_status_filter ILIKE '%hoạt động%' OR v_status_filter ILIKE '%hoat dong%' THEN
      v_status_filter := 'Hoạt động';
    END IF;
  END IF;

  IF v_is_global THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
      RETURN jsonb_build_object(
        'data', '[]'::JSONB,
        'total', 0,
        'limit', v_limit
      );
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT (p_don_vi = ANY(v_allowed)) THEN
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  ELSE
    IF p_don_vi IS NOT NULL AND p_don_vi IS DISTINCT FROM v_don_vi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
    END IF;
    v_effective := ARRAY[v_don_vi];
  END IF;

  RETURN (
    WITH filtered AS (
      SELECT
        tb.id,
        tb.ma_thiet_bi,
        tb.ten_thiet_bi,
        tb.model,
        tb.serial,
        tb.so_luu_hanh,
        tb.tinh_trang_hien_tai,
        tb.khoa_phong_quan_ly,
        tb.vi_tri_lap_dat,
        tb.phan_loai_theo_nd98,
        tb.ngay_bt_tiep_theo,
        tb.ngay_hc_tiep_theo,
        tb.ngay_kd_tiep_theo,
        tb.don_vi,
        dv.name AS facility_name,
        COUNT(*) OVER () AS total_count
      FROM public.thiet_bi tb
      LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
      WHERE tb.is_deleted = FALSE
        AND (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
        AND (
          v_status_filter IS NULL
          OR tb.tinh_trang_hien_tai = v_status_filter
        )
        AND (
          v_department_filter IS NULL
          OR COALESCE(tb.khoa_phong_quan_ly, '') ILIKE '%' || v_department_filter || '%'
        )
        AND (
          v_location_filter IS NULL
          OR COALESCE(tb.vi_tri_lap_dat, '') ILIKE '%' || v_location_filter || '%'
        )
        AND (
          v_classification_filter IS NULL
          OR COALESCE(tb.phan_loai_theo_nd98, '') = v_classification_filter
        )
        AND (
          v_model_filter IS NULL
          OR COALESCE(tb.model, '') ILIKE '%' || v_model_filter || '%'
        )
        AND (
          v_serial_filter IS NULL
          OR COALESCE(tb.serial, '') ILIKE '%' || v_serial_filter || '%'
        )
        AND (
          v_sanitized_q IS NULL
          OR tb.ma_thiet_bi ILIKE '%' || v_sanitized_q || '%'
          OR tb.ten_thiet_bi ILIKE '%' || v_sanitized_q || '%'
          OR COALESCE(tb.model, '') ILIKE '%' || v_sanitized_q || '%'
          OR COALESCE(tb.serial, '') ILIKE '%' || v_sanitized_q || '%'
          OR COALESCE(tb.so_luu_hanh, '') ILIKE '%' || v_sanitized_q || '%'
          OR COALESCE(tb.tinh_trang_hien_tai, '') ILIKE '%' || v_sanitized_q || '%'
          OR COALESCE(tb.khoa_phong_quan_ly, '') ILIKE '%' || v_sanitized_q || '%'
          OR COALESCE(tb.vi_tri_lap_dat, '') ILIKE '%' || v_sanitized_q || '%'
          OR COALESCE(tb.phan_loai_theo_nd98, '') ILIKE '%' || v_sanitized_q || '%'
        )
      ORDER BY tb.created_at DESC NULLS LAST, tb.id DESC
      LIMIT v_limit
    )
    SELECT jsonb_build_object(
      'data',
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'ma_thiet_bi', ma_thiet_bi,
            'ten_thiet_bi', ten_thiet_bi,
            'model', model,
            'serial', serial,
            'so_luu_hanh', so_luu_hanh,
            'tinh_trang_hien_tai', tinh_trang_hien_tai,
            'khoa_phong_quan_ly', khoa_phong_quan_ly,
            'vi_tri_lap_dat', vi_tri_lap_dat,
            'phan_loai_theo_nd98', phan_loai_theo_nd98,
            'ngay_bt_tiep_theo', ngay_bt_tiep_theo,
            'ngay_hc_tiep_theo', ngay_hc_tiep_theo,
            'ngay_kd_tiep_theo', ngay_kd_tiep_theo,
            'don_vi', don_vi,
            'facility_name', facility_name
          )
        ),
        '[]'::JSONB
      ),
      'total', COALESCE(MAX(total_count), 0),
      'limit', v_limit,
      'appliedFilters',
      jsonb_strip_nulls(
        jsonb_build_object(
          'status', v_status_filter,
          'department', v_department_filter_raw,
          'location', v_location_filter_raw,
          'classification', v_classification_filter,
          'model', v_model_filter_raw,
          'serial', v_serial_filter_raw
        )
      )
    )
    FROM filtered
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ai_equipment_lookup(TEXT, INTEGER, BIGINT, TEXT, TEXT, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ai_equipment_lookup(TEXT, INTEGER, BIGINT, TEXT, TEXT, JSONB) FROM PUBLIC;

COMMIT;
