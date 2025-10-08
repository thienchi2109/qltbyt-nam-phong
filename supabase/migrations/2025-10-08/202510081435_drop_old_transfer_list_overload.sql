-- Migration: Drop older transfer_request_list_enhanced overload
-- Date: 2025-10-08 14:35
-- Purpose: Remove function overload ambiguity by dropping 7-param version
-- OPTIONAL: Only apply if you want to clean up duplicate functions
-- MANUAL REVIEW REQUIRED - DO NOT AUTO-APPLY

BEGIN;

-- Drop the older 7-parameter version (without p_khoa_phong)
-- The newer 8-parameter version (with p_khoa_phong) will remain
DROP FUNCTION IF EXISTS public.transfer_request_list_enhanced(
  p_q TEXT,
  p_status TEXT,
  p_page INTEGER,
  p_page_size INTEGER,
  p_don_vi BIGINT,
  p_date_from DATE,
  p_date_to DATE
);

-- Verify the remaining function
-- Should only show the 8-parameter version with p_khoa_phong
SELECT 
  proname, 
  pg_get_function_arguments(oid) as args
FROM pg_proc 
WHERE proname = 'transfer_request_list_enhanced' 
  AND pronamespace = 'public'::regnamespace;

COMMIT;

-- Note: After applying this migration, the hook will automatically use
-- the remaining 8-parameter version. The p_khoa_phong parameter provides
-- additional filtering capability for department-based queries.
