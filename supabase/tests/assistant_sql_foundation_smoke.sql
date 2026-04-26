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

-- 5) Equipment reporting surface should expose governed wide dimensions.
DO $$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_remove(array[
    CASE
      WHEN NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'ai_readonly'
          AND table_name = 'equipment_search'
          AND column_name = 'nguoi_dang_truc_tiep_quan_ly'
      ) THEN 'equipment_search.nguoi_dang_truc_tiep_quan_ly'
    END,
    CASE
      WHEN NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'ai_readonly'
          AND table_name = 'equipment_search'
          AND column_name = 'vi_tri_lap_dat'
      ) THEN 'equipment_search.vi_tri_lap_dat'
    END,
    CASE
      WHEN NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'ai_readonly'
          AND table_name = 'equipment_search'
          AND column_name = 'phan_loai_theo_nd98'
      ) THEN 'equipment_search.phan_loai_theo_nd98'
    END,
    CASE
      WHEN NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'ai_readonly'
          AND table_name = 'equipment_search'
          AND column_name = 'ngay_dua_vao_su_dung_date'
      ) THEN 'equipment_search.ngay_dua_vao_su_dung_date'
    END,
    CASE
      WHEN NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'ai_readonly'
          AND table_name = 'equipment_search'
          AND column_name = 'ngay_dua_vao_su_dung_year'
      ) THEN 'equipment_search.ngay_dua_vao_su_dung_year'
    END,
    CASE
      WHEN NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'ai_readonly'
          AND table_name = 'equipment_search'
          AND column_name = 'ngay_dua_vao_su_dung_month'
      ) THEN 'equipment_search.ngay_dua_vao_su_dung_month'
    END,
    CASE
      WHEN NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'ai_readonly'
          AND table_name = 'equipment_search'
          AND column_name = 'ngay_dua_vao_su_dung_quarter'
      ) THEN 'equipment_search.ngay_dua_vao_su_dung_quarter'
    END
  ], NULL)
  INTO v_missing;

  IF coalesce(array_length(v_missing, 1), 0) > 0 THEN
    RAISE EXCEPTION 'Missing wide equipment reporting columns: %', array_to_string(v_missing, ', ');
  END IF;

  RAISE NOTICE 'OK: equipment_search exposes wide reporting dimensions';
END $$;

-- 6) With a real facility scope, the wide reporting dimensions should support grouping.
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
    RAISE EXCEPTION 'Cannot run grouping smoke: no active don_vi rows found';
  END IF;

  PERFORM set_config('app.current_facility_id', v_facility_id::text, true);

  SELECT count(*) INTO v_count
  FROM (
    SELECT nguoi_dang_truc_tiep_quan_ly, COUNT(*) AS so_luong
    FROM ai_readonly.equipment_search
    GROUP BY nguoi_dang_truc_tiep_quan_ly
  ) grouped_manager;

  SELECT count(*) INTO v_count
  FROM (
    SELECT ngay_dua_vao_su_dung_year, COUNT(*) AS so_luong
    FROM ai_readonly.equipment_search
    GROUP BY ngay_dua_vao_su_dung_year
  ) grouped_usage_year;

  RAISE NOTICE 'OK: equipment_search wide reporting dimensions support grouping';
END $$;
