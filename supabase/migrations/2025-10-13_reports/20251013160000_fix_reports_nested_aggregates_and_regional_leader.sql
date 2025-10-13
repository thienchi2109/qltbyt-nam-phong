-- Fix Reports Functions: Nested Aggregates and Regional Leader Support
-- Issue 1: get_maintenance_report_data throws "aggregate function calls cannot be nested" error
-- Issue 2: equipment_status_distribution ignores p_don_vi for non-global users
-- Root Cause 1: jsonb_agg with SUM() inside causes nested aggregates (lines 204-209)
-- Root Cause 2: Missing regional_leader RBAC logic in equipment_status_distribution
-- Migration Date: 2025-10-13 16:00 UTC
-- Related: Reports Page Regional Leader RBAC Phase 1 Implementation

BEGIN;

-- ============================================================================
-- FIX 1: get_maintenance_report_data - Remove Nested Aggregates
-- ============================================================================
-- Problem: Line 204-209 has jsonb_agg(jsonb_build_object(..., SUM(planned), SUM(actual)))
-- Solution: Pre-aggregate in CTE before jsonb_agg to avoid nesting

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
  ),
  -- FIX: Pre-aggregate maintenance data to avoid nested aggregates
  maintenance_aggregated AS (
    SELECT 
      loai_cong_viec,
      SUM(planned) as total_planned,
      SUM(actual) as total_actual
    FROM maintenance_summary
    GROUP BY loai_cong_viec
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
        'totalMaintenancePlanned', COALESCE((SELECT SUM(ma.total_planned) FROM maintenance_aggregated ma), 0),
        'maintenanceCompletionRate',
          CASE 
            WHEN COALESCE((SELECT SUM(ma.total_planned) FROM maintenance_aggregated ma), 0) > 0
            THEN (COALESCE((SELECT SUM(ma.total_actual) FROM maintenance_aggregated ma), 0)::numeric / 
                  (SELECT SUM(ma.total_planned) FROM maintenance_aggregated ma) * 100)
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
        -- FIX: No more nested aggregates - just jsonb_agg over pre-aggregated data
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'name', loai_cong_viec,
            'planned', total_planned,
            'actual', total_actual
          ) ORDER BY loai_cong_viec
        ), '[]'::jsonb)
        FROM maintenance_aggregated
      )
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_maintenance_report_data(DATE, DATE, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.get_maintenance_report_data(DATE, DATE, BIGINT)
IS 'Returns maintenance report data with server-side aggregation and proper RBAC. 
FIXED: Removed nested aggregate error by pre-aggregating maintenance data in CTE. 
Supports regional_leader role with automatic region scoping via allowed_don_vi_for_session_safe().';

-- ============================================================================
-- FIX 2: equipment_status_distribution - Add Regional Leader Support
-- ============================================================================
-- Problem: Lines 29-39 ignore p_don_vi parameter for non-global users
-- Solution: Use allowed_don_vi_for_session_safe() with validation like other RPC functions

CREATE OR REPLACE FUNCTION public.equipment_status_distribution(
  p_don_vi BIGINT DEFAULT NULL,
  p_khoa_phong BIGINT DEFAULT NULL,
  p_vi_tri BIGINT DEFAULT NULL
)
RETURNS TABLE (
  tinh_trang TEXT,
  so_luong BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed BIGINT[];
  v_effective_donvi BIGINT;
BEGIN
  -- 1. Get role and allowed facilities
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();
  
  -- 2. Determine effective facility based on role
  IF v_role = 'global' THEN
    -- Global users can query specific tenant or need to specify one
    v_effective_donvi := p_don_vi;
    
  ELSIF v_role = 'regional_leader' THEN
    -- Regional leader: validate access to requested facility
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      -- No access - return no data
      RETURN;
    END IF;
    
    IF p_don_vi IS NOT NULL THEN
      -- Validate access to specific facility
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        -- Access denied - return no data
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi 
          USING ERRCODE = '42501';
      END IF;
    ELSE
      -- No facility specified - cannot aggregate across multiple facilities
      -- This function expects a single facility, so use first allowed or return error
      -- For now, return no data to force frontend to select a facility
      RETURN;
    END IF;
    
  ELSE
    -- Other roles: limited to their facility
    -- Extract user's primary don_vi from JWT
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
    
    -- If p_don_vi is provided and doesn't match user's facility, deny access
    IF p_don_vi IS NOT NULL AND p_don_vi != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi 
        USING ERRCODE = '42501';
    END IF;
  END IF;
  
  -- 3. Query equipment status distribution
  RETURN QUERY
  SELECT 
    COALESCE(tb.tinh_trang, 'Không xác định') as tinh_trang,
    COUNT(tb.id) as so_luong
  FROM public.thiet_bi tb
  WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
    AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
    AND (p_vi_tri IS NULL OR tb.vi_tri_lap_dat = p_vi_tri)
  GROUP BY tb.tinh_trang
  ORDER BY so_luong DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_status_distribution(BIGINT, BIGINT, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.equipment_status_distribution(BIGINT, BIGINT, BIGINT)
IS 'Returns equipment count grouped by status (tinh_trang) for a specific facility.
FIXED: Added regional_leader support with allowed_don_vi_for_session_safe() validation.
Requires p_don_vi parameter to be specified for regional_leader and global roles.';

-- ============================================================================
-- FIX 3: maintenance_stats_for_reports - Add Regional Leader Support
-- ============================================================================
-- Same issue as equipment_status_distribution - ignores p_don_vi for non-global users

CREATE OR REPLACE FUNCTION public.maintenance_stats_for_reports(
  p_don_vi BIGINT DEFAULT NULL,
  p_thiet_bi_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
  total_maintenance_plans BIGINT,
  total_tasks BIGINT,
  completed_tasks BIGINT,
  completion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed BIGINT[];
  v_effective_donvi BIGINT;
BEGIN
  -- 1. Get role and allowed facilities
  v_role := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed := public.allowed_don_vi_for_session_safe();
  
  -- 2. Determine effective facility based on role
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi;
    
  ELSIF v_role = 'regional_leader' THEN
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;
    END IF;
    
    IF p_don_vi IS NOT NULL THEN
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;
      ELSE
        RAISE EXCEPTION 'Access denied for facility %', p_don_vi 
          USING ERRCODE = '42501';
      END IF;
    ELSE
      RETURN;  -- Force facility selection
    END IF;
    
  ELSE
    v_effective_donvi := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
    
    IF p_don_vi IS NOT NULL AND p_don_vi != v_effective_donvi THEN
      RAISE EXCEPTION 'Access denied for facility %', p_don_vi 
        USING ERRCODE = '42501';
    END IF;
  END IF;
  
  -- 3. Query maintenance statistics
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT kh.id)::BIGINT as total_maintenance_plans,
    COUNT(cv.id)::BIGINT as total_tasks,
    COUNT(cv.id) FILTER (
      WHERE cv.thang_1_hoan_thanh OR cv.thang_2_hoan_thanh OR 
            cv.thang_3_hoan_thanh OR cv.thang_4_hoan_thanh OR
            cv.thang_5_hoan_thanh OR cv.thang_6_hoan_thanh OR
            cv.thang_7_hoan_thanh OR cv.thang_8_hoan_thanh OR
            cv.thang_9_hoan_thanh OR cv.thang_10_hoan_thanh OR
            cv.thang_11_hoan_thanh OR cv.thang_12_hoan_thanh
    )::BIGINT as completed_tasks,
    CASE 
      WHEN COUNT(cv.id) > 0 THEN
        (COUNT(cv.id) FILTER (
          WHERE cv.thang_1_hoan_thanh OR cv.thang_2_hoan_thanh OR 
                cv.thang_3_hoan_thanh OR cv.thang_4_hoan_thanh OR
                cv.thang_5_hoan_thanh OR cv.thang_6_hoan_thanh OR
                cv.thang_7_hoan_thanh OR cv.thang_8_hoan_thanh OR
                cv.thang_9_hoan_thanh OR cv.thang_10_hoan_thanh OR
                cv.thang_11_hoan_thanh OR cv.thang_12_hoan_thanh
        )::NUMERIC / COUNT(cv.id) * 100)
      ELSE 0
    END as completion_rate
  FROM public.ke_hoach_bao_tri kh
  LEFT JOIN public.cong_viec_bao_tri cv ON kh.id = cv.ke_hoach_id
  WHERE (v_effective_donvi IS NULL OR kh.don_vi = v_effective_donvi)
    AND (p_thiet_bi_id IS NULL OR cv.thiet_bi_id = p_thiet_bi_id)
    AND kh.trang_thai = 'Đã duyệt';
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_stats_for_reports(BIGINT, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.maintenance_stats_for_reports(BIGINT, BIGINT)
IS 'Returns maintenance statistics summary for a specific facility.
FIXED: Added regional_leader support with allowed_don_vi_for_session_safe() validation.';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run manually in Supabase SQL Editor)
-- ============================================================================
/*
-- Test get_maintenance_report_data as regional_leader
SELECT public.get_maintenance_report_data(
  '2025-01-01'::date,
  '2025-12-31'::date,
  1  -- Specify facility ID
);

-- Test equipment_status_distribution as regional_leader
SELECT * FROM public.equipment_status_distribution(1, NULL, NULL);

-- Test maintenance_stats_for_reports as regional_leader
SELECT * FROM public.maintenance_stats_for_reports(1, NULL);

-- Verify no nested aggregate errors
EXPLAIN ANALYZE
SELECT public.get_maintenance_report_data(
  '2025-01-01'::date,
  '2025-12-31'::date,
  1
);
*/
