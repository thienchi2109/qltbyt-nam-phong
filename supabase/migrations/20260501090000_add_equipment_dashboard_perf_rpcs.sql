-- Migration: add bundled equipment filters and dashboard KPI summary RPCs
-- Date: 2026-05-01
-- Scope: performance-only read RPCs for Equipment and Dashboard initial loads
--
-- Notes:
-- - Repo-only until explicitly applied via Supabase MCP.
-- - Keep access semantics aligned with the current tenant and department-scoped
--   equipment read functions.
-- - Reduce browser initial-load fan-out without changing page-visible data.
--
-- Rollback:
-- - Forward-only. Drop the new RPCs and index in a later timestamped migration
--   if this batch must be reverted.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_ycsc_active_equipment_status_requested_desc
ON public.yeu_cau_sua_chua (thiet_bi_id, trang_thai, ngay_yeu_cau DESC, id DESC)
WHERE trang_thai IN ('Chờ xử lý', 'Đã duyệt');

CREATE OR REPLACE FUNCTION public.equipment_filter_buckets(p_don_vi bigint DEFAULT NULL::bigint)
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

  WITH scoped_equipment AS MATERIALIZED (
    SELECT
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
  )
  SELECT jsonb_build_object(
    'department', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', bucket.name, 'count', bucket.count) ORDER BY bucket.count DESC, bucket.name)
      FROM (
        SELECT department_name AS name, COUNT(*)::integer AS count
        FROM scoped_equipment
        GROUP BY department_name
      ) bucket
    ), '[]'::jsonb),
    'user', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', bucket.name, 'count', bucket.count) ORDER BY bucket.count DESC, bucket.name)
      FROM (
        SELECT user_name AS name, COUNT(*)::integer AS count
        FROM scoped_equipment
        GROUP BY user_name
      ) bucket
    ), '[]'::jsonb),
    'location', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', bucket.name, 'count', bucket.count) ORDER BY bucket.count DESC, bucket.name)
      FROM (
        SELECT location_name AS name, COUNT(*)::integer AS count
        FROM scoped_equipment
        GROUP BY location_name
      ) bucket
    ), '[]'::jsonb),
    'status', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', bucket.name, 'count', bucket.count) ORDER BY bucket.count DESC, bucket.name)
      FROM (
        SELECT status_name AS name, COUNT(*)::integer AS count
        FROM scoped_equipment
        GROUP BY status_name
      ) bucket
    ), '[]'::jsonb),
    'classification', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', bucket.name, 'count', bucket.count) ORDER BY bucket.count DESC, bucket.name)
      FROM (
        SELECT classification_name AS name, COUNT(*)::integer AS count
        FROM scoped_equipment
        GROUP BY classification_name
      ) bucket
    ), '[]'::jsonb),
    'fundingSource', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', bucket.name, 'count', bucket.count) ORDER BY bucket.count DESC, bucket.name)
      FROM (
        SELECT funding_source_name AS name, COUNT(*)::integer AS count
        FROM scoped_equipment
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

CREATE OR REPLACE FUNCTION public.dashboard_kpi_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_user_id text;
  v_jwt_claims jsonb;
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

  RETURN jsonb_build_object(
    'totalEquipment', public.dashboard_equipment_total(),
    'maintenanceCount', public.dashboard_maintenance_count(),
    'repairRequests', public.dashboard_repair_request_stats(),
    'maintenancePlans', public.dashboard_maintenance_plan_stats()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.equipment_filter_buckets(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_filter_buckets(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipment_filter_buckets(bigint) TO service_role;

REVOKE ALL ON FUNCTION public.dashboard_kpi_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_kpi_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_kpi_summary() TO service_role;

COMMENT ON FUNCTION public.equipment_filter_buckets(bigint) IS
  'Returns all equipment filter option buckets in one scoped RPC for faster Equipment initial load.';

COMMENT ON FUNCTION public.dashboard_kpi_summary() IS
  'Returns Dashboard KPI card payload in one scoped RPC for faster Dashboard initial load.';

COMMIT;
