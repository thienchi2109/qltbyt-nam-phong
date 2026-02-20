-- Migration: Pin equipment_count SECURITY DEFINER search_path to public
-- Date: 2026-02-20
-- Purpose: Enforce explicit search_path pinning style required by review policy.

BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_count(
  p_statuses text[] DEFAULT NULL::text[],
  p_q text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role        TEXT     := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed     BIGINT[] := public.allowed_don_vi_for_session();
  v_cnt         BIGINT;
  v_sanitized_q TEXT;
BEGIN
  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;

  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  IF v_role = 'global' THEN
    SELECT COUNT(*) INTO v_cnt
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false
      AND (v_sanitized_q IS NULL OR tb.ten_thiet_bi ILIKE ('%' || v_sanitized_q || '%') OR tb.ma_thiet_bi ILIKE ('%' || v_sanitized_q || '%'))
      AND (p_statuses IS NULL OR tb.tinh_trang_hien_tai = ANY(p_statuses));
  ELSE
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
