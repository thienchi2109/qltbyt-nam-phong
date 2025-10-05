-- Cleanup Debug Functions from Production
-- These functions were used for debugging regional_leader authentication issues
-- and are no longer needed after fixes were applied.
-- Migration Date: 2025-10-04 11:00 UTC

BEGIN;

-- ============================================================================
-- Drop debug functions created during troubleshooting
-- ============================================================================

-- Drop debug_jwt_and_access (created in migration 20251004095000)
-- This function was used to diagnose JWT claim propagation issues
DROP FUNCTION IF EXISTS public.debug_jwt_and_access();

-- Drop equipment_list_enhanced_debug_test (created in migration 20251004101000)
-- This function was used to inspect WHERE clause generation in equipment_list_enhanced
DROP FUNCTION IF EXISTS public.equipment_list_enhanced_debug_test(BIGINT);

-- Drop debug_jwt_claims_detailed (created in migration 20251004071000)
-- This function provided detailed JWT claim inspection
DROP FUNCTION IF EXISTS public.debug_jwt_claims_detailed();

-- Keep debug_jwt_claims (created in migration 20251004065000)
-- This is a general-purpose utility function that may be useful for future debugging
-- COMMENT: If you want to drop this too, uncomment the line below:
-- DROP FUNCTION IF EXISTS public.debug_jwt_claims();

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify functions are dropped
SELECT 
  routine_name,
  routine_type,
  routine_schema
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%debug%'
ORDER BY routine_name;

-- Expected output:
-- Only debug_jwt_claims should remain (if you chose to keep it)
-- debug_claims (if exists from earlier migrations)
-- test_jwt_claims (if exists from earlier migrations)
