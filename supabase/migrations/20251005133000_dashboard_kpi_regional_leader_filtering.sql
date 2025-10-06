-- Dashboard KPI Regional Leader Filtering (2025-10-05)
-- Updates dashboard KPI functions to use allowed_don_vi_for_session for proper regional filtering
-- Ensures regional leaders only see data from facilities within their assigned region

BEGIN;

-- =====================================================
-- UPDATE DASHBOARD KPI FUNCTIONS FOR REGIONAL FILTERING
-- =====================================================

-- Dashboard KPI: Equipment total count with regional leader filtering
CREATE OR REPLACE FUNCTION public.dashboard_equipment_total()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER  
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_allowed_don_vi BIGINT[];
  result INTEGER;
BEGIN
  -- Get allowed don_vi based on role (handles regional leader filtering)
  v_allowed_don_vi := public.allowed_don_vi_for_session();
  
  -- Count total equipment with proper regional filtering
  SELECT COUNT(*)::INTEGER INTO result
  FROM public.thiet_bi tb
  WHERE 
    -- Global users see all equipment
    v_role = 'global' 
    OR 
    -- Non-global users see only equipment from their allowed don_vi
    (v_allowed_don_vi IS NOT NULL AND array_length(v_allowed_don_vi, 1) > 0 AND tb.don_vi = ANY(v_allowed_don_vi));

  RETURN COALESCE(result, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_equipment_total() TO authenticated;

-- Dashboard KPI: Equipment needing maintenance count with regional leader filtering
CREATE OR REPLACE FUNCTION public.dashboard_maintenance_count()
RETURNS INTEGER
LANGUAGE plpgsql  
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_allowed_don_vi BIGINT[];
  result INTEGER;
BEGIN
  -- Get allowed don_vi based on role (handles regional leader filtering)
  v_allowed_don_vi := public.allowed_don_vi_for_session();
  
  -- Count equipment needing maintenance/calibration with proper regional filtering
  SELECT COUNT(*)::INTEGER INTO result
  FROM public.thiet_bi tb
  WHERE 
    -- Regional filtering
    (v_role = 'global' OR (v_allowed_don_vi IS NOT NULL AND array_length(v_allowed_don_vi, 1) > 0 AND tb.don_vi = ANY(v_allowed_don_vi)))
    AND (
      tb.tinh_trang_hien_tai ILIKE '%Chờ bảo trì%' 
      OR tb.tinh_trang_hien_tai ILIKE '%Chờ hiệu chuẩn%'
      OR tb.tinh_trang_hien_tai ILIKE '%Chờ kiểm định%'
      OR tb.tinh_trang_hien_tai ILIKE '%bảo trì%'
      OR tb.tinh_trang_hien_tai ILIKE '%hiệu chuẩn%'
      OR tb.tinh_trang_hien_tai ILIKE '%kiểm định%'
    );

  RETURN COALESCE(result, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_maintenance_count() TO authenticated;

-- Dashboard KPI: Repair request statistics with regional leader filtering
CREATE OR REPLACE FUNCTION public.dashboard_repair_request_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_allowed_don_vi BIGINT[];
  result JSONB;
BEGIN
  -- Get allowed don_vi based on role (handles regional leader filtering)
  v_allowed_don_vi := public.allowed_don_vi_for_session();
  
  -- Get repair request counts with proper regional filtering
  WITH repair_counts AS (
    SELECT 
      COUNT(*) AS total_all,
      COUNT(*) FILTER (WHERE yc.trang_thai = 'Chờ xử lý') AS pending,
      COUNT(*) FILTER (WHERE yc.trang_thai = 'Đã duyệt') AS approved,
      COUNT(*) FILTER (WHERE yc.trang_thai IN ('Hoàn thành', 'Không HT')) AS completed
    FROM public.yeu_cau_sua_chua yc
    LEFT JOIN public.thiet_bi tb ON yc.thiet_bi_id = tb.id
    WHERE 
      -- Regional filtering
      v_role = 'global' 
      OR 
      (v_allowed_don_vi IS NOT NULL AND array_length(v_allowed_don_vi, 1) > 0 AND tb.don_vi = ANY(v_allowed_don_vi))
  )
  SELECT jsonb_build_object(
    'total', COALESCE(rc.pending + rc.approved, 0), -- Total active (pending + approved)
    'pending', COALESCE(rc.pending, 0),
    'approved', COALESCE(rc.approved, 0), 
    'completed', COALESCE(rc.completed, 0)
  ) INTO result
  FROM repair_counts rc;

  RETURN COALESCE(result, jsonb_build_object(
    'total', 0,
    'pending', 0,
    'approved', 0,
    'completed', 0
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_repair_request_stats() TO authenticated;

-- Dashboard KPI: Maintenance plan statistics with regional leader filtering
CREATE OR REPLACE FUNCTION public.dashboard_maintenance_plan_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_allowed_don_vi BIGINT[];
  result JSONB;
BEGIN
  -- Get allowed don_vi based on role (handles regional leader filtering)
  v_allowed_don_vi := public.allowed_don_vi_for_session();
  
  -- Get maintenance plan counts with direct regional filtering
  WITH tenant_filtered_plans AS (
    SELECT kh.*
    FROM ke_hoach_bao_tri kh
    WHERE 
      -- Regional filtering
      v_role = 'global' 
      OR 
      (v_allowed_don_vi IS NOT NULL AND array_length(v_allowed_don_vi, 1) > 0 AND kh.don_vi = ANY(v_allowed_don_vi))
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

-- =====================================================
-- VERIFICATION AND PERFORMANCE OPTIMIZATION
-- =====================================================

-- Add performance indexes for regional filtering (if not exists)
CREATE INDEX IF NOT EXISTS idx_thiet_bi_don_vi_active 
ON public.thiet_bi (don_vi) WHERE don_vi IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_thiet_bi_don_vi 
ON public.yeu_cau_sua_chua (thiet_bi_id);

CREATE INDEX IF NOT EXISTS idx_ke_hoach_bao_tri_don_vi_active 
ON public.ke_hoach_bao_tri (don_vi) WHERE don_vi IS NOT NULL;

-- Update table statistics for optimal query performance
ANALYZE public.thiet_bi;
ANALYZE public.yeu_cau_sua_chua;
ANALYZE public.ke_hoach_bao_tri;
ANALYZE public.don_vi;

-- =====================================================
-- MIGRATION SUMMARY
-- =====================================================

-- Log successful migration completion
INSERT INTO public.audit_logs (
  admin_user_id,
  admin_username,
  action_type,
  action_details,
  created_at
) VALUES (
  1, -- System user ID
  'system',
  'migration_complete',
  jsonb_build_object(
    'migration', 'dashboard_kpi_regional_leader_filtering',
    'date', '2025-10-05',
    'components', jsonb_build_array(
      'dashboard_equipment_total',
      'dashboard_maintenance_count',
      'dashboard_repair_request_stats',
      'dashboard_maintenance_plan_stats'
    ),
    'feature', 'Regional leaders now see KPI data only from their assigned region'
  ),
  NOW()
) ON CONFLICT DO NOTHING;

COMMIT;

-- =====================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- =====================================================

/*
-- Test regional leader filtering (replace with actual regional leader JWT):
SET request.jwt.claims TO '{"app_role": "regional_leader", "don_vi": "15", "dia_ban": "1"}';

-- Verify dashboard functions work with regional filtering:
SELECT dashboard_equipment_total();
SELECT dashboard_maintenance_count();
SELECT dashboard_repair_request_stats();
SELECT dashboard_maintenance_plan_stats();

-- Test global user (should see all data):
SET request.jwt.claims TO '{"app_role": "global", "don_vi": null, "dia_ban": null}';
SELECT dashboard_equipment_total();
SELECT dashboard_maintenance_count();
SELECT dashboard_repair_request_stats();
SELECT dashboard_maintenance_plan_stats();

-- Clean up test JWT claims:
RESET request.jwt.claims;
*/