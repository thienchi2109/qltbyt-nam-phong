-- Expand ai_equipment_lookup to include so_luu_hanh (Marketing Authorization Number)
-- in both the ILIKE search scope and the JSONB output.
--
-- This is a non-breaking patch: the function signature is unchanged.

BEGIN;

CREATE OR REPLACE FUNCTION public.ai_equipment_lookup(
  query TEXT DEFAULT NULL,
  "limit" INTEGER DEFAULT 10,
  p_don_vi BIGINT DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL
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
  v_sanitized_q TEXT := public._sanitize_ilike_pattern(query);
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
          v_sanitized_q IS NULL
          OR tb.ma_thiet_bi ILIKE '%' || v_sanitized_q || '%'
          OR tb.ten_thiet_bi ILIKE '%' || v_sanitized_q || '%'
          OR COALESCE(tb.model, '') ILIKE '%' || v_sanitized_q || '%'
          OR COALESCE(tb.serial, '') ILIKE '%' || v_sanitized_q || '%'
          OR COALESCE(tb.so_luu_hanh, '') ILIKE '%' || v_sanitized_q || '%'
        )
      ORDER BY tb.updated_at DESC NULLS LAST, tb.id DESC
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
      'limit', v_limit
    )
    FROM filtered
  );
END;
$function$;

COMMIT;
