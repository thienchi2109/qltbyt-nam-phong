-- Testing RPC Functions with Authentication Context
-- Run this in Supabase SQL Editor

-- ============================================================================
-- OPTION 1: Test as authenticated user (bypassing auth check for testing)
-- ============================================================================

-- Temporarily modify function to skip auth check for testing
-- (Don't use this in production!)

-- First, let's see what the actual error is by checking the function
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'get_transfers_kanban'
LIMIT 1;

-- ============================================================================
-- OPTION 2: Test via the application (RECOMMENDED)
-- ============================================================================

-- The RPC functions are designed to be called via the API with NextAuth session
-- They check auth.uid() which is set by the JWT token

-- Instead of testing directly in SQL Editor, test via:
-- 1. Open browser DevTools → Network tab
-- 2. Refresh the transfers page
-- 3. Look for: GET /api/transfers/kanban?
-- 4. Should return 200 OK with data

-- ============================================================================
-- OPTION 3: Check if data exists in the table
-- ============================================================================

-- Let's verify there's actual data to return
SELECT 
  COUNT(*) as total_transfers,
  COUNT(CASE WHEN trang_thai = 'cho_duyet' THEN 1 END) as cho_duyet,
  COUNT(CASE WHEN trang_thai = 'da_duyet' THEN 1 END) as da_duyet,
  COUNT(CASE WHEN trang_thai = 'dang_luan_chuyen' THEN 1 END) as dang_luan_chuyen,
  COUNT(CASE WHEN trang_thai = 'da_ban_giao' THEN 1 END) as da_ban_giao,
  COUNT(CASE WHEN trang_thai = 'hoan_thanh' THEN 1 END) as hoan_thanh
FROM yeu_cau_dieu_chuyen;

-- ============================================================================
-- OPTION 4: Temporarily disable auth check (TESTING ONLY)
-- ============================================================================

-- WARNING: Only use this for testing, then revert immediately!

CREATE OR REPLACE FUNCTION get_transfers_kanban_test(
  p_facility_ids BIGINT[] DEFAULT NULL,
  p_limit INT DEFAULT 10
) 
RETURNS TABLE (
  id BIGINT,
  ma_yeu_cau TEXT,
  trang_thai TEXT,
  total_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Skip auth check for testing
  RETURN QUERY
  SELECT 
    yd.id,
    yd.ma_yeu_cau,
    yd.trang_thai,
    COUNT(*) OVER() AS total_count
  FROM yeu_cau_dieu_chuyen yd
  WHERE 
    (p_facility_ids IS NULL OR yd.don_vi_id = ANY(p_facility_ids))
  ORDER BY yd.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Test the simplified version
SELECT * FROM get_transfers_kanban_test(NULL, 5);

-- ============================================================================
-- OPTION 5: Check the actual auth context
-- ============================================================================

-- See what auth context is available in SQL Editor (should be none)
SELECT 
  current_setting('request.jwt.claims', true) as jwt_claims,
  auth.uid() as user_id;

-- This will show NULL because SQL Editor doesn't have auth context
