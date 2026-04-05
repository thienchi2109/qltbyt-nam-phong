# Supabase Tenant-Scoped RPC Template

Use this template when adding a new tenant-scoped `SECURITY DEFINER` RPC. The goal is to make the scope model explicit so reviewers do not force the wrong JWT-guard pattern onto modules that support `regional_leader`.

## Before You Start

- Find the nearest existing detail/list RPC for the same module.
- Confirm whether the role model is:
  - single-tenant via `don_vi`
  - multi-tenant via `allowed_don_vi_for_session()` / `dia_ban`
- If `regional_leader` is allowed, do not add an outer `v_don_vi IS NULL` guard unless the existing module contract already requires it.

## Checklist

- [ ] `BEGIN; ... COMMIT;`
- [ ] Header comment explains why the RPC exists
- [ ] `SECURITY DEFINER`
- [ ] `SET search_path = public, pg_temp`
- [ ] `GRANT EXECUTE ... TO authenticated`
- [ ] `REVOKE EXECUTE ... FROM PUBLIC`
- [ ] `v_jwt_claims`, `v_role`, `v_user_id` extracted with `COALESCE(..., '{}')::jsonb`
- [ ] `v_role` guard
- [ ] `v_user_id` guard
- [ ] `admin -> global` normalization if the RPC can run outside proxy assumptions
- [ ] Third scope guard matches the actual role model
- [ ] `regional_leader` write paths explicitly denied when the RPC mutates data
- [ ] Post-migration smoke script covers authorized scope, blocked scope, and role-specific exceptions

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
