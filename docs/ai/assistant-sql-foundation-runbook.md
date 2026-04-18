# Assistant SQL Foundation Runbook

This runbook covers the manual provisioning steps for the dormant assistant SQL foundation introduced by Issue `#271`.

## Purpose

The application stays RPC-first. This SQL foundation exists only for a future server-only assistant path and is intentionally not wired into `/api/chat` yet.

The migration creates:
- `ai_readonly` schema
- facility-scope helper functions
- approved read-only semantic views
- `ai_query_reader` grant role

The migration does **not** create a passworded login role, because credentials must not live in git.

## Manual Role Provisioning

After the migration is applied to the target Supabase project, create the passworded login role manually in SQL editor or via a privileged database session:

```sql
create role ai_query_tool
  login
  password 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD'
  in role ai_query_reader;

grant connect on database postgres to ai_query_tool;

alter role ai_query_tool set default_transaction_read_only = on;
alter role ai_query_tool set statement_timeout = '5s';
alter role ai_query_tool set idle_in_transaction_session_timeout = '5s';
alter role ai_query_tool set search_path = ai_readonly, pg_catalog;
```

Notes:
- keep `ai_query_tool` dedicated to assistant SQL only
- never reuse `service_role`, `anon`, or app-user credentials
- runtime code should still issue `SET LOCAL search_path = ai_readonly, pg_catalog` per transaction as defense in depth

## Environment Contract

Set `AI_DATABASE_URL` to the Supabase transaction-pooler URL for `ai_query_tool`:

```text
postgresql://ai_query_tool:<PASSWORD>@db.<project-ref>.supabase.co:6543/postgres?sslmode=require
```

Use:
- transaction pooler (`:6543`) for serverless runtime
- SSL required
- prepared statements disabled in the future executor (`prepare: false`)

## Local Verification

After applying the migration and creating the login role, run:

```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/assistant_sql_foundation_smoke.sql
```

That smoke script verifies:
- `ai_readonly` schema and approved views exist
- `ai_query_reader` can read only the semantic layer
- raw `public` table access is not granted
- missing `app.current_facility_id` fails closed
- semantic views are queryable when a facility scope is injected

## Rollout Boundary

This foundation remains dormant until later batches:
- no runtime `query_database` registration in `/api/chat`
- no planner selection changes
- no audit-execution path yet

Those steps belong to later implementation batches and should not be mixed into the migration rollout.
