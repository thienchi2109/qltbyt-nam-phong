-- Check if RPC functions exist
-- Run this in Supabase SQL Editor to verify

-- Check if get_transfers_kanban function exists
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prokind as kind
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('get_transfers_kanban', 'get_transfer_counts')
ORDER BY p.proname;

-- If empty result, the functions don't exist!
-- You need to apply the migration:
-- supabase/migrations/2025-10-12_transfer_kanban/20251012120000_kanban_server_side_filtering.sql
