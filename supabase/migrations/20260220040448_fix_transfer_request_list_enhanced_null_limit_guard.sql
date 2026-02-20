-- Migration: Guard transfer_request_list_enhanced page size against NULL/negative values
-- Date: 2026-02-20
-- Issue: LIMIT/OFFSET must use bounded local v_limit with COALESCE.

BEGIN;

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
SET search_path TO 'public'
AS $function$
DECLARE
  v_role TEXT;
  v_is_global BOOLEAN := false;
  v_allowed BIGINT[];
  v_effective_donvi BIGINT;
  v_effective BIGINT[] := NULL;
  v_limit INT := GREATEST(COALESCE(p_page_size, 100), 1);
  v_offset INT;
  v_sanitized_q TEXT := NULL;
BEGIN
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_is_global := v_role IN ('global', 'admin');
  v_allowed := public.allowed_don_vi_for_session_safe();
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

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
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
    IF v_effective_donvi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for role %', v_role USING ERRCODE = '42501';
    END IF;
    IF p_don_vi IS NOT NULL AND p_don_vi != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi USING ERRCODE = '42501';
    END IF;
    v_effective := ARRAY[v_effective_donvi];
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
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
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

COMMIT;
