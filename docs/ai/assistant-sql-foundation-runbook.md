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

After the migration is applied to the target Supabase project, create the passworded login role manually from a privileged database session. On hosted Supabase, that means using the SQL editor or a direct `psql`/admin session with enough privileges to run `CREATE ROLE`; do not try to create this role through `service_role` or an app-facing API.

```sql
do $$
begin
  if not exists (
    select 1
    from pg_roles
    where rolname = 'ai_query_tool'
  ) then
    create role ai_query_tool
      login
      password 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD'
      in role ai_query_reader;
  end if;
end
$$;

grant ai_query_reader to ai_query_tool;
grant connect on database postgres to ai_query_tool;

alter role ai_query_tool set default_transaction_read_only = on;
alter role ai_query_tool set statement_timeout = '5s';
alter role ai_query_tool set idle_in_transaction_session_timeout = '5s';
alter role ai_query_tool set search_path = ai_readonly, pg_catalog;
```

Notes:
- keep `ai_query_tool` dedicated to assistant SQL only
- never reuse `service_role`, `anon`, or app-user credentials
- store the password in the team secret manager and rotate it there before updating `AI_DATABASE_URL`
- runtime code should still issue `SET LOCAL search_path = ai_readonly, pg_catalog` per transaction as defense in depth

## Environment Contract

Set `AI_DATABASE_URL` to the exact Supabase transaction-pooler connection string shown in the project dashboard (`Connect` -> `Transaction pooler`), then swap in the dedicated `ai_query_tool` credentials:

```text
postgresql://ai_query_tool:<PASSWORD>@<transaction-pooler-host>:6543/postgres?sslmode=require
```

Use:
- transaction pooler (`:6543`) for serverless runtime
- SSL required
- copy the exact hostname/username format from the Supabase dashboard instead of assuming a single pooler host pattern
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
