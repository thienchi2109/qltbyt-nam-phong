-- HOTFIX: Fix JWT claim error in maintenance_tasks_list_with_equipment
-- Purpose: Enable regional leaders to see equipment from ALL facilities in their assigned dia_ban
-- Migration Date: 2025-10-07 11:12 UTC - HOTFIX for JWT errors
-- Issue: Regional leaders could only see equipment from their primary don_vi, not all facilities in region
-- Solution: Use allowed_don_vi_for_session_safe() helper instead of direct JWT claim
-- MANUAL REVIEW REQUIRED - DO NOT AUTO-APPLY

-- ============================================================================
-- Background
-- ============================================================================
-- The function maintenance_tasks_list_with_equipment was using old single-tenant
-- filtering logic (v_effective_donvi) instead of the regional leader helper
-- function allowed_don_vi_for_session_safe() which returns an array of accessible
-- facilities based on role and dia_ban assignment.
--
-- This caused regional leaders to only see equipment from their primary don_vi
-- instead of all equipment from all facilities in their assigned region.
--
-- All other maintenance RPCs were already updated in 20250927_regional_leader_phase4.sql
-- but this function was missed.
-- ============================================================================

BEGIN;

-- ============================================================================
-- Prerequisites Verification (informational - for manual review)
-- ============================================================================
-- âœ… Helper function allowed_don_vi_for_session_safe() exists and returns bigint[]
-- âœ… Helper is SECURITY DEFINER with safe owner (postgres)
-- âœ… Index idx_thiet_bi_don_vi exists on thiet_bi(don_vi)
-- âœ… Index idx_cong_viec_bao_tri_ke_hoach_id exists
-- âœ… Index idx_cong_viec_bao_tri_thiet_bi_id exists
-- âœ… Role literals verified: 'global', 'regional_leader', 'to_qltb', 'user'
-- ============================================================================

-- Drop the old function first (safer than CREATE OR REPLACE for signature changes)
DROP FUNCTION IF EXISTS public.maintenance_tasks_list_with_equipment(bigint, bigint, text, text);

-- Recreate with proper regional leader support
CREATE FUNCTION public.maintenance_tasks_list_with_equipment(
  p_ke_hoach_id bigint DEFAULT NULL,
  p_thiet_bi_id bigint DEFAULT NULL,
  p_loai_cong_viec text DEFAULT NULL,
  p_don_vi_thuc_hien text DEFAULT NULL
)
RETURNS TABLE(
  id bigint,
  ke_hoach_id bigint,
  thiet_bi_id bigint,
  loai_cong_viec text,
  diem_hieu_chuan text,
  don_vi_thuc_hien text,
  thang_1 boolean,
  thang_2 boolean,
  thang_3 boolean,
  thang_4 boolean,
  thang_5 boolean,
  thang_6 boolean,
  thang_7 boolean,
  thang_8 boolean,
  thang_9 boolean,
  thang_10 boolean,
  thang_11 boolean,
  thang_12 boolean,
  ghi_chu text,
  created_at timestamptz,
  updated_at timestamptz,
  -- Equipment fields (maintained for backward compatibility)
  ma_thiet_bi text,
  ten_thiet_bi text,
  model text,
  khoa_phong_quan_ly text,
  vi_tri_lap_dat text,
  -- Completion status fields
  thang_1_hoan_thanh boolean,
  thang_2_hoan_thanh boolean,
  thang_3_hoan_thanh boolean,
  thang_4_hoan_thanh boolean,
  thang_5_hoan_thanh boolean,
  thang_6_hoan_thanh boolean,
  thang_7_hoan_thanh boolean,
  thang_8_hoan_thanh boolean,
  thang_9_hoan_thanh boolean,
  thang_10_hoan_thanh boolean,
  thang_11_hoan_thanh boolean,
  thang_12_hoan_thanh boolean,
  -- Nested equipment object for frontend compatibility
  thiet_bi jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;
BEGIN
  -- Use allowed_don_vi_for_session_safe() helper for proper multi-tenant filtering
  -- This handles global, regional_leader, and facility-level roles correctly
  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    
    -- Defensive NULL and empty array handling
    -- array_length returns NULL for empty arrays '{}' or NULL arrays
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL OR array_length(v_allowed, 1) = 0 THEN
      -- User has no accessible facilities, return empty result
      -- This is a safe fallback and should not normally occur for valid users
      RETURN;
    END IF;
  END IF;

  -- Return maintenance tasks with equipment info and proper tenant filtering
  RETURN QUERY
  SELECT 
    cv.id,
    cv.ke_hoach_id,
    cv.thiet_bi_id,
    cv.loai_cong_viec,
    cv.diem_hieu_chuan,
    cv.don_vi_thuc_hien,
    cv.thang_1,
    cv.thang_2,
    cv.thang_3,
    cv.thang_4,
    cv.thang_5,
    cv.thang_6,
    cv.thang_7,
    cv.thang_8,
    cv.thang_9,
    cv.thang_10,
    cv.thang_11,
    cv.thang_12,
    cv.ghi_chu,
    cv.created_at,
    cv.updated_at,
    -- Equipment fields (maintained for backward compatibility)
    tb.ma_thiet_bi,
    tb.ten_thiet_bi,
    tb.model,
    tb.khoa_phong_quan_ly,
    tb.vi_tri_lap_dat,
    -- Completion status
    cv.thang_1_hoan_thanh,
    cv.thang_2_hoan_thanh,
    cv.thang_3_hoan_thanh,
    cv.thang_4_hoan_thanh,
    cv.thang_5_hoan_thanh,
    cv.thang_6_hoan_thanh,
    cv.thang_7_hoan_thanh,
    cv.thang_8_hoan_thanh,
    cv.thang_9_hoan_thanh,
    cv.thang_10_hoan_thanh,
    cv.thang_11_hoan_thanh,
    cv.thang_12_hoan_thanh,
    -- Nested equipment object (provides thiet_bi.ma_thiet_bi, thiet_bi.ten_thiet_bi access)
    CASE 
      WHEN tb.id IS NOT NULL THEN
        jsonb_build_object(
          'id', tb.id,
          'ma_thiet_bi', tb.ma_thiet_bi,
          'ten_thiet_bi', tb.ten_thiet_bi,
          'model', COALESCE(tb.model, ''),
          'khoa_phong_quan_ly', COALESCE(tb.khoa_phong_quan_ly, ''),
          'vi_tri_lap_dat', COALESCE(tb.vi_tri_lap_dat, ''),
          'hang_san_xuat', COALESCE(tb.hang_san_xuat, ''),
          'noi_san_xuat', COALESCE(tb.noi_san_xuat, ''),
          'nam_san_xuat', tb.nam_san_xuat,
          'serial', COALESCE(tb.serial, '')
        )
      ELSE NULL
    END as thiet_bi
  FROM public.cong_viec_bao_tri cv
  LEFT JOIN public.thiet_bi tb ON cv.thiet_bi_id = tb.id
  WHERE (p_ke_hoach_id IS NULL OR cv.ke_hoach_id = p_ke_hoach_id)
    AND (p_thiet_bi_id IS NULL OR cv.thiet_bi_id = p_thiet_bi_id)
    AND (p_loai_cong_viec IS NULL OR cv.loai_cong_viec = p_loai_cong_viec)
    AND (p_don_vi_thuc_hien IS NULL OR cv.don_vi_thuc_hien = p_don_vi_thuc_hien)
    AND (
      v_role = 'global'
      OR cv.thiet_bi_id IS NULL
      OR tb.don_vi = ANY(v_allowed)  -- âœ… FIXED: Use array check instead of single value
    )
  ORDER BY cv.created_at DESC;
END;
$$;

-- Set explicit owner to postgres for SECURITY DEFINER safety
ALTER FUNCTION public.maintenance_tasks_list_with_equipment(bigint, bigint, text, text) 
  OWNER TO postgres;

-- Grant execution permission to authenticated users only
-- Note: anon role (non-authenticated) should NOT have access to this function
GRANT EXECUTE ON FUNCTION public.maintenance_tasks_list_with_equipment(bigint, bigint, text, text) TO authenticated;

-- Revoke from public to ensure only authenticated users can call this
REVOKE ALL ON FUNCTION public.maintenance_tasks_list_with_equipment(bigint, bigint, text, text) FROM PUBLIC;

-- Add comment for documentation
COMMENT ON FUNCTION public.maintenance_tasks_list_with_equipment IS 
'Lists maintenance tasks with equipment details. Supports multi-tenant filtering:
- global: All tasks from all tenants
- regional_leader: All tasks from facilities in assigned dia_ban (READ-ONLY)
- Other roles: Tasks from assigned don_vi only

Security: SECURITY DEFINER with owner=postgres, search_path pinned to public,pg_temp.
Access: authenticated role only (not anon).';

COMMIT;

-- ============================================================================
-- Verification Query (run after applying migration)
-- ============================================================================
/*
-- Test as regional_leader user to verify access to all facilities in region
SELECT 
  COUNT(*) as total_tasks,
  COUNT(DISTINCT tb.don_vi) as unique_facilities,
  array_agg(DISTINCT dv.name) as facility_names
FROM maintenance_tasks_list_with_equipment(
  p_ke_hoach_id := NULL,
  p_thiet_bi_id := NULL,
  p_loai_cong_viec := NULL,
  p_don_vi_thuc_hien := NULL
) t
LEFT JOIN thiet_bi tb ON t.thiet_bi_id = tb.id
LEFT JOIN don_vi dv ON tb.don_vi = dv.id;

-- Expected result for regional_leader:
-- Should see tasks from MULTIPLE facilities (not just one)
-- unique_facilities should be > 1 if there are tasks in multiple facilities in the region
*/

-- ============================================================================
-- Rollback Plan (if needed)
-- ============================================================================
/*
BEGIN;

-- Restore the old function (single-tenant filtering)
CREATE OR REPLACE FUNCTION public.maintenance_tasks_list_with_equipment(
  p_ke_hoach_id bigint DEFAULT NULL,
  p_thiet_bi_id bigint DEFAULT NULL,
  p_loai_cong_viec text DEFAULT NULL,
  p_don_vi_thuc_hien text DEFAULT NULL
)
RETURNS TABLE(
  id bigint,
  ke_hoach_id bigint,
  thiet_bi_id bigint,
  loai_cong_viec text,
  diem_hieu_chuan text,
  don_vi_thuc_hien text,
  thang_1 boolean,
  thang_2 boolean,
  thang_3 boolean,
  thang_4 boolean,
  thang_5 boolean,
  thang_6 boolean,
  thang_7 boolean,
  thang_8 boolean,
  thang_9 boolean,
  thang_10 boolean,
  thang_11 boolean,
  thang_12 boolean,
  ghi_chu text,
  created_at timestamptz,
  updated_at timestamptz,
  ma_thiet_bi text,
  ten_thiet_bi text,
  model text,
  khoa_phong_quan_ly text,
  vi_tri_lap_dat text,
  thang_1_hoan_thanh boolean,
  thang_2_hoan_thanh boolean,
  thang_3_hoan_thanh boolean,
  thang_4_hoan_thanh boolean,
  thang_5_hoan_thanh boolean,
  thang_6_hoan_thanh boolean,
  thang_7_hoan_thanh boolean,
  thang_8_hoan_thanh boolean,
  thang_9_hoan_thanh boolean,
  thang_10_hoan_thanh boolean,
  thang_11_hoan_thanh boolean,
  thang_12_hoan_thanh boolean,
  thiet_bi jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
BEGIN
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := NULL;
  ELSE
    v_effective_donvi := v_claim_donvi;
  END IF;

  RETURN QUERY
  SELECT 
    cv.id, cv.ke_hoach_id, cv.thiet_bi_id, cv.loai_cong_viec, cv.diem_hieu_chuan, cv.don_vi_thuc_hien,
    cv.thang_1, cv.thang_2, cv.thang_3, cv.thang_4, cv.thang_5, cv.thang_6,
    cv.thang_7, cv.thang_8, cv.thang_9, cv.thang_10, cv.thang_11, cv.thang_12,
    cv.ghi_chu, cv.created_at, cv.updated_at,
    tb.ma_thiet_bi, tb.ten_thiet_bi, tb.model, tb.khoa_phong_quan_ly, tb.vi_tri_lap_dat,
    cv.thang_1_hoan_thanh, cv.thang_2_hoan_thanh, cv.thang_3_hoan_thanh, cv.thang_4_hoan_thanh,
    cv.thang_5_hoan_thanh, cv.thang_6_hoan_thanh, cv.thang_7_hoan_thanh, cv.thang_8_hoan_thanh,
    cv.thang_9_hoan_thanh, cv.thang_10_hoan_thanh, cv.thang_11_hoan_thanh, cv.thang_12_hoan_thanh,
    CASE WHEN tb.id IS NOT NULL THEN
      jsonb_build_object('id', tb.id, 'ma_thiet_bi', tb.ma_thiet_bi, 'ten_thiet_bi', tb.ten_thiet_bi,
        'model', COALESCE(tb.model, ''), 'khoa_phong_quan_ly', COALESCE(tb.khoa_phong_quan_ly, ''),
        'vi_tri_lap_dat', COALESCE(tb.vi_tri_lap_dat, ''), 'hang_san_xuat', COALESCE(tb.hang_san_xuat, ''),
        'noi_san_xuat', COALESCE(tb.noi_san_xuat, ''), 'nam_san_xuat', tb.nam_san_xuat,
        'serial', COALESCE(tb.serial, ''))
    ELSE NULL END as thiet_bi
  FROM cong_viec_bao_tri cv
  LEFT JOIN thiet_bi tb ON cv.thiet_bi_id = tb.id
  WHERE (p_ke_hoach_id IS NULL OR cv.ke_hoach_id = p_ke_hoach_id)
    AND (p_thiet_bi_id IS NULL OR cv.thiet_bi_id = p_thiet_bi_id)
    AND (p_loai_cong_viec IS NULL OR cv.loai_cong_viec = p_loai_cong_viec)
    AND (p_don_vi_thuc_hien IS NULL OR cv.don_vi_thuc_hien = p_don_vi_thuc_hien)
    AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
  ORDER BY cv.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_tasks_list_with_equipment(bigint, bigint, text, text) TO authenticated;

COMMIT;
*/

