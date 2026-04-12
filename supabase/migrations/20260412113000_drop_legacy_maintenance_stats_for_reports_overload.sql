BEGIN;

-- Follow-up for Issue #237 review: remove the legacy overload that bypasses the
-- newer JWT guard and admin/global normalization added to the date-scoped RPC.
-- Rollback (forward-only): if restoration is required, recreate
-- public.maintenance_stats_for_reports(bigint, bigint) from
-- supabase/migrations/2025-10-13_reports/20251013160000_fix_reports_nested_aggregates_and_regional_leader.sql
-- and re-apply its GRANT EXECUTE statement. This migration itself is destructive
-- and does not provide an automatic down path.
DROP FUNCTION IF EXISTS public.maintenance_stats_for_reports(bigint, bigint);

COMMIT;
