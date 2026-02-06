-- Add BRIN index for efficient time-range queries
-- BRIN is ideal for append-only time-series data
-- Note: CONCURRENTLY removed because it cannot run inside a transaction block
-- For zero-downtime creation on large tables, run manually outside migrations
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_brin
ON public.audit_logs USING BRIN (created_at)
WITH (pages_per_range = 128);

-- Keep existing B-tree index (better for pagination/sorting)
-- idx_audit_logs_created_at stays

COMMENT ON INDEX idx_audit_logs_created_at_brin IS
'BRIN index for efficient time-range queries. Smaller than B-tree, ideal for append-only data.';
