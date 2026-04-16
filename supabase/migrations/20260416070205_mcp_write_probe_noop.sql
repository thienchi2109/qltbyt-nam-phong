-- No-op migration to verify Supabase MCP write/apply capability from this session.
-- Forward-only migration: do not edit or delete applied history.
-- This migration intentionally performs no schema or data changes beyond
-- recording its version in the migration history table.

BEGIN;

SELECT 1;

COMMIT;
