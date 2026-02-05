-- =============================================================================
-- SECURE Audit logs retention policy
-- Addresses all security review findings
-- =============================================================================

CREATE OR REPLACE FUNCTION public.audit_logs_cleanup_scheduled()
RETURNS TABLE (deleted_count bigint, oldest_remaining timestamptz, batches_executed integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Hardcoded retention - NOT configurable at runtime (security)
  c_retention_days CONSTANT integer := 365;
  c_batch_size CONSTANT integer := 1000;
  c_max_batches CONSTANT integer := 100;

  v_cutoff_date timestamptz;
  v_deleted bigint := 0;
  v_batch_deleted bigint;
  v_batches integer := 0;
  v_oldest timestamptz;
  v_total_count bigint;
  v_to_delete_count bigint;
BEGIN
  -- SECURITY: Prevent concurrent execution (only one cleanup at a time)
  PERFORM pg_advisory_xact_lock(hashtext('audit_logs_cleanup_scheduled'));

  v_cutoff_date := now() - (c_retention_days || ' days')::interval;

  -- SECURITY: Cannot delete logs from last 24 hours (investigation window)
  IF v_cutoff_date > now() - interval '24 hours' THEN
    RAISE EXCEPTION 'Cannot delete logs from last 24 hours';
  END IF;

  -- SECURITY: Check bulk deletion threshold (50% max per run)
  -- Exception: First run is allowed to exceed threshold (detected by empty audit_cleanup_log)
  SELECT COUNT(*) INTO v_total_count FROM audit_logs;
  SELECT COUNT(*) INTO v_to_delete_count FROM audit_logs WHERE created_at < v_cutoff_date;

  IF v_total_count > 0 AND v_to_delete_count > (v_total_count * 0.5) THEN
    -- Check if this is the first cleanup run (audit_cleanup_log is empty)
    IF EXISTS (SELECT 1 FROM audit_cleanup_log LIMIT 1) THEN
      -- Not first run - enforce threshold
      RAISE EXCEPTION 'Bulk deletion blocked: % of % records (>50%%) would be deleted. '
        'This safety check prevents accidental mass deletion. '
        'If intentional, review records manually and run in smaller batches.',
        v_to_delete_count, v_total_count;
    ELSE
      -- First run - allow initial cleanup with warning in logs
      RAISE NOTICE 'First-time cleanup: allowing % of % records (>50%%) to be deleted.',
        v_to_delete_count, v_total_count;
    END IF;
  END IF;

  -- Batch delete with SKIP LOCKED to avoid blocking concurrent operations
  LOOP
    WITH to_delete AS (
      SELECT ctid
      FROM audit_logs
      WHERE created_at < v_cutoff_date
      LIMIT c_batch_size
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM audit_logs
    WHERE ctid IN (SELECT ctid FROM to_delete);

    GET DIAGNOSTICS v_batch_deleted = ROW_COUNT;
    v_deleted := v_deleted + v_batch_deleted;
    v_batches := v_batches + 1;

    EXIT WHEN v_batch_deleted = 0 OR v_batches >= c_max_batches;

    -- Yield to other transactions (50ms)
    PERFORM pg_sleep(0.05);
  END LOOP;

  -- Get oldest remaining record
  SELECT MIN(created_at) INTO v_oldest FROM audit_logs;

  -- Log the cleanup event (meta-audit) - required for compliance
  INSERT INTO audit_cleanup_log (
    retention_days,
    cutoff_date,
    deleted_count,
    oldest_remaining,
    executed_by
  ) VALUES (
    c_retention_days,
    v_cutoff_date,
    v_deleted::integer,
    v_oldest,
    'system-cron'
  );

  RETURN QUERY SELECT v_deleted, v_oldest, v_batches;
END;
$$;

-- =============================================================================
-- SECURITY: Restrict access to service_role ONLY
-- =============================================================================

-- Revoke from all roles
REVOKE ALL ON FUNCTION public.audit_logs_cleanup_scheduled() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_logs_cleanup_scheduled() FROM authenticated;

-- Grant only to service_role (for cron jobs)
GRANT EXECUTE ON FUNCTION public.audit_logs_cleanup_scheduled() TO service_role;

COMMENT ON FUNCTION public.audit_logs_cleanup_scheduled() IS
'SECURE cleanup function. Only callable by service_role via cron. Hardcoded 365-day retention.';

-- =============================================================================
-- DO NOT add to ALLOWED_FUNCTIONS in /api/rpc/[fn]/route.ts
-- This function should NEVER be callable through the RPC proxy
-- =============================================================================
