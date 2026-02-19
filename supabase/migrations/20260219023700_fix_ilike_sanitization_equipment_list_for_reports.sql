-- Migration: Apply _sanitize_ilike_pattern to equipment_list_for_reports
-- Date: 2026-02-19
--
-- Background: equipment_list_for_reports (defined in 20260213100000) builds
-- ILIKE pattern as ('%' || COALESCE(p_q, '') || '%') and passes raw p_q as
-- the $3 null-guard in the USING clause. A search for literal '%' matches
-- every row; '_' matches any single character.
--
-- Fix: add v_sanitized_q via _sanitize_ilike_pattern(p_q) and pass it as
-- both the $3 null-guard and the basis for the $5 pattern in the USING clause.
-- The format string (line 73 in the original) is unchanged — $5 is still the
-- fully-built pattern and $3 IS NULL continues to serve as the skip guard.
-- _sanitize_ilike_pattern returns NULL for NULL/empty input, so the $3 IS NULL
-- guard naturally skips the clause when p_q is absent.

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
  v_sanitized_q TEXT;
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
  v_offset := GREATEST((p_page - 1), 0) * GREATEST(p_page_size, 1);

  -- Sanitize ILIKE metacharacters (%, _, \) before embedding in pattern.
  -- _sanitize_ilike_pattern returns NULL for NULL/empty input, so the
  -- $3 IS NULL guard in the query correctly skips the clause when p_q is absent.
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

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
  ) USING v_effective_donvi, p_khoa_phong, v_sanitized_q, v_offset, ('%' || COALESCE(v_sanitized_q, '') || '%'), p_page_size;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.equipment_list_for_reports(TEXT, TEXT, INT, INT, BIGINT, TEXT) TO authenticated;

COMMIT;
