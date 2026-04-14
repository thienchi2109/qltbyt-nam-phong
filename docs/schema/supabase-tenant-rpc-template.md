# Supabase SQL Migration Pattern

Use this pattern when adding or replacing Supabase SQL, especially tenant-scoped
`SECURITY DEFINER` RPCs. The goal is to make live database assumptions explicit
so agents do not miss grants, JWT guards, search paths, tenant scope, indexes, or
post-migration verification.

## Before You Start

- Find the nearest existing detail/list RPC for the same module.
- Query the live database for the current function definition, grants, indexes,
  and column types before replacing an existing RPC.
- Compare the local migration plan with live behavior; preserve compatible
  contracts unless the OpenSpec change explicitly requires a breaking change.
- Confirm whether the role model is:
  - single-tenant via `don_vi`
  - multi-tenant via `allowed_don_vi_for_session()` / `dia_ban`
- If `regional_leader` is allowed, do not add an outer `v_don_vi IS NULL` guard unless the existing module contract already requires it.
- If a prior user instruction says not to apply a migration yet, create and test
  the migration file only; wait for explicit approval before calling
  Supabase MCP `apply_migration`.

## Standard Flow

1. Read the nearest existing migration and smoke test for the same module.
2. Query live DB state before writing SQL:

   ```sql
   SELECT p.oid::regprocedure::text AS signature,
          p.prosecdef AS security_definer,
          p.proconfig,
          pg_get_functiondef(p.oid) AS function_definition
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'example_tenant_rpc';

   SELECT grantee, privilege_type
   FROM information_schema.routine_privileges
   WHERE routine_schema = 'public'
     AND routine_name = 'example_tenant_rpc'
   ORDER BY grantee, privilege_type;
   ```

3. Write the SQL smoke test first. Wrap it in `BEGIN; ... ROLLBACK;` and make
   it fail for the intended missing behavior before changing the migration.
4. Write the migration with a header comment, explicit function signature,
   `SECURITY DEFINER`, `SET search_path = public, pg_temp`, JWT guards, scope
   guards, and grants that match the intended access contract.
5. Run the focused smoke test until green. For MCP execution, paste the smoke
   SQL through `execute_sql` only if it is transaction-wrapped and rolls back.
6. Apply only after approval when approval was requested. Use Supabase MCP
   `apply_migration` for DDL when migration history is drifted.
7. After applying, run the smoke test again against live DB and run
   Supabase MCP `get_advisors(security)`. Run `get_advisors(performance)` when
   the migration adds or changes filtered, sorted, or joined queries.
8. Verify the applied function shape and grants from live DB. Note: MCP
   `apply_migration` may record a generated version timestamp while storing the
   local migration filename stem as the migration `name`; confirm with
   `list_migrations`.

## Checklist

- [ ] `BEGIN; ... COMMIT;`
- [ ] Header comment explains why the RPC exists
- [ ] Live function definition/grants/indexes were queried before replacement
- [ ] `SECURITY DEFINER`
- [ ] `SET search_path = public, pg_temp`
- [ ] Existing RPC grants are preserved when replacing a function, unless the
      spec intentionally changes access
- [ ] New authenticated-only RPCs use `GRANT EXECUTE ... TO authenticated`
- [ ] `REVOKE EXECUTE ... FROM PUBLIC`
- [ ] `v_jwt_claims`, `v_role`, `v_user_id` extracted with `COALESCE(..., '{}')::jsonb`
- [ ] `v_role` guard
- [ ] `v_user_id` guard
- [ ] `admin -> global` normalization if the RPC can run outside proxy assumptions
- [ ] Third scope guard matches the actual role model
- [ ] `regional_leader` write paths explicitly denied when the RPC mutates data
- [ ] LIKE/ILIKE user input uses `_sanitize_ilike_pattern()`
- [ ] No `SELECT *`; fetch only columns needed by the payload
- [ ] New filters, sorts, and joins either use existing indexes or add a justified index
- [ ] JSON payload keys intentionally match the frontend contract, usually camelCase
- [ ] Post-migration smoke script covers authorized scope, blocked scope, and role-specific exceptions
- [ ] Post-apply `get_advisors(security)` was reviewed; pre-existing advisor noise is separated from new migration risk

## Template

```sql
BEGIN;

CREATE OR REPLACE FUNCTION public.example_tenant_rpc(p_id INT)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_claims JSONB := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb;
  v_role TEXT;
  v_user_id TEXT;
  v_is_global BOOLEAN := FALSE;
  v_allowed BIGINT[] := NULL;
BEGIN
  v_role := lower(COALESCE(
    NULLIF(v_jwt_claims->>'app_role', ''),
    NULLIF(v_jwt_claims->>'role', ''),
    ''
  ));
  v_user_id := NULLIF(COALESCE(v_jwt_claims->>'user_id', v_jwt_claims->>'sub'), '');

  IF v_role = '' THEN
    RAISE EXCEPTION 'Missing role claim' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user_id claim' USING ERRCODE = '42501';
  END IF;

  IF v_role = 'admin' THEN
    v_role := 'global';
  END IF;
  v_is_global := (v_role = 'global');

  -- Choose one of the two scope patterns below.

  -- Pattern A: single-tenant roles require a direct don_vi claim
  -- DECLARE v_don_vi BIGINT := NULLIF(v_jwt_claims->>'don_vi', '')::BIGINT;
  -- IF NOT v_is_global AND v_don_vi IS NULL THEN
  --   RAISE EXCEPTION 'Missing don_vi claim' USING ERRCODE = '42501';
  -- END IF;

  -- Pattern B: multi-tenant roles (for example regional_leader) derive scope
  -- through the approved helper. Do not add a direct outer don_vi guard if
  -- valid sessions may have don_vi = NULL.
  IF NOT v_is_global THEN
    v_allowed := public.allowed_don_vi_for_session();
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RAISE EXCEPTION 'Resource not found or access denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.example_tenant_rpc(INT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.example_tenant_rpc(INT) FROM PUBLIC;

COMMIT;
```

## Reviewer Notes To Leave In The Migration

Add a short comment when using helper-based scope:

```sql
-- NOTE: this RPC intentionally relies on allowed_don_vi_for_session() instead
-- of an outer v_don_vi NULL guard because regional_leader access is derived
-- from dia_ban and valid sessions may have don_vi = NULL.
```

That one note prevents future review churn.

Add a short comment when preserving existing grants that are broader than the
default authenticated-only template:

```sql
-- NOTE: this replaces an existing report RPC. Preserve the live EXECUTE grants
-- for anon/authenticated/service_role to avoid changing the established access
-- contract; JWT guards inside the SECURITY DEFINER function still enforce scope.
```
