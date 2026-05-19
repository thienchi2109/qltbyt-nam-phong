-- Fix Issue #512 follow-up after review:
-- - keep dashboard_maintenance_count aligned with dashboard_equipment_total by
--   excluding soft-deleted equipment
-- - keep repair/header badge counts from including requests linked to
--   soft-deleted equipment
-- - preserve the regional_leader null-don_vi contract in
--   maintenance_plan_status_counts
--
-- The original Issue #512 migration was already applied as
-- 20260518152809_scope_dashboard_badges_to_user_department. This follow-up
-- preserves that applied migration and supersedes only the affected RPC.

BEGIN;

CREATE OR REPLACE FUNCTION public.dashboard_maintenance_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_jwt_claims jsonb;
  v_role text;
  v_user_id text;
  v_allowed_don_vi bigint[];
  v_department_scope text;
  result integer;
BEGIN
  v_jwt_claims := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  v_role := lower(COALESCE(v_jwt_claims->>'app_role', v_jwt_claims->>'role', ''));
  v_user_id := NULLIF(COALESCE(v_jwt_claims->>'user_id', v_jwt_claims->>'sub'), '');

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF v_role <> 'global'
     AND (v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL) THEN
    RETURN 0;
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims->>'khoa_phong');
    IF v_department_scope IS NULL THEN
      RETURN 0;
    END IF;
  END IF;

  SELECT COUNT(*)::integer INTO result
  FROM public.thiet_bi tb
  WHERE tb.is_deleted = false
    AND (
      v_role = 'global'
      OR tb.don_vi = ANY(v_allowed_don_vi)
    )
    AND (
      v_role <> 'user'
      OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope
    )
    AND (
      tb.tinh_trang_hien_tai ILIKE '%Chờ bảo trì%'
      OR tb.tinh_trang_hien_tai ILIKE '%Chờ hiệu chuẩn%'
      OR tb.tinh_trang_hien_tai ILIKE '%Chờ kiểm định%'
      OR tb.tinh_trang_hien_tai ILIKE '%bảo trì%'
      OR tb.tinh_trang_hien_tai ILIKE '%hiệu chuẩn%'
      OR tb.tinh_trang_hien_tai ILIKE '%kiểm định%'
    );

  RETURN COALESCE(result, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_repair_request_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_jwt_claims jsonb;
  v_role text;
  v_user_id text;
  v_allowed_don_vi bigint[];
  v_department_scope text;
  result jsonb;
BEGIN
  v_jwt_claims := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  v_role := lower(COALESCE(v_jwt_claims->>'app_role', v_jwt_claims->>'role', ''));
  v_user_id := NULLIF(COALESCE(v_jwt_claims->>'user_id', v_jwt_claims->>'sub'), '');

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF v_role <> 'global'
     AND (v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL) THEN
    RETURN jsonb_build_object('total', 0, 'pending', 0, 'approved', 0, 'completed', 0);
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims->>'khoa_phong');
    IF v_department_scope IS NULL THEN
      RETURN jsonb_build_object('total', 0, 'pending', 0, 'approved', 0, 'completed', 0);
    END IF;
  END IF;

  WITH repair_counts AS (
    SELECT
      COUNT(*) FILTER (WHERE yc.trang_thai = 'Chờ xử lý') AS pending,
      COUNT(*) FILTER (WHERE yc.trang_thai = 'Đã duyệt') AS approved,
      COUNT(*) FILTER (WHERE yc.trang_thai IN ('Hoàn thành', 'Không HT')) AS completed
    FROM public.yeu_cau_sua_chua yc
    INNER JOIN public.thiet_bi tb ON tb.id = yc.thiet_bi_id
    WHERE tb.is_deleted = false
      AND (
        v_role = 'global'
        OR tb.don_vi = ANY(v_allowed_don_vi)
      )
      AND (
        v_role <> 'user'
        OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope
      )
  )
  SELECT jsonb_build_object(
    'total', COALESCE(rc.pending + rc.approved, 0),
    'pending', COALESCE(rc.pending, 0),
    'approved', COALESCE(rc.approved, 0),
    'completed', COALESCE(rc.completed, 0)
  )
  INTO result
  FROM repair_counts rc;

  RETURN COALESCE(result, jsonb_build_object('total', 0, 'pending', 0, 'approved', 0, 'completed', 0));
END;
$function$;

CREATE OR REPLACE FUNCTION public.header_notifications_summary(p_don_vi bigint DEFAULT NULL::bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_jwt_claims jsonb;
  v_role text;
  v_user_id text;
  v_is_global boolean := false;
  v_allowed_don_vi bigint[];
  v_filter_don_vi bigint := NULL;
  v_department_scope text;
  v_repairs bigint := 0;
  v_transfers bigint := 0;
BEGIN
  v_jwt_claims := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  v_role := lower(COALESCE(v_jwt_claims->>'app_role', v_jwt_claims->>'role', ''));
  v_user_id := NULLIF(COALESCE(v_jwt_claims->>'user_id', v_jwt_claims->>'sub'), '');

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;
  v_is_global := v_role = 'global';

  IF NOT v_is_global THEN
    v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

    IF v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL THEN
      RETURN jsonb_build_object('pending_repairs', 0, 'pending_transfers', 0);
    END IF;

    IF p_don_vi IS NOT NULL AND NOT (p_don_vi = ANY(v_allowed_don_vi)) THEN
      RETURN jsonb_build_object('pending_repairs', 0, 'pending_transfers', 0);
    END IF;
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims->>'khoa_phong');
    IF v_department_scope IS NULL THEN
      RETURN jsonb_build_object('pending_repairs', 0, 'pending_transfers', 0);
    END IF;
  END IF;

  IF p_don_vi IS NOT NULL THEN
    v_filter_don_vi := p_don_vi;
  END IF;

  SELECT COUNT(*) INTO v_repairs
  FROM public.yeu_cau_sua_chua r
  INNER JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
  WHERE r.trang_thai IN ('Chờ xử lý', 'Đã duyệt')
    AND tb.is_deleted = false
    AND (
      (v_filter_don_vi IS NOT NULL AND tb.don_vi = v_filter_don_vi)
      OR (v_filter_don_vi IS NULL AND v_is_global)
      OR (v_filter_don_vi IS NULL AND NOT v_is_global AND tb.don_vi = ANY(v_allowed_don_vi))
    )
    AND (
      v_role <> 'user'
      OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope
    );

  SELECT COUNT(*) INTO v_transfers
  FROM public.yeu_cau_luan_chuyen t
  INNER JOIN public.thiet_bi tb ON tb.id = t.thiet_bi_id
  WHERE t.trang_thai IN ('cho_duyet', 'da_duyet')
    AND tb.is_deleted = false
    AND (
      (v_filter_don_vi IS NOT NULL AND tb.don_vi = v_filter_don_vi)
      OR (v_filter_don_vi IS NULL AND v_is_global)
      OR (v_filter_don_vi IS NULL AND NOT v_is_global AND tb.don_vi = ANY(v_allowed_don_vi))
    )
    AND (
      v_role <> 'user'
      OR public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope
    );

  RETURN jsonb_build_object(
    'pending_repairs', COALESCE(v_repairs, 0),
    'pending_transfers', COALESCE(v_transfers, 0)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.maintenance_plan_status_counts(p_don_vi bigint DEFAULT NULL::bigint, p_q text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_jwt_claims jsonb;
  v_role text;
  v_user_id text;
  v_don_vi bigint;
  v_is_global boolean := false;
  v_allowed_don_vi bigint[];
  v_department_scope text;
  v_result jsonb;
  v_sanitized_q text;
BEGIN
  v_jwt_claims := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  v_role := lower(COALESCE(v_jwt_claims->>'app_role', v_jwt_claims->>'role', ''));
  v_user_id := NULLIF(COALESCE(v_jwt_claims->>'user_id', v_jwt_claims->>'sub'), '');
  v_don_vi := NULLIF(v_jwt_claims->>'don_vi', '')::bigint;

  IF v_role IS NULL OR v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;
  v_is_global := v_role = 'global';

  IF v_role NOT IN ('global', 'regional_leader') AND v_don_vi IS NULL THEN
    RAISE EXCEPTION 'Missing don_vi claim' USING ERRCODE = '42501';
  END IF;

  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  IF NOT v_is_global AND (v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL) THEN
    RETURN jsonb_build_object('Bản nháp', 0, 'Đã duyệt', 0, 'Không duyệt', 0);
  END IF;

  IF NOT v_is_global AND p_don_vi IS NOT NULL AND NOT (p_don_vi = ANY(v_allowed_don_vi)) THEN
    RAISE EXCEPTION 'Access denied to facility %', p_don_vi
      USING ERRCODE = '42501',
            HINT = 'You do not have permission to access this facility';
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(v_jwt_claims->>'khoa_phong');
    IF v_department_scope IS NULL THEN
      RETURN jsonb_build_object('Bản nháp', 0, 'Đã duyệt', 0, 'Không duyệt', 0);
    END IF;
  END IF;

  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  SELECT jsonb_build_object(
    'Bản nháp', COALESCE(SUM(CASE WHEN kh.trang_thai = 'Bản nháp' THEN 1 ELSE 0 END), 0),
    'Đã duyệt', COALESCE(SUM(CASE WHEN kh.trang_thai = 'Đã duyệt' THEN 1 ELSE 0 END), 0),
    'Không duyệt', COALESCE(SUM(CASE WHEN kh.trang_thai = 'Không duyệt' THEN 1 ELSE 0 END), 0)
  )
  INTO v_result
  FROM public.ke_hoach_bao_tri kh
  LEFT JOIN public.don_vi dv ON kh.don_vi = dv.id
  WHERE (
      v_sanitized_q IS NULL
      OR kh.ten_ke_hoach ILIKE '%' || v_sanitized_q || '%'
      OR COALESCE(kh.khoa_phong, '') ILIKE '%' || v_sanitized_q || '%'
      OR COALESCE(kh.nguoi_lap_ke_hoach, '') ILIKE '%' || v_sanitized_q || '%'
      OR COALESCE(kh.loai_cong_viec, '') ILIKE '%' || v_sanitized_q || '%'
      OR COALESCE(dv.name, '') ILIKE '%' || v_sanitized_q || '%'
      OR CAST(kh.nam AS text) ILIKE '%' || v_sanitized_q || '%'
    )
    AND (
      CASE
        WHEN p_don_vi IS NOT NULL THEN kh.don_vi = p_don_vi
        ELSE v_is_global OR kh.don_vi = ANY(v_allowed_don_vi)
      END
    )
    AND (
      v_role <> 'user'
      OR public._normalize_department_scope(kh.khoa_phong) = v_department_scope
    );

  RETURN COALESCE(v_result, jsonb_build_object('Bản nháp', 0, 'Đã duyệt', 0, 'Không duyệt', 0));
END;
$function$;

COMMIT;
