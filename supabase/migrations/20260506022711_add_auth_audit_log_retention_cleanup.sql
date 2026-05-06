-- Issue #391: auth_audit_log retention and scheduled purge policy.
--
-- Policy:
--   - retain auth_audit_log rows for 90 days
--   - hard purge rows older than the retention window
--   - no archive table and no persistent cleanup meta-log

CREATE OR REPLACE FUNCTION public.auth_audit_log_cleanup_scheduled()
RETURNS TABLE (
  deleted_count bigint,
  oldest_remaining timestamptz,
  batches_executed integer,
  cutoff_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_retention_days CONSTANT integer := 90;
  c_batch_size CONSTANT integer := 1000;
  c_max_batches CONSTANT integer := 100;
  v_cutoff_date timestamptz := now() - (c_retention_days || ' days')::interval;
  v_deleted_count bigint := 0;
  v_batch_deleted bigint := 0;
  v_batches_executed integer := 0;
  v_oldest_remaining timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('auth_audit_log_cleanup_scheduled'));

  IF v_cutoff_date > now() - interval '24 hours' THEN
    RAISE EXCEPTION 'Cannot delete auth audit logs from the last 24 hours';
  END IF;

  LOOP
    WITH to_delete AS (
      SELECT ctid
      FROM public.auth_audit_log
      WHERE created_at < v_cutoff_date
      ORDER BY created_at
      LIMIT c_batch_size
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM public.auth_audit_log
    WHERE ctid IN (SELECT ctid FROM to_delete);

    GET DIAGNOSTICS v_batch_deleted = ROW_COUNT;

    EXIT WHEN v_batch_deleted = 0;

    v_deleted_count := v_deleted_count + v_batch_deleted;
    v_batches_executed := v_batches_executed + 1;

    EXIT WHEN v_batches_executed >= c_max_batches;
  END LOOP;

  SELECT MIN(created_at)
  INTO v_oldest_remaining
  FROM public.auth_audit_log;

  RETURN QUERY
  SELECT
    v_deleted_count,
    v_oldest_remaining,
    v_batches_executed,
    v_cutoff_date;
END;
$$;

REVOKE ALL ON FUNCTION public.auth_audit_log_cleanup_scheduled() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_audit_log_cleanup_scheduled() FROM anon;
REVOKE ALL ON FUNCTION public.auth_audit_log_cleanup_scheduled() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.auth_audit_log_cleanup_scheduled() TO service_role;

COMMENT ON FUNCTION public.auth_audit_log_cleanup_scheduled() IS
  'Scheduled service-role cleanup for auth_audit_log. Hard-purges rows older than 90 days in bounded batches.';
