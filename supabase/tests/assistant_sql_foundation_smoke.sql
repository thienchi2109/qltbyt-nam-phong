-- Local/DB-admin verification artifact for Issue #271 Batch 2.
-- How to run (after applying the migration on a linked Supabase DB):
--   psql "$SUPABASE_DB_URL" -f supabase/tests/assistant_sql_foundation_smoke.sql
--
-- This script is intentionally local-only and should not be wired into CI.

-- 1) Existence checks: schema, role, helpers, and approved views.
DO $$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_remove(array[
    CASE WHEN to_regnamespace('ai_readonly') IS NULL THEN 'schema ai_readonly' END,
    CASE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_query_reader') THEN 'role ai_query_reader' END,
    CASE WHEN to_regprocedure('ai_readonly.current_facility_id()') IS NULL THEN 'function ai_readonly.current_facility_id()' END,
    CASE WHEN to_regprocedure('ai_readonly.require_single_facility_scope()') IS NULL THEN 'function ai_readonly.require_single_facility_scope()' END,
    CASE WHEN to_regclass('ai_readonly.equipment_search') IS NULL THEN 'view ai_readonly.equipment_search' END,
    CASE WHEN to_regclass('ai_readonly.maintenance_facts') IS NULL THEN 'view ai_readonly.maintenance_facts' END,
    CASE WHEN to_regclass('ai_readonly.repair_facts') IS NULL THEN 'view ai_readonly.repair_facts' END,
    CASE WHEN to_regclass('ai_readonly.usage_facts') IS NULL THEN 'view ai_readonly.usage_facts' END,
    CASE WHEN to_regclass('ai_readonly.quota_facts') IS NULL THEN 'view ai_readonly.quota_facts' END
  ], NULL)
  INTO v_missing;

  IF coalesce(array_length(v_missing, 1), 0) > 0 THEN
    RAISE EXCEPTION 'Missing assistant SQL foundation artifacts: %', array_to_string(v_missing, ', ');
  END IF;

  RAISE NOTICE 'OK: ai_readonly schema, helpers, role, and views exist';
END $$;

-- 2) Privilege checks: role can read semantic layer and cannot read/mutate base tables.
DO $$
BEGIN
  IF NOT has_schema_privilege('ai_query_reader', 'ai_readonly', 'USAGE') THEN
    RAISE EXCEPTION 'ai_query_reader is missing USAGE on ai_readonly';
  END IF;

  IF NOT has_table_privilege('ai_query_reader', 'ai_readonly.equipment_search', 'SELECT') THEN
    RAISE EXCEPTION 'ai_query_reader is missing SELECT on ai_readonly.equipment_search';
  END IF;

  IF NOT has_table_privilege('ai_query_reader', 'ai_readonly.maintenance_facts', 'SELECT') THEN
    RAISE EXCEPTION 'ai_query_reader is missing SELECT on ai_readonly.maintenance_facts';
  END IF;

  IF NOT has_table_privilege('ai_query_reader', 'ai_readonly.repair_facts', 'SELECT') THEN
    RAISE EXCEPTION 'ai_query_reader is missing SELECT on ai_readonly.repair_facts';
  END IF;

  IF NOT has_table_privilege('ai_query_reader', 'ai_readonly.usage_facts', 'SELECT') THEN
    RAISE EXCEPTION 'ai_query_reader is missing SELECT on ai_readonly.usage_facts';
  END IF;

  IF NOT has_table_privilege('ai_query_reader', 'ai_readonly.quota_facts', 'SELECT') THEN
    RAISE EXCEPTION 'ai_query_reader is missing SELECT on ai_readonly.quota_facts';
  END IF;

  IF has_table_privilege('ai_query_reader', 'public.thiet_bi', 'SELECT') THEN
    RAISE EXCEPTION 'ai_query_reader must not have SELECT on public.thiet_bi';
  END IF;

  IF has_table_privilege('ai_query_reader', 'public.thiet_bi', 'INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'ai_query_reader must not have write privileges on public.thiet_bi';
  END IF;

  RAISE NOTICE 'OK: ai_query_reader privileges are limited to ai_readonly views';
END $$;

-- 3) Missing scope must fail closed.
DO $$
BEGIN
  PERFORM set_config('app.current_facility_id', '', true);

  BEGIN
    PERFORM 1 FROM ai_readonly.equipment_search LIMIT 1;
    RAISE EXCEPTION 'Expected ai_readonly.equipment_search to fail without app.current_facility_id';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = '42501' THEN
      RAISE NOTICE 'OK: missing facility scope fails closed';
    ELSE
      RAISE;
    END IF;
  END;
END $$;

-- 4) With a real facility scope, the semantic layer should be queryable.
DO $$
DECLARE
  v_facility_id bigint;
  v_count bigint;
BEGIN
  SELECT id
  INTO v_facility_id
  FROM public.don_vi
  WHERE active = true
  ORDER BY id
  LIMIT 1;

  IF v_facility_id IS NULL THEN
    RAISE EXCEPTION 'Cannot run smoke: no active don_vi rows found';
  END IF;

  PERFORM set_config('app.current_facility_id', v_facility_id::text, true);

  SELECT count(*) INTO v_count FROM ai_readonly.equipment_search;
  SELECT count(*) INTO v_count FROM ai_readonly.maintenance_facts;
  SELECT count(*) INTO v_count FROM ai_readonly.repair_facts;
  SELECT count(*) INTO v_count FROM ai_readonly.usage_facts;
  SELECT count(*) INTO v_count FROM ai_readonly.quota_facts;

  RAISE NOTICE 'OK: ai_readonly views are queryable with app.current_facility_id=%', v_facility_id;
END $$;
