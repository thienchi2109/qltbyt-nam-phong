-- Migration: align inventory report detail RPCs with role=user department scope
-- Date: 2026-04-23
-- Issue: #313
--
-- Notes:
-- - Keep the public.equipment_list_for_reports(TEXT, TEXT, INT, INT, BIGINT, TEXT)
--   signature unchanged.
-- - Keep the public.transfer_request_list_enhanced(TEXT, TEXT, INT, INT, BIGINT, DATE, DATE, TEXT)
--   signature unchanged.
-- - Preserve existing non-user behavior for global/admin/regional_leader and
--   other tenant-scoped roles.
-- - Reuse public._normalize_department_scope(text) so role=user report detail
--   rows follow the same normalized department contract as #301/#306.
-- - Fail closed to empty result sets for role=user when the khoa_phong claim is
--   blank/missing or when the requested department does not normalize to the
--   user's department scope.
--
-- Rollback:
-- - Forward-only. Restore the previous function bodies in a new timestamped
--   migration if this behavior must be reverted.

BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_list_for_reports(
  p_q text DEFAULT NULL::text,
  p_sort text DEFAULT 'id.asc'::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 10000,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_khoa_phong text DEFAULT NULL::text
)
RETURNS SETOF public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_allowed bigint[];
  v_effective_donvi bigint;
  v_sort_col text;
  v_sort_dir text;
  v_offset int;
  v_limit int;
  v_sanitized_q text;
  v_department_scope text;
  v_requested_department_scope text;
BEGIN
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
    ELSE
      v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
      IF v_effective_donvi IS NULL THEN
        RETURN;
      END IF;
    END IF;
  ELSE
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
    IF v_effective_donvi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for role %', v_role USING ERRCODE = '42501';
    END IF;

    IF p_don_vi IS NOT NULL AND p_don_vi != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(public._get_jwt_claim('khoa_phong'));
    IF v_department_scope IS NULL THEN
      RETURN;
    END IF;

    IF p_khoa_phong IS NOT NULL THEN
      v_requested_department_scope := public._normalize_department_scope(p_khoa_phong);
      IF v_requested_department_scope IS DISTINCT FROM v_department_scope THEN
        RETURN;
      END IF;
    END IF;
  END IF;

  v_sort_col := split_part(p_sort, '.', 1);
  v_sort_dir := CASE lower(split_part(p_sort, '.', 2)) WHEN 'desc' THEN 'DESC' ELSE 'ASC' END;
  IF v_sort_col NOT IN ('id', 'ten_thiet_bi', 'ma_thiet_bi', 'khoa_phong_quan_ly', 'don_vi') THEN
    v_sort_col := 'id';
  END IF;

  v_limit := GREATEST(COALESCE(p_page_size, 10000), 1);
  v_offset := GREATEST((p_page - 1), 0) * v_limit;
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  RETURN QUERY EXECUTE format(
    'SELECT * FROM public.thiet_bi
     WHERE is_deleted = false
       AND ($1::bigint IS NULL OR don_vi = $1)
       AND (
         ($7::text IS NOT NULL AND public._normalize_department_scope(khoa_phong_quan_ly) = $7)
         OR
         ($7::text IS NULL AND ($2::text IS NULL OR khoa_phong_quan_ly = $2))
       )
       AND ($3::text IS NULL OR ten_thiet_bi ILIKE $5 OR ma_thiet_bi ILIKE $5)
     ORDER BY %I %s
     OFFSET $4 LIMIT $6',
    v_sort_col,
    v_sort_dir
  ) USING
    v_effective_donvi,
    p_khoa_phong,
    v_sanitized_q,
    v_offset,
    ('%' || COALESCE(v_sanitized_q, '') || '%'),
    v_limit,
    CASE WHEN v_role = 'user' THEN v_department_scope ELSE NULL END;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.equipment_list_for_reports(TEXT, TEXT, INT, INT, BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.equipment_list_for_reports(TEXT, TEXT, INT, INT, BIGINT, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.transfer_request_list_enhanced(
  p_q text DEFAULT NULL::text,
  p_status text DEFAULT NULL::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 100,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_khoa_phong text DEFAULT NULL::text
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_is_global boolean := false;
  v_allowed bigint[];
  v_effective_donvi bigint;
  v_effective bigint[] := NULL;
  v_limit int := GREATEST(COALESCE(p_page_size, 100), 1);
  v_offset int;
  v_sanitized_q text := NULL;
  v_department_scope text;
  v_requested_department_scope text;
BEGIN
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_is_global := v_role IN ('global', 'admin');
  v_allowed := public.allowed_don_vi_for_session_safe();
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  IF v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_is_global THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective := ARRAY[p_don_vi];
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
      END IF;
    ELSE
      v_effective := v_allowed;
    END IF;
  ELSE
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
    IF v_effective_donvi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for role %', v_role USING ERRCODE = '42501';
    END IF;
    IF p_don_vi IS NOT NULL AND p_don_vi != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
    END IF;
    v_effective := ARRAY[v_effective_donvi];
  END IF;

  IF v_role = 'user' THEN
    v_department_scope := public._normalize_department_scope(public._get_jwt_claim('khoa_phong'));
    IF v_department_scope IS NULL THEN
      RETURN;
    END IF;

    IF p_khoa_phong IS NOT NULL THEN
      v_requested_department_scope := public._normalize_department_scope(p_khoa_phong);
      IF v_requested_department_scope IS DISTINCT FROM v_department_scope THEN
        RETURN;
      END IF;
    END IF;
  END IF;

  v_offset := GREATEST((COALESCE(p_page, 1) - 1), 0) * v_limit;

  RETURN QUERY
  SELECT to_jsonb(row) FROM (
    SELECT
      yc.*,
      tb.is_deleted AS equipment_is_deleted,
      jsonb_build_object(
        'id', tb.id,
        'ma_thiet_bi', tb.ma_thiet_bi,
        'ten_thiet_bi', tb.ten_thiet_bi,
        'model', tb.model,
        'serial', tb.serial,
        'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
        'don_vi', tb.don_vi,
        'is_deleted', tb.is_deleted
      ) AS thiet_bi
    FROM public.yeu_cau_luan_chuyen yc
    LEFT JOIN public.thiet_bi tb ON yc.thiet_bi_id = tb.id
    WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
      AND (
        (v_role = 'user' AND public._normalize_department_scope(tb.khoa_phong_quan_ly) = v_department_scope)
        OR
        (v_role <> 'user' AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong))
      )
      AND (p_status IS NULL OR yc.trang_thai = p_status)
      AND (p_date_from IS NULL OR yc.created_at::date >= p_date_from)
      AND (p_date_to IS NULL OR yc.created_at::date <= p_date_to)
      AND (
        v_sanitized_q IS NULL OR (
          yc.ma_yeu_cau ILIKE '%' || v_sanitized_q || '%' OR
          yc.ly_do_luan_chuyen ILIKE '%' || v_sanitized_q || '%' OR
          tb.ten_thiet_bi ILIKE '%' || v_sanitized_q || '%' OR
          tb.ma_thiet_bi ILIKE '%' || v_sanitized_q || '%'
        )
      )
    ORDER BY yc.created_at DESC
    OFFSET v_offset LIMIT v_limit
  ) row;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.transfer_request_list_enhanced(TEXT, TEXT, INT, INT, BIGINT, DATE, DATE, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_list_enhanced(TEXT, TEXT, INT, INT, BIGINT, DATE, DATE, TEXT) FROM PUBLIC;

COMMIT;
