-- Migration: Fix report/historical RPC parameter types and query hardening
-- Date: 2026-02-16
-- Scope:
--   1) equipment_status_distribution legacy overload uses text filters (not bigint)
--   2) repair_request_list and transfer_request_list_enhanced sanitize ILIKE search input
--   3) usage_log_list (historical overload) pins function-level search_path

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Fix legacy equipment_status_distribution overload parameter types
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.equipment_status_distribution(BIGINT, BIGINT, BIGINT);

CREATE OR REPLACE FUNCTION public.equipment_status_distribution(
  p_don_vi bigint DEFAULT NULL::bigint,
  p_khoa_phong text DEFAULT NULL::text,
  p_vi_tri text DEFAULT NULL::text
)
RETURNS TABLE(tinh_trang text, so_luong bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_allowed bigint[];
  v_effective_donvi bigint;
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
      RETURN;
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

  RETURN QUERY
  SELECT
    COALESCE(NULLIF(TRIM(tb.tinh_trang_hien_tai), ''), U&'Kh\00F4ng x\00E1c \0111\1ECBnh') AS tinh_trang,
    COUNT(tb.id)::bigint AS so_luong
  FROM public.thiet_bi tb
  WHERE tb.is_deleted = false
    AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
    AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
    AND (p_vi_tri IS NULL OR tb.vi_tri_lap_dat = p_vi_tri)
  GROUP BY COALESCE(NULLIF(TRIM(tb.tinh_trang_hien_tai), ''), U&'Kh\00F4ng x\00E1c \0111\1ECBnh')
  ORDER BY so_luong DESC;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2) Sanitize pattern input for historical read RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.repair_request_list(
  p_q text DEFAULT NULL::text,
  p_status text DEFAULT NULL::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_don_vi bigint DEFAULT NULL::bigint,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_statuses text[] DEFAULT NULL::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_is_global BOOLEAN := false;
  v_effective_donvi BIGINT := NULL;
  v_allowed BIGINT[] := NULL;
  v_limit INT := GREATEST(COALESCE(p_page_size, 50), 1);
  v_offset INT := GREATEST((COALESCE(p_page, 1) - 1) * v_limit, 0);
  v_total BIGINT := 0;
  v_data JSONB := '[]'::jsonb;
  v_statuses TEXT[] := NULL;
  v_sanitized_q TEXT := NULL;
BEGIN
  v_is_global := v_role IN ('global', 'admin');
  v_sanitized_q := public._sanitize_ilike_pattern(p_q);

  IF p_statuses IS NOT NULL AND array_length(p_statuses, 1) IS NOT NULL THEN
    v_statuses := p_statuses;
  ELSIF p_status IS NOT NULL AND p_status <> '' THEN
    v_statuses := ARRAY[p_status];
  END IF;

  IF v_is_global THEN
    v_effective_donvi := p_don_vi;
  ELSE
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'pageSize', p_page_size);
    END IF;
    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RETURN jsonb_build_object('data', '[]'::jsonb, 'total', 0, 'page', p_page, 'pageSize', p_page_size);
      END IF;
    END IF;
  END IF;

  SELECT count(*) INTO v_total
  FROM public.yeu_cau_sua_chua r
  LEFT JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
  LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
  WHERE (
    (v_is_global AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
    (NOT v_is_global AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
  )
  AND (v_statuses IS NULL OR r.trang_thai = ANY(v_statuses))
  AND (
    v_sanitized_q IS NULL OR
    r.mo_ta_su_co ILIKE '%' || v_sanitized_q || '%' OR
    r.hang_muc_sua_chua ILIKE '%' || v_sanitized_q || '%' OR
    tb.ten_thiet_bi ILIKE '%' || v_sanitized_q || '%' OR
    tb.ma_thiet_bi ILIKE '%' || v_sanitized_q || '%'
  )
  AND (p_date_from IS NULL OR r.ngay_yeu_cau >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
  AND (p_date_to IS NULL OR r.ngay_yeu_cau < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'));

  SELECT COALESCE(jsonb_agg(row_data ORDER BY ngay_yeu_cau DESC), '[]'::jsonb) INTO v_data
  FROM (
    SELECT
      jsonb_build_object(
        'id', r.id,
        'thiet_bi_id', r.thiet_bi_id,
        'ngay_yeu_cau', r.ngay_yeu_cau,
        'trang_thai', r.trang_thai,
        'mo_ta_su_co', r.mo_ta_su_co,
        'hang_muc_sua_chua', r.hang_muc_sua_chua,
        'ngay_mong_muon_hoan_thanh', r.ngay_mong_muon_hoan_thanh,
        'nguoi_yeu_cau', r.nguoi_yeu_cau,
        'ngay_duyet', r.ngay_duyet,
        'ngay_hoan_thanh', r.ngay_hoan_thanh,
        'nguoi_duyet', r.nguoi_duyet,
        'nguoi_xac_nhan', r.nguoi_xac_nhan,
        'don_vi_thuc_hien', r.don_vi_thuc_hien,
        'ten_don_vi_thue', r.ten_don_vi_thue,
        'ket_qua_sua_chua', r.ket_qua_sua_chua,
        'ly_do_khong_hoan_thanh', r.ly_do_khong_hoan_thanh,
        'equipment_is_deleted', tb.is_deleted,
        'thiet_bi', jsonb_build_object(
          'ten_thiet_bi', tb.ten_thiet_bi,
          'ma_thiet_bi', tb.ma_thiet_bi,
          'model', tb.model,
          'serial', tb.serial,
          'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
          'facility_name', dv.name,
          'facility_id', tb.don_vi,
          'is_deleted', tb.is_deleted
        )
      ) AS row_data,
      r.ngay_yeu_cau
    FROM public.yeu_cau_sua_chua r
    LEFT JOIN public.thiet_bi tb ON tb.id = r.thiet_bi_id
    LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi
    WHERE (
      (v_is_global AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)) OR
      (NOT v_is_global AND ((v_effective_donvi IS NOT NULL AND tb.don_vi = v_effective_donvi) OR (v_effective_donvi IS NULL AND tb.don_vi = ANY(v_allowed))))
    )
    AND (v_statuses IS NULL OR r.trang_thai = ANY(v_statuses))
    AND (
      v_sanitized_q IS NULL OR
      r.mo_ta_su_co ILIKE '%' || v_sanitized_q || '%' OR
      r.hang_muc_sua_chua ILIKE '%' || v_sanitized_q || '%' OR
      tb.ten_thiet_bi ILIKE '%' || v_sanitized_q || '%' OR
      tb.ma_thiet_bi ILIKE '%' || v_sanitized_q || '%'
    )
    AND (p_date_from IS NULL OR r.ngay_yeu_cau >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
    AND (p_date_to IS NULL OR r.ngay_yeu_cau < ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
    ORDER BY r.ngay_yeu_cau DESC
    OFFSET v_offset
    LIMIT v_limit
  ) subq;

  RETURN jsonb_build_object('data', v_data, 'total', v_total, 'page', p_page, 'pageSize', p_page_size);
END;
$function$;

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
  v_role TEXT;
  v_is_global BOOLEAN := false;
  v_allowed BIGINT[];
  v_effective_donvi BIGINT;
  v_effective BIGINT[] := NULL;
  v_limit INT;
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

  v_limit := GREATEST(COALESCE(p_page_size, 100), 1);
  v_offset := GREATEST((p_page - 1), 0) * v_limit;

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

-- ---------------------------------------------------------------------------
-- 3) Harden historical usage_log_list overload search_path
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.usage_log_list(
  BIGINT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT, BIGINT
) SET search_path TO 'public', 'pg_temp';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.equipment_status_distribution(BIGINT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_request_list(TEXT, TEXT, INT, INT, BIGINT, DATE, DATE, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_request_list_enhanced(TEXT, TEXT, INT, INT, BIGINT, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.usage_log_list(BIGINT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT, BIGINT) TO authenticated;

COMMIT;
