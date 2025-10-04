-- Add Debug Functions to RPC Whitelist for Troubleshooting
-- Issue: Need to verify JWT claims are being passed correctly from RPC proxy
-- Solution: Add debug_jwt_claims functions to ALLOWED_FUNCTIONS
-- Migration Date: 2025-10-04 09:45 UTC

-- No SQL changes needed - this is a frontend-only change
-- The debug functions already exist in the database
-- We just need to allow them through the RPC proxy

-- Add to src/app/api/rpc/[fn]/route.ts ALLOWED_FUNCTIONS:
-- 'debug_jwt_claims',
-- 'debug_jwt_claims_detailed',
