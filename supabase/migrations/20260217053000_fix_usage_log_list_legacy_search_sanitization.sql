-- Migration: Sanitize legacy usage_log_list search pattern input
-- Date: 2026-02-17
-- Issue: usage_log_list(text,...) used raw p_q in ILIKE patterns.

BEGIN;

CREATE OR REPLACE FUNCTION public.usage_log_list(
  p_q text DEFAULT NULL::text,
  p_status text DEFAULT NULL::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 100,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_don_vi bigint DEFAULT NULL::bigint
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_is_global BOOLEAN := false;
  v_allowed BIGINT[] := public.allowed_don_vi_for_session();
  v_effective BIGINT[] := NULL;
  v_offset INT := GREATEST(p_page - 1, 0) * GREATEST(p_page_size, 1);
  v_sanitized_q TEXT := NULL;
BEGIN
  v_is_global := v_role IN ('global', 'admin');
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  IF v_is_global THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;
    END IF;
  ELSE
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;

    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := v_allowed;
    END IF;
  END IF;

  IF v_effective IS NOT NULL AND array_length(v_effective, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT to_jsonb(nk)
    || jsonb_build_object(
      'thiet_bi', to_jsonb(tb),
      'equipment_is_deleted', tb.is_deleted
    )
    || jsonb_build_object('nguoi_su_dung', to_jsonb(u))
  FROM public.nhat_ky_su_dung nk
  LEFT JOIN public.thiet_bi tb ON nk.thiet_bi_id = tb.id
  LEFT JOIN public.nhan_vien u ON nk.nguoi_su_dung_id = u.id
  WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
    AND (p_status IS NULL OR nk.trang_thai = p_status)
    AND (p_date_from IS NULL OR nk.thoi_gian_bat_dau::date >= p_date_from)
    AND (p_date_to IS NULL OR nk.thoi_gian_bat_dau::date <= p_date_to)
    AND (
      v_sanitized_q IS NULL OR
      tb.ten_thiet_bi ILIKE '%' || v_sanitized_q || '%' OR
      tb.ma_thiet_bi ILIKE '%' || v_sanitized_q || '%'
    )
  ORDER BY nk.thoi_gian_bat_dau DESC
  OFFSET v_offset
  LIMIT p_page_size;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.usage_log_list(TEXT, TEXT, INT, INT, DATE, DATE, BIGINT) TO authenticated;

COMMIT;
