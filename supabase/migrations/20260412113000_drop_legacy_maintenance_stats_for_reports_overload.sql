BEGIN;

-- Follow-up for Issue #237 review: remove the legacy overload that bypasses the
-- newer JWT guard and admin/global normalization added to the date-scoped RPC.
DROP FUNCTION IF EXISTS public.maintenance_stats_for_reports(bigint, bigint);

COMMIT;
