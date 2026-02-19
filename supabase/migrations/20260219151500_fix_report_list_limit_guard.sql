-- Migration: Guard LIMIT in equipment_list_for_reports
-- Date: 2026-02-19
--
-- Fix: Replace raw p_page_size in LIMIT $6 with GREATEST(COALESCE(p_page_size, 10000), 1).
--      The offset calculation already used GREATEST(p_page_size, 1) but the actual LIMIT
--      passed p_page_size directly. In PostgreSQL, negative LIMIT means "no limit",
--      allowing a caller to dump all rows by passing p_page_size = -1.

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
BEGIN
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();

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

  v_sort_col := split_part(p_sort, '.', 1);
  v_sort_dir := CASE lower(split_part(p_sort, '.', 2)) WHEN 'desc' THEN 'DESC' ELSE 'ASC' END;
  IF v_sort_col NOT IN ('id', 'ten_thiet_bi', 'ma_thiet_bi', 'khoa_phong_quan_ly', 'don_vi') THEN
    v_sort_col := 'id';
  END IF;

  -- FIX: use guarded limit for both offset and LIMIT to prevent unbounded results
  v_limit := GREATEST(COALESCE(p_page_size, 10000), 1);
  v_offset := GREATEST((p_page - 1), 0) * v_limit;

  RETURN QUERY EXECUTE format(
    'SELECT * FROM public.thiet_bi
     WHERE is_deleted = false
       AND ($1::bigint IS NULL OR don_vi = $1)
       AND ($2::text IS NULL OR khoa_phong_quan_ly = $2)
       AND ($3::text IS NULL OR ten_thiet_bi ILIKE $5 OR ma_thiet_bi ILIKE $5)
     ORDER BY %I %s
     OFFSET $4 LIMIT $6',
    v_sort_col,
    v_sort_dir
  ) USING v_effective_donvi, p_khoa_phong, p_q, v_offset, ('%' || COALESCE(p_q, '') || '%'), v_limit;
END;
$function$;

COMMIT;
