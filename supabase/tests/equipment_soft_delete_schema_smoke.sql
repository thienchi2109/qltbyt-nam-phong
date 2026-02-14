-- supabase/tests/equipment_soft_delete_schema_smoke.sql
-- Purpose: smoke checks for equipment soft-delete schema baseline

DO $$
DECLARE
  v_default text;
  v_null_rows bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'thiet_bi'
      AND column_name = 'is_deleted'
  ) THEN
    RAISE EXCEPTION 'Expected public.thiet_bi.is_deleted to exist';
  END IF;

  SELECT c.column_default
  INTO v_default
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'thiet_bi'
    AND c.column_name = 'is_deleted';

  IF v_default IS NULL OR position('false' in lower(v_default)) = 0 THEN
    RAISE EXCEPTION 'Expected is_deleted default to contain false, got: %', v_default;
  END IF;

  EXECUTE 'SELECT COUNT(*) FROM public.thiet_bi WHERE is_deleted IS NULL'
  INTO v_null_rows;

  IF v_null_rows <> 0 THEN
    RAISE EXCEPTION 'Expected zero NULL is_deleted rows, got: %', v_null_rows;
  END IF;

  RAISE NOTICE 'OK: schema smoke checks passed for public.thiet_bi.is_deleted';
END $$;
