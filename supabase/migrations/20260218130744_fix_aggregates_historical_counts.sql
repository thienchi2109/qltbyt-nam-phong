-- Migration: Fix equipment_aggregates_for_reports to include soft-deleted equipment
--            in historical event counts (totalImported, totalExported).
-- Date: 2026-02-18
-- Rationale: totalImported and totalExported are historical event counts and must
--            include equipment that was later soft-deleted. Only currentStock should
--            filter by is_deleted = false since it reflects current active inventory.

BEGIN;

CREATE OR REPLACE FUNCTION public.equipment_aggregates_for_reports(
  p_don_vi_array bigint[] DEFAULT NULL::bigint[],
  p_khoa_phong text DEFAULT NULL::text,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_allowed bigint[];
  v_facilities_to_query bigint[];
  v_total_imported bigint := 0;
  v_total_exported bigint := 0;
  v_current_stock bigint := 0;
  v_result jsonb;
  v_from_ts timestamptz;
  v_to_ts_excl timestamptz;
  v_single_don_vi bigint;
BEGIN
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();

  IF p_khoa_phong IS NOT NULL AND btrim(p_khoa_phong) = '' THEN
    p_khoa_phong := NULL;
  END IF;

  IF p_date_from IS NOT NULL THEN
    v_from_ts := (p_date_from)::timestamptz;
  END IF;
  IF p_date_to IS NOT NULL THEN
    v_to_ts_excl := ((p_date_to + 1))::timestamptz;
  END IF;

  IF v_role IN ('global', 'admin') THEN
    IF p_don_vi_array IS NULL OR array_length(p_don_vi_array, 1) IS NULL THEN
      v_facilities_to_query := NULL;
    ELSE
      v_facilities_to_query := p_don_vi_array;
    END IF;
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object('totalImported', 0, 'totalExported', 0, 'currentStock', 0, 'netChange', 0);
    END IF;

    IF p_don_vi_array IS NULL OR array_length(p_don_vi_array, 1) IS NULL THEN
      v_facilities_to_query := v_allowed;
    ELSE
      SELECT ARRAY_AGG(fid)
      INTO v_facilities_to_query
      FROM UNNEST(p_don_vi_array) AS fid
      WHERE fid = ANY(v_allowed);

      IF v_facilities_to_query IS NULL OR array_length(v_facilities_to_query, 1) IS NULL THEN
        RAISE EXCEPTION 'Access denied to requested facilities' USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSE
    v_single_don_vi := NULLIF(public._get_jwt_claim('don_vi'), '')::bigint;
    IF v_single_don_vi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for role %', v_role USING ERRCODE = '42501';
    END IF;
    v_facilities_to_query := ARRAY[v_single_don_vi];
  END IF;

  -- totalImported: historical count of equipment registered in the date range.
  -- Intentionally excludes is_deleted filter — soft-deleted equipment was still
  -- physically imported and must be reflected in the historical record.
  IF v_facilities_to_query IS NULL THEN
    SELECT COUNT(*)
    INTO v_total_imported
    FROM public.thiet_bi tb
    WHERE (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND (v_from_ts IS NULL OR tb.created_at >= v_from_ts)
      AND (v_to_ts_excl IS NULL OR tb.created_at < v_to_ts_excl);
  ELSE
    SELECT COUNT(*)
    INTO v_total_imported
    FROM public.thiet_bi tb
    WHERE tb.don_vi = ANY(v_facilities_to_query)
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND (v_from_ts IS NULL OR tb.created_at >= v_from_ts)
      AND (v_to_ts_excl IS NULL OR tb.created_at < v_to_ts_excl);
  END IF;

  -- totalExported: historical count of equipment transferred/disposed in the date range.
  -- Intentionally excludes is_deleted filter — the transfer/disposal event occurred
  -- regardless of the equipment's current soft-delete status.
  IF v_facilities_to_query IS NULL THEN
    SELECT COUNT(DISTINCT ylc.thiet_bi_id)
    INTO v_total_exported
    FROM public.yeu_cau_luan_chuyen ylc
    INNER JOIN public.thiet_bi tb ON ylc.thiet_bi_id = tb.id
    WHERE (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND ylc.trang_thai IN ('da_ban_giao', 'hoan_thanh')
      AND (
        (
          ylc.loai_hinh IN ('noi_bo', 'ben_ngoai')
          AND ylc.ngay_ban_giao IS NOT NULL
          AND (v_from_ts IS NULL OR ylc.ngay_ban_giao >= v_from_ts)
          AND (v_to_ts_excl IS NULL OR ylc.ngay_ban_giao < v_to_ts_excl)
        ) OR (
          ylc.muc_dich = 'thanh_ly'
          AND ylc.ngay_hoan_thanh IS NOT NULL
          AND (v_from_ts IS NULL OR ylc.ngay_hoan_thanh >= v_from_ts)
          AND (v_to_ts_excl IS NULL OR ylc.ngay_hoan_thanh < v_to_ts_excl)
        )
      );
  ELSE
    SELECT COUNT(DISTINCT ylc.thiet_bi_id)
    INTO v_total_exported
    FROM public.yeu_cau_luan_chuyen ylc
    INNER JOIN public.thiet_bi tb ON ylc.thiet_bi_id = tb.id
    WHERE tb.don_vi = ANY(v_facilities_to_query)
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND ylc.trang_thai IN ('da_ban_giao', 'hoan_thanh')
      AND (
        (
          ylc.loai_hinh IN ('noi_bo', 'ben_ngoai')
          AND ylc.ngay_ban_giao IS NOT NULL
          AND (v_from_ts IS NULL OR ylc.ngay_ban_giao >= v_from_ts)
          AND (v_to_ts_excl IS NULL OR ylc.ngay_ban_giao < v_to_ts_excl)
        ) OR (
          ylc.muc_dich = 'thanh_ly'
          AND ylc.ngay_hoan_thanh IS NOT NULL
          AND (v_from_ts IS NULL OR ylc.ngay_hoan_thanh >= v_from_ts)
          AND (v_to_ts_excl IS NULL OR ylc.ngay_hoan_thanh < v_to_ts_excl)
        )
      );
  END IF;

  -- currentStock: current active inventory count.
  -- Correctly keeps is_deleted = false — only non-deleted equipment is in stock.
  IF v_facilities_to_query IS NULL THEN
    SELECT COUNT(*)
    INTO v_current_stock
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong);
  ELSE
    SELECT COUNT(*)
    INTO v_current_stock
    FROM public.thiet_bi tb
    WHERE tb.is_deleted = false
      AND tb.don_vi = ANY(v_facilities_to_query)
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong);
  END IF;

  v_result := jsonb_build_object(
    'totalImported', COALESCE(v_total_imported, 0),
    'totalExported', COALESCE(v_total_exported, 0),
    'currentStock', COALESCE(v_current_stock, 0),
    'netChange', COALESCE(v_total_imported, 0) - COALESCE(v_total_exported, 0)
  );

  RETURN v_result;
END;
$function$;

COMMIT;
