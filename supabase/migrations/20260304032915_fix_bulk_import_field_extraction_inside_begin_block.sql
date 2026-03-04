-- Migration: reconcile missing local migration file for live version 20260304032915
-- Name: fix_bulk_import_field_extraction_inside_begin_block
--
-- Context:
--   Live DB already has this migration version in supabase_migrations.schema_migrations,
--   but the corresponding file was missing in this repository branch.
--
-- Purpose:
--   Keep local migration history aligned with live without changing runtime behavior.
--   The functional fix itself is already present in
--   20260303101008_deploy_dinh_muc_nhom_bulk_import.sql.

DO $$
DECLARE
  v_fn_def TEXT;
BEGIN
  SELECT pg_get_functiondef('public.dinh_muc_nhom_bulk_import(jsonb,bigint)'::regprocedure)
  INTO v_fn_def;

  IF position('v_thu_tu_hien_thi := NULLIF(v_item->>''thu_tu_hien_thi'', '''')::INT;' IN v_fn_def) = 0 THEN
    RAISE EXCEPTION 'Expected dinh_muc_nhom_bulk_import to extract fields inside per-item BEGIN block';
  END IF;
END $$;
