-- DEVICE QUOTA UNIFIED IMPORT + ACTIVE BULK GUARD REGRESSION TEST
\echo 'DEVICE QUOTA UNIFIED IMPORT + ACTIVE BULK GUARD REGRESSION TEST'

BEGIN;

-- Guard: bulk import must allow both draft and active decisions.
DO $$
DECLARE
  v_bulk_def text;
BEGIN
  SELECT pg_get_functiondef('public.dinh_muc_chi_tiet_bulk_import(bigint,jsonb,bigint)'::regprocedure)
  INTO v_bulk_def;

  IF position('not in (''draft'', ''active'')' in lower(v_bulk_def)) = 0 THEN
    RAISE EXCEPTION 'Expected dinh_muc_chi_tiet_bulk_import() to allow decision statuses draft + active';
  END IF;
END $$;

-- Guard: unified import function must exist and orchestrate decision + quota imports.
DO $$
DECLARE
  v_unified_sig regprocedure;
  v_unified_def text;
  v_unified_norm text;
  v_insert_columns text;
BEGIN
  v_unified_sig := to_regprocedure('public.dinh_muc_unified_import(jsonb,bigint)');
  IF v_unified_sig IS NULL THEN
    RAISE EXCEPTION 'Expected public.dinh_muc_unified_import(jsonb,bigint) to exist';
  END IF;

  SELECT pg_get_functiondef(v_unified_sig) INTO v_unified_def;
  v_unified_norm := regexp_replace(lower(v_unified_def), '\s+', ' ', 'g');

  IF position('dinh_muc_chi_tiet_bulk_import' in lower(v_unified_def)) = 0 THEN
    RAISE EXCEPTION 'Expected unified import to call dinh_muc_chi_tiet_bulk_import';
  END IF;

  IF position('insert into public.quyet_dinh_dinh_muc' in lower(v_unified_def)) = 0 THEN
    RAISE EXCEPTION 'Expected unified import to create a draft decision before importing line items';
  END IF;

  IF position('''success'', v_bulk_result->>''success''' in lower(v_unified_def)) > 0 THEN
    RAISE EXCEPTION 'Expected unified import to return success as JSON boolean, not text';
  END IF;

  IF position('''success'', v_bulk_result->''success''' in lower(v_unified_def)) = 0 THEN
    RAISE EXCEPTION 'Expected unified import to propagate success as JSON boolean via ->';
  END IF;

  SELECT (regexp_match(
    v_unified_norm,
    'insert into public\.quyet_dinh_dinh_muc\s*\(([^)]*)\)\s*values'
  ))[1] INTO v_insert_columns;

  IF v_insert_columns IS NULL THEN
    RAISE EXCEPTION 'Expected unified import to include explicit INSERT column list for quyet_dinh_dinh_muc';
  END IF;

  -- Guard: INSERT column list must include nguoi_ky (NOT NULL column on quyet_dinh_dinh_muc)
  IF v_insert_columns !~ '(^|,\s*)nguoi_ky(\s*,|$)' THEN
    RAISE EXCEPTION 'Expected unified import INSERT columns to include nguoi_ky (NOT NULL column)';
  END IF;

  -- Guard: INSERT column list must include chuc_vu_nguoi_ky (NOT NULL column on quyet_dinh_dinh_muc)
  IF v_insert_columns !~ '(^|,\s*)chuc_vu_nguoi_ky(\s*,|$)' THEN
    RAISE EXCEPTION 'Expected unified import INSERT columns to include chuc_vu_nguoi_ky (NOT NULL column)';
  END IF;
END $$;

ROLLBACK;
