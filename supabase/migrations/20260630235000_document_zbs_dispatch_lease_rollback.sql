-- Issue #620 Phase 3 documentation follow-up: make the ZBS dispatch lease
-- rollback target explicit without editing applied migrations.
--
-- Rollback strategy: forward-only. To undo the processing-lease contract added
-- by 20260630234000_validate_zbs_dispatch_processing_lease.sql, create a later
-- migration that restores the ZBS live-dispatch RPC bodies/signatures from
-- 20260630143000_harden_zbs_live_dispatch_rpcs.sql. For the original Phase 3
-- RPC creation baseline, see 20260630123000_add_zbs_live_dispatch_rpcs.sql.

BEGIN;

DO $$
BEGIN
  NULL;
END
$$;

COMMIT;
