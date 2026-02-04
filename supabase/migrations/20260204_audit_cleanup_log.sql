-- Immutable table to log all cleanup operations (meta-audit)
CREATE TABLE IF NOT EXISTS public.audit_cleanup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at timestamptz NOT NULL DEFAULT now(),
  retention_days integer NOT NULL,
  cutoff_date timestamptz NOT NULL,
  deleted_count integer NOT NULL,
  oldest_remaining timestamptz,
  executed_by text NOT NULL DEFAULT 'system-cron'
);

-- Make it append-only (no updates or deletes)
REVOKE UPDATE, DELETE ON audit_cleanup_log FROM PUBLIC;
REVOKE UPDATE, DELETE ON audit_cleanup_log FROM authenticated;
REVOKE UPDATE, DELETE ON audit_cleanup_log FROM service_role;

-- Only service_role can insert
GRANT INSERT ON audit_cleanup_log TO service_role;
GRANT SELECT ON audit_cleanup_log TO service_role;

COMMENT ON TABLE audit_cleanup_log IS
'Immutable log of audit_logs cleanup operations. Required for healthcare compliance.';

-- Index for compliance query performance (time-based lookups)
CREATE INDEX IF NOT EXISTS idx_audit_cleanup_log_executed_at
ON audit_cleanup_log (executed_at DESC);
