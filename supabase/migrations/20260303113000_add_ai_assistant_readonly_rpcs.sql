-- Add read-only AI assistant RPC functions with strict JWT guardrails.
-- Functions:
--   - ai_equipment_lookup
--   - ai_maintenance_summary
--   - ai_repair_summary
--
-- Also pins search_path on helper functions (_get_jwt_claim,
-- _sanitize_ilike_pattern) to clear Supabase security linter warnings.
--
-- Security requirements (REVIEW.md):
--   * SECURITY DEFINER + pinned search_path
--   * JWT claim NULL guards (role, user_id, don_vi for non-global roles)
--   * Tenant isolation enforced server-side
--   * Authenticated-only execution grants

BEGIN;

DROP FUNCTION IF EXISTS public.ai_equipment_lookup(TEXT, INTEGER, BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.ai_maintenance_summary(TEXT, TEXT, BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.ai_repair_summary(TEXT, BIGINT, TEXT);

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

CREATE OR REPLACE FUNCTION public.ai_maintenance_summary(
  "fromDate" TEXT DEFAULT NULL,
  "toDate" TEXT DEFAULT NULL,
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
  v_from_date DATE := NULL;
  v_to_date DATE := NULL;
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

  IF NULLIF(BTRIM("fromDate"), '') IS NOT NULL THEN
    v_from_date := NULLIF(BTRIM("fromDate"), '')::DATE;
  END IF;
  IF NULLIF(BTRIM("toDate"), '') IS NOT NULL THEN
    v_to_date := NULLIF(BTRIM("toDate"), '')::DATE;
  END IF;
  IF v_from_date IS NOT NULL AND v_to_date IS NOT NULL AND v_from_date > v_to_date THEN
    RAISE EXCEPTION 'fromDate must be before or equal to toDate' USING ERRCODE = '22007';
  END IF;

  IF v_is_global THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
      RETURN jsonb_build_object(
        'totalTasks', 0,
        'totalPlans', 0,
        'statusCounts', '{}'::JSONB,
        'taskTypeCounts', '{}'::JSONB,
        'recentTasks', '[]'::JSONB,
        'fromDate', v_from_date,
        'toDate', v_to_date
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
        cv.id AS task_id,
        cv.loai_cong_viec,
        cv.don_vi_thuc_hien,
        cv.updated_at AS task_updated_at,
        kh.id AS plan_id,
        kh.ten_ke_hoach,
        kh.nam,
        kh.trang_thai AS plan_status,
        kh.ngay_phe_duyet,
        tb.id AS equipment_id,
        tb.ma_thiet_bi,
        tb.ten_thiet_bi,
        tb.model
      FROM public.cong_viec_bao_tri cv
      JOIN public.ke_hoach_bao_tri kh ON kh.id = cv.ke_hoach_id
      LEFT JOIN public.thiet_bi tb ON tb.id = cv.thiet_bi_id
      WHERE (v_effective IS NULL OR COALESCE(tb.don_vi, kh.don_vi) = ANY(v_effective))
        AND (
          v_from_date IS NULL
          OR kh.ngay_phe_duyet IS NULL
          OR kh.ngay_phe_duyet::DATE >= v_from_date
        )
        AND (
          v_to_date IS NULL
          OR kh.ngay_phe_duyet IS NULL
          OR kh.ngay_phe_duyet::DATE <= v_to_date
        )
    ),
    status_counts AS (
      SELECT
        COALESCE(NULLIF(BTRIM(plan_status), ''), 'Khong xac dinh') AS k,
        COUNT(DISTINCT plan_id)::BIGINT AS c
      FROM filtered
      GROUP BY 1
    ),
    task_type_counts AS (
      SELECT
        COALESCE(NULLIF(BTRIM(loai_cong_viec), ''), 'khac') AS k,
        COUNT(*)::BIGINT AS c
      FROM filtered
      GROUP BY 1
    ),
    recent AS (
      SELECT *
      FROM filtered
      ORDER BY COALESCE(task_updated_at, ngay_phe_duyet) DESC NULLS LAST, task_id DESC
      LIMIT 20
    )
    SELECT jsonb_build_object(
      'totalTasks', COALESCE((SELECT COUNT(*)::BIGINT FROM filtered), 0),
      'totalPlans', COALESCE((SELECT COUNT(DISTINCT plan_id)::BIGINT FROM filtered), 0),
      'statusCounts', COALESCE((SELECT jsonb_object_agg(k, c) FROM status_counts), '{}'::JSONB),
      'taskTypeCounts', COALESCE((SELECT jsonb_object_agg(k, c) FROM task_type_counts), '{}'::JSONB),
      'recentTasks',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'task_id', task_id,
              'loai_cong_viec', loai_cong_viec,
              'don_vi_thuc_hien', don_vi_thuc_hien,
              'plan_id', plan_id,
              'ten_ke_hoach', ten_ke_hoach,
              'nam', nam,
              'plan_status', plan_status,
              'ngay_phe_duyet', ngay_phe_duyet,
              'equipment_id', equipment_id,
              'ma_thiet_bi', ma_thiet_bi,
              'ten_thiet_bi', ten_thiet_bi,
              'model', model
            )
          )
          FROM recent
        ),
        '[]'::JSONB
      ),
      'fromDate', v_from_date,
      'toDate', v_to_date
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_repair_summary(
  status TEXT DEFAULT NULL,
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
  v_status_filter TEXT := NULLIF(BTRIM(status), '');
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
        'totalRequests', 0,
        'openRequests', 0,
        'statusCounts', '{}'::JSONB,
        'recentRequests', '[]'::JSONB,
        'statusFilter', v_status_filter
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
    WITH scoped AS (
      SELECT
        r.id,
        r.thiet_bi_id,
        r.ngay_yeu_cau,
        r.trang_thai,
        r.mo_ta_su_co,
        r.hang_muc_sua_chua,
        r.ngay_hoan_thanh,
        r.don_vi_thuc_hien,
        r.ten_don_vi_thue,
        tb.ma_thiet_bi,
        tb.ten_thiet_bi,
        tb.model,
        tb.khoa_phong_quan_ly,
        tb.don_vi,
        dv.name AS facility_name
      FROM public.yeu_cau_sua_chua r
      LEFT JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
      LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
      WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    ),
    filtered AS (
      SELECT *
      FROM scoped
      WHERE v_status_filter IS NULL OR trang_thai = v_status_filter
    ),
    status_counts AS (
      SELECT
        COALESCE(NULLIF(BTRIM(trang_thai), ''), 'Khong xac dinh') AS k,
        COUNT(*)::BIGINT AS c
      FROM scoped
      GROUP BY 1
    ),
    recent AS (
      SELECT *
      FROM filtered
      ORDER BY ngay_yeu_cau DESC NULLS LAST, id DESC
      LIMIT 20
    )
    SELECT jsonb_build_object(
      'totalRequests', COALESCE((SELECT COUNT(*)::BIGINT FROM filtered), 0),
      'openRequests', COALESCE((SELECT COUNT(*)::BIGINT FROM filtered WHERE trang_thai IN ('Chờ xử lý', 'Đã duyệt')), 0),
      'statusCounts', COALESCE((SELECT jsonb_object_agg(k, c) FROM status_counts), '{}'::JSONB),
      'recentRequests',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', id,
              'thiet_bi_id', thiet_bi_id,
              'ngay_yeu_cau', ngay_yeu_cau,
              'trang_thai', trang_thai,
              'mo_ta_su_co', mo_ta_su_co,
              'hang_muc_sua_chua', hang_muc_sua_chua,
              'ngay_hoan_thanh', ngay_hoan_thanh,
              'don_vi_thuc_hien', don_vi_thuc_hien,
              'ten_don_vi_thue', ten_don_vi_thue,
              'ma_thiet_bi', ma_thiet_bi,
              'ten_thiet_bi', ten_thiet_bi,
              'model', model,
              'khoa_phong_quan_ly', khoa_phong_quan_ly,
              'don_vi', don_vi,
              'facility_name', facility_name
            )
          )
          FROM recent
        ),
        '[]'::JSONB
      ),
      'statusFilter', v_status_filter
    )
  );
END;
$function$;

-- Pin search_path on helper functions referenced by the new RPCs
-- to clear Supabase security linter warnings (function_search_path_mutable).
ALTER FUNCTION public._get_jwt_claim(text) SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public._sanitize_ilike_pattern(text) SET search_path TO 'public', 'pg_temp';

GRANT EXECUTE ON FUNCTION public.ai_equipment_lookup(TEXT, INTEGER, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_maintenance_summary(TEXT, TEXT, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_repair_summary(TEXT, BIGINT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.ai_equipment_lookup(TEXT, INTEGER, BIGINT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_maintenance_summary(TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_repair_summary(TEXT, BIGINT, TEXT) FROM PUBLIC;

COMMIT;
