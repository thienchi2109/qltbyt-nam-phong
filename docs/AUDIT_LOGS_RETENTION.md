# Audit Logs Retention System

This document describes the audit logs optimization and secure retention policy implementation.

## Overview

The system implements:
- **BRIN Index**: Efficient time-range queries on `audit_logs.created_at`
- **Secure Retention Policy**: Automated cleanup with 365-day retention
- **Meta-Audit Logging**: Immutable record of all cleanup operations
- **Edge Function Trigger**: Cron-based scheduled execution

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Cron Schedule                            │
│                    (Weekly Sunday 3 AM UTC)                      │
└─────────────────────┬───────────────────────────────────────────┘
                      │ POST + Bearer CRON_SECRET
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Edge Function                                 │
│                 audit-cleanup/index.ts                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 1. Validate CRON_SECRET                                  │    │
│  │ 2. Create service_role client                            │    │
│  │ 3. Call RPC: audit_logs_cleanup_scheduled()              │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────┬───────────────────────────────────────────┘
                      │ service_role JWT
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                PostgreSQL Function                               │
│            audit_logs_cleanup_scheduled()                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Security Checks:                                         │    │
│  │ • Advisory lock (prevent concurrent execution)           │    │
│  │ • 24-hour investigation window                           │    │
│  │ • 50% bulk deletion threshold                            │    │
│  │                                                          │    │
│  │ Batch Deletion:                                          │    │
│  │ • 1000 rows per batch                                    │    │
│  │ • Max 100 batches per run                                │    │
│  │ • SKIP LOCKED for concurrent safety                      │    │
│  │ • 50ms yield between batches                             │    │
│  │                                                          │    │
│  │ Meta-Audit:                                              │    │
│  │ • Log cleanup to audit_cleanup_log                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260204_audit_logs_brin_index.sql` | BRIN index for time-range queries |
| `supabase/migrations/20260204_audit_cleanup_log.sql` | Immutable meta-audit table |
| `supabase/migrations/20260204_audit_logs_retention_secure.sql` | Secure cleanup function |
| `supabase/functions/audit-cleanup/index.ts` | Edge Function for cron trigger |

## Security Model

### Access Control

| Role | Access |
|------|--------|
| `service_role` | Can execute cleanup function |
| `authenticated` | **NO ACCESS** - explicitly revoked |
| `PUBLIC` | **NO ACCESS** - explicitly revoked |

### Security Features

1. **Hardcoded Retention Period**
   - 365 days is a compile-time constant
   - Cannot be changed at runtime via parameters
   - Prevents malicious parameter injection

2. **24-Hour Investigation Window**
   - Logs from the last 24 hours are NEVER deleted
   - Preserves evidence during active incident investigations

3. **50% Bulk Deletion Threshold**
   - Cleanup is blocked if >50% of records would be deleted
   - Prevents accidental mass data loss
   - **Exception**: First run (empty `audit_cleanup_log`) bypasses this check
   - This allows initial deployment to systems with existing data

4. **Advisory Lock**
   - `pg_advisory_xact_lock` prevents concurrent execution
   - Only one cleanup can run at a time

5. **Meta-Audit Logging**
   - Every cleanup operation is logged to `audit_cleanup_log`
   - Table is append-only (UPDATE/DELETE revoked from all roles)
   - Required for healthcare compliance auditing

6. **Not in RPC Whitelist (Intentional - System Function)**
   - Function is NOT added to `ALLOWED_FUNCTIONS` in `/api/rpc/[fn]/route.ts`
   - Cannot be called through the application's RPC proxy
   - Only accessible via `service_role` from Edge Function (backend-to-backend)

   **Note**: This does NOT violate the project's RPC-only security model. The RPC-only
   architecture in CLAUDE.md applies to **user-initiated requests** (Client → callRpc →
   RPC proxy). System functions like audit cleanup are **backend-initiated** via cron/Edge
   Function with `SUPABASE_SERVICE_ROLE_KEY`, which is the correct pattern for privileged
   operations that should never be user-callable. Adding this to the whitelist would
   REDUCE security by exposing a destructive function to authenticated users.

## Deployment Instructions

### Step 1: Apply Migrations

Review the migration files, then apply them in order:

```sql
-- Option A: Via Supabase Dashboard SQL Editor
-- Run each migration file in order:
-- 1. 20260204_audit_cleanup_log.sql (table must exist first)
-- 2. 20260204_audit_logs_brin_index.sql
-- 3. 20260204_audit_logs_retention_secure.sql

-- Option B: Via Supabase MCP (if available)
-- The migrations will be applied automatically
```

### Step 2: Generate CRON_SECRET

```bash
# Generate a secure random secret
openssl rand -base64 32

# Example output: K7xR2mN9pQ4wL6yT8vB3cF5hJ1kM0nS2dG4eA7iU9oP=
```

Save this value securely - you'll need it for Step 3 and Step 5.

### Step 3: Set Supabase Secrets

```bash
# Set the cron secret in Supabase
npx supabase secrets set CRON_SECRET="YOUR_GENERATED_SECRET"

# Verify secrets are set
npx supabase secrets list
```

### Step 4: Deploy Edge Function

```bash
# Deploy the audit-cleanup function
npx supabase functions deploy audit-cleanup

# Verify deployment
npx supabase functions list
```

### Step 5: Configure Cron Schedule

**Option A: Supabase Dashboard (Recommended)**

1. Go to Supabase Dashboard > Edge Functions
2. Find `audit-cleanup` function
3. Click "Add Schedule"
4. Set cron expression: `0 3 * * 0` (Weekly Sunday 3 AM UTC)
5. Set HTTP method: `POST`
6. Add header: `Authorization: Bearer YOUR_CRON_SECRET`

**Option B: External Cron Service (Vercel, Railway, etc.)**

```bash
# Weekly Sunday 3 AM UTC
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/audit-cleanup \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Verification

### 1. Verify BRIN Index

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'audit_logs' AND indexname LIKE '%brin%';

-- Expected: idx_audit_logs_created_at_brin
```

### 2. Verify Cleanup Log Table

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'audit_cleanup_log'
ORDER BY ordinal_position;

-- Expected columns: id, executed_at, retention_days, cutoff_date,
--                   deleted_count, oldest_remaining, executed_by
```

### 3. Verify Function Permissions

```sql
-- This should FAIL for authenticated users
SET ROLE authenticated;
SELECT * FROM audit_logs_cleanup_scheduled();
-- Expected: ERROR: permission denied for function audit_logs_cleanup_scheduled

-- Reset role
RESET ROLE;
```

### 4. Test Cleanup (Dry Run)

```sql
-- Check what would be deleted (without actually deleting)
SELECT
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '1 year') as would_delete,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM audit_logs;
```

### 5. Manual Cleanup Test

```sql
-- Run cleanup manually (requires service_role connection)
-- Connect with service_role key, then:
SELECT * FROM audit_logs_cleanup_scheduled();

-- Verify cleanup was logged
SELECT * FROM audit_cleanup_log ORDER BY executed_at DESC LIMIT 5;
```

### 6. Test Edge Function

```bash
# Test the Edge Function (replace with your values)
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/audit-cleanup \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -v

# Expected response:
# {"success":true,"result":[{"deleted_count":0,"oldest_remaining":"2025-01-01T00:00:00Z","batches_executed":1}]}
```

## Monitoring

### View Cleanup History

```sql
SELECT
  executed_at,
  retention_days,
  deleted_count,
  oldest_remaining,
  executed_by
FROM audit_cleanup_log
ORDER BY executed_at DESC
LIMIT 10;
```

### Check Table Size

```sql
SELECT
  pg_size_pretty(pg_total_relation_size('audit_logs')) as total_size,
  pg_size_pretty(pg_relation_size('audit_logs')) as table_size,
  pg_size_pretty(pg_indexes_size('audit_logs')) as indexes_size,
  (SELECT COUNT(*) FROM audit_logs) as row_count,
  (SELECT MIN(created_at) FROM audit_logs) as oldest,
  (SELECT MAX(created_at) FROM audit_logs) as newest;
```

### Check Index Usage

```sql
SELECT
  indexrelname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE relname = 'audit_logs';
```

## Troubleshooting

### Cleanup Function Fails with "Bulk deletion blocked"

**Cause**: More than 50% of records would be deleted, AND this is not the first cleanup run.

**Note**: The first cleanup run (detected by empty `audit_cleanup_log`) is allowed to exceed
the 50% threshold. This handles the common case of deploying to systems with existing data
where all records older than 1 year need to be cleaned up initially.

**If this happens on subsequent runs**, it indicates unusual data growth patterns:

```sql
-- Check the distribution
SELECT
  date_trunc('month', created_at) as month,
  COUNT(*) as records
FROM audit_logs
GROUP BY 1
ORDER BY 1;

-- Check if cleanup has run before
SELECT COUNT(*) as cleanup_runs FROM audit_cleanup_log;
```

**Solutions**:
1. If cleanup has never run (`cleanup_runs = 0`), the function should allow it automatically
2. If cleanup HAS run before but is now blocked, investigate why so many old records exist
3. For intentional large deletions, you can manually delete in batches:
   ```sql
   -- Delete oldest month manually (repeat as needed)
   DELETE FROM audit_logs
   WHERE created_at < (SELECT MIN(created_at) + INTERVAL '1 month' FROM audit_logs);
   ```

### Edge Function Returns 401 Unauthorized

**Cause**: CRON_SECRET mismatch or missing.

**Solution**:
1. Verify the secret is set: `npx supabase secrets list`
2. Ensure the Authorization header uses `Bearer ` prefix
3. Regenerate and reset the secret if needed

### Edge Function Returns 500 Error

**Cause**: Database function error or connection issue.

**Solution**:
1. Check Edge Function logs in Supabase Dashboard
2. Verify the function exists: `SELECT proname FROM pg_proc WHERE proname = 'audit_logs_cleanup_scheduled';`
3. Check if migrations were applied correctly

### BRIN Index Not Being Used

**Cause**: Query planner chooses different path.

**Solution**:
```sql
-- Check if statistics are up to date
ANALYZE audit_logs;

-- Force index usage for testing
SET enable_seqscan = off;
EXPLAIN ANALYZE SELECT * FROM audit_logs
WHERE created_at > NOW() - INTERVAL '7 days';
RESET enable_seqscan;
```

## Healthcare Compliance Notes

### Retention Period

The default 365-day retention is configured for **operational audit logs** only.

For PHI-related audit events, HIPAA requires **6-year retention**. If `audit_logs` contains PHI audit events, adjust the retention period:

```sql
-- In the function, change:
c_retention_days CONSTANT integer := 365;
-- To:
c_retention_days CONSTANT integer := 2190; -- 6 years
```

### Audit Trail Requirements

The `audit_cleanup_log` table provides:
- **What** was deleted (count, date range)
- **When** the deletion occurred
- **Who/What** triggered it (system-cron)
- **Immutability** (no UPDATE/DELETE allowed)

This satisfies audit trail requirements for most healthcare compliance frameworks.

## Configuration Reference

### Function Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `c_retention_days` | 365 | Days to retain audit logs |
| `c_batch_size` | 1000 | Records per deletion batch |
| `c_max_batches` | 100 | Maximum batches per run (100K records max) |

### Cron Schedule

| Schedule | Cron Expression | Description |
|----------|-----------------|-------------|
| Weekly | `0 3 * * 0` | Every Sunday at 3 AM UTC |
| Daily | `0 3 * * *` | Every day at 3 AM UTC |
| Monthly | `0 3 1 * *` | First day of month at 3 AM UTC |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CRON_SECRET` | Yes | Secret for authenticating cron requests |
| `SUPABASE_URL` | Auto | Supabase project URL (auto-populated) |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Service role key (auto-populated) |

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-04 | 1.0.0 | Initial implementation |

---

*Last updated: 2026-02-04*
