-- Migration: Fix transfer_request_list_enhanced for regional_leader
-- Date: 2025-10-08 14:40
-- Purpose: Enable regional_leader to see transfers from ALL facilities in their dia_ban
-- Issue: Current function only uses single don_vi, not multiple facilities in region
-- MANUAL REVIEW REQUIRED - DO NOT AUTO-APPLY

BEGIN;

-- Replace the function to use allowed_don_vi_for_session() for proper regional access
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
        'don_vi', tb.don_vi
      ) as thiet_bi
    FROM public.yeu_cau_luan_chuyen yc
    LEFT JOIN public.thiet_bi tb ON yc.thiet_bi_id = tb.id
    WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))  -- ✅ Uses array check
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

GRANT EXECUTE ON FUNCTION public.transfer_request_list_enhanced(TEXT, TEXT, INTEGER, INTEGER, BIGINT, DATE, DATE, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_request_list_enhanced(TEXT, TEXT, INTEGER, INTEGER, BIGINT, DATE, DATE, TEXT) FROM PUBLIC;

COMMIT;

-- ============================================================================
-- CHANGE SUMMARY
-- ============================================================================
-- Before: Used single don_vi from JWT claim (v_claim_donvi)
-- After:  Uses allowed_don_vi_for_session() which returns array of facilities
--
-- Impact:
-- - regional_leader: NOW sees transfers from ALL facilities in their dia_ban ✅
-- - Other roles: Behavior unchanged ✅
-- - Security: Maintains proper tenant isolation ✅
--
-- The allowed_don_vi_for_session() function already handles:
-- - global: All facilities
-- - regional_leader: All facilities in assigned dia_ban
-- - admin/to_qltb: Single assigned facility
-- - Others: Single assigned facility
