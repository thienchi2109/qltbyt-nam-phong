--- Fix Dashboard Tabs for Regional Leaders
--- Issue: Regional leaders don't see equipment/tasks in "Thông tin chi tiết" card tabs
--- Root Cause: 
---   1. equipment_attention_list only checks single facility
---   2. calendar data uses direct Supabase queries bypassing JWT/RPC (SECURITY ISSUE)
--- Solution: 
---   1. Update equipment_attention_list to use allowed_don_vi_for_session_safe()
---   2. Create maintenance_calendar_events RPC with proper regional filtering
--- Migration Date: 2025-10-11 17:00 UTC

BEGIN;

-- ============================================================================
-- Fix equipment_attention_list for regional leaders
-- ============================================================================
-- This function returns equipment needing attention (repair/maintenance/calibration)
-- for the dashboard "Thiết bị" tab.
--
-- Previous behavior:
-- - Global users: See all equipment
-- - Non-global users: See only equipment from their single facility
--
-- New behavior:
-- - Global users: See all equipment
-- - Regional leaders: See equipment from all facilities in their region
-- - Regular users: See only equipment from their single facility
-- ============================================================================

CREATE OR REPLACE FUNCTION public.equipment_attention_list(
  p_limit INT DEFAULT 5
)
RETURNS SETOF public.thiet_bi
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_role TEXT := '';
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
  
  -- Get role from claims (prefer app_role, fallback to role)
  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  
  -- Get allowed facilities based on role and region
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();
  
  -- If no role or no allowed facilities, return no data
  IF v_role = '' OR v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL THEN
    RETURN;
  END IF;
  
  -- CASE 1: Global users - see all equipment needing attention
  IF v_role = 'global' THEN
    RETURN QUERY
    SELECT *
    FROM public.thiet_bi tb
    WHERE tb.tinh_trang_hien_tai IN ('Chờ sửa chữa', 'Chờ bảo trì', 'Chờ hiệu chuẩn/kiểm định')
    ORDER BY tb.ngay_bt_tiep_theo ASC NULLS LAST
    LIMIT GREATEST(p_limit, 1);
    
    RETURN;
  END IF;
  
  -- CASE 2: Non-global users (regional leaders, regular users)
  -- Use allowed_don_vi array to filter equipment
  RETURN QUERY
  SELECT *
  FROM public.thiet_bi tb
  WHERE tb.don_vi = ANY(v_allowed_don_vi)
    AND tb.tinh_trang_hien_tai IN ('Chờ sửa chữa', 'Chờ bảo trì', 'Chờ hiệu chuẩn/kiểm định')
  ORDER BY tb.ngay_bt_tiep_theo ASC NULLS LAST
  LIMIT GREATEST(p_limit, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.equipment_attention_list(INT) TO authenticated;

-- ============================================================================
-- Create maintenance_calendar_events RPC for "This month" tab
-- ============================================================================
-- This replaces direct Supabase queries which bypass JWT claims (SECURITY ISSUE)
-- Returns calendar events (maintenance tasks) for a specific year/month with
-- proper role-based filtering.
--
-- Security: Uses allowed_don_vi_for_session_safe() for tenant isolation
-- Regional leader support: Respects dia_ban claim for multi-facility access
-- ============================================================================

CREATE OR REPLACE FUNCTION public.maintenance_calendar_events(
  p_year INT,
  p_month INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_role TEXT := '';
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_month_field TEXT;
  v_completion_field TEXT;
  v_result JSONB;
  v_stats JSONB;
BEGIN
  -- Validate month parameter
  IF p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'Invalid month: %. Must be between 1 and 12', p_month USING ERRCODE = '22023';
  END IF;
  
  -- Get JWT claims
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    -- No JWT claims - return empty result
    RETURN jsonb_build_object(
      'events', '[]'::jsonb,
      'departments', '[]'::jsonb,
      'stats', jsonb_build_object(
        'total', 0,
        'completed', 0,
        'pending', 0,
        'byType', '{}'::jsonb
      )
    );
  END;
  
  -- Get role from claims
  v_role := lower(COALESCE(
    v_jwt_claims ->> 'app_role',
    v_jwt_claims ->> 'role',
    ''
  ));
  
  -- Get allowed facilities based on role and region
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();
  
  -- If no role or no allowed facilities, return empty result
  IF v_role = '' OR v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'events', '[]'::jsonb,
      'departments', '[]'::jsonb,
      'stats', jsonb_build_object(
        'total', 0,
        'completed', 0,
        'pending', 0,
        'byType', '{}'::jsonb
      )
    );
  END IF;
  
  -- Build dynamic field names for the month
  v_month_field := 'thang_' || p_month::TEXT;
  v_completion_field := v_month_field || '_hoan_thanh';
  
  -- Build calendar events with proper filtering
  WITH approved_plans AS (
    -- Get approved maintenance plans for the year (with regional filtering)
    SELECT kh.id, kh.ten_ke_hoach, kh.nam, kh.khoa_phong, kh.loai_cong_viec, kh.don_vi
    FROM public.ke_hoach_bao_tri kh
    WHERE kh.nam = p_year
      AND kh.trang_thai = 'Đã duyệt'
      AND (v_role = 'global' OR kh.don_vi = ANY(v_allowed_don_vi))
  ),
  monthly_tasks AS (
    -- Get tasks scheduled for this month with equipment info
    SELECT 
      cv.id,
      cv.ke_hoach_id,
      cv.thiet_bi_id,
      cv.loai_cong_viec,
      CASE 
        WHEN p_month = 1 THEN cv.thang_1_hoan_thanh
        WHEN p_month = 2 THEN cv.thang_2_hoan_thanh
        WHEN p_month = 3 THEN cv.thang_3_hoan_thanh
        WHEN p_month = 4 THEN cv.thang_4_hoan_thanh
        WHEN p_month = 5 THEN cv.thang_5_hoan_thanh
        WHEN p_month = 6 THEN cv.thang_6_hoan_thanh
        WHEN p_month = 7 THEN cv.thang_7_hoan_thanh
        WHEN p_month = 8 THEN cv.thang_8_hoan_thanh
        WHEN p_month = 9 THEN cv.thang_9_hoan_thanh
        WHEN p_month = 10 THEN cv.thang_10_hoan_thanh
        WHEN p_month = 11 THEN cv.thang_11_hoan_thanh
        WHEN p_month = 12 THEN cv.thang_12_hoan_thanh
      END AS is_completed,
      tb.ma_thiet_bi,
      tb.ten_thiet_bi,
      tb.khoa_phong_quan_ly,
      tb.don_vi AS equipment_don_vi,
      ap.ten_ke_hoach AS plan_name
    FROM public.cong_viec_bao_tri cv
    INNER JOIN approved_plans ap ON ap.id = cv.ke_hoach_id
    INNER JOIN public.thiet_bi tb ON tb.id = cv.thiet_bi_id
    WHERE 
      CASE 
        WHEN p_month = 1 THEN cv.thang_1
        WHEN p_month = 2 THEN cv.thang_2
        WHEN p_month = 3 THEN cv.thang_3
        WHEN p_month = 4 THEN cv.thang_4
        WHEN p_month = 5 THEN cv.thang_5
        WHEN p_month = 6 THEN cv.thang_6
        WHEN p_month = 7 THEN cv.thang_7
        WHEN p_month = 8 THEN cv.thang_8
        WHEN p_month = 9 THEN cv.thang_9
        WHEN p_month = 10 THEN cv.thang_10
        WHEN p_month = 11 THEN cv.thang_11
        WHEN p_month = 12 THEN cv.thang_12
      END = TRUE
      -- Additional equipment-level filtering for regional leaders
      AND (v_role = 'global' OR tb.don_vi = ANY(v_allowed_don_vi))
  ),
  events_json AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', mt.id,
        'title', mt.ten_thiet_bi,
        'type', COALESCE(mt.loai_cong_viec, 'Bảo trì'),
        'date', make_date(p_year, p_month, 15)::TEXT, -- Mid-month as default
        'equipmentCode', mt.ma_thiet_bi,
        'equipmentName', mt.ten_thiet_bi,
        'department', COALESCE(mt.khoa_phong_quan_ly, 'Không xác định'),
        'isCompleted', COALESCE(mt.is_completed, FALSE),
        'planName', mt.plan_name,
        'planId', mt.ke_hoach_id,
        'taskId', mt.id
      )
    ) AS events
    FROM monthly_tasks mt
  ),
  departments_json AS (
    SELECT jsonb_agg(DISTINCT COALESCE(mt.khoa_phong_quan_ly, 'Không xác định') ORDER BY COALESCE(mt.khoa_phong_quan_ly, 'Không xác định')) AS departments
    FROM monthly_tasks mt
  ),
  type_counts AS (
    SELECT 
      COALESCE(mt.loai_cong_viec, 'Bảo trì') AS task_type,
      COUNT(*) AS type_count
    FROM monthly_tasks mt
    GROUP BY COALESCE(mt.loai_cong_viec, 'Bảo trì')
  ),
  stats_calculation AS (
    SELECT
      COUNT(*)::INT AS total,
      COUNT(*) FILTER (WHERE mt.is_completed = TRUE)::INT AS completed,
      COUNT(*) FILTER (WHERE COALESCE(mt.is_completed, FALSE) = FALSE)::INT AS pending
    FROM monthly_tasks mt
  ),
  by_type_json AS (
    SELECT
      CASE
        WHEN COUNT(*) = 0 THEN '{}'::jsonb
        ELSE jsonb_object_agg(tc.task_type, tc.type_count)
      END AS by_type
    FROM type_counts tc
  )
  SELECT jsonb_build_object(
    'events', COALESCE(ej.events, '[]'::jsonb),
    'departments', COALESCE(dj.departments, '[]'::jsonb),
    'stats', jsonb_build_object(
      'total', COALESCE(sc.total, 0),
      'completed', COALESCE(sc.completed, 0),
      'pending', COALESCE(sc.pending, 0),
      'byType', COALESCE(btj.by_type, '{}'::jsonb)
    )
  ) INTO v_result
  FROM events_json ej
  CROSS JOIN departments_json dj
  CROSS JOIN stats_calculation sc
  CROSS JOIN by_type_json btj;
  
  RETURN COALESCE(v_result, jsonb_build_object(
    'events', '[]'::jsonb,
    'departments', '[]'::jsonb,
    'stats', jsonb_build_object(
      'total', 0,
      'completed', 0,
      'pending', 0,
      'byType', '{}'::jsonb
    )
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.maintenance_calendar_events(INT, INT) TO authenticated;

COMMIT;

-- ============================================================================
-- Migration Notes
-- ============================================================================
-- 1. Both functions are idempotent (uses CREATE OR REPLACE)
-- 2. Adds SET search_path for additional security
-- 3. Uses allowed_don_vi_for_session_safe() for proper multi-facility support
-- 4. maintenance_calendar_events replaces direct Supabase queries (security fix)
-- 5. Preserves backward compatibility with global users
-- 6. No data changes required
-- 7. Security verified: uses server-signed JWT claims
--
-- Frontend changes required:
-- - Update use-calendar-data.ts to call maintenance_calendar_events RPC
-- - Remove direct Supabase queries (security vulnerability)
-- ============================================================================
