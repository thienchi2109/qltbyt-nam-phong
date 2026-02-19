-- Migration: Fix equipment_count missing search_path and unsanitized ILIKE
-- Date: 2026-02-19
--
-- Issues fixed:
--   1. SECURITY DEFINER without SET search_path — leaves the function open to
--      search_path hijacking. A malicious user could place objects in a schema
--      that appears before 'public' and intercept calls to internal helpers.
--      Fix: add SET search_path TO 'public', 'pg_temp' (matches all other
--      SECURITY DEFINER functions in this codebase).
--
--   2. Raw p_q passed to ILIKE patterns — a search for '%' matches every row,
--      '_' matches any single character, breaking result isolation.
--      Fix: sanitize via _sanitize_ilike_pattern(p_q) before use, matching the
--      pattern established in 20260218203500 (equipment_count) and
--      20260219023519 (equipment_count_enhanced).
--
-- Note: both branches (global and non-global) are patched. The GRANT is
-- re-applied for completeness; it was present in the original definition.

BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_count(
  p_statuses text[] DEFAULT NULL::text[],
  p_q text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role        TEXT     := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed     BIGINT[] := public.allowed_don_vi_for_session();
  v_cnt         BIGINT;
  v_sanitized_q TEXT;
BEGIN
  -- Map admin → global for consistency with equipment_get / equipment_list
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  -- Sanitize ILIKE metacharacters (%, _, \) before embedding in pattern.
  -- _sanitize_ilike_pattern returns NULL for NULL/empty input, so the
  -- v_sanitized_q IS NULL guard below correctly skips the clause when p_q absent.
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  IF v_role = 'global' THEN
    -- Global/admin: count across all tenants (no tenant filter)
    SELECT COUNT(*) INTO v_cnt
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false
      AND (v_sanitized_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || v_sanitized_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || v_sanitized_q || '%'))
      AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));
  ELSE
    -- All other roles (regional_leader, to_qltb, technician, user, etc.):
    -- use allowed_don_vi_for_session() so the count covers exactly the same
    -- set of tenants that equipment_list returns rows for.
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN 0;
    END IF;

    SELECT COUNT(*) INTO v_cnt
    FROM public.thiet_bi tb
    WHERE tb.don_vi = ANY(v_allowed)
      AND tb.is_deleted = false
      AND (v_sanitized_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || v_sanitized_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || v_sanitized_q || '%'))
      AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));
  END IF;

  RETURN COALESCE(v_cnt, 0);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.equipment_count(TEXT[], TEXT) TO authenticated;

COMMIT;
