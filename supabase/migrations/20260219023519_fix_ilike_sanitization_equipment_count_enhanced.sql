-- Migration: Apply _sanitize_ilike_pattern to equipment_count_enhanced
-- Date: 2026-02-19
--
-- Background: equipment_count used raw p_q in its ILIKE condition, which was
-- fixed in 20260218203500. The companion equipment_count_enhanced function
-- (defined in 20260213100000) has the same issue at line 138:
--
--   AND (p_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || p_q || '%') OR ...)
--
-- A search for literal '%' would match every row; '_' would match any single
-- character. This change adds v_sanitized_q via _sanitize_ilike_pattern(p_q)
-- and replaces the raw p_q reference, matching the pattern established in
-- equipment_count and the other RPCs already fixed.

BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_count_enhanced(
  p_statuses text[] DEFAULT NULL::text[],
  p_q text DEFAULT NULL::text,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_khoa_phong text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_allowed bigint[];
  v_effective_donvi bigint;
  v_cnt bigint;
  v_sanitized_q TEXT;
BEGIN
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();

  IF v_role IN ('global', 'admin') THEN
    v_effective_donvi := p_don_vi;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN 0;
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
        RETURN 0;
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

  -- Sanitize ILIKE metacharacters (%, _, \) before embedding in pattern.
  -- _sanitize_ilike_pattern returns NULL for NULL/empty input, so the
  -- v_sanitized_q IS NULL guard below correctly skips the clause when p_q absent.
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  SELECT COUNT(*)
  INTO v_cnt
  FROM public.thiet_bi tb
  WHERE tb.is_deleted = false
    AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
    AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
    AND (v_sanitized_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || v_sanitized_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || v_sanitized_q || '%'))
    AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));

  RETURN COALESCE(v_cnt, 0);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.equipment_count_enhanced(TEXT[], TEXT, BIGINT, TEXT) TO authenticated;

COMMIT;
