-- Migration: Add facility_name and facility_id to transfer_request_list_enhanced
-- Date: October 8, 2025
-- Purpose: Enable client-side facility filtering for regional leaders in transfer requests page
-- Related: Consistency with maintenance, equipment, and repair-requests pages

-- BEFORE: thiet_bi object only included equipment fields, no facility name
-- AFTER: thiet_bi object includes facility_name and facility_id for dropdown filtering

CREATE OR REPLACE FUNCTION public.transfer_request_list_enhanced(
  p_q TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 100,
  p_don_vi BIGINT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_khoa_phong TEXT DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_role TEXT;
  v_allowed BIGINT[];
  v_effective BIGINT[];
  v_offset INT;
BEGIN
  -- Get user role
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  
  -- Get allowed facilities for this user (handles regional_leader multi-facility access)
  v_allowed := public.allowed_don_vi_for_session();
  
  -- Determine effective facility filter
  IF v_role = 'global' THEN
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;  -- All facilities
    END IF;
  ELSE
    -- For non-global users (including regional_leader)
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;  -- No access
    END IF;

    IF p_don_vi IS NOT NULL THEN
      -- Validate requested facility is in allowed list
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for tenant %', p_don_vi USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      -- Use all allowed facilities (important for regional_leader)
      v_effective := v_allowed;
    END IF;
  END IF;

  -- Check if effective filter is empty
  IF v_effective IS NOT NULL AND array_length(v_effective, 1) IS NULL THEN
    RETURN;
  END IF;

  v_offset := GREATEST((p_page - 1), 0) * GREATEST(p_page_size, 1);

  RETURN QUERY
  SELECT to_jsonb(row) FROM (
    SELECT 
      yc.*,
      jsonb_build_object(
        'id', tb.id,
        'ma_thiet_bi', tb.ma_thiet_bi,
        'ten_thiet_bi', tb.ten_thiet_bi,
        'model', tb.model,
        'serial', tb.serial,
        'khoa_phong_quan_ly', tb.khoa_phong_quan_ly,
        'don_vi', tb.don_vi,
        'facility_name', dv.name,      -- ✅ NEW: Facility name for UI display
        'facility_id', tb.don_vi       -- ✅ NEW: Explicit facility ID
      ) as thiet_bi,
      -- Restore user information for TransferDetailDialog
      -- Use to_jsonb() to include all nhan_vien columns automatically
      to_jsonb(nyc.*) as nguoi_yeu_cau,
      to_jsonb(nd.*) as nguoi_duyet
    FROM public.yeu_cau_luan_chuyen yc
    LEFT JOIN public.thiet_bi tb ON yc.thiet_bi_id = tb.id
    LEFT JOIN public.don_vi dv ON dv.id = tb.don_vi  -- ✅ NEW: Join to get facility name
    LEFT JOIN public.nhan_vien nyc ON yc.nguoi_yeu_cau_id = nyc.id
    LEFT JOIN public.nhan_vien nd ON yc.nguoi_duyet_id = nd.id
    WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
      AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
      AND (p_status IS NULL OR yc.trang_thai = p_status)
      AND (p_date_from IS NULL OR yc.created_at::date >= p_date_from)
      AND (p_date_to IS NULL OR yc.created_at::date <= p_date_to)
      AND (p_q IS NULL OR (
        tb.ten_thiet_bi ILIKE '%' || p_q || '%' OR 
        tb.ma_thiet_bi ILIKE '%' || p_q || '%'
      ))
    ORDER BY yc.created_at DESC
    OFFSET v_offset LIMIT p_page_size
  ) row;
END;
$$;

-- Maintain existing grants
GRANT EXECUTE ON FUNCTION public.transfer_request_list_enhanced(TEXT, TEXT, INTEGER, INTEGER, BIGINT, DATE, DATE, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_list_enhanced(TEXT, TEXT, INTEGER, INTEGER, BIGINT, DATE, DATE, TEXT) FROM PUBLIC;

-- Migration notes:
-- 1. Added LEFT JOIN to don_vi table to retrieve facility name
-- 2. Extended thiet_bi JSONB object with facility_name and facility_id
-- 3. Maintains backward compatibility - existing callers still work
-- 4. Enables client-side facility filtering for regional leaders
-- 5. Security model unchanged - still uses allowed_don_vi_for_session()
-- 6. No breaking changes - only adds new fields to response
