-- Fix Maintenance Plan List for Regional Leader Access
-- Issue: Regional leaders cannot see maintenance plans
-- Root Cause: maintenance_plan_list only checks single don_vi claim, not regional filtering
-- Solution: Use allowed_don_vi_for_session_safe() helper for proper role-based access
-- Migration Date: 2025-10-07 01:30 UTC

BEGIN;

-- =====================================================
-- Fix maintenance_plan_list with regional leader support
-- =====================================================

CREATE OR REPLACE FUNCTION public.maintenance_plan_list(p_q text DEFAULT NULL)
RETURNS SETOF ke_hoach_bao_tri
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
BEGIN
  -- Get JWT claims
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    -- No JWT claims - return no data
    RETURN;
  END;
  
  -- Get role from claims
  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  
  -- Get allowed tenants based on role (handles global, regional_leader, and tenant-specific roles)
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();
  
  -- Check if user has any access
  IF v_role = '' OR v_allowed_don_vi IS NULL OR cardinality(v_allowed_don_vi) = 0 THEN
    RETURN;
  END IF;
  
  -- Return maintenance plans with proper multi-tenant filtering
  RETURN QUERY
  SELECT kh.*
  FROM ke_hoach_bao_tri kh
  WHERE (
    -- Search filter
    p_q IS NULL OR p_q = ''
    OR kh.ten_ke_hoach ILIKE '%' || p_q || '%'
    OR COALESCE(kh.khoa_phong, '') ILIKE '%' || p_q || '%'
    OR COALESCE(kh.nguoi_lap_ke_hoach, '') ILIKE '%' || p_q || '%'
  ) AND (
    -- Tenant filtering using allowed_don_vi helper
    -- Global users: v_allowed_don_vi contains all active tenants
    -- Regional leaders: v_allowed_don_vi contains all tenants in their region
    -- Other roles: v_allowed_don_vi contains only their single tenant
    v_role = 'global' -- Global users see all plans
    OR kh.don_vi = ANY(v_allowed_don_vi) -- Filter by allowed tenants
  )
  ORDER BY kh.nam DESC, kh.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_plan_list(text) TO authenticated;

COMMENT ON FUNCTION public.maintenance_plan_list(text) IS 
'Lists maintenance plans with proper role-based filtering.
- Global: sees all plans from all active tenants
- Regional Leader: sees plans from all tenants in assigned region (READ-ONLY)
- Other roles: see only plans from their own tenant';

-- =====================================================
-- Fix dashboard_maintenance_plan_stats for regional leader
-- =====================================================

CREATE OR REPLACE FUNCTION public.dashboard_maintenance_plan_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  result JSONB;
BEGIN
  -- Get JWT claims
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    -- No JWT claims - return empty stats
    RETURN jsonb_build_object(
      'total', 0,
      'draft', 0,
      'approved', 0,
      'plans', '[]'::jsonb
    );
  END;
  
  -- Get role from claims
  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  
  -- Get allowed tenants based on role
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();
  
  -- Check if user has any access
  IF v_role = '' OR v_allowed_don_vi IS NULL OR cardinality(v_allowed_don_vi) = 0 THEN
    RETURN jsonb_build_object(
      'total', 0,
      'draft', 0,
      'approved', 0,
      'plans', '[]'::jsonb
    );
  END IF;
  
  -- Get maintenance plan counts with role-based filtering
  WITH tenant_filtered_plans AS (
    SELECT kh.*
    FROM ke_hoach_bao_tri kh
    WHERE (
      v_role = 'global' -- Global users see all plans
      OR kh.don_vi = ANY(v_allowed_don_vi) -- Filter by allowed tenants
    )
  ),
  plan_counts AS (
    SELECT 
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE trang_thai = 'Bản nháp') AS draft,
      COUNT(*) FILTER (WHERE trang_thai = 'Đã duyệt') AS approved
    FROM tenant_filtered_plans
  ),
  recent_plans AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', tfp.id,
        'ten_ke_hoach', tfp.ten_ke_hoach,
        'nam', tfp.nam,
        'khoa_phong', tfp.khoa_phong,
        'loai_cong_viec', tfp.loai_cong_viec,
        'trang_thai', tfp.trang_thai,
        'created_at', tfp.created_at
      ) ORDER BY tfp.created_at DESC
    ) AS plans
    FROM (
      SELECT * FROM tenant_filtered_plans 
      ORDER BY created_at DESC 
      LIMIT 10
    ) tfp
  )
  SELECT jsonb_build_object(
    'total', COALESCE(pc.total, 0),
    'draft', COALESCE(pc.draft, 0),
    'approved', COALESCE(pc.approved, 0),
    'plans', COALESCE(rp.plans, '[]'::jsonb)
  ) INTO result
  FROM plan_counts pc
  CROSS JOIN recent_plans rp;

  RETURN COALESCE(result, jsonb_build_object(
    'total', 0,
    'draft', 0,
    'approved', 0,
    'plans', '[]'::jsonb
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_maintenance_plan_stats() TO authenticated;

COMMENT ON FUNCTION public.dashboard_maintenance_plan_stats() IS 
'Returns maintenance plan statistics with proper role-based filtering.
- Global: stats from all active tenants
- Regional Leader: stats from all tenants in assigned region
- Other roles: stats from their own tenant only';

COMMIT;
