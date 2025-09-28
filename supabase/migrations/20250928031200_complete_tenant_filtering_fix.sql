-- COMPLETE TENANT FILTERING FIX (2025-09-28)
-- Consolidates all dashboard KPI and maintenance plan tenant isolation fixes
-- This migration is idempotent and safe to run multiple times

-- =====================================================
-- SUMMARY OF FIXES:
-- 1. Dashboard KPI tenant-filtered RPC endpoints
-- 2. Maintenance plans schema enhancement (add don_vi column)
-- 3. All maintenance functions with proper tenant filtering
-- 4. Performance indexes and constraints
-- 5. Data migration for existing maintenance plans
-- =====================================================

BEGIN;

-- =====================================================
-- SECTION 1: HELPER FUNCTIONS
-- =====================================================

-- Helper function for JWT claims (reuse existing if available)
CREATE OR REPLACE FUNCTION public._get_jwt_claim(claim TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> claim, NULL);
$$;

-- =====================================================
-- SECTION 2: DASHBOARD KPI TENANT-FILTERED FUNCTIONS
-- =====================================================

-- Dashboard KPI: Equipment total count with tenant filtering
CREATE OR REPLACE FUNCTION public.dashboard_equipment_total()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER  
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
  result INTEGER;
BEGIN
  -- Determine tenant scope
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := NULL; -- Global users see all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- Non-global users see only their tenant
  END IF;

  -- Count total equipment with tenant filtering
  SELECT COUNT(*)::INTEGER INTO result
  FROM public.thiet_bi tb
  WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi);

  RETURN COALESCE(result, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_equipment_total() TO authenticated;

-- Dashboard KPI: Equipment needing maintenance count with tenant filtering
CREATE OR REPLACE FUNCTION public.dashboard_maintenance_count()
RETURNS INTEGER
LANGUAGE plpgsql  
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
  result INTEGER;
BEGIN
  -- Determine tenant scope
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := NULL; -- Global users see all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- Non-global users see only their tenant
  END IF;

  -- Count equipment needing maintenance/calibration with tenant filtering
  SELECT COUNT(*)::INTEGER INTO result
  FROM public.thiet_bi tb
  WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
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

-- Dashboard KPI: Repair request statistics with tenant filtering
CREATE OR REPLACE FUNCTION public.dashboard_repair_request_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
  result JSONB;
BEGIN
  -- Determine tenant scope
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := NULL; -- Global users see all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- Non-global users see only their tenant
  END IF;

  -- Get repair request counts with proper tenant filtering
  WITH repair_counts AS (
    SELECT 
      COUNT(*) AS total_all,
      COUNT(*) FILTER (WHERE yc.trang_thai = 'Chờ xử lý') AS pending,
      COUNT(*) FILTER (WHERE yc.trang_thai = 'Đã duyệt') AS approved,
      COUNT(*) FILTER (WHERE yc.trang_thai IN ('Hoàn thành', 'Không HT')) AS completed
    FROM public.yeu_cau_sua_chua yc
    LEFT JOIN public.thiet_bi tb ON yc.thiet_bi_id = tb.id
    WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
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

-- =====================================================
-- SECTION 3: MAINTENANCE PLANS SCHEMA ENHANCEMENT
-- =====================================================

-- Add don_vi column to ke_hoach_bao_tri table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ke_hoach_bao_tri' 
    AND column_name = 'don_vi'
  ) THEN
    ALTER TABLE public.ke_hoach_bao_tri 
    ADD COLUMN don_vi BIGINT;
  END IF;
END $$;

-- Add foreign key constraint (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ke_hoach_bao_tri_don_vi_fkey'
  ) THEN
    ALTER TABLE public.ke_hoach_bao_tri 
    ADD CONSTRAINT ke_hoach_bao_tri_don_vi_fkey 
    FOREIGN KEY (don_vi) REFERENCES public.don_vi(id);
  END IF;
END $$;

-- Migrate existing maintenance plans with proper tenant assignment
-- Plan - CDC (tenant 3)
UPDATE public.ke_hoach_bao_tri 
SET don_vi = 3 
WHERE ten_ke_hoach = 'Plan - CDC' 
AND nguoi_lap_ke_hoach = 'CDC'
AND (don_vi IS NULL OR don_vi != 3);

-- Plan - YKPNT (tenant 1) 
UPDATE public.ke_hoach_bao_tri 
SET don_vi = 1 
WHERE ten_ke_hoach = 'Plan - YKPNT' 
AND nguoi_lap_ke_hoach = 'Trường Đại học Y khoa Phạm Ngọc Thạch'
AND (don_vi IS NULL OR don_vi != 1);

-- Add performance index for tenant filtering
CREATE INDEX IF NOT EXISTS idx_ke_hoach_bao_tri_don_vi 
ON public.ke_hoach_bao_tri (don_vi);

-- =====================================================
-- SECTION 4: MAINTENANCE FUNCTIONS WITH TENANT FILTERING
-- =====================================================

-- Fix maintenance_plan_list with proper tenant filtering
CREATE OR REPLACE FUNCTION public.maintenance_plan_list(p_q text default null)
RETURNS SETOF ke_hoach_bao_tri
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
BEGIN
  -- Determine tenant scope
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := NULL; -- Global users see all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- Non-global users see only their tenant
  END IF;

  -- Return maintenance plans with proper tenant filtering
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
    -- Tenant filtering: direct don_vi check
    v_effective_donvi IS NULL -- Global users see all plans
    OR kh.don_vi = v_effective_donvi -- Non-global users see only their tenant's plans
  )
  ORDER BY kh.nam DESC, kh.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_plan_list(text) TO authenticated;

-- Dashboard KPI: Maintenance plan statistics with proper tenant filtering
CREATE OR REPLACE FUNCTION public.dashboard_maintenance_plan_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
  result JSONB;
BEGIN
  -- Determine tenant scope
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := NULL; -- Global users see all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- Non-global users see only their tenant
  END IF;

  -- Get maintenance plan counts with direct tenant filtering
  WITH tenant_filtered_plans AS (
    SELECT kh.*
    FROM ke_hoach_bao_tri kh
    WHERE (
      v_effective_donvi IS NULL -- Global users see all plans
      OR kh.don_vi = v_effective_donvi -- Non-global users see only their tenant's plans
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

-- Update maintenance_plan_create to include don_vi from JWT
CREATE OR REPLACE FUNCTION public.maintenance_plan_create(
  p_ten_ke_hoach text,
  p_nam int,
  p_loai_cong_viec text,
  p_khoa_phong text,
  p_nguoi_lap_ke_hoach text
) 
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
BEGIN
  INSERT INTO ke_hoach_bao_tri(
    ten_ke_hoach, 
    nam, 
    loai_cong_viec, 
    khoa_phong, 
    nguoi_lap_ke_hoach, 
    trang_thai,
    don_vi
  )
  VALUES (
    p_ten_ke_hoach, 
    p_nam, 
    p_loai_cong_viec, 
    NULLIF(p_khoa_phong,''), 
    p_nguoi_lap_ke_hoach, 
    'Bản nháp',
    v_claim_donvi -- Set don_vi from JWT claims
  )
  RETURNING id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_plan_create(text,int,text,text,text) TO authenticated;

-- Fix maintenance_tasks_list_with_equipment to include tenant filtering
CREATE OR REPLACE FUNCTION public.maintenance_tasks_list_with_equipment(
  p_ke_hoach_id bigint default null,
  p_thiet_bi_id bigint default null,
  p_loai_cong_viec text default null,
  p_don_vi_thuc_hien text default null
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
  -- Equipment fields
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
  thang_12_hoan_thanh boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
BEGIN
  -- Determine tenant scope
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := NULL; -- Global users see all tenants
  ELSE
    v_effective_donvi := v_claim_donvi; -- Non-global users see only their tenant
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
    -- Equipment fields
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
    cv.thang_12_hoan_thanh
  FROM cong_viec_bao_tri cv
  LEFT JOIN thiet_bi tb ON cv.thiet_bi_id = tb.id
  WHERE (p_ke_hoach_id IS NULL OR cv.ke_hoach_id = p_ke_hoach_id)
    AND (p_thiet_bi_id IS NULL OR cv.thiet_bi_id = p_thiet_bi_id)
    AND (p_loai_cong_viec IS NULL OR cv.loai_cong_viec = p_loai_cong_viec)
    AND (p_don_vi_thuc_hien IS NULL OR cv.don_vi_thuc_hien = p_don_vi_thuc_hien)
    AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi) -- TENANT FILTERING
  ORDER BY cv.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_tasks_list_with_equipment(bigint, bigint, text, text) TO authenticated;

-- =====================================================
-- SECTION 5: PERFORMANCE INDEXES
-- =====================================================

-- Ensure all tenant-related indexes exist for optimal performance
CREATE INDEX IF NOT EXISTS idx_thiet_bi_don_vi ON public.thiet_bi (don_vi);
CREATE INDEX IF NOT EXISTS idx_yeu_cau_sua_chua_thiet_bi_id ON public.yeu_cau_sua_chua (thiet_bi_id);
CREATE INDEX IF NOT EXISTS idx_cong_viec_bao_tri_thiet_bi_id ON public.cong_viec_bao_tri (thiet_bi_id);

-- =====================================================
-- MIGRATION SUMMARY AND VERIFICATION
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
    'migration', 'complete_tenant_filtering_fix',
    'date', '2025-09-28',
    'components', jsonb_build_array(
      'dashboard_kpi_functions',
      'maintenance_plan_schema',
      'tenant_filtering_functions',
      'performance_indexes',
      'data_migration'
    )
  ),
  NOW()
) ON CONFLICT DO NOTHING;

COMMIT;

-- =====================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- =====================================================

/*
-- Verify maintenance plans have proper tenant assignment:
SELECT id, ten_ke_hoach, nguoi_lap_ke_hoach, don_vi FROM ke_hoach_bao_tri;

-- Test tenant filtering (replace 1 with actual tenant ID):
SELECT * FROM maintenance_plan_list(null) WHERE don_vi = 1;

-- Verify dashboard functions work:
SELECT dashboard_equipment_total();
SELECT dashboard_maintenance_count();
SELECT dashboard_repair_request_stats();
SELECT dashboard_maintenance_plan_stats();

-- Check performance indexes:
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE indexname LIKE '%don_vi%';
*/