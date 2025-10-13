-- Add Maintenance Report RPC with Server-Side Aggregation and RBAC
-- Fixes P0 security vulnerability: replaces direct Supabase queries with secure RPC
-- Migration Date: 2025-10-13 14:01 UTC
-- Related: Regional Leader RBAC for Reports Page

BEGIN;

-- ============================================================================
-- CREATE: get_maintenance_report_data RPC Function
-- ============================================================================
-- Returns maintenance report data with server-side aggregation and proper RBAC
-- Supports: global, admin, regional_leader, and regular users
-- Security: Uses allowed_don_vi_for_session_safe() for automatic region scoping

CREATE OR REPLACE FUNCTION public.get_maintenance_report_data(
  p_date_from DATE,
  p_date_to DATE,
  p_don_vi BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed BIGINT[];
  v_effective BIGINT[];
  v_result JSONB;
BEGIN
  -- 1. Get role and allowed facilities
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();
  
  -- 2. Determine effective facilities based on role
  IF v_role = 'global' THEN
    -- Global users can query specific tenant or all tenants
    IF p_don_vi IS NOT NULL THEN
      v_effective := ARRAY[p_don_vi];
    ELSE
      v_effective := NULL;  -- All facilities
    END IF;
  ELSE
    -- Regional leader or other roles: use scoped facilities
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      -- No access - return empty result
      RETURN jsonb_build_object(
        'summary', jsonb_build_object(
          'totalRepairs', 0,
          'repairCompletionRate', 0,
          'totalMaintenancePlanned', 0,
          'maintenanceCompletionRate', 0
        ),
        'charts', jsonb_build_object(
          'repairStatusDistribution', '[]'::jsonb,
          'maintenancePlanVsActual', '[]'::jsonb
        )
      );
    END IF;
    
    -- If specific facility requested, validate access
    IF p_don_vi IS NOT NULL THEN
      IF NOT p_don_vi = ANY(v_allowed) THEN
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi 
          USING ERRCODE = '42501';
      END IF;
      v_effective := ARRAY[p_don_vi];
    ELSE
      -- Use all allowed facilities (region-scoped)
      v_effective := v_allowed;
    END IF;
  END IF;
  
  -- 3. Fetch and aggregate repair requests
  WITH repair_data AS (
    SELECT 
      yc.id,
      yc.trang_thai,
      yc.ngay_yeu_cau,
      tb.don_vi
    FROM public.yeu_cau_sua_chua yc
    INNER JOIN public.thiet_bi tb ON yc.thiet_bi_id = tb.id
    WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
      AND yc.ngay_yeu_cau IS NOT NULL
      AND yc.ngay_yeu_cau::date BETWEEN p_date_from AND p_date_to
  ),
  repair_summary AS (
    SELECT 
      COUNT(*) as total_repairs,
      COUNT(*) FILTER (WHERE trang_thai = 'Hoàn thành') as completed,
      COUNT(*) FILTER (WHERE trang_thai = 'Không HT') as not_completed,
      COUNT(*) FILTER (WHERE trang_thai = 'Đã duyệt') as approved,
      COUNT(*) FILTER (WHERE trang_thai = 'Chờ xử lý') as pending
    FROM repair_data
  ),
  -- 4. Fetch and aggregate maintenance plans and tasks
  maintenance_data AS (
    SELECT 
      kh.id as plan_id,
      kh.nam,
      kh.trang_thai,
      kh.don_vi,
      cv.id as task_id,
      cv.loai_cong_viec,
      cv.thang_1, cv.thang_1_hoan_thanh,
      cv.thang_2, cv.thang_2_hoan_thanh,
      cv.thang_3, cv.thang_3_hoan_thanh,
      cv.thang_4, cv.thang_4_hoan_thanh,
      cv.thang_5, cv.thang_5_hoan_thanh,
      cv.thang_6, cv.thang_6_hoan_thanh,
      cv.thang_7, cv.thang_7_hoan_thanh,
      cv.thang_8, cv.thang_8_hoan_thanh,
      cv.thang_9, cv.thang_9_hoan_thanh,
      cv.thang_10, cv.thang_10_hoan_thanh,
      cv.thang_11, cv.thang_11_hoan_thanh,
      cv.thang_12, cv.thang_12_hoan_thanh
    FROM public.ke_hoach_bao_tri kh
    LEFT JOIN public.cong_viec_bao_tri cv ON kh.id = cv.ke_hoach_id
    WHERE (v_effective IS NULL OR kh.don_vi = ANY(v_effective))
      AND kh.nam = EXTRACT(YEAR FROM p_date_from)
      AND kh.trang_thai = 'Đã duyệt'
  ),
  maintenance_summary AS (
    SELECT 
      loai_cong_viec,
      -- Count planned months (sum all thang_X columns)
      (CASE WHEN thang_1 THEN 1 ELSE 0 END +
       CASE WHEN thang_2 THEN 1 ELSE 0 END +
       CASE WHEN thang_3 THEN 1 ELSE 0 END +
       CASE WHEN thang_4 THEN 1 ELSE 0 END +
       CASE WHEN thang_5 THEN 1 ELSE 0 END +
       CASE WHEN thang_6 THEN 1 ELSE 0 END +
       CASE WHEN thang_7 THEN 1 ELSE 0 END +
       CASE WHEN thang_8 THEN 1 ELSE 0 END +
       CASE WHEN thang_9 THEN 1 ELSE 0 END +
       CASE WHEN thang_10 THEN 1 ELSE 0 END +
       CASE WHEN thang_11 THEN 1 ELSE 0 END +
       CASE WHEN thang_12 THEN 1 ELSE 0 END) as planned,
      -- Count completed months (sum all thang_X_hoan_thanh columns)
      (CASE WHEN thang_1_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_2_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_3_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_4_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_5_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_6_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_7_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_8_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_9_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_10_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_11_hoan_thanh THEN 1 ELSE 0 END +
       CASE WHEN thang_12_hoan_thanh THEN 1 ELSE 0 END) as actual
    FROM maintenance_data
    WHERE loai_cong_viec IN ('Bảo trì', 'Hiệu chuẩn', 'Kiểm định')
  )
  -- 5. Build result JSON with summary and charts
  SELECT jsonb_build_object(
    'summary', (
      SELECT jsonb_build_object(
        'totalRepairs', COALESCE(rs.total_repairs, 0),
        'repairCompletionRate', 
          CASE 
            WHEN COALESCE(rs.total_repairs, 0) > 0 
            THEN (COALESCE(rs.completed, 0)::numeric / rs.total_repairs * 100)
            ELSE 0
          END,
        'totalMaintenancePlanned', COALESCE((SELECT SUM(ms.planned) FROM maintenance_summary ms), 0),
        'maintenanceCompletionRate',
          CASE 
            WHEN COALESCE((SELECT SUM(ms.planned) FROM maintenance_summary ms), 0) > 0
            THEN (COALESCE((SELECT SUM(ms.actual) FROM maintenance_summary ms), 0)::numeric / 
                  (SELECT SUM(ms.planned) FROM maintenance_summary ms) * 100)
            ELSE 0
          END
      )
      FROM repair_summary rs
    ),
    'charts', jsonb_build_object(
      'repairStatusDistribution', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'name', status_name,
            'value', status_count,
            'color', status_color
          )
        ), '[]'::jsonb)
        FROM (
          SELECT 'Hoàn thành' as status_name, completed as status_count, 'hsl(var(--chart-1))' as status_color 
          FROM repair_summary WHERE completed > 0
          UNION ALL
          SELECT 'Không HT', not_completed, 'hsl(var(--chart-5))' 
          FROM repair_summary WHERE not_completed > 0
          UNION ALL
          SELECT 'Đã duyệt', approved, 'hsl(var(--chart-2))' 
          FROM repair_summary WHERE approved > 0
          UNION ALL
          SELECT 'Chờ xử lý', pending, 'hsl(var(--chart-3))' 
          FROM repair_summary WHERE pending > 0
        ) statuses
      ),
      'maintenancePlanVsActual', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'name', loai_cong_viec,
            'planned', SUM(planned),
            'actual', SUM(actual)
          ) ORDER BY loai_cong_viec
        ), '[]'::jsonb)
        FROM maintenance_summary
        GROUP BY loai_cong_viec
      )
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_maintenance_report_data(DATE, DATE, BIGINT) TO authenticated;

-- Add function comment for documentation
COMMENT ON FUNCTION public.get_maintenance_report_data(DATE, DATE, BIGINT)
IS 'Returns maintenance report data with server-side aggregation and proper RBAC. Supports regional_leader role with automatic region scoping via allowed_don_vi_for_session_safe(). Fixes P0 security vulnerability from direct Supabase queries.';

-- ============================================================================
-- CREATE: Performance Indexes
-- ============================================================================
-- Note: Leveraging existing indexes for repair requests:
--   - idx_yeu_cau_sua_chua_ngay_yeu_cau (date filtering)
--   - idx_yeu_cau_sua_chua_thiet_bi_id (JOIN with thiet_bi)
--   - idx_cong_viec_bao_tri_ke_hoach_id (already exists for tasks)
-- Only creating composite index for maintenance plans WHERE clause optimization.

-- Composite index for maintenance plans by facility, year, and status
-- Supports: WHERE don_vi = ANY(v_effective) AND nam = X AND trang_thai = 'Đã duyệt'
-- This is essential for regional_leader queries filtering by region + year + status
CREATE INDEX IF NOT EXISTS idx_ke_hoach_bao_tri_don_vi_nam_status 
  ON public.ke_hoach_bao_tri(don_vi, nam, trang_thai);

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run manually in Supabase SQL Editor)
-- ============================================================================
/*
-- Test as global user (all facilities)
SELECT public.get_maintenance_report_data(
  '2025-01-01'::date,
  '2025-12-31'::date,
  NULL
);

-- Test as global user (specific facility)
SELECT public.get_maintenance_report_data(
  '2025-01-01'::date,
  '2025-12-31'::date,
  1
);

-- Test query performance
EXPLAIN ANALYZE
SELECT public.get_maintenance_report_data(
  '2025-01-01'::date,
  '2025-12-31'::date,
  NULL
);

-- Verify indexes are being used
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('yeu_cau_sua_chua', 'ke_hoach_bao_tri', 'cong_viec_bao_tri')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
*/
