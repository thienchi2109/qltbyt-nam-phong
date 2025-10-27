-- Add Equipment Aggregates RPC for Reports "All Facilities" Feature
-- This function aggregates equipment data across multiple facilities for Reports page
-- Supports both global users (all facilities) and regional_leader (allowed facilities only)
-- Migration Date: 2025-10-27 13:00 UTC

BEGIN;

-- =========================================================================
-- CREATE: equipment_aggregates_for_reports (improved)
-- - Sargable date filters (half-open [from, to) interval)
-- - Branching to avoid OR conditions that defeat indexes
-- - Explicit REVOKE FROM PUBLIC and least-privilege GRANT
-- - Stricter handling for missing don_vi claim on non-privileged roles
-- =========================================================================

CREATE OR REPLACE FUNCTION public.equipment_aggregates_for_reports(
  p_don_vi_array BIGINT[] DEFAULT NULL,
  p_khoa_phong TEXT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed BIGINT[];
  v_facilities_to_query BIGINT[];
  v_total_imported BIGINT := 0;
  v_total_exported BIGINT := 0;
  v_current_stock BIGINT := 0;
  v_result JSONB;
  v_from_ts TIMESTAMPTZ;
  v_to_ts_excl TIMESTAMPTZ;
  v_single_don_vi BIGINT;
BEGIN
  -- 1) Resolve role and allowed facilities
  v_role := lower(COALESCE(
    public._get_jwt_claim('app_role'),
    public._get_jwt_claim('role'),
    ''
  ));
  v_allowed := public.allowed_don_vi_for_session_safe();

  -- 2) Normalize inputs
  -- Treat empty department string as NULL
  IF p_khoa_phong IS NOT NULL AND btrim(p_khoa_phong) = '' THEN
    p_khoa_phong := NULL;
  END IF;

  -- Convert dates to half-open timestamp range [from, to)
  IF p_date_from IS NOT NULL THEN
    v_from_ts := (p_date_from)::timestamptz;
  END IF;
  IF p_date_to IS NOT NULL THEN
    v_to_ts_excl := ((p_date_to + 1))::timestamptz;
  END IF;

  -- 3) Determine facilities to query (authorization-aware)
  IF v_role = 'global' OR v_role = 'admin' THEN
    IF p_don_vi_array IS NULL OR array_length(p_don_vi_array, 1) IS NULL THEN
      v_facilities_to_query := NULL; -- query ALL facilities
    ELSE
      v_facilities_to_query := p_don_vi_array; -- specific subset
    END IF;

  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN jsonb_build_object('totalImported',0,'totalExported',0,'currentStock',0,'netChange',0);
    END IF;

    IF p_don_vi_array IS NULL OR array_length(p_don_vi_array, 1) IS NULL THEN
      v_facilities_to_query := v_allowed; -- all allowed facilities
    ELSE
      SELECT ARRAY_AGG(fid)
      INTO v_facilities_to_query
      FROM UNNEST(p_don_vi_array) AS fid
      WHERE fid = ANY(v_allowed);

      IF v_facilities_to_query IS NULL OR array_length(v_facilities_to_query,1) IS NULL THEN
        RAISE EXCEPTION 'Access denied to requested facilities'
          USING ERRCODE = '42501';
      END IF;
    END IF;

  ELSE
    -- Other roles: require a valid single-facility claim
    v_single_don_vi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
    IF v_single_don_vi IS NULL THEN
      RAISE EXCEPTION 'Missing don_vi claim for role %', v_role USING ERRCODE = '42501';
    END IF;
    v_facilities_to_query := ARRAY[v_single_don_vi];
  END IF;

  -- 4) Calculate totals with branch (no OR on indexed columns)
  -- 4a) Total imported (equipment created within date range)
  IF v_facilities_to_query IS NULL THEN
    SELECT COUNT(*) INTO v_total_imported
    FROM public.thiet_bi tb
    WHERE (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND (v_from_ts IS NULL OR tb.created_at >= v_from_ts)
      AND (v_to_ts_excl IS NULL OR tb.created_at < v_to_ts_excl);
  ELSE
    SELECT COUNT(*) INTO v_total_imported
    FROM public.thiet_bi tb
    WHERE tb.don_vi = ANY(v_facilities_to_query)
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND (v_from_ts IS NULL OR tb.created_at >= v_from_ts)
      AND (v_to_ts_excl IS NULL OR tb.created_at < v_to_ts_excl);
  END IF;

  -- 4b) Total exported (transfers/liquidations completed within date range)
  IF v_facilities_to_query IS NULL THEN
    SELECT COUNT(DISTINCT ylc.thiet_bi_id) INTO v_total_exported
    FROM public.yeu_cau_luan_chuyen ylc
    INNER JOIN public.thiet_bi tb ON ylc.thiet_bi_id = tb.id
    WHERE (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND ylc.trang_thai IN ('da_ban_giao', 'hoan_thanh')
      AND (
        (ylc.loai_hinh IN ('noi_bo','ben_ngoai') AND ylc.ngay_ban_giao IS NOT NULL
         AND (v_from_ts IS NULL OR ylc.ngay_ban_giao >= v_from_ts)
         AND (v_to_ts_excl IS NULL OR ylc.ngay_ban_giao < v_to_ts_excl))
        OR
        (ylc.muc_dich = 'thanh_ly' AND ylc.ngay_hoan_thanh IS NOT NULL
         AND (v_from_ts IS NULL OR ylc.ngay_hoan_thanh >= v_from_ts)
         AND (v_to_ts_excl IS NULL OR ylc.ngay_hoan_thanh < v_to_ts_excl))
      );
  ELSE
    SELECT COUNT(DISTINCT ylc.thiet_bi_id) INTO v_total_exported
    FROM public.yeu_cau_luan_chuyen ylc
    INNER JOIN public.thiet_bi tb ON ylc.thiet_bi_id = tb.id
    WHERE tb.don_vi = ANY(v_facilities_to_query)
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND ylc.trang_thai IN ('da_ban_giao', 'hoan_thanh')
      AND (
        (ylc.loai_hinh IN ('noi_bo','ben_ngoai') AND ylc.ngay_ban_giao IS NOT NULL
         AND (v_from_ts IS NULL OR ylc.ngay_ban_giao >= v_from_ts)
         AND (v_to_ts_excl IS NULL OR ylc.ngay_ban_giao < v_to_ts_excl))
        OR
        (ylc.muc_dich = 'thanh_ly' AND ylc.ngay_hoan_thanh IS NOT NULL
         AND (v_from_ts IS NULL OR ylc.ngay_hoan_thanh >= v_from_ts)
         AND (v_to_ts_excl IS NULL OR ylc.ngay_hoan_thanh < v_to_ts_excl))
      );
  END IF;

  -- 4c) Current stock (no date filter)
  IF v_facilities_to_query IS NULL THEN
    SELECT COUNT(*) INTO v_current_stock
    FROM public.thiet_bi tb
    WHERE (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong);
  ELSE
    SELECT COUNT(*) INTO v_current_stock
    FROM public.thiet_bi tb
    WHERE tb.don_vi = ANY(v_facilities_to_query)
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong);
  END IF;

  -- 5) Build result JSON
  v_result := jsonb_build_object(
    'totalImported', COALESCE(v_total_imported, 0),
    'totalExported', COALESCE(v_total_exported, 0),
    'currentStock', COALESCE(v_current_stock, 0),
    'netChange', COALESCE(v_total_imported, 0) - COALESCE(v_total_exported, 0)
  );

  RETURN v_result;
END;
$$;

-- Enforce least-privilege execution
REVOKE ALL ON FUNCTION public.equipment_aggregates_for_reports(
  BIGINT[], TEXT, DATE, DATE
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equipment_aggregates_for_reports(
  BIGINT[], TEXT, DATE, DATE
) TO authenticated;

-- Documentation
COMMENT ON FUNCTION public.equipment_aggregates_for_reports(BIGINT[], TEXT, DATE, DATE) IS
'Returns aggregated equipment statistics across multiple facilities for Reports page.
Authorization:
- Global/admin: can aggregate across all facilities or specified subset
- Regional leader: aggregates only across allowed facilities (from allowed_don_vi_for_session_safe)
- Other roles: must include a valid don_vi claim, else 42501 is raised

Parameters:
- p_don_vi_array: Array of facility IDs to aggregate (NULL = all allowed)
- p_khoa_phong: Department filter (NULL or empty = all departments)
- p_date_from, p_date_to: Date bounds for half-open interval [from, to) used on timestamps

Returns JSONB:
{
  "totalImported": number,    -- Equipment created in date range
  "totalExported": number,    -- Equipment transferred/liquidated in date range (DISTINCT thiet_bi_id)
  "currentStock": number,     -- Total current equipment count (no date filter)
  "netChange": number         -- totalImported - totalExported
}

Security:
- SECURITY DEFINER with search_path = public, pg_temp
- Facility access validated via allowed_don_vi_for_session_safe()
- PUBLIC execute revoked; granted to authenticated only';

COMMIT;
